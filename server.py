#!/usr/bin/env python3
"""Intuiflix local server: static app, lightweight profiles and session history."""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import mimetypes
import secrets
import threading
from datetime import datetime, timezone
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"
USERS_FILE = ROOT / "data" / "users.json"
HISTORY_FILE = ROOT / "data" / "history.json"
MAX_BODY_BYTES = 250_000
MAX_HISTORY_PER_USER = 80
SESSION_SECRET = secrets.token_bytes(32)
HISTORY_LOCK = threading.Lock()


def load_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return fallback


def normalized_username(value: str) -> str:
    return value.strip().casefold()


def accepted_users() -> dict[str, dict[str, str]]:
    payload = load_json(USERS_FILE, {"users": []})
    users: dict[str, dict[str, str]] = {}
    for candidate in payload.get("users", []):
        username = normalized_username(str(candidate.get("username", "")))
        display_name = str(candidate.get("displayName", "")).strip()
        if username and display_name:
            users[username] = {"username": username, "displayName": display_name}
    return users


def sign_username(username: str) -> str:
    encoded = base64.urlsafe_b64encode(username.encode("utf-8")).decode("ascii").rstrip("=")
    signature = hmac.new(SESSION_SECRET, encoded.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"


def verify_session(value: str) -> str | None:
    try:
        encoded, signature = value.split(".", 1)
        expected = hmac.new(SESSION_SECRET, encoded.encode("ascii"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return None
        padded = encoded + "=" * (-len(encoded) % 4)
        username = base64.urlsafe_b64decode(padded).decode("utf-8")
        return username if username in accepted_users() else None
    except (ValueError, UnicodeDecodeError):
        return None


def read_history() -> dict[str, list[dict]]:
    payload = load_json(HISTORY_FILE, {})
    return payload if isinstance(payload, dict) else {}


def write_history(payload: dict[str, list[dict]]) -> None:
    temporary = HISTORY_FILE.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    temporary.replace(HISTORY_FILE)


class IntuiflixHandler(BaseHTTPRequestHandler):
    server_version = "Intuiflix/1.0"

    def log_message(self, message: str, *args) -> None:
        print(f"[intuiflix] {self.address_string()} - {message % args}")

    def send_json(self, payload, status: HTTPStatus = HTTPStatus.OK, headers=None) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for key, value in headers or []:
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self) -> dict | None:
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return None
        if content_length <= 0 or content_length > MAX_BODY_BYTES:
            return None
        try:
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            return payload if isinstance(payload, dict) else None
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None

    def current_username(self) -> str | None:
        cookie_header = self.headers.get("Cookie", "")
        cookies = SimpleCookie()
        try:
            cookies.load(cookie_header)
        except Exception:
            return None
        morsel = cookies.get("intuiflix_session")
        return verify_session(morsel.value) if morsel else None

    def current_user(self) -> dict[str, str] | None:
        username = self.current_username()
        return accepted_users().get(username) if username else None

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/health":
            self.send_json({"status": "ok", "service": "intuiflix"})
            return
        if path == "/api/me":
            self.send_json({"user": self.current_user()})
            return
        if path == "/api/history":
            user = self.current_user()
            if not user:
                self.send_json({"error": "Connexion requise."}, HTTPStatus.UNAUTHORIZED)
                return
            with HISTORY_LOCK:
                history = read_history().get(user["username"], [])
            self.send_json({"history": history})
            return
        self.serve_static(path)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/login":
            payload = self.read_json_body()
            username = normalized_username(str((payload or {}).get("username", "")))
            user = accepted_users().get(username)
            if not user:
                self.send_json(
                    {"error": "Ce username ne fait pas partie des profils autorisés."},
                    HTTPStatus.UNAUTHORIZED,
                )
                return
            cookie = (
                f"intuiflix_session={sign_username(username)}; "
                "Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000"
            )
            self.send_json({"user": user}, headers=[("Set-Cookie", cookie)])
            return
        if path == "/api/logout":
            self.send_json(
                {"ok": True},
                headers=[(
                    "Set-Cookie",
                    "intuiflix_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
                )],
            )
            return
        if path == "/api/sessions":
            user = self.current_user()
            if not user:
                self.send_json({"error": "Connexion requise."}, HTTPStatus.UNAUTHORIZED)
                return
            payload = self.read_json_body()
            if not payload or not isinstance(payload.get("decisions"), list):
                self.send_json({"error": "Session invalide."}, HTTPStatus.BAD_REQUEST)
                return
            decisions = payload["decisions"]
            if not 1 <= len(decisions) <= 60:
                self.send_json({"error": "Nombre de décisions invalide."}, HTTPStatus.BAD_REQUEST)
                return
            entry = {
                "id": secrets.token_urlsafe(9),
                "date": datetime.now(timezone.utc).isoformat(),
                "score": int(max(0, min(1_000_000, payload.get("score", 0)))),
                "accuracy": float(max(0, min(1, payload.get("accuracy", 0)))),
                "optimalRate": float(max(0, min(1, payload.get("optimalRate", 0)))),
                "averageReactionTime": int(max(0, min(60_000, payload.get("averageReactionTime", 0)))),
                "longestStreak": int(max(0, min(60, payload.get("longestStreak", 0)))),
                "profile": str(payload.get("profile", ""))[:80],
                "decisions": decisions,
            }
            with HISTORY_LOCK:
                history = read_history()
                user_history = history.setdefault(user["username"], [])
                user_history.append(entry)
                history[user["username"]] = user_history[-MAX_HISTORY_PER_USER:]
                write_history(history)
            self.send_json({"session": entry}, HTTPStatus.CREATED)
            return
        self.send_json({"error": "Route inconnue."}, HTTPStatus.NOT_FOUND)

    def serve_static(self, request_path: str) -> None:
        if request_path == "/":
            candidate = PUBLIC_DIR / "index.html"
        elif request_path.startswith("/.design-system/"):
            candidate = ROOT / unquote(request_path.lstrip("/"))
        else:
            candidate = PUBLIC_DIR / unquote(request_path.lstrip("/"))

        try:
            resolved = candidate.resolve()
            allowed_roots = (PUBLIC_DIR.resolve(), (ROOT / ".design-system" / "generated").resolve())
            if not any(resolved == root or root in resolved.parents for root in allowed_roots):
                raise ValueError("outside static roots")
            if not resolved.is_file():
                raise FileNotFoundError
            body = resolved.read_bytes()
        except (OSError, ValueError):
            self.send_error(HTTPStatus.NOT_FOUND, "Fichier introuvable")
            return

        content_type, _ = mimetypes.guess_type(resolved.name)
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", f"{content_type or 'application/octet-stream'}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        cache = "no-cache" if resolved.suffix in {".html", ".js", ".css"} else "public, max-age=3600"
        self.send_header("Cache-Control", cache)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve Intuiflix locally.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), IntuiflixHandler)
    print(f"Intuiflix est disponible sur http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt d’Intuiflix.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
