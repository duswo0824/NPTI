import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(os.path.dirname(__file__))))

from logger import Logger
import time
from elasticsearch import Elasticsearch, helpers
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base, get_engine, SessionLocal
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from datetime import datetime, timezone, timedelta
from sklearn.metrics import classification_report, accuracy_score
from sklearn.ensemble import VotingClassifier
from sklearn.naive_bayes import MultinomialNB
from sklearn.linear_model import LogisticRegression
from lightgbm import LGBMClassifier
from sklearn.multioutput import MultiOutputClassifier

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
df_full = pd.read_csv(r'D:\PROJECT\Project_team3\LLM_test\LLM_results\TEST_DATA_v1.csv')
df = df_full.dropna(subset=['content', 'final_article_type', 'final_information_type', 'final_viewpoint_type'])

# X: 입력 데이터 (기사 본문), y: 타겟 데이터 (3가지 라벨)
X = df['content']
y = df[['final_article_type', 'final_information_type', 'final_viewpoint_type']]

# 데이터 분할 (학습용 80%, 테스트용 20%)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y['final_article_type']
)

# TF-IDF 벡터화
# 데이터 양이 9,000개 수준이므로 max_features를 15,000으로 설정하여 충분한 어휘력 확보
tfidf = TfidfVectorizer(
    ngram_range=(1, 3),
    max_features=20000,
    min_df=3,         # 너무 희귀한 오타 등은 제외
    max_df=0.9        # 모든 기사에 나오는 너무 흔한 단어 제외
)
X_train_tfidf = tfidf.fit_transform(X_train)
X_test_tfidf = tfidf.transform(X_test)

# 개별 모델 정의
clf1 = MultinomialNB(alpha=0.1)
clf2 = LogisticRegression(class_weight='balanced', max_iter=1000)
clf3 = LGBMClassifier(class_weight='balanced', random_state=42)

# 앙상블 모델 생성 (Soft Voting)
voting_clf = VotingClassifier(
    estimators=[('nb', clf1), ('lr', clf2), ('lgbm', clf3)],
    voting='soft'  # 확률 기반 투표
)

model = MultiOutputClassifier(voting_clf)
start_time = time.time()
logger.info("앙상블 모델 학습 시작!!!!!!")

model.fit(X_train_tfidf.toarray(), y_train)
end_time = time.time()
elapsed_time = end_time - start_time
logger.info(f"학습 완료 - 학습시간: {elapsed_time}")

# accuracy 확인
def get_model_accuracy(y_test, predictions):
    target_names = ['구조(C/T)', '내용(F/I)', '논조(P/N)']
    total_f1 = 0

    # predictions는 2차원 배열이므로 각 열을 순회합니다.
    for i in range(len(target_names)):
        # i번째 열만 추출하여 비교
        y_true_col = y_test.iloc[:, i]
        y_pred_col = predictions[:, i]

        # 정확도(Accuracy) 계산
        acc = accuracy_score(y_true_col, y_pred_col)
        # 상세 리포트(F1-score 포함)
        report_dict = classification_report(y_true_col, y_pred_col, output_dict=True)
        report_text = classification_report(y_true_col, y_pred_col)
        # 각 타겟의 weighted avg f1-score를 합산
        total_f1 += report_dict['weighted avg']['f1-score']

        logger.info(f"정확도(Accuracy): {acc:.4f}")
        logger.info(f'F1-score: {report_text}')

    return total_f1 / len(target_names)

# 성능 측정 및 점수 저장
predictions = model.predict(X_test_tfidf.toarray())
avg_f1_score = get_model_accuracy(y_test, predictions)


def classify_npti():
    add_db()  # 테이블 생성 확인
    db = SessionLocal()
    try:
        # DB에 이미 존재하는 news_id 목록 가져오기
        existing_ids = set(row[0] for row in db.query(ArticlesNPTI.news_id).all())
        logger.info(f"현재 DB에 등록된 기사 수: {len(existing_ids)}건")
        # ES에서 전체 기사 탐색
        query = {
            "query": {"match_all": {}},  # 전체를 보되 아래 로직에서 필터링
            "_source": ["content"]
        }
        rows = helpers.scan(es, index=ES_INDEX, query=query)

        count = 0
        logger.info("신규 기사 NPTI 분류 프로세스 시작")

        for row in rows:
            news_id = row['_id']
            # DB에 이미 있는 news_id라면 건너뛰기
            if news_id in existing_ids:
                continue

            content = row['_source'].get('content', '')
            if not content: continue

            try:
                # Length 분류
                length_type = 'L' if len(content) >= 800 else 'S'

                # 2. 모델 예측 (구조, 내용, 논조)
                # 학습된 tfidf와 model 객체를 직접 사용합니다.
                content_tfidf = tfidf.transform([content])
                pred = model.predict(content_tfidf)[0]  # 결과 예: ['C', 'F', 'P']

                article_type = pred[0]
                info_type = pred[1]
                view_type = pred[2]

                # 3. NPTI 코드 생성
                combined_code = length_type + article_type + info_type + view_type

                # 4. DB 객체 생성 및 저장
                npti_record = ArticlesNPTI(
                    news_id=news_id,
                    length_type=length_type,
                    article_type=article_type,
                    info_type=info_type,
                    view_type=view_type,
                    NPTI_code=combined_code,
                    updated_at=datetime.now(timezone(timedelta(hours=9)))
                )
                db.merge(npti_record)
                count += 1

                if count % 100 == 0:
                    db.commit()
                    logger.info(f"현재 {count}건 처리 중")
            except Exception as e:
                logger.info(f'[기사 NPTI 분류]-[ {news_id} ] 에러: {e}')
                err_article(news_id, e)
                continue

        db.commit()
        logger.info(f"========== 최종 {count}건 - 기사 NPTI분류 및 DB 저장 완료 ==========")

    except Exception as e:
        logger.error(f"통합 NPTI 분류 처리 중 오류 발생: {e}")
        db.rollback()
    finally:
        db.close()


# ==================================================================================
# TEST 기사 예측 함수
def predict_new_article(text):
    # TF-IDF 변환
    text_tfidf = tfidf.transform([text])
    X_input = pd.DataFrame(text_tfidf.toarray(), columns=tfidf.get_feature_names_out())
    # 예측
    pred = model.predict(X_input)[0]

    try:
        probs = model.predict_proba(X_input)
        # 각 타겟(구조, 내용, 논조)별로 가장 높은 확률값 추출
        confidences = [max(p[0]) for p in probs]
        conf_str = f"(확신도 - 구조: {confidences[0]:.1%}, 내용: {confidences[1]:.1%}, 논조: {confidences[2]:.1%})"
    except Exception as e:
        conf_str = f"(확신도 계산 제외: {e})"

    logger.info(f'기사 NPTI 분류 모델 평균 신뢰도: {avg_f1_score:.2%}')
    logger.info(f"[예측 결과] - 구조: {pred[0]} / 내용: {pred[1]} / 논조: {pred[2]}")
    if conf_str:
        logger.info(conf_str)


# ==================================================================================
import numpy as np


def analyze_feature_importance(target_idx=1):
    """
    target_idx: 0(구조), 1(내용), 2(논조)
    """
    target_names = ['구조(C/T)', '내용(F/I)', '논조(P/N)']
    logger.info(f"--- {target_names[target_idx]} 분류에 영향을 주는 상위 단어 분석 ---")

    # 1. MultiOutputClassifier에서 해당 타겟의 VotingClassifier 추출
    target_voting_clf = model.estimators_[target_idx]

    # 2. VotingClassifier 내부에 학습된 개별 모델 리스트에서 'lr' (Logistic Regression) 찾기
    # 학습 후에는 'named_estimators_' 속성을 사용하는 것이 가장 안전합니다.
    if 'lr' in target_voting_clf.named_estimators_:
        lr_model = target_voting_clf.named_estimators_['lr']
    else:
        logger.error("로지스틱 회귀 모델(lr)을 찾을 수 없습니다.")
        return

    # 3. TF-IDF 단어 이름 가져오기
    feature_names = tfidf.get_feature_names_out()

    # 4. 가중치(Coefficients) 추출 (로지스틱 회귀는 1차원 배열로 가중치를 가짐)
    coefs = lr_model.coef_[0]

    # 5. 가중치 순으로 정렬
    # 값이 클수록 Insight(I)에 가깝고, 작을수록(음수) Fact(F)에 가깝습니다.
    top_indices = np.argsort(coefs)[-20:][::-1]
    bottom_indices = np.argsort(coefs)[:20]

    print(f"\n[ {target_names[target_idx]} - Insight(I)로 분류하게 만드는 단어 TOP 20 ]")
    print("-" * 50)
    for idx in top_indices:
        print(f"{feature_names[idx]:<20} : {coefs[idx]:.4f}")

    print(f"\n[ {target_names[target_idx]} - Fact(F)로 분류하게 만드는 단어 TOP 20 ]")
    print("-" * 50)
    for idx in bottom_indices:
        print(f"{feature_names[idx]:<20} : {coefs[idx]:.4f}")


# 내용(F/I) 분석 실행
analyze_feature_importance(1)


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

    predict_new_article(sample_text)


