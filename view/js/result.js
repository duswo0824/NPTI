// 1. 전역 상수 및 상태 변수
const EL = {
    userName: () => document.getElementById('userName'),
    nptiCode: () => document.getElementById('nptiCode'),
    nptiName: () => document.getElementById('nptiName'),
    resultSummary: () => document.getElementById('resultSummary'),
    goCurationBtn: () => document.getElementById('goCurationBtn'),
    chartItems: () => document.querySelectorAll('.chart-item')
};

// 2. 메인 실행 (DOMContentLoaded)
document.addEventListener('DOMContentLoaded', async () => {
    // [보안] 로그인 및 결과 데이터 존재 여부 확인 
    const isReady = await initResultPage();

    if (isReady) {
        // [이벤트] 버튼 클릭 핸들러 등록
        EL.goCurationBtn()?.addEventListener('click', handleGoMain);
    }
});

// 3. 데이터 생성 및 헬퍼 함수 (서버 통신)
async function fetchResultData() {
    try {
        const response = await fetch('/result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        // 로그인 확인: 401 응답 시 로그인 페이지로 리다이렉트
        if (response.status === 401) {
            location.href = "/login";
            return null;
        }

        if (!response.ok) throw new Error('서버 응답 오류');

        return await response.json();
    } catch (err) {
        console.error("[Data Error] 결과 데이터를 가져오지 못했습니다:", err);
        return null;
    }
}

// 4. UI 컴포넌트 초기화 및 렌더링
async function initResultPage() {
    const res = await fetchResultData();

    // 데이터가 없거나 결과값이 없는 경우 처리
    if (!res || !res.hasResult) {
        if (res && !res.hasResult) {
            // 로그인 상태지만 결과가 없는 경우 테스트 페이지로 이동
            location.href = "/test";
        }
        return false;
    }

    const { user_npti, code_info, all_types } = res;

    // A. 텍스트 정보 삽입 (db_npti_code 데이터 연결)
    if (EL.userName()) EL.userName().textContent = localStorage.getItem('userName') || "독자";
    if (EL.nptiCode()) EL.nptiCode().textContent = user_npti.npti_code;
    if (EL.nptiName()) EL.nptiName().textContent = code_info.type_nick;
    if (EL.resultSummary()) {
        EL.resultSummary().innerHTML = `<p>${code_info.type_de}</p>`;
    }

    // B. 차트 렌더링 (db_npti_type 및 user_npti 점수 연결)
    const axisKeys = ['length', 'article', 'info', 'view'];

    axisKeys.forEach((key, idx) => {
        // npti_type DB에서 해당 그룹(예: length)의 좌/우 라벨(S/L 등) 추출
        const groupPair = all_types.filter(t => t.npti_group === key);
        if (groupPair.length < 2) return;

        // DB에 저장된 가중치 점수 (float 0.0~1.0 -> 100분율로 변환)
        const scorePercentage = user_npti[`${key}_score`] * 100;

        renderChartItem(key, groupPair, scorePercentage, idx);
    });

    return true;
}

/* 개별 차트 바 및 라벨 렌더링 */
function renderChartItem(key, pair, score, idx) {
    const container = EL.chartItems()[idx];
    if (!container) return;

    // pair[0]: 왼쪽(0 성향 - Long, Content, Insight, Positive)
    // pair[1]: 오른쪽(1 성향 - Short, Tale, Fact, Negative)
    const leftType = pair[0];
    const rightType = pair[1];

    // 가중치 합산 점수(score)는 질문 설계상 '오른쪽 타입'의 강도
    // 예: Q1-1~3에 '매우 그렇다'를 할수록 Short(오른쪽) 점수가 높아짐
    const rightVal = Math.round(score); // 오른쪽 성향 수치
    const leftVal = 100 - rightVal;     // 왼쪽 성향 수치

    // 더 큰 값 결정
    const maxVal = Math.max(leftVal, rightVal);

    // 1. 라벨 및 퍼센트 텍스트 삽입 (npti_kor 필드 사용)
    container.querySelector('.label-left').innerHTML =
        `${leftType.npti_kor} <b style="color:var(--orange)">${leftVal}%</b>`;
    container.querySelector('.label-right').innerHTML =
        `<b style="color:var(--orange)">${rightVal}%</b> ${rightType.npti_kor}`;

    if (container.querySelector('.type-title')) {
        container.querySelector('.type-title').textContent = `${key.toUpperCase()} TYPE`;
    }

    // 2. 바 애니메이션 실행
    const bar = container.querySelector('.bar-fill');
    // const barBg = container.querySelector('.bar-bg'); // 바의 배경/트랙

    if (bar) {
        // 무조건 큰 값이 너비가 되도록 설정
        setTimeout(() => {
            bar.style.width = maxVal + "%";

            // 시각적 팁: 왼쪽이 크면 바를 왼쪽 정렬, 오른쪽이 크면 오른쪽 정렬하고 싶을 때 사용
            if (leftVal >= rightVal) {
                bar.style.left = "0";
                bar.style.right = "auto";
                bar.style.backgroundColor = "var(--orange)"; // 왼쪽 강조 색상
            } else {
                bar.style.left = "auto";
                bar.style.right = "0";
                bar.style.backgroundColor = "var(--orange)"; // 오른쪽 강조 색상
            }
        }, 150);
    }

    // 3. 알파벳 기호 하이라이트 (더 높은 쪽 강조)
    const charL = container.querySelector('.char-left');
    const charR = container.querySelector('.char-right');

    if (leftVal > rightVal) {
        charL.style.color = "var(--orange)";
        charR.style.color = "#ccc";
    } else if (rightVal > leftVal) {
        charR.style.color = "var(--orange)";
        charL.style.color = "#ccc";
    } else {
        // 50:50 동일할 경우 처리
        charL.style.color = "var(--orange)";
        charR.style.color = "var(--orange)";
    }
}

// 5. 이벤트 핸들러 및 페이지 이동
function handleGoMain() {
    // 메인 페이지(큐레이션)로 이동 전 상태 기록
    localStorage.setItem('hasNPTI', 'true');
    location.href = "/";
}