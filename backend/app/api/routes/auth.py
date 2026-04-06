from sqlalchemy.orm import Session
from sqlalchemy import inspect, text

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import HTMLResponse

from app.core.database import engine, get_db
from app.schemas.auth import (
    AuthUserResponse,
    ChangePasswordRequest,
    CheckEmailVerificationRequest,
    LoginRequest,
    SendEmailVerificationRequest,
    SignupRequest,
    UpdateEmailRequest,
    UpdateMobileRequest,
    UpdateUsernameRequest,
)
from app.services.auth_service import AuthService, AuthServiceError
from app.services.otp_service import OTPService, OTPServiceError


def build_auth_router(otp_service: OTPService, auth_service: AuthService) -> APIRouter:
    router = APIRouter(prefix="/auth", tags=["auth"])

    def quote_identifier(identifier: str) -> str:
        return f"`{identifier.replace('`', '``')}`"

    def serialize_scalar(value):
        if value is None or isinstance(value, (bool, int, float, str)):
            return value
        if hasattr(value, "isoformat"):
            return value.isoformat()
        return str(value)

    def append_virtual_columns(columns, extra_columns: list[tuple[str, str]]):
        existing_names = {column["name"] for column in columns}
        for name, column_type in extra_columns:
            if name in existing_names:
                continue
            columns.append(
                {
                    "name": name,
                    "type": column_type,
                    "nullable": True,
                    "default": None,
                }
            )

    def require_authenticated_user_id(authorization: str | None = Header(default=None)) -> str:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing authorization token.")

        token = authorization.split(" ", 1)[1].strip()
        if not token:
            raise HTTPException(status_code=401, detail="Missing authorization token.")

        try:
            return auth_service.verify_access_token(token)
        except AuthServiceError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

    def serialize_user(user):
        return AuthUserResponse(
            id=user.id,
            fullName=user.full_name,
            username=user.username,
            dateOfBirth=user.date_of_birth,
            gender=user.gender,
            email=user.email,
            alternateEmail=user.alternate_email,
            mobile=user.mobile,
            securityQuestion=user.security_question,
            securityAnswer=user.security_answer,
            referralCode=user.referral_code,
            emailVerified=user.email_verified,
            mobileVerified=user.mobile_verified,
            subscriptionPlanId=user.subscription_plan_id,
            subscriptionPlanName=user.subscription_plan_name,
            subscriptionStatus=user.subscription_status,
            subscriptionAmount=user.subscription_amount,
            subscriptionCurrency=user.subscription_currency,
            subscriptionBillingCycle=user.subscription_billing_cycle,
            subscriptionActivatedAt=user.subscription_activated_at,
            createdAt=user.created_at,
            isAdmin=auth_service.is_admin_email(user.email),
            mode="admin" if auth_service.is_admin_email(user.email) else "member",
            authToken=auth_service.create_access_token(user_id=user.id),
        )

    @router.post("/signup", response_model=AuthUserResponse)
    def signup(payload: SignupRequest, db: Session = Depends(get_db)):
        try:
            user = auth_service.register_user(
                db,
                full_name=payload.fullName,
                username=payload.username,
                date_of_birth=payload.dateOfBirth,
                gender=payload.gender,
                email=payload.email,
                alternate_email=payload.alternateEmail,
                mobile=payload.mobile,
                security_question=payload.securityQuestion,
                security_answer=payload.securityAnswer,
                referral_code=payload.referralCode,
                password=payload.password,
                email_verified=payload.emailVerified,
                mobile_verified=payload.mobileVerified,
            )
            return serialize_user(user)
        except AuthServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/login", response_model=AuthUserResponse)
    def login(payload: LoginRequest, db: Session = Depends(get_db)):
        try:
            user = auth_service.authenticate_user(
                db,
                identifier=payload.identifier,
                password=payload.password,
            )
            return serialize_user(user)
        except AuthServiceError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

    @router.post("/settings/username", response_model=AuthUserResponse)
    def update_username(
        payload: UpdateUsernameRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            if payload.userId != authenticated_user_id:
                raise HTTPException(status_code=403, detail="You can only update your own account.")
            user = auth_service.update_username(db, user_id=authenticated_user_id, new_username=payload.newUsername)
            return serialize_user(user)
        except AuthServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/settings/email", response_model=AuthUserResponse)
    def update_email(
        payload: UpdateEmailRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            if payload.userId != authenticated_user_id:
                raise HTTPException(status_code=403, detail="You can only update your own account.")
            user = auth_service.update_email(db, user_id=authenticated_user_id, new_email=payload.newEmail)
            return serialize_user(user)
        except AuthServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/settings/mobile", response_model=AuthUserResponse)
    def update_mobile(
        payload: UpdateMobileRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            if payload.userId != authenticated_user_id:
                raise HTTPException(status_code=403, detail="You can only update your own account.")
            user = auth_service.update_mobile(db, user_id=authenticated_user_id, new_mobile=payload.newMobile)
            return serialize_user(user)
        except AuthServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/settings/password")
    def change_password(
        payload: ChangePasswordRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            if payload.userId != authenticated_user_id:
                raise HTTPException(status_code=403, detail="You can only update your own account.")
            auth_service.change_password(
                db,
                user_id=authenticated_user_id,
                current_password=payload.currentPassword,
                new_password=payload.newPassword,
            )
            return {"message": "Password updated successfully."}
        except AuthServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/settings/admin/mysql-overview")
    def admin_mysql_overview(
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        if not auth_service.user_is_admin(db, user_id=authenticated_user_id):
            raise HTTPException(status_code=403, detail="Admin access is required.")

        inspector = inspect(engine)
        tables = []

        with engine.connect() as connection:
            users_lookup = {}
            table_names = set(inspector.get_table_names())
            if "users" in table_names:
                raw_users = connection.execute(
                    text("SELECT id, full_name, username, email FROM users")
                ).mappings().all()
                users_lookup = {
                    serialize_scalar(row["id"]): {
                        "linked_user_name": serialize_scalar(row["full_name"]),
                        "linked_user_username": serialize_scalar(row["username"]),
                        "linked_user_email": serialize_scalar(row["email"]),
                    }
                    for row in raw_users
                }

            for table_name in sorted(inspector.get_table_names()):
                quoted_table = quote_identifier(table_name)
                columns = [
                    {
                        "name": column["name"],
                        "type": str(column["type"]),
                        "nullable": column.get("nullable", True),
                        "default": serialize_scalar(column.get("default")),
                    }
                    for column in inspector.get_columns(table_name)
                ]
                total_rows = connection.execute(
                    text(f"SELECT COUNT(*) AS total FROM {quoted_table}")
                ).scalar_one()
                raw_rows = connection.execute(
                    text(f"SELECT * FROM {quoted_table} ORDER BY 1 DESC LIMIT 100")
                ).mappings().all()
                rows = [
                    {key: serialize_scalar(value) for key, value in row.items()}
                    for row in raw_rows
                ]

                if table_name in {"contact_requests", "user_social_links"}:
                    append_virtual_columns(
                        columns,
                        [
                            ("linked_user_name", "VARCHAR"),
                            ("linked_user_username", "VARCHAR"),
                            ("linked_user_email", "VARCHAR"),
                        ],
                    )
                    for row in rows:
                        linked_user_id = serialize_scalar(row.get("user_id"))
                        user_details = users_lookup.get(linked_user_id, {})
                        row.update(user_details)

                tables.append(
                    {
                        "tableName": table_name,
                        "columns": columns,
                        "rowCount": total_rows,
                        "rows": rows,
                    }
                )

        return {"tables": tables, "statusOptions": list(contact_request_service.STATUS_OPTIONS) if False else ["In Progress", "In Review", "Completed"]}

    @router.post("/email/send-verification")
    def send_email_verification(payload: SendEmailVerificationRequest):
        try:
            otp_service.send_email_verification(payload.email)
            return {"message": "Verification email sent successfully."}
        except OTPServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/email/check-verification")
    def check_email_verification(payload: CheckEmailVerificationRequest):
        try:
            otp_service.verify_email_status(payload.email)
            return {"message": "Email verified successfully.", "verified": True}
        except OTPServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/email/confirm", response_class=HTMLResponse)
    def confirm_email_verification(token: str):
        try:
            destination = otp_service.confirm_email_verification(token)
            return HTMLResponse(
                content=(
                    "<html><body style=\"font-family:Arial,sans-serif;padding:32px;\">"
                    "<h2>Email verified successfully</h2>"
                    f"<p>{destination} is now verified for Unified AI Workspace.</p>"
                    "<p>You can return to the signup page and click Verify.</p>"
                    "</body></html>"
                )
            )
        except OTPServiceError as exc:
            return HTMLResponse(
                status_code=400,
                content=(
                    "<html><body style=\"font-family:Arial,sans-serif;padding:32px;\">"
                    "<h2>Email verification failed</h2>"
                    f"<p>{exc}</p>"
                    "</body></html>"
                ),
            )

    return router
