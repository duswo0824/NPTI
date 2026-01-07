// [전역 변수] 수집된 데이터를 담을 배열과 현재 기사 ID
let behaviorLogs = [];
let currentNewsId = null;
let tracker = null; // tracker 제어용 객체

document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const news_id = params.get('news_id');

    if (news_id) {
        currentNewsId = news_id; // 전역 변수에 할당 (나중에 전송할 때 사용)
        loadArticleData(news_id);
    } else {
        alert("잘못된 접근입니다.");
    }
});

// 페이지 이탈(닫기, 새로고침, 뒤로가기) 시 데이터 전송
window.addEventListener('beforeunload', sendDataToServer);
// 모바일 등 일부 환경 대비 (visibilitychange)
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
        sendDataToServer();
    }
});

function loadArticleData(news_id){
    fetch(`/article/${news_id}`)
        .then(response => {
            if (!response.ok) throw new Error("기사를 불러오는데 실패했습니다.");
            return response.json();
        })
        .then(data => {
            renderArticle(data);

            // [수정됨] 기사 로딩이 끝나면 행동 수집 시작!
            if (!tracker) {
                tracker = userBehavior(100); // 0.1초 간격 수집
            }

            if (data.related_news && data.related_news.length > 0){
                initRelatedNews(data.related_news);
            }
        })
        .catch(error => {
            console.error('Error:', error);
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

function sendDataToServer() {
    // 1. 보낼 데이터가 없으면 중단
    if (!behaviorLogs || behaviorLogs.length === 0) return;

    // 2. 최종 데이터 패키징
    const payload = {
        news_id: currentNewsId,
        user_id: "guest", // 로그인 기능 구현 시 실제 ID로 교체
        session_end_time: Date.now(),
        total_logs: behaviorLogs.length,
        logs: behaviorLogs // 쌓아둔 데이터 전체
    };

    // 3. 데이터 전송 (sendBeacon 사용 권장)
    // sendBeacon은 페이지가 닫혀도 전송을 보장하며, POST로 전송됨.
    const blob = new Blob([JSON.stringify(payload)], {type: 'application/json'});
    const success = navigator.sendBeacon('/log/behavior', blob);

    // 4. 전송 후 로그 초기화 (중복 전송 방지)
    if (success) {
        behaviorLogs = [];
    } else {
        // sendBeacon 실패 시 fetch로 시도 (keepalive 옵션 필수)
        fetch('/log/behavior', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload),
            keepalive: true
        });
        behaviorLogs = [];
    }
}

function userBehavior(intervalMs = 100) {
    let totalActiveMs = 0;
    let lastCheckTime = Date.now();

    const state = {
        currentX: 0, currentY: 0,
        cumulativeX: 0, cumulativeY: 0,
        lastX: null, lastY: null,
        scrollTop: window.scrollY || window.pageYOffset,
        cumulativeScrollY: 0,
        lastScrollTop: window.scrollY || window.pageYOffset
    };

    const targetDiv = document.getElementById('viewBody');

    const isPageActive = () => !document.hidden && document.hasFocus();

    const handleMouseMove = (e) => {
        if (!isPageActive()) return;
        const x = e.pageX;
        const y = e.pageY;
        state.currentX = x;
        state.currentY = y;
        if (state.lastX !== null && state.lastY !== null){
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
            state.cumulativeScrollY += Math.abs(currentScrollY - state.lastScrollTop);
        }
        state.lastScrollTop = currentScrollY;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll);

    const timerId = setInterval(() => {
        const now = Date.now();
        const timeDelta = now - lastCheckTime;
        lastCheckTime = now;

        if (!isPageActive()) return;

        totalActiveMs += timeDelta;

        const winWidth = window.innerWidth || 1;
        const winHeight = window.innerHeight || 1;
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        // Rescaling Logic (요청하신 부분)
        let normMouseX = (state.currentX - scrollX) / winWidth;
        let normMouseY = (state.currentY - scrollY) / winHeight;
        let normMMF_X = state.cumulativeX / winWidth;
        let normMMF_Y = state.cumulativeY / winHeight;
        let normMSF_Y = state.cumulativeScrollY / winHeight;

        let distance = -1;
        let baseline = 0;

        if (targetDiv) {
            const rect = targetDiv.getBoundingClientRect();
            // Document 기준 좌표로 변환
            const absLeft = rect.left + scrollX;
            const absTop = rect.top + scrollY;
            const absRight = absLeft + rect.width;
            const absBottom = absTop + rect.height;

            const divCenterX = absLeft + (rect.width / 2);
            const divCenterY = absTop + (rect.height / 2);

            distance = Math.sqrt(
                Math.pow(state.currentX - divCenterX, 2) +
                Math.pow(state.currentY - divCenterY, 2)
            );

            const isHovering = (
                state.currentX >= absLeft && state.currentX <= absRight &&
                state.currentY >= absTop && state.currentY <= absBottom
            );

            baseline = isHovering ? 1 : (distance > 0 ? (1 / distance) : 0);
        }

        const dataSnapshot = {
            timestamp: now,
            elapsedMs: totalActiveMs,
            mouseX: parseFloat(normMouseX.toFixed(4)),
            mouseY: parseFloat(normMouseY.toFixed(4)),
            MMF_X: parseFloat(normMMF_X.toFixed(4)),
            MMF_Y: parseFloat(normMMF_Y.toFixed(4)),
            MSF_Y: parseFloat(normMSF_Y.toFixed(4)),
            distTarget: parseFloat(distance.toFixed(2)),
            baseline: parseFloat(baseline.toFixed(6))
        };

        // [수정됨] 콘솔 출력 대신 전역 배열에 저장
        behaviorLogs.push(dataSnapshot);
        // console.log("Collected:", behaviorLogs.length); // 디버깅용

    }, intervalMs);

    return {
        stop: () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('scroll', handleScroll);
            clearInterval(timerId);
        }
    };
}