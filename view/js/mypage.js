document.addEventListener('DOMContentLoaded', () => {
    /* 1. 데이터 바인딩 (생략 가능하므로 로직만 확인) */
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

    /* 2. 요소 캐싱 - 여기서 변수들을 els 안에 담았습니다 */
    const els = {
        btnDots: document.querySelector('.btn-dots'),
        dotsMenu: document.getElementById('dotsMenu'),
        btnShowWithdraw: document.getElementById('btnShowWithdraw'),
        withdrawModal: document.getElementById('withdrawModal'),
        closeWithdraw: document.getElementById('closeWithdraw'),
        confirmWithdraw: document.getElementById('confirmWithdraw')
    };

    /* 3. 모달 제어 함수 */
    const toggleWithdrawModal = (show) => {
        if (!els.withdrawModal) return;
        if (show) {
            els.withdrawModal.classList.add('show'); // CSS의 .active 클래스 활용
        } else {
            els.withdrawModal.classList.remove('show');
        }
        if (show && els.dotsMenu) els.dotsMenu.classList.remove('show');
    };

    /* 4. 이벤트 리스너  */

    // 점점점 버튼
    if (els.btnDots && els.dotsMenu) {
        els.btnDots.onclick = (e) => {
            e.stopPropagation();
            els.dotsMenu.classList.toggle('show');
        };
    }

    // 회원탈퇴 클릭 시 (반드시 els. 를 붙여야 함)
    if (els.btnShowWithdraw && els.withdrawModal) {
        els.btnShowWithdraw.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("클릭됨! 이제 팝업이 뜹니다."); // 확인용 로그
            toggleWithdrawModal(true);
        };
    }

    // 취소 버튼 (els. 추가)
    if (els.closeWithdraw) {
        els.closeWithdraw.onclick = () => toggleWithdrawModal(false);
    }

    // 탈퇴 실행 (els. 추가)
    if (els.confirmWithdraw) {
        els.confirmWithdraw.onclick = () => {
            localStorage.clear();
            location.href = "/view/html/main.html";
        };
    }

    // 외부 클릭 시 닫기
    document.addEventListener('click', () => {
        if (els.dotsMenu) els.dotsMenu.classList.remove('show');
    });
});