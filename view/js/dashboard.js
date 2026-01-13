document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

function initDashboard() {
    // 1. 관리자 권한 체크 (sessionStorage 활용)
    const sessionStr = sessionStorage.getItem('admin_session');
    if (!sessionStr) {
        // 테스트용 세션 강제 생성
        sessionStorage.setItem('admin_session', JSON.stringify({ id: 'admin', role: 'admin' }));
    }

    // 2. 탭 네비게이션 설정
    setupTabNavigation();

    // 3. 초기 화면 렌더링
    renderContent('stats');
}

// 탭 클릭 이벤트 설정
function setupTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tabs a');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const category = tab.dataset.category;

            console.log("클릭된 탭: " + category);

            // 탭 스타일 변경 (Active 클래스 관리)
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // 내용 렌더링 호출
            renderContent(category);
        });
    });
}

// npti 사용자 통계 콘텐츠 렌더링 로직
function renderContent(category) {
    const contentArea = document.getElementById('adminContentArea');
    if (!contentArea) return;

    if (category === 'stats') {
        contentArea.innerHTML = `
            <div class="layout-wrapper animate-fade-in">
                ${createSection("NPTI별 회원 분포", "npti_main", "npti_sub", false)} 
                ${createSection("NPTI 4가지 분류별 회원분포", "", "metrics_sub", false)}
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
}

function renderNoData() {
    return `
        <div class="no-data-container">
            <div class="no-data-box">
                <p>데이터가 없습니다.</p>
            </div>
        </div>
    `;
}

// 섹션 생성 헬퍼 함수
function createSection(title, leftField, rightField, isToggleLeft = false) {
    const isSingle = (rightField === "" || rightField === null);

    // 왼쪽 박스: 항상 half 클래스를 사용하여 50% 너비 유지
    const leftBoxHtml = `
        <div class="box-container half">
            ${createBoxHeader(title, leftField, isToggleLeft)}
            <div class="empty-box"></div>
        </div>`;

    // 오른쪽 박스 처리
    let rightBoxHtml = "";
    if (isSingle) {
        // 박스가 하나일 때: 오른쪽에 투명한 공간을 넣어 왼쪽 박스가 커지지 않게 막음
        rightBoxHtml = `<div class="box-container half" style="visibility: hidden;"></div>`;
    } else {
        // 박스가 두 개일 때: 기존대로 오른쪽 박스 생성
        rightBoxHtml = `
            <div class="box-container half">
                ${createBoxHeader(title, rightField, !isToggleLeft)}
                <div class="empty-box"></div>
            </div>`;
    }

    return `
        <div class="section-outer-header">
            <h3 class="section-main-title">${title}</h3>
            <span class="box-timestamp">2025-12-29 16:02:56 기준</span>
        </div>
        <div class="layout-section">
            <div class="layout-row">
                ${leftBoxHtml}
                ${rightBoxHtml}
            </div>
        </div>`;
}


// 필드 옵션 생성
const options = {
    'npti_main': ['NPTI', '나이', '성별'],
    'npti_sub': ['STFP', 'STFN', 'STIP', 'STIN', 'SCFP', 'SCFN', 'SCIP', 'SCIN', 'LTFP', 'LTFN', 'LTIP', 'LTIN', 'LCFP', 'LCFN', 'LCIP', 'LCIN'],
    'metrics_sub': ['Short', 'Long', 'Content', 'Tale', 'Fact', 'Information', 'Positive', 'Negative'],
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

    if (fieldType) {
        if (checkboxFields.includes(fieldType)) {
            const isSingleSelect = (fieldType === 'npti_main');
            const inputType = isSingleSelect ? 'radio' : 'checkbox';
            const inputName = isSingleSelect ? `${fieldType}_group` : ''; // radio는 name이 같아야 하나만 선택됨

            const dropdownItems = options[fieldType].map((opt, index) => `
                <label class="checkbox-label">
                    <input type="${inputType}" 
                           ${inputName ? `name="${inputName}"` : ""} 
                           ${index === 0 ? 'checked' : ''} 
                           onclick="event.stopPropagation()"> 
                    <span class="checkbox-text">${opt}</span>
                </label>
            `).join('');

            // 버튼 텍스트 설정 (npti_main은 'NPTI', 나머지는 '필드')
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

    return `
        <div class="box-header">
            <div class="header-left">${leftContent}</div>
            <div class="header-right">${rightContent}</div>
        </div>`;
}

// 클릭과 변경 이벤트를 동시에 감지하는 통합 함수
function handleUIEvents(e) {
    // 일/주/월 토글 버튼 클릭 처리
    const toggleBtn = e.target.closest('.btn-toggle');
    if (e.type === 'click' && toggleBtn) {
        const toggleGroup = toggleBtn.parentElement;

        // 해당 그룹 내 모든 버튼에서 active 제거 후 클릭한 버튼에 추가
        toggleGroup.querySelectorAll('.btn-toggle').forEach(btn => btn.classList.remove('active'));
        toggleBtn.classList.add('active');

        // 박스 제목 찾기 (data-title 속성 활용)
        const boxTitle = toggleGroup.getAttribute('data-title') || "시간 단위";
        console.log("[" + boxTitle + "] 시간 단위 변경:", toggleBtn.innerText);
        return; // 토글 처리 후 종료
    }

    // 1. 일반 드롭다운(select) 값이 바뀐 경우
    if (e.type === 'change' && e.target.classList.contains('box-select')) {
        const select = e.target;
        const boxTitle = select.getAttribute('data-title') || "필드 선택";
        console.log("[" + boxTitle + "] 적용된 필드:", [select.value]);
        return;
    }

    // 2. 커스텀 체크박스 드롭다운 바깥 클릭 시 처리
    if (e.type === 'click') {
        const activeDropdowns = document.querySelectorAll('.custom-dropdown.active');
        activeDropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                let checkedInputs = dropdown.querySelectorAll('input[type="checkbox"]:checked');

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
                console.log("[" + boxTitle + "] 적용된 필드:", selectedValues);

                dropdown.classList.remove('active');
            }
        });
    }
}

// 이벤트 리스너 등록
['click', 'change'].forEach(evt => window.addEventListener(evt, handleUIEvents));