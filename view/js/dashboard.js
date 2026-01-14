let globalStatsData = null;
let chartInstances = {};

// Chart.js 전역 설정 (폰트 등)
Chart.defaults.font.family = "'Pretendard', sans-serif";
Chart.defaults.color = '#666';

// 색상 팔레트
const COLORS = {
    orange: '#FF7F50',
    blue: '#36A2EB',
    red: '#FF6384',
    green: '#4BC0C0',
    purple: '#9966FF',
    grey: '#C9CBCF',
    mix: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#FF7F50', '#20B2AA', '#87CEFA', '#778899', '#DA70D6', '#BDB76B', '#F08080', '#4682B4', '#556B2F']
};

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

async function initDashboard() {
    try {
        const res = await fetch('/members_statistics');
        globalStatsData = await res.json();
        console.log({"statsdata" : globalStatsData});
    } catch (e) {
        console.error("데이터 로드 실패", e);
        return;
    }

    // 1. 관리자 권한 체크
    const sessionStr = sessionStorage.getItem('admin_session');
    if (!sessionStr) {
        sessionStorage.setItem('admin_session', JSON.stringify({ id: 'admin', role: 'admin' }));
    }

    // 2. 탭 네비게이션 설정
    setupTabNavigation();

    // 3. 초기 화면 렌더링
    renderContent('stats');
}

function setupTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tabs a');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const category = tab.dataset.category;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderContent(category);
        });
    });
}

function renderContent(category) {
    const contentArea = document.getElementById('adminContentArea');
    if (!contentArea) return;

    if (category === 'stats') {
        contentArea.innerHTML = `
            <div class="layout-wrapper animate-fade-in">
                ${createSection("NPTI별 회원 분포", "npti_main", "npti_sub", false)}
                ${createSection("NPTI 4가지 분류별 회원분포", "metrics_main", "metrics_sub", false)}
            </div>`;
    }
    else if (category === 'articles') {
        contentArea.innerHTML = `
            <div class="layout-wrapper animate-fade-in">
                ${createSection("카테고리별 수집기사", "news_categories", "", true)}
                ${createSection("NPTI별 수집기사", "npti_sub", "metrics_short", true)}
            </div>`;
    }
    else {
        contentArea.innerHTML = renderNoData();
    }

    if (globalStatsData) {
        drawChartsForCategory(category);
    }
}

function renderNoData() {
    return `<div class="no-data-container"><div class="no-data-box"><p>데이터가 없습니다.</p></div></div>`;
}

function createSection(title, leftField, rightField, isToggleLeft = false) {
    const isSingle = (rightField === "" || rightField === null);
    const leftCanvasId = `canvas-${leftField || 'left-' + title.replace(/\s/g, '')}`;

    const leftBoxHtml = `
        <div class="box-container half">
            ${createBoxHeader(title, leftField, isToggleLeft)}
            <div class="chart-container">
                <canvas id="${leftCanvasId}"></canvas>
            </div>
        </div>`;

    const rightCanvasId = `canvas-${rightField || 'right-' + title.replace(/\s/g, '')}`;
    let rightBoxHtml = "";
    if (isSingle) {
        rightBoxHtml = `<div class="box-container half" style="visibility: hidden;"></div>`;
    } else {
        rightBoxHtml = `
            <div class="box-container half">
                ${createBoxHeader(title, rightField, !isToggleLeft)}
                <div class="chart-container">
                    <canvas id="${rightCanvasId}"></canvas>
                </div>
            </div>`;
    }

    return `
        <div class="section-outer-header">
            <h3 class="section-main-title">${title}</h3>
            <span class="box-timestamp">${globalStatsData.time_now}</span>
        </div>
        <div class="layout-section">
            <div class="layout-row">
                ${leftBoxHtml}
                ${rightBoxHtml}
            </div>
        </div>`;
}

const options = {
    'npti_main': ['NPTI', '나이', '성별'],
    'npti_sub': ['STFP', 'STFN', 'STIP', 'STIN', 'SCFP', 'SCFN', 'SCIP', 'SCIN', 'LTFP', 'LTFN', 'LTIP', 'LTIN', 'LCFP', 'LCFN', 'LCIP', 'LCIN'],
    'metrics_main' : ['속성별 분포'],
    'metrics_sub': ['Short', 'Long', 'Content', 'Tale', 'Fact', 'Insight', 'Positive', 'Negative'],
    'news_categories': ['정치', '경제', '사회', '생활/문화', 'IT/과학', '세계', '스포츠', '연예', '지역'],
    'metrics_short': ['S/L', 'C/T', 'F/I', 'P/N']
};

function createBoxHeader(title, fieldType, hasToggle) {
    const leftContent = hasToggle
        ? `<div class="toggle-group" data-title="${title}">
                <button type="button" class="btn-toggle active">일별</button>
                <button type="button" class="btn-toggle">주별</button>
                <button type="button" class="btn-toggle">월별</button>
           </div>`
        : "";

    const checkboxFields = ['npti_main', 'npti_sub', 'metrics_sub', 'news_categories', 'metrics_short'];
    let rightContent = "";

    if (fieldType && options[fieldType] && fieldType !== 'metrics_main') {
        if (checkboxFields.includes(fieldType)) {
            const isSingleSelect = (fieldType === 'npti_main');
            const inputType = isSingleSelect ? 'radio' : 'checkbox';
            const inputName = isSingleSelect ? `${fieldType}_group` : '';

            const dropdownItems = options[fieldType].map((opt, index) => {
                const isChecked = isSingleSelect ? (index === 0 ? 'checked' : '') : 'checked';
                return `
                    <label class="checkbox-label">
                        <input type="${inputType}" ${inputName ? `name="${inputName}"` : ""} ${isChecked} onclick="event.stopPropagation()">
                        <span class="checkbox-text">${opt}</span>
                    </label>
                `;
            }).join('');

            const btnText = isSingleSelect ? 'NPTI' : '필드';
            rightContent = `
                <div class="custom-dropdown" data-title="${title}" onclick="this.classList.toggle('active')">
                    <button class="dropdown-btn" onclick="event.stopPropagation(); this.parentElement.classList.toggle('active')">
                        ${btnText} <span class="arrow">▼</span>
                    </button>
                    <div class="dropdown-menu" onclick="event.stopPropagation()">
                        <div class="checkbox-list">${dropdownItems}</div>
                    </div>
                </div>`;
        } else {
            rightContent = `
                <select class="box-select" data-title="${title}">
                    ${options[fieldType].map(opt => `<option>${opt}</option>`).join('')}
                </select>`;
        }
    }

    return `<div class="box-header"><div class="header-left">${leftContent}</div><div class="header-right">${rightContent}</div></div>`;
}

function handleUIEvents(e) {
    const toggleBtn = e.target.closest('.btn-toggle');
    if (e.type === 'click' && toggleBtn) {
        const toggleGroup = toggleBtn.parentElement;
        toggleGroup.querySelectorAll('.btn-toggle').forEach(btn => btn.classList.remove('active'));
        toggleBtn.classList.add('active');

        const boxTitle = toggleGroup.getAttribute('data-title') || "시간 단위";
        const selectedValue = toggleBtn.innerText;
        updateSpecificChart(boxTitle, selectedValue, true);
        return;
    }

    if (e.type === 'change' && e.target.classList.contains('box-select')) {
        const select = e.target;
        const boxTitle = select.getAttribute('data-title') || "필드 선택";
        console.log("[" + boxTitle + "] 적용된 필드:", [select.value]);
        return;
    }

    if (e.type === 'click') {
        const activeDropdowns = document.querySelectorAll('.custom-dropdown.active');
        activeDropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                let checkedInputs = dropdown.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked');

                if (checkedInputs.length === 0) {
                    const allInputs = dropdown.querySelectorAll('input[type="checkbox"]');
                    allInputs.forEach(input => { input.checked = true; });
                    checkedInputs = dropdown.querySelectorAll('input[type="checkbox"]:checked');
                }

                const selectedValues = Array.from(checkedInputs).map(input => {
                    const textSpan = input.parentElement.querySelector('.checkbox-text');
                    return textSpan ? textSpan.innerText : input.value;
                });

                const boxTitle = dropdown.getAttribute('data-title') || "선택 필드";
                const btn = dropdown.querySelector('.dropdown-btn');
                const isRadio = dropdown.querySelector('input[type="radio"]');

                if (btn && isRadio && selectedValues.length > 0) {
                    btn.innerHTML = `${selectedValues[0]} <span class="arrow">▼</span>`;
                }

                console.log("[" + boxTitle + "] 적용된 필드:", selectedValues);
                updateSpecificChart(boxTitle, selectedValues, false)
                dropdown.classList.remove('active');
            }
        });
    }
}

function drawChartsForCategory(category) {
    if (!globalStatsData) return;

    if (category === 'stats') {
        createPieChart('canvas-npti_main', globalStatsData.result1_npti_code, 'npti_code');
        createLineChartNPTI('canvas-npti_sub', globalStatsData.result2_day);
        createStackedBarChart('canvas-metrics_main', globalStatsData.result3_npti_type);
        createLineChartType('canvas-metrics_sub', globalStatsData.result4_day);
    }
}

// ==========================================================
// [Chart 1] Pie Chart (% 변환)
// ==========================================================
function createPieChart(canvasId, data, labelKey) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    ctx.parentNode.style.height = '320px';

    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();
    if (chartInstances[canvasId]) delete chartInstances[canvasId];

    if (!data || data.length === 0) {
        console.warn(`[${canvasId}] 데이터가 없습니다.`);
        return;
    }

    // 1. 라벨 변환
    const labels = data.map(item => {
        const rawValue = item[labelKey];
        if (labelKey === 'user_gender') {
            if (rawValue === 0 || rawValue === '0') return '남성';
            if (rawValue === 1 || rawValue === '1') return '여성';
            return '알 수 없음';
        }
        return rawValue;
    });

    // 2. 값(Count) -> 백분율(Percentage) 변환
    const counts = data.map(item => item.count);
    const totalCount = counts.reduce((sum, val) => sum + val, 0);

    // totalCount가 0이면 0으로 처리, 아니면 퍼센트 계산 (소수점 1자리)
    const percentages = counts.map(val => totalCount === 0 ? 0 : parseFloat(((val / totalCount) * 100).toFixed(1)));

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: percentages, // 퍼센트 데이터 사용
                backgroundColor: COLORS.mix.slice(0, labels.length),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12 } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) label += ': ';
                            // 툴팁에도 % 붙여서 표시
                            label += context.parsed + '%';
                            return label;
                        }
                    }
                }
            }
        }
    });
}

// ==========================================================
// [Chart 2] Stacked Bar Chart (Y축 0~100% 고정)
// ==========================================================
function createStackedBarChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    ctx.parentNode.style.height = '320px';

    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    const labels = ['에너지 (L vs S)', '인식 (C vs T)', '판단 (I vs F)', '계획 (P vs N)'];

    // 각 속성값
    const L = data.L_count || 0;
    const S = data.S_count || 0;
    const C = data.C_count || 0;
    const T = data.T_count || 0;
    const I = data.I_count || 0;
    const F = data.F_count || 0;
    const P = data.P_count || 0;
    const N = data.N_count || 0;

    // 쌍별 합계 (Total)
    const totalLS = L + S || 1; // 0나누기 방지
    const totalCT = C + T || 1;
    const totalIF = I + F || 1;
    const totalPN = P + N || 1;

    // 퍼센트 변환 함수
    const toPct = (val, total) => parseFloat(((val / total) * 100).toFixed(1));

    const dataLeft = [toPct(L, totalLS), toPct(C, totalCT), toPct(I, totalIF), toPct(P, totalPN)];
    const dataRight = [toPct(S, totalLS), toPct(T, totalCT), toPct(F, totalIF), toPct(N, totalPN)];

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Left Type (L,C,I,P)', data: dataLeft, backgroundColor: COLORS.orange },
                { label: 'Right Type (S,T,F,N)', data: dataRight, backgroundColor: COLORS.grey }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    min: 0,
                    max: 100, // Y축 최대 100% 고정
                    ticks: {
                        callback: function(value) { return value + "%" } // 눈금에 % 표시
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y + '%';
                        }
                    }
                }
            }
        }
    });
}

// ==========================================================
// [Chart 3] Line Chart (NPTI Code별) - 날짜별 비중(%)
// ==========================================================
function createLineChartNPTI(canvasId, rawData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    ctx.parentNode.style.height = '320px';

    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    const dates = [...new Set(rawData.map(item => item.date_period))];
    const chartLabels = dates.map(dateStr => {
        if (dateStr.includes('\n')) {
            return dateStr.split('\n');
        }
        return dateStr;
    });
    const codes = [...new Set(rawData.map(item => item.npti_code))];

    // [중요] 날짜별 전체 합계(Total Count) 미리 계산
    const dailyTotals = {};
    rawData.forEach(item => {
        const d = item.date_period;
        if (!dailyTotals[d]) dailyTotals[d] = 0;
        dailyTotals[d] += item.user_count;
    });

    const datasets = codes.map((code, idx) => {
        const dataPoints = dates.map(date => {
            const found = rawData.find(r => r.date_period === date && r.npti_code === code);
            const count = found ? found.user_count : 0;
            const total = dailyTotals[date] || 1; // 0나누기 방지

            // (해당 코드 수 / 그날 전체 사용자 수) * 100
            return parseFloat(((count / total) * 100).toFixed(1));
        });

        return {
            label: code,
            data: dataPoints,
            borderColor: COLORS.mix[idx % COLORS.mix.length],
            tension: 0.3,
            fill: false,
            clip: false,
            pointRadius: 4,
            pointHoverRadius: 6
        };
    });

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: { labels: chartLabels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: false } },
            layout: {
                padding: {top: 20, right: 10, left: 10}
            },
            scales: {
                y: {
                    beginAtZero: true,
                    min: 0,
                    max: 100, // Y축 100% 고정
                    ticks: {
                        stepSize: 20,
                        callback: (val) => val + "%"
                    }
                }
            }
        }
    });
}

// ==========================================================
// [Chart 4] Line Chart (Type 속성별) - 날짜별 비중(%)
// ==========================================================
function createLineChartType(canvasId, rawData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    ctx.parentNode.style.height = '320px';

    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    const dates = rawData.map(d => d.date_period);
    const chartLabels = dates.map(dateStr => {
        if (dateStr.includes('\n')) {
            return dateStr.split('\n');
        }
        return dateStr;
    });

    // 각 날짜별로 Type 합계 구하기 (보통 L+S = 전체, C+T = 전체이므로 L+S를 기준으로 함)
    // rawData row: {date_period: "...", L_count: 10, S_count: 5...}
    const rowTotals = {};
    rawData.forEach(row => {
        // L과 S의 합을 해당 날짜의 전체 모수로 가정 (MBTI 특성상)
        rowTotals[row.date_period] = (row.L_count || 0) + (row.S_count || 0);
        if (rowTotals[row.date_period] === 0) rowTotals[row.date_period] = 1; // 방어
    });

    const toRowPct = (val, date) => {
        const total = rowTotals[date];
        return parseFloat(((val / total) * 100).toFixed(1));
    };

    const types = [
        { key: 'L_count', label: 'Long', color: COLORS.orange },
        { key: 'S_count', label: 'Short', color: COLORS.grey },
        { key: 'C_count', label: 'Content', color: COLORS.blue },
        { key: 'T_count', label: 'Tale', color: COLORS.purple },
        { key: 'I_count', label: 'Insight', color: COLORS.green },
        { key: 'F_count', label: 'Fact', color: COLORS.red },
        { key: 'P_count', label: 'Positive', color: COLORS.orange },
        { key: 'N_count', label: 'Negative', color: COLORS.grey }
    ];

    const datasets = types.map(t => ({
        label: t.label,
        data: rawData.map(row => toRowPct(row[t.key], row.date_period)),
        borderColor: t.color,
        tension: 0.3,
        hidden: false,
        clip: false,
        pointRadius: 4,
        pointHoverRadius: 6
    }));

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: { labels: chartLabels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            layout: {
                padding: {top:20, right: 10, left :10}
            },
            scales: {
                y: {
                    beginAtZero: true,
                    min: 0,
                    max: 100, // Y축 100% 고정
                    ticks: {
                        stepSize :20,
                        callback: (val) => val + "%"
                    }
                }
            }
        }
    });
}

function updateSpecificChart(boxTitle, changedValue, isToggleEvent = false) {
    if (!globalStatsData) return;

    // 1. [Pie Chart] NPTI별 회원 분포
    if (boxTitle === 'NPTI별 회원 분포' && !isToggleEvent) {
        let newData = null;
        let labelKey = '';

        const selected = changedValue[0];
        if (selected === 'NPTI') {
            newData = globalStatsData.result1_npti_code;
            labelKey = 'npti_code';
        } else if (selected === '나이') {
            newData = globalStatsData.result1_age;
            labelKey = 'age_group';
        } else if (selected === '성별') {
            newData = globalStatsData.result1_gender;
            labelKey = 'user_gender';
        }
        if (newData) createPieChart('canvas-npti_main', newData, labelKey);
    }

    // 2. [Line Chart] NPTI별 변화 (일/주/월)
    if (boxTitle === 'NPTI별 회원 분포') {
        const canvasId = 'canvas-npti_sub';
        if (isToggleEvent) {
            let newData = null;
            if (changedValue === '일별') newData = globalStatsData.result2_day;
            else if (changedValue === '주별') newData = globalStatsData.result2_week;
            else if (changedValue === '월별') newData = globalStatsData.result2_month;
            if (newData) createLineChartNPTI(canvasId, newData);
        } else {
            const chart = chartInstances[canvasId];
            if (chart) {
                chart.data.datasets.forEach(ds => {
                    ds.hidden = !changedValue.includes(ds.label);
                });
                chart.update();
            }
        }
    }

    // 3. [Line Chart] 4가지 분류별 변화
    if (boxTitle === 'NPTI 4가지 분류별 회원분포') {
        const canvasId = 'canvas-metrics_sub';
        if (isToggleEvent) {
            let newData = null;
            if (changedValue === '일별') newData = globalStatsData.result4_day;
            else if (changedValue === '주별') newData = globalStatsData.result4_week;
            else if (changedValue === '월별') newData = globalStatsData.result4_month;
            if (newData) createLineChartType(canvasId, newData);
        } else {
            const chart = chartInstances[canvasId];
            if (chart) {
                chart.data.datasets.forEach(ds => {
                    ds.hidden = !changedValue.includes(ds.label);
                });
                chart.update();
            }
        }
    }
}

// 이벤트 리스너 등록
['click', 'change'].forEach(evt => window.addEventListener(evt, handleUIEvents));