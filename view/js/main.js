/* main.js
[구조]
1. 전역 상수 및 상태 변수
2. 메인 실행 DOMContentLoaded
3. 데이터 생성 및 헬퍼 함수
4. UI 컴포넌트 초기화 함수
5. NPTI 개인화 로직
6. 이벤트 핸들러 및 모달 관리
*/

// 1. 전역 상수 및 상태 변수
const CAT_NAMES = {
    all: '전체', politics: '정치', economy: '경제', society: '사회',
    culture: '생활/문화', it: 'IT/과학', world: '세계', sports: '스포츠',
    enter: '연예', local: '지역'
};

const OPPOSITE_MAP = { 'S': 'L', 'L': 'S', 'T': 'C', 'C': 'T', 'F': 'I', 'I': 'F', 'N': 'P', 'P': 'N' };
const PAIRS = [['L', 'S'], ['C', 'T'], ['I', 'F'], ['P', 'N']];

const TYPE_DB = {
    'L': { text: '긴', color: 'blue' },
    'S': { text: '짧은', color: 'orange' },
    'C': { text: '텍스트형', color: 'blue' },
    'T': { text: '이야기형', color: 'orange' },
    'I': { text: '분석적', color: 'blue' },
    'F': { text: '객관적', color: 'orange' },
    'P': { text: '우호적', color: 'blue' },
    'N': { text: '비판적', color: 'orange' }
};

// [상태관리]
let currentSelection = ['L', 'C', 'I', 'P']; // 현재 선택된 배지 조합 (기본값)
let sliderInterval = null; // 슬라이더 자동 넘김 타이머

// 2. 메인 실행 DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {

    // 1. 유저 상태 확인
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const hasNPTI = localStorage.getItem('hasNPTI') === 'true';
    const nptiResult = localStorage.getItem('nptiResult');

    // 2. 공통 UI/기능 실행
    initTicker();
    setupGlobalEvents(isLoggedIn, hasNPTI);
    updateNPTIButton(hasNPTI);

    // About Modal 동적 주입 (HTML에 없을 경우를 대비해 안전장치)
    if (!document.getElementById('aboutModal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="aboutModal" class="modal">
                <div class="modal-content">
                    <span class="close-btn">&times;</span>
                    <div id="aboutRoot" class="modal-inner"></div>
                </div>
            </div>`);
    }

    // 3. 상태별 로직 분기 (Branching Logic)

    // [CASE 1] 비로그인 (Guest)
    if (!isLoggedIn) {
        console.log("User Status: Guest");
        initSlider('all'); // 기본 슬라이더
        initGrid('all');       // 기본 그리드
        // 타이틀이나 배지는 기본 HTML 상태 유지
        initBottomBadges('STFN');
    }
    // [CASE 2] 로그인 O, 진단 X (New Member)
    else if (isLoggedIn && !hasNPTI) {
        console.log("User Status: Member (No NPTI)");
        initSlider('all');
        initGrid('all');
    }
    // [CASE 3] 로그인 O, 진단 O (Full Member)
    else {
        console.log(`User Status: Full Member (${nptiResult})`);

        // 3-1. 상단 타이틀 개인화
        updateHeaderTitle(nptiResult);

        // 3-2. 상단 슬라이더 개인화 (개인화된 데이터 사용)
        initSlider('all');

        // 3-3. 하단 배지 및 그리드 개인화 (반대 성향 자동 세팅)
        initBottomBadges(nptiResult);

        // 3-4. 블러(Blur) 해제 및 배너 숨김
        const blurSection = document.querySelector('.blur-wrapper');
        const bannerOverlay = document.querySelector('.banner-overlay');
        if (blurSection) blurSection.classList.add('unlocked');
        if (bannerOverlay) bannerOverlay.style.display = 'none';
    }
});

// 3. 데이터 생성 및 헬퍼 함수

/* 탭 요소에서 카테고리 영문명 추출 */
function getCategoryFromTab(tab) {
    let category = tab.getAttribute('data-category');
    if (!category) {
        const text = tab.innerText.trim();
        // 한글명 -> 영문명 역매핑
        const invertedMap = Object.entries(CAT_NAMES).reduce((acc, [k, v]) => ({ ...acc, [v]: k }), {});
        category = invertedMap[text] || 'all';
    }
    return category;
}

/* 뉴스 데이터 생성 (슬라이더용)
- 로그인 상태(NPTI 결과 유무)에 따라 제목 형식이 달라짐
*/
function getNewsData(category) {
    const name = CAT_NAMES[category] || '전체';
    const nptiResult = localStorage.getItem('nptiResult');

    let typeTag, typeId;

    if (nptiResult) {
        // 진단 완료: 결과 유형 표시
        typeTag = `[${nptiResult}]`;
        typeId = nptiResult;
    } else {
        // 미진단/비로그인: NPTI PICK 표시
        typeTag = `[NPTI PICK]`;
        typeId = "GUEST";
    }

    const data = [];
    for (let i = 1; i <= 9; i++) {
        data.push({
            id: `${typeId}_slider_${i}`,
            title: `${typeTag} 성향에 맞는 ${name} 관련 주요 뉴스 헤드라인 예시 ${i}번입니다`,
            desc: `${name} 분야의 ${i}번째 기사입니다.`,
            img: '',
            link: '#'
        });
    }
    return data;
}

// 4. UI 컴포넌트 초기화 함수

/* [Ticker] 상단 속보 롤링 기능 */
function initTicker() {
    const list = document.getElementById('ticker-list');
    if (!list) return;

    // 데이터 생성
    const breakingNewsData = Array.from({ length: 5 }, (_, i) => ({
        id: `breaking_${i + 1}`,
        title: `[속보] 관련 주요 뉴스 헤드라인 예시 ${i + 1}번입니다`
    }));

    list.innerHTML = '';
    breakingNewsData.forEach(item => {
        const li = document.createElement('li');
        li.className = 'ticker-item';
        li.innerHTML = `<a href="/view/html/view.html?id=${item.id}" class="ticker-link">${item.title}</a>`;
        list.appendChild(li);
    });

    // 무한 롤링을 위해 첫 번째 요소 복제
    if (breakingNewsData.length > 0) {
        list.appendChild(list.firstElementChild.cloneNode(true));
    }

    let currentIndex = 0;
    const itemHeight = 24; // CSS 높이와 일치해야 함

    setInterval(() => {
        currentIndex++;
        list.style.transition = 'transform 1s ease';
        list.style.transform = `translateY(-${currentIndex * itemHeight}px)`;

        if (currentIndex === breakingNewsData.length) {
            setTimeout(() => {
                list.style.transition = 'none';
                currentIndex = 0;
                list.style.transform = `translateY(0px)`;
            }, 1000);
        }
    }, 3000);
}

/* [Slider] 메인 슬라이더 */
function initSlider(category) {
    const track = document.getElementById('slider-track');
    const paginationContainer = document.getElementById('pagination-dots');
    const sliderWrapper = document.querySelector('.hero-slider-wrapper');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    if (!track) return;

    // 기존 타이머 초기화
    if (sliderInterval) clearInterval(sliderInterval);

    // DOM 초기화
    track.innerHTML = '';
    paginationContainer.innerHTML = '';
    track.style.transition = 'none';
    track.style.transform = `translateX(0)`;

    const currentData = getNewsData(category);
    let currentIndex = 0;
    let isTransitioning = false;
    let dots = [];

    // 슬라이드 생성
    currentData.forEach((news, index) => {
        const slide = document.createElement('a');
        slide.className = 'hero-slide';
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

        // 페이지네이션 닷 생성
        const dot = document.createElement('span');
        dot.className = `dot ${index === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => {
            if (isTransitioning) return;
            moveToSlide(index);
            resetAutoSlide();
        });
        paginationContainer.appendChild(dot);
    });

    // 무한 루프용 첫 슬라이드 복제
    track.appendChild(track.firstElementChild.cloneNode(true));
    dots = document.querySelectorAll('.dot');
    const totalRealSlides = currentData.length;

    // 슬라이드 이동 함수
    function moveToSlide(index) {
        if (isTransitioning) return;
        isTransitioning = true;

        track.style.transition = 'transform 0.5s ease-in-out';
        currentIndex = index;
        track.style.transform = `translateX(-${currentIndex * 100}%)`;

        // 닷 활성화
        let dotIndex = currentIndex;
        if (currentIndex === totalRealSlides) dotIndex = 0;
        else if (currentIndex < 0) dotIndex = totalRealSlides - 1;

        dots.forEach(d => d.classList.remove('active'));
        if (dots[dotIndex]) dots[dotIndex].classList.add('active');

        // 트랜지션 후 위치 재조정 (무한 루프)
        setTimeout(() => {
            if (currentIndex === totalRealSlides) {
                track.style.transition = 'none';
                currentIndex = 0;
                track.style.transform = `translateX(0%)`;
            } else if (currentIndex < 0) {
                track.style.transition = 'none';
                currentIndex = totalRealSlides - 1;
                track.style.transform = `translateX(-${currentIndex * 100}%)`;
            }
            isTransitioning = false;
        }, 500);
    }
    function startAutoSlide() {
        if (sliderInterval) clearInterval(sliderInterval);
        sliderInterval = setInterval(() => moveToSlide(currentIndex + 1), 4000);
    }

    function resetAutoSlide() {
        clearInterval(sliderInterval);
        startAutoSlide();
    }

    // *주의*: 슬라이더 내부 변수(currentIndex)를 참조해야 하므로, 여기서는 onclick 속성으로 덮어씌움
    if (btnPrev) btnPrev.onclick = () => { moveToSlide(currentIndex - 1); resetAutoSlide(); };
    if (btnNext) btnNext.onclick = () => { moveToSlide(currentIndex + 1); resetAutoSlide(); };

    // 호버 시 정지
    if (sliderWrapper) {
        sliderWrapper.onmouseenter = () => clearInterval(sliderInterval);
        sliderWrapper.onmouseleave = startAutoSlide;
    }

    // 시작
    setTimeout(startAutoSlide, 100);
}

/* [Grid] 하단 뉴스 그리드 생성 
- currentSelection(배지 조합)에 따라 제목이 동적으로 바뀜
*/
function initGrid(category) {
    const gridContainer = document.getElementById('news-grid');
    if (!gridContainer) return;
    gridContainer.innerHTML = '';

    const type = currentSelection.join(''); // 현재 배지 상태 (예: LCIP)
    const categoryName = CAT_NAMES[category] || '전체';

    for (let i = 1; i <= 9; i++) {
        const item = document.createElement('a');
        item.className = 'grid-item';
        item.href = `/view/html/view.html?id=${type}_${i}`; // ID에 현재 조합 반영

        item.innerHTML = `
            <div class="grid-thumb"><i class="fa-regular fa-image"></i></div>
            <h4 class="grid-title">[${type}] 성향에 맞는 ${categoryName} 관련 주요 뉴스 헤드라인 예시 ${i}번 입니다.</h4>
        `;
        gridContainer.appendChild(item);
    }
}

// 5. NPTI 개인화 로직 & 배지 핸들링

/* 상단 메인 타이틀 업데이트 (유저 닉네임, 성향 코드 등) */
function updateHeaderTitle(nptiResult) {
    const titleArea = document.querySelector('.section-pick .title-area');
    if (!titleArea) return;

    const nicknames = { 'STFN': '팩트 현실주의자', 'LCIP': '심층 분석가', 'STFP': '열정적 소식통', 'LCIN': '심층 비평가' };
    const nickname = nicknames[nptiResult] || '나만의 뉴스 탐험가';

    titleArea.innerHTML = `
        <div class="npti-title-wrapper">
            <div class="npti-main-line">
                <span class="npti-code" style="color:#FF6B00;">${nptiResult}</span> 
                <span class="npti-nickname">${nickname}</span>
            </div>
            <div class="tags">
                <div class="tag-text">
                    ${nptiResult.split('').map(char => `<span><b class="point">${char}</b> - ${TYPE_DB[char].text}</span>`).join('')}
                </div>
            </div>
        </div>`;
}

/* 하단 배지 및 설명 영역 초기화
- 진단 결과가 있을 경우, 자동으로 반대 성향(추천 성향)으로 세팅
*/
function initBottomBadges(nptiResult) {
    const bottomTagText = document.querySelector('.section-lcin .tag-text');
    const bottomBadges = document.getElementById('lcin-badges');

    if (!bottomTagText || !bottomBadges) return;

    // 1. 반대 성향 계산 (예: STFN -> LCIP)
    const oppositeChars = nptiResult.split('').map(char => OPPOSITE_MAP[char]);
    currentSelection = [...oppositeChars]; // 전역 상태 업데이트

    // 2. DOM 생성 (설명 텍스트 & 배지 버튼)
    bottomTagText.innerHTML = oppositeChars.map((char, idx) => `
        <span id="desc-${idx}"><strong class="blue">${char}</strong> - ${TYPE_DB[char].text}</span>`).join('');

    bottomBadges.innerHTML = oppositeChars.map((char, idx) => `
        <span id="badge-${idx}" style="cursor: pointer;">${char}</span>`).join('');

    // 3. 이벤트 연결 및 초기 색상 적용
    oppositeChars.forEach((char, idx) => {
        const badgeEl = document.getElementById(`badge-${idx}`);
        if (badgeEl) {
            badgeEl.onclick = () => toggleSlot(idx); // 클릭 시 토글
            updateBadgeDisplay(idx, char); // 초기 색상 설정
        }
    });

    // 4. 배지 상태에 맞춰 그리드 최초 렌더링
    initGrid('all');
}

/* 배지 슬롯 토글 (L <-> S) */
function toggleSlot(index) {
    const currentVal = currentSelection[index];
    const pair = PAIRS[index];
    const nextVal = (currentVal === pair[0]) ? pair[1] : pair[0];

    currentSelection[index] = nextVal; // 상태 업데이트
    updateBadgeDisplay(index, nextVal); // UI 업데이트
}

/* 배지 UI 업데이트 (색상 처리)
- 추천 성향(원래 성향과 다름) -> Blue
- 본래 성향(원래 성향과 같음) -> Orange
 */
function updateBadgeDisplay(index, code) {
    const badgeEl = document.getElementById(`badge-${index}`);
    const descEl = document.getElementById(`desc-${index}`);
    if (!badgeEl) return;

    const nptiResult = localStorage.getItem('nptiResult') || "STFN";
    const originalChar = nptiResult[index];

    badgeEl.innerText = code;

    // 색상 결정 로직
    const isRecommended = (code !== originalChar);
    const themeColor = isRecommended ? '#0057FF' : '#FF6B00';

    badgeEl.style.backgroundColor = themeColor;
    badgeEl.style.color = '#ffffff';

    // 설명 텍스트 업데이트
    if (descEl) {
        descEl.innerHTML = `<strong style="color: ${themeColor}">${code}</strong> - ${TYPE_DB[code].text}`;
    }
}

// 6. 이벤트 핸들러 및 모달 관리
function setupGlobalEvents(isLoggedIn, hasNPTI) {
    // (1) [상단] 메인 슬라이더 탭 이벤트 (질문하신 코드 적용)
    const mainTabs = document.querySelectorAll('.section-pick .nav-tabs a, .npti-pick-header .nav-tabs a');

    mainTabs.forEach(tab => {
        tab.addEventListener('click', function (e) {
            e.preventDefault();

            // 1. 상단 탭들의 active 클래스 초기화
            mainTabs.forEach(t => t.classList.remove('active'));

            // 2. 클릭한 탭 활성화
            this.classList.add('active');

            // 3. 카테고리 가져오기
            const category = getCategoryFromTab(this);
            console.log("상단 슬라이더 변경:", category);

            // 4. [핵심] 슬라이더 실행 함수 호출
            initSlider(category);
        });
    });

    // (2) [하단] 뉴스 그리드 탭 이벤트 (별도로 분리)
    const gridTabs = document.querySelectorAll('.section-lcin .nav-tabs a');

    gridTabs.forEach(tab => {
        tab.addEventListener('click', function (e) {
            e.preventDefault();

            // 1. 하단 탭들의 active 클래스 초기화
            gridTabs.forEach(t => t.classList.remove('active'));

            // 2. 클릭한 탭 활성화
            this.classList.add('active');

            // 3. 카테고리 가져오기
            const category = getCategoryFromTab(this);
            console.log("하단 그리드 변경:", category);

            // 4. [핵심] 그리드 실행 함수 호출
            initGrid(category);
        });
    });

    // (2) '이 조합으로 뉴스 보기' 버튼
    const combineBtn = document.getElementById('btn-combine');
    if (combineBtn) {
        combineBtn.addEventListener('click', () => {
            const activeTab = document.querySelector('.section-lcin .nav-tabs a.active');
            const category = activeTab ? getCategoryFromTab(activeTab) : 'all';
            initGrid(category); // 변경된 배지 조합으로 그리드 갱신
            console.log("조합 확정:", currentSelection.join(''));
        });
    }

    // (3) 모달 제어 헬퍼
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

    // (4) 로그인/로그아웃 링크 처리
    const authLink = document.getElementById('authLink');
    if (isLoggedIn && authLink) {
        authLink.innerText = "로그아웃";
        authLink.onclick = (e) => {
            e.preventDefault();
            toggleModal('logoutModal', true);
        };
    }

    // (5) 페이지 접근 제어 (로그인 가드 & 진단 가드)
    // - 큐레이션, 마이페이지, 테스트 페이지, 유저 아이콘, 더보기 버튼 대상
    const protectedLinks = document.querySelectorAll('a[href*="curation.html"], a[href*="mypage.html"], a[href*="test.html"], .icon-btn.user, .btn-load-more');

    protectedLinks.forEach(link => {
        link.removeAttribute('onclick'); // HTML 인라인 이벤트 제거

        link.addEventListener('click', (e) => {
            const targetHref = link.getAttribute('href') || "";

            // [가드 1] 비로그인 상태
            if (!isLoggedIn) {
                e.preventDefault();
                // 마이페이지나 유저 아이콘은 로그인 페이지로 바로 이동
                if (targetHref.includes('mypage.html') || link.classList.contains('user')) {
                    location.href = '/view/html/login.html';
                } else {
                    toggleModal('loginGuardModal', true);
                }
                return;
            }

            // [가드 2] 로그인 했으나 NPTI 미진단 (큐레이션 접근 시)
            if (targetHref.includes('curation.html') && !hasNPTI) {
                e.preventDefault();
                toggleModal('hasNPTIGuardModal', true);
                return;
            }

            // [통과] '더보기' 버튼 클릭 시: 현재 조합된 파라미터 전달
            if (link.classList.contains('btn-load-more')) {
                e.preventDefault();
                const finalType = currentSelection.join('');
                const baseUrl = targetHref.split('?')[0]; // 기존 쿼리 제거 후 재생성
                location.href = `${baseUrl}?type=${finalType}`;
            }
            // 유저 아이콘 클릭
            else if (link.classList.contains('user')) {
                e.preventDefault();
                location.href = '/view/html/mypage.html';
            }
        });
    });

    // (6) 모달 내부 버튼 이벤트 바인딩
    document.getElementById('closeLoginGuard')?.addEventListener('click', () => toggleModal('loginGuardModal', false));
    document.getElementById('goToLogin')?.addEventListener('click', () => location.href = "/view/html/login.html");
    document.getElementById('closeNPTIGuard')?.addEventListener('click', () => toggleModal('hasNPTIGuardModal', false));
    document.getElementById('goToTest')?.addEventListener('click', () => location.href = "/view/html/test.html");
    document.getElementById('closeLogout')?.addEventListener('click', () => toggleModal('logoutModal', false));
    document.getElementById('confirmLogout')?.addEventListener('click', () => {
        localStorage.clear(); // 로그아웃 처리
        location.replace("/view/html/main.html");
    });

    // (7) About NPTI 팝업 (말풍선 클릭)
    const aboutBtn = document.querySelector('.search-bubble');
    if (aboutBtn) {
        aboutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const modal = document.getElementById('aboutModal');
            // 외부 라이브러리(window.renderNPTI)가 로드되었는지 확인
            if (modal && typeof window.renderNPTI === 'function') {
                window.renderNPTI('#aboutRoot');
                modal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }
        });
    }
    // About 팝업 닫기 버튼
    document.querySelector('#aboutModal .close-btn')?.addEventListener('click', () => {
        document.getElementById('aboutModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    });
}

/* 말풍선 버튼(헤더 우측) 상태 업데이트 */
function updateNPTIButton(hasNPTI) {
    const nptiBtn = document.querySelector('.nav-row .btn-bubble');
    if (!nptiBtn) return;

    if (hasNPTI) {
        nptiBtn.innerText = "나의 NPTI 뉴스 더보기";
        nptiBtn.href = "/view/html/curation.html";
        nptiBtn.classList.add('npti-done');
    } else {
        nptiBtn.innerText = "나의 뉴스 성향 알아보기";
        nptiBtn.href = "/view/html/test.html";
        nptiBtn.classList.remove('npti-done');
    }
}