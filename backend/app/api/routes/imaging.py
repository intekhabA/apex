import os
import re
import uuid
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, or_
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.permissions import require_lab_staff
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.test import Test
from app.models.report import Report, ReportStatus, ReportAttachment
from app.models.imaging_template import ImagingTemplate
from app.schemas.common import APIResponse, MessageResponse
from app.schemas.imaging import (
    ImagingReportUpdate,
    ImagingAttachmentResponse,
    ImagingReportResponse,
    ImagingTemplateCreate,
    ImagingTemplateUpdate,
    ImagingTemplateResponse,
)
from app.services.storage_service import storage_service
from app.services.audit_service import AuditService

router = APIRouter(prefix="/imaging", tags=["Imaging & Radiology Reporting"])

# Standard Diagnostic Ultrasound & Radiography Narrative Templates
DEFAULT_TEMPLATES_DATA = [
    {
        "code": "USG_WHOLE_ABDOMEN",
        "name": "USG Whole Abdomen",
        "modality": "USG",
        "clinical_history_template": "Patient presents with abdominal discomfort. Evaluation of hepatobiliary, renal, and gastrointestinal systems.",
        "findings_template": (
            "LIVER: Normal size and shape. Normal parenchymal echotexture. No focal mass lesion. Intrahepatic biliary radicles are not dilated.\n"
            "GALLBLADDER: Well distended with normal wall thickness. Lumen is clear of calculi or biliary sludge.\n"
            "PANCREAS: Visualised parts show normal size and homogeneous echogenicity. MPD is not dilated.\n"
            "SPLEEN: Normal in size and contour with uniform echotexture.\n"
            "KIDNEYS: Both kidneys are normal in size, shape, and position. Corticomedullary differentiation is well maintained. No evidence of calculus or hydronephrosis.\n"
            "URINARY BLADDER: Adequately distended with smooth walls. No intravesical mass or calculus.\n"
            "RETROPERITONEUM: No significant retroperitoneal lymphadenopathy or free fluid in peritoneal cavity."
        ),
        "impression_template": "Sonographically normal whole abdomen study. No focal parenchymal lesion, cholelithiasis, or calculus noted.",
        "recommendations_template": "Clinical and biochemical correlation advised.",
        "display_order": 1,
    },
    {
        "code": "USG_PELVIS",
        "name": "USG Pelvis",
        "modality": "USG",
        "clinical_history_template": "Routine pelvic sonogram evaluation.",
        "findings_template": (
            "UTERUS: Normal in size, anteverted, and shows homogeneous myometrial echotexture. Endometrial stripe is central and regular.\n"
            "OVARIES: Both ovaries are normal in size and volume with regular stromal echogenicity. No cysts or solid masses noted.\n"
            "CUL-DE-SAC: Free of fluid collections or masses."
        ),
        "impression_template": "Normal pelvic ultrasound. No uterine or adnexal mass lesions seen.",
        "recommendations_template": "Correlate clinically.",
        "display_order": 2,
    },
    {
        "code": "USG_OBSTETRIC",
        "name": "USG Obstetric (Routine Antenatal)",
        "modality": "USG",
        "clinical_history_template": "Antenatal obstetric sonographic evaluation.",
        "findings_template": (
            "Single live intrauterine gestation demonstrated. Regular cardiac motion and active fetal movements observed.\n"
            "Fetal Heart Rate: 144 beats/minute, regular rhythm.\n"
            "Placenta: Anterior, upper segment, maturity Grade I.\n"
            "Amniotic Fluid: Amniotic fluid volume is adequate with clear liquor. AFI is within normal range."
        ),
        "impression_template": "Single live intrauterine gestation corresponding to gestational dates. Good fetal cardiac activity and adequate liquor.",
        "recommendations_template": "Routine antenatal care and follow-up as scheduled.",
        "display_order": 3,
    },
    {
        "code": "CHEST_XRAY_PA",
        "name": "Chest X-Ray PA View",
        "modality": "X-RAY",
        "clinical_history_template": "Evaluation for respiratory symptoms / routine pre-operative screening.",
        "findings_template": (
            "Trachea is central in position.\n"
            "Lung fields: Clear bilaterally. No active focal parenchymal consolidation, infiltrate, cavity, or nodule seen.\n"
            "Pleura: Both costophrenic and cardiophrenic angles are sharp and clear. No pleural effusion.\n"
            "Cardiovascular: Cardiothoracic ratio is within normal limits. Aortic arch and mediastinum appear normal.\n"
            "Bony thorax: Ribs, clavicles, and visualised soft tissues are unremarkable."
        ),
        "impression_template": "Normal chest radiograph (PA View). No cardiopulmonary abnormality identified.",
        "recommendations_template": "Clinical correlation recommended.",
        "display_order": 4,
    },
    {
        "code": "XRAY_LUMBAR_SPINE",
        "name": "X-Ray Lumbar Spine AP & Lateral",
        "modality": "X-RAY",
        "clinical_history_template": "Evaluation for lower back pain.",
        "findings_template": (
            "Normal physiological lumbar lordosis is preserved.\n"
            "Vertebral body heights and alignment are normal. No evidence of compression fracture or spondylolisthesis.\n"
            "Intervertebral disc spaces appear preserved across L1 to S1.\n"
            "Posterior elements, pedicles, and spinous processes are intact.\n"
            "Sacroiliac joints appear normal."
        ),
        "impression_template": "No significant osseous abnormality, fracture, or misalignment seen in lumbar spine.",
        "recommendations_template": "Physiotherapy / clinical review advised.",
        "display_order": 5,
    },
]


async def ensure_imaging_templates_seeded(db: AsyncSession):
    """Seed standard templates if the imaging_templates table is empty."""
    count_res = await db.execute(select(func.count(ImagingTemplate.id)))
    count = count_res.scalar() or 0
    if count == 0:
        for tpl_data in DEFAULT_TEMPLATES_DATA:
            tpl = ImagingTemplate(
                id=tpl_data["code"],
                code=tpl_data["code"],
                name=tpl_data["name"],
                modality=tpl_data["modality"],
                clinical_history_template=tpl_data["clinical_history_template"],
                findings_template=tpl_data["findings_template"],
                impression_template=tpl_data["impression_template"],
                recommendations_template=tpl_data["recommendations_template"],
                display_order=tpl_data["display_order"],
                is_active=True,
            )
            db.add(tpl)
        await db.commit()


def _format_template_response(t: ImagingTemplate) -> ImagingTemplateResponse:
    return ImagingTemplateResponse(
        id=str(t.id),
        code=t.code,
        name=t.name,
        modality=t.modality,
        test_id=str(t.test_id) if t.test_id else None,
        test_name=t.test.name if t.test else None,
        test_code=t.test.code if t.test else None,
        clinical_history_template=t.clinical_history_template or "",
        findings_template=t.findings_template,
        impression_template=t.impression_template or "",
        recommendations_template=t.recommendations_template or "",
        is_active=t.is_active,
        display_order=t.display_order,
        lab_id=str(t.lab_id) if t.lab_id else None,
        is_custom=bool(t.lab_id),
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


@router.get("/templates", response_model=APIResponse[List[ImagingTemplateResponse]])
async def list_imaging_templates(
    search: Optional[str] = Query(None, description="Search by name, code, or findings"),
    modality: Optional[str] = Query(None, description="Filter by modality (USG, X-RAY, CT, MRI, etc.)"),
    test_id: Optional[str] = Query(None, description="Filter by linked diagnostic test ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    scope: Optional[str] = Query("all", description="Scope: all, system, or lab"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Retrieve platform standard templates and laboratory custom narrative reporting templates."""
    await ensure_imaging_templates_seeded(db)

    query = (
        select(ImagingTemplate)
        .options(selectinload(ImagingTemplate.test))
        .order_by(ImagingTemplate.display_order.asc(), ImagingTemplate.name.asc())
    )

    is_super_admin = (
        current_user.role == UserRole.SUPER_ADMIN
        or (hasattr(current_user.role, "value") and current_user.role.value == "SUPER_ADMIN")
    )

    if not is_super_admin or current_user.lab_id:
        if scope == "system":
            query = query.where(ImagingTemplate.lab_id.is_(None))
        elif scope == "lab":
            query = query.where(ImagingTemplate.lab_id == current_user.lab_id)
        else:
            query = query.where(
                or_(
                    ImagingTemplate.lab_id.is_(None),
                    ImagingTemplate.lab_id == current_user.lab_id,
                )
            )
    else:
        if scope == "system":
            query = query.where(ImagingTemplate.lab_id.is_(None))
        elif scope == "lab":
            query = query.where(ImagingTemplate.lab_id.is_not(None))

    if modality and modality.upper() != "ALL":
        query = query.where(ImagingTemplate.modality == modality.upper())
    if test_id:
        query = query.where(or_(ImagingTemplate.test_id == test_id, ImagingTemplate.test_id.is_(None)))
    if is_active is not None:
        query = query.where(ImagingTemplate.is_active == is_active)
    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                ImagingTemplate.name.ilike(term),
                ImagingTemplate.code.ilike(term),
                ImagingTemplate.findings_template.ilike(term),
                ImagingTemplate.impression_template.ilike(term),
            )
        )

    res = await db.execute(query)
    templates = res.scalars().all()

    data = [_format_template_response(t) for t in templates]

    return APIResponse(
        success=True,
        message=f"Retrieved {len(data)} imaging templates.",
        data=data,
    )


@router.get("/templates/{template_id}", response_model=APIResponse[ImagingTemplateResponse])
async def get_imaging_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Retrieve a single reporting template by ID or code."""
    res = await db.execute(
        select(ImagingTemplate)
        .options(selectinload(ImagingTemplate.test))
        .where(or_(ImagingTemplate.id == template_id, ImagingTemplate.code == template_id))
    )
    template = res.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Template '{template_id}' not found.")

    is_super_admin = (
        current_user.role == UserRole.SUPER_ADMIN
        or (hasattr(current_user.role, "value") and current_user.role.value == "SUPER_ADMIN")
    )
    if not is_super_admin and current_user.lab_id:
        if template.lab_id is not None and template.lab_id != current_user.lab_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this laboratory template.",
            )

    return APIResponse(
        success=True,
        message="Template details retrieved.",
        data=_format_template_response(template),
    )


@router.post("/templates", response_model=APIResponse[ImagingTemplateResponse], status_code=status.HTTP_201_CREATED)
async def create_imaging_template(
    payload: ImagingTemplateCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Create a new reporting template for the current laboratory (or platform system template for Super Admin)."""
    is_super_admin = (
        current_user.role == UserRole.SUPER_ADMIN
        or (hasattr(current_user.role, "value") and current_user.role.value == "SUPER_ADMIN")
    )
    target_lab_id = None
    if not is_super_admin or current_user.lab_id:
        target_lab_id = current_user.lab_id
    elif payload.lab_id:
        target_lab_id = payload.lab_id

    # Sanitize and ensure code uniqueness
    raw_code = payload.code.strip().upper()
    code_clean = re.sub(r'[^A-Z0-9_]', '_', raw_code).strip('_')
    if not code_clean:
        code_clean = f"TPL_{uuid.uuid4().hex[:6].upper()}"

    res = await db.execute(select(ImagingTemplate).where(func.upper(ImagingTemplate.code) == code_clean))
    existing = res.scalar_one_or_none()
    if existing:
        if target_lab_id and existing.lab_id == target_lab_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A template with code '{code_clean}' already exists in your laboratory.",
            )
        else:
            suffix = f"_{target_lab_id[:6].upper()}" if target_lab_id else f"_{uuid.uuid4().hex[:4].upper()}"
            candidate = f"{code_clean}{suffix}"
            idx = 1
            while True:
                chk = await db.execute(select(ImagingTemplate).where(func.upper(ImagingTemplate.code) == candidate))
                if not chk.scalar_one_or_none():
                    break
                candidate = f"{code_clean}{suffix}_{idx}"
                idx += 1
            code_clean = candidate

    test_obj = None
    if payload.test_id:
        t_res = await db.execute(select(Test).where(Test.id == payload.test_id))
        test_obj = t_res.scalar_one_or_none()
        if not test_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Linked test with ID '{payload.test_id}' not found.",
            )

    template = ImagingTemplate(
        code=code_clean,
        name=payload.name.strip(),
        modality=payload.modality.strip().upper(),
        test_id=payload.test_id,
        clinical_history_template=payload.clinical_history_template,
        findings_template=payload.findings_template,
        impression_template=payload.impression_template,
        recommendations_template=payload.recommendations_template,
        is_active=payload.is_active,
        display_order=payload.display_order,
        lab_id=target_lab_id,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)

    # Load relation
    r_res = await db.execute(
        select(ImagingTemplate).options(selectinload(ImagingTemplate.test)).where(ImagingTemplate.id == template.id)
    )
    template = r_res.scalar_one()

    await AuditService.log_event(
        db=db,
        action="CREATE_IMAGING_TEMPLATE",
        entity_name="imaging_templates",
        entity_id=str(template.id),
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        after_state={"code": template.code, "name": template.name, "modality": template.modality, "lab_id": target_lab_id},
    )

    return APIResponse(
        success=True,
        message=f"Template '{template.name}' saved successfully.",
        data=_format_template_response(template),
    )


@router.put("/templates/{template_id}", response_model=APIResponse[ImagingTemplateResponse])
async def update_imaging_template(
    template_id: str,
    payload: ImagingTemplateUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Update an existing template. Laboratories can only modify templates belonging to their lab."""
    res = await db.execute(
        select(ImagingTemplate)
        .options(selectinload(ImagingTemplate.test))
        .where(or_(ImagingTemplate.id == template_id, ImagingTemplate.code == template_id))
    )
    template = res.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Template '{template_id}' not found.")

    is_super_admin = (
        current_user.role == UserRole.SUPER_ADMIN
        or (hasattr(current_user.role, "value") and current_user.role.value == "SUPER_ADMIN")
    )
    if not is_super_admin:
        if template.lab_id != current_user.lab_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only edit templates created by your laboratory. Standard system templates cannot be modified directly.",
            )

    before_state = {"code": template.code, "name": template.name, "modality": template.modality}

    if payload.code is not None:
        raw_code = payload.code.strip().upper()
        code_clean = re.sub(r'[^A-Z0-9_]', '_', raw_code).strip('_')
        if code_clean and code_clean != template.code:
            chk = await db.execute(
                select(ImagingTemplate).where(
                    func.upper(ImagingTemplate.code) == code_clean,
                    ImagingTemplate.id != template.id,
                )
            )
            if chk.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Template with code '{code_clean}' already exists.",
                )
            template.code = code_clean

    if payload.name is not None:
        template.name = payload.name.strip()
    if payload.modality is not None:
        template.modality = payload.modality.strip().upper()
    if payload.test_id is not None:
        if payload.test_id:
            t_res = await db.execute(select(Test).where(Test.id == payload.test_id))
            if not t_res.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Linked test '{payload.test_id}' not found.",
                )
            template.test_id = payload.test_id
        else:
            template.test_id = None
    if payload.clinical_history_template is not None:
        template.clinical_history_template = payload.clinical_history_template
    if payload.findings_template is not None:
        template.findings_template = payload.findings_template
    if payload.impression_template is not None:
        template.impression_template = payload.impression_template
    if payload.recommendations_template is not None:
        template.recommendations_template = payload.recommendations_template
    if payload.is_active is not None:
        template.is_active = payload.is_active
    if payload.display_order is not None:
        template.display_order = payload.display_order

    await db.commit()
    await db.refresh(template)

    r_res = await db.execute(
        select(ImagingTemplate).options(selectinload(ImagingTemplate.test)).where(ImagingTemplate.id == template.id)
    )
    template = r_res.scalar_one()

    await AuditService.log_event(
        db=db,
        action="UPDATE_IMAGING_TEMPLATE",
        entity_name="imaging_templates",
        entity_id=str(template.id),
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        before_state=before_state,
        after_state={"code": template.code, "name": template.name, "modality": template.modality},
    )

    return APIResponse(
        success=True,
        message=f"Template '{template.name}' updated successfully.",
        data=_format_template_response(template),
    )


@router.delete("/templates/{template_id}", response_model=APIResponse[dict])
async def delete_imaging_template(
    template_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Delete a template. Laboratories can only delete templates belonging to their lab."""
    res = await db.execute(
        select(ImagingTemplate).where(or_(ImagingTemplate.id == template_id, ImagingTemplate.code == template_id))
    )
    template = res.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Template '{template_id}' not found.")

    is_super_admin = (
        current_user.role == UserRole.SUPER_ADMIN
        or (hasattr(current_user.role, "value") and current_user.role.value == "SUPER_ADMIN")
    )
    if not is_super_admin:
        if template.lab_id != current_user.lab_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete templates belonging to your laboratory.",
            )

    template_name = template.name
    template_code = template.code
    await db.delete(template)
    await db.commit()

    await AuditService.log_event(
        db=db,
        action="DELETE_IMAGING_TEMPLATE",
        entity_name="imaging_templates",
        entity_id=str(template.id),
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        before_state={"code": template_code, "name": template_name},
    )

    return APIResponse(
        success=True,
        message=f"Template '{template_name}' [{template_code}] deleted successfully.",
        data={"id": template_id, "deleted": True},
    )


@router.get("/{report_id}", response_model=APIResponse[ImagingReportResponse])
async def get_imaging_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Retrieve structured narrative findings and uploaded diagnostic scans for a report."""
    res = await db.execute(
        select(Report)
        .options(
            selectinload(Report.test),
            selectinload(Report.patient),
            selectinload(Report.attachments),
        )
        .where(Report.id == report_id)
    )
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    if current_user.role.value != "SUPER_ADMIN" and report.lab_id != current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden.")

    attachments_out = [
        ImagingAttachmentResponse(
            id=str(a.id),
            report_id=str(a.report_id),
            file_name=a.file_name,
            file_type=a.file_type,
            file_size_bytes=a.file_size_bytes,
            storage_path=a.storage_path,
            caption=a.caption,
            uploaded_by=a.uploaded_by,
            created_at=a.created_at,
        )
        for a in report.attachments
    ]

    return APIResponse(
        success=True,
        message="Imaging report retrieved successfully.",
        data=ImagingReportResponse(
            report_id=str(report.id),
            report_id_display=report.report_id_display,
            lab_id=str(report.lab_id),
            booking_id=str(report.booking_id),
            patient_id=str(report.patient.id),
            patient_name=report.patient.full_name,
            patient_gender=report.patient.gender.value,
            patient_age_years=report.patient.age_years,
            test_id=str(report.test.id),
            test_name=report.test.name,
            test_code=report.test.code,
            status=report.status,
            clinical_history=report.clinical_history,
            imaging_findings=report.imaging_findings,
            imaging_impression=report.imaging_impression,
            recommendations=report.recommendations,
            attachments=attachments_out,
            created_at=report.created_at,
            updated_at=report.updated_at,
        ),
    )


@router.put("/{report_id}", response_model=APIResponse[ImagingReportResponse])
async def update_imaging_report(
    report_id: str,
    payload: ImagingReportUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Save radiologist findings, clinical history, impression, and recommendations."""
    res = await db.execute(
        select(Report)
        .options(
            selectinload(Report.test),
            selectinload(Report.patient),
            selectinload(Report.attachments),
        )
        .where(Report.id == report_id)
    )
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    if current_user.role.value != "SUPER_ADMIN" and report.lab_id != current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden.")

    if report.is_immutable or report.status == ReportStatus.FINAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify a finalized medical report.",
        )

    if payload.clinical_history is not None:
        report.clinical_history = payload.clinical_history
    if payload.imaging_findings is not None:
        report.imaging_findings = payload.imaging_findings
    if payload.imaging_impression is not None:
        report.imaging_impression = payload.imaging_impression
    if payload.recommendations is not None:
        report.recommendations = payload.recommendations

    if payload.submit_for_review and report.status == ReportStatus.DRAFT:
        report.status = ReportStatus.PENDING_REVIEW

    await db.commit()
    await db.refresh(report)

    attachments_out = [
        ImagingAttachmentResponse(
            id=str(a.id),
            report_id=str(a.report_id),
            file_name=a.file_name,
            file_type=a.file_type,
            file_size_bytes=a.file_size_bytes,
            storage_path=a.storage_path,
            caption=a.caption,
            uploaded_by=a.uploaded_by,
            created_at=a.created_at,
        )
        for a in report.attachments
    ]

    return APIResponse(
        success=True,
        message="Imaging report updated successfully.",
        data=ImagingReportResponse(
            report_id=str(report.id),
            report_id_display=report.report_id_display,
            lab_id=str(report.lab_id),
            booking_id=str(report.booking_id),
            patient_id=str(report.patient.id),
            patient_name=report.patient.full_name,
            patient_gender=report.patient.gender.value,
            patient_age_years=report.patient.age_years,
            test_id=str(report.test.id),
            test_name=report.test.name,
            test_code=report.test.code,
            status=report.status,
            clinical_history=report.clinical_history,
            imaging_findings=report.imaging_findings,
            imaging_impression=report.imaging_impression,
            recommendations=report.recommendations,
            attachments=attachments_out,
            created_at=report.created_at,
            updated_at=report.updated_at,
        ),
    )


@router.post("/{report_id}/attachments", response_model=APIResponse[ImagingAttachmentResponse], status_code=status.HTTP_201_CREATED)
async def upload_imaging_attachment(
    report_id: str,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Upload diagnostic scan (X-Ray, Ultrasound, CT, MRI, PDF) to the report."""
    res = await db.execute(
        select(Report)
        .options(selectinload(Report.attachments))
        .where(Report.id == report_id)
    )
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    if current_user.role.value != "SUPER_ADMIN" and report.lab_id != current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden.")

    if report.is_immutable or report.status == ReportStatus.FINAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add attachments to a finalized report.",
        )

    safe_filename = f"{len(report.attachments) + 1}_{file.filename}"
    rel_path = f"reports/{report_id}/{safe_filename}"

    # Read and store file
    contents = await file.read()
    file_size = len(contents)
    if file_size > settings.STORAGE_MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of {settings.STORAGE_MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB.",
        )

    stored_path = await storage_service.save_file_bytes(
        file_bytes=contents,
        rel_path=rel_path,
        content_type=file.content_type or "application/octet-stream",
    )

    attachment = ReportAttachment(
        report_id=report.id,
        file_name=file.filename or "attachment",
        file_type=file.content_type or "application/octet-stream",
        file_size_bytes=file_size,
        storage_path=stored_path,
        caption=caption,
        uploaded_by=current_user.id,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)

    return APIResponse(
        success=True,
        message=f"Attachment '{attachment.file_name}' uploaded successfully.",
        data=ImagingAttachmentResponse(
            id=str(attachment.id),
            report_id=str(attachment.report_id),
            file_name=attachment.file_name,
            file_type=attachment.file_type,
            file_size_bytes=attachment.file_size_bytes,
            storage_path=attachment.storage_path,
            caption=attachment.caption,
            uploaded_by=attachment.uploaded_by,
            created_at=attachment.created_at,
        ),
    )


@router.get("/{report_id}/attachments/{attachment_id}/download")
async def download_imaging_attachment(
    report_id: str,
    attachment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Download or view an uploaded diagnostic scan/image attachment."""
    res = await db.execute(
        select(ReportAttachment).where(
            ReportAttachment.id == attachment_id,
            ReportAttachment.report_id == report_id,
        )
    )
    attachment = res.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found.")

    rep_res = await db.execute(select(Report).where(Report.id == report_id))
    report = rep_res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    if current_user.role.value != "SUPER_ADMIN" and report.lab_id != current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden.")

    if not await storage_service.file_exists(attachment.storage_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment file not found in storage.")

    return await storage_service.get_file_response(
        rel_path=attachment.storage_path,
        filename=attachment.file_name,
        media_type=attachment.file_type or "application/octet-stream",
    )


@router.delete("/{report_id}/attachments/{attachment_id}", response_model=APIResponse[MessageResponse])
async def delete_imaging_attachment(
    report_id: str,
    attachment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Delete an uploaded scan attachment from the report."""
    res = await db.execute(
        select(ReportAttachment).where(
            ReportAttachment.id == attachment_id,
            ReportAttachment.report_id == report_id,
        )
    )
    attachment = res.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found.")

    # Check report ownership
    rep_res = await db.execute(select(Report).where(Report.id == report_id))
    report = rep_res.scalar_one()

    if current_user.role.value != "SUPER_ADMIN" and report.lab_id != current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden.")

    if report.is_immutable or report.status == ReportStatus.FINAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete attachments from a finalized report.",
        )

    # Delete file from storage (Local or S3)
    await storage_service.delete_file(attachment.storage_path)

    await db.delete(attachment)
    await db.commit()

    return APIResponse(
        success=True,
        message="Attachment deleted successfully.",
        data=MessageResponse(message="Attachment removed."),
    )
