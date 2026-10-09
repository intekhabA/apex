import enum
from sqlalchemy import Column, String, Date, Numeric, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base, UUIDMixin, TimestampMixin


class ExpenseCategory(str, enum.Enum):
    LAB_SUPPLIES = "LAB_SUPPLIES"          # Reagents, kits, test tubes, consumables
    EQUIPMENT = "EQUIPMENT"                # Machine maintenance, calibration, repairs
    UTILITIES = "UTILITIES"                # Electricity, water, internet, telephone
    RENT = "RENT"                          # Premise rent, building charges
    SALARIES = "SALARIES"                  # Daily wages, staff stipend, incentives
    REFRESHMENTS = "REFRESHMENTS"          # Pantry, tea/coffee, refreshments
    LOGISTICS = "LOGISTICS"                # Sample transport, fuel, courier
    STATIONERY = "STATIONERY"              # Paper, printer ink, barcode ribbons
    MARKETING = "MARKETING"                # Banners, local promotion, brochures
    MAINTENANCE = "MAINTENANCE"            # Sanitization, clinic repairs, disposal
    OTHER = "OTHER"                        # Miscellaneous expenses


class Expense(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "expenses"

    lab_id = Column(String(36), ForeignKey("laboratories.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False, default=ExpenseCategory.OTHER.value, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    expense_date = Column(Date, nullable=False, index=True)
    payment_method = Column(String(50), nullable=False, default="CASH")
    vendor_name = Column(String(255), nullable=True)
    receipt_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    laboratory = relationship("Laboratory")
    created_by = relationship("User")
