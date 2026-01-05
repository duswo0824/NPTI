document.addEventListener('DOMContentLoaded', function () {
    /* =========================================
       [기능 1] 요소 및 변수 초기화 (필수 변수 선언)
       ========================================= */
    const searchForm = document.querySelector('.search-form');
    const searchInput = document.querySelector('.search-input');
    const resultsArea = document.getElementById('search-results');
    const searchMessage = document.getElementById('search-message');

    // 드롭다운 관련 요소 (ID 확인 필요)
    const filterContainer = document.getElementById('searchFilter'); // HTML의 드롭다운 컨테이너 ID
    const filterBtn = filterContainer?.querySelector('.select-btn');
    const filterText = filterContainer?.querySelector('.btn-text');
    const optionsList = filterContainer?.querySelector('.select-options');
    const checkboxes = filterContainer?.querySelectorAll('input[type="checkbox"]');
    const btnClear = document.querySelector('.btn-clear');

    const ITEMS_PER_PAGE = 20;
    let currentSort = 'accuracy'; // 기본 정렬 값

    /* =========================================
       [기능 2] 가상 데이터 생성 (ID 포함)
       ========================================= */
    function getSearchData() {
        return Array.from({ length: 45 }, (_, i) => ({
            id: `news_${i + 1}`,
            title: `[${i + 1}] 순천시, 2025년 빛낸 10대 정책 하이라이트 발표`,
            desc: "순천시가 2025년 '10대 정책 하이라이트'를 공개했다. 시민 체감도와 지역 파급력 등을 고려해 선정된 이번 정책들은...",
            img: "https://picsum.photos/id/10/200/150",
            date: new Date(2025, 11, i + 1) // 정렬용 가짜 날짜
        }));
    }

    const allData = getSearchData();

    /* =========================================
       [기능 3] 결과 렌더링 함수 (정렬 탭 포함)
       ========================================= */
    function renderResults(page) {
        resultsArea.innerHTML = '';
        const keyword = searchInput.value.trim();

        // 1. 키워드 필터링
        let filtered = allData.filter(item =>
            item.title.includes(keyword) || item.desc.includes(keyword)
        );

        // 2. 결과 없음 처리
        if (filtered.length === 0) {
            searchMessage.innerHTML = `<div style="text-align:left; padding:20px 0;">'<strong>${keyword || ' '}</strong>'에 대해 검색된 기사가 없습니다.</div>`;
            return;
        }

        // 3. 정렬 로직
        if (currentSort === 'latest') {
            filtered.sort((a, b) => b.date - a.date);
        } else {
            // 정확도순 (기본 ID순)
            filtered.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
        }

        // 4. 상단 헤더 (건수 + 정렬 탭)
        searchMessage.innerHTML = `
            <div class="result-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <div class="result-count" style="font-size:14px;">검색결과 <span style="color:#ff6b00; font-weight:bold;">${filtered.length}</span>건</div>
                <div class="sort-tabs" style="display:flex; gap:10px; font-size:14px;">
                    <button type="button" class="sort-btn ${currentSort === 'accuracy' ? 'active' : ''}" data-sort="accuracy" style="color:${currentSort === 'accuracy' ? '#ff6b00' : '#999'}; font-weight:${currentSort === 'accuracy' ? 'bold' : 'normal'}">정확도순</button>
                    <button type="button" class="sort-btn ${currentSort === 'latest' ? 'active' : ''}" data-sort="latest" style="color:${currentSort === 'latest' ? '#ff6b00' : '#999'}; font-weight:${currentSort === 'latest' ? 'bold' : 'normal'}">최신순</button>
                </div>
            </div>
        `;

        // 정렬 이벤트 바인딩
        searchMessage.querySelectorAll('.sort-btn').forEach(btn => {
            btn.onclick = () => {
                currentSort = btn.dataset.sort;
                renderResults(1);
            };
        });

        // 5. 페이징 처리 및 출력
        const start = (page - 1) * ITEMS_PER_PAGE;
        const pageData = filtered.slice(start, start + ITEMS_PER_PAGE);

        pageData.forEach(news => {
            const resultItem = document.createElement('a');
            resultItem.className = 'result-item';
            // 개별 기사 페이지 view.html로 연결
            resultItem.href = `/view/html/view.html?id=${news.id}`;

            resultItem.innerHTML = `
                <div class="result-info">
                    <h3 class="result-title">${news.title}</h3>
                    <p class="result-content">${news.desc}</p>
                </div>
                <div class="result-image">
                    ${news.img ? `<img src="${news.img}" alt="뉴스">` : `<i class="fa-regular fa-image"></i>`}
                </div>
            `;
            resultsArea.appendChild(resultItem);
        });

        renderPagination(filtered.length, page);
        window.scrollTo(0, 0);
    }

    /* =========================================
       [기능 4] 페이지네이션 생성
       ========================================= */
    function renderPagination(totalItems, currentPage) {
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        if (totalPages <= 1) return;

        const pagination = document.createElement('div');
        pagination.className = 'pagination';

        const createBtn = (text, targetPage, isDisabled) => {
            const btn = document.createElement('button');
            btn.className = 'arrow';
            btn.innerText = text;
            btn.disabled = isDisabled;
            btn.onclick = () => renderResults(targetPage);
            return btn;
        };

        pagination.appendChild(createBtn('《', 1, currentPage === 1));
        pagination.appendChild(createBtn('〈', currentPage - 1, currentPage === 1));

        for (let i = 1; i <= totalPages; i++) {
            const btnNum = document.createElement('button');
            btnNum.className = `page-num ${i === currentPage ? 'active' : ''}`;
            btnNum.innerText = i;
            btnNum.onclick = () => renderResults(i);
            pagination.appendChild(btnNum);
        }

        pagination.appendChild(createBtn('〉', currentPage + 1, currentPage === totalPages));
        pagination.appendChild(createBtn('》', totalPages, currentPage === totalPages));

        resultsArea.appendChild(pagination);
    }

    /* =========================================
       [기능 5] 이벤트 리스너 및 드롭다운 로직
       ========================================= */
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        renderResults(1);
    });

    if (searchInput && btnClear) {
        searchInput.addEventListener('input', () => {
            btnClear.style.display = searchInput.value.length > 0 ? 'block' : 'none';
        });
        btnClear.addEventListener('click', () => {
            searchInput.value = '';
            resultsArea.innerHTML = '';
            searchMessage.innerHTML = '';
            btnClear.style.display = 'none';
        });
    }

    // 드롭다운 토글 기능 수정
    if (filterBtn) {
        filterBtn.onclick = (e) => {
            e.stopPropagation();
            filterContainer.classList.toggle('active');
        };
    }

    if (optionsList) {
        optionsList.onclick = (e) => e.stopPropagation();
    }

    document.onclick = () => {
        if (filterContainer) filterContainer.classList.remove('active');
    };

    const updateFilter = () => {
        if (!checkboxes || !filterText) return;
        let sel = [...checkboxes].filter(c => c.checked);
        if (sel.length === 0) {
            checkboxes.forEach(c => c.checked = true);
            sel = [...checkboxes];
        }
        const labels = sel.map(c => c.nextElementSibling.innerText.trim());
        const combined = labels.join('/');
        filterText.innerText = sel.length === checkboxes.length ? "전체" : combined;
        searchInput.placeholder = `${sel.length === checkboxes.length ? '제목/본문/언론사/카테고리' : combined}의 키워드를 입력해주세요`;
    };

    if (checkboxes) {
        checkboxes.forEach(c => {
            c.checked = true;
            c.onchange = updateFilter;
        });
        updateFilter();
    }
});