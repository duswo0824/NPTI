document.addEventListener('DOMContentLoaded', async () => {
    // 1. 설정 및 상태 변수
    let currentSort = 'accuracy'; // 안쪽으로 이동
    let currentCategory = 'all';
    let currentPage = 1;
    let nptiResult = ''; 
    let userId = sessionStorage.getItem('userId');


    // 2. 로그인 및 NPTI 데이터 체크 로직
    async function checkAuthAndNPTI() {
        // 로그인 여부 확인 (userId가 없으면 로그인 페이지로)
        if (!userId) {
            alert('로그인이 필요한 서비스입니다.');
            window.location.href = '/view/html/login.html';
            return false;
        }

        try {
            // DB에서 NPTI_code 확인
            const response = await fetch(`http://127.0.0.1:8000/user/npti/${userId}`);
            
            if (response.ok) {
            // 성공(200 OK): 데이터가 있으므로 결과 저장
            const data = await response.json();
            // 상단에 랜더링 되는 npti코드와 뉴스 추출에 쓸 코드 일치
            nptiResult = data.npti_code;
            // 상단 렌더링 (백엔드에서 받은 데이터 전달)
            renderCurationHeader(data);
            // 동일한 nptiResult를 사용하여 뉴스 로드
            loadCurationNews('all', 1);
            return true;
            } 
            else if (response.status === 404) {
                // 실패(404 Not Found): 백엔드에서 raise HTTPException(status_code=404)를 보낸 경우
                alert('NPTI 진단 결과가 없습니다. 진단 페이지로 이동합니다.');
                window.location.href = '/view/html/test.html'; // 진단 페이지 경로
                return false;
            } 
            else {
                // 기타 에러 (500 등)
                alert('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
                return false;
            }
        } catch (error) {
            console.error("Auth Check Error:", error);
            alert('네트워크 연결을 확인해주세요.');
            return false;
        }
    }

    // 초기 로직 실행
    const isAuthorized = await checkAuthAndNPTI();
    if (!isAuthorized) return; // 권한이 없으면 이후 렌더링 중단

    // --- 이후 로직은 권한이 확인된 경우에만 실행됨 ---
    const resultHeader = document.getElementById('nptiResultHeader');
    const curationList = document.getElementById('curationList');
    const categoryTabs = document.querySelectorAll('.nav-tabs a');
    const resultsArea = document.querySelector('.news-feed-section');
    

    // 3. 상단 NPTI 성향 바 렌더링
    function renderCurationHeader(data) {
        if (!resultHeader || !data) return;

        const { npti_code, type_nick, npti_kor_list } = data;

        resultHeader.innerHTML = `
        <div class="npti-header" style="margin-bottom:15px;">
            <span class="npti-code">${npti_code}</span> 
            <span class="npti-nickname">${type_nick}</span>
        </div>
        <div class="tags">
            ${npti_code.split('').map((char, i) => `
                <div class="tag-item">
                    <span class="point">${char}</span> - ${npti_kor_list[i]}
                </div>
            `).join('')}
        </div>
    `;
        // 하단 제목 업데이트
        const curationTitle = document.getElementById('curation-result-title');
        if (curationTitle) curationTitle.innerText = `[${npti_code}] 성향 뉴스 큐레이션`;
    }

    // 4. 맞춤 뉴스 리스트 렌더링
    async function loadCurationNews(category = 'all', page = 1) {
        if (!curationList) return;
        curationList.innerHTML = '<div class="loading">뉴스를 분석 중입니다...</div>';
        currentCategory = category;
        currentPage = page;

        try {
        // FastAPI 엔드포인트 호출
        // nptiResult, category, page, ITEMS_PER_PAGE 변수를 쿼리 파라미터로 전달
        const response = await fetch(
            `http://127.0.0.1:8000/curated/new?npti=${nptiResult}&category=${category}&sort_type=${currentSort}&page=${page}`
        );

        if (!response.ok) throw new Error('데이터 로드 실패');
        const data = await response.json(); // { total: 100, articles: [...] } 형태 예상
        
        curationList.innerHTML = ''; // 로딩 메시지 제거

        // 검색 결과가 없을 경우 처리
        if (data.articles.length === 0) {
            curationList.innerHTML = '<p class="no-data">해당 조건에 맞는 뉴스가 없습니다.</p>';
            return;
        }

        // 서버에서 받아온 실제 데이터로 리스트 생성
        data.articles.forEach((news) => {
            const article = document.createElement('a');
            article.className = 'news-card';
            
            // 상세 페이지 이동 시 뉴스 고유 ID 전달
            article.href = `/view/html/view.html?id=${news.id}`; 
            
            article.innerHTML = `
                <div class="news-img">
                    ${news.thumbnail ? `<img src="${news.thumbnail}" alt="news">` : '<i class="fa-regular fa-image"></i>'}
                </div>
                <div class="news-info">
                    <h3>[${news.category.toUpperCase()}] ${news.title}</h3>
                    <p>${news.summary}</p>
                    <div class="news-meta">${news.publisher || 'NPTI Curation'} | ${news.date || '2026-01-08'}</div>
                </div>
            `;
            curationList.appendChild(article);
        });

        // 서버에서 알려준 '전체 개수(data.total)'를 기반으로 페이지네이션 생성
        renderPagination(data.total, page);

    } catch (error) {
        console.error('Error fetching news:', error);
        curationList.innerHTML = '<p class="error-msg">뉴스를 불러오는 중 오류가 발생했습니다.</p>';
    }
}// loadCurationNews 함수 종료

// 페이지네이션 생성 함수
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

// 탭 클릭 이벤트
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

// 모든 정렬 버튼에 이벤트 연결
document.querySelectorAll('.sort-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        // 1. 클릭한 버튼의 data-sort 값 ('accuracy' 또는 'latest') 가져오기
        const selectedSort = e.target.getAttribute('data-sort');
        
        if (currentSort === selectedSort) return; // 이미 선택된 정렬이면 무시

        currentSort = selectedSort;

        // 2. UI 활성화 표시 변경 (기존 active 제거 후 클릭한 버튼에 추가)
        document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');

        // 3. 새로운 정렬 기준으로 뉴스 로드
        loadCurationNews(currentCategory, 1);
    });
});

});// DOMContentLoaded 종료