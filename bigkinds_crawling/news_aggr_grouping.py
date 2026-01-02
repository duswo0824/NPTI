import hashlib
import pandas as pd
import time
from selenium import webdriver
from selenium.webdriver.chromium.options import ChromiumOptions
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support import expected_conditions as ec
from kiwipiepy import Kiwi
from typing import Optional
from matplotlib import pyplot as plt
from sklearn.metrics.pairwise import cosine_similarity as cosine
import math
import numpy as np
from elasticsearch_index.es_aggr import tokens_aggr
from elasticsearch_index.es_raw import es, ES_INDEX
from datetime import datetime, timezone
from logger import Logger
from elasticsearch_index.es_raw import (
    ensure_news_raw, index_sample_row, search_news_row, tokens
)
from elasticsearch_index.es_err_crawling import index_error_log
from sklearn.feature_extraction.text import TfidfVectorizer
from elasticsearch import helpers

logger = Logger().get_logger(__name__)



kiwi = Kiwi()
def news_aggr():
    processed_ids = set()
    try:
        # 1. 처리된 기사 확인
        query = {"_source": ["news_id"], "size": 10000,
                 "query": {"range": {"timestamp": {"gte": "2025-12-31T00:00:00+09:00", "lte": "now"}}}}
        es.indices.refresh(index="news_aggr")
        res = es.search(index="news_aggr", body=query)
        for hit in res["hits"]["hits"]: processed_ids.add(hit["_source"].get("news_id"))

        # 2. Raw 기사 가져오기
        raw_query = {"_source": ["news_id", "title", "content", "tag"], "size": 10000,
                     "query": {"range": {"timestamp": {"gte": "2025-12-31T00:00:00+09:00", "lte": "now"}}}}
        raw_res = es.search(index="news_raw", body=raw_query)

        breaking_list = []
        norm_list = []

        # [수정 1] 변수 미리 초기화 (UnboundLocalError 방지)
        breaking_tfidf = None
        breaking_actions = []
        norm_actions = []

        for hit in raw_res["hits"]["hits"]:
            source = hit["_source"]
            news_id = source.get("news_id")
            if news_id not in processed_ids:
                title_token = str(source.get("title", ""))
                content_token = str(source.get("content", ""))
                tag = str(source.get("tag", ""))
                title_content = title_token + " " + content_token
                token_result = tokens_aggr(title_content, kiwi)

                # 아이템 딕셔너리 구성
                item_data = {"news_id": news_id, "token": token_result, "tag": tag}

                if tag == "속보":
                    breaking_list.append(item_data)
                elif tag == "일반":
                    norm_list.append(item_data)

        final_list = breaking_list + norm_list
        logger.info(f"토큰된 기사 : {len(final_list)}개")

        if not final_list:
            return {"status": "no data"}

        # 3. 속보 TF-IDF
        if breaking_list:
            breaking_corpus = [item['token'] for item in breaking_list]
            breaking_vectorizer = TfidfVectorizer(ngram_range=(1, 2))
            breaking_tfidf = breaking_vectorizer.fit_transform(breaking_corpus)
            breaking_features = breaking_vectorizer.get_feature_names_out()

            for i, item in enumerate(breaking_list):
                row = breaking_tfidf.getrow(i).toarray().flatten()
                tokens_score_list = [
                    {"term": str(breaking_features[idx]), "score": float(row[idx])}
                    for idx in range(len(row)) if row[idx] > 0
                ]
                tokens_score_list = sorted(tokens_score_list, key=lambda x: x['score'], reverse=True)

                action = {
                    "_index": "news_aggr", "_id": item['news_id'],
                    "_source": {
                        "news_id": item['news_id'], "tokens": tokens_score_list,
                        "tag": item['tag'], "timestamp": datetime.now().astimezone().isoformat(timespec="seconds")
                    }
                }
                breaking_actions.append(action)
            logger.info(f"속보 기사 TF-IDF 완료 : {len(breaking_actions)}")

        # 4. 일반 기사 TF-IDF
        if norm_list:
            norm_corpus = [item['token'] for item in norm_list]
            norm_vectorizer = TfidfVectorizer(ngram_range=(1, 2))
            norm_tfidf = norm_vectorizer.fit_transform(norm_corpus)
            norm_features = norm_vectorizer.get_feature_names_out()
            for i, item in enumerate(norm_list):
                row = norm_tfidf.getrow(i).toarray().flatten()
                tokens_score_list = [
                    {"term": str(norm_features[idx]), "score": float(row[idx])}
                    for idx in range(len(row)) if row[idx] > 0
                ]
                tokens_score_list = sorted(tokens_score_list, key=lambda x: x['score'], reverse=True)
                action = {
                    "_index": "news_aggr", "_id": item['news_id'],
                    "_source": {
                        "news_id": item['news_id'], "tokens": tokens_score_list,
                        "tag": item['tag'], "timestamp": datetime.now().astimezone().isoformat(timespec="seconds")
                    }
                }
                norm_actions.append(action)
            logger.info(f"일반 기사 TF-IDF 완료 : {len(norm_actions)}")

        # 5. ES 저장
        actions = breaking_actions + norm_actions
        if actions:
            success, _ = helpers.bulk(es, actions)
            logger.info(f"success : {success}")

        # 6. 그룹핑 및 시각화 (속보 대상)
        final_groups = []
        # [수정] breaking_tfidf가 None이 아닐 때만 실행
        if breaking_actions and breaking_tfidf is not None:
            logger.info("--- 속보 기사 그룹핑 시작 ---")
            sim_actions = cal_cosine_similarity(breaking_tfidf, breaking_list)
            groups_1st, edges = topic_grouping(sim_actions)
            logger.info(f"1차 그룹핑 완료: {len(groups_1st)}개 그룹")

            all_news_dict = {item['news_id']: item for item in breaking_list}
            threshold = 0.25
            final_groups = merge_similar_groups(groups_1st, all_news_dict, threshold=threshold)
            logger.info(f"2차 병합 완료: {len(final_groups)}개 그룹")

            graph_title = f"final_groups_threshold({threshold})"

            try:
                visualize_groups(final_groups, edges, title=graph_title)
            except Exception as viz_err:
                logger.error(f"시각화 중 에러 발생: {viz_err}")

        return {"first_group": groups_1st, "final_group": final_groups}

    except Exception as e:
        logger.error(f"news_aggr error: {e}")
        return {"status": "error", "message": str(e)}



def cal_cosine_similarity(tfidf_matrix, news_items):
    sim_matrix = cosine(tfidf_matrix)

    similarity_actions=[]
    for i in range(len(news_items)):
        # 자기 자신을 제외하고 유사도가 높은 순으로 정렬 (예: 상위 5개)
        # sim_matrix[i]는 i번째 기사와 다른 모든 기사 간의 점수
        sorted_indices = sim_matrix[i].argsort()[::-1]

        related_news = []
        for idx in sorted_indices:
            if i == idx: continue  # 자기 자신 제외
            score = float(sim_matrix[i][idx])
            if score < 0.25 : break  # 유사도 임계값 설정

            related_news.append({
                "news_id": news_items[idx]['news_id'],
                "score": score
            })
            # if len(related_news) >= 5: break  # 상위 5개만 저장

        if related_news:
            similarity_actions.append({
                    "news_id": news_items[i]['news_id'],
                    "related_news": related_news,
                    "timestamp": datetime.now().isoformat()
            })
    return similarity_actions


# 1. 1차 그룹핑 (기사 간 유사도 기반)
# ---------------------------------------------------------
def topic_grouping(news_group):
    """
    1차: 기사 간 유사도(Cosine Similarity) 결과를 바탕으로 그래프를 생성하고
    연결된 컴포넌트(Connected Components)를 찾아 그룹핑합니다.
    Returns: (groups, edges)
    """
    adj_list = {}
    all_nodes = set()
    edges = []

    for item in news_group:
        source_id = item['news_id']
        all_nodes.add(source_id)

        if source_id not in adj_list:
            adj_list[source_id] = set()

        for rel in item['related_news']:
            # score 0.25 이상만 유효한 엣지로 간주
            if rel['score'] >= 0.25:
                target_id = rel['news_id']
                all_nodes.add(target_id)

                # 양방향 연결
                adj_list[source_id].add(target_id)
                if target_id not in adj_list:
                    adj_list[target_id] = set()
                adj_list[target_id].add(source_id)

                # 시각화용 엣지 저장
                edge = tuple(sorted([source_id, target_id]))
                if edge not in [e[:2] for e in edges]:
                    edges.append((edge[0], edge[1], rel['score']))

    # BFS로 그룹 찾기
    visited = set()
    groups = []

    for node in all_nodes:
        if node not in visited:
            component = []
            queue = [node]
            visited.add(node)
            while queue:
                curr = queue.pop(0)
                component.append(curr)
                if curr in adj_list:
                    for neighbor in adj_list[curr]:
                        if neighbor not in visited:
                            visited.add(neighbor)
                            queue.append(neighbor)
            groups.append(component)

    return groups, edges


# ---------------------------------------------------------
# 2. 2차 그룹핑 (그룹 간 유사도 기반 병합)
# ---------------------------------------------------------
def merge_similar_groups(groups, all_news_dict, threshold:float = 0.25):
    """
    2차: 1차로 분류된 그룹들의 전체 텍스트를 합쳐서 다시 TF-IDF를 돌리고,
    그룹 간 유사도가 threshold 이상이면 병합합니다.
    """
    if len(groups) < 2:
        return groups

    # 1. 각 그룹의 텍스트 뭉치기
    group_texts = []
    for group in groups:
        combined_text = []
        for news_id in group:
            if news_id in all_news_dict:
                # tokens_aggr로 이미 토큰화된 문자열을 가져옴
                token_str = all_news_dict[news_id].get('token', '')
                combined_text.append(str(token_str))
        group_texts.append(" ".join(combined_text))

    # 2. 그룹 간 유사도 계산
    try:
        vectorizer = TfidfVectorizer()
        tfidf_matrix = vectorizer.fit_transform(group_texts)
        sim_matrix = cosine(tfidf_matrix)  # sklearn cosine_similarity
    except ValueError:
        # 텍스트가 비어있거나 하는 경우 원본 유지
        return groups

    # 3. 그룹 간 병합 그래프 생성
    n_groups = len(groups)
    adj = {i: set() for i in range(n_groups)}

    for i in range(n_groups):
        for j in range(i + 1, n_groups):
            if sim_matrix[i][j] >= threshold:
                adj[i].add(j)
                adj[j].add(i)

    # 4. BFS로 병합된 그룹 찾기
    visited = set()
    merged_groups = []

    for i in range(n_groups):
        if i not in visited:
            stack = [i]
            visited.add(i)
            new_big_group = []
            while stack:
                curr_idx = stack.pop()
                new_big_group.extend(groups[curr_idx])
                for neighbor in adj[curr_idx]:
                    if neighbor not in visited:
                        visited.add(neighbor)
                        stack.append(neighbor)
            merged_groups.append(new_big_group)

    return merged_groups


# ---------------------------------------------------------
# 3. 통합 시각화 함수
# ---------------------------------------------------------
def visualize_groups(groups, edges, title:str="News Grouping"):
    """
    그룹 결과를 시각화합니다. 서버 실행 시 plt.show()는 주의해야 합니다.
    """
    group_centers = []
    node_positions = {}

    if len(groups) > 0:
        colors = plt.cm.rainbow(np.linspace(0, 1, len(groups)))
        grid_cols = math.ceil(math.sqrt(len(groups)))
    else:
        colors = []
        grid_cols = 1

    grid_spacing = 4.0

    for i, group in enumerate(groups):
        cx = (i % grid_cols) * grid_spacing
        cy = (i // grid_cols) * grid_spacing
        group_centers.append((cx, cy))

        n_nodes = len(group)
        radius = 1.0 if n_nodes > 1 else 0

        for j, node_id in enumerate(group):
            angle = 2 * math.pi * j / n_nodes if n_nodes > 0 else 0
            x = cx + radius * math.cos(angle)
            y = cy + radius * math.sin(angle)
            node_positions[node_id] = (x, y)

            plt.scatter(x, y, color=colors[i], zorder=5, edgecolors='black')
            plt.text(x, y + 0.15, node_id[:6], fontsize=7, ha='center', fontweight='bold')

    # 기존 기사 간 연결선 (Edges from 1st grouping)
    for u, v, score in edges:
        if u in node_positions and v in node_positions:
            x1, y1 = node_positions[u]
            x2, y2 = node_positions[v]
            plt.plot([x1, x2], [y1, y2], color='gray', alpha=0.5, linewidth=1, zorder=1)

    # 그룹 배경 원
    for i, (cx, cy) in enumerate(group_centers):
        group_radius = 1.8
        circle = plt.Circle((cx, cy), group_radius, color=colors[i], alpha=0.1, zorder=0)
        plt.gca().add_patch(circle)
        plt.text(cx, cy - group_radius - 0.2, f"Group {i + 1}", ha='center',
                 fontsize=12, fontweight='bold', color=colors[i])

    plt.title(title, fontsize=15)
    plt.axis('equal')
    plt.axis('off')
    plt.tight_layout()

    # [서버 환경 설정]
    # 실제 서버 배포 시에는 plt.show() 대신 plt.savefig('result.png') 등을 사용하세요.
    plt.savefig(f"{title}.png")