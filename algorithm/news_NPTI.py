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


# 1. length type 분류
def classify_length(news_id:str):
    try:
        res = es.get(
            index=ES_INDEX,
            id=news_id,
            _source=["content"],
        )
        content = res['_source'].get('content','')
        length = len(content)
    except Exception as e:
        print(f'error 발생 또는 문서 없음 : {e}')
        length = 0

    if length >= 800:
        length_type = 'long'
    else :
        length_type = 'short'
    print(f'{news_id} -> {length_type}')
    return length_type




# 2. article type 분류
def classify_article(news_id:str):
    pass



# 3. information type 분류
def classify_information(news_id:str):
    pass

############################################################# news_aggr 저장하는 함수 따로 만들기 (crawling 함수랑 분리)

# 4. viewpoint type 분류
def classify_viewpoint(news_id:str):
    pass

