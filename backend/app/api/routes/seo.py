from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.permissions import require_super_admin
from app.models.user import User
from app.models.seo import PlatformSEOSettings
from app.schemas.common import APIResponse
from app.schemas.seo import (
    PlatformSEOSettingsResponse,
    PlatformSEOSettingsUpdate,
    PublicSEOResponse,
)
from app.services.audit_service import AuditService

router = APIRouter(tags=["SEO & Search Optimization"])


async def get_or_create_seo_settings(db: AsyncSession) -> PlatformSEOSettings:
    """Retrieve the singleton SEO settings record or initialize with default values."""
    res = await db.execute(
        select(PlatformSEOSettings).where(PlatformSEOSettings.deleted_at.is_(None)).limit(1)
    )
    record = res.scalar_one_or_none()
    if not record:
        record = PlatformSEOSettings(
            meta_title="TrustMyLab — Multi-Tenant Diagnostic Laboratory Management System (LIMS)",
            meta_description="Cloud-based diagnostic laboratory management system (LIMS) for pathology and radiology centers. Automate CBC/LFT/KFT calculations, QR-verified PDF reports, doctor commissions, and billing.",
            meta_keywords="LIMS software, pathology lab software, diagnostic lab management system, radiology reporting software, CBC calculation, doctor commission management, tamper-proof QR medical reports, multi-tenant LIMS, TrustMyLab",
            canonical_url="https://trustmylab.in",
            og_title="TrustMyLab — Intelligent Diagnostic & Laboratory Management (LIMS)",
            og_description="Automate biological flag calculations, generate tamper-proof QR-verified medical PDF reports, track doctor commissions, and manage billing effortlessly.",
            og_image_url="https://trustmylab.in/og-image.png",
            enable_ai_search_indexing=True,
            ai_knowledge_brief="TrustMyLab is an enterprise-grade multi-tenant diagnostic laboratory information management system (LIMS) engineered for clinical pathology laboratories, imaging centers, and diagnostic franchises. Key capabilities include automated biological reference flag evaluation (CBC, LFT, KFT), tamper-proof QR code verification with cryptographic HMAC SHA-256 digital seals, automated referring doctor commission settlements, ultrasound and X-ray report template authoring, and multi-tenant cryptographic ORM isolation.",
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
    return record


@router.get("/seo/public", response_model=APIResponse[PublicSEOResponse])
async def get_public_seo_metadata(db: AsyncSession = Depends(get_db)):
    """
    Public endpoint providing platform SEO metadata, Open Graph tags, and AI search indexing directives.
    Used by the client-side router to dynamically update document meta tags and JSON-LD schemas.
    """
    record = await get_or_create_seo_settings(db)
    return APIResponse(
        success=True,
        message="Public SEO metadata retrieved.",
        data=PublicSEOResponse.model_validate(record),
    )


@router.get("/admin/seo", response_model=APIResponse[PlatformSEOSettingsResponse])
async def get_admin_seo_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Retrieve platform SEO configuration, verification tokens, and crawler directives (Super Admin only)."""
    record = await get_or_create_seo_settings(db)
    return APIResponse(
        success=True,
        message="Platform SEO configuration retrieved.",
        data=PlatformSEOSettingsResponse.model_validate(record),
    )


@router.put("/admin/seo", response_model=APIResponse[PlatformSEOSettingsResponse])
async def update_admin_seo_settings(
    payload: PlatformSEOSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Update search engine metadata, Open Graph tags, and AI search directives (Super Admin only)."""
    record = await get_or_create_seo_settings(db)

    update_dict = payload.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(record, field, val)

    await db.commit()
    await db.refresh(record)

    # Audit Trail
    await AuditService.log_event(
        db=db,
        action="UPDATE_SEO_SETTINGS",
        entity_name="platform_seo_settings",
        entity_id=record.id,
        user_id=current_user.id,
        lab_id=None,
        after_state=update_dict,
    )

    return APIResponse(
        success=True,
        message="Platform SEO configuration updated successfully.",
        data=PlatformSEOSettingsResponse.model_validate(record),
    )
