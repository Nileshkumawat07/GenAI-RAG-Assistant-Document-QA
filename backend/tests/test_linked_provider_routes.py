from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.api.routes.linked_providers import build_callback_url


def test_build_callback_url_keeps_configured_https_when_request_scheme_is_http():
    app = FastAPI()

    @app.get("/probe")
    def probe(request: Request):
        return {"callbackUrl": build_callback_url(request, "facebook")}

    client = TestClient(app, base_url="http://www.infralayer.in")

    response = client.get("/probe")

    assert response.status_code == 200, response.text
    assert response.json()["callbackUrl"] == "https://www.infralayer.in/auth/facebook/callback"
