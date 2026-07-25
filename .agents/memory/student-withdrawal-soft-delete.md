---
name: 학생 퇴원 soft delete
description: 학생 퇴원 처리 아키텍처 — soft delete + 재원 복구 + 1년 후 purge
---

# 학생 퇴원 처리 규칙

- 학생 "퇴원 처리"는 hard delete가 아니라 soft delete: `users.withdrawn_at` 세팅, 수강 정보는 `users.withdrawn_enrollments`(classId JSON)에 스냅샷 후 enrollments 삭제.
- 재원 복구(reinstate)는 withdrawn_at 해제 + 스냅샷 기반 enrollments 재생성(삭제/보관된 반은 skip).
- **Why:** 퇴원생 데이터를 1년간 보관 후 자동 완전 폐기(일 1회 purge 스케줄러가 storage.deleteUser 호출 → exit-record 스냅샷 자동 생성)하기 위해.
- **How to apply:**
  - 사용자 목록 조회(getUsers/getCenterUsers)는 기본적으로 퇴원생 제외. 퇴원생까지 필요하면 `includeWithdrawn` 옵션/쿼리파람 사용 (사용자 관리 페이지만 사용).
  - 학생 목록/집계에 새 기능을 추가할 때 withdrawn 학생 포함 여부를 반드시 고려할 것.
  - 표시 규칙: 숙제 제출 목록은 퇴원생 완전 제외, 평가/대면점검은 이름 뒤 "(퇴원생)" suffix (markWithdrawnStudentNames), hard-delete된 학생은 exit-record 기반 placeholder.
  - 퇴원생의 "삭제" 버튼은 즉시 완전 삭제(hard delete)로 동작.
