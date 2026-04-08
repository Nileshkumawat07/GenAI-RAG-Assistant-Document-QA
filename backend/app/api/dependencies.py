from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.auth_service import AuthService, AuthServiceError


def require_session_id(x_session_id: str | None = Header(default=None)) -> str:
    if not x_session_id or not x_session_id.strip():
        raise HTTPException(status_code=400, detail="Missing X-Session-Id header.")
    return x_session_id.strip()


def require_authenticated_user_id(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token.")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization token.")

    auth_service = AuthService()
    try:
        user_id = auth_service.verify_access_token(token)
        auth_service.get_user_by_id(db, user_id=user_id)
        return user_id
    except AuthServiceError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
