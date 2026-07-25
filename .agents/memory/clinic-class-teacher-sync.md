---
name: 클리닉 담당선생님 ↔ 시간표 담당교사 연동
description: 중등/고등클리닉 학생의 담당선생님(regularTeacherId)이 정규 수업 담당교사를 따라가는 매핑 규칙과 그 근거
---

# 클리닉 담당선생님 ↔ 시간표 담당교사 연동

- 클리닉 학생(`clinic_students`)의 `regularTeacherId`(담당선생님)는 학생이 배정된 정규 수업의 담당교사를 따라간다. 시간표에서 그 수업의 담당교사를 바꾸면 클리닉 담당선생님도 자동으로 함께 바뀐다.
- 연결 키는 클리닉 학생의 `classGroup` 문자열이다. `classGroup`은 실제 수업(FK 아님)을 `"수업명 (반이름)"` = `"${class.name} (${class.subject})"` 형식으로 가리킨다. 과거 데이터는 `"${class.name}"`만 저장된 경우도 있어 두 형식 모두 매칭해야 한다.

**Why:** 사용자가 "학생의 정규(일반) 수업 담당교사가 바뀌면 클리닉 담당선생님도 바뀌게" 원함(중등클리닉 표의 '담당선생님' 컬럼 대상). 클리닉↔수업 사이에 정식 FK가 없고, `classGroup`이 유일한 연결 고리(클리닉 화면의 반 탭/배정도 이 문자열로 동작).

**How to apply:** 담당교사 동기화는 `PATCH /api/classes/:id`에서 `teacherId`가 실제로 변경됐을 때만 실행(`syncClinicTeacherOnClassTeacherChange`). 같은 센터에서 `classGroup`이 매칭되는 클리닉 학생 전원의 `regularTeacherId`를 새 교사로 갱신. 자체 try/catch로 격리(수업 수정 응답은 실패해도 성공 유지).

**주의(설계상 한계):** 문자열 매핑이라 같은 센터에 `name`+`subject`가 동일한 수업이 여러 개면 해당 `classGroup` 학생이 모두 함께 바뀐다. 라벨 중복이 잦아지면 class-id 기반 연결로 이전 고려.
