from fastapi import FastAPI, Depends, Query
from fastapi.responses import FileResponse
from starlette.responses import JSONResponse
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
from db_index.db_user_info import UserCreateRequest, insert_user
from sqlalchemy import text
import hashlib

app = FastAPI()
logger = Logger().get_logger(__name__)
app.mount("/view",StaticFiles(directory="view"), name="view")

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
@app.post("/users")
def create_user(req: UserCreateRequest, db: Session = Depends(get_db)):
    try:
        insert_user(db, req.model_dump())
        db.commit()
        logger.info(f"회원가입 성공: {req.user_id}")
        return {"success": True, "msg": "회원가입에 성공했습니다"}

    except Exception as e:
        db.rollback()
        logger.error(f"회원가입 오류: {e}")
        return {"success": False, "msg": "회원가입 처리 중 오류가 발생했습니다"}

# 로그인
def verify_password(raw_pw: str, hashed_pw: str) -> bool:
    return hashlib.sha256(raw_pw.encode()).hexdigest() == hashed_pw



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

@app.post("/login")
def login(req: dict, db: Session = Depends(get_db)):
    user_id = req.get("user_id")
    user_pw = req.get("user_pw")

    sql = """
        SELECT user_id, user_pw, activation
        FROM user_info
        WHERE user_id = :user_id
    """
    user = db.execute(text(sql), {"user_id": user_id}).fetchone()

    if not user:
        return {"success": False, "msg": "아이디 또는 비밀번호 오류"}

    if not user.activation:
        return {"success": False, "msg": "비활성화된 계정입니다"}

    if not verify_password(user_pw, user.user_pw):
        return {"success": False, "msg": "아이디 또는 비밀번호 오류"}

    logger.info(f"[LOGIN SUCCESS] {user_id}")
    return {"success": True, "msg": "login success"}

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
                "group": group,
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