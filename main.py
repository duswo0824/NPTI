from fastapi import FastAPI, Depends, Query, Request, Body, HTTPException
from fastapi.responses import FileResponse
from starlette.responses import JSONResponse, RedirectResponse, HTMLResponse
from starlette.staticfiles import StaticFiles
import pandas as pd
import asyncio
from algorithm.user_NPTI import model_predict_proba
from bigkinds_crawling.scheduler import sch_start, result_queue
from bigkinds_crawling.sample import sample_crawling, get_sample
from logger import Logger
from typing import Optional
from bigkinds_crawling.news_raw import news_crawling, get_news_raw, search_article
from bigkinds_crawling.news_aggr_grouping import news_aggr, related_news
from sqlalchemy.orm import Session
from database import get_db
from db_index.db_npti_type import get_all_npti_type, get_npti_type_by_group, npti_type_response, NptiTypeTable
from db_index.db_npti_code import get_all_npti_codes, get_npti_code_by_code, npti_code_response, NptiCodeTable
from db_index.db_npti_question import get_all_npti_questions, get_npti_questions_by_axis, npti_question_response
from db_index.db_user_info import UserCreateRequest, insert_user, authenticate_user
from db_index.db_user_npti import get_user_npti_info
from sqlalchemy import text
from starlette.middleware.sessions import SessionMiddleware
from elasticsearch import Elasticsearch, ConnectionError as ESConnectionError
from datetime import timedelta, datetime, timezone
from db_index.db_user_answers import insert_user_answers
from db_index.db_user_npti import insert_user_npti
import json
from elasticsearch_index.es_user_behavior import index_user_behavior, search_user_behavior
from db_index.db_user_npti import UserNPTITable, UserNPTIResponse
from elasticsearch_index.es_raw import ES_INDEX, search_news_condition
from db_index.db_articles_NPTI import ArticlesNPTI
import math
from datetime import datetime
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI()
logger = Logger().get_logger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"], # 프론트엔드 주소 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/view",StaticFiles(directory="view"), name="view")
app.add_middleware(
    SessionMiddleware,
    secret_key="npti-secret-key",
    # max_age=60 * 60 * 24, #1일
    max_age=int(timedelta(minutes=5).total_seconds()),
    same_site="lax"         # 기본 보안 옵션
)

@app.get("/")
def main():
    return FileResponse("view/html/main.html")



@app.get("/article")
async def view_page():
    return FileResponse("view/html/view.html")

@app.get("/article/{news_id}")
async def get_article(news_id:str):
    news_info = search_article(news_id)
    related = related_news(news_info["title"], news_id, news_info["category"])
    news_info["related_news"] = related
    print(f"related : {related}")
    if news_info:
        return JSONResponse(content=news_info,  status_code=200)
    else:
        return JSONResponse(content=None, status_code=404)


# JS의 sendBeacon('/log/behavior') 경로와 일치시킴
@app.post("/log/behavior")
async def collect_behavior_log(request: Request):
    try:
        # 1. Body 데이터를 Dictionary로 변환 (await 필수)
        data = await request.json()

        # 2. 데이터 확인 (터미널 출력)
        # JS에서 보낸 payload 구조: { news_id, user_id, session_end_time, total_logs, logs }
        news_id = data.get("news_id")
        user_id = data.get("user_id")
        log_count = data.get("total_logs")
        raw_logs = data.get("logs", [])
        stored_time = datetime.now(timezone(timedelta(hours=9))).isoformat(timespec='seconds')

        processed_docs = []
        for log in raw_logs:
            # JS 변수명 -> ES 매핑 변수명 변환
            doc = {
                "user_id": user_id,
                "news_id": news_id,
                "MMF_X_inf": log.get("MMF_X", 0.0),  # JS: MMF_X -> ES: MMF_X_inf
                "MMF_Y_inf": log.get("MMF_Y", 0.0),  # JS: MMF_Y -> ES: MMF_Y_inf
                "MSF_Y_inf": log.get("MSF_Y", 0.0),  # JS: MSF_Y -> ES: MSF_Y_inf
                "mouseX": log.get("mouseX", 0.0),
                "mouseY": log.get("mouseY", 0.0),
                "timestamp": int(log.get("elapsedMs", 0)),
                "baseline": log.get("baseline", 0.0),
                "stored_time": stored_time
            }
            processed_docs.append(doc)

        # 4. [저장] ES 인덱싱
        if processed_docs:
            count = index_user_behavior(processed_docs)
            print(f"[Log] User:{user_id} | News:{news_id} | {count} 개 데이터 저장 완료")
            return {"status": "ok", "message": f"{count}개 로그 저장"}
        else:
            return {"status": "ok", "message": "저장할 로그 없음"}

    except Exception as e:
        print(f"[에러 발생] {e}")
        return {"status": "error", "message": str(e)}


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
@app.get("/scheduler_start") # scheduler 수동 시작
async def scheduler_start():
    if not sch.running:
        sch.start()
        return {'msg': 'scheduler 실행 시작!'}
    else:
        return {'msg': '이미 실행 중입니다.'}

@app.get("/news_aggr")
def news_aggr_start():
    tfid = news_aggr()
    return tfid


@app.get("/read_news_raw")
def read_news_raw(q: Optional[str] = None):
    logger.info(f"ES 데이터 조회 요청: query={q}")
    try:
        news_list = get_news_raw(q)
        if news_list is None:
            return {"status": "error", "message": "데이터를 가져올 수 없습니다."}
        return news_list
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/test")
async def get_test_page():
    return FileResponse("view/html/test.html")


@app.get("/npti/q")
async def get_questions(request: Request, db: Session = Depends(get_db)):
    if not request.session.get("user_id"):
        return JSONResponse(status_code=401, content={"message": "로그인 필요"})

    query = text("SELECT question_id, question_text, npti_axis, question_ratio FROM npti_question")
    result = db.execute(query).fetchall()
    return [dict(row._mapping) for row in result]


@app.post("/test")
async def save_test_result(request: Request, payload: dict = Body(...), db: Session = Depends(get_db)):
    user_id = request.session.get("user_id")
    if not user_id:
        return JSONResponse(status_code=401, content={"success": False, "message": "로그인이 필요합니다."})

    try:
        # 개별 답변 데이터 가공 및 저장 (insert_user_answers 호출)
        answers_list = [
            {"question_no": int(str(q_id).replace('q', '')), "answer_value": val}
            for q_id, val in payload.get("answers", {}).items()
        ]
        insert_user_answers(db, user_id, answers_list)

        # NPTI 결과 데이터 가공 (insert_user_npti 호출)
        scores = payload.get("scores", {})
        npti_params = {
            "user_id": user_id,
            "npti_code": payload.get("npti_result"),
            "length_score": scores.get('length'),
            "article_score": scores.get('article'),
            "information_score": scores.get('info') or scores.get('information') or 0,
            "view_score": scores.get('view')
        }
        insert_user_npti(db, npti_params)

        db.commit()  # 최종 커밋
        request.session['hasNPTI']=True
        request.session['npti_result'] = payload.get("npti_result")
        return {"success": True, "message": "저장 완료"}

    except Exception as e:
        db.rollback()
        return JSONResponse(status_code=500, content={"success": False, "message": str(e)})

@app.get("/result")
async def get_result_page():
    return FileResponse("view/html/result.html")

@app.post("/result")
def api_get_result_data(request: Request, db: Session = Depends(get_db)):
    try:
        user_id = request.session.get("user_id")
        user_name = request.session.get("user_name", "독자")

        if not user_id:
            return {"isLoggedIn": False, "hasNPTI": False}

        # 1. 최신 데이터 조회 (일반 함수 호출)
        user_data = get_user_npti_info(db, user_id)

        if not user_data:
            return {"isLoggedIn": True, "hasNPTI": False, "user_name": user_name}

        # 2. 날짜 직렬화 (JSON 에러 방지 핵심)
        if user_data.get('updated_at') and isinstance(user_data['updated_at'], datetime):
            user_data['updated_at'] = user_data['updated_at'].strftime('%Y-%m-%d %H:%M:%S')

        # 3. 통합 데이터 반환 (컬럼명 이슈 해결을 위해 별칭을 사용하는 함수들)
        return {
            "isLoggedIn": True,
            "hasNPTI": True,
            "user_name": user_name,
            "user_npti": user_data,
            "code_info": get_npti_code_by_code(db, user_data['npti_code']), # 여기서 에러 해결됨
            "all_types": get_all_npti_type(db) # 여기서도 info_type AS information_type 적용 필요
        }
    except Exception as e:
        print(f"서버 에러 상세: {str(e)}")
        return JSONResponse(status_code=500, content={"message": str(e)})


@app.get("/search")
def main():
    return FileResponse("view/html/search.html")


es = Elasticsearch(
    "http://localhost:9200",
    basic_auth=("elastic", "elastic"),
    verify_certs=False
)

FIELD_MAP = {
    "title": "title_tokens",
    "content": "content_tokens",
    "media": "media",
    "category": "category"
}

@app.post("/search")
def search_news(payload: dict = Body(...)):
    # 1. 요청 데이터 추출
    query_obj = payload.get("query", {}).get("multi_match", {})
    q = query_obj.get("query", "")
    fields = query_obj.get("fields", ["title", "content", "media", "category"])

    from_idx = payload.get("from", 0)
    size = payload.get("size", 20)
    sort_option = payload.get("sort", ["_score"])

    # 검색어 공백 방어
    if not q.strip():
        return {"hits": {"total": {"value": 0}, "hits": []}}

    # 2. 필드 매핑 및 검색 Body 구성 (FIELD_MAP을 통해 실제 토큰 필드명으로 변환)
    field_list = [FIELD_MAP.get(f, f) for f in fields]

    search_condition = {
        "query": {
            "multi_match": {
                "query": q,
                "fields": field_list,
                "operator": "or"
            }
        },
        "from": from_idx,
        "size": size,
        "sort": sort_option
    }

    try:
        # 3. ES 검색 실행 (JS 렌더링에 필요한 필드들을 _source에 명시)
        res = es.search(
            index="news_raw",
            body=search_condition,
            _source=["title", "content", "media", "category", "img", "pubdate"]
        )
        return res  # Elasticsearch 응답 구조 그대로 반환

    except ESConnectionError as e:
        logger.error(f"ES 연결 실패: {e}")
        return {"hits": {"total": {"value": 0}, "hits": []}}
    except Exception as e:
        logger.error(f"검색 오류: {e}")
        return {"hits": {"total": {"value": 0}, "hits": []}}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
    # ----------------------------------------------------------------------------
@app.get("/npti/types", response_model=list[npti_type_response])
def npti_type_list(db: Session = Depends(get_db)):
    try:
        return get_all_npti_type(db)
    except Exception as e:
        logger.error(f"실행 중 오류 발생: {e}")


@app.get("/npti/types/group", response_model=list[npti_type_response])
def npti_type_by_group(group: str = Query(...), db: Session = Depends(get_db)):
    try:
        return get_npti_type_by_group(db, group)
    except Exception as e:
        logger.error(f"실행 중 오류 발생: {e}")


@app.get("/npti/codes", response_model=list[npti_code_response])
def npti_code_list(db: Session = Depends(get_db)):
    try:
        return get_all_npti_codes(db)
    except Exception as e:
        logger.error(f"실행 중 오류 발생: {e}")

@app.get("/npti/codes/{code}", response_model=npti_code_response)
def npti_code_detail(code: str, db: Session = Depends(get_db)):
    try:
        result = get_npti_code_by_code(db, code)
        if not result:
            return {'msg': 'npti_code를 찾을 수 없습니다.'}
        return result
    except Exception as e:
        logger.error(f"실행 중 오류 발생: {e}")

# 관리자
@app.get("/npti/questions", response_model=list[npti_question_response])
def npti_question_list(db: Session = Depends(get_db)):
    try:
        return get_all_npti_questions(db)
    except Exception as e:
        logger.error(f"실행 중 오류 발생: {e}")

# 사용자
@app.get("/npti/questions/axis", response_model=list[npti_question_response])
def npti_question_by_axis(axis: str = Query(...), db: Session = Depends(get_db)):
    try:
        return get_npti_questions_by_axis(db, axis)
    except Exception as e:
        logger.error(f"실행 중 오류 발생: {e}")

# 가입용
@app.get("/signup")
async def get_signup_page():
    # 사용자가 /signup 주소로 들어오면 html 파일을 보여줍니다.
    return FileResponse("view/html/signup.html")

# 2. [POST] 회원가입 데이터 처리하기
@app.post("/signup")
def create_user(req: UserCreateRequest, db: Session = Depends(get_db)):
    # DB에 사용자 저장
    insert_user(db, req.model_dump())
    db.commit()
    return {"success":True}

@app.get("/users/check-id")
def check_user_id(user_id: str, db: Session = Depends(get_db)):
    sql = """
        SELECT 1
        FROM user_info
        WHERE user_id = :user_id
        LIMIT 1
    """
    exists = db.execute(text(sql), {"user_id": user_id}).first() is not None
    return {"exists": exists}

# 로그인
@app.get("/login")
def page_login():
    return FileResponse("view/html/login.html")

@app.post("/login")
def login(req: dict, request: Request, db: Session = Depends(get_db)):
    user_id = req.get("user_id")
    user_pw = req.get("user_pw")

    # 1. 인증 확인
    if not authenticate_user(db, user_id, user_pw):
        return {"success": False, "message": "ID 또는 비밀번호가 틀립니다."}

    # 2. DB에서 데이터 가져오기
    raw_data = get_user_npti_info(db, user_id)

    # 3. 세션 저장
    request.session["user_id"] = user_id


    if raw_data: # 유저 NPTI가 있을 경우
        # 💡 핵심: 복잡한 객체 전체를 넣지 말고,
        # 필요한 'npti_code'(문자열)만 딱 골라서 넣습니다.
        # 이렇게 하면 RowMapping이나 날짜 에러가 전혀 발생하지 않습니다.
        request.session["npti_result"] = raw_data["npti_code"]
        request.session["hasNPTI"] = True
    else:# 유저 NPTI가 없을 경우
        request.session["npti_result"] = None
        request.session["hasNPTI"] = False

    return {"success": True}

#로그인 상태를 확인
@app.get("/auth/me")
def auth_me(request: Request):
    session = request.session

    user_id = session.get("user_id")
    npti_result = session.get("npti_result")
    logger.info(npti_result)

    return {
        # 로그인 여부
        "isLoggedIn": bool(user_id),

        # 세션 유효성 (이 요청에 도달했으면 True)
        "isSessionValid": True,

        # 부가 정보
        "user_id": user_id,
        "hasNPTI": bool(npti_result),
        "nptiResult": npti_result
    }

@app.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {
        "success": True
    }

@app.get("/api/about")
def get_about(db: Session = Depends(get_db)):

    # 1. NPTI 기준 (npti_type)
    type_rows = db.execute("""
        SELECT npti_group, npti_type, npti_kor
        FROM npti_type
        ORDER BY npti_group, npti_type
    """).fetchall()

    grouped = {}
    for r in type_rows:
        grouped.setdefault(r.npti_group, []).append(r)

    criteria = []
    for group, items in grouped.items():
        if len(items) == 2:
            left, right = items
            criteria.append({
                "title": group.capitalize(),
                "left": f"{left.npti_type} - {left.npti_kor}",
                "right": f"{right.npti_type} - {right.npti_kor}"
            })

    # 2. NPTI 성향 (npti_code)
    code_rows = db.execute("""
        SELECT npti_code, type_nick, type_de,
               length_type, article_type, info_type, view_type
        FROM npti_code
        ORDER BY npti_code
    """).fetchall()

    guides = []
    for r in code_rows:
        guides.append({
            "code": r.npti_code,
            "name": r.type_nick,
            "desc": r.type_de,
            "pref": "",  # 또는 실제 선호 설명 컬럼
            "types": [
                r.length_type,
                r.article_type,
                r.info_type,
                r.view_type
            ]
        })

    return {
        "intro": {
            "title": "NPTI란?",
            "content": "NPTI는 뉴스 소비 성향을 분석해 개인에게 맞는 뉴스 경험을 제공하는 지표입니다."
        },
        "criteria": criteria,
        "guides": guides
    }

@app.get("/mypage")
async def get_mypage_page():
    return FileResponse("view/html/mypage.html")

@app.post("/mypage")
async def mypage(req: Request, db: Session = Depends(get_db)):
    pass # 실직적으로 처리하는 곳


@app.get("/user/npti/{user_id}")
async def get_user_npti(user_id: str, db: Session = Depends(get_db)):
    # 1. user_npti와 npti_code 테이블 조인 (기본 정보 및 별칭 조회)
    result = db.query(
        UserNPTITable,
        npti_code_response.type_nick
    ).join(
        npti_code_response, UserNPTITable.npti_code == npti_code_response.npti_code
    ).filter(
        UserNPTITable.user_id == user_id
    ).first()

    if not result:
        raise HTTPException(status_code=404, detail="NPTI data not found")
    user_data, type_nick = result
    npti_code_str = user_data.npti_code  # 예: 'STFN'

    # 2. 각 알파벳에 매칭되는 npti_kor 값 가져오기 (npti_type 테이블 조회)
    # npti_type 테이블에서 NPTI_type 컬럼이 코드에 포함된 것들만 조회
    chars = list(npti_code_str)
    type_items = db.query(npti_type_response).filter(npti_type_response.NPTI_type.in_(chars)).all()

    # 순서(S-T-F-N)에 맞게 딕셔너리로 맵핑 생성
    kor_map = {item.NPTI_type: item.npti_kor for item in type_items}

    # 최종 리스트 생성 (예: ["짧은", "이야기형", "객관적", "비판적"])
    npti_kor_list = [kor_map.get(c, "") for c in chars]

    return {
        "user_id": user_data.user_id,
        "npti_code": npti_code_str,
        "type_nick": type_nick,
        "npti_kor_list": npti_kor_list,  # 프론트에서 사용할 한글 명칭 리스트
        "updated_at": user_data.updated_at
    }


@app.get("/curated/news")
async def get_curated_news(
        npti: str = Query(...),
        category: str = "all",
        sort_type: str = "accuracy",
        db: Session = Depends(get_db)
):
    # DB에서 해당 NPTI_code를 가진 news_id 리스트를 먼저 가져옴
    news_ids = db.query(ArticlesNPTI.news_id).filter(
        ArticlesNPTI.NPTI_code == npti
    ).all()

    id_list = [id[0] for id in news_ids]
    if not id_list:
        return {"articles": []}

    # ES 쿼리 작성
    body = {
        "query": {
            "bool": {
                "must": [{"terms": {"news_id": id_list}}]
            }
        }
    }

    # 3. 정렬 조건 처리
    if sort_type == "latest":  # == 양옆에 공백 추가
        # 최신순 정렬 로직
        body["sort"] = [
            {"pubdate": {"order": "desc"}},
            #{"pubtime": {"order": "desc"}}
        ]
    else:
        # 정확도순 (디폴트)
        body["sort"] = [{"_score": {"order": "desc"}}]

    if category != "all":
        body["query"]["bool"]["filter"] = [{"term": {"category": category}}]

    try:
        res = es.search(index=ES_INDEX, body=body)
        hits = res["hits"]["hits"]

        # 3. 기존 search_article의 데이터 가공 방식을 그대로 활용
        articles = []
        for hit in hits:
            src = hit["_source"]
            news_info = {
                "id": src.get("news_id", ""),
                "title": src.get("title", ""),
                "summary": src.get("content", "")[:150] + "...",  # UI에 맞게 요약
                "publisher": src.get("media", ""),
                "date": src.get("pubdate", ""),
                "thumbnail": src.get("img", ""),
                "category": src.get("category", "")
            }
            articles.append(news_info)

        return {"articles": articles}
    except Exception as e:
        logger.error(f"큐레이션 뉴스 검색 오류: {e}")
        return {"articles": []}

@app.get("/update_user_npti")
def update_user_npti(request: Request, db: Session = Depends(get_db)):
    user_id = request.session.get("user_id")
    # user_id가 세션에 없는 경우 추가해야함
    latest_user_npti = get_user_npti_info(db, user_id)
    latest_update_time = latest_user_npti.get('timestamp')
    behavior_log_per_news = search_user_behavior(user_id, latest_update_time) # [[{},{}],[{},{},{},],[{}]] 형태
    for behavior_log in behavior_log_per_news: # [{},{}]
        if not behavior_log:
            continue
        result = model_predict_proba(behavior_log)# {userid:, news_id:, dwell time:, final_read_time:, reading_efficiency: } 같은 dictionary
        reading_efficiency = result.get('reading_efficiency')
        news_id = result.get('news_id')
        body = {"query": {"term": {"news_id": "검색할_news_id"}},"_source": ["content"],"script_fields": {"word_count": {"script": {"lang": "painless",
        "source": """if (params['_source']['content'] != null && params['_source']['content'].trim().length() > 0) {
            return params['_source']['content'].trim().splitOnTokenizePattern(/\\s+/).length;}return 0;"""}}}}
        response = search_news_condition(body)
        if response and response['hits']['hits']:
            n_word = response['hits']['hits'][0]['fields']['word_count'][0]
        interest_score = min(1, reading_efficiency * (math.log(n_word+1) / math.log(500+1)))
        user_npti = get_user_npti_info(db, user_id)
        news_npti = None # ------------------------------------------------------- 성은님 질문?????
        # user_npti 점수에 interest_score 반영하는 로직 !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! (까먹으면 안됨)
    return None

async def update_state_loop():
    while True:
        if not result_queue.empty():
            latest_breaking = result_queue.get()
            if isinstance(latest_breaking, dict) and "final_group" in latest_breaking:
                app.state.breaking_news = latest_breaking
                print("New breaking news data updated!")
        await asyncio.sleep(1)

@app.on_event("startup")
async def startup_event():
    if not sch.running:
        sch.start()
    app.state.breaking_news = {'msg':'스케쥴러 가동 중 - 데이터 준비 중'} # 초기값
    asyncio.create_task(update_state_loop())

@app.get("/render_breaking")
def render_breaking():
    grouping_result = getattr(app.state, "breaking_news", {"msg": "데이터가 아직 없습니다."})
    breaking_topic = grouping_result.get('final_group') # None or ['news_id1', 'news_id2']
    if not breaking_topic:
        return {"breaking_news": None, "msg":"데이터 없음"}
    id_title_list = []
    for topic in breaking_topic:
        query = {"size": 1,"_source": ["news_id", "title", "timestamp"],
          "query": {"terms": {"news_id": topic}},
          "sort": [{"timestamp": {"order": "desc"}}]}
        res = search_news_condition(query)
        if res and res.get("hits") and res["hits"]["hits"]:
            first_hit = res["hits"]["hits"][0]["_source"]
            id_title = {"id":first_hit["news_id"], "title":first_hit["title"]}
            id_title_list.append(id_title)

    return {"breaking_news": id_title_list, "msg":"데이터 있음"}