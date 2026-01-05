document.addEventListener('DOMContentLoaded', function () {

    /* =========================================
       [공통 기능] 요소 가져오기
       ========================================= */
    const idInput = document.getElementById('userid');
    const pwInput = document.getElementById('userpw');
    const pwCheckInput = document.getElementById('userpw-check');
    const nameInput = document.getElementById('username');
    const birthInput = document.getElementById('birth');
    const ageInput = document.getElementById('age'); // 나이 추가
    const emailInput = document.getElementById('email');

    const submitBtn = document.querySelector('.btn-submit');
    const signupForm = document.querySelector('.signup-form');

    // 버튼과 메시지 태그
    const checkIdBtn = document.querySelector('.btn-check');
    const idHelper = document.querySelector('.id-helper');
    const pwHelper = document.querySelector('.pw-helper');

    // 상태 변수 (중복확인 성공 여부)
    let isIdChecked = false;


    /* =========================================
       [기능 1] 회원가입 버튼 활성화 체크 (핵심 로직)
       ========================================= */
    function checkSignupValidity() {
        // 1. 모든 필수 입력칸이 비어있지 않은지 체크
        const isAllFilled =
            idInput.value.trim().length > 0 &&
            pwInput.value.trim().length > 0 &&
            pwCheckInput.value.trim().length > 0 &&
            nameInput.value.trim().length > 0 &&
            birthInput.value.trim().length > 0 &&
            ageInput.value.trim().length > 0 &&
            emailInput.value.trim().length > 0;

        // 2. 비밀번호 일치 여부 체크
        const isPwMatch = (pwInput.value === pwCheckInput.value) && pwInput.value.length > 0;

        // 3. 최종 판단: (모두 입력됨 AND 비번 일치 AND 아이디 중복확인 완료)
        if (isAllFilled && isPwMatch && isIdChecked) {
            submitBtn.disabled = false; // 버튼 활성화 (주황색)
        } else {
            submitBtn.disabled = true;  // 버튼 비활성화 (회색)
        }
    }


    /* =========================================
       [기능 2] 입력 감지 & X 버튼 관리
       ========================================= */
    const inputWrappers = document.querySelectorAll('.input-wrapper');

    inputWrappers.forEach(wrapper => {
        const input = wrapper.querySelector('input');
        const btnClear = wrapper.querySelector('.btn-clear');

        if (!input) return;

        const updateBtnVisibility = () => {
            if (!btnClear) return;
            if (input.value.length > 0) btnClear.classList.add('active');
            else btnClear.classList.remove('active');
        };

        // ★ 입력할 때마다 유효성 검사 실행
        input.addEventListener('input', function () {
            updateBtnVisibility();

            // 비밀번호 관련 칸이면 일치 여부 텍스트 갱신
            if (input === pwCheckInput || input === pwInput) {
                checkPwMatch();
            }

            // 전체 조건 다시 체크 (버튼 색상 변경)
            checkSignupValidity();
        });

        // X 버튼 클릭 시 초기화
        if (btnClear) {
            btnClear.addEventListener('click', function () {
                input.value = '';
                input.focus();
                updateBtnVisibility();

                // 아이디 지우면 인증 풀기
                if (input === idInput) {
                    isIdChecked = false;
                    if (idHelper) idHelper.style.display = 'none';
                }

                // 비밀번호 지우면 일치 메시지 숨기기
                if (input === pwCheckInput || input === pwInput) {
                    if (pwHelper) pwHelper.style.display = 'none';
                }

                checkSignupValidity();
            });
        }
    });


    /* =========================================
       [기능 3] 아이디 중복확인
       ========================================= */
    const TAKEN_IDS = ['admin'];

    if (checkIdBtn) {
        checkIdBtn.addEventListener('click', function () {
            const currentId = idInput.value.trim();

            if (currentId.length === 0) {
                showAlert('아이디를 입력해주세요.');
                return;
            }

            if (!idHelper) return;

            if (TAKEN_IDS.includes(currentId)) {
                // [사용 불가]
                idHelper.textContent = "이미 사용중인 아이디입니다.";
                idHelper.style.color = "var(--blue)";
                idHelper.style.display = "block";
                isIdChecked = false; // 인증 실패
            } else {
                // [사용 가능]
                idHelper.textContent = "사용가능한 아이디입니다.";
                idHelper.style.color = "var(--orange)";
                idHelper.style.display = "block";
                isIdChecked = true;  // 인증 성공!
            }
            checkSignupValidity(); // 버튼 상태 갱신
        });
    }

    // 아이디를 수정하면 인증 취소
    idInput.addEventListener('input', function () {
        isIdChecked = false;
        if (idHelper) idHelper.style.display = 'none';
        checkSignupValidity();
    });


    /* =========================================
       [기능 4] 비밀번호 일치 확인 텍스트
       ========================================= */
    function checkPwMatch() {
        if (!pwHelper) return;

        if (pwInput.value.length > 0 && pwCheckInput.value.length > 0) {
            if (pwInput.value === pwCheckInput.value) {
                pwHelper.textContent = '비밀번호가 일치합니다.';
                pwHelper.style.color = 'var(--orange)';
                pwHelper.style.display = 'block';
            } else {
                pwHelper.textContent = '비밀번호가 일치하지 않습니다.';
                pwHelper.style.color = 'var(--blue)';
                pwHelper.style.display = 'block';
            }
        } else {
            pwHelper.style.display = 'none';
        }
    }


    /* =========================================
       [기능 5] 팝업 (모달)
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
       [기능 6] 회원가입 제출
       ========================================= */
    if (signupForm) {
        signupForm.addEventListener('submit', function (e) {
            e.preventDefault();

            // 버튼이 비활성 상태면 실행 안 함 (이중 안전장치)
            if (submitBtn.disabled) return;

            showAlert('회원가입이 완료되었습니다!\n로그인 페이지로 이동합니다.', function () {
                window.location.href = '/view/html/login.html';
            });
        });
    }

    /* =========================================
       [기능 7] 나이 입력창 커스텀 화살표 기능
       ========================================= */
    const btnUp = document.querySelector('.btn-spin.up');
    const btnDown = document.querySelector('.btn-spin.down');

    if (ageInput && btnUp && btnDown) {
        btnUp.addEventListener('click', function () {
            ageInput.stepUp();
            // 값이 바뀌었음을 강제로 알려줘야 checkSignupValidity가 실행됨
            ageInput.dispatchEvent(new Event('input'));
        });

        btnDown.addEventListener('click', function () {
            ageInput.stepDown();
            ageInput.dispatchEvent(new Event('input'));
        });
    }
});