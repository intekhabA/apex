import os
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.permissions import require_lab_staff
from app.models.user import User
from app.models.patient import Patient
from app.models.test import Test
from app.models.report import Report, ReportStatus, ReportAttachment
from app.schemas.common import APIResponse, MessageResponse
from app.schemas.imaging import (
    ImagingReportUpdate,
    ImagingAttachmentResponse,
    ImagingReportResponse,
    ImagingTemplateResponse,
)
from app.services.storage_service import storage_service

router = APIRouter(prefix="/imaging", tags=["Imaging & Radiology Reporting"])

# Standard Diagnostic Ultrasound & Radiography Narrative Templates
STANDARD_TEMPLATES: List[ImagingTemplateResponse] = [
    ImagingTemplateResponse(
        id="USG_WHOLE_ABDOMEN",
        name="USG Whole Abdomen",
        modality="USG",
        clinical_history_template="Patient presents with abdominal discomfort. Evaluation of hepatobiliary, renal, and gastrointestinal systems.",
        findings_template=(
            "LIVER: Normal size and shape. Normal parenchymal echotexture. No focal mass lesion. Intrahepatic biliary radicles are not dilated.\n"
            "GALLBLADDER: Well distended with normal wall thickness. Lumen is clear of calculi or biliary sludge.\n"
            "PANCREAS: Visualised parts show normal size and homogeneous echogenicity. MPD is not dilated.\n"
            "SPLEEN: Normal in size and contour with uniform echotexture.\n"
            "KIDNEYS: Both kidneys are normal in size, shape, and position. Corticomedullary differentiation is well maintained. No evidence of calculus or hydronephrosis.\n"
            "URINARY BLADDER: Adequately distended with smooth walls. No intravesical mass or calculus.\n"
            "RETROPERITONEUM: No significant retroperitoneal lymphadenopathy or free fluid in peritoneal cavity."
        ),
        impression_template="Sonographically normal whole abdomen study. No focal parenchymal lesion, cholelithiasis, or calculus noted.",
        recommendations_template="Clinical and biochemical correlation advised.",
    ),
    ImagingTemplateResponse(
        id="USG_PELVIS",
        name="USG Pelvis",
        modality="USG",
        clinical_history_template="Routine pelvic sonogram evaluation.",
        findings_template=(
            "UTERUS: Normal in size, anteverted, and shows homogeneous myometrial echotexture. Endometrial stripe is central and regular.\n"
            "OVARIES: Both ovaries are normal in size and volume with regular stromal echogenicity. No cysts or solid masses noted.\n"
            "CUL-DE-SAC: Free of fluid collections or masses."
        ),
        impression_template="Normal pelvic ultrasound. No uterine or adnexal mass lesions seen.",
        recommendations_template="Correlate clinically.",
    ),
    ImagingTemplateResponse(
        id="USG_OBSTETRIC",
        name="USG Obstetric (Routine Antenatal)",
        modality="USG",
        clinical_history_template="Antenatal obstetric sonographic evaluation.",
        findings_template=(
            "Single live intrauterine gestation demonstrated. Regular cardiac motion and active fetal movements observed.\n"
            "Fetal Heart Rate: 144 beats/minute, regular rhythm.\n"
            "Placenta: Anterior, upper segment, maturity Grade I.\n"
            "Amniotic Fluid: Amniotic fluid volume is adequate with clear liquor. AFI is within normal range."
        ),
        impression_template="Single live intrauterine gestation corresponding to gestational dates. Good fetal cardiac activity and adequate liquor.",
        recommendations_template="Routine antenatal care and follow-up as scheduled.",
    ),
    ImagingTemplateResponse(
        id="CHEST_XRAY_PA",
        name="Chest X-Ray PA View",
        modality="X-RAY",
        clinical_history_template="Evaluation for respiratory symptoms / routine pre-operative screening.",
        findings_template=(
            "Trachea is central in position.\n"
            "Lung fields: Clear bilaterally. No active focal parenchymal consolidation, infiltrate, cavity, or nodule seen.\n"
            "Pleura: Both costophrenic and cardiophrenic angles are sharp and clear. No pleural effusion.\n"
            "Cardiovascular: Cardiothoracic ratio is within normal limits. Aortic arch and mediastinum appear normal.\n"
            "Bony thorax: Ribs, clavicles, and visualised soft tissues are unremarkable."
        ),
        impression_template="Normal chest radiograph (PA View). No cardiopulmonary abnormality identified.",
        recommendations_template="Clinical correlation recommended.",
    ),
    ImagingTemplateResponse(
        id="XRAY_LUMBAR_SPINE",
        name="X-Ray Lumbar Spine AP & Lateral",
        modality="X-RAY",
        clinical_history_template="Evaluation for lower back pain.",
        findings_template=(
            "Normal physiological lumbar lordosis is preserved.\n"
            "Vertebral body heights and alignment are normal. No evidence of compression fracture or spondylolisthesis.\n"
            "Intervertebral disc spaces appear preserved across L1 to S1.\n"
            "Posterior elements, pedicles, and spinous processes are intact.\n"
            "Sacroiliac joints appear normal."
        ),
        impression_template="No significant osseous abnormality, fracture, or misalignment seen in lumbar spine.",
        recommendations_template="Physiotherapy / clinical review advised.",
    ),
]


@router.get("/templates", response_model=APIResponse[List[ImagingTemplateResponse]])
async def list_imaging_templates(
    current_user: User = Depends(require_lab_staff),
):
    """Retrieve pre-configured diagnostic radiology & ultrasound narrative reporting templates."""
    return APIResponse(
        success=True,
        message=f"Retrieved {len(STANDARD_TEMPLATES)} imaging templates.",
        data=STANDARD_TEMPLATES,
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
