document.addEventListener('DOMContentLoaded', () => {

    // ============================================
    // 1. 공통 데이터 생성 함수 (슬라이더 & 그리드 공용)
    // ============================================
    function getNewsData(category) {
        const catNames = {
            all: '전체', politics: '정치', economy: '경제', society: '사회',
            culture: '생활/문화', it: 'IT/과학', world: '세계', sports: '스포츠',
            enter: '연예', local: '지역'
        };
        const name = catNames[category] || '전체';

        const data = [];
        for (let i = 1; i <= 9; i++) {
            data.push({
                title: `[${name}] 관련 주요 뉴스 헤드라인 예시 ${i}번입니다`,
                // 요청하신 텍스트 포맷 적용
                desc: `${name} 분야의 ${i}번째 기사입니다. 이 박스 영역 어디를 눌러도 기사 페이지로 이동합니다.`,
                img: '',
                link: '#'
            });
        }
        return data;
    }

    // ============================================
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
            li.innerHTML = `<a href="/html/view.html?id=${item.id}" class="ticker-link">${item.title}</a>`;

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

    // ============================================
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

        currentData = getNewsData(category);

        currentData.forEach((news, index) => {
            const slide = document.createElement('a');
            slide.className = 'hero-slide';

            // 고유 아이디를 사용해 view 페이지로 연결
            slide.href = `/html/view.html?id=${news.id}`;

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

        gridContainer.innerHTML = ''; // 기존 내용 삭제

        // 1. 데이터를 가져올 때 각 아이템에 id가 포함되어 있어야 함
        const gridData = getNewsData(category);

        gridData.forEach(news => {
            // 2. 카드 전체를 클릭 가능한 a태그로 생성
            const item = document.createElement('a');
            item.className = 'grid-item';

            // 3. [수정] news.link 대신 고유 id를 이용한 상세 페이지 경로 설정
            // 데이터 생성 시 news.id가 부여되어 있다고 가정합니다.
            item.href = `/html/view.html?id=${news.id}`;

            item.innerHTML = `
            <div class="grid-thumb">
                ${news.img ? `<img src="${news.img}" alt="뉴스 썸네일">` : `<i class="fa-regular fa-image"></i>`}
            </div>
            <h4 class="grid-title">${news.title}</h4>
        `;
            gridContainer.appendChild(item);
        });
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
    initGrid('all');
});

// ==========================================
// 1. [DB] 유형별 데이터 정의 (여기만 고치면 텍스트/색상 변경 가능)
// ==========================================
const typeDB = {
    // 1번 슬롯 (L <-> S)
    'L': { text: '긴',       color: 'blue' },
    'S': { text: '짧은',     color: 'orange' },
    
    // 2번 슬롯 (C <-> T)
    'C': { text: '텍스트형', color: 'blue' },
    'T': { text: '이야기형', color: 'orange' },
    
    // 3번 슬롯 (I <-> F)
    'I': { text: '분석적',   color: 'blue' },
    'F': { text: '객관적',   color: 'orange' },
    
    // 4번 슬롯 (P <-> N)
    'P': { text: '우호적',   color: 'blue' },
    'N': { text: '비판적',   color: 'orange' }
};

// 각 슬롯별 짝꿍 정의 (기본값, 대체값)
const pairs = [
    ['L', 'S'], // index 0
    ['C', 'T'], // index 1
    ['I', 'F'], // index 2
    ['P', 'N']  // index 3
];

// 현재 사용자의 선택 상태 (초기값: L, C, I, P)
let currentSelection = ['L', 'C', 'I', 'P']; 


// ==========================================
// 2. 메인 로직 실행
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    
    // 4개의 슬롯에 대해 각각 이벤트 연결
    for (let i = 0; i < 4; i++) {
        const badgeEl = document.getElementById(`badge-${i}`);
        
        // 클릭 이벤트 연결
        badgeEl.addEventListener('click', function() {
            toggleSlot(i);
        });
    }

    // 조합하기 버튼 이벤트
    document.getElementById('btn-combine').addEventListener('click', confirmCombination);
});


// --- [기능 1] 슬롯 토글 함수 ---
function toggleSlot(index) {
    // 현재 해당 슬롯의 값 (예: 'L')
    const currentVal = currentSelection[index];
    
    // 이 슬롯의 짝꿍 배열 가져오기 (예: ['L', 'S'])
    const pair = pairs[index];
    
    // 현재 값이 짝꿍 중 0번째면 1번째로, 아니면 0번째로 교체
    const nextVal = (currentVal === pair[0]) ? pair[1] : pair[0];
    
    // 상태 업데이트
    currentSelection[index] = nextVal;
    
    // 화면 다시 그리기
    updateDisplay(index, nextVal);
}


// --- [기능 2] 화면 업데이트 함수 ---
function updateDisplay(index, code) {
    const data = typeDB[code]; // DB에서 정보 가져오기
    
    const badgeEl = document.getElementById(`badge-${index}`);
    const descEl = document.getElementById(`desc-${index}`);

    // 1. 뱃지 디자인 변경
    badgeEl.innerText = code;
    if (data.color === 'orange') {
        badgeEl.style.backgroundColor = '#FF6B00'; // 주황색 배경
    } else {
        badgeEl.style.backgroundColor = ''; // 원래 CSS 색(파랑)으로 복귀
    }

    // 2. 설명 텍스트 변경
    // 주황색이면 style 적용, 파란색이면 class="blue" 사용
    const colorHtml = (data.color === 'orange') 
        ? `<strong style="color: #FF6B00;">${code}</strong>` 
        : `<strong class="blue">${code}</strong>`;
        
    descEl.innerHTML = `${colorHtml} - ${data.text}`;
}


// --- [기능 3] 조합 확정 함수 ---
function confirmCombination() {
    // 배열을 문자열로 합침 (예: ['S', 'C', 'I', 'N'] -> "SCIN")
    const finalType = currentSelection.join('');
    
    // alert(`[조합 완료]\n당신의 NPTI 유형은 "${finalType}" 입니다!`);
    
    // 나중에 여기서 DB로 전송 (예: sendToServer(finalType));
    console.log("선택된 유형:", finalType); 
}

// HTML이 완전히 로딩된 후에 실행하도록 감싸줌 블러처리 해제
document.addEventListener('DOMContentLoaded', function () {

    // 1. 테스트용 변수 설정
    let isLoggedIn = false;
    let isDiagnosed = false;

    // 2. 요소 찾기
    const blurSection = document.querySelector('.blur-wrapper');

    // (혹시 요소를 못 찾았으면 에러 방지를 위해 중단)
    if (!blurSection) return;

    // 3. 작성하신 테스트 로직 (둘 다 true일 때 해제)
    if (isLoggedIn === true && isDiagnosed === true) {
        console.log("테스트 조건 통과! 잠금 해제"); // F12 콘솔에서 확인 가능
        blurSection.classList.add('unlocked');
    } else {
        console.log("조건 불만족. 잠금 유지");
    }

});

