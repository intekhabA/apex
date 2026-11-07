from typing import Optional
from datetime import datetime
from pydantic import BaseModel, HttpUrl


class PlatformSEOSettingsBase(BaseModel):
    meta_title: str
    meta_description: str
    meta_keywords: str
    canonical_url: str

    og_title: str
    og_description: str
    og_image_url: Optional[str] = None

    google_site_verification: Optional[str] = None
    bing_site_verification: Optional[str] = None

    enable_ai_search_indexing: bool = True
    ai_knowledge_brief: Optional[str] = None
    custom_schema_json: Optional[str] = None
    robots_txt_content: Optional[str] = None


class PlatformSEOSettingsUpdate(BaseModel):
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[str] = None
    canonical_url: Optional[str] = None

    og_title: Optional[str] = None
    og_description: Optional[str] = None
    og_image_url: Optional[str] = None

    google_site_verification: Optional[str] = None
    bing_site_verification: Optional[str] = None

    enable_ai_search_indexing: Optional[bool] = None
    ai_knowledge_brief: Optional[str] = None
    custom_schema_json: Optional[str] = None
    robots_txt_content: Optional[str] = None


class PlatformSEOSettingsResponse(PlatformSEOSettingsBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PublicSEOResponse(BaseModel):
    meta_title: str
    meta_description: str
    meta_keywords: str
    canonical_url: str

    og_title: str
    og_description: str
    og_image_url: Optional[str] = None

    google_site_verification: Optional[str] = None
    bing_site_verification: Optional[str] = None

    enable_ai_search_indexing: bool = True
    ai_knowledge_brief: Optional[str] = None
    custom_schema_json: Optional[str] = None

    class Config:
        from_attributes = True
