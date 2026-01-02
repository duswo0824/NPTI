from logger import Logger
from elasticsearch import Elasticsearch, helpers
import pymysql
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base, get_engine, SessionLocal

logger = Logger().get_logger(__name__)

ES_HOST = "http://localhost:9200"
ES_USER = "elastic"
ES_PASS = "elastic"
ES_INDEX = "news_raw"

es = Elasticsearch( # elasticsearch 연결 객체 생성
    ES_HOST,
    basic_auth=(ES_USER, ES_PASS),
    verify_certs=False,
    ssl_show_warn=False # type: ignore
)

# articles_NPTI 테이블 정의
class ArticlesNPTI(Base):
    __tablename__ = 'articles_NPTI'

    news_id = Column(String(100), primary_key=True)
    NPTI_code = Column(String(50), ForeignKey('npti_code.NPTI_code'))
    length_type = Column(String(10))  # L/S
    article_type = Column(String(10))  # T/C
    info_type = Column(String(10))  # F/I
    view_type = Column(String(10))  # P/N
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

# 테이블 생성 함수
def add_db():
    engine = get_engine()
    Base.metadata.create_all(bind=engine, tables=[ArticlesNPTI.__table__])

# 1. length type 분류
def classify_length():
    add_db()
    db = SessionLocal()
    try:
        query = {
            "query": {
                "bool": {
                    "must_not": {
                        "exists": {
                            "field": "length_type"
                        }
                    }
                }
            },
            "_source": ["content"]
        }
        logger.info("[ES]length_type 미분류 기사 탐색 시작")
        rows = helpers.scan(es, index=ES_INDEX, query=query)

        count = 0
        for row in rows:
            news_id = row['_id']
            content = row['_source'].get('content', '')

            # 1. Length 분류
            length_type = 'L' if len(content) >= 800 else 'S'

            article_type = "Z"
            info_type = "Z"
            view_type = "Z"

            combined_code = length_type + article_type + info_type + view_type

            # 4. DB 객체 생성
            length_type_list = ArticlesNPTI(
                news_id=news_id,
                length_type=length_type,
                article_type=article_type,
                info_type=info_type,
                view_type=view_type,
                NPTI_code=combined_code
            )
            # 존재하면 Update, 없으면 Insert
            db.merge(length_type_list)
            count += 1

        db.commit()
        logger.info(f"==========length_type {count}건 분류 및 DB 저장 완료==========")

    except Exception as e:
        logger.error(f"length_type 분류 및 DB 저장 처리 중 오류 발생-[classify_length()]: {e}")
        db.rollback()
    finally:
        db.close()


# 정답데이터로 머신러닝 학습
# 2. article type 분류
def classify_article(news_id:str):
    pass


# 3. information type 분류
def classify_information(news_id:str):
    pass


# 4. viewpoint type 분류
def classify_viewpoint(news_id:str):
    pass

