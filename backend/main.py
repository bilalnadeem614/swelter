import asyncio

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from fortyguard_client import FortyGuardClient
from gemini_reasoning import decide
from supabase_client import supabase

app = FastAPI(title="Swelter")

# ponytail: allow all origins, this is a public read-only API with no auth cookies —
# tighten to the deployed frontend origin only if that changes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# leaves headroom under Vercel's 60s function limit for the Supabase writes bookending the wait
CHECK_HEAT_BUDGET_S = 50.0


def _risk_level(temp_f: float) -> str:
    # ponytail: simple threshold placeholder, not OSHA-calibrated — refine once real reasoning
    # (Step 4) takes over risk assessment
    if temp_f >= 115:
        return "extreme"
    if temp_f >= 105:
        return "high"
    if temp_f >= 95:
        return "moderate"
    return "low"


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/zones")
async def list_zones():
    resp = supabase.table("zones").select("*").eq("active", True).execute()
    return resp.data


@app.get("/api/decisions")
async def list_decisions(zone_id: str | None = Query(default=None), limit: int = Query(default=20, le=100)):
    query = supabase.table("decisions").select("*").order("created_at", desc=True).limit(limit)
    if zone_id:
        query = query.eq("zone_id", zone_id)
    return query.execute().data


@app.get("/api/decisions/latest")
async def latest_decisions():
    rows = supabase.table("decisions").select("*").order("created_at", desc=True).execute().data
    latest_by_zone: dict[str, dict] = {}
    for row in rows:
        latest_by_zone.setdefault(row["zone_id"], row)
    return list(latest_by_zone.values())


async def _process_zone(client: FortyGuardClient, zone: dict) -> bool:
    """Fetch + write one zone's reading and decision. Returns True if processed, False if skipped."""
    current_temp_f, forecast_12h = await asyncio.gather(
        client.get_current_temp_f(zone["lat"], zone["lng"]),
        client.get_forecast_12h(zone["lat"], zone["lng"]),
    )
    if current_temp_f is None:
        return False

    reading = (
        supabase.table("readings")
        .insert(
            {
                "zone_id": zone["id"],
                "temperature_f": current_temp_f,
                "risk_level": _risk_level(current_temp_f),
                "forecast_12h": forecast_12h,
            }
        )
        .execute()
    )
    reading_id = reading.data[0]["id"]

    action, reasoning = await decide(zone["id"], current_temp_f, forecast_12h)

    supabase.table("decisions").insert(
        {
            "zone_id": zone["id"],
            "reading_id": reading_id,
            "action": action,
            "reasoning": reasoning,
            "notified": action != "none",
        }
    ).execute()

    return True


@app.post("/api/check-heat")
async def check_heat(x_check_heat_secret: str = Header(default="")):
    if x_check_heat_secret != settings.CHECK_HEAT_SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")

    zones = supabase.table("zones").select("*").eq("active", True).execute().data
    client = FortyGuardClient(settings.FORTYGUARD_API_KEY)
    try:
        tasks = {asyncio.create_task(_process_zone(client, zone)): zone["id"] for zone in zones}
        done, pending = await asyncio.wait(tasks.keys(), timeout=CHECK_HEAT_BUDGET_S)

        processed, skipped = [], []
        for task in done:
            zone_id = tasks[task]
            (processed if not task.exception() and task.result() else skipped).append(zone_id)
        for task in pending:
            task.cancel()
            skipped.append(tasks[task])

        return {"processed": processed, "skipped": skipped}
    finally:
        await client.aclose()
