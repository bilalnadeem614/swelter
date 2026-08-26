import asyncio
import json

import google.generativeai as genai

from config import settings
from fortyguard_client import _c_to_f
from schemas import Action
from supabase_client import supabase

genai.configure(api_key=settings.GEMINI_API_KEY)
_model = genai.GenerativeModel("gemini-3.6-flash")

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


async def decide(zone_id: str, temperature_f: float, forecast_12h: dict | None) -> tuple[Action, str]:
    prompt = PROMPT_TEMPLATE.format(
        previous_decisions=_previous_decisions_text(zone_id),
        current_temp_f=round(temperature_f),
        forecast_range_f=_forecast_range_f(forecast_12h),
    )
    try:
        response = await asyncio.wait_for(
            asyncio.to_thread(
                _model.generate_content,
                prompt,
                generation_config=genai.GenerationConfig(response_mime_type="application/json"),
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
        return "none", f"fallback — gemini call failed: {exc}"
