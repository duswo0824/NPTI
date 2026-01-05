document.addEventListener('DOMContentLoaded', function () {

    /* =========================================
       [공통] 요소 가져오기
       ========================================= */
    const idInput = document.getElementById('userid');
    const pwInput = document.getElementById('userpw');
    const pwCheckInput = document.getElementById('userpw-check');
    const nameInput = document.getElementById('username');
    const birthInput = document.getElementById('birth');
    const ageInput = document.getElementById('age');
    const emailInput = document.getElementById('email');

    const submitBtn = document.querySelector('.btn-submit');
    const signupForm = document.querySelector('.signup-form');

    const checkIdBtn = document.querySelector('.btn-check');
    const idHelper = document.querySelector('.id-helper');
    const pwHelper = document.querySelector('.pw-helper');
    const emailHelper = document.querySelector('.email-helper');

    let isIdChecked = false;

    /* =========================================
       [이메일 형식 검증 함수 (추가)
       ========================================= */
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /* =========================================
       [1] 회원가입 버튼 활성화 조건
       ========================================= */
    function checkSignupValidity() {
        const isAllFilled =
            idInput.value.trim() &&
            pwInput.value &&
            pwCheckInput.value &&
            nameInput.value.trim() &&
            birthInput.value &&
            ageInput.value &&
            emailInput.value.trim();

        const isPwMatch =
            pwInput.value &&
            pwInput.value === pwCheckInput.value;

        const isEmailValid =
            isValidEmail(emailInput.value.trim());

        submitBtn.disabled = !(isAllFilled && isPwMatch && isIdChecked && isEmailValid);
    }


    /* =========================================
       [2] 입력 감지 & X 버튼
       ========================================= */
    document.querySelectorAll('.input-wrapper').forEach(wrapper => {
        const input = wrapper.querySelector('input');
        const btnClear = wrapper.querySelector('.btn-clear');
        if (!input || !btnClear) return;

        input.addEventListener('input', () => {
            btnClear.classList.toggle('active', input.value.length > 0);

            if (input === pwInput || input === pwCheckInput) {
                checkPwMatch();
            }

            if (input === idInput) {
                isIdChecked = false;
                idHelper.style.display = 'none';
            }

            checkSignupValidity();
        });

        btnClear.addEventListener('click', () => {
            input.value = '';
            btnClear.classList.remove('active');

            if (input === idInput) {
                isIdChecked = false;
                idHelper.style.display = 'none';
            }

            if (input === pwInput || input === pwCheckInput) {
                pwHelper.style.display = 'none';
            }

            checkSignupValidity();
        });
    });


    /* =========================================
       [3] 아이디 중복확인 (서버 연동)
       ========================================= */
    checkIdBtn.addEventListener('click', async function () {
        const userId = idInput.value.trim();
        if (!userId) return showAlert('아이디를 입력해주세요.');

        try {
            const res = await fetch(`/users/check-id?user_id=${userId}`);
            const data = await res.json();

            if (data.exists) {
                idHelper.textContent = '이미 사용중인 아이디입니다.';
                idHelper.style.color = 'var(--blue)';
                isIdChecked = false;
            } else {
                idHelper.textContent = '사용 가능한 아이디입니다.';
                idHelper.style.color = 'var(--orange)';
                isIdChecked = true;
            }
            idHelper.style.display = 'block';
            checkSignupValidity();

        } catch (e) {
            showAlert('아이디 확인 중 오류가 발생했습니다.');
        }
    });


    /* =========================================
       [4] 비밀번호 일치 안내
       ========================================= */
    function checkPwMatch() {
        if (!pwInput.value || !pwCheckInput.value) {
            pwHelper.style.display = 'none';
            return;
        }

        if (pwInput.value === pwCheckInput.value) {
            pwHelper.textContent = '비밀번호가 일치합니다.';
            pwHelper.style.color = 'var(--orange)';
        } else {
            pwHelper.textContent = '비밀번호가 일치하지 않습니다.';
            pwHelper.style.color = 'var(--blue)';
        }
        pwHelper.style.display = 'block';
    }

     /* =========================================
       이메일 형식 실시간 안내 (추가)
       ========================================= */
    emailInput.addEventListener('input', () => {
        const email = emailInput.value.trim();

        if (!email) {
            emailHelper.style.display = 'none';
            return;
        }

        if (isValidEmail(email)) {
            emailHelper.textContent = '올바른 이메일 형식입니다.';
            emailHelper.style.color = 'var(--orange)';
        } else {
            emailHelper.textContent = '이메일 형식이 올바르지 않습니다.';
            emailHelper.style.color = 'var(--blue)';
        }
        emailHelper.style.display = 'block';

        checkSignupValidity();
    });

    /* =========================================
       [5] 커스텀 모달
       ========================================= */
    const modal = document.getElementById('custom-alert');
    const modalMsg = document.querySelector('.modal-message');
    const modalBtn = document.getElementById('modal-ok-btn');
    let onConfirm = null;

    function showAlert(message, callback) {
        modalMsg.textContent = message;
        modal.classList.add('show');
        onConfirm = callback;
    }

    modalBtn.addEventListener('click', () => {
        modal.classList.remove('show');
        if (onConfirm) onConfirm();
        onConfirm = null;
    });


    /* =========================================
       [6] 회원가입 제출 (핵심)
       ========================================= */
    signupForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (submitBtn.disabled) return;

        const genderValue =
            document.querySelector('input[name="gender"]:checked').value === 'female';

        const payload = {
            user_id: idInput.value.trim(),
            user_pw: pwInput.value,
            user_name: nameInput.value.trim(),
            user_birth: birthInput.value,
            user_age: Number(ageInput.value),
            user_gender: genderValue,
            user_email: emailInput.value.trim(),
            activation: true
        };

        try {
            const res = await fetch('/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const msg = await res.text();
                throw new Error(msg);
            }

            showAlert('회원가입이 완료되었습니다!\n로그인 페이지로 이동합니다.', () => {
                window.location.href = '/view/html/login.html';
            });

        } catch (err) {
            showAlert('회원가입 실패: ' + err.message);
        }
    });
});
