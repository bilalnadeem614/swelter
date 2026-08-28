from main import _risk_level

assert _risk_level(70, 70) == "low"
assert _risk_level(96, 116) == "high"
assert _risk_level(110, 130) == "extreme"
assert _risk_level(120, None) == "high"  # no heat index -> falls back to raw temp_f

print("ok")
