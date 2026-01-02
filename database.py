from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, Session
from logger import Logger

logger = Logger().get_logger(__name__)

DB_HOST = "localhost"
DB_PORT = 3306
DB_NAME = "npti"
DB_USER = "web_user"
DB_PASSWORD = "pass"

DATABASE_URL = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

_engine: Engine | None = None


def get_engine() -> Engine:
    global _engine

    if _engine is None:
        logger.info("DB Engine 생성")
        _engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            pool_recycle=3600,
        )

    return _engine


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=get_engine(),
)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"DB 연결 실패 : {e}")
    finally:
        db.close()