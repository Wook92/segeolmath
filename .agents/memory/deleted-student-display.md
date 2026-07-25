---
name: 삭제된 학생 (퇴원생) 표시
description: 하드 삭제된 학생 이름을 어디서/어떻게 복구해 "이름 (퇴원생)"으로 표시하는지
---

# 삭제된 학생 표시 규칙

학생 계정은 하드 삭제(users 행 완전 삭제)라 이름 복구 수단이 필요하다.

**규칙:**
- deleteUser가 학생 삭제 시 트랜잭션 안에서 센터별 `student_exit_records` 스냅샷을 자동 생성한다 (이미 수동 퇴원 기록이 있는 센터는 skip, `notes="계정 삭제 시 자동 기록"`, reasons=["OTHER"]).
- 서버 조회에서 studentId로 user를 못 찾으면 exit record 이름으로 `"이름 (퇴원생)"` 합성 User 플레이스홀더를 만들어 내려준다 (storage의 addDeletedStudentPlaceholders 헬퍼; 교육비 안내/숙제 제출/평가/대면점검에 적용).
- 교육비 결제 현황 탭은 학생 목록 밖 studentId의 해당 월 청구서를 모아 삭제 학생 행을 추가한다 (서버 합성 이름 사용).
- 퇴원 사유 통계(getMonthlyExitSummary)는 자동 기록의 사유("기타")를 집계에서 제외한다 — notes 마커 문자열로 판별. 마커 문자열을 바꾸면 두 곳을 함께 바꿔야 함.

**Why:** 삭제 후 "알 수 없음" 표기 불만; 사용자 요구는 "이름 (퇴원생)" 표기 + 삭제 당월 교육비 목록 유지.
**How to apply:** 삭제된 학생 이름이 필요한 새 조회를 만들 땐 addDeletedStudentPlaceholders 패턴을 재사용할 것. 새 자동 exit record 생성 경로를 추가하면 통계 제외 마커도 고려.
