//input_type db와 동일하게 수정
document.addEventListener('DOMContentLoaded', function () {
    const questionList = document.getElementById('questionList');
    const nptiForm = document.getElementById('nptiForm');

    // 12개 질문 데이터 (예시) - 삭제
    /*const questions = [
        "짧고 핵심만 정리된 기사가 더 편하게 느껴진다.",
        "객관적 사실과 데이터를 중심으로 정리된 기사를 더 신뢰한다.",
        "사건·사실만 나열된 기사는 지루하게 느껴진다.",
        "흥미 있는 내용이라도 스크롤이 길면 끝까지 읽기 힘들다.",
        "인물의 경험이나 감정, 상황 묘사가 담긴 기사가 더 흥미롭다.",
        "긍정적인 성과 중심 기사는 현실을 과장한다고 느낄 때가 많다.",
        "분석이나 해설이 길어지면 오히려 이해하기 어려워 부담스럽다.",
        "스토리처럼 전개되며 흐름이 살아 있는 기사에서 더 집중하게 된다.",
        "\"어떻게 개선할 수 있는가\"보다 \"누가 잘못했는가\"를 다루는 기사가 더 흥미롭다.",
        "어떤 일이 일어났는지만 간단히 정리해 준 기사면 충분하다고 생각한다.",
        "기업이나 정부를 칭찬하는 기사보다 비판하는 기사에 더 끌린다.",
        "한 문단 안에 결론이 나오는 기사를 더 선호한다."
    ];*/

    // 1. 셔플(Shuffle) 함수 추가
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            // 무작위 인덱스 생성
            const j = Math.floor(Math.random() * (i + 1));
            // 요소 위치 맞바꾸기 (Destructuring assignment)
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // 질문 리스트 섞기
    /*const shuffledQuestions = shuffleArray([...questions])*/

    // 2. 질문 생성 (섞인 리스트로 순회)
    /*shuffledQuestions.forEach((q, index) => {
        const qHtml = `
            <div class="q-card">
                <p class="q-title">Q${index + 1}. ${q}</p>
                <div class="options-group">
                    <span class="option-label">매우 그렇지 않다</span>
                    ${[1, 2, 3, 4, 5].map(num => `
                        <div class="option-item">
                            <input type="radio" name="q${index}" value="${num}" required>
                            <span class="option-num">${num}</span>
                        </div>
                    `).join('')}
                    <span class="option-label">매우 그렇다</span>
                </div>
            </div>
        `;
        questionList.insertAdjacentHTML('beforeend', qHtml);
    });*/

    //서버에서 질문 가져오기 - 추가
    fetch('/npti/questions')
        .then(res => res.json())
        .then(data => {
            const shuffled = shuffleArray([...data]); // 서버 질문 셔플
            renderQuestions(shuffled);                // 질문 생성
        })
        .catch(err => {
            console.error('질문 로딩 실패:', err);
        });
    // 질문 생성 (서버 데이터 기반)
    function renderQuestions(questions) {
        questions.forEach((q, index) => {
            const qHtml = `
                <div class="q-card">
                    <p class="q-title">Q${index + 1}. ${q.question_text}</p>
                    <div class="options-group">
                        <span class="option-label">매우 그렇지 않다</span>
                        ${[1, 2, 3, 4, 5].map(num => `
                            <div class="option-item">
                                <input type="radio"
                                        name="${q.question_id}"
                                        value="${num}"
                                        required
                                        data-axis="${q.npti_axis}"
                                        data-ratio="${q.question_ratio}">
                                <span class="option-num">${num}</span>
                            </div>
                        `).join('')}
                        <span class="option-label">매우 그렇다</span>
                    </div>
                </div>
            `;
            questionList.insertAdjacentHTML('beforeend', qHtml);
        });
    }
    // 제출 이벤트
    nptiForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const formData = new FormData(nptiForm);
        let finalScores = { length: 0, article: 0, info: 0, view: 0 };
        /*const weights = [0.4, 0.3, 0.3]; // 가중치 설정

        // 1. 가중치 기반 점수 계산
        for (let [key, value] of formData.entries()) {
            const val = parseInt(value);
            const qIdx = parseInt(key.replace('q', '')); // 질문 인덱스 (0~11)

            const categoryIdx = Math.floor(qIdx / 3); // 0:Length, 1:Style, 2:Info, 3:View
            const weightIdx = qIdx % 3; // 0, 1, 2 (각 질문의 가중치 순서)

            // (val - 1) / 4 : 1~5점을 0~1 비율로 변환
            const weightedScore = ((val - 1) / 4) * weights[weightIdx];

            if (categoryIdx === 0) finalScores.length += weightedScore;
            else if (categoryIdx === 1) finalScores.style += weightedScore;
            else if (categoryIdx === 2) finalScores.info += weightedScore;
            else if (categoryIdx === 3) finalScores.view += weightedScore;
        }*/ //삭제

        /* ---------------------------------------------
       [추가] DB 메타데이터 기반 점수 계산
       --------------------------------------------- */
        for (let [questionId, value] of formData.entries()) {
            const input = nptiForm.querySelector(
                `input[name="${questionId}"]:checked`
            );

            const axis = input.dataset.axis;              // length/article/info/view
            const ratio = parseFloat(input.dataset.ratio); // 0.4 / 0.3
            const score = parseInt(value);                 // 1~5

            // 1~5 → 0~1 정규화
            const normalized = (score - 1) / 4;

            // 축별 점수 누적
            finalScores[axis] += normalized * ratio;
        }

        // 2. 0.5(50%) 기준으로 타입 결정
        const type = [
            finalScores.length > 0.5 ? 'S' : 'L',
            finalScores.article > 0.5 ? 'T' : 'C',
            finalScores.info > 0.5 ? 'F' : 'I',
            finalScores.view > 0.5 ? 'N' : 'P'
        ].join('');

        // 3. 진단 완료 데이터 저장 (로컬 스토리지)
        localStorage.setItem('hasNPTI', 'true');
        localStorage.setItem('nptiResult', type); // 계산된 결과(예: STFN) 저장

        // 4. 커스텀 팝업 띄우기
        const completeModal = document.getElementById('testCompleteModal');
        if (completeModal) {
            completeModal.style.display = 'flex';
            setTimeout(() => completeModal.classList.add('show'), 10);
        }
    });

    // [확인] 버튼 클릭 시 이동 로직
    document.getElementById('goToResult')?.addEventListener('click', function () {
        location.href = "/view/html/result.html"; // 결과 페이지 경로
    });
});