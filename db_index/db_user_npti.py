from sqlalchemy.orm import Session
from sqlalchemy import text
from logger import Logger
from pydantic import BaseModel
from datetime import datetime

logger = Logger().get_logger(__name__)

# =========================
# Response Model
# =========================
class UserNPTIResponse(BaseModel):
    user_id: str
    npti_code: str
    length_score: float
    article_score: float
    info_score: float
    view_score: float
    updated_at: datetime


# =========================
# 조회 (Result / Main 공용)
# =========================
def get_user_npti(db: Session, user_id: str):
    logger.info(f"user_npti 조회: {user_id}")

    sql = text("""
        SELECT
            user_id,
            npti_code,
            length_score,
            article_score,
            info_score,
            view_score,
            updated_at
        FROM user_npti
        WHERE user_id = :user_id
    """)

    return db.execute(sql, {"user_id": user_id}).mappings().first()


# =========================
# 저장 / 갱신 (설문 완료 시)
# =========================
def upsert_user_npti(db: Session, params: dict):
    logger.info(f"user_npti 저장/갱신: {params.get('user_id')}")

    sql = text("""
        INSERT INTO user_npti (
            user_id,
            npti_code,
            length_score,
            article_score,
            info_score,
            view_score
        )
        VALUES (
            :user_id,
            :npti_code,
            :length_score,
            :article_score,
            :info_score,
            :view_score
        )
        ON DUPLICATE KEY UPDATE
            npti_code = VALUES(npti_code),
            length_score = VALUES(length_score),
            article_score = VALUES(article_score),
            info_score = VALUES(info_score),
            view_score = VALUES(view_score),
            updated_at = CURRENT_TIMESTAMP
    """)

    db.execute(sql, params)