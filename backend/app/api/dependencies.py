from fastapi import Header, HTTPException


def require_session_id(x_session_id: str | None = Header(default=None)) -> str:
    if not x_session_id or not x_session_id.strip():
        raise HTTPException(status_code=400, detail="Missing X-Session-Id header.")
    return x_session_id.strip()
