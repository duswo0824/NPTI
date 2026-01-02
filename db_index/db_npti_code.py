from sqlalchemy.orm import Session
from logger import Logger
from pydantic import BaseModel

logger = Logger().get_logger(__name__)

class npti_code_response(BaseModel):
    npti_code: str
    length_type: str
    article_type: str
    info_type: str
    view_type: str
    type_nick: str | None
    type_de: str | None

def get_all_npti_codes(db: Session):
    logger.info("npti_code 전체 조회")

    sql = """
        select
            npti_code,
            length_type,
            article_type,
            info_type,
            view_type,
            type_nick,
            type_de
        from npti_code
        order by npti_code
    """
    return db.execute(sql).mappings().all()


def get_npti_code_by_code(db: Session, code: str):
    logger.info(f"npti_code 단일 조회: {code}")

    sql = """
        select
            npti_code,
            length_type,
            article_type,
            info_type,
            view_type,
            type_nick,
            type_de
        from npti_code
        where npti_code = :code
    """
    return db.execute(sql, {"code": code}).mappings().first()
