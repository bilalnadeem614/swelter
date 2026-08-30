import json
import logging

from pywebpush import WebPushException, webpush

from config import settings
from supabase_client import supabase

logger = logging.getLogger(__name__)


def notify_all(zone_name: str, action: str, reasoning: str) -> None:
    """Best-effort web push fan-out to every subscribed browser. Desktop/Android only —
    iOS Safari needs an installed PWA to receive push, out of scope for this build. Never
    raises: a bad/expired subscription is deleted, any other failure is just logged, so this
    can't break the decide()/check-heat write path it's called from."""
    subs = supabase.table("push_subscriptions").select("*").execute().data
    if not subs:
        return

    payload = json.dumps({"title": f"Swelter — {zone_name}", "body": f"{action.capitalize()}: {reasoning}"})

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                },
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_SUBJECT},
            )
        except WebPushException as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status in (404, 410):
                # subscription expired/revoked on the browser side — stop trying it
                supabase.table("push_subscriptions").delete().eq("endpoint", sub["endpoint"]).execute()
            else:
                logger.warning("push failed for %s: %s", sub["endpoint"], exc)
