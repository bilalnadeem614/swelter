import asyncio
import json
import logging

from google import genai
from google.genai import types

from config import settings
from fortyguard_client import _c_to_f
from schemas import Action
from supabase_client import supabase

logger = logging.getLogger(__name__)

_client = genai.Client(api_key=settings.GEMINI_API_KEY)
_MODEL_NAME = "gemini-3.6-flash"

ALLOWED_ACTIONS = {"none", "alert", "reschedule", "escalate"}
GEMINI_TIMEOUT_S = 8.0

PROMPT_TEMPLATE = """Context:
Previous decisions: {previous_decisions}
Current reading: {current_temp_f} F
12-hr forecast: {forecast_range_f} F

Instructions:
You are an AI heat safety agent monitoring outdoor work conditions. Based on the context above, decide the appropriate action:

none: Conditions normal, no action needed
alert: Heat index approaching hazardous levels, send advisory to check on crews
reschedule: Heat index forecast hazardous, recommend rescheduling outdoor work
escalate: Extreme heat index, notify safety manager immediately

Respond with a JSON object containing:

action: none, alert, reschedule, or escalate
reasoning: 1-2 sentence plain-English explanation for the action
JSON Response:"""


def _previous_decisions_text(zone_id: str) -> str:
    rows = (
        supabase.table("decisions")
        .select("action,reasoning")
        .eq("zone_id", zone_id)
        .order("created_at", desc=True)
        .limit(5)
        .execute()
        .data
    )
    if not rows:
        return "none yet"
    return "; ".join(f"{r['action']}: {r['reasoning']}" for r in rows)


def _forecast_range_f(forecast_12h: dict | None) -> str:
    if not forecast_12h:
        return "unavailable"
    stats = forecast_12h.get("temperature_stats") or {}
    lo, hi = stats.get("minimum"), stats.get("maximum")
    if lo is None or hi is None:
        return "unavailable"
    return f"{_c_to_f(lo):.0f}-{_c_to_f(hi):.0f}"


CHAT_PROMPT_TEMPLATE = """You are an AI heat safety agent for outdoor work crews. Answer the
user's question using only the live zone data below. Be concise (1-3 sentences), plain English,
no markdown.

Zones:
{zones_context}

Question: {question}
Answer:"""


def _zones_context() -> str:
    # Stretch A (pulled forward from Day 4): same latest-decision-per-zone shape as
    # /api/decisions/latest, plus zone names, flattened into a short block for the prompt
    zones = supabase.table("zones").select("id,name").eq("active", True).execute().data
    rows = (
        supabase.table("decisions")
        .select("zone_id,action,reasoning,reading:readings(temperature_f,forecast_12h)")
        .order("created_at", desc=True)
        .execute()
        .data
    )
    latest_by_zone: dict[str, dict] = {}
    for row in rows:
        latest_by_zone.setdefault(row["zone_id"], row)

    lines = []
    for zone in zones:
        d = latest_by_zone.get(zone["id"])
        if not d:
            lines.append(f"- {zone['name']}: no data yet")
            continue
        reading = d.get("reading") or {}
        temp = reading.get("temperature_f")
        temp_text = f"{round(temp)}F" if temp is not None else "unknown"
        lines.append(
            f"- {zone['name']}: {temp_text} latest reading, "
            f"{_forecast_range_f(reading.get('forecast_12h'))}F forecast, "
            f"action={d['action']} ({d['reasoning']})"
        )
    return "\n".join(lines) if lines else "no active zones"


async def answer_question(question: str) -> str:
    prompt = CHAT_PROMPT_TEMPLATE.format(zones_context=_zones_context(), question=question)
    try:
        response = await asyncio.wait_for(
            _client.aio.models.generate_content(model=_MODEL_NAME, contents=prompt),
            timeout=GEMINI_TIMEOUT_S,
        )
        return response.text.strip()
    except Exception as exc:
        logger.warning("Gemini answer_question() failed: %s", exc)
        return "Sorry, I couldn't answer that right now — try again in a moment."


async def decide(zone_id: str, temperature_f: float, forecast_12h: dict | None) -> tuple[Action, str]:
    prompt = PROMPT_TEMPLATE.format(
        previous_decisions=_previous_decisions_text(zone_id),
        current_temp_f=round(temperature_f),
        forecast_range_f=_forecast_range_f(forecast_12h),
    )
    try:
        response = await asyncio.wait_for(
            _client.aio.models.generate_content(
                model=_MODEL_NAME,
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            ),
            timeout=GEMINI_TIMEOUT_S,
        )
        parsed = json.loads(response.text)
        action, reasoning = parsed["action"], parsed["reasoning"]
        if action not in ALLOWED_ACTIONS:
            raise ValueError(f"action {action!r} not in {ALLOWED_ACTIONS}")
        return action, reasoning
    except Exception as exc:
        # ponytail: fail safe to "none" rather than block the write — a bad/slow Gemini call
        # shouldn't lose the reading. Revisit if silent under-alerting on failure is a concern.
        # Raw exception (quota IDs, doc links, retry delays) goes to server logs only —
        # `reasoning` is rendered directly in the public chat feed, must stay clean.
        logger.warning("Gemini decide() failed for zone %s: %s", zone_id, exc)
        return "none", "No automated recommendation this cycle — the AI reasoning step was unavailable."
