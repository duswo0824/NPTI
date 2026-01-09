document.addEventListener('DOMContentLoaded', async () => {
    // --- [1. 전역 설정 및 상태 변수] ---
    let currentSort = 'accuracy';     // 정렬 기본값: 정확도순
    let currentCategory = 'all';      // 카테고리 기본값: 전체
    let currentPage = 1;              // 현재 페이지
    let nptiResult = '';              // 뉴스 API 호출에 사용할 NPTI 코드 (예: STFN)
    const ITEMS_PER_PAGE = 10;        // 페이지당 뉴스 개수 (백엔드와 맞춤)

    // DOM 요소 참조
    const resultHeader = document.getElementById('nptiResultHeader');
    const curationList = document.getElementById('curationList');
    const categoryTabs = document.querySelectorAll('.nav-tabs a');
    const resultsArea = document.querySelector('.news-feed-section');
    const categoryNameDisplay = document.getElementById('categoryName');

    // --- [2. 초기 실행 로직: 인증 및 데이터 체크] ---
    async function checkAuthAndNPTI() {
    try {
        const response = await fetch("/user/npti/me", {
            credentials: "include"
        });

        // 1. 로그인 안 된 상태
        if (response.status === 401 || response.status === 403) {
            alert('로그인이 필요한 서비스입니다.');
            window.location.href = '/login';
            return false;
        }

        // 2. 유저는 있으나 NPTI 결과 없음
        if (response.status === 404) {
            alert('NPTI 진단 결과가 없습니다. 진단 페이지로 이동합니다.');
            window.location.href = '/test';
            return false;
        }

        // 3. 기타 서버 오류
        if (!response.ok) {
            alert('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            return false;
        }

        // 4. 정상
        const data = await response.json();
        nptiResult = data.npti_code;
        renderCurationHeader(data);
        loadCurationNews('all', 1);
        return true;

    } catch (e) {
        console.error("Auth Check Error:", e);
        alert('네트워크 오류가 발생했습니다.');
        return false;
    }
    }

    // 초기 실행 시작점
    const isAuthorized = await checkAuthAndNPTI();
    if (!isAuthorized) return; // 권한 없으면 이후 코드 실행 안 함

    // --- [3. UI 렌더링 함수들] ---

    // 상단 NPTI 성향 결과 바 생성
    function renderCurationHeader(data) {
        if (!resultHeader || !data) return;

        const { npti_code, type_nick, npti_kor_list } = data;

        resultHeader.innerHTML = `
            <div class="npti-header" style="margin-bottom:15px;">
                <span class="npti-code" style="color:#FF6B00; font-weight:bold; font-size:24px;">${npti_code}</span> 
                <span class="npti-nickname" style="margin-left:10px; font-weight:bold;">${type_nick}</span>
            </div>
            <div class="tags" style="background-color: #FFF5EE; padding: 10px; border-radius: 5px; display: flex; gap: 15px;">
                ${npti_code.split('').map((char, i) => `
                    <div class="tag-item">
                        <span class="point" style="color:#FF6B00; font-weight:bold;">${char}</span> - ${npti_kor_list[i]}
                    </div>
                `).join('')}
            </div>
        `;
        
        // 하단 섹션 제목 업데이트 (예: [STFN] 성향 뉴스 큐레이션)
        const curationTitle = document.getElementById('curation-result-title');
        if (curationTitle) curationTitle.innerText = `[${npti_code}] 성향 뉴스 큐레이션`;
    }

    // 백엔드 API로부터 뉴스 데이터를 가져오는 핵심 함수
    async function loadCurationNews(category = 'all', page = 1) {
        if (!curationList) return;

        currentCategory = category;
        currentPage = page;

        // 리스트 비우고 로딩 메시지 표시
        curationList.innerHTML = '<div class="loading" style="padding:40px; text-align:center;">사용자님의 성향에 맞는 뉴스를 분석 중입니다...</div>';

        try {
            // 백엔드 엔드포인트에 쿼리 파라미터 전달
            const url = `/curated/news?npti=${nptiResult}&category=${category}&sort_type=${currentSort}&page=${page}`;
            const response = await fetch(url);
            
            if (!response.ok) throw new Error('뉴스 데이터 로드 실패');

            const data = await response.json(); // data 구조: { articles: [...], total: 100 }

            // 실제 뉴스 카드 그리기 함수 호출
            renderNewsCards(data.articles);
            
            // 페이지네이션 생성 함수 호출
            renderPagination(data.total || 0, page);

        } catch (error) {
            console.error('News Load Error:', error);
            curationList.innerHTML = '<p class="error-msg">데이터를 가져오는 중 오류가 발생했습니다.</p>';
        }
    }

    // 뉴스 기사 배열을 받아 HTML 카드 리스트 생성
    function renderNewsCards(articles) {
        curationList.innerHTML = ''; // 로딩 메시지 제거

        if (!articles || articles.length === 0) {
            curationList.innerHTML = '<p class="no-data" style="text-align:center; padding:50px;">해당 조건에 맞는 뉴스가 아직 없습니다.</p>';
            return;
        }

        articles.forEach(news => {
            const articleHtml = `
                <div class="news-card"
                    onclick="location.href='/article?news_id=${news.id}'" style="cursor:pointer;">
                    <div class="news-img">
                        <img src="${news.thumbnail || '/view/img/default.png'}"
                            onerror="this.src='/view/img/default.png'">
                    </div>
                    <div class="news-info">
                        <h3>${news.title}</h3>
                        <p class="summary">${news.summary}</p>
                        <div class="news-meta">
                            <span>${news.publisher}</span> | 
                            <span>${news.date}</span>
                        </div>
                    </div>
                </div>
            `;
            curationList.insertAdjacentHTML('beforeend', articleHtml);
        });
    }

    // 하단 페이지 번호 버튼 생성
    function renderPagination(totalItems, currentPage) {
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        
        // 기존 페이지네이션 UI 제거 후 새로 생성
        const existingPagination = document.querySelector('.pagination');
        if (existingPagination) existingPagination.remove();

        if (totalPages <= 1) return; // 1페이지뿐이면 생성 안 함

        const paginationDiv = document.createElement('div');
        paginationDiv.className = 'pagination';

        // 공통 버튼 생성기
        const createBtn = (text, targetPage, isDisabled, className = '') => {
            const btn = document.createElement('button');
            btn.innerHTML = text;
            btn.disabled = isDisabled;
            if (className) btn.className = className;
            btn.onclick = () => {
                window.scrollTo({ top: 0, behavior: 'smooth' }); // 상단 이동
                loadCurationNews(currentCategory, targetPage);
            };
            return btn;
        };

        // 처음, 이전 버튼
        paginationDiv.appendChild(createBtn('《', 1, currentPage === 1));
        paginationDiv.appendChild(createBtn('〈', currentPage - 1, currentPage === 1));

        // 숫자 버튼 (최대 10개 등 제한 가능하나 여기선 전체 출력)
        for (let i = 1; i <= totalPages; i++) {
            const btnNum = createBtn(i, i, false, `page-num ${i === currentPage ? 'active' : ''}`);
            paginationDiv.appendChild(btnNum);
        }

        // 다음, 끝 버튼
        paginationDiv.appendChild(createBtn('〉', currentPage + 1, currentPage === totalPages));
        paginationDiv.appendChild(createBtn('》', totalPages, currentPage === totalPages));

        // HTML의 컨테이너에 삽입
        const container = document.getElementById('paginationContainer');
        if (container) container.appendChild(paginationDiv);
        else resultsArea.appendChild(paginationDiv);
    }

    // --- [4. 이벤트 리스너: 사용자 인터랙션] ---

        // 4-1. 카테고리 탭 클릭 시
        categoryTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                
                // UI 업데이트: active 클래스 이동
                categoryTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const category = tab.getAttribute('data-category') || 'all';
                
                // 제목 텍스트 변경 (전체 -> 정치 등)
                if (categoryNameDisplay) categoryNameDisplay.innerText = tab.innerText;
                
                // 데이터 새로고침
                loadCurationNews(category, 1);
            });
        });

        // 4-2. 정확도순/최신순 정렬 버튼 클릭 시
        document.querySelectorAll('.sort-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const selectedSort = e.target.getAttribute('data-sort');
                
                if (currentSort === selectedSort) return; // 이미 선택된 거면 무시

                currentSort = selectedSort;

                // UI 업데이트: 버튼 강조 변경
                document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');

                // 첫 페이지부터 다시 로드
                loadCurationNews(currentCategory, 1);
            });
        });

    }); // DOMContentLoaded 종료