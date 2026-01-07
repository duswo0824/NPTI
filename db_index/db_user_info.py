from sqlalchemy.orm import Session
from sqlalchemy import text
import hashlib
from pydantic import BaseModel, EmailStr
from datetime import date
from logger import Logger

logger = Logger().get_logger(__name__)

# =========================
# Pydantic Model
# =========================
class UserCreateRequest(BaseModel):
    user_id: str
    user_pw: str
    user_name: str
    user_birth: date
    user_age: int
    user_gender: bool
    user_email: EmailStr
    activation: bool = True


# =========================
# Password Helpers
# =========================
def hash_password(raw_pw: str) -> str:
    """비밀번호 해시 (회원가입 / 로그인 공용)"""
    return hashlib.sha256(raw_pw.encode()).hexdigest()


def verify_password(raw_pw: str, hashed_pw: str) -> bool:
    """입력 비밀번호와 DB 비밀번호 비교"""
    return hash_password(raw_pw) == hashed_pw


# =========================
# Signup Logic
# =========================
def insert_user(db: Session, params: dict):
    logger.info(f"[SIGNUP] try user_id={params.get('user_id')}")

    params["user_pw"] = hash_password(params["user_pw"])

    sql = text("""
        INSERT INTO user_info (
            user_id, user_pw, user_name, user_birth,
            user_age, user_gender, user_email, activation
        )
        VALUES (
            :user_id, :user_pw, :user_name, :user_birth,
            :user_age, :user_gender, :user_email, :activation
        )
    """)
    db.execute(sql, params)

    logger.info(f"[SIGNUP SUCCESS] user_id={params.get('user_id')}")


# =========================
# Login Logic
# =========================
def authenticate_user(db: Session, user_id: str, user_pw: str) -> bool:
    logger.info(f"[LOGIN] attempt user_id={user_id}")

    sql = text("""
        SELECT user_pw, activation
        FROM user_info
        WHERE user_id = :user_id
    """)
    user = db.execute(sql, {"user_id": user_id}).fetchone()

    if not user:
        logger.warning(f"[LOGIN FAIL] user not found: {user_id}")
        return False

    if not user.activation:
        logger.warning(f"[LOGIN FAIL] deactivated user: {user_id}")
        return False

    if not verify_password(user_pw, user.user_pw):
        logger.warning(f"[LOGIN FAIL] password mismatch: {user_id}")
        return False

    logger.info(f"[LOGIN SUCCESS] user_id={user_id}")
    return True