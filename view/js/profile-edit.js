document.addEventListener('DOMContentLoaded', () => {
    /* 1. 가상 DB 데이터 주입 및 요소 캐싱 */
    // const userData = {
    //     userId: "admin",
    //     name: "홍길동",
    //     birth: "1999-09-16",
    //     age: 28,
    //     gender: "male",
    //     email: "Honggildong@email.com"
    // };

    // FastAPI 서버 주소 (배포 환경에 따라 수정)
    const API_BASE_URL = "http://127.0.0.1:8000";
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


    // 유저 데이터 가져오기(세션)(GET)
    const loadUserData = async () => {
        const loggedInUserId = sessionStorage.getItem("user_id");
        //console.log("세션에서 가져온 id :", loggedInUserId);

        if (!loggedInUserId) {
            alert("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
            window.location.href = "/login";
            return;
        }
        try {
            // FastAPI 엔드포인트에 userId를 쿼리 파라미터나 경로로 전달
            const response = await fetch(`${API_BASE_URL}/users/profile?user_id=${loggedInUserId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const userData = await response.json();
                console.log("서버 응답 데이터:", userData);
                
                // 데이터 주입
                const handleEl = document.getElementById('displayHandle');
                if (handleEl) {
                    // 백엔드에서 userId로 주는지 user_id로 주는지 확인 필요
                    handleEl.innerText = `@${userData.userId || userData.user_id}`;
                }
                
                fields.username.value = userData.name || "";
                fields.birth.value = userData.birth || "";
                fields.age.value = userData.age || "";
                fields.email.value = userData.email || "";
                
                // 성별 라디오 버튼
                const genderRadios = document.getElementsByName('gender');
                genderRadios.forEach(radio => { 
                    if (radio.value === userData.gender) radio.checked = true; 
                }); 

                updateButtonState();
            } else {
                const error = await response.json();
                alert(`데이터 로드 실패: ${error.detail}`);
            }
        } catch (error) {
            console.error("FastAPI 통신 오류:", error);
        }
    };

    // 수정된 유저 데이터 저장(POST)
    const saveUserData = async () => {
        const loggedInUserId = sessionStorage.getItem("user_id");

        const updatedData = {
            user_id: loggedInUserId, // 수정할 대상을 식별하기 위해 세션 ID 포함
            user_name: fields.username.value,
            current_password: fields.currentPw.value,
            new_password: fields.newPw.value,
            user_birth: fields.birth.value,
            user_age: parseInt(fields.age.value,10),
            user_gender: document.querySelector('input[name="gender"]:checked').value,
            user_email: fields.email.value
        };
        console.log("서버로 보내는 데이터:", updatedData);

        fields.currentPw.addEventListener('change', async () => {
            const loggedInUserId = sessionStorage.getItem("user_id");
            const passwordToVerify = fields.currentPw.value;

            if (passwordToVerify.length === 0) return;

            try {
                const response = await fetch(`${API_BASE_URL}/users/verify-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: loggedInUserId,
                        current_password: passwordToVerify
                    })
                });

                const result = await response.json();

                if (result.success) {
                    currentMsg.innerText = "비밀번호 확인 완료";
                    currentMsg.className = "status-text success visible";
                    state.isPasswordVerified = true; // 검증 성공 상태 저장
                } else {
                    currentMsg.innerText = "현재 비밀번호와 일치하지 않습니다.";
                    currentMsg.className = "status-text error visible";
                    state.isPasswordVerified = false;
                }
                updateButtonState(); // 버튼 활성화 상태 다시 계산
            } catch (error) {
                console.error("비밀번호 검증 오류:", error);
        }
    });

    // // 데이터 초기 주입
    // const initProfileData = (data) => {
    //     const handleEl = document.getElementById('displayHandle');
    //     if (handleEl) handleEl.innerText = `@${data.userId}`;
    //     fields.username.value = data.name;
    //     fields.birth.value = data.birth;
    //     fields.age.value = data.age;
    //     fields.email.value = data.email;
    //     const genderRadios = document.getElementsByName('gender');
    //     genderRadios.forEach(radio => { if (radio.value === data.gender) radio.checked = true; });
    // };

    // initProfileData(userData);

    /* 2. [핵심] 모든 필드 검사 및 버튼 활성화 함수 */
    const updateButtonState = () => {
        // 1. 모든 인풋 값이 비어있지 않은지 확인 (trim으로 공백 제거)
        const allFieldsFilled = Object.values(fields).every(el => el.value.trim() !== "");

        // 2. 성별 라디오 버튼이 선택되었는지 확인
        const genderSelected = document.querySelector('input[name="gender"]:checked') !== null;

        // 3. 비밀번호 상세 조건 확인
        const isCurrentPwInput = fields.currentPw.value.length > 0;
        const isNewPwMatch = fields.newPw.value === fields.newPwCheck.value;
        const isNewPwNotSame = fields.newPw.value !== fields.currentPw.value;

        // 모든 필수 조건 결합
        const canSubmit = allFieldsFilled && genderSelected && isCurrentPwInput && isNewPwMatch && isNewPwNotSame;

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

    /* 4. 비밀번호 전용 유효성 메시지 로직*/
    fields.currentPw.addEventListener('input', () => {
        if (fields.currentPw.value.length === 0) {
            currentMsg.innerText = "비밀번호가 틀렸습니다.";
            currentMsg.className = "status-text error visible";
            currentMsg.classList.remove('visible');
        } else if (fields.currentPw.value.length > 0) {
            currentMsg.innerText = "현재 비밀번호를 확인합니다.";
            currentMsg.className = "status-text success visible";
        }
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

    fields.newPw.addEventListener('input', validateMatch);
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

    /* 모달 제어 로직 */
    // 1. 완료 버튼(submit) 클릭 시 팝업 띄우기
    editForm.addEventListener('submit', (e) => {
        e.preventDefault(); // 페이지 이동을 일단 막음
        //editModal.classList.add('show'); // 팝업 노출
        saveUserData();
    });

    // 2. 팝업 내 '확인' 클릭 시 마이페이지로 이동
    confirmEdit.addEventListener('click', () => {
        editModal.classList.remove('show');
        window.location.href = "/mypage"; // 실제 이동 경로
    });

    // 3. 팝업 내 '취소' 클릭 시 팝업 닫기
    closeEdit.addEventListener('click', () => {
        editModal.classList.remove('show');
    });

    // 페이지 로드 시 실행
    loadUserData();
    
});