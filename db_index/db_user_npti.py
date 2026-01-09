from sqlalchemy.orm import Session
from sqlalchemy import text
from logger import Logger
from pydantic import BaseModel
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime
from database import Base

logger = Logger().get_logger(__name__)

# =========================
# Response Model
# =========================
class UserNPTIResponse(BaseModel):
    user_id: str
    npti_code: str
    length_score: float
    article_score: float
    information_score: float
    view_score: float
    updated_at: datetime

class UserNPTITable(Base):
    __tablename__ = "user_npti"

    user_id = Column(String, primary_key=True, index=True)
    npti_code = Column(String, primary_key=True)
    length_score = Column(Float)
    article_score = Column(Float)
    information_score = Column(Float)
    view_score = Column(Float)
    updated_at = Column(DateTime)

# =========================
# 조회 (가장 최신 결과 1건만 가져오기)
# =========================
def get_user_npti_info(db: Session, user_id: str):
    logger.info(f"user_npti 최신 결과 조회 시작: {user_id}")

    sql = text("""
        SELECT
            user_id, npti_code, length_score, article_score, 
            information_score, view_score, updated_at
        FROM user_npti
        WHERE user_id = :user_id
        ORDER BY updated_at DESC
        LIMIT 1
    """)

    result = db.execute(sql, {"user_id": user_id}).first()

    if result:
        logger.info(f"user_npti 조회 성공 (최신본): {user_id}")
        # ✅ 핵심 수정: RowMapping 객체를 dict로 변환하여 리턴합니다.
        return dict(result._asdict())
    else:
        logger.info(f"user_npti 결과 없음: {user_id}")
        return None


# =========================
# 저장 (누적 기록 방식)
# =========================
def insert_user_npti(db: Session, params: dict):
    logger.info(f"user_npti 새로운 기록 저장: {params.get('user_id')}")

    # 이제 user_id가 PK가 아니므로 중복 체크 없이 계속 INSERT 가능합니다.
    sql = text("""
        INSERT INTO user_npti (
            user_id,
            npti_code,
            length_score,
            article_score,
            information_score,
            view_score
        )
        VALUES (
            :user_id,
            :npti_code,
            :length_score,
            :article_score,
            :information_score,
            :view_score
        )
    """)

    try:
        db.execute(sql, params)
        db.commit()  # 변경사항을 실제 DB에 반영 (중요!)
        logger.info(f"user_npti 저장 성공: {params.get('user_id')}")
    except Exception as e:
        db.rollback()  # 에러 발생 시 원상복구
        logger.error(f"user_npti 저장 실패: {str(e)}")
        raise e