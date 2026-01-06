from logger import Logger
from elasticsearch import Elasticsearch

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

def ensure_index():
    body = {
        "mappings": {
            "properties": {
                "user_id": {"type": "keyword"},
                "news_id": {"type": "keyword"},
                "MMF_X_inf": {"type": "float"},
                "MMF_Y_inf": {"type": "float"},
                "MSF_Y_inf": {"type": "float"},
                "mouseX": {"type": "float"},
                "mouseY": {"type": "float"},
                "n_word": {"type": "integer"},
                "timestamp": {"type": "integer"},
                "click": {"type": "integer"},
            }
        }
    }
    if es.indices.exists(index=ES_INDEX):
        logger.info(f"이미 존재하는 index : {ES_INDEX}")
        cnt = es.count(index=ES_INDEX)["count"]  # raw_news 데이터 수를 cnt 변수에 저장
        logger.info(f"문서 수 : {cnt}")
        return None

    try:
        res = es.indices.create(index=ES_INDEX, body=body)
        if res.get("acknowledged"):
            logger.info(f"index 생성 완료 : {ES_INDEX}")
        else:
            logger.error(f"index 생성 실패 : {res}")
    except Exception as e:
        logger.error(f"index 생성 오류 : {e}")

def index_behavior_row(row:dict): # raw_news 데이터를 indexing하는 함수
    es.index(index=ES_INDEX, id=row["news_id"], document=row, refresh="wait_for")

def search_behavior(id_:str):
    try:
        result = es.exists(index=ES_INDEX, id=id_)  # ✅ exists() 사용 (더 빠름)
        logger.info(f"ES 중복 확인 - {id_} : {'기존' if result else '신규'}")
        return result
    except Exception as e:
        logger.error(f"ES 중복 확인 실패 {id_}: {e}")
        return False