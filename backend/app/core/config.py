import os
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    APP_NAME: str = "DiagnoLab SaaS"
    APP_URL: str = "http://localhost:5173"
    API_V1_PREFIX: str = "/api"

    # Security & Cryptography
    SECRET_KEY: str = "dev_secret_key_change_in_production_89abcf12456780e_diagnolab"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database Configuration (MySQL default)
    MYSQL_HOST: str = "localhost"
    MYSQL_PORT: int = 3306
    MYSQL_USER: str = "diagnolab"
    MYSQL_PASSWORD: str = "diagnolab_secret"
    MYSQL_DATABASE: str = "diagnolab_db"

    DATABASE_URL: str = "mysql+aiomysql://diagnolab:diagnolab_secret@localhost:3306/diagnolab_db"
    SYNC_DATABASE_URL: str = "mysql+pymysql://diagnolab:diagnolab_secret@localhost:3306/diagnolab_db"

    # Database Connection Pool Settings
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_RECYCLE: int = 3600
    DB_POOL_PRE_PING: bool = True
    DB_ECHO: bool = False

    # Storage Settings
    STORAGE_PROVIDER: str = "local"  # 'local' or 's3'
    STORAGE_LOCAL_ROOT: str = "./storage/uploads"
    STORAGE_MAX_FILE_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB

    # S3 Settings (optional)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    AWS_S3_BUCKET: str = "diagnolab-reports"

    @property
    def is_production(self) -> bool:
        return (self.ENVIRONMENT or "").lower() in ("production", "prod")

    @property
    def use_s3_storage(self) -> bool:
        """
        Determines whether to use AWS S3 bucket or local filesystem storage:
        - If STORAGE_PROVIDER is 's3', returns True.
        - If STORAGE_PROVIDER is 'local' in local/development environment, returns False.
        - If ENVIRONMENT is 'production' (or AWS runtime) and AWS_S3_BUCKET is set, returns True.
        - Defaults to False (local storage) for local development.
        """
        provider = (self.STORAGE_PROVIDER or "").lower().strip()
        if provider == "s3":
            return True
        if provider == "local" and not self.is_production:
            return False
        if self.is_production and bool(self.AWS_S3_BUCKET):
            return True
        is_aws_runtime = bool(os.getenv("AWS_EXECUTION_ENV")) or bool(os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
        if is_aws_runtime and bool(self.AWS_S3_BUCKET):
            return True
        return False

    # Super Admin Seed
    INITIAL_SUPER_ADMIN_EMAIL: str = "admin@example.com"
    INITIAL_SUPER_ADMIN_PASSWORD: str = "SuperAdmin@2026!"
    INITIAL_SUPER_ADMIN_NAME: str = "Platform Super Admin"

    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173"
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, str)):
            return v
        return []


settings = Settings()
