from fastapi import FastAPI, Depends, Query, Request, Body
from fastapi.responses import FileResponse
from starlette.responses import JSONResponse, RedirectResponse
from starlette.staticfiles import StaticFiles
from bigkinds_crawling.scheduler import sch_start
from bigkinds_crawling.sample import sample_crawling, get_sample
from logger import Logger
from typing import Optional
from bigkinds_crawling.news_raw import news_crawling, get_news_raw, search_article
from bigkinds_crawling.news_aggr_grouping import news_aggr, related_news
from sqlalchemy.orm import Session
from database import get_db
from db_index.db_npti_type import get_all_npti_type, get_npti_type_by_group, npti_type_response
from db_index.db_npti_code import get_all_npti_codes, get_npti_code_by_code, npti_code_response
from db_index.db_npti_question import get_all_npti_questions, get_npti_questions_by_axis, npti_question_response
from db_index.db_user_info import UserCreateRequest, insert_user, authenticate_user, get_my_page_data
from db_index.db_user_npti import get_user_npti
from sqlalchemy import text
from starlette.middleware.sessions import SessionMiddleware
from elasticsearch import Elasticsearch, ConnectionError as ESConnectionError
from datetime import timedelta
from db_index.db_user_answers import insert_user_answers
from db_index.db_user_npti import upsert_user_npti
import json
from elasticsearch_index.es_user_behavior import index_user_behavior

app = FastAPI()
logger = Logger().get_logger(__name__)
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


# @app.get("/news/ticker")
# async def get_ticker_news():
#     try:
#         # 1. 스케줄러(/scheduler_start)가 5분마다 갱신한 그룹 데이터 호출
#         # final_groups 예시: [ ["id1", "id2"], ["id3"], ... ]
#         final_groups = news_aggr()
#
#         if not final_groups:
#             return {"data": []}
#
#         ticker_data = []
#
#         # 2. 각 그룹(주제별 묶음)을 순회하며 가장 최신 기사 선별
#         for group in final_groups:
#             if not group:
#                 continue
#
#             # [수정] timestamp 필드를 기준으로 가장 늦은(최신) 1건 조회
#             res = es.search(index="news_raw", body={
#                 "query": {"ids": {"values": group}},
#                 "sort": [{"timestamp": {"order": "desc"}}],  # 최신 수집 시간 기준
#                 "size": 1
#             })
#
#             hits = res['hits']['hits']
#             if hits:
#                 latest_news = hits[0]
#                 ticker_data.append({
#                     "_id": latest_news['_id'],
#                     "title": latest_news['_source'].get('title', '제목 없음')
#                 })
#
#         # 3. 분석된 모든 주제의 대표 기사 리스트 반환
#         return {"data": ticker_data}
#
#     except Exception as e:
#         # 에러 발생 시 빈 배열을 반환하여 Ticker를 숨김 처리
#         print(f"Ticker 추출 중 오류 발생: {e}")
#         return {"data": []}

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
                "baseline": log.get("baseline", 0.0)
            }
            processed_docs.append(doc)

        # 4. [저장] ES 인덱싱 함수 호출
        count = index_user_behavior(processed_docs)

        print(f"[수신 성공] User: {user_id} | News: {news_id} | Logs: {log_count}개 | ES 저장: {count}건")
        return {"status": "ok", "message": f"Saved {count} logs"}

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
@app.get("/scheduler_start")
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

        # NPTI 결과 데이터 가공 (upsert_user_npti 호출)
        scores = payload.get("scores", {})
        npti_params = {
            "user_id": user_id,
            "npti_code": payload.get("npti_result"),
            "length_score": scores.get('length'),
            "article_score": scores.get('article'),
            "info_score": scores.get('info'),
            "view_score": scores.get('view')
        }
        upsert_user_npti(db, npti_params)

        db.commit()  # 최종 커밋
        return {"success": True, "message": "저장 완료"}

    except Exception as e:
        db.rollback()
        return JSONResponse(status_code=500, content={"success": False, "message": str(e)})

@app.get("/result")
async def get_result_page():
    return FileResponse("view/html/result.html")

@app.post("/result")
async def api_get_result_data(request: Request, db: Session = Depends(get_db)):
    """결과 페이지에 필요한 모든 DB 데이터 통합 조회"""
    user_id = request.session.get("user_id")
    if not user_id:
        return JSONResponse(status_code=401, content={"success": False})

    # 유저 점수 조회
    user_npti = get_user_npti(db, user_id)
    if not user_npti:
        return {"hasResult": False}

    # 유형 상세 설명(닉네임 등) 및 차트 라벨 정보 조회
    code_info = get_npti_code_by_code(db, user_npti['npti_code'])
    all_types = get_all_npti_type(db)

    return {
        "hasResult": True,
        "user_npti": user_npti,
        "code_info": code_info,
        "all_types": all_types
    }

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
    success = authenticate_user(
        db,
        req.get("user_id"),
        req.get("user_pw")
    )

    if not success:
        return {"success": False}

    # 세션 저장
    request.session["user_id"] = req.get("user_id")

    # JSON만 반환 (페이지 이동 X)
    return {"success": True}

#로그인 상태를 확인
@app.get("/auth/me")
def auth_me(request: Request):
    session = request.session

    user_id = session.get("user_id")
    npti_result = session.get("npti_result")

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

# 마이페이지 프로필 조회 - (추가)
@app.get("/users/me/profile")
def read_my_profile(request: Request, db: Session = Depends(get_db)):
    user_id = request.session.get("user_id")
    if not user_id:
        return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

    profile_data = get_my_page_data(db, user_id)

    if not profile_data:
        request.session.clear()
        return JSONResponse(status_code=404, content={"detail": "User not found"})

    return profile_data

# NPTI 결과 조회
@app.get("/users/me/npti")
def read_my_npti(
    request: Request,
    db: Session = Depends(get_db)
):
    user_id = request.session.get("user_id")

    # 로그인 안 됨 → 사실만 반환
    if not user_id:
        return {
            "hasResult": False,
            "reason": "not_logged_in"
        }

    result = get_user_npti(db, user_id)

    if not result:
        return {
            "hasResult": False,
            "reason": "no_result"
        }

    return {
        "hasResult": True,
        "data": result
    }
