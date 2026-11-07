import os
import re
import html
import datetime
import io
import base64
import logging
import hmac
import hashlib
import shutil
import tempfile
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
    PageBreak,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode import code128
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import qrcode

logger = logging.getLogger(__name__)

DEVANAGARI_FONT_PATH = "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf"
DEVANAGARI_BOLD_PATH = "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf"
HAS_DEVANAGARI = False

if os.path.exists(DEVANAGARI_FONT_PATH):
    try:
        pdfmetrics.registerFont(TTFont("Devanagari", DEVANAGARI_FONT_PATH))
        if os.path.exists(DEVANAGARI_BOLD_PATH):
            pdfmetrics.registerFont(TTFont("Devanagari-Bold", DEVANAGARI_BOLD_PATH))
        else:
            pdfmetrics.registerFont(TTFont("Devanagari-Bold", DEVANAGARI_FONT_PATH))
        HAS_DEVANAGARI = True
    except Exception as e:
        logger.warning("Could not register Devanagari font: %s", e)


def infer_subgroup(param_name: str, param_code: str = "") -> Optional[str]:
    """Infers standard subgroup hierarchy for test parameters when not explicitly set."""
    name_upper = (param_name or "").upper()
    code_upper = (param_code or "").upper()

    # Direct parameters under CBC that do not belong to a subgroup
    if code_upper in ["HB", "WBC"] or any(k in name_upper for k in ["HEMOGLOBIN", "HAEMOGLOBIN", "TOTAL LEUCOCYTE", "TOTAL LEUKOCYTE"]):
        return None

    # Differential Count
    if any(k in name_upper for k in ["NEUTROPHIL", "LYMPHOCYTE", "MONOCYTE", "EOSINOPHIL", "BASOPHIL", "BAND CELL", "POLYMORPH"]) or code_upper in ["NEUT", "LYMPH", "MONO", "EOS", "BASO"]:
        return "DIFFERENTIAL COUNT :"

    # RBCs Indices
    if any(k in name_upper for k in ["RBC COUNT", "RBCS COUNT", "PACKED CELL VOLUME", "PCV", "MCV", "MCH", "MCHC", "RDW"]) or code_upper in ["RBC", "HCT", "MCV", "MCH", "MCHC", "RDW_CV", "RDW_SD", "RDW"]:
        return "RBCs Indices"

    # Platelet Indices
    if any(k in name_upper for k in ["PLATELET", "MPV", "PDW", "PCT"]) or code_upper in ["PLT", "MPV", "PDW", "PCT"]:
        return "Platelet Indices"

    return None

DEFAULT_SIGNATURE_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "static", "signatures", "default_doctor_signature.png")
)


def is_pdf_file(file_path: Optional[str]) -> bool:
    """Check if the given file path is a valid PDF document."""
    if not file_path or not os.path.exists(file_path):
        return False
    try:
        with open(file_path, "rb") as f:
            header = f.read(5)
            return header.startswith(b"%PDF")
    except Exception:
        return False


def apply_pdf_letterhead_overlay(content_pdf_path: str, letterhead_pdf_path: str, output_path: str) -> None:
    """
    Overlays content_pdf_path on top of letterhead_pdf_path using pypdf.
    The letterhead page sits in the background, and report content sits on top.
    """
    try:
        import pypdf
        bg_reader = pypdf.PdfReader(letterhead_pdf_path)
        if not bg_reader.pages:
            if content_pdf_path != output_path:
                shutil.copyfile(content_pdf_path, output_path)
            return

        bg_page = bg_reader.pages[0]
        content_reader = pypdf.PdfReader(content_pdf_path)
        writer = pypdf.PdfWriter()

        for page in content_reader.pages:
            merged = pypdf.PageObject.create_blank_page(
                width=page.mediabox.width,
                height=page.mediabox.height,
            )
            # 1. Background layer: letterhead PDF
            merged.merge_page(bg_page)
            # 2. Foreground layer: report text and tables
            merged.merge_page(page)
            writer.add_page(merged)

        if content_pdf_path == output_path:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f_tmp:
                tmp_out = f_tmp.name
            with open(tmp_out, "wb") as f_out:
                writer.write(f_out)
            shutil.move(tmp_out, output_path)
        else:
            with open(output_path, "wb") as f_out:
                writer.write(f_out)
        logger.info("Successfully stamped PDF letterhead overlay onto %s", output_path)
    except Exception as e:
        logger.error("Failed to overlay PDF letterhead: %s", e, exc_info=True)
        if content_pdf_path != output_path and os.path.exists(content_pdf_path):
            shutil.copyfile(content_pdf_path, output_path)


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
    Sanitizes and transforms HTML from the rich text editor or pasted Word/Doc documents
    into valid ReportLab Paragraph XML.
    ReportLab requires:
    - Strict self-closing <br/> tags (unclosed <br> causes crash)
    - Entities properly handled
    - Headings converted to bold text with font styling
    - Lists converted to bullet points (&bull;)
    - Divs, Ps, and Table rows converted to clean line-broken blocks
    - Span styles for font color and highlight converted to <font color="..." backColor="...">
    - MS Word / Office metadata, scripts, styles, and conditional comments stripped
    - Unsupported tags stripped while preserving inner text
    """
    if not content:
        return ""

    text = str(content)

    # 0. Strip MS Office / Word comments, XML blocks, styles, scripts
    text = re.sub(r'<!--\[if[\s\S]*?<!\[endif\]-->', '', text, flags=re.IGNORECASE)
    text = re.sub(r'<!--[\s\S]*?-->', '', text)
    text = re.sub(r'<style[\s\S]*?</style>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'<script[\s\S]*?</script>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'<xml[\s\S]*?</xml>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'</?(?:meta|link|title|o:[a-z0-9_-]+|w:[a-z0-9_-]+|m:[a-z0-9_-]+)[^>]*>', '', text, flags=re.IGNORECASE)

    # 1. Normalize line breaks
    text = re.sub(r'<br\s*/?>', '<br/>', text, flags=re.IGNORECASE)

    # 2. Headings
    text = re.sub(r'<h[1-6][^>]*>(.*?)</h[1-6]>', r'<b>\1</b><br/>', text, flags=re.IGNORECASE | re.DOTALL)

    # 3. Lists: handle list items and wrappers
    text = re.sub(r'<li[^>]*>(.*?)</li>', r'&bull; \1<br/>', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'</?(?:ul|ol)[^>]*>', '<br/>', text, flags=re.IGNORECASE)

    # 4. Tables: format cells and rows cleanly
    text = re.sub(r'<t[dh][^>]*>(.*?)</t[dh]>', r'\1 &nbsp; ', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'<tr[^>]*>(.*?)</tr>', r'\1<br/>', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'</?(?:table|thead|tbody|tfoot)[^>]*>', '', text, flags=re.IGNORECASE)

    # 5. Convert span styles (color and background-color) to ReportLab font tags
    def span_to_font(match):
        style = match.group(1)
        inner = match.group(2)
        c_m = re.search(r'(?:^|;)\s*color:\s*([^;\"]+)', style, re.I)
        bg_m = re.search(r'(?:^|;)\s*background(?:-color)?:\s*([^;\"]+)', style, re.I)
        attrs = []
        if c_m and not re.search(r'windowtext|#000000|rgb\(0,\s*0,\s*0\)', c_m.group(1), re.I):
            attrs.append(f'color="{c_m.group(1).strip()}"')
        if bg_m and not re.search(r'transparent|#ffffff|rgb\(255,\s*255,\s*255\)', bg_m.group(1), re.I):
            attrs.append(f'backColor="{bg_m.group(1).strip()}"')
        if attrs:
            return f'<font {" ".join(attrs)}>{inner}</font>'
        return inner

    for _ in range(3):
        text = re.sub(r'<span[^>]*style=[\"\']([^\"\']*)[\"\'][^>]*>(.*?)</span>', span_to_font, text, flags=re.I | re.DOTALL)

    # 6. Paragraphs and divs:
    # Empty paragraphs (<p>&nbsp;</p>, <p><br/></p>, etc.) become line breaks
    text = re.sub(r'<p[^>]*>(?:\s|&nbsp;|<br\s*/?>)*</p>', '<br/>', text, flags=re.IGNORECASE)
    # Closing paragraph and div tags become line breaks
    text = re.sub(r'</p\s*>', '<br/>', text, flags=re.IGNORECASE)
    text = re.sub(r'</div\s*>', '<br/>', text, flags=re.IGNORECASE)
    # Remove opening paragraph and div tags
    text = re.sub(r'<(?:p|div)[^>]*>', '', text, flags=re.IGNORECASE)

    # 7. Strong and em
    text = re.sub(r'</?strong[^>]*>', lambda m: '<b>' if '<strong' in m.group(0).lower() else '</b>', text, flags=re.IGNORECASE)
    text = re.sub(r'</?em[^>]*>', lambda m: '<i>' if '<em' in m.group(0).lower() else '</i>', text, flags=re.IGNORECASE)

    # 8. Strip other unsupported tags while preserving inner content
    text = re.sub(r'</?(?!(?:b|i|u|font|br|sub|super)\b)[a-zA-Z0-9_-]+[^>]*>', '', text, flags=re.IGNORECASE)

    # 9. Convert remaining raw newlines
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = text.replace('\n', '<br/>')

    # 10. Clean up empty/redundant spaces before/after br and compress 3+ breaks to 2
    text = re.sub(r'(?:&nbsp;|\s)+<br/>', '<br/>', text)
    text = re.sub(r'<br/>(?:&nbsp;|\s)+', '<br/>', text)
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
    is_letterhead: bool = False,
    top_margin_mm: Optional[int] = None,
    bottom_margin_mm: Optional[int] = None,
) -> str:
    """Renders a diagnostic test report PDF matching the exact visual style of Uttam Diagnostic Center:
    - Group and Subgroup hierarchy (HAEMATOLOGY -> COMPLETE BLOOD COUNT -> DIFFERENTIAL COUNT -> RBCs Indices -> Platelet Indices)
    - Clean unbordered report layout (no boxed grid table format)
    - Two clean horizontal black dividing lines for column headers
    - Red & Cyan letterhead branding, patient demographics, barcode, interpretation, emergency strip, and legal disclaimer.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    letterhead_bg_image = lab_info.get("letterhead_image")
    use_letterhead_bg = lab_info.get("use_letterhead_background", True)
    has_letterhead_bg = bool(
        letterhead_bg_image
        and os.path.exists(letterhead_bg_image)
        and use_letterhead_bg
        and not is_letterhead
    )
    is_pdf_letterhead = has_letterhead_bg and is_pdf_file(letterhead_bg_image)
    is_image_letterhead = has_letterhead_bg and not is_pdf_letterhead

    # 1 mm = 72 / 25.4 points
    mm_pt = 72.0 / 25.4
    if is_letterhead or has_letterhead_bg:
        top_m = float(top_margin_mm * mm_pt) if top_margin_mm else (48.0 * mm_pt)
        bottom_m = float(bottom_margin_mm * mm_pt) if bottom_margin_mm else (28.0 * mm_pt)
    else:
        top_m = 24.0
        bottom_m = 24.0

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=top_m,
        bottomMargin=bottom_m,
    )

    styles = getSampleStyleSheet()

    # Colors
    cyan_brand = colors.HexColor(lab_info.get("primary_color_hex", "#0099DD"))
    red_accent = colors.HexColor("#CC0000")
    green_emergency = colors.HexColor("#008855")
    dark_text = colors.HexColor("#1A1A1A")
    muted_text = colors.HexColor("#555555")

    # Typography styles
    hindi_font = "Devanagari" if HAS_DEVANAGARI else "Helvetica"
    hindi_bold = "Devanagari-Bold" if HAS_DEVANAGARI else "Helvetica-Bold"

    title_main_style = ParagraphStyle(
        "UttamMainTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=22,
        leading=25,
        alignment=1,  # Center
        textColor=cyan_brand,
    )
    title_sub_style = ParagraphStyle(
        "UttamSubTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        alignment=1,  # Center
        textColor=red_accent,
    )
    address_hindi_style = ParagraphStyle(
        "UttamHindiAddress",
        parent=styles["Normal"],
        fontName=hindi_font,
        fontSize=7.5,
        leading=10,
        alignment=1,  # Center
        textColor=red_accent,
    )
    reg_phone_style = ParagraphStyle(
        "UttamRegPhone",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10.5,
        alignment=2,  # Right
        textColor=dark_text,
    )
    demo_label_style = ParagraphStyle(
        "DemoLabel",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=dark_text,
    )
    col_hdr_style = ParagraphStyle(
        "ColHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.black,
    )
    group_hdr_style = ParagraphStyle(
        "GroupHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=13,
        alignment=1,  # Centered
        textColor=colors.black,
    )
    test_hdr_style = ParagraphStyle(
        "TestHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        alignment=0,  # Left
        textColor=colors.black,
    )
    subgroup_hdr_style = ParagraphStyle(
        "SubgroupHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        alignment=0,  # Left
        textColor=colors.black,
    )
    param_text_style = ParagraphStyle(
        "ParamText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=dark_text,
    )
    param_text_bold = ParagraphStyle(
        "ParamTextBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=dark_text,
    )
    interp_style = ParagraphStyle(
        "InterpretationText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=dark_text,
    )

    story = []

    # 1. Laboratory Banner / Letterhead
    if not is_letterhead and not has_letterhead_bg:
        raw_name = lab_info.get("name", "UTTAM Diagnostic Center").strip()
        name_tokens = raw_name.split(None, 1)
        name_first = name_tokens[0] if name_tokens else "UTTAM"
        name_rest = name_tokens[1] if len(name_tokens) > 1 else "Diagnostic Center"

        phone_str = lab_info.get("phone", "9918613886, 9519205517")
        phones = [p.strip() for p in phone_str.replace(";", ",").split(",") if p.strip()]
        mob_line_1 = phones[0] if len(phones) > 0 else "9918613886"
        if len(phones) > 1:
            mob_line_1 += f", {phones[1]}"

        reg_block = (
            f"<b>Regd.- {lab_info.get('license', 'RMEE2342261')}</b><br/>"
            f"<font color='#CC0000'><b>Mob. :</b></font> {mob_line_1}"
        )
        if len(phones) > 2:
            reg_block += f"<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{', '.join(phones[2:4])}"
        if len(phones) > 4:
            reg_block += f"<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{', '.join(phones[4:6])}"

        hindi_address = (
            lab_info.get("address_hindi")
            or "पता-पटेल नगर निकट दीवानी न्यायालय गेट नं0 1 सिविल लाइन, भिनगा (श्रावस्ती)"
        )

        # Left logo mark / badge
        logo_flowable = None
        lab_logo_path = lab_info.get("logo_image")
        if lab_logo_path and os.path.exists(lab_logo_path):
            try:
                logo_flowable = Image(lab_logo_path, width=1.1 * inch, height=0.65 * inch)
            except Exception:
                logo_flowable = None

        if not logo_flowable:
            logo_sub = Paragraph(
                f"<font color='#CC0000' size=14><b>✚</b></font><br/>"
                f"<b><font size=7 color='#CC0000'>{raw_name}</font></b>",
                ParagraphStyle("LogoSub", parent=styles["Normal"], alignment=1, leading=8.5),
            )
            logo_cell = logo_sub
        else:
            logo_cell = Table([[logo_flowable], [Paragraph(f"<font size=6.5 color='#CC0000'><b>{raw_name}</b></font>", ParagraphStyle("LgSub", alignment=1, leading=7.5))]], colWidths=[95])
            logo_cell.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))

        header_center = [
            Paragraph(f"<b>{name_first}</b>", title_main_style),
            Paragraph(f"<b>{name_rest}</b>", title_sub_style),
            Spacer(1, 1),
            Paragraph(hindi_address, address_hindi_style),
        ]

        top_header_table = Table(
            [
                [
                    logo_cell,
                    header_center,
                    Paragraph(reg_block, reg_phone_style),
                ]
            ],
            colWidths=[105, 265, 153],
        )
        top_header_table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        story.append(top_header_table)
        story.append(HRFlowable(width="100%", thickness=1.5, color=red_accent, spaceBefore=4, spaceAfter=6))
    else:
        # Pre-printed letterhead mode: lab branding is pre-printed.
        show_header_status = lab_info.get("show_report_header_status", True)
        if "show_header_status" in report_info and report_info["show_header_status"] is not None:
            show_header_status = report_info["show_header_status"]
        if show_header_status:
            lh_strip = Table(
                [
                    [
                        Paragraph("<b>DIAGNOSTIC MEDICAL REPORT</b>", ParagraphStyle("LhHead", parent=styles["Normal"], fontSize=9, fontName="Helvetica-Bold", textColor=cyan_brand)),
                        Paragraph(f"<b>REPORT #{report_info.get('report_id_display', '')}</b> &nbsp;|&nbsp; STATUS: <b>{report_info.get('status', 'FINAL')}</b> &nbsp;|&nbsp; Version: v{report_info.get('version', 1)}.0", ParagraphStyle("LhRef", parent=styles["Normal"], alignment=2, fontSize=8, textColor=dark_text)),
                    ]
                ],
                colWidths=[200, 323],
            )
            lh_strip.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 2), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
            story.append(lh_strip)
            story.append(Spacer(1, 3))

    # 2. Patient & Request Demographics (No outer box / borders, clean two-column format)
    patient_name = str(patient_info.get("name") or patient_info.get("full_name") or "N/A")
    age_str = str(patient_info.get("age") or "N/A")
    gender_str = str(patient_info.get("gender") or "N/A").upper()
    referred_by = str(patient_info.get("referred_by") or "DR. SELF")

    req_id = (
        report_info.get("booking_id_display")
        or patient_info.get("booking_id_display")
        or report_info.get("report_id_display")
        or report_info.get("report_number")
        or report_info.get("id")
        or "N/A"
    )
    recv_date = (
        report_info.get("received_date")
        or report_info.get("sample_collected_at")
        or report_info.get("date")
        or "N/A"
    )
    rep_date = (
        report_info.get("reporting_date")
        or report_info.get("finalized_at")
        or report_info.get("created_at")
        or report_info.get("date")
        or "N/A"
    )

    demo_left_text = (
        f"<b>Name Of Patient</b> &nbsp;: &nbsp;{patient_name}<br/>"
        f"<b>Age / Gender</b> &nbsp;&nbsp;&nbsp;&nbsp;: &nbsp;{age_str} Yrs / {gender_str}<br/>"
        f"<b>Referred By</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: &nbsp;{referred_by}"
    )

    demo_right_text = (
        f"<b>Test Request ID</b> &nbsp;: &nbsp;{req_id}<br/>"
        f"<b>Received Date</b> &nbsp;&nbsp;&nbsp;: &nbsp;{recv_date}<br/>"
        f"<b>Reporting Date</b> &nbsp;&nbsp;: &nbsp;{rep_date}"
    )

    demo_table = Table(
        [
            [
                Paragraph(demo_left_text, demo_label_style),
                Paragraph(demo_right_text, demo_label_style),
            ]
        ],
        colWidths=[265, 258],
    )
    demo_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 1),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(demo_table)
    story.append(Spacer(1, 4))

    # 3. Test Results Section (Unbordered format with two black lines for column header, Group & Subgroup hierarchy)
    test_title_raw = (test_info.get("name") or "Investigation").upper()
    group_name = (test_info.get("category_name") or "HAEMATOLOGY").upper()

    col_widths = [215, 95, 75, 138]

    if result_values:
        # Build Table rows with Group, Test Header, Subgroups and Parameter rows
        table_rows = [
            [
                Paragraph("<b>Test Description</b>", col_hdr_style),
                Paragraph("<b>Observe Value</b>", col_hdr_style),
                Paragraph("<b>Units</b>", col_hdr_style),
                Paragraph("<b>Biological Reference Range</b>", col_hdr_style),
            ]
        ]
        table_style_commands = [
            ("LINEABOVE", (0, 0), (-1, 0), 1.2, colors.black),
            ("LINEBELOW", (0, 0), (-1, 0), 1.2, colors.black),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 1.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
        ]

        row_idx = 1

        # Check if first result value overrides group_name
        for v in result_values:
            if v.get("group_name"):
                group_name = str(v["group_name"]).upper()
                break

        # Group Title row (Centered bold, e.g. HAEMATOLOGY)
        table_rows.append([Paragraph(f"<b>{group_name}</b>", group_hdr_style), "", "", ""])
        table_style_commands.append(("SPAN", (0, row_idx), (3, row_idx)))
        table_style_commands.append(("TOPPADDING", (0, row_idx), (3, row_idx), 4))
        table_style_commands.append(("BOTTOMPADDING", (0, row_idx), (3, row_idx), 3))
        row_idx += 1

        # Test Title row (Left-aligned, underlined bold, e.g. COMPLETE BLOOD COUNT)
        table_rows.append([Paragraph(f"<u><b>{test_title_raw}</b></u>", test_hdr_style), "", "", ""])
        table_style_commands.append(("SPAN", (0, row_idx), (3, row_idx)))
        table_style_commands.append(("TOPPADDING", (0, row_idx), (3, row_idx), 3))
        table_style_commands.append(("BOTTOMPADDING", (0, row_idx), (3, row_idx), 2))
        row_idx += 1

        # Partition parameters into direct parameters and subgroups
        direct_params = []
        subgroup_map = {}

        for v in result_values:
            sg = v.get("subgroup_name") or infer_subgroup(v.get("parameter_name", ""), v.get("parameter_code", ""))
            if not sg:
                direct_params.append(v)
            else:
                if sg not in subgroup_map:
                    subgroup_map[sg] = []
                subgroup_map[sg].append(v)

        # 1. Render direct parameters
        for v in direct_params:
            p_name = v.get("parameter_name") or v.get("name") or ""
            p_val = v.get("value")
            if p_val is not None and v.get("numeric_value") is None and v.get("text_value") is None:
                val_display = str(p_val)
            else:
                val_display = format_result_value(v.get("numeric_value"), v.get("text_value"))
            p_unit = v.get("unit") or ""
            p_ref = v.get("reference_range_display") or v.get("reference_range") or ""
            flag_str = str(v.get("flag", "NORMAL")).upper()
            is_abnormal = flag_str in ["HIGH", "LOW", "CRITICAL_HIGH", "CRITICAL_LOW", "ABNORMAL"]
            v_style = param_text_bold if is_abnormal else param_text_style

            table_rows.append(
                [
                    Paragraph(p_name, param_text_style),
                    Paragraph(val_display, v_style),
                    Paragraph(p_unit, param_text_style),
                    Paragraph(p_ref, param_text_style),
                ]
            )
            row_idx += 1

        # 2. Render each subgroup and its parameters
        for sg_name, sg_params in subgroup_map.items():
            # Subgroup Heading (Left-aligned, bold, underlined)
            table_rows.append([Paragraph(f"<u><b>{sg_name}</b></u>", subgroup_hdr_style), "", "", ""])
            table_style_commands.append(("SPAN", (0, row_idx), (3, row_idx)))
            table_style_commands.append(("TOPPADDING", (0, row_idx), (3, row_idx), 4))
            table_style_commands.append(("BOTTOMPADDING", (0, row_idx), (3, row_idx), 2))
            row_idx += 1

            for v in sg_params:
                p_name = v.get("parameter_name") or v.get("name") or ""
                p_val = v.get("value")
                if p_val is not None and v.get("numeric_value") is None and v.get("text_value") is None:
                    val_display = str(p_val)
                else:
                    val_display = format_result_value(v.get("numeric_value"), v.get("text_value"))
                p_unit = v.get("unit") or ""
                p_ref = v.get("reference_range_display") or v.get("reference_range") or ""
                flag_str = str(v.get("flag", "NORMAL")).upper()
                is_abnormal = flag_str in ["HIGH", "LOW", "CRITICAL_HIGH", "CRITICAL_LOW", "ABNORMAL"]
                v_style = param_text_bold if is_abnormal else param_text_style

                table_rows.append(
                    [
                        Paragraph(f"&nbsp;&nbsp;{p_name}", param_text_style),
                        Paragraph(val_display, v_style),
                        Paragraph(p_unit, param_text_style),
                        Paragraph(p_ref, param_text_style),
                    ]
                )
                row_idx += 1

        # 3. Interpretation Section
        interp_text = (
            report_info.get("interpretation")
            or narrative_info.get("interpretation")
            or narrative_info.get("imaging_impression")
            or narrative_info.get("imaging_findings")
            or narrative_info.get("clinical_history")
            or test_info.get("interpretation")
        )
        if not interp_text and ("CBC" in (test_info.get("code") or "").upper() or "COMPLETE BLOOD COUNT" in test_title_raw):
            interp_text = (
                "Hemoglobin/platelet/leucocyte count and platelets count are stable till 24 hrs. "
                "The cell morphology is well preserved for 48 hrs. However, haematocrit & MCV variation is observed "
                "(MCV -3.5 - 7.5% and HCT - 0.4 - 4.0% leading to a decrease in MCHC). "
                "A fresh smear is recommended for an accurate differential WBC count and interpretation of RBC morphology."
            )

        if interp_text:
            table_rows.append([Paragraph("<u><b>INTERPRETATION :</b></u>", subgroup_hdr_style), "", "", ""])
            table_style_commands.append(("SPAN", (0, row_idx), (3, row_idx)))
            table_style_commands.append(("TOPPADDING", (0, row_idx), (3, row_idx), 5))
            table_style_commands.append(("BOTTOMPADDING", (0, row_idx), (3, row_idx), 2))
            row_idx += 1

            table_rows.append([Paragraph(interp_text, interp_style), "", "", ""])
            table_style_commands.append(("SPAN", (0, row_idx), (3, row_idx)))
            table_style_commands.append(("TOPPADDING", (0, row_idx), (3, row_idx), 2))
            table_style_commands.append(("BOTTOMPADDING", (0, row_idx), (3, row_idx), 4))
            row_idx += 1

        res_table = Table(table_rows, colWidths=col_widths, repeatRows=1)
        res_table.setStyle(TableStyle(table_style_commands))
        story.append(res_table)
    else:
        # Narrative / Radiology Findings
        narrative_elements = []
        is_single_box = bool(narrative_info.get("imaging_findings")) and not bool(narrative_info.get("clinical_history")) and not bool(narrative_info.get("imaging_impression"))

        narrative_elements.append(Paragraph(f"<b>{group_name}</b>", group_hdr_style))
        narrative_elements.append(Spacer(1, 2))
        narrative_elements.append(Paragraph(f"<u><b>{test_title_raw}</b></u>", test_hdr_style))
        narrative_elements.append(Spacer(1, 4))

        if is_single_box:
            narrative_elements.append(Paragraph("<u><b>RADIOLOGICAL REPORT &amp; FINDINGS:</b></u>", subgroup_hdr_style))
            narrative_elements.append(Spacer(1, 2))
            narrative_elements.append(safe_reportlab_paragraph(narrative_info["imaging_findings"], param_text_style))
            narrative_elements.append(Spacer(1, 4))
            if narrative_info.get("recommendations"):
                narrative_elements.append(Paragraph("<u><b>RECOMMENDATIONS:</b></u>", subgroup_hdr_style))
                narrative_elements.append(safe_reportlab_paragraph(narrative_info["recommendations"], param_text_style))
        else:
            if narrative_info.get("clinical_history"):
                narrative_elements.append(Paragraph("<u><b>CLINICAL HISTORY &amp; INDICATION:</b></u>", subgroup_hdr_style))
                narrative_elements.append(safe_reportlab_paragraph(narrative_info["clinical_history"], param_text_style))
                narrative_elements.append(Spacer(1, 4))
            if narrative_info.get("imaging_findings"):
                narrative_elements.append(Paragraph("<u><b>FINDINGS:</b></u>", subgroup_hdr_style))
                narrative_elements.append(safe_reportlab_paragraph(narrative_info["imaging_findings"], param_text_style))
                narrative_elements.append(Spacer(1, 4))
            if narrative_info.get("imaging_impression"):
                narrative_elements.append(Paragraph("<u><b>IMPRESSION:</b></u>", subgroup_hdr_style))
                narrative_elements.append(safe_reportlab_paragraph(f"<b>{narrative_info['imaging_impression']}</b>", param_text_style))
                narrative_elements.append(Spacer(1, 4))
            if narrative_info.get("recommendations"):
                narrative_elements.append(Paragraph("<u><b>RECOMMENDATIONS:</b></u>", subgroup_hdr_style))
                narrative_elements.append(safe_reportlab_paragraph(narrative_info["recommendations"], param_text_style))

        story.append(KeepTogether(narrative_elements))

    story.append(Spacer(1, 14))

    # 4. Signature & Authentication elements
    approver_name = report_info.get("approved_by_name", "Authorized Laboratory Pathologist")
    sig_source = (
        report_info.get("signature_image")
        or report_info.get("signature_image_url")
        or report_info.get("signature_bytes")
    )
    sig_flowable = get_signature_flowable(sig_source, max_width=120, max_height=32)

    signatory_title = report_info.get("signatory_title") or "Consultant Pathologist"
    signatory_degrees = report_info.get("signatory_degrees") or ""
    signatory_reg_no = report_info.get("signatory_reg_no") or ""

    cred_str = signatory_degrees if signatory_degrees else ""
    if signatory_reg_no:
        cred_str = f"{cred_str} (Reg: {signatory_reg_no})" if cred_str else f"Reg: {signatory_reg_no}"

    sig_cell_elements = []
    if sig_flowable:
        sig_cell_elements.append(sig_flowable)
        sig_cell_elements.append(Spacer(1, 1))

    sig_info_text = f"<b>{approver_name}</b>"
    if cred_str:
        sig_info_text += f"<br/>{cred_str}"
    if signatory_title:
        sig_info_text += f"<br/>{signatory_title}"

    sig_cell_elements.append(
        Paragraph(
            sig_info_text,
            ParagraphStyle("SigDocInfo", parent=styles["Normal"], fontSize=8, leading=10, alignment=2, textColor=dark_text),
        )
    )

    # Center column: Barcode / QR Code / Tracking ID & Date
    raw_code_type = report_info.get("footer_code_type") or lab_info.get("footer_code_type")
    enable_qr = lab_info.get("enable_qr_verification", True)
    if "enable_qr_verification" in report_info and report_info["enable_qr_verification"] is not None:
        enable_qr = report_info["enable_qr_verification"]

    if raw_code_type:
        code_type = str(raw_code_type).upper()
    else:
        code_type = "QR_CODE" if enable_qr else "BARCODE"

    barcode_id = report_info.get("report_id_display") or "ULR-32673"
    center_cell_elements = []

    if code_type in ["BARCODE", "BOTH"]:
        try:
            bc_flowable = code128.Code128(barcode_id, barHeight=18, barWidth=0.8)
        except Exception:
            bc_flowable = Paragraph(f"<b>*{barcode_id}*</b>", ParagraphStyle("BcAlt", alignment=1, fontSize=10))
        center_cell_elements.append(bc_flowable)

    if code_type in ["QR_CODE", "QR", "BOTH"] and enable_qr and qr_url:
        try:
            qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=3, border=1)
            qr.add_data(qr_url)
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="black", back_color="white")
            qr_buffer = io.BytesIO()
            qr_img.save(qr_buffer, format="PNG")
            qr_buffer.seek(0)
            qr_flowable = Image(qr_buffer, width=0.48 * inch, height=0.48 * inch)
            center_cell_elements.append(qr_flowable)
            center_cell_elements.append(Paragraph("Scan QR to Verify Authenticity Online", ParagraphStyle("QrCaption", parent=styles["Normal"], fontSize=6, leading=7.5, alignment=1, textColor=muted_text)))
        except Exception:
            pass

    center_cell_elements.append(
        Paragraph(f"{barcode_id} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {rep_date}", ParagraphStyle("BcText", parent=styles["Normal"], fontSize=7, leading=9, alignment=1, textColor=dark_text))
    )

    # Left column: Checked by & Printed by
    printed_by_str = report_info.get("printed_by") or "Reception"
    left_cell_elements = [
        Paragraph("<b>Checked by</b>", ParagraphStyle("CheckedBy", parent=styles["Normal"], fontSize=8, leading=10, textColor=dark_text)),
        Spacer(1, 18),
        Paragraph(f"<b>Printed By :</b> &nbsp;{printed_by_str}", ParagraphStyle("PrintedBy", parent=styles["Normal"], fontSize=7.5, leading=9.5, textColor=dark_text)),
    ]

    # Upper footer block (3 columns)
    upper_footer_table = Table(
        [
            [
                left_cell_elements,
                center_cell_elements,
                sig_cell_elements,
            ]
        ],
        colWidths=[150, 185, 188],
    )
    upper_footer_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                ("ALIGN", (1, 0), (1, 0), "CENTER"),
                ("ALIGN", (2, 0), (2, 0), "RIGHT"),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    story.append(KeepTogether([upper_footer_table]))

    # Build PDF with background if letterhead image configured
    def draw_letterhead_bg(canvas_obj, doc_obj):
        if is_image_letterhead and letterhead_bg_image and os.path.exists(letterhead_bg_image):
            try:
                canvas_obj.saveState()
                canvas_obj.drawImage(
                    letterhead_bg_image,
                    0,
                    0,
                    width=A4[0],
                    height=A4[1],
                    preserveAspectRatio=False,
                    mask="auto",
                )
                canvas_obj.restoreState()
            except Exception as e:
                logger.warning("Could not draw letterhead background image: %s", e)

    doc.build(story, onFirstPage=draw_letterhead_bg, onLaterPages=draw_letterhead_bg)

    # If the letterhead is a vector PDF, stamp the letterhead page underneath using pypdf
    if is_pdf_letterhead and letterhead_bg_image and os.path.exists(letterhead_bg_image):
        apply_pdf_letterhead_overlay(output_path, letterhead_bg_image, output_path)

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
    lab_tz_name = lab_info.get("timezone") or "Asia/Kolkata"
    try:
        from zoneinfo import ZoneInfo
        active_tz = ZoneInfo(lab_tz_name)
    except Exception:
        active_tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30), name="IST")

    raw_date = payment_info.get("date")
    if not raw_date or raw_date == "N/A":
        date_str = datetime.datetime.now(active_tz).strftime("%d-%b-%Y %I:%M %p")
    elif isinstance(raw_date, datetime.datetime):
        if raw_date.tzinfo is None:
            raw_date = raw_date.replace(tzinfo=datetime.timezone.utc)
        date_str = raw_date.astimezone(active_tz).strftime("%d-%b-%Y %I:%M %p")
    elif isinstance(raw_date, str) and ("T" in raw_date or raw_date.endswith("Z")):
        try:
            clean_str = raw_date.replace("Z", "+00:00")
            parsed_dt = datetime.datetime.fromisoformat(clean_str)
            if parsed_dt.tzinfo is None:
                parsed_dt = parsed_dt.replace(tzinfo=datetime.timezone.utc)
            date_str = parsed_dt.astimezone(active_tz).strftime("%d-%b-%Y %I:%M %p")
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

    lab_display_name = lab_info.get("name") or "Diagnostic Laboratory"
    footer_table = Table(
        [
            [
                Paragraph(
                    f"<i>Official computer-generated receipt issued by {lab_display_name}.</i><br/>"
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
        self.is_letterhead = False
        self.has_letterhead_bg = False

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
        # Clean page numbering only if document exceeds 1 page
        if page_count > 1:
            self.saveState()
            self.setFont("Helvetica", 7.5)
            self.setFillColor(colors.HexColor("#64748B"))
            page_text = f"Page {self._pageNumber} of {page_count}"
            self.drawRightString(A4[0] - 36, 12, page_text)
            self.restoreState()


def infer_group_name(category_name: str = "", test_name: str = "", test_code: str = "") -> str:
    """Infers Department / Group header name matching standard pathology catalog."""
    cat_upper = (category_name or "").upper()
    name_upper = (test_name or "").upper()
    code_upper = (test_code or "").upper()

    if any(k in cat_upper or k in name_upper or k in code_upper for k in ["HEMATOLOGY", "HAEMATOLOGY", "CBC", "HEM", "BLOOD GROUP", "BLD-GRP", "ESR", "PBS", "COAGULATION", "PT-INR"]):
        return "HAEMATOLOGY"
    if any(k in cat_upper or k in name_upper or k in code_upper for k in ["THYROID", "HORMON", "TUMOUR", "T3", "T4", "TSH", "PSA", "FERTILITY", "AMH", "PROLACTIN"]):
        return "HORMONAL AND TUMOUR MARKER"
    if any(k in cat_upper or k in name_upper or k in code_upper for k in ["SEROLOGY", "IMMUNOLOGY", "WIDAL", "VIRAL", "HIV", "HBSAG", "HCV", "VDRL", "DENGUE", "MALARIA", "COVID"]):
        return "IMMUNOLOGY AND SEROLOGY"
    if any(k in cat_upper or k in name_upper or k in code_upper for k in ["BIOCHEMISTRY", "BIO", "DIABETES", "DIA", "LFT", "LIVER", "KFT", "KIDNEY", "LIPID", "GLUCOSE", "SUGAR", "RBS", "FBS", "PPBS", "HBA1C", "ELECTROLYTE", "CALCIUM", "URIC"]):
        return "BIOCHEMISTRY"
    if any(k in cat_upper or k in name_upper for k in ["RADIOLOGY", "IMAGING", "XRAY", "X-RAY", "USG", "ULTRASOUND"]):
        return "RADIOLOGY & IMAGING"
    if any(k in cat_upper or k in name_upper for k in ["CARDIOLOGY", "ECG", "ECHO", "TMT"]):
        return "CARDIOLOGY"
    if any(k in cat_upper or k in name_upper for k in ["URINE", "STOOL", "SEMEN", "CLINICAL PATH"]):
        return "CLINICAL PATHOLOGY"
    if any(k in cat_upper or k in name_upper for k in ["MICROBIOLOGY", "CULTURE", "AFB", "KOH"]):
        return "MICROBIOLOGY"
    return cat_upper or "BIOCHEMISTRY"


def get_standard_interpretation(test_name: str = "", test_code: str = "") -> Optional[str]:
    """Provides clinically accurate diagnostic interpretation text matching Uttam Diagnostic Center standard."""
    name_upper = (test_name or "").upper()
    code_upper = (test_code or "").upper()

    if "CBC" in code_upper or "COMPLETE BLOOD COUNT" in name_upper:
        return (
            "Hemoglobin ,total leucocyte count and platelate Count are stable till 72 hrs. "
            "The cell morphology is well preserved for 24 hrs. However , between 24 to 72 hrs. "
            "an increase in MCV and HCT is observed (MCV- 5.0 - 7.5 % and HCT - 5.0 - 6.8 % ) "
            "leading to a decrease in MCHC. A direct smear is recommended for an accurate "
            "differential WBC count and interpretation of RBC morphology."
        )

    if "WIDAL" in code_upper or "WIDAL" in name_upper:
        return (
            "Thyphoid is a Enteric Fever caused by various species of Salmonella such as S.typhi, S.paratyphi -A and S. paratyphi-B. "
            "The disease is characterized by sustained high Fever, sever Headache,Nauses, Anorexia and Constipation initially and later Diarrhoea. "
            "Humans are the only reservoir of the bacteria. The bacteria is usuly transmitted by five ‘F’s: files, food, fingers, faeces, and fomited.\n\n"
            "Widal test is the most widely accepted ,a century old, serodiagonstic technique used for diagnosis of Typhoid . "
            "The test uses ‘O’ and ‘H’ antigens of S.typhi and S. paratyphi ‘A’ and ‘B’ to detect the high agglutinin titres of ‘O’ and ‘H’ antibodies in the serum of patients suffering from Enteric Fever.\n\n"
            "‘O’ is somatic antigen shared by most of the enterics bacteria and thus of lower specificity for the diagnosis . ‘H’ is flagellar antigen specific for Salmonella species. "
            "Antibodies against ‘O’ disappear quickly , on the other hand ’H’ antibodies persist for a longer period of time, lowering its diagnostic value. "
            "So , detection of ‘O’ antigen alone or ‘H’ antigen alone is not sufficient to prove Typhoid infection . While , a diagnostic ‘O’ titre and a rising titre of both ‘H’ and ‘O’ agglutinins in to different samples, taken at the interval of 7-10 days assure typhoid infection .\n\n"
            "RESULTS DEPEND ON:\n"
            "• Level of agglutinins in normal population.\n"
            "• Stage of disease.\n"
            "• Current of past infection.\n"
            "• Immunization with typhoid vaccine."
        )

    if "LFT" in code_upper or "LIVER" in name_upper:
        return (
            "Bilirubin is a break down product of hemoglobin. Bilirubin formed in the reticulo-endothelial system is transport to the liver bound to a albumin. "
            "This bilirubin is water insoluble and is know as indirect or unconjugated bilirubin. In the liver, bilirubin is conjugated to glucuronic acid to form direct bilirubin. "
            "Conjugated bilirubin is excreted via the bilary system into the intestine where it is metabolized by bacteria to urobilinogen & stercobilinogen.\n\n"
            "Increase:\n"
            "Total bilirubin is elevated in obstructive condition of the bile duct, hepatitis, cirrhosis, in hemolytic disorders and several inherited enzyme deficiencies.\n"
            "Indirect bilirubin is elevated by pre-hepatic causes such as hemolytic disorder or liver disease resulting in impaired entry, transport or conjugated within the liver."
        )

    if "KFT" in code_upper or "KIDNEY" in name_upper:
        return (
            "Kidney function evaluates glomerular filtration, tubular reabsorption, and electrolyte balance. "
            "Elevated blood urea and serum creatinine indicate reduced renal clearance or acute/chronic kidney injury. "
            "High serum uric acid is associated with gout, renal calculi, or metabolic syndrome. "
            "Electrolytes (Sodium and Potassium) are vital for neuromuscular conduction and systemic fluid homeostasis."
        )

    if "LIPID" in code_upper:
        return (
            "Lipid profile evaluates cardiovascular risk and lipid metabolism. Desirable levels: Total Cholesterol < 200 mg/dL, "
            "Triglycerides < 150 mg/dL, HDL Cholesterol > 40 mg/dL (protective/anti-atherogenic), LDL Cholesterol < 100 mg/dL. "
            "Elevated LDL and non-HDL cholesterol strongly correlate with atherosclerotic coronary artery disease."
        )

    if "THYROID" in code_upper or "TFT" in code_upper:
        return (
            "Note: Guidelines for interpretation of abnormal thyroid function test:-\n"
            "TSH: High | T4: Normal | T3: Normal => Mild (sub-clinical) Hypothyroidism\n"
            "TSH: High | T4: Low | T3: Low/Normal => Hypothyroidism\n"
            "TSH: Low | T4: Normal | T3: Normal => Mild (sub-clinical) Hyperthyroidism\n"
            "TSH: Low | T4: High/Normal | T3: High/Normal => Hyperthyroidism\n"
            "TSH: Low | T4: Low/Normal | T3: Low/Normal => Rare pituitary (secondary) Hypothyroidism\n\n"
            "TSH LEVEL IN INFANTS:\n"
            "New Born (1 - 4 Days): 1.0 to 39.0 uIU/ml | 2 to 20 weeks: 1.7 to 9.0 uIU/ml | 21 weeks - 20 years: 0.7 to 6.4 uIU/ml\n\n"
            "Symptoms of hyperthyroidism: Increased heart rate, anxiety, weight loss, tremor, weakness, eye puffiness/dryness.\n"
            "Symptoms of hypothyroidism: Weight gain, dry skin, constipation, cold intolerance, puffy skin, hair loss, fatigue."
        )

    if "VDRL" in code_upper or "RPR" in code_upper:
        return (
            "This is screening test for syphilis which is useful for following the progression of disease and response to therapy. "
            "It is advisable to perform battery of tests such as RPR, TPHA & FTA-Abs for diagnosis of syphilis.\n\n"
            "RPR/VDRL: + | TPHA: - | FTA-Abs: - => False positive - Repeat to exclude Biological false positive\n"
            "RPR/VDRL: + | TPHA: + | FTA-Abs: + => Untreated or recently treated Infection\n"
            "RPR/VDRL: - | TPHA: + | FTA-Abs: + => Treated or partially treated at any stage / Untreated latent infection\n"
            "RPR/VDRL: - | TPHA: +/- | FTA-Abs: +/- => History of treated syphilis\n\n"
            "The positive response after successful therapy suggests either persistent infection or biological False positives (BFP). "
            "Biological false positives may occur in patients with autoimmune disorders, pregnancy, tuberculosis, malaria & viral diseases."
        )

    if any(k in code_upper for k in ["VIRAL", "HIV", "HBSAG", "HCV"]):
        return (
            "HIV: A negative result implies no Anti HIV-I/II antibodies detected in the sample (window phase must be considered). Positive results must be confirmed by Western Blot/PCR.\n"
            "HBsAg: Initial marker in serum during incubation and acute phase of HBV. Persistence beyond 6 months indicates carrier state.\n"
            "HCV: Indicates exposure or persistent infection with Hepatitis C virus. Recommended to evaluate with HCV-RNA viral load."
        )

    return None


def format_test_title(test_name: str = "", test_code: str = "") -> str:
    """Formats test title matching the exact pathology headers in Uttam Diagnostic reports."""
    name_upper = (test_name or "").strip().upper()
    code_upper = (test_code or "").strip().upper()

    if "CBC" in code_upper or "COMPLETE BLOOD COUNT" in name_upper:
        return "COMPLETE BLOOD COUNT"
    if "LFT" in code_upper or "LIVER FUNCTION" in name_upper:
        return "LIVER FUNCTION TEST -"
    if "KFT" in code_upper or "KIDNEY FUNCTION" in name_upper:
        return "KIDNEY FUNCTION TEST:"
    if "LIPID" in code_upper:
        return "LIPID PROFILE -"
    if "THYROID" in code_upper or "TFT" in code_upper:
        return "THYROID PROFILE"
    if "RBS" in code_upper or "RANDOM BLOOD SUGAR" in name_upper or "GLUCOSE RANDOM" in name_upper:
        return "BLOOD SUGAR RANDOM:-"
    if "WIDAL" in code_upper:
        return "WIDAL TEST"
    if "VDRL" in code_upper or "RPR" in code_upper:
        return "VDRL (RPR), SERUM"
    if "BLD-GRP" in code_upper or "BLOOD GROUP" in name_upper:
        return "ABO GROUP (A,B,O) AND Rh FACTOR WITH REVERSE GROUPING"
    if any(k in code_upper for k in ["HIV", "HBSAG", "HCV", "VIRAL"]):
        return "VIRAL MARKER:"
    return name_upper or "DIAGNOSTIC INVESTIGATION"


def generate_consolidated_booking_report_pdf(
    lab_info: dict,
    patient_info: dict,
    booking_info: dict,
    reports_data: List[dict],
    qr_url: str,
    output_path: str,
    is_letterhead: bool = False,
    top_margin_mm: Optional[int] = None,
    bottom_margin_mm: Optional[int] = None,
) -> str:
    """Renders a diagnostic report PDF containing all tests for a booking, matching the exact visual sample:
    - Identical header and footer formatting
    - Hierarchical Department Group & Subgroups
    - Clean unbordered demographics and analyte rows (no boxed grid table format)
    - Two clean horizontal black dividing lines for column headers
    - Booking ID displayed under Test Request ID in patient details
    - Completely removed 'CONSOLIDATED DIAGNOSTIC REPORT' and summary panel index
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    letterhead_bg_image = lab_info.get("letterhead_image")
    use_letterhead_bg = lab_info.get("use_letterhead_background", True)
    has_letterhead_bg = bool(
        letterhead_bg_image
        and os.path.exists(letterhead_bg_image)
        and use_letterhead_bg
        and not is_letterhead
    )
    is_pdf_letterhead = has_letterhead_bg and is_pdf_file(letterhead_bg_image)
    is_image_letterhead = has_letterhead_bg and not is_pdf_letterhead

    mm_pt = 72.0 / 25.4
    if is_letterhead or has_letterhead_bg:
        top_m = float(top_margin_mm * mm_pt) if top_margin_mm else (48.0 * mm_pt)
        bottom_m = float(bottom_margin_mm * mm_pt) if bottom_margin_mm else (28.0 * mm_pt)
    else:
        top_m = 24.0
        bottom_m = 24.0

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=top_m,
        bottomMargin=bottom_m,
    )

    styles = getSampleStyleSheet()

    cyan_brand = colors.HexColor("#0099DD")
    red_accent = colors.HexColor("#CC0000")
    dark_text = colors.HexColor("#1A1A1A")
    muted_text = colors.HexColor("#555555")
    green_emergency = colors.HexColor("#008800")

    hindi_font = "Devanagari" if HAS_DEVANAGARI else "Helvetica"
    hindi_bold = "Devanagari-Bold" if HAS_DEVANAGARI else "Helvetica-Bold"

    title_main_style = ParagraphStyle(
        "UttamMainTitleConsol",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=20,
        alignment=1,
        textColor=cyan_brand,
    )
    title_sub_style = ParagraphStyle(
        "UttamSubTitleConsol",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=15,
        alignment=1,
        textColor=red_accent,
    )
    address_hindi_style = ParagraphStyle(
        "UttamHindiAddressConsol",
        parent=styles["Normal"],
        fontName=hindi_font,
        fontSize=7.5,
        leading=10,
        alignment=1,
        textColor=red_accent,
    )
    reg_phone_style = ParagraphStyle(
        "UttamRegPhoneConsol",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10.5,
        alignment=2,
        textColor=dark_text,
    )
    demo_label_style = ParagraphStyle(
        "DemoLabelConsol",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=dark_text,
    )
    col_hdr_style = ParagraphStyle(
        "ColHeaderConsol",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.black,
    )
    group_hdr_style = ParagraphStyle(
        "GroupHeaderConsol",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=13,
        alignment=1,
        textColor=colors.black,
    )
    test_hdr_style = ParagraphStyle(
        "TestHeaderConsol",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        alignment=0,
        textColor=colors.black,
    )
    subgroup_hdr_style = ParagraphStyle(
        "SubgroupHeaderConsol",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        alignment=0,
        textColor=colors.black,
    )
    param_text_style = ParagraphStyle(
        "ParamTextConsol",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=dark_text,
    )
    param_text_bold = ParagraphStyle(
        "ParamTextBoldConsol",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=dark_text,
    )
    interp_style = ParagraphStyle(
        "InterpretationTextConsol",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=dark_text,
    )

    # 1. Top Letterhead Header Builder
    def build_top_header():
        raw_name = lab_info.get("name", "UTTAM Diagnostic Center").strip()
        name_tokens = raw_name.split(None, 1)
        name_first = name_tokens[0] if name_tokens else "UTTAM"
        name_rest = name_tokens[1] if len(name_tokens) > 1 else "Diagnostic Center"

        phone_str = lab_info.get("phone", "9918613886, 9519205517")
        phones = [p.strip() for p in phone_str.replace(";", ",").split(",") if p.strip()]
        mob_line_1 = phones[0] if len(phones) > 0 else "9918613886"
        if len(phones) > 1:
            mob_line_1 += f", {phones[1]}"

        reg_block = (
            f"<b>Regd.- {lab_info.get('license', 'RMEE2342261')}</b><br/>"
            f"<font color='#CC0000'><b>Mob. :</b></font> {mob_line_1}"
        )
        if len(phones) > 2:
            reg_block += f"<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{', '.join(phones[2:4])}"
        if len(phones) > 4:
            reg_block += f"<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{', '.join(phones[4:6])}"

        hindi_address = (
            lab_info.get("address_hindi")
            or "पता-पटेल नगर निकट दीवानी न्यायालय गेट नं0 1 सिविल लाइन, भिनगा (श्रावस्ती)"
        )

        logo_flowable = None
        lab_logo_path = lab_info.get("logo_image")
        if lab_logo_path and os.path.exists(lab_logo_path):
            try:
                logo_flowable = Image(lab_logo_path, width=1.1 * inch, height=0.65 * inch)
            except Exception:
                logo_flowable = None

        if not logo_flowable:
            logo_sub = Paragraph(
                f"<font color='#CC0000' size=14><b>✚</b></font><br/>"
                f"<b><font size=7 color='#CC0000'>{raw_name}</font></b>",
                ParagraphStyle("LogoSubC", parent=styles["Normal"], alignment=1, leading=8.5),
            )
            logo_cell = logo_sub
        else:
            logo_cell = Table(
                [[logo_flowable], [Paragraph(f"<font size=6.5 color='#CC0000'><b>{raw_name}</b></font>", ParagraphStyle("LgSubC", alignment=1, leading=7.5))]],
                colWidths=[95]
            )
            logo_cell.setStyle(TableStyle([
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]))

        header_center = [
            Paragraph(f"<b>{name_first}</b>", title_main_style),
            Paragraph(f"<b>{name_rest}</b>", title_sub_style),
            Spacer(1, 1),
            Paragraph(hindi_address, address_hindi_style),
        ]

        top_tbl = Table(
            [[logo_cell, header_center, Paragraph(reg_block, reg_phone_style)]],
            colWidths=[105, 265, 153],
        )
        top_tbl.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        return top_tbl

    # 2. Patient Demographics Builder (Clean two columns, booking ID under Test Request ID)
    patient_name = str(patient_info.get("name") or patient_info.get("full_name") or "N/A")
    age_str = str(patient_info.get("age") or "N/A")
    gender_str = str(patient_info.get("gender") or "N/A").upper()
    referred_by = str(patient_info.get("referred_by") or booking_info.get("referred_by") or "DR. SELF")

    req_id = str(
        booking_info.get("booking_id_display")
        or booking_info.get("id_display")
        or booking_info.get("id")
        or patient_info.get("booking_id_display")
        or "UDC-32675"
    )
    recv_date = str(
        booking_info.get("received_date")
        or booking_info.get("sample_collected_at")
        or booking_info.get("appointment_date")
        or booking_info.get("created_at")
        or "N/A"
    )
    rep_date = str(
        booking_info.get("reporting_date")
        or booking_info.get("finalized_at")
        or booking_info.get("appointment_date")
        or booking_info.get("created_at")
        or "N/A"
    )

    demo_left_text = (
        f"<b>Name Of Patient</b> &nbsp;: &nbsp;{patient_name}<br/>"
        f"<b>Age / Gender</b> &nbsp;&nbsp;&nbsp;&nbsp;: &nbsp;{age_str} Yrs / {gender_str}<br/>"
        f"<b>Referred By</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: &nbsp;{referred_by}"
    )
    demo_right_text = (
        f"<b>Test Request ID</b> &nbsp;: &nbsp;{req_id}<br/>"
        f"<b>Received Date</b> &nbsp;&nbsp;&nbsp;: &nbsp;{recv_date}<br/>"
        f"<b>Reporting Date</b> &nbsp;&nbsp;: &nbsp;{rep_date}"
    )

    def build_demographics_table():
        demo_table = Table(
            [[Paragraph(demo_left_text, demo_label_style), Paragraph(demo_right_text, demo_label_style)]],
            colWidths=[265, 258],
        )
        demo_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        return demo_table

    # 3. Footer Builder
    approver_name = (
        booking_info.get("approved_by_name")
        or lab_info.get("default_signatory_name")
        or "Dr.P.K.Rai"
    )
    signatory_title = lab_info.get("default_signatory_designation") or "Consultant Pathologist"
    signatory_degrees = lab_info.get("default_signatory_degrees") or "M.B.B.S., MD(Path)"
    signatory_reg_no = lab_info.get("default_signatory_reg_no") or ""

    cred_str = signatory_degrees if signatory_degrees else ""
    if signatory_reg_no:
        cred_str = f"{cred_str} (Reg: {signatory_reg_no})" if cred_str else f"Reg: {signatory_reg_no}"

    sig_source = (
        booking_info.get("signature_image")
        or lab_info.get("signature_image")
        or lab_info.get("default_signatory_signature_url")
    )
    sig_flowable = get_signature_flowable(sig_source, max_width=120, max_height=32)

    sig_cell_elements = []
    if sig_flowable:
        sig_cell_elements.append(sig_flowable)
        sig_cell_elements.append(Spacer(1, 1))

    sig_info_text = f"<b>{approver_name}</b>"
    if cred_str:
        sig_info_text += f"<br/>{cred_str}"
    if signatory_title:
        sig_info_text += f"<br/>{signatory_title}"

    sig_cell_elements.append(
        Paragraph(
            sig_info_text,
            ParagraphStyle("SigDocInfoC", parent=styles["Normal"], fontSize=8, leading=10, alignment=2, textColor=dark_text),
        )
    )

    raw_code_type = booking_info.get("footer_code_type") or lab_info.get("footer_code_type")
    enable_qr = lab_info.get("enable_qr_verification", True)
    if raw_code_type:
        code_type = str(raw_code_type).upper()
    else:
        code_type = "QR_CODE" if enable_qr else "BARCODE"

    center_cell_elements = []

    if code_type in ["BARCODE", "BOTH"]:
        try:
            bc_flowable = code128.Code128(req_id, barHeight=18, barWidth=0.8)
        except Exception:
            bc_flowable = Paragraph(f"<b>*{req_id}*</b>", ParagraphStyle("BcAltC", alignment=1, fontSize=10))
        center_cell_elements.append(bc_flowable)

    enable_qr = lab_info.get("enable_qr_verification", True)
    if code_type in ["QR_CODE", "QR", "BOTH"] and enable_qr and qr_url:
        try:
            qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=3, border=1)
            qr.add_data(qr_url)
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="black", back_color="white")
            qr_buffer = io.BytesIO()
            qr_img.save(qr_buffer, format="PNG")
            qr_buffer.seek(0)
            qr_flowable = Image(qr_buffer, width=0.48 * inch, height=0.48 * inch)
            center_cell_elements.append(qr_flowable)
            center_cell_elements.append(Paragraph("Scan QR to Verify Authenticity Online", ParagraphStyle("QrCaptionC", parent=styles["Normal"], fontSize=6, leading=7.5, alignment=1, textColor=muted_text)))
        except Exception:
            pass

    center_cell_elements.append(
        Paragraph(f"{req_id} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {rep_date}", ParagraphStyle("BcTextC", parent=styles["Normal"], fontSize=7, leading=9, alignment=1, textColor=dark_text))
    )

    printed_by_str = booking_info.get("printed_by") or "Reception"
    left_cell_elements = [
        Paragraph("<b>Checked by</b>", ParagraphStyle("CheckedByC", parent=styles["Normal"], fontSize=8, leading=10, textColor=dark_text)),
        Spacer(1, 18),
        Paragraph(f"<b>Printed By :</b> &nbsp;{printed_by_str}", ParagraphStyle("PrintedByC", parent=styles["Normal"], fontSize=7.5, leading=9.5, textColor=dark_text)),
    ]

    upper_footer_table = Table(
        [[left_cell_elements, center_cell_elements, sig_cell_elements]],
        colWidths=[150, 185, 188],
    )
    upper_footer_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("ALIGN", (1, 0), (1, 0), "CENTER"),
        ("ALIGN", (2, 0), (2, 0), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))

    complete_footer = [
        upper_footer_table,
    ]

    story = []
    effective_reports = reports_data if reports_data else [{
        "test_name": "Diagnostic Investigation",
        "test_code": "",
        "result_values": [],
    }]

    for rep_idx, rep in enumerate(effective_reports):
        if rep_idx > 0:
            story.append(PageBreak())

        # Top Letterhead
        if not is_letterhead and not has_letterhead_bg:
            story.append(build_top_header())
            story.append(HRFlowable(width="100%", thickness=1.5, color=red_accent, spaceBefore=4, spaceAfter=6))

        # Demographics
        story.append(build_demographics_table())
        story.append(Spacer(1, 4))

        # Test Results Section
        t_name = rep.get("test_name") or "Diagnostic Test"
        t_code = rep.get("test_code") or ""
        test_title = format_test_title(t_name, t_code)
        grp_name = (
            rep.get("group_name")
            or infer_group_name(rep.get("category_name", ""), t_name, t_code)
        ).upper()

        res_values = rep.get("result_values") or rep.get("results") or rep.get("parameters") or []
        narrative = rep.get("narrative_info", {})

        if res_values:
            table_rows = [
                [
                    Paragraph("<b>Test Description</b>", col_hdr_style),
                    Paragraph("<b>Observe Value</b>", col_hdr_style),
                    Paragraph("<b>Units</b>", col_hdr_style),
                    Paragraph("<b>Biological Reference Range</b>", col_hdr_style),
                ]
            ]
            t_styles = [
                ("LINEABOVE", (0, 0), (-1, 0), 1.2, colors.black),
                ("LINEBELOW", (0, 0), (-1, 0), 1.2, colors.black),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 1.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
            ]
            r_idx = 1

            for v in res_values:
                if v.get("group_name"):
                    grp_name = str(v["group_name"]).upper()
                    break

            # Group Heading (Centered, bold)
            table_rows.append([Paragraph(f"<b>{grp_name}</b>", group_hdr_style), "", "", ""])
            t_styles.append(("SPAN", (0, r_idx), (3, r_idx)))
            t_styles.append(("TOPPADDING", (0, r_idx), (3, r_idx), 4))
            t_styles.append(("BOTTOMPADDING", (0, r_idx), (3, r_idx), 3))
            r_idx += 1

            # Test Heading (Left-aligned, underlined, bold)
            table_rows.append([Paragraph(f"<u><b>{test_title}</b></u>", test_hdr_style), "", "", ""])
            t_styles.append(("SPAN", (0, r_idx), (3, r_idx)))
            t_styles.append(("TOPPADDING", (0, r_idx), (3, r_idx), 3))
            t_styles.append(("BOTTOMPADDING", (0, r_idx), (3, r_idx), 2))
            r_idx += 1

            dir_params = []
            sg_dict = {}
            for v in res_values:
                p_n = v.get("parameter_name") or v.get("name") or ""
                p_c = v.get("parameter_code") or v.get("code") or ""
                sg = v.get("subgroup_name") or infer_subgroup(p_n, p_c)
                if not sg:
                    dir_params.append(v)
                else:
                    if sg not in sg_dict:
                        sg_dict[sg] = []
                    sg_dict[sg].append(v)

            # Direct parameters
            for v in dir_params:
                p_name = v.get("parameter_name") or v.get("name") or ""
                p_val = v.get("value")
                if p_val is not None and v.get("numeric_value") is None and v.get("text_value") is None:
                    val_display = str(p_val)
                else:
                    val_display = format_result_value(v.get("numeric_value"), v.get("text_value"))
                p_unit = v.get("unit") or ""
                p_ref = v.get("reference_range_display") or v.get("reference_range") or ""
                flag_str = str(v.get("flag", "NORMAL")).upper()
                is_abn = flag_str in ["HIGH", "LOW", "CRITICAL_HIGH", "CRITICAL_LOW", "ABNORMAL"]
                f_style = param_text_bold if is_abn else param_text_style

                table_rows.append([
                    Paragraph(p_name, param_text_style),
                    Paragraph(val_display, f_style),
                    Paragraph(p_unit, param_text_style),
                    Paragraph(p_ref, param_text_style),
                ])
                r_idx += 1

            # Subgroup parameters
            for sg_name, sg_items in sg_dict.items():
                table_rows.append([Paragraph(f"<u><b>{sg_name}</b></u>", subgroup_hdr_style), "", "", ""])
                t_styles.append(("SPAN", (0, r_idx), (3, r_idx)))
                t_styles.append(("TOPPADDING", (0, r_idx), (3, r_idx), 4))
                t_styles.append(("BOTTOMPADDING", (0, r_idx), (3, r_idx), 2))
                r_idx += 1

                for v in sg_items:
                    p_name = v.get("parameter_name") or v.get("name") or ""
                    p_val = v.get("value")
                    if p_val is not None and v.get("numeric_value") is None and v.get("text_value") is None:
                        val_display = str(p_val)
                    else:
                        val_display = format_result_value(v.get("numeric_value"), v.get("text_value"))
                    p_unit = v.get("unit") or ""
                    p_ref = v.get("reference_range_display") or v.get("reference_range") or ""
                    flag_str = str(v.get("flag", "NORMAL")).upper()
                    is_abn = flag_str in ["HIGH", "LOW", "CRITICAL_HIGH", "CRITICAL_LOW", "ABNORMAL"]
                    f_style = param_text_bold if is_abn else param_text_style

                    table_rows.append([
                        Paragraph(f"&nbsp;&nbsp;{p_name}", param_text_style),
                        Paragraph(val_display, f_style),
                        Paragraph(p_unit, param_text_style),
                        Paragraph(p_ref, param_text_style),
                    ])
                    r_idx += 1

            # Interpretation
            interp_text = (
                rep.get("interpretation")
                or (narrative.get("interpretation") if narrative else None)
                or (narrative.get("imaging_impression") if narrative else None)
                or get_standard_interpretation(t_name, t_code)
            )

            if interp_text:
                table_rows.append([Paragraph("<u><b>INTERPRETATION :</b></u>", subgroup_hdr_style), "", "", ""])
                t_styles.append(("SPAN", (0, r_idx), (3, r_idx)))
                t_styles.append(("TOPPADDING", (0, r_idx), (3, r_idx), 5))
                t_styles.append(("BOTTOMPADDING", (0, r_idx), (3, r_idx), 2))
                r_idx += 1

                table_rows.append([Paragraph(interp_text.replace("\n", "<br/>"), interp_style), "", "", ""])
                t_styles.append(("SPAN", (0, r_idx), (3, r_idx)))
                t_styles.append(("TOPPADDING", (0, r_idx), (3, r_idx), 2))
                t_styles.append(("BOTTOMPADDING", (0, r_idx), (3, r_idx), 4))
                r_idx += 1

            res_table = Table(table_rows, colWidths=[215, 95, 75, 138], repeatRows=1)
            res_table.setStyle(TableStyle(t_styles))
            story.append(res_table)

        elif narrative and (narrative.get("clinical_history") or narrative.get("imaging_findings") or narrative.get("imaging_impression")):
            narrative_elements = []
            narrative_elements.append(Paragraph(f"<b>{grp_name}</b>", group_hdr_style))
            narrative_elements.append(Spacer(1, 2))
            narrative_elements.append(Paragraph(f"<u><b>{test_title}</b></u>", test_hdr_style))
            narrative_elements.append(Spacer(1, 4))

            if narrative.get("clinical_history"):
                narrative_elements.append(Paragraph("<u><b>CLINICAL HISTORY &amp; INDICATION:</b></u>", subgroup_hdr_style))
                narrative_elements.append(safe_reportlab_paragraph(narrative["clinical_history"], param_text_style))
                narrative_elements.append(Spacer(1, 4))
            if narrative.get("imaging_findings"):
                narrative_elements.append(Paragraph("<u><b>FINDINGS:</b></u>", subgroup_hdr_style))
                narrative_elements.append(safe_reportlab_paragraph(narrative["imaging_findings"], param_text_style))
                narrative_elements.append(Spacer(1, 4))
            if narrative.get("imaging_impression"):
                narrative_elements.append(Paragraph("<u><b>IMPRESSION:</b></u>", subgroup_hdr_style))
                narrative_elements.append(safe_reportlab_paragraph(f"<b>{narrative['imaging_impression']}</b>", param_text_style))
                narrative_elements.append(Spacer(1, 4))
            if narrative.get("recommendations"):
                narrative_elements.append(Paragraph("<u><b>RECOMMENDATIONS:</b></u>", subgroup_hdr_style))
                narrative_elements.append(safe_reportlab_paragraph(narrative["recommendations"], param_text_style))

            story.append(KeepTogether(narrative_elements))

        else:
            pending_box = Table(
                [[
                    Paragraph(
                        "<b>Specimen Registered &amp; Accessioned:</b> Laboratory analytical processing is in progress. "
                        "Final results and pathologist sign-off pending.",
                        param_text_style
                    )
                ]],
                colWidths=[520],
            )
            pending_box.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEF3C7")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#F59E0B")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ]))
            story.append(pending_box)

        story.append(Spacer(1, 12))
        story.append(KeepTogether(complete_footer))

    def draw_consolidated_letterhead_bg(canvas_obj, doc_obj):
        if is_image_letterhead and letterhead_bg_image and os.path.exists(letterhead_bg_image):
            try:
                canvas_obj.saveState()
                canvas_obj.drawImage(
                    letterhead_bg_image,
                    0,
                    0,
                    width=A4[0],
                    height=A4[1],
                    preserveAspectRatio=False,
                    mask="auto",
                )
                canvas_obj.restoreState()
            except Exception as e:
                logger.warning("Could not draw consolidated letterhead background image: %s", e)

    def make_canvas(*args, **kwargs):
        c = NumberedCanvas(*args, **kwargs)
        c.is_letterhead = is_letterhead
        c.has_letterhead_bg = has_letterhead_bg
        return c

    doc.build(
        story,
        onFirstPage=draw_consolidated_letterhead_bg,
        onLaterPages=draw_consolidated_letterhead_bg,
        canvasmaker=make_canvas,
    )

    if is_pdf_letterhead and letterhead_bg_image and os.path.exists(letterhead_bg_image):
        apply_pdf_letterhead_overlay(output_path, letterhead_bg_image, output_path)

    return output_path

