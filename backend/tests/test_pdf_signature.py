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


def test_pdf_customization_header_and_qr_toggles(tmp_path):
    """Verify that toggling show_report_header_status and show_qr_side_text correctly modifies PDF layout."""
    import subprocess
    lab_info = {
        "name": "Customized Diagnostic Lab",
        "address": "456 Marine Lines",
        "phone": "022-123456",
        "email": "test@lab.com",
        "license": "ISO-9001",
        "show_report_header_status": False,
        "show_qr_side_text": False,
        "enable_qr_verification": True,
    }
    patient_info = {
        "name": "Jane Patient",
        "id_display": "PAT-777",
        "age": 42,
        "gender": "Female",
        "booking_id_display": "BKG-777",
        "referred_by": "Dr. Strange",
    }
    test_info = {"name": "Ultrasound Pelvis", "code": "USG-02"}
    report_info = {
        "report_id_display": "REP-2026-000078",
        "status": "FINAL",
        "version": 1,
        "date": "24-Oct-2026 03:00 AM",
        "finalized_at": "24-Oct-2026 03:00 AM",
        "approved_by_name": "Dr. Chief",
        "show_header_status": False,
        "show_qr_side_text": False,
    }
    out_pdf = str(tmp_path / "custom_report.pdf")
    generate_medical_report_pdf(
        lab_info=lab_info,
        patient_info=patient_info,
        test_info=test_info,
        report_info=report_info,
        result_values=[],
        narrative_info={"imaging_findings": "Normal"},
        qr_url="https://trustmylab.in/verify/test78",
        hmac_digest="11223344556677889900aabbccddeeff",
        output_path=out_pdf,
    )

    assert os.path.exists(out_pdf)
    assert os.path.getsize(out_pdf) > 1000

    # Extract text and assert
    res = subprocess.run(["pdftotext", out_pdf, "-"], capture_output=True, text=True)
    pdf_text = res.stdout
    assert "REPORT #REP-2026-000078" not in pdf_text
    assert "STATUS: FINAL" not in pdf_text
    assert "Version: v1.0" not in pdf_text
    assert "HMAC Digest:" not in pdf_text
    assert "Scan QR to Verify Authenticity Online" in pdf_text


def test_generate_medical_report_pdf_letterhead_mode(tmp_path):
    """Verify medical report PDF renders in letterhead mode with suppressed lab banner."""
    import subprocess
    lab_info = {
        "name": "Should Not Appear In Letterhead Top Banner",
        "address": "123 Physical Street",
        "phone": "555-0100",
        "email": "lab@example.com",
    }
    patient_info = {
        "name": "Letterhead Patient",
        "id_display": "PAT-LH-1",
        "age": 35,
        "gender": "Male",
        "booking_id_display": "BKG-LH-1",
    }
    test_info = {"name": "Complete Blood Count", "code": "CBC-01"}
    report_info = {
        "report_id_display": "REP-LH-001",
        "status": "FINAL",
        "version": 1,
        "date": "24-Oct-2026",
    }
    result_vals = [
        {
            "parameter_name": "Hemoglobin",
            "numeric_value": 14.5,
            "text_value": None,
            "unit": "g/dL",
            "reference_range_display": "13.0 - 17.0",
            "flag": "NORMAL",
        }
    ]
    out_pdf = str(tmp_path / "letterhead_report.pdf")
    generate_medical_report_pdf(
        lab_info=lab_info,
        patient_info=patient_info,
        test_info=test_info,
        report_info=report_info,
        result_values=result_vals,
        narrative_info={},
        qr_url="https://trustmylab.in/verify/lh1",
        hmac_digest="abcde12345",
        output_path=out_pdf,
        is_letterhead=True,
        top_margin_mm=48,
        bottom_margin_mm=28,
    )

    assert os.path.exists(out_pdf)
    assert os.path.getsize(out_pdf) > 1000

    res = subprocess.run(["pdftotext", out_pdf, "-"], capture_output=True, text=True)
    pdf_text = res.stdout
    # Should contain patient and test data
    assert "Letterhead Patient" in pdf_text
    assert "Hemoglobin" in pdf_text
    assert "14.5" in pdf_text
    # Should NOT contain full lab header banner
    assert "Should Not Appear In Letterhead Top Banner" not in pdf_text


def test_generate_consolidated_booking_report_pdf_letterhead_mode(tmp_path):
    """Verify consolidated booking report PDF renders in letterhead mode."""
    import subprocess
    lab_info = {
        "name": "Should Not Appear In Consolidated Letterhead Top",
        "address": "123 Physical Street",
        "phone": "555-0100",
        "email": "lab@example.com",
    }
    patient_info = {
        "name": "Booking Letterhead Patient",
        "id_display": "PAT-BKG-LH",
        "age": 40,
        "gender": "Female",
    }
    booking_info = {
        "booking_id_display": "BKG-2026-0099",
        "appointment_date": "24-Oct-2026",
        "status": "CONFIRMED",
    }
    reports_data = [
        {
            "report_id_display": "REP-BKG-01",
            "status": "FINAL",
            "version": 1,
            "test_name": "Thyroid Profile",
            "test_code": "THY-01",
            "sample_type": "Serum",
            "sample_id_display": "SMP-001",
            "result_values": [
                {
                    "parameter_name": "TSH",
                    "numeric_value": 2.5,
                    "text_value": None,
                    "unit": "uIU/mL",
                    "reference_range_display": "0.4 - 4.2",
                    "flag": "NORMAL",
                }
            ],
            "narrative_info": {},
        }
    ]
    out_pdf = str(tmp_path / "consolidated_letterhead.pdf")
    generate_consolidated_booking_report_pdf(
        lab_info=lab_info,
        patient_info=patient_info,
        booking_info=booking_info,
        reports_data=reports_data,
        qr_url="https://trustmylab.in/verify/bkglh",
        output_path=out_pdf,
        is_letterhead=True,
        top_margin_mm=48,
        bottom_margin_mm=28,
    )

    assert os.path.exists(out_pdf)
    assert os.path.getsize(out_pdf) > 1000

    res = subprocess.run(["pdftotext", out_pdf, "-"], capture_output=True, text=True)
    pdf_text = res.stdout
    assert "Booking Letterhead Patient" in pdf_text
    assert "Thyroid Profile" in pdf_text
    assert "TSH" in pdf_text
    assert "Should Not Appear In Consolidated Letterhead Top" not in pdf_text


def test_generate_medical_report_pdf_with_background_image(tmp_path):
    """Verify medical report PDF renders with full-bleed letterhead background image."""
    import subprocess
    # Create dummy letterhead PNG image
    lh_img_path = str(tmp_path / "lab_letterhead_bg.png")
    dummy_img = PILImage.new("RGB", (1240, 1754), (245, 250, 255))
    dummy_img.save(lh_img_path, format="PNG")

    lab_info = {
        "name": "Generic Digital Name Not Displayed When BG Active",
        "address": "123 Physical Street",
        "phone": "555-0100",
        "email": "lab@example.com",
        "letterhead_image": lh_img_path,
        "use_letterhead_background": True,
    }
    patient_info = {
        "name": "Letterhead Image Patient",
        "id_display": "PAT-LH-IMG-1",
        "age": 30,
        "gender": "Male",
        "booking_id_display": "BKG-LH-IMG-1",
    }
    test_info = {"name": "Liver Function Test", "code": "LFT-01"}
    report_info = {
        "report_id_display": "REP-BG-001",
        "status": "FINAL",
        "version": 1,
        "date": "24-Oct-2026",
    }
    result_vals = [
        {
            "parameter_name": "SGPT (ALT)",
            "numeric_value": 28.0,
            "text_value": None,
            "unit": "U/L",
            "reference_range_display": "0 - 45",
            "flag": "NORMAL",
        }
    ]
    out_pdf = str(tmp_path / "report_with_background.pdf")
    generate_medical_report_pdf(
        lab_info=lab_info,
        patient_info=patient_info,
        test_info=test_info,
        report_info=report_info,
        result_values=result_vals,
        narrative_info={},
        qr_url="https://trustmylab.in/verify/bg1",
        hmac_digest="abcde12345",
        output_path=out_pdf,
        is_letterhead=False,
        top_margin_mm=48,
        bottom_margin_mm=28,
    )

    assert os.path.exists(out_pdf)
    assert os.path.getsize(out_pdf) > 2000

    res = subprocess.run(["pdftotext", out_pdf, "-"], capture_output=True, text=True)
    pdf_text = res.stdout
    assert "Letterhead Image Patient" in pdf_text
    assert "SGPT (ALT)" in pdf_text
    assert "Generic Digital Name Not Displayed When BG Active" not in pdf_text


def test_generate_medical_report_pdf_with_pdf_letterhead(tmp_path):
    """Verify medical report PDF renders with a vector 1-page PDF letterhead overlay."""
    import subprocess
    import pypdf
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Paragraph
    from reportlab.lib.styles import getSampleStyleSheet

    # Create dummy 1-page PDF letterhead
    lh_pdf_path = str(tmp_path / "official_vector_letterhead.pdf")
    doc_lh = SimpleDocTemplate(lh_pdf_path, pagesize=A4)
    styles = getSampleStyleSheet()
    doc_lh.build([Paragraph("<b>OFFICIAL PRE-PRINTED CLINIC HEADER ON PDF</b>", styles["Heading1"])])

    lab_info = {
        "name": "Generic Digital Name",
        "address": "123 Physical Street",
        "phone": "555-0100",
        "email": "lab@example.com",
        "letterhead_image": lh_pdf_path,
        "use_letterhead_background": True,
    }
    patient_info = {
        "name": "PDF Letterhead Patient",
        "id_display": "PAT-PDF-LH-1",
        "age": 32,
        "gender": "Female",
        "booking_id_display": "BKG-PDF-LH-1",
    }
    test_info = {"name": "Kidney Function Test", "code": "KFT-01"}
    report_info = {
        "report_id_display": "REP-PDF-001",
        "status": "FINAL",
        "version": 1,
        "date": "24-Oct-2026",
    }
    result_vals = [
        {
            "parameter_name": "Serum Creatinine",
            "numeric_value": 0.9,
            "text_value": None,
            "unit": "mg/dL",
            "reference_range_display": "0.6 - 1.2",
            "flag": "NORMAL",
        }
    ]
    out_pdf = str(tmp_path / "final_report_on_pdf_letterhead.pdf")
    generate_medical_report_pdf(
        lab_info=lab_info,
        patient_info=patient_info,
        test_info=test_info,
        report_info=report_info,
        result_values=result_vals,
        narrative_info={},
        qr_url="https://trustmylab.in/verify/pdflh1",
        hmac_digest="abcde12345",
        output_path=out_pdf,
        is_letterhead=False,
        top_margin_mm=48,
        bottom_margin_mm=28,
    )

    assert os.path.exists(out_pdf)
    assert os.path.getsize(out_pdf) > 2000

    res = subprocess.run(["pdftotext", out_pdf, "-"], capture_output=True, text=True)
    pdf_text = res.stdout
    # Should contain both the letterhead text and the report content!
    assert "OFFICIAL PRE-PRINTED CLINIC HEADER ON PDF" in pdf_text
    assert "PDF Letterhead Patient" in pdf_text
    assert "Serum Creatinine" in pdf_text
    assert "0.9" in pdf_text





