document.addEventListener('DOMContentLoaded', async () => {

    /* =================================================================
       1. [서버 연동] 실제 유저 정보 및 NPTI 데이터 가져오기
    ================================================================= */
    let userData = null;
    let nptiData = null;

    try {
        // 병렬로 API 호출 (프로필 + NPTI 결과)
        const [profileRes, nptiRes] = await Promise.all([
            fetch('/users/me/profile'),
            fetch('/users/me/npti')
        ]);

        // 1-1. 비로그인 접근 차단 (보안)
        if (profileRes.status === 401) {
            // alert("로그인이 필요한 서비스입니다."); #팝업이 뜨고 로그인으로 보낼지 그냥 알림없이 바로 보낼지
            window.location.replace("/login");
            return;
        }

        // 1-2. 데이터 파싱
        if (profileRes.ok) {
            userData = await profileRes.json();
        }

        const nptiResponse = await nptiRes.json();
        if (nptiResponse.hasResult) {
            nptiData = nptiResponse.data;
        }

    } catch (error) {
        console.error("데이터 로드 중 오류 발생:", error);
    }

    /* =================================================================
       2. 요소 캐싱 (기존 UI 기능 유지를 위해 필수)
    ================================================================= */
    const els = {
        // 프로필 영역
        displayId: document.getElementById('displayId'),
        dbName: document.getElementById('dbName'),
        dbEmail: document.getElementById('dbEmail'),
        dbBirth: document.getElementById('dbBirth'),
        dbAge: document.getElementById('dbAge'),
        dbGender: document.getElementById('dbGender'),

        // NPTI 결과 영역
        nptiResultSection: document.getElementById('nptiResultSection'),
        resUserName: document.getElementById('resUserName'),
        nptiCode: document.getElementById('nptiCode'),
        nptiName: document.getElementById('nptiName'),
        resultSummary: document.getElementById('resultSummary'),

        // UI 컨트롤 (버튼, 모달, 툴팁)
        btnDots: document.querySelector('.btn-dots'),
        dotsMenu: document.getElementById('dotsMenu'),
        btnShowWithdraw: document.getElementById('btnShowWithdraw'),
        withdrawModal: document.getElementById('withdrawModal'),
        closeWithdraw: document.getElementById('closeWithdraw'),
        confirmWithdraw: document.getElementById('confirmWithdraw'),
        updateBtn: document.getElementById('goCurationBtn'),
        updateTooltip: document.getElementById('nptiUpdateTooltip')
    };

    /* =================================================================
       3. 데이터 바인딩 (서버 데이터 -> 화면 표시)
    ================================================================= */

    // 헬퍼 함수: input은 value, 그 외는 innerText
    const setVal = (el, val) => {
        if (el) (el.tagName === 'INPUT' ? el.value = val : el.innerText = val);
    };

    // 3-1. 유저 프로필 바인딩
    if (userData) {
        setVal(els.displayId, `@${userData.userId}`);
        setVal(els.dbName, userData.name);
        setVal(els.dbEmail, userData.email);
        setVal(els.dbBirth, userData.birth);
        setVal(els.dbAge, userData.age);
        setVal(els.dbGender, userData.gender);
    }

    // 3-2. NPTI 결과 바인딩 (조건부 렌더링)
    if (nptiData) {
        // 결과가 있으면 섹션 보이기
        if (els.nptiResultSection) els.nptiResultSection.style.display = 'block';

        if (els.resUserName) els.resUserName.innerText = userData.name;
        if (els.nptiCode) els.nptiCode.innerText = nptiData.npti_code; // DB 컬럼명 확인
        if (els.nptiName) els.nptiName.innerText = `"${nptiData.type_nick || '분석된 유형'}"`;
        if (els.resultSummary) els.resultSummary.innerHTML = nptiData.type_de || '';

        // 차트 렌더링 (DB 점수 활용)
        // DB에는 한쪽 점수만 있으므로 반대쪽은 100에서 뺌
        renderChart('barLength', nptiData.length_score, 100 - nptiData.length_score, 'S', 'L', 'track-Length');
        renderChart('barArticle', nptiData.article_score, 100 - nptiData.article_score, 'C', 'T', 'track-Article');
        renderChart('barInfo', nptiData.info_score, 100 - nptiData.info_score, 'F', 'I', 'track-Info');
        renderChart('barView', nptiData.view_score, 100 - nptiData.view_score, 'P', 'N', 'track-View');

    } else {
        // 결과가 없으면 섹션 숨기기
        if (els.nptiResultSection) els.nptiResultSection.style.display = 'none';

        // 업데이트 버튼을 '진단하러 가기'로 변경 (UX 개선)
        if(els.updateBtn) {
            els.updateBtn.innerText = "NPTI 진단 시작하기";
            els.updateBtn.onclick = () => location.href = "/view/html/test.html";
            // 툴팁 제거
            if(els.updateTooltip) els.updateTooltip.remove();
        }
    }

    /* =================================================================
       4. [기능 유지] 차트 렌더링 및 애니메이션 함수
    ================================================================= */
    function renderChart(id, scoreLeft, scoreRight, charLeft, charRight, trackId) {
        const bar = document.getElementById(id);
        const track = document.getElementById(trackId);
        const sLeft = document.getElementById(`score-${charLeft}`);
        const sRight = document.getElementById(`score-${charRight}`);
        const cLeft = document.getElementById(`char-${charLeft}`);
        const cRight = document.getElementById(`char-${charRight}`);

        if (!bar || !track) return;

        // 텍스트 설정
        if(sLeft) sLeft.innerText = scoreLeft + '%';
        if(sRight) sRight.innerText = scoreRight + '%';

        [cLeft, cRight].forEach(el => el?.classList.remove('char-highlight'));

        const isLeftHigher = scoreLeft >= scoreRight;

        // 색상 및 위치 설정
        if (isLeftHigher) {
            track.style.justifyContent = 'flex-start';
            cLeft?.classList.add('char-highlight');
            if(sLeft) sLeft.style.color = 'var(--orange)';
            if(sRight) sRight.style.color = '';
        } else {
            track.style.justifyContent = 'flex-end';
            cRight?.classList.add('char-highlight');
            if(sRight) sRight.style.color = 'var(--orange)';
            if(sLeft) sLeft.style.color = '';
        }

        // 3초 애니메이션 실행
        bar.style.transition = 'none';
        bar.style.width = '0%';
        setTimeout(() => {
            bar.style.transition = 'width 3s cubic-bezier(0.1, 0.5, 0.5, 1)';
            bar.style.width = (isLeftHigher ? scoreLeft : scoreRight) + '%';
            bar.className = (isLeftHigher ? 'progress-bar orange-bar' : 'progress-bar orange-bar-right');
        }, 50);
    }

    /* =================================================================
       5. [기능 유지] NPTI 업데이트 버튼 잠금 로직 (여기 건들지 않음!)
    ================================================================= */
    // 진단 데이터가 있을 때만 작동하도록 조건 추가
    if (nptiData) {
        const disableUpdateBtn = () => {
            if (!els.updateBtn) return;
            els.updateBtn.disabled = true;
            els.updateBtn.innerText = "업데이트 완료 (24시간 후 가능)";
            els.updateBtn.style.backgroundColor = "#ccc";
            els.updateBtn.style.borderColor = "#ccc";
            els.updateBtn.style.cursor = "not-allowed";
        };

        const checkAvailability = () => {
            const lastUpdate = localStorage.getItem('lastNptiUpdate');
            if (lastUpdate) {
                const now = new Date().getTime();
                const timeDiff = now - lastUpdate;
                // [테스트용 3초 제한] - 배포 시 24시간 로직으로 변경 필요
                if (timeDiff < 3000) {
                    disableUpdateBtn();
                }
            }
        };

        checkAvailability();

        // 툴팁 이벤트
        if (els.updateBtn && els.updateTooltip) {
            els.updateBtn.addEventListener('mouseenter', () => {
                if (!els.updateBtn.disabled) els.updateTooltip.style.display = 'block';
            });
            els.updateBtn.addEventListener('mouseleave', () => {
                els.updateTooltip.style.display = 'none';
            });
        }

        // 버튼 클릭 이벤트 (기존 시뮬레이션 유지 - 건들지 않음!)
        if (els.updateBtn) {
            els.updateBtn.onclick = () => {
                if (els.updateBtn.disabled) return;

                // 1. 랜덤 점수 생성 (시각적 효과 유지)
                const newScores = {
                    S: Math.floor(Math.random() * 31) + 50,
                    T: Math.floor(Math.random() * 31) + 50,
                    F: Math.floor(Math.random() * 31) + 50,
                    N: Math.floor(Math.random() * 31) + 50
                };
                newScores.L = 100 - newScores.S;
                newScores.C = 100 - newScores.T;
                newScores.I = 100 - newScores.F;
                newScores.P = 100 - newScores.N;

                renderChart('barLength', newScores.S, newScores.L, 'S', 'L', 'track-Length');
                renderChart('barArticle', newScores.C, newScores.T, 'C', 'T', 'track-Article');
                renderChart('barInfo', newScores.F, newScores.I, 'F', 'I', 'track-Info');
                renderChart('barView', newScores.P, newScores.N, 'P', 'N', 'track-View');

                // 2. 알림 메시지 (signup 스타일로 화면에 삽입)
                if (els.resultSummary) {
                    const successMsg = document.createElement('p');
                    successMsg.style.color = 'var(--orange)';
                    successMsg.style.fontWeight = '800';
                    successMsg.style.marginTop = '15px';
                    successMsg.innerHTML = "✨ 최근 유저 행동 데이터를 기반으로 NPTI가 업데이트되었습니다! (시뮬레이션)";
                    els.resultSummary.appendChild(successMsg);
                    setTimeout(() => successMsg.remove(), 3000);
                }

                // 3. 현재 시간 저장 및 버튼 잠금
                localStorage.setItem('lastNptiUpdate', new Date().getTime());
                disableUpdateBtn();
                if (els.updateTooltip) els.updateTooltip.style.display = 'none';
            };
        }
    }

    /* =================================================================
       6. [기능 유지] 모달 제어 및 로그아웃
    ================================================================= */
    const toggleWithdrawModal = (show) => {
        if (!els.withdrawModal) return;
        show ? els.withdrawModal.classList.add('show') : els.withdrawModal.classList.remove('show');
        if (show && els.dotsMenu) els.dotsMenu.classList.remove('show');
    };

    if (els.btnDots) {
        els.btnDots.onclick = (e) => {
            e.stopPropagation();
            els.dotsMenu.classList.toggle('show');
        };
    }

    if (els.btnShowWithdraw) {
        els.btnShowWithdraw.onclick = (e) => {
            e.preventDefault();
            toggleWithdrawModal(true);
        };
    }

    if (els.closeWithdraw) els.closeWithdraw.onclick = () => toggleWithdrawModal(false);

    // [서버 연동] 회원 탈퇴(로그아웃) 처리
    if (els.confirmWithdraw) {
        els.confirmWithdraw.onclick = async () => {
            try {
                // 단순 로컬스토리지 삭제가 아니라 서버에 로그아웃 요청
                await fetch('/logout', { method: 'POST' });

                alert("로그아웃 되었습니다.");
                window.location.href = "/view/html/main.html";
            } catch (e) {
                console.error("로그아웃 실패", e);
                window.location.href = "/view/html/main.html";
            }
        };
    }

    // 외부 클릭 시 메뉴 닫기
    document.addEventListener('click', () => {
        if (els.dotsMenu) els.dotsMenu.classList.remove('show');
    });
});