from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.contact_request import ContactRequest
from app.models.subscription_transaction import SubscriptionTransaction
from app.models.team_member import TeamMember
from app.models.team_workspace import TeamWorkspace
from app.models.user import User
from app.models.workspace_chat_message import WorkspaceChatMessage
from app.models.workspace_chat_thread import WorkspaceChatThread
from app.models.workspace_notification import WorkspaceNotification


class WorkspaceHubServiceError(RuntimeError):
    """Raised when a workspace hub action fails for an expected reason."""


class WorkspaceHubService:
    def ensure_user_bootstrap(self, db: Session, *, user_id: str) -> None:
        user = self._require_user(db, user_id)
        personal_team = db.execute(
            select(TeamWorkspace)
            .where(
                TeamWorkspace.owner_user_id == user_id,
                TeamWorkspace.is_personal.is_(True),
            )
            .order_by(TeamWorkspace.created_at.asc(), TeamWorkspace.id.asc())
        ).scalars().first()
        if not personal_team:
            personal_team = TeamWorkspace(
                id=str(uuid.uuid4()),
                owner_user_id=user_id,
                name=self._personal_workspace_name(user),
                description="Personal workspace for saved activity and collaboration setup.",
                is_personal=True,
            )
            db.add(personal_team)
            db.flush()
            db.add(
                TeamMember(
                    id=str(uuid.uuid4()),
                    team_id=personal_team.id,
                    user_id=user_id,
                    role="owner",
                    status="active",
                    joined_at=datetime.now(timezone.utc),
                )
            )

        existing_notifications = db.execute(
            select(WorkspaceNotification.id).where(WorkspaceNotification.user_id == user_id).limit(1)
        ).first()
        if not existing_notifications:
            now = datetime.now(timezone.utc)
            db.add_all(
                [
                    WorkspaceNotification(
                        id=str(uuid.uuid4()),
                        user_id=user_id,
                        category="welcome",
                        title="Workspace ready",
                        message="Your dashboard, notifications, analytics, team tools, and chat history are now enabled.",
                        action_url="#/workspace",
                        created_at=now,
                    ),
                    WorkspaceNotification(
                        id=str(uuid.uuid4()),
                        user_id=user_id,
                        category="product",
                        title="Build your first team",
                        message="Create a shared workspace and invite collaborators from the new Team Management tab.",
                        action_url="#/workspace",
                        created_at=now,
                    ),
                ]
            )

        existing_thread = db.execute(
            select(WorkspaceChatThread.id).where(WorkspaceChatThread.user_id == user_id).limit(1)
        ).first()
        if not existing_thread:
            thread = WorkspaceChatThread(
                id=str(uuid.uuid4()),
                user_id=user_id,
                title="Getting started notes",
                last_message_preview="Use this space to save prompts, answers, and follow-up notes.",
                last_message_at=datetime.now(timezone.utc),
            )
            db.add(thread)
            db.flush()
            db.add_all(
                [
                    WorkspaceChatMessage(
                        id=str(uuid.uuid4()),
                        thread_id=thread.id,
                        user_id=user_id,
                        role="system",
                        content="Use this space to save prompts, answers, and follow-up notes.",
                    ),
                    WorkspaceChatMessage(
                        id=str(uuid.uuid4()),
                        thread_id=thread.id,
                        user_id=user_id,
                        role="assistant",
                        content="Your workspace history is ready. Add notes here any time.",
                    ),
                ]
            )

        db.commit()

    def get_dashboard(self, db: Session, *, user_id: str) -> dict:
        self.ensure_user_bootstrap(db, user_id=user_id)
        notifications = self._user_notifications(db, user_id)
        threads = self._user_threads(db, user_id)
        teams = self._user_teams(db, user_id)
        requests = db.execute(select(ContactRequest).where(ContactRequest.user_id == user_id)).scalars().all()
        transactions = db.execute(
            select(SubscriptionTransaction).where(SubscriptionTransaction.user_id == user_id)
        ).scalars().all()

        recent_activity = []
        for item in notifications[:3]:
            recent_activity.append(
                {
                    "id": item.id,
                    "title": item.title,
                    "detail": item.message,
                    "category": item.category,
                    "createdAt": self._serialize_datetime(item.created_at),
                    "tone": "success" if item.is_read else "info",
                }
            )
        for thread in threads[:2]:
            recent_activity.append(
                {
                    "id": thread.id,
                    "title": f"Chat thread: {thread.title}",
                    "detail": thread.last_message_preview or "Recent workspace note saved.",
                    "category": "chat",
                    "createdAt": self._serialize_datetime(thread.last_message_at or thread.updated_at),
                    "tone": "info",
                }
            )
        for team in teams[:2]:
            recent_activity.append(
                {
                    "id": team.id,
                    "title": f"Team workspace: {team.name}",
                    "detail": team.description or "Shared workspace available for collaboration.",
                    "category": "team",
                    "createdAt": self._serialize_datetime(team.updated_at or team.created_at),
                    "tone": "success" if not team.is_personal else "info",
                }
            )
        for request in requests[:2]:
            recent_activity.append(
                {
                    "id": request.id,
                    "title": f"Support request: {request.title}",
                    "detail": f"{request.category} | {request.status}",
                    "category": "support",
                    "createdAt": self._serialize_datetime(request.created_at),
                    "tone": "warning" if request.status.lower() not in {"completed", "resolved", "closed"} else "success",
                }
            )
        for transaction in transactions[:2]:
            recent_activity.append(
                {
                    "id": transaction.id,
                    "title": f"Payment: {transaction.plan_name}",
                    "detail": f"{transaction.currency} {transaction.amount / 100:.2f} | {transaction.status}",
                    "category": "payment",
                    "createdAt": self._serialize_datetime(transaction.created_at),
                    "tone": "success" if transaction.status.lower() == "verified" else "info",
                }
            )
        recent_activity = sorted(recent_activity, key=lambda item: item["createdAt"] or "", reverse=True)[:5]
        unread_notifications = len([item for item in notifications if not item.is_read])
        personal_teams = len([team for team in teams if team.is_personal])
        shared_teams = max(len(teams) - personal_teams, 0)
        active_support = len([item for item in requests if item.status.lower() not in {"completed", "resolved", "closed"}])
        verified_payments = len([item for item in transactions if item.status.lower() == "verified"])

        return {
            "metrics": [
                {
                    "label": "Unread Notifications",
                    "value": str(unread_notifications),
                    "hint": "Alerts waiting for your attention",
                },
                {
                    "label": "Saved Chats",
                    "value": str(len(threads)),
                    "hint": "Conversation threads stored in your workspace",
                },
                {
                    "label": "Teams",
                    "value": str(len(teams)),
                    "hint": "Personal and shared workspaces you can access",
                },
                {
                    "label": "Support Requests",
                    "value": str(len(requests)),
                    "hint": "Tracked contact and support conversations",
                },
                {
                    "label": "Payments Logged",
                    "value": str(len(transactions)),
                    "hint": "Subscription transactions on your account",
                },
            ],
            "recentActivity": recent_activity,
            "activityInsights": [
                {
                    "label": "Shared Workspaces",
                    "value": str(shared_teams),
                    "detail": "Team spaces shared with collaborators",
                },
                {
                    "label": "Personal Workspaces",
                    "value": str(personal_teams),
                    "detail": "Private spaces reserved for your own activity",
                },
                {
                    "label": "Open Support",
                    "value": str(active_support),
                    "detail": "Requests still awaiting a final outcome",
                },
                {
                    "label": "Verified Payments",
                    "value": str(verified_payments),
                    "detail": "Successful subscription payments recorded",
                },
            ],
            "recentChats": [self._serialize_dashboard_chat(db, item) for item in threads[:4]],
            "activeTeamsList": [self._serialize_dashboard_team(db, item) for item in teams[:4]],
            "supportRequestsList": [
                {
                    "id": item.id,
                    "title": item.title,
                    "detail": item.category,
                    "meta": item.status,
                    "createdAt": self._serialize_datetime(item.created_at),
                }
                for item in requests[:4]
            ],
            "paymentHistory": [
                {
                    "id": item.id,
                    "title": item.plan_name,
                    "detail": f"{item.currency} {item.amount / 100:.2f}",
                    "meta": item.status,
                    "createdAt": self._serialize_datetime(item.created_at),
                }
                for item in transactions[:4]
            ],
            "unreadNotifications": unread_notifications,
            "activeTeams": len(teams),
            "activeChats": len(threads),
        }

    def list_notifications(self, db: Session, *, user_id: str) -> list[dict]:
        self.ensure_user_bootstrap(db, user_id=user_id)
        return [self.serialize_notification(item) for item in self._user_notifications(db, user_id)]

    def mark_notification_read(self, db: Session, *, user_id: str, notification_id: str) -> dict:
        notification = db.execute(
            select(WorkspaceNotification).where(
                WorkspaceNotification.id == notification_id,
                WorkspaceNotification.user_id == user_id,
            )
        ).scalar_one_or_none()
        if not notification:
            raise WorkspaceHubServiceError("Notification was not found.")
        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)
        return self.serialize_notification(notification)

    def mark_all_notifications_read(self, db: Session, *, user_id: str) -> dict:
        notifications = self._user_notifications(db, user_id)
        now = datetime.now(timezone.utc)
        changed = 0
        for notification in notifications:
            if notification.is_read:
                continue
            notification.is_read = True
            notification.read_at = now
            changed += 1
        db.commit()
        return {"updatedCount": changed}

    def get_analytics(self, db: Session, *, user_id: str) -> dict:
        self.ensure_user_bootstrap(db, user_id=user_id)
        notifications = self._user_notifications(db, user_id)
        teams = self._user_teams(db, user_id)
        threads = self._user_threads(db, user_id)
        messages = db.execute(
            select(WorkspaceChatMessage).where(WorkspaceChatMessage.user_id == user_id)
        ).scalars().all()
        requests = db.execute(select(ContactRequest).where(ContactRequest.user_id == user_id)).scalars().all()
        transactions = db.execute(
            select(SubscriptionTransaction).where(SubscriptionTransaction.user_id == user_id)
        ).scalars().all()
        chat_points = self._build_daily_counts(
            [
                item.created_at
                for item in messages
            ],
            days=7,
        )
        notification_points = self._build_daily_counts([item.created_at for item in notifications], days=7)
        team_distribution = []
        for team in teams:
            member_count = db.execute(
                select(func.count()).select_from(TeamMember).where(TeamMember.team_id == team.id)
            ).scalar_one()
            team_distribution.append({"label": team.name, "value": member_count})
        team_memberships = db.execute(
            select(TeamMember).where(TeamMember.user_id == user_id)
        ).scalars().all()

        return {
            "headline": {
                "chatThreads": len(threads),
                "messagesSaved": len(messages),
                "notificationsReceived": len(notifications),
                "teamsAvailable": len(teams),
                "supportRequests": len(requests),
                "paymentsLogged": len(transactions),
            },
            "chatActivity": chat_points,
            "notificationActivity": notification_points,
            "teamDistribution": team_distribution,
            "activityMix": [
                {"label": "Threads", "value": len(threads), "hint": "Saved chat containers"},
                {"label": "Messages", "value": len(messages), "hint": "Messages stored across threads"},
                {"label": "Notifications", "value": len(notifications), "hint": "Alerts and reminders generated"},
                {"label": "Teams", "value": len(teams), "hint": "Personal and shared workspaces"},
                {"label": "Support", "value": len(requests), "hint": "Tracked contact requests"},
                {"label": "Payments", "value": len(transactions), "hint": "Billing and subscription records"},
            ],
            "teamRoleDistribution": self._build_breakdown(
                [item.role for item in team_memberships],
                hints={
                    "owner": "Primary owner access",
                    "admin": "Can manage members and updates",
                    "member": "Standard collaborator access",
                },
            ),
            "notificationCategoryBreakdown": self._build_breakdown(
                [item.category for item in notifications],
                hints={
                    "welcome": "Workspace onboarding alerts",
                    "product": "Product guidance and prompts",
                    "chat": "Saved conversation events",
                    "team": "Team and membership events",
                },
            ),
            "supportStatusBreakdown": self._build_breakdown([item.status for item in requests], hints={}),
            "paymentStatusBreakdown": self._build_breakdown([item.status for item in transactions], hints={}),
            "weeklyTimeline": self._build_weekly_timeline(
                messages=messages,
                notifications=notifications,
                teams=teams,
                requests=requests,
                transactions=transactions,
                days=7,
            ),
        }

    def list_threads(self, db: Session, *, user_id: str) -> list[dict]:
        self.ensure_user_bootstrap(db, user_id=user_id)
        return [self.serialize_thread(db, item) for item in self._user_threads(db, user_id)]

    def create_thread(self, db: Session, *, user_id: str, title: str, opening_message: str | None = None) -> dict:
        self.ensure_user_bootstrap(db, user_id=user_id)
        cleaned_title = (title or "").strip()
        if len(cleaned_title) < 3:
            raise WorkspaceHubServiceError("Thread title must be at least 3 characters.")

        now = datetime.now(timezone.utc)
        thread = WorkspaceChatThread(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title=cleaned_title,
            last_message_preview=(opening_message or "").strip()[:240] or None,
            last_message_at=now if opening_message and opening_message.strip() else None,
            created_at=now,
            updated_at=now,
        )
        db.add(thread)
        db.flush()
        if opening_message and opening_message.strip():
            db.add(
                WorkspaceChatMessage(
                    id=str(uuid.uuid4()),
                    thread_id=thread.id,
                    user_id=user_id,
                    role="user",
                    content=opening_message.strip(),
                    created_at=now,
                )
            )
        db.add(
            WorkspaceNotification(
                id=str(uuid.uuid4()),
                user_id=user_id,
                category="chat",
                title="Chat thread saved",
                message=f"Your thread '{cleaned_title}' was added to workspace history.",
                action_url="#/workspace",
                created_at=now,
            )
        )
        db.commit()
        db.refresh(thread)
        return self.serialize_thread(db, thread)

    def list_thread_messages(self, db: Session, *, user_id: str, thread_id: str) -> list[dict]:
        thread = self._require_thread(db, user_id=user_id, thread_id=thread_id)
        messages = db.execute(
            select(WorkspaceChatMessage)
            .where(WorkspaceChatMessage.thread_id == thread.id)
            .order_by(WorkspaceChatMessage.created_at.asc())
        ).scalars().all()
        return [self.serialize_message(item) for item in messages]

    def add_thread_message(self, db: Session, *, user_id: str, thread_id: str, role: str, content: str) -> dict:
        thread = self._require_thread(db, user_id=user_id, thread_id=thread_id)
        cleaned_content = (content or "").strip()
        cleaned_role = (role or "user").strip().lower()
        if not cleaned_content:
            raise WorkspaceHubServiceError("Message content is required.")
        if cleaned_role not in {"user", "assistant", "system"}:
            raise WorkspaceHubServiceError("Unsupported message role.")

        now = datetime.now(timezone.utc)
        message = WorkspaceChatMessage(
            id=str(uuid.uuid4()),
            thread_id=thread.id,
            user_id=user_id,
            role=cleaned_role,
            content=cleaned_content,
            created_at=now,
        )
        thread.last_message_preview = cleaned_content[:240]
        thread.last_message_at = now
        thread.updated_at = now
        db.add(message)
        db.commit()
        db.refresh(message)
        return self.serialize_message(message)

    def list_teams(self, db: Session, *, user_id: str) -> list[dict]:
        self.ensure_user_bootstrap(db, user_id=user_id)
        teams = self._user_teams(db, user_id)
        return [self.serialize_team(db, item) for item in teams]

    def list_workspace_users(self, db: Session, *, user_id: str) -> list[dict]:
        self.ensure_user_bootstrap(db, user_id=user_id)
        users = db.execute(select(User).order_by(User.full_name.asc())).scalars().all()
        return [
            {
                "id": item.id,
                "fullName": item.full_name,
                "email": item.email,
            }
            for item in users
            if not item.archived_at
        ]

    def create_team(self, db: Session, *, user_id: str, name: str, description: str | None) -> dict:
        self.ensure_user_bootstrap(db, user_id=user_id)
        cleaned_name = (name or "").strip()
        if len(cleaned_name) < 3:
            raise WorkspaceHubServiceError("Team name must be at least 3 characters.")

        now = datetime.now(timezone.utc)
        team = TeamWorkspace(
            id=str(uuid.uuid4()),
            owner_user_id=user_id,
            name=cleaned_name,
            description=(description or "").strip() or None,
            is_personal=False,
            created_at=now,
            updated_at=now,
        )
        db.add(team)
        db.flush()
        db.add(
            TeamMember(
                id=str(uuid.uuid4()),
                team_id=team.id,
                user_id=user_id,
                role="owner",
                status="active",
                joined_at=now,
                created_at=now,
            )
        )
        db.add(
            WorkspaceNotification(
                id=str(uuid.uuid4()),
                user_id=user_id,
                category="team",
                title="Team created",
                message=f"Your shared workspace '{cleaned_name}' is ready.",
                action_url="#/workspace",
                created_at=now,
            )
        )
        db.commit()
        db.refresh(team)
        return self.serialize_team(db, team)

    def add_team_member(self, db: Session, *, actor_user_id: str, team_id: str, target_user_id: str, role: str) -> dict:
        team = self._require_team_owner_access(db, actor_user_id=actor_user_id, team_id=team_id)
        self._require_user(db, target_user_id)
        existing = db.execute(
            select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.user_id == target_user_id)
        ).scalar_one_or_none()
        if existing:
            raise WorkspaceHubServiceError("That user is already a team member.")
        now = datetime.now(timezone.utc)
        member = TeamMember(
            id=str(uuid.uuid4()),
            team_id=team.id,
            user_id=target_user_id,
            role=(role or "member").strip().lower() or "member",
            status="active",
            invited_by_user_id=actor_user_id,
            created_at=now,
            joined_at=now,
        )
        db.add(member)
        db.add(
            WorkspaceNotification(
                id=str(uuid.uuid4()),
                user_id=target_user_id,
                category="team",
                title=f"Added to {team.name}",
                message="A shared workspace is now available in your Team Management panel.",
                action_url="#/workspace",
                created_at=now,
            )
        )
        team.updated_at = now
        db.commit()
        db.refresh(team)
        return self.serialize_team(db, team)

    def update_team_member(
        self,
        db: Session,
        *,
        actor_user_id: str,
        team_id: str,
        membership_id: str,
        role: str | None,
        status: str | None,
    ) -> dict:
        team = self._require_team_owner_access(db, actor_user_id=actor_user_id, team_id=team_id)
        member = db.execute(
            select(TeamMember).where(TeamMember.id == membership_id, TeamMember.team_id == team.id)
        ).scalar_one_or_none()
        if not member:
            raise WorkspaceHubServiceError("Team member was not found.")
        if role is not None:
            member.role = role.strip().lower()
        if status is not None:
            member.status = status.strip().lower()
        team.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(team)
        return self.serialize_team(db, team)

    def serialize_notification(self, item: WorkspaceNotification) -> dict:
        return {
            "id": item.id,
            "category": item.category,
            "title": item.title,
            "message": item.message,
            "actionUrl": item.action_url,
            "isRead": bool(item.is_read),
            "createdAt": self._serialize_datetime(item.created_at),
            "readAt": self._serialize_datetime(item.read_at),
        }

    def serialize_thread(self, db: Session, item: WorkspaceChatThread) -> dict:
        message_count = db.execute(
            select(func.count()).select_from(WorkspaceChatMessage).where(WorkspaceChatMessage.thread_id == item.id)
        ).scalar_one()
        return {
            "id": item.id,
            "title": item.title,
            "lastMessagePreview": item.last_message_preview,
            "createdAt": self._serialize_datetime(item.created_at),
            "updatedAt": self._serialize_datetime(item.updated_at),
            "lastMessageAt": self._serialize_datetime(item.last_message_at),
            "messageCount": message_count,
        }

    def serialize_message(self, item: WorkspaceChatMessage) -> dict:
        return {
            "id": item.id,
            "role": item.role,
            "content": item.content,
            "createdAt": self._serialize_datetime(item.created_at),
        }

    def serialize_team(self, db: Session, item: TeamWorkspace) -> dict:
        members = db.execute(
            select(TeamMember, User)
            .join(User, User.id == TeamMember.user_id)
            .where(TeamMember.team_id == item.id)
            .order_by(TeamMember.created_at.asc())
        ).all()
        serialized_members = [
            {
                "id": member.id,
                "userId": user.id,
                "role": member.role,
                "status": member.status,
                "joinedAt": self._serialize_datetime(member.joined_at),
                "createdAt": self._serialize_datetime(member.created_at),
                "userName": user.full_name,
                "userEmail": user.email,
            }
            for member, user in members
        ]
        return {
            "id": item.id,
            "name": item.name,
            "description": item.description,
            "isPersonal": bool(item.is_personal),
            "createdAt": self._serialize_datetime(item.created_at),
            "updatedAt": self._serialize_datetime(item.updated_at),
            "ownerUserId": item.owner_user_id,
            "memberCount": len(serialized_members),
            "members": serialized_members,
        }

    def _user_notifications(self, db: Session, user_id: str) -> list[WorkspaceNotification]:
        return db.execute(
            select(WorkspaceNotification)
            .where(WorkspaceNotification.user_id == user_id)
            .order_by(WorkspaceNotification.created_at.desc())
        ).scalars().all()

    def _user_threads(self, db: Session, user_id: str) -> list[WorkspaceChatThread]:
        return db.execute(
            select(WorkspaceChatThread)
            .where(WorkspaceChatThread.user_id == user_id)
            .order_by(WorkspaceChatThread.updated_at.desc())
        ).scalars().all()

    def _user_teams(self, db: Session, user_id: str) -> list[TeamWorkspace]:
        return db.execute(
            select(TeamWorkspace)
            .join(TeamMember, TeamMember.team_id == TeamWorkspace.id)
            .where(TeamMember.user_id == user_id)
            .order_by(TeamWorkspace.updated_at.desc())
        ).scalars().all()

    def _require_user(self, db: Session, user_id: str) -> User:
        user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
        if not user:
            raise WorkspaceHubServiceError("User was not found.")
        return user

    def _require_thread(self, db: Session, *, user_id: str, thread_id: str) -> WorkspaceChatThread:
        thread = db.execute(
            select(WorkspaceChatThread).where(
                WorkspaceChatThread.id == thread_id,
                WorkspaceChatThread.user_id == user_id,
            )
        ).scalar_one_or_none()
        if not thread:
            raise WorkspaceHubServiceError("Chat thread was not found.")
        return thread

    def _require_team_owner_access(self, db: Session, *, actor_user_id: str, team_id: str) -> TeamWorkspace:
        team = db.execute(select(TeamWorkspace).where(TeamWorkspace.id == team_id)).scalar_one_or_none()
        if not team:
            raise WorkspaceHubServiceError("Team was not found.")
        membership = db.execute(
            select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == actor_user_id)
        ).scalar_one_or_none()
        if not membership or membership.role not in {"owner", "admin"}:
            raise WorkspaceHubServiceError("You do not have permission to manage that team.")
        return team

    def _build_daily_counts(self, dates: list[datetime | None], *, days: int) -> list[dict]:
        today = datetime.now(timezone.utc).date()
        counts: dict[str, int] = {}
        for value in dates:
            if not value:
                continue
            value = self._ensure_utc(value)
            key = value.date().isoformat()
            counts[key] = counts.get(key, 0) + 1
        points = []
        for offset in range(days - 1, -1, -1):
            day = today - timedelta(days=offset)
            key = day.isoformat()
            points.append({"label": day.strftime("%d %b"), "value": counts.get(key, 0)})
        return points

    def _build_breakdown(self, values: list[str | None], *, hints: dict[str, str]) -> list[dict]:
        counts: dict[str, int] = {}
        for value in values:
            label = (value or "unknown").strip() or "unknown"
            counts[label] = counts.get(label, 0) + 1
        return [
            {
                "label": key.replace("_", " ").title(),
                "value": value,
                "hint": hints.get(key.lower()),
            }
            for key, value in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
        ]

    def _build_weekly_timeline(
        self,
        *,
        messages: list[WorkspaceChatMessage],
        notifications: list[WorkspaceNotification],
        teams: list[TeamWorkspace],
        requests: list[ContactRequest],
        transactions: list[SubscriptionTransaction],
        days: int,
    ) -> list[dict]:
        today = datetime.now(timezone.utc).date()
        chats_by_day = self._count_by_day([item.created_at for item in messages if item.role == "user"])
        messages_by_day = self._count_by_day([item.created_at for item in messages])
        notifications_by_day = self._count_by_day([item.created_at for item in notifications])
        teams_by_day = self._count_by_day([item.created_at for item in teams])
        requests_by_day = self._count_by_day([item.created_at for item in requests])
        payments_by_day = self._count_by_day([item.created_at for item in transactions])
        points = []
        for offset in range(days - 1, -1, -1):
            day = today - timedelta(days=offset)
            key = day.isoformat()
            points.append(
                {
                    "label": day.strftime("%d %b"),
                    "chats": chats_by_day.get(key, 0),
                    "messages": messages_by_day.get(key, 0),
                    "notifications": notifications_by_day.get(key, 0),
                    "teams": teams_by_day.get(key, 0),
                    "supportRequests": requests_by_day.get(key, 0),
                    "payments": payments_by_day.get(key, 0),
                }
            )
        return points

    def _count_by_day(self, dates: list[datetime | None]) -> dict[str, int]:
        counts: dict[str, int] = {}
        for value in dates:
            if not value:
                continue
            key = self._ensure_utc(value).date().isoformat()
            counts[key] = counts.get(key, 0) + 1
        return counts

    def _serialize_dashboard_chat(self, db: Session, item: WorkspaceChatThread) -> dict:
        serialized = self.serialize_thread(db, item)
        return {
            "id": item.id,
            "title": item.title,
            "detail": item.last_message_preview or "No preview yet.",
            "meta": f"{serialized['messageCount']} messages",
            "createdAt": self._serialize_datetime(item.last_message_at or item.updated_at or item.created_at),
        }

    def _serialize_dashboard_team(self, db: Session, item: TeamWorkspace) -> dict:
        serialized = self.serialize_team(db, item)
        return {
            "id": item.id,
            "title": item.name,
            "detail": item.description or ("Personal workspace" if item.is_personal else "Shared workspace"),
            "meta": f"{serialized['memberCount']} members",
            "createdAt": self._serialize_datetime(item.updated_at or item.created_at),
        }

    def _ensure_utc(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def _personal_workspace_name(self, user: User) -> str:
        raw_name = (getattr(user, "full_name", None) or "").strip()
        if raw_name:
            return f"{raw_name.split()[0]}'s Workspace"

        username = (getattr(user, "username", None) or "").strip()
        if username:
            return f"{username}'s Workspace"

        email = (getattr(user, "email", None) or "").strip()
        if email and "@" in email:
            return f"{email.split('@', 1)[0]}'s Workspace"

        return "My Workspace"

    def _serialize_datetime(self, value: datetime | None) -> str | None:
        if not value:
            return None
        return self._ensure_utc(value).isoformat().replace("+00:00", "Z")
