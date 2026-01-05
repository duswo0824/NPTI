from sqlalchemy.orm import Session
from sqlalchemy import text
from logger import Logger

from pydantic import BaseModel, EmailStr
from datetime import date
import hashlib

logger = Logger().get_logger(__name__)

# 회원가입 입력
class UserCreateRequest(BaseModel):
    user_id: str
    user_pw: str
    user_name: str
    user_birth: date
    user_age: int
    user_gender: bool          # False = 남(0), True = 여(1)
    user_email: EmailStr
    activation: bool = True    # True = 활성, False = 탈퇴

# 회원 조회용
class UserInfoResponse(BaseModel):
    user_id: str
    user_name: str
    user_birth: date
    user_age: int
    user_gender: bool
    user_email: EmailStr
    activation: bool

# 아이디 중복 체크
def is_duplicate_user_id(db: Session, user_id: str) -> bool:
    sql = text("""
        SELECT 1
        FROM user_info
        WHERE user_id = :user_id
        LIMIT 1
    """)
    return db.execute(sql, {"user_id": user_id}).first() is not None

# 조회
def get_user_by_id(db: Session, user_id: str):
    logger.info(f"user_info 조회: {user_id}")

    sql = text("""
        SELECT
            user_id,
            user_name,
            user_birth,
            user_age,
            user_gender,
            user_email,
            activation
        FROM user_info
        WHERE user_id = :user_id
    """)

    return db.execute(sql, {"user_id": user_id}).mappings().first()

# 회원가입
def insert_user(db: Session, params: dict):
    logger.info(f"user_info 등록: {params.get('user_id')}")

    # 비밀번호 해시
    params["user_pw"] = hashlib.sha256(
        params["user_pw"].encode()
    ).hexdigest()

    sql = text("""
        INSERT INTO user_info
        (
            user_id,
            user_pw,
            user_name,
            user_birth,
            user_age,
            user_gender,
            user_email,
            activation
        )
        VALUES
        (
            :user_id,
            :user_pw,
            :user_name,
            :user_birth,
            :user_age,
            :user_gender,
            :user_email,
            :activation
        )
    """)

    db.execute(sql, params)

# 로그인 검증
def verify_user_login(db: Session, user_id: str, user_pw: str):
    hashed_pw = hashlib.sha256(user_pw.encode()).hexdigest()

    sql = text("""
        SELECT
            user_id,
            user_name,
            activation
        FROM user_info
        WHERE user_id = :user_id
          AND user_pw = :user_pw
          AND activation = true
        LIMIT 1
    """)

    return db.execute(sql, {
        "user_id": user_id,
        "user_pw": hashed_pw
    }).mappings().first()