"""add chat conversation backgrounds

Revision ID: 20260410_0002
Revises: 20260409_0001
Create Date: 2026-04-10 00:02:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260410_0002"
down_revision = "20260409_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "chat_conversation_backgrounds",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("conversation_type", sa.String(length=40), nullable=False),
        sa.Column("conversation_key", sa.String(length=120), nullable=False),
        sa.Column("created_by_user_id", sa.String(length=36), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=120), nullable=True),
        sa.Column("storage_path", sa.String(length=600), nullable=False),
        sa.Column("background_url", sa.String(length=600), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("conversation_type", "conversation_key", name="uq_chat_conversation_background_key"),
    )
    op.create_index(op.f("ix_chat_conversation_backgrounds_conversation_key"), "chat_conversation_backgrounds", ["conversation_key"], unique=False)
    op.create_index(op.f("ix_chat_conversation_backgrounds_conversation_type"), "chat_conversation_backgrounds", ["conversation_type"], unique=False)
    op.create_index(op.f("ix_chat_conversation_backgrounds_created_by_user_id"), "chat_conversation_backgrounds", ["created_by_user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_chat_conversation_backgrounds_created_by_user_id"), table_name="chat_conversation_backgrounds")
    op.drop_index(op.f("ix_chat_conversation_backgrounds_conversation_type"), table_name="chat_conversation_backgrounds")
    op.drop_index(op.f("ix_chat_conversation_backgrounds_conversation_key"), table_name="chat_conversation_backgrounds")
    op.drop_table("chat_conversation_backgrounds")
