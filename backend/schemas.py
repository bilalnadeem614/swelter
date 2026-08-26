from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel

Action = Literal["none", "alert", "reschedule", "escalate"]


class Zone(BaseModel):
    id: UUID
    name: str
    lat: float
    lng: float
    category: Optional[str] = None
    active: bool
    created_at: datetime


class Reading(BaseModel):
    id: UUID
    zone_id: UUID
    temperature_f: float
    risk_level: str
    forecast_12h: Optional[dict] = None
    fetched_at: datetime


class Decision(BaseModel):
    id: UUID
    zone_id: UUID
    reading_id: Optional[UUID] = None
    action: Action
    reasoning: str
    notified: bool
    created_at: datetime
