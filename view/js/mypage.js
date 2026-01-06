document.addEventListener('DOMContentLoaded', () => {
    /* 1. 기본 유저 정보 바인딩 (상단 프로필) */
    const userData = { userId: "admin", name: "홍길동", email: "honggildong@gmail.com", birth: "1999-09-16", age: "28", gender: "남자" };
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) (el.tagName === 'INPUT' ? el.value = val : el.innerText = val);
    };
    setVal('displayId', `@${userData.userId}`);
    setVal('dbName', userData.name);
    setVal('dbEmail', userData.email);
    setVal('dbBirth', userData.birth);
    setVal('dbAge', userData.age);
    setVal('dbGender', userData.gender);

    /* 2. 요소 캐싱 (els 객체로 통합 관리) */
    const els = {
        btnDots: document.querySelector('.btn-dots'),
        dotsMenu: document.getElementById('dotsMenu'),
        btnShowWithdraw: document.getElementById('btnShowWithdraw'),
        withdrawModal: document.getElementById('withdrawModal'),
        closeWithdraw: document.getElementById('closeWithdraw'),
        confirmWithdraw: document.getElementById('confirmWithdraw'),
        updateBtn: document.getElementById('goCurationBtn'),
        updateTooltip: document.getElementById('nptiUpdateTooltip'),
        resultSummary: document.getElementById('resultSummary')
    };

    /* 3. 모달 제어 함수 */
    const toggleWithdrawModal = (show) => {
        if (!els.withdrawModal) return;
        show ? els.withdrawModal.classList.add('show') : els.withdrawModal.classList.remove('show');
        if (show && els.dotsMenu) els.dotsMenu.classList.remove('show');
    };

    /* 4. 차트 렌더링 함수 (애니메이션 3초 설정) */
    const renderChart = (id, scoreLeft, scoreRight, charLeft, charRight, trackId) => {
        const bar = document.getElementById(id);
        const track = document.getElementById(trackId);
        const sLeft = document.getElementById(`score-${charLeft}`);
        const sRight = document.getElementById(`score-${charRight}`);
        const cLeft = document.getElementById(`char-${charLeft}`);
        const cRight = document.getElementById(`char-${charRight}`);

        if (!bar || !track) return;

        // 수치 및 강조 색상 즉시 적용
        sLeft.innerText = scoreLeft + '%';
        sRight.innerText = scoreRight + '%';

        [cLeft, cRight].forEach(el => el.classList.remove('char-highlight'));
        if (scoreLeft >= scoreRight) {
            track.style.justifyContent = 'flex-start';
            cLeft.classList.add('char-highlight');
            sLeft.style.color = 'var(--orange)';
            sRight.style.color = '';
        } else {
            track.style.justifyContent = 'flex-end';
            cRight.classList.add('char-highlight');
            sRight.style.color = 'var(--orange)';
            sLeft.style.color = '';
        }

        // 바 애니메이션 실행 (3초 설정)
        bar.style.transition = 'none';
        bar.style.width = '0%';
        setTimeout(() => {
            bar.style.transition = 'width 3s cubic-bezier(0.1, 0.5, 0.5, 1)'; // 3초 애니메이션
            bar.style.width = (scoreLeft >= scoreRight ? scoreLeft : scoreRight) + '%';
            bar.className = (scoreLeft >= scoreRight ? 'progress-bar orange-bar' : 'progress-bar orange-bar-right');
        }, 50);
    };

    /* 5. NPTI 가상 데이터 및 초기 렌더링 */
    const nptiResult = {
        hasData: true, // true: 진단했다고 가정, false: npti 내용 사라짐
        userName: "홍길동",
        code: "STFN",
        typeName: "팩트 현실주의자형",
        summary: "짧은 스트레이트 기사로<br>현실의 불편한 진실을 확인하려는 독자<br><strong>팩트 위주의 간결한 기사 선호</strong>",
        scores: { S: 65, L: 35, C: 28, T: 72, F: 75, I: 25, P: 18, N: 82 }
    };

    if (nptiResult.hasData) {
        const resultSection = document.getElementById('nptiResultSection');
        if (resultSection) resultSection.style.display = 'block';

        document.getElementById('resUserName').innerText = nptiResult.userName;
        document.getElementById('nptiCode').innerText = nptiResult.code;
        document.getElementById('nptiName').innerText = `"${nptiResult.typeName}"`;
        document.getElementById('resultSummary').innerHTML = nptiResult.summary;

        renderChart('barLength', nptiResult.scores.S, nptiResult.scores.L, 'S', 'L', 'track-Length');
        renderChart('barArticle', nptiResult.scores.C, nptiResult.scores.T, 'C', 'T', 'track-Article');
        renderChart('barInfo', nptiResult.scores.F, nptiResult.scores.I, 'F', 'I', 'track-Info');
        renderChart('barView', nptiResult.scores.P, nptiResult.scores.N, 'P', 'N', 'track-View');
    }

    /* 6. NPTI 업데이트 버튼 잠금 로직 */

    // 버튼 비활성화 시각화 함수
    const disableUpdateBtn = () => {
        if (!els.updateBtn) return;
        els.updateBtn.disabled = true;
        els.updateBtn.innerText = "업데이트 완료 (24시간 후 가능)";
        els.updateBtn.style.backgroundColor = "#ccc";
        els.updateBtn.style.borderColor = "#ccc";
        els.updateBtn.style.cursor = "not-allowed";
    };

    // 시간 체크 함수
    const checkAvailability = () => {
        const lastUpdate = localStorage.getItem('lastNptiUpdate');
        if (lastUpdate) {
            const now = new Date().getTime();
            const timeDiff = now - lastUpdate;

            // [임시 3초 제한] 3000ms
            if (timeDiff < 3000) {
                disableUpdateBtn();
            }
            /* // [실제 24시간 제한용 코드]
            const hoursPassed = timeDiff / (1000 * 60 * 60);
            if (hoursPassed < 24) {
                disableUpdateBtn();
            }
            */
        }
    };

    /* 7. 이벤트 리스너 등록 */
    checkAvailability();

    // NPTI 업데이트 버튼 Hover
    if (els.updateBtn && els.updateTooltip) {
        els.updateBtn.addEventListener('mouseenter', () => {
            if (!els.updateBtn.disabled) els.updateTooltip.style.display = 'block';
        });
        els.updateBtn.addEventListener('mouseleave', () => {
            els.updateTooltip.style.display = 'none';
        });
    }

    // NPTI 업데이트 클릭
    if (els.updateBtn) {
        els.updateBtn.onclick = () => {
            if (els.updateBtn.disabled) return;

            // 새 점수 생성 및 3초 애니메이션 재렌더링
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

            // 알림 메시지 (signup 스타일로 화면에 삽입)
            if (els.resultSummary) {
                const successMsg = document.createElement('p');
                successMsg.style.color = 'var(--orange)';
                successMsg.style.fontWeight = '800';
                successMsg.style.marginTop = '15px';
                successMsg.innerHTML = "✨ 최근 유저 행동 데이터를 기반으로 NPTI가 업데이트되었습니다!";
                els.resultSummary.appendChild(successMsg);
                setTimeout(() => successMsg.remove(), 3000);
            }

            // 현재 시간 저장 및 버튼 잠금
            localStorage.setItem('lastNptiUpdate', new Date().getTime());
            disableUpdateBtn();
            if (els.updateTooltip) els.updateTooltip.style.display = 'none';
        };
    }

    // 기타 (메뉴, 회원탈퇴 모달) 리스너
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

    if (els.confirmWithdraw) {
        els.confirmWithdraw.onclick = () => {
            localStorage.clear();
            location.href = "/view/html/main.html";
        };
    }

    document.addEventListener('click', () => {
        if (els.dotsMenu) els.dotsMenu.classList.remove('show');
    });
});