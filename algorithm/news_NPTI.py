import sys, os
sys.path.append(os.path.dirname(os.path.abspath(os.path.dirname(__file__))))

import re

import joblib
from datetime import datetime, timezone, timedelta
from logger import Logger
from elasticsearch import Elasticsearch, helpers
from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func
from database import Base, get_engine, SessionLocal

logger = Logger().get_logger(__name__)

# 엘라스틱
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
    NPTI_code = Column(String(50)) #,ForeignKey('npti_code.NPTI_code'))
    length_type = Column(String(10))  # L/S
    article_type = Column(String(10))  # T/C
    info_type = Column(String(10))  # F/I
    view_type = Column(String(10))  # P/N
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

# 테이블 생성 함수
def add_db():
    engine = get_engine()
    Base.metadata.create_all(bind=engine, tables=[ArticlesNPTI.__table__])

# 에러 메세지 ES저장 함수
def err_article(news_id, error_message):
    doc = {
        "news_id": news_id,
        "error_message": str(error_message),
        "error_timestamp": datetime.now(timezone(timedelta(hours=9))).isoformat()
    }
    try:
        es.index(index="err_article", document=doc)
        logger.info(f"[news_NPTI.py] 에러 정보 ES 저장 완료: {news_id}")
    except Exception as e:
        logger.error(f"[news_NPTI.py] ES 에러 로그 저장 중 추가 오류 발생: {e}")

# joblib 로드
base_dir = os.path.dirname(os.path.abspath(__file__))
model_dir = os.path.join(base_dir, "saved_models")
def load_joblib():
    logger.info("joblib 모델 및 벡터 로드 완료")
    return {
        "ct": (
            joblib.load(os.path.join(model_dir, "model_ct.joblib")),
            joblib.load(os.path.join(model_dir, "tfidf_ct.joblib")),
        ),
        "fi": (
            joblib.load(os.path.join(model_dir, "model_fi.joblib")),
            joblib.load(os.path.join(model_dir, "tfidf_fi.joblib")),
        ),
        "pn": (
            joblib.load(os.path.join(model_dir, "model_pn.joblib")),
            joblib.load(os.path.join(model_dir, "tfidf_pn.joblib")),
        ),
    }

# F/I 분류용 사전 및 tokenizer
FACTUAL_VERBS = {
    '말하다','밝히다','전하다','설명하다','주장하다','전해지다'
}

FACT_PATTERNS = {
    "에 따르면","전해졌다","밝혔다","확인됐다","발생했다","조사 결과","경찰은","검찰은","소방은","당국은","관계자는"
}

INSIGHT_KEYWORDS = {
    "의미","맥락","관점","해석","배경","평가",
    "논란","쟁점","문제","시사점","함의",
    "우려","비판","반박","옹호","핵심","본질","원인","영향","파장"
}

def tokenizer_fi(text: str):
    tokens = re.findall(r"[가-힣]{2,}", text)
    result = []

    text_has_fact_pattern = any(p in text for p in FACT_PATTERNS)
    for t in tokens:
        # Insight 키워드는 유지
        if t in INSIGHT_KEYWORDS:
            result.append(t)
        # Fact 패턴이 있는 기사라면
        # FACTUAL_VERBS도 제거하지 않고 유지
        elif text_has_fact_pattern:
            result.append(t)
        # Fact 패턴 없고, 서술 동사면 제거
        elif t in FACTUAL_VERBS:
            continue
        else:
            result.append(t)

    return result

# NPTI 라벨링 함수(joblib 모델 활용)
def classify_npti_fast():
    add_db()
    db = SessionLocal()

    models = load_joblib()
    model_ct, tfidf_ct = models["ct"]
    model_fi, tfidf_fi = models["fi"]
    model_pn, tfidf_pn = models["pn"]

    news_id = None
    try:
        now = datetime.now(timezone(timedelta(hours=9)))
        since = now - timedelta(minutes=5)  # 5분 전 수집된 기사까지만 라벨링 # 이거랑 아래 쿼리문 주석 지워줘야됨

        query = {
            "query": {
                "range": {
                    "@timestamp": {
                        "gte": since.isoformat()
                    }
                }
            },
            "_source": ["content"]
        }
        existing_ids = set(row[0] for row in db.query(ArticlesNPTI.news_id).all())

        rows = helpers.scan(es, index=ES_INDEX, query=query)
        count = 0

        for row in rows:
            news_id = row["_id"]
            if news_id in existing_ids:
                continue

            content = row["_source"].get("content", "")
            if not content:
                continue

            try:
                length_type = "L" if len(content) >= 1000 else "S"
                ct = model_ct.predict(tfidf_ct.transform([content]))[0].upper()
                fi = model_fi.predict(tfidf_fi.transform([content]))[0].upper()
                pn = model_pn.predict(tfidf_pn.transform([content]))[0].upper()

                npti_code = length_type + ct + fi + pn

                record = ArticlesNPTI(
                    news_id=news_id,
                    length_type=length_type,
                    article_type=ct,
                    info_type=fi,
                    view_type=pn,
                    NPTI_code=npti_code,
                    updated_at=now
                )
                db.merge(record)
                count += 1

            except Exception as e:
                logger.error(f"[기사 분류 실패] news_id={news_id} / {e}")
                err_article(news_id, e)
                logger.info(f"기사 분류 실패 에러로그 저장 완료 - {news_id}")
                continue

        db.commit()
        logger.info(f"NPTI 신규 기사 {count}건 분류 완료")

    except Exception as e:
        logger.error(f"[news_NPTI.py] 기사 NPTI 전체 프로세스(joblib) 에러: {e}")
        err_article(news_id, e)
        logger.info(f"[news_NPTI.py] 기사 NPTI 전체 프로세스(joblib) 에러 로그 저장 완료")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("NPTI 분류(joblib) 테스트 시작")
    classify_npti_fast()