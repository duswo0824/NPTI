document.addEventListener('DOMContentLoaded', function () {
    /* ============================================================
       1. 뉴스 상세 데이터베이스 (articleDB)
       - content 배열에 긴 문단들을 추가하여 스크롤을 구현했습니다.
       ============================================================ */
    const articleDB = {
        "news_1": {
            press: "언론사명",
            category: "카테고리명",
            title: "기사 제목 : 개별기사 페이지의 기사 제목",
            // 여기 링크가 기사 원문
            link: "https://www.naver.com",
            date: "2025-12-31",
            author: "기자명",
            caption: "▲ 이미지 사이즈 확인용 회색 플레이스홀더 영역입니다.",
            content: [
                "첫 번째 문단입니다. NPTI 서비스의 상세 페이지 레이아웃을 테스트하기 위한 긴 본문 텍스트입니다. 이 부분은 사용자가 기사를 클릭했을 때 가장 먼저 마주하게 되는 도입부로, 기사의 핵심 내용을 요약하거나 흥미를 유발하는 문장들로 채워집니다.",
                "두 번째 문단입니다. 기사 본문이 길어질 경우 가독성을 위해 CSS에서 설정한 line-height(행간)와 margin-bottom(문단 간격)이 매우 중요하게 작용합니다. 현재 설정된 1.95 이상의 행간은 긴 글을 읽을 때 피로감을 줄여주며, 양끝 정렬(text-align: justify)을 통해 실제 신문이나 전문 뉴스 매체와 같은 정갈한 느낌을 줍니다.",
                "세 번째 문단으로 본격적인 데이터 분석 내용을 담고 있다고 가정해 봅시다. 최근 뉴스 소비 트렌드에 따르면 사용자들은 자신에게 최적화된 맞춤형 콘텐츠를 선호하는 경향이 뚜렷해지고 있습니다. NPTI는 이러한 심리적, 성향적 지표를 분석하여 단순한 정보 전달을 넘어 사용자의 삶에 밀착된 인사이트를 제공하는 것을 목표로 합니다.",
                "네 번째 문단입니다. 스크롤을 더 유도하기 위해 내용을 추가합니다. 현대 사회에서의 뉴스 리터러시는 정보를 단순히 수용하는 단계를 넘어, 수많은 정보 속에서 진실을 가려내고 자신의 관점을 정립하는 능력을 의미합니다. 상세 페이지의 깔끔한 UI는 사용자가 오직 기사 내용에만 집중할 수 있는 환경을 조성합니다.",
                "다섯 번째 문단입니다. 디자인적으로는 좌측의 넓은 본문 영역과 우측의 사이드바가 균형을 이루어야 합니다. 본문이 길어지더라도 우측 사이드바에 적용된 sticky 속성 덕분에 '함께 보면 좋은 뉴스' 리스트는 사용자의 시선을 따라 이동하며 추가적인 클릭을 유도하게 됩니다.",
                "여섯 번째 문단입니다. 이제 스크롤이 제법 생겼을 것입니다. 기사의 중반부에서는 구체적인 통계 수치나 전문가의 인터뷰 내용을 인용하여 신뢰도를 높이는 것이 일반적입니다. 예를 들어, 'NPTI 연구소의 조사에 따르면 뉴스 가독성이 20% 향상될 때 사용자의 체류 시간은 평균 15% 증가한다'는 식의 구성을 상상해 볼 수 있습니다.",
                "일곱 번째 문단입니다. 이미지 하단에 위치한 캡션 역시 중요한 요소입니다. 사진이 전달하지 못하는 세부적인 맥락을 텍스트로 보완함으로써 독자의 이해를 돕습니다. 회색 플레이스홀더 박스는 실제 이미지가 삽입될 위치와 크기를 가늠하게 해주며, 16:9 비율은 현대 웹 디자인에서 가장 안정적인 시각적 경험을 제공합니다.",
                "여덟 번째 문단입니다. 거의 끝부분에 다다랐습니다. 상세 페이지 하단에는 기사 원문으로 바로갈 수 있는 버튼과 저작권 표시가 위치합니다. 저작권 문구는 언론사의 권리를 보호하는 동시에 독자에게 출처를 명확히 밝히는 역할을 합니다.",
                "마지막 아홉 번째 문단입니다. 긴 글을 읽어주신 사용자에게 감사의 인사를 전하거나 관련 기사로의 이동을 권유하며 마무리합니다. NPTI는 앞으로도 더 나은 뉴스 읽기 경험을 위해 인터페이스와 알고리즘을 지속적으로 개선해 나갈 예정입니다."
            ],
            copyright: "" // 비워두면 하단 로직에서 자동으로 생성됩니다.
        }
    };

    /* ============================================================
       2. 렌더링 로직
       ============================================================ */
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id') || "news_1";
    const data = articleDB[id];

    if (data) {
        document.getElementById('viewPress').innerText = data.press;
        document.getElementById('viewTitle').innerText = data.title;
        document.getElementById('viewCategory').innerText = data.category;
        document.getElementById('viewDate').innerText = data.date;
        document.getElementById('viewAuthor').innerText = data.author;
        document.getElementById('viewCaption').innerText = data.caption;

        // 저작권 문구 동적 생성 (press 값 활용)
        const copyrightText = data.copyright || `※ 이 기사의 저작권은 「${data.press}」에 있으며, 이를 무단으로 이용할 경우 법적 책임을 질 수 있습니다.`;
        document.getElementById('viewCopyright').innerText = copyrightText;

        const bodyWrap = document.getElementById('viewBody');
        bodyWrap.innerHTML = '';
        data.content.forEach(text => {
            const p = document.createElement('p');
            p.innerText = text;
            bodyWrap.appendChild(p);
        });

        const originBtn = document.querySelector('.btn-origin');
        if (originBtn && data.link) {
            originBtn.onclick = function () {
                // articleDB에 설정된 link 주소로 새 창 열기
                window.open(data.link, '_blank');
            };
        }

    }

    /* ============================================================
       3. 사이드바 (5개 고정)
       ============================================================ */
    initRelatedNews();
});

function initRelatedNews() {
    const relatedList = document.getElementById('relatedList');
    if (!relatedList) return;

    const sideData = [
        { id: "news_1", title: "함께 보면 좋은 뉴스 제목 1번입니다", press: "언론사명", date: "2025-12-31" },
        { id: "news_2", title: "함께 보면 좋은 뉴스 제목 2번입니다", press: "언론사명", date: "2025-12-31" },
        { id: "news_3", title: "함께 보면 좋은 뉴스 제목 3번입니다", press: "언론사명", date: "2025-12-31" },
        { id: "news_4", title: "함께 보면 좋은 뉴스 제목 4번입니다", press: "언론사명", date: "2025-12-31" },
        { id: "news_5", title: "함께 보면 좋은 뉴스 제목 5번입니다", press: "언론사명", date: "2025-12-31" }
    ];

    relatedList.innerHTML = '';
    sideData.forEach(item => {
        const html = `
            <a href="view.html?id=${item.id}" class="related-item">
                <div class="related-text">
                    <h4>${item.title}</h4>
                    <div class="related-info"><span>${item.press}</span> | <span>${item.date}</span></div>
                </div>
                <div class="related-img"><i class="fa-regular fa-image" style="color:#ddd; font-size:20px;"></i></div>
            </a>`;
        relatedList.insertAdjacentHTML('beforeend', html);
    });
}

/* --- view.js 내의 사이드바 생성 함수 부분 --- */
function initRelatedNews() {
    const relatedList = document.getElementById('relatedList');
    if (!relatedList) return;

    // 사이드바 뉴스 5개 데이터
    const sideData = [
        { id: "news_1", title: "함께 보면 좋은 뉴스 제목 1번입니다", press: "언론사명", date: "2025-12-31" },
        { id: "news_2", title: "함께 보면 좋은 뉴스 제목 2번입니다", press: "언론사명", date: "2025-12-31" },
        { id: "news_3", title: "함께 보면 좋은 뉴스 제목 3번입니다", press: "언론사명", date: "2025-12-31" },
        { id: "news_4", title: "함께 보면 좋은 뉴스 제목 4번입니다", press: "언론사명", date: "2025-12-31" },
        { id: "news_5", title: "함께 보면 좋은 뉴스 제목 5번입니다", press: "언론사명", date: "2025-12-31" }
    ];

    relatedList.innerHTML = '';
    sideData.forEach(item => {
        // [수정] a 태그를 사용하여 href에 경로와 id를 넣음
        const html = `
            <a href="view.html?id=${item.id}" class="related-item">
                <div class="related-text">
                    <h4>${item.title}</h4>
                    <div class="related-info">
                        <span>${item.press}</span> | <span>${item.date}</span>
                    </div>
                </div>
                <div class="related-img">
                    <i class="fa-regular fa-image" style="color:#ddd; font-size:20px;"></i>
                </div>
            </a>`;
        relatedList.insertAdjacentHTML('beforeend', html);
    });
}

initRelatedNews();