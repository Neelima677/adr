import json
from pathlib import Path
from hashlib import sha256


BASE_DIR = Path(__file__).resolve().parent.parent
USERS_FILE = BASE_DIR / "users.json"


def hash_password(password: str) -> str:
    return sha256(password.encode("utf-8")).hexdigest()


def load_users() -> dict:
    if not USERS_FILE.exists():
        return {}

    try:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_users(users: dict) -> None:
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=4)


def register_user(username: str, password: str) -> tuple[bool, str]:
    username = username.strip()
    password = password.strip()

    if not username or not password:
        return False, "Username and password are required"

    users = load_users()

    if username in users:
        return False, "User already exists"

    users[username] = {
        "password": hash_password(password)
    }
    save_users(users)

    return True, "Account created successfully"


def login_user(username: str, password: str) -> tuple[bool, str]:
    username = username.strip()
    password = password.strip()

    if not username or not password:
        return False, "Username and password are required"

    users = load_users()

    if username not in users:
        return False, "Invalid username or password"

    stored_password = users[username].get("password", "")
    if stored_password != hash_password(password):
        return False, "Invalid username or password"

    return True, "Login successful"