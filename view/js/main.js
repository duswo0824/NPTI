document.addEventListener('DOMContentLoaded', () => {

    // 1. 공통 데이터 생성 함수 (슬라이더 & 그리드 공용)
    // ============================================
    function getNewsData(category) {
        const catNames = {
            all: '전체', politics: '정치', economy: '경제', society: '사회',
            culture: '생활/문화', it: 'IT/과학', world: '세계', sports: '스포츠',
            enter: '연예', local: '지역'
        };
        const name = catNames[category] || '전체';

        const nptiResult = localStorage.getItem('nptiResult');
        const oppositeMap = { 'S': 'L', 'L': 'S', 'T': 'C', 'C': 'T', 'F': 'I', 'I': 'F', 'N': 'P', 'P': 'N' };

        let typeTag; // 제목 앞에 붙을 태그
        let typeId;  // 데이터 구분을 위한 ID

        if (nptiResult) { // [로그인/진단완료] 진단 결과의 반대 성향을 가져옴
            typeTag = `[${nptiResult}]`;
            typeId = nptiResult;
        } else {
            // [로그아웃/미진단] 요청하신 대로 "NPTI PICK"으로 표시
            typeTag = `[NPTI PICK]`;
            typeId = "GUEST"; // 기본값 ID
        }

        const data = [];
        for (let i = 1; i <= 9; i++) {
            data.push({
                id: `${typeId}_slider_${i}`,
                // 로그아웃 시 제목이 "[NPTI PICK] 성향에 맞는 전체 관련..."으로 바뀝니다.
                title: `${typeTag} 성향에 맞는 ${name} 관련 주요 뉴스 헤드라인 예시 ${i}번입니다`,
                desc: `${name} 분야의 ${i}번째 기사입니다.`,
                img: '',
                link: '#'
            });
        }
        return data;
    }

    // 2. 속보 롤링 기능 (Ticker)
    // ============================================

    // [수정] 5개의 데이터를 반복문으로 자동 생성 (ID 부여)
    const breakingNewsData = [];
    const tickerName = '속보';

    for (let i = 1; i <= 5; i++) {
        breakingNewsData.push({
            id: `breaking_${i}`, // [수정] 고유 ID 부여 (예: breaking_1)
            title: `[${tickerName}] 관련 주요 뉴스 헤드라인 예시 ${i}번입니다`,
            desc: `${tickerName} 분야의 ${i}번째 기사입니다.`,
            // link 속성은 더 이상 고정값이 아닌 아래에서 동적으로 생성합니다.
        });
    }

    function startTicker() {
        const list = document.getElementById('ticker-list');
        if (!list) return;

        list.innerHTML = '';
        breakingNewsData.forEach(item => {
            const li = document.createElement('li');
            li.className = 'ticker-item';

            // [수정] href 주소를 /html/view.html?id=아이디 형식으로 변경
            li.innerHTML = `<a href="/view/html/view.html?id=${item.id}" class="ticker-link">${item.title}</a>`;

            list.appendChild(li);
        });

        if (breakingNewsData.length > 0) {
            const clone = list.firstElementChild.cloneNode(true);
            list.appendChild(clone);
        }

        let currentIndex = 0;
        const itemHeight = 24; // CSS의 line-height나 높이값에 맞춰 조절
        const totalCount = breakingNewsData.length;

        setInterval(() => {
            currentIndex++;
            list.style.transition = 'transform 1s ease';
            list.style.transform = `translateY(-${currentIndex * itemHeight}px)`;

            if (currentIndex === totalCount) {
                setTimeout(() => {
                    list.style.transition = 'none';
                    currentIndex = 0;
                    list.style.transform = `translateY(0px)`;
                }, 1000);
            }
        }, 3000);
    }
    startTicker();

    // 3. 상단 메인 슬라이더 (Hero Slider)
    // ============================================
    const sliderWrapper = document.querySelector('.hero-slider-wrapper');
    const track = document.getElementById('slider-track');
    const paginationContainer = document.getElementById('pagination-dots');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    // [중요] 상단 탭만 선택하도록 수정
    const mainTabs = document.querySelectorAll('.npti-pick-header .nav-tabs a');

    let currentIndex = 0;
    let slideInterval;
    let currentData = [];
    let dots = [];
    let isTransitioning = false;

    function initSlider(category) {
        stopAutoSlide();
        track.innerHTML = '';
        paginationContainer.innerHTML = '';
        currentIndex = 0;
        track.style.transition = 'none';
        track.style.transform = `translateX(0)`;

        currentData = getNewsData(category); // 현재 NPTI 유형이 반영된 데이터

        currentData.forEach((news, index) => {
            const slide = document.createElement('a');
            slide.className = 'hero-slide';

            // 고유 아이디를 사용해 view 페이지로 연결
            slide.href = `/view/html/view.html?id=${news.id}`;

            slide.innerHTML = `
            <div class="slide-img-box">
                ${news.img ? `<img src="${news.img}" alt="뉴스 이미지">` : `<i class="fa-regular fa-image"></i>`}
            </div>
            <div class="slide-text-box">
                <h3>${news.title}</h3>
                <p>${news.desc}</p>
            </div>
        `;
            track.appendChild(slide);

            const dot = document.createElement('span');
            dot.className = `dot ${index === 0 ? 'active' : ''}`;
            dot.addEventListener('click', () => {
                if (isTransitioning) return;
                moveToSlide(index);
                resetAutoSlide();
            });
            paginationContainer.appendChild(dot);
        });

        const firstSlideClone = track.firstElementChild.cloneNode(true);
        track.appendChild(firstSlideClone);
        dots = document.querySelectorAll('.dot');

        setTimeout(() => startAutoSlide(), 100);
    }

    function moveToSlide(index) {
        if (isTransitioning) return;
        isTransitioning = true;
        const totalRealSlides = currentData.length;
        track.style.transition = 'transform 0.5s ease-in-out';
        currentIndex = index;
        track.style.transform = `translateX(-${currentIndex * 100}%)`;

        let dotIndex = currentIndex;
        if (currentIndex === totalRealSlides) dotIndex = 0;
        else if (currentIndex < 0) dotIndex = totalRealSlides - 1;

        if (dots.length > 0) {
            dots.forEach(d => d.classList.remove('active'));
            if (dots[dotIndex]) dots[dotIndex].classList.add('active');
        }

        setTimeout(() => {
            if (currentIndex === totalRealSlides) {
                track.style.transition = 'none';
                currentIndex = 0;
                track.style.transform = `translateX(0%)`;
            }
            if (currentIndex < 0) {
                track.style.transition = 'none';
                currentIndex = totalRealSlides - 1;
                track.style.transform = `translateX(-${currentIndex * 100}%)`;
            }
            isTransitioning = false;
        }, 500);
    }

    function startAutoSlide() {
        clearInterval(slideInterval);
        slideInterval = setInterval(() => moveToSlide(currentIndex + 1), 4000);
    }

    function stopAutoSlide() { clearInterval(slideInterval); }
    function resetAutoSlide() { stopAutoSlide(); startAutoSlide(); }

    btnPrev.addEventListener('click', () => {
        if (isTransitioning) return;
        currentIndex === 0 ? moveToSlide(-1) : moveToSlide(currentIndex - 1);
        resetAutoSlide();
    });
    btnNext.addEventListener('click', () => {
        if (isTransitioning) return;
        moveToSlide(currentIndex + 1);
        resetAutoSlide();
    });

    if (sliderWrapper) {
        sliderWrapper.addEventListener('mouseenter', stopAutoSlide);
        sliderWrapper.addEventListener('mouseleave', startAutoSlide);
    }

    // 상단 탭 이벤트
    mainTabs.forEach(tab => {
        tab.addEventListener('click', function (e) {
            e.preventDefault();
            mainTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            initSlider(getCategoryFromTab(this));
        });
    });


    // ============================================
    // 4. 하단 LCIN 그리드
    // ============================================
    const gridContainer = document.getElementById('news-grid');
    const lcinTabs = document.querySelectorAll('.section-lcin .nav-tabs a');

    function initGrid(category) {
        if (!gridContainer) return;
        gridContainer.innerHTML = '';

        // 현재 선택된 4글자 유형(처음엔 LCIP)과 카테고리명 가져오기
        const type = currentSelection.join('');
        const catNames = {
            all: '전체', politics: '정치', economy: '경제', society: '사회',
            culture: '생활/문화', it: 'IT/과학', world: '세계', sports: '스포츠',
            enter: '연예', local: '지역'
        };
        const categoryName = catNames[category] || '전체';

        // 9개의 기사를 즉시 생성
        for (let i = 1; i <= 9; i++) {
            const item = document.createElement('a');
            item.className = 'grid-item';
            item.href = `/view/html/view.html?id=${type}_${i}`;

            item.innerHTML = `
            <div class="grid-thumb">
                <i class="fa-regular fa-image"></i>
            </div>
            <h4 class="grid-title">
                [${type}] 성향에 맞는 ${categoryName} 관련 주요 뉴스 헤드라인 예시 ${i}번 입니다.
            </h4>
        `;
            gridContainer.appendChild(item);
        }
    }

    // 하단 탭 이벤트
    lcinTabs.forEach(tab => {
        tab.addEventListener('click', function (e) {
            e.preventDefault();
            lcinTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            initGrid(getCategoryFromTab(this));
        });
    });

    // 탭에서 카테고리명 추출하는 헬퍼 함수
    function getCategoryFromTab(tab) {
        let category = tab.getAttribute('data-category');
        if (!category) {
            const text = tab.innerText.trim();
            if (text === '전체') category = 'all';
            else if (text === '정치') category = 'politics';
            else if (text === '경제') category = 'economy';
            else if (text === '사회') category = 'society';
            else if (text === '생활/문화') category = 'culture';
            else if (text === 'IT/과학') category = 'it';
            else if (text === '세계') category = 'world';
            else if (text === '스포츠') category = 'sports';
            else if (text === '연예') category = 'enter';
            else if (text === '지역') category = 'local';
        }
        return category;
    }

    // 최초 실행
    initSlider('all');
    // initGrid('all');
});


// 1. 전역 변수 및 데이터 정의
// ==========================================
const typeDB = {
    'L': { text: '긴', color: 'blue' },
    'S': { text: '짧은', color: 'orange' },
    'C': { text: '텍스트형', color: 'blue' },
    'T': { text: '이야기형', color: 'orange' },
    'I': { text: '분석적', color: 'blue' },
    'F': { text: '객관적', color: 'orange' },
    'P': { text: '우호적', color: 'blue' },
    'N': { text: '비판적', color: 'orange' }
};

const pairs = [['L', 'S'], ['C', 'T'], ['I', 'F'], ['P', 'N']];
let currentSelection = ['L', 'C', 'I', 'P']; // 초기 기본값


// 2. 메인 초기화 (DOMContentLoaded)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    const nptiResult = localStorage.getItem('nptiResult'); // 예: 'STFN'
    const bottomBadges = document.getElementById('lcin-badges');
    const bottomTagText = document.querySelector('.section-lcin .tag-text');
    const titleArea = document.querySelector('.section-pick .title-area');

    const oppositeMap = { 'S': 'L', 'L': 'S', 'T': 'C', 'C': 'T', 'F': 'I', 'I': 'F', 'N': 'P', 'P': 'N' };
    const descMap = { 'S': '짧은', 'L': '긴', 'T': '이야기형', 'C': '텍스트형', 'F': '객관적', 'I': '분석적', 'N': '비판적', 'P': '우호적' };
    const nicknames = { 'STFN': '팩트 현실주의자', 'LCIP': '심층 분석가', 'STFP': '열정적 소식통', 'LCIN': '심층 비평가' };

    // 1. 상단 타이틀 업데이트 (유저 성향 데이터가 있을 때만 실행)
    if (nptiResult && titleArea) {
        const nickname = nicknames[nptiResult] || '나만의 뉴스 탐험가';
        titleArea.innerHTML = `
            <div class="npti-title-wrapper">
                <div class="npti-main-line">
                    <span class="npti-code" style="color:#FF6B00;">${nptiResult}</span> 
                    <span class="npti-nickname">${nickname}</span>
                </div>
                <div class="tags">
                    <div class="tag-text">
                        ${nptiResult.split('').map(char => `<span><b class="point">${char}</b> - ${descMap[char]}</span>`).join('')}
                    </div>
                </div>
            </div>`;

        if (typeof initSlider === 'function') {
            initSlider('all');
        }
    }

    // 2. [수정 완료] 하단 영역 동기화 (결과 유무와 상관없이 항상 실행)
    if (bottomBadges && bottomTagText) {

        // [중요] nptiResult가 있을 때만 반전된 성향으로 세팅
        // 로그아웃 상태(null)라면 위에서 선언한 기본값(['L','C','I','P'])을 그대로 사용함
        if (nptiResult) {
            const oppositeChars = nptiResult.split('').map(char => oppositeMap[char]);
            currentSelection = [...oppositeChars];
        }

        // [1순위] 기사 그리드 생성 (currentSelection 기반으로 제목 일치 보장)
        initGrid('all');

        // [2순위] 하단 텍스트 및 배지 UI 주입
        bottomTagText.innerHTML = currentSelection.map((char, idx) => `
            <span id="desc-${idx}"><strong class="blue">${char}</strong> - ${descMap[char]}</span>`).join('');

        bottomBadges.innerHTML = currentSelection.map((char, idx) => `
            <span id="badge-${idx}" style="cursor: pointer;">${char}</span>`).join('');

        // [3순위] 이벤트 연결 및 초기 테마 적용 (이 로직이 if문 밖에 있어 무조건 실행됨)
        currentSelection.forEach((char, idx) => {
            const badgeEl = document.getElementById(`badge-${idx}`);
            if (badgeEl) {
                badgeEl.addEventListener('click', () => toggleSlot(idx));
                updateDisplay(idx, char);
            }
        });
    }

    // 기능별 초기화 실행
    if (typeof startTicker === 'function') startTicker();
    if (typeof initSlider === 'function') initSlider('all');

    // 공통 이벤트 리스너 연결
    const btn = document.getElementById('btn-combine');
    if (btn) {
        btn.addEventListener('click', confirmCombination);
    }
    document.querySelectorAll('.section-lcin .nav-tabs a').forEach(tab => {
        tab.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelectorAll('.section-lcin .nav-tabs a').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            initGrid(getCategoryFromTab(this));
        });
    });

    // [추가] 더보기 버튼 클릭 시 현재 조합된 유형을 curation.html로 전달
    // const loadMoreBtn = document.querySelector('.btn-load-more');

    // if (loadMoreBtn) {
    //     loadMoreBtn.addEventListener('click', function (e) {
    //         // 1. 단순 링크 이동을 방지 (파라미터를 붙여서 이동시키기 위함)
    //         e.preventDefault();

    //         // 2. 현재 배지로 조합된 4자리 NPTI 코드 추출 (예: "LCIP")
    //         // 전역 혹은 상위 스코프에 선언된 currentSelection 배열을 활용합니다.
    //         const finalType = currentSelection.join('');

    //         // 3. 버튼의 href 주소 뒤에 ?type=유형 형식을 붙여서 강제 이동
    //         // 결과: /view/html/curation.html?type=LCIP
    //         const baseUrl = this.getAttribute('href') || "/view/html/curation.html";
    //         location.href = `${baseUrl}?type=${finalType}`;
    //     });
    // }

});

// [기능] 하단 뉴스 그리드 생성
function initGrid(category) {
    const gridContainer = document.getElementById('news-grid');
    if (!gridContainer) return;
    gridContainer.innerHTML = '';

    const type = currentSelection.join(''); // 현재 배지 상태 합침
    const catNames = { all: '전체', politics: '정치', economy: '경제', society: '사회', culture: '생활/문화', it: 'IT/과학', world: '세계', sports: '스포츠', enter: '연예', local: '지역' };
    const categoryName = catNames[category] || '전체';

    for (let i = 1; i <= 9; i++) {
        const item = document.createElement('a');
        item.className = 'grid-item';
        item.href = `/view/html/view.html?id=${type}_${i}`;
        item.innerHTML = `
            <div class="grid-thumb"><i class="fa-regular fa-image"></i></div>
            <h4 class="grid-title">[${type}] 성향에 맞는 ${categoryName} 관련 주요 뉴스 헤드라인 예시 ${i}번 입니다.</h4>
        `;
        gridContainer.appendChild(item);
    }
}

// [기능] 배지 슬롯 토글
function toggleSlot(index) {
    const currentVal = currentSelection[index];
    const pair = pairs[index];
    const nextVal = (currentVal === pair[0]) ? pair[1] : pair[0];
    currentSelection[index] = nextVal;
    updateDisplay(index, nextVal);
}

// [기능] 화면 업데이트 (색상 및 텍스트)
function updateDisplay(index, code) {
    const data = typeDB[code];
    const badgeEl = document.getElementById(`badge-${index}`);
    const descEl = document.getElementById(`desc-${index}`);
    if (!badgeEl) return;

    // 1. 원래 사용자의 진단 결과 가져오기
    const nptiResult = localStorage.getItem('nptiResult') || "STFN";
    const originalChar = nptiResult[index];
    
    badgeEl.innerText = code;

    // 2. 색상 결정 로직 
    // 현재 글자(code)가 원래 성향(originalChar)과 다르면(즉, 추천된 반대 성향이면) 파란색
    // 현재 글자가 원래 성향과 같으면(즉, 클릭해서 본래 성향으로 돌아왔으면) 주황색
    const isRecommended = (code !== originalChar);
    const themeColor = isRecommended ? '#0057FF' : '#FF6B00';

    // 3. UI 적용
    badgeEl.style.backgroundColor = themeColor;
    badgeEl.style.color = '#ffffff';

    if (descEl) {
        descEl.innerHTML = `<strong style="color: ${themeColor}">${code}</strong> - ${data.text}`;
    }
}

// [기능] 조합 확정 및 뉴스 갱신
function confirmCombination() {
    const finalType = currentSelection.join('');
    const activeTab = document.querySelector('.section-lcin .nav-tabs a.active');
    const category = activeTab ? getCategoryFromTab(activeTab) : 'all';
    initGrid(category); // 하단 그리드 바뀐 유형으로 즉시 갱신

    console.log("선택된 NPTI 유형:", finalType);
}

// [헬퍼] 탭 카테고리 추출
function getCategoryFromTab(tab) {
    let category = tab.getAttribute('data-category');
    if (!category) {
        const text = tab.innerText.trim();
        const map = { '전체': 'all', '정치': 'politics', '경제': 'economy', '사회': 'society', '생활/문화': 'culture', 'IT/과학': 'it', '세계': 'world', '스포츠': 'sports', '연예': 'enter', '지역': 'local' };
        category = map[text] || 'all';
    }
    return category;
}

// --- HTML이 완전히 로딩된 후에 실행하도록 감싸줌 블러처리 해제 ---
document.addEventListener('DOMContentLoaded', () => {

    // 1. 말풍선 업데이트 (안전 호출)
    if (typeof updateNPTIButton === 'function') updateNPTIButton();

    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const hasNPTI = localStorage.getItem('hasNPTI') === 'true'; // 저장된 상태 가져오기
    const blurSection = document.querySelector('.blur-wrapper');
    const bannerOverlay = document.querySelector('.banner-overlay');

    // [핵심] 가상으로 진단 완료 시 블러 해제 처리
    if (isLoggedIn && hasNPTI && blurSection) {
        blurSection.classList.add('unlocked'); // CSS에서 filter: none 처리된 클래스
        if (bannerOverlay) bannerOverlay.style.display = 'none'; // 배너 숨김
        console.log("진단 완료 확인: 블러가 해제되었습니다.");
    }


/* 타이틀 및 하단 조합 영역 통합 업데이트 */
document.addEventListener('DOMContentLoaded', () => {
    const nptiResult = localStorage.getItem('nptiResult'); // 예: 'STFN'
    const titleArea = document.querySelector('.section-pick .title-area');
    const bottomTagText = document.querySelector('.section-lcin .tag-text');
    const bottomBadges = document.getElementById('lcin-badges');

    if (nptiResult) {
        // 1. 공통 데이터 맵
        const nicknames = {
            'STFN': '팩트 현실주의자', 'LCIP': '심층 분석가',
            'STFP': '열정적 소식통', 'LCIN': '심층 비평가'
        };
        const descMap = {
            'S': '짧은', 'L': '긴', 'T': '이야기형', 'C': '텍스트형',
            'F': '객관적', 'I': '분석적', 'N': '비판적', 'P': '우호적'
        };
        const oppositeMap = {
            'S': 'L', 'L': 'S', 'T': 'C', 'C': 'T',
            'F': 'I', 'I': 'F', 'N': 'P', 'P': 'N'
        };

        // 2. 상단 타이틀 업데이트 (유저 성향 그대로 출력)
        if (titleArea) {
            const nickname = nicknames[nptiResult] || '나만의 뉴스 탐험가';
            titleArea.innerHTML = `
        <div class="npti-title-wrapper">
            <div class="npti-main-line">
                <span class="npti-code" style="color:#FF6B00;">${nptiResult}</span> 
                <span class="npti-nickname">${nickname}</span>
            </div>
            <div class="tags">
                <div class="tag-text">
                    ${nptiResult.split('').map(char => `<span><b class="point">${char}</b> - ${descMap[char]}</span>`).join('')}
                </div>
            </div>
        </div>`;
        }

        // 3. [핵심] 하단 영역 업데이트 (반대 성향으로 자동 설정)
        if (bottomTagText && bottomBadges) {
            // 결과값을 반대로 변환 (STFN -> LCIP 등)
            const oppositeChars = nptiResult.split('').map(char => oppositeMap[char]);

            // [중요] 내부 상태 변수를 반대 성향으로 일치시킴 (이게 안 되면 클릭 시 에러 발생)
            currentSelection = [...oppositeChars];

            // initGrid('all');

            // 하단 텍스트 주입
            bottomTagText.innerHTML = oppositeChars.map((char, idx) => `
        <span id="desc-${idx}">
            <strong class="blue">${char}</strong> - ${descMap[char]}
        </span>`).join('');

            // 하단 배지 주입 및 스타일 초기화
            bottomBadges.innerHTML = oppositeChars.map((char, idx) => `
        <span id="badge-${idx}" style="cursor: pointer;">${char}</span>`).join('');

            // 4. 동적으로 생성된 하단 배지에 클릭 이벤트 연결 및 초기 테마 적용
            oppositeChars.forEach((char, idx) => {
                const badgeEl = document.getElementById(`badge-${idx}`);
                badgeEl?.addEventListener('click', () => toggleSlot(idx));
                // 초기 화면은 파란색 계열이므로 updateDisplay를 호출해 스타일 확정
                updateDisplay(idx, char);
            });
        }
    }

});

/* 말풍선 안 내용 추가 및 실행 로직 */
function updateNPTIButton() {
    // localStorage에서 진단 완료 여부 확인
    const hasNPTI = localStorage.getItem('hasNPTI') === 'true';
    const nptiBtn = document.querySelector('.nav-row .btn-bubble');

    if (!nptiBtn) return;

    if (hasNPTI) {
        // 진단 완료 시: '더보기'로 텍스트와 링크 변경
        nptiBtn.innerText = "나의 NPTI 뉴스 더보기";
        nptiBtn.href = "/view/html/curation.html";
        nptiBtn.classList.add('npti-done');
    } else {
        // 미진단 시: '알아보기'로 유지
        nptiBtn.innerText = "나의 뉴스 성향 알아보기";
        nptiBtn.href = "/view/html/test.html";
        nptiBtn.classList.remove('npti-done');
    }
}


    // NPTI 설명 팝업 로직 (에러 방지 적용)
    const aboutBtn = document.querySelector('.search-bubble');
    aboutBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        // window.renderNPTI가 정의되어 있는지 확인 후 실행하여 에러 방지
        if (typeof window.renderNPTI === 'function') {
            window.renderNPTI('#aboutModalContent');
            document.getElementById('aboutModal').style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    });
});

// 모든 페이지에서 공통으로 실행되는 로그인 상태 업데이트 함수
document.addEventListener('DOMContentLoaded', () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const hasNPTI = localStorage.getItem('hasNPTI') === 'true';

    // 1. 모달 제어 공통 함수 (null 체크 포함)
    const toggleModal = (id, isShow) => {
        const modal = document.getElementById(id);
        if (!modal) return;
        if (isShow) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('show'), 10);
        } else {
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        }
    };

    // 2. 로그인 상태 UI 업데이트
    const authLink = document.getElementById('authLink');
    if (isLoggedIn && authLink) {
        authLink.innerText = "로그아웃";
        authLink.onclick = (e) => { e.preventDefault(); toggleModal('logoutModal', true); };
    }

    // 3. 페이지 접근 제어 (로그인 + 진단 여부 통합 관리)
    document.querySelectorAll('a[href*="curation.html"], a[href*="mypage.html"], a[href*="test.html"], .icon-btn.user').forEach(link => {
        link.removeAttribute('onclick'); // 기존 HTML의 inline onclick 제거

        link.addEventListener('click', (e) => {
            const targetHref = link.getAttribute('href') || "";

            // [관문 1] 로그인이 안 된 경우: 무조건 차단
            if (!isLoggedIn) {
                e.preventDefault();
                if (targetHref.includes('mypage.html') || link.classList.contains('user')) {
                    location.href = '/view/html/login.html';
                } else {
                    toggleModal('loginGuardModal', true);
                }
                return;
            }
            // [관문 2] 로그인은 했으나 NPTI 진단이 없는 경우: 큐레이션 관련 접근 차단
            if (targetHref.includes('curation.html') && !hasNPTI) {
                e.preventDefault();
                toggleModal('hasNPTIGuardModal', true);
                return; // 로직 종료
            }

            // [관문 3] 모든 조건 통과 (로그인 OK + 진단 OK)
            // 이때 '조합하기' 버튼(.btn-load-more)을 눌렀다면 파라미터를 붙여 이동시킵니다.
            if (link.classList.contains('btn-load-more')) {
                e.preventDefault();

                // 4자리 NPTI 코드 추출 (currentSelection 활용)
                const finalType = (typeof currentSelection !== 'undefined') ? currentSelection.join('') : "STFN";
                const baseUrl = targetHref || "/view/html/curation.html";

                console.log("통과 완료 - 조합된 유형으로 이동:", `${baseUrl}?type=${finalType}`);
                location.href = `${baseUrl}?type=${finalType}`;
            }
            else if (link.classList.contains('user')) {
                // 유저 아이콘 클릭 시 마이페이지 이동
                e.preventDefault();
                location.href = '/view/html/mypage.html';
            }
            // 그 외 일반 링크는 원래 href대로 이동합니다.
        });
    });

    // 4. 버튼 이벤트 바인딩 (헬퍼 함수로 간결화)
    const btnMap = {
        'closeLoginGuard': () => toggleModal('loginGuardModal', false),
        'goToLogin': () => location.href = "/view/html/login.html",
        'closeNPTIGuard': () => toggleModal('hasNPTIGuardModal', false),
        'goToTest': () => location.href = "/view/html/test.html",
        'closeLogout': () => toggleModal('logoutModal', false),
        'confirmLogout': () => { localStorage.clear(); location.replace("/view/html/main.html"); }
    };

    Object.keys(btnMap).forEach(id => {
        document.getElementById(id)?.addEventListener('click', btnMap[id]);
    });
});

/* npti 설명 팝업 공통 설정 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. 모든 페이지에 공통 모달 구조 자동 주입
    if (!document.getElementById('aboutModal')) {
        const modalHtml = `
            <div id="aboutModal" class="modal">
                <div class="modal-content">
                    <span class="close-btn">&times;</span>
                    <div id="aboutRoot" class="modal-inner"></div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // 2. CSS 자동 연결 (about.css가 없는 페이지 대비)
    if (!document.querySelector('link[href*="about.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/css/about.css';
        document.head.appendChild(link);
    }

    const modal = document.getElementById('aboutModal');

    // 3. 통합 클릭 이벤트 관리
    document.addEventListener('click', (e) => {
        // 모달 열기: .search-bubble 클래스나 #aboutTrigger 아이디를 가진 요소를 클릭했을 때
        const trigger = e.target.closest('.search-bubble') || e.target.closest('#aboutTrigger');

        if (trigger) {
            e.preventDefault(); // 링크 이동 방지
            const root = document.querySelector('#aboutModal #aboutRoot');

            // 처음 열 때만 렌더링 (중복 방지)
            if (root && root.innerHTML === "" && typeof renderNPTI === 'function') {
                renderNPTI(root);
            }

            modal.style.display = "block";
            document.body.style.overflow = "hidden";
        }

        // 모달 닫기: X 버튼이나 배경 클릭 시
        if (e.target.classList.contains('close-btn') || e.target === modal) {
            modal.style.display = "none";
            document.body.style.overflow = "auto";
        }
    });
});