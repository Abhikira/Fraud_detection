import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import auth as security_auth
import models
from database import Base, SessionLocal, engine
from routers import auth, reports, cases, admin
from upload_storage import UPLOAD_DIR

load_dotenv()

@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD")

    if bool(admin_email) != bool(admin_password):
        raise RuntimeError("Set both ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env")

    with SessionLocal() as db:
        existing_categories = {
            category.name for category in db.query(models.FraudCategory.name).all()
        }
        default_categories = [
            ("Phishing", "Email or SMS scams"),
            ("Credit Card Fraud", "Unauthorized card usage"),
            ("Identity Theft", "Stolen personal information"),
        ]
        db.add_all(
            models.FraudCategory(name=name, description=description)
            for name, description in default_categories
            if name not in existing_categories
        )

        if admin_email and admin_password:
            if db.query(models.User.id).filter_by(email=admin_email).first():
                raise RuntimeError(
                    "ADMIN_EMAIL is already used by a citizen account; choose a different admin email"
                )

            admin = (
                db.query(models.Officer)
                .filter_by(email=admin_email)
                .first()
            )
            if admin is None:
                admin = models.Officer(
                    full_name="System Administrator",
                    email=admin_email,
                    password_hash=security_auth.get_password_hash(admin_password),
                    role=models.UserRole.admin,
                )
                db.add(admin)
            else:
                admin.password_hash = security_auth.get_password_hash(admin_password)
                admin.role = models.UserRole.admin

        officer_configs = [
            (
                "Gourav",
                os.getenv("GOURAV_EMAIL"),
                os.getenv("GOURAV_PASSWORD"),
            ),
            (
                "Ujjwal",
                os.getenv("UJJWAL_EMAIL"),
                os.getenv("UJJWAL_PASSWORD"),
            ),
        ]
        configured_emails = [
            email for _, email, _ in officer_configs if email
        ]
        if len(configured_emails) != len(set(configured_emails)):
            raise RuntimeError("Each provisioned officer must have a unique email address")

        for full_name, email, password in officer_configs:
            if bool(email) != bool(password):
                raise RuntimeError(
                    f"Set both the email and password for officer {full_name} in backend/.env"
                )
            if not email:
                continue
            if email == admin_email or db.query(models.User.id).filter_by(email=email).first():
                raise RuntimeError(
                    f"Officer email {email} is already used by another account"
                )

            officer = db.query(models.Officer).filter_by(email=email).first()
            if officer is None:
                db.add(
                    models.Officer(
                        full_name=full_name,
                        email=email,
                        password_hash=security_auth.get_password_hash(password),
                        role=models.UserRole.officer,
                    )
                )
            elif officer.role != models.UserRole.officer:
                raise RuntimeError(
                    f"Officer email {email} belongs to an account with a different role"
                )

        db.commit()
    yield

app = FastAPI(title="Fraud Management System API", version="1.0.0", lifespan=lifespan)

origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(reports.router)
app.include_router(cases.router)
app.include_router(admin.router)

@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok"}
