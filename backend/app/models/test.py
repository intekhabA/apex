import enum
from sqlalchemy import Column, String, Integer, Text, Numeric, Boolean, ForeignKey, JSON, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base, UUIDMixin, TimestampMixin


class SampleTypeEnum(str, enum.Enum):
    WHOLE_BLOOD_EDTA = "WHOLE_BLOOD_EDTA"
    SERUM = "SERUM"
    PLASMA_CITRATE = "PLASMA_CITRATE"
    URINE_ROUTINE = "URINE_ROUTINE"
    URINE_24HR = "URINE_24HR"
    STOOL = "STOOL"
    CSF = "CSF"
    SWAB = "SWAB"
    IMAGING = "IMAGING"
    OTHER = "OTHER"


class TestTypeEnum(str, enum.Enum):
    PATHOLOGY = "PATHOLOGY"
    BIOCHEMISTRY = "BIOCHEMISTRY"
    RADIOLOGY = "RADIOLOGY"
    CARDIOLOGY = "CARDIOLOGY"
    OTHER = "OTHER"


class ResultValueTypeEnum(str, enum.Enum):
    NUMBER = "NUMBER"
    TEXT = "TEXT"
    SELECT = "SELECT"
    POSITIVE_NEGATIVE = "POSITIVE_NEGATIVE"
    RANGE = "RANGE"
    CUSTOM = "CUSTOM"


class TestCategory(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "test_categories"

    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    display_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True, nullable=False)

    tests = relationship("Test", back_populates="category")


class Test(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "tests"

    category_id = Column(String(36), ForeignKey("test_categories.id", ondelete="RESTRICT"), nullable=False, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)  # e.g. "CBC", "LFT"
    name = Column(String(255), nullable=False)
    short_name = Column(String(100), nullable=True)
    test_type = Column(SQLEnum(TestTypeEnum), default=TestTypeEnum.PATHOLOGY, nullable=False)
    sample_type = Column(SQLEnum(SampleTypeEnum), nullable=False)
    sample_container = Column(String(100), nullable=True)
    preparation_instructions = Column(Text, nullable=True)
    turnaround_hours = Column(Integer, default=24)
    default_price = Column(Numeric(10, 2), default=0.00, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    category = relationship("TestCategory", back_populates="tests")
    parameters = relationship("TestParameter", back_populates="test", cascade="all, delete-orphan", order_by="TestParameter.display_order")


class TestParameter(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "test_parameters"

    test_id = Column(String(36), ForeignKey("tests.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False)  # e.g. "HB", "WBC"
    name = Column(String(200), nullable=False)
    short_name = Column(String(100), nullable=True)
    unit = Column(String(50), nullable=True)  # "g/dL", "mg/dL"
    result_type = Column(SQLEnum(ResultValueTypeEnum), default=ResultValueTypeEnum.NUMBER, nullable=False)
    decimal_precision = Column(Integer, default=2)
    display_order = Column(Integer, default=0)
    options_json = Column(JSON, nullable=True)

    __table_args__ = (
        UniqueConstraint("test_id", "code", name="uq_test_param_code"),
    )

    test = relationship("Test", back_populates="parameters")
    reference_ranges = relationship("TestReferenceRange", back_populates="parameter", cascade="all, delete-orphan")


class TestReferenceRange(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "test_reference_ranges"

    parameter_id = Column(String(36), ForeignKey("test_parameters.id", ondelete="CASCADE"), nullable=False, index=True)
    gender = Column(String(10), nullable=True)  # "MALE", "FEMALE", or NULL for any
    age_min_years = Column(Integer, default=0)
    age_max_years = Column(Integer, default=150)
    min_value = Column(Numeric(12, 4), nullable=True)
    max_value = Column(Numeric(12, 4), nullable=True)
    critical_low = Column(Numeric(12, 4), nullable=True)
    critical_high = Column(Numeric(12, 4), nullable=True)
    text_normal_value = Column(String(255), nullable=True)
    display_range_string = Column(String(100), nullable=False)

    parameter = relationship("TestParameter", back_populates="reference_ranges")


class LabTestPrice(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "lab_test_prices"

    lab_id = Column(String(36), ForeignKey("laboratories.id", ondelete="CASCADE"), nullable=False)
    test_id = Column(String(36), ForeignKey("tests.id", ondelete="CASCADE"), nullable=False)
    custom_price = Column(Numeric(10, 2), nullable=False)
    discount_percentage = Column(Numeric(5, 2), default=0.00)
    is_available = Column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("lab_id", "test_id", name="uq_lab_test_price"),
    )


class TestPackage(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "test_packages"

    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    discount_percentage = Column(Numeric(5, 2), default=0.00)
    is_active = Column(Boolean, default=True, nullable=False)

    items = relationship("TestPackageItem", back_populates="package", cascade="all, delete-orphan")


class TestPackageItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "test_package_items"

    package_id = Column(String(36), ForeignKey("test_packages.id", ondelete="CASCADE"), nullable=False)
    test_id = Column(String(36), ForeignKey("tests.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (
        UniqueConstraint("package_id", "test_id", name="uq_package_test_item"),
    )

    package = relationship("TestPackage", back_populates="items")
