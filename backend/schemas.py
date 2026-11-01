from datetime import datetime, date
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from typing import Optional, List
from models import UserRole, CaseStatus, Priority

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: Optional[str] = None
    password: str = Field(min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    email: EmailStr
    role: UserRole
    created_at: datetime


class AdminUserResponse(UserResponse):
    phone: Optional[str] = None


# Category Schemas
class CategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: Optional[str] = None

class CategoryResponse(CategoryCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int

# Officer Schemas
class OfficerCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def validate_password_byte_length(cls, password: str) -> str:
        if len(password.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return password


class OfficerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    email: EmailStr
    role: UserRole
    dept_id: Optional[int] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=20)
    password: Optional[str] = Field(default=None, min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def validate_password_byte_length(cls, password: str | None) -> str | None:
        if password is not None and len(password.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return password


class OfficerUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    dept_id: Optional[int] = Field(default=None, ge=1)
    password: Optional[str] = Field(default=None, min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def validate_password_byte_length(cls, password: str | None) -> str | None:
        if password is not None and len(password.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return password


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)


# Evidence Schemas
class EvidenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    file_type: str
    uploaded_at: datetime

# Fraud Report Schemas
class FraudReportCreate(BaseModel):
    title: str = Field(min_length=5, max_length=150)
    description: str
    amount_involved: float = Field(gt=0)
    incident_date: date
    category_id: int

class FraudReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: str
    amount_involved: float
    incident_date: date
    reported_at: datetime
    status: str
    user_id: int
    category_id: int
    evidence: List[EvidenceResponse] = Field(default_factory=list)

# Case Schemas
class CaseCreate(BaseModel):
    report_id: int
    priority: Priority = Priority.Medium

class CaseUpdate(BaseModel):
    officer_id: Optional[int] = None
    priority: Optional[Priority] = None
    case_status: Optional[CaseStatus] = None

class StatusLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    old_status: Optional[str]
    new_status: str
    changed_by: str
    changed_at: datetime

class CaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    report_id: int
    officer_id: Optional[int]
    priority: Priority
    case_status: CaseStatus
    opened_at: datetime
    closed_at: Optional[datetime]
    status_logs: List[StatusLogResponse] = Field(default_factory=list)
    report: Optional[FraudReportResponse] = None
