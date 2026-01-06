import sys, os, re, time
sys.path.append(os.path.dirname(os.path.abspath(os.path.dirname(__file__))))

import pandas as pd
from datetime import datetime, timezone, timedelta

from logger import Logger
from elasticsearch import Elasticsearch, helpers
from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func
from database import Base, get_engine, SessionLocal

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import classification_report, accuracy_score
from sklearn.ensemble import VotingClassifier
from sklearn.naive_bayes import MultinomialNB
from sklearn.linear_model import LogisticRegression
from lightgbm import LGBMClassifier

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
        logger.info(f"[기사 NPTI 분류] 에러 정보 ES 저장 완료: {news_id}")
    except Exception as e:
        logger.error(f"[기사 NPTI 분류] ES 에러 로그 저장 중 추가 오류 발생: {e}")

# ==========================================================================================
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


# TF-IDF(분류별)
tfidf_ct = TfidfVectorizer(
    ngram_range=(1, 2),
    max_features=15000,
    min_df=3,
    max_df=0.9
)

tfidf_fi = TfidfVectorizer(
    tokenizer=tokenizer_fi,
    token_pattern=None,
    ngram_range=(1, 3),
    max_features=20000,
    min_df=3,
    max_df=0.9
)

tfidf_pn = TfidfVectorizer(
    ngram_range=(1, 3),
    max_features=15000,
    min_df=3,
    max_df=0.9
)

# 앙상블 모델 생성 함수
def build_model():
    return VotingClassifier(
        estimators=[
            ("nb", MultinomialNB(alpha=0.1)),
            ("lr", LogisticRegression(class_weight="balanced", max_iter=1000)),
            ("lgbm", LGBMClassifier(class_weight="balanced", random_state=42))
        ],
        voting="soft"
    )
model_ct = build_model()
model_fi = build_model()
model_pn = build_model()

# 데이터 로드
df = pd.read_csv(r"D:\PROJECT\Project_team3\LLM_test\LLM_results\TRAIN_DATA_v2.csv")
df = df.dropna(subset=["content","final_article_type","final_information_type","final_viewpoint_type"])

X = df["content"]
y_ct = df["final_article_type"]
y_fi = df["final_information_type"]
y_pn = df["final_viewpoint_type"]

X_tr, X_te, y_ct_tr, y_ct_te, y_fi_tr, y_fi_te, y_pn_tr, y_pn_te = train_test_split(
    X, y_ct, y_fi, y_pn, test_size=0.2, random_state=42, stratify=y_ct
)

# Vectorize
X_ct_tr = tfidf_ct.fit_transform(X_tr)
X_fi_tr = tfidf_fi.fit_transform(X_tr)
X_pn_tr = tfidf_pn.fit_transform(X_tr)

# 모델 학습
logger.info("[article_type] 학습 시작")
t = time.time()
model_ct.fit(X_ct_tr, y_ct_tr)
logger.info(f"[article_type] 완료 ({time.time()-t:.2f}s)")

logger.info("[info_type] 학습 시작 (n-gram)")
t = time.time()
model_fi.fit(X_fi_tr, y_fi_tr)
logger.info(f"[info_type] 완료 ({time.time()-t:.2f}s)")

logger.info("[view_type] 학습 시작")
t = time.time()
model_pn.fit(X_pn_tr, y_pn_tr)
logger.info(f"[view_type] 완료 ({time.time()-t:.2f}s)")


# Accuracy 평가
def evaluate_model(name, model, vectorizer, X_test, y_test):
    """
    name        : 'CT', 'FI', 'PN'
    model       : 해당 타겟 모델
    vectorizer  : 해당 타겟 TF-IDF
    X_test      : 테스트 본문
    y_test      : 테스트 라벨
    """
    X_vec = vectorizer.transform(X_test)
    preds = model.predict(X_vec)

    acc = accuracy_score(y_test, preds)
    report = classification_report(y_test, preds)

    logger.info(f"[{name}] Accuracy: {acc:.4f}")
    logger.info(f"{report}")

    return acc

acc_CT = evaluate_model("CT", model_ct, tfidf_ct, X_te, y_ct_te)
acc_FI = evaluate_model("FI", model_fi, tfidf_fi, X_te, y_fi_te)
acc_PN = evaluate_model("PN", model_pn, tfidf_pn, X_te, y_pn_te)

# NPTI 라벨링 함수
def classify_npti():
    add_db()
    db = SessionLocal()

    try:
        logger.info("===== NPTI 배치 분류 시작 =====")
        logger.info(
            f"[MODEL ACCURACY] "
            f"article_type: {acc_CT:.2%} | "
            f"info_type: {acc_FI:.2%} | "
            f"view_type: {acc_PN:.2%}"
        )

        existing_ids = set(row[0] for row in db.query(ArticlesNPTI.news_id).all())
        logger.info(f"현재 DB에 등록된 기사 수: {len(existing_ids)}건")

        rows = helpers.scan(
            es,
            index=ES_INDEX,
            query={"query": {"match_all": {}}, "_source": ["content"]}
        )

        count = 0
        for row in rows:
            news_id = row["_id"]
            if news_id in existing_ids:
                continue

            content = row["_source"].get("content", "")
            if not content:
                continue

            try:
                # 길이
                length_type = "L" if len(content) >= 800 else "S"

                # 예측
                ct = model_ct.predict(tfidf_ct.transform([content]))[0]
                fi = model_fi.predict(tfidf_fi.transform([content]))[0]
                pn = model_pn.predict(tfidf_pn.transform([content]))[0]

                npti_code = length_type + ct + fi + pn

                record = ArticlesNPTI(
                    news_id=news_id,
                    length_type=length_type,
                    article_type=ct,
                    info_type=fi,
                    view_type=pn,
                    NPTI_code=npti_code,
                    updated_at=datetime.now(timezone(timedelta(hours=9)))
                )

                db.merge(record)
                count += 1

                if count % 100 == 0:
                    db.commit()
                    logger.info(f"{count}건 처리 중-----------------------")

            except Exception as e:
                logger.error(f"[기사 NPTI 분류 실패] news_id={news_id} / {e}")
                err_article(news_id, e)
                continue

        db.commit()
        logger.info(f"최종 {count}건 기사 NPTI 분류 완료")
        logger.info(f"article_type:{acc_CT:.2%}, info_type:{acc_FI:.2%}, view_type:{acc_PN:.2%} =====")

    except Exception as e:
        logger.error(f"전체 분류 프로세스 오류: {e}")
        db.rollback()

    finally:
        db.close()


# =========== TEST용 ==========
def test_article(text: str):
    length_type = "L" if len(text) >= 800 else "S"

    # CT
    ct_vec = tfidf_ct.transform([text])
    ct_pred = model_ct.predict(ct_vec)[0]
    ct_conf = model_ct.predict_proba(ct_vec)[0].max()

    # FI
    fi_vec = tfidf_fi.transform([text])
    fi_pred = model_fi.predict(fi_vec)[0]
    fi_conf = model_fi.predict_proba(fi_vec)[0].max()

    # PN
    pn_vec = tfidf_pn.transform([text])
    pn_pred = model_pn.predict(pn_vec)[0]
    pn_conf = model_pn.predict_proba(pn_vec)[0].max()

    npti = length_type + ct_pred + fi_pred + pn_pred

    logger.info(
        f"[article_type] confidence: {ct_pred} | confidence: {ct_conf:.2%} | model_acc: {acc_CT:.2%}"
    )
    logger.info(
        f"[info_type] confidence: {fi_pred} | confidence: {fi_conf:.2%} | model_acc: {acc_FI:.2%}"
    )
    logger.info(
        f"[view_type] confidence: {pn_pred} | confidence: {pn_conf:.2%} | model_acc: {acc_PN:.2%}"
    )
    logger.info(f"NPTI CODE: {npti}")

    return npti


# ==================================================================================
if __name__ == "__main__":
    # 분류 함수 호출
    #classify_npti()

    sample_text = """
    
[헤럴드경제=민성기 기자] 경기 의정부시 한 대형 프랜차이즈 카페에서 주문 없이 화장실을 이용했다는 이유로 업주에게 영업방해 혐의로 신고당했다는 사연이 전해져 논란이 일고 있는 가운데, 해당 카페 사장은 “손님이 계속 고함을 치고 협박성 발언을 해서 경찰에 신고한 것”이라며 반박했다.


최근 한 온라인 커뮤니티에는 ‘카페 사장을 감금죄나 강요죄로 신고해도 되냐?’는 제목의 글이 올라왔다.


작성자 A씨에 따르면 그는 지난달 28일 오후 4~5시쯤 경기도 의정부에 위치한 한 대형 프랜차이즈 카페를 찾았다. 가족과 외출 중이던 A씨는 급하게 소변이 마려워 카페 지하 1층 화장실을 이용했다.


그런데 이때 카페 사장은 카페 밖으로 나오려는 A씨를 막아섰다. A씨는 “화장실을 이용하고 나오려는 순간 사장이 출입구를 양팔로 막았다”며 “주문하지 않은 외부인은 화장실을 사용할 수 없고, 음식을 주문해야만 나갈 수 있다고 했다”고 말했다.


해당 카페 내부에는 ‘손님 외 출입 금지’, ‘공중화장실 아님. 결제 후 이용’, ‘화장실 이용 요금 5000원’ 등의 안내문이 부착돼 있었던 것으로 전해졌다.


A씨는 죄송하다며 90도로 인사한 뒤 “추운 날씨에 아이가 밖에 서 있으니 다음에 꼭 이용하겠다”고 했지만 사장이 또 못 가게 막았다고 했다.


결국 A씨 아내가 1400원짜리 아이용 병 음료를 사려고 했더니 길을 막았던 사장은 이보다 비싼 커피를 주문하라고 했다고 주장했다.


A씨 부부가 “구매 품목 선택은 소비자의 자유”라며 반발하자 사장은 “가게 규정상 커피만 가능하다”고 강조했고 이후 약 2분간 실랑이가 이어졌다.


이 과정에서 사장은 “여기서 한마디라도 더 하면 영업방해로 경찰을 부르겠다”고 한 뒤 실제로 경찰에 신고한 것으로 전해졌다. 다만 출동한 경찰은 A씨 부부에 대해 영업방해 혐의가 성립하지 않는다고 판단했으며, 화장실 이용 역시 불법이나 처벌 대상은 아니라는 취지로 설명한 것으로 알려졌다.


A씨는 “화장실을 무료로 이용했다는 이유로 출구를 몸으로 막아 나가지 못하게 했고, 원하지 않는 물건을 강제로 구매하게 했다”며 “정당한 사유 없는 신체 자유 제한이라고 생각해 감금죄나 강요죄로 신고를 고민 중”이라고 밝혔다.


해당 글이 논란이 되자 카페 사장은 지난 6일 JTBC ‘사건반장’과 인터뷰를 통해 사건 당시 상황이 담긴 CCTV를 공개하며 A씨 주장을 반박했다.


카페 사장은 “A씨를 양팔로 막아서지 않았고 추운 날 아이가 밖에 서 있다는 말도 들은 적 없으며 90도로 사과하지 않았다”며 “A씨가 그냥 나가려는 거 같아 안내문을 손으로 가리키며 ‘화장실만 이용하는 건 안 돼서 주문 부탁드린다’고 안내했다”고 밝혔다.


카페 사장은 “무단으로 화장실을 이용한 분들이 안내문이 없다고 화를 낸 적이 많아 안내문을 붙이기 시작했다”며 “화장실 바닥에 대변을 보고 그냥 가거나 휴지를 통째로 훔쳐가는 경우도 있었다. 별의별 손님을 겪어 너무 힘들고 스트레스를 많이 받았다”고 토로했다.


카페 사장은 A씨 부부가 음료 주문 뒤에도 카페 내부 사진을 찍고 언성을 높이면서 “인터넷이 하나도 안 무섭나 보네”라며 협박하듯 말했다고 주장했다.


그는 “주말이라 주문이 많이 밀려있는데 일부러 다른 손님들 들으라는 듯이 계속 고함을 쳐서 결국 경찰을 부르게 됐다”면서 “이 정도로는 영업방해 처벌이 안 된다는 건 알지만 경찰이 와서 중재해주길 바라는 마음에 불렀다”고 당시 상황을 설명했다.


출동한 경찰은 양쪽 이야기를 들은 뒤 사장에게 A씨 부부를 돌려보내도 되는지 물었고 사장은 중재를 요청한 거라 그냥 보내도 된다고 말했다고 한다.


카페 사장은 “CCTV에 다 녹화돼 있고 증거 자료가 명백하게 있는데 어떻게 저렇게 거짓으로 글을 썼는지 놀랐다”며 “사실과 다른 글 하나로 마녀사냥을 당해 잠도 못 자면서 마음이 아주 힘들었다”고 했다.


카페 사장은 A씨가 ‘감금이나 강요죄’라고 언급한 데 대해 “어느 부분에서 감금죄까지 운운하며 오히려 고소하겠다고 하는지 이해가 되지 않는다”고 했다.
    """

    test_article(sample_text)


