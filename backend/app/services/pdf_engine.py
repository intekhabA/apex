import os
import re
import html
import datetime
import io
import base64
import logging
import hmac
import hashlib
from typing import List, Optional, Any, Union
from PIL import Image as PILImage
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
    KeepTogether,
    HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
import qrcode

logger = logging.getLogger(__name__)

DEFAULT_SIGNATURE_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "static", "signatures", "default_doctor_signature.png")
)


def get_signature_flowable(
    signature_source: Optional[Union[str, bytes]] = None,
    max_width: float = 140,
    max_height: float = 40,
) -> Optional[Image]:
    """
    Resolves, proportional scales, and returns a human signature Image Flowable.
    Handles:
    - Raw image bytes (PNG, JPEG, etc.)
    - Base64 data URIs (e.g. data:image/png;base64,...)
    - Local filesystem paths or relative paths in storage
    - Seamlessly falls back to the default certified medical doctor handwritten signature image.
    """
    img = None
    try:
        if signature_source:
            if isinstance(signature_source, bytes):
                img = PILImage.open(io.BytesIO(signature_source))
            elif isinstance(signature_source, str):
                sig_str = signature_source.strip()
                if sig_str.startswith("data:image/"):
                    _, b64data = sig_str.split(",", 1)
                    raw_bytes = base64.b64decode(b64data)
                    img = PILImage.open(io.BytesIO(raw_bytes))
                elif len(sig_str) > 200 and not os.path.exists(sig_str) and not sig_str.startswith("http"):
                    try:
                        raw_bytes = base64.b64decode(sig_str)
                        img = PILImage.open(io.BytesIO(raw_bytes))
                    except Exception:
                        pass

                if img is None:
                    candidate_paths = [
                        sig_str,
                        os.path.abspath(sig_str),
                        os.path.join(os.getcwd(), sig_str.lstrip("/")),
                        os.path.join("/app", sig_str.lstrip("/")),
                    ]
                    try:
                        from app.core.config import settings
                        storage_root = os.path.abspath(settings.STORAGE_LOCAL_ROOT)
                        clean_sub = sig_str.replace("storage/uploads/", "").replace("storage/", "").lstrip("/")
                        candidate_paths.append(os.path.join(storage_root, clean_sub))
                    except Exception:
                        pass

                    for p in candidate_paths:
                        if p and os.path.isfile(p):
                            img = PILImage.open(p)
                            break

        # Fallback to default doctor signature PNG asset
        if img is None and os.path.isfile(DEFAULT_SIGNATURE_PATH):
            img = PILImage.open(DEFAULT_SIGNATURE_PATH)

        if img is None:
            return None

        orig_w, orig_h = img.size
        if orig_w <= 0 or orig_h <= 0:
            return None

        aspect = orig_w / float(orig_h)
        calc_w = max_height * aspect
        calc_h = max_height
        if calc_w > max_width:
            calc_w = max_width
            calc_h = max_width / aspect

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        sig_img = Image(buf, width=calc_w, height=calc_h)
        sig_img.hAlign = "RIGHT"
        return sig_img

    except Exception as exc:
        logger.warning("Could not render human signature image: %s", exc)
        return None



def clean_html_for_reportlab(content: Optional[str]) -> str:
    """
    Sanitizes and transforms HTML from the rich text editor into valid ReportLab Paragraph XML.
    ReportLab requires:
    - Strict self-closing <br/> tags (unclosed <br> causes crash)
    - Entities properly handled
    - Headings converted to bold text with font styling
    - Lists converted to bullet points (&bull;)
    - Divs and Ps converted to line-broken blocks
    - Unsupported tags stripped while preserving text
    """
    if not content:
        return ""

    text = str(content)

    # Normalize line breaks
    text = re.sub(r'<br\s*/?>', '<br/>', text, flags=re.IGNORECASE)

    # Headings
    text = re.sub(r'<h[1-6][^>]*>(.*?)</h[1-6]>', r'<b>\1</b><br/>', text, flags=re.IGNORECASE | re.DOTALL)

    # Lists
    text = re.sub(r'<li[^>]*>(.*?)</li>', r'&bull; \1<br/>', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'</?(?:ul|ol)[^>]*>', '', text, flags=re.IGNORECASE)

    # Paragraphs and divs
    text = re.sub(r'<(?:p|div)[^>]*>(.*?)</(?:\1)>', r'\1<br/>', text, flags=re.IGNORECASE | re.DOTALL)

    # Strong and em
    text = re.sub(r'</?strong[^>]*>', lambda m: '<b>' if '<strong' in m.group(0).lower() else '</b>', text, flags=re.IGNORECASE)
    text = re.sub(r'</?em[^>]*>', lambda m: '<i>' if '<em' in m.group(0).lower() else '</i>', text, flags=re.IGNORECASE)

    # Strip other unsupported tags while preserving inner content
    text = re.sub(r'</?(?!(?:b|i|u|font|br|sub|super)\b)[a-zA-Z0-9_-]+[^>]*>', '', text, flags=re.IGNORECASE)

    # Convert remaining newlines
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = text.replace('\n', '<br/>')

    # Compress multiple br tags
    text = re.sub(r'(<br/>\s*){3,}', '<br/><br/>', text)
    text = re.sub(r'^(<br/>\s*)+|(<br/>\s*)+$', '', text)

    return text.strip()


def safe_reportlab_paragraph(raw_content: Optional[str], style: ParagraphStyle, fallback_text: Optional[str] = None) -> Paragraph:
    """
    Creates a ReportLab Paragraph safely. Cleans rich text HTML; if XML parsing fails,
    defensively falls back to escaped plain text to ensure PDF generation never crashes.
    """
    if not raw_content:
        return Paragraph("", style)

    cleaned = clean_html_for_reportlab(raw_content)
    try:
        return Paragraph(cleaned, style)
    except Exception:
        fallback = fallback_text if fallback_text is not None else raw_content
        escaped = html.escape(str(fallback)).replace("\n", "<br/>")
        return Paragraph(escaped, style)



def generate_report_hmac(
    secret_key: str,
    lab_id: str,
    report_id: str,
    patient_id: str,
    test_id: str,
    version: int,
    status: str,
) -> str:
    """Generate a tamper-proof SHA-256 HMAC digital signature for a finalized medical report."""
    message = f"{lab_id}:{report_id}:{patient_id}:{test_id}:{version}:{status}"
    return hmac.new(secret_key.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()


def mask_patient_name(full_name: str) -> str:
    """Mask patient full name for privacy compliance on public verification views."""
    parts = full_name.strip().split()
    masked = []
    for p in parts:
        if len(p) <= 2:
            masked.append(p[0] + "*")
        else:
            masked.append(p[0] + "*" * (len(p) - 2) + p[-1])
    return " ".join(masked)


def format_result_value(numeric_val: Any, text_val: Any = None) -> str:
    """Format an observed test result value for reports.
    If the result is a whole number (non-floating / integer), display without decimals (no '.00').
    If the result is a floating number, display with exactly 2 digits after decimal.
    """
    if numeric_val is not None and str(numeric_val).strip() != "":
        try:
            val_float = float(numeric_val)
            if val_float.is_integer():
                return str(int(val_float))
            return f"{val_float:.2f}"
        except (ValueError, TypeError):
            return str(numeric_val)

    if text_val is not None and str(text_val).strip() != "":
        s_val = str(text_val).strip()
        try:
            val_float = float(s_val)
            if val_float.is_integer():
                return str(int(val_float))
            return f"{val_float:.2f}"
        except (ValueError, TypeError):
            return s_val

    return "—"


def generate_medical_report_pdf(
    lab_info: dict,
    patient_info: dict,
    test_info: dict,
    report_info: dict,
    result_values: List[dict],
    narrative_info: dict,
    qr_url: str,
    hmac_digest: str,
    output_path: str,
) -> str:
    """Renders a production-grade, sealed Diagnostic Medical Report PDF using ReportLab."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # 0.75-inch margins
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    brand_color = colors.HexColor("#0D9488")  # Teal 600
    brand_dark = colors.HexColor("#115E59")   # Teal 800
    slate_dark = colors.HexColor("#1E293B")   # Slate 800
    slate_muted = colors.HexColor("#64748B")  # Slate 500
    slate_light = colors.HexColor("#F8FAFC")  # Slate 50

    title_style = ParagraphStyle(
        "LabTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=brand_dark,
    )
    subtitle_style = ParagraphStyle(
        "LabSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=slate_muted,
    )
    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=brand_dark,
    )
    meta_label = ParagraphStyle(
        "MetaLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=slate_muted,
    )
    meta_value = ParagraphStyle(
        "MetaValue",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=slate_dark,
    )
    table_header = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
    )
    table_cell = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=slate_dark,
    )
    table_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=slate_dark,
    )
    flag_low = ParagraphStyle(
        "FlagLow",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#D97706"),  # Amber
    )
    flag_high = ParagraphStyle(
        "FlagHigh",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#E11D48"),  # Rose
    )
    flag_critical = ParagraphStyle(
        "FlagCritical",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#DC2626"),  # Red
    )

    story = []

    # 1. Header: Laboratory Banner
    lab_text = f"<b>{lab_info.get('name', 'TrustMyLab Diagnostic Services')}</b>"
    lab_details = (
        f"{lab_info.get('address', '123 Medical Center Way')}<br/>"
        f"Phone: {lab_info.get('phone', 'N/A')} | Email: {lab_info.get('email', 'N/A')}<br/>"
        f"Licence / Accreditation: {lab_info.get('license', 'ISO 15189 / NABL Certified')}"
    )
    lab_table = Table(
        [
            [
                Paragraph(lab_text, title_style),
                Paragraph(
                    f"<b>REPORT #{report_info.get('report_id_display', '')}</b><br/>"
                    f"<font color='#0D9488'><b>STATUS: {report_info.get('status', 'FINAL')}</b></font><br/>"
                    f"Version: v{report_info.get('version', 1)}.0",
                    ParagraphStyle("ReportRef", parent=styles["Normal"], alignment=2, fontSize=9, leading=12),
                ),
            ],
            [Paragraph(lab_details, subtitle_style), ""],
        ],
        colWidths=[360, 160],
    )
    lab_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    story.append(lab_table)
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=2, color=brand_color, spaceAfter=8))

    # 2. Patient & Booking Demographics Card
    patient_data = [
        [
            Paragraph("PATIENT NAME:", meta_label),
            Paragraph(f"<b>{str(patient_info.get('name') or 'N/A')}</b>", meta_value),
            Paragraph("PATIENT ID:", meta_label),
            Paragraph(str(patient_info.get("id_display") or "N/A"), meta_value),
        ],
        [
            Paragraph("AGE / GENDER:", meta_label),
            Paragraph(f"{str(patient_info.get('age') or 'N/A')} Yrs / {str(patient_info.get('gender') or 'N/A')}", meta_value),
            Paragraph("BOOKING ID:", meta_label),
            Paragraph(str(patient_info.get("booking_id_display") or "N/A"), meta_value),
        ],
        [
            Paragraph("REFERRED BY:", meta_label),
            Paragraph(str(patient_info.get("referred_by") or "Self / Dr. Consultation"), meta_value),
            Paragraph("DATE / TIME:", meta_label),
            Paragraph(str(report_info.get("date") or "N/A"), meta_value),
        ],
    ]
    p_table = Table(patient_data, colWidths=[95, 165, 95, 165])
    p_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), slate_light),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(p_table)
    story.append(Spacer(1, 14))

    # 3. Diagnostic Test Title
    test_title_text = f"<b>{test_info.get('name', 'Diagnostic Investigation')}</b> ({test_info.get('code', '')})"
    story.append(Paragraph(test_title_text, section_heading))
    story.append(Spacer(1, 6))

    # 4. Results Section: Pathology Analyte Table OR Radiology Narrative
    if result_values:
        # Pathology Analyte Table
        table_rows = [
            [
                Paragraph("<b>TEST PARAMETER / ANALYTE</b>", table_header),
                Paragraph("<b>OBSERVED VALUE</b>", table_header),
                Paragraph("<b>UNIT</b>", table_header),
                Paragraph("<b>REFERENCE INTERVAL</b>", table_header),
                Paragraph("<b>FLAG</b>", table_header),
            ]
        ]
        for v in result_values:
            flag_str = str(v.get("flag", "NORMAL"))
            if "CRITICAL" in flag_str:
                f_style = flag_critical
            elif "HIGH" in flag_str:
                f_style = flag_high
            elif "LOW" in flag_str:
                f_style = flag_low
            else:
                f_style = table_cell

            val_display = format_result_value(v.get("numeric_value"), v.get("text_value"))

            table_rows.append(
                [
                    Paragraph(f"<b>{v.get('parameter_name', '')}</b>", table_cell_bold),
                    Paragraph(val_display, table_cell_bold),
                    Paragraph(v.get("unit") or "—", table_cell),
                    Paragraph(v.get("reference_range_display") or "—", table_cell),
                    Paragraph(flag_str.replace("_", " "), f_style),
                ]
            )

        res_table = Table(table_rows, colWidths=[170, 95, 65, 125, 65])
        res_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), brand_dark),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, slate_light]),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ]
            )
        )
        story.append(res_table)
    else:
        # Radiology Narrative Findings
        narrative_elements = []
        is_single_box = bool(narrative_info.get("imaging_findings")) and not bool(narrative_info.get("clinical_history")) and not bool(narrative_info.get("imaging_impression"))

        if is_single_box:
            narrative_elements.append(Paragraph("<b>RADIOLOGICAL REPORT &amp; FINDINGS:</b>", meta_label))
            narrative_elements.append(Spacer(1, 4))
            narrative_elements.append(safe_reportlab_paragraph(narrative_info["imaging_findings"], meta_value))
            narrative_elements.append(Spacer(1, 6))

            if narrative_info.get("recommendations"):
                narrative_elements.append(Paragraph("<b>RECOMMENDATIONS:</b>", meta_label))
                narrative_elements.append(safe_reportlab_paragraph(narrative_info["recommendations"], meta_value))
        else:
            if narrative_info.get("clinical_history"):
                narrative_elements.append(Paragraph("<b>CLINICAL HISTORY &amp; INDICATION:</b>", meta_label))
                narrative_elements.append(safe_reportlab_paragraph(narrative_info["clinical_history"], meta_value))
                narrative_elements.append(Spacer(1, 6))

            if narrative_info.get("imaging_findings"):
                narrative_elements.append(Paragraph("<b>FINDINGS:</b>", meta_label))
                narrative_elements.append(safe_reportlab_paragraph(narrative_info["imaging_findings"], meta_value))
                narrative_elements.append(Spacer(1, 6))

            if narrative_info.get("imaging_impression"):
                narrative_elements.append(Paragraph("<b>IMPRESSION:</b>", meta_label))
                narrative_elements.append(safe_reportlab_paragraph(f"<b>{narrative_info['imaging_impression']}</b>", meta_value))
                narrative_elements.append(Spacer(1, 6))

            if narrative_info.get("recommendations"):
                narrative_elements.append(Paragraph("<b>RECOMMENDATIONS:</b>", meta_label))
                narrative_elements.append(safe_reportlab_paragraph(narrative_info["recommendations"], meta_value))

        story.append(KeepTogether(narrative_elements))

    story.append(Spacer(1, 20))

    # 5. Footer: QR Code, HMAC Security Stamp, and Digital Signature
    # Generate QR Code image in memory
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=4,
        border=1,
    )
    qr.add_data(qr_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")

    qr_buffer = io.BytesIO()
    qr_img.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)

    qr_flowable = Image(qr_buffer, width=1.1 * inch, height=1.1 * inch)

    hmac_short = f"{hmac_digest[:16]}...{hmac_digest[-8:]}" if hmac_digest else "N/A"
    approver_name = report_info.get("approved_by_name", "Authorized Laboratory Pathologist")

    footer_text = (
        f"<b>Scan QR to Verify Authenticity Online</b><br/>"
        f"<font color='#64748B'>Portal: {qr_url}</font><br/>"
        f"<font color='#64748B'>HMAC Digest: {hmac_short}</font><br/>"
        f"<i>This medical report is tamper-proof signed and electronically validated.</i>"
    )

    sig_source = (
        report_info.get("signature_image")
        or report_info.get("signature_image_url")
        or report_info.get("signature_bytes")
    )
    sig_flowable = get_signature_flowable(sig_source, max_width=140, max_height=38)

    signatory_title = report_info.get("signatory_title") or "Consultant Pathologist / Radiologist"
    signatory_degrees = report_info.get("signatory_degrees") or ""
    signatory_reg_no = report_info.get("signatory_reg_no") or ""

    cred_parts = [signatory_title]
    if signatory_degrees:
        cred_parts.append(signatory_degrees)
    if signatory_reg_no:
        cred_parts.append(f"Reg: {signatory_reg_no}")
    cred_str = " | ".join(cred_parts)

    sig_cell_elements = [
        Paragraph(
            "<b>Digitally Authenticated &amp; Signed By:</b>",
            ParagraphStyle("SigAuthHeader", parent=styles["Normal"], fontSize=7.5, leading=9.5, alignment=2, textColor=colors.HexColor("#475569")),
        )
    ]
    if sig_flowable:
        sig_cell_elements.append(Spacer(1, 2))
        sig_cell_elements.append(sig_flowable)
        sig_cell_elements.append(Spacer(1, 2))

    sig_info_text = (
        f"<b>{approver_name}</b><br/>"
        f"<font color='#64748B'>{cred_str}</font><br/>"
        f"<font color='#94A3B8'>Date: {report_info.get('finalized_at', 'N/A')}</font>"
    )
    sig_cell_elements.append(
        Paragraph(
            sig_info_text,
            ParagraphStyle("SigDocInfo", parent=styles["Normal"], fontSize=8, leading=10.5, alignment=2, textColor=slate_dark),
        )
    )

    sig_sub_table = Table(
        [[elem] for elem in sig_cell_elements],
        colWidths=[185],
    )
    sig_sub_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    footer_table = Table(
        [
            [
                qr_flowable,
                Paragraph(footer_text, subtitle_style),
                sig_sub_table,
            ]
        ],
        colWidths=[85, 250, 185],
    )
    footer_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LINEABOVE", (0, 0), (-1, 0), 1, brand_color),
            ]
        )
    )

    story.append(KeepTogether(footer_table))

    # Build PDF
    doc.build(story)
    return output_path


def generate_payment_receipt_pdf(
    lab_info: dict,
    patient_info: dict,
    payment_info: dict,
    invoice_summary: dict,
    output_path: str,
    items: Optional[List[dict]] = None,
) -> str:
    """Renders a printable Payment Receipt PDF matching the print receipt format using ReportLab."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()
    brand_dark = colors.HexColor("#0F766E")
    brand_color = colors.HexColor("#0D9488")
    slate_dark = colors.HexColor("#0F172A")
    slate_body = colors.HexColor("#1E293B")
    slate_muted = colors.HexColor("#64748B")
    slate_light = colors.HexColor("#F8FAFC")
    border_color = colors.HexColor("#CBD5E1")
    inner_border = colors.HexColor("#E2E8F0")
    rose_red = colors.HexColor("#E11D48")

    label_style = ParagraphStyle(
        "RecLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10.5,
        textColor=slate_muted,
    )
    val_style = ParagraphStyle(
        "RecVal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=slate_dark,
    )
    val_right_style = ParagraphStyle(
        "RecValRight",
        parent=val_style,
        alignment=2,
    )

    story = []

    # 1. Header: Laboratory details on left, Receipt badge & date on right
    lab_text = f"<b>{lab_info.get('name', 'TrustMyLab Diagnostics').upper()}</b>"
    lab_phone = lab_info.get("phone")
    phone_part = f"Phone: {lab_phone} | " if lab_phone and lab_phone != "N/A" else ""
    lab_details = (
        f"{lab_info.get('address', 'Accredited Pathology & Diagnostic Healthcare Center')}<br/>"
        f"{phone_part}Reg / License: {lab_info.get('license', 'Accredited Laboratory')}"
    )

    receipt_title = "PAYMENT RECEIPT / BILL"
    receipt_num = payment_info.get("receipt_id_display") or invoice_summary.get("invoice_id_display") or "REC"
    ist_tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30), name="IST")
    raw_date = payment_info.get("date")
    if not raw_date or raw_date == "N/A":
        date_str = datetime.datetime.now(ist_tz).strftime("%d-%b-%Y %I:%M %p")
    elif isinstance(raw_date, datetime.datetime):
        if raw_date.tzinfo is None:
            raw_date = raw_date.replace(tzinfo=datetime.timezone.utc)
        date_str = raw_date.astimezone(ist_tz).strftime("%d-%b-%Y %I:%M %p")
    elif isinstance(raw_date, str) and ("T" in raw_date or raw_date.endswith("Z")):
        try:
            clean_str = raw_date.replace("Z", "+00:00")
            parsed_dt = datetime.datetime.fromisoformat(clean_str)
            if parsed_dt.tzinfo is None:
                parsed_dt = parsed_dt.replace(tzinfo=datetime.timezone.utc)
            date_str = parsed_dt.astimezone(ist_tz).strftime("%d-%b-%Y %I:%M %p")
        except Exception:
            date_str = raw_date
    else:
        date_str = str(raw_date)

    header_table = Table(
        [
            [
                Paragraph(
                    lab_text,
                    ParagraphStyle(
                        "RecLabTitle",
                        parent=styles["Normal"],
                        fontName="Helvetica-Bold",
                        fontSize=15,
                        leading=18,
                        textColor=brand_dark,
                    ),
                ),
                Paragraph(
                    f"<b>{receipt_title}</b><br/>"
                    f"<font color='#0F172A'><b>#{receipt_num}</b></font><br/>"
                    f"<font color='#64748B'>{date_str}</font>",
                    ParagraphStyle(
                        "RecBadge",
                        parent=styles["Normal"],
                        fontName="Helvetica",
                        alignment=2,
                        fontSize=8.5,
                        leading=12,
                        textColor=brand_dark,
                    ),
                ),
            ],
            [
                Paragraph(
                    lab_details,
                    ParagraphStyle(
                        "RecLabMeta",
                        parent=styles["Normal"],
                        fontName="Helvetica",
                        fontSize=8,
                        leading=10.5,
                        textColor=slate_muted,
                    ),
                ),
                "",
            ],
        ],
        colWidths=[332, 190],
    )
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=2, color=brand_color, spaceBefore=4, spaceAfter=8))

    # 2. Patient Details Card (2-column layout)
    gender_str = patient_info.get("gender") or "—"
    age_val = patient_info.get("age")
    age_str = f"{age_val}y" if age_val else "—"
    gender_age_str = f"{gender_str} / {age_str}"

    patient_card_data = [
        [
            Paragraph("Patient Name:", label_style),
            Paragraph(f"<b>{patient_info.get('name', 'N/A')}</b>", val_style),
            Paragraph("Phone:", label_style),
            Paragraph(f"<b>{patient_info.get('phone', 'N/A')}</b>", val_style),
        ],
        [
            Paragraph("Patient ID:", label_style),
            Paragraph(f"<b>{patient_info.get('id_display', 'N/A')}</b>", val_style),
            Paragraph("Booking Ref:", label_style),
            Paragraph(f"<b>{patient_info.get('booking_id_display', 'N/A')}</b>", val_style),
        ],
        [
            Paragraph("Gender / Age:", label_style),
            Paragraph(f"<b>{gender_age_str}</b>", val_style),
            Paragraph("Ref. Doctor:", label_style),
            Paragraph(f"<b>{patient_info.get('referring_doctor', 'Self / Walk-in')}</b>", val_style),
        ],
    ]
    ref_table = Table(patient_card_data, colWidths=[85, 176, 85, 176])
    ref_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), slate_light),
                ("BOX", (0, 0), (-1, -1), 0.5, border_color),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, inner_border),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(ref_table)
    story.append(Spacer(1, 8))

    # 3. Itemized Ordered Tests & Packages Table
    th_style = ParagraphStyle(
        "RecTH",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
    )
    th_center_style = ParagraphStyle("RecTHCenter", parent=th_style, alignment=1)
    th_right_style = ParagraphStyle("RecTHRight", parent=th_style, alignment=2)

    td_style = ParagraphStyle(
        "RecTD",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=slate_body,
    )
    td_center_style = ParagraphStyle("RecTDCenter", parent=td_style, alignment=1, textColor=slate_muted)
    td_right_style = ParagraphStyle("RecTDRight", parent=td_style, alignment=2, fontName="Helvetica-Bold", textColor=slate_dark)
    td_type_style = ParagraphStyle("RecTDType", parent=td_style, fontSize=7.5, leading=9.5, textColor=colors.HexColor("#475569"))

    table_rows = [
        [
            Paragraph("#", th_center_style),
            Paragraph("TEST / INVESTIGATION DESCRIPTION", th_style),
            Paragraph("TYPE", th_style),
            Paragraph("PRICE (Rs.)", th_right_style),
        ]
    ]

    if items and len(items) > 0:
        for idx, it in enumerate(items, 1):
            name = it.get("name", "Diagnostic Investigation")
            itype = it.get("type", "TEST")
            price = float(it.get("price", 0))
            table_rows.append(
                [
                    Paragraph(str(idx), td_center_style),
                    Paragraph(f"<b>{name}</b>", td_style),
                    Paragraph(f"{itype}", td_type_style),
                    Paragraph(f"Rs. {price:.2f}", td_right_style),
                ]
            )
    else:
        table_rows.append(
            [
                Paragraph("1", td_center_style),
                Paragraph("<b>Diagnostic investigation services rendered</b>", td_style),
                Paragraph("ORDER", td_type_style),
                Paragraph(f"Rs. {float(invoice_summary.get('subtotal', 0)):.2f}", td_right_style),
            ]
        )

    items_table = Table(table_rows, colWidths=[32, 310, 80, 100])
    items_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), brand_dark),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, slate_light]),
                ("GRID", (0, 0), (-1, -1), 0.5, inner_border),
            ]
        )
    )
    story.append(items_table)
    story.append(Spacer(1, 8))

    # 4. Payment Transaction Ledger & Financial Summary Box
    pay_rows = [
        [
            Paragraph(
                "<b>PAYMENT TRANSACTION DETAILS</b>",
                ParagraphStyle("PayH", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=brand_dark),
            ),
            "",
        ],
        [Paragraph("Payment Method:", label_style), Paragraph(f"<b>{payment_info.get('payment_method', 'CASH')}</b>", val_style)],
        [Paragraph("Transaction Ref:", label_style), Paragraph(str(payment_info.get("transaction_reference") or "Cash Desk"), val_style)],
        [Paragraph("Desk Staff:", label_style), Paragraph(str(payment_info.get("received_by_name") or "Laboratory Cashier"), val_style)],
        [Paragraph("Payment Status:", label_style), Paragraph(f"<b>{invoice_summary.get('payment_status', 'PENDING')}</b>", val_style)],
    ]
    pay_subtable = Table(pay_rows, colWidths=[90, 144])
    pay_subtable.setStyle(
        TableStyle(
            [
                ("SPAN", (0, 0), (1, 0)),
                ("BACKGROUND", (0, 0), (-1, -1), slate_light),
                ("BOX", (0, 0), (-1, -1), 0.5, border_color),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, inner_border),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )

    subtotal = float(invoice_summary.get("subtotal", 0))
    discount = float(invoice_summary.get("discount_amount", 0))
    tax = float(invoice_summary.get("tax_amount", 0))
    grand_total = float(invoice_summary.get("grand_total", 0))
    paid_amount = float(invoice_summary.get("paid_amount", 0))
    balance_amount = float(invoice_summary.get("balance_amount", 0))
    pay_method = payment_info.get("payment_method", "CASH")

    tot_rows = [
        [Paragraph("Subtotal:", label_style), Paragraph(f"Rs. {subtotal:.2f}", val_right_style)],
    ]
    if discount > 0:
        tot_rows.append(
            [
                Paragraph("Discount:", ParagraphStyle("TotDiscL", parent=label_style, textColor=brand_dark)),
                Paragraph(f"-Rs. {discount:.2f}", ParagraphStyle("TotDiscV", parent=val_right_style, textColor=brand_dark, fontName="Helvetica-Bold")),
            ]
        )
    if tax > 0:
        tot_rows.append(
            [
                Paragraph("Tax:", label_style),
                Paragraph(f"Rs. {tax:.2f}", val_right_style),
            ]
        )

    tot_rows.extend(
        [
            [
                Paragraph("<b>Grand Total:</b>", ParagraphStyle("TotGTL", parent=label_style, fontSize=9, leading=11, textColor=slate_dark)),
                Paragraph(f"<b>Rs. {grand_total:.2f}</b>", ParagraphStyle("TotGTV", parent=val_right_style, fontSize=9.5, leading=11, textColor=slate_dark, fontName="Helvetica-Bold")),
            ],
            [
                Paragraph(f"<b>Amount Paid ({pay_method}):</b>", ParagraphStyle("TotPaidL", parent=label_style, textColor=brand_dark)),
                Paragraph(f"<b>Rs. {paid_amount:.2f}</b>", ParagraphStyle("TotPaidV", parent=val_right_style, textColor=brand_dark, fontName="Helvetica-Bold")),
            ],
            [
                Paragraph("<b>Balance Due:</b>", ParagraphStyle("TotBalL", parent=label_style, textColor=rose_red)),
                Paragraph(f"<b>Rs. {balance_amount:.2f}</b>", ParagraphStyle("TotBalV", parent=val_right_style, textColor=rose_red, fontName="Helvetica-Bold")),
            ],
        ]
    )

    tot_subtable = Table(tot_rows, colWidths=[160, 126])
    tot_subtable.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), slate_light),
                ("BOX", (0, 0), (-1, -1), 0.5, border_color),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, inner_border),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("LINEABOVE", (0, len(tot_rows) - 3), (1, len(tot_rows) - 3), 1, border_color),
            ]
        )
    )

    bottom_table = Table(
        [[pay_subtable, tot_subtable]],
        colWidths=[236, 286],
    )
    bottom_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(bottom_table)
    story.append(Spacer(1, 10))

    # 5. Footer & Authorized Sign
    story.append(HRFlowable(width="100%", thickness=0.5, color=border_color, spaceBefore=4, spaceAfter=6))

    sign_subtable = Table(
        [
            [""],
            [Paragraph("<b>Authorized Cashier / Desk Sign</b>", ParagraphStyle("SignLabel", parent=styles["Normal"], alignment=2, fontSize=8, leading=10, textColor=slate_muted))],
        ],
        colWidths=[180],
        rowHeights=[28, 12],
    )
    sign_subtable.setStyle(
        TableStyle(
            [
                ("LINEABOVE", (0, 1), (0, 1), 1, colors.HexColor("#94A3B8")),
                ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                ("TOPPADDING", (0, 0), (-1, -1), 1),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    footer_table = Table(
        [
            [
                Paragraph(
                    "<i>Official computer-generated receipt issued by TrustMyLab Healthcare.</i><br/>"
                    "<font color='#94A3B8'>Retain this receipt for insurance claims and specimen tracking.</font>",
                    ParagraphStyle("FootText", parent=styles["Normal"], fontSize=8, leading=11, textColor=slate_muted),
                ),
                sign_subtable,
            ]
        ],
        colWidths=[332, 190],
    )
    footer_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(footer_table)

    doc.build(story)
    return output_path


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        # Running top header on pages 2+
        if self._pageNumber > 1:
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(36, A4[1] - 30, A4[0] - 36, A4[1] - 30)
            self.drawString(36, A4[1] - 24, "TrustMyLab Consolidated Diagnostic Report")
            self.drawRightString(A4[0] - 36, A4[1] - 24, "Confidential Medical Record")

        # Running bottom footer
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(36, 30, A4[0] - 36, 30)
        self.drawString(36, 18, "TrustMyLab — Validated Electronic Health Record — Strictly Confidential")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(A4[0] - 36, 18, page_text)
        self.restoreState()


def generate_consolidated_booking_report_pdf(
    lab_info: dict,
    patient_info: dict,
    booking_info: dict,
    reports_data: List[dict],
    qr_url: str,
    output_path: str,
) -> str:
    """Renders a production-grade Consolidated Diagnostic Report PDF containing all reports for a single booking."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=42,
    )

    styles = getSampleStyleSheet()

    # Color Palette
    brand_color = colors.HexColor("#0D9488")  # Teal 600
    brand_dark = colors.HexColor("#115E59")   # Teal 800
    slate_dark = colors.HexColor("#1E293B")   # Slate 800
    slate_muted = colors.HexColor("#64748B")  # Slate 500
    slate_light = colors.HexColor("#F8FAFC")  # Slate 50
    border_color = colors.HexColor("#CBD5E1") # Slate 300
    grid_color = colors.HexColor("#E2E8F0")   # Slate 200

    title_style = ParagraphStyle(
        "ConsolidatedLabTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=17,
        leading=21,
        textColor=brand_dark,
    )
    subtitle_style = ParagraphStyle(
        "ConsolidatedLabSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11.5,
        textColor=slate_muted,
    )
    meta_label = ParagraphStyle(
        "ConsolidatedMetaLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=slate_muted,
    )
    meta_value = ParagraphStyle(
        "ConsolidatedMetaValue",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=slate_dark,
    )
    panel_title_style = ParagraphStyle(
        "PanelTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.white,
    )
    panel_sub_style = ParagraphStyle(
        "PanelSub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#CCFBF1"),
        alignment=2,
    )
    table_header = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
    )
    table_cell = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10.5,
        textColor=slate_dark,
    )
    table_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10.5,
        textColor=slate_dark,
    )
    flag_normal = ParagraphStyle(
        "FlagNormal",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#059669"),
    )
    flag_low = ParagraphStyle(
        "FlagLow",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#D97706"),
    )
    flag_high = ParagraphStyle(
        "FlagHigh",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#E11D48"),
    )
    flag_critical = ParagraphStyle(
        "FlagCritical",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#DC2626"),
    )
    notice_text = ParagraphStyle(
        "NoticeText",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8.5,
        leading=11,
        textColor=slate_muted,
    )

    story = []

    # 1. Header: Laboratory Banner & Consolidated Document Identification
    lab_text = f"<b>{lab_info.get('name', 'TrustMyLab Diagnostic Services')}</b>"
    lab_details = (
        f"{lab_info.get('address', '123 Medical Center Way')}<br/>"
        f"Phone: {lab_info.get('phone', 'N/A')} | Email: {lab_info.get('email', 'N/A')}<br/>"
        f"Accreditation / Reg: {lab_info.get('license', 'ISO 15189 / NABL Certified')}"
    )
    booking_header_block = (
        f"<b>CONSOLIDATED DIAGNOSTIC REPORT</b><br/>"
        f"<font color='#0D9488'><b>BOOKING #{booking_info.get('booking_id_display', '')}</b></font><br/>"
        f"Order Status: <b>{booking_info.get('status', 'PENDING')}</b><br/>"
        f"<font color='#64748B'>Date: {booking_info.get('appointment_date', 'N/A')}</font>"
    )
    lab_table = Table(
        [
            [
                Paragraph(lab_text, title_style),
                Paragraph(
                    booking_header_block,
                    ParagraphStyle("BookingRef", parent=styles["Normal"], alignment=2, fontSize=9, leading=12.5),
                ),
            ],
            [Paragraph(lab_details, subtitle_style), ""],
        ],
        colWidths=[335, 185],
    )
    lab_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    story.append(lab_table)
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=2, color=brand_color, spaceAfter=8))

    # 2. Patient & Booking Demographics Card
    patient_data = [
        [
            Paragraph("PATIENT NAME:", meta_label),
            Paragraph(f"<b>{str(patient_info.get('name') or 'N/A')}</b>", meta_value),
            Paragraph("PATIENT ID:", meta_label),
            Paragraph(str(patient_info.get("id_display") or "N/A"), meta_value),
        ],
        [
            Paragraph("AGE / GENDER:", meta_label),
            Paragraph(f"{str(patient_info.get('age') or 'N/A')} Yrs / {str(patient_info.get('gender') or 'N/A')}", meta_value),
            Paragraph("CONTACT:", meta_label),
            Paragraph(f"{str(patient_info.get('phone') or 'N/A')}", meta_value),
        ],
        [
            Paragraph("REFERRED BY:", meta_label),
            Paragraph(str(patient_info.get("referred_by") or "Self / Dr. Consultation"), meta_value),
            Paragraph("APPOINTMENT:", meta_label),
            Paragraph(f"{booking_info.get('appointment_date', 'N/A')} {booking_info.get('appointment_time') or ''}".strip(), meta_value),
        ],
    ]
    if booking_info.get("clinical_notes"):
        patient_data.append([
            Paragraph("CLINICAL NOTES:", meta_label),
            Paragraph(str(booking_info.get("clinical_notes")), meta_value),
            "",
            "",
        ])

    p_table = Table(patient_data, colWidths=[90, 170, 90, 170])
    p_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), slate_light),
                ("BOX", (0, 0), (-1, -1), 0.5, border_color),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, grid_color),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    if booking_info.get("clinical_notes"):
        p_table.setStyle(TableStyle([("SPAN", (1, 3), (3, 3))]))

    story.append(p_table)
    story.append(Spacer(1, 10))

    # 3. Order Summary Table (Index of all tests in this booking)
    story.append(Paragraph("<b>DIAGNOSTIC INVESTIGATION PANELS INCLUDED IN THIS ORDER</b>", ParagraphStyle("SummaryHeader", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, textColor=brand_dark)))
    story.append(Spacer(1, 4))

    summary_rows = [
        [
            Paragraph("<b>#</b>", table_header),
            Paragraph("<b>INVESTIGATION NAME</b>", table_header),
            Paragraph("<b>SPECIMEN TYPE / BARCODE</b>", table_header),
            Paragraph("<b>REPORT ID</b>", table_header),
            Paragraph("<b>STATUS</b>", table_header),
        ]
    ]

    for idx, rep in enumerate(reports_data, start=1):
        st_color = "#059669" if rep.get("status") == "FINAL" else "#D97706" if rep.get("status") == "APPROVED" else "#64748B"
        summary_rows.append([
            Paragraph(str(idx), table_cell_bold),
            Paragraph(f"<b>{rep.get('test_name', 'Diagnostic Test')}</b> ({rep.get('test_code', '')})", table_cell),
            Paragraph(f"{rep.get('sample_type', 'N/A')} [{rep.get('sample_id_display', 'N/A')}]", table_cell),
            Paragraph(str(rep.get("report_id_display", "—")), table_cell_bold),
            Paragraph(f"<font color='{st_color}'><b>{rep.get('status', 'PENDING')}</b></font>", table_cell),
        ])

    summary_table = Table(summary_rows, colWidths=[20, 205, 155, 80, 60])
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), slate_dark),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, slate_light]),
                ("GRID", (0, 0), (-1, -1), 0.5, grid_color),
            ]
        )
    )
    story.append(summary_table)
    story.append(Spacer(1, 14))

    # 4. Detailed Sections for each Report
    for idx, rep in enumerate(reports_data):
        test_elements = []

        # Test Banner
        panel_banner = Table(
            [
                [
                    Paragraph(f"<b>{idx + 1}. {rep.get('test_name', 'Investigation')}</b> ({rep.get('test_code', '')})", panel_title_style),
                    Paragraph(
                        f"REPORT: <b>{rep.get('report_id_display', '')}</b> | "
                        f"STATUS: <b>{rep.get('status', 'DRAFT')}</b> | "
                        f"v{rep.get('version', 1)}.0",
                        panel_sub_style,
                    ),
                ]
            ],
            colWidths=[310, 210],
        )
        panel_banner.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), brand_dark),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        test_elements.append(panel_banner)

        # Specimen sub-bar
        specimen_info_str = (
            f"<b>Specimen:</b> {rep.get('sample_type', 'N/A')} "
            f"({rep.get('sample_container', 'Standard Tube')}) &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>Barcode/ID:</b> {rep.get('sample_id_display', 'N/A')} &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>Methodology:</b> Automated Diagnostic Analyzer"
        )
        specimen_bar = Table(
            [[Paragraph(specimen_info_str, ParagraphStyle("SpecimenSub", parent=styles["Normal"], fontSize=8, leading=10, textColor=slate_muted))]],
            colWidths=[520],
        )
        specimen_bar.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
                    ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("BOX", (0, 0), (-1, -1), 0.5, grid_color),
                ]
            )
        )
        test_elements.append(specimen_bar)
        test_elements.append(Spacer(1, 4))

        # Content: Pathology analyte table OR Radiology narrative OR Pending placeholder
        res_values = rep.get("result_values", [])
        narrative = rep.get("narrative_info", {})

        if res_values:
            table_rows = [
                [
                    Paragraph("<b>TEST PARAMETER / ANALYTE</b>", table_header),
                    Paragraph("<b>OBSERVED VALUE</b>", table_header),
                    Paragraph("<b>UNIT</b>", table_header),
                    Paragraph("<b>REFERENCE INTERVAL</b>", table_header),
                    Paragraph("<b>FLAG</b>", table_header),
                ]
            ]
            for v in res_values:
                flag_str = str(v.get("flag", "NORMAL")).upper()
                if "CRITICAL" in flag_str:
                    f_style = flag_critical
                elif "HIGH" in flag_str:
                    f_style = flag_high
                elif "LOW" in flag_str:
                    f_style = flag_low
                else:
                    f_style = flag_normal

                val_display = format_result_value(v.get("numeric_value"), v.get("text_value"))

                table_rows.append(
                    [
                        Paragraph(f"<b>{v.get('parameter_name', '')}</b>", table_cell_bold),
                        Paragraph(val_display, table_cell_bold),
                        Paragraph(v.get("unit") or "—", table_cell),
                        Paragraph(v.get("reference_range_display") or "—", table_cell),
                        Paragraph(flag_str.replace("_", " "), f_style),
                    ]
                )

            res_table = Table(table_rows, colWidths=[175, 95, 65, 120, 65])
            res_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), brand_color),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                        ("LEFTPADDING", (0, 0), (-1, -1), 6),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, slate_light]),
                        ("GRID", (0, 0), (-1, -1), 0.5, grid_color),
                    ]
                )
            )
            test_elements.append(res_table)

        elif narrative and (narrative.get("clinical_history") or narrative.get("imaging_findings") or narrative.get("imaging_impression")):
            narrative_elements = []
            is_single_box = bool(narrative.get("imaging_findings")) and not bool(narrative.get("clinical_history")) and not bool(narrative.get("imaging_impression"))

            if is_single_box:
                narrative_elements.append(Paragraph("<b>RADIOLOGICAL REPORT &amp; FINDINGS:</b>", meta_label))
                narrative_elements.append(Spacer(1, 3))
                narrative_elements.append(safe_reportlab_paragraph(narrative["imaging_findings"], meta_value))
                narrative_elements.append(Spacer(1, 4))

                if narrative.get("recommendations"):
                    narrative_elements.append(Paragraph("<b>RECOMMENDATIONS:</b>", meta_label))
                    narrative_elements.append(safe_reportlab_paragraph(narrative["recommendations"], meta_value))
            else:
                if narrative.get("clinical_history"):
                    narrative_elements.append(Paragraph("<b>CLINICAL HISTORY &amp; INDICATION:</b>", meta_label))
                    narrative_elements.append(safe_reportlab_paragraph(narrative["clinical_history"], meta_value))
                    narrative_elements.append(Spacer(1, 4))

                if narrative.get("imaging_findings"):
                    narrative_elements.append(Paragraph("<b>FINDINGS:</b>", meta_label))
                    narrative_elements.append(safe_reportlab_paragraph(narrative["imaging_findings"], meta_value))
                    narrative_elements.append(Spacer(1, 4))

                if narrative.get("imaging_impression"):
                    narrative_elements.append(Paragraph("<b>IMPRESSION:</b>", meta_label))
                    narrative_elements.append(safe_reportlab_paragraph(f"<b>{narrative['imaging_impression']}</b>", meta_value))
                    narrative_elements.append(Spacer(1, 4))

                if narrative.get("recommendations"):
                    narrative_elements.append(Paragraph("<b>RECOMMENDATIONS:</b>", meta_label))
                    narrative_elements.append(safe_reportlab_paragraph(narrative["recommendations"], meta_value))

            narrative_table = Table([[narrative_elements]], colWidths=[520])
            narrative_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), slate_light),
                        ("BOX", (0, 0), (-1, -1), 0.5, border_color),
                        ("TOPPADDING", (0, 0), (-1, -1), 6),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                        ("LEFTPADDING", (0, 0), (-1, -1), 8),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ]
                )
            )
            test_elements.append(narrative_table)

        else:
            pending_box = Table(
                [[
                    Paragraph(
                        "<b>Specimen Registered & Accessioned:</b> Laboratory analytical processing is in progress. "
                        "Final results and pathologist sign-off pending.",
                        notice_text
                    )
                ]],
                colWidths=[520],
            )
            pending_box.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEF3C7")),
                        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#F59E0B")),
                        ("TOPPADDING", (0, 0), (-1, -1), 5),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                        ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ]
                )
            )
            test_elements.append(pending_box)

        approver = rep.get("approved_by_name") or "Authorized Medical Signatory"
        final_date = rep.get("finalized_at") or "Pending final review"
        sign_bar = Table(
            [[
                Paragraph(f"<i>Panel Signatory: {approver} &nbsp;|&nbsp; Reviewed: {final_date}</i>", subtitle_style)
            ]],
            colWidths=[520],
        )
        sign_bar.setStyle(
            TableStyle(
                [
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        test_elements.append(sign_bar)
        test_elements.append(Spacer(1, 10))

        story.append(KeepTogether(test_elements))

    story.append(Spacer(1, 10))

    # 5. Master Footer: QR Code, Digital Validation Notice, and Chief Pathologist Authentication
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=4,
        border=1,
    )
    qr.add_data(qr_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")

    qr_buffer = io.BytesIO()
    qr_img.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)
    qr_flowable = Image(qr_buffer, width=1.05 * inch, height=1.05 * inch)

    footer_text = (
        f"<b>Scan QR to Verify All Booking Reports Online</b><br/>"
        f"<font color='#0D9488'>Portal: {qr_url}</font><br/>"
        f"<font color='#64748B'>Booking Reference: #{booking_info.get('booking_id_display', '')}</font><br/>"
        f"<i>This consolidated document is electronically certified by {lab_info.get('name', 'TrustMyLab')}.</i>"
    )

    chief_sig_source = (
        lab_info.get("signature_image")
        or lab_info.get("default_signatory_signature_url")
        or booking_info.get("signature_image")
    )
    chief_sig_flowable = get_signature_flowable(chief_sig_source, max_width=140, max_height=38)

    chief_name = lab_info.get("default_signatory_name") or "Chief Laboratory Officer & Pathologist"
    chief_desig = lab_info.get("default_signatory_designation") or "Consultant Laboratory Medicine"
    chief_degrees = lab_info.get("default_signatory_degrees") or ""
    chief_reg = lab_info.get("default_signatory_reg_no") or ""

    chief_cred_parts = [chief_desig]
    if chief_degrees:
        chief_cred_parts.append(chief_degrees)
    if chief_reg:
        chief_cred_parts.append(f"Reg: {chief_reg}")
    chief_cred_str = " | ".join(chief_cred_parts)

    chief_cell_elements = [
        Paragraph(
            "<b>Digitally Authenticated By:</b>",
            ParagraphStyle("ConsolidatedSigAuth", parent=styles["Normal"], fontSize=7.5, leading=9.5, alignment=2, textColor=colors.HexColor("#475569")),
        )
    ]
    if chief_sig_flowable:
        chief_cell_elements.append(Spacer(1, 2))
        chief_cell_elements.append(chief_sig_flowable)
        chief_cell_elements.append(Spacer(1, 2))

    chief_text = (
        f"<b>{chief_name}</b><br/>"
        f"<font color='#64748B'>{chief_cred_str}</font><br/>"
        f"<font color='#94A3B8'>Validated: {booking_info.get('appointment_date', 'N/A')}</font>"
    )
    chief_cell_elements.append(
        Paragraph(
            chief_text,
            ParagraphStyle("ConsolidatedDocInfo", parent=styles["Normal"], fontSize=8, leading=10.5, alignment=2, textColor=slate_dark),
        )
    )

    chief_sub_table = Table(
        [[elem] for elem in chief_cell_elements],
        colWidths=[185],
    )
    chief_sub_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    footer_table = Table(
        [
            [
                qr_flowable,
                Paragraph(footer_text, subtitle_style),
                chief_sub_table,
            ]
        ],
        colWidths=[80, 255, 185],
    )
    footer_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LINEABOVE", (0, 0), (-1, 0), 1, brand_color),
            ]
        )
    )

    story.append(KeepTogether(footer_table))

    # Build PDF with NumberedCanvas for professional "Page X of Y"
    doc.build(story, canvasmaker=NumberedCanvas)
    return output_path

