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

            console.log("[TAB CLICK] 클릭된 탭: " + category);

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

    // [1] NPTI 사용자 통계 탭
    if (category === 'stats') {
        contentArea.innerHTML = `
            <div class="layout-wrapper animate-fade-in">
                ${createSection("NPTI별 회원 분포", "npti_main", "npti_sub")} 
                ${createSection("NPTI 4가지 분류별 회원분포", "", "metrics_sub")}
            </div>`;
    } 
}

// 필드 옵션 생성
const options = {
    'npti_main': ['NPTI', '나이', '성별'],
    'npti_sub': ['STFP', 'STFN', 'STIP', 'STIN', 'SCFP', 'SCFN', 'SCIP', 'SCIN', 'LTFP', 'LTFN', 'LTIP', 'LTIN', 'LCFP', 'LCFN', 'LCIP', 'LCIN'],
    'metrics_sub': ['Short', 'Long', 'Content', 'Tale', 'Fact', 'Information', 'Positive', 'Negative']
};

function createBoxHeader(title, fieldType, hasToggle) {
    
    const leftContent = hasToggle
        ? `<div class="toggle-group">
                <button class="btn-toggle active">일별</button>
                <button class="btn-toggle">주별</button>
                <button class="btn-toggle">월별</button>
           </div>`
        : `<div class="header-title-group">
                <h3 class="box-title">${title}</h3>
                <span class="box-timestamp">2025-12-29 16:02:56 기준</span>
           </div>`;

    const checkboxFields = ['npti_sub', 'metrics_sub'];
    let rightContent = "";

    if (fieldType) {
        if (checkboxFields.includes(fieldType)) {
            // 1. 체크박스 아이템 생성 (기존과 동일하지만 class 확인)
            const checkboxItems = options[fieldType].map(opt => `
                <label class="checkbox-label">
                    <input type="checkbox" checked onclick="event.stopPropagation()"> <span class="checkbox-text">${opt}</span>
                </label>
            `).join('');

            // 2. 드롭다운 구조
            rightContent = `
                <div class="custom-dropdown" data-title="${title}" onclick="this.classList.toggle('active')">
                    <button class="dropdown-btn" onclick="event.stopPropagation(); this.parentElement.classList.toggle('active')">
                        필드 <span class="arrow">▼</span>
                    </button>
                    <div class="dropdown-menu" onclick="event.stopPropagation()"> <div class="checkbox-list">${checkboxItems}</div>
                    </div>
                </div>`;
        } else {
            // 일반 드롭다운 (기존과 동일)
            rightContent = `
                <select class="box-select">
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

// 섹션 생성 헬퍼 함수
function createSection(title, leftField, rightField) {
    return `
        <div class="layout-section">
            <div class="layout-row">
                <div class="box-container half">
                    ${createBoxHeader(title, leftField, false)}
                    <div class="empty-box"></div>
                </div>
                <div class="box-container half">
                    ${createBoxHeader(title, rightField, true)}
                    <div class="empty-box"></div>
                </div>
            </div>
        </div>`;
}

// [교체] 클릭과 변경 이벤트를 동시에 감지하는 통합 함수
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