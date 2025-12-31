from fastapi import FastAPI
from bigkinds_crawling.scheduler import sch_start
from bigkinds_crawling.sample import sample_crawling, get_sample
from logger import Logger
from typing import Optional
from bigkinds_crawling.news_raw import news_crawling, get_news_raw
from bigkinds_crawling.news_aggr_grouping import news_aggr

app = FastAPI()
logger = Logger().get_logger(__name__)


@app.get("/sample")
def sample(max_pages: int = 90):
    logger.info(f"API 호출: 크롤링 시작 (최대 {max_pages} 페이지)")
    try:
        # 비즈니스 로직 호출
        result = sample_crawling(max_pages=max_pages)
        return {"status": "success","count": len(result),"data": result}
    except Exception as e:
        logger.error(f"API 실행 오류: {e}")
        return {"status": "error", "message": str(e)}


@app.get("/sample_csv")
def sample_csv(q: Optional[str] = None):
    logger.info(f"ES 데이터 요청 수신 (query: {q})")
    try:
        result = get_sample(q)
        if result is None:
            return {"status": "error", "message": "데이터를 가져올 수 없습니다."}
        return result
    except Exception as e:
        logger.error(f"API 실행 오류: {e}")
        return {"status": "error", "message": str(e)}


@app.get("/news_raw")
def news_raw(max_pages: int = 5):
    logger.info(f"크롤링 시작: 최대 {max_pages} 페이지")
    try:
        # sample.py의 crawling 함수 호출
        result = news_crawling(max_pages=max_pages)
        return {"status": "success","count": len(result),"data": result}
    except Exception as e:
        logger.error(f"API 실행 중 오류 발생: {e}")
        return {"status": "error", "message": str(e)}

sch = sch_start()
@app.get("/scheduler_start")
async def scheduler_start():
    if not sch.running:
        sch.start()
        return {'msg': 'scheduler 실행 시작!'}
    else:
        return {'msg': '이미 실행 중입니다.'}




@app.get("/news_raw_csv")
def news_raw_csv(q: Optional[str] = None):
    logger.info(f"ES 데이터 조회 요청: query={q}")
    try:
        news_list = get_news_raw(q)
        if news_list is None:
            return {"status": "error", "message": "데이터를 가져올 수 없습니다."}
        return news_list
    except Exception as e:
        return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)