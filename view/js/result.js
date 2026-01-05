document.addEventListener('DOMContentLoaded', () => {
    // 1. 유형 설명 DB
    const nptiData = {
        "STFN": { name: "팩트 현실주의자형", desc: "짧은 스트레이트 기사로<br>현실의 불편한 진실을 확인하려는 독자", point: "팩트 위주의 간결한 기사 선호" },
        "LCIP": { name: "심층 스토리텔러형", desc: "긴 호흡의 분석 기사를 통해<br>사건의 이면과 맥락을 파고드는 독자", point: "이야기 중심의 따뜻한 시선 선호" }
    };

    // 2. 지표 텍스트 DB
    const chartConfig = {
        length: { title: "Length Type", left: "짧은 기사", right: "긴 기사", isOrangeLeft: true },
        article: { title: "Article Type", left: "텍스트 중심 기사", right: "이야기형 기사", isOrangeLeft: false },
        info: { title: "Information Type", left: "객관적 기사", right: "분석 기사", isOrangeLeft: true },
        view: { title: "Viewpoint Type", left: "우호적 기사", right: "비판적 기사", isOrangeLeft: false }
    };

    // 3. 데이터 로드 (LocalStorage)
    const userName = localStorage.getItem('userName') || "admin";
    const userCode = localStorage.getItem('nptiResult') || "STFN";
    const scores = JSON.parse(localStorage.getItem('nptiScores')) || { length: 65, article: 72, info: 75, view: 82 };

    // 4. 기본 텍스트 삽입
    document.getElementById('userName').textContent = userName;
    document.getElementById('nptiCode').textContent = userCode;
    document.getElementById('nptiName').textContent = nptiData[userCode]?.name || "결과 분석 완료";
    document.getElementById('resultSummary').innerHTML = `<p>${nptiData[userCode]?.desc || ""}</p><p class="point">${nptiData[userCode]?.point || ""}</p>`;

    // 5. 차트 렌더링 함수
    function renderChartItem(key, barId, containerIdx) {
        const config = chartConfig[key];
        const score = scores[key];
        const container = document.querySelectorAll('.chart-item')[containerIdx];
        if (!container) return;

        const leftLabel = container.querySelector('.label-left');
        const rightLabel = container.querySelector('.label-right');
        const charL = container.querySelector('.char-left');
        const charR = container.querySelector('.char-right');

        const leftVal = config.isOrangeLeft ? score : (100 - score);
        const rightVal = config.isOrangeLeft ? (100 - score) : score;

        leftLabel.innerHTML = `${config.left} <b style="color:var(--orange)">${leftVal}%</b>`;
        rightLabel.innerHTML = `<b style="color:var(--orange)">${rightVal}%</b> ${config.right}`;
        container.querySelector('.type-title').textContent = config.title;

        // 바 애니메이션
        const bar = document.getElementById(barId);
        if (bar) setTimeout(() => { bar.style.width = score + "%"; }, 100);

        // 알파벳 하이라이트
        if (leftVal > rightVal) {
            charL.style.color = "var(--orange)";
            charR.style.color = "#111";
        } else {
            charR.style.color = "var(--orange)";
            charL.style.color = "#111";
        }
    }

    renderChartItem('length', 'barLength', 0);
    renderChartItem('article', 'barArticle', 1);
    renderChartItem('info', 'barInfo', 2);
    renderChartItem('view', 'barView', 3);

    document.getElementById('goCurationBtn')?.addEventListener('click', () => {
        // 진단 완료 상태를 로컬 스토리지에 저장
        localStorage.setItem('hasNPTI', 'true');
        location.href = "/view/html/main.html";
    });
});