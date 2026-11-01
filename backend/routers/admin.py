from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import auth
import models
import schemas
from database import get_db

router = APIRouter(
    prefix="/api/admin",
    tags=["Administration"],
    dependencies=[Depends(auth.require_role(["admin"]))],
)


@router.get("/users", response_model=List[schemas.AdminUserResponse])
def get_users(db: Session = Depends(get_db)):
    return (
        db.query(models.User)
        .filter(models.User.role == models.UserRole.citizen)
        .order_by(models.User.full_name)
        .all()
    )


@router.get("/departments", response_model=List[schemas.DepartmentResponse])
def get_departments(db: Session = Depends(get_db)):
    return db.query(models.Department).order_by(models.Department.name).all()


@router.post(
    "/departments",
    response_model=schemas.DepartmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_department(
    department: schemas.DepartmentCreate,
    db: Session = Depends(get_db),
):
    if db.query(models.Department.id).filter_by(name=department.name).first():
        raise HTTPException(status_code=409, detail="Department already exists")
    new_department = models.Department(name=department.name)
    db.add(new_department)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Department already exists") from exc
    db.refresh(new_department)
    return new_department


def _ensure_email_available(db: Session, email: str, account_id: int, is_officer: bool):
    user_match = (
        db.query(models.User.id)
        .filter(models.User.email == email)
        .first()
    )
    officer_query = db.query(models.Officer.id).filter(models.Officer.email == email)
    if is_officer:
        officer_query = officer_query.filter(models.Officer.id != account_id)
    else:
        user_match = (
            db.query(models.User.id)
            .filter(models.User.email == email, models.User.id != account_id)
            .first()
        )
    officer_match = officer_query.first()
    if user_match or officer_match:
        raise HTTPException(status_code=409, detail="Email is already registered")


def _apply_account_update(account, update_data: dict):
    password = update_data.pop("password", None)
    if password is not None:
        account.password_hash = auth.get_password_hash(password)
    for field, value in update_data.items():
        if value is not None or field in {"phone", "dept_id"}:
            setattr(account, field, str(value) if field == "email" else value)


@router.patch("/users/{user_id}", response_model=schemas.AdminUserResponse)
def update_user(
    user_id: int,
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
):
    user = (
        db.query(models.User)
        .filter_by(id=user_id, role=models.UserRole.citizen)
        .first()
    )
    if user is None:
        raise HTTPException(status_code=404, detail="Citizen account not found")

    update_data = user_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=422, detail="Provide at least one field to update")
    if update_data.get("email") is not None:
        _ensure_email_available(db, str(update_data["email"]), user.id, False)
    _apply_account_update(user, update_data)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email is already registered") from exc
    db.refresh(user)
    return user


@router.patch("/officers/{officer_id}", response_model=schemas.OfficerResponse)
def update_officer(
    officer_id: int,
    officer_update: schemas.OfficerUpdate,
    db: Session = Depends(get_db),
):
    officer = (
        db.query(models.Officer)
        .filter_by(id=officer_id, role=models.UserRole.officer)
        .first()
    )
    if officer is None:
        raise HTTPException(status_code=404, detail="Officer account not found")

    update_data = officer_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=422, detail="Provide at least one field to update")
    if update_data.get("email") is not None:
        _ensure_email_available(db, str(update_data["email"]), officer.id, True)
    department_id = update_data.get("dept_id")
    if department_id is not None and db.get(models.Department, department_id) is None:
        raise HTTPException(status_code=404, detail="Department not found")

    _apply_account_update(officer, update_data)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email is already registered") from exc
    db.refresh(officer)
    return officer


def _account_has_linked_records(db: Session, account_id: int, is_officer: bool) -> bool:
    if is_officer:
        return any(
            (
                db.query(models.Case.id)
                .filter(models.Case.officer_id == account_id)
                .first(),
                db.query(models.Comment.id)
                .filter(models.Comment.officer_id == account_id)
                .first(),
            )
        )
    return any(
        (
            db.query(models.FraudReport.id)
            .filter(models.FraudReport.user_id == account_id)
            .first(),
            db.query(models.Notification.id)
            .filter(models.Notification.user_id == account_id)
            .first(),
            db.query(models.Comment.id)
            .filter(models.Comment.user_id == account_id)
            .first(),
        )
    )


def _delete_account(db: Session, account, account_id: int, is_officer: bool):
    if _account_has_linked_records(db, account_id, is_officer):
        raise HTTPException(
            status_code=409,
            detail="This account has linked records and cannot be deleted",
        )
    db.delete(account)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This account has linked records and cannot be deleted",
        ) from exc


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = (
        db.query(models.User)
        .filter_by(id=user_id, role=models.UserRole.citizen)
        .first()
    )
    if user is None:
        raise HTTPException(status_code=404, detail="Citizen account not found")
    _delete_account(db, user, user_id, False)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/officers/{officer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_officer(officer_id: int, db: Session = Depends(get_db)):
    officer = (
        db.query(models.Officer)
        .filter_by(id=officer_id, role=models.UserRole.officer)
        .first()
    )
    if officer is None:
        raise HTTPException(status_code=404, detail="Officer account not found")
    _delete_account(db, officer, officer_id, True)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
