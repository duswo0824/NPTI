document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const news_id = params.get('news_id');
    if (news_id) {
        loadArticleData(news_id);
    } else {
        alert("잘못된 접근입니다.");
    }
    initRelatedNews();
});

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


function initRelatedNews(related_news) {
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

initRelatedNews();