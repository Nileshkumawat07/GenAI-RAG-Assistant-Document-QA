from __future__ import annotations

import secrets
import uuid
from datetime import datetime

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.subscription_transaction import SubscriptionTransaction


class SubscriptionTransactionServiceError(RuntimeError):
    pass


class SubscriptionTransactionService:
    def create_verified_transaction(
        self,
        db: Session,
        *,
        user_id: str,
        customer_code: str | None,
        customer_name: str,
        customer_email: str,
        customer_mobile: str,
        company_name: str,
        plan_id: str,
        plan_name: str,
        amount: int,
        currency: str,
        billing_cycle: str,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        activated_at: datetime,
        expires_at: datetime,
    ) -> SubscriptionTransaction:
        existing = db.execute(
            select(SubscriptionTransaction).where(
                SubscriptionTransaction.razorpay_payment_id == razorpay_payment_id
            )
        ).scalar_one_or_none()
        if existing:
            return existing

        transaction = SubscriptionTransaction(
            id=str(uuid.uuid4()),
            transaction_code=self._generate_transaction_code(db),
            invoice_number=self._generate_transaction_code(db),
            user_id=user_id,
            customer_code=customer_code,
            customer_name=customer_name,
            customer_email=customer_email,
            customer_mobile=customer_mobile,
            company_name=company_name,
            plan_id=plan_id,
            plan_name=plan_name,
            amount=amount,
            currency=currency,
            billing_cycle=billing_cycle,
            status="verified",
            razorpay_order_id=razorpay_order_id,
            razorpay_payment_id=razorpay_payment_id,
            activated_at=activated_at,
            expires_at=expires_at,
        )
        db.add(transaction)
        db.commit()
        db.refresh(transaction)
        return transaction

    def list_transactions(self, db: Session) -> list[SubscriptionTransaction]:
        return db.execute(
            select(SubscriptionTransaction).order_by(desc(SubscriptionTransaction.created_at))
        ).scalars().all()

    def list_transactions_for_user(self, db: Session, *, user_id: str) -> list[SubscriptionTransaction]:
        return db.execute(
            select(SubscriptionTransaction)
            .where(SubscriptionTransaction.user_id == user_id)
            .order_by(desc(SubscriptionTransaction.created_at))
        ).scalars().all()

    def get_user_transaction_by_invoice(self, db: Session, *, user_id: str, invoice_number: str) -> SubscriptionTransaction | None:
        return db.execute(
            select(SubscriptionTransaction).where(
                SubscriptionTransaction.user_id == user_id,
                SubscriptionTransaction.invoice_number == invoice_number,
            )
        ).scalar_one_or_none()

    def mark_latest_transaction_canceled(self, db: Session, *, user_id: str, canceled_at: datetime) -> SubscriptionTransaction | None:
        transaction = db.execute(
            select(SubscriptionTransaction)
            .where(
                SubscriptionTransaction.user_id == user_id,
                SubscriptionTransaction.status == "verified",
            )
            .order_by(desc(SubscriptionTransaction.created_at))
        ).scalar_one_or_none()
        if not transaction:
            return None
        transaction.status = "canceled"
        transaction.canceled_at = canceled_at
        db.commit()
        db.refresh(transaction)
        return transaction

    def mark_expired_transactions(self, db: Session, *, user_id: str, expires_before: datetime) -> None:
        transactions = db.execute(
            select(SubscriptionTransaction).where(
                SubscriptionTransaction.user_id == user_id,
                SubscriptionTransaction.status == "verified",
                SubscriptionTransaction.expires_at <= expires_before,
            )
        ).scalars().all()
        if not transactions:
            return
        for transaction in transactions:
            transaction.status = "expired"
        db.commit()

    def _generate_transaction_code(self, db: Session) -> str:
        for _ in range(20):
            code = f"{secrets.randbelow(1_000_000):06d}"
            exists = db.execute(
                select(SubscriptionTransaction.id).where(
                    SubscriptionTransaction.transaction_code == code
                )
            ).scalar_one_or_none()
            if not exists:
                return code
        raise SubscriptionTransactionServiceError("Unable to generate a short transaction code.")
