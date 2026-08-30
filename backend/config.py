from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    FORTYGUARD_API_KEY: str
    GEMINI_API_KEY: str
    # optional backup keys — tried in order if an earlier one fails (quota exhausted, etc.),
    # invisible to the user. Leave unset to run with just GEMINI_API_KEY, unchanged from
    # before. See decisions.md 2026-08-30.
    GEMINI_API_KEY_2: str | None = None
    GEMINI_API_KEY_3: str | None = None
    CHECK_HEAT_SECRET: str
    VAPID_PUBLIC_KEY: str
    VAPID_PRIVATE_KEY: str
    VAPID_SUBJECT: str


settings = Settings()
