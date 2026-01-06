import pandas as pd
import numpy as np
from sklearn.metrics import classification_report
from xgboost import XGBClassifier

def algorithm_training():
    df = pd.read_csv("second_feature_labeled.csv")
    # df.loc[df['isVisible'] == False, 'read'] = 0

    df['isVisible'] = df['isVisible'].astype(int) # 0:False, 1 :True
    df.drop_duplicates(inplace=True)

    features = ['user_id','news_id','timestamp','MMF_y_2','MMF_y_5','MMF_y_10','MMF_y_inf','MMF_x_2','MMF_x_5','MMF_x_10','MMF_x_inf','MSF_y_2','MSF_y_5','MSF_y_10','MSF_y_inf','isVisible']
    x = df[features]
    y = df['read']

    model = XGBClassifier(n_estimators=200, max_depth=5, learning_rate=0.1, n_jobs=-1, objective='binary:logistic',scale_pos_weight=1)
    model.fit(x,y)
    importances = model.feature_importances_
    feature_imp = pd.Series(importances, index=x.columns).sort_values(ascending=False)

    print(f'score : {model.score(x,y)}')
    print(f'feature importances : {feature_imp}')

    y_pred = model.predict(x)
    print(f"classification report : \n{classification_report(y,y_pred)}")

    y_prob = model.predict_proba(x)[:,1]
    actual_reading_time = y.sum()
    predicted_reading_time = y_prob.sum()
    print(f"actual reading time: {actual_reading_time}")
    print(f"predicted reading time: {predicted_reading_time}")

    error_rate = abs(actual_reading_time - predicted_reading_time)/actual_reading_time
    print(f"오차율 error rate : {error_rate:.2f}%")

algorithm_training()