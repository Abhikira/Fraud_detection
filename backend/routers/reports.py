import io
import warnings
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from datetime import date
from typing import List
from starlette.concurrency import run_in_threadpool

import models
import schemas
import auth
from database import get_db
from upload_storage import UPLOAD_DIR

router = APIRouter(prefix="/api/reports", tags=["Fraud Reports"])
MAX_IMAGE_SIZE = 5 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
ALLOWED_IMAGE_FORMATS = {
    "JPEG": ("image/jpeg", ".jpg"),
    "PNG": ("image/png", ".png"),
    "WEBP": ("image/webp", ".webp"),
}


async def store_evidence_image(image: UploadFile) -> tuple[str, str]:
    image_bytes = await image.read(MAX_IMAGE_SIZE + 1)
    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Images must be 5 MB or smaller")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            source = Image.open(io.BytesIO(image_bytes))
            if source.format not in ALLOWED_IMAGE_FORMATS:
                raise HTTPException(
                    status_code=415,
                    detail="Upload a JPEG, PNG, or WebP image",
                )
            if source.width * source.height > MAX_IMAGE_PIXELS:
                raise HTTPException(
                    status_code=413,
                    detail="Image dimensions must not exceed 20 megapixels",
                )
            source.verify()

            with Image.open(io.BytesIO(image_bytes)) as verified_image:
                verified_image.load()
                image_format = verified_image.format
                if image_format == "JPEG":
                    verified_image = verified_image.convert("RGB")
                output = io.BytesIO()
                verified_image.save(output, format=image_format)
    except HTTPException:
        raise
    except (
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        UnidentifiedImageError,
        OSError,
        ValueError,
    ) as exc:
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid image") from exc

    mime_type, extension = ALLOWED_IMAGE_FORMATS[image_format]
    filename = f"{uuid4().hex}{extension}"
    await run_in_threadpool((UPLOAD_DIR / filename).write_bytes, output.getvalue())
    return filename, mime_type


def create_report_with_case(
    report: schemas.FraudReportCreate,
    db: Session,
    current_user: models.User,
    evidence_path: str | None = None,
    evidence_type: str | None = None,
) -> models.FraudReport:
    new_report = models.FraudReport(
        **report.model_dump(),
        user_id=current_user.id,
    )
    try:
        db.add(new_report)
        db.flush()
        db.add(
            models.Case(
                report_id=new_report.id,
                priority=models.Priority.Medium,
                case_status=models.CaseStatus.Open,
            )
        )
        if evidence_path and evidence_type:
            db.add(
                models.Evidence(
                    report_id=new_report.id,
                    file_path=evidence_path,
                    file_type=evidence_type,
                )
            )
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        if evidence_path:
            (UPLOAD_DIR / evidence_path).unlink(missing_ok=True)
        raise

    db.refresh(new_report)
    return new_report

@router.get("/categories", response_model=List[schemas.CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    return db.query(models.FraudCategory).order_by(models.FraudCategory.name).all()

@router.get(
    "/",
    response_model=List[schemas.FraudReportResponse],
    dependencies=[Depends(auth.require_role(["admin"]))],
)
def get_all_reports(db: Session = Depends(get_db)):
    return db.query(models.FraudReport).order_by(
        models.FraudReport.reported_at.desc()
    ).all()

@router.post("/", response_model=schemas.FraudReportResponse, status_code=status.HTTP_201_CREATED)
def create_report(
    report: schemas.FraudReportCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["citizen"]))
):
    return create_report_with_case(report, db, current_user)

@router.post(
    "/with-evidence",
    response_model=schemas.FraudReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_report_with_evidence(
    title: Annotated[str, Form(min_length=5, max_length=150)],
    description: Annotated[str, Form()],
    amount_involved: Annotated[float, Form(gt=0)],
    incident_date: Annotated[date, Form()],
    category_id: Annotated[int, Form()],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["citizen"])),
    image: UploadFile | None = File(default=None),
):
    report = schemas.FraudReportCreate(
        title=title,
        description=description,
        amount_involved=amount_involved,
        incident_date=incident_date,
        category_id=category_id,
    )
    evidence_path = None
    evidence_type = None
    if image and image.filename:
        evidence_path, evidence_type = await store_evidence_image(image)

    return create_report_with_case(
        report,
        db,
        current_user,
        evidence_path,
        evidence_type,
    )

@router.get("/my-reports", response_model=List[schemas.FraudReportResponse])
def get_my_reports(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["citizen"]))
):
    reports = db.query(models.FraudReport).filter(models.FraudReport.user_id == current_user.id).all()
    return reports

@router.get(
    "/{report_id}/evidence/{evidence_id}/image",
    response_class=FileResponse,
)
def get_report_image(
    report_id: int,
    evidence_id: int,
    db: Session = Depends(get_db),
    current_user: models.User | models.Officer = Depends(auth.get_current_user),
):
    evidence = (
        db.query(models.Evidence)
        .join(models.FraudReport)
        .filter(
            models.FraudReport.id == report_id,
            models.Evidence.id == evidence_id,
        )
        .first()
    )
    if evidence is None:
        raise HTTPException(status_code=404, detail="Image not found")

    report = db.query(models.FraudReport).filter_by(id=report_id).first()
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    if current_user.role == models.UserRole.citizen:
        if report.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == models.UserRole.officer:
        assigned_case = (
            db.query(models.Case.id)
            .filter_by(report_id=report_id, officer_id=current_user.id)
            .first()
        )
        if assigned_case is None:
            raise HTTPException(status_code=403, detail="Access denied")

    image_path = (UPLOAD_DIR / evidence.file_path).resolve()
    if image_path.parent != UPLOAD_DIR.resolve() or not image_path.is_file():
        raise HTTPException(status_code=404, detail="Image file not found")
    return FileResponse(
        image_path,
        media_type=evidence.file_type,
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
