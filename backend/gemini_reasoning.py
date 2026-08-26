from schemas import Action


async def decide(temperature_f: float, forecast_12h: dict | None) -> tuple[Action, str]:
    # ponytail: stub until Step 4 wires the real Gemini call — pipeline is provably working
    # end-to-end without it. Swap this body for the real prompt/response handling.
    return "none", "stubbed — gemini integration pending"
