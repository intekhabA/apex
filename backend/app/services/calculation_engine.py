from decimal import Decimal
from typing import Optional, Tuple
from app.models.result import ResultFlagEnum
from app.models.test import TestParameter, TestReferenceRange
from app.models.patient import Patient


def evaluate_parameter_result(
    value: Optional[Decimal],
    parameter: TestParameter,
    patient: Optional[Patient] = None,
) -> Tuple[ResultFlagEnum, Optional[str]]:
    """Evaluates a numeric test result value against patient-specific biological reference ranges.

    Returns:
        (flag, reference_range_display_string)
    """
    if not parameter.reference_ranges:
        return ResultFlagEnum.NORMAL, None

    # Determine patient gender and age
    patient_gender = patient.gender.value if (patient and hasattr(patient, "gender") and hasattr(patient.gender, "value")) else (str(patient.gender) if patient and hasattr(patient, "gender") else None)
    patient_age = patient.age_years if patient and hasattr(patient, "age_years") else 30

    # Find the most specific reference range matching gender and age
    matched_range: Optional[TestReferenceRange] = None

    # Pass 1: exact gender match
    for rr in parameter.reference_ranges:
        if rr.gender and patient_gender and rr.gender.upper() == patient_gender.upper():
            if rr.age_min_years <= patient_age <= rr.age_max_years:
                matched_range = rr
                break

    # Pass 2: fallback to any gender (None)
    if not matched_range:
        for rr in parameter.reference_ranges:
            if rr.gender is None or rr.gender == "":
                if rr.age_min_years <= patient_age <= rr.age_max_years:
                    matched_range = rr
                    break

    # Pass 3: fallback to first available range if age bounds didn't match
    if not matched_range and parameter.reference_ranges:
        matched_range = parameter.reference_ranges[0]

    if not matched_range:
        return ResultFlagEnum.NORMAL, None

    display_str = matched_range.display_range_string

    if value is None:
        return ResultFlagEnum.NORMAL, display_str

    # Critical thresholds check first
    if matched_range.critical_low is not None and value < matched_range.critical_low:
        return ResultFlagEnum.CRITICAL_LOW, display_str

    if matched_range.critical_high is not None and value > matched_range.critical_high:
        return ResultFlagEnum.CRITICAL_HIGH, display_str

    # Normal range boundaries check
    if matched_range.min_value is not None and value < matched_range.min_value:
        return ResultFlagEnum.LOW, display_str

    if matched_range.max_value is not None and value > matched_range.max_value:
        return ResultFlagEnum.HIGH, display_str

    return ResultFlagEnum.NORMAL, display_str
