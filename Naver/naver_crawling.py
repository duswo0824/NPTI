# pip install lxml
import time
import random
import hashlib
import traceback

import requests
from bs4 import BeautifulSoup, Tag
from fastapi import FastAPI
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from elasticsearch import Elasticsearch
from logger import Logger
from datetime import datetime, timezone, timedelta
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.executors.pool import ThreadPoolExecutor
#from kiwipiepy import Kiwi

@asynccontextmanager
async def lifespan(app: FastAPI):

    executors = {
        'default': ThreadPoolExecutor(1)  # 크롤링은 동시에 여러 개 실행되지 않도록 제한
    }
    job_defaults = {
        'coalesce': True,  # 여러 번 실행될 상황이면 한 번만 실행
        'max_instances': 1  # 동일 작업은 무조건 1개만 실행 (중복 실행 방지)
    }
    scheduler = BackgroundScheduler(executors=executors, job_defaults=job_defaults)
    # 30분 주기, 5분 지터
    scheduler.add_job(
        scheduled_task,
        'interval',
        seconds=1800,
        jitter=300,
        id="naver_news_job"  # 작업 식별자 추가
    )

    #scheduled_task() # uvicorn 연결 하자마자 스케줄러 실행
    scheduler.start()
    logger.info("NAVER 뉴스 크롤링 스케줄러 활성화(30분 주기)")

    yield

    scheduler.shutdown()
    logger.info("NAVER 크롤링 스케줄러 종료")

app = FastAPI(lifespan=lifespan)
logger = Logger().get_logger(__name__)

# ---------- [설정] 엘라스틱서치 연결 ----------
# 엘라스틱서치 서버 주소 및 인덱스 이름 설정
ES_HOST = "http://localhost:9200"
INDEX_NAME = "news_raw"
es = Elasticsearch(ES_HOST)


# ---------- [설정] Selenium 드라이버 초기화 함수 ----------
def get_safe_driver():
    try:
        chrome_options = Options()
        # 1. 자동화 탐지 방지 설정 # '이 브라우저는 자동화 소프트웨어에 의해 제어되고 있습니다' 문구 제거
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        # 2. 실제 브라우저처럼 보이게 헤더 설정
        chrome_options.add_argument(
            "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36")
        chrome_options.add_argument("--window-size=1920,1080")  # 창 크기 고정
        # 3. 리소스 절약을 위해 headless 모드 권장 (필요시 주석 해제)
        # chrome_options.add_argument("--headless")

        # webdriver 속성을 undefined로 만들어 탐지 방지
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
        driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
            "source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        })
        return driver
    except Exception as e:
        logger.error(f"Selenium 드라이버 초기화 실패:{e}")
        logger.error(traceback.format_exc())
        return None


# ---------- 중복 확인 함수 (엘라스틱서치 조회) ----------
def id_dupl(news_id):
    try:
        if not es.ping():
            logger.error("ES 서버 연결 끊김")
            return True  # 안전을 위해 중복으로 간주하여 저장 시도 방지
        return es.exists(index=INDEX_NAME, id=news_id)
    except Exception as e:
        logger.error(f"ES PK 중복 확인 중 에러 발생 (ID: {news_id}): {e}")
        return False


# ---------- 기사 상세 feature 가지고 오기(본문,원문URL,언론사,발행일,발행시간,카테고리,기자,이미지URL,이미지캡션) ----------
def get_article_detail(url, category_name):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()  # 404, 500 에러 체크
        soup = BeautifulSoup(response.text, "lxml")

        # 6. URL(기사 원문)
        origin_link = soup.select_one("a.media_end_head_origin_link")
        URL = origin_link.get("href") if origin_link else None

        # 1. 본문
        content_area = soup.select_one("article#dic_area")
        if not content_area: return None

        # 1-1. 첫 번째 이미지 및 캡션 추출 (제거하기 전에 미리 저장)
        imgURL = None
        imgCaption = None
        first_photo = content_area.select_one("span.end_photo_org")
        if first_photo:
            img_tag = first_photo.select_one("img")
            cap_tag = first_photo.select_one("em.img_desc")
            if img_tag:
                imgURL = img_tag.get("src") or img_tag.get("data-src")
            if cap_tag:
                imgCaption = cap_tag.get_text(strip=True)

        # 1-2. 본문 정제 (광고, 캡션, 이미지, 표 등 불필요한 요소 통째로 삭제)
        for junk in content_area.select("table, .link_tagger, .script_tag, span.end_photo_org, div.ad_body_res"):
            junk.decompose()

        # 1-3. 순수 텍스트만 추출
        content = content_area.get_text("\n", strip=True)

        # 2. 발행일자(pubdate/pubtime 분리)
        date_tag = soup.select_one("span.media_end_head_info_datestamp_time")

        pubdate = None
        pubtime = None

        if date_tag:
            raw_date = date_tag.get("data-date-time")
            if raw_date:  # raw_date 예시: "2023-10-27 14:30:01"
                date_parts = raw_date.split(" ")
                if len(date_parts) == 2:
                    pubdate = date_parts[0]
                    pubtime = date_parts[1]
            else:
                # 2순위: 속성이 없을 경우 텍스트 직접 파싱 (예외 방식)
                # 예: "2025.12.19. 오전 10:16"
                text_date = date_tag.get_text(strip=True)

                # 마침표와 공백을 기준으로 분리
                parts = text_date.replace("..", ".").split(". ")
                if len(parts) >= 3:
                    # 연-월-일 형식을 맞추기 위해 zfill(2) 사용 (예: 1 -> 01)
                    pubdate = f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
                    pubtime = parts[3] if len(parts) > 3 else None

        # 3. 기자명
        writer_tag = soup.select_one("span.byline_s") or soup.select_one("em.media_end_head_journalist_name")
        writer = writer_tag.get_text(strip=True).replace("기자","").strip() if writer_tag else None

        # 4. 카테고리
        category_tag = soup.select_one("em.media_end_categorize_item") or soup.select_one("a._current")
        category = category_tag.get_text(strip=True) if category_tag else category_name
        if "생활/문화" in category_name:
            category = "생활/문화"

        # 5. 언론사
        media_tag = soup.select_one("span.media_end_head_top_logo_text") or soup.select_one(
            "img.media_end_head_top_logo_img")
        if media_tag:
            # img 태그면 alt를, 아니면 text를 가져옴
            media = media_tag.get("alt") if media_tag.name == "img" else media_tag.get_text(strip=True)

        return {
            "content": content.strip(),
            "URL": URL,
            "media": media,
            "pubdate": pubdate,
            "pubtime": pubtime,
            "writer": writer,
            "imgURL": imgURL,
            "imgCaption": imgCaption,
            "category": category
        }
    except Exception as e:
        logger.error(f"기사 상세 수집 실패 ({url}): {e}")
        return None


# ---------- [스포츠/연예]기사 상세 feature 가지고 오기(본문,원문URL,언론사,발행일,발행시간,카테고리,기자,이미지URL,이미지캡션) ----------
def get_sports_article_detail(url, category_name):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'}
    try:
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, "lxml")

        # 동영상 영역 존재 여부 확인
        video_element = soup.select_one("div.video_area, div[id^='video_area_']")
        if video_element:
            logger.info(f"[SKIP] 동영상이 포함된 기사입니다: {url}")
            return None

        # 본문
        content_area = soup.select_one("#comp_news_article ._article_content")
        if not content_area: return None

        # 첫 번째 이미지 및 캡션 추출
        imgURL = None
        imgCaption = None
        img_wrap = soup.select_one("span[class*='ArticleImage_image_wrap']")
        if img_wrap:
            img_tag = img_wrap.select_one("img")
            if img_tag: imgURL = img_tag.get("src")
            cap_tag = img_wrap.find_next(["em", "p"], class_=lambda x: x and ("img_desc" in x or "caption" in x))
            if cap_tag: imgCaption = cap_tag.get_text(strip=True)

        # 2. 본문 정제
        for junk in content_area.select("div[class*='ArticleImage_image_wrap'], em.img_desc, p.caption, div.ad_area"):
            junk.decompose()

        content = content_area.get_text("\n", strip=True)

        # 원문 URL
        origin_link = soup.select_one("#content a[class*='DateInfo_link_origin_article']")
        URL = origin_link.get("href") if origin_link else None

        # 언론사
        media = ""
        media_tag = soup.select_one("a.link_media img, #content a[class*='PressLogo'] img")
        if media_tag:
            media = media_tag.get("alt", "").strip()

        if not media:
            media_text_tag = soup.select_one("em[class*='JournalistCard_press_name']")
            if media_text_tag:
                media = media_text_tag.get_text(strip=True)

        # 날짜 추출
        date_tag = soup.select_one("em.date")
        pubdate, pubtime = None, None
        if date_tag:
            text_date = date_tag.get_text(strip=True)  # 예: "2025.12.19. 오전 10:16"
            parts = text_date.split()
            if len(parts) >= 1:
                date_str = parts[0].rstrip('.')
                d_parts = date_str.split('.')
                if len(d_parts) == 3:
                    pubdate = f"{d_parts[0]}-{d_parts[1].zfill(2)}-{d_parts[2].zfill(2)}"
            if len(parts) >= 2:
                pubtime = " ".join(parts[1:])

        # 기자명 추출
        writer_tag = soup.select_one("em[class*='JournalistCard_name']")
        if writer_tag:
            writer = writer_tag.get_text(strip=True).replace("기자", "").strip()
        else:
            writer = ""  # None 대신 빈 문자열 할당

        return {
            "content": content,
            "URL": URL,
            "media": media,
            "pubdate": pubdate,
            "pubtime": pubtime,
            "writer": writer,
            "imgURL": imgURL,
            "imgCaption": imgCaption,
            "category": "스포츠"
        }
    except Exception as e:
        logger.error(f"스포츠 기사 상세 수집 실패 ({url}): {e}")
        return None

################################################################################################################
# 전체 크롤링 함수
def crawler_naver():
    logger.info("=====NAVER 크롤링 프로세스 시작=====")
    start_time = time.time()

    # ES 인덱스 생성 체크
    try:
        if not es.indices.exists(index=INDEX_NAME):
            es.indices.create(index=INDEX_NAME)
    except Exception as e:
        logger.error(f"ES 인덱스 체크 실패: {e}")
        return

    driver = get_safe_driver()
    if not driver:
        return
    try:
        # 일반 기사 크롤링
        crawling_general_news(driver)
        # 스포츠 기사 크롤링
        crawling_sports_news(driver)
        # 연예 기사 크롤링
        crawling_enter_news(driver)
    except Exception as e:
        logger.error(f"메인 크롤링 루프 에러: {e}")
    finally:
        if driver:
            driver.quit()
            logger.info(f"드라이버 종료 및 NAVER 크롤링 프로세스 완료 / {time.time()-start_time:.2f}초 소요")

################################################################################################################
# 일반기사 크롤링 함수
def crawling_general_news(driver):
    #kiwi = Kiwi()
    categories_map = {"사회": "102",
                      "생활/문화(일반)": "103/245"
                      }

    for cat_name, cat_id in categories_map.items():
        start_time = time.time()

        try:
            if "/" in cat_id:
                url = f"https://news.naver.com/breakingnews/section/{cat_id}"
            else:
                url = f"https://news.naver.com/section/{cat_id}"
            logger.info(f"======[{cat_name}] 수집 시작======")
            driver.get(url)

            # 더보기 클릭 (2회)
            for i in range(2):
                try:
                    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                    time.sleep(random.uniform(1.0, 1.5))
                    more_btn_xpath = "//a[contains(@class, 'section_more_inner') or contains(text(), '더보기')]"
                    more_btn = WebDriverWait(driver, 7).until(
                        EC.presence_of_element_located((By.XPATH, more_btn_xpath))
                    )
                    driver.execute_script("arguments[0].scrollIntoView(true);", more_btn)
                    time.sleep(random.uniform(1.5, 2.5))

                    driver.execute_script("arguments[0].click();", more_btn)

                    logger.info(f"[{cat_name}] 더보기 버튼 클릭 성공 ({i + 1}/2)")
                    time.sleep(random.uniform(2.0, 3.0))
                except:
                    logger.debug(f"[{cat_name}] 더보기 버튼 없음/종료")
                    break

            soup = BeautifulSoup(driver.page_source, "lxml")
            items = soup.select("div.section_latest ul li")

            saved_count = 0  # 카테고리별 저장 기사 수 카운터
            duplicate_count = 0

            for item in items:
                link_tag = item.select_one("a")
                title_tag = item.select_one("strong")

                if not title_tag: continue
                title = title_tag.get_text(strip=True)

                if not link_tag: continue
                naver_url = link_tag.get("href")
                if naver_url.startswith("/"): naver_url = f"https://news.naver.com{naver_url}"

                # 상세 페이지 접근
                # logger.info(f"상세 페이지 접근 시도: {naver_url}")
                detail = get_article_detail(naver_url, cat_name)
                if not detail or not detail.get("URL"): continue
                # logger.info(f"상세 페이지 수집 완료")

                # PK(news_id) 생성
                news_id = hashlib.sha256(detail["URL"].encode()).hexdigest()
                if id_dupl(news_id):
                    duplicate_count += 1
                    logger.info(f"중복 발견 ({duplicate_count}/5): {title[:15]}")
                    if duplicate_count >= 5:
                        logger.info(f"[{cat_name}] 수집 종료(id_dupl)")
                        break
                    continue

                duplicate_count = 0

                content = detail.get("content")
                media = detail.get("media")
                writer = detail.get("writer")
                URL = detail.get("URL")

                if not content or not media or not writer or not URL:
                    logger.warning(f"[SKIP] 필수 정보 누락(본문/언론사/기자/URL: {naver_url}")
                    continue

                ####################여기 키위토큰############################################
                #token = tokens({"title": title, "content": content}, kiwi)

                # --- 엘라스틱서치 저장 ---
                doc = {
                    "news_id": news_id,
                    "tag": "breaking" if "[속보]" in title else "normal",
                    "title": title.replace("[속보]", "").replace('\\', '').strip(),
                    #"title_tokens": token["title_tokens"],
                    "content": content,
                    #"content_tokens": token["content_tokens"],
                    "URL": URL,
                    "naver_url": naver_url,
                    "media": detail.get("media", "").replace('\\', ''),
                    "pubdate": detail.get("pubdate"),
                    "pubtime": detail.get("pubtime"),
                    "category": detail.get("category"),
                    "writer": detail.get("writer", "").replace('\\', ''),
                    "imgURL": detail.get("imgURL"),
                    "imgCaption": detail.get("imgCaption"),
                    "timestamp": datetime.now(timezone(timedelta(hours=9))).isoformat(timespec='seconds')
                }
                es.index(index=INDEX_NAME, id=news_id, document=doc)
                saved_count += 1
                time.sleep(random.uniform(0.5, 1.0))

            end_time = time.time()
            duration = end_time - start_time
            logger.info(f"[카테고리 - {cat_name}] 수집: 신규 기사: {saved_count}건 / {duration:.2f}초 소요 ")

        except Exception as e:
            logger.error(f"crawling_general_news - [{cat_name}] 카테고리 수집 중 에러: {e}")
            continue

        # 다음 카테고리로 넘어가기 전 대기(IP 차단 방지)
        time.sleep(random.uniform(2.0, 5.0))

    logger.info("일반기사 수집 프로세스 종료")

################################################################################################################
# 스포츠기사 크롤링 함수
def crawling_sports_news(driver):
    # kiwi = Kiwi()
    sports_categories = {
                         "농구": "basketball",
                         "국내축구": "kfootball"}

    for s_name, s_id in sports_categories.items():
        start_time = time.time()
        saved_count = 0
        duplicate_count = 0
        stop_current_category = False

        try:
            url = f"https://m.sports.naver.com/{s_id}/news"
            logger.info(f"[======스포츠/{s_name}] 수집 시작======")
            driver.get(url)
            time.sleep(random.uniform(2.5, 3.5))

            for page_num in range(1, 4):
                if stop_current_category:
                    break

                try:
                    # 페이지 하단으로 스크롤
                    for i in range(3):
                        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                        time.sleep(1.0)
                    logger.info(f"[스포츠/{s_name}] {page_num}페이지 데이터 및 버튼 로드 중")
                    time.sleep(1.5)

                    if page_num > 1:
                        page_btn_xpath = f"//div[contains(@class, 'Pagination_pagination')]//button[text()='{page_num}']"
                        try:
                            page_button = WebDriverWait(driver, 10).until(
                                    EC.element_to_be_clickable((By.XPATH, page_btn_xpath))
                                )
                            driver.execute_script("arguments[0].scrollIntoView(true);", page_button)
                            time.sleep(0.5)
                            driver.execute_script("arguments[0].click();", page_button)
                            logger.info(f"[{s_name}] {page_num}페이지로 이동 중")
                            time.sleep(random.uniform(2.0, 3.0))

                            # 페이지 이동 후 스크롤
                            driver.execute_script("window.scrollTo(0, 0);")
                            time.sleep(1.0)
                            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                            time.sleep(1.5)

                        except Exception as e:
                            logger.error(f"[{s_name}] {page_num}페이지 버튼 클릭 실패: {e}")
                            break  # 다음 페이지 버튼을 못 찾으면 해당 종목 종료
                except Exception as e:
                    logger.error(f"[스포츠/{s_name}] {page_num} 이동 중 에러: {e}")
                    break

                soup = BeautifulSoup(driver.page_source, "lxml")
                items = soup.select("ul[class*='NewsList_news_list'] li")
                if not items: break

                for item in items:
                    link_tag = item.select_one("a") or item.select_one("a.link_news")
                    title_tag = item.select_one("em[class*='NewsItem_title']") or item.select_one("strong")

                    if not title_tag or not link_tag:
                        continue

                    title = title_tag.get_text(strip=True)
                    naver_url = link_tag.get("href")

                    if naver_url.startswith("/"):
                        naver_url = f"https://m.sports.naver.com{naver_url}"
                    elif not naver_url.startswith("http"):
                        continue

                    # 상세 페이지 접근
                    detail = get_sports_article_detail(naver_url, f"스포츠/{s_name}")

                    if not detail:
                        logger.info(f"[SKIP] 상세 페이지 접속 실패: {naver_url}")
                        continue

                    news_id = hashlib.sha256(detail["URL"].encode()).hexdigest()
                    if id_dupl(news_id):
                        duplicate_count += 1
                        if duplicate_count >= 5:
                            logger.info(f"[{s_name}] 5회 연속 중복 발생. 해당 종목 종료.")
                            stop_current_category = True
                            break
                        continue
                    duplicate_count = 0

                    required_fields = {
                        "본문": detail.get("content"),
                        "언론사": detail.get("media"),
                        "원문URL": detail.get("URL")
                        }

                    # 하나라도 없으면 건너뜀
                    if not all(required_fields.values()):
                        missing_names = [k for k, v in required_fields.items() if not v]
                        logger.warning(f"[SKIP] 필수 정보 누락({', '.join(missing_names)}): {naver_url}")
                        continue

                    ####################여기 키위토큰############################################
                    # token = tokens({"title": title, "content": content}, kiwi)

                    doc = {
                        "news_id": news_id,
                        "tag": "breaking" if "[속보]" in title else "normal",
                        "title": title.replace("[속보]", "").replace('\\', '').strip(),
                        # "title_tokens": token["title_tokens"],
                        "content": detail.get("content", ""),
                        # "content_tokens": token["content_tokens"],
                        "writer": detail.get("writer", "").replace('\\', ''),
                        "media": detail.get("media", "").replace('\\', ''),
                        "pubdate": detail.get("pubdate"),
                        "pubtime": detail.get("pubtime"),
                        "category": "스포츠",
                        "imgURL": detail.get("imgURL"),
                        "imgCaption": detail.get("imgCaption"),
                        "URL": detail.get("URL"),
                        "naver_url": naver_url,
                        "timestamp": datetime.now(timezone(timedelta(hours=9))).isoformat(timespec='seconds')
                    }
                    es.index(index=INDEX_NAME, id=news_id, document=doc)
                    saved_count += 1
                    time.sleep(random.uniform(0.5, 1.0))

            duration = time.time() - start_time
            logger.info(f"[스포츠/{s_name}] 완료 : {saved_count}건 / {duration:.2f}초 소요")
            time.sleep(random.uniform(0.8, 1.5))

        except Exception as e:
            logger.error(f"crawling_sports_news - 스포츠/{s_name} 수집 중 에러: {e}")
            continue

    logger.info("스포츠 기사 수집 프로세스 종료")


################################################################################################################
# 연예 기사 크롤링 함수
def crawling_enter_news(driver):
    # kiwi = Kiwi()
    start_time = time.time()
    saved_count = 0
    duplicate_count = 0
    stop_process = False

    try:
        url = "https://m.entertain.naver.com/now"
        logger.info("[======연예 뉴스] 수집 시작======")
        driver.get(url)
        time.sleep(random.uniform(2.5, 3.5))

        for page_num in range(1, 4):
            if stop_process: break

            try:
                for i in range(3):
                    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                logger.info(f"[연예] {page_num}페이지 로드 중({i}/3)")
                time.sleep(2.0)

                if page_num > 1:
                    page_btn_xpath = f"//div[contains(@class, 'Pagination_pagination')]//button[text()='{page_num}']"

                    try:
                        page_button = WebDriverWait(driver, 10).until(
                            EC.element_to_be_clickable((By.XPATH, page_btn_xpath))
                        )
                        # 일반 클릭이 안 될 경우를 대비해 스크립트 실행 방식으로 클릭
                        driver.execute_script("arguments[0].click();", page_button)
                        logger.info(f"[연예] {page_num}페이지로 이동 중")
                        time.sleep(random.uniform(2.5, 3.5))

                        # 페이지 이동 후 스크롤
                        driver.execute_script("window.scrollTo(0, 0);")
                        time.sleep(1.0)
                        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                        time.sleep(1.5)

                    except Exception as e:
                        logger.error(f"[연예] {page_num}페이지 버튼 찾기 실패: {e}")
                        break

                soup = BeautifulSoup(driver.page_source, "lxml")
                items = soup.select("ul[class*='NewsList_news_list'] li")
                if not items:
                    #logger.info(f"[연예] {page_num}페이지에 기사 없음")
                    break

                for item in items:
                    link_tag = item.select_one("a[class*='NewsItem_link_news']") or item.select_one("a")
                    title_tag = item.select_one("em[class*='NewsItem_title']") or item.select_one("strong")

                    if not title_tag or not link_tag:
                        continue

                    title = title_tag.get_text(strip=True)
                    naver_url = link_tag.get("href")

                    if naver_url.startswith("/"):
                        naver_url = f"https://m.entertain.naver.com{naver_url}"
                    elif not naver_url.startswith("http"):
                        continue

                    # 상세 페이지 접근
                    detail = get_sports_article_detail(naver_url, "연예")

                    if not detail:
                        logger.warning(f"[SKIP] 상세 페이지 접속 실패: {naver_url}")
                        continue

                    news_id = hashlib.sha256(detail["URL"].encode()).hexdigest()
                    if id_dupl(news_id):
                        duplicate_count += 1
                        if duplicate_count >= 5:
                            logger.info("[연예] 5회 연속 중복 발생. 수집 종료.")
                            stop_process = True
                            break
                        continue
                    duplicate_count = 0

                    # 필수 필드 체크
                    required_fields = {
                        "본문": detail.get("content"),
                        "언론사": detail.get("media"),
                        "원문URL": detail.get("URL")
                    }

                    if not all(required_fields.values()):
                        missing_names = [k for k, v in required_fields.items() if not v]
                        logger.warning(f"[SKIP] 필수 정보 누락({', '.join(missing_names)}): {naver_url}")
                        continue

                    ####################여기 키위토큰############################################
                    # token = tokens({"title": title, "content": content}, kiwi)

                    doc = {
                        "news_id": news_id,
                        "tag": "breaking" if "[속보]" in title else "normal",
                        "title": title.replace("[속보]", "").replace('\\', '').strip(),
                        # "title_tokens": token["title_tokens"],
                        "content": detail.get("content", ""),
                        # "content_tokens": token["content_tokens"],
                        "writer": detail.get("writer", "").replace('\\', ''),
                        "media": detail.get("media", "").replace('\\', ''),
                        "pubdate": detail.get("pubdate"),
                        "pubtime": detail.get("pubtime"),
                        "category": "연예",
                        "imgURL": detail.get("imgURL"),
                        "imgCaption": detail.get("imgCaption"),
                        "URL": detail.get("URL"),
                        "naver_url": naver_url,
                        "timestamp": datetime.now(timezone(timedelta(hours=9))).isoformat(timespec='seconds')
                    }

                    # ES 저장
                    es.index(index=INDEX_NAME, id=news_id, document=doc)
                    saved_count += 1
                    time.sleep(random.uniform(0.8, 1.2))

                logger.info(f"[연예] {page_num}페이지 완료 (누적 {saved_count}건)")

            except Exception as e:
                logger.error(f"[연예] {page_num}페이지 수집 중 에러: {e}")
                continue

        duration = time.time() - start_time
        logger.info(f"[연예 뉴스] 전체 완료 : {saved_count}건 / {duration:.2f}초 소요")

    except Exception as e:
        logger.error(f"crawling_enter_news - 수집 중 에러: {e}")

    logger.info("연예 기사 수집 프로세스 종료")


################################################################################################################
# 스케줄러 설정
def scheduled_task():
    try:
        crawler_naver()
    except Exception as e:
        logger.critical(f"NAVER 스케줄러 예외 발생: {e}")





# 수동 크롤링 실행용
if __name__ == "__main__":
    crawler_naver()
