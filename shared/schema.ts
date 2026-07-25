import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, date, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User roles (7-tier hierarchy)
export const UserRole = {
  ADMIN: 4,           // 관리자 - Full system access
  PRINCIPAL: 3,       // 원장 - Center management
  TEACHER: 2,         // 선생님 - Class management
  CLINIC_TEACHER: 2,  // 클리닉 선생님 - Same level as teacher, handles clinic instruction
  STUDENT: 1,         // 학생 - Learning activities
  PARENT: 0,          // 학부모 - Read-only access
  KIOSK: -1,          // 키오스크 - Attendance pad only
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

// Centers (학원 센터)
export const centers = pgTable("centers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  businessName: text("business_name"), // 상호명
  representativeName: text("representative_name"), // 대표자명
  businessRegistrationNumber: text("business_registration_number"), // 사업자등록번호
  businessAddress: text("business_address"), // 사업장 주소
  businessPhone: text("business_phone"), // 유선번호
  logoUrl: text("logo_url"), // 센터 로고 URL (기본)
  loginLogoUrl: text("login_logo_url"), // 로그인 페이지 로고
  sidebarLogoUrl: text("sidebar_logo_url"), // 사이드바 로고
  faviconUrl: text("favicon_url"), // 파비콘
  attendancePadLogoUrl: text("attendance_pad_logo_url"), // 출결패드 로고
  shortcutIconUrl: text("shortcut_icon_url"), // 홈화면 바로가기 아이콘
  domain: text("domain"), // 센터 도메인
  clinicTeacherEnabled: boolean("clinic_teacher_enabled").default(false), // 클리닉 선생님 계정 유형 활성화
  tossClientKey: text("toss_client_key"), // 토스페이먼츠 클라이언트 키 (암호화)
  tossSecretKey: text("toss_secret_key"), // 토스페이먼츠 시크릿 키 (암호화)
  supplementarySmsTemplate: text("supplementary_sms_template"), // 보충 안내 문자 서식
  supplementaryReminderSmsTemplate: text("supplementary_reminder_sms_template"), // 보충 전날 예약 문자 서식
  dailyNoticeSmsTemplate: text("daily_notice_sms_template"), // 알림장 학부모 문자 서식
  tuitionVisibleToTeachers: boolean("tuition_visible_to_teachers").default(false), // 선생님에게 교육비 공개
  tossConsentStatus: text("toss_consent_status").default("none"), // 토스페이먼츠 연동 동의 상태: none, pending, approved, rejected
  tossConsentAt: timestamp("toss_consent_at"), // 동의 요청 시각
  tossApprovedAt: timestamp("toss_approved_at"), // 승인 시각
  smsMode: text("sms_mode").default("none"), // none | direct | credit
  creditSenderNumber: text("credit_sender_number"), // 충전 모드에서 사용할 발신번호
  updatedAt: timestamp("updated_at").defaultNow(), // 캐시 버스팅용 업데이트 시간
});

export const insertCenterSchema = createInsertSchema(centers).pick({ 
  name: true,
  businessName: true,
  representativeName: true,
  businessRegistrationNumber: true,
  businessAddress: true,
  businessPhone: true,
  logoUrl: true,
  loginLogoUrl: true,
  sidebarLogoUrl: true,
  faviconUrl: true,
  attendancePadLogoUrl: true,
  shortcutIconUrl: true,
  domain: true,
  clinicTeacherEnabled: true,
  tossClientKey: true,
  tossSecretKey: true,
  supplementarySmsTemplate: true,
  supplementaryReminderSmsTemplate: true,
  dailyNoticeSmsTemplate: true,
});
export type InsertCenter = z.infer<typeof insertCenterSchema>;
export type Center = typeof centers.$inferSelect;

// Employment types for teachers (고용 형태)
export const EmploymentType = {
  REGULAR: "regular",      // 정규직
  PART_TIME: "part_time",  // 파트타임
  HOURLY: "hourly",        // 아르바이트
} as const;

export type EmploymentTypeValue = typeof EmploymentType[keyof typeof EmploymentType];

// Account types for students/parents (계정 유형)
export const AccountType = {
  STUDENT: "student",   // 학생 계정 (본인이 직접 로그인)
  PARENT: "parent",     // 학부모 계정 (자녀 관리)
} as const;

export type AccountTypeValue = typeof AccountType[keyof typeof AccountType];

// Users (사용자)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  motherPhone: text("mother_phone"),
  fatherPhone: text("father_phone"),
  studentPhone: text("student_phone"), // 학생 본인 전화번호
  school: text("school"),
  grade: text("grade"),
  role: integer("role").notNull().default(1),
  isClinicTeacher: boolean("is_clinic_teacher").notNull().default(false),
  linkedStudentIds: text("linked_student_ids").array(), // For parents: list of linked student IDs
  homeroomTeacherId: varchar("homeroom_teacher_id"), // 담임 선생님 ID
  employmentType: text("employment_type"), // 고용 형태: regular, part_time, hourly (선생님만 사용)
  dailyRate: integer("daily_rate"), // 일급 (아르바이트 선생님용, 원 단위)
  hourlyRate: integer("hourly_rate"), // 시급 (아르바이트 선생님용, 원 단위)
  wageType: text("wage_type"), // 급여 유형: daily(일급) 또는 hourly(시급)
  fixedWorkStart: text("fixed_work_start"), // 고정 근무 시작 시간 (HH:MM)
  fixedWorkEnd: text("fixed_work_end"), // 고정 근무 종료 시간 (HH:MM)
  fixedWorkDays: text("fixed_work_days").array(), // 고정 근무 요일 (mon, tue, wed, thu, fri, sat, sun)
  chatPassword: text("chat_password"), // 교사소통 톡방 입장 비밀번호 (학생용)
  consentAgreedAt: timestamp("consent_agreed_at"), // 전자정보 이용 동의 일시
  consultationImageUrl: text("consultation_image_url"), // 상담지 이미지 URL (R2)
  consultationNotes: text("consultation_notes"), // 상담 내용
  accountType: text("account_type"), // 계정 유형: student(학생 계정) 또는 parent(학부모 계정) - 둘 중 하나만 가능
  parentId: varchar("parent_id"), // 학부모 계정 ID (학생이 학부모 계정에 연결된 경우)
  birthDate: text("birth_date"), // 생년월일 (YYYY-MM-DD 형식)
  address: text("address"), // 주소
  gender: text("gender"), // 성별: male, female
  enrollmentDate: text("enrollment_date"), // 학원 입학일 (YYYY-MM-DD 형식)
  tuitionVisibleToStudent: boolean("tuition_visible_to_student").notNull().default(true),
  tuitionMemo: text("tuition_memo"),
  customTuitionAmount: integer("custom_tuition_amount"),
  discountRate: integer("discount_rate"),
  discountReason: text("discount_reason"),
  discountTarget: text("discount_target"),
  withdrawnAt: timestamp("withdrawn_at"), // 퇴원 처리 일시 (null이면 재원)
  withdrawnEnrollments: text("withdrawn_enrollments"), // 퇴원 시 수강 중이던 classId 목록 (JSON, 재원 복구용)
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  phone: true,
  motherPhone: true,
  fatherPhone: true,
  studentPhone: true,
  school: true,
  grade: true,
  role: true,
  isClinicTeacher: true,
  linkedStudentIds: true,
  homeroomTeacherId: true,
  employmentType: true,
  dailyRate: true,
  hourlyRate: true,
  wageType: true,
  fixedWorkStart: true,
  fixedWorkEnd: true,
  fixedWorkDays: true,
  chatPassword: true,
  consentAgreedAt: true,
  consultationImageUrl: true,
  consultationNotes: true,
  accountType: true,
  parentId: true,
  birthDate: true,
  address: true,
  gender: true,
  enrollmentDate: true,
  customTuitionAmount: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// User-Center relationship (N:M)
export const userCenters = pgTable("user_centers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  centerId: varchar("center_id").notNull(),
});

export const insertUserCenterSchema = createInsertSchema(userCenters).pick({
  userId: true,
  centerId: true,
});
export type InsertUserCenter = z.infer<typeof insertUserCenterSchema>;
export type UserCenter = typeof userCenters.$inferSelect;

// Schedule slot for day-specific times
export type ScheduleSlot = {
  day: string;      // 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
  startTime: string; // '14:00'
  endTime: string;   // '16:00'
};

// Class Level enum
export const ClassLevels = {
  KINDERGARTEN: "kindergarten",
  ELEMENTARY: "elementary",
  MIDDLE: "middle",
  HIGH: "high",
  ADULT: "adult",
} as const;
export type ClassLevel = typeof ClassLevels[keyof typeof ClassLevels];

// Classes (수업)
export const classes = pgTable("classes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  classType: text("class_type").notNull().default("regular"), // regular | assessment | high_clinic | middle_clinic
  classLevel: text("class_level").notNull().default("middle"), // elementary | middle | high (초등/중등/고등)
  teacherId: varchar("teacher_id"), // nullable - null when teacher is deleted
  assistantTeacherId: varchar("assistant_teacher_id"), // 부담임 선생님 (deprecated: 첫 번째 부담임을 호환용으로 보관)
  assistantTeacherIds: text("assistant_teacher_ids").array().notNull().default(sql`ARRAY[]::text[]`), // 부담임 선생님들 (다중 지정)
  teacherName: text("teacher_name"), // snapshot of teacher name when archived
  centerId: varchar("center_id").notNull(),
  classroom: text("classroom"), // 강의실 (예: A101, B202)
  days: text("days").array().notNull(), // ['mon', 'wed', 'fri'] - kept for backwards compatibility
  startTime: text("start_time").notNull(), // '14:00' - default time
  endTime: text("end_time").notNull(), // '15:30' - default time
  schedule: text("schedule"), // JSON string: [{day, startTime, endTime}, ...] - for day-specific times
  color: text("color").notNull().default("#3B82F6"),
  isArchived: boolean("is_archived").notNull().default(false), // true when teacher is deleted
  baseFee: integer("base_fee").notNull().default(0), // 기본금 (첫 수업 가격)
  additionalFee: integer("additional_fee").notNull().default(0), // 추가금 (추가 수업 가격)
  hourlyRate: integer("hourly_rate"), // 수업별 시급 (null이면 선생님 기본 시급 사용)
  deletedAt: timestamp("deleted_at"), // 휴지통 이동 시각 (null이면 정상, 4주 경과 시 완전삭제)
});

export const insertClassSchema = createInsertSchema(classes).pick({
  name: true,
  subject: true,
  classType: true,
  classLevel: true,
  teacherId: true,
  assistantTeacherId: true,
  assistantTeacherIds: true,
  centerId: true,
  classroom: true,
  days: true,
  startTime: true,
  endTime: true,
  schedule: true,
  color: true,
  baseFee: true,
  additionalFee: true,
});
export type InsertClass = z.infer<typeof insertClassSchema>;
export type Class = typeof classes.$inferSelect;

// 부담임 다중 지정 도우미: 신규 컬럼 + 기존 단일 컬럼을 합쳐 중복 제거된 배열 반환
export function getAssistantTeacherIds(
  cls: Pick<Class, "assistantTeacherId" | "assistantTeacherIds"> | null | undefined
): string[] {
  if (!cls) return [];
  const list = Array.isArray(cls.assistantTeacherIds) ? [...cls.assistantTeacherIds] : [];
  if (cls.assistantTeacherId && !list.includes(cls.assistantTeacherId)) {
    list.unshift(cls.assistantTeacherId);
  }
  return list.filter(Boolean);
}

// 특정 사용자가 해당 수업의 부담임인지 확인
export function isAssistantTeacher(
  cls: Pick<Class, "assistantTeacherId" | "assistantTeacherIds"> | null | undefined,
  userId: string | null | undefined
): boolean {
  if (!cls || !userId) return false;
  return getAssistantTeacherIds(cls).includes(userId);
}

// Class Enrollments (수업 신청)
export const enrollments = pgTable("enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  classId: varchar("class_id").notNull(),
  enrolledAt: timestamp("enrolled_at").defaultNow(),
});

export const insertEnrollmentSchema = createInsertSchema(enrollments).pick({
  studentId: true,
  classId: true,
});
export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;
export type Enrollment = typeof enrollments.$inferSelect;

// Homework (숙제)
export const homework = pgTable("homework", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: varchar("class_id").notNull(),
  studentId: varchar("student_id"), // null = all students in class, set = specific student only
  title: text("title").notNull(),
  dueDate: date("due_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertHomeworkSchema = createInsertSchema(homework).pick({
  classId: true,
  studentId: true,
  title: true,
  dueDate: true,
});
export type InsertHomework = z.infer<typeof insertHomeworkSchema>;
export type Homework = typeof homework.$inferSelect;

// Homework Submissions (숙제 제출)
export const homeworkSubmissions = pgTable("homework_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  homeworkId: varchar("homework_id").notNull(),
  studentId: varchar("student_id").notNull(),
  photos: text("photos").array(),
  completionRate: integer("completion_rate").default(0), // 0-100
  status: text("status").notNull().default("pending"), // pending | submitted | reviewed | resubmit | in_person
  feedback: text("feedback"),
  resubmitReason: text("resubmit_reason"),
  submittedAt: timestamp("submitted_at"),
  reviewedAt: timestamp("reviewed_at"),
});

export const insertHomeworkSubmissionSchema = createInsertSchema(homeworkSubmissions).pick({
  homeworkId: true,
  studentId: true,
  photos: true,
  completionRate: true,
  status: true,
  feedback: true,
  resubmitReason: true,
});
export type InsertHomeworkSubmission = z.infer<typeof insertHomeworkSubmissionSchema>;
export type HomeworkSubmission = typeof homeworkSubmissions.$inferSelect;

// Face-to-Face Checks (대면검사) - Similar to homework but without photo submission
export const faceToFaceChecks = pgTable("face_to_face_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: varchar("class_id").notNull(),
  studentId: varchar("student_id"), // null = all students in class, set = specific student only
  title: text("title").notNull(),
  description: text("description"), // 검사 내용 설명
  dueDate: date("due_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFaceToFaceCheckSchema = createInsertSchema(faceToFaceChecks).pick({
  classId: true,
  studentId: true,
  title: true,
  description: true,
  dueDate: true,
});
export type InsertFaceToFaceCheck = z.infer<typeof insertFaceToFaceCheckSchema>;
export type FaceToFaceCheck = typeof faceToFaceChecks.$inferSelect;

// Face-to-Face Check Results (대면검사 결과) - Teacher evaluates in person
export const faceToFaceCheckResults = pgTable("face_to_face_check_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  checkId: varchar("check_id").notNull(),
  studentId: varchar("student_id").notNull(),
  completionRate: integer("completion_rate").default(0), // 0-100 완성도
  status: text("status").notNull().default("pending"), // pending | checked | recheck
  feedback: text("feedback"), // 선생님 피드백
  recheckReason: text("recheck_reason"), // 재검사 필요시 사유
  checkedAt: timestamp("checked_at"), // 검사 완료 시간
  checkedBy: varchar("checked_by"), // 검사한 선생님 ID
});

export const insertFaceToFaceCheckResultSchema = createInsertSchema(faceToFaceCheckResults).pick({
  checkId: true,
  studentId: true,
  completionRate: true,
  status: true,
  feedback: true,
  recheckReason: true,
  checkedBy: true,
});
export type InsertFaceToFaceCheckResult = z.infer<typeof insertFaceToFaceCheckResultSchema>;
export type FaceToFaceCheckResult = typeof faceToFaceCheckResults.$inferSelect;

// Assessments (평가 수업 점수)
export const assessments = pgTable("assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: varchar("class_id").notNull(),
  studentId: varchar("student_id").notNull(),
  score: integer("score").notNull(),
  maxScore: integer("max_score").notNull().default(100),
  assessmentDate: date("assessment_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAssessmentSchema = createInsertSchema(assessments).pick({
  classId: true,
  studentId: true,
  score: true,
  maxScore: true,
  assessmentDate: true,
});
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type Assessment = typeof assessments.$inferSelect;

// Exams (평가관리 - 시험)
export const exams = pgTable("exams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  classId: varchar("class_id"), // optional - can be null for cross-class exams
  name: text("name").notNull(), // 시험 이름
  scope: text("scope"), // 시험 범위
  examDate: date("exam_date").notNull(),
  maxScore: integer("max_score").notNull().default(100),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExamSchema = createInsertSchema(exams).pick({
  centerId: true,
  classId: true,
  name: true,
  scope: true,
  examDate: true,
  maxScore: true,
  createdBy: true,
});
export type InsertExam = z.infer<typeof insertExamSchema>;
export type Exam = typeof exams.$inferSelect;

// Exam Participants (시험 응시자)
export const examParticipants = pgTable("exam_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  examId: varchar("exam_id").notNull(),
  studentId: varchar("student_id").notNull(),
  score: integer("score"), // nullable - 점수 미입력 가능
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExamParticipantSchema = createInsertSchema(examParticipants).pick({
  examId: true,
  studentId: true,
  score: true,
});
export type InsertExamParticipant = z.infer<typeof insertExamParticipantSchema>;
export type ExamParticipant = typeof examParticipants.$inferSelect;

// Exam Papers (시험지 이미지)
export const examPapers = pgTable("exam_papers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  examId: varchar("exam_id").notNull(),
  studentId: varchar("student_id").notNull(),
  objectKey: text("object_key").notNull(), // R2 object key
  imageUrl: text("image_url").notNull(), // R2 public URL
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // 45일 후 삭제 예정
});

export const insertExamPaperSchema = createInsertSchema(examPapers).pick({
  examId: true,
  studentId: true,
  objectKey: true,
  imageUrl: true,
  expiresAt: true,
});
export type InsertExamPaper = z.infer<typeof insertExamPaperSchema>;
export type ExamPaper = typeof examPapers.$inferSelect;

// Class Videos (수업 영상)
export const classVideos = pgTable("class_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: varchar("class_id").notNull(),
  title: text("title").notNull(),
  youtubeUrl: text("youtube_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  isAllStudents: boolean("is_all_students").notNull().default(true),
  visibleTo: text("visible_to").array(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertClassVideoSchema = createInsertSchema(classVideos).pick({
  classId: true,
  title: true,
  youtubeUrl: true,
  thumbnailUrl: true,
  isAllStudents: true,
  visibleTo: true,
});
export type InsertClassVideo = z.infer<typeof insertClassVideoSchema>;
export type ClassVideo = typeof classVideos.$inferSelect;

// Textbooks (교재)
export const textbooks = pgTable("textbooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  title: text("title").notNull(),
  coverImage: text("cover_image"),
  isVisible: boolean("is_visible").notNull().default(true),
});

export const insertTextbookSchema = createInsertSchema(textbooks).pick({
  centerId: true,
  title: true,
  coverImage: true,
  isVisible: true,
});
export type InsertTextbook = z.infer<typeof insertTextbookSchema>;
export type Textbook = typeof textbooks.$inferSelect;

// Textbook Videos (교재별 풀이 영상)
export const textbookVideos = pgTable("textbook_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  textbookId: varchar("textbook_id").notNull(),
  pageNumber: integer("page_number").notNull(),
  problemNumber: integer("problem_number").notNull(),
  youtubeUrl: text("youtube_url").notNull(),
  uploadedBy: varchar("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertTextbookVideoSchema = createInsertSchema(textbookVideos).pick({
  textbookId: true,
  pageNumber: true,
  problemNumber: true,
  youtubeUrl: true,
  uploadedBy: true,
});
export type InsertTextbookVideo = z.infer<typeof insertTextbookVideoSchema>;
export type TextbookVideo = typeof textbookVideos.$inferSelect;

// ===== NEW CLINIC SYSTEM (Weekly Workflow) =====

// Clinic Students (클리닉 학생 프로필) - Persistent profile with template instructions
export const clinicStudents = pgTable("clinic_students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(), // FK to users
  regularTeacherId: varchar("regular_teacher_id").notNull(), // 담당 선생님
  clinicTeacherId: varchar("clinic_teacher_id"), // 클리닉 선생님 (can be null)
  centerId: varchar("center_id").notNull(),
  clinicType: text("clinic_type").notNull().default("middle"), // 클리닉 유형: "high" (고등) | "middle" (중등)
  grade: text("grade"), // 학년 (예: 초1, 초2, 중1, 중2, 고1, 고2, 고3)
  classGroup: text("class_group"), // 반 (예: A반, B반) - 미등록이면 null
  clinicDays: text("clinic_days").array().notNull(), // 클리닉 요일들: ['mon', 'tue'] 등 복수 선택 가능
  clinicTime: text("clinic_time"), // 클리닉 시간 (예: "12~1pm 사이 등원")
  defaultInstructions: text("default_instructions").notNull(), // 기본 지시사항 템플릿 (매주 재사용)
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClinicStudentSchema = createInsertSchema(clinicStudents).pick({
  studentId: true,
  regularTeacherId: true,
  clinicTeacherId: true,
  centerId: true,
  clinicType: true,
  grade: true,
  classGroup: true,
  clinicDays: true,
  clinicTime: true,
  defaultInstructions: true,
  isActive: true,
});
export type InsertClinicStudent = z.infer<typeof insertClinicStudentSchema>;
export type ClinicStudent = typeof clinicStudents.$inferSelect;

// Clinic Instruction Defaults (요일별 기본 지시사항) - Per teacher, per weekday defaults
export const clinicInstructionDefaults = pgTable("clinic_instruction_defaults", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicStudentId: varchar("clinic_student_id").notNull(), // FK to clinicStudents
  weekday: text("weekday").notNull(), // mon, tue, wed, thu, fri, sat
  period1Default: text("period1_default"), // 1교시 기본 지시사항
  period2Default: text("period2_default"), // 2교시 기본 지시사항
  period3Default: text("period3_default"), // 3교시 기본 지시사항
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClinicInstructionDefaultSchema = createInsertSchema(clinicInstructionDefaults).pick({
  clinicStudentId: true,
  weekday: true,
  period1Default: true,
  period2Default: true,
  period3Default: true,
});
export type InsertClinicInstructionDefault = z.infer<typeof insertClinicInstructionDefaultSchema>;
export type ClinicInstructionDefault = typeof clinicInstructionDefaults.$inferSelect;

// Clinic Weekly Records (주간 클리닉 기록) - Created each week
export const clinicWeeklyRecords = pgTable("clinic_weekly_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicStudentId: varchar("clinic_student_id").notNull(), // FK to clinicStudents
  weekStartDate: date("week_start_date").notNull(), // 주 시작일 (월요일)
  // Legacy fields (keep for backward compatibility)
  filePath: text("file_path"), // 이번 주 PDF 파일 경로
  fileName: text("file_name"), // 파일명
  additionalNotes: text("additional_notes"), // 담당선생님 추가 메모/문의사항
  clinicTeacherFeedback: text("clinic_teacher_feedback"), // 클리닉 선생님 피드백
  progressNotes: text("progress_notes"), // 오늘 공부한 부분 (상세하게)
  status: text("status").notNull().default("pending"), // pending | in_progress | completed
  // New fields for redesigned clinic
  clinicDayTimeNote: text("clinic_day_time_note"), // 클리닉요일/시간 특별 메모 (예: "1/10 안옵니다")
  weeklyEvaluation: text("weekly_evaluation"), // 담당선생님 지시사항 (1교시)
  period2Instruction: text("period2_instruction"), // 담당선생님 지시사항 (2교시)
  period3Instruction: text("period3_instruction"), // 담당선생님 지시사항 (3교시)
  clinicTeacherNotes: text("clinic_teacher_notes"), // 클리닉 선생님 기록사항
  useDefaultPeriod1: boolean("use_default_period1").notNull().default(true), // 1교시 기본값 사용 여부
  useDefaultPeriod2: boolean("use_default_period2").notNull().default(true), // 2교시 기본값 사용 여부
  useDefaultPeriod3: boolean("use_default_period3").notNull().default(true), // 3교시 기본값 사용 여부
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClinicWeeklyRecordSchema = createInsertSchema(clinicWeeklyRecords).pick({
  clinicStudentId: true,
  weekStartDate: true,
  filePath: true,
  fileName: true,
  additionalNotes: true,
  clinicTeacherFeedback: true,
  progressNotes: true,
  status: true,
  clinicDayTimeNote: true,
  weeklyEvaluation: true,
  period2Instruction: true,
  period3Instruction: true,
  clinicTeacherNotes: true,
  useDefaultPeriod1: true,
  useDefaultPeriod2: true,
  useDefaultPeriod3: true,
});
export type InsertClinicWeeklyRecord = z.infer<typeof insertClinicWeeklyRecordSchema>;
export type ClinicWeeklyRecord = typeof clinicWeeklyRecords.$inferSelect;

// Extended type for clinic student with user details
export type ClinicStudentWithDetails = ClinicStudent & {
  student?: User;
  regularTeacher?: User;
  clinicTeacher?: User;
  weeklyRecords?: ClinicWeeklyRecord[];
  instructionDefaults?: ClinicInstructionDefault[];
};

// Clinic Weekly Record Files (주간 기록 첨부파일) - PDF/Image per period
export const clinicWeeklyRecordFiles = pgTable("clinic_weekly_record_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recordId: varchar("record_id").notNull(), // FK to clinicWeeklyRecords
  period: text("period").notNull(), // weekly_evaluation | period2 | period3 | clinic_notes
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(), // Object storage path
  fileType: text("file_type").notNull(), // pdf | image | hwp | etc
  fileSize: integer("file_size"), // bytes
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertClinicWeeklyRecordFileSchema = createInsertSchema(clinicWeeklyRecordFiles).pick({
  recordId: true,
  period: true,
  fileName: true,
  filePath: true,
  fileType: true,
  fileSize: true,
});
export type InsertClinicWeeklyRecordFile = z.infer<typeof insertClinicWeeklyRecordFileSchema>;
export type ClinicWeeklyRecordFile = typeof clinicWeeklyRecordFiles.$inferSelect;

// Extended weekly record type with files
export type ClinicWeeklyRecordWithFiles = ClinicWeeklyRecord & {
  files?: ClinicWeeklyRecordFile[];
  clinicStudent?: ClinicStudentWithDetails;
};

// Clinic Shared Instruction Groups (공통 지시사항 그룹) - Groups of students sharing same instructions
export const clinicSharedInstructionGroups = pgTable("clinic_shared_instruction_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  teacherId: varchar("teacher_id").notNull(), // 담당선생님
  weekStartDate: date("week_start_date").notNull(), // 주 시작일
  period: text("period").notNull(), // weekly_evaluation | period2 | period3
  content: text("content"), // 공통 지시사항 내용
  useDefault: boolean("use_default").notNull().default(false), // 기본값 사용 여부
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClinicSharedInstructionGroupSchema = createInsertSchema(clinicSharedInstructionGroups).pick({
  centerId: true,
  teacherId: true,
  weekStartDate: true,
  period: true,
  content: true,
  useDefault: true,
});
export type InsertClinicSharedInstructionGroup = z.infer<typeof insertClinicSharedInstructionGroupSchema>;
export type ClinicSharedInstructionGroup = typeof clinicSharedInstructionGroups.$inferSelect;

// Clinic Shared Instruction Members (공통 지시사항 그룹 멤버) - Links records to shared groups
export const clinicSharedInstructionMembers = pgTable("clinic_shared_instruction_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sharedGroupId: varchar("shared_group_id").notNull(), // FK to clinicSharedInstructionGroups
  recordId: varchar("record_id").notNull(), // FK to clinicWeeklyRecords
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const insertClinicSharedInstructionMemberSchema = createInsertSchema(clinicSharedInstructionMembers).pick({
  sharedGroupId: true,
  recordId: true,
});
export type InsertClinicSharedInstructionMember = z.infer<typeof insertClinicSharedInstructionMemberSchema>;
export type ClinicSharedInstructionMember = typeof clinicSharedInstructionMembers.$inferSelect;

// Extended shared group type with members
export type ClinicSharedInstructionGroupWithMembers = ClinicSharedInstructionGroup & {
  members?: (ClinicSharedInstructionMember & { record?: ClinicWeeklyRecord })[];
};

// Clinic Resources (클리닉 자료 모음) - Shared problem files for clinic students
export const clinicResources = pgTable("clinic_resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  classId: varchar("class_id"), // 수업 ID (nullable - null이면 미지정)
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  description: text("description"), // 자료 설명
  isPermanent: boolean("is_permanent").notNull().default(false), // true = 영구 보관, false = 2주 후 자동 삭제
  weekStartDate: date("week_start_date"), // 임시 자료의 경우 주 시작일 (삭제 기준)
  uploadedById: varchar("uploaded_by_id").notNull(), // 업로더 ID
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClinicResourceSchema = createInsertSchema(clinicResources).pick({
  centerId: true,
  classId: true,
  fileName: true,
  filePath: true,
  description: true,
  isPermanent: true,
  weekStartDate: true,
  uploadedById: true,
});
export type InsertClinicResource = z.infer<typeof insertClinicResourceSchema>;
export type ClinicResource = typeof clinicResources.$inferSelect;
export type ClinicResourceWithUploader = ClinicResource & { uploader?: User; class?: Class };

// Clinic Daily Notes (클리닉 학생 날짜별 기록) - Cumulative notes for each student
export const clinicDailyNotes = pgTable("clinic_daily_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicStudentId: varchar("clinic_student_id").notNull(), // FK to clinicStudents
  noteDate: date("note_date").notNull(), // 기록 날짜
  content: text("content").notNull(), // 기록 내용
  createdById: varchar("created_by_id").notNull(), // 작성자 ID
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClinicDailyNoteSchema = createInsertSchema(clinicDailyNotes).pick({
  clinicStudentId: true,
  noteDate: true,
  content: true,
  createdById: true,
});
export type InsertClinicDailyNote = z.infer<typeof insertClinicDailyNoteSchema>;
export type ClinicDailyNote = typeof clinicDailyNotes.$inferSelect;
export type ClinicDailyNoteWithCreator = ClinicDailyNote & { creator?: User };

// ===== LEGACY CLINIC SYSTEM (kept for backwards compatibility) =====

// Clinic Assignments (클리닉 지시사항) - Regular teacher assigns to clinic teacher
export const clinicAssignments = pgTable("clinic_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  regularTeacherId: varchar("regular_teacher_id").notNull(), // 정규 선생님 (작성자)
  clinicTeacherId: varchar("clinic_teacher_id"), // 클리닉 선생님 (수행자) - null if self
  centerId: varchar("center_id").notNull(),
  assignmentDate: date("assignment_date").notNull(),
  title: text("title").notNull(),
  description: text("description"), // 전체 설명
  status: text("status").notNull().default("pending"), // pending | in_progress | completed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClinicAssignmentSchema = createInsertSchema(clinicAssignments).pick({
  studentId: true,
  regularTeacherId: true,
  clinicTeacherId: true,
  centerId: true,
  assignmentDate: true,
  title: true,
  description: true,
  status: true,
});
export type InsertClinicAssignment = z.infer<typeof insertClinicAssignmentSchema>;
export type ClinicAssignment = typeof clinicAssignments.$inferSelect;

// Clinic Assignment Steps (단계별 지시사항)
export const clinicAssignmentSteps = pgTable("clinic_assignment_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull(),
  stepOrder: integer("step_order").notNull(), // 순서
  instruction: text("instruction").notNull(), // 지시 내용
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
});

export const insertClinicAssignmentStepSchema = createInsertSchema(clinicAssignmentSteps).pick({
  assignmentId: true,
  stepOrder: true,
  instruction: true,
  isCompleted: true,
});
export type InsertClinicAssignmentStep = z.infer<typeof insertClinicAssignmentStepSchema>;
export type ClinicAssignmentStep = typeof clinicAssignmentSteps.$inferSelect;

// Clinic Assignment Files (PDF 첨부파일)
export const clinicAssignmentFiles = pgTable("clinic_assignment_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull(),
  stepId: varchar("step_id"), // null if attached to whole assignment
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileType: text("file_type").notNull(), // pdf, image, etc.
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertClinicAssignmentFileSchema = createInsertSchema(clinicAssignmentFiles).pick({
  assignmentId: true,
  stepId: true,
  fileName: true,
  filePath: true,
  fileType: true,
});
export type InsertClinicAssignmentFile = z.infer<typeof insertClinicAssignmentFileSchema>;
export type ClinicAssignmentFile = typeof clinicAssignmentFiles.$inferSelect;

// Clinic Comments (클리닉 선생님이 작성하는 코멘트)
export const clinicComments = pgTable("clinic_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull(),
  authorId: varchar("author_id").notNull(), // 작성자 (클리닉 선생님)
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClinicCommentSchema = createInsertSchema(clinicComments).pick({
  assignmentId: true,
  authorId: true,
  content: true,
});
export type InsertClinicComment = z.infer<typeof insertClinicCommentSchema>;
export type ClinicComment = typeof clinicComments.$inferSelect;

// Clinic Progress Logs (진도 기록 - 문제 풀이 기록)
export const clinicProgressLogs = pgTable("clinic_progress_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull(),
  studentId: varchar("student_id").notNull(),
  logDate: date("log_date").notNull(),
  problemsSolved: text("problems_solved"), // 푼 문제 (예: "p.25 1-5번, p.26 1-3번")
  stoppedAt: text("stopped_at"), // 어디까지 풀었는지 (예: "p.26 3번까지")
  notes: text("notes"), // 추가 메모
  createdAt: timestamp("created_at").defaultNow(),
  updatedBy: varchar("updated_by").notNull(),
});

export const insertClinicProgressLogSchema = createInsertSchema(clinicProgressLogs).pick({
  assignmentId: true,
  studentId: true,
  logDate: true,
  problemsSolved: true,
  stoppedAt: true,
  notes: true,
  updatedBy: true,
});
export type InsertClinicProgressLog = z.infer<typeof insertClinicProgressLogSchema>;
export type ClinicProgressLog = typeof clinicProgressLogs.$inferSelect;

// ============================================
// Attendance System (출결 시스템)
// ============================================

// Attendance PINs (출결 번호) - Each student has a unique PIN per center
export const attendancePins = pgTable("attendance_pins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  centerId: varchar("center_id").notNull(),
  pin: text("pin").notNull(), // 4-6 digit PIN (e.g., "1234")
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAttendancePinSchema = createInsertSchema(attendancePins).pick({
  studentId: true,
  centerId: true,
  pin: true,
  isActive: true,
});
export type InsertAttendancePin = z.infer<typeof insertAttendancePinSchema>;
export type AttendancePin = typeof attendancePins.$inferSelect;

// Teacher Check-in Settings (선생님 출근 설정)
export const teacherCheckInSettings = pgTable("teacher_check_in_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id").notNull(),
  centerId: varchar("center_id").notNull(),
  checkInCode: text("check_in_code").notNull(), // 4-digit check-in code
  smsRecipient1: text("sms_recipient_1"), // First phone number to receive SMS
  smsRecipient2: text("sms_recipient_2"), // Second phone number to receive SMS (optional)
  messageTemplate: text("message_template"), // Custom SMS message template (check-in)
  checkOutMessageTemplate: text("check_out_message_template"), // Custom SMS message template (check-out)
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTeacherCheckInSettingsSchema = createInsertSchema(teacherCheckInSettings).pick({
  teacherId: true,
  centerId: true,
  checkInCode: true,
  smsRecipient1: true,
  smsRecipient2: true,
  messageTemplate: true,
  checkOutMessageTemplate: true,
  isActive: true,
});
export type InsertTeacherCheckInSettings = z.infer<typeof insertTeacherCheckInSettingsSchema>;
export type TeacherCheckInSettings = typeof teacherCheckInSettings.$inferSelect;

// Attendance Status
export const ATTENDANCE_STATUS = {
  PENDING: "pending",    // 미확인
  PRESENT: "present",    // 등원
  LATE: "late",          // 지각
  ABSENT: "absent",      // 결석
} as const;
export type AttendanceStatus = typeof ATTENDANCE_STATUS[keyof typeof ATTENDANCE_STATUS];

// Attendance Records (출결 기록)
export const attendanceRecords = pgTable("attendance_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  centerId: varchar("center_id").notNull(),
  classId: varchar("class_id"), // Optional: which class the student is checking in for
  checkInAt: timestamp("check_in_at").notNull().defaultNow(),
  checkInDate: date("check_in_date").notNull(), // For easy date filtering
  wasLate: boolean("was_late").notNull().default(false),
  attendanceStatus: text("attendance_status").notNull().default("pending"), // pending | present | late | absent
  lateNotificationSent: boolean("late_notification_sent").notNull().default(false),
  lateNotificationSentAt: timestamp("late_notification_sent_at"),
  checkInNotificationSent: boolean("check_in_notification_sent").notNull().default(false),
  checkOutAt: timestamp("check_out_at"), // 하원 시간
  checkOutNotificationSent: boolean("check_out_notification_sent").notNull().default(false),
});

export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecords).pick({
  studentId: true,
  centerId: true,
  classId: true,
  checkInDate: true,
  wasLate: true,
  attendanceStatus: true,
});
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;

// Teacher Work Records (선생님 근무 기록)
export const teacherWorkRecords = pgTable("teacher_work_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id").notNull(),
  centerId: varchar("center_id").notNull(),
  workDate: date("work_date").notNull(), // 근무일 (YYYY-MM-DD)
  checkInAt: timestamp("check_in_at"), // 출근 시각
  checkOutAt: timestamp("check_out_at"), // 퇴근 시각
  workMinutes: integer("work_minutes"), // 근무 시간 (분 단위)
  noCheckOut: boolean("no_check_out").notNull().default(false), // 퇴근 기록 없음 여부
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTeacherWorkRecordSchema = createInsertSchema(teacherWorkRecords).pick({
  teacherId: true,
  centerId: true,
  workDate: true,
  checkInAt: true,
  checkOutAt: true,
  workMinutes: true,
  noCheckOut: true,
});
export type InsertTeacherWorkRecord = z.infer<typeof insertTeacherWorkRecordSchema>;
export type TeacherWorkRecord = typeof teacherWorkRecords.$inferSelect;

// Message Templates (알림 메시지 템플릿)
export const messageTemplates = pgTable("message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  type: text("type").notNull(), // 'check_in' | 'late' | 'check_out'
  title: text("title").notNull(),
  body: text("body").notNull(), // Supports variables like {{studentName}}, {{time}}, {{date}}
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).pick({
  centerId: true,
  type: true,
  title: true,
  body: true,
  isActive: true,
});
export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;
export type MessageTemplate = typeof messageTemplates.$inferSelect;

// Notification Logs (알림 발송 기록)
export const notificationLogs = pgTable("notification_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  attendanceRecordId: varchar("attendance_record_id"),
  templateId: varchar("template_id"),
  recipientPhone: text("recipient_phone").notNull(),
  recipientType: text("recipient_type").notNull(), // 'student' | 'mother' | 'father'
  messageType: text("message_type").notNull(), // 'check_in' | 'late' | 'check_out'
  channel: text("channel").notNull(), // 'alimtalk' | 'sms'
  status: text("status").notNull().default("pending"), // 'pending' | 'sent' | 'failed'
  errorMessage: text("error_message"),
  messageContent: text("message_content"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationLogSchema = createInsertSchema(notificationLogs).pick({
  attendanceRecordId: true,
  templateId: true,
  recipientPhone: true,
  recipientType: true,
  messageType: true,
  channel: true,
  status: true,
  errorMessage: true,
  messageContent: true,
});
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;
export type NotificationLog = typeof notificationLogs.$inferSelect;

// Extended types for frontend
export type ClassWithTeacher = Class & { teacher?: User };
export type HomeworkWithClass = Homework & { class?: Class };
export type SubmissionWithDetails = HomeworkSubmission & { homework?: Homework; student?: User };
export type AssessmentWithDetails = Assessment & { class?: Class; student?: User };
export type ClinicAssignmentWithDetails = ClinicAssignment & { 
  student?: User; 
  regularTeacher?: User; 
  clinicTeacher?: User;
  steps?: ClinicAssignmentStep[];
  files?: ClinicAssignmentFile[];
  comments?: ClinicComment[];
  progressLogs?: ClinicProgressLog[];
};

// Attendance extended types
export type AttendancePinWithStudent = AttendancePin & { student?: User };
export type AttendanceRecordWithStudent = AttendanceRecord & { student?: User };
export type AttendanceRecordWithClass = AttendanceRecord & { class?: Class };

// Class Notes (수업 공통 기록)
export const classNotes = pgTable("class_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: varchar("class_id").notNull(),
  teacherId: varchar("teacher_id").notNull(),
  noteDate: date("note_date").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClassNoteSchema = createInsertSchema(classNotes).pick({
  classId: true,
  teacherId: true,
  noteDate: true,
  content: true,
});
export type InsertClassNote = z.infer<typeof insertClassNoteSchema>;
export type ClassNote = typeof classNotes.$inferSelect;

// Student Class Notes (학생별 수업 기록)
export const studentClassNotes = pgTable("student_class_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: varchar("class_id").notNull(),
  studentId: varchar("student_id").notNull(),
  teacherId: varchar("teacher_id").notNull(),
  noteDate: date("note_date").notNull(),
  content: text("content").notNull(),
  attitudeScore: integer("attitude_score"), // 0-10 수업 태도 점수
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStudentClassNoteSchema = createInsertSchema(studentClassNotes).pick({
  classId: true,
  studentId: true,
  teacherId: true,
  noteDate: true,
  content: true,
  attitudeScore: true,
});
export type InsertStudentClassNote = z.infer<typeof insertStudentClassNoteSchema>;
export type StudentClassNote = typeof studentClassNotes.$inferSelect;

// Extended types for class notes
export type ClassNoteWithTeacher = ClassNote & { teacher?: User };
export type StudentClassNoteWithDetails = StudentClassNote & { student?: User; teacher?: User };

// SOLAPI Credentials (센터별 SMS/카카오톡 설정)
export const solapiCredentials = pgTable("solapi_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull().unique(),
  apiKey: text("api_key").notNull(),           // encrypted
  apiSecret: text("api_secret").notNull(),     // encrypted
  senderNumber: text("sender_number").notNull(), // plaintext phone number
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSolapiCredentialsSchema = createInsertSchema(solapiCredentials).pick({
  centerId: true,
  apiKey: true,
  apiSecret: true,
  senderNumber: true,
});
export type InsertSolapiCredentials = z.infer<typeof insertSolapiCredentialsSchema>;
export type SolapiCredentials = typeof solapiCredentials.$inferSelect;

// Study Cafe Settings (스터디카페 센터 설정)
export const studyCafeSettings = pgTable("study_cafe_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull().unique(),
  isEnabled: boolean("is_enabled").notNull().default(false),
  notice: text("notice"), // 공지사항
  entryPassword: text("entry_password"), // 출입 비밀번호
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStudyCafeSettingsSchema = createInsertSchema(studyCafeSettings).pick({
  centerId: true,
  isEnabled: true,
}).extend({
  notice: z.string().nullable().optional(),
  entryPassword: z.string().nullable().optional(),
});
export type InsertStudyCafeSettings = z.infer<typeof insertStudyCafeSettingsSchema>;
export type StudyCafeSettings = typeof studyCafeSettings.$inferSelect;

// Study Cafe Seats (스터디카페 좌석)
export const studyCafeSeats = pgTable("study_cafe_seats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  seatNumber: integer("seat_number").notNull(),
  row: integer("row").notNull(), // 행 (위치 정보)
  col: integer("col").notNull(), // 열 (위치 정보)
  isActive: boolean("is_active").notNull().default(true), // 좌석 사용 가능 여부
});

export const insertStudyCafeSeatSchema = createInsertSchema(studyCafeSeats).pick({
  centerId: true,
  seatNumber: true,
  row: true,
  col: true,
  isActive: true,
});
export type InsertStudyCafeSeat = z.infer<typeof insertStudyCafeSeatSchema>;
export type StudyCafeSeat = typeof studyCafeSeats.$inferSelect;

// Study Cafe Reservations (스터디카페 좌석 예약 - 2시간 단위)
export const studyCafeReservations = pgTable("study_cafe_reservations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seatId: varchar("seat_id").notNull(),
  studentId: varchar("student_id").notNull(),
  centerId: varchar("center_id").notNull(),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(), // startAt + 2시간
  status: text("status").notNull().default("active"), // active, released, expired
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStudyCafeReservationSchema = createInsertSchema(studyCafeReservations).pick({
  seatId: true,
  studentId: true,
  centerId: true,
  startAt: true,
  endAt: true,
  status: true,
});
export type InsertStudyCafeReservation = z.infer<typeof insertStudyCafeReservationSchema>;
export type StudyCafeReservation = typeof studyCafeReservations.$inferSelect;

// Study Cafe Fixed Seats (스터디카페 고정석)
export const studyCafeFixedSeats = pgTable("study_cafe_fixed_seats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seatId: varchar("seat_id").notNull(),
  studentId: varchar("student_id").notNull(),
  centerId: varchar("center_id").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  assignedById: varchar("assigned_by_id").notNull(), // 지정한 사람 (선생님/원장/관리자)
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStudyCafeFixedSeatSchema = createInsertSchema(studyCafeFixedSeats).pick({
  seatId: true,
  studentId: true,
  centerId: true,
  startDate: true,
  endDate: true,
  assignedById: true,
});
export type InsertStudyCafeFixedSeat = z.infer<typeof insertStudyCafeFixedSeatSchema>;
export type StudyCafeFixedSeat = typeof studyCafeFixedSeats.$inferSelect;

// Extended types for study cafe
export type StudyCafeSeatWithStatus = StudyCafeSeat & {
  reservation?: StudyCafeReservation & { student?: User };
  fixedSeat?: StudyCafeFixedSeat & { student?: User };
  remainingMinutes?: number;
  isAvailable: boolean;
  isFixed: boolean;
};

// Tuition Access Passwords (수강료 열람 비밀번호)
// Parents set this password for their children; students must enter it to view tuition fees
export const tuitionAccessPasswords = pgTable("tuition_access_passwords", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().unique(), // One password per student
  password: text("password").notNull(), // Plain text for simplicity (parent-set PIN)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTuitionAccessPasswordSchema = createInsertSchema(tuitionAccessPasswords).pick({
  studentId: true,
  password: true,
});
export type InsertTuitionAccessPassword = z.infer<typeof insertTuitionAccessPasswordSchema>;
export type TuitionAccessPassword = typeof tuitionAccessPasswords.$inferSelect;

// Tuition Guidance (교육비 안내)
// Per-center guidance text and images that students/parents can view
export const tuitionGuidances = pgTable("tuition_guidances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull().unique(),
  guidanceText: text("guidance_text"),
  imageUrls: text("image_urls").array().default([]),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTuitionGuidanceSchema = createInsertSchema(tuitionGuidances).pick({
  centerId: true,
  guidanceText: true,
  imageUrls: true,
});
export type InsertTuitionGuidance = z.infer<typeof insertTuitionGuidanceSchema>;
export type TuitionGuidance = typeof tuitionGuidances.$inferSelect;

// Tuition Notifications (교육비 안내 문자 발송 기록)
// Tracks SMS notifications sent to parents about education fees
export const PaymentMethod = {
  IN_PERSON: "in_person",         // 대면결제
  BANK_TRANSFER: "bank_transfer", // 계좌이체
  ZERO_PAY: "zero_pay",           // 제로페이
  ONLINE: "online",               // 비대면결제 (토스페이먼츠 등)
} as const;

export type PaymentMethodType = typeof PaymentMethod[keyof typeof PaymentMethod];

export const tuitionNotifications = pgTable("tuition_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  parentId: varchar("parent_id"), // The parent who received the notification (optional, may use phone from student)
  centerId: varchar("center_id").notNull(),
  sentById: varchar("sent_by_id").notNull(), // The principal/admin who sent it
  title: text("title"), // 결제 내역 제목 (원장이 설정, 학생에게 표시)
  
  // Fee details
  calculatedTotal: integer("calculated_total").notNull(), // Auto-calculated amount
  sentAmount: integer("sent_amount").notNull(), // Actually sent amount (may differ if modified)
  feeBreakdown: text("fee_breakdown"), // JSON: [{className, fee, isFirst}]
  
  // Payment information
  paymentMethod: text("payment_method").notNull(), // in_person, bank_transfer, zero_pay, online
  paymentDetails: text("payment_details"), // Extra info (e.g., bank account for transfer)
  
  // Message content
  messageContent: text("message_content").notNull(), // The actual SMS content sent
  recipientPhone: text("recipient_phone").notNull(), // Phone number SMS was sent to
  recipientType: text("recipient_type"), // "mother" or "father" when using student's phone fields
  
  // Status tracking
  status: text("status").notNull().default("sent"), // sent, failed
  errorMessage: text("error_message"), // Error if sending failed
  
  // Payment tracking
  paymentStatus: text("payment_status").notNull().default("pending"), // pending, paid, cancelled
  paymentMemo: text("payment_memo"), // Admin memo when changing payment status
  textbookTotal: integer("textbook_total").default(0), // Textbook fees at time of notification
  paidAt: timestamp("paid_at"), // When payment was confirmed
  
  // Toss Payments integration
  tossPaymentKey: text("toss_payment_key"), // Toss Payments paymentKey
  tossOrderId: text("toss_order_id"), // Our orderId for Toss Payments
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTuitionNotificationSchema = createInsertSchema(tuitionNotifications).pick({
  studentId: true,
  parentId: true,
  centerId: true,
  sentById: true,
  title: true,
  calculatedTotal: true,
  sentAmount: true,
  feeBreakdown: true,
  paymentMethod: true,
  paymentDetails: true,
  messageContent: true,
  recipientPhone: true,
  recipientType: true,
  status: true,
  errorMessage: true,
  paymentStatus: true,
  textbookTotal: true,
  createdAt: true,
});
export type InsertTuitionNotification = z.infer<typeof insertTuitionNotificationSchema>;
export type TuitionNotification = typeof tuitionNotifications.$inferSelect;

// Class Textbooks (수업별 교재)
export const classTextbooks = pgTable("class_textbooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: varchar("class_id").notNull(),
  centerId: varchar("center_id").notNull(),
  name: varchar("name").notNull(),
  price: integer("price").notNull().default(0),
  createdById: varchar("created_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClassTextbookSchema = createInsertSchema(classTextbooks).pick({
  classId: true,
  centerId: true,
  name: true,
  price: true,
  createdById: true,
});
export type InsertClassTextbook = z.infer<typeof insertClassTextbookSchema>;
export type ClassTextbook = typeof classTextbooks.$inferSelect;

// Student Textbook Purchases (학생 교재비 기록)
// Tracks textbook purchases for each student with individual pricing
export const studentTextbookPurchases = pgTable("student_textbook_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  centerId: varchar("center_id").notNull(),
  textbookName: varchar("textbook_name").notNull(),
  price: integer("price").notNull().default(0),
  purchaseDate: timestamp("purchase_date").defaultNow(),
  notes: text("notes"),
  classTextbookId: varchar("class_textbook_id"),
  createdById: varchar("created_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStudentTextbookPurchaseSchema = createInsertSchema(studentTextbookPurchases).pick({
  studentId: true,
  centerId: true,
  textbookName: true,
  price: true,
  purchaseDate: true,
  notes: true,
  classTextbookId: true,
  createdById: true,
});
export type InsertStudentTextbookPurchase = z.infer<typeof insertStudentTextbookPurchaseSchema>;
export type StudentTextbookPurchase = typeof studentTextbookPurchases.$inferSelect;

// Student Monthly Reports (학생 월간 보고서)
// AI-generated reports synthesizing student performance data
export const studentMonthlyReports = pgTable("student_monthly_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  centerId: varchar("center_id").notNull(),
  createdById: varchar("created_by_id").notNull(), // Teacher/admin who created/edited
  
  // Report period
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  
  // Report content
  reportContent: text("report_content").notNull(), // The actual report text
  customInstructions: text("custom_instructions"), // Teacher's custom instructions for AI
  
  // Data snapshots (JSON strings for reference)
  assessmentSummary: text("assessment_summary"), // JSON: score averages, trends
  attendanceSummary: text("attendance_summary"), // JSON: attendance rate, late count
  homeworkSummary: text("homework_summary"), // JSON: completion rate, on-time count
  clinicSummary: text("clinic_summary"), // JSON: comments summary
  videoViewingSummary: text("video_viewing_summary"), // JSON: view counts
  studyCafeSummary: text("study_cafe_summary"), // JSON: usage hours
  examResultsSummary: text("exam_results_summary"), // JSON: exam management results
  
  // SMS sending status
  smsSentAt: timestamp("sms_sent_at"),
  smsRecipients: text("sms_recipients"), // JSON: [{phone, type, sentAt}]
  smsStatus: text("sms_status"), // pending, sent, partial, failed
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStudentMonthlyReportSchema = createInsertSchema(studentMonthlyReports).pick({
  studentId: true,
  centerId: true,
  createdById: true,
  year: true,
  month: true,
  reportContent: true,
  customInstructions: true,
  assessmentSummary: true,
  attendanceSummary: true,
  homeworkSummary: true,
  clinicSummary: true,
  videoViewingSummary: true,
  studyCafeSummary: true,
  examResultsSummary: true,
  smsSentAt: true,
  smsRecipients: true,
  smsStatus: true,
});
export type InsertStudentMonthlyReport = z.infer<typeof insertStudentMonthlyReportSchema>;
export type StudentMonthlyReport = typeof studentMonthlyReports.$inferSelect;

// Notifications (알림)
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // 알림 받는 사용자
  type: text("type").notNull(), // homework_submitted, homework_due, etc.
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedId: varchar("related_id"), // 관련 숙제/수업 ID
  relatedType: text("related_type"), // homework, class, etc.
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  type: true,
  title: true,
  message: true,
  relatedId: true,
  relatedType: true,
  isRead: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// System settings (시스템 설정)
export const systemSettings = pgTable("system_settings", {
  key: varchar("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;

// Todos (투두리스트)
export const todos = pgTable("todos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  creatorId: varchar("creator_id").notNull(), // 생성자 (Admin/Principal/Teacher)
  title: text("title").notNull(), // 할일 제목
  description: text("description"), // 상세 설명
  startDate: date("start_date"), // 시작 날짜 (기간 설정용)
  dueDate: date("due_date").notNull(), // 기한 날짜
  priority: text("priority").notNull().default("medium"), // urgent, high, medium, low
  recurrence: text("recurrence").notNull().default("none"), // none, weekly, monthly
  recurrenceAnchorDate: date("recurrence_anchor_date"), // 반복 기준 날짜
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTodoSchema = createInsertSchema(todos).pick({
  centerId: true,
  creatorId: true,
  title: true,
  description: true,
  startDate: true,
  dueDate: true,
  priority: true,
  recurrence: true,
  recurrenceAnchorDate: true,
  isActive: true,
});
export type InsertTodo = z.infer<typeof insertTodoSchema>;
export type Todo = typeof todos.$inferSelect;

// Todo Assignees (투두 담당자)
export const todoAssignees = pgTable("todo_assignees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  todoId: varchar("todo_id").notNull(),
  assigneeId: varchar("assignee_id").notNull(), // 담당자 ID
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  completedForDate: date("completed_for_date"), // 반복 투두의 경우 어느 날짜에 완료했는지
});

export const insertTodoAssigneeSchema = createInsertSchema(todoAssignees).pick({
  todoId: true,
  assigneeId: true,
  isCompleted: true,
  completedAt: true,
  completedForDate: true,
});
export type InsertTodoAssignee = z.infer<typeof insertTodoAssigneeSchema>;
export type TodoAssignee = typeof todoAssignees.$inferSelect;

// Extended types for todos with details
export type TodoWithDetails = Todo & {
  creator?: User;
  assignees?: (TodoAssignee & { user?: User })[];
};

// Student Exit Reasons (학생 퇴원 사유)
export const ExitReasons = {
  PERFORMANCE: "성적/효과 불만",
  NO_INTEREST: "학업에 관심 없음/수학포기",
  HOMEWORK_MANAGEMENT: "숙제·관리 방식 불만",
  TEACHING_STYLE: "강사/수업 스타일",
  LEVEL_PLACEMENT: "레벨·반 편성",
  SCHEDULE_MISMATCH: "시간표 불일치",
  DISTANCE: "거리/동선",
  COST: "비용 부담",
  RELOCATION: "이사/전학",
  OVERLOAD: "일정 과부하(다른 학원/활동)",
  OTHER_ACADEMY: "다른 학원 이동(상위반/추천)",
  SEASONAL_PROGRAM: "윈터/썸머스쿨",
  OTHER: "기타",
} as const;

export type ExitReasonKey = keyof typeof ExitReasons;
export type ExitReasonValue = typeof ExitReasons[keyof typeof ExitReasons];

export const EXIT_REASON_LIST = Object.entries(ExitReasons).map(([key, label]) => ({
  key: key as ExitReasonKey,
  label,
}));

// Student Exit Records (학생 퇴원 기록)
export const studentExitRecords = pgTable("student_exit_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(), // 퇴원 학생 ID
  studentName: text("student_name").notNull(), // 퇴원 시점 학생 이름 (스냅샷)
  centerId: varchar("center_id").notNull(), // 센터 ID
  exitMonth: text("exit_month").notNull(), // 퇴원 월 (YYYY-MM 형식)
  reasons: text("reasons").array().notNull(), // 퇴원 사유 배열
  notes: text("notes"), // 추가 메모
  recordedBy: varchar("recorded_by").notNull(), // 기록자 ID
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStudentExitRecordSchema = createInsertSchema(studentExitRecords).pick({
  studentId: true,
  studentName: true,
  centerId: true,
  exitMonth: true,
  reasons: true,
  notes: true,
  recordedBy: true,
});
export type InsertStudentExitRecord = z.infer<typeof insertStudentExitRecordSchema>;
export type StudentExitRecord = typeof studentExitRecords.$inferSelect;

// Monthly student count snapshot for management dashboard
export const monthlyStudentSnapshots = pgTable("monthly_student_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  month: text("month").notNull(), // YYYY-MM 형식
  studentCount: integer("student_count").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMonthlyStudentSnapshotSchema = createInsertSchema(monthlyStudentSnapshots).pick({
  centerId: true,
  month: true,
  studentCount: true,
});
export type InsertMonthlyStudentSnapshot = z.infer<typeof insertMonthlyStudentSnapshotSchema>;
export type MonthlyStudentSnapshot = typeof monthlyStudentSnapshots.$inferSelect;

// Monthly Finance Snapshots (월별 재무 계산 스냅샷)
// 인건비 등 "현재 데이터" 기반 실시간 계산 결과를 월별로 동결 저장.
// 달이 지나면 이 스냅샷을 그대로 보여줘서, 이후 수강/시간표 변경이
// 지난달 재무 내역에 소급 반영되지 않도록 한다.
export const monthlyFinanceSnapshots = pgTable("monthly_finance_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  yearMonth: text("year_month").notNull(), // YYYY-MM 형식
  kind: text("kind").notNull(), // 예: "teacherSalary:<teacherId>", "scheduleHours"
  data: text("data").notNull(), // JSON 직렬화된 계산 결과
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  centerMonthKindUnique: uniqueIndex("monthly_finance_snapshots_center_month_kind_idx").on(table.centerId, table.yearMonth, table.kind),
}));

export const insertMonthlyFinanceSnapshotSchema = createInsertSchema(monthlyFinanceSnapshots).pick({
  centerId: true,
  yearMonth: true,
  kind: true,
  data: true,
});
export type InsertMonthlyFinanceSnapshot = z.infer<typeof insertMonthlyFinanceSnapshotSchema>;
export type MonthlyFinanceSnapshot = typeof monthlyFinanceSnapshots.$inferSelect;

// Marketing Campaigns (마케팅 캠페인)
export const MarketingChannels = {
  NAVER_BLOG: "네이버 블로그",
  NAVER_SEARCH: "네이버 검색광고",
  GOOGLE_ADS: "구글 광고",
  INSTAGRAM: "인스타그램",
  FACEBOOK: "페이스북",
  YOUTUBE: "유튜브",
  KAKAOTALK: "카카오톡",
  FLYER: "전단지/현수막",
  REFERRAL: "지인소개 프로모션",
  LOCAL_EVENT: "지역 행사",
  OTHER: "기타",
} as const;

export type MarketingChannelKey = keyof typeof MarketingChannels;
export type MarketingChannelValue = typeof MarketingChannels[keyof typeof MarketingChannels];

export const MARKETING_CHANNEL_LIST = Object.entries(MarketingChannels).map(([key, label]) => ({
  key: key as MarketingChannelKey,
  label,
}));

export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  name: text("name").notNull(),
  channel: text("channel").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  budget: integer("budget").notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMarketingCampaignSchema = createInsertSchema(marketingCampaigns).pick({
  centerId: true,
  name: true,
  channel: true,
  startDate: true,
  endDate: true,
  budget: true,
  notes: true,
  createdBy: true,
});
export type InsertMarketingCampaign = z.infer<typeof insertMarketingCampaignSchema>;
export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;

// Monthly Financial Records (월별 재무 기록)
// Each category has an amount and optional notes/details in JSON format
export const monthlyFinancialRecords = pgTable("monthly_financial_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  yearMonth: text("year_month").notNull(), // YYYY-MM format
  
  // 매출 (Revenue)
  revenueTuition: integer("revenue_tuition").notNull().default(0), // 수강료
  revenueTuitionDetails: text("revenue_tuition_details"), // JSON: sub-items
  
  // 인건비 (Labor costs)
  expenseRegularSalary: integer("expense_regular_salary").notNull().default(0), // 정규선생님 급여
  expenseRegularSalaryDetails: text("expense_regular_salary_details"),
  expensePartTimeSalary: integer("expense_part_time_salary").notNull().default(0), // 파트선생님 급여
  expensePartTimeSalaryDetails: text("expense_part_time_salary_details"),
  expenseHourlySalary: integer("expense_hourly_salary").notNull().default(0), // 아르바이트 급여
  expenseHourlySalaryDetails: text("expense_hourly_salary_details"),
  expenseEmployeeInsurance: integer("expense_employee_insurance").notNull().default(0), // 4대보험
  expenseEmployeeInsuranceDetails: text("expense_employee_insurance_details"),
  
  // 임대료 및 관리비
  expenseRent: integer("expense_rent").notNull().default(0),
  expenseRentDetails: text("expense_rent_details"),
  
  // 복리후생비 (간식비, 회식비, 직원교육비)
  expenseWelfare: integer("expense_welfare").notNull().default(0),
  expenseWelfareDetails: text("expense_welfare_details"),
  
  // 수도광열비 (전기, 수도, 가스)
  expenseUtilities: integer("expense_utilities").notNull().default(0),
  expenseUtilitiesDetails: text("expense_utilities_details"),
  
  // 통신비 (인터넷, 전화)
  expenseCommunication: integer("expense_communication").notNull().default(0),
  expenseCommunicationDetails: text("expense_communication_details"),
  
  // 소모품비 (복사용지, 사무용품)
  expenseSupplies: integer("expense_supplies").notNull().default(0),
  expenseSuppliesDetails: text("expense_supplies_details"),
  
  // 광고선전비
  expenseAdvertising: integer("expense_advertising").notNull().default(0),
  expenseAdvertisingDetails: text("expense_advertising_details"),
  
  // 지급수수료 (세무회계 대행료, 외주개발비, 카드수수료)
  expenseFees: integer("expense_fees").notNull().default(0),
  expenseFeesDetails: text("expense_fees_details"),
  
  // 보험료 (화재보험, 학원 책임보험)
  expenseInsurance: integer("expense_insurance").notNull().default(0),
  expenseInsuranceDetails: text("expense_insurance_details"),
  
  // 감가상각비 (인테리어, 집기, 컴퓨터)
  expenseDepreciation: integer("expense_depreciation").notNull().default(0),
  expenseDepreciationDetails: text("expense_depreciation_details"),
  
  // 차량유지비 (유류비, 차량보험료)
  expenseVehicle: integer("expense_vehicle").notNull().default(0),
  expenseVehicleDetails: text("expense_vehicle_details"),
  
  // 교육운영비 (교재비, 온라인 플랫폼 사용료)
  expenseEducation: integer("expense_education").notNull().default(0),
  expenseEducationDetails: text("expense_education_details"),
  
  // 기타판관비 (회의비)
  expenseOther: integer("expense_other").notNull().default(0),
  expenseOtherDetails: text("expense_other_details"),
  
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMonthlyFinancialRecordSchema = createInsertSchema(monthlyFinancialRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMonthlyFinancialRecord = z.infer<typeof insertMonthlyFinancialRecordSchema>;
export type MonthlyFinancialRecord = typeof monthlyFinancialRecords.$inferSelect;

// Financial expense categories for UI
export const FinancialExpenseCategories = {
  // 인건비 그룹
  labor: {
    label: "인건비",
    group: "인건비",
    items: [
      { key: "expenseRegularSalary", label: "정규선생님 급여" },
      { key: "expensePartTimeSalary", label: "파트선생님 급여" },
      { key: "expenseHourlySalary", label: "아르바이트 급여" },
      { key: "expenseEmployeeInsurance", label: "4대보험" },
    ],
  },
  // 고정비 그룹 - 매달 유지되는 금액
  rent: {
    label: "임대료 및 관리비",
    group: "고정비",
    items: [{ key: "expenseRent", label: "임대료 및 관리비" }],
  },
  utilities: {
    label: "수도광열비",
    group: "고정비",
    items: [{ key: "expenseUtilities", label: "전기, 수도, 가스" }],
  },
  communication: {
    label: "통신비",
    group: "고정비",
    items: [{ key: "expenseCommunication", label: "인터넷, 전화" }],
  },
  insurance: {
    label: "보험료",
    group: "고정비",
    items: [{ key: "expenseInsurance", label: "화재보험, 학원 책임보험" }],
  },
  depreciation: {
    label: "감가상각비",
    group: "고정비",
    items: [{ key: "expenseDepreciation", label: "인테리어, 집기, 컴퓨터" }],
  },
  // 판관비 그룹
  welfare: {
    label: "복리후생비",
    group: "판관비",
    items: [{ key: "expenseWelfare", label: "간식비, 회식비, 직원교육비" }],
  },
  supplies: {
    label: "소모품비",
    group: "판관비",
    items: [{ key: "expenseSupplies", label: "복사용지, 사무용품" }],
  },
  advertising: {
    label: "광고선전비",
    group: "판관비",
    items: [{ key: "expenseAdvertising", label: "광고선전비" }],
  },
  fees: {
    label: "지급수수료",
    group: "판관비",
    items: [{ key: "expenseFees", label: "세무회계 대행료, 외주개발비, 카드수수료" }],
  },
  vehicle: {
    label: "차량유지비",
    group: "판관비",
    items: [{ key: "expenseVehicle", label: "유류비, 차량보험료" }],
  },
  education: {
    label: "교육운영비",
    group: "판관비",
    items: [{ key: "expenseEducation", label: "교재비, 온라인 플랫폼 사용료" }],
  },
  other: {
    label: "기타판관비",
    group: "판관비",
    items: [{ key: "expenseOther", label: "회의비" }],
  },
} as const;

// Teacher Salary Settings (선생님 급여 설정 - 정규직/파트타임)
export const teacherSalarySettings = pgTable("teacher_salary_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id").notNull(),
  centerId: varchar("center_id").notNull(),
  baseSalary: integer("base_salary").notNull().default(0), // 기본급 (월)
  classBasePay: integer("class_base_pay").notNull().default(0), // 수업당 기본급 (중등) - legacy, kept for backwards compatibility
  classBasePayElementary: integer("class_base_pay_elementary").notNull().default(0), // 초등 수업당 기본급
  classBasePayMiddle: integer("class_base_pay_middle").notNull().default(0), // 중등 수업당 기본급
  classBasePayHigh: integer("class_base_pay_high").notNull().default(0), // 고등 수업당 기본급
  classBasePayAdult: integer("class_base_pay_adult").notNull().default(0), // 성인 수업당 기본급
  studentThreshold: integer("student_threshold").notNull().default(0), // 기준 인원 (legacy)
  studentThresholdElementary: integer("student_threshold_elementary").notNull().default(0), // 초등 기준 인원
  studentThresholdMiddle: integer("student_threshold_middle").notNull().default(0), // 중등 기준 인원
  studentThresholdHigh: integer("student_threshold_high").notNull().default(0), // 고등 기준 인원
  studentThresholdAdult: integer("student_threshold_adult").notNull().default(0), // 성인 기준 인원
  perStudentBonus: integer("per_student_bonus").notNull().default(0), // 초과 학생당 추가금 (legacy)
  perStudentBonusElementary: integer("per_student_bonus_elementary").notNull().default(0), // 초등 초과 학생당 추가금
  perStudentBonusMiddle: integer("per_student_bonus_middle").notNull().default(0), // 중등 초과 학생당 추가금
  perStudentBonusHigh: integer("per_student_bonus_high").notNull().default(0), // 고등 초과 학생당 추가금
  perStudentBonusAdult: integer("per_student_bonus_adult").notNull().default(0), // 성인 초과 학생당 추가금
  employmentType: text("employment_type"), // 고용형태: regular, part_time, hourly (센터별)
  wageType: text("wage_type"), // 급여유형: daily, hourly (센터별)
  hourlyRate: integer("hourly_rate"), // 시급 (센터별)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  teacherCenterUnique: uniqueIndex("teacher_center_unique").on(table.teacherId, table.centerId),
}));

export const insertTeacherSalarySettingsSchema = createInsertSchema(teacherSalarySettings).pick({
  teacherId: true,
  centerId: true,
  baseSalary: true,
  classBasePay: true,
  classBasePayElementary: true,
  classBasePayMiddle: true,
  classBasePayHigh: true,
  classBasePayAdult: true,
  studentThreshold: true,
  studentThresholdElementary: true,
  studentThresholdMiddle: true,
  studentThresholdHigh: true,
  studentThresholdAdult: true,
  perStudentBonus: true,
  perStudentBonusElementary: true,
  perStudentBonusMiddle: true,
  perStudentBonusHigh: true,
  perStudentBonusAdult: true,
  employmentType: true,
  wageType: true,
  hourlyRate: true,
});
export type InsertTeacherSalarySettings = z.infer<typeof insertTeacherSalarySettingsSchema>;
export type TeacherSalarySettings = typeof teacherSalarySettings.$inferSelect;

// Teacher salary adjustments - 급여 조정 항목 (플러스/마이너스)
export const teacherSalaryAdjustments = pgTable("teacher_salary_adjustments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id").notNull(),
  centerId: varchar("center_id").notNull(),
  yearMonth: varchar("year_month", { length: 7 }).notNull(), // YYYY-MM 형식
  amount: integer("amount").notNull(), // 양수: 추가, 음수: 차감
  description: text("description").notNull(), // 조정 사유
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"), // 생성한 관리자 ID
});

export const insertTeacherSalaryAdjustmentSchema = createInsertSchema(teacherSalaryAdjustments).pick({
  teacherId: true,
  centerId: true,
  yearMonth: true,
  amount: true,
  description: true,
  createdBy: true,
});
export type InsertTeacherSalaryAdjustment = z.infer<typeof insertTeacherSalaryAdjustmentSchema>;
export type TeacherSalaryAdjustment = typeof teacherSalaryAdjustments.$inferSelect;

// Academy Calendar Events (학원 캘린더 이벤트)
export const CalendarEventType = {
  SINGLE: "single",     // 단일 날짜 이벤트
  PERIOD: "period",     // 기간 이벤트 (선으로 연결)
  EXAM: "exam",         // 시험 일정
} as const;

export type CalendarEventTypeValue = typeof CalendarEventType[keyof typeof CalendarEventType];

export const academyCalendarEvents = pgTable("academy_calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  eventType: text("event_type").notNull().default("single"), // single | period | exam
  startDate: date("start_date").notNull(),
  endDate: date("end_date"), // null이면 단일 날짜
  color: text("color").notNull().default("#3B82F6"),
  school: text("school"), // 시험 학교명 (exam 타입 전체 기간 공통)
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAcademyCalendarEventSchema = createInsertSchema(academyCalendarEvents).pick({
  centerId: true,
  title: true,
  description: true,
  eventType: true,
  startDate: true,
  endDate: true,
  color: true,
  school: true,
  createdBy: true,
});
export type InsertAcademyCalendarEvent = z.infer<typeof insertAcademyCalendarEventSchema>;
export type AcademyCalendarEvent = typeof academyCalendarEvents.$inferSelect;

// Exam Subject Schedules (시험 과목 일정 - 날짜별 과목)
export const examSubjectSchedules = pgTable("exam_subject_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull(), // academy_calendar_events의 exam 타입 이벤트 ID
  examDate: date("exam_date").notNull(),
  subjects: text("subjects").notNull(), // 해당 날짜 시험 과목들 (예: "국어, 영어")
  grade: text("grade"), // 학년 (예: 고1) - 과목별 대상 학년
  excludedStudentIds: text("excluded_student_ids").array().default(sql`ARRAY[]::text[]`), // 보강 명단 제외 학생 ID들
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExamSubjectScheduleSchema = createInsertSchema(examSubjectSchedules).pick({
  eventId: true,
  examDate: true,
  subjects: true,
  grade: true,
  excludedStudentIds: true,
});
export type InsertExamSubjectSchedule = z.infer<typeof insertExamSubjectScheduleSchema>;
export type ExamSubjectSchedule = typeof examSubjectSchedules.$inferSelect;

// Feature Management System - 기능 관리 시스템

// Feature Categories - 상위 메뉴 (관리자가 생성/수정 가능)
export const featureCategories = pgTable("feature_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),           // 카테고리 이름 (예: "수업 관리", "학부모 기능")
  menuKey: text("menu_key").notNull().unique(), // 메뉴 키 (예: "class-management")
  description: text("description"),        // 카테고리 설명
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFeatureCategorySchema = createInsertSchema(featureCategories).pick({
  name: true,
  menuKey: true,
  description: true,
  displayOrder: true,
  isActive: true,
});
export type InsertFeatureCategory = z.infer<typeof insertFeatureCategorySchema>;
export type FeatureCategory = typeof featureCategories.$inferSelect;

// Features - 관리자가 등록한 기능들
export const FeatureType = {
  BASIC: "basic",       // 기본 기능 (모든 센터에서 기본 제공)
  OPTIONAL: "optional", // 선택 기능 (원장이 신청해서 사용)
} as const;

export type FeatureTypeValue = typeof FeatureType[keyof typeof FeatureType];

export const features = pgTable("features", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),           // 기능 이름
  description: text("description"),        // 기능 설명
  imageUrl: text("image_url"),             // 기능 설명 이미지
  videoUrl: text("video_url"),             // 영상 매뉴얼 유튜브 URL
  menuKey: text("menu_key").notNull(),     // 메뉴 키 (예: 'study-cafe', 'textbooks-videos')
  parentMenuKey: text("parent_menu_key"),  // 상위 메뉴 키 (null이면 새 메뉴로 생성) - deprecated, use categoryId
  categoryId: varchar("category_id"),      // 상위 카테고리 ID (null이면 독립 메뉴)
  featureType: text("feature_type").notNull().default("optional"), // basic | optional
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  purchasePrice: integer("purchase_price").default(0), // 기능구매비 (일회성)
  subscriptionPrice: integer("subscription_price").default(0), // 구독료 (월정액)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFeatureSchema = createInsertSchema(features).pick({
  name: true,
  description: true,
  imageUrl: true,
  videoUrl: true,
  menuKey: true,
  parentMenuKey: true,
  categoryId: true,
  featureType: true,
  isActive: true,
  displayOrder: true,
  purchasePrice: true,
  subscriptionPrice: true,
});
export type InsertFeature = z.infer<typeof insertFeatureSchema>;
export type Feature = typeof features.$inferSelect;

// Feature Request Status
export const FeatureRequestStatus = {
  PENDING: "pending",     // 대기 중
  APPROVED: "approved",   // 승인됨
  REJECTED: "rejected",   // 거절됨
} as const;

export type FeatureRequestStatusValue = typeof FeatureRequestStatus[keyof typeof FeatureRequestStatus];

// Feature Requests - 원장이 요청한 기능
export const featureRequests = pgTable("feature_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  featureId: varchar("feature_id").notNull(),   // 요청한 기능 ID
  centerId: varchar("center_id").notNull(),     // 요청한 센터 ID
  requestedBy: varchar("requested_by").notNull(), // 요청한 원장 ID
  phoneNumber: text("phone_number").notNull(),   // 원장 연락처 (필수)
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  requestNote: text("request_note"),             // 요청 메모
  responseNote: text("response_note"),           // 관리자 응답 메모
  respondedBy: varchar("responded_by"),          // 응답한 관리자 ID
  respondedAt: timestamp("responded_at"),        // 응답 시간
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFeatureRequestSchema = createInsertSchema(featureRequests).pick({
  featureId: true,
  centerId: true,
  requestedBy: true,
  phoneNumber: true,
  status: true,
  requestNote: true,
  responseNote: true,
  respondedBy: true,
});
export type InsertFeatureRequest = z.infer<typeof insertFeatureRequestSchema>;
export type FeatureRequest = typeof featureRequests.$inferSelect;

// Center Features - 센터별 활성화된 기능
export const centerFeatures = pgTable("center_features", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  featureId: varchar("feature_id").notNull(),
  isHidden: boolean("is_hidden").notNull().default(false),  // 원장이 해당 센터에서 기능 감추기
  enabledAt: timestamp("enabled_at").defaultNow(),
  enabledBy: varchar("enabled_by"),  // 활성화한 관리자 ID
});

export const insertCenterFeatureSchema = createInsertSchema(centerFeatures).pick({
  centerId: true,
  featureId: true,
  isHidden: true,
  enabledBy: true,
});
export type InsertCenterFeature = z.infer<typeof insertCenterFeatureSchema>;
export type CenterFeature = typeof centerFeatures.$inferSelect;

// Feature Suggestions - 원장이 새 기능 개발을 요청하는 테이블
export const featureSuggestions = pgTable("feature_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),     // 요청한 센터 ID
  requestedBy: varchar("requested_by").notNull(), // 요청한 원장 ID
  title: text("title").notNull(),                // 요청 제목
  description: text("description").notNull(),    // 상세 설명
  status: text("status").notNull().default("pending"), // pending | in_review | approved | rejected | completed
  adminNote: text("admin_note"),                 // 관리자 메모/응답
  respondedBy: varchar("responded_by"),          // 응답한 관리자 ID
  respondedAt: timestamp("responded_at"),        // 응답 시간
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFeatureSuggestionSchema = createInsertSchema(featureSuggestions).pick({
  centerId: true,
  requestedBy: true,
  title: true,
  description: true,
  status: true,
  adminNote: true,
  respondedBy: true,
});
export type InsertFeatureSuggestion = z.infer<typeof insertFeatureSuggestionSchema>;
export type FeatureSuggestion = typeof featureSuggestions.$inferSelect;

export const FeatureSuggestionStatus = {
  PENDING: "pending",       // 대기 중
  IN_REVIEW: "in_review",   // 검토 중
  APPROVED: "approved",     // 승인됨
  REJECTED: "rejected",     // 거절됨
  COMPLETED: "completed",   // 완료됨
} as const;

// SMS History (발송 문자 기록)
export const smsHistory = pgTable("sms_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  sentBy: varchar("sent_by").notNull(),
  studentId: varchar("student_id").notNull(),
  recipientPhone: text("recipient_phone").notNull(),
  recipientType: text("recipient_type").notNull(), // mother, father
  message: text("message").notNull(),
  status: text("status").notNull().default("sent"), // sent, failed
  errorMessage: text("error_message"),
  category: text("category"), // supplementary, attendance, report, etc.
  referenceId: varchar("reference_id"), // ID of related record (e.g., supplementary class ID)
  sentAt: timestamp("sent_at").defaultNow(),
});

export const insertSmsHistorySchema = createInsertSchema(smsHistory).omit({ id: true, sentAt: true });
export type InsertSmsHistory = z.infer<typeof insertSmsHistorySchema>;
export type SmsHistory = typeof smsHistory.$inferSelect;

// 예약 문자 (Scheduled SMS Messages)
export const scheduledSmsMessages = pgTable("scheduled_sms_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  createdBy: varchar("created_by").notNull(),
  studentIds: text("student_ids").array().notNull(), // 대상 학생 ID 목록
  message: text("message").notNull(),
  phoneTypes: text("phone_types").array().notNull(), // mother, father, student
  scheduledAt: timestamp("scheduled_at").notNull(), // 예약 발송 시간
  status: text("status").notNull().default("pending"), // pending, sent, cancelled, failed
  successCount: integer("success_count"),
  failCount: integer("fail_count"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertScheduledSmsMessageSchema = createInsertSchema(scheduledSmsMessages).omit({ id: true, status: true, successCount: true, failCount: true, createdAt: true });
export type InsertScheduledSmsMessage = z.infer<typeof insertScheduledSmsMessageSchema>;
export type ScheduledSmsMessage = typeof scheduledSmsMessages.$inferSelect;

// SMS Templates - 문자 템플릿
export const smsTemplates = pgTable("sms_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSmsTemplateSchema = createInsertSchema(smsTemplates).omit({ id: true, createdAt: true });
export type InsertSmsTemplate = z.infer<typeof insertSmsTemplateSchema>;
export type SmsTemplate = typeof smsTemplates.$inferSelect;

// User Menu Orders - 사용자별 메뉴 순서 설정
export const userMenuOrders = pgTable("user_menu_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  menuOrder: text("menu_order").notNull(), // JSON array of menu keys in order
  subMenuOrder: text("sub_menu_order"), // JSON object: { parentKey: [childKey1, childKey2, ...] }
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserMenuOrderSchema = createInsertSchema(userMenuOrders).omit({ id: true, updatedAt: true });
export type InsertUserMenuOrder = z.infer<typeof insertUserMenuOrderSchema>;
export type UserMenuOrder = typeof userMenuOrders.$inferSelect;

// User Activity Logs - 사용자 활동 로그 (앱 사용 통계용)
export const userActivityLogs = pgTable("user_activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  centerId: varchar("center_id").notNull(),
  pagePath: text("page_path").notNull(), // 방문한 페이지 경로
  sessionId: varchar("session_id").notNull(), // 세션 식별자
  visitedAt: timestamp("visited_at").defaultNow(),
  durationSeconds: integer("duration_seconds"), // 해당 페이지 체류 시간 (초)
});

export const insertUserActivityLogSchema = createInsertSchema(userActivityLogs).omit({ id: true, visitedAt: true });
export type InsertUserActivityLog = z.infer<typeof insertUserActivityLogSchema>;
export type UserActivityLog = typeof userActivityLogs.$inferSelect;

// Deleted Objects - 삭제 예정 R2 객체 추적 (10일 후 완전 삭제)
export const deletedObjects = pgTable("deleted_objects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  objectKey: text("object_key").notNull(), // R2 object key
  objectType: text("object_type").notNull(), // 'center-logo', 'homework-image', 'clinic-resource', etc.
  centerId: varchar("center_id"), // 관련 센터 ID (optional)
  deletedAt: timestamp("deleted_at").defaultNow(),
  scheduledDeleteAt: timestamp("scheduled_delete_at").notNull(), // 완전 삭제 예정 시간
});

export const insertDeletedObjectSchema = createInsertSchema(deletedObjects).omit({ id: true, deletedAt: true });
export type InsertDeletedObject = z.infer<typeof insertDeletedObjectSchema>;
export type DeletedObject = typeof deletedObjects.$inferSelect;

// Center Registrations - 학원 등록 신청
export const CenterRegistrationStatus = {
  PENDING: "pending",      // 대기 중
  PROCESSING: "processing", // 처리 중 (중복 방지용)
  APPROVED: "approved",    // 승인됨
  REJECTED: "rejected",    // 거절됨
} as const;

export type CenterRegistrationStatusType = typeof CenterRegistrationStatus[keyof typeof CenterRegistrationStatus];

export const centerRegistrations = pgTable("center_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // 센터명
  businessName: text("business_name"), // 상호명
  representativeName: text("representative_name"), // 대표자명
  businessRegistrationNumber: text("business_registration_number"), // 사업자등록번호
  businessAddress: text("business_address"), // 사업장 주소
  businessPhone: text("business_phone"), // 유선번호
  applicantName: text("applicant_name").notNull(), // 신청자 이름
  applicantPhone: text("applicant_phone").notNull(), // 신청자 전화번호
  applicantEmail: text("applicant_email"), // 신청자 이메일
  loginLogoUrl: text("login_logo_url"), // 로그인 페이지 로고
  sidebarLogoUrl: text("sidebar_logo_url"), // 사이드바 로고
  faviconUrl: text("favicon_url"), // 파비콘
  attendancePadLogoUrl: text("attendance_pad_logo_url"), // 출결패드 로고
  shortcutIconUrl: text("shortcut_icon_url"), // 홈화면 바로가기 아이콘
  tossConsentAgreed: boolean("toss_consent_agreed").default(false),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  rejectReason: text("reject_reason"), // 거절 사유
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"), // 심사 완료 시간
  reviewedBy: varchar("reviewed_by"), // 심사자 ID
});

export const insertCenterRegistrationSchema = createInsertSchema(centerRegistrations).pick({
  name: true,
  businessName: true,
  representativeName: true,
  businessRegistrationNumber: true,
  businessAddress: true,
  businessPhone: true,
  applicantName: true,
  applicantPhone: true,
  applicantEmail: true,
  loginLogoUrl: true,
  sidebarLogoUrl: true,
  faviconUrl: true,
  attendancePadLogoUrl: true,
  shortcutIconUrl: true,
});
export type InsertCenterRegistration = z.infer<typeof insertCenterRegistrationSchema>;
export type CenterRegistration = typeof centerRegistrations.$inferSelect;

// Logo Help Images - 로고 도움말 이미지 (관리자가 등록)
export const logoHelpImages = pgTable("logo_help_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  logoType: text("logo_type").notNull().unique(), // loginLogo, sidebarLogo, favicon, attendancePadLogo, shortcutIcon
  imageUrl: text("image_url").notNull(), // R2에 저장된 이미지 URL
  description: text("description"), // 도움말 설명
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLogoHelpImageSchema = createInsertSchema(logoHelpImages).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLogoHelpImage = z.infer<typeof insertLogoHelpImageSchema>;
export type LogoHelpImage = typeof logoHelpImages.$inferSelect;

// SOLAPI Manual - SOLAPI 매뉴얼 (관리자가 등록, 원장이 확인)
export const SolapiManualType = {
  BUSINESS_REGISTRATION: "business_registration", // 사업자 등록
  API_KEY: "api_key",                             // API Key 등록
  PAYMENT: "payment",                             // 결제 등록
} as const;

export type SolapiManualTypeValue = typeof SolapiManualType[keyof typeof SolapiManualType];

export const solapiManuals = pgTable("solapi_manuals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  manualType: text("manual_type").notNull().unique(), // business_registration, api_key, payment
  title: text("title").notNull(), // 매뉴얼 제목
  linkUrl: text("link_url"), // 외부 링크 URL
  imageUrl: text("image_url"), // R2에 저장된 이미지 URL
  description: text("description"), // 설명
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSolapiManualSchema = createInsertSchema(solapiManuals).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSolapiManual = z.infer<typeof insertSolapiManualSchema>;
export type SolapiManual = typeof solapiManuals.$inferSelect;

// Student Presentation Videos - 학생 수업 발표 영상
export const studentPresentationVideos = pgTable("student_presentation_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  classId: varchar("class_id").notNull(),
  centerId: varchar("center_id").notNull(),
  title: text("title").notNull(),
  youtubeUrl: text("youtube_url").notNull(),
  description: text("description"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStudentPresentationVideoSchema = createInsertSchema(studentPresentationVideos).omit({ id: true, createdAt: true });
export type InsertStudentPresentationVideo = z.infer<typeof insertStudentPresentationVideoSchema>;
export type StudentPresentationVideo = typeof studentPresentationVideos.$inferSelect;

// Google Calendar OAuth tokens (stored per center)
export const googleCalendarTokens = pgTable("google_calendar_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull().unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  calendarId: text("calendar_id").default("primary"), // 기본값: primary 캘린더
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGoogleCalendarTokenSchema = createInsertSchema(googleCalendarTokens).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGoogleCalendarToken = z.infer<typeof insertGoogleCalendarTokenSchema>;
export type GoogleCalendarToken = typeof googleCalendarTokens.$inferSelect;

// Google Calendar에서 가져온 수업과 수강 학생 연결
export const googleCalendarClassStudents = pgTable("google_calendar_class_students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  eventId: varchar("event_id").notNull(), // Google Calendar event ID
  studentId: varchar("student_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGoogleCalendarClassStudentSchema = createInsertSchema(googleCalendarClassStudents).omit({ id: true, createdAt: true });
export type InsertGoogleCalendarClassStudent = z.infer<typeof insertGoogleCalendarClassStudentSchema>;
export type GoogleCalendarClassStudent = typeof googleCalendarClassStudents.$inferSelect;

// Google Calendar 이벤트 색깔 설정
export const googleCalendarEventColors = pgTable("google_calendar_event_colors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  eventId: varchar("event_id").notNull(), // Google Calendar event ID
  colorIndex: integer("color_index").notNull(), // 0-11 색깔 인덱스
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGoogleCalendarEventColorSchema = createInsertSchema(googleCalendarEventColors).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGoogleCalendarEventColor = z.infer<typeof insertGoogleCalendarEventColorSchema>;
export type GoogleCalendarEventColor = typeof googleCalendarEventColors.$inferSelect;

// Google Calendar 이벤트 담당 선생님 연결
export const googleCalendarEventTeachers = pgTable("google_calendar_event_teachers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  eventId: varchar("event_id").notNull(), // Google Calendar event ID (or recurringEventId for recurring events)
  teacherId: varchar("teacher_id").notNull(), // 담당 선생님 ID
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGoogleCalendarEventTeacherSchema = createInsertSchema(googleCalendarEventTeachers).omit({ id: true, createdAt: true });
export type InsertGoogleCalendarEventTeacher = z.infer<typeof insertGoogleCalendarEventTeacherSchema>;
export type GoogleCalendarEventTeacher = typeof googleCalendarEventTeachers.$inferSelect;

// 교사-학생 소통 메시지 (Teacher-Student Communication Messages)
export const teacherStudentMessages = pgTable("teacher_student_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  senderId: varchar("sender_id").notNull(), // 보낸 사람 (선생님 또는 학생)
  receiverId: varchar("receiver_id").notNull(), // 받는 사람 (선생님 또는 학생)
  teacherId: varchar("teacher_id").notNull(), // 대화를 담당하는 선생님 ID (원장 조회용)
  studentId: varchar("student_id").notNull(), // 대화 대상 학생 ID
  content: text("content").notNull(),
  imageUrl: text("image_url"), // 첨부 이미지 URL (R2)
  imageObjectKey: text("image_object_key"), // R2 object key (2주 후 자동 삭제용)
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTeacherStudentMessageSchema = createInsertSchema(teacherStudentMessages).omit({ id: true, createdAt: true });
export type InsertTeacherStudentMessage = z.infer<typeof insertTeacherStudentMessageSchema>;
export type TeacherStudentMessage = typeof teacherStudentMessages.$inferSelect;

// 알림장 (Daily Notices for Parents/Students)
export const dailyNotices = pgTable("daily_notices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  studentId: varchar("student_id").notNull(), // 대상 학생
  noticeDate: date("notice_date").notNull(), // 알림장 날짜
  additionalNote: text("additional_note"), // 추가 알림 내용 (선생님이 작성)
  createdBy: varchar("created_by").notNull(), // 작성자 (선생님/원장)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDailyNoticeSchema = createInsertSchema(dailyNotices).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDailyNotice = z.infer<typeof insertDailyNoticeSchema>;
export type DailyNotice = typeof dailyNotices.$inferSelect;

// SMS 연결 가이드 단계 (SMS Setup Guide Steps)
export const smsSetupGuideSteps = pgTable("sms_setup_guide_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stepNumber: integer("step_number").notNull(), // 단계 번호 (1, 2, 3...)
  title: text("title").notNull(), // 단계 제목
  description: text("description"), // 단계 설명
  imageUrl: text("image_url"), // 가이드 이미지 URL (R2)
  linkUrl: text("link_url"), // 관련 링크 URL
  linkText: text("link_text"), // 링크 텍스트
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSmsSetupGuideStepSchema = createInsertSchema(smsSetupGuideSteps).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSmsSetupGuideStep = z.infer<typeof insertSmsSetupGuideStepSchema>;
export type SmsSetupGuideStep = typeof smsSetupGuideSteps.$inferSelect;

// 오류 제보 (Bug Reports)
export const BugReportStatus = {
  PENDING: "pending",   // 대기 중
  RESOLVED: "resolved", // 처리 완료
} as const;

export type BugReportStatusType = typeof BugReportStatus[keyof typeof BugReportStatus];

export const bugReports = pgTable("bug_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(), // 제보한 센터
  reporterId: varchar("reporter_id").notNull(), // 제보자 (원장)
  title: text("title").notNull(), // 오류 제목
  description: text("description").notNull(), // 오류 설명
  status: text("status").default("pending").notNull(), // pending, resolved
  adminNote: text("admin_note"), // 관리자 메모
  resolvedAt: timestamp("resolved_at"), // 해결 시간
  resolvedBy: varchar("resolved_by"), // 해결한 관리자
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBugReportSchema = createInsertSchema(bugReports).pick({
  centerId: true,
  reporterId: true,
  title: true,
  description: true,
});
export type InsertBugReport = z.infer<typeof insertBugReportSchema>;
export type BugReport = typeof bugReports.$inferSelect;

// 실시간 화상강의 세션 (Live Video Sessions)
export const VideoSessionStatus = {
  SCHEDULED: "scheduled", // 예정됨
  ACTIVE: "active",       // 진행 중
  ENDED: "ended",         // 종료됨
} as const;

export type VideoSessionStatusType = typeof VideoSessionStatus[keyof typeof VideoSessionStatus];

export const videoSessions = pgTable("video_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  classId: varchar("class_id").notNull(), // 대상 반
  title: text("title").notNull(), // 강의 제목
  roomName: text("room_name").notNull(), // Jitsi 방 이름 (고유)
  hostId: varchar("host_id").notNull(), // 주최자 (선생님/원장)
  status: text("status").default("scheduled").notNull(), // scheduled, active, ended
  scheduledAt: timestamp("scheduled_at"), // 예정 시간 (선택)
  startedAt: timestamp("started_at"), // 실제 시작 시간
  endedAt: timestamp("ended_at"), // 종료 시간
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVideoSessionSchema = createInsertSchema(videoSessions).omit({ id: true, createdAt: true });
export type InsertVideoSession = z.infer<typeof insertVideoSessionSchema>;
export type VideoSession = typeof videoSessions.$inferSelect;

// 화상강의 참여자 (Video Session Participants)
export const videoSessionParticipants = pgTable("video_session_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  studentId: varchar("student_id").notNull(), // 초대된 학생
  joinedAt: timestamp("joined_at"), // 참여 시간
  leftAt: timestamp("left_at"), // 퇴장 시간
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVideoSessionParticipantSchema = createInsertSchema(videoSessionParticipants).omit({ id: true, createdAt: true });
export type InsertVideoSessionParticipant = z.infer<typeof insertVideoSessionParticipantSchema>;
export type VideoSessionParticipant = typeof videoSessionParticipants.$inferSelect;

// ===== 새 학기 수업 안내 (Semester Announcements) =====

export const SemesterAnnouncementStatus = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;

export type SemesterAnnouncementStatusType = typeof SemesterAnnouncementStatus[keyof typeof SemesterAnnouncementStatus];

export const semesterAnnouncements = pgTable("semester_announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  createdById: varchar("created_by_id").notNull(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSemesterAnnouncementSchema = createInsertSchema(semesterAnnouncements).pick({
  centerId: true,
  title: true,
  description: true,
  status: true,
  createdById: true,
});
export type InsertSemesterAnnouncement = z.infer<typeof insertSemesterAnnouncementSchema>;
export type SemesterAnnouncement = typeof semesterAnnouncements.$inferSelect;

export const semesterAnnouncementClasses = pgTable("semester_announcement_classes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  announcementId: varchar("announcement_id").notNull(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  classLevel: text("class_level").notNull().default("middle"),
  teacherName: text("teacher_name"),
  teacherId: varchar("teacher_id"),
  classroom: text("classroom"),
  days: text("days").array().notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  schedule: text("schedule"),
  color: text("color").notNull().default("#3B82F6"),
  textbook: text("textbook"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertSemesterAnnouncementClassSchema = createInsertSchema(semesterAnnouncementClasses).pick({
  announcementId: true,
  name: true,
  subject: true,
  classLevel: true,
  teacherName: true,
  teacherId: true,
  classroom: true,
  days: true,
  startTime: true,
  endTime: true,
  schedule: true,
  color: true,
  textbook: true,
  notes: true,
  sortOrder: true,
});
export type InsertSemesterAnnouncementClass = z.infer<typeof insertSemesterAnnouncementClassSchema>;
export type SemesterAnnouncementClass = typeof semesterAnnouncementClasses.$inferSelect;

export const semesterRecommendations = pgTable("semester_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  announcementId: varchar("announcement_id").notNull(),
  announcementClassId: varchar("announcement_class_id").notNull(),
  studentId: varchar("student_id").notNull(),
  assignedById: varchar("assigned_by_id").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSemesterRecommendationSchema = createInsertSchema(semesterRecommendations).pick({
  announcementId: true,
  announcementClassId: true,
  studentId: true,
  assignedById: true,
  notes: true,
});
export type InsertSemesterRecommendation = z.infer<typeof insertSemesterRecommendationSchema>;
export type SemesterRecommendation = typeof semesterRecommendations.$inferSelect;

export const semesterApplications = pgTable("semester_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  announcementId: varchar("announcement_id").notNull(),
  announcementClassId: varchar("announcement_class_id").notNull(),
  studentId: varchar("student_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  announcementIdx: index("idx_semester_applications_announcement").on(table.announcementId),
  studentIdx: index("idx_semester_applications_student").on(table.studentId),
  classStudentUnique: uniqueIndex("idx_semester_applications_class_student").on(table.announcementClassId, table.studentId),
}));

export const insertSemesterApplicationSchema = createInsertSchema(semesterApplications).pick({
  announcementId: true,
  announcementClassId: true,
  studentId: true,
});
export type InsertSemesterApplication = z.infer<typeof insertSemesterApplicationSchema>;
export type SemesterApplication = typeof semesterApplications.$inferSelect;

// ===== Supplementary Classes (보충 수업) =====
export const supplementaryClasses = pgTable("supplementary_classes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  teacherId: varchar("teacher_id").notNull(),
  date: varchar("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  classroom: text("classroom"),
  reason: text("reason"),
  customReason: text("custom_reason"),
  sendReminder: boolean("send_reminder").default(false),
  reminderTime: text("reminder_time"),
  reminderSent: boolean("reminder_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSupplementaryClassSchema = createInsertSchema(supplementaryClasses).pick({
  centerId: true,
  teacherId: true,
  date: true,
  startTime: true,
  endTime: true,
  classroom: true,
  reason: true,
  customReason: true,
  sendReminder: true,
  reminderTime: true,
});
export type InsertSupplementaryClass = z.infer<typeof insertSupplementaryClassSchema>;
export type SupplementaryClass = typeof supplementaryClasses.$inferSelect;

export const supplementaryStudents = pgTable("supplementary_students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supplementaryClassId: varchar("supplementary_class_id").notNull(),
  studentId: varchar("student_id").notNull(),
  smsSent: boolean("sms_sent").default(false),
  reminderSmsSent: boolean("reminder_sms_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSupplementaryStudentSchema = createInsertSchema(supplementaryStudents).pick({
  supplementaryClassId: true,
  studentId: true,
});
export type InsertSupplementaryStudent = z.infer<typeof insertSupplementaryStudentSchema>;
export type SupplementaryStudent = typeof supplementaryStudents.$inferSelect;

// ==================== Counseling Records ====================
export const counselingRecords = pgTable("counseling_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  studentId: varchar("student_id").notNull(),
  teacherId: varchar("teacher_id").notNull(),
  counselingDate: date("counseling_date").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 신규상담 (new consultation) - 학부모 작성 영역 + 선생님 작성 영역이 한 페이지에 있음
export const newConsultations = pgTable("new_consultations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  // 학부모 기록 영역
  studentName: text("student_name").notNull(),
  gender: text("gender"), // 남 / 여
  school: text("school"),
  grade: text("grade"),
  targetSchool: text("target_school"),
  studentPhone: text("student_phone"), // 학생 핸드폰 번호
  parentPhone: text("parent_phone"), // 학부모 핸드폰 번호
  availableDays: text("available_days"), // 수업 가능 요일 (쉼표 구분: "월,수,금")
  // 선생님 기록 영역
  scores: text("scores"),
  counselingContent: text("counseling_content"),
  consultationDate: text("consultation_date"), // 상담 날짜 (yyyy-MM-dd, 저장 시 자동 기록)
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNewConsultationSchema = createInsertSchema(newConsultations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertNewConsultation = z.infer<typeof insertNewConsultationSchema>;
export type NewConsultation = typeof newConsultations.$inferSelect;

export const insertCounselingRecordSchema = createInsertSchema(counselingRecords).pick({
  centerId: true,
  studentId: true,
  teacherId: true,
  counselingDate: true,
  content: true,
});
export type InsertCounselingRecord = z.infer<typeof insertCounselingRecordSchema>;
export type CounselingRecord = typeof counselingRecords.$inferSelect;

// ==================== School Subjects (내신 과목) ====================
export const schoolSubjects = pgTable("school_subjects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  studentId: varchar("student_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSchoolSubjectSchema = createInsertSchema(schoolSubjects).pick({
  centerId: true,
  studentId: true,
  name: true,
});
export type InsertSchoolSubject = z.infer<typeof insertSchoolSubjectSchema>;
export type SchoolSubject = typeof schoolSubjects.$inferSelect;

// ==================== School Grades (내신성적) ====================
export const schoolGrades = pgTable("school_grades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  studentId: varchar("student_id").notNull(),
  enteredById: varchar("entered_by_id").notNull(),
  schoolLevel: text("school_level").notNull(), // 'middle' | 'high'
  gradeYear: integer("grade_year").notNull(), // 1, 2, 3
  semester: integer("semester").notNull(), // 1 or 2
  examType: text("exam_type").notNull(), // 'midterm' | 'final'
  subject: text("subject").notNull(),
  score: integer("score").notNull(), // 원점수 (required)
  grade: integer("grade"), // 등급 (optional, 1-9)
  rank: integer("rank"), // 석차 (optional)
  totalStudents: integer("total_students"), // 전체 인원 (optional, required if rank is set)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSchoolGradeSchema = createInsertSchema(schoolGrades).pick({
  centerId: true,
  studentId: true,
  enteredById: true,
  schoolLevel: true,
  gradeYear: true,
  semester: true,
  examType: true,
  subject: true,
  score: true,
  grade: true,
  rank: true,
  totalStudents: true,
});
export type InsertSchoolGrade = z.infer<typeof insertSchoolGradeSchema>;
export type SchoolGrade = typeof schoolGrades.$inferSelect;

// Push Subscriptions (웹 푸시 알림 구독)
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  centerId: varchar("center_id"),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).pick({
  userId: true,
  centerId: true,
  endpoint: true,
  p256dh: true,
  auth: true,
  userAgent: true,
});
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

// Textbook Progress (교재진도표)
export const textbookProgress = pgTable("textbook_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  studentId: varchar("student_id").notNull(),
  yearMonth: varchar("year_month", { length: 7 }).notNull().default("2025-01"),
  learningLevel: text("learning_level"),
  progressBook: text("progress_book"),
  reviewBook: text("review_book"),
  homeworkCalc: text("homework_calc"),
  homeworkBook: text("homework_book"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTextbookProgressSchema = createInsertSchema(textbookProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTextbookProgress = z.infer<typeof insertTextbookProgressSchema>;
export type TextbookProgress = typeof textbookProgress.$inferSelect;

// Work Journal (업무일지)
export const workJournals = pgTable("work_journals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  teacherId: varchar("teacher_id").notNull(),
  periodType: varchar("period_type", { length: 10 }).notNull(), // "day", "week", "month"
  periodValue: varchar("period_value", { length: 20 }).notNull(), // "2025-03-18", "2025-W12", "2025-03"
  commonNotes: text("common_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWorkJournalSchema = createInsertSchema(workJournals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWorkJournal = z.infer<typeof insertWorkJournalSchema>;
export type WorkJournal = typeof workJournals.$inferSelect;

// Work Journal Class Notes (업무일지 반별 기록)
export const workJournalClassNotes = pgTable("work_journal_class_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  journalId: varchar("journal_id").notNull(),
  classId: varchar("class_id").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWorkJournalClassNoteSchema = createInsertSchema(workJournalClassNotes).omit({
  id: true,
  createdAt: true,
});
export type InsertWorkJournalClassNote = z.infer<typeof insertWorkJournalClassNoteSchema>;
export type WorkJournalClassNote = typeof workJournalClassNotes.$inferSelect;

// Work Journal Student Notes (업무일지 학생별 기록)
export const workJournalStudentNotes = pgTable("work_journal_student_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  journalId: varchar("journal_id").notNull(),
  studentId: varchar("student_id").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWorkJournalStudentNoteSchema = createInsertSchema(workJournalStudentNotes).omit({
  id: true,
  createdAt: true,
});
export type InsertWorkJournalStudentNote = z.infer<typeof insertWorkJournalStudentNoteSchema>;
export type WorkJournalStudentNote = typeof workJournalStudentNotes.$inferSelect;

// SMS Credits (충전형 문자 크레딧)
export const smsCredits = pgTable("sms_credits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  balance: integer("balance").notNull().default(0),
  lowBalanceNotifyEnabled: boolean("low_balance_notify_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SmsCredit = typeof smsCredits.$inferSelect;

export const smsCreditTransactions = pgTable("sms_credit_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  amount: integer("amount").notNull(),
  type: text("type").notNull(), // charge | deduct
  description: text("description"),
  messageType: text("message_type"), // sms | lms | mms (for deductions)
  paymentKey: text("payment_key"), // TossPayments payment key
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSmsCreditTransactionSchema = createInsertSchema(smsCreditTransactions).omit({
  id: true,
  createdAt: true,
});
export type InsertSmsCreditTransaction = z.infer<typeof insertSmsCreditTransactionSchema>;
export type SmsCreditTransaction = typeof smsCreditTransactions.$inferSelect;

// Math Wrong Notes (수학 오답노트)
export const mathWorkbookFolders = pgTable("math_workbook_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  name: text("name").notNull(),
  parentId: varchar("parent_id"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMathWorkbookFolderSchema = createInsertSchema(mathWorkbookFolders).omit({
  id: true,
  createdAt: true,
});
export type InsertMathWorkbookFolder = z.infer<typeof insertMathWorkbookFolderSchema>;
export type MathWorkbookFolder = typeof mathWorkbookFolders.$inferSelect;

export const mathWorkbooks = pgTable("math_workbooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  title: text("title").notNull(),
  createdBy: varchar("created_by").notNull(),
  totalPages: integer("total_pages").default(0),
  paidPages: integer("paid_pages").default(0),
  folderId: varchar("folder_id"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMathWorkbookSchema = createInsertSchema(mathWorkbooks).omit({
  id: true,
  createdAt: true,
  deletedAt: true,
});
export type InsertMathWorkbook = z.infer<typeof insertMathWorkbookSchema>;
export type MathWorkbook = typeof mathWorkbooks.$inferSelect;

export const mathWorkbookPages = pgTable("math_workbook_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workbookId: varchar("workbook_id").notNull(),
  pageNumber: integer("page_number").notNull(),
  imageUrl: text("image_url").notNull(),
  r2ObjectKey: text("r2_object_key"),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  detectionStatus: varchar("detection_status", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMathWorkbookPageSchema = createInsertSchema(mathWorkbookPages).omit({
  id: true,
  createdAt: true,
});
export type InsertMathWorkbookPage = z.infer<typeof insertMathWorkbookPageSchema>;
export type MathWorkbookPage = typeof mathWorkbookPages.$inferSelect;

export const mathProblems = pgTable("math_problems", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pageId: varchar("page_id").notNull(),
  problemNumber: text("problem_number").notNull(),
  label: text("label"),
  imageUrl: text("image_url"),
  r2ObjectKey: text("r2_object_key"),
  cropX: integer("crop_x").notNull(),
  cropY: integer("crop_y").notNull(),
  cropWidth: integer("crop_width").notNull(),
  cropHeight: integer("crop_height").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMathProblemSchema = createInsertSchema(mathProblems).omit({
  id: true,
  createdAt: true,
});
export type InsertMathProblem = z.infer<typeof insertMathProblemSchema>;
export type MathProblem = typeof mathProblems.$inferSelect;

export const mathWrongNoteFolders = pgTable("math_wrong_note_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  name: text("name").notNull(),
  parentId: varchar("parent_id"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMathWrongNoteFolderSchema = createInsertSchema(mathWrongNoteFolders).omit({
  id: true,
  createdAt: true,
});
export type InsertMathWrongNoteFolder = z.infer<typeof insertMathWrongNoteFolderSchema>;
export type MathWrongNoteFolder = typeof mathWrongNoteFolders.$inferSelect;

export const mathWrongNotes = pgTable("math_wrong_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  workbookId: varchar("workbook_id").notNull(),
  title: text("title").notNull(),
  folderId: varchar("folder_id"),
  createdBy: varchar("created_by").notNull(),
  createdByRole: varchar("created_by_role", { length: 20 }),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMathWrongNoteSchema = createInsertSchema(mathWrongNotes).omit({
  id: true,
  createdAt: true,
  deletedAt: true,
});
export type InsertMathWrongNote = z.infer<typeof insertMathWrongNoteSchema>;
export type MathWrongNote = typeof mathWrongNotes.$inferSelect;

export const mathWrongNoteItems = pgTable("math_wrong_note_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  wrongNoteId: varchar("wrong_note_id").notNull(),
  problemId: varchar("problem_id").notNull(),
  sortOrder: integer("sort_order").default(0),
});

export const insertMathWrongNoteItemSchema = createInsertSchema(mathWrongNoteItems).omit({
  id: true,
});
export type InsertMathWrongNoteItem = z.infer<typeof insertMathWrongNoteItemSchema>;
export type MathWrongNoteItem = typeof mathWrongNoteItems.$inferSelect;

export const mathWrongNoteStudents = pgTable("math_wrong_note_students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  wrongNoteId: varchar("wrong_note_id").notNull(),
  studentId: varchar("student_id").notNull(),
  assignedBy: varchar("assigned_by").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
  solveCount: integer("solve_count").default(0).notNull(),
});

export const insertMathWrongNoteStudentSchema = createInsertSchema(mathWrongNoteStudents).omit({
  id: true,
  assignedAt: true,
});
export type InsertMathWrongNoteStudent = z.infer<typeof insertMathWrongNoteStudentSchema>;
export type MathWrongNoteStudent = typeof mathWrongNoteStudents.$inferSelect;

// Re-export chat models for OpenAI integration
export * from "./models/chat";
