// [전역 변수] 수집된 데이터를 담을 배열과 현재 기사 ID
let behaviorLogs = [];
let currentNewsId = null;
let tracker = null; // tracker 제어용 객체
let viewerId = "guest";

document.addEventListener('DOMContentLoaded', async function () {
    const params = new URLSearchParams(window.location.search);
    const news_id = params.get('news_id');

    let sessionData = {};
    try {
        // main.js가 먼저 로드되었으므로 함수 호출 가능
        sessionData = await loadSessionState();

        // main.js의 globalSession 상태 업데이트 (선택 사항)
        if (typeof globalSession !== 'undefined') {
            Object.assign(globalSession, sessionData);
        }
    } catch (e) {
        console.error("세션 정보를 가져오는 중 오류 발생(main.js 로드 확인 필요):", e);
    }

    if (sessionData && sessionData.isLoggedIn && sessionData.user_id) {
        viewerId = sessionData.user_id;
        console.log(`[View] 사용자 인증 완료: ${viewerId}`);
    } else {
        console.log(`[View] 비로그인(Guest) 접속`);
    }

    if (news_id) {
        currentNewsId = news_id; // 전역 변수에 할당 (나중에 전송할 때 사용)
        loadArticleData(news_id, viewerId);
    } else {
        alert("잘못된 접근입니다.");
    }



});

// 페이지 이탈(닫기, 새로고침, 뒤로가기) 시 데이터 전송
window.addEventListener('beforeunload', sendDataToServer);
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
        sendDataToServer();
    }
});

function loadArticleData(news_id, viewerId){
    fetch(`/article/${news_id}`)
        .then(response => {
            if (!response.ok) throw new Error("기사를 불러오는데 실패했습니다.");
            return response.json();
        })
        .then(data => {
            renderArticle(data);

            // [수정됨] 기사 로딩이 끝나면 행동 수집 시작!
            if (!tracker && viewerId != 'guest') {
                tracker = userBehavior(news_id, 100); // 0.1초 간격 수집
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
        imgContainer.innerHTML = `<img src="${data.img}" style="height:100%; width:100%; object-fit:contain;", alt="뉴스 이미지">`;
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
        const imgHtml = item.img
            ? `<div class="related-img"><img src="${item.img}" alt="관련기사 이미지" style="width:100%; height:100%; object-fit: contain;"></div>`
            : `<div class="related-img" style="background-color: #eee; display:flex; justify-content:center; align-items:center; font-size: 8px;">이미지 없음</div>`;
        const html = `
            <a href="/article?news_id=${item.news_id}" class="related-item">
                <div class="related-text">
                    <h4>${item.title}</h4>
                    <div class="related-info"><span>${item.media}</span> | <span>${item.pubdate}</span></div>
                </div>
                ${imgHtml}
            </a>`;
        relatedList.insertAdjacentHTML('beforeend', html);
    });
}

function sendDataToServer() {
    // 1. 보낼 데이터가 없으면 중단
    if (!behaviorLogs || behaviorLogs.length === 0) return;
    const logsToSend = [...behaviorLogs];
    behaviorLogs = [];
    // 2. 최종 데이터 패키징
    const payload = {
        news_id: currentNewsId,
        user_id: viewerId, // 로그인 기능 구현 시 실제 ID로 교체
        session_end_time: Date.now(),
        total_logs: logsToSend.length,
        logs: logsToSend // 복사한 데이터(10초)
    };

    // 3. 데이터 전송 (sendBeacon 사용 권장)
    // sendBeacon은 페이지가 닫혀도 전송을 보장하며, POST로 전송됨.
    const blob = new Blob([JSON.stringify(payload)], {type: 'application/json'});
    const success = navigator.sendBeacon('/log/behavior', blob);

    // 4. 전송 후 로그 초기화 (중복 전송 방지)
    if (success) {
        console.log(`[Data Transfer] sendBeacon 전송 성공! ${logsToSend.length}개`)
    } else {
        console.log(`[Data Transfer] sendBeacon 실패 - fetch로 재시도`)
        fetch('/log/behavior',{
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body:JSON.stringify(payload),
            keepalive:true
        })
        .then(response => {
            if (response.of) {
                console.log(`[Data Transfer] fetch(keepalive) 전송 성공! ${logsToSend.length}개`);
            } else {
                console.error("[Data Trnasfer] fecth 서버 응답 에러:", response.status);
            }
        })
        .catch(err => {
            console.error("[Data Transfer] 최종 전송 실패:", err);
            behaviorLogs.unshift(...logsToSend);
        });
    }
}

function userBehavior(news_id, intervalMs = 100) {
    // ------------------------------------------------------------------------
    // [설정] 서버 전송 관련 설정
    // ------------------------------------------------------------------------
    const SERVER_URL = '/log/behavior';
    const SEND_INTERVAL_MS = 10000;         // 10초마다 전송
    let behaviorBuffer = [];                // 전송 전 데이터를 모아둘 버퍼

    // ------------------------------------------------------------------------
    // [기존 변수] 상태 및 활성 추적 변수
    // ------------------------------------------------------------------------
    let totalActiveMs = 0;
    let lastCheckTime = Date.now();
    let isMouseInside = true;
    let isScrolling = false;
    let scrollTimeout = null;

    const state = {
        currentX: 0, currentY: 0,
        cumulativeX: 0, cumulativeY: 0,
        lastX: null, lastY: null,
        scrollTop: window.scrollY || window.pageYOffset,
        cumulativeScrollY: 0,
        lastScrollTop: window.scrollY || window.pageYOffset
    };

    const targetDiv = document.getElementById('viewBody');

    // ------------------------------------------------------------------------
    // [이벤트 핸들러] 활성 상태 추적
    // ------------------------------------------------------------------------
    const handleMouseEnter = () => { isMouseInside = true; };
    const handleMouseLeave = () => { isMouseInside = false; };

    const trackScrollState = () => {
        isScrolling = true;
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            isScrolling = false;
        }, 3000);
    };

    document.documentElement.addEventListener('mouseenter', handleMouseEnter);
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('scroll', trackScrollState);

    const isPageActive = () => {
        return !document.hidden && (document.hasFocus() || isMouseInside || isScrolling);
    };

    // ------------------------------------------------------------------------
    // [이벤트 핸들러] 데이터 수집 (마우스/스크롤 좌표)
    // ------------------------------------------------------------------------
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

    // ------------------------------------------------------------------------
    // [Timer 1] 100ms 간격 데이터 수집 (Collection Loop)
    // ------------------------------------------------------------------------
    const collectTimerId = setInterval(() => {
        const now = Date.now();
        const timeDelta = now - lastCheckTime;
        lastCheckTime = now;

        if (!isPageActive()) return;

        totalActiveMs += timeDelta;

        const winWidth = window.innerWidth || 1;
        const winHeight = window.innerHeight || 1;
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        // Rescaling Logic
        let normMouseX = (state.currentX - scrollX) / winWidth;
        let normMouseY = (state.currentY - scrollY) / winHeight;
        let normMMF_X = state.cumulativeX / winWidth;
        let normMMF_Y = state.cumulativeY / winHeight;
        let normMSF_Y = state.cumulativeScrollY / winHeight;

        let distance = -1;
        let baseline = 0;

        if (targetDiv) {
            const rect = targetDiv.getBoundingClientRect();
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
            timestamp: now / 100,
            elapsedMs: totalActiveMs / 100,
            mouseX: parseFloat(normMouseX.toFixed(20)),
            mouseY: parseFloat(normMouseY.toFixed(20)),
            MMF_X: parseFloat(normMMF_X.toFixed(20)),
            MMF_Y: parseFloat(normMMF_Y.toFixed(20)),
            MSF_Y: parseFloat(normMSF_Y.toFixed(20)),
            distTarget: parseFloat(distance.toFixed(20)),
            baseline: parseFloat(baseline.toFixed(20)),
        };

        // [변경] 내부 버퍼 대신 전역 배열 behaviorLogs에 push
        behaviorLogs.push(dataSnapshot);
        console.log(dataSnapshot);

    }, intervalMs);

    // ------------------------------------------------------------------------
    // [Timer 2] 10초 간격 전송 (Transmission Loop)
    // ------------------------------------------------------------------------
    const sendTimerId = setInterval(() => {
        // [변경] 전역 함수 호출
        sendDataToServer();
    }, SEND_INTERVAL_MS);

    // ------------------------------------------------------------------------
    // Clean-up
    // ------------------------------------------------------------------------
    return {
        stop: () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('scroll', handleScroll);
            document.documentElement.removeEventListener('mouseenter', handleMouseEnter);
            document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
            window.removeEventListener('scroll', trackScrollState);

            if (scrollTimeout) clearTimeout(scrollTimeout);
            clearInterval(collectTimerId);
            clearInterval(sendTimerId);

            // [변경] 종료 직전 전역 함수 호출로 남은 데이터 전송
            sendDataToServer();
        }
    };
}