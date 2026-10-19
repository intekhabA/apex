from sqlalchemy import Column, String, Text, Boolean, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base, UUIDMixin, TimestampMixin


class ImagingTemplate(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "imaging_templates"

    code = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    modality = Column(String(50), nullable=False, default="USG", index=True)  # USG, X-RAY, CT, MRI, ECG, OTHER
    test_id = Column(String(36), ForeignKey("tests.id", ondelete="SET NULL"), nullable=True, index=True)
    clinical_history_template = Column(Text, nullable=True)
    findings_template = Column(Text, nullable=False)
    impression_template = Column(Text, nullable=True)
    recommendations_template = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    display_order = Column(Integer, default=0)
    lab_id = Column(String(36), ForeignKey("laboratories.id", ondelete="CASCADE"), nullable=True, index=True)

    test = relationship("Test")
    laboratory = relationship("Laboratory")
