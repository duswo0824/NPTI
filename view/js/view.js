function userBehavior(intervalMs = 100) {
    // 1. 초기 상태 및 시작 시간 정의
    const startTime = Date.now(); // [New] 수집 시작 시간 (정수)
    let stepCount = 0;            // [New] 데이터 수집 회차 (0, 1, 2... 순차 증가)

    const state = {
        currentX: 0,
        currentY: 0,
        cumulativeX: 0,
        cumulativeY: 0,
        lastX: null,
        lastY: null,

        scrollTop: window.scrollY || window.pageYOffset,
        cumulativeScrollY: 0,
        lastScrollTop: window.scrollY || window.pageYOffset
    };

    const targetDiv = document.getElementById('viewBody');

    const isPageActive = () => {
        return !document.hidden && document.hasFocus();
    };

    const handleMouseMove = (e) => {
        if (!isPageActive()) return;
        const x = e.pageX;
        const y = e.pageY;
        state.currentX = x;
        state.currentY = y;
        if (state.lastX !== null && state.lastY !==null){
            state.cumulativeX += Math.abs(x - state.lastX);
            state.cumulativeY += Math.abs(y - state.lastY);
        }
        state.lastX = x;
        state.lastY = y;
    };

    const handleScroll = () => {
        if (!isPageActive()) return;
        const currentScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
        state.scrollTop = currentScrollY;

        if (state.lastScrollTop !== null) {
            const delta = Math.abs(currentScrollY - state.lastScrollTop);
            state.cumulativeScrollY += delta;
        }
        state.lastScrollTop = currentScrollY;
    };

    // 전역 리스너 등록
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll);

    // 주기적 데이터 수집 (Interval)
    const timerId = setInterval(() => {
        if (!isPageActive()) {
            return;
        }

        // [New] Step 증가 (데이터 순번)
        stepCount++;

        // 타겟과의 거리 계산
        let distance = -1;
        if (targetDiv) {
            const rect = targetDiv.getBoundingClientRect();
            const scrollX = window.scrollX || window.pageXOffset;
            const scrollY = window.scrollY || window.pageYOffset;

            const divCenterX = rect.left + scrollX + (rect.width / 2);
            const divCenterY = rect.top + scrollY + (rect.height / 2);

            distance = Math.sqrt(
                Math.pow(state.currentX - divCenterX, 2) +
                Math.pow(state.currentY - divCenterY, 2)
            );
        }

        // 현재 시간 (정수)
        const now = Date.now();

        // 최종 데이터 패키징
        const dataSnapshot = {
            // [Modified] 타임스탬프: 1970년 1월 1일 이후 흐른 밀리초 (정수)
            // 예: 1735689000123
            timestamp: now,

            // [New] 경과 시간: 시작 후 흐른 밀리초 (0, 100, 200...) - 분석 시 가장 유용
            elapsedMs: now - startTime,

            // [New] 수집 순번: 1, 2, 3... (누락된 데이터 확인 용도)
            step: stepCount,

            mouseX: Math.round(state.currentX), // 좌표도 정수로 반올림 처리 (선택사항)
            mouseY: Math.round(state.currentY),
            accX: Math.floor(state.cumulativeX),
            accY: Math.floor(state.cumulativeY),
            accScrollY: Math.floor(state.cumulativeScrollY),
            distTarget: parseFloat(distance.toFixed(2)) // 숫자형으로 변환
        };

        // 데이터를 배열에 넣어서 전송하는 로직 필요
        console.log("Data:", dataSnapshot);

    }, intervalMs);

    // 클린업 함수
    return {
        stop: () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('scroll', handleScroll);
            clearInterval(timerId);
            console.log("데이터 수집이 종료되었습니다.");
        }
    };
}