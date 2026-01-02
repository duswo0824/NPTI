document.addEventListener('DOMContentLoaded', () => {
    // 1. 상태 및 결과값 가져오기
    const nptiResult = localStorage.getItem('nptiResult') || 'STFN';
    const resultHeader = document.getElementById('nptiResultHeader');
    const curationList = document.getElementById('curationList');
    const categoryTabs = document.querySelectorAll('.nav-tabs a');

    // 2. 상단 NPTI 성향 바 렌더링 함수
    function renderCurationHeader() {
        if (!resultHeader) return;

        const nicknames = {
            'STFN': '팩트 현실주의자', 'LCIP': '지적 탐구자',
            'STFP': '열정적 소식통', 'LCIN': '심층 비평가'
        };
        const descMap = {
            'S': '짧은', 'L': '긴', 'T': '이야기형', 'C': '텍스트형',
            'F': '객관적', 'I': '분석적', 'N': '비판적', 'P': '우호적'
        };
        const nickname = nicknames[nptiResult] || '나만의 뉴스 탐험가';

        resultHeader.innerHTML = `
            <div class="npti-header">
                <span class="npti-code">${nptiResult}</span> 
                <span class="npti-nickname">${nickname}</span>
            </div>
            <div class="tags">
                <div class="tag-text">
                    ${nptiResult.split('').map(char => `
                        <span><b class="point">${char}</b> - ${descMap[char] || ''}</span>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 3. 맞춤 뉴스 리스트 렌더링 함수
    function loadCurationNews(category = 'all') {
        if (!curationList) return;
        curationList.innerHTML = ''; // 리스트 초기화

        // 실제로는 이 부분에서 nptiResult와 category를 조합해 데이터를 필터링
        for (let i = 1; i <= 20; i++) {
            // 루프 내에서 사용할 가상 데이터 객체 생성
            const news = {
                img: "", // 이미지가 있으면 경로 입력 (예: "/img/news1.jpg")
                id: i
            };

            const article = document.createElement('a');
            article.className = 'news-card';
            article.href = `/html/view.html?id=curation_${news.id}`;

            article.innerHTML = `
            <div class="news-img">
                ${news.img ? `<img src="${news.img}" alt="뉴스 이미지">` : `<i class="fa-regular fa-image"></i>`}
            </div>
            <div class="news-info">
                <h3>[${category.toUpperCase()}] ${nptiResult} 타입을 위한 맞춤 헤드라인 예시 ${i}</h3>
                <p>${nptiResult} 성향에 맞춰 재구성된 뉴스 본문 요약입니다. 사용자가 선호하는 ${nptiResult[0]} 호흡과 ${nptiResult[2]} 시각을 반영하고 있습니다.</p>
                <div class="news-meta">NPTI Curation | 2026-01-02</div>
            </div>
        `;
            curationList.appendChild(article);
        }
    }

    // 4. 탭 클릭 이벤트 연결
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            categoryTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const category = tab.getAttribute('data-category');
            document.getElementById('categoryName').innerText = tab.innerText;
            loadCurationNews(category);
        });
    });

    // 초기 실행
    renderCurationHeader();
    loadCurationNews('all');
});