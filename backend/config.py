from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    FORTYGUARD_API_KEY: str
    GEMINI_API_KEY: str
    CHECK_HEAT_SECRET: str
    VAPID_PUBLIC_KEY: str
    VAPID_PRIVATE_KEY: str
    VAPID_SUBJECT: str


settings = Settings()
