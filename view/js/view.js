// 페이지 로딩 (기사 원문 + 관련 기사 포함)
// ?news_id= 뒤에 들어온 news_id 기준
document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const news_id = params.get('news_id');
    if (news_id) {
        loadArticleData(news_id);
        // --------------------------------------------------
        // 로그인 확인 로직
        // 로그인 되어 있으면 유저 행동 수집 로직 실행
    } else {
        alert("잘못된 접근입니다.");
    }
});

// request에 대한 response 확인 -> 기사 원문 가져오기 -> 관련 기사가 있으면 관련 기사 가져오기
function loadArticleData(news_id){
    fetch(`/article/${news_id}`)
        .then(response => {
            if (!response.ok) {
                throw new Error("기사를 불러오는데 실패했습니다.")
            }
            return response.json();
        })
        .then(data => {
            renderArticle(data);
            console.log(data);
            if (data.related_news && data.related_news.length >0){
                initRelatedNews(data.related_news);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert("기사 내용을 불러올 수 없습니다.")
        });
}

// 기사 원문 보여주기 (링크 있으면 원문 버튼 & 이미지 있으면 보여줌, 없으면 생략)
function renderArticle(data){
    document.getElementById('viewPress').innerText = data.media || "";
    document.getElementById('viewTitle').innerText = data.title || "";
    document.getElementById('viewCategory').innerText = data.category || "";
    document.getElementById('viewDate').innerText = data.pubdate || "";
    document.getElementById('viewAuthor').innerText = data.writer || "";
    document.getElementById('viewCaption').innerText = data.imgCap || "";
    document.getElementById('viewPress').innerText = data.media || "";
    document.getElementById('viewBody').innerText = data.content || "";
    const originBtn = document.querySelector('.btn-origin');
    if (originBtn && data.link){
        originBtn.onclick = function(){
            window.open(data.link,'_blank');
        }

    }
    const imgContainer = document.querySelector('div.img-placeholder');
    if (imgContainer && data.img) {
        imgContainer.innerHTML = `<img src="${data.img}" style="height:100%, width:auto", alt="뉴스 이미지">`;
        imgContainer.style.display = 'block';
    } else if (imgContainer && !data.img){
        imgContainer.style.display = 'none';
    }
    const copyrightText = `이 기사의 저작권은 ${data.media || '해당 언론사'}에 있으며, 이를 무단으로 이용할 경우 법적 책임을 질 수 있습니다.`
    document.getElementById('viewCopyright').innerText = copyrightText;

}

// 관련 기사 보여주기
function initRelatedNews(related_news) {
    const relatedList = document.getElementById('relatedList');
    if (!relatedList) return;

    relatedList.innerHTML = '';
    related_news.forEach(item => {
        const html = `
            <a href="/article?news_id=${item.news_id}" class="related-item">
                <div class="related-text">
                    <h4>${item.title}</h4>
                    <div class="related-info"><span>${item.media}</span> | <span>${item.pubdate}</span></div>
                </div>
                <div class="related-img"><img src=item.img></div>
            </a>`;
        relatedList.insertAdjacentHTML('beforeend', html);
    });
}
// #---------------------------------------------------------------------------

function userBehavior(){
    let mouseData = []; // 마우스 좌표 (x, y, timestamp)
    let scrollData = []; // 스크롤 위치 (scrollY, timestamp)
    let lastMouseTime = 0; // 스로틀링을 위한 마지막 기록 시간
    let lastScrollTime = 0; // 스로틀링을 위한 마지막 기록 시간
    const SAMPLING_RATE = 100; // 0.2초마다 데이터 수집 (서버 부하 및 데이터 크기 조절)

    // 1. MouseMove 이벤트 리스너
    document.addEventListener('mousemove', function(e) {
        const now = Date.now();
        // 설정한 시간 간격(100ms)보다 지났을 때만 기록
        if (now - lastMouseTime > SAMPLING_RATE) {
            mouseData.push({
                x: e.clientX, // 브라우저 창 기준 X 좌표
                y: e.clientY, // 브라우저 창 기준 Y 좌표
                t: now        // 타임스탬프
            });
            lastMouseTime = now;
        }
    });

    // 2. Scroll 이벤트 리스너
    document.addEventListener('scroll', function() {
        const now = Date.now();
        if (now - lastScrollTime > SAMPLING_RATE) {
            scrollData.push({
                y: window.scrollY, // 세로 스크롤 위치
                pct: getScrollPercentage(), // 스크롤 백분율 (전체 문서 중 어디쯤인지)
                t: now
            });
            lastScrollTime = now;
        }
    });

    // (보조 함수) 스크롤 백분율 계산
    function getScrollPercentage() {
        const scrollTop = window.scrollY;
        const docHeight = document.body.scrollHeight - window.innerHeight;
        if (docHeight <= 0) return 0;
        return Math.round((scrollTop / docHeight) * 100);
    }

    // 3. 데이터 전송 (페이지를 떠날 때)
    // 'beforeunload'는 사용자가 탭을 닫거나 다른 페이지로 이동하기 직전에 발생합니다.
    window.addEventListener('beforeunload', function() {
        const params = new URLSearchParams(window.location.search);
        const news_id = params.get('news_id');

        // 수집된 데이터 패키징
        const payload = {
            news_id: news_id,
            session_id: "user_session_123", // 실제 구현 시 쿠키나 로컬스토리지의 세션 ID 사용
            start_time: mouseData.length > 0 ? mouseData[0].t : Date.now(),
            end_time: Date.now(),
            mouse_events: mouseData,
            scroll_events: scrollData,
            // 체류 시간 (초 단위)
            dwell_time: (Date.now() - (mouseData.length > 0 ? mouseData[0].t : Date.now())) / 1000
        };

        // 데이터 전송: sendBeacon 사용 권장 (페이지가 닫혀도 전송 보장)
        // 데이터는 JSON 문자열로 변환하여 전송
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon('/log/behavior', blob);
    });
}