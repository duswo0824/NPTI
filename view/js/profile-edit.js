document.addEventListener('DOMContentLoaded', () => {
    /* 1. 가상 DB 데이터 주입 및 요소 캐싱 */
    const userData = {
        userId: "admin",
        name: "홍길동",
        birth: "1999-09-16",
        age: 28,
        gender: "male",
        email: "Honggildong@email.com"
    };

    const btnSave = document.querySelector('.btn-save');

    btnSave.disabled = true;

    // 필수 입력 요소들 캐싱
    const fields = {
        username: document.getElementById('username'),
        currentPw: document.getElementById('current-pw'),
        newPw: document.getElementById('new-pw'),
        newPwCheck: document.getElementById('new-pw-check'),
        birth: document.getElementById('birth'),
        age: document.getElementById('age'),
        email: document.getElementById('email')
    };

    const currentMsg = document.getElementById('current-pw-msg');
    const newMsg = document.getElementById('new-pw-msg');
    const checkMsg = document.getElementById('new-pw-check-msg');
    const editForm = document.querySelector('.edit-form');
    const editModal = document.getElementById('editModal');
    const confirmEdit = document.getElementById('confirmEdit');
    const closeEdit = document.getElementById('closeEdit')

    // 데이터 초기 주입
    const initProfileData = (data) => {
        const handleEl = document.getElementById('displayHandle');
        if (handleEl) handleEl.innerText = `@${data.userId}`;
        fields.username.value = data.name;
        fields.birth.value = data.birth;
        fields.age.value = data.age;
        fields.email.value = data.email;
        const genderRadios = document.getElementsByName('gender');
        genderRadios.forEach(radio => { if (radio.value === data.gender) radio.checked = true; });
    };

    initProfileData(userData);

    /* 2. [핵심] 모든 필드 검사 및 버튼 활성화 함수 */
    const updateButtonState = () => {
        // 1. 모든 인풋 값이 비어있지 않은지 확인 (trim으로 공백 제거)
        const allFieldsFilled = Object.values(fields).every(el => el.value.trim() !== "");

        // 2. 성별 라디오 버튼이 선택되었는지 확인
        const genderSelected = document.querySelector('input[name="gender"]:checked') !== null;

        // 3. 비밀번호 상세 조건 확인
        const isCurrentPwCorrect = fields.currentPw.value === "1234"; // 가상 비번
        const isNewPwMatch = fields.newPw.value === fields.newPwCheck.value;
        const isNewPwNotOld = fields.newPw.value !== "1234"; // 기존 비번과 달라야 함

        // 모든 필수 조건 결합
        const canSubmit = allFieldsFilled && genderSelected &&
            isCurrentPwCorrect && isNewPwMatch && isNewPwNotOld;

        btnSave.disabled = !canSubmit;
    };

    /* 3. 각 입력창에 이벤트 리스너 등록 (실시간 체크) */

    // 모든 일반 인풋/날짜/숫자 요소에 input 이벤트 추가
    Object.values(fields).forEach(field => {
        field.addEventListener('input', () => {
            updateButtonState();
        });
    });

    // 성별 라디오 버튼에 change 이벤트 추가
    document.getElementsByName('gender').forEach(radio => {
        radio.addEventListener('change', updateButtonState);
    });

    /* 4. 비밀번호 전용 유효성 메시지 로직 (기존 유지) */
    fields.currentPw.addEventListener('input', () => {
        if (fields.currentPw.value === "1234") {
            currentMsg.innerText = "비밀번호가 일치합니다.";
            currentMsg.className = "status-text success visible";
        } else if (fields.currentPw.value.length > 0) {
            currentMsg.innerText = "비밀번호가 틀렸습니다.";
            currentMsg.className = "status-text error visible";
        } else {
            currentMsg.classList.remove('visible');
        }
    });

    fields.newPw.addEventListener('input', () => {
        if (fields.newPw.value === "1234") {
            newMsg.innerText = "이미 사용중인 비밀번호 입니다.";
            newMsg.className = "status-text error visible";
        } else {
            newMsg.classList.remove('visible');
        }
        validateMatch();
    });

    const validateMatch = () => {
        if (fields.newPw.value && fields.newPwCheck.value) {
            checkMsg.classList.add('visible');
            if (fields.newPw.value === fields.newPwCheck.value) {
                checkMsg.innerText = "비밀번호가 일치합니다.";
                checkMsg.className = "status-text success visible";
            } else {
                checkMsg.innerText = "비밀번호가 일치하지 않습니다.";
                checkMsg.className = "status-text error visible";
            }
        } else {
            checkMsg.classList.remove('visible');
        }
    };

    fields.newPwCheck.addEventListener('input', validateMatch);

    /* 5. X 버튼 (Clear) 클릭 시에도 버튼 상태 갱신 */
    document.querySelectorAll('.btn-clear').forEach(btn => {
        btn.addEventListener('click', function () {
            const inputEl = this.previousElementSibling;
            if (inputEl) {
                inputEl.value = '';
                const msgEl = this.closest('.form-group').querySelector('.status-text');
                if (msgEl) msgEl.classList.remove('visible');
                updateButtonState();
            }
        });
    });

    // 초기실행
    updateButtonState();

    /* 모달 제어 로직 */
    // 1. 완료 버튼(submit) 클릭 시 팝업 띄우기
    editForm.addEventListener('submit', (e) => {
        e.preventDefault(); // 페이지 이동을 일단 막음
        editModal.classList.add('show'); // 팝업 노출
    });

    // 2. 팝업 내 '확인' 클릭 시 마이페이지로 이동
    confirmEdit.addEventListener('click', () => {
        editModal.classList.remove('show');
        window.location.href = "/view/html/mypage.html"; // 실제 이동 경로
    });

    // 3. 팝업 내 '취소' 클릭 시 팝업 닫기
    closeEdit.addEventListener('click', () => {
        editModal.classList.remove('show');
    });
    
});