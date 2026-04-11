from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.api.routes.chat_management import build_chat_management_router
from app.core.database import Base, get_db
from app.models.user import User
from app.services.auth_service import AuthService
from app.services.chat_management_service import ChatManagementService

from backend.tests.test_chat_management_service import build_user


def build_session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)()


def test_direct_message_route_accepts_conversation_id_without_receiver_id():
    db = build_session()
    db.add_all(
        [
            build_user("user-1", "one@example.com", "userone", "User One"),
            build_user("user-2", "two@example.com", "usertwo", "User Two"),
        ]
    )
    db.commit()

    auth_service = AuthService()
    chat_service = ChatManagementService(auth_service)
    request = chat_service.send_friend_request(db, current_user_id="user-1", receiver_user_id="user-2")
    chat_service.accept_friend_request(db, current_user_id="user-2", request_id=request["id"])

    app = FastAPI()
    app.include_router(build_chat_management_router(chat_service))

    def override_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_db
    client = TestClient(app)
    token = auth_service.create_access_token(user_id="user-1")

    response = client.post(
        "/chat/messages",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "conversationType": "direct",
            "conversationId": "user-2",
            "body": "Hello from API",
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["conversationType"] == "direct"
    assert payload["conversationId"] == "user-2"
    assert payload["body"] == "Hello from API"


def test_remove_friend_route_deletes_direct_chat_and_friendship():
    db = build_session()
    db.add_all(
        [
            build_user("user-1", "one@example.com", "userone", "User One"),
            build_user("user-2", "two@example.com", "usertwo", "User Two"),
        ]
    )
    db.commit()

    auth_service = AuthService()
    chat_service = ChatManagementService(auth_service)
    request = chat_service.send_friend_request(db, current_user_id="user-1", receiver_user_id="user-2")
    chat_service.accept_friend_request(db, current_user_id="user-2", request_id=request["id"])
    chat_service.send_text_message(
        db,
        current_user_id="user-1",
        receiver_user_id="user-2",
        body="Delete this chat",
        reply_to_message_id=None,
    )

    app = FastAPI()
    app.include_router(build_chat_management_router(chat_service))

    def override_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_db
    client = TestClient(app)
    token = auth_service.create_access_token(user_id="user-1")

    response = client.delete(
        "/chat/friends/user-2",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["removed"] is True
    assert payload["friendUserId"] == "user-2"
    overview = chat_service.get_overview(db, current_user_id="user-1")
    assert overview["friends"] == []
    assert overview["directChats"] == []
