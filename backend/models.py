from datetime import datetime, date
from sqlalchemy import String, Boolean, Date, DateTime, ForeignKey, Text, DECIMAL, Enum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base
import enum

class UserRole(str, enum.Enum):
    citizen = "citizen"
    officer = "officer"
    admin = "admin"

class CaseStatus(str, enum.Enum):
    Open = "Open"
    Investigating = "Investigating"
    Resolved = "Resolved"
    Closed = "Closed"

class Priority(str, enum.Enum):
    Low = "Low"
    Medium = "Medium"
    High = "High"

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.citizen)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    
    reports: Mapped[list["FraudReport"]] = relationship(back_populates="user")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="user")

class Officer(Base):
    __tablename__ = "officers"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    dept_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.officer)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    
    cases: Mapped[list["Case"]] = relationship(back_populates="officer")

class Department(Base):
    __tablename__ = "departments"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

class FraudCategory(Base):
    __tablename__ = "fraud_categories"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

class FraudReport(Base):
    __tablename__ = "fraud_reports"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    amount_involved: Mapped[float] = mapped_column(DECIMAL(15, 2), nullable=False)
    incident_date: Mapped[date] = mapped_column(Date, nullable=False)
    reported_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    status: Mapped[str] = mapped_column(String(50), default="Pending")
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    category_id: Mapped[int] = mapped_column(ForeignKey("fraud_categories.id"))
    
    user: Mapped["User"] = relationship(back_populates="reports")
    case: Mapped["Case"] = relationship(back_populates="report", uselist=False)
    evidence: Mapped[list["Evidence"]] = relationship(back_populates="report")

class Case(Base):
    __tablename__ = "cases"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("fraud_reports.id", ondelete="CASCADE"), unique=True)
    officer_id: Mapped[int | None] = mapped_column(ForeignKey("officers.id", ondelete="SET NULL"))
    priority: Mapped[Priority] = mapped_column(Enum(Priority), default=Priority.Medium)
    case_status: Mapped[CaseStatus] = mapped_column(Enum(CaseStatus), default=CaseStatus.Open)
    opened_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(DateTime)
    
    report: Mapped["FraudReport"] = relationship(back_populates="case")
    officer: Mapped["Officer"] = relationship(back_populates="cases")
    status_logs: Mapped[list["StatusLog"]] = relationship(back_populates="case")
    comments: Mapped[list["Comment"]] = relationship(back_populates="case")

class Evidence(Base):
    __tablename__ = "evidence"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("fraud_reports.id", ondelete="CASCADE"))
    file_path: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    report: Mapped["FraudReport"] = relationship(back_populates="evidence")

class StatusLog(Base):
    __tablename__ = "status_logs"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"))
    old_status: Mapped[str | None] = mapped_column(String(50))
    new_status: Mapped[str] = mapped_column(String(50), nullable=False)
    changed_by: Mapped[str] = mapped_column(String(100), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    case: Mapped["Case"] = relationship(back_populates="status_logs")

class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    user: Mapped["User"] = relationship(back_populates="notifications")

class Comment(Base):
    __tablename__ = "comments"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    officer_id: Mapped[int | None] = mapped_column(ForeignKey("officers.id", ondelete="SET NULL"))
    comment_text: Mapped[str] = mapped_column(Text, nullable=False)
    commented_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    case: Mapped["Case"] = relationship(back_populates="comments")
