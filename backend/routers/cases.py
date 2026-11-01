from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from typing import List

import models
import schemas
import auth
from database import get_db

router = APIRouter(prefix="/api/cases", tags=["Cases"])

@router.get(
    "/",
    response_model=List[schemas.CaseResponse],
)
def get_all_cases(
    db: Session = Depends(get_db),
    current_user: models.Officer = Depends(auth.require_role(["officer", "admin"])),
):
    query = db.query(models.Case).options(
        joinedload(models.Case.status_logs),
        joinedload(models.Case.report).joinedload(models.FraudReport.evidence),
    )
    if current_user.role == models.UserRole.officer:
        query = query.filter(models.Case.officer_id == current_user.id)
    return query.all()


@router.get(
    "/officers",
    response_model=List[schemas.OfficerResponse],
    dependencies=[Depends(auth.require_role(["admin"]))],
)
def get_officers(db: Session = Depends(get_db)):
    return (
        db.query(models.Officer)
        .filter(models.Officer.role == models.UserRole.officer)
        .order_by(models.Officer.full_name)
        .all()
    )


@router.post(
    "/officers",
    response_model=schemas.OfficerResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(auth.require_role(["admin"]))],
)
def create_officer(
    officer: schemas.OfficerCreate,
    db: Session = Depends(get_db),
):
    email = str(officer.email)
    existing_user = db.query(models.User.id).filter_by(email=email).first()
    existing_officer = db.query(models.Officer.id).filter_by(email=email).first()
    if existing_user or existing_officer:
        raise HTTPException(status_code=409, detail="Email is already registered")

    new_officer = models.Officer(
        full_name=officer.full_name,
        email=email,
        password_hash=auth.get_password_hash(officer.password),
        role=models.UserRole.officer,
    )
    db.add(new_officer)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Email is already registered",
        ) from exc
    db.refresh(new_officer)
    return new_officer


@router.get(
    "/{case_id}",
    response_model=schemas.CaseResponse,
)
def get_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: models.Officer = Depends(auth.require_role(["officer", "admin"])),
):
    case = (
        db.query(models.Case)
        .options(
            joinedload(models.Case.status_logs),
            joinedload(models.Case.report).joinedload(models.FraudReport.evidence),
        )
        .filter(models.Case.id == case_id)
        .first()
    )
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if (
        current_user.role == models.UserRole.officer
        and case.officer_id != current_user.id
    ):
        raise HTTPException(status_code=403, detail="This case is not assigned to you")
    return case

@router.patch("/{case_id}", response_model=schemas.CaseResponse)
def update_case(
    case_id: int,
    case_update: schemas.CaseUpdate,
    db: Session = Depends(get_db),
    current_user: models.Officer = Depends(auth.require_role(["officer", "admin"]))
):
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if (
        current_user.role == models.UserRole.officer
        and case.officer_id != current_user.id
    ):
        raise HTTPException(status_code=403, detail="This case is not assigned to you")
    
    previous_status = case.case_status
    update_data = case_update.model_dump(exclude_unset=True)
    for field in ("priority", "case_status"):
        if update_data.get(field) is None:
            update_data.pop(field, None)
    if (
        current_user.role == models.UserRole.officer
        and "officer_id" in update_data
    ):
        raise HTTPException(status_code=403, detail="Only administrators can assign cases")
    if "officer_id" in update_data and update_data["officer_id"] is not None:
        assigned_officer = (
            db.query(models.Officer)
            .filter_by(
                id=update_data["officer_id"],
                role=models.UserRole.officer,
            )
            .first()
        )
        if assigned_officer is None:
            raise HTTPException(status_code=404, detail="Officer not found")

    for key, value in update_data.items():
        setattr(case, key, value)
        
    if case_update.case_status is not None:
        case.closed_at = (
            datetime.now(timezone.utc).replace(tzinfo=None)
            if case_update.case_status == models.CaseStatus.Closed
            else None
        )

    if (
        "case_status" in update_data
        and previous_status != case_update.case_status
    ):
        db.add(
            models.StatusLog(
                case_id=case.id,
                old_status=previous_status.value,
                new_status=case.case_status.value,
                changed_by=current_user.email,
            )
        )

    db.commit()
    db.refresh(case)
    return case
