from apscheduler.schedulers.asyncio import AsyncIOScheduler
from bigkinds_crawling.news_raw import news_crawling
from bigkinds_crawling.news_aggr_grouping import news_aggr
import multiprocessing
import psutil
from logger import Logger
from datetime import datetime, timezone, timedelta

logger = Logger()


# 1. 하나의 통합된 실행 제어 함수
def run_job_with_timeout(func, args, timeout):
    """
    func: 실행할 함수 (news_crawling 등)
    args: 함수에 전달할 인자 (튜플 형태)
    timeout: 제한 시간 (초 단위)
    """
    # 별도 프로세스로 작업 시작
    p = multiprocessing.Process(target=func, args=args)
    p.start()
    print(f"{func} 함수 시작")

    # 프로세스가 끝날 때까지 지정된 시간(timeout)만큼 대기
    p.join(timeout)

    # 만약 지정된 시간이 지났는데도 프로세스가 살아있다면? (강제 종료 로직)
    if p.is_alive():
        print(f"⚠️ [타임아웃] {func.__name__} 작업이 {timeout}초를 초과하여 강제 종료 및 청소를 시작합니다.")

        try:
            # 부모 프로세스 객체 생성
            parent = psutil.Process(p.pid)
            # 자식 프로세스(Chromedriver, Chrome 등)를 재귀적으로 모두 찾음
            children = parent.children(recursive=True)

            # 1단계: 자식 프로세스(브라우저 등) 먼저 종료
            for child in children:
                if child.is_running():
                    child.terminate()

            # 2단계: 부모 프로세스(파이썬 함수) 종료
            parent.terminate()

            # 3단계: 완전히 죽을 때까지 최대 3초 대기 후, 안 죽으면 강제 Kill
            gone, alive = psutil.wait_procs(children + [parent], timeout=3)
            for p_alive in alive:
                p_alive.kill()

        except psutil.NoSuchProcess:
            pass
        finally:
            p.join()  # 프로세스 자원 반환
            print(f"✅ [정리완료] {func.__name__} 관련 좀비 프로세스가 모두 제거되었습니다.")
    else:
        print(f"✅ [완료] {func.__name__} 작업이 제시간에 종료되었습니다.")


def sch_start():
    sch = AsyncIOScheduler()

    # 5분(300초) 주기지만, 안전을 위해 280초(4분 40초)에 강제 종료하도록 설정
    # 그래야 5분 정각에 새 스케줄러가 시작될 때 충돌이 없습니다.

    # 2-1. 뉴스 크롤링 등록
    sch.add_job(
        run_job_with_timeout,
        'interval',
        minutes=5,
        id='news_crawling',
        args=[news_crawling, (10,), 280],
        next_run_time=(datetime.now(timezone(timedelta(hours=9)))+timedelta(seconds=5)).isoformat(timespec='seconds') # 함수명, 인자(튜플), 타임아웃(초)
    )

    # 2-2. 뉴스 집계 등록
    sch.add_job(
        run_job_with_timeout,
        'interval',
        minutes=5,
        id='news_aggr',
        args=[news_aggr, (), 290],
        next_run_time=(datetime.now(timezone(timedelta(hours=9)))+timedelta(seconds=5)).isoformat(timespec='seconds')
    )

    return sch