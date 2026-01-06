// 페이지 로딩 (기사 원문 + 관련 기사 포함)
// ?news_id= 뒤에 들어온 news_id 기준
document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const news_id = params.get('news_id');
    if (news_id) {
        loadArticleData(news_id);
        // -------------------------------------------------------------------
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


// 누적마우스X,Y & 누적스크롤Y & 현재페이지X,Y & baseline3 & timestamp 수집
// 유저 행동 데이터 수집---------------------------------------------------------------------------
function userBehavior(intervalMs = 100) {
    // 변수 정의
    const state = {
        currentX: 0, // 현재 마우스 X,Y
        currentY: 0,
        cumulativeX: 0, // 누적 마우스 X,Y
        cumulativeY: 0, 
        lastX: null,    // 직전 위치 (누적 계산용)
        lastY: null,

        scrollTop: window.scrollY || window.pageYOffset, // 현재 스크롤 위치
        cumulativeScrollY: 0,                            // 누적 스크롤 이동 거리
        lastScrollTop: window.scrollY || window.pageYOffset // 직전 스크롤 위치 (초기값은 현재 위치)
    };
    const targetDiv = document.getElementById('viewBody') // 
    const isPageActive = () => {
        return !document.hidden && document.hasFocus();
    };
    const handleMouseMove = (e) => {
        if (!isPageActive()) return; // 페이지가 안 보이면 업데이트도 안 함 (성능 절약)
        const x = e.pageX; // 현재마우스X,Y
        const y = e.pageY;
        state.currentX = x; 
        state.currentY = y; 
        if (state.lastX !== null && state.lastY !==null){
            state.cumulativeX += Math.abs(x - state.lastX); // 누적마우스X,Y
            state.cumulativeY += Math.abs(y - state.lastY);
        }
        state.lastX = x;
        state.lastY = y;
    };
    const handleScroll = () => {
        if (!isPageActive()) return;

        // 현재 스크롤 위치 가져오기 (크로스 브라우징 지원)
        const currentScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
        
        state.scrollTop = currentScrollY; // 현재 위치 갱신

        // 누적 스크롤 계산
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

        // 타겟과의 거리 계산 ----------------------------------------------------------
        let distance = -1;
        if (targetDiv) {
            const rect = targetDiv.getBoundingClientRect();
            // getBoundingClientRect는 뷰포트 기준이므로 scroll 값을 더해줘야 pageX/Y와 매칭됨
            const scrollX = window.scrollX || window.pageXOffset;
            const scrollY = window.scrollY || window.pageYOffset;

            const divCenterX = rect.left + scrollX + (rect.width / 2);
            const divCenterY = rect.top + scrollY + (rect.height / 2);

            // 유클리드 거리 계산 -------------------------------------------------------------
            distance = Math.sqrt(
                Math.pow(state.currentX - divCenterX, 2) + 
                Math.pow(state.currentY - divCenterY, 2)
            );
        }

        // 최종 데이터 패키징
        const dataSnapshot = {
            timestamp: new Date().toISOString(),
            mouseX: state.currentX,         // 현재 X
            mouseY: state.currentY,         // 현재 Y
            accX: state.cumulativeX,        // 누적 X
            accY: state.cumulativeY,        // 누적 Y
            accScrollY: state.cumulativeScrollY, // 누적 스크롤 Y
            distTarget: distance.toFixed(2) // 타겟과의 거리 (소수점 2자리)
        };

        // 데이터를 배열에 넣어서 전송하는 로직 필요 ----------------------------------------------
        console.log("Data:", dataSnapshot);

    }, intervalMs);


    // 5. 클린업 함수 반환 (수집 종료 시 호출)
    return {
        stop: () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('scroll', handleScroll);
            clearInterval(timerId);
            console.log("데이터 수집이 종료되었습니다.");
        }
    };
}



























