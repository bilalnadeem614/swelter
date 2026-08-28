import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from pydantic import BaseModel

BASE_URL = "https://api.fortyguard.com/v1"
# ponytail: 0.001deg (~110m) returned zero tiles in live testing — API needs a wider AOI to
# populate a grid cell. 0.02deg (~4.4km square, ~7.6mi²) verified to return 4576 tiles, under
# the Basic plan's 10mi² heatmap cap.
ZONE_HALF_WIDTH_DEG = 0.02
GRANULARITY = 60

# ponytail: re-verified AGAIN 2026-08-28 (see decisions.md) — the 25h value set 2026-08-27
# (itself a fix for a prior wrong ~3-4h measurement) is already stale. Sweep tested
# 25h/30h/36h/48h/72h back from now: 25h through 36h all returned n_cells=0 with no
# temperature_stats; 48h and 72h both returned full data. Actual boundary sits somewhere
# between 36h and 48h — using 48h as the confirmed-working mark, no safety margin added
# since it's already drifted twice in two days. FortyGuard's own docs claim near-real-time
# data works ("2019-01-01 through 12 hours past the current time") — that claim does not
# match observed behavior; FortyGuard support separately confirmed no near-real-time
# endpoint exists. Re-verify if this build is revisited later — this has moved twice
# already and there's no guarantee it's stable day to day.
FRESHNESS_LAG = timedelta(hours=48)

POLL_INTERVAL_S = 2.0
POLL_TIMEOUT_S = 45.0  # per job; two jobs per zone run concurrently within the 60s function budget
MAX_RETRIES = 3

# ponytail: single shared semaphore, not per-client — caps total concurrent FortyGuard
# requests (submits + polls) across all zones so a 3-zone run doesn't trip their rate limit
_RATE_LIMIT = asyncio.Semaphore(4)


class HeatmapResult(BaseModel):
    map_data: Optional[dict] = None
    stats_data: Optional[dict] = None


def _zone_polygon(lat: float, lng: float) -> dict:
    d = ZONE_HALF_WIDTH_DEG
    ring = [
        [lng - d, lat - d],
        [lng + d, lat - d],
        [lng + d, lat + d],
        [lng - d, lat + d],
        [lng - d, lat - d],
    ]
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {},
                "geometry": {"type": "Polygon", "coordinates": [ring]},
            }
        ],
    }


def _c_to_f(celsius: float) -> float:
    return celsius * 9 / 5 + 32


def _f_to_c(fahrenheit: float) -> float:
    return (fahrenheit - 32) * 5 / 9


class FortyGuardClient:
    def __init__(self, api_key: str):
        self._client = httpx.AsyncClient(
            base_url=BASE_URL,
            headers={"api-key": api_key, "Content-Type": "application/json"},
            timeout=15.0,
        )

    async def aclose(self):
        await self._client.aclose()

    async def _submit(self, payload: dict, endpoint: str = "/heatmap") -> Optional[str]:
        for attempt in range(MAX_RETRIES):
            async with _RATE_LIMIT:
                try:
                    resp = await self._client.post(endpoint, json=payload)
                except httpx.RequestError:
                    await asyncio.sleep(2**attempt)
                    continue
            if resp.status_code == 429 or resp.status_code >= 500:
                await asyncio.sleep(2**attempt)
                continue
            if resp.status_code != 200:
                return None
            return resp.json().get("data", {}).get("activity_id")
        return None

    async def _poll(self, activity_id: str) -> Optional[dict]:
        deadline = asyncio.get_event_loop().time() + POLL_TIMEOUT_S
        while asyncio.get_event_loop().time() < deadline:
            async with _RATE_LIMIT:
                try:
                    resp = await self._client.get(f"/status/{activity_id}")
                except httpx.RequestError:
                    await asyncio.sleep(POLL_INTERVAL_S)
                    continue
            if resp.status_code == 429 or resp.status_code >= 500:
                await asyncio.sleep(POLL_INTERVAL_S)
                continue
            if resp.status_code != 200:
                return None
            data = resp.json().get("data", {})
            status = (data.get("status") or "").lower()
            if status in ("completed", "succeeded"):
                return data.get("result") or {}
            if status == "failed":
                return None
            await asyncio.sleep(POLL_INTERVAL_S)
        return None

    async def _run_job(self, payload: dict, endpoint: str = "/heatmap") -> Optional[dict]:
        activity_id = await self._submit(payload, endpoint)
        if not activity_id:
            return None
        return await self._poll(activity_id)

    async def get_current_temp_f(self, lat: float, lng: float) -> Optional[float]:
        # data only exists at hourly marks; non-hour-aligned minutes silently return zero tiles
        reference = (datetime.now(timezone.utc) - FRESHNESS_LAG).replace(minute=0, second=0, microsecond=0)
        payload = {
            "polygon_aoi": _zone_polygon(lat, lng),
            "date_time": {
                "start_date": reference.strftime("%Y-%m-%d"),
                "start_time": reference.strftime("%H:%M"),
                "filter_type": 1,
            },
            "granularity": GRANULARITY,
        }
        result = HeatmapResult.model_validate(await self._run_job(payload) or {})
        if not result.stats_data:
            return None
        mean_c = (result.stats_data.get("temperature_stats") or {}).get("mean")
        return _c_to_f(mean_c) if mean_c is not None else None

    async def get_heat_index_f(self, lat: float, lng: float, temp_f: float) -> Optional[float]:
        # FortyGuard's own /v1/env_params computes heat index server-side (official number,
        # confirmed via live docs 2026-08-28) — no third-party call or hand-rolled formula
        # needed. Per docs, the date_time here "should match the date/time of the heatmap
        # you generated for this location", so this must run AFTER get_current_temp_f (needs
        # its temp value too), not concurrently with it — adds sequential latency on top of
        # the already-tight CHECK_HEAT_BUDGET_S, accepted per 2026-08-28 decision.
        reference = (datetime.now(timezone.utc) - FRESHNESS_LAG).replace(minute=0, second=0, microsecond=0)
        payload = {
            "latitude": lat,
            "longitude": lng,
            "temperature": _f_to_c(temp_f),
            "date_time": {
                "start_date": reference.strftime("%Y-%m-%d"),
                "start_time": reference.strftime("%H:%M"),
                "filter_type": 1,
            },
            "analysis": ["heat_index_celsius"],
        }
        result = await self._run_job(payload, endpoint="/env_params")
        locations = (result or {}).get("locations") or []
        if not locations:
            return None
        values = (locations[0].get("parameters") or {}).get("heat_index_celsius") or []
        hi_c = values[0] if values else None
        return _c_to_f(hi_c) if hi_c is not None else None

    async def get_forecast_12h(self, lat: float, lng: float) -> Optional[dict]:
        # anchor the forecast window at the same freshness-lag-adjusted reference point used
        # for "current" so the two calls describe a continuous timeline
        reference = (datetime.now(timezone.utc) - FRESHNESS_LAG).replace(minute=0, second=0, microsecond=0)
        # ponytail: filter_type=2 only spans a single day (max 23h), so a forecast requested
        # late in the day gets clamped to today's 23:59 instead of the full 12h ahead. Upgrade
        # to a second filter_type=1 call for the overflow hours if that gap matters later.
        end = min(reference + timedelta(hours=12), reference.replace(hour=23, minute=59, second=0))
        if end <= reference:
            end = reference.replace(hour=23, minute=59, second=0)
        payload = {
            "polygon_aoi": _zone_polygon(lat, lng),
            "date_time": {
                "start_date": reference.strftime("%Y-%m-%d"),
                "start_time": reference.strftime("%H:%M"),
                "end_time": end.strftime("%H:%M"),
                "filter_type": 2,
            },
            "granularity": GRANULARITY,
        }
        result = await self._run_job(payload)
        return result.get("stats_data") if result else None
