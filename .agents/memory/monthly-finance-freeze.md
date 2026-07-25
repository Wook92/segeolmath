---
name: 월별 재무 동결 스냅샷
description: 경영 재무의 인건비(급여/시급 시간) 실시간 계산을 지난달에 대해 동결하는 스냅샷 규칙
---

# 월별 재무 동결 (monthly_finance_snapshots)

규칙: 인건비 관련 실시간 계산(강사 급여 계산, 시급용 수업시간)은 요청 월이 현재 월(KST 기준)보다 과거이면 `monthly_finance_snapshots` 스냅샷을 서빙한다. 스냅샷이 없으면 최초 1회 계산 후 동결(freeze-on-first-read). 현재 월은 실시간 계산 + 스냅샷 upsert. 12시간 주기 스케줄러가 전 센터 현재 월 스냅샷을 저장해, 아무도 조회하지 않아도 월말 상태가 동결된다.

**Why:** 급여/시간 계산이 "현재" 수강·시간표 기준이라, 다음 달에 수업을 추가하면 지난달 재무 수치가 소급 변경되는 문제(사용자 확인 요청). 결제 기반 매출과 수동 지출은 이미 저장형이라 동결 불필요.

**How to apply:**
- 새로운 실시간 재무 계산 엔드포인트를 추가하면 같은 kind 체계(`teacherSalary:<teacherId>`, `scheduleHours` 등)로 이 동결 로직을 적용할 것.
- 스냅샷 데이터는 응답 JSON 그대로 직렬화 — 응답 형식 바꾸면 기존 스냅샷과 호환 확인 필요.
- 현재 월 판정은 서버 UTC가 아닌 KST(`getCurrentYearMonthKST`) 기준.
- upsert는 (center_id, year_month, kind) unique index 기반 onConflictDoUpdate (원자적).
