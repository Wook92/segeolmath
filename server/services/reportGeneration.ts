import { GoogleGenerativeAI } from "@google/generative-ai";
import { storage } from "../storage";
import type { Assessment, ClinicWeeklyRecord, ClassVideo, Exam, ExamParticipant } from "@shared/schema";

const geminiApiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(geminiApiKey);

export interface StudentDataSummary {
  studentId: string;
  studentName: string;
  centerName?: string;
  school?: string;
  grade?: string;
  centerId: string;
  year: number;
  month: number;
  assessments: {
    className: string;
    scores: { date: string; score: number; maxScore: number; rank?: number; totalStudents?: number }[];
    averageScore: number;
    averageRank?: number;
    totalStudentsInClass?: number;
    trend: "improving" | "stable" | "declining";
  }[];
  attendance: {
    totalDays: number;
    presentDays: number;
    lateDays: number;
    absentDays: number;
    attendanceRate: number;
  };
  homework: {
    totalAssigned: number;
    completed: number;
    completionRate: number;
    averageCompletionScore: number;
    byClass: { className: string; assigned: number; completed: number; avgCompletionScore: number }[];
  };
  clinic: {
    comments: string[];
    progress: string[];
  };
  videoViewing: {
    totalViews: number;
    viewsByClass: { className: string; viewCount: number }[];
  };
  studyCafe: {
    totalHours: number;
    sessionsCount: number;
  };
  examResults: {
    examName: string;
    examDate: string;
    score: number | null;
    maxScore: number;
    className?: string;
    rank?: number;
    totalParticipants?: number;
  }[];
}

export async function gatherStudentData(
  studentId: string,
  centerId: string,
  year: number,
  month: number
): Promise<StudentDataSummary> {
  const student = await storage.getUser(studentId);
  if (!student) {
    throw new Error("Student not found");
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const allAssessments = await storage.getAssessmentsByCenter(centerId);
  const studentAssessments = allAssessments.filter(
    (a: Assessment & { studentId?: string }) => a.studentId === studentId
  );

  // Group assessments by class and calculate ranks using assessmentDate (exam date)
  const classGroups = new Map<string, { 
    className: string; 
    classId: string;
    scores: { date: string; score: number; maxScore: number; rank?: number; totalStudents?: number }[] 
  }>();
  
  for (const assessment of studentAssessments) {
    // Use assessmentDate (exam date) for filtering and ranking, not createdAt
    if (assessment.assessmentDate) {
      const assessDateStr = assessment.assessmentDate; // Already a date string (YYYY-MM-DD)
      const assessDate = new Date(assessDateStr);
      
      if (assessDate >= startDate && assessDate <= endDate) {
        const key = assessment.classId;
        
        if (!classGroups.has(key)) {
          classGroups.set(key, { className: assessment.className || "수업", classId: key, scores: [] });
        }
        
        // Calculate rank among all students who took the same assessment on the same date
        // Using assessmentDate for accurate same-exam grouping
        const sameAssessments = allAssessments.filter((a: Assessment) => 
          a.classId === assessment.classId && 
          a.assessmentDate === assessDateStr
        );
        
        // Sort by percentage score descending
        const sortedByScore = sameAssessments
          .map((a: Assessment) => ({ studentId: a.studentId, percentage: (a.score / (a.maxScore || 100)) * 100 }))
          .sort((a, b) => b.percentage - a.percentage);
        
        const rank = sortedByScore.findIndex(s => s.studentId === studentId) + 1;
        const totalStudents = sameAssessments.length;
        
        classGroups.get(key)!.scores.push({
          date: assessDateStr,
          score: assessment.score,
          maxScore: assessment.maxScore || 100,
          rank: rank > 0 ? rank : undefined,
          totalStudents: totalStudents > 1 ? totalStudents : undefined,
        });
      }
    }
  }

  const assessmentData: StudentDataSummary["assessments"] = [];
  const groupValues = Array.from(classGroups.values());
  for (const group of groupValues) {
    if (group.scores.length > 0) {
      const avgScore = group.scores.reduce((sum: number, s) => sum + (s.score / s.maxScore) * 100, 0) / group.scores.length;
      let trend: "improving" | "stable" | "declining" = "stable";
      if (group.scores.length >= 2) {
        const firstHalf = group.scores.slice(0, Math.floor(group.scores.length / 2));
        const secondHalf = group.scores.slice(Math.floor(group.scores.length / 2));
        const firstAvg = firstHalf.reduce((s: number, x) => s + x.score / x.maxScore * 100, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((s: number, x) => s + x.score / x.maxScore * 100, 0) / secondHalf.length;
        if (secondAvg > firstAvg + 5) trend = "improving";
        else if (secondAvg < firstAvg - 5) trend = "declining";
      }
      
      // Calculate average rank
      const rankedScores = group.scores.filter(s => s.rank !== undefined && s.totalStudents !== undefined);
      const avgRank = rankedScores.length > 0 
        ? Math.round((rankedScores.reduce((sum, s) => sum + (s.rank || 0), 0) / rankedScores.length) * 10) / 10
        : undefined;
      const totalStudentsInClass = rankedScores.length > 0 
        ? Math.max(...rankedScores.map(s => s.totalStudents || 0))
        : undefined;
      
      assessmentData.push({
        className: group.className,
        scores: group.scores,
        averageScore: Math.round(avgScore * 10) / 10,
        averageRank: avgRank,
        totalStudentsInClass,
        trend,
      });
    }
  }

  let presentDays = 0;
  let lateDays = 0;
  let totalDays = 0;
  const currentDate = new Date(startDate);
  while (currentDate <= endDate && currentDate <= new Date()) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0) {
      totalDays++;
      const dateStr = currentDate.toISOString().split("T")[0];
      const record = await storage.getAttendanceRecordByStudentAndDate(studentId, dateStr);
      if (record) {
        presentDays++;
        if (record.wasLate) lateDays++;
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const clinicComments: string[] = [];
  const clinicProgress: string[] = [];
  const clinicStudentsList = await storage.getClinicStudents(centerId);
  const studentClinic = clinicStudentsList.find((cs) => cs.studentId === studentId);
  if (studentClinic) {
    const records = await storage.getClinicWeeklyRecords(studentClinic.id);
    for (const rec of records) {
      if (rec.createdAt && new Date(rec.createdAt) >= startDate && new Date(rec.createdAt) <= endDate) {
        if (rec.clinicTeacherFeedback) clinicComments.push(rec.clinicTeacherFeedback);
        if (rec.progressNotes) clinicProgress.push(rec.progressNotes);
      }
    }
  }

  // Gather homework data with completion scores
  const homeworkByClass = new Map<string, { 
    className: string; 
    assigned: number; 
    completed: number;
    completionScores: number[];
  }>();
  const allHomework = await storage.getHomeworkByCenter(centerId);
  const studentEnrollments = await storage.getStudentEnrollments(studentId);
  const enrolledClassIds = studentEnrollments.map(e => e.classId);
  
  for (const hw of allHomework) {
    // Skip if student is not enrolled in this class
    if (!enrolledClassIds.includes(hw.classId)) continue;
    if (!hw.dueDate) continue;
    
    // Include homework if it's for all students (studentId is null) or for this specific student
    if (hw.studentId !== null && hw.studentId !== studentId) continue;
    
    const dueDate = new Date(hw.dueDate);
    if (dueDate >= startDate && dueDate <= endDate) {
      const classInfo = await storage.getClass(hw.classId);
      const className = classInfo?.name || "수업";
      
      if (!homeworkByClass.has(hw.classId)) {
        homeworkByClass.set(hw.classId, { className, assigned: 0, completed: 0, completionScores: [] });
      }
      
      const entry = homeworkByClass.get(hw.classId)!;
      entry.assigned++;
      
      const submission = await storage.getSubmissionByHomeworkAndStudent(hw.id, studentId);
      if (submission) {
        entry.completed++;
        // Track completion rate score if available
        if (submission.completionRate !== null && submission.completionRate !== undefined) {
          entry.completionScores.push(submission.completionRate);
        }
      }
    }
  }
  
  const homeworkByClassList = Array.from(homeworkByClass.values()).map(h => ({
    className: h.className,
    assigned: h.assigned,
    completed: h.completed,
    avgCompletionScore: h.completionScores.length > 0 
      ? Math.round(h.completionScores.reduce((sum, s) => sum + s, 0) / h.completionScores.length)
      : 0
  }));
  const totalAssigned = homeworkByClassList.reduce((sum, h) => sum + h.assigned, 0);
  const totalCompleted = homeworkByClassList.reduce((sum, h) => sum + h.completed, 0);
  const allCompletionScores = Array.from(homeworkByClass.values()).flatMap(h => h.completionScores);
  const avgCompletionScore = allCompletionScores.length > 0
    ? Math.round(allCompletionScores.reduce((sum, s) => sum + s, 0) / allCompletionScores.length)
    : 0;

  const allExams = await storage.getExams(centerId);
  const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const monthExams = allExams.filter(exam => {
    if (!exam.examDate) return false;
    return exam.examDate >= startDateStr && exam.examDate <= endDateStr;
  });
  
  const examResults: StudentDataSummary["examResults"] = [];
  for (const exam of monthExams) {
    const participants = await storage.getExamParticipants(exam.id);
    const studentParticipant = participants.find(p => p.studentId === studentId);
    if (studentParticipant) {
      const scoredParticipants = participants.filter(p => p.score !== null && p.score !== undefined);
      const sorted = scoredParticipants
        .map(p => ({ studentId: p.studentId, score: p.score! }))
        .sort((a, b) => b.score - a.score);
      const rank = studentParticipant.score !== null && studentParticipant.score !== undefined
        ? sorted.findIndex(s => s.studentId === studentId) + 1
        : undefined;

      let className: string | undefined;
      if (exam.classId) {
        const cls = await storage.getClass(exam.classId);
        if (cls) className = `${cls.name} ${cls.subject}반`;
      }

      examResults.push({
        examName: exam.name,
        examDate: exam.examDate,
        score: studentParticipant.score,
        maxScore: exam.maxScore,
        className,
        rank: rank && rank > 0 ? rank : undefined,
        totalParticipants: scoredParticipants.length > 0 ? scoredParticipants.length : undefined,
      });
    }
  }

  const center = await storage.getCenter(centerId);

  return {
    studentId,
    studentName: student.name,
    centerName: center?.name || undefined,
    school: student.school || undefined,
    grade: student.grade || undefined,
    centerId,
    year,
    month,
    assessments: assessmentData,
    attendance: {
      totalDays,
      presentDays,
      lateDays,
      absentDays: totalDays - presentDays,
      attendanceRate: totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0,
    },
    homework: {
      totalAssigned,
      completed: totalCompleted,
      completionRate: totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0,
      averageCompletionScore: avgCompletionScore,
      byClass: homeworkByClassList,
    },
    clinic: {
      comments: clinicComments,
      progress: clinicProgress,
    },
    videoViewing: {
      totalViews: 0,
      viewsByClass: [],
    },
    studyCafe: {
      totalHours: 0,
      sessionsCount: 0,
    },
    examResults,
  };
}

export async function generateReportWithAI(data: StudentDataSummary, customInstructions?: string): Promise<string> {
  const prompt = buildReportPrompt(data, customInstructions);
  const givenName = getGivenName(data.studentName);
  const centerName = data.centerName || "학원";
  
  const systemInstruction = `당신은 수학 학원 선생님입니다. 학부모에게 보내는 월간 학습 보고서를 작성합니다.

작성 지침:
- 반드시 "안녕하세요. ${centerName}입니다."로 시작합니다. 학원명을 정확히 "${centerName}"으로 적어주세요.
- 그 다음 줄에 "${givenName}의 ${data.month}월 학습한 부분에 대해 안내드립니다."라고 작성합니다.
- 절대로 "학생"이라는 단어를 붙이지 않습니다. "${givenName} 학생" X, "${givenName}" O.
- 항상 성을 뺀 이름만 사용합니다: "${data.studentName}" → "${givenName}". 절대 "${data.studentName}"(풀네임)을 쓰지 마세요.
- "님"을 붙이지 않습니다. (예: "${givenName}가", "${givenName}는" O, "${givenName}님" X)
- 따뜻하고 격려하는 톤으로 작성하되, 객관적인 사실에 기반합니다.
- 500-700자 정도로 충분히 상세하게 작성합니다.
- 가독성을 위해 문단을 나누고 줄바꿈을 적극 활용합니다.
- 각 주제(출석, 숙제, 평가, 종합 코멘트)를 구분하여 작성합니다.
- 이모지는 사용하지 않습니다.
- 마지막에 다음 달 목표나 격려의 말로 마무리합니다.
- 중요: "학교생활", "학교"라는 단어를 절대 사용하지 않습니다. 우리는 학원입니다.
- "보고서를 드리게 되어 기쁩니다" 같은 어색한 표현은 사용하지 않습니다.`;

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction,
  });

  const result = await model.generateContent(prompt);
  let text = result.response.text() || "";
  text = text.replace(/\{학원명\}/g, centerName);
  return text;
}

export async function refineReportWithAI(content: string): Promise<string> {
  const systemInstruction = `당신은 문장 다듬기 전문가입니다. 

다듬기 지침:
- 주어진 학습 보고서를 더 자연스럽고 읽기 쉽게 다듬어 주세요.
- 내용의 핵심은 유지하면서, 문법을 교정하고 어색한 표현을 부드럽게 수정합니다.
- 가독성을 위해 문단을 적절히 나누고 줄바꿈을 활용합니다.
- 500-700자 정도의 상세한 보고서 형식을 유지합니다.
- 이모지는 사용하지 않습니다.`;

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction,
  });

  const result = await model.generateContent(`다음 학습 보고서 문자를 다듬어 주세요:\n\n${content}`);
  return result.response.text() || content;
}

// Extract given name (first name without surname) from Korean name
function getGivenName(fullName: string): string {
  // Korean names are typically: 성(1자) + 이름(1-2자)
  // Remove first character (surname) to get given name
  if (fullName.length > 1) {
    return fullName.slice(1);
  }
  return fullName;
}

function buildReportPrompt(data: StudentDataSummary, customInstructions?: string): string {
  const lines: string[] = [];
  const givenName = getGivenName(data.studentName);
  
  lines.push(`학생 정보: ${data.studentName} (이름: ${givenName})`);
  if (data.school) lines.push(`학교: ${data.school}`);
  if (data.grade) lines.push(`학년: ${data.grade}`);
  lines.push(`보고 기간: ${data.year}년 ${data.month}월`);
  lines.push("");

  if (data.assessments.length > 0) {
    lines.push("## 평가 성적");
    for (const a of data.assessments) {
      let assessmentLine = `- ${a.className}: 평균 ${a.averageScore}점`;
      if (a.averageRank !== undefined && a.totalStudentsInClass !== undefined) {
        assessmentLine += ` (반 ${a.totalStudentsInClass}명 중 ${a.averageRank}등)`;
      }
      assessmentLine += ` - ${
        a.trend === "improving" ? "향상 중" : 
        a.trend === "declining" ? "하락 추세" : "안정적"
      }`;
      lines.push(assessmentLine);
    }
    lines.push("");
  }

  lines.push("## 출결 현황");
  lines.push(`- 수업일: ${data.attendance.totalDays}일`);
  lines.push(`- 출석: ${data.attendance.presentDays}일 (출석률 ${data.attendance.attendanceRate}%)`);
  if (data.attendance.lateDays > 0) {
    lines.push(`- 지각: ${data.attendance.lateDays}회`);
  }
  lines.push("");

  if (data.homework.totalAssigned > 0) {
    lines.push("## 숙제 완성도");
    lines.push(`- 총 배정: ${data.homework.totalAssigned}개`);
    lines.push(`- 제출 완료: ${data.homework.completed}개 (제출률 ${data.homework.completionRate}%)`);
    if (data.homework.averageCompletionScore > 0) {
      lines.push(`- 숙제 평가 평균: ${data.homework.averageCompletionScore}점`);
    }
    if (data.homework.byClass.length > 0) {
      lines.push("- 수업별 상세:");
      for (const h of data.homework.byClass) {
        let classLine = `  - ${h.className}: ${h.assigned}개 중 ${h.completed}개 제출`;
        if (h.avgCompletionScore > 0) {
          classLine += ` (평가점수 ${h.avgCompletionScore}점)`;
        }
        lines.push(classLine);
      }
    }
    lines.push("");
  }

  if (data.examResults && data.examResults.length > 0) {
    lines.push("## 평가관리 시험 결과");
    for (const e of data.examResults) {
      let examLine = `- ${e.examName} (${e.examDate})`;
      if (e.className) examLine += ` [${e.className}]`;
      if (e.score !== null && e.score !== undefined) {
        examLine += `: ${e.score}/${e.maxScore}점`;
        if (e.rank !== undefined && e.totalParticipants !== undefined) {
          examLine += ` (${e.totalParticipants}명 중 ${e.rank}등)`;
        }
      } else {
        examLine += `: 미채점`;
      }
      lines.push(examLine);
    }
    lines.push("");
  }

  if (data.clinic.comments.length > 0 || data.clinic.progress.length > 0) {
    lines.push("## 클리닉 피드백");
    for (const c of data.clinic.comments.slice(0, 3)) {
      lines.push(`- ${c}`);
    }
    for (const p of data.clinic.progress.slice(0, 2)) {
      lines.push(`- 진행: ${p}`);
    }
    lines.push("");
  }

  if (data.videoViewing.totalViews > 0) {
    lines.push("## 수업 영상 시청");
    lines.push(`- 총 시청 횟수: ${data.videoViewing.totalViews}회`);
    for (const v of data.videoViewing.viewsByClass.slice(0, 3)) {
      lines.push(`- ${v.className}: ${v.viewCount}회`);
    }
    lines.push("");
  }

  if (data.studyCafe.sessionsCount > 0) {
    lines.push("## 스터디카페 이용");
    lines.push(`- 총 이용 시간: ${data.studyCafe.totalHours}시간`);
    lines.push(`- 이용 횟수: ${data.studyCafe.sessionsCount}회`);
  }

  lines.push("");
  lines.push("위 정보를 바탕으로 학부모에게 보내는 따뜻하고 격려하는 월간 학습 보고서를 작성해주세요.");
  
  if (customInstructions && customInstructions.trim()) {
    lines.push("");
    lines.push("## 선생님 추가 요청사항");
    lines.push(customInstructions.trim());
  }

  return lines.join("\n");
}
