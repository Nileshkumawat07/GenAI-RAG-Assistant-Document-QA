from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.core.database import Base
from app.models.user import User
from app.services.workspace_hub_service import WorkspaceHubService


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


def test_dashboard_bootstrap_creates_defaults():
    db = build_session()
    db.add(build_user("user-1", "one@example.com", "userone", "User One"))
    db.commit()
    service = WorkspaceHubService()

    dashboard = service.get_dashboard(db, user_id="user-1")

    assert dashboard["unreadNotifications"] >= 1
    assert dashboard["activeTeams"] == 1
    assert dashboard["activeChats"] == 1
    assert any(item["label"] == "Saved Chats" for item in dashboard["metrics"])


def test_chat_thread_and_message_flow():
    db = build_session()
    db.add(build_user("user-1", "one@example.com", "userone", "User One"))
    db.commit()
    service = WorkspaceHubService()
    service.ensure_user_bootstrap(db, user_id="user-1")

    thread = service.create_thread(db, user_id="user-1", title="Project notes", opening_message="Initial prompt")
    message = service.add_thread_message(
        db,
        user_id="user-1",
        thread_id=thread["id"],
        role="assistant",
        content="Saved answer",
    )
    messages = service.list_thread_messages(db, user_id="user-1", thread_id=thread["id"])

    assert thread["title"] == "Project notes"
    assert message["role"] == "assistant"
    assert len(messages) == 2
    assert messages[-1]["content"] == "Saved answer"
    refreshed_threads = service.list_threads(db, user_id="user-1")
    assert refreshed_threads[0]["assistantMessageCount"] >= 1
    assert refreshed_threads[0]["userMessageCount"] >= 1
    assert refreshed_threads[0]["lastMessageRole"] == "assistant"


def test_team_management_adds_member_and_updates_state():
    db = build_session()
    db.add_all(
        [
            build_user("user-1", "one@example.com", "userone", "User One"),
            build_user("user-2", "two@example.com", "usertwo", "User Two"),
        ]
    )
    db.commit()
    service = WorkspaceHubService()
    service.ensure_user_bootstrap(db, user_id="user-1")

    team = service.create_team(db, user_id="user-1", name="Delivery Team", description="Shared workspace")
    updated_team = service.add_team_member(
        db,
        actor_user_id="user-1",
        team_id=team["id"],
        target_user_id="user-2",
        role="member",
    )

    assert updated_team["memberCount"] == 2
    assert any(item["userId"] == "user-2" for item in updated_team["members"])

    added_member = next(item for item in updated_team["members"] if item["userId"] == "user-2")
    updated_again = service.update_team_member(
        db,
        actor_user_id="user-1",
        team_id=team["id"],
        membership_id=added_member["id"],
        role="admin",
        status="active",
    )

    changed_member = next(item for item in updated_again["members"] if item["userId"] == "user-2")
    assert changed_member["role"] == "admin"
    assert updated_again["activeMemberCount"] == 2
    assert updated_again["adminCount"] == 2


def test_thread_delete_and_member_remove_flow():
    db = build_session()
    db.add_all(
        [
            build_user("user-1", "one@example.com", "userone", "User One"),
            build_user("user-2", "two@example.com", "usertwo", "User Two"),
        ]
    )
    db.commit()
    service = WorkspaceHubService()
    service.ensure_user_bootstrap(db, user_id="user-1")

    thread = service.create_thread(db, user_id="user-1", title="Temporary thread", opening_message="Draft")
    deleted = service.delete_thread(db, user_id="user-1", thread_id=thread["id"])
    threads_after_delete = service.list_threads(db, user_id="user-1")

    team = service.create_team(db, user_id="user-1", name="Ops Team", description="Operations")
    updated_team = service.add_team_member(
        db,
        actor_user_id="user-1",
        team_id=team["id"],
        target_user_id="user-2",
        role="member",
    )
    removable_member = next(item for item in updated_team["members"] if item["userId"] == "user-2")
    removed_team = service.remove_team_member(
        db,
        actor_user_id="user-1",
        team_id=team["id"],
        membership_id=removable_member["id"],
    )

    assert deleted["deletedId"] == thread["id"]
    assert all(item["id"] != thread["id"] for item in threads_after_delete)
    assert removed_team["memberCount"] == 1
    assert all(item["userId"] != "user-2" for item in removed_team["members"])
