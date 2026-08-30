import asyncio
from datetime import datetime, timezone

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from fortyguard_client import FortyGuardClient
from gemini_reasoning import answer_question, decide
from push_notify import notify_all
from schemas import ChatQuestion, ConfirmDecisionResponse, PushSubscription
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

# leaves headroom under Vercel's 60s function limit for the Supabase writes bookending the wait.
# 2026-08-30 — confirmed Hobby plan, 60s is a hard ceiling (can't be raised via vercel.json on
# this plan), so this can't go higher. Bumped 50 -> 55 only because HEAT_INDEX_TIMEOUT_S below
# was cut in the same change, keeping total headroom roughly where it was.
CHECK_HEAT_BUDGET_S = 55.0

# ponytail: 2026-08-29 — live testing showed a single FortyGuard job alone taking 31-40s right
# now; env_params running sequentially after get_current_temp_f/get_forecast_12h was pushing
# every zone past CHECK_HEAT_BUDGET_S (0/3 processed, twice in a row on the live deploy).
# Capped so it can't eat the whole budget — best-effort heat index, not a hard requirement.
# 2026-08-30 — re-measured live: get_current_temp_f + get_forecast_12h (concurrent) alone took
# ~42s, i.e. FortyGuard's own latency now eats nearly the entire budget even for ONE zone with
# zero contention (the per-zone split fixed cross-zone contention, but not this). Cut from 12
# to 6 to leave real room for decide()/writes/push after it — heat index is still attempted,
# just can't eat as much of an already-tight budget. Falls back to raw temp_f either way.
HEAT_INDEX_TIMEOUT_S = 6.0

# push fan-out must never be why a zone gets reported "skipped" when its reading/decision
# were already written — bounded and swallowed, same pattern as HEAT_INDEX_TIMEOUT_S.
# Cut 8 -> 5 in the same 2026-08-30 pass, same reason: less budget to spare now that Gemini
# can spend up to 3x GEMINI_TIMEOUT_S rotating through backup keys.
PUSH_TIMEOUT_S = 5.0


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


@app.patch("/api/decisions/{decision_id}/confirm")
async def confirm_decision(decision_id: str) -> ConfirmDecisionResponse:
    # Human audit annotation only — does not touch decide() or /api/check-heat, and this
    # endpoint has no auth (same open trust model as the rest of the API surface today).
    existing = supabase.table("decisions").select("id, field_confirmed_at").eq("id", decision_id).execute().data
    if not existing:
        raise HTTPException(status_code=404, detail="decision not found")
    if existing[0]["field_confirmed_at"]:
        return existing[0]

    confirmed_at = datetime.now(timezone.utc).isoformat()
    row = (
        supabase.table("decisions")
        .update({"field_confirmed_at": confirmed_at})
        .eq("id", decision_id)
        .execute()
        .data
    )
    return row[0]


@app.get("/api/push/public-key")
async def push_public_key():
    return {"publicKey": settings.VAPID_PUBLIC_KEY}


@app.post("/api/push/subscribe")
async def push_subscribe(body: PushSubscription):
    # public, no auth — same open trust model as the rest of the API surface. Upsert on
    # endpoint so re-subscribing (e.g. after clearing site data) doesn't duplicate rows.
    supabase.table("push_subscriptions").upsert(
        {"endpoint": body.endpoint, "p256dh": body.keys.p256dh, "auth": body.keys.auth},
        on_conflict="endpoint",
    ).execute()
    return {"ok": True}


@app.post("/api/chat")
async def chat(body: ChatQuestion):
    # Stretch A (pulled forward from Day 4): read-only, grounded in live zone/decision data —
    # does not write to `decisions`, this is a query not a new autonomous decision.
    # zone_id (set from the zone detail page) scopes the agent to that one site's data only.
    zone_id = str(body.zone_id) if body.zone_id else None
    return {"answer": await answer_question(body.question, zone_id)}


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

    if action != "none":
        # pywebpush is a blocking (requests-based) call — run off the event loop so one slow
        # or unreachable push endpoint can't stall the other zones' check-heat cycle. Bounded
        # and best-effort: the reading/decision above are already written, so a slow or failed
        # push must never flip this zone to "skipped" in the response.
        try:
            await asyncio.wait_for(asyncio.to_thread(notify_all, zone["name"], action, reasoning), timeout=PUSH_TIMEOUT_S)
        except asyncio.TimeoutError:
            pass

    return True


@app.post("/api/check-heat")
async def check_heat(
    zone_id: str | None = Query(default=None),
    x_check_heat_secret: str = Header(default=""),
):
    # zone_id (optional): process just this one zone instead of every active zone.
    # 2026-08-30 — introduced so a single slow/rate-limited zone can't eat the shared
    # CHECK_HEAT_BUDGET_S and cause OTHER zones to get cancelled and reported "skipped"
    # alongside it. Omitted, this behaves exactly as before (all active zones, one shared
    # budget) — GitHub Actions and the frontend's "Check Now" now both call this once per
    # zone instead, see decisions.md.
    if x_check_heat_secret != settings.CHECK_HEAT_SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")

    zones_query = supabase.table("zones").select("*").eq("active", True)
    if zone_id:
        zones_query = zones_query.eq("id", zone_id)
    zones = zones_query.execute().data
    if zone_id and not zones:
        raise HTTPException(status_code=404, detail="zone not found or not active")

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
