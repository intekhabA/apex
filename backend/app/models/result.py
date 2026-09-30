import enum
from sqlalchemy import Column, String, Numeric, Text, ForeignKey, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base, UUIDMixin, TimestampMixin


class ResultFlagEnum(str, enum.Enum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    CRITICAL_LOW = "CRITICAL_LOW"
    CRITICAL_HIGH = "CRITICAL_HIGH"
    ABNORMAL = "ABNORMAL"


class TestResultValue(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "test_result_values"

    report_id = Column(String(36), ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True)
    parameter_id = Column(String(36), ForeignKey("test_parameters.id", ondelete="RESTRICT"), nullable=False, index=True)
    parameter_name = Column(String(200), nullable=False)
    parameter_code = Column(String(50), nullable=False)
    numeric_value = Column(Numeric(12, 4), nullable=True)
    text_value = Column(Text, nullable=True)
    unit = Column(String(50), nullable=True)
    reference_range_display = Column(String(100), nullable=True)
    flag = Column(SQLEnum(ResultFlagEnum), default=ResultFlagEnum.NORMAL, nullable=False)
    technician_comment = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("report_id", "parameter_id", name="uq_report_param_val"),
    )

    report = relationship("Report", back_populates="result_values")
