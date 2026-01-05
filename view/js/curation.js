document.addEventListener('DOMContentLoaded', () => {
    // 1. 설정 및 상태 변수
    const ITEMS_PER_PAGE = 20;
    const urlParams = new URLSearchParams(window.location.search);
    const selectedType = urlParams.get('type');
    const nptiResult = selectedType || localStorage.getItem('nptiResult') || 'STFN';

    const resultHeader = document.getElementById('nptiResultHeader');
    const curationList = document.getElementById('curationList');
    const categoryTabs = document.querySelectorAll('.nav-tabs a');
    const resultsArea = document.querySelector('.news-feed-section');

    // 현재 상태 저장 (페이지네이션 클릭 시 사용)
    let currentCategory = 'all';
    let currentPage = 1;

    // 2. 상단 NPTI 성향 바 렌더링
    function renderCurationHeader() {
        if (!resultHeader) return;
        const nicknames = { 'STFN': '팩트 현실주의자', 'LCIP': '심층 분석가', 'STFP': '열정적 소식통', 'LCIN': '심층 비평가' };
        const descMap = { 'S': '짧은', 'L': '긴', 'T': '이야기형', 'C': '텍스트형', 'F': '객관적', 'I': '분석적', 'N': '비판적', 'P': '우호적' };
        const nickname = nicknames[nptiResult] || '나만의 뉴스 탐험가';

        resultHeader.innerHTML = `
            <div class="npti-header">
                <span class="npti-code" style="color:#FF6B00;">${nptiResult}</span> 
                <span class="npti-nickname">${nickname}</span>
            </div>
            <div class="tags">
                <div class="tag-text">
                    ${nptiResult.split('').map(char => `<span><b class="point">${char}</b> - ${descMap[char] || ''}</span>`).join('')}
                </div>
            </div>
        `;
        const curationTitle = document.getElementById('curation-result-title');
        if (curationTitle) curationTitle.innerText = `[${nptiResult}] 성향 뉴스 큐레이션`;
    }

    // 3. 맞춤 뉴스 리스트 렌더링 (페이지네이션 연동 수정)
    function loadCurationNews(category = 'all', page = 1) {
        if (!curationList) return;
        curationList.innerHTML = '';
        currentCategory = category;
        currentPage = page;

        const totalItems = 50; // 전체 데이터 개수
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);

        // 해당 페이지에 해당하는 데이터만 생성
        for (let i = startIndex + 1; i <= endIndex; i++) {
            const article = document.createElement('a');
            article.className = 'news-card';
            article.href = `/view/html/view.html?id=${nptiResult}_curation_${i}`;
            article.innerHTML = `
                <div class="news-img"><i class="fa-regular fa-image"></i></div>
                <div class="news-info">
                    <h3>[${category.toUpperCase()}] ${nptiResult} 타입을 위한 맞춤 헤드라인 예시 ${i}</h3>
                    <p>${nptiResult} 성향에 맞춰 재구성된 뉴스입니다. ${nptiResult[0] === 'S' ? '간결한 요약' : '심도 있는 분석'}을 제공합니다.</p>
                    <div class="news-meta">NPTI Curation | 2026-01-05</div>
                </div>
            `;
            curationList.appendChild(article);
        }

        // [핵심] 리스트를 다 그린 후 페이지네이션 호출
        renderPagination(totalItems, page);
    }

    // 4. 페이지네이션 생성 함수
    function renderPagination(totalItems, currentPage) {
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        const oldPagination = document.querySelector('.pagination');
        if (oldPagination) oldPagination.remove();

        if (totalPages <= 1) return;

        const pagination = document.createElement('div');
        pagination.className = 'pagination';

        const createBtn = (text, targetPage, isDisabled) => {
            const btn = document.createElement('button');
            btn.innerText = text;
            btn.disabled = isDisabled;
            btn.onclick = () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                loadCurationNews(currentCategory, targetPage);
            };
            return btn;
        };

        pagination.appendChild(createBtn('《', 1, currentPage === 1));
        pagination.appendChild(createBtn('〈', currentPage - 1, currentPage === 1));

        for (let i = 1; i <= totalPages; i++) {
            const btnNum = document.createElement('button');
            btnNum.className = `page-num ${i === currentPage ? 'active' : ''}`;
            btnNum.innerText = i;
            btnNum.onclick = () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                loadCurationNews(currentCategory, i);
            };
            pagination.appendChild(btnNum);
        }

        pagination.appendChild(createBtn('〉', currentPage + 1, currentPage === totalPages));
        pagination.appendChild(createBtn('》', totalPages, currentPage === totalPages));

        // HTML의 paginationContainer가 있다면 거기 넣고, 없다면 resultsArea에 추가
        const container = document.getElementById('paginationContainer');
        if (container) {
            container.appendChild(pagination);
        } else {
            resultsArea.appendChild(pagination);
        }
    }

    // 5. 탭 클릭 이벤트
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            categoryTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const category = tab.getAttribute('data-category') || 'all';
            document.getElementById('categoryName').innerText = tab.innerText;
            loadCurationNews(category, 1); // 탭 클릭 시 1페이지부터
        });
    });

    // [초기 실행]
    renderCurationHeader();
    loadCurationNews('all', 1);
});

// 정렬 버튼 이벤트 (상태 연동은 loadCurationNews 인자 추가 필요 시 수정)
document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        // 정렬 시에도 1페이지부터 보여주는 것이 일반적입니다.
    });
});