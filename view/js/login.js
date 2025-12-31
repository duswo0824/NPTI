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

    // ★ 가짜 DB 정보
    const DB_USER = { id: 'admin', pw: '1234' };

    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();

            // 만약 버튼이 비활성 상태라면 전송 막음 (이중 안전장치)
            if (submitBtn.disabled) return;

            const inputId = idInput.value;
            const inputPw = pwInput.value;

            if (inputId === DB_USER.id && inputPw === DB_USER.pw) {
                // 성공 시
                showAlert(`${inputId}님 환영합니다!`, function () {
                    window.location.href = '/main/main.html';
                });
            } else {
                // [실패 시] 파란 글씨 에러 메시지 표시
                errorMessage.classList.add('show');
                document.getElementById('userid').value = '';
                document.getElementById('userpw').value = '';
                document.getElementById('userid').focus();
                checkInputValidity(); // 비밀번호 지웠으니 버튼 다시 비활성화
            }
        });
    }
});