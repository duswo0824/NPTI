import pandas as pd
import numpy as np
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix
from xgboost import XGBClassifier
from sklearn.model_selection import GroupShuffleSplit


def algorithm_training():
    # 1. 데이터 로드 (파일 경로 확인 필요)
    try:
        df = pd.read_csv("second_feature_labeled.csv")
    except FileNotFoundError:
        print("[Error] 파일을 찾을 수 없습니다. 파일 경로를 확인해주세요.")
        return

    # [설정] 샘플링 레이트에 따른 시간 보정
    ROW_DURATION = 0.04

    # 2. 데이터 전처리 및 분할
    df['group_key'] = df['user_id'].astype(str) + "_" + df['news_id'].astype(str)

    gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, test_idx = next(gss.split(df, groups=df['group_key']))

    train_df = df.iloc[train_idx].copy()
    test_df = df.iloc[test_idx].copy()

    features = ['MMF_y_inf', 'MMF_x_inf', 'MSF_y_inf','mouseX', 'mouseY', 'height_3']
    # features = ['MMF_y_2', 'MMF_y_5', 'MMF_y_10', 'MMF_y_inf',
    #             'MMF_x_2', 'MMF_x_5', 'MMF_x_10', 'MMF_x_inf', 'MSF_y_2', 'MSF_y_5',
    #             'MSF_y_10', 'MSF_y_inf', 'isVisible', 'mouseX', 'mouseY', 'height_3']

    # 범주형 변환
    for col in ['user_id', 'news_id']:
        train_df[col] = train_df[col].astype('category')
        test_df[col] = test_df[col].astype('category')

    x_train, y_train = train_df[features], train_df['read']
    x_test, y_test = test_df[features], test_df['read']

    # 3. 불균형 가중치 계산 및 모델 학습
    neg_count = (y_train == 0).sum()
    pos_count = (y_train == 1).sum()
    scale_weight = neg_count / pos_count

    model = XGBClassifier(
        n_estimators=1000,
        learning_rate=0.05,
        max_depth=3,
        scale_pos_weight=np.sqrt(scale_weight),  # 상황에 맞게 조정 (논문에서는 20, 혹은 scale_weight 그대로 사용)
        eval_metric='auc',
        n_jobs=-1,
    )

    model.fit(
        x_train, y_train,
        eval_set=[(x_test, y_test)],
        verbose=False
    )

    # --- [추가 1] 분류 성능 평가 (Recall, F1-Score) ---
    print("\n=== Classification Performance ===")

    # 확률 예측
    y_prob = model.predict_proba(x_test)[:, 1]

    # 0/1 클래스 예측 (Threshold 0.5 기준)
    # 필요시 threshold를 조정하여 recall을 높일 수 있음 (예: y_prob > 0.3)
    y_pred = model.predict(x_test)

    # 1. AUC 출력
    print(f"ROC AUC: {roc_auc_score(y_test, y_prob):.4f}")
    print(f"model test score : {model.score(x_test, y_test):.4f}")

    # 2. Classification Report (Precision, Recall, F1-score)
    print("\n[Classification Report]")
    print(classification_report(y_test, y_pred, digits=4))

    # 3. Confusion Matrix
    tn, fp, fn, tp = confusion_matrix(y_test, y_pred).ravel()
    print(f"[Confusion Matrix]\nTN: {tn}, FP: {fp}\nFN: {fn}, TP: {tp}")

    # --- [추가 2] Feature Importance (변수 중요도) ---
    print("\n=== Feature Importance ===")

    # 중요도 추출 및 데이터프레임 생성
    fi_df = pd.DataFrame({
        'feature': features,
        'importance': model.feature_importances_
    })

    # 중요도 순으로 정렬 (내림차순)
    fi_df = fi_df.sort_values(by='importance', ascending=False)

    # 상위 10개 출력
    print(fi_df.head(10))
    print("-" * 30)

    # --- [기존] 결과 분석 (초 단위 변환) ---
    test_df['pred_prob'] = y_prob

    grouped = test_df.groupby(['user_id', 'news_id'], observed=True).agg(
        row_count=('pred_prob', 'count'),
        prob_sum=('pred_prob', 'sum')
    ).reset_index()

    grouped['dwell_time_sec'] = grouped['row_count'] * ROW_DURATION
    grouped['pred_read_time_sec'] = grouped['prob_sum'] * ROW_DURATION
    grouped['reading_efficiency'] = grouped['pred_read_time_sec'] / grouped['dwell_time_sec']

    result_df = grouped[['user_id', 'news_id', 'dwell_time_sec', 'pred_read_time_sec', 'reading_efficiency']]

    print("\n=== Reading Analysis (Seconds) Sample ===")
    print(result_df[result_df['dwell_time_sec'] > 1.0].head(10))

    print("\n=== Efficiency Statistics ===")
    print(result_df['reading_efficiency'].describe())

    return result_df


if __name__ == "__main__":
    algorithm_training()