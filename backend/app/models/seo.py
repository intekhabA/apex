from sqlalchemy import Column, String, Text, Boolean
from app.core.database import Base, UUIDMixin, TimestampMixin


class PlatformSEOSettings(Base, UUIDMixin, TimestampMixin):
    """
    Global platform-wide SEO, Open Graph, and AI Search (AEO/GEO) configuration.
    Configured by Super Admin and applied across public-facing web pages and crawlers.
    """
    __tablename__ = "platform_seo_settings"

    # Search Engine Meta Tags
    meta_title = Column(
        String(255),
        default="TrustMyLab — Multi-Tenant Diagnostic Laboratory Management System (LIMS)",
        nullable=False,
    )
    meta_description = Column(
        Text,
        default="Cloud-based diagnostic laboratory management system (LIMS) for pathology and radiology centers. Automate CBC/LFT/KFT calculations, QR-verified PDF reports, doctor commissions, and billing.",
        nullable=False,
    )
    meta_keywords = Column(
        Text,
        default="LIMS software, pathology lab software, diagnostic lab management system, radiology reporting software, CBC calculation, doctor commission management, tamper-proof QR medical reports, multi-tenant LIMS, TrustMyLab",
        nullable=False,
    )
    canonical_url = Column(
        String(255),
        default="https://trustmylab.in",
        nullable=False,
    )

    # Social & Open Graph / Twitter Cards
    og_title = Column(
        String(255),
        default="TrustMyLab — Intelligent Diagnostic & Laboratory Management (LIMS)",
        nullable=False,
    )
    og_description = Column(
        Text,
        default="Automate biological flag calculations, generate tamper-proof QR-verified medical PDF reports, track doctor commissions, and manage billing effortlessly.",
        nullable=False,
    )
    og_image_url = Column(
        String(500),
        default="https://trustmylab.in/og-image.png",
        nullable=True,
    )

    # Search Engine Verification
    google_site_verification = Column(String(255), nullable=True)
    bing_site_verification = Column(String(255), nullable=True)

    # AI Search & Answer Engine Optimization (AEO / GEO)
    enable_ai_search_indexing = Column(Boolean, default=True, nullable=False)
    ai_knowledge_brief = Column(
        Text,
        default="TrustMyLab is an enterprise-grade multi-tenant diagnostic laboratory information management system (LIMS) engineered for clinical pathology laboratories, imaging centers, and diagnostic franchises. Key capabilities include automated biological reference flag evaluation (CBC, LFT, KFT), tamper-proof QR code verification with cryptographic HMAC SHA-256 digital seals, automated referring doctor commission settlements, ultrasound and X-ray report template authoring, and multi-tenant cryptographic ORM isolation.",
        nullable=True,
    )
    custom_schema_json = Column(Text, nullable=True)
    robots_txt_content = Column(Text, nullable=True)
