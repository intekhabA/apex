import os
import io
import pytest
from reportlab.platypus import Image
from PIL import Image as PILImage
from app.services.pdf_engine import (
    get_signature_flowable,
    generate_medical_report_pdf,
    generate_consolidated_booking_report_pdf,
    DEFAULT_SIGNATURE_PATH,
)


def test_default_signature_asset_exists():
    """Verify that default certified medical doctor signature asset exists on disk."""
    assert os.path.isfile(DEFAULT_SIGNATURE_PATH), f"Missing signature asset at {DEFAULT_SIGNATURE_PATH}"
    img = PILImage.open(DEFAULT_SIGNATURE_PATH)
    assert img.size[0] > 0 and img.size[1] > 0


def test_get_signature_flowable_with_default():
    """Verify get_signature_flowable falls back to default signature flowable."""
    flowable = get_signature_flowable(None, max_width=140, max_height=40)
    assert flowable is not None
    assert isinstance(flowable, Image)
    assert flowable.drawWidth <= 140
    assert flowable.drawHeight <= 40


def test_get_signature_flowable_with_custom_bytes():
    """Verify get_signature_flowable handles raw image bytes."""
    test_img = PILImage.new("RGBA", (200, 100), (0, 0, 0, 0))
    buf = io.BytesIO()
    test_img.save(buf, format="PNG")
    raw_bytes = buf.getvalue()

    flowable = get_signature_flowable(raw_bytes, max_width=120, max_height=40)
    assert flowable is not None
    assert isinstance(flowable, Image)
    assert flowable.drawWidth <= 120
    assert flowable.drawHeight <= 40


def test_get_signature_flowable_with_data_uri():
    """Verify get_signature_flowable handles base64 data URIs."""
    import base64
    test_img = PILImage.new("RGBA", (300, 100), (0, 0, 0, 0))
    buf = io.BytesIO()
    test_img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    data_uri = f"data:image/png;base64,{b64}"

    flowable = get_signature_flowable(data_uri, max_width=140, max_height=40)
    assert flowable is not None
    assert isinstance(flowable, Image)
    assert flowable.drawWidth <= 140


def test_generate_medical_report_pdf_with_signature(tmp_path):
    """Verify medical report PDF renders successfully with signature."""
    lab_info = {
        "name": "TrustMyLab Certified",
        "address": "123 Medical Center",
        "phone": "555-0100",
        "email": "lab@diagnolab.com",
        "license": "ISO 15189",
    }
    patient_info = {
        "name": "Jane Smith",
        "id_display": "PAT-999",
        "age": 29,
        "gender": "Female",
        "booking_id_display": "BKG-999",
        "referred_by": "Self",
    }
    test_info = {"name": "Lipid Profile Panel", "code": "LIPID-01"}
    report_info = {
        "report_id_display": "REP-999",
        "status": "FINAL",
        "version": 1,
        "date": "01-Oct-2026",
        "finalized_at": "01-Oct-2026 03:00 PM",
        "approved_by_name": "Dr. Sarah Jenkins",
        "signatory_title": "Consultant Pathologist",
        "signatory_degrees": "MD, DCP",
        "signatory_reg_no": "MCI-77889",
    }
    result_vals = [
        {
            "parameter_name": "Total Cholesterol",
            "numeric_value": 185.0,
            "text_value": None,
            "unit": "mg/dL",
            "reference_range_display": "< 200",
            "flag": "NORMAL",
        }
    ]
    out_pdf = str(tmp_path / "report_with_sig.pdf")
    res = generate_medical_report_pdf(
        lab_info=lab_info,
        patient_info=patient_info,
        test_info=test_info,
        report_info=report_info,
        result_values=result_vals,
        narrative_info={},
        qr_url="http://localhost:5173/verify/dummy",
        hmac_digest="abcdef0123456789",
        output_path=out_pdf,
    )

    assert os.path.exists(res)
    assert os.path.getsize(res) > 1000


def test_format_result_value():
    """Verify test results display integers without decimal and floats with 2 decimal places."""
    from app.services.pdf_engine import format_result_value
    from decimal import Decimal

    # Non-floating integers -> without decimals
    assert format_result_value(12) == "12"
    assert format_result_value(12.0) == "12"
    assert format_result_value(Decimal("12.0000")) == "12"
    assert format_result_value("12.00") == "12"
    assert format_result_value(0) == "0"
    assert format_result_value(0.0) == "0"

    # Floats -> 2 digits after decimal
    assert format_result_value(12.5) == "12.50"
    assert format_result_value(12.345) == "12.35"
    assert format_result_value(Decimal("12.5000")) == "12.50"
    assert format_result_value(0.7) == "0.70"

    # Text results and nulls
    assert format_result_value(None, "Reactive") == "Reactive"
    assert format_result_value(None, "Negative") == "Negative"
    assert format_result_value(None, "14.00") == "14"
    assert format_result_value(None, "14.5") == "14.50"
    assert format_result_value(None, None) == "—"

