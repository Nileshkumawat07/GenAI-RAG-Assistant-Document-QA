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


def test_search_chat_and_message_context_for_direct_conversation():
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

    first = service.send_text_message(
        db,
        current_user_id="user-1",
        receiver_user_id="user-2",
        body="Alpha kickoff",
        reply_to_message_id=None,
    )
    service.send_text_message(
        db,
        current_user_id="user-2",
        receiver_user_id="user-1",
        body="Replying to alpha",
        reply_to_message_id=first["id"],
    )

    search_result = service.search_chat(db, current_user_id="user-1", query="alpha")
    context = service.get_message_context(
        db,
        current_user_id="user-1",
        conversation_type="direct",
        conversation_id="user-2",
        message_id=first["id"],
    )

    assert search_result["messages"][0]["conversationType"] == "direct"
    assert search_result["messages"][0]["conversationId"] == "user-2"
    assert context["focusMessageId"] == first["id"]
    assert any(item["id"] == first["id"] for item in context["items"])


def test_remove_friend_deletes_direct_relationship_and_messages():
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
    service.send_text_message(
        db,
        current_user_id="user-1",
        receiver_user_id="user-2",
        body="This chat will be removed",
        reply_to_message_id=None,
    )

    removed = service.remove_friend(db, current_user_id="user-1", friend_user_id="user-2")
    overview = service.get_overview(db, current_user_id="user-1")

    assert removed["removed"] is True
    assert removed["friendUserId"] == "user-2"
    assert removed["deletedMessageCount"] == 1
    assert overview["friends"] == []
    assert overview["directChats"] == []


def test_cancel_friend_request_removes_pending_request_for_both_sides():
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
    canceled = service.cancel_friend_request(db, current_user_id="user-1", request_id=request["id"])
    sender_overview = service.get_overview(db, current_user_id="user-1")
    receiver_overview = service.get_overview(db, current_user_id="user-2")

    assert canceled["canceled"] is True
    assert canceled["receiverUserId"] == "user-2"
    assert sender_overview["sentRequests"] == []
    assert receiver_overview["receivedRequests"] == []


def test_delete_community_removes_it_for_creator():
    db = build_session()
    db.add(build_user("user-1", "one@example.com", "userone", "User One"))
    db.commit()
    service = ChatManagementService(AuthService())

    community = service.create_community(
        db,
        current_user_id="user-1",
        name="Alpha Community",
        description="A removable community",
        image_file=None,
    )

    deleted = service.delete_community(
        db,
        current_user_id="user-1",
        community_id=community["id"],
    )
    overview = service.get_overview(db, current_user_id="user-1")

    assert deleted["deleted"] is True
    assert deleted["communityId"] == community["id"]
    assert overview["communities"] == []
