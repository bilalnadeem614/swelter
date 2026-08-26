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

# ponytail: live testing (2026-08-26) showed the API has a ~3-4hr data-freshness lag — querying
# the literal current instant returns zero tiles, while now-5h reliably returns data. Confirmed
# boundary sits between 3h and 4h; 5h is a safety margin, not the measured lag itself.
FRESHNESS_LAG = timedelta(hours=5)

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


class FortyGuardClient:
    def __init__(self, api_key: str):
        self._client = httpx.AsyncClient(
            base_url=BASE_URL,
            headers={"api-key": api_key, "Content-Type": "application/json"},
            timeout=15.0,
        )

    async def aclose(self):
        await self._client.aclose()

    async def _submit(self, payload: dict) -> Optional[str]:
        for attempt in range(MAX_RETRIES):
            async with _RATE_LIMIT:
                try:
                    resp = await self._client.post("/heatmap", json=payload)
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

    async def _poll(self, activity_id: str) -> Optional[HeatmapResult]:
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
                return HeatmapResult.model_validate(data.get("result") or {})
            if status == "failed":
                return None
            await asyncio.sleep(POLL_INTERVAL_S)
        return None

    async def _run_job(self, payload: dict) -> Optional[HeatmapResult]:
        activity_id = await self._submit(payload)
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
        result = await self._run_job(payload)
        if not result or not result.stats_data:
            return None
        mean_c = (result.stats_data.get("temperature_stats") or {}).get("mean")
        return _c_to_f(mean_c) if mean_c is not None else None

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
        return result.stats_data if result else None
