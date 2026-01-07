// 페이지 로딩 (기사 원문 + 관련 기사 포함)
// ?news_id= 뒤에 들어온 news_id 기준
let tracker = null;
document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const news_id = params.get('news_id');
    if (news_id) {
        loadArticleData(news_id);
        // -------------------------------------------------------------------
        // 로그인 확인 로직
        // 로그인 되어 있으면 유저 행동 수집 로직 실행
        userBehavior();
    } else {
        alert("잘못된 접근입니다.");
    }
});

document.addEventListener('beforeunload',sendDataToServer);

function sendDataToServer() {
    if (!tracker) return;
    const finalData = tracker.stop();
    if (!finalData || finalData.length == 0) return;
    const blob = new Blob([JSON.stringify(finalData)], {type: 'application/json'});
    navigator.sendBeacon('/save_behavior', blob);
    console.log("데이터 전송 완료:", finalData.length);
}


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
        imgContainer.innerHTML = `<img src="${data.img}" style="height:100%;, width:auto;", alt="뉴스 이미지">`;
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
                <div class="related-img"><img src="${item.img}"></div>
            </a>`;
        relatedList.insertAdjacentHTML('beforeend', html);
    });
}


// 누적마우스X,Y & 누적스크롤Y & 현재페이지X,Y & baseline3 & timestamp 수집
// 유저 행동 데이터 수집---------------------------------------------------------------------------
window.currentTracker = null;
function userBehavior(intervalMs = 1000) {
    if (window.currentTracker) {
        console.log("기존 수집기 실행중 - 종료 후 재시작")
        window.currentTracker.stop();
    }
    // 1. 초기 상태 및 시작 시간 정의
    const startTime = Date.now(); // [New] 수집 시작 시간 (정수)
    let stepCount = 0;            // [New] 데이터 수집 회차 (0, 1, 2... 순차 증가)
    let collectedData = [];
    const state = {
        currentX: 0,
        currentY: 0,
        cumulativeX: 0,
        cumulativeY: 0,
        lastX: null,
        lastY: null,

        scrollTop: window.scrollY || window.pageYOffset,
        cumulativeScrollY: 0,
        lastScrollTop: window.scrollY || window.pageYOffset
    };

    const targetDiv = document.getElementById('viewBody');

    const isPageActive = () => {
        return !document.hidden && document.hasFocus();
    };

    const handleMouseMove = (e) => {
        if (!isPageActive()) return;
        const x = e.pageX;
        const y = e.pageY;
        state.currentX = x;
        state.currentY = y;
        if (state.lastX !== null && state.lastY !==null){
            state.cumulativeX += Math.abs(x - state.lastX);
            state.cumulativeY += Math.abs(y - state.lastY);
        }
        state.lastX = x;
        state.lastY = y;
    };

    const handleScroll = () => {
        if (!isPageActive()) return;
        const currentScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
        state.scrollTop = currentScrollY;

        if (state.lastScrollTop !== null) {
            const delta = Math.abs(currentScrollY - state.lastScrollTop);
            state.cumulativeScrollY += delta;
        }
        state.lastScrollTop = currentScrollY;
    };

    // 전역 리스너 등록
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll);

    // 주기적 데이터 수집 (Interval)
    const timerId = setInterval(() => {
        if (!isPageActive()) {
            return;
        }

        // [New] Step 증가 (데이터 순번)
        stepCount++;

        // 타겟과의 거리 계산
        let distance = -1;
        if (targetDiv) {
            const rect = targetDiv.getBoundingClientRect();
            const scrollX = window.scrollX || window.pageXOffset;
            const scrollY = window.scrollY || window.pageYOffset;

            const divCenterX = rect.left + scrollX + (rect.width / 2);
            const divCenterY = rect.top + scrollY + (rect.height / 2);

            distance = Math.sqrt(
                Math.pow(state.currentX - divCenterX, 2) +
                Math.pow(state.currentY - divCenterY, 2)
            );
        }

        // 현재 시간 (정수)
        const now = Date.now();

        // 최종 데이터 패키징
        const dataSnapshot = {
            // [Modified] 타임스탬프: 1970년 1월 1일 이후 흐른 밀리초 (정수)
            // 예: 1735689000123
            // timestamp: now,

            // [New] 경과 시간: 시작 후 흐른 밀리초 (0, 100, 200...) - 분석 시 가장 유용
            elapsedMs: (now - startTime)/1000,

            // [New] 수집 순번: 1, 2, 3... (누락된 데이터 확인 용도)
            step: stepCount,

            mouseX: Math.round(state.currentX), // 좌표도 정수로 반올림 처리 (선택사항)
            mouseY: Math.round(state.currentY),
            MMF_X: Math.floor(state.cumulativeX),
            MMF_Y: Math.floor(state.cumulativeY),
            MSF_Y: Math.floor(state.cumulativeScrollY),
            distTarget: parseFloat(distance.toFixed(2)) // 숫자형으로 변환
        };

        collectedData.push(dataSnapshot);

        console.log("Data:", dataSnapshot, "total:", collectedData.length);

        if (collectedData.length >= 100) {
//            sendDataToServer(collectedData);
//            collectedData = [];
            console.log("100개 수집 (전송 대기)")
        }

    }, intervalMs);

    // 클린업 함수
    const trackInstance = {
        stop: () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('scroll', handleScroll);
            clearInterval(timerId);
            window.currentTracker = null;
            console.log("데이터 수집이 종료되었습니다.");
            return collectedData;
        }
    };
    window.currentTracker = trackInstance;
    return trackInstance;
}

