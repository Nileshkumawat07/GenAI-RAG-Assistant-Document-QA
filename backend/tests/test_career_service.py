from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.core.database import Base
from app.models.user import User
from app.services.career_service import CareerService


def build_session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)()


def build_user(user_id: str, email: str, username: str, full_name: str, *, is_management: bool = False) -> User:
    return User(
        id=user_id,
        full_name=full_name,
        username=username,
        date_of_birth=date(2000, 1, 1),
        gender="Other",
        email=email,
        alternate_email=None,
        mobile=f"+910000000{user_id[-1]}",
        security_question="Question",
        security_answer="Answer",
        referral_code=None,
        public_user_code=f"U{user_id[-5:]}",
        password_hash="hashed",
        email_verified=True,
        mobile_verified=True,
        is_management=is_management,
    )


def test_withdrawn_application_is_hidden_from_management_overview_and_counts():
    db = build_session()
    db.add_all(
        [
            build_user("user-1", "candidate@example.com", "candidate", "Candidate One"),
            build_user("user-2", "manager@example.com", "manager", "Manager One", is_management=True),
        ]
    )
    db.commit()
    service = CareerService()

    opening = service.create_opening(
        db,
        acting_user_id="user-2",
        payload={
            "title": "Frontend Engineer",
            "department": "Engineering",
            "location": "Jaipur, India",
            "workMode": "Hybrid",
            "employmentType": "Full-time",
            "experienceLevel": "Mid Level",
            "salaryRange": "10-12 LPA",
            "summary": "Build polished UI experiences.",
            "responsibilities": ["Ship frontend features"],
            "requirements": ["React"],
            "perks": ["Health insurance"],
            "skills": ["JavaScript"],
            "seatsOpen": 1,
            "isPublished": True,
            "isFeatured": False,
        },
    )

    application = service.create_application(
        db,
        user_id="user-1",
        opening_id=opening["id"],
        full_name="Candidate One",
        email="candidate@example.com",
        mobile="+9100000001",
    )

    overview_before = service.get_management_overview(db)
    withdrawn = service.withdraw_application(db, user_id="user-1", application_id=application["id"])
    overview_after = service.get_management_overview(db)
    public_openings = service.list_public_openings(db)

    assert overview_before["summary"]["totalApplications"] == 1
    assert len(overview_before["applications"]) == 1
    assert withdrawn["status"] == "Withdrawn"
    assert overview_after["summary"]["totalApplications"] == 0
    assert overview_after["applications"] == []
    assert public_openings[0]["totalApplications"] == 0
