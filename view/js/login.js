//커밋 가능
document.addEventListener('DOMContentLoaded', function () {

    // 요소들 가져오기
    const idInput = document.getElementById('userid');
    const pwInput = document.getElementById('userpw');
    const submitBtn = document.querySelector('.btn-submit');
    const loginForm = document.querySelector('.login-form');
    const errorMessage = document.querySelector('.error-message');

    /* =========================================
       [기능 1] 버튼 활성화/비활성화 체크 함수
       ========================================= */
    function checkInputValidity() {
        // 아이디와 비밀번호가 둘 다 1글자 이상이면
        if (idInput.value.length > 0 && pwInput.value.length > 0) {
            submitBtn.disabled = false; // 버튼 활성화 (주황색 됨)
        } else {
            submitBtn.disabled = true;  // 버튼 비활성화 (회색 됨)
        }
    }

    /* =========================================
       [기능 2] 인풋 창 X 버튼 & 입력 감지
       ========================================= */
    const inputWrappers = document.querySelectorAll('.input-wrapper');

    inputWrappers.forEach(wrapper => {
        const input = wrapper.querySelector('input');
        const btnClear = wrapper.querySelector('.btn-clear');

        if (!input || !btnClear) return;

        const updateBtnVisibility = () => {
            if (input.value.length > 0) btnClear.classList.add('active');
            else btnClear.classList.remove('active');
        };

        // ★ 글자를 칠 때마다 실행되는 것들
        input.addEventListener('input', function () {
            updateBtnVisibility();       // 1. X 버튼 보여줄까 말까?
            checkInputValidity();        // 2. 로그인 버튼 켜줄까 말까? (추가된 기능)
            if (errorMessage) errorMessage.classList.remove('show'); // 3. 에러 메시지 숨기기
        });

        // X 버튼 클릭 시 초기화
        btnClear.addEventListener('click', function () {
            input.value = '';
            input.focus();
            updateBtnVisibility();
            checkInputValidity(); // ★ 지웠으니까 로그인 버튼도 다시 꺼야 함!
        });
    });


    /* =========================================
       [기능 3] 커스텀 팝업 및 로그인 검사
       ========================================= */
    const modal = document.getElementById('custom-alert');
    const modalMsg = document.querySelector('.modal-message');
    const modalBtn = document.getElementById('modal-ok-btn');
    let onConfirm = null;

    function showAlert(message, callback) {
        if (!modal) return;
        modalMsg.textContent = message;
        modal.classList.add('show');
        onConfirm = callback;
    }

    if (modalBtn) {
        modalBtn.addEventListener('click', function () {
            modal.classList.remove('show');
            if (onConfirm) {
                onConfirm();
                onConfirm = null;
            }
        });
    }

   /* =========================================
   [기능 4] 로그인 요청 (최종 정리본)
   ========================================= */
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (submitBtn.disabled) return;

        try {
            const res = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: idInput.value,
                    user_pw: pwInput.value
                })
            });

            const data = await res.json();

            // 로그인 실패
            if (!data.success) {
                errorMessage.classList.add('show');
                idInput.value = '';
                pwInput.value = '';
                idInput.focus();
                checkInputValidity();
                return;
            }

            // 로그인 성공
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('user_id', idInput.value);

            showAlert(`${idInput.value}님 환영합니다!`, () => {
                window.location.href = '/view/html/main.html';
            });

        } catch (err) {
            showAlert('서버와 통신 중 오류가 발생했습니다.');
        }
    });
    checkInputValidity();
});