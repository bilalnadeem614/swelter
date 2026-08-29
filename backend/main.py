import asyncio

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from fortyguard_client import FortyGuardClient
from gemini_reasoning import answer_question, decide
from schemas import ChatQuestion
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

# ponytail: 2026-08-29 — live testing showed a single FortyGuard job alone taking 31-40s right
# now; env_params running sequentially after get_current_temp_f/get_forecast_12h was pushing
# every zone past CHECK_HEAT_BUDGET_S (0/3 processed, twice in a row on the live deploy).
# Capped so it can't eat the whole budget — best-effort heat index, not a hard requirement.
HEAT_INDEX_TIMEOUT_S = 12.0


def _risk_level(temp_f: float, heat_index_f: float | None) -> str:
    # NWS heat-index categories (Caution/Extreme Caution/Danger/Extreme Danger), collapsed to
    # this app's 4 levels. heat_index_f comes from FortyGuard's own env_params endpoint
    # (official number, no hand-rolled formula) — falls back to raw temp_f if unavailable.
    heat_index_f = heat_index_f if heat_index_f is not None else temp_f
    if heat_index_f >= 125:
        return "extreme"
    if heat_index_f >= 103:
        return "high"
    if heat_index_f >= 90:
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
    # embeds the linked reading (temp/forecast) via Supabase's FK-based select —
    # map popup (Day 3 Step 1) needs both without a second round trip
    rows = (
        supabase.table("decisions")
        .select("*, reading:readings(temperature_f, forecast_12h, fetched_at)")
        .order("created_at", desc=True)
        .execute()
        .data
    )
    latest_by_zone: dict[str, dict] = {}
    for row in rows:
        if row["zone_id"] not in latest_by_zone:
            latest_by_zone[row["zone_id"]] = row
        elif "previous_temperature_f" not in latest_by_zone[row["zone_id"]]:
            # second row seen per zone (rows are already sorted newest-first) — trend indicator
            reading = row.get("reading")
            latest_by_zone[row["zone_id"]]["previous_temperature_f"] = reading["temperature_f"] if reading else None
    return list(latest_by_zone.values())


@app.post("/api/chat")
async def chat(body: ChatQuestion):
    # Stretch A (pulled forward from Day 4): read-only, grounded in live zone/decision data —
    # does not write to `decisions`, this is a query not a new autonomous decision
    return {"answer": await answer_question(body.question)}


async def _process_zone(client: FortyGuardClient, zone: dict) -> bool:
    """Fetch + write one zone's reading and decision. Returns True if processed, False if skipped."""
    current_temp_f, forecast_12h = await asyncio.gather(
        client.get_current_temp_f(zone["lat"], zone["lng"]),
        client.get_forecast_12h(zone["lat"], zone["lng"]),
    )
    if current_temp_f is None:
        return False

    # must run after get_current_temp_f (env_params needs its temp value) — see
    # get_heat_index_f docstring comment for the resulting latency tradeoff. Capped so a slow
    # env_params job can't burn the whole zone's share of CHECK_HEAT_BUDGET_S — best-effort,
    # falls back to raw temp_f in _risk_level if it doesn't finish in time.
    try:
        heat_index_f = await asyncio.wait_for(
            client.get_heat_index_f(zone["lat"], zone["lng"], current_temp_f), timeout=HEAT_INDEX_TIMEOUT_S
        )
    except asyncio.TimeoutError:
        heat_index_f = None

    reading = (
        supabase.table("readings")
        .insert(
            {
                "zone_id": zone["id"],
                "temperature_f": current_temp_f,
                "risk_level": _risk_level(current_temp_f, heat_index_f),
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
