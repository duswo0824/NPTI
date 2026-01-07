/* main.js
[구조]
1. 전역 상수 및 상태 변수
2. Session 상태 로딩
3. 메인 실행 DOMContentLoaded
4. 데이터 생성 및 헬퍼 함수
5. UI 컴포넌트 (Ticker / Slider / Grid)
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

const OPPOSITE_MAP = { S:'L', L:'S', T:'C', C:'T', F:'I', I:'F', N:'P', P:'N' };
const PAIRS = [['L','S'], ['C','T'], ['I','F'], ['P','N']];

const TYPE_DB = {
    L:{ text:'긴', color:'blue' },   S:{ text:'짧은', color:'orange' },
    C:{ text:'텍스트형', color:'blue' }, T:{ text:'이야기형', color:'orange' },
    I:{ text:'분석적', color:'blue' }, F:{ text:'객관적', color:'orange' },
    P:{ text:'우호적', color:'blue' }, N:{ text:'비판적', color:'orange' }
};

let currentSelection = ['L','C','I','P'];
let sliderInterval = null;

/* =====================================================
   2. Session 상태 로딩 (단일 진실 소스)
===================================================== */
async function loadSessionState() {
    try {
        const res = await fetch('/auth/me', { credentials:'include' });
        return await res.json();
    } catch {
        return { isLoggedIn:false, hasNPTI:false, nptiResult:null };
    }
}

/* =====================================================
   3. 메인 실행
===================================================== */
document.addEventListener('DOMContentLoaded', async () => {

    const { isLoggedIn, hasNPTI, nptiResult } = await loadSessionState();

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

    /* 상태 분기 */
    if (!isLoggedIn) {
        initSlider('all');
        initGrid('all');
        initBottomBadges('STFN');
        return;
    }

    if (!hasNPTI) {
        initSlider('all');
        initGrid('all');
        return;
    }

    updateHeaderTitle(nptiResult);
    initSlider('all');
    initBottomBadges(nptiResult);

    document.querySelector('.blur-wrapper')?.classList.add('unlocked');
    document.querySelector('.banner-overlay')?.style.setProperty('display', 'none');
});

/* =====================================================
   4. 데이터 & 헬퍼
===================================================== */
function getCategoryFromTab(tab) {
    return tab.dataset.category ||
        Object.entries(CAT_NAMES).find(([,v]) => v === tab.innerText.trim())?.[0] ||
        'all';
}

function getNewsData(category) {
    const name = CAT_NAMES[category] || '전체';
    return Array.from({ length: 9 }, (_, i) => ({
        id:`NEWS_${i+1}`,
        title:`[NPTI PICK] ${name} 뉴스 예시 ${i+1}`,
        desc:`${name} 분야 기사`,
        img:'',
        link:'#'
    }));
}

/* =====================================================
   5. UI 컴포넌트
===================================================== */

/* Ticker */
function initTicker() {
    const list = document.getElementById('ticker-list');
    if (!list) return;

    list.innerHTML='';
    Array.from({length:5},(_,i)=>`[속보] 뉴스 예시 ${i+1}`)
        .forEach(t=>{
            const li=document.createElement('li');
            li.innerHTML=`<a>${t}</a>`;
            list.appendChild(li);
        });
}

/* Slider (dot / prev-next / hover stop / infinite) */
function initSlider(category) {
    const track = document.getElementById('slider-track');
    const dotsWrap = document.getElementById('pagination-dots');
    const wrapper = document.querySelector('.hero-slider-wrapper');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    if (!track || !dotsWrap) return;

    if (sliderInterval) clearInterval(sliderInterval);
    track.innerHTML=''; dotsWrap.innerHTML='';

    const data = getNewsData(category);
    let currentIndex = 0;
    let isTransitioning = false;

    data.forEach((n,i)=>{
        const a=document.createElement('a');
        a.className='hero-slide';
        a.innerHTML=`<h3>${n.title}</h3><p>${n.desc}</p>`;
        track.appendChild(a);

        const dot=document.createElement('span');
        dot.className=`dot ${i===0?'active':''}`;
        dot.onclick=()=>{ moveTo(i); resetAuto(); };
        dotsWrap.appendChild(dot);
    });

    track.appendChild(track.firstElementChild.cloneNode(true));
    const dots=dotsWrap.querySelectorAll('.dot');
    const total=data.length;

    function moveTo(idx){
        if(isTransitioning) return;
        isTransitioning=true;

        track.style.transition='transform .5s';
        currentIndex=idx;
        track.style.transform=`translateX(-${currentIndex*100}%)`;

        let dIdx=currentIndex;
        if(currentIndex===total) dIdx=0;
        if(currentIndex<0) dIdx=total-1;

        dots.forEach(d=>d.classList.remove('active'));
        dots[dIdx]?.classList.add('active');

        setTimeout(()=>{
            if(currentIndex===total){
                track.style.transition='none';
                currentIndex=0;
                track.style.transform='translateX(0)';
            }
            if(currentIndex<0){
                track.style.transition='none';
                currentIndex=total-1;
                track.style.transform=`translateX(-${currentIndex*100}%)`;
            }
            isTransitioning=false;
        },500);
    }

    function auto(){ sliderInterval=setInterval(()=>moveTo(currentIndex+1),4000); }
    function resetAuto(){ clearInterval(sliderInterval); auto(); }

    btnPrev && (btnPrev.onclick=()=>{ moveTo(currentIndex-1); resetAuto(); });
    btnNext && (btnNext.onclick=()=>{ moveTo(currentIndex+1); resetAuto(); });

    wrapper && (
        wrapper.onmouseenter=()=>clearInterval(sliderInterval),
        wrapper.onmouseleave=auto
    );

    auto();
}

/* Grid */
function initGrid(category){
    const grid=document.getElementById('news-grid');
    if(!grid) return;
    grid.innerHTML='';

    const type=currentSelection.join('');
    const name=CAT_NAMES[category]||'전체';

    for(let i=1;i<=9;i++){
        const a=document.createElement('a');
        a.className='grid-item';
        a.innerHTML=`<h4>[${type}] ${name} 뉴스 ${i}</h4>`;
        grid.appendChild(a);
    }
}

/* =====================================================
   6. NPTI 개인화 (Badge + 색상)
===================================================== */
function updateHeaderTitle(code){
    const area=document.querySelector('.section-pick .title-area');
    if(!area) return;

    area.innerHTML=`
        <span class="npti-code">${code}</span>
        ${code.split('').map(c=>`<span>${c}-${TYPE_DB[c].text}</span>`).join('')}
    `;
}

function initBottomBadges(code){
    const text=document.querySelector('.section-lcin .tag-text');
    const badges=document.getElementById('lcin-badges');
    if(!text||!badges) return;

    currentSelection=code.split('').map(c=>OPPOSITE_MAP[c]);

    text.innerHTML=currentSelection.map((_,i)=>`<span id="desc-${i}"></span>`).join('');
    badges.innerHTML=currentSelection.map((c,i)=>`<span id="badge-${i}">${c}</span>`).join('');

    currentSelection.forEach((c,i)=>{
        document.getElementById(`badge-${i}`).onclick=()=>toggleSlot(i,code);
        updateBadgeDisplay(i,c,code);
    });

    initGrid('all');
}

function toggleSlot(i,origin){
    const p=PAIRS[i];
    currentSelection[i]=currentSelection[i]===p[0]?p[1]:p[0];
    updateBadgeDisplay(i,currentSelection[i],origin);
    initGrid('all');
}

function updateBadgeDisplay(i,code,origin){
    const badge=document.getElementById(`badge-${i}`);
    const desc=document.getElementById(`desc-${i}`);
    if(!badge||!desc) return;

    const isRec=code!==origin[i];
    const color=isRec?'#0057FF':'#FF6B00';

    badge.style.background=color;
    badge.style.color='#fff';
    desc.innerHTML=`<strong style="color:${color}">${code}</strong> - ${TYPE_DB[code].text}`;
}

/* =====================================================
   7. 이벤트 & 모달 / 접근 가드
===================================================== */
function setupGlobalEvents(isLoggedIn,hasNPTI){

    /* 로그아웃 */
    const authLink=document.getElementById('authLink');
    if(isLoggedIn&&authLink){
        authLink.innerText='로그아웃';
        authLink.onclick=async e=>{
            e.preventDefault();
            await fetch('/logout',{method:'POST',credentials:'include'});
            location.replace('/');
        };
    }

    /* 접근 가드 + 파라미터 전달 */
    document.querySelectorAll(
        'a[href*="curation.html"], a[href*="mypage.html"], a[href*="test.html"], .icon-btn.user, .btn-load-more'
    ).forEach(link=>{
        link.onclick=e=>{
            const href=link.getAttribute('href')||'';

            if(!isLoggedIn){
                e.preventDefault();
                toggleModal('loginGuardModal',true);
                return;
            }

            if(href.includes('curation')&&!hasNPTI){
                e.preventDefault();
                toggleModal('hasNPTIGuardModal',true);
                return;
            }

            if(link.classList.contains('btn-load-more')){
                e.preventDefault();
                location.href=`${href.split('?')[0]}?type=${currentSelection.join('')}`;
            }

            if(link.classList.contains('user')){
                e.preventDefault();
                location.href='/view/html/mypage.html';
            }
        };
    });

    /* About NPTI */
    const aboutBtn=document.querySelector('.search-bubble');
    if(aboutBtn){
        aboutBtn.onclick=e=>{
            e.preventDefault();
            const modal=document.getElementById('aboutModal');
            const root=document.getElementById('aboutRoot');

            if(root&&root.innerHTML.trim()===''&&typeof renderNPTI==='function'){
                renderNPTI(root);
            }

            modal.style.display='flex';
            document.body.style.overflow='hidden';

            modal.onclick=ev=>{
                if(ev.target===modal||ev.target.classList.contains('close-btn')){
                    modal.style.display='none';
                    document.body.style.overflow='auto';
                }
            };
        };
    }
}

function toggleModal(id,show){
    const m=document.getElementById(id);
    if(!m) return;
    m.style.display=show?'flex':'none';
}

function updateNPTIButton(hasNPTI){
    const btn=document.querySelector('.btn-bubble');
    if(!btn) return;
    btn.innerText=hasNPTI?'나의 NPTI 뉴스':'나의 뉴스 성향 알아보기';
    btn.href=hasNPTI?'/view/html/curation.html':'/view/html/test.html';
}
