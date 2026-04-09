from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.core.database import Base
from app.models.user import User
from app.services.auth_service import AuthService
from app.services.chat_management_service import ChatManagementService


def build_session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)()


def build_user(user_id: str, email: str, username: str, full_name: str) -> User:
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
    )


def test_friend_request_acceptance_creates_bidirectional_friendship():
    db = build_session()
    db.add_all(
        [
            build_user("user-1", "one@example.com", "userone", "User One"),
            build_user("user-2", "two@example.com", "usertwo", "User Two"),
        ]
    )
    db.commit()
    service = ChatManagementService(AuthService())

    request = service.send_friend_request(db, current_user_id="user-1", receiver_user_id="user-2")
    accepted = service.accept_friend_request(db, current_user_id="user-2", request_id=request["id"])
    overview = service.get_overview(db, current_user_id="user-1")

    assert accepted["accepted"] is True
    assert len(overview["friends"]) == 1
    assert overview["friends"][0]["relationshipState"] == "friends"


def test_message_read_and_delete_flow():
    db = build_session()
    db.add_all(
        [
            build_user("user-1", "one@example.com", "userone", "User One"),
            build_user("user-2", "two@example.com", "usertwo", "User Two"),
        ]
    )
    db.commit()
    service = ChatManagementService(AuthService())

    request = service.send_friend_request(db, current_user_id="user-1", receiver_user_id="user-2")
    service.accept_friend_request(db, current_user_id="user-2", request_id=request["id"])

    message = service.send_text_message(
        db,
        current_user_id="user-1",
        receiver_user_id="user-2",
        body="Hello there",
        reply_to_message_id=None,
    )
    read_result = service.mark_conversation_read(db, current_user_id="user-2", friend_user_id="user-1")
    messages_for_receiver = service.get_messages(db, current_user_id="user-2", friend_user_id="user-1")
    delete_result = service.delete_message(db, current_user_id="user-1", message_id=message["id"], scope="everyone")
    messages_after_delete = service.get_messages(db, current_user_id="user-2", friend_user_id="user-1")

    assert message["status"] == "sent"
    assert read_result["updatedIds"] == [message["id"]]
    assert messages_for_receiver[0]["status"] == "read"
    assert delete_result["deletedForEveryone"] is True
    assert messages_after_delete[0]["deletedForEveryone"] is True
