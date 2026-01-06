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


df_full = pd.read_csv(r'D:\PROJECT\Project_team3\LLM_test\LLM_results\TEST_DATA.csv')
df = df_full.dropna(subset=['content_tokens', 'final_article_type', 'final_information_type', 'final_viewpoint_type'])

# X: 입력 데이터 (기사 본문), y: 타겟 데이터 (3가지 레이블)
X = df['content_tokens']
y = df[['final_article_type', 'final_information_type', 'final_viewpoint_type']]

# 데이터 분할 (학습용 80%, 테스트용 20%)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y['final_article_type']
)

# TF-IDF 벡터화
# 데이터 양이 9,000개 수준이므로 max_features를 15,000으로 설정하여 충분한 어휘력 확보
tfidf = TfidfVectorizer(ngram_range=(1, 3), max_features=15000)
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

        db.commit()
        logger.info(f"========== 최종 {count}건 - 기사 NPTI분류 및 DB 저장 완료 ==========")

    except Exception as e:
        logger.error(f"통합 NPTI 분류 처리 중 오류 발생: {e}")
        db.rollback()
    finally:
        db.close()


# TEST 기사 예측 함수
def predict_new_article(text):
    text_tfidf = tfidf.transform([text])
    X_input = pd.DataFrame(text_tfidf.toarray(), columns=tfidf.get_feature_names_out())
    pred = model.predict(X_input)[0]

    try:
        # MultiOutputClassifier는 각 타겟별로 독립된 모델의 리스트를 가집니다.
        probs = model.predict_proba(X_input)
        # 각 항목별로 예측된 클래스의 확률값만 추출
        confidences = [max(p[0]) for p in probs]
        conf_str = f"(확신도 - 구조: {confidences[0]:.1%}, 내용: {confidences[1]:.1%}, 논조: {confidences[2]:.1%})"
    except Exception as e:
        conf_str = f"(확신도 계산 제외: {e})"

    logger.info(f'기사 NPTI 분류 모델 평균 신뢰도: {avg_f1_score:.2%}')
    logger.info(f"[예측 결과] - 구조: {pred[0]} / 내용: {pred[1]} / 논조: {pred[2]}")
    if conf_str:
        logger.info(conf_str)


# ==================================================================================
if __name__ == "__main__":
    # 분류 함수 호출
    #classify_npti()

    sample_text = """
    
이재명 대통령이 중국의 국회의장 격인 자오러지 전국인민대표회의 상무위원장에게 민의를 대표해 양국 간 공감대를 확장해달라고 당부했습니다.

자오러지 위원장은 두 나라 정상의 지도로, 양국 관계가 정상 궤도로 복귀했다고 화답했습니다.

취재기자 연결합니다. 정인용 기자. 두 사람 회동 소식 자세히 전해주시죠.


네, 방중 3일 차를 맞은 이재명 대통령이 오늘 오전 중국 권력 서열 3위이자, 국회의장 격인 자오러지 전인대 상무위원장과 만났습니다.

이 대통령은 모두발언에서, 만나 뵙게 돼 반갑다며 자오러지 위원장이 한중 간 교류를 이어가는 데에 큰 역할을 해줬다고 말했습니다.

이어 시진핑 주석과 회담으로 양국 정부 간 정치적 신뢰와 민간 부문의 우호적 신뢰를 바탕으로 한중 전략적 협력 동반자 관계를 성숙하게 발전시켜 나가는 데에 뜻을 함께했다고 강조했습니다.

두 나라 관계에 전인대의 역할이 어느 때보다 중요하다며 민의를 대표하는 기관으로서 양국 간 상호 이해를 높이고 공감대를 확장하는 데에 중요한 기여를 할 거로 믿는다고 당부했습니다.

그러면서 굳은 신뢰의 기반 위에서 한중 관계를 더욱 발전시켜나가도록 자오러지 위원장과 전인대의 적극적 지지와 성원을 부탁했습니다.

자오러지 위원장은 양국은 우호적인 가까운 이웃이고 전략적 협력 동반자라며 수교 이래 공동 발전을 도모해왔다고 평가했습니다.

이어 심화하는 양국 관계가 양국 국민 이익에 부합하고 지역과 세계의 평화와 안정, 그리고 발전과 번영에 유리하다고 짚었습니다.

특히 시 주석과 이 대통령의 전략적인 지도 아래 양국 관계가 다시 한 번 정상 궤도로 복귀했고 새로운 국면을 맞았다고 언급했습니다.

또, 양국 관계 새로운 발전의 청사진도 그렸다며 각 분야 협력을 심화함으로써 양국이 안정적으로 멀리 갈 수 있도록 함께 주도하겠다고 덧붙였습니다.

이 대통령은 자오러지 위원장과의 만남 뒤에는 서열 2위 경제 사령탑인 리창 국무원 총리와 함께하는 시간도 가졌습니다.


    """

    predict_new_article(sample_text)
