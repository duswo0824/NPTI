/* main.js
[구조]
1. 전역 상수 및 상태 변수 (세션 상태 포함)
2. Session 상태 로딩
3. 메인 실행 DOMContentLoaded
4. 데이터 생성 및 헬퍼 함수 (HTML 구조 복구)
5. UI 컴포넌트 (Ticker / Slider / Grid -> HTML 구조 복구)
6. NPTI 개인화 로직 (Badge + 색상)
7. 이벤트 핸들러 및 모달 관리
*/

/* =====================================================
   1. 전역 상수 및 상태 변수
===================================================== */
const CAT_NAMES = {
    all: '전체', politics: '정치', economy: '경제', society: '사회',
    culture: '생활/문화', it: 'IT/과학', world: '세계',
    sports: '스포츠', enter: '연예', local: '지역'
};

const OPPOSITE_MAP = { S: 'L', L: 'S', T: 'C', C: 'T', F: 'I', I: 'F', N: 'P', P: 'N' };
const PAIRS = [['L', 'S'], ['C', 'T'], ['I', 'F'], ['P', 'N']];

const TYPE_DB = {
    L: { text: '긴', color: 'blue' }, S: { text: '짧은', color: 'orange' },
    C: { text: '텍스트형', color: 'blue' }, T: { text: '이야기형', color: 'orange' },
    I: { text: '분석적', color: 'blue' }, F: { text: '객관적', color: 'orange' },
    P: { text: '우호적', color: 'blue' }, N: { text: '비판적', color: 'orange' }
};

// [상태 관리]
let currentSelection = ['L', 'C', 'I', 'P'];
let sliderInterval = null;

// [세션 전역 상태] (탭 이동 시 재사용을 위해 전역 변수로 관리)
let globalSession = {
    isLoggedIn: false,
    hasNPTI: false,
    nptiResult: null
};

/* =====================================================
   2. Session 상태 로딩 (단일 진실 소스)
===================================================== */
async function loadSessionState() {
    try {
        const res = await fetch('/auth/me', { credentials: 'include' });
        if (!res.ok) throw new Error('Session fetch failed');
        return await res.json();
    } catch {
        return { isLoggedIn: false, hasNPTI: false, nptiResult: null };
    }
}

/* =====================================================
   3. 메인 실행
===================================================== */
document.addEventListener('DOMContentLoaded', async () => {

    // 1. 서버에서 세션 정보 가져오기
    const sessionData = await loadSessionState();

    // 전역 상태 업데이트
    globalSession = { ...sessionData };
    const { isLoggedIn, hasNPTI, nptiResult } = globalSession;

    // 2. 공통 UI 실행
    initTicker();
    setupGlobalEvents(isLoggedIn, hasNPTI);
    updateNPTIButton(hasNPTI);

    /* About NPTI Modal 안전 주입 */
    if (!document.getElementById('aboutModal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="aboutModal" class="modal">
                <div class="modal-content">
                    <span class="close-btn">&times;</span>
                    <div id="aboutRoot" class="modal-inner"></div>
                </div>
            </div>
        `);
    }

    /* 3. 상태 분기 처리 */

    // [CASE 1] 비로그인
    if (!isLoggedIn) {
        console.log("User Status: Guest");
        initSlider('all');
        initGrid('all');
        initBottomBadges('STFN'); // 기본값
    }

    // [CASE 2] 로그인 O, 진단 X
    else if (!hasNPTI) {
        console.log("User Status: Member (No NPTI)");
        initSlider('all');
        initGrid('all');
        initBottomBadges('STFN'); // 기본값
    }

    // [CASE 3] 로그인 O, 진단 O
    else {
        console.log(`User Status: Full Member (${nptiResult})`);
        updateHeaderTitle(nptiResult);
        initSlider('all');
        initBottomBadges(nptiResult);

        // 블러 해제 및 배너 숨김
        const blurSection = document.querySelector('.blur-wrapper');
        const bannerOverlay = document.querySelector('.banner-overlay');
        if (blurSection) blurSection.classList.add('unlocked');
        if (bannerOverlay) bannerOverlay.style.setProperty('display', 'none');
    }
});

/* =====================================================
   4. 데이터 & 헬퍼
===================================================== */
function getCategoryFromTab(tab) {
    return tab.dataset.category ||
        Object.entries(CAT_NAMES).find(([, v]) => v === tab.innerText.trim())?.[0] ||
        'all';
}

/* 뉴스 데이터 생성
   (1번 코드 로직 복구: 세션 상태에 따라 [NPTI PICK] 또는 [성향] 표시)
*/
function getNewsData(category) {
    const name = CAT_NAMES[category] || '전체';
    const { isLoggedIn, nptiResult } = globalSession;

    let typeTag, typeId;

    if (isLoggedIn && nptiResult) {
        typeTag = `[${nptiResult}]`;
        typeId = nptiResult;
    } else {
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

/* =====================================================
   5. UI 컴포넌트 (CSS 복구를 위해 HTML 구조 1번으로 롤백)
===================================================== */

/* Ticker */
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

    if (breakingNewsData.length > 0) {
        list.appendChild(list.firstElementChild.cloneNode(true));
    }

    let currentIndex = 0;
    const itemHeight = 24;

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

/* Slider (HTML 구조 복구됨) */
function initSlider(category) {
    const track = document.getElementById('slider-track');
    const paginationContainer = document.getElementById('pagination-dots');
    const sliderWrapper = document.querySelector('.hero-slider-wrapper');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    if (!track) return;

    if (sliderInterval) clearInterval(sliderInterval);

    track.innerHTML = '';
    paginationContainer.innerHTML = '';
    track.style.transition = 'none';
    track.style.transform = `translateX(0)`;

    const currentData = getNewsData(category);
    let currentIndex = 0;
    let isTransitioning = false;
    let dots = [];

    // [CSS 복구 포인트] 1번 코드의 HTML 구조 사용 (img-box, text-box)
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

        const dot = document.createElement('span');
        dot.className = `dot ${index === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => {
            if (isTransitioning) return;
            moveToSlide(index);
            resetAutoSlide();
        });
        paginationContainer.appendChild(dot);
    });

    track.appendChild(track.firstElementChild.cloneNode(true));
    dots = document.querySelectorAll('.dot');
    const totalRealSlides = currentData.length;

    function moveToSlide(index) {
        if (isTransitioning) return;
        isTransitioning = true;

        track.style.transition = 'transform 0.5s ease-in-out';
        currentIndex = index;
        track.style.transform = `translateX(-${currentIndex * 100}%)`;

        let dotIndex = currentIndex;
        if (currentIndex === totalRealSlides) dotIndex = 0;
        else if (currentIndex < 0) dotIndex = totalRealSlides - 1;

        dots.forEach(d => d.classList.remove('active'));
        if (dots[dotIndex]) dots[dotIndex].classList.add('active');

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

    if (btnPrev) btnPrev.onclick = () => { moveToSlide(currentIndex - 1); resetAutoSlide(); };
    if (btnNext) btnNext.onclick = () => { moveToSlide(currentIndex + 1); resetAutoSlide(); };

    if (sliderWrapper) {
        sliderWrapper.onmouseenter = () => clearInterval(sliderInterval);
        sliderWrapper.onmouseleave = startAutoSlide;
    }

    setTimeout(startAutoSlide, 100);
}

/* Grid (HTML 구조 복구됨) */
function initGrid(category) {
    const gridContainer = document.getElementById('news-grid');
    if (!gridContainer) return;
    gridContainer.innerHTML = '';

    const type = currentSelection.join('');
    const categoryName = CAT_NAMES[category] || '전체';

    for (let i = 1; i <= 9; i++) {
        const item = document.createElement('a');
        item.className = 'grid-item';
        // [CSS 복구 포인트] 1번 코드의 HTML 구조 사용 (grid-thumb, grid-title)
        item.href = `/view/html/view.html?id=${type}_${i}`;

        item.innerHTML = `
            <div class="grid-thumb"><i class="fa-regular fa-image"></i></div>
            <h4 class="grid-title">[${type}] 성향에 맞는 ${categoryName} 관련 주요 뉴스 헤드라인 예시 ${i}번 입니다.</h4>
        `;
        gridContainer.appendChild(item);
    }
}

/* =====================================================
   6. NPTI 개인화 (Badge + 색상)
===================================================== */
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

function initBottomBadges(nptiResult) {
    const bottomTagText = document.querySelector('.section-lcin .tag-text');
    const bottomBadges = document.getElementById('lcin-badges');

    if (!bottomTagText || !bottomBadges) return;

    const oppositeChars = nptiResult.split('').map(char => OPPOSITE_MAP[char]);
    currentSelection = [...oppositeChars];

    bottomTagText.innerHTML = oppositeChars.map((char, idx) => `
        <span id="desc-${idx}"><strong class="blue">${char}</strong> - ${TYPE_DB[char].text}</span>`).join('');

    bottomBadges.innerHTML = oppositeChars.map((char, idx) => `
        <span id="badge-${idx}" style="cursor: pointer;">${char}</span>`).join('');

    oppositeChars.forEach((char, idx) => {
        const badgeEl = document.getElementById(`badge-${idx}`);
        if (badgeEl) {
            badgeEl.onclick = () => toggleSlot(idx);
            updateBadgeDisplay(idx, char);
        }
    });

    initGrid('all');
}

function toggleSlot(index) {
    const currentVal = currentSelection[index];
    const pair = PAIRS[index];
    const nextVal = (currentVal === pair[0]) ? pair[1] : pair[0];

    currentSelection[index] = nextVal;
    updateBadgeDisplay(index, nextVal);
}

function updateBadgeDisplay(index, code) {
    const badgeEl = document.getElementById(`badge-${index}`);
    const descEl = document.getElementById(`desc-${index}`);
    if (!badgeEl) return;

    const nptiResult = globalSession.nptiResult || "STFN";
    const originalChar = nptiResult[index];

    badgeEl.innerText = code;

    const isRecommended = (code !== originalChar);
    const themeColor = isRecommended ? '#0057FF' : '#FF6B00';

    badgeEl.style.backgroundColor = themeColor;
    badgeEl.style.color = '#ffffff';

    if (descEl) {
        descEl.innerHTML = `<strong style="color: ${themeColor}">${code}</strong> - ${TYPE_DB[code].text}`;
    }
}

/* =====================================================
   7. 이벤트 & 모달 / 접근 가드
===================================================== */
function setupGlobalEvents(isLoggedIn, hasNPTI) {

    // (1) [상단] 메인 슬라이더 탭 이벤트
    const mainTabs = document.querySelectorAll('.section-pick .nav-tabs a, .npti-pick-header .nav-tabs a');
    mainTabs.forEach(tab => {
        tab.addEventListener('click', function (e) {
            e.preventDefault();
            mainTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            const category = getCategoryFromTab(this);
            console.log("상단 슬라이더 변경:", category);
            initSlider(category);
        });
    });

    // (2) [하단] 뉴스 그리드 탭 이벤트
    const gridTabs = document.querySelectorAll('.section-lcin .nav-tabs a');
    gridTabs.forEach(tab => {
        tab.addEventListener('click', function (e) {
            e.preventDefault();
            gridTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            const category = getCategoryFromTab(this);
            console.log("하단 그리드 변경:", category);
            initGrid(category);
        });
    });

    // '이 조합으로 뉴스 보기' 버튼
    const combineBtn = document.getElementById('btn-combine');
    if (combineBtn) {
        combineBtn.addEventListener('click', () => {
            const activeTab = document.querySelector('.section-lcin .nav-tabs a.active');
            const category = activeTab ? getCategoryFromTab(activeTab) : 'all';
            initGrid(category);
            console.log("조합 확정:", currentSelection.join(''));
        });
    }

    // 모달 제어 헬퍼
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

    /* 로그아웃 (서버 통신) */
    const authLink = document.getElementById('authLink');
    if (isLoggedIn && authLink) {
        authLink.innerText = '로그아웃';
        authLink.onclick = (e) => {
            e.preventDefault();
            toggleModal('logoutModal', true);
        };
    }

    /* 접근 가드 + 파라미터 전달 */
    document.querySelectorAll(
        'a[href*="curation.html"], a[href*="mypage.html"], a[href*="test.html"], .icon-btn.user, .btn-load-more'
    ).forEach(link => {
        // 인라인 이벤트 제거
        link.removeAttribute('onclick');

        link.onclick = e => {
            const href = link.getAttribute('href') || '';
            const { isLoggedIn, hasNPTI } = globalSession; // 최신 상태 참조

            // 비로그인 가드
            if (!isLoggedIn) {
                e.preventDefault();
                if (href.includes('mypage.html') || link.classList.contains('user')) {
                    location.href = '/login';
                } else {
                    toggleModal('loginGuardModal', true);
                }
                return;
            }

            // NPTI 미진단 가드
            if (href.includes('curation') && !hasNPTI) {
                e.preventDefault();
                toggleModal('hasNPTIGuardModal', true);
                return;
            }

            // 더보기 버튼 파라미터 전달
            if (link.classList.contains('btn-load-more')) {
                e.preventDefault();
                location.href = `${href.split('?')[0]}?type=${currentSelection.join('')}`;
            }

            // 유저 아이콘
            if (link.classList.contains('user')) {
                e.preventDefault();
                location.href = '/view/html/mypage.html';
            }
        };
    });

    // 모달 내부 버튼 이벤트
    document.getElementById('closeLoginGuard')?.addEventListener('click', () => toggleModal('loginGuardModal', false));
    document.getElementById('goToLogin')?.addEventListener('click', () => location.href = "/login");
    document.getElementById('closeNPTIGuard')?.addEventListener('click', () => toggleModal('hasNPTIGuardModal', false));
    document.getElementById('goToTest')?.addEventListener('click', () => location.href = "/view/html/test.html");
    document.getElementById('closeLogout')?.addEventListener('click', () => toggleModal('logoutModal', false));

    // 로그아웃 확인
    document.getElementById('confirmLogout')?.addEventListener('click', async () => {
        try {
            await fetch('/logout', { method: 'POST', credentials: 'include' });
            location.replace("/");
        } catch (error) {
            console.error('Logout failed:', error);
            location.replace("/");
        }
    });

    /* About NPTI */
    const aboutBtn = document.querySelector('.search-bubble');
    if (aboutBtn) {
        aboutBtn.onclick = e => {
            e.preventDefault();
            const modal = document.getElementById('aboutModal');
            const root = document.getElementById('aboutRoot');

            if (root && root.innerHTML.trim() === '' && typeof renderNPTI === 'function') {
                renderNPTI(root);
            }

            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';

            modal.onclick = ev => {
                if (ev.target === modal || ev.target.classList.contains('close-btn')) {
                    modal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                }
            };
        };
    }
}

function updateNPTIButton(hasNPTI) {
    const btn = document.querySelector('.btn-bubble');
    if (!btn) return;
    btn.innerText = hasNPTI ? '나의 NPTI 뉴스 더보기' : '나의 뉴스 성향 알아보기';
    btn.href = hasNPTI ? '/view/html/curation.html' : '/view/html/test.html';
    if(hasNPTI) btn.classList.add('npti-done');
    else btn.classList.remove('npti-done');
}