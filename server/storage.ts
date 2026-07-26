import { 
  type User, type InsertUser,
  type Center, type InsertCenter,
  type UserCenter, type InsertUserCenter,
  type Class, type InsertClass,
  type Enrollment, type InsertEnrollment,
  type Homework, type InsertHomework,
  type HomeworkSubmission, type InsertHomeworkSubmission,
  type FaceToFaceCheck, type InsertFaceToFaceCheck,
  type FaceToFaceCheckResult, type InsertFaceToFaceCheckResult,
  type Assessment, type InsertAssessment,
  type ClassVideo, type InsertClassVideo,
  type Textbook, type InsertTextbook,
  type TextbookVideo, type InsertTextbookVideo,
  type ClinicAssignment, type InsertClinicAssignment,
  type ClinicAssignmentStep, type InsertClinicAssignmentStep,
  type ClinicAssignmentFile, type InsertClinicAssignmentFile,
  type ClinicComment, type InsertClinicComment,
  type ClinicProgressLog, type InsertClinicProgressLog,
  type ClinicAssignmentWithDetails,
  type ClinicStudent, type InsertClinicStudent,
  type ClinicWeeklyRecord, type InsertClinicWeeklyRecord,
  type ClinicStudentWithDetails,
  type ClinicResource, type InsertClinicResource,
  type ClinicResourceWithUploader,
  type ClinicDailyNote, type InsertClinicDailyNote,
  type ClinicDailyNoteWithCreator,
  type AttendancePin, type InsertAttendancePin,
  type TeacherCheckInSettings, type InsertTeacherCheckInSettings,
  type AttendanceRecord, type InsertAttendanceRecord,
  type TeacherWorkRecord, type InsertTeacherWorkRecord,
  type MessageTemplate, type InsertMessageTemplate,
  type NotificationLog, type InsertNotificationLog,
  type AttendancePinWithStudent, type AttendanceRecordWithStudent, type AttendanceRecordWithClass,
  type ClassNote, type InsertClassNote,
  type StudentClassNote, type InsertStudentClassNote,
  type ClassNoteWithTeacher, type StudentClassNoteWithDetails,
  type SolapiCredentials, type InsertSolapiCredentials,
  type StudyCafeSettings, type InsertStudyCafeSettings,
  type StudyCafeSeat, type InsertStudyCafeSeat,
  type StudyCafeReservation, type InsertStudyCafeReservation,
  type StudyCafeFixedSeat, type InsertStudyCafeFixedSeat,
  type StudyCafeSeatWithStatus,
  type TuitionAccessPassword,
  type TuitionGuidance,
  type TuitionNotification, type InsertTuitionNotification,
  type StudentMonthlyReport, type InsertStudentMonthlyReport,
  type Notification, type InsertNotification,
  type Todo, type InsertTodo,
  type TodoAssignee, type InsertTodoAssignee,
  type TodoWithDetails,
  type StudentExitRecord, type InsertStudentExitRecord,
  type MonthlyStudentSnapshot, type InsertMonthlyStudentSnapshot,
  UserRole,
  users,
  centers,
  userCenters,
  classes,
  enrollments,
  homework,
  homeworkSubmissions,
  faceToFaceChecks,
  faceToFaceCheckResults,
  assessments,
  classVideos,
  textbooks,
  textbookVideos,
  clinicAssignments,
  clinicAssignmentSteps,
  clinicAssignmentFiles,
  clinicComments,
  clinicProgressLogs,
  clinicStudents,
  clinicWeeklyRecords,
  clinicResources,
  clinicDailyNotes,
  clinicInstructionDefaults,
  clinicWeeklyRecordFiles,
  clinicSharedInstructionGroups,
  clinicSharedInstructionMembers,
  type ClinicInstructionDefault, type InsertClinicInstructionDefault,
  type ClinicWeeklyRecordFile, type InsertClinicWeeklyRecordFile,
  type ClinicSharedInstructionGroup, type InsertClinicSharedInstructionGroup,
  type ClinicSharedInstructionMember, type InsertClinicSharedInstructionMember,
  type ClinicSharedInstructionGroupWithMembers,
  attendancePins,
  teacherCheckInSettings,
  attendanceRecords,
  teacherWorkRecords,
  messageTemplates,
  notificationLogs,
  classNotes,
  studentClassNotes,
  solapiCredentials,
  studyCafeSettings,
  studyCafeSeats,
  studyCafeReservations,
  studyCafeFixedSeats,
  tuitionAccessPasswords,
  tuitionGuidances,
  tuitionNotifications,
  studentMonthlyReports,
  systemSettings,
  notifications,
  todos,
  todoAssignees,
  studentExitRecords,
  monthlyStudentSnapshots,
  monthlyFinanceSnapshots,
  newConsultations,
  type MonthlyFinanceSnapshot,
  marketingCampaigns,
  type MarketingCampaign, type InsertMarketingCampaign,
  monthlyFinancialRecords,
  type MonthlyFinancialRecord, type InsertMonthlyFinancialRecord,
  type SystemSetting,
  teacherSalarySettings,
  type TeacherSalarySettings, type InsertTeacherSalarySettings,
  teacherSalaryAdjustments,
  type TeacherSalaryAdjustment, type InsertTeacherSalaryAdjustment,
  classTextbooks,
  studentTextbookPurchases,
  type StudentTextbookPurchase, type InsertStudentTextbookPurchase,
  academyCalendarEvents,
  type AcademyCalendarEvent, type InsertAcademyCalendarEvent,
  examSubjectSchedules,
  type ExamSubjectSchedule, type InsertExamSubjectSchedule,
  featureCategories,
  type FeatureCategory, type InsertFeatureCategory,
  features,
  type Feature, type InsertFeature,
  featureRequests,
  type FeatureRequest, type InsertFeatureRequest,
  centerFeatures,
  type CenterFeature, type InsertCenterFeature,
  featureSuggestions,
  type FeatureSuggestion, type InsertFeatureSuggestion,
  smsHistory,
  type SmsHistory, type InsertSmsHistory,
  scheduledSmsMessages,
  type ScheduledSmsMessage, type InsertScheduledSmsMessage,
  smsTemplates,
  type SmsTemplate, type InsertSmsTemplate,
  smsCredits,
  type SmsCredit,
  smsCreditTransactions,
  type SmsCreditTransaction, type InsertSmsCreditTransaction,
  userMenuOrders,
  type UserMenuOrder, type InsertUserMenuOrder,
  userActivityLogs,
  type UserActivityLog, type InsertUserActivityLog,
  deletedObjects,
  type DeletedObject, type InsertDeletedObject,
  centerRegistrations,
  type CenterRegistration, type InsertCenterRegistration,
  logoHelpImages,
  type LogoHelpImage, type InsertLogoHelpImage,
  solapiManuals,
  type SolapiManual, type InsertSolapiManual,
  studentPresentationVideos,
  type StudentPresentationVideo, type InsertStudentPresentationVideo,
  exams,
  type Exam, type InsertExam,
  examParticipants,
  type ExamParticipant, type InsertExamParticipant,
  examPapers,
  type ExamPaper, type InsertExamPaper,
  googleCalendarTokens,
  type GoogleCalendarToken, type InsertGoogleCalendarToken,
  googleCalendarClassStudents,
  type GoogleCalendarClassStudent, type InsertGoogleCalendarClassStudent,
  googleCalendarEventColors,
  type GoogleCalendarEventColor, type InsertGoogleCalendarEventColor,
  googleCalendarEventTeachers,
  type GoogleCalendarEventTeacher,
  teacherStudentMessages,
  type TeacherStudentMessage, type InsertTeacherStudentMessage,
  dailyNotices,
  type DailyNotice, type InsertDailyNotice,
  smsSetupGuideSteps,
  type SmsSetupGuideStep, type InsertSmsSetupGuideStep,
  videoSessions,
  type VideoSession, type InsertVideoSession,
  videoSessionParticipants,
  type VideoSessionParticipant, type InsertVideoSessionParticipant,
  semesterAnnouncements,
  type SemesterAnnouncement, type InsertSemesterAnnouncement,
  semesterAnnouncementClasses,
  type SemesterAnnouncementClass, type InsertSemesterAnnouncementClass,
  semesterRecommendations,
  type SemesterRecommendation, type InsertSemesterRecommendation,
  semesterApplications,
  type SemesterApplication, type InsertSemesterApplication,
  supplementaryClasses,
  type SupplementaryClass, type InsertSupplementaryClass,
  supplementaryStudents,
  type SupplementaryStudent, type InsertSupplementaryStudent,
  pushSubscriptions,
  type PushSubscription, type InsertPushSubscription,
  textbookProgress,
  type TextbookProgress, type InsertTextbookProgress,
  workJournals,
  type WorkJournal, type InsertWorkJournal,
  workJournalClassNotes,
  type WorkJournalClassNote, type InsertWorkJournalClassNote,
  workJournalStudentNotes,
  type WorkJournalStudentNote, type InsertWorkJournalStudentNote,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, inArray, lt, desc, asc, gte, lte, isNull, isNotNull, ne, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(centerId?: string, includeWithdrawn?: boolean): Promise<User[]>;
  withdrawStudent(id: string): Promise<void>;
  reinstateStudent(id: string): Promise<{ restoredClassIds: string[]; skippedClassIds: string[] }>;
  getExpiredWithdrawnStudents(cutoff: Date): Promise<User[]>;
  deleteUser(id: string): Promise<void>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User>;
  updateUserPassword(id: string, password: string): Promise<void>;

  getCenter(id: string): Promise<Center | undefined>;
  getCenters(): Promise<Center[]>;
  createCenter(center: InsertCenter): Promise<Center>;
  updateCenter(id: string, data: Partial<InsertCenter>): Promise<Center>;
  deleteCenter(id: string): Promise<void>;
  getCenterStats(): Promise<any[]>;

  getUserCenters(userId: string): Promise<Center[]>;
  addUserToCenter(data: InsertUserCenter): Promise<UserCenter>;
  removeUserFromCenter(userId: string, centerId: string): Promise<void>;
  getCenterUsers(centerId: string, role?: number, includeWithdrawn?: boolean): Promise<User[]>;

  getClass(id: string): Promise<Class | undefined>;
  getClasses(centerId?: string, includeArchived?: boolean): Promise<Class[]>;
  createClass(cls: InsertClass): Promise<Class>;
  updateClass(id: string, data: Partial<InsertClass>): Promise<Class>;
  deleteClass(id: string): Promise<void>;
  softDeleteClass(id: string): Promise<void>;
  restoreClass(id: string): Promise<Class>;
  getDeletedClasses(centerId: string): Promise<Class[]>;
  getExpiredDeletedClasses(cutoff: Date): Promise<Class[]>;
  getClassStudents(classId: string): Promise<User[]>;

  getEnrollment(studentId: string, classId: string): Promise<Enrollment | undefined>;
  getEnrollmentById(id: string): Promise<Enrollment | undefined>;
  getStudentEnrollments(studentId: string): Promise<Enrollment[]>;
  getClassEnrollments(classId: string): Promise<Enrollment[]>;
  createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment>;
  deleteEnrollment(id: string): Promise<void>;
  checkTimeConflict(studentId: string, newClass: Class): Promise<boolean>;

  getHomework(id: string): Promise<Homework | undefined>;
  getHomeworkByClass(classId: string): Promise<Homework[]>;
  getHomeworkByCenter(centerId: string): Promise<Homework[]>;
  getStudentHomework(studentId: string, centerId?: string): Promise<Homework[]>;
  createHomework(homework: InsertHomework): Promise<Homework>;
  updateHomework(id: string, data: Partial<InsertHomework>): Promise<Homework>;
  deleteHomework(id: string): Promise<void>;

  getSubmission(id: string): Promise<HomeworkSubmission | undefined>;
  getSubmissionByHomeworkAndStudent(homeworkId: string, studentId: string): Promise<HomeworkSubmission | undefined>;
  getSubmissionsByCenter(centerId: string): Promise<any[]>;
  getStudentSubmissions(studentId: string, centerId?: string): Promise<HomeworkSubmission[]>;
  getSubmissionPhotos(id: string): Promise<string[]>;
  createSubmission(submission: InsertHomeworkSubmission): Promise<HomeworkSubmission>;
  updateSubmission(id: string, data: Partial<InsertHomeworkSubmission>): Promise<HomeworkSubmission>;

  // Face-to-Face Checks (대면검사)
  getFaceToFaceCheck(id: string): Promise<FaceToFaceCheck | undefined>;
  getFaceToFaceChecksByClass(classId: string): Promise<FaceToFaceCheck[]>;
  getFaceToFaceChecksByCenter(centerId: string): Promise<FaceToFaceCheck[]>;
  getStudentFaceToFaceChecks(studentId: string, centerId?: string): Promise<FaceToFaceCheck[]>;
  createFaceToFaceCheck(check: InsertFaceToFaceCheck): Promise<FaceToFaceCheck>;
  updateFaceToFaceCheck(id: string, data: Partial<InsertFaceToFaceCheck>): Promise<FaceToFaceCheck>;
  deleteFaceToFaceCheck(id: string): Promise<void>;

  getFaceToFaceCheckResult(id: string): Promise<FaceToFaceCheckResult | undefined>;
  getResultByCheckAndStudent(checkId: string, studentId: string): Promise<FaceToFaceCheckResult | undefined>;
  getResultsByCenter(centerId: string): Promise<any[]>;
  getStudentCheckResults(studentId: string, centerId?: string): Promise<FaceToFaceCheckResult[]>;
  createCheckResult(result: InsertFaceToFaceCheckResult): Promise<FaceToFaceCheckResult>;
  updateCheckResult(id: string, data: Partial<InsertFaceToFaceCheckResult>): Promise<FaceToFaceCheckResult>;

  getAssessment(id: string): Promise<Assessment | undefined>;
  getAssessmentsByCenter(centerId: string): Promise<any[]>;
  getStudentAssessments(studentId: string, month?: string, centerId?: string): Promise<any[]>;
  createAssessments(assessments: InsertAssessment[]): Promise<Assessment[]>;
  updateAssessment(id: string, data: { score: number; maxScore?: number }): Promise<Assessment>;
  deleteAssessment(id: string): Promise<void>;

  getClassVideos(centerId?: string): Promise<ClassVideo[]>;
  createClassVideo(video: InsertClassVideo): Promise<ClassVideo>;
  updateClassVideo(id: string, data: Partial<InsertClassVideo>): Promise<ClassVideo>;
  deleteClassVideo(id: string): Promise<void>;

  getTextbooks(centerId: string): Promise<Textbook[]>;
  createTextbook(textbook: InsertTextbook): Promise<Textbook>;
  updateTextbook(id: string, data: Partial<InsertTextbook>): Promise<Textbook>;
  deleteTextbook(id: string): Promise<void>;

  getTextbookVideos(textbookId: string): Promise<TextbookVideo[]>;
  createTextbookVideo(video: InsertTextbookVideo): Promise<TextbookVideo>;
  updateTextbookVideo(id: string, data: Partial<InsertTextbookVideo>): Promise<TextbookVideo>;
  deleteTextbookVideo(id: string): Promise<void>;

  // Clinic methods
  getClinicAssignment(id: string): Promise<ClinicAssignmentWithDetails | undefined>;
  getClinicAssignments(options: { centerId?: string; regularTeacherId?: string; clinicTeacherId?: string; studentId?: string }): Promise<ClinicAssignmentWithDetails[]>;
  createClinicAssignment(assignment: InsertClinicAssignment): Promise<ClinicAssignment>;
  updateClinicAssignment(id: string, data: Partial<InsertClinicAssignment>): Promise<ClinicAssignment>;
  deleteClinicAssignment(id: string): Promise<void>;

  createClinicAssignmentStep(step: InsertClinicAssignmentStep): Promise<ClinicAssignmentStep>;
  updateClinicAssignmentStep(id: string, data: Partial<InsertClinicAssignmentStep>): Promise<ClinicAssignmentStep>;
  deleteClinicAssignmentStep(id: string): Promise<void>;

  createClinicAssignmentFile(file: InsertClinicAssignmentFile): Promise<ClinicAssignmentFile>;
  deleteClinicAssignmentFile(id: string): Promise<void>;

  createClinicComment(comment: InsertClinicComment): Promise<ClinicComment>;
  deleteClinicComment(id: string): Promise<void>;

  getClinicProgressLogs(assignmentId: string): Promise<ClinicProgressLog[]>;
  createClinicProgressLog(log: InsertClinicProgressLog): Promise<ClinicProgressLog>;
  updateClinicProgressLog(id: string, data: Partial<InsertClinicProgressLog>): Promise<ClinicProgressLog>;

  // New Clinic System (Weekly Workflow)
  getClinicStudent(id: string): Promise<ClinicStudentWithDetails | undefined>;
  getClinicStudentByStudentAndCenter(studentId: string, centerId: string): Promise<ClinicStudent | undefined>;
  getClinicStudentByStudentCenterAndType(studentId: string, centerId: string, clinicType: string): Promise<ClinicStudent | undefined>;
  getClinicStudents(centerId: string): Promise<ClinicStudentWithDetails[]>;
  createClinicStudent(student: InsertClinicStudent): Promise<ClinicStudent>;
  updateClinicStudent(id: string, data: Partial<InsertClinicStudent>): Promise<ClinicStudent>;
  deleteClinicStudent(id: string): Promise<void>;

  getClinicWeeklyRecord(id: string): Promise<ClinicWeeklyRecord | undefined>;
  getClinicWeeklyRecords(clinicStudentId: string, weekStartDate?: string): Promise<ClinicWeeklyRecord[]>;
  getClinicWeeklyRecordsByCenter(centerId: string, weekStartDate: string): Promise<(ClinicWeeklyRecord & { clinicStudent?: ClinicStudentWithDetails })[]>;
  getClinicWeeklyRecordsByMonth(centerId: string, year: number, month: number): Promise<(ClinicWeeklyRecord & { clinicStudent?: ClinicStudentWithDetails })[]>;
  createClinicWeeklyRecord(record: InsertClinicWeeklyRecord): Promise<ClinicWeeklyRecord>;
  updateClinicWeeklyRecord(id: string, data: Partial<InsertClinicWeeklyRecord>): Promise<ClinicWeeklyRecord>;
  deleteClinicWeeklyRecord(id: string): Promise<void>;
  deleteOldClinicWeeklyRecords(centerId: string, beforeDate: string): Promise<number>;

  // Clinic Resources (자료 모음)
  getClinicResource(id: string): Promise<ClinicResource | undefined>;
  getClinicResources(centerId: string): Promise<ClinicResourceWithUploader[]>;
  createClinicResource(resource: InsertClinicResource): Promise<ClinicResource>;
  updateClinicResource(id: string, data: { classId?: string | null }): Promise<ClinicResource>;
  deleteClinicResource(id: string): Promise<void>;
  deleteOldTemporaryClinicResources(beforeDate: string): Promise<{ count: number; filePaths: string[] }>;

  // Clinic Daily Notes (날짜별 기록)
  getClinicDailyNotes(clinicStudentId: string): Promise<ClinicDailyNoteWithCreator[]>;
  createClinicDailyNote(note: InsertClinicDailyNote): Promise<ClinicDailyNote>;
  updateClinicDailyNote(id: string, data: Partial<InsertClinicDailyNote>): Promise<ClinicDailyNote>;
  deleteClinicDailyNote(id: string): Promise<void>;

  // Attendance System (출결 시스템)
  getAttendancePinByPin(centerId: string, pin: string): Promise<AttendancePinWithStudent | undefined>;
  getAttendancePinById(id: string): Promise<AttendancePin | undefined>;
  getAttendancePins(centerId: string): Promise<AttendancePinWithStudent[]>;
  getAttendancePinByStudent(studentId: string, centerId: string): Promise<AttendancePin | undefined>;
  createAttendancePin(data: InsertAttendancePin): Promise<AttendancePin>;
  updateAttendancePin(id: string, data: Partial<InsertAttendancePin>): Promise<AttendancePin>;
  deleteAttendancePin(id: string): Promise<void>;

  // Teacher Check-in Settings (선생님 출근 설정)
  getTeacherCheckInSettings(teacherId: string, centerId: string): Promise<TeacherCheckInSettings | undefined>;
  getTeacherCheckInSettingsByCode(centerId: string, code: string): Promise<(TeacherCheckInSettings & { teacher?: User }) | undefined>;
  getAllTeacherCheckInSettings(centerId: string): Promise<TeacherCheckInSettings[]>;
  createTeacherCheckInSettings(data: InsertTeacherCheckInSettings): Promise<TeacherCheckInSettings>;
  updateTeacherCheckInSettings(id: string, data: Partial<InsertTeacherCheckInSettings>): Promise<TeacherCheckInSettings>;
  deleteTeacherCheckInSettings(id: string): Promise<void>;

  getAttendanceRecords(centerId: string, date: string): Promise<AttendanceRecordWithStudent[]>;
  getAttendanceRecordsByDateWithStudents(centerId: string, date: string): Promise<(AttendanceRecord & { student?: User; class?: Class })[]>;
  getAttendanceRecordByStudentAndDate(studentId: string, date: string): Promise<AttendanceRecord | undefined>;
  getAttendanceRecordsByStudentAndDate(studentId: string, date: string): Promise<AttendanceRecord[]>;
  getAttendanceRecordByStudentDateAndClass(studentId: string, date: string, classId: string): Promise<AttendanceRecord | undefined>;
  getStudentEnrolledClasses(studentId: string, centerId: string): Promise<Class[]>;
  createAttendanceRecord(data: InsertAttendanceRecord): Promise<AttendanceRecord>;
  createAttendanceRecordCheckOutOnly(data: { studentId: string; centerId: string; checkInDate: string; checkOutAt: Date }): Promise<AttendanceRecord>;
  updateAttendanceRecord(id: string, data: Partial<AttendanceRecord>): Promise<AttendanceRecord>;
  updateAttendanceRecordCheckOut(id: string, checkOutTime: Date): Promise<void>;
  updateAttendanceRecordCheckOutNotificationSent(id: string): Promise<void>;
  getAttendanceRecordsForStudent(studentId: string, startDate: string, endDate: string): Promise<AttendanceRecordWithClass[]>;
  deleteAttendanceRecord(id: string): Promise<void>;
  deleteOldAttendanceRecords(beforeDate: string): Promise<number>;

  // Teacher Work Records (선생님 출퇴근 기록)
  getTeacherWorkRecords(centerId: string, startDate: string, endDate: string): Promise<TeacherWorkRecord[]>;
  getTeacherWorkRecordByDate(teacherId: string, centerId: string, workDate: string): Promise<TeacherWorkRecord | undefined>;
  createTeacherWorkRecord(data: InsertTeacherWorkRecord): Promise<TeacherWorkRecord>;
  updateTeacherWorkRecord(id: string, data: Partial<InsertTeacherWorkRecord>): Promise<TeacherWorkRecord>;
  getTeacherWorkRecordsWithoutCheckOut(date: string): Promise<TeacherWorkRecord[]>;
  markTeacherWorkRecordNoCheckOut(id: string): Promise<void>;
  markMissingCheckOuts(workDate: string): Promise<number>;
  deleteOldTeacherWorkRecords(beforeDate: string): Promise<number>;

  getMessageTemplates(centerId: string): Promise<MessageTemplate[]>;
  getMessageTemplate(id: string): Promise<MessageTemplate | undefined>;
  createMessageTemplate(data: InsertMessageTemplate): Promise<MessageTemplate>;
  updateMessageTemplate(id: string, data: Partial<InsertMessageTemplate>): Promise<MessageTemplate>;
  deleteMessageTemplate(id: string): Promise<void>;

  createNotificationLog(data: InsertNotificationLog): Promise<NotificationLog>;
  updateNotificationLog(id: string, data: Partial<NotificationLog>): Promise<NotificationLog>;
  getNotificationLogsByAttendanceRecord(attendanceRecordId: string): Promise<NotificationLog[]>;

  // Class Notes (수업 기록)
  getClassNotes(classId: string, noteDate: string): Promise<ClassNoteWithTeacher[]>;
  getClassNote(id: string): Promise<ClassNote | undefined>;
  createClassNote(data: InsertClassNote): Promise<ClassNote>;
  updateClassNote(id: string, data: Partial<InsertClassNote>): Promise<ClassNote>;
  deleteClassNote(id: string): Promise<void>;

  getStudentClassNotes(classId: string, noteDate: string): Promise<StudentClassNoteWithDetails[]>;
  getStudentClassNote(id: string): Promise<StudentClassNote | undefined>;
  getStudentClassNoteByKey(studentId: string, classId: string, noteDate: string): Promise<StudentClassNote | undefined>;
  upsertStudentClassNote(data: InsertStudentClassNote): Promise<StudentClassNote>;
  createStudentClassNote(data: InsertStudentClassNote): Promise<StudentClassNote>;
  updateStudentClassNote(id: string, data: Partial<InsertStudentClassNote>): Promise<StudentClassNote>;
  deleteStudentClassNote(id: string): Promise<void>;

  // SOLAPI Credentials (센터별 SMS 설정)
  getSolapiCredentials(centerId: string): Promise<SolapiCredentials | undefined>;
  getAllSolapiCredentials(): Promise<SolapiCredentials[]>;
  upsertSolapiCredentials(data: InsertSolapiCredentials): Promise<SolapiCredentials>;
  deleteSolapiCredentials(centerId: string): Promise<void>;

  // Study Cafe (스터디카페)
  getStudyCafeSettings(centerId: string): Promise<StudyCafeSettings | undefined>;
  upsertStudyCafeSettings(data: InsertStudyCafeSettings): Promise<StudyCafeSettings>;
  getStudyCafeEnabledCenters(): Promise<StudyCafeSettings[]>;
  
  getStudyCafeSeats(centerId: string): Promise<StudyCafeSeat[]>;
  createStudyCafeSeat(data: InsertStudyCafeSeat): Promise<StudyCafeSeat>;
  updateStudyCafeSeat(id: string, data: Partial<InsertStudyCafeSeat>): Promise<StudyCafeSeat>;
  deleteStudyCafeSeat(id: string): Promise<void>;
  initializeStudyCafeSeats(centerId: string): Promise<StudyCafeSeat[]>;
  
  getStudyCafeSeatsWithStatus(centerId: string): Promise<StudyCafeSeatWithStatus[]>;
  
  getActiveReservation(seatId: string): Promise<StudyCafeReservation | undefined>;
  getStudentActiveReservation(studentId: string, centerId: string): Promise<StudyCafeReservation | undefined>;
  getStudyCafeReservation(id: string): Promise<StudyCafeReservation | undefined>;
  createStudyCafeReservation(data: InsertStudyCafeReservation): Promise<StudyCafeReservation>;
  updateStudyCafeReservation(id: string, data: Partial<InsertStudyCafeReservation>): Promise<StudyCafeReservation>;
  expireOldReservations(): Promise<number>;
  
  getActiveFixedSeat(seatId: string): Promise<StudyCafeFixedSeat | undefined>;
  getStudentActiveFixedSeat(studentId: string, centerId: string): Promise<StudyCafeFixedSeat | undefined>;
  getStudyCafeFixedSeatById(id: string): Promise<StudyCafeFixedSeat | undefined>;
  getFixedSeats(centerId: string): Promise<(StudyCafeFixedSeat & { student?: User; seat?: StudyCafeSeat })[]>;
  createStudyCafeFixedSeat(data: InsertStudyCafeFixedSeat): Promise<StudyCafeFixedSeat>;
  updateStudyCafeFixedSeat(id: string, data: Partial<InsertStudyCafeFixedSeat>): Promise<StudyCafeFixedSeat>;
  deleteStudyCafeFixedSeat(id: string): Promise<void>;
  expireOldFixedSeats(): Promise<number>;

  // Tuition Access Passwords (수강료 열람 비밀번호)
  getTuitionAccessPassword(studentId: string): Promise<TuitionAccessPassword | undefined>;
  setTuitionAccessPassword(studentId: string, password: string): Promise<TuitionAccessPassword>;
  deleteTuitionAccessPassword(studentId: string): Promise<void>;

  // Tuition Guidance (교육비 안내)
  getTuitionGuidance(centerId: string): Promise<TuitionGuidance | undefined>;
  upsertTuitionGuidance(centerId: string, data: { guidanceText?: string | null; imageUrls?: string[] }): Promise<TuitionGuidance>;

  // Tuition Notifications (교육비 안내 문자)
  getTuitionNotifications(centerId: string): Promise<(TuitionNotification & { student?: User; parent?: User; sender?: User })[]>;
  getTuitionNotificationsByStudent(studentId: string, centerId?: string): Promise<TuitionNotification[]>;
  getTuitionNotificationById(id: string): Promise<TuitionNotification | undefined>;
  getTuitionNotificationByOrderId(orderId: string): Promise<TuitionNotification | undefined>;
  getPendingTuitionNotificationsWithOrderId(): Promise<TuitionNotification[]>;
  createTuitionNotification(data: InsertTuitionNotification): Promise<TuitionNotification>;
  updateTuitionNotificationPaymentStatus(id: string, paymentStatus: string, paymentMethod?: string, paymentMemo?: string): Promise<TuitionNotification | undefined>;
  deleteTuitionNotification(id: string): Promise<boolean>;
  updateTuitionNotificationTossOrderId(id: string, orderId: string): Promise<TuitionNotification | undefined>;
  updateTuitionNotificationPayment(id: string, data: { paymentStatus: string; tossPaymentKey: string; paidAt: Date; paymentMethod?: string }): Promise<TuitionNotification | undefined>;
  markTuitionNotificationPaidIfPending(id: string, data: { tossPaymentKey: string; paidAt: Date; paymentMethod?: string }): Promise<TuitionNotification | undefined>;

  // Student Monthly Reports (학생 월간 보고서)
  getStudentMonthlyReport(id: string): Promise<StudentMonthlyReport | undefined>;
  getStudentMonthlyReportByMonth(studentId: string, year: number, month: number): Promise<StudentMonthlyReport | undefined>;
  getStudentMonthlyReports(centerId: string, year: number, month: number): Promise<(StudentMonthlyReport & { student?: User; creator?: User })[]>;
  createStudentMonthlyReport(data: InsertStudentMonthlyReport): Promise<StudentMonthlyReport>;
  updateStudentMonthlyReport(id: string, data: Partial<InsertStudentMonthlyReport>): Promise<StudentMonthlyReport>;
  deleteStudentMonthlyReport(id: string): Promise<void>;

  // Notifications (알림)
  getNotifications(userId: string): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;
  deleteNotificationsByRelated(relatedId: string, type: string): Promise<void>;

  // Push Subscriptions (웹 푸시 구독)
  getPushSubscriptionsByUser(userId: string): Promise<PushSubscription[]>;
  createPushSubscription(data: InsertPushSubscription): Promise<PushSubscription>;
  deletePushSubscriptionByEndpoint(endpoint: string): Promise<void>;
  deletePushSubscriptionsByUser(userId: string): Promise<void>;

  // Todos (투두리스트)
  getTodo(id: string): Promise<TodoWithDetails | undefined>;
  getTodos(centerId: string, assigneeId?: string): Promise<TodoWithDetails[]>;
  getTodosByDate(centerId: string, date: string, assigneeId?: string): Promise<TodoWithDetails[]>;
  createTodo(todo: InsertTodo, assigneeIds: string[]): Promise<TodoWithDetails>;
  updateTodo(id: string, data: Partial<InsertTodo>, assigneeIds?: string[]): Promise<Todo>;
  deleteTodo(id: string): Promise<void>;
  
  // Todo Assignees
  toggleTodoComplete(todoId: string, assigneeId: string, date: string): Promise<TodoAssignee>;
  getTodoAssignees(todoId: string): Promise<(TodoAssignee & { user?: User })[]>;
  isTodoCompletedForDate(todoId: string, assigneeId: string, date: string): Promise<boolean>;

  // Student Exit Records (학생 퇴원 기록)
  createStudentExitRecord(data: InsertStudentExitRecord): Promise<StudentExitRecord>;
  getStudentExitRecords(centerId: string): Promise<StudentExitRecord[]>;
  getMonthlyExitSummary(centerId: string, months: number): Promise<{ month: string; exitCount: number; reasons: Record<string, number> }[]>;
  getExitRecordsByTeacher(centerId: string, months: number): Promise<{ teacherId: string; teacherName: string; exitCount: number; totalStudents: number; exitRatio: number }[]>;
  
  // Monthly Student Snapshots (월별 학생 수)
  getOrCreateMonthlySnapshot(centerId: string, month: string): Promise<MonthlyStudentSnapshot>;
  getMonthlyStudentSnapshots(centerId: string, months: number): Promise<MonthlyStudentSnapshot[]>;
  getFinanceSnapshot(centerId: string, yearMonth: string, kind: string): Promise<MonthlyFinanceSnapshot | undefined>;
  upsertFinanceSnapshot(centerId: string, yearMonth: string, kind: string, data: string): Promise<void>;
  updateMonthlyStudentCount(centerId: string, month: string): Promise<MonthlyStudentSnapshot>;

  // Marketing Campaigns (마케팅 캠페인)
  getMarketingCampaigns(centerId: string, year?: number): Promise<MarketingCampaign[]>;
  getMarketingCampaign(id: string): Promise<MarketingCampaign | undefined>;
  createMarketingCampaign(data: InsertMarketingCampaign): Promise<MarketingCampaign>;
  updateMarketingCampaign(id: string, data: Partial<InsertMarketingCampaign>): Promise<MarketingCampaign>;
  deleteMarketingCampaign(id: string): Promise<void>;

  // Monthly Financial Records
  getMonthlyFinancialRecords(centerId: string, year?: number): Promise<MonthlyFinancialRecord[]>;
  getMonthlyFinancialRecord(centerId: string, yearMonth: string): Promise<MonthlyFinancialRecord | undefined>;
  getMonthlyFinancialRecordById(id: string): Promise<MonthlyFinancialRecord | undefined>;
  createMonthlyFinancialRecord(data: InsertMonthlyFinancialRecord): Promise<MonthlyFinancialRecord>;
  updateMonthlyFinancialRecord(id: string, data: Partial<InsertMonthlyFinancialRecord>): Promise<MonthlyFinancialRecord>;
  deleteMonthlyFinancialRecord(id: string): Promise<void>;

  // Teacher Salary Settings (선생님 급여 설정)
  getTeacherSalarySettings(teacherId: string, centerId: string): Promise<TeacherSalarySettings | undefined>;
  getTeacherSalarySettingsByCenter(centerId: string): Promise<TeacherSalarySettings[]>;
  createTeacherSalarySettings(data: InsertTeacherSalarySettings): Promise<TeacherSalarySettings>;
  updateTeacherSalarySettings(id: string, data: Partial<InsertTeacherSalarySettings>): Promise<TeacherSalarySettings>;
  deleteTeacherSalarySettings(id: string): Promise<void>;

  // Teacher Salary Adjustments (급여 조정 항목)
  getTeacherSalaryAdjustments(teacherId: string, centerId: string, yearMonth: string): Promise<TeacherSalaryAdjustment[]>;
  getTeacherSalaryAdjustmentsByCenter(centerId: string, yearMonth: string): Promise<TeacherSalaryAdjustment[]>;
  createTeacherSalaryAdjustment(data: InsertTeacherSalaryAdjustment): Promise<TeacherSalaryAdjustment>;
  updateTeacherSalaryAdjustment(id: string, data: Partial<InsertTeacherSalaryAdjustment>): Promise<TeacherSalaryAdjustment>;
  deleteTeacherSalaryAdjustment(id: string): Promise<void>;

  // Student Textbook Purchases (학생 교재비)
  getStudentTextbookPurchases(studentId: string, centerId?: string): Promise<StudentTextbookPurchase[]>;
  getStudentTextbookPurchasesByCenter(centerId: string): Promise<StudentTextbookPurchase[]>;
  createStudentTextbookPurchase(data: InsertStudentTextbookPurchase): Promise<StudentTextbookPurchase>;
  updateStudentTextbookPurchase(id: string, data: Partial<InsertStudentTextbookPurchase>): Promise<StudentTextbookPurchase>;
  deleteStudentTextbookPurchase(id: string): Promise<void>;

  // Textbook Progress (교재진도표)
  getTextbookProgressByCenter(centerId: string, yearMonth?: string): Promise<TextbookProgress[]>;
  getTextbookProgressByStudent(studentId: string, centerId: string, yearMonth?: string): Promise<TextbookProgress | undefined>;
  upsertTextbookProgress(data: InsertTextbookProgress): Promise<TextbookProgress>;
  deleteTextbookProgress(id: string): Promise<void>;

  // Work Journal (업무일지)
  getWorkJournals(centerId: string, teacherId?: string): Promise<WorkJournal[]>;
  getWorkJournal(id: string): Promise<WorkJournal | undefined>;
  createWorkJournal(data: InsertWorkJournal): Promise<WorkJournal>;
  updateWorkJournal(id: string, data: Partial<InsertWorkJournal>): Promise<WorkJournal>;
  deleteWorkJournal(id: string): Promise<void>;
  getWorkJournalClassNotes(journalId: string): Promise<WorkJournalClassNote[]>;
  upsertWorkJournalClassNote(data: InsertWorkJournalClassNote): Promise<WorkJournalClassNote>;
  deleteWorkJournalClassNote(id: string): Promise<void>;
  getWorkJournalStudentNotes(journalId: string): Promise<WorkJournalStudentNote[]>;
  upsertWorkJournalStudentNote(data: InsertWorkJournalStudentNote): Promise<WorkJournalStudentNote>;
  deleteWorkJournalStudentNote(id: string): Promise<void>;

  // Academy Calendar Events (학원 캘린더)
  getAcademyCalendarEvents(centerId: string, year?: number, month?: number): Promise<AcademyCalendarEvent[]>;
  getAcademyCalendarEvent(id: string): Promise<AcademyCalendarEvent | undefined>;
  createAcademyCalendarEvent(data: InsertAcademyCalendarEvent): Promise<AcademyCalendarEvent>;
  updateAcademyCalendarEvent(id: string, data: Partial<InsertAcademyCalendarEvent>): Promise<AcademyCalendarEvent>;
  deleteAcademyCalendarEvent(id: string): Promise<void>;

  // Exam Subject Schedules (시험 과목 일정)
  getExamSubjectSchedules(eventId: string): Promise<ExamSubjectSchedule[]>;
  getExamSubjectScheduleById(id: string): Promise<ExamSubjectSchedule | undefined>;
  createExamSubjectSchedule(data: InsertExamSubjectSchedule): Promise<ExamSubjectSchedule>;
  updateExamSubjectSchedule(id: string, data: Partial<InsertExamSubjectSchedule>): Promise<ExamSubjectSchedule>;
  deleteExamSubjectSchedule(id: string): Promise<void>;
  deleteExamSubjectSchedulesByEventId(eventId: string): Promise<void>;

  // Feature Categories (상위 메뉴 관리)
  getFeatureCategories(): Promise<FeatureCategory[]>;
  getFeatureCategory(id: string): Promise<FeatureCategory | undefined>;
  getFeatureCategoryByMenuKey(menuKey: string): Promise<FeatureCategory | undefined>;
  createFeatureCategory(data: InsertFeatureCategory): Promise<FeatureCategory>;
  updateFeatureCategory(id: string, data: Partial<InsertFeatureCategory>): Promise<FeatureCategory>;
  deleteFeatureCategory(id: string): Promise<void>;

  // Feature Management (기능 관리)
  getFeatures(): Promise<Feature[]>;
  getFeature(id: string): Promise<Feature | undefined>;
  getFeatureByMenuKey(menuKey: string): Promise<Feature | undefined>;
  createFeature(data: InsertFeature): Promise<Feature>;
  updateFeature(id: string, data: Partial<InsertFeature>): Promise<Feature>;
  deleteFeature(id: string): Promise<void>;

  // Feature Requests (기능 요청)
  getFeatureRequests(centerId?: string): Promise<FeatureRequest[]>;
  getFeatureRequest(id: string): Promise<FeatureRequest | undefined>;
  createFeatureRequest(data: InsertFeatureRequest): Promise<FeatureRequest>;
  updateFeatureRequest(id: string, data: Partial<InsertFeatureRequest>): Promise<FeatureRequest>;
  deleteFeatureRequest(id: string): Promise<void>;

  // Center Features (센터별 활성화 기능)
  getCenterFeatures(centerId: string): Promise<CenterFeature[]>;
  getCenterFeature(centerId: string, featureId: string): Promise<CenterFeature | undefined>;
  createCenterFeature(data: InsertCenterFeature): Promise<CenterFeature>;
  deleteCenterFeature(id: string): Promise<void>;
  deleteCenterFeatureByIds(centerId: string, featureId: string): Promise<void>;
  toggleCenterFeatureHidden(centerId: string, featureId: string, isHidden: boolean): Promise<void>;

  // Feature Suggestions (새 기능 개발 요청)
  getFeatureSuggestions(centerId?: string): Promise<FeatureSuggestion[]>;
  getFeatureSuggestion(id: string): Promise<FeatureSuggestion | undefined>;
  createFeatureSuggestion(data: InsertFeatureSuggestion): Promise<FeatureSuggestion>;
  updateFeatureSuggestion(id: string, data: Partial<InsertFeatureSuggestion>): Promise<FeatureSuggestion>;
  deleteFeatureSuggestion(id: string): Promise<void>;

  // SMS History (문자 발송 기록)
  getSmsHistory(centerId: string): Promise<SmsHistory[]>;
  getSmsHistoryByCategory(centerId: string, category: string): Promise<SmsHistory[]>;
  getSmsHistoryByReference(referenceId: string): Promise<SmsHistory[]>;
  createSmsHistory(data: InsertSmsHistory): Promise<SmsHistory>;
  // 예약 문자 (Scheduled SMS)
  createScheduledSms(data: InsertScheduledSmsMessage): Promise<ScheduledSmsMessage>;
  getScheduledSmsByCenter(centerId: string): Promise<ScheduledSmsMessage[]>;
  getScheduledSms(id: string): Promise<ScheduledSmsMessage | undefined>;
  getDueScheduledSms(): Promise<ScheduledSmsMessage[]>;
  claimScheduledSms(id: string): Promise<ScheduledSmsMessage | undefined>;
  updateScheduledSmsStatus(id: string, status: string, successCount?: number, failCount?: number): Promise<ScheduledSmsMessage | undefined>;
  cancelScheduledSms(id: string): Promise<ScheduledSmsMessage | undefined>;

  // SMS Templates (문자 템플릿)
  getSmsTemplates(centerId: string): Promise<SmsTemplate[]>;
  createSmsTemplate(data: InsertSmsTemplate): Promise<SmsTemplate>;
  updateSmsTemplate(id: string, data: Partial<InsertSmsTemplate>): Promise<SmsTemplate>;
  deleteSmsTemplate(id: string): Promise<void>;

  // SMS Credits (충전형 문자)
  getSmsCredit(centerId: string): Promise<SmsCredit | undefined>;
  createSmsCredit(centerId: string): Promise<SmsCredit>;
  updateSmsCreditBalance(centerId: string, amount: number): Promise<SmsCredit>;
  updateSmsCreditNotifyEnabled(centerId: string, enabled: boolean): Promise<SmsCredit>;
  getSmsCreditTransactions(centerId: string, limit?: number): Promise<SmsCreditTransaction[]>;
  getAllSmsCreditTransactions(limit?: number): Promise<SmsCreditTransaction[]>;
  createSmsCreditTransaction(data: InsertSmsCreditTransaction): Promise<SmsCreditTransaction>;


  // User Menu Orders (사용자별 메뉴 순서)
  getUserMenuOrder(userId: string): Promise<UserMenuOrder | undefined>;
  saveUserMenuOrder(userId: string, menuOrder: string, subMenuOrder?: string): Promise<UserMenuOrder>;

  // Deleted Objects (삭제 예정 R2 객체)
  scheduleObjectDeletion(objectKey: string, objectType: string, centerId?: string, afterDays?: number): Promise<void>;
  getExpiredDeletedObjects(): Promise<DeletedObject[]>;
  removeDeletedObject(id: string): Promise<void>;

  // Center Registrations (학원 등록 신청)
  getCenterRegistrations(status?: string): Promise<CenterRegistration[]>;
  getCenterRegistration(id: string): Promise<CenterRegistration | undefined>;
  createCenterRegistration(data: InsertCenterRegistration): Promise<CenterRegistration>;
  updateCenterRegistration(id: string, data: Partial<CenterRegistration>): Promise<CenterRegistration>;
  approveCenterRegistration(id: string, reviewedBy: string, linkExisting?: boolean): Promise<{ center: Center; principalUser: User }>;
  rejectCenterRegistration(id: string, reviewedBy: string, rejectReason: string): Promise<CenterRegistration>;

  // Logo Help Images (로고 도움말 이미지)
  getLogoHelpImages(): Promise<LogoHelpImage[]>;
  getLogoHelpImage(logoType: string): Promise<LogoHelpImage | undefined>;
  upsertLogoHelpImage(data: InsertLogoHelpImage): Promise<LogoHelpImage>;
  deleteLogoHelpImage(logoType: string): Promise<void>;

  // SOLAPI Manuals (SOLAPI 매뉴얼)
  getSolapiManuals(): Promise<SolapiManual[]>;
  getSolapiManual(manualType: string): Promise<SolapiManual | undefined>;
  upsertSolapiManual(data: InsertSolapiManual): Promise<SolapiManual>;
  deleteSolapiManual(manualType: string): Promise<void>;

  getStudentPresentationVideos(centerId: string, classId?: string, studentId?: string): Promise<StudentPresentationVideo[]>;
  getStudentPresentationVideo(id: string): Promise<StudentPresentationVideo | undefined>;
  createStudentPresentationVideo(data: InsertStudentPresentationVideo): Promise<StudentPresentationVideo>;
  updateStudentPresentationVideo(id: string, data: Partial<InsertStudentPresentationVideo>): Promise<StudentPresentationVideo>;
  deleteStudentPresentationVideo(id: string): Promise<void>;

  // Exams (평가관리)
  getExams(centerId: string): Promise<Exam[]>;
  getExam(id: string): Promise<Exam | undefined>;
  createExam(data: InsertExam): Promise<Exam>;
  updateExam(id: string, data: Partial<InsertExam>): Promise<Exam>;
  deleteExam(id: string): Promise<void>;

  // Exam Participants (시험 응시자)
  getExamParticipants(examId: string): Promise<ExamParticipant[]>;
  getExamParticipantsByStudent(studentId: string): Promise<ExamParticipant[]>;
  createExamParticipant(data: InsertExamParticipant): Promise<ExamParticipant>;
  updateExamParticipantScore(id: string, score: number | null): Promise<ExamParticipant>;
  deleteExamParticipant(id: string): Promise<void>;
  deleteExamParticipantsByExam(examId: string): Promise<void>;

  // Exam Papers (시험지 이미지)
  getExamPapers(examId: string, studentId?: string): Promise<ExamPaper[]>;
  getExamPapersByStudent(studentId: string): Promise<ExamPaper[]>;
  createExamPaper(data: InsertExamPaper): Promise<ExamPaper>;
  deleteExamPaper(id: string): Promise<void>;
  getExpiredExamPapers(): Promise<ExamPaper[]>;
  deleteExpiredExamPapers(): Promise<void>;

  // Google Calendar
  getGoogleCalendarToken(centerId: string): Promise<GoogleCalendarToken | undefined>;
  upsertGoogleCalendarToken(data: InsertGoogleCalendarToken): Promise<GoogleCalendarToken>;
  deleteGoogleCalendarToken(centerId: string): Promise<void>;
  
  // Google Calendar Class Students
  getGoogleCalendarClassStudents(centerId: string, eventId: string): Promise<GoogleCalendarClassStudent[]>;
  getGoogleCalendarStudentEvents(centerId: string, studentId: string): Promise<GoogleCalendarClassStudent[]>;
  addGoogleCalendarClassStudent(data: InsertGoogleCalendarClassStudent): Promise<GoogleCalendarClassStudent>;
  removeGoogleCalendarClassStudent(centerId: string, eventId: string, studentId: string): Promise<void>;
  
  // Google Calendar Event Colors
  getGoogleCalendarEventColor(centerId: string, eventId: string): Promise<GoogleCalendarEventColor | undefined>;
  getGoogleCalendarEventColors(centerId: string): Promise<GoogleCalendarEventColor[]>;
  upsertGoogleCalendarEventColor(data: InsertGoogleCalendarEventColor): Promise<GoogleCalendarEventColor>;
  
  // Google Calendar Event Teachers (담당 선생님)
  getGoogleCalendarEventTeachers(centerId: string): Promise<GoogleCalendarEventTeacher[]>;
  upsertGoogleCalendarEventTeacher(data: { centerId: string; eventId: string; teacherId: string | null }): Promise<GoogleCalendarEventTeacher | null>;
  
  // Teacher-Student Messages (교사-학생 소통)
  getTeacherStudentMessages(centerId: string, teacherId: string, studentId: string): Promise<TeacherStudentMessage[]>;
  getStudentAllMessages(centerId: string, studentId: string): Promise<TeacherStudentMessage[]>;
  getTeacherStudentConversations(centerId: string, teacherId: string): Promise<{ studentId: string; lastMessage: string; lastMessageAt: Date; unreadCount: number }[]>;
  getAllTeacherStudentConversations(centerId: string): Promise<{ teacherId: string; studentId: string; lastMessage: string; lastMessageAt: Date; unreadCount: number }[]>;
  createTeacherStudentMessage(data: InsertTeacherStudentMessage): Promise<TeacherStudentMessage>;
  reassignTeacherStudentMessages(centerId: string, fromTeacherId: string, toTeacherId: string, studentId: string): Promise<number>;
  markMessagesAsRead(centerId: string, teacherId: string, studentId: string, readerId: string): Promise<void>;
  markStudentMessagesAsReadForReceiver(centerId: string, studentId: string, readerId: string): Promise<void>;
  markAllMessagesAsReadForConversation(centerId: string, teacherId: string, studentId: string): Promise<void>;

  // Daily Notices (알림장)
  getDailyNotice(centerId: string, studentId: string, noticeDate: string): Promise<DailyNotice | undefined>;
  getDailyNoticeById(id: string): Promise<DailyNotice | undefined>;
  getDailyNoticesByStudent(centerId: string, studentId: string): Promise<DailyNotice[]>;
  getDailyNoticesByCenter(centerId: string, noticeDate: string): Promise<DailyNotice[]>;
  createDailyNotice(data: InsertDailyNotice): Promise<DailyNotice>;
  updateDailyNotice(id: string, data: Partial<InsertDailyNotice>): Promise<DailyNotice>;
  deleteDailyNotice(id: string): Promise<void>;

  // Video Sessions (실시간 화상강의)
  getVideoSessions(centerId: string): Promise<VideoSession[]>;
  getVideoSession(id: string): Promise<VideoSession | undefined>;
  getActiveVideoSessionsForStudent(studentId: string): Promise<VideoSession[]>;
  createVideoSession(data: InsertVideoSession): Promise<VideoSession>;
  updateVideoSession(id: string, data: Partial<InsertVideoSession>): Promise<VideoSession>;
  deleteVideoSession(id: string): Promise<void>;
  
  // Video Session Participants (화상강의 참여자)
  getVideoSessionParticipants(sessionId: string): Promise<VideoSessionParticipant[]>;
  addVideoSessionParticipant(data: InsertVideoSessionParticipant): Promise<VideoSessionParticipant>;
  updateVideoSessionParticipant(id: string, data: Partial<InsertVideoSessionParticipant>): Promise<VideoSessionParticipant>;
  removeVideoSessionParticipant(sessionId: string, studentId: string): Promise<void>;

  // Semester Announcements (새 학기 수업 안내)
  getSemesterAnnouncements(centerId: string): Promise<SemesterAnnouncement[]>;
  getSemesterAnnouncement(id: string): Promise<SemesterAnnouncement | undefined>;
  createSemesterAnnouncement(data: InsertSemesterAnnouncement): Promise<SemesterAnnouncement>;
  updateSemesterAnnouncement(id: string, data: Partial<InsertSemesterAnnouncement>): Promise<SemesterAnnouncement>;
  deleteSemesterAnnouncement(id: string): Promise<void>;

  getSemesterAnnouncementClasses(announcementId: string): Promise<SemesterAnnouncementClass[]>;
  createSemesterAnnouncementClass(data: InsertSemesterAnnouncementClass): Promise<SemesterAnnouncementClass>;
  updateSemesterAnnouncementClass(id: string, data: Partial<InsertSemesterAnnouncementClass>): Promise<SemesterAnnouncementClass>;
  deleteSemesterAnnouncementClass(id: string): Promise<void>;

  getSemesterRecommendations(announcementId: string, studentId?: string): Promise<SemesterRecommendation[]>;
  createSemesterRecommendation(data: InsertSemesterRecommendation): Promise<SemesterRecommendation>;
  createSemesterRecommendationsBulk(data: InsertSemesterRecommendation[]): Promise<SemesterRecommendation[]>;
  updateSemesterRecommendation(id: string, data: { announcementClassId?: string; notes?: string | null }): Promise<SemesterRecommendation>;
  deleteSemesterRecommendation(id: string): Promise<void>;
  deleteSemesterRecommendationsByClass(announcementClassId: string): Promise<void>;

  getSemesterApplications(announcementId: string, studentId?: string): Promise<SemesterApplication[]>;
  getSemesterApplication(id: string): Promise<SemesterApplication | undefined>;
  getSemesterApplicationByKey(announcementClassId: string, studentId: string): Promise<SemesterApplication | undefined>;
  createSemesterApplication(data: InsertSemesterApplication): Promise<SemesterApplication>;
  deleteSemesterApplication(id: string): Promise<void>;
  deleteSemesterApplicationsByClass(announcementClassId: string): Promise<void>;
  importCurrentClassesToAnnouncement(announcementId: string, centerId: string, actorId: string): Promise<{ classesAdded: number; recommendationsAdded: number }>;

  getSupplementaryClasses(centerId: string, startDate: string, endDate: string, teacherId?: string): Promise<SupplementaryClass[]>;
  getSupplementaryClass(id: string): Promise<SupplementaryClass | undefined>;
  createSupplementaryClass(data: InsertSupplementaryClass): Promise<SupplementaryClass>;
  updateSupplementaryClass(id: string, data: Partial<InsertSupplementaryClass>): Promise<SupplementaryClass>;
  deleteSupplementaryClass(id: string): Promise<void>;
  getSupplementaryStudents(supplementaryClassId: string): Promise<SupplementaryStudent[]>;
  getSupplementaryStudentsByStudent(studentId: string, startDate: string, endDate: string): Promise<(SupplementaryStudent & { supplementaryClass: SupplementaryClass })[]>;
  addSupplementaryStudents(supplementaryClassId: string, studentIds: string[]): Promise<SupplementaryStudent[]>;
  removeSupplementaryStudent(id: string): Promise<void>;
  updateSupplementaryStudent(id: string, data: Partial<SupplementaryStudent>): Promise<void>;
  getSupplementaryClassesForReminder(tomorrowDate: string): Promise<SupplementaryClass[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    return result[0];
  }

  async checkUserExists(normalizedPhone: string | null, normalizedUsername: string): Promise<User | undefined> {
    // Efficient DB query instead of loading all users
    if (normalizedPhone) {
      const byPhone = await db.select().from(users).where(
        or(eq(users.phone, normalizedPhone), eq(users.username, normalizedPhone))
      ).limit(1);
      if (byPhone[0]) return byPhone[0];
    }
    const byUsername = await db.select().from(users).where(eq(users.username, normalizedUsername)).limit(1);
    return byUsername[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values({
      ...insertUser,
      role: insertUser.role ?? UserRole.STUDENT,
    }).returning();
    return result[0];
  }

  async getUsers(centerId?: string, includeWithdrawn: boolean = false): Promise<User[]> {
    if (!centerId) {
      const allUsers = await db.select().from(users);
      return includeWithdrawn ? allUsers : allUsers.filter(u => !u.withdrawnAt);
    }
    const ucs = await db.select().from(userCenters).where(eq(userCenters.centerId, centerId));
    const userIds = ucs.map((uc) => uc.userId);
    if (userIds.length === 0) return [];
    const result = await db.select().from(users).where(inArray(users.id, userIds));
    return includeWithdrawn ? result : result.filter(u => !u.withdrawnAt);
  }

  async deleteUser(id: string): Promise<void> {
    // Get user to check role
    const user = await this.getUser(id);

    // Wrap the whole deletion in a transaction so we never leave orphan rows
    // (e.g., an attendance_pins row whose student no longer exists) when a
    // later step fails. Previously each delete ran independently, which could
    // leave a stale PIN that still works on the attendance pad.
    await db.transaction(async (tx) => {
      // If teacher or higher, archive their classes instead of deleting
      // This preserves homework/assessment history for students
      if (user && user.role >= UserRole.TEACHER) {
        // Find all classes taught by this teacher
        const teacherClasses = await tx.select().from(classes).where(eq(classes.teacherId, id));
        const classIds = teacherClasses.map(c => c.id);

        if (classIds.length > 0) {
          // Delete homework submissions first (child of homework)
          const teacherHomework = await tx.select({ id: homework.id }).from(homework).where(inArray(homework.classId, classIds));
          const homeworkIds = teacherHomework.map(h => h.id);
          if (homeworkIds.length > 0) {
            await tx.delete(homeworkSubmissions).where(inArray(homeworkSubmissions.homeworkId, homeworkIds));
          }

          // Delete textbook purchases linked to class textbooks
          const teacherTextbooks = await tx.select({ id: classTextbooks.id }).from(classTextbooks).where(inArray(classTextbooks.classId, classIds));
          const textbookIds = teacherTextbooks.map(t => t.id);
          if (textbookIds.length > 0) {
            await tx.delete(studentTextbookPurchases).where(inArray(studentTextbookPurchases.classTextbookId, textbookIds));
          }
          await tx.delete(classTextbooks).where(inArray(classTextbooks.classId, classIds));

          // Delete all class-related data
          await tx.delete(classVideos).where(inArray(classVideos.classId, classIds));
          await tx.delete(enrollments).where(inArray(enrollments.classId, classIds));
          await tx.delete(classNotes).where(inArray(classNotes.classId, classIds));
          await tx.delete(studentClassNotes).where(inArray(studentClassNotes.classId, classIds));
          await tx.delete(homework).where(inArray(homework.classId, classIds));
          await tx.delete(assessments).where(inArray(assessments.classId, classIds));
          await tx.delete(attendanceRecords).where(inArray(attendanceRecords.classId, classIds));
          await tx.delete(faceToFaceChecks).where(inArray(faceToFaceChecks.classId, classIds));

          // Finally delete the classes
          await tx.delete(classes).where(inArray(classes.id, classIds));
        }

        // Also handle classes where this teacher is assistant teacher
        // Cleanup both legacy single-id column and new multi-id array column
        const assistantClasses = await tx
          .select()
          .from(classes)
          .where(or(eq(classes.assistantTeacherId, id), sql`${id} = ANY(${classes.assistantTeacherIds})`));
        if (assistantClasses.length > 0) {
          for (const cls of assistantClasses) {
            const remainingIds = (cls.assistantTeacherIds ?? []).filter((aid) => aid !== id);
            await tx.update(classes).set({
              assistantTeacherId: cls.assistantTeacherId === id ? (remainingIds[0] ?? null) : cls.assistantTeacherId,
              assistantTeacherIds: remainingIds,
            }).where(eq(classes.id, cls.id));
          }
        }

        // Free up any teacher check-in codes so they don't clash with future codes/PINs
        await tx.delete(teacherCheckInSettings).where(eq(teacherCheckInSettings.teacherId, id));
      }

      // For students: snapshot an exit record (per center) BEFORE deleting, so
      // their name can still be shown as "이름 (퇴원생)" in tuition/homework
      // history after the hard delete. Skip centers that already have a
      // manually-recorded exit record for this student.
      if (user && user.role === UserRole.STUDENT && user.accountType !== "parent" && user.name) {
        const centerRows = await tx.select().from(userCenters).where(eq(userCenters.userId, id));
        const centerIds = Array.from(new Set(centerRows.map(r => r.centerId)));
        if (centerIds.length > 0) {
          const existing = await tx.select().from(studentExitRecords).where(eq(studentExitRecords.studentId, id));
          const existingCenters = new Set(existing.map(e => e.centerId));
          const exitMonth = new Date().toISOString().slice(0, 7);
          for (const centerId of centerIds) {
            if (existingCenters.has(centerId)) continue;
            await tx.insert(studentExitRecords).values({
              studentId: id,
              studentName: user.name,
              centerId,
              exitMonth,
              reasons: ["OTHER"],
              notes: "계정 삭제 시 자동 기록",
              recordedBy: id,
            });
          }
        }
      }

      // For students: delete their enrollments but keep homework/assessment records for history
      await tx.delete(enrollments).where(eq(enrollments.studentId, id));

      // Clean up attendance PINs so the student's PIN slot is freed for re-use
      // (otherwise orphan PIN rows accumulate and block auto-generation for new students,
      //  AND remain matchable on the attendance pad)
      await tx.delete(attendancePins).where(eq(attendancePins.studentId, id));

      // Delete user center associations
      await tx.delete(userCenters).where(eq(userCenters.userId, id));

      // Delete user
      await tx.delete(users).where(eq(users.id, id));
    });
  }

  // For deleted students, fill in synthetic placeholder users so the UI can
  // render "이름 (퇴원생)" instead of "알 수 없음". Names are recovered from
  // student_exit_records snapshots (auto-created on deletion).
  // 퇴원(soft delete) 상태 학생 이름에 "(퇴원생)" 표기 추가
  private markWithdrawnStudentNames(studentMap: Map<string, User>): void {
    const entries = Array.from(studentMap.entries());
    for (const [id, student] of entries) {
      if (student.withdrawnAt && !student.name.includes("(퇴원생)")) {
        studentMap.set(id, { ...student, name: `${student.name} (퇴원생)` });
      }
    }
  }

  private async addDeletedStudentPlaceholders(studentIds: string[], studentMap: Map<string, User>): Promise<void> {
    const missing = studentIds.filter(sid => sid && !studentMap.has(sid));
    if (missing.length === 0) return;
    const exitRecords = await db.select().from(studentExitRecords)
      .where(inArray(studentExitRecords.studentId, missing));
    const exitNameById = new Map<string, string>();
    for (const er of exitRecords) {
      if (!exitNameById.has(er.studentId)) {
        exitNameById.set(er.studentId, er.studentName);
      }
    }
    for (const sid of missing) {
      const exitName = exitNameById.get(sid);
      const placeholderName = exitName ? `${exitName} (퇴원생)` : "(퇴원생)";
      studentMap.set(sid, {
        id: sid,
        name: placeholderName,
        role: UserRole.STUDENT,
      } as unknown as User);
    }
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User> {
    const result = await db.update(users).set(data).where(eq(users.id, id)).returning();
    if (!result[0]) throw new Error("User not found");
    return result[0];
  }

  async updateUserPassword(id: string, password: string): Promise<void> {
    await db.update(users).set({ password }).where(eq(users.id, id));
  }

  async getCenter(id: string): Promise<Center | undefined> {
    const result = await db.select().from(centers).where(eq(centers.id, id));
    return result[0];
  }

  async getCenters(): Promise<Center[]> {
    const allCenters = await db.select().from(centers);
    return allCenters.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }

  async createCenter(center: InsertCenter): Promise<Center> {
    const result = await db.insert(centers).values(center).returning();
    return result[0];
  }

  async updateCenter(id: string, data: Partial<InsertCenter>): Promise<Center> {
    const result = await db.update(centers).set(data).where(eq(centers.id, id)).returning();
    if (!result[0]) throw new Error("Center not found");
    return result[0];
  }

  async deleteCenter(id: string): Promise<void> {
    // Get all classes for this center first (needed for cascading deletes)
    const centerClasses = await db.select({ id: classes.id }).from(classes).where(eq(classes.centerId, id));
    const classIds = centerClasses.map(c => c.id);
    
    // Get all clinic students for this center (needed for cascading deletes)
    const centerClinicStudents = await db.select({ id: clinicStudents.id }).from(clinicStudents).where(eq(clinicStudents.centerId, id));
    const clinicStudentIds = centerClinicStudents.map(s => s.id);
    
    // Get all clinic assignments for this center (needed for cascading deletes)
    const centerClinicAssignments = await db.select({ id: clinicAssignments.id }).from(clinicAssignments).where(eq(clinicAssignments.centerId, id));
    const clinicAssignmentIds = centerClinicAssignments.map(a => a.id);
    
    // Get all todos for this center (needed for cascading deletes)
    const centerTodos = await db.select({ id: todos.id }).from(todos).where(eq(todos.centerId, id));
    const todoIds = centerTodos.map(t => t.id);
    
    // Get all academy calendar events for this center (needed for cascading deletes)
    const centerEvents = await db.select({ id: academyCalendarEvents.id }).from(academyCalendarEvents).where(eq(academyCalendarEvents.centerId, id));
    const eventIds = centerEvents.map(e => e.id);
    
    // Get clinic shared instruction groups
    const centerSharedGroups = await db.select({ id: clinicSharedInstructionGroups.id }).from(clinicSharedInstructionGroups).where(eq(clinicSharedInstructionGroups.centerId, id));
    const sharedGroupIds = centerSharedGroups.map(g => g.id);
    
    // Delete in order (child tables first, then parent tables)
    
    // 1. Delete class-related data
    if (classIds.length > 0) {
      await db.delete(homeworkSubmissions).where(inArray(homeworkSubmissions.homeworkId, 
        db.select({ id: homework.id }).from(homework).where(inArray(homework.classId, classIds))
      ));
      await db.delete(homework).where(inArray(homework.classId, classIds));
      await db.delete(assessments).where(inArray(assessments.classId, classIds));
      await db.delete(classVideos).where(inArray(classVideos.classId, classIds));
      await db.delete(classNotes).where(inArray(classNotes.classId, classIds));
      await db.delete(studentClassNotes).where(inArray(studentClassNotes.classId, classIds));
      await db.delete(enrollments).where(inArray(enrollments.classId, classIds));
    }
    
    // 2. Delete clinic-related data
    if (clinicStudentIds.length > 0) {
      // Delete clinic weekly record files first
      const weeklyRecords = await db.select({ id: clinicWeeklyRecords.id }).from(clinicWeeklyRecords).where(inArray(clinicWeeklyRecords.clinicStudentId, clinicStudentIds));
      const weeklyRecordIds = weeklyRecords.map(r => r.id);
      if (weeklyRecordIds.length > 0) {
        await db.delete(clinicWeeklyRecordFiles).where(inArray(clinicWeeklyRecordFiles.recordId, weeklyRecordIds));
      }
      await db.delete(clinicWeeklyRecords).where(inArray(clinicWeeklyRecords.clinicStudentId, clinicStudentIds));
      await db.delete(clinicInstructionDefaults).where(inArray(clinicInstructionDefaults.clinicStudentId, clinicStudentIds));
      await db.delete(clinicDailyNotes).where(inArray(clinicDailyNotes.clinicStudentId, clinicStudentIds));
    }
    
    if (clinicAssignmentIds.length > 0) {
      await db.delete(clinicAssignmentFiles).where(inArray(clinicAssignmentFiles.assignmentId, clinicAssignmentIds));
      await db.delete(clinicAssignmentSteps).where(inArray(clinicAssignmentSteps.assignmentId, clinicAssignmentIds));
      await db.delete(clinicComments).where(inArray(clinicComments.assignmentId, clinicAssignmentIds));
      await db.delete(clinicProgressLogs).where(inArray(clinicProgressLogs.assignmentId, clinicAssignmentIds));
    }
    
    if (sharedGroupIds.length > 0) {
      await db.delete(clinicSharedInstructionMembers).where(inArray(clinicSharedInstructionMembers.sharedGroupId, sharedGroupIds));
    }
    
    // 3. Delete todo assignees
    if (todoIds.length > 0) {
      await db.delete(todoAssignees).where(inArray(todoAssignees.todoId, todoIds));
    }
    
    // 4. Delete exam subject schedules
    if (eventIds.length > 0) {
      await db.delete(examSubjectSchedules).where(inArray(examSubjectSchedules.eventId, eventIds));
    }
    
    // 5. Delete users who ONLY belong to this center (not shared with other centers)
    // First, find all users connected to this center
    const usersInThisCenter = await db.select({ userId: userCenters.userId })
      .from(userCenters)
      .where(eq(userCenters.centerId, id));
    
    for (const { userId } of usersInThisCenter) {
      // Check if this user belongs to any OTHER center
      const otherCenterLinks = await db.select({ centerId: userCenters.centerId })
        .from(userCenters)
        .where(and(eq(userCenters.userId, userId), ne(userCenters.centerId, id)));
      
      // If user only belongs to this center, delete them (but not admin)
      if (otherCenterLinks.length === 0) {
        const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
        if (user && user.role !== UserRole.ADMIN) {
          await db.delete(users).where(eq(users.id, userId));
        }
      }
    }
    
    // 6. Delete all tables with direct centerId reference
    await db.delete(userCenters).where(eq(userCenters.centerId, id));
    await db.delete(classes).where(eq(classes.centerId, id));
    await db.delete(clinicStudents).where(eq(clinicStudents.centerId, id));
    await db.delete(clinicSharedInstructionGroups).where(eq(clinicSharedInstructionGroups.centerId, id));
    await db.delete(clinicResources).where(eq(clinicResources.centerId, id));
    await db.delete(clinicAssignments).where(eq(clinicAssignments.centerId, id));
    await db.delete(attendancePins).where(eq(attendancePins.centerId, id));
    await db.delete(teacherCheckInSettings).where(eq(teacherCheckInSettings.centerId, id));
    await db.delete(attendanceRecords).where(eq(attendanceRecords.centerId, id));
    await db.delete(teacherWorkRecords).where(eq(teacherWorkRecords.centerId, id));
    await db.delete(messageTemplates).where(eq(messageTemplates.centerId, id));
    await db.delete(solapiCredentials).where(eq(solapiCredentials.centerId, id));
    await db.delete(studyCafeReservations).where(eq(studyCafeReservations.centerId, id));
    await db.delete(studyCafeFixedSeats).where(eq(studyCafeFixedSeats.centerId, id));
    await db.delete(studyCafeSeats).where(eq(studyCafeSeats.centerId, id));
    await db.delete(studyCafeSettings).where(eq(studyCafeSettings.centerId, id));
    await db.delete(tuitionGuidances).where(eq(tuitionGuidances.centerId, id));
    await db.delete(tuitionNotifications).where(eq(tuitionNotifications.centerId, id));
    await db.delete(studentTextbookPurchases).where(eq(studentTextbookPurchases.centerId, id));
    await db.delete(studentMonthlyReports).where(eq(studentMonthlyReports.centerId, id));
    await db.delete(todos).where(eq(todos.centerId, id));
    await db.delete(studentExitRecords).where(eq(studentExitRecords.centerId, id));
    await db.delete(monthlyStudentSnapshots).where(eq(monthlyStudentSnapshots.centerId, id));
    await db.delete(monthlyFinanceSnapshots).where(eq(monthlyFinanceSnapshots.centerId, id));
    await db.delete(newConsultations).where(eq(newConsultations.centerId, id));
    await db.delete(marketingCampaigns).where(eq(marketingCampaigns.centerId, id));
    await db.delete(monthlyFinancialRecords).where(eq(monthlyFinancialRecords.centerId, id));
    await db.delete(teacherSalarySettings).where(eq(teacherSalarySettings.centerId, id));
    await db.delete(teacherSalaryAdjustments).where(eq(teacherSalaryAdjustments.centerId, id));
    await db.delete(academyCalendarEvents).where(eq(academyCalendarEvents.centerId, id));
    
    // Delete center registrations with the same name — but only the terminal
    // statuses ('approved', 'rejected'). Important:
    //  - Do NOT delete 'pending' rows: the same academy may have already
    //    submitted a re-registration request waiting for approval.
    //  - Do NOT delete 'processing' rows: another approval may be running
    //    concurrently and would otherwise lose its row before the final
    //    status update completes.
    const centerToDelete = await db.select().from(centers).where(eq(centers.id, id));
    if (centerToDelete.length > 0) {
      await db.delete(centerRegistrations).where(
        and(
          eq(centerRegistrations.name, centerToDelete[0].name),
          inArray(centerRegistrations.status, ["approved", "rejected"]),
        )
      );
    }
    
    // 6. Finally delete the center itself
    await db.delete(centers).where(eq(centers.id, id));
  }

  async getCenterStats(): Promise<any[]> {
    // Optimized: fetch all data in parallel with fewer queries
    const [allCenters, allUserCenters, allUsers, allClasses] = await Promise.all([
      db.select().from(centers),
      db.select().from(userCenters),
      db.select({ id: users.id, role: users.role, name: users.name, phone: users.phone, createdAt: users.createdAt }).from(users),
      db.select({ id: classes.id, centerId: classes.centerId }).from(classes),
    ]);

    // Create lookup maps for efficient access
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    
    return allCenters.map(center => {
      const centerUserIds = allUserCenters
        .filter(uc => uc.centerId === center.id)
        .map(uc => uc.userId);
      
      let studentCount = 0;
      let teacherCount = 0;
      let principalName: string | null = null;
      let principalPhone: string | null = null;
      
      // Collect all principals for this center and sort by createdAt (earliest first)
      const centerPrincipals: { name: string; phone: string | null; createdAt: Date | null }[] = [];
      
      for (const userId of centerUserIds) {
        const user = userMap.get(userId);
        if (!user) continue;
        if (user.role === UserRole.STUDENT) studentCount++;
        else if (user.role === UserRole.TEACHER) teacherCount++;
        else if (user.role === UserRole.PRINCIPAL) {
          centerPrincipals.push({
            name: user.name,
            phone: user.phone,
            createdAt: user.createdAt
          });
        }
      }
      
      // First registered principal becomes the primary principal
      if (centerPrincipals.length > 0) {
        centerPrincipals.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return aTime - bTime;
        });
        principalName = centerPrincipals[0].name;
        principalPhone = centerPrincipals[0].phone;
      }
      
      const classCount = allClasses.filter(c => c.centerId === center.id).length;
      
      return { ...center, studentCount, teacherCount, classCount, principalName, principalPhone };
    });
  }

  async getUserCenters(userId: string): Promise<Center[]> {
    const ucs = await db.select().from(userCenters).where(eq(userCenters.userId, userId));
    const centerIds = ucs.map((uc) => uc.centerId);
    if (centerIds.length === 0) return [];
    return await db.select().from(centers).where(inArray(centers.id, centerIds));
  }

  async addUserToCenter(data: InsertUserCenter): Promise<UserCenter> {
    const result = await db.insert(userCenters).values(data).returning();
    return result[0];
  }

  async removeUserFromCenter(userId: string, centerId: string): Promise<void> {
    await db.delete(userCenters).where(and(eq(userCenters.userId, userId), eq(userCenters.centerId, centerId)));
    // Free the student's attendance PIN slot in this center so the same last-4
    // digits can be reused (and the student doesn't keep a stale PIN here).
    await db.delete(attendancePins).where(and(
      eq(attendancePins.studentId, userId),
      eq(attendancePins.centerId, centerId),
    ));
  }

  async getCenterUsers(centerId: string, role?: number, includeWithdrawn: boolean = false): Promise<User[]> {
    const ucs = await db.select().from(userCenters).where(eq(userCenters.centerId, centerId));
    const userIds = ucs.map((uc) => uc.userId);
    if (userIds.length === 0) return [];
    let allUsers = await db.select().from(users).where(inArray(users.id, userIds));
    if (!includeWithdrawn) {
      allUsers = allUsers.filter((u) => !u.withdrawnAt);
    }
    if (role !== undefined) {
      return allUsers.filter((u) => u.role === role);
    }
    return allUsers;
  }

  // 학생 퇴원 처리 (soft delete): 수강 정보를 스냅샷 후 제거, 데이터는 보존
  async withdrawStudent(id: string): Promise<void> {
    const studentEnrollments = await this.getStudentEnrollments(id);
    const classIds = studentEnrollments.map(e => e.classId);
    await db.transaction(async (tx) => {
      await tx.update(users)
        .set({ withdrawnAt: new Date(), withdrawnEnrollments: JSON.stringify(classIds) })
        .where(eq(users.id, id));
      if (studentEnrollments.length > 0) {
        await tx.delete(enrollments).where(eq(enrollments.studentId, id));
      }
    });
  }

  // 퇴원생 재원 복구: 퇴원 상태 해제 + 당시 수강 정보 복원
  async reinstateStudent(id: string): Promise<{ restoredClassIds: string[]; skippedClassIds: string[] }> {
    const user = await this.getUser(id);
    if (!user) throw new Error("Student not found");
    let classIds: string[] = [];
    try {
      classIds = user.withdrawnEnrollments ? JSON.parse(user.withdrawnEnrollments) : [];
    } catch {}

    const restoredClassIds: string[] = [];
    const skippedClassIds: string[] = [];
    await db.transaction(async (tx) => {
      for (const classId of classIds) {
        const cls = await this.getClass(classId);
        if (!cls || cls.isArchived) {
          skippedClassIds.push(classId);
          continue;
        }
        const existing = await tx.select().from(enrollments)
          .where(and(eq(enrollments.studentId, id), eq(enrollments.classId, classId)));
        if (existing.length === 0) {
          await tx.insert(enrollments).values({ studentId: id, classId });
        }
        restoredClassIds.push(classId);
      }

      await tx.update(users)
        .set({ withdrawnAt: null, withdrawnEnrollments: null })
        .where(eq(users.id, id));
    });

    return { restoredClassIds, skippedClassIds };
  }

  // 1년 경과한 퇴원생 조회 (완전 폐기 대상)
  async getExpiredWithdrawnStudents(cutoff: Date): Promise<User[]> {
    const result = await db.select().from(users)
      .where(and(isNotNull(users.withdrawnAt), lt(users.withdrawnAt, cutoff)));
    return result.filter(u => u.role === UserRole.STUDENT);
  }

  async getClass(id: string): Promise<Class | undefined> {
    const result = await db.select().from(classes).where(eq(classes.id, id));
    return result[0];
  }

  async getClasses(centerId?: string, includeArchived: boolean = false): Promise<Class[]> {
    // 휴지통(soft-delete)에 들어간 수업은 항상 제외
    const notDeleted = isNull(classes.deletedAt);
    if (!centerId) {
      if (includeArchived) {
        return await db.select().from(classes).where(notDeleted);
      }
      return await db.select().from(classes).where(and(eq(classes.isArchived, false), notDeleted));
    }
    if (includeArchived) {
      return await db.select().from(classes).where(and(eq(classes.centerId, centerId), notDeleted));
    }
    return await db.select().from(classes).where(
      and(eq(classes.centerId, centerId), eq(classes.isArchived, false), notDeleted)
    );
  }

  async createClass(cls: InsertClass): Promise<Class> {
    const result = await db.insert(classes).values(cls).returning();
    return result[0];
  }

  async updateClass(id: string, data: Partial<InsertClass>): Promise<Class> {
    const result = await db.update(classes).set(data).where(eq(classes.id, id)).returning();
    if (!result[0]) throw new Error("Class not found");
    return result[0];
  }

  async deleteClass(id: string): Promise<void> {
    // Wrap in a transaction so a partial failure can't leave orphan rows
    // (e.g. class textbooks / student textbook purchases that keep appearing
    //  in the tuition aggregation after the class itself is gone).
    await db.transaction(async (tx) => {
      // Delete homework submissions first (child of homework)
      const classHomework = await tx.select({ id: homework.id }).from(homework).where(eq(homework.classId, id));
      const homeworkIds = classHomework.map(h => h.id);
      if (homeworkIds.length > 0) {
        await tx.delete(homeworkSubmissions).where(inArray(homeworkSubmissions.homeworkId, homeworkIds));
      }

      // Delete textbook purchases tied to this class's textbooks first,
      // then the class_textbooks rows themselves. Without this, deleted
      // classes keep contributing 교재비 to 교육비 집계.
      const classTextbookRows = await tx.select({ id: classTextbooks.id }).from(classTextbooks).where(eq(classTextbooks.classId, id));
      const textbookIds = classTextbookRows.map(t => t.id);
      if (textbookIds.length > 0) {
        await tx.delete(studentTextbookPurchases).where(inArray(studentTextbookPurchases.classTextbookId, textbookIds));
      }
      await tx.delete(classTextbooks).where(eq(classTextbooks.classId, id));

      // Delete other class-related records
      await tx.delete(attendanceRecords).where(eq(attendanceRecords.classId, id));
      await tx.delete(faceToFaceChecks).where(eq(faceToFaceChecks.classId, id));
      await tx.delete(homework).where(eq(homework.classId, id));
      await tx.delete(assessments).where(eq(assessments.classId, id));
      await tx.delete(classVideos).where(eq(classVideos.classId, id));
      await tx.delete(classNotes).where(eq(classNotes.classId, id));
      await tx.delete(studentClassNotes).where(eq(studentClassNotes.classId, id));
      await tx.delete(enrollments).where(eq(enrollments.classId, id));

      // Finally delete the class
      await tx.delete(classes).where(eq(classes.id, id));
    });
  }

  async softDeleteClass(id: string): Promise<void> {
    const result = await db.update(classes)
      .set({ deletedAt: new Date() })
      .where(eq(classes.id, id))
      .returning();
    if (!result[0]) throw new Error("Class not found");
  }

  async restoreClass(id: string): Promise<Class> {
    const result = await db.update(classes)
      .set({ deletedAt: null })
      .where(eq(classes.id, id))
      .returning();
    if (!result[0]) throw new Error("Class not found");
    return result[0];
  }

  async getDeletedClasses(centerId: string): Promise<Class[]> {
    return await db.select().from(classes)
      .where(and(eq(classes.centerId, centerId), isNotNull(classes.deletedAt)))
      .orderBy(desc(classes.deletedAt));
  }

  async getExpiredDeletedClasses(cutoff: Date): Promise<Class[]> {
    return await db.select().from(classes)
      .where(and(isNotNull(classes.deletedAt), lt(classes.deletedAt, cutoff)));
  }

  async getClassStudents(classId: string): Promise<User[]> {
    const enrs = await db.select().from(enrollments).where(eq(enrollments.classId, classId));
    const studentIds = enrs.map((e) => e.studentId);
    if (studentIds.length === 0) return [];
    return await db.select().from(users).where(inArray(users.id, studentIds));
  }

  async getEnrollment(studentId: string, classId: string): Promise<Enrollment | undefined> {
    const result = await db.select().from(enrollments).where(
      and(eq(enrollments.studentId, studentId), eq(enrollments.classId, classId))
    );
    return result[0];
  }

  async getEnrollmentById(id: string): Promise<Enrollment | undefined> {
    const result = await db.select().from(enrollments).where(eq(enrollments.id, id));
    return result[0];
  }

  async getStudentEnrollments(studentId: string): Promise<Enrollment[]> {
    return await db.select().from(enrollments).where(eq(enrollments.studentId, studentId));
  }

  async getClassEnrollments(classId: string): Promise<Enrollment[]> {
    return await db.select().from(enrollments).where(eq(enrollments.classId, classId));
  }

  async createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment> {
    const result = await db.insert(enrollments).values(enrollment).returning();
    return result[0];
  }

  async deleteEnrollment(id: string): Promise<void> {
    await db.delete(enrollments).where(eq(enrollments.id, id));
  }

  async checkTimeConflict(studentId: string, newClass: Class): Promise<boolean> {
    const studentEnrollments = await this.getStudentEnrollments(studentId);
    for (const enrollment of studentEnrollments) {
      const existingClass = await this.getClass(enrollment.classId);
      if (!existingClass) continue;

      const hasOverlappingDay = newClass.days.some((d) => existingClass.days.includes(d));
      if (!hasOverlappingDay) continue;

      const newStart = parseInt(newClass.startTime.replace(":", ""));
      const newEnd = parseInt(newClass.endTime.replace(":", ""));
      const existStart = parseInt(existingClass.startTime.replace(":", ""));
      const existEnd = parseInt(existingClass.endTime.replace(":", ""));

      if (!(newEnd <= existStart || newStart >= existEnd)) {
        return true;
      }
    }
    return false;
  }

  async getHomework(id: string): Promise<Homework | undefined> {
    const result = await db.select().from(homework).where(eq(homework.id, id));
    return result[0];
  }

  async getHomeworkByClass(classId: string): Promise<Homework[]> {
    return await db.select().from(homework).where(eq(homework.classId, classId));
  }

  async getHomeworkByCenter(centerId: string): Promise<Homework[]> {
    const centerClasses = await db.select().from(classes).where(
      and(eq(classes.centerId, centerId), isNull(classes.deletedAt))
    );
    const classIds = centerClasses.map((c) => c.id);
    if (classIds.length === 0) return [];
    return await db.select().from(homework).where(inArray(homework.classId, classIds));
  }

  async getStudentHomework(studentId: string, centerId?: string): Promise<Homework[]> {
    const studentEnrollments = await this.getStudentEnrollments(studentId);
    let classIds = studentEnrollments.map((e) => e.classId);
    if (classIds.length === 0) return [];
    
    // Filter out deleted (trash) classes, and by center if provided
    const enrolledClassData = await db.select().from(classes).where(inArray(classes.id, classIds));
    const activeClassData = enrolledClassData.filter(c => !c.deletedAt && (!centerId || c.centerId === centerId));
    classIds = activeClassData.map(c => c.id);
    if (classIds.length === 0) return [];
    
    const homeworkList = await db.select().from(homework).where(
      and(
        inArray(homework.classId, classIds),
        or(
          isNull(homework.studentId),
          eq(homework.studentId, studentId)
        )
      )
    );
    if (homeworkList.length === 0) return [];
    
    const classMap = new Map(activeClassData.map(c => [c.id, c]));
    
    return homeworkList.map(h => ({
      ...h,
      class: classMap.get(h.classId),
    }));
  }

  async createHomework(hw: InsertHomework): Promise<Homework> {
    const result = await db.insert(homework).values(hw).returning();
    return result[0];
  }

  async updateHomework(id: string, data: Partial<InsertHomework>): Promise<Homework> {
    const result = await db.update(homework).set(data).where(eq(homework.id, id)).returning();
    if (!result[0]) throw new Error("Homework not found");
    return result[0];
  }

  async deleteHomework(id: string): Promise<void> {
    await db.delete(homework).where(eq(homework.id, id));
  }

  async getSubmission(id: string): Promise<HomeworkSubmission | undefined> {
    const result = await db.select().from(homeworkSubmissions).where(eq(homeworkSubmissions.id, id));
    return result[0];
  }

  async getSubmissionByHomeworkAndStudent(homeworkId: string, studentId: string): Promise<HomeworkSubmission | undefined> {
    const result = await db.select().from(homeworkSubmissions).where(
      and(eq(homeworkSubmissions.homeworkId, homeworkId), eq(homeworkSubmissions.studentId, studentId))
    );
    return result[0];
  }

  async getSubmissionsByCenter(centerId: string): Promise<any[]> {
    const centerHomework = await this.getHomeworkByCenter(centerId);
    const homeworkIds = centerHomework.map((h) => h.id);
    if (homeworkIds.length === 0) return [];
    
    // Exclude photos field from list query to reduce memory usage
    const submissions = await db.select({
      id: homeworkSubmissions.id,
      homeworkId: homeworkSubmissions.homeworkId,
      studentId: homeworkSubmissions.studentId,
      completionRate: homeworkSubmissions.completionRate,
      status: homeworkSubmissions.status,
      feedback: homeworkSubmissions.feedback,
      resubmitReason: homeworkSubmissions.resubmitReason,
      submittedAt: homeworkSubmissions.submittedAt,
      reviewedAt: homeworkSubmissions.reviewedAt,
    }).from(homeworkSubmissions).where(inArray(homeworkSubmissions.homeworkId, homeworkIds));
    if (submissions.length === 0) return [];
    
    // Batch fetch all homework and students at once
    const homeworkMap = new Map(centerHomework.map(h => [h.id, h]));
    const studentIds = Array.from(new Set(submissions.map(s => s.studentId)));
    const studentsData = studentIds.length > 0 
      ? await db.select().from(users).where(inArray(users.id, studentIds))
      : [];
    const studentMap = new Map(studentsData.filter(s => !s.withdrawnAt).map(s => [s.id, s]));
    
    // 숙제 파트에서는 삭제된(퇴원) 학생을 표시하지 않음 - 제출 기록 자체를 제외
    return submissions
      .filter(s => studentMap.has(s.studentId))
      .map(s => ({
        ...s,
        photos: [], // Placeholder - photos loaded separately when needed
        homework: homeworkMap.get(s.homeworkId),
        student: studentMap.get(s.studentId),
      }));
  }

  async getStudentSubmissions(studentId: string, centerId?: string): Promise<HomeworkSubmission[]> {
    // Exclude photos from list query to reduce memory usage
    let query = db.select({
      id: homeworkSubmissions.id,
      homeworkId: homeworkSubmissions.homeworkId,
      studentId: homeworkSubmissions.studentId,
      completionRate: homeworkSubmissions.completionRate,
      status: homeworkSubmissions.status,
      feedback: homeworkSubmissions.feedback,
      resubmitReason: homeworkSubmissions.resubmitReason,
      submittedAt: homeworkSubmissions.submittedAt,
      reviewedAt: homeworkSubmissions.reviewedAt,
    }).from(homeworkSubmissions).where(eq(homeworkSubmissions.studentId, studentId));
    
    let results = await query;
    
    // If centerId is provided, filter submissions by homework's class center
    if (centerId && results.length > 0) {
      const homeworkIds = results.map(r => r.homeworkId);
      const homeworkList = await db.select().from(homework).where(inArray(homework.id, homeworkIds));
      const classIds = [...new Set(homeworkList.map(h => h.classId))];
      
      if (classIds.length > 0) {
        const classData = await db.select().from(classes).where(inArray(classes.id, classIds));
        const centerClassIds = new Set(classData.filter(c => c.centerId === centerId).map(c => c.id));
        const centerHomeworkIds = new Set(homeworkList.filter(h => centerClassIds.has(h.classId)).map(h => h.id));
        results = results.filter(r => centerHomeworkIds.has(r.homeworkId));
      }
    }
    
    return results.map(r => ({ ...r, photos: [] })) as HomeworkSubmission[];
  }

  async getSubmissionPhotos(id: string): Promise<string[]> {
    const result = await db.select({ photos: homeworkSubmissions.photos })
      .from(homeworkSubmissions)
      .where(eq(homeworkSubmissions.id, id));
    return result[0]?.photos || [];
  }

  async createSubmission(submission: InsertHomeworkSubmission): Promise<HomeworkSubmission> {
    console.log(`[Storage] createSubmission - homeworkId: ${submission.homeworkId}, studentId: ${submission.studentId}, photos: ${submission.photos?.length || 0}`);
    try {
      const result = await db.insert(homeworkSubmissions).values({
        ...submission,
        status: submission.status || "submitted",
        submittedAt: new Date(),
      }).returning();
      console.log(`[Storage] createSubmission - success, id: ${result[0]?.id}`);
      return result[0];
    } catch (error: any) {
      console.error(`[Storage] createSubmission - error:`, error?.message, error?.stack);
      throw error;
    }
  }

  async updateSubmission(id: string, data: Partial<InsertHomeworkSubmission>): Promise<HomeworkSubmission> {
    console.log(`[Storage] updateSubmission - id: ${id}, status: ${data.status}, photos: ${data.photos?.length || 0}`);
    try {
      const updateData: any = { ...data };
      if (data.status === "reviewed" || data.status === "in_person") {
        updateData.reviewedAt = new Date();
      }
      const result = await db.update(homeworkSubmissions).set(updateData).where(eq(homeworkSubmissions.id, id)).returning();
      if (!result[0]) throw new Error("Submission not found");
      console.log(`[Storage] updateSubmission - success, id: ${result[0]?.id}`);
      return result[0];
    } catch (error: any) {
      console.error(`[Storage] updateSubmission - error:`, error?.message, error?.stack);
      throw error;
    }
  }

  // Face-to-Face Checks (대면검사)
  async getFaceToFaceCheck(id: string): Promise<FaceToFaceCheck | undefined> {
    const result = await db.select().from(faceToFaceChecks).where(eq(faceToFaceChecks.id, id));
    return result[0];
  }

  async getFaceToFaceChecksByClass(classId: string): Promise<FaceToFaceCheck[]> {
    return await db.select().from(faceToFaceChecks).where(eq(faceToFaceChecks.classId, classId));
  }

  async getFaceToFaceChecksByCenter(centerId: string): Promise<FaceToFaceCheck[]> {
    const centerClasses = await db.select().from(classes).where(
      and(eq(classes.centerId, centerId), isNull(classes.deletedAt))
    );
    const classIds = centerClasses.map((c) => c.id);
    if (classIds.length === 0) return [];
    return await db.select().from(faceToFaceChecks).where(inArray(faceToFaceChecks.classId, classIds));
  }

  async getStudentFaceToFaceChecks(studentId: string, centerId?: string): Promise<FaceToFaceCheck[]> {
    const studentEnrollments = await this.getStudentEnrollments(studentId);
    let classIds = studentEnrollments.map((e) => e.classId);
    if (classIds.length === 0) return [];
    
    // Filter out deleted (trash) classes, and by center if provided
    let classData = await db.select().from(classes).where(inArray(classes.id, classIds));
    classData = classData.filter(c => !c.deletedAt && (!centerId || c.centerId === centerId));
    classIds = classData.map(c => c.id);
    if (classIds.length === 0) return [];
    
    const checkList = await db.select().from(faceToFaceChecks).where(
      and(
        inArray(faceToFaceChecks.classId, classIds),
        or(
          isNull(faceToFaceChecks.studentId),
          eq(faceToFaceChecks.studentId, studentId)
        )
      )
    );
    if (checkList.length === 0) return [];
    
    const classMap = new Map(classData.map(c => [c.id, c]));
    
    return checkList.map(check => ({
      ...check,
      class: classMap.get(check.classId),
    }));
  }

  async createFaceToFaceCheck(check: InsertFaceToFaceCheck): Promise<FaceToFaceCheck> {
    const result = await db.insert(faceToFaceChecks).values(check).returning();
    return result[0];
  }

  async updateFaceToFaceCheck(id: string, data: Partial<InsertFaceToFaceCheck>): Promise<FaceToFaceCheck> {
    const result = await db.update(faceToFaceChecks).set(data).where(eq(faceToFaceChecks.id, id)).returning();
    if (!result[0]) throw new Error("Face-to-face check not found");
    return result[0];
  }

  async deleteFaceToFaceCheck(id: string): Promise<void> {
    await db.delete(faceToFaceCheckResults).where(eq(faceToFaceCheckResults.checkId, id));
    await db.delete(faceToFaceChecks).where(eq(faceToFaceChecks.id, id));
  }

  async getFaceToFaceCheckResult(id: string): Promise<FaceToFaceCheckResult | undefined> {
    const result = await db.select().from(faceToFaceCheckResults).where(eq(faceToFaceCheckResults.id, id));
    return result[0];
  }

  async getResultByCheckAndStudent(checkId: string, studentId: string): Promise<FaceToFaceCheckResult | undefined> {
    const result = await db.select().from(faceToFaceCheckResults).where(
      and(eq(faceToFaceCheckResults.checkId, checkId), eq(faceToFaceCheckResults.studentId, studentId))
    );
    return result[0];
  }

  async getResultsByCenter(centerId: string): Promise<any[]> {
    const centerChecks = await this.getFaceToFaceChecksByCenter(centerId);
    const checkIds = centerChecks.map((c) => c.id);
    if (checkIds.length === 0) return [];
    
    const results = await db.select().from(faceToFaceCheckResults).where(inArray(faceToFaceCheckResults.checkId, checkIds));
    if (results.length === 0) return [];
    
    const checkMap = new Map(centerChecks.map(c => [c.id, c]));
    const studentIds = Array.from(new Set(results.map(r => r.studentId)));
    const studentsData = studentIds.length > 0 
      ? await db.select().from(users).where(inArray(users.id, studentIds))
      : [];
    const studentMap = new Map(studentsData.map(s => [s.id, s]));
    await this.addDeletedStudentPlaceholders(studentIds, studentMap);
    this.markWithdrawnStudentNames(studentMap);
    
    return results.map(r => ({
      ...r,
      check: checkMap.get(r.checkId),
      student: studentMap.get(r.studentId),
    }));
  }

  async getStudentCheckResults(studentId: string, centerId?: string): Promise<FaceToFaceCheckResult[]> {
    const results = await db.select().from(faceToFaceCheckResults).where(eq(faceToFaceCheckResults.studentId, studentId));
    
    // If centerId is provided, filter results by check's class center
    if (centerId && results.length > 0) {
      const checkIds = results.map(r => r.checkId);
      const checks = await db.select().from(faceToFaceChecks).where(inArray(faceToFaceChecks.id, checkIds));
      const classIds = [...new Set(checks.map(c => c.classId))];
      
      if (classIds.length > 0) {
        const classData = await db.select().from(classes).where(inArray(classes.id, classIds));
        const centerClassIds = new Set(classData.filter(c => c.centerId === centerId).map(c => c.id));
        const centerCheckIds = new Set(checks.filter(c => centerClassIds.has(c.classId)).map(c => c.id));
        return results.filter(r => centerCheckIds.has(r.checkId));
      }
    }
    
    return results;
  }

  async createCheckResult(result: InsertFaceToFaceCheckResult): Promise<FaceToFaceCheckResult> {
    const insertResult = await db.insert(faceToFaceCheckResults).values(result).returning();
    return insertResult[0];
  }

  async updateCheckResult(id: string, data: Partial<InsertFaceToFaceCheckResult>): Promise<FaceToFaceCheckResult> {
    const updateData: any = { ...data };
    if (data.status === "checked" || data.status === "recheck") {
      updateData.checkedAt = new Date();
    }
    const result = await db.update(faceToFaceCheckResults).set(updateData).where(eq(faceToFaceCheckResults.id, id)).returning();
    if (!result[0]) throw new Error("Check result not found");
    return result[0];
  }

  async getAssessment(id: string): Promise<Assessment | undefined> {
    const result = await db.select().from(assessments).where(eq(assessments.id, id));
    return result[0];
  }

  async getAssessmentsByCenter(centerId: string): Promise<any[]> {
    const centerClasses = await db.select().from(classes).where(
      and(eq(classes.centerId, centerId), isNull(classes.deletedAt))
    );
    const classIds = centerClasses.map((c) => c.id);
    if (classIds.length === 0) return [];
    
    const allAssessments = await db.select().from(assessments).where(inArray(assessments.classId, classIds));
    if (allAssessments.length === 0) return [];
    
    // Batch fetch classes and students
    const classMap = new Map(centerClasses.map(c => [c.id, c]));
    const studentIds = Array.from(new Set(allAssessments.map(a => a.studentId)));
    const studentsData = studentIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, studentIds))
      : [];
    const studentMap = new Map(studentsData.map(s => [s.id, s]));
    await this.addDeletedStudentPlaceholders(studentIds, studentMap);
    this.markWithdrawnStudentNames(studentMap);
    
    return allAssessments.map(a => ({
      ...a,
      class: classMap.get(a.classId),
      student: studentMap.get(a.studentId),
    }));
  }

  async getStudentAssessments(studentId: string, month?: string, centerId?: string): Promise<any[]> {
    let allAssessments = await db.select().from(assessments).where(eq(assessments.studentId, studentId));
    if (month) {
      allAssessments = allAssessments.filter((a) => a.assessmentDate.startsWith(month));
    }
    
    // Filter out deleted (trash) classes, and by center if provided
    if (allAssessments.length > 0) {
      const classIds = [...new Set(allAssessments.map(a => a.classId))];
      const classData = await db.select().from(classes).where(inArray(classes.id, classIds));
      const activeClassIds = new Set(
        classData.filter(c => !c.deletedAt && (!centerId || c.centerId === centerId)).map(c => c.id)
      );
      allAssessments = allAssessments.filter(a => activeClassIds.has(a.classId));
    }
    
    // Pre-calculate monthly rankings per class for efficiency
    const classMonthlyRankings = new Map<string, { studentAverages: Map<string, number>; topScore: number; totalStudents: number }>();
    
    // Get unique class IDs from student's assessments
    const classIds = Array.from(new Set(allAssessments.map(a => a.classId)));
    
    for (const classId of classIds) {
      // Get all assessments for this class in the month
      let classAssessments = await db.select().from(assessments).where(eq(assessments.classId, classId));
      if (month) {
        classAssessments = classAssessments.filter((a) => a.assessmentDate.startsWith(month));
      }
      
      // Calculate monthly average per student
      const studentScores = new Map<string, number[]>();
      for (const ca of classAssessments) {
        if (!studentScores.has(ca.studentId)) {
          studentScores.set(ca.studentId, []);
        }
        studentScores.get(ca.studentId)!.push(ca.score);
      }
      
      const studentAverages = new Map<string, number>();
      let topScore = 0;
      studentScores.forEach((scores, sid) => {
        const avg = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
        studentAverages.set(sid, avg);
        if (avg > topScore) topScore = avg;
      });
      
      classMonthlyRankings.set(classId, {
        studentAverages,
        topScore,
        totalStudents: studentScores.size
      });
    }
    
    const result = [];
    for (const a of allAssessments) {
      const cls = await this.getClass(a.classId);
      const ranking = classMonthlyRankings.get(a.classId);
      
      // Get monthly class average
      const allAverages = ranking ? Array.from(ranking.studentAverages.values()) : [a.score];
      const monthlyClassAverage = allAverages.length > 0
        ? Math.round(allAverages.reduce((sum, avg) => sum + avg, 0) / allAverages.length)
        : a.score;
      
      // Check if this student is first for the month in this class
      const studentMonthlyAvg = ranking?.studentAverages.get(studentId) || a.score;
      const isFirst = ranking && ranking.topScore > 0 && studentMonthlyAvg === ranking.topScore && ranking.totalStudents > 1;
      
      // Calculate monthly rank
      const sortedAverages = allAverages.sort((x, y) => y - x);
      const monthlyRank = sortedAverages.indexOf(studentMonthlyAvg) + 1;
      
      result.push({ 
        ...a, 
        class: cls, 
        average: monthlyClassAverage, 
        rank: monthlyRank, 
        isFirst, 
        totalStudents: ranking?.totalStudents || 1,
        studentMonthlyAverage: studentMonthlyAvg
      });
    }
    return result;
  }

  async createAssessments(assessmentList: InsertAssessment[]): Promise<Assessment[]> {
    const results: Assessment[] = [];
    for (const assessment of assessmentList) {
      const existing = await db.select().from(assessments).where(
        and(
          eq(assessments.studentId, assessment.studentId),
          eq(assessments.classId, assessment.classId),
          eq(assessments.assessmentDate, assessment.assessmentDate)
        )
      );
      if (existing[0]) {
        const updated = await db.update(assessments).set({ 
          score: assessment.score, 
          maxScore: assessment.maxScore 
        }).where(eq(assessments.id, existing[0].id)).returning();
        results.push(updated[0]);
      } else {
        const created = await db.insert(assessments).values(assessment).returning();
        results.push(created[0]);
      }
    }
    return results;
  }

  async updateAssessment(id: string, data: { score: number; maxScore?: number }): Promise<Assessment> {
    const [updated] = await db.update(assessments).set(data).where(eq(assessments.id, id)).returning();
    return updated;
  }

  async deleteAssessment(id: string): Promise<void> {
    await db.delete(assessments).where(eq(assessments.id, id));
  }

  async getClassVideos(centerId?: string): Promise<ClassVideo[]> {
    if (!centerId) {
      return await db.select().from(classVideos);
    }
    const centerClasses = await db.select().from(classes).where(
      and(eq(classes.centerId, centerId), isNull(classes.deletedAt))
    );
    const classIds = centerClasses.map((c) => c.id);
    if (classIds.length === 0) return [];
    return await db.select().from(classVideos).where(inArray(classVideos.classId, classIds));
  }

  async createClassVideo(video: InsertClassVideo): Promise<ClassVideo> {
    const result = await db.insert(classVideos).values(video).returning();
    return result[0];
  }

  async updateClassVideo(id: string, data: Partial<InsertClassVideo>): Promise<ClassVideo> {
    const result = await db.update(classVideos).set(data).where(eq(classVideos.id, id)).returning();
    if (!result[0]) throw new Error("Video not found");
    return result[0];
  }

  async deleteClassVideo(id: string): Promise<void> {
    await db.delete(classVideos).where(eq(classVideos.id, id));
  }

  async getTextbooks(centerId: string): Promise<Textbook[]> {
    return await db.select().from(textbooks).where(eq(textbooks.centerId, centerId));
  }

  async createTextbook(textbook: InsertTextbook): Promise<Textbook> {
    const result = await db.insert(textbooks).values(textbook).returning();
    return result[0];
  }

  async updateTextbook(id: string, data: Partial<InsertTextbook>): Promise<Textbook> {
    const result = await db.update(textbooks).set(data).where(eq(textbooks.id, id)).returning();
    if (!result[0]) throw new Error("Textbook not found");
    return result[0];
  }

  async deleteTextbook(id: string): Promise<void> {
    await db.delete(textbooks).where(eq(textbooks.id, id));
  }

  async getTextbookVideos(textbookId: string): Promise<TextbookVideo[]> {
    const videos = await db.select().from(textbookVideos).where(eq(textbookVideos.textbookId, textbookId));
    return videos.sort((a, b) => a.pageNumber - b.pageNumber || a.problemNumber - b.problemNumber);
  }

  async createTextbookVideo(video: InsertTextbookVideo): Promise<TextbookVideo> {
    const result = await db.insert(textbookVideos).values(video).returning();
    return result[0];
  }

  async updateTextbookVideo(id: string, data: Partial<InsertTextbookVideo>): Promise<TextbookVideo> {
    const result = await db.update(textbookVideos).set(data).where(eq(textbookVideos.id, id)).returning();
    if (!result[0]) throw new Error("Video not found");
    return result[0];
  }

  async deleteTextbookVideo(id: string): Promise<void> {
    await db.delete(textbookVideos).where(eq(textbookVideos.id, id));
  }

  // Clinic methods
  async getClinicAssignment(id: string): Promise<ClinicAssignmentWithDetails | undefined> {
    const result = await db.select().from(clinicAssignments).where(eq(clinicAssignments.id, id));
    if (!result[0]) return undefined;
    return this.enrichClinicAssignment(result[0]);
  }

  async getClinicAssignments(options: { centerId?: string; regularTeacherId?: string; clinicTeacherId?: string; studentId?: string }): Promise<ClinicAssignmentWithDetails[]> {
    let assignments = await db.select().from(clinicAssignments);
    
    if (options.centerId) {
      assignments = assignments.filter(a => a.centerId === options.centerId);
    }
    if (options.regularTeacherId) {
      assignments = assignments.filter(a => a.regularTeacherId === options.regularTeacherId);
    }
    if (options.clinicTeacherId) {
      assignments = assignments.filter(a => a.clinicTeacherId === options.clinicTeacherId);
    }
    if (options.studentId) {
      assignments = assignments.filter(a => a.studentId === options.studentId);
    }

    return Promise.all(assignments.map(a => this.enrichClinicAssignment(a)));
  }

  private async enrichClinicAssignment(assignment: ClinicAssignment): Promise<ClinicAssignmentWithDetails> {
    const [student, regularTeacher, clinicTeacher, steps, files, comments, progressLogs] = await Promise.all([
      this.getUser(assignment.studentId),
      this.getUser(assignment.regularTeacherId),
      assignment.clinicTeacherId ? this.getUser(assignment.clinicTeacherId) : Promise.resolve(undefined),
      db.select().from(clinicAssignmentSteps).where(eq(clinicAssignmentSteps.assignmentId, assignment.id)),
      db.select().from(clinicAssignmentFiles).where(eq(clinicAssignmentFiles.assignmentId, assignment.id)),
      db.select().from(clinicComments).where(eq(clinicComments.assignmentId, assignment.id)),
      db.select().from(clinicProgressLogs).where(eq(clinicProgressLogs.assignmentId, assignment.id)),
    ]);

    return {
      ...assignment,
      student,
      regularTeacher,
      clinicTeacher,
      steps: steps.sort((a, b) => a.stepOrder - b.stepOrder),
      files,
      comments,
      progressLogs,
    };
  }

  async createClinicAssignment(assignment: InsertClinicAssignment): Promise<ClinicAssignment> {
    const result = await db.insert(clinicAssignments).values(assignment).returning();
    return result[0];
  }

  async updateClinicAssignment(id: string, data: Partial<InsertClinicAssignment>): Promise<ClinicAssignment> {
    const result = await db.update(clinicAssignments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clinicAssignments.id, id))
      .returning();
    if (!result[0]) throw new Error("Assignment not found");
    return result[0];
  }

  async deleteClinicAssignment(id: string): Promise<void> {
    await db.delete(clinicProgressLogs).where(eq(clinicProgressLogs.assignmentId, id));
    await db.delete(clinicComments).where(eq(clinicComments.assignmentId, id));
    await db.delete(clinicAssignmentFiles).where(eq(clinicAssignmentFiles.assignmentId, id));
    await db.delete(clinicAssignmentSteps).where(eq(clinicAssignmentSteps.assignmentId, id));
    await db.delete(clinicAssignments).where(eq(clinicAssignments.id, id));
  }

  async createClinicAssignmentStep(step: InsertClinicAssignmentStep): Promise<ClinicAssignmentStep> {
    const result = await db.insert(clinicAssignmentSteps).values(step).returning();
    return result[0];
  }

  async updateClinicAssignmentStep(id: string, data: Partial<InsertClinicAssignmentStep>): Promise<ClinicAssignmentStep> {
    const result = await db.update(clinicAssignmentSteps)
      .set(data)
      .where(eq(clinicAssignmentSteps.id, id))
      .returning();
    if (!result[0]) throw new Error("Step not found");
    return result[0];
  }

  async deleteClinicAssignmentStep(id: string): Promise<void> {
    await db.delete(clinicAssignmentFiles).where(eq(clinicAssignmentFiles.stepId, id));
    await db.delete(clinicAssignmentSteps).where(eq(clinicAssignmentSteps.id, id));
  }

  async createClinicAssignmentFile(file: InsertClinicAssignmentFile): Promise<ClinicAssignmentFile> {
    const result = await db.insert(clinicAssignmentFiles).values(file).returning();
    return result[0];
  }

  async deleteClinicAssignmentFile(id: string): Promise<void> {
    await db.delete(clinicAssignmentFiles).where(eq(clinicAssignmentFiles.id, id));
  }

  async createClinicComment(comment: InsertClinicComment): Promise<ClinicComment> {
    const result = await db.insert(clinicComments).values(comment).returning();
    return result[0];
  }

  async deleteClinicComment(id: string): Promise<void> {
    await db.delete(clinicComments).where(eq(clinicComments.id, id));
  }

  async getClinicProgressLogs(assignmentId: string): Promise<ClinicProgressLog[]> {
    return db.select().from(clinicProgressLogs).where(eq(clinicProgressLogs.assignmentId, assignmentId));
  }

  async createClinicProgressLog(log: InsertClinicProgressLog): Promise<ClinicProgressLog> {
    const result = await db.insert(clinicProgressLogs).values(log).returning();
    return result[0];
  }

  async updateClinicProgressLog(id: string, data: Partial<InsertClinicProgressLog>): Promise<ClinicProgressLog> {
    const result = await db.update(clinicProgressLogs)
      .set(data)
      .where(eq(clinicProgressLogs.id, id))
      .returning();
    if (!result[0]) throw new Error("Progress log not found");
    return result[0];
  }

  // ===== New Clinic System (Weekly Workflow) =====
  async getClinicStudent(id: string): Promise<ClinicStudentWithDetails | undefined> {
    const result = await db.select().from(clinicStudents).where(eq(clinicStudents.id, id));
    if (!result[0]) return undefined;

    const cs = result[0];
    const [student, regularTeacher, clinicTeacher, weeklyRecords] = await Promise.all([
      this.getUser(cs.studentId),
      this.getUser(cs.regularTeacherId),
      cs.clinicTeacherId ? this.getUser(cs.clinicTeacherId) : Promise.resolve(undefined),
      db.select().from(clinicWeeklyRecords).where(eq(clinicWeeklyRecords.clinicStudentId, cs.id)),
    ]);

    return { ...cs, student, regularTeacher, clinicTeacher, weeklyRecords };
  }

  async getClinicStudentByStudentAndCenter(studentId: string, centerId: string): Promise<ClinicStudent | undefined> {
    const result = await db.select().from(clinicStudents)
      .where(and(
        eq(clinicStudents.studentId, studentId),
        eq(clinicStudents.centerId, centerId)
      ));
    return result[0];
  }

  async getClinicStudentByStudentCenterAndType(studentId: string, centerId: string, clinicType: string): Promise<ClinicStudent | undefined> {
    const result = await db.select().from(clinicStudents)
      .where(and(
        eq(clinicStudents.studentId, studentId),
        eq(clinicStudents.centerId, centerId),
        eq(clinicStudents.clinicType, clinicType)
      ));
    return result[0];
  }

  async getClinicStudents(centerId: string): Promise<ClinicStudentWithDetails[]> {
    const allClinicStudents = await db.select().from(clinicStudents)
      .where(eq(clinicStudents.centerId, centerId));

    return Promise.all(allClinicStudents.map(async (cs) => {
      const [student, regularTeacher, clinicTeacher] = await Promise.all([
        this.getUser(cs.studentId),
        this.getUser(cs.regularTeacherId),
        cs.clinicTeacherId ? this.getUser(cs.clinicTeacherId) : Promise.resolve(undefined),
      ]);
      return { ...cs, student, regularTeacher, clinicTeacher };
    }));
  }

  async createClinicStudent(student: InsertClinicStudent): Promise<ClinicStudent> {
    const result = await db.insert(clinicStudents).values(student).returning();
    return result[0];
  }

  async updateClinicStudent(id: string, data: Partial<InsertClinicStudent>): Promise<ClinicStudent> {
    const result = await db.update(clinicStudents)
      .set(data)
      .where(eq(clinicStudents.id, id))
      .returning();
    if (!result[0]) throw new Error("Clinic student not found");
    return result[0];
  }

  async deleteClinicStudent(id: string): Promise<void> {
    await db.delete(clinicWeeklyRecords).where(eq(clinicWeeklyRecords.clinicStudentId, id));
    await db.delete(clinicStudents).where(eq(clinicStudents.id, id));
  }

  async getClinicWeeklyRecord(id: string): Promise<ClinicWeeklyRecord | undefined> {
    const result = await db.select().from(clinicWeeklyRecords).where(eq(clinicWeeklyRecords.id, id));
    return result[0];
  }

  async getClinicWeeklyRecords(clinicStudentId: string, weekStartDate?: string): Promise<ClinicWeeklyRecord[]> {
    if (weekStartDate) {
      return db.select().from(clinicWeeklyRecords)
        .where(and(
          eq(clinicWeeklyRecords.clinicStudentId, clinicStudentId),
          eq(clinicWeeklyRecords.weekStartDate, weekStartDate)
        ));
    }
    return db.select().from(clinicWeeklyRecords)
      .where(eq(clinicWeeklyRecords.clinicStudentId, clinicStudentId));
  }

  async getClinicWeeklyRecordsByCenter(centerId: string, weekStartDate: string): Promise<(ClinicWeeklyRecord & { clinicStudent?: ClinicStudentWithDetails })[]> {
    const clinicStudentsList = await this.getClinicStudents(centerId);
    const clinicStudentIds = clinicStudentsList.map(cs => cs.id);
    
    if (clinicStudentIds.length === 0) return [];
    
    const records = await db.select().from(clinicWeeklyRecords)
      .where(and(
        inArray(clinicWeeklyRecords.clinicStudentId, clinicStudentIds),
        eq(clinicWeeklyRecords.weekStartDate, weekStartDate)
      ));

    return records.map(record => ({
      ...record,
      clinicStudent: clinicStudentsList.find(cs => cs.id === record.clinicStudentId),
    }));
  }

  async getClinicWeeklyRecordsByMonth(centerId: string, year: number, month: number): Promise<(ClinicWeeklyRecord & { clinicStudent?: ClinicStudentWithDetails })[]> {
    const clinicStudentsList = await this.getClinicStudents(centerId);
    const clinicStudentIds = clinicStudentsList.map(cs => cs.id);
    
    if (clinicStudentIds.length === 0) return [];
    
    // Calculate the first day of the month and last day of the month
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    
    // Find the Monday of the week containing the first day of the month
    // This ensures boundary-spanning weeks are included
    const firstMonday = new Date(firstDayOfMonth);
    const dayOfWeek = firstDayOfMonth.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, Monday = 1
    firstMonday.setDate(firstDayOfMonth.getDate() - daysToMonday);
    
    // Find the Monday of the week containing the last day of the month
    const lastMonday = new Date(lastDayOfMonth);
    const lastDayOfWeek = lastDayOfMonth.getDay();
    const daysToLastMonday = lastDayOfWeek === 0 ? 6 : lastDayOfWeek - 1;
    lastMonday.setDate(lastDayOfMonth.getDate() - daysToLastMonday);
    
    // Format dates for comparison
    const formatDate = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const startDate = formatDate(firstMonday);
    const endDate = formatDate(lastMonday);
    
    const records = await db.select().from(clinicWeeklyRecords)
      .where(and(
        inArray(clinicWeeklyRecords.clinicStudentId, clinicStudentIds),
        gte(clinicWeeklyRecords.weekStartDate, startDate),
        lte(clinicWeeklyRecords.weekStartDate, endDate)
      ));

    return records.map(record => ({
      ...record,
      clinicStudent: clinicStudentsList.find(cs => cs.id === record.clinicStudentId),
    }));
  }

  async createClinicWeeklyRecord(record: InsertClinicWeeklyRecord): Promise<ClinicWeeklyRecord> {
    // Check for existing record to prevent duplicates
    if (record.clinicStudentId && record.weekStartDate) {
      const existing = await db.select().from(clinicWeeklyRecords)
        .where(and(
          eq(clinicWeeklyRecords.clinicStudentId, record.clinicStudentId),
          eq(clinicWeeklyRecords.weekStartDate, record.weekStartDate as string)
        ));
      if (existing.length > 0) {
        return existing[0]; // Return existing record instead of creating duplicate
      }
    }
    const result = await db.insert(clinicWeeklyRecords).values(record).returning();
    return result[0];
  }

  async updateClinicWeeklyRecord(id: string, data: Partial<InsertClinicWeeklyRecord>): Promise<ClinicWeeklyRecord> {
    const result = await db.update(clinicWeeklyRecords)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clinicWeeklyRecords.id, id))
      .returning();
    if (!result[0]) throw new Error("Clinic weekly record not found");
    return result[0];
  }

  async deleteClinicWeeklyRecord(id: string): Promise<void> {
    await db.delete(clinicWeeklyRecords).where(eq(clinicWeeklyRecords.id, id));
  }

  async deleteOldClinicWeeklyRecords(centerId: string, beforeDate: string): Promise<number> {
    const clinicStudentsList = await this.getClinicStudents(centerId);
    const clinicStudentIds = clinicStudentsList.map(cs => cs.id);
    
    if (clinicStudentIds.length === 0) {
      return 0;
    }
    
    // First delete associated files
    const oldRecords = await db.select({ id: clinicWeeklyRecords.id })
      .from(clinicWeeklyRecords)
      .where(and(
        inArray(clinicWeeklyRecords.clinicStudentId, clinicStudentIds),
        lt(clinicWeeklyRecords.weekStartDate, beforeDate)
      ));
    
    for (const record of oldRecords) {
      await this.deleteClinicWeeklyRecordFilesByRecordId(record.id);
    }
    
    // Then delete the records
    const result = await db.delete(clinicWeeklyRecords)
      .where(and(
        inArray(clinicWeeklyRecords.clinicStudentId, clinicStudentIds),
        lt(clinicWeeklyRecords.weekStartDate, beforeDate)
      ))
      .returning();
    
    return result.length;
  }

  // Clinic Resources
  async getClinicResource(id: string): Promise<ClinicResource | undefined> {
    const result = await db.select().from(clinicResources)
      .where(eq(clinicResources.id, id))
      .limit(1);
    return result[0];
  }

  async getClinicResources(centerId: string): Promise<ClinicResourceWithUploader[]> {
    const resources = await db.select().from(clinicResources)
      .where(eq(clinicResources.centerId, centerId));
    
    const uploaderIds = Array.from(new Set(resources.map(r => r.uploadedById)));
    const uploaders = uploaderIds.length > 0 
      ? await db.select().from(users).where(inArray(users.id, uploaderIds))
      : [];
    const uploaderMap = new Map(uploaders.map(u => [u.id, u]));
    
    // Get class information for resources with classId
    const classIds = Array.from(new Set(resources.filter(r => r.classId).map(r => r.classId!)));
    const classesResult = classIds.length > 0 
      ? await db.select().from(classes).where(inArray(classes.id, classIds))
      : [];
    const classMap = new Map(classesResult.map(c => [c.id, c]));
    
    return resources.map(r => ({
      ...r,
      uploader: uploaderMap.get(r.uploadedById),
      class: r.classId ? classMap.get(r.classId) : undefined,
    }));
  }

  async createClinicResource(resource: InsertClinicResource): Promise<ClinicResource> {
    const result = await db.insert(clinicResources).values(resource).returning();
    return result[0];
  }

  async updateClinicResource(id: string, data: { classId?: string | null }): Promise<ClinicResource> {
    const result = await db.update(clinicResources)
      .set(data)
      .where(eq(clinicResources.id, id))
      .returning();
    return result[0];
  }

  async deleteClinicResource(id: string): Promise<void> {
    await db.delete(clinicResources).where(eq(clinicResources.id, id));
  }

  async deleteOldTemporaryClinicResources(beforeDate: string): Promise<{ count: number; filePaths: string[] }> {
    // Delete temporary resources (isPermanent = false) where createdAt < beforeDate (14 days ago)
    const result = await db.delete(clinicResources)
      .where(and(
        eq(clinicResources.isPermanent, false),
        lt(clinicResources.createdAt, new Date(beforeDate))
      ))
      .returning();
    return { 
      count: result.length, 
      filePaths: result.map(r => r.filePath).filter(Boolean) as string[]
    };
  }

  // ============================================
  // Clinic Daily Notes Implementation (날짜별 기록)
  // ============================================

  async getClinicDailyNotes(clinicStudentId: string): Promise<ClinicDailyNoteWithCreator[]> {
    const notes = await db.select().from(clinicDailyNotes)
      .where(eq(clinicDailyNotes.clinicStudentId, clinicStudentId))
      .orderBy(desc(clinicDailyNotes.noteDate));
    
    const notesWithCreator: ClinicDailyNoteWithCreator[] = [];
    for (const note of notes) {
      const creator = await db.select().from(users).where(eq(users.id, note.createdById)).limit(1);
      notesWithCreator.push({
        ...note,
        creator: creator[0]
      });
    }
    return notesWithCreator;
  }

  async createClinicDailyNote(note: InsertClinicDailyNote): Promise<ClinicDailyNote> {
    const [created] = await db.insert(clinicDailyNotes).values(note).returning();
    return created;
  }

  async updateClinicDailyNote(id: string, data: Partial<InsertClinicDailyNote>): Promise<ClinicDailyNote> {
    const [updated] = await db.update(clinicDailyNotes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clinicDailyNotes.id, id))
      .returning();
    return updated;
  }

  async deleteClinicDailyNote(id: string): Promise<void> {
    await db.delete(clinicDailyNotes).where(eq(clinicDailyNotes.id, id));
  }

  // ============================================
  // Clinic Instruction Defaults Implementation
  // ============================================

  async getClinicInstructionDefaults(clinicStudentId: string): Promise<ClinicInstructionDefault[]> {
    return db.select().from(clinicInstructionDefaults)
      .where(eq(clinicInstructionDefaults.clinicStudentId, clinicStudentId));
  }

  async getClinicInstructionDefaultByWeekday(clinicStudentId: string, weekday: string): Promise<ClinicInstructionDefault | undefined> {
    const result = await db.select().from(clinicInstructionDefaults)
      .where(and(
        eq(clinicInstructionDefaults.clinicStudentId, clinicStudentId),
        eq(clinicInstructionDefaults.weekday, weekday)
      ));
    return result[0];
  }

  async upsertClinicInstructionDefault(data: InsertClinicInstructionDefault): Promise<ClinicInstructionDefault> {
    const existing = await this.getClinicInstructionDefaultByWeekday(data.clinicStudentId, data.weekday);
    if (existing) {
      const [updated] = await db.update(clinicInstructionDefaults)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(clinicInstructionDefaults.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(clinicInstructionDefaults).values(data).returning();
    return created;
  }

  async deleteClinicInstructionDefault(id: string): Promise<void> {
    await db.delete(clinicInstructionDefaults).where(eq(clinicInstructionDefaults.id, id));
  }

  // ============================================
  // Clinic Weekly Record Files Implementation
  // ============================================

  async getClinicWeeklyRecordFiles(recordId: string): Promise<ClinicWeeklyRecordFile[]> {
    return db.select().from(clinicWeeklyRecordFiles)
      .where(eq(clinicWeeklyRecordFiles.recordId, recordId));
  }

  async getClinicWeeklyRecordFilesByPeriod(recordId: string, period: string): Promise<ClinicWeeklyRecordFile[]> {
    return db.select().from(clinicWeeklyRecordFiles)
      .where(and(
        eq(clinicWeeklyRecordFiles.recordId, recordId),
        eq(clinicWeeklyRecordFiles.period, period)
      ));
  }

  async createClinicWeeklyRecordFile(file: InsertClinicWeeklyRecordFile): Promise<ClinicWeeklyRecordFile> {
    const [created] = await db.insert(clinicWeeklyRecordFiles).values(file).returning();
    return created;
  }

  async getClinicWeeklyRecordFileById(id: string): Promise<ClinicWeeklyRecordFile | null> {
    const result = await db.select().from(clinicWeeklyRecordFiles)
      .where(eq(clinicWeeklyRecordFiles.id, id));
    return result[0] || null;
  }

  async deleteClinicWeeklyRecordFile(id: string): Promise<void> {
    await db.delete(clinicWeeklyRecordFiles).where(eq(clinicWeeklyRecordFiles.id, id));
  }

  async deleteClinicWeeklyRecordFilesByRecordId(recordId: string): Promise<void> {
    await db.delete(clinicWeeklyRecordFiles).where(eq(clinicWeeklyRecordFiles.recordId, recordId));
  }

  // ============================================
  // Clinic Shared Instruction Groups Implementation
  // ============================================

  async getClinicSharedInstructionGroups(
    centerId: string,
    teacherId?: string,
    weekStartDate?: string
  ): Promise<ClinicSharedInstructionGroupWithMembers[]> {
    let query = db.select().from(clinicSharedInstructionGroups)
      .where(eq(clinicSharedInstructionGroups.centerId, centerId));
    
    const groups = await query;
    
    const filtered = groups.filter(g => {
      if (teacherId && g.teacherId !== teacherId) return false;
      if (weekStartDate && g.weekStartDate !== weekStartDate) return false;
      return true;
    });
    
    const result: ClinicSharedInstructionGroupWithMembers[] = [];
    for (const group of filtered) {
      const members = await db.select().from(clinicSharedInstructionMembers)
        .where(eq(clinicSharedInstructionMembers.sharedGroupId, group.id));
      
      const membersWithRecords = await Promise.all(members.map(async m => {
        const records = await db.select().from(clinicWeeklyRecords)
          .where(eq(clinicWeeklyRecords.id, m.recordId));
        return { ...m, record: records[0] };
      }));
      
      result.push({ ...group, members: membersWithRecords });
    }
    
    return result;
  }

  async getClinicSharedInstructionGroupWithMembers(id: string): Promise<ClinicSharedInstructionGroupWithMembers | undefined> {
    const groups = await db.select().from(clinicSharedInstructionGroups)
      .where(eq(clinicSharedInstructionGroups.id, id));
    
    if (groups.length === 0) return undefined;
    
    const group = groups[0];
    const members = await db.select().from(clinicSharedInstructionMembers)
      .where(eq(clinicSharedInstructionMembers.sharedGroupId, id));
    
    const membersWithRecords = await Promise.all(members.map(async m => {
      const records = await db.select().from(clinicWeeklyRecords)
        .where(eq(clinicWeeklyRecords.id, m.recordId));
      return { ...m, record: records[0] };
    }));
    
    return { ...group, members: membersWithRecords };
  }

  async createClinicSharedInstructionGroup(data: InsertClinicSharedInstructionGroup): Promise<ClinicSharedInstructionGroup> {
    const [created] = await db.insert(clinicSharedInstructionGroups).values(data).returning();
    return created;
  }

  async updateClinicSharedInstructionGroup(id: string, data: Partial<InsertClinicSharedInstructionGroup>): Promise<ClinicSharedInstructionGroup> {
    const [updated] = await db.update(clinicSharedInstructionGroups)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clinicSharedInstructionGroups.id, id))
      .returning();
    return updated;
  }

  async deleteClinicSharedInstructionGroup(id: string): Promise<void> {
    await db.delete(clinicSharedInstructionMembers).where(eq(clinicSharedInstructionMembers.sharedGroupId, id));
    await db.delete(clinicSharedInstructionGroups).where(eq(clinicSharedInstructionGroups.id, id));
  }

  async addClinicSharedInstructionMember(data: InsertClinicSharedInstructionMember): Promise<ClinicSharedInstructionMember> {
    // First, get the group to find its period and weekStartDate
    const groups = await db.select().from(clinicSharedInstructionGroups)
      .where(eq(clinicSharedInstructionGroups.id, data.sharedGroupId));
    
    if (groups.length > 0) {
      const targetGroup = groups[0];
      
      // Find all existing memberships for this recordId
      const existingMemberships = await db.select().from(clinicSharedInstructionMembers)
        .where(eq(clinicSharedInstructionMembers.recordId, data.recordId));
      
      // Check each membership's group to see if it's for the same period/weekStartDate
      for (const membership of existingMemberships) {
        const membershipGroups = await db.select().from(clinicSharedInstructionGroups)
          .where(eq(clinicSharedInstructionGroups.id, membership.sharedGroupId));
        
        if (membershipGroups.length > 0) {
          const existingGroup = membershipGroups[0];
          // Remove from old group if same period and weekStartDate (but different group)
          if (existingGroup.period === targetGroup.period && 
              existingGroup.weekStartDate === targetGroup.weekStartDate &&
              existingGroup.id !== targetGroup.id) {
            await db.delete(clinicSharedInstructionMembers)
              .where(eq(clinicSharedInstructionMembers.id, membership.id));
            
            // Check if old group is now empty and delete it if so
            const remainingMembers = await db.select().from(clinicSharedInstructionMembers)
              .where(eq(clinicSharedInstructionMembers.sharedGroupId, existingGroup.id));
            if (remainingMembers.length === 0) {
              await db.delete(clinicSharedInstructionGroups)
                .where(eq(clinicSharedInstructionGroups.id, existingGroup.id));
            }
          }
        }
      }
    }
    
    const [created] = await db.insert(clinicSharedInstructionMembers).values(data).returning();
    return created;
  }

  async clearClinicSharedInstructionMembers(sharedGroupId: string): Promise<void> {
    await db.delete(clinicSharedInstructionMembers).where(eq(clinicSharedInstructionMembers.sharedGroupId, sharedGroupId));
  }

  async getClinicSharedInstructionMembersByRecord(recordId: string): Promise<(ClinicSharedInstructionMember & { group?: ClinicSharedInstructionGroup })[]> {
    const members = await db.select().from(clinicSharedInstructionMembers)
      .where(eq(clinicSharedInstructionMembers.recordId, recordId));
    
    const result = await Promise.all(members.map(async m => {
      const groups = await db.select().from(clinicSharedInstructionGroups)
        .where(eq(clinicSharedInstructionGroups.id, m.sharedGroupId));
      return { ...m, group: groups[0] };
    }));
    
    return result;
  }

  // ============================================
  // Attendance System Implementation
  // ============================================

  async getAttendancePinByPin(centerId: string, pin: string): Promise<AttendancePinWithStudent | undefined> {
    const result = await db.select().from(attendancePins)
      .where(and(
        eq(attendancePins.centerId, centerId),
        eq(attendancePins.pin, pin),
        eq(attendancePins.isActive, true)
      ));
    if (result.length === 0) return undefined;

    // Defense-in-depth: if the PIN belongs to a student that no longer exists
    // or is no longer linked to this center, treat the PIN as invalid AND
    // self-heal by removing the orphan row so the attendance pad stops
    // accepting it.
    const valid: AttendancePinWithStudent[] = [];
    for (const pinRecord of result) {
      const student = await this.getUser(pinRecord.studentId);
      if (!student) {
        await db.delete(attendancePins).where(eq(attendancePins.id, pinRecord.id));
        continue;
      }
      const linked = await db.select().from(userCenters).where(and(
        eq(userCenters.userId, pinRecord.studentId),
        eq(userCenters.centerId, centerId),
      )).limit(1);
      if (linked.length === 0) {
        await db.delete(attendancePins).where(eq(attendancePins.id, pinRecord.id));
        continue;
      }
      valid.push({ ...pinRecord, student });
    }
    return valid[0];
  }

  async getAttendancePins(centerId: string): Promise<AttendancePinWithStudent[]> {
    const pins = await db.select().from(attendancePins)
      .where(eq(attendancePins.centerId, centerId));
    if (pins.length === 0) return [];

    const studentsMap = new Map<string, User>();
    const studentIds = Array.from(new Set(pins.map(p => p.studentId)));
    const studentList = await db.select().from(users).where(inArray(users.id, studentIds));
    studentList.forEach(s => studentsMap.set(s.id, s));

    // Find which of those students are still linked to this center
    const links = await db.select().from(userCenters).where(and(
      inArray(userCenters.userId, studentIds),
      eq(userCenters.centerId, centerId),
    ));
    const linkedSet = new Set(links.map(l => l.userId));

    // Self-heal: drop PIN rows whose student is gone or no longer in this center,
    // so they don't keep occupying a PIN slot or matching on the attendance pad.
    const orphanIds = pins
      .filter(p => !studentsMap.has(p.studentId) || !linkedSet.has(p.studentId))
      .map(p => p.id);
    if (orphanIds.length > 0) {
      await db.delete(attendancePins).where(inArray(attendancePins.id, orphanIds));
    }

    return pins
      .filter(p => studentsMap.has(p.studentId) && linkedSet.has(p.studentId))
      .map(p => ({ ...p, student: studentsMap.get(p.studentId) }));
  }

  async getAttendancePinById(id: string): Promise<AttendancePin | undefined> {
    const result = await db.select().from(attendancePins).where(eq(attendancePins.id, id));
    return result[0];
  }

  async getAttendancePinByStudent(studentId: string, centerId: string): Promise<AttendancePin | undefined> {
    const result = await db.select().from(attendancePins)
      .where(and(
        eq(attendancePins.studentId, studentId),
        eq(attendancePins.centerId, centerId)
      ));
    return result[0];
  }

  async createAttendancePin(data: InsertAttendancePin): Promise<AttendancePin> {
    const result = await db.insert(attendancePins).values(data).returning();
    return result[0];
  }

  async updateAttendancePin(id: string, data: Partial<InsertAttendancePin>): Promise<AttendancePin> {
    const result = await db.update(attendancePins).set(data).where(eq(attendancePins.id, id)).returning();
    return result[0];
  }

  async deleteAttendancePin(id: string): Promise<void> {
    await db.delete(attendancePins).where(eq(attendancePins.id, id));
  }

  // Teacher Check-in Settings
  async getTeacherCheckInSettings(teacherId: string, centerId: string): Promise<TeacherCheckInSettings | undefined> {
    const result = await db.select().from(teacherCheckInSettings)
      .where(and(
        eq(teacherCheckInSettings.teacherId, teacherId),
        eq(teacherCheckInSettings.centerId, centerId)
      ));
    return result[0];
  }

  async getTeacherCheckInSettingsByCode(centerId: string, code: string): Promise<(TeacherCheckInSettings & { teacher?: User }) | undefined> {
    const result = await db.select().from(teacherCheckInSettings)
      .where(and(
        eq(teacherCheckInSettings.centerId, centerId),
        eq(teacherCheckInSettings.checkInCode, code),
        eq(teacherCheckInSettings.isActive, true)
      ));
    if (result.length === 0) return undefined;
    const settings = result[0];
    const teacherResult = await db.select().from(users).where(eq(users.id, settings.teacherId));
    return { ...settings, teacher: teacherResult[0] };
  }

  async getAllTeacherCheckInSettings(centerId: string): Promise<TeacherCheckInSettings[]> {
    return await db.select().from(teacherCheckInSettings)
      .where(eq(teacherCheckInSettings.centerId, centerId));
  }

  async createTeacherCheckInSettings(data: InsertTeacherCheckInSettings): Promise<TeacherCheckInSettings> {
    const result = await db.insert(teacherCheckInSettings).values(data).returning();
    return result[0];
  }

  async updateTeacherCheckInSettings(id: string, data: Partial<InsertTeacherCheckInSettings>): Promise<TeacherCheckInSettings> {
    const result = await db.update(teacherCheckInSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(teacherCheckInSettings.id, id))
      .returning();
    return result[0];
  }

  async deleteTeacherCheckInSettings(id: string): Promise<void> {
    await db.delete(teacherCheckInSettings).where(eq(teacherCheckInSettings.id, id));
  }

  async getAttendanceRecords(centerId: string, date: string): Promise<AttendanceRecordWithStudent[]> {
    const records = await db.select().from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.centerId, centerId),
        eq(attendanceRecords.checkInDate, date)
      ));
    const studentsMap = new Map<string, User>();
    const studentIds = Array.from(new Set(records.map(r => r.studentId)));
    if (studentIds.length > 0) {
      const studentList = await db.select().from(users).where(inArray(users.id, studentIds));
      studentList.forEach(s => studentsMap.set(s.id, s));
    }
    return records.map(r => ({ ...r, student: studentsMap.get(r.studentId) }));
  }

  async getAttendanceRecordsByDateWithStudents(centerId: string, date: string): Promise<(AttendanceRecord & { student?: User; class?: Class })[]> {
    const records = await db.select().from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.centerId, centerId),
        eq(attendanceRecords.checkInDate, date)
      ))
      .orderBy(attendanceRecords.checkInAt);
    
    const studentsMap = new Map<string, User>();
    const classesMap = new Map<string, Class>();
    
    const studentIds = Array.from(new Set(records.map(r => r.studentId)));
    const classIds = Array.from(new Set(records.filter(r => r.classId).map(r => r.classId!)));
    
    if (studentIds.length > 0) {
      const studentList = await db.select().from(users).where(inArray(users.id, studentIds));
      studentList.forEach(s => studentsMap.set(s.id, s));
    }
    
    if (classIds.length > 0) {
      const classList = await db.select().from(classes).where(inArray(classes.id, classIds));
      classList.forEach(c => classesMap.set(c.id, c));
    }
    
    return records.map(r => ({
      ...r,
      student: studentsMap.get(r.studentId),
      class: r.classId ? classesMap.get(r.classId) : undefined,
    }));
  }

  async getAttendanceRecordByStudentAndDate(studentId: string, date: string): Promise<AttendanceRecord | undefined> {
    const result = await db.select().from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.studentId, studentId),
        eq(attendanceRecords.checkInDate, date)
      ))
      .orderBy(desc(attendanceRecords.checkInAt));
    return result[0];
  }

  async getAttendanceRecordsByStudentAndDate(studentId: string, date: string): Promise<AttendanceRecord[]> {
    return db.select().from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.studentId, studentId),
        eq(attendanceRecords.checkInDate, date)
      ))
      .orderBy(desc(attendanceRecords.checkInAt));
  }

  async getAttendanceRecordByStudentDateAndClass(studentId: string, date: string, classId: string): Promise<AttendanceRecord | undefined> {
    const result = await db.select().from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.studentId, studentId),
        eq(attendanceRecords.checkInDate, date),
        eq(attendanceRecords.classId, classId)
      ));
    return result[0];
  }

  async getStudentEnrolledClasses(studentId: string, centerId: string): Promise<Class[]> {
    const studentEnrollments = await db.select().from(enrollments).where(eq(enrollments.studentId, studentId));
    const classIds = studentEnrollments.map(e => e.classId);
    if (classIds.length === 0) return [];
    const allClasses = await db.select().from(classes).where(
      and(
        inArray(classes.id, classIds),
        eq(classes.centerId, centerId),
        isNull(classes.deletedAt)
      )
    );
    return allClasses;
  }

  async createAttendanceRecord(data: InsertAttendanceRecord): Promise<AttendanceRecord> {
    const result = await db.insert(attendanceRecords).values({
      ...data,
      checkInAt: new Date(),
      attendanceStatus: data.attendanceStatus || "present", // Default to "present" when checking in
    }).returning();
    return result[0];
  }

  async createAttendanceRecordCheckOutOnly(data: { studentId: string; centerId: string; checkInDate: string; checkOutAt: Date }): Promise<AttendanceRecord> {
    const result = await db.insert(attendanceRecords).values({
      studentId: data.studentId,
      centerId: data.centerId,
      checkInDate: data.checkInDate,
      checkInAt: data.checkOutAt, // Set checkInAt same as checkOutAt to indicate no separate check-in
      checkOutAt: data.checkOutAt,
      attendanceStatus: "present",
    }).returning();
    return result[0];
  }

  async updateAttendanceRecord(id: string, data: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
    const result = await db.update(attendanceRecords).set(data).where(eq(attendanceRecords.id, id)).returning();
    return result[0];
  }

  async updateAttendanceRecordCheckOut(id: string, checkOutTime: Date): Promise<void> {
    await db.update(attendanceRecords).set({ checkOutAt: checkOutTime }).where(eq(attendanceRecords.id, id));
  }

  async updateAttendanceRecordCheckOutNotificationSent(id: string): Promise<void> {
    await db.update(attendanceRecords).set({ checkOutNotificationSent: true }).where(eq(attendanceRecords.id, id));
  }

  async getAttendanceRecordsForStudent(studentId: string, startDate: string, endDate: string): Promise<AttendanceRecordWithClass[]> {
    const records = await db.select().from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.studentId, studentId),
        gte(attendanceRecords.checkInDate, startDate),
        lte(attendanceRecords.checkInDate, endDate)
      ))
      .orderBy(desc(attendanceRecords.checkInDate), asc(attendanceRecords.checkInAt));
    
    // Get class information for each record
    const classIds = Array.from(new Set(records.filter(r => r.classId).map(r => r.classId as string)));
    const classMap = new Map<string, Class>();
    if (classIds.length > 0) {
      const classList = await db.select().from(classes).where(inArray(classes.id, classIds));
      classList.forEach(c => classMap.set(c.id, c));
    }
    
    return records.map(r => ({
      ...r,
      class: r.classId ? classMap.get(r.classId) : undefined
    }));
  }

  async deleteAttendanceRecord(id: string): Promise<void> {
    await db.delete(attendanceRecords).where(eq(attendanceRecords.id, id));
  }

  async deleteOldAttendanceRecords(beforeDate: string): Promise<number> {
    const result = await db.delete(attendanceRecords)
      .where(lt(attendanceRecords.checkInDate, beforeDate))
      .returning();
    return result.length;
  }

  // Teacher Work Records (선생님 근무 기록)
  async getTeacherWorkRecords(centerId: string, startDate: string, endDate: string): Promise<TeacherWorkRecord[]> {
    return await db.select().from(teacherWorkRecords)
      .where(and(
        eq(teacherWorkRecords.centerId, centerId),
        gte(teacherWorkRecords.workDate, startDate),
        lte(teacherWorkRecords.workDate, endDate)
      ))
      .orderBy(desc(teacherWorkRecords.workDate));
  }

  async getTeacherWorkRecordByDate(teacherId: string, centerId: string, workDate: string): Promise<TeacherWorkRecord | undefined> {
    const result = await db.select().from(teacherWorkRecords)
      .where(and(
        eq(teacherWorkRecords.teacherId, teacherId),
        eq(teacherWorkRecords.centerId, centerId),
        eq(teacherWorkRecords.workDate, workDate)
      ));
    return result[0];
  }

  async createTeacherWorkRecord(data: InsertTeacherWorkRecord): Promise<TeacherWorkRecord> {
    const result = await db.insert(teacherWorkRecords).values(data).returning();
    return result[0];
  }

  async updateTeacherWorkRecord(id: string, data: Partial<InsertTeacherWorkRecord>): Promise<TeacherWorkRecord> {
    const result = await db.update(teacherWorkRecords).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(teacherWorkRecords.id, id)).returning();
    return result[0];
  }

  async getTeacherWorkRecordsWithoutCheckOut(date: string): Promise<TeacherWorkRecord[]> {
    return await db.select().from(teacherWorkRecords)
      .where(and(
        eq(teacherWorkRecords.workDate, date),
        isNull(teacherWorkRecords.checkOutAt),
        eq(teacherWorkRecords.noCheckOut, false)
      ));
  }

  async markTeacherWorkRecordNoCheckOut(id: string): Promise<void> {
    await db.update(teacherWorkRecords).set({ 
      noCheckOut: true,
      updatedAt: new Date() 
    }).where(eq(teacherWorkRecords.id, id));
  }

  async markMissingCheckOuts(workDate: string): Promise<number> {
    const recordsWithoutCheckOut = await this.getTeacherWorkRecordsWithoutCheckOut(workDate);
    for (const record of recordsWithoutCheckOut) {
      await this.markTeacherWorkRecordNoCheckOut(record.id);
    }
    return recordsWithoutCheckOut.length;
  }

  async deleteOldTeacherWorkRecords(beforeDate: string): Promise<number> {
    const result = await db.delete(teacherWorkRecords)
      .where(lt(teacherWorkRecords.workDate, beforeDate))
      .returning();
    return result.length;
  }

  async getMessageTemplates(centerId: string): Promise<MessageTemplate[]> {
    return await db.select().from(messageTemplates).where(eq(messageTemplates.centerId, centerId));
  }

  async getMessageTemplate(id: string): Promise<MessageTemplate | undefined> {
    const result = await db.select().from(messageTemplates).where(eq(messageTemplates.id, id));
    return result[0];
  }

  async createMessageTemplate(data: InsertMessageTemplate): Promise<MessageTemplate> {
    const result = await db.insert(messageTemplates).values(data).returning();
    return result[0];
  }

  async updateMessageTemplate(id: string, data: Partial<InsertMessageTemplate>): Promise<MessageTemplate> {
    const result = await db.update(messageTemplates).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(messageTemplates.id, id)).returning();
    return result[0];
  }

  async deleteMessageTemplate(id: string): Promise<void> {
    await db.delete(messageTemplates).where(eq(messageTemplates.id, id));
  }

  async createNotificationLog(data: InsertNotificationLog): Promise<NotificationLog> {
    const result = await db.insert(notificationLogs).values(data).returning();
    return result[0];
  }

  async updateNotificationLog(id: string, data: Partial<NotificationLog>): Promise<NotificationLog> {
    const result = await db.update(notificationLogs).set(data).where(eq(notificationLogs.id, id)).returning();
    return result[0];
  }

  async getNotificationLogsByAttendanceRecord(attendanceRecordId: string): Promise<NotificationLog[]> {
    return await db.select().from(notificationLogs)
      .where(eq(notificationLogs.attendanceRecordId, attendanceRecordId))
      .orderBy(notificationLogs.sentAt);
  }

  // Class Notes (수업 공통 기록)
  async getClassNotes(classId: string, noteDate: string): Promise<ClassNoteWithTeacher[]> {
    const notes = await db.select().from(classNotes)
      .where(and(eq(classNotes.classId, classId), eq(classNotes.noteDate, noteDate)));
    
    const result: ClassNoteWithTeacher[] = [];
    for (const note of notes) {
      const teacher = await this.getUser(note.teacherId);
      result.push({ ...note, teacher });
    }
    return result;
  }

  async getClassNote(id: string): Promise<ClassNote | undefined> {
    const result = await db.select().from(classNotes).where(eq(classNotes.id, id));
    return result[0];
  }

  async createClassNote(data: InsertClassNote): Promise<ClassNote> {
    const result = await db.insert(classNotes).values(data).returning();
    return result[0];
  }

  async updateClassNote(id: string, data: Partial<InsertClassNote>): Promise<ClassNote> {
    const result = await db.update(classNotes).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(classNotes.id, id)).returning();
    return result[0];
  }

  async deleteClassNote(id: string): Promise<void> {
    await db.delete(classNotes).where(eq(classNotes.id, id));
  }

  // Student Class Notes (학생별 수업 기록)
  async getStudentClassNotes(classId: string, noteDate: string): Promise<StudentClassNoteWithDetails[]> {
    const notes = await db.select().from(studentClassNotes)
      .where(and(eq(studentClassNotes.classId, classId), eq(studentClassNotes.noteDate, noteDate)));
    
    const result: StudentClassNoteWithDetails[] = [];
    for (const note of notes) {
      const student = await this.getUser(note.studentId);
      const teacher = await this.getUser(note.teacherId);
      result.push({ ...note, student, teacher });
    }
    return result;
  }

  async getStudentClassNote(id: string): Promise<StudentClassNote | undefined> {
    const result = await db.select().from(studentClassNotes).where(eq(studentClassNotes.id, id));
    return result[0];
  }

  async getStudentClassNoteByKey(studentId: string, classId: string, noteDate: string): Promise<StudentClassNote | undefined> {
    const result = await db.select().from(studentClassNotes)
      .where(and(
        eq(studentClassNotes.studentId, studentId),
        eq(studentClassNotes.classId, classId),
        eq(studentClassNotes.noteDate, noteDate),
      ))
      .limit(1);
    return result[0];
  }

  // 동일 학생/반/날짜 기록의 중복 생성을 원자적으로 방지한다.
  // 트랜잭션 내 advisory lock으로 동시 요청을 직렬화하여 조회→삽입 사이의
  // 경쟁(TOCTOU)을 제거한다. (운영 DB에 unique 제약을 추가하지 않고도
  // 중복 등록을 차단)
  async upsertStudentClassNote(data: InsertStudentClassNote): Promise<StudentClassNote> {
    return await db.transaction(async (tx) => {
      const lockKey = `student_class_note:${data.studentId}:${data.classId}:${data.noteDate}`;
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);

      const existingRows = await tx.select().from(studentClassNotes)
        .where(and(
          eq(studentClassNotes.studentId, data.studentId),
          eq(studentClassNotes.classId, data.classId),
          eq(studentClassNotes.noteDate, data.noteDate),
        ))
        .limit(1);
      const existing = existingRows[0];

      if (existing) {
        const updated = await tx.update(studentClassNotes).set({
          content: data.content?.trim() ? data.content : (existing.content || " "),
          attitudeScore: data.attitudeScore,
          updatedAt: new Date(),
        }).where(eq(studentClassNotes.id, existing.id)).returning();
        return updated[0];
      }

      const inserted = await tx.insert(studentClassNotes).values(data).returning();
      return inserted[0];
    });
  }

  async createStudentClassNote(data: InsertStudentClassNote): Promise<StudentClassNote> {
    const result = await db.insert(studentClassNotes).values(data).returning();
    return result[0];
  }

  async updateStudentClassNote(id: string, data: Partial<InsertStudentClassNote>): Promise<StudentClassNote> {
    const result = await db.update(studentClassNotes).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(studentClassNotes.id, id)).returning();
    return result[0];
  }

  async deleteStudentClassNote(id: string): Promise<void> {
    await db.delete(studentClassNotes).where(eq(studentClassNotes.id, id));
  }

  // SOLAPI Credentials
  async getSolapiCredentials(centerId: string): Promise<SolapiCredentials | undefined> {
    const result = await db.select().from(solapiCredentials).where(eq(solapiCredentials.centerId, centerId));
    return result[0];
  }

  async getAllSolapiCredentials(): Promise<SolapiCredentials[]> {
    return await db.select().from(solapiCredentials);
  }

  async upsertSolapiCredentials(data: InsertSolapiCredentials): Promise<SolapiCredentials> {
    const existing = await this.getSolapiCredentials(data.centerId);
    if (existing) {
      const result = await db.update(solapiCredentials).set({
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        senderNumber: data.senderNumber,
        updatedAt: new Date(),
      }).where(eq(solapiCredentials.centerId, data.centerId)).returning();
      return result[0];
    }
    const result = await db.insert(solapiCredentials).values(data).returning();
    return result[0];
  }

  async deleteSolapiCredentials(centerId: string): Promise<void> {
    await db.delete(solapiCredentials).where(eq(solapiCredentials.centerId, centerId));
  }

  // Study Cafe Settings
  async getStudyCafeSettings(centerId: string): Promise<StudyCafeSettings | undefined> {
    const result = await db.select().from(studyCafeSettings).where(eq(studyCafeSettings.centerId, centerId));
    return result[0];
  }

  async upsertStudyCafeSettings(data: InsertStudyCafeSettings): Promise<StudyCafeSettings> {
    const existing = await this.getStudyCafeSettings(data.centerId);
    if (existing) {
      const updateData: Record<string, any> = {
        isEnabled: data.isEnabled,
        notice: data.notice,
        updatedAt: new Date(),
      };
      if (data.entryPassword !== undefined) {
        updateData.entryPassword = data.entryPassword;
      }
      const result = await db.update(studyCafeSettings).set(updateData).where(eq(studyCafeSettings.centerId, data.centerId)).returning();
      return result[0];
    }
    const result = await db.insert(studyCafeSettings).values(data).returning();
    return result[0];
  }

  async getStudyCafeEnabledCenters(): Promise<StudyCafeSettings[]> {
    return await db.select().from(studyCafeSettings).where(eq(studyCafeSettings.isEnabled, true));
  }

  // Study Cafe Seats
  async getStudyCafeSeats(centerId: string): Promise<StudyCafeSeat[]> {
    return await db.select().from(studyCafeSeats).where(eq(studyCafeSeats.centerId, centerId));
  }

  async createStudyCafeSeat(data: InsertStudyCafeSeat): Promise<StudyCafeSeat> {
    const result = await db.insert(studyCafeSeats).values(data).returning();
    return result[0];
  }

  async updateStudyCafeSeat(id: string, data: Partial<InsertStudyCafeSeat>): Promise<StudyCafeSeat> {
    const result = await db.update(studyCafeSeats).set(data).where(eq(studyCafeSeats.id, id)).returning();
    return result[0];
  }

  async deleteStudyCafeSeat(id: string): Promise<void> {
    await db.delete(studyCafeSeats).where(eq(studyCafeSeats.id, id));
  }

  async initializeStudyCafeSeats(centerId: string): Promise<StudyCafeSeat[]> {
    const existingSeats = await this.getStudyCafeSeats(centerId);
    if (existingSeats.length > 0) {
      return existingSeats;
    }

    const seatLayout: { seatNumber: number; row: number; col: number }[] = [
      { seatNumber: 21, row: 0, col: 0 },
      { seatNumber: 22, row: 1, col: 0 },
      { seatNumber: 23, row: 2, col: 0 },
      { seatNumber: 24, row: 3, col: 0 },
      { seatNumber: 25, row: 4, col: 0 },
      { seatNumber: 26, row: 5, col: 0 },
      { seatNumber: 20, row: 0, col: 1 },
      { seatNumber: 19, row: 1, col: 1 },
      { seatNumber: 18, row: 2, col: 1 },
      { seatNumber: 17, row: 3, col: 1 },
      { seatNumber: 16, row: 4, col: 1 },
      { seatNumber: 15, row: 0, col: 2 },
      { seatNumber: 14, row: 1, col: 2 },
      { seatNumber: 13, row: 2, col: 2 },
      { seatNumber: 12, row: 3, col: 2 },
      { seatNumber: 11, row: 4, col: 2 },
      { seatNumber: 6, row: 0, col: 3 },
      { seatNumber: 7, row: 1, col: 3 },
      { seatNumber: 8, row: 2, col: 3 },
      { seatNumber: 9, row: 3, col: 3 },
      { seatNumber: 10, row: 4, col: 3 },
      { seatNumber: 5, row: 0, col: 4 },
      { seatNumber: 4, row: 1, col: 4 },
      { seatNumber: 3, row: 2, col: 4 },
      { seatNumber: 2, row: 3, col: 4 },
      { seatNumber: 1, row: 4, col: 4 },
    ];

    const createdSeats: StudyCafeSeat[] = [];
    for (const seat of seatLayout) {
      const created = await this.createStudyCafeSeat({
        centerId,
        seatNumber: seat.seatNumber,
        row: seat.row,
        col: seat.col,
        isActive: true,
      });
      createdSeats.push(created);
    }
    return createdSeats;
  }

  async getStudyCafeSeatsWithStatus(centerId: string): Promise<StudyCafeSeatWithStatus[]> {
    await this.expireOldReservations();
    await this.expireOldFixedSeats();

    const seats = await this.getStudyCafeSeats(centerId);
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const result: StudyCafeSeatWithStatus[] = [];
    for (const seat of seats) {
      const activeReservation = await this.getActiveReservation(seat.id);
      const activeFixedSeat = await this.getActiveFixedSeat(seat.id);

      let remainingMinutes: number | undefined;
      let reservationWithStudent: (StudyCafeReservation & { student?: User }) | undefined;
      let fixedSeatWithStudent: (StudyCafeFixedSeat & { student?: User }) | undefined;

      if (activeReservation) {
        const endTime = new Date(activeReservation.endAt);
        remainingMinutes = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 60000));
        const student = await this.getUser(activeReservation.studentId);
        reservationWithStudent = { ...activeReservation, student };
      }

      if (activeFixedSeat) {
        const student = await this.getUser(activeFixedSeat.studentId);
        fixedSeatWithStudent = { ...activeFixedSeat, student };
      }

      result.push({
        ...seat,
        reservation: reservationWithStudent,
        fixedSeat: fixedSeatWithStudent,
        remainingMinutes,
        isAvailable: !activeReservation && !activeFixedSeat,
        isFixed: !!activeFixedSeat,
      });
    }

    return result.sort((a, b) => a.seatNumber - b.seatNumber);
  }

  // Reservations
  async getActiveReservation(seatId: string): Promise<StudyCafeReservation | undefined> {
    const now = new Date();
    const result = await db.select().from(studyCafeReservations)
      .where(and(
        eq(studyCafeReservations.seatId, seatId),
        eq(studyCafeReservations.status, "active")
      ));
    const reservation = result[0];
    if (reservation && new Date(reservation.endAt) > now) {
      return reservation;
    }
    return undefined;
  }

  async getStudentActiveReservation(studentId: string, centerId: string): Promise<StudyCafeReservation | undefined> {
    const now = new Date();
    const result = await db.select().from(studyCafeReservations)
      .where(and(
        eq(studyCafeReservations.studentId, studentId),
        eq(studyCafeReservations.centerId, centerId),
        eq(studyCafeReservations.status, "active")
      ));
    const reservation = result[0];
    if (reservation && new Date(reservation.endAt) > now) {
      return reservation;
    }
    return undefined;
  }

  async getStudyCafeReservation(id: string): Promise<StudyCafeReservation | undefined> {
    const result = await db.select().from(studyCafeReservations)
      .where(eq(studyCafeReservations.id, id));
    return result[0];
  }

  async createStudyCafeReservation(data: InsertStudyCafeReservation): Promise<StudyCafeReservation> {
    const result = await db.insert(studyCafeReservations).values(data).returning();
    return result[0];
  }

  async updateStudyCafeReservation(id: string, data: Partial<InsertStudyCafeReservation>): Promise<StudyCafeReservation> {
    const result = await db.update(studyCafeReservations).set(data).where(eq(studyCafeReservations.id, id)).returning();
    return result[0];
  }

  async expireOldReservations(): Promise<number> {
    const now = new Date();
    const result = await db.update(studyCafeReservations).set({ status: "expired" })
      .where(and(
        eq(studyCafeReservations.status, "active"),
        lt(studyCafeReservations.endAt, now)
      )).returning();
    return result.length;
  }

  // Fixed Seats
  async getActiveFixedSeat(seatId: string): Promise<StudyCafeFixedSeat | undefined> {
    const today = new Date().toISOString().split('T')[0];
    const result = await db.select().from(studyCafeFixedSeats)
      .where(eq(studyCafeFixedSeats.seatId, seatId));
    const fixedSeat = result[0];
    if (fixedSeat && fixedSeat.startDate <= today && fixedSeat.endDate >= today) {
      return fixedSeat;
    }
    return undefined;
  }

  async getStudentActiveFixedSeat(studentId: string, centerId: string): Promise<StudyCafeFixedSeat | undefined> {
    const today = new Date().toISOString().split('T')[0];
    const result = await db.select().from(studyCafeFixedSeats)
      .where(and(
        eq(studyCafeFixedSeats.studentId, studentId),
        eq(studyCafeFixedSeats.centerId, centerId)
      ));
    const fixedSeat = result[0];
    if (fixedSeat && fixedSeat.startDate <= today && fixedSeat.endDate >= today) {
      return fixedSeat;
    }
    return undefined;
  }

  async getStudyCafeFixedSeatById(id: string): Promise<StudyCafeFixedSeat | undefined> {
    const result = await db.select().from(studyCafeFixedSeats)
      .where(eq(studyCafeFixedSeats.id, id));
    return result[0];
  }

  async getFixedSeats(centerId: string): Promise<(StudyCafeFixedSeat & { student?: User; seat?: StudyCafeSeat })[]> {
    const fixedSeats = await db.select().from(studyCafeFixedSeats)
      .where(eq(studyCafeFixedSeats.centerId, centerId));
    
    const result: (StudyCafeFixedSeat & { student?: User; seat?: StudyCafeSeat })[] = [];
    for (const fs of fixedSeats) {
      const student = await this.getUser(fs.studentId);
      const seats = await db.select().from(studyCafeSeats).where(eq(studyCafeSeats.id, fs.seatId));
      result.push({ ...fs, student, seat: seats[0] });
    }
    return result;
  }

  async createStudyCafeFixedSeat(data: InsertStudyCafeFixedSeat): Promise<StudyCafeFixedSeat> {
    const result = await db.insert(studyCafeFixedSeats).values(data).returning();
    return result[0];
  }

  async updateStudyCafeFixedSeat(id: string, data: Partial<InsertStudyCafeFixedSeat>): Promise<StudyCafeFixedSeat> {
    const result = await db.update(studyCafeFixedSeats).set(data).where(eq(studyCafeFixedSeats.id, id)).returning();
    return result[0];
  }

  async deleteStudyCafeFixedSeat(id: string): Promise<void> {
    await db.delete(studyCafeFixedSeats).where(eq(studyCafeFixedSeats.id, id));
  }

  async expireOldFixedSeats(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const result = await db.delete(studyCafeFixedSeats)
      .where(lt(studyCafeFixedSeats.endDate, today))
      .returning();
    return result.length;
  }

  // Tuition Access Passwords
  async getTuitionAccessPassword(studentId: string): Promise<TuitionAccessPassword | undefined> {
    const result = await db.select().from(tuitionAccessPasswords)
      .where(eq(tuitionAccessPasswords.studentId, studentId));
    return result[0];
  }

  async setTuitionAccessPassword(studentId: string, password: string): Promise<TuitionAccessPassword> {
    const existing = await this.getTuitionAccessPassword(studentId);
    if (existing) {
      const result = await db.update(tuitionAccessPasswords)
        .set({ password, updatedAt: new Date() })
        .where(eq(tuitionAccessPasswords.studentId, studentId))
        .returning();
      return result[0];
    }
    const result = await db.insert(tuitionAccessPasswords)
      .values({ studentId, password })
      .returning();
    return result[0];
  }

  async deleteTuitionAccessPassword(studentId: string): Promise<void> {
    await db.delete(tuitionAccessPasswords)
      .where(eq(tuitionAccessPasswords.studentId, studentId));
  }

  // Tuition Guidance
  async getTuitionGuidance(centerId: string): Promise<TuitionGuidance | undefined> {
    const result = await db.select().from(tuitionGuidances)
      .where(eq(tuitionGuidances.centerId, centerId));
    return result[0];
  }

  async upsertTuitionGuidance(centerId: string, data: { guidanceText?: string | null; imageUrls?: string[] }): Promise<TuitionGuidance> {
    const existing = await this.getTuitionGuidance(centerId);
    if (existing) {
      const result = await db.update(tuitionGuidances)
        .set({ 
          guidanceText: data.guidanceText ?? existing.guidanceText,
          imageUrls: data.imageUrls ?? existing.imageUrls,
          updatedAt: new Date() 
        })
        .where(eq(tuitionGuidances.centerId, centerId))
        .returning();
      return result[0];
    }
    const result = await db.insert(tuitionGuidances)
      .values({ 
        centerId, 
        guidanceText: data.guidanceText,
        imageUrls: data.imageUrls || []
      })
      .returning();
    return result[0];
  }

  // Tuition Notifications
  async getTuitionNotifications(centerId: string): Promise<(TuitionNotification & { student?: User; parent?: User; sender?: User })[]> {
    const notifications = await db.select().from(tuitionNotifications)
      .where(eq(tuitionNotifications.centerId, centerId))
      .orderBy(tuitionNotifications.createdAt);

    // Build a lookup of exit records to recover names for deleted students
    const exitRecords = await db.select().from(studentExitRecords)
      .where(eq(studentExitRecords.centerId, centerId));
    const exitNameById = new Map<string, string>();
    for (const er of exitRecords) {
      if (!exitNameById.has(er.studentId)) {
        exitNameById.set(er.studentId, er.studentName);
      }
    }

    // Batch-load all referenced users in a single query to avoid N+1 (3 lookups per row).
    const userIds = new Set<string>();
    for (const notification of notifications) {
      if (notification.studentId) userIds.add(notification.studentId);
      if (notification.parentId) userIds.add(notification.parentId);
      if (notification.sentById) userIds.add(notification.sentById);
    }
    const userRows = userIds.size > 0
      ? await db.select().from(users).where(inArray(users.id, Array.from(userIds)))
      : [];
    const userById = new Map<string, User>(userRows.map(u => [u.id, u]));

    const results: (TuitionNotification & { student?: User; parent?: User; sender?: User })[] = [];
    for (const notification of notifications) {
      let student = userById.get(notification.studentId);
      if (!student) {
        const exitName = exitNameById.get(notification.studentId);
        // Synthetic placeholder so UI can render "이름 (퇴원생)" (or just "(퇴원생)" if name lost)
        const placeholderName = exitName ? `${exitName} (퇴원생)` : "(퇴원생)";
        student = {
          id: notification.studentId,
          name: placeholderName,
          role: 1, // STUDENT
        } as unknown as User;
      }
      const parent = notification.parentId ? userById.get(notification.parentId) : undefined;
      const sender = userById.get(notification.sentById);
      results.push({ ...notification, student, parent, sender });
    }
    return results.reverse(); // Most recent first
  }

  async getTuitionNotificationsByStudent(studentId: string, centerId?: string): Promise<TuitionNotification[]> {
    let query = db.select().from(tuitionNotifications)
      .where(eq(tuitionNotifications.studentId, studentId))
      .orderBy(tuitionNotifications.createdAt);
    
    if (centerId) {
      query = db.select().from(tuitionNotifications)
        .where(and(
          eq(tuitionNotifications.studentId, studentId),
          eq(tuitionNotifications.centerId, centerId)
        ))
        .orderBy(tuitionNotifications.createdAt);
    }
    
    return await query;
  }

  async getTuitionNotificationById(id: string): Promise<TuitionNotification | undefined> {
    const result = await db.select().from(tuitionNotifications)
      .where(eq(tuitionNotifications.id, id));
    return result[0];
  }

  async createTuitionNotification(data: InsertTuitionNotification): Promise<TuitionNotification> {
    const result = await db.insert(tuitionNotifications).values(data).returning();
    return result[0];
  }

  async updateTuitionNotificationPaymentStatus(id: string, paymentStatus: string, paymentMethod?: string, paymentMemo?: string): Promise<TuitionNotification | undefined> {
    const updateData: Record<string, any> = { 
      paymentStatus,
      paidAt: paymentStatus === "paid" ? new Date() : null
    };
    
    // Update payment method if provided and status is paid
    if (paymentMethod && paymentStatus === "paid") {
      updateData.paymentMethod = paymentMethod;
    }
    
    // Update payment memo if provided
    if (paymentMemo !== undefined) {
      updateData.paymentMemo = paymentMemo;
    }
    
    const result = await db.update(tuitionNotifications)
      .set(updateData)
      .where(eq(tuitionNotifications.id, id))
      .returning();
    
    return result[0];
  }

  async deleteTuitionNotification(id: string): Promise<boolean> {
    const result = await db.delete(tuitionNotifications)
      .where(eq(tuitionNotifications.id, id))
      .returning();
    return result.length > 0;
  }

  async getTuitionNotificationByOrderId(orderId: string): Promise<TuitionNotification | undefined> {
    const result = await db.select().from(tuitionNotifications)
      .where(eq(tuitionNotifications.tossOrderId, orderId));
    return result[0];
  }

  async getPendingTuitionNotificationsWithOrderId(): Promise<TuitionNotification[]> {
    return await db.select().from(tuitionNotifications)
      .where(and(
        eq(tuitionNotifications.paymentStatus, "pending"),
        isNotNull(tuitionNotifications.tossOrderId),
        ne(tuitionNotifications.tossOrderId, ""),
      ));
  }

  async updateTuitionNotificationTossOrderId(id: string, orderId: string): Promise<TuitionNotification | undefined> {
    const result = await db.update(tuitionNotifications)
      .set({ tossOrderId: orderId })
      .where(eq(tuitionNotifications.id, id))
      .returning();
    return result[0];
  }

  async updateTuitionNotificationPayment(id: string, data: { paymentStatus: string; tossPaymentKey: string; paidAt: Date; paymentMethod?: string }): Promise<TuitionNotification | undefined> {
    const updateData: Record<string, any> = {
      paymentStatus: data.paymentStatus,
      tossPaymentKey: data.tossPaymentKey,
      paidAt: data.paidAt,
    };
    if (data.paymentMethod) {
      updateData.paymentMethod = data.paymentMethod;
    }
    const result = await db.update(tuitionNotifications)
      .set(updateData)
      .where(eq(tuitionNotifications.id, id))
      .returning();
    return result[0];
  }

  // 원자적 결제완료 처리: 현재 상태가 pending 일 때만 paid 로 갱신한다.
  // (웹훅/대사/confirm 동시 실행 시 이미 처리·취소된 건을 덮어쓰지 않도록 compare-and-set)
  async markTuitionNotificationPaidIfPending(id: string, data: { tossPaymentKey: string; paidAt: Date; paymentMethod?: string }): Promise<TuitionNotification | undefined> {
    const updateData: Record<string, any> = {
      paymentStatus: "paid",
      tossPaymentKey: data.tossPaymentKey,
      paidAt: data.paidAt,
    };
    if (data.paymentMethod) {
      updateData.paymentMethod = data.paymentMethod;
    }
    const result = await db.update(tuitionNotifications)
      .set(updateData)
      .where(and(
        eq(tuitionNotifications.id, id),
        eq(tuitionNotifications.paymentStatus, "pending"),
      ))
      .returning();
    return result[0];
  }

  // Student Monthly Reports
  async getStudentMonthlyReport(id: string): Promise<StudentMonthlyReport | undefined> {
    const result = await db.select().from(studentMonthlyReports).where(eq(studentMonthlyReports.id, id));
    return result[0];
  }

  async getStudentMonthlyReportByMonth(studentId: string, year: number, month: number): Promise<StudentMonthlyReport | undefined> {
    const result = await db.select().from(studentMonthlyReports)
      .where(and(
        eq(studentMonthlyReports.studentId, studentId),
        eq(studentMonthlyReports.year, year),
        eq(studentMonthlyReports.month, month)
      ));
    return result[0];
  }

  async getStudentMonthlyReports(centerId: string, year: number, month: number): Promise<(StudentMonthlyReport & { student?: User; creator?: User })[]> {
    const reports = await db.select().from(studentMonthlyReports)
      .where(and(
        eq(studentMonthlyReports.centerId, centerId),
        eq(studentMonthlyReports.year, year),
        eq(studentMonthlyReports.month, month)
      ));
    
    const results: (StudentMonthlyReport & { student?: User; creator?: User })[] = [];
    for (const report of reports) {
      const student = await this.getUser(report.studentId);
      const creator = await this.getUser(report.createdById);
      results.push({ ...report, student, creator });
    }
    return results;
  }

  async createStudentMonthlyReport(data: InsertStudentMonthlyReport): Promise<StudentMonthlyReport> {
    const result = await db.insert(studentMonthlyReports).values(data).returning();
    return result[0];
  }

  async updateStudentMonthlyReport(id: string, data: Partial<InsertStudentMonthlyReport>): Promise<StudentMonthlyReport> {
    const result = await db.update(studentMonthlyReports)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(studentMonthlyReports.id, id))
      .returning();
    return result[0];
  }

  async deleteStudentMonthlyReport(id: string): Promise<void> {
    await db.delete(studentMonthlyReports).where(eq(studentMonthlyReports.id, id));
  }

  // System Settings
  async getSystemSetting(key: string): Promise<string | null> {
    const result = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return result[0]?.value ?? null;
  }

  async setSystemSetting(key: string, value: string): Promise<void> {
    await db.insert(systemSettings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value, updatedAt: new Date() }
      });
  }

  // Promote all student grades (for auto-promotion)
  async promoteAllStudentGrades(): Promise<number> {
    const gradeMap: Record<string, string> = {
      "초1": "초2", "초2": "초3", "초3": "초4", "초4": "초5", "초5": "초6", "초6": "중1",
      "중1": "중2", "중2": "중3", "중3": "고1",
      "고1": "고2", "고2": "고3", "고3": "고3",
    };
    
    const allUsers = await this.getUsers();
    const students = allUsers.filter(u => u.role === 1 && u.grade);
    
    let promotedCount = 0;
    for (const student of students) {
      const currentGrade = student.grade;
      const nextGrade = currentGrade ? gradeMap[currentGrade] : null;
      
      if (nextGrade && nextGrade !== currentGrade) {
        await this.updateUser(student.id, { grade: nextGrade });
        promotedCount++;
      }
    }
    
    return promotedCount;
  }

  // Notification methods
  async getNotifications(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db.select().from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
    return result.length;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification).returning();
    const created = result[0];
    
    try {
      const { sendPushNotification } = await import("./services/web-push");
      sendPushNotification(notification.userId, {
        title: notification.title,
        body: notification.message,
        url: notification.relatedId ? `/${notification.relatedType || ''}` : '/',
        tag: notification.type,
      }).catch(err => console.error("[WebPush] Background send error:", err));
    } catch (e) {
    }
    
    return created;
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async deleteNotification(id: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  async deleteNotificationsByRelated(relatedId: string, type: string): Promise<void> {
    await db.delete(notifications).where(
      and(eq(notifications.relatedId, relatedId), eq(notifications.type, type))
    );
  }

  async getPushSubscriptionsByUser(userId: string): Promise<PushSubscription[]> {
    return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }

  async createPushSubscription(data: InsertPushSubscription): Promise<PushSubscription> {
    const existing = await db.select().from(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.userId, data.userId),
        eq(pushSubscriptions.endpoint, data.endpoint)
      ));
    if (existing.length > 0) {
      const result = await db.update(pushSubscriptions)
        .set({ p256dh: data.p256dh, auth: data.auth, lastUsedAt: new Date(), userAgent: data.userAgent })
        .where(eq(pushSubscriptions.id, existing[0].id))
        .returning();
      return result[0];
    }
    const result = await db.insert(pushSubscriptions).values(data).returning();
    return result[0];
  }

  async deletePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async deletePushSubscriptionsByUser(userId: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }

  // Todo methods
  async getTodo(id: string): Promise<TodoWithDetails | undefined> {
    const result = await db.select().from(todos).where(eq(todos.id, id));
    if (!result[0]) return undefined;

    const todo = result[0];
    const creator = await this.getUser(todo.creatorId);
    const assigneesList = await this.getTodoAssignees(id);

    return {
      ...todo,
      creator,
      assignees: assigneesList,
    };
  }

  async getTodos(centerId: string, assigneeId?: string): Promise<TodoWithDetails[]> {
    const allTodos = await db.select().from(todos)
      .where(and(
        eq(todos.centerId, centerId),
        eq(todos.isActive, true)
      ))
      .orderBy(desc(todos.createdAt));

    if (allTodos.length === 0) return [];

    const todoIds = allTodos.map(t => t.id);
    
    // Batch fetch all assignees for all todos at once
    const allAssignees = await db.select().from(todoAssignees)
      .where(inArray(todoAssignees.todoId, todoIds));
    
    // Batch fetch all users (creators + assignees)
    const creatorIds = allTodos.map(t => t.creatorId);
    const assigneeUserIds = allAssignees.map(a => a.assigneeId);
    const allUserIds = Array.from(new Set([...creatorIds, ...assigneeUserIds]));
    const allUsers = allUserIds.length > 0 
      ? await db.select().from(users).where(inArray(users.id, allUserIds))
      : [];
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    
    const assigneesByTodoId = new Map<string, (TodoAssignee & { user?: User })[]>();
    for (const assignee of allAssignees) {
      if (!assigneesByTodoId.has(assignee.todoId)) {
        assigneesByTodoId.set(assignee.todoId, []);
      }
      assigneesByTodoId.get(assignee.todoId)!.push({
        ...assignee,
        user: userMap.get(assignee.assigneeId),
      });
    }

    const result: TodoWithDetails[] = [];
    for (const todo of allTodos) {
      const assigneesList = assigneesByTodoId.get(todo.id) || [];
      
      if (assigneeId) {
        const isAssigned = assigneesList.some(a => a.assigneeId === assigneeId);
        if (!isAssigned) continue;
      }

      result.push({
        ...todo,
        creator: userMap.get(todo.creatorId),
        assignees: assigneesList,
      });
    }

    return result;
  }

  async getTodosByDate(centerId: string, date: string, assigneeId?: string): Promise<TodoWithDetails[]> {
    const allTodos = await this.getTodos(centerId, assigneeId);
    
    return allTodos.filter(todo => {
      if (todo.recurrence === "none") {
        return todo.dueDate === date;
      }
      
      const anchor = todo.recurrenceAnchorDate || todo.dueDate;
      const anchorDate = new Date(anchor);
      const targetDate = new Date(date);
      
      if (targetDate < anchorDate) return false;
      
      if (todo.recurrence === "weekly") {
        const diffDays = Math.floor((targetDate.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays % 7 === 0;
      }
      
      if (todo.recurrence === "monthly") {
        return anchorDate.getDate() === targetDate.getDate();
      }
      
      return false;
    });
  }

  async createTodo(todo: InsertTodo, assigneeIds: string[]): Promise<TodoWithDetails> {
    const result = await db.insert(todos).values({
      ...todo,
      recurrenceAnchorDate: todo.recurrence !== "none" ? todo.dueDate : null,
    }).returning();
    const newTodo = result[0];

    const uniqueAssigneeIds = Array.from(new Set(assigneeIds));
    for (const assigneeId of uniqueAssigneeIds) {
      await db.insert(todoAssignees).values({
        todoId: newTodo.id,
        assigneeId,
      });
    }

    return (await this.getTodo(newTodo.id))!;
  }

  async updateTodo(id: string, data: Partial<InsertTodo>, assigneeIds?: string[]): Promise<Todo> {
    const result = await db.update(todos)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(todos.id, id))
      .returning();
    if (!result[0]) throw new Error("Todo not found");

    // Update assignees if provided
    if (assigneeIds !== undefined) {
      const uniqueAssigneeIds = Array.from(new Set(assigneeIds));
      // Get existing base assignees (without completedForDate)
      const existingAssignees = await db.select().from(todoAssignees)
        .where(and(
          eq(todoAssignees.todoId, id),
          isNull(todoAssignees.completedForDate)
        ));

      const existingIds = Array.from(new Set(existingAssignees.map(a => a.assigneeId)));
      const toAdd = uniqueAssigneeIds.filter(id => !existingIds.includes(id));
      const toRemove = existingIds.filter(id => !uniqueAssigneeIds.includes(id));

      // Remove old assignees (including their completion records)
      for (const assigneeId of toRemove) {
        await db.delete(todoAssignees).where(and(
          eq(todoAssignees.todoId, id),
          eq(todoAssignees.assigneeId, assigneeId)
        ));
      }

      // Add new assignees
      for (const assigneeId of toAdd) {
        await db.insert(todoAssignees).values({
          todoId: id,
          assigneeId,
        });
      }
    }

    return result[0];
  }

  async deleteTodo(id: string): Promise<void> {
    await db.delete(todoAssignees).where(eq(todoAssignees.todoId, id));
    await db.delete(todos).where(eq(todos.id, id));
  }

  async toggleTodoComplete(todoId: string, assigneeId: string, date: string): Promise<TodoAssignee> {
    const existing = await db.select().from(todoAssignees)
      .where(and(
        eq(todoAssignees.todoId, todoId),
        eq(todoAssignees.assigneeId, assigneeId),
        eq(todoAssignees.completedForDate, date)
      ));

    if (existing[0]) {
      await db.delete(todoAssignees).where(eq(todoAssignees.id, existing[0].id));
      const base = await db.select().from(todoAssignees)
        .where(and(
          eq(todoAssignees.todoId, todoId),
          eq(todoAssignees.assigneeId, assigneeId),
          eq(todoAssignees.completedForDate, null as any)
        ));
      return base[0] || existing[0];
    }

    const result = await db.insert(todoAssignees).values({
      todoId,
      assigneeId,
      isCompleted: true,
      completedAt: new Date(),
      completedForDate: date,
    }).returning();
    return result[0];
  }

  async getTodoAssignees(todoId: string): Promise<(TodoAssignee & { user?: User })[]> {
    const assignees = await db.select().from(todoAssignees)
      .where(eq(todoAssignees.todoId, todoId));

    const result: (TodoAssignee & { user?: User })[] = [];
    const seenIds = new Set<string>();
    for (const assignee of assignees) {
      if (seenIds.has(assignee.assigneeId)) continue;
      seenIds.add(assignee.assigneeId);
      const user = await this.getUser(assignee.assigneeId);
      result.push({ ...assignee, user });
    }
    return result;
  }

  async isTodoCompletedForDate(todoId: string, assigneeId: string, date: string): Promise<boolean> {
    const result = await db.select().from(todoAssignees)
      .where(and(
        eq(todoAssignees.todoId, todoId),
        eq(todoAssignees.assigneeId, assigneeId),
        eq(todoAssignees.completedForDate, date)
      ));
    return result.length > 0;
  }

  // Student Exit Records (학생 퇴원 기록)
  async createStudentExitRecord(data: InsertStudentExitRecord): Promise<StudentExitRecord> {
    const result = await db.insert(studentExitRecords).values(data).returning();
    return result[0];
  }

  async getStudentExitRecords(centerId: string): Promise<StudentExitRecord[]> {
    return await db.select().from(studentExitRecords)
      .where(eq(studentExitRecords.centerId, centerId))
      .orderBy(desc(studentExitRecords.createdAt));
  }

  async getMonthlyExitSummary(centerId: string, months: number): Promise<{ month: string; exitCount: number; reasons: Record<string, number> }[]> {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    const startMonthStr = `${startMonth.getFullYear()}-${String(startMonth.getMonth() + 1).padStart(2, '0')}`;
    
    const records = await db.select().from(studentExitRecords)
      .where(and(
        eq(studentExitRecords.centerId, centerId),
        gte(studentExitRecords.exitMonth, startMonthStr)
      ));
    
    const summary: Record<string, { exitCount: number; reasons: Record<string, number> }> = {};
    
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      summary[monthKey] = { exitCount: 0, reasons: {} };
    }
    
    for (const record of records) {
      if (summary[record.exitMonth]) {
        summary[record.exitMonth].exitCount++;
        // 계정 삭제 시 자동 생성된 기록은 사유가 "기타"로 고정되어 있어
        // 퇴원 사유 통계를 왜곡하므로 사유 집계에서는 제외 (퇴원 수에는 포함)
        if (record.notes === "계정 삭제 시 자동 기록") continue;
        for (const reason of record.reasons || []) {
          summary[record.exitMonth].reasons[reason] = (summary[record.exitMonth].reasons[reason] || 0) + 1;
        }
      }
    }
    
    return Object.entries(summary)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  async getExitRecordsByTeacher(centerId: string, months: number): Promise<{ teacherId: string; teacherName: string; exitCount: number; totalStudents: number; exitRatio: number }[]> {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    const startMonthStr = `${startMonth.getFullYear()}-${String(startMonth.getMonth() + 1).padStart(2, '0')}`;
    
    const exitRecords = await db.select().from(studentExitRecords)
      .where(and(
        eq(studentExitRecords.centerId, centerId),
        gte(studentExitRecords.exitMonth, startMonthStr)
      ));
    
    const allTeachers = await this.getCenterUsers(centerId, UserRole.TEACHER);
    const allStudents = await this.getCenterUsers(centerId, UserRole.STUDENT);
    
    const teacherExitCounts: Record<string, number> = {};
    const teacherStudentCounts: Record<string, number> = {};
    const teacherNames: Record<string, string> = {};
    
    for (const teacher of allTeachers) {
      teacherExitCounts[teacher.id] = 0;
      teacherStudentCounts[teacher.id] = 0;
      teacherNames[teacher.id] = teacher.name;
    }
    
    for (const student of allStudents) {
      if (student.homeroomTeacherId && teacherStudentCounts[student.homeroomTeacherId] !== undefined) {
        teacherStudentCounts[student.homeroomTeacherId]++;
      }
    }
    
    for (const record of exitRecords) {
      const exitedStudent = await db.select().from(users)
        .where(eq(users.id, record.studentId))
        .limit(1);
      
      if (exitedStudent[0]?.homeroomTeacherId && teacherExitCounts[exitedStudent[0].homeroomTeacherId] !== undefined) {
        teacherExitCounts[exitedStudent[0].homeroomTeacherId]++;
      }
    }
    
    const result = allTeachers.map(teacher => {
      const exitCount = teacherExitCounts[teacher.id] || 0;
      const totalStudents = (teacherStudentCounts[teacher.id] || 0) + exitCount;
      const exitRatio = totalStudents > 0 ? (exitCount / totalStudents) * 100 : 0;
      
      return {
        teacherId: teacher.id,
        teacherName: teacher.name,
        exitCount,
        totalStudents,
        exitRatio: Math.round(exitRatio * 10) / 10
      };
    });
    
    return result.sort((a, b) => b.exitCount - a.exitCount);
  }

  // Monthly Student Snapshots (월별 학생 수)
  async getOrCreateMonthlySnapshot(centerId: string, month: string): Promise<MonthlyStudentSnapshot> {
    const existing = await db.select().from(monthlyStudentSnapshots)
      .where(and(
        eq(monthlyStudentSnapshots.centerId, centerId),
        eq(monthlyStudentSnapshots.month, month)
      ));
    
    if (existing[0]) return existing[0];
    
    const students = await this.getCenterUsers(centerId, UserRole.STUDENT);
    const studentCount = students.length;
    
    const result = await db.insert(monthlyStudentSnapshots)
      .values({ centerId, month, studentCount })
      .returning();
    return result[0];
  }

  // Monthly Finance Snapshots (월별 재무 계산 스냅샷 - 지난달 동결용)
  async getFinanceSnapshot(centerId: string, yearMonth: string, kind: string): Promise<MonthlyFinanceSnapshot | undefined> {
    const result = await db.select().from(monthlyFinanceSnapshots)
      .where(and(
        eq(monthlyFinanceSnapshots.centerId, centerId),
        eq(monthlyFinanceSnapshots.yearMonth, yearMonth),
        eq(monthlyFinanceSnapshots.kind, kind)
      ));
    return result[0];
  }

  async upsertFinanceSnapshot(centerId: string, yearMonth: string, kind: string, data: string): Promise<void> {
    await db.insert(monthlyFinanceSnapshots)
      .values({ centerId, yearMonth, kind, data })
      .onConflictDoUpdate({
        target: [monthlyFinanceSnapshots.centerId, monthlyFinanceSnapshots.yearMonth, monthlyFinanceSnapshots.kind],
        set: { data, updatedAt: new Date() },
      });
  }

  async getMonthlyStudentSnapshots(centerId: string, months: number): Promise<MonthlyStudentSnapshot[]> {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    const startMonthStr = `${startMonth.getFullYear()}-${String(startMonth.getMonth() + 1).padStart(2, '0')}`;
    
    return await db.select().from(monthlyStudentSnapshots)
      .where(and(
        eq(monthlyStudentSnapshots.centerId, centerId),
        gte(monthlyStudentSnapshots.month, startMonthStr)
      ))
      .orderBy(monthlyStudentSnapshots.month);
  }

  async updateMonthlyStudentCount(centerId: string, month: string): Promise<MonthlyStudentSnapshot> {
    const students = await this.getCenterUsers(centerId, UserRole.STUDENT);
    const studentCount = students.length;
    
    const existing = await db.select().from(monthlyStudentSnapshots)
      .where(and(
        eq(monthlyStudentSnapshots.centerId, centerId),
        eq(monthlyStudentSnapshots.month, month)
      ));
    
    if (existing[0]) {
      const result = await db.update(monthlyStudentSnapshots)
        .set({ studentCount })
        .where(eq(monthlyStudentSnapshots.id, existing[0].id))
        .returning();
      return result[0];
    }
    
    const result = await db.insert(monthlyStudentSnapshots)
      .values({ centerId, month, studentCount })
      .returning();
    return result[0];
  }

  // Marketing Campaigns (마케팅 캠페인)
  async getMarketingCampaigns(centerId: string, year?: number): Promise<MarketingCampaign[]> {
    if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      return await db.select().from(marketingCampaigns)
        .where(and(
          eq(marketingCampaigns.centerId, centerId),
          gte(marketingCampaigns.startDate, startDate),
          lte(marketingCampaigns.startDate, endDate)
        ))
        .orderBy(desc(marketingCampaigns.startDate));
    }
    return await db.select().from(marketingCampaigns)
      .where(eq(marketingCampaigns.centerId, centerId))
      .orderBy(desc(marketingCampaigns.startDate));
  }

  async getMarketingCampaign(id: string): Promise<MarketingCampaign | undefined> {
    const result = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.id, id));
    return result[0];
  }

  async createMarketingCampaign(data: InsertMarketingCampaign): Promise<MarketingCampaign> {
    const result = await db.insert(marketingCampaigns).values(data).returning();
    return result[0];
  }

  async updateMarketingCampaign(id: string, data: Partial<InsertMarketingCampaign>): Promise<MarketingCampaign> {
    const result = await db.update(marketingCampaigns)
      .set(data)
      .where(eq(marketingCampaigns.id, id))
      .returning();
    return result[0];
  }

  async deleteMarketingCampaign(id: string): Promise<void> {
    await db.delete(marketingCampaigns).where(eq(marketingCampaigns.id, id));
  }

  // Monthly Financial Records
  async getMonthlyFinancialRecords(centerId: string, year?: number): Promise<MonthlyFinancialRecord[]> {
    if (year) {
      const startMonth = `${year}-01`;
      const endMonth = `${year}-12`;
      return await db.select().from(monthlyFinancialRecords)
        .where(and(
          eq(monthlyFinancialRecords.centerId, centerId),
          gte(monthlyFinancialRecords.yearMonth, startMonth),
          lte(monthlyFinancialRecords.yearMonth, endMonth)
        ))
        .orderBy(desc(monthlyFinancialRecords.yearMonth));
    }
    return await db.select().from(monthlyFinancialRecords)
      .where(eq(monthlyFinancialRecords.centerId, centerId))
      .orderBy(desc(monthlyFinancialRecords.yearMonth));
  }

  async getMonthlyFinancialRecord(centerId: string, yearMonth: string): Promise<MonthlyFinancialRecord | undefined> {
    const result = await db.select().from(monthlyFinancialRecords)
      .where(and(
        eq(monthlyFinancialRecords.centerId, centerId),
        eq(monthlyFinancialRecords.yearMonth, yearMonth)
      ));
    return result[0];
  }

  async getMonthlyFinancialRecordById(id: string): Promise<MonthlyFinancialRecord | undefined> {
    const result = await db.select().from(monthlyFinancialRecords)
      .where(eq(monthlyFinancialRecords.id, id));
    return result[0];
  }

  async createMonthlyFinancialRecord(data: InsertMonthlyFinancialRecord): Promise<MonthlyFinancialRecord> {
    const result = await db.insert(monthlyFinancialRecords).values(data).returning();
    return result[0];
  }

  async updateMonthlyFinancialRecord(id: string, data: Partial<InsertMonthlyFinancialRecord>): Promise<MonthlyFinancialRecord> {
    const result = await db.update(monthlyFinancialRecords)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(monthlyFinancialRecords.id, id))
      .returning();
    return result[0];
  }

  async deleteMonthlyFinancialRecord(id: string): Promise<void> {
    await db.delete(monthlyFinancialRecords).where(eq(monthlyFinancialRecords.id, id));
  }

  // Teacher Salary Settings
  async getTeacherSalarySettings(teacherId: string, centerId: string): Promise<TeacherSalarySettings | undefined> {
    const result = await db.select().from(teacherSalarySettings)
      .where(and(
        eq(teacherSalarySettings.teacherId, teacherId),
        eq(teacherSalarySettings.centerId, centerId)
      ));
    return result[0];
  }

  async getTeacherSalarySettingsByCenter(centerId: string): Promise<TeacherSalarySettings[]> {
    return await db.select().from(teacherSalarySettings)
      .where(eq(teacherSalarySettings.centerId, centerId));
  }

  async createTeacherSalarySettings(data: InsertTeacherSalarySettings): Promise<TeacherSalarySettings> {
    const result = await db.insert(teacherSalarySettings).values(data).returning();
    return result[0];
  }

  async updateTeacherSalarySettings(id: string, data: Partial<InsertTeacherSalarySettings>): Promise<TeacherSalarySettings> {
    const result = await db.update(teacherSalarySettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(teacherSalarySettings.id, id))
      .returning();
    return result[0];
  }

  async deleteTeacherSalarySettings(id: string): Promise<void> {
    await db.delete(teacherSalarySettings).where(eq(teacherSalarySettings.id, id));
  }

  // Teacher Salary Adjustments (급여 조정 항목)
  async getTeacherSalaryAdjustments(teacherId: string, centerId: string, yearMonth: string): Promise<TeacherSalaryAdjustment[]> {
    return await db.select().from(teacherSalaryAdjustments)
      .where(and(
        eq(teacherSalaryAdjustments.teacherId, teacherId),
        eq(teacherSalaryAdjustments.centerId, centerId),
        eq(teacherSalaryAdjustments.yearMonth, yearMonth)
      ));
  }

  async getTeacherSalaryAdjustmentsByCenter(centerId: string, yearMonth: string): Promise<TeacherSalaryAdjustment[]> {
    return await db.select().from(teacherSalaryAdjustments)
      .where(and(
        eq(teacherSalaryAdjustments.centerId, centerId),
        eq(teacherSalaryAdjustments.yearMonth, yearMonth)
      ));
  }

  async createTeacherSalaryAdjustment(data: InsertTeacherSalaryAdjustment): Promise<TeacherSalaryAdjustment> {
    const result = await db.insert(teacherSalaryAdjustments).values(data).returning();
    return result[0];
  }

  async updateTeacherSalaryAdjustment(id: string, data: Partial<InsertTeacherSalaryAdjustment>): Promise<TeacherSalaryAdjustment> {
    const result = await db.update(teacherSalaryAdjustments)
      .set(data)
      .where(eq(teacherSalaryAdjustments.id, id))
      .returning();
    return result[0];
  }

  async deleteTeacherSalaryAdjustment(id: string): Promise<void> {
    await db.delete(teacherSalaryAdjustments).where(eq(teacherSalaryAdjustments.id, id));
  }

  // Student Textbook Purchases (학생 교재비)
  // 삭제된 반에 속해 있던 교재비 청구 내역(class_textbook 이 사라졌거나
  // class_textbook 의 class 자체가 삭제된 경우)은 교육비 집계 및 조회에서
  // 자동으로 제외한다. classTextbookId 가 NULL 인 수동 등록 건은 항상 포함.
  private orphanTextbookExclusion() {
    return sql`(
      ${studentTextbookPurchases.classTextbookId} IS NULL
      OR EXISTS (
        SELECT 1
        FROM class_textbooks ct
        JOIN classes c ON c.id = ct.class_id
        WHERE ct.id = ${studentTextbookPurchases.classTextbookId}
      )
    )`;
  }

  async getStudentTextbookPurchases(studentId: string, centerId?: string): Promise<StudentTextbookPurchase[]> {
    if (centerId) {
      return await db.select().from(studentTextbookPurchases)
        .where(and(
          eq(studentTextbookPurchases.studentId, studentId),
          eq(studentTextbookPurchases.centerId, centerId),
          this.orphanTextbookExclusion(),
        ))
        .orderBy(desc(studentTextbookPurchases.purchaseDate));
    }
    return await db.select().from(studentTextbookPurchases)
      .where(and(
        eq(studentTextbookPurchases.studentId, studentId),
        this.orphanTextbookExclusion(),
      ))
      .orderBy(desc(studentTextbookPurchases.purchaseDate));
  }

  async getStudentTextbookPurchasesByCenter(centerId: string): Promise<StudentTextbookPurchase[]> {
    return await db.select().from(studentTextbookPurchases)
      .where(and(
        eq(studentTextbookPurchases.centerId, centerId),
        this.orphanTextbookExclusion(),
      ))
      .orderBy(desc(studentTextbookPurchases.purchaseDate));
  }

  async createStudentTextbookPurchase(data: InsertStudentTextbookPurchase): Promise<StudentTextbookPurchase> {
    const result = await db.insert(studentTextbookPurchases).values(data).returning();
    return result[0];
  }

  async updateStudentTextbookPurchase(id: string, data: Partial<InsertStudentTextbookPurchase>): Promise<StudentTextbookPurchase> {
    const result = await db.update(studentTextbookPurchases)
      .set(data)
      .where(eq(studentTextbookPurchases.id, id))
      .returning();
    return result[0];
  }

  async deleteStudentTextbookPurchase(id: string): Promise<void> {
    await db.delete(studentTextbookPurchases).where(eq(studentTextbookPurchases.id, id));
  }

  // Academy Calendar Events
  async getAcademyCalendarEvents(centerId: string, year?: number, month?: number): Promise<AcademyCalendarEvent[]> {
    if (year && month) {
      // Get events that overlap with the specified month
      const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
      const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0];
      return await db.select().from(academyCalendarEvents)
        .where(and(
          eq(academyCalendarEvents.centerId, centerId),
          or(
            // Single date events in the month
            and(
              gte(academyCalendarEvents.startDate, startOfMonth),
              lte(academyCalendarEvents.startDate, endOfMonth)
            ),
            // Period events that overlap with the month
            and(
              lte(academyCalendarEvents.startDate, endOfMonth),
              or(
                isNull(academyCalendarEvents.endDate),
                gte(academyCalendarEvents.endDate, startOfMonth)
              )
            )
          )
        ));
    }
    return await db.select().from(academyCalendarEvents)
      .where(eq(academyCalendarEvents.centerId, centerId));
  }

  async getAcademyCalendarEvent(id: string): Promise<AcademyCalendarEvent | undefined> {
    const result = await db.select().from(academyCalendarEvents).where(eq(academyCalendarEvents.id, id));
    return result[0];
  }

  async createAcademyCalendarEvent(data: InsertAcademyCalendarEvent): Promise<AcademyCalendarEvent> {
    const result = await db.insert(academyCalendarEvents).values(data).returning();
    return result[0];
  }

  async updateAcademyCalendarEvent(id: string, data: Partial<InsertAcademyCalendarEvent>): Promise<AcademyCalendarEvent> {
    const result = await db.update(academyCalendarEvents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(academyCalendarEvents.id, id))
      .returning();
    return result[0];
  }

  async deleteAcademyCalendarEvent(id: string): Promise<void> {
    // First delete associated exam subject schedules
    await db.delete(examSubjectSchedules).where(eq(examSubjectSchedules.eventId, id));
    await db.delete(academyCalendarEvents).where(eq(academyCalendarEvents.id, id));
  }

  // Exam Subject Schedules
  async getExamSubjectSchedules(eventId: string): Promise<ExamSubjectSchedule[]> {
    return await db.select().from(examSubjectSchedules)
      .where(eq(examSubjectSchedules.eventId, eventId));
  }

  async getExamSubjectScheduleById(id: string): Promise<ExamSubjectSchedule | undefined> {
    const result = await db.select().from(examSubjectSchedules)
      .where(eq(examSubjectSchedules.id, id));
    return result[0];
  }

  async createExamSubjectSchedule(data: InsertExamSubjectSchedule): Promise<ExamSubjectSchedule> {
    const result = await db.insert(examSubjectSchedules).values(data).returning();
    return result[0];
  }

  async updateExamSubjectSchedule(id: string, data: Partial<InsertExamSubjectSchedule>): Promise<ExamSubjectSchedule> {
    const result = await db.update(examSubjectSchedules)
      .set(data)
      .where(eq(examSubjectSchedules.id, id))
      .returning();
    return result[0];
  }

  async deleteExamSubjectSchedule(id: string): Promise<void> {
    await db.delete(examSubjectSchedules).where(eq(examSubjectSchedules.id, id));
  }

  async deleteExamSubjectSchedulesByEventId(eventId: string): Promise<void> {
    await db.delete(examSubjectSchedules).where(eq(examSubjectSchedules.eventId, eventId));
  }

  // Feature Categories (상위 메뉴 관리)
  async getFeatureCategories(): Promise<FeatureCategory[]> {
    return await db.select().from(featureCategories).orderBy(featureCategories.displayOrder);
  }

  async getFeatureCategory(id: string): Promise<FeatureCategory | undefined> {
    const result = await db.select().from(featureCategories).where(eq(featureCategories.id, id));
    return result[0];
  }

  async getFeatureCategoryByMenuKey(menuKey: string): Promise<FeatureCategory | undefined> {
    const result = await db.select().from(featureCategories).where(eq(featureCategories.menuKey, menuKey));
    return result[0];
  }

  async createFeatureCategory(data: InsertFeatureCategory): Promise<FeatureCategory> {
    const result = await db.insert(featureCategories).values(data).returning();
    return result[0];
  }

  async updateFeatureCategory(id: string, data: Partial<InsertFeatureCategory>): Promise<FeatureCategory> {
    const result = await db.update(featureCategories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(featureCategories.id, id))
      .returning();
    return result[0];
  }

  async deleteFeatureCategory(id: string): Promise<void> {
    // Remove categoryId from features that belong to this category
    await db.update(features)
      .set({ categoryId: null })
      .where(eq(features.categoryId, id));
    await db.delete(featureCategories).where(eq(featureCategories.id, id));
  }

  // Feature Management (기능 관리)
  async getFeatures(): Promise<Feature[]> {
    return await db.select().from(features).orderBy(features.displayOrder);
  }

  async getFeature(id: string): Promise<Feature | undefined> {
    const result = await db.select().from(features).where(eq(features.id, id));
    return result[0];
  }

  async getFeatureByMenuKey(menuKey: string): Promise<Feature | undefined> {
    const result = await db.select().from(features).where(eq(features.menuKey, menuKey));
    return result[0];
  }

  async createFeature(data: InsertFeature): Promise<Feature> {
    const result = await db.insert(features).values(data).returning();
    return result[0];
  }

  async updateFeature(id: string, data: Partial<InsertFeature>): Promise<Feature> {
    const result = await db.update(features)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(features.id, id))
      .returning();
    return result[0];
  }

  async deleteFeature(id: string): Promise<void> {
    // Delete associated center features and requests first
    await db.delete(centerFeatures).where(eq(centerFeatures.featureId, id));
    await db.delete(featureRequests).where(eq(featureRequests.featureId, id));
    await db.delete(features).where(eq(features.id, id));
  }

  // Feature Requests (기능 요청)
  async getFeatureRequests(centerId?: string): Promise<FeatureRequest[]> {
    if (centerId) {
      return await db.select().from(featureRequests)
        .where(eq(featureRequests.centerId, centerId))
        .orderBy(desc(featureRequests.createdAt));
    }
    return await db.select().from(featureRequests).orderBy(desc(featureRequests.createdAt));
  }

  async getFeatureRequest(id: string): Promise<FeatureRequest | undefined> {
    const result = await db.select().from(featureRequests).where(eq(featureRequests.id, id));
    return result[0];
  }

  async createFeatureRequest(data: InsertFeatureRequest): Promise<FeatureRequest> {
    const result = await db.insert(featureRequests).values(data).returning();
    return result[0];
  }

  async updateFeatureRequest(id: string, data: Partial<InsertFeatureRequest>): Promise<FeatureRequest> {
    const result = await db.update(featureRequests)
      .set(data)
      .where(eq(featureRequests.id, id))
      .returning();
    return result[0];
  }

  async deleteFeatureRequest(id: string): Promise<void> {
    await db.delete(featureRequests).where(eq(featureRequests.id, id));
  }

  // Center Features (센터별 활성화 기능)
  async getCenterFeatures(centerId: string): Promise<CenterFeature[]> {
    return await db.select().from(centerFeatures)
      .where(eq(centerFeatures.centerId, centerId));
  }

  async getCenterFeature(centerId: string, featureId: string): Promise<CenterFeature | undefined> {
    const result = await db.select().from(centerFeatures)
      .where(and(
        eq(centerFeatures.centerId, centerId),
        eq(centerFeatures.featureId, featureId)
      ));
    return result[0];
  }

  async createCenterFeature(data: InsertCenterFeature): Promise<CenterFeature> {
    const result = await db.insert(centerFeatures).values(data).returning();
    return result[0];
  }

  async deleteCenterFeature(id: string): Promise<void> {
    await db.delete(centerFeatures).where(eq(centerFeatures.id, id));
  }

  async deleteCenterFeatureByIds(centerId: string, featureId: string): Promise<void> {
    await db.delete(centerFeatures).where(and(
      eq(centerFeatures.centerId, centerId),
      eq(centerFeatures.featureId, featureId)
    ));
  }

  async toggleCenterFeatureHidden(centerId: string, featureId: string, isHidden: boolean): Promise<void> {
    const existing = await db.select().from(centerFeatures).where(and(
      eq(centerFeatures.centerId, centerId),
      eq(centerFeatures.featureId, featureId)
    ));
    if (existing.length === 0) {
      await db.insert(centerFeatures).values({ centerId, featureId, isHidden });
    } else {
      await db.update(centerFeatures)
        .set({ isHidden })
        .where(and(
          eq(centerFeatures.centerId, centerId),
          eq(centerFeatures.featureId, featureId)
        ));
    }
  }

  // Feature Suggestions (새 기능 개발 요청)
  async getFeatureSuggestions(centerId?: string): Promise<FeatureSuggestion[]> {
    if (centerId) {
      return await db.select().from(featureSuggestions)
        .where(eq(featureSuggestions.centerId, centerId))
        .orderBy(desc(featureSuggestions.createdAt));
    }
    return await db.select().from(featureSuggestions).orderBy(desc(featureSuggestions.createdAt));
  }

  async getFeatureSuggestion(id: string): Promise<FeatureSuggestion | undefined> {
    const result = await db.select().from(featureSuggestions).where(eq(featureSuggestions.id, id));
    return result[0];
  }

  async createFeatureSuggestion(data: InsertFeatureSuggestion): Promise<FeatureSuggestion> {
    const result = await db.insert(featureSuggestions).values(data).returning();
    return result[0];
  }

  async updateFeatureSuggestion(id: string, data: Partial<InsertFeatureSuggestion>): Promise<FeatureSuggestion> {
    const result = await db.update(featureSuggestions)
      .set(data)
      .where(eq(featureSuggestions.id, id))
      .returning();
    return result[0];
  }

  async deleteFeatureSuggestion(id: string): Promise<void> {
    await db.delete(featureSuggestions).where(eq(featureSuggestions.id, id));
  }

  // SMS History (문자 발송 기록)
  async getSmsHistory(centerId: string): Promise<SmsHistory[]> {
    return await db.select().from(smsHistory)
      .where(eq(smsHistory.centerId, centerId))
      .orderBy(desc(smsHistory.sentAt));
  }

  async getSmsHistoryByCategory(centerId: string, category: string): Promise<SmsHistory[]> {
    return await db.select().from(smsHistory)
      .where(and(eq(smsHistory.centerId, centerId), eq(smsHistory.category, category)))
      .orderBy(desc(smsHistory.sentAt));
  }

  async getSmsHistoryByReference(referenceId: string): Promise<SmsHistory[]> {
    return await db.select().from(smsHistory)
      .where(eq(smsHistory.referenceId, referenceId))
      .orderBy(desc(smsHistory.sentAt));
  }

  async createSmsHistory(data: InsertSmsHistory): Promise<SmsHistory> {
    const [result] = await db.insert(smsHistory).values(data).returning();
    return result;
  }

  // 예약 문자 (Scheduled SMS)
  async createScheduledSms(data: InsertScheduledSmsMessage): Promise<ScheduledSmsMessage> {
    const [result] = await db.insert(scheduledSmsMessages).values(data).returning();
    return result;
  }

  async getScheduledSmsByCenter(centerId: string): Promise<ScheduledSmsMessage[]> {
    return await db.select().from(scheduledSmsMessages)
      .where(eq(scheduledSmsMessages.centerId, centerId))
      .orderBy(desc(scheduledSmsMessages.scheduledAt));
  }

  async getScheduledSms(id: string): Promise<ScheduledSmsMessage | undefined> {
    const [result] = await db.select().from(scheduledSmsMessages)
      .where(eq(scheduledSmsMessages.id, id));
    return result;
  }

  async getDueScheduledSms(): Promise<ScheduledSmsMessage[]> {
    return await db.select().from(scheduledSmsMessages)
      .where(and(
        eq(scheduledSmsMessages.status, "pending"),
        lte(scheduledSmsMessages.scheduledAt, new Date()),
      ))
      .orderBy(asc(scheduledSmsMessages.scheduledAt));
  }

  async claimScheduledSms(id: string): Promise<ScheduledSmsMessage | undefined> {
    // pending -> processing 원자적 전이 (중복 발송 방지). 이미 클레임된 건은 undefined 반환.
    const [result] = await db.update(scheduledSmsMessages)
      .set({ status: "processing" })
      .where(and(eq(scheduledSmsMessages.id, id), eq(scheduledSmsMessages.status, "pending")))
      .returning();
    return result;
  }

  async updateScheduledSmsStatus(id: string, status: string, successCount?: number, failCount?: number): Promise<ScheduledSmsMessage | undefined> {
    const [result] = await db.update(scheduledSmsMessages)
      .set({ status, successCount, failCount })
      .where(eq(scheduledSmsMessages.id, id))
      .returning();
    return result;
  }

  async cancelScheduledSms(id: string): Promise<ScheduledSmsMessage | undefined> {
    const [result] = await db.update(scheduledSmsMessages)
      .set({ status: "cancelled" })
      .where(and(eq(scheduledSmsMessages.id, id), eq(scheduledSmsMessages.status, "pending")))
      .returning();
    return result;
  }

  // SMS Templates (문자 템플릿)
  async getSmsTemplates(centerId: string): Promise<SmsTemplate[]> {
    return await db.select().from(smsTemplates)
      .where(eq(smsTemplates.centerId, centerId))
      .orderBy(desc(smsTemplates.createdAt));
  }

  async createSmsTemplate(data: InsertSmsTemplate): Promise<SmsTemplate> {
    const [result] = await db.insert(smsTemplates).values(data).returning();
    return result;
  }

  async updateSmsTemplate(id: string, data: Partial<InsertSmsTemplate>): Promise<SmsTemplate> {
    const [result] = await db.update(smsTemplates)
      .set(data)
      .where(eq(smsTemplates.id, id))
      .returning();
    return result;
  }

  async deleteSmsTemplate(id: string): Promise<void> {
    await db.delete(smsTemplates).where(eq(smsTemplates.id, id));
  }

  // User Menu Orders (사용자별 메뉴 순서)
  async getUserMenuOrder(userId: string): Promise<UserMenuOrder | undefined> {
    const result = await db.select().from(userMenuOrders)
      .where(eq(userMenuOrders.userId, userId));
    return result[0];
  }

  async saveUserMenuOrder(userId: string, menuOrder: string, subMenuOrder?: string): Promise<UserMenuOrder> {
    const existing = await this.getUserMenuOrder(userId);
    if (existing) {
      const updates: Record<string, any> = { menuOrder, updatedAt: new Date() };
      if (subMenuOrder !== undefined) {
        updates.subMenuOrder = subMenuOrder;
      }
      const [result] = await db.update(userMenuOrders)
        .set(updates)
        .where(eq(userMenuOrders.userId, userId))
        .returning();
      return result;
    } else {
      const [result] = await db.insert(userMenuOrders)
        .values({ userId, menuOrder, subMenuOrder: subMenuOrder || null })
        .returning();
      return result;
    }
  }

  // User Activity Logs
  async createUserActivityLog(log: InsertUserActivityLog): Promise<UserActivityLog> {
    const [result] = await db.insert(userActivityLogs)
      .values(log)
      .returning();
    return result;
  }

  async getUserActivityLogs(centerId: string, startDate: Date, endDate: Date): Promise<UserActivityLog[]> {
    return db.select().from(userActivityLogs)
      .where(and(
        eq(userActivityLogs.centerId, centerId),
        gte(userActivityLogs.visitedAt, startDate),
        lte(userActivityLogs.visitedAt, endDate)
      ))
      .orderBy(desc(userActivityLogs.visitedAt));
  }

  async getCenterUsageStats(centerId: string, year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);
    
    const logs = await db.select().from(userActivityLogs)
      .where(and(
        eq(userActivityLogs.centerId, centerId),
        gte(userActivityLogs.visitedAt, startDate),
        lte(userActivityLogs.visitedAt, endDate)
      ));

    // Monthly stats
    const monthlyStats = [];
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
      
      const monthLogs = logs.filter(log => {
        const logDate = new Date(log.visitedAt!);
        return logDate >= monthStart && logDate <= monthEnd;
      });

      // Unique users this month
      const uniqueUsers = new Set(monthLogs.map(log => log.userId));
      
      // Unique sessions this month
      const uniqueSessions = new Set(monthLogs.map(log => log.sessionId));
      
      // Calculate return rate: users who had sessions on multiple days
      const userDays = new Map<string, Set<string>>();
      monthLogs.forEach(log => {
        const userId = log.userId;
        const day = new Date(log.visitedAt!).toDateString();
        if (!userDays.has(userId)) userDays.set(userId, new Set());
        userDays.get(userId)!.add(day);
      });
      const returningUsers = Array.from(userDays.values()).filter(days => days.size > 1).length;
      const returnRate = uniqueUsers.size > 0 ? (returningUsers / uniqueUsers.size) * 100 : 0;
      
      // Average session duration
      const sessionsWithDuration = monthLogs.filter(log => log.durationSeconds && log.durationSeconds > 0);
      const totalDuration = sessionsWithDuration.reduce((sum, log) => sum + (log.durationSeconds || 0), 0);
      const avgDuration = sessionsWithDuration.length > 0 ? totalDuration / sessionsWithDuration.length : 0;
      
      // Page visit counts
      const pageVisits = new Map<string, number>();
      monthLogs.forEach(log => {
        const count = pageVisits.get(log.pagePath) || 0;
        pageVisits.set(log.pagePath, count + 1);
      });
      const topPages = Array.from(pageVisits.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([path, count]) => ({ path, count }));
      
      monthlyStats.push({
        month: month + 1,
        uniqueUsers: uniqueUsers.size,
        totalSessions: uniqueSessions.size,
        returnRate: Math.round(returnRate * 10) / 10,
        avgDurationMinutes: Math.round(avgDuration / 60 * 10) / 10,
        topPages
      });
    }

    return {
      year,
      centerId,
      monthlyStats
    };
  }

  async getCenterUserUsageStats(centerId: string, year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);
    
    // Get all users in this center
    const centerUsers = await db.select({
      userId: userCenters.userId,
      userName: users.name,
      userRole: users.role
    })
    .from(userCenters)
    .innerJoin(users, eq(userCenters.userId, users.id))
    .where(eq(userCenters.centerId, centerId));
    
    // Get all logs for this center
    const logs = await db.select().from(userActivityLogs)
      .where(and(
        eq(userActivityLogs.centerId, centerId),
        gte(userActivityLogs.visitedAt, startDate),
        lte(userActivityLogs.visitedAt, endDate)
      ));

    // Build per-user stats
    const userStats = centerUsers.map(cu => {
      const userLogs = logs.filter(log => log.userId === cu.userId);
      
      // Total sessions (unique session IDs)
      const uniqueSessions = new Set(userLogs.map(log => log.sessionId));
      
      // Total page views
      const totalPageViews = userLogs.length;
      
      // Days active (unique days with activity)
      const uniqueDays = new Set(userLogs.map(log => 
        new Date(log.visitedAt!).toDateString()
      ));
      
      // Total duration
      const totalDuration = userLogs
        .filter(log => log.durationSeconds && log.durationSeconds > 0)
        .reduce((sum, log) => sum + (log.durationSeconds || 0), 0);
      
      // Last active date
      const lastActive = userLogs.length > 0 
        ? userLogs.reduce((latest, log) => {
            const logDate = new Date(log.visitedAt!);
            return logDate > latest ? logDate : latest;
          }, new Date(0))
        : null;
      
      // Most visited pages
      const pageVisits = new Map<string, number>();
      userLogs.forEach(log => {
        const count = pageVisits.get(log.pagePath) || 0;
        pageVisits.set(log.pagePath, count + 1);
      });
      const topPages = Array.from(pageVisits.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([path, count]) => ({ path, count }));

      return {
        userId: cu.userId,
        userName: cu.userName,
        userRole: cu.userRole,
        totalSessions: uniqueSessions.size,
        totalPageViews,
        daysActive: uniqueDays.size,
        totalDurationMinutes: Math.round(totalDuration / 60),
        lastActive: lastActive?.toISOString() || null,
        topPages
      };
    });

    // Sort by total sessions descending
    userStats.sort((a, b) => b.totalSessions - a.totalSessions);

    return {
      year,
      centerId,
      userStats
    };
  }

  // Deleted Objects (삭제 예정 R2 객체)
  async scheduleObjectDeletion(objectKey: string, objectType: string, centerId?: string, afterDays: number = 10): Promise<void> {
    const scheduledDeleteAt = new Date();
    scheduledDeleteAt.setDate(scheduledDeleteAt.getDate() + afterDays);
    
    await db.insert(deletedObjects).values({
      objectKey,
      objectType,
      centerId: centerId || null,
      scheduledDeleteAt,
    });
  }

  async getExpiredDeletedObjects(): Promise<DeletedObject[]> {
    const now = new Date();
    return await db.select().from(deletedObjects).where(lte(deletedObjects.scheduledDeleteAt, now));
  }

  async removeDeletedObject(id: string): Promise<void> {
    await db.delete(deletedObjects).where(eq(deletedObjects.id, id));
  }

  // Center Registrations (학원 등록 신청)
  async getCenterRegistrations(status?: string): Promise<CenterRegistration[]> {
    if (status) {
      return db.select().from(centerRegistrations).where(eq(centerRegistrations.status, status)).orderBy(desc(centerRegistrations.createdAt));
    }
    return db.select().from(centerRegistrations).orderBy(desc(centerRegistrations.createdAt));
  }

  async getCenterRegistration(id: string): Promise<CenterRegistration | undefined> {
    const result = await db.select().from(centerRegistrations).where(eq(centerRegistrations.id, id));
    return result[0];
  }

  async createCenterRegistration(data: InsertCenterRegistration): Promise<CenterRegistration> {
    const [result] = await db.insert(centerRegistrations).values(data).returning();
    return result;
  }

  async updateCenterRegistration(id: string, data: Partial<CenterRegistration>): Promise<CenterRegistration> {
    const [result] = await db.update(centerRegistrations).set(data).where(eq(centerRegistrations.id, id)).returning();
    return result;
  }

  async approveCenterRegistration(id: string, reviewedBy: string, linkExisting: boolean = false): Promise<{ center: Center; principalUser: User }> {
    const registration = await this.getCenterRegistration(id);
    if (!registration) throw new Error("등록 신청을 찾을 수 없습니다");
    if (registration.status !== "pending") throw new Error("이미 처리된 신청입니다");

    // Immediately mark as processing to prevent duplicate approvals (race condition)
    const [updated] = await db.update(centerRegistrations).set({
      status: "processing",
    }).where(and(eq(centerRegistrations.id, id), eq(centerRegistrations.status, "pending"))).returning();
    
    if (!updated) throw new Error("이미 처리 중이거나 처리된 신청입니다");

    try {
      // Create the center with logo URLs from registration
      const [center] = await db.insert(centers).values({
        name: registration.name,
        businessName: registration.businessName,
        representativeName: registration.representativeName,
        businessRegistrationNumber: registration.businessRegistrationNumber,
        businessAddress: registration.businessAddress,
        businessPhone: registration.businessPhone,
        loginLogoUrl: registration.loginLogoUrl,
        sidebarLogoUrl: registration.sidebarLogoUrl,
        faviconUrl: registration.faviconUrl,
        attendancePadLogoUrl: registration.attendancePadLogoUrl,
        shortcutIconUrl: registration.shortcutIconUrl,
      }).returning();

      // Check if user with this phone already exists.
      // Look up by BOTH username and phone columns to stay consistent with the
      // /check-existing-principal endpoint (which uses getUserByPhone).
      // Without this, an orphan user from a previous (deleted) center could
      // collide with the username UNIQUE constraint when we try to insert below.
      const [existingUser] = await db.select().from(users).where(
        or(
          eq(users.username, registration.applicantPhone),
          eq(users.phone, registration.applicantPhone),
        )
      ).limit(1);
      
      let principalUser: User;
      
      if (existingUser) {
        if (!linkExisting) {
          // Rollback: delete the center we just created
          await db.delete(centers).where(eq(centers.id, center.id));
          throw new Error(`이미 존재하는 아이디입니다: ${registration.applicantPhone}. 다른 전화번호로 신청하거나 기존 계정을 사용해주세요.`);
        }
        
        // Link existing user to the new center
        principalUser = existingUser;
        await db.insert(userCenters).values({
          userId: existingUser.id,
          centerId: center.id,
        }).onConflictDoNothing();
      } else {
        // Create new principal account with applicant phone as username
        const [newUser] = await db.insert(users).values({
          username: registration.applicantPhone,
          password: "1234", // Default password
          name: registration.applicantName,
          phone: registration.applicantPhone,
          role: UserRole.PRINCIPAL,
        }).returning();
        
        principalUser = newUser;

        // Link principal to center
        await db.insert(userCenters).values({
          userId: principalUser.id,
          centerId: center.id,
        });
      }

      // Enable basic features for the new center
      const allBasicFeatures = await db.select().from(features).where(eq(features.featureType, "basic"));
      for (const feature of allBasicFeatures) {
        await db.insert(centerFeatures).values({
          centerId: center.id,
          featureId: feature.id,
          isHidden: false,
        });
      }

      // If toss consent was agreed during registration, set center's tossConsentStatus to pending
      if (registration.tossConsentAgreed) {
        await db.update(centers).set({
          tossConsentStatus: "pending",
          tossConsentAt: new Date(),
        }).where(eq(centers.id, center.id));
      }

      // Update registration status
      await db.update(centerRegistrations).set({
        status: "approved",
        reviewedAt: new Date(),
        reviewedBy,
      }).where(eq(centerRegistrations.id, id));

      return { center, principalUser };
    } catch (error) {
      // Rollback: reset status to pending so it can be retried
      await db.update(centerRegistrations).set({
        status: "pending",
      }).where(eq(centerRegistrations.id, id));
      throw error;
    }
  }

  async rejectCenterRegistration(id: string, reviewedBy: string, rejectReason: string): Promise<CenterRegistration> {
    const [result] = await db.update(centerRegistrations).set({
      status: "rejected",
      rejectReason,
      reviewedAt: new Date(),
      reviewedBy,
    }).where(eq(centerRegistrations.id, id)).returning();
    return result;
  }

  // Logo Help Images
  async getLogoHelpImages(): Promise<LogoHelpImage[]> {
    return await db.select().from(logoHelpImages);
  }

  async getLogoHelpImage(logoType: string): Promise<LogoHelpImage | undefined> {
    const [result] = await db.select().from(logoHelpImages).where(eq(logoHelpImages.logoType, logoType));
    return result;
  }

  async upsertLogoHelpImage(data: InsertLogoHelpImage): Promise<LogoHelpImage> {
    const existing = await this.getLogoHelpImage(data.logoType);
    if (existing) {
      const [result] = await db.update(logoHelpImages).set({
        imageUrl: data.imageUrl,
        description: data.description,
        updatedAt: new Date(),
      }).where(eq(logoHelpImages.logoType, data.logoType)).returning();
      return result;
    } else {
      const [result] = await db.insert(logoHelpImages).values(data).returning();
      return result;
    }
  }

  async deleteLogoHelpImage(logoType: string): Promise<void> {
    await db.delete(logoHelpImages).where(eq(logoHelpImages.logoType, logoType));
  }

  // SOLAPI Manuals
  async getSolapiManuals(): Promise<SolapiManual[]> {
    return await db.select().from(solapiManuals);
  }

  async getSolapiManual(manualType: string): Promise<SolapiManual | undefined> {
    const [result] = await db.select().from(solapiManuals).where(eq(solapiManuals.manualType, manualType));
    return result;
  }

  async upsertSolapiManual(data: InsertSolapiManual): Promise<SolapiManual> {
    const existing = await this.getSolapiManual(data.manualType);
    if (existing) {
      const [result] = await db.update(solapiManuals).set({
        title: data.title,
        linkUrl: data.linkUrl,
        imageUrl: data.imageUrl,
        description: data.description,
        updatedAt: new Date(),
      }).where(eq(solapiManuals.manualType, data.manualType)).returning();
      return result;
    } else {
      const [result] = await db.insert(solapiManuals).values(data).returning();
      return result;
    }
  }

  async deleteSolapiManual(manualType: string): Promise<void> {
    await db.delete(solapiManuals).where(eq(solapiManuals.manualType, manualType));
  }

  async getStudentPresentationVideos(centerId: string, classId?: string, studentId?: string): Promise<StudentPresentationVideo[]> {
    let conditions = [eq(studentPresentationVideos.centerId, centerId)];
    if (classId) {
      conditions.push(eq(studentPresentationVideos.classId, classId));
    }
    if (studentId) {
      conditions.push(eq(studentPresentationVideos.studentId, studentId));
    }
    return await db.select().from(studentPresentationVideos).where(and(...conditions)).orderBy(desc(studentPresentationVideos.createdAt));
  }

  async getStudentPresentationVideo(id: string): Promise<StudentPresentationVideo | undefined> {
    const [result] = await db.select().from(studentPresentationVideos).where(eq(studentPresentationVideos.id, id));
    return result;
  }

  async createStudentPresentationVideo(data: InsertStudentPresentationVideo): Promise<StudentPresentationVideo> {
    const [result] = await db.insert(studentPresentationVideos).values(data).returning();
    return result;
  }

  async updateStudentPresentationVideo(id: string, data: Partial<InsertStudentPresentationVideo>): Promise<StudentPresentationVideo> {
    const [result] = await db.update(studentPresentationVideos).set(data).where(eq(studentPresentationVideos.id, id)).returning();
    return result;
  }

  async deleteStudentPresentationVideo(id: string): Promise<void> {
    await db.delete(studentPresentationVideos).where(eq(studentPresentationVideos.id, id));
  }

  // Exams (평가관리)
  async getExams(centerId: string): Promise<Exam[]> {
    return await db.select().from(exams).where(eq(exams.centerId, centerId)).orderBy(desc(exams.examDate));
  }

  async getExam(id: string): Promise<Exam | undefined> {
    const [result] = await db.select().from(exams).where(eq(exams.id, id));
    return result;
  }

  async createExam(data: InsertExam): Promise<Exam> {
    const [result] = await db.insert(exams).values(data).returning();
    return result;
  }

  async updateExam(id: string, data: Partial<InsertExam>): Promise<Exam> {
    const [result] = await db.update(exams).set(data).where(eq(exams.id, id)).returning();
    return result;
  }

  async deleteExam(id: string): Promise<void> {
    // Also delete participants and papers
    await db.delete(examPapers).where(eq(examPapers.examId, id));
    await db.delete(examParticipants).where(eq(examParticipants.examId, id));
    await db.delete(exams).where(eq(exams.id, id));
  }

  // Exam Participants (시험 응시자)
  async getExamParticipants(examId: string): Promise<ExamParticipant[]> {
    return await db.select().from(examParticipants).where(eq(examParticipants.examId, examId));
  }

  async getExamParticipantsByStudent(studentId: string): Promise<ExamParticipant[]> {
    return await db.select().from(examParticipants).where(eq(examParticipants.studentId, studentId));
  }

  async createExamParticipant(data: InsertExamParticipant): Promise<ExamParticipant> {
    const [result] = await db.insert(examParticipants).values(data).returning();
    return result;
  }

  async updateExamParticipantScore(id: string, score: number | null): Promise<ExamParticipant> {
    const [result] = await db.update(examParticipants).set({ score }).where(eq(examParticipants.id, id)).returning();
    return result;
  }

  async deleteExamParticipant(id: string): Promise<void> {
    await db.delete(examParticipants).where(eq(examParticipants.id, id));
  }

  async deleteExamParticipantsByExam(examId: string): Promise<void> {
    await db.delete(examParticipants).where(eq(examParticipants.examId, examId));
  }

  // Exam Papers (시험지 이미지)
  async getExamPapers(examId: string, studentId?: string): Promise<ExamPaper[]> {
    if (studentId) {
      return await db.select().from(examPapers).where(and(eq(examPapers.examId, examId), eq(examPapers.studentId, studentId)));
    }
    return await db.select().from(examPapers).where(eq(examPapers.examId, examId));
  }

  async getExamPapersByStudent(studentId: string): Promise<ExamPaper[]> {
    return await db.select().from(examPapers).where(eq(examPapers.studentId, studentId)).orderBy(desc(examPapers.uploadedAt));
  }

  async createExamPaper(data: InsertExamPaper): Promise<ExamPaper> {
    const [result] = await db.insert(examPapers).values(data).returning();
    return result;
  }

  async deleteExamPaper(id: string): Promise<void> {
    await db.delete(examPapers).where(eq(examPapers.id, id));
  }

  async getExpiredExamPapers(): Promise<ExamPaper[]> {
    const now = new Date();
    return await db.select().from(examPapers).where(lt(examPapers.expiresAt, now));
  }

  async deleteExpiredExamPapers(): Promise<void> {
    const now = new Date();
    await db.delete(examPapers).where(lt(examPapers.expiresAt, now));
  }

  // Google Calendar Token
  async getGoogleCalendarToken(centerId: string): Promise<GoogleCalendarToken | undefined> {
    const result = await db.select().from(googleCalendarTokens).where(eq(googleCalendarTokens.centerId, centerId));
    return result[0];
  }

  async upsertGoogleCalendarToken(data: InsertGoogleCalendarToken): Promise<GoogleCalendarToken> {
    const existing = await this.getGoogleCalendarToken(data.centerId);
    if (existing) {
      const [updated] = await db.update(googleCalendarTokens)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(googleCalendarTokens.centerId, data.centerId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(googleCalendarTokens).values(data).returning();
    return created;
  }

  async deleteGoogleCalendarToken(centerId: string): Promise<void> {
    await db.delete(googleCalendarTokens).where(eq(googleCalendarTokens.centerId, centerId));
  }

  // Google Calendar Class Students
  async getGoogleCalendarClassStudents(centerId: string, eventId: string): Promise<GoogleCalendarClassStudent[]> {
    return await db.select().from(googleCalendarClassStudents).where(
      and(
        eq(googleCalendarClassStudents.centerId, centerId),
        eq(googleCalendarClassStudents.eventId, eventId)
      )
    );
  }

  async getGoogleCalendarStudentEvents(centerId: string, studentId: string): Promise<GoogleCalendarClassStudent[]> {
    return await db.select().from(googleCalendarClassStudents).where(
      and(
        eq(googleCalendarClassStudents.centerId, centerId),
        eq(googleCalendarClassStudents.studentId, studentId)
      )
    );
  }

  async addGoogleCalendarClassStudent(data: InsertGoogleCalendarClassStudent): Promise<GoogleCalendarClassStudent> {
    const [created] = await db.insert(googleCalendarClassStudents).values(data).returning();
    return created;
  }

  async removeGoogleCalendarClassStudent(centerId: string, eventId: string, studentId: string): Promise<void> {
    await db.delete(googleCalendarClassStudents).where(
      and(
        eq(googleCalendarClassStudents.centerId, centerId),
        eq(googleCalendarClassStudents.eventId, eventId),
        eq(googleCalendarClassStudents.studentId, studentId)
      )
    );
  }

  // Google Calendar Event Colors
  async getGoogleCalendarEventColor(centerId: string, eventId: string): Promise<GoogleCalendarEventColor | undefined> {
    const result = await db.select().from(googleCalendarEventColors).where(
      and(
        eq(googleCalendarEventColors.centerId, centerId),
        eq(googleCalendarEventColors.eventId, eventId)
      )
    );
    return result[0];
  }

  async getGoogleCalendarEventColors(centerId: string): Promise<GoogleCalendarEventColor[]> {
    return await db.select().from(googleCalendarEventColors).where(
      eq(googleCalendarEventColors.centerId, centerId)
    );
  }

  async upsertGoogleCalendarEventColor(data: InsertGoogleCalendarEventColor): Promise<GoogleCalendarEventColor> {
    const existing = await this.getGoogleCalendarEventColor(data.centerId, data.eventId);
    if (existing) {
      const [updated] = await db.update(googleCalendarEventColors)
        .set({ colorIndex: data.colorIndex, updatedAt: new Date() })
        .where(eq(googleCalendarEventColors.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(googleCalendarEventColors).values(data).returning();
    return created;
  }

  async getGoogleCalendarEventTeachers(centerId: string): Promise<GoogleCalendarEventTeacher[]> {
    return await db.select().from(googleCalendarEventTeachers).where(
      eq(googleCalendarEventTeachers.centerId, centerId)
    );
  }

  async upsertGoogleCalendarEventTeacher(data: { centerId: string; eventId: string; teacherId: string | null }): Promise<GoogleCalendarEventTeacher | null> {
    // If teacherId is null, remove the assignment
    if (!data.teacherId) {
      await db.delete(googleCalendarEventTeachers).where(
        and(
          eq(googleCalendarEventTeachers.centerId, data.centerId),
          eq(googleCalendarEventTeachers.eventId, data.eventId)
        )
      );
      return null;
    }
    
    // Check if exists
    const existing = await db.select().from(googleCalendarEventTeachers).where(
      and(
        eq(googleCalendarEventTeachers.centerId, data.centerId),
        eq(googleCalendarEventTeachers.eventId, data.eventId)
      )
    );
    
    if (existing.length > 0) {
      const [updated] = await db.update(googleCalendarEventTeachers)
        .set({ teacherId: data.teacherId })
        .where(eq(googleCalendarEventTeachers.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(googleCalendarEventTeachers).values({
      centerId: data.centerId,
      eventId: data.eventId,
      teacherId: data.teacherId,
    }).returning();
    return created;
  }

  // Teacher-Student Messages (교사-학생 소통)
  async getTeacherStudentMessages(centerId: string, teacherId: string, studentId: string): Promise<TeacherStudentMessage[]> {
    return await db.select().from(teacherStudentMessages).where(
      and(
        eq(teacherStudentMessages.centerId, centerId),
        eq(teacherStudentMessages.teacherId, teacherId),
        eq(teacherStudentMessages.studentId, studentId)
      )
    ).orderBy(teacherStudentMessages.createdAt);
  }

  async getStudentAllMessages(centerId: string, studentId: string): Promise<TeacherStudentMessage[]> {
    return await db.select().from(teacherStudentMessages).where(
      and(
        eq(teacherStudentMessages.centerId, centerId),
        eq(teacherStudentMessages.studentId, studentId)
      )
    ).orderBy(teacherStudentMessages.createdAt);
  }

  async getTeacherStudentConversations(centerId: string, teacherId: string): Promise<{ studentId: string; lastMessage: string; lastMessageAt: Date; unreadCount: number }[]> {
    const messages = await db.select().from(teacherStudentMessages).where(
      and(
        eq(teacherStudentMessages.centerId, centerId),
        eq(teacherStudentMessages.teacherId, teacherId)
      )
    ).orderBy(desc(teacherStudentMessages.createdAt));

    const conversationMap = new Map<string, { studentId: string; lastMessage: string; lastMessageAt: Date; unreadCount: number }>();
    
    for (const msg of messages) {
      if (!conversationMap.has(msg.studentId)) {
        conversationMap.set(msg.studentId, {
          studentId: msg.studentId,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt!,
          unreadCount: 0,
        });
      }
      // Count unread messages sent to the teacher
      if (!msg.isRead && msg.receiverId === teacherId) {
        const conv = conversationMap.get(msg.studentId)!;
        conv.unreadCount++;
      }
    }

    return Array.from(conversationMap.values());
  }

  async getAllTeacherStudentConversations(centerId: string): Promise<{ teacherId: string; studentId: string; lastMessage: string; lastMessageAt: Date; unreadCount: number }[]> {
    const messages = await db.select().from(teacherStudentMessages).where(
      eq(teacherStudentMessages.centerId, centerId)
    ).orderBy(desc(teacherStudentMessages.createdAt));

    const conversationMap = new Map<string, { teacherId: string; studentId: string; lastMessage: string; lastMessageAt: Date; unreadCount: number }>();
    
    for (const msg of messages) {
      const key = `${msg.teacherId}_${msg.studentId}`;
      if (!conversationMap.has(key)) {
        conversationMap.set(key, {
          teacherId: msg.teacherId,
          studentId: msg.studentId,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt!,
          unreadCount: 0,
        });
      }
      // 담당 선생님이 아직 읽지 않은(선생님 수신) 메시지만 카운트.
      // 관리자/원장 열람으로는 줄지 않고, 담당 선생님이 읽어야 0이 됨.
      if (!msg.isRead && msg.receiverId === msg.teacherId) {
        const conv = conversationMap.get(key)!;
        conv.unreadCount++;
      }
    }

    return Array.from(conversationMap.values());
  }

  async createTeacherStudentMessage(data: InsertTeacherStudentMessage): Promise<TeacherStudentMessage> {
    const [message] = await db.insert(teacherStudentMessages).values(data).returning();
    return message;
  }

  // 수업 담당 선생님이 바뀌면 이전 선생님과 학생 사이의 대화를 새 선생님에게 인수인계한다.
  // teacherId(대화 그룹 키)만 새 선생님으로 옮기고 senderId/receiverId(실제 발신/수신자)는 이력 보존을 위해 그대로 둔다.
  async reassignTeacherStudentMessages(centerId: string, fromTeacherId: string, toTeacherId: string, studentId: string): Promise<number> {
    if (!fromTeacherId || !toTeacherId || fromTeacherId === toTeacherId) return 0;
    const rows = await db.update(teacherStudentMessages)
      .set({ teacherId: toTeacherId })
      .where(
        and(
          eq(teacherStudentMessages.centerId, centerId),
          eq(teacherStudentMessages.teacherId, fromTeacherId),
          eq(teacherStudentMessages.studentId, studentId)
        )
      )
      .returning({ id: teacherStudentMessages.id });
    return rows.length;
  }

  async markMessagesAsRead(centerId: string, teacherId: string, studentId: string, readerId: string): Promise<void> {
    await db.update(teacherStudentMessages)
      .set({ isRead: true })
      .where(
        and(
          eq(teacherStudentMessages.centerId, centerId),
          eq(teacherStudentMessages.teacherId, teacherId),
          eq(teacherStudentMessages.studentId, studentId),
          eq(teacherStudentMessages.receiverId, readerId),
          eq(teacherStudentMessages.isRead, false)
        )
      );
  }

  // 특정 학생과의 모든 대화에서, 읽는 사람(readerId)이 실제 수신자인 메시지를 teacherId와 무관하게 읽음 처리한다.
  // 원장/관리자가 "전체" 보기로 대화를 열어도 본인이 수신자인 메시지의 미읽음(빨간 1)이 소거되도록 한다.
  async markStudentMessagesAsReadForReceiver(centerId: string, studentId: string, readerId: string): Promise<void> {
    await db.update(teacherStudentMessages)
      .set({ isRead: true })
      .where(
        and(
          eq(teacherStudentMessages.centerId, centerId),
          eq(teacherStudentMessages.studentId, studentId),
          eq(teacherStudentMessages.receiverId, readerId),
          eq(teacherStudentMessages.isRead, false)
        )
      );
  }

  async markAllMessagesAsReadForConversation(centerId: string, teacherId: string, studentId: string): Promise<void> {
    await db.update(teacherStudentMessages)
      .set({ isRead: true })
      .where(
        and(
          eq(teacherStudentMessages.centerId, centerId),
          eq(teacherStudentMessages.teacherId, teacherId),
          eq(teacherStudentMessages.studentId, studentId),
          eq(teacherStudentMessages.isRead, false)
        )
      );
  }

  // Daily Notices (알림장)
  async getDailyNotice(centerId: string, studentId: string, noticeDate: string): Promise<DailyNotice | undefined> {
    const result = await db.select().from(dailyNotices).where(
      and(
        eq(dailyNotices.centerId, centerId),
        eq(dailyNotices.studentId, studentId),
        eq(dailyNotices.noticeDate, noticeDate)
      )
    );
    return result[0];
  }

  async getDailyNoticeById(id: string): Promise<DailyNotice | undefined> {
    const result = await db.select().from(dailyNotices).where(eq(dailyNotices.id, id));
    return result[0];
  }

  async getDailyNoticesByStudent(centerId: string, studentId: string): Promise<DailyNotice[]> {
    return await db.select().from(dailyNotices).where(
      and(
        eq(dailyNotices.centerId, centerId),
        eq(dailyNotices.studentId, studentId)
      )
    ).orderBy(desc(dailyNotices.noticeDate));
  }

  async getDailyNoticesByCenter(centerId: string, noticeDate: string): Promise<DailyNotice[]> {
    return await db.select().from(dailyNotices).where(
      and(
        eq(dailyNotices.centerId, centerId),
        eq(dailyNotices.noticeDate, noticeDate)
      )
    );
  }

  async createDailyNotice(data: InsertDailyNotice): Promise<DailyNotice> {
    const [notice] = await db.insert(dailyNotices).values(data).returning();
    return notice;
  }

  async updateDailyNotice(id: string, data: Partial<InsertDailyNotice>): Promise<DailyNotice> {
    const [notice] = await db.update(dailyNotices)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(dailyNotices.id, id))
      .returning();
    return notice;
  }

  async deleteDailyNotice(id: string): Promise<void> {
    await db.delete(dailyNotices).where(eq(dailyNotices.id, id));
  }

  // Video Sessions (실시간 화상강의)
  async getVideoSessions(centerId: string): Promise<VideoSession[]> {
    return await db.select().from(videoSessions)
      .where(eq(videoSessions.centerId, centerId))
      .orderBy(desc(videoSessions.createdAt));
  }

  async getVideoSession(id: string): Promise<VideoSession | undefined> {
    const result = await db.select().from(videoSessions)
      .where(eq(videoSessions.id, id));
    return result[0];
  }

  async getActiveVideoSessionsForStudent(studentId: string): Promise<VideoSession[]> {
    // Get sessions where student is a participant and session is active
    const participations = await db.select().from(videoSessionParticipants)
      .where(eq(videoSessionParticipants.studentId, studentId));
    
    if (participations.length === 0) return [];
    
    const sessionIds = participations.map(p => p.sessionId);
    return await db.select().from(videoSessions)
      .where(and(
        inArray(videoSessions.id, sessionIds),
        eq(videoSessions.status, "active")
      ));
  }

  async createVideoSession(data: InsertVideoSession): Promise<VideoSession> {
    const result = await db.insert(videoSessions).values(data).returning();
    return result[0];
  }

  async updateVideoSession(id: string, data: Partial<InsertVideoSession>): Promise<VideoSession> {
    const result = await db.update(videoSessions)
      .set(data)
      .where(eq(videoSessions.id, id))
      .returning();
    return result[0];
  }

  async deleteVideoSession(id: string): Promise<void> {
    // Delete participants first
    await db.delete(videoSessionParticipants).where(eq(videoSessionParticipants.sessionId, id));
    // Then delete session
    await db.delete(videoSessions).where(eq(videoSessions.id, id));
  }

  // Video Session Participants
  async getVideoSessionParticipants(sessionId: string): Promise<VideoSessionParticipant[]> {
    return await db.select().from(videoSessionParticipants)
      .where(eq(videoSessionParticipants.sessionId, sessionId));
  }

  async addVideoSessionParticipant(data: InsertVideoSessionParticipant): Promise<VideoSessionParticipant> {
    const result = await db.insert(videoSessionParticipants).values(data).returning();
    return result[0];
  }

  async updateVideoSessionParticipant(id: string, data: Partial<InsertVideoSessionParticipant>): Promise<VideoSessionParticipant> {
    const result = await db.update(videoSessionParticipants)
      .set(data)
      .where(eq(videoSessionParticipants.id, id))
      .returning();
    return result[0];
  }

  async removeVideoSessionParticipant(sessionId: string, studentId: string): Promise<void> {
    await db.delete(videoSessionParticipants).where(and(
      eq(videoSessionParticipants.sessionId, sessionId),
      eq(videoSessionParticipants.studentId, studentId)
    ));
  }

  // SMS Setup Guide Steps
  async getSmsSetupGuideSteps(): Promise<SmsSetupGuideStep[]> {
    return await db.select().from(smsSetupGuideSteps)
      .orderBy(smsSetupGuideSteps.stepNumber);
  }

  async getSmsSetupGuideStep(id: string): Promise<SmsSetupGuideStep | undefined> {
    const [step] = await db.select().from(smsSetupGuideSteps)
      .where(eq(smsSetupGuideSteps.id, id));
    return step;
  }

  async createSmsSetupGuideStep(data: InsertSmsSetupGuideStep): Promise<SmsSetupGuideStep> {
    const [step] = await db.insert(smsSetupGuideSteps).values(data).returning();
    return step;
  }

  async updateSmsSetupGuideStep(id: string, data: Partial<InsertSmsSetupGuideStep>): Promise<SmsSetupGuideStep> {
    const [step] = await db.update(smsSetupGuideSteps)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(smsSetupGuideSteps.id, id))
      .returning();
    return step;
  }

  async deleteSmsSetupGuideStep(id: string): Promise<void> {
    await db.delete(smsSetupGuideSteps).where(eq(smsSetupGuideSteps.id, id));
  }

  // Semester Announcements
  async getSemesterAnnouncements(centerId: string): Promise<SemesterAnnouncement[]> {
    return db.select().from(semesterAnnouncements)
      .where(eq(semesterAnnouncements.centerId, centerId))
      .orderBy(desc(semesterAnnouncements.createdAt));
  }

  async getSemesterAnnouncement(id: string): Promise<SemesterAnnouncement | undefined> {
    const result = await db.select().from(semesterAnnouncements).where(eq(semesterAnnouncements.id, id));
    return result[0];
  }

  async createSemesterAnnouncement(data: InsertSemesterAnnouncement): Promise<SemesterAnnouncement> {
    const [result] = await db.insert(semesterAnnouncements).values(data).returning();
    return result;
  }

  async updateSemesterAnnouncement(id: string, data: Partial<InsertSemesterAnnouncement>): Promise<SemesterAnnouncement> {
    const [result] = await db.update(semesterAnnouncements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(semesterAnnouncements.id, id))
      .returning();
    if (!result) throw new Error("Announcement not found");
    return result;
  }

  async deleteSemesterAnnouncement(id: string): Promise<void> {
    await db.delete(semesterApplications).where(eq(semesterApplications.announcementId, id));
    await db.delete(semesterRecommendations).where(eq(semesterRecommendations.announcementId, id));
    await db.delete(semesterAnnouncementClasses).where(eq(semesterAnnouncementClasses.announcementId, id));
    await db.delete(semesterAnnouncements).where(eq(semesterAnnouncements.id, id));
  }

  async getSemesterAnnouncementClasses(announcementId: string): Promise<SemesterAnnouncementClass[]> {
    return db.select().from(semesterAnnouncementClasses)
      .where(eq(semesterAnnouncementClasses.announcementId, announcementId))
      .orderBy(semesterAnnouncementClasses.sortOrder);
  }

  async createSemesterAnnouncementClass(data: InsertSemesterAnnouncementClass): Promise<SemesterAnnouncementClass> {
    const [result] = await db.insert(semesterAnnouncementClasses).values(data).returning();
    return result;
  }

  async updateSemesterAnnouncementClass(id: string, data: Partial<InsertSemesterAnnouncementClass>): Promise<SemesterAnnouncementClass> {
    const [result] = await db.update(semesterAnnouncementClasses)
      .set(data)
      .where(eq(semesterAnnouncementClasses.id, id))
      .returning();
    if (!result) throw new Error("Announcement class not found");
    return result;
  }

  async deleteSemesterAnnouncementClass(id: string): Promise<void> {
    await db.delete(semesterApplications).where(eq(semesterApplications.announcementClassId, id));
    await db.delete(semesterRecommendations).where(eq(semesterRecommendations.announcementClassId, id));
    await db.delete(semesterAnnouncementClasses).where(eq(semesterAnnouncementClasses.id, id));
  }

  async getSemesterRecommendations(announcementId: string, studentId?: string): Promise<SemesterRecommendation[]> {
    if (studentId) {
      return db.select().from(semesterRecommendations)
        .where(and(
          eq(semesterRecommendations.announcementId, announcementId),
          eq(semesterRecommendations.studentId, studentId)
        ));
    }
    return db.select().from(semesterRecommendations)
      .where(eq(semesterRecommendations.announcementId, announcementId));
  }

  async createSemesterRecommendation(data: InsertSemesterRecommendation): Promise<SemesterRecommendation> {
    const [result] = await db.insert(semesterRecommendations).values(data).returning();
    return result;
  }

  async createSemesterRecommendationsBulk(data: InsertSemesterRecommendation[]): Promise<SemesterRecommendation[]> {
    if (data.length === 0) return [];
    return db.insert(semesterRecommendations).values(data).returning();
  }

  async updateSemesterRecommendation(id: string, data: { announcementClassId?: string; notes?: string | null }): Promise<SemesterRecommendation> {
    const [result] = await db.update(semesterRecommendations).set(data).where(eq(semesterRecommendations.id, id)).returning();
    return result;
  }

  async deleteSemesterRecommendation(id: string): Promise<void> {
    await db.delete(semesterRecommendations).where(eq(semesterRecommendations.id, id));
  }

  async deleteSemesterRecommendationsByClass(announcementClassId: string): Promise<void> {
    await db.delete(semesterRecommendations).where(eq(semesterRecommendations.announcementClassId, announcementClassId));
  }

  async getSemesterApplications(announcementId: string, studentId?: string): Promise<SemesterApplication[]> {
    if (studentId) {
      return db.select().from(semesterApplications)
        .where(and(
          eq(semesterApplications.announcementId, announcementId),
          eq(semesterApplications.studentId, studentId)
        ));
    }
    return db.select().from(semesterApplications)
      .where(eq(semesterApplications.announcementId, announcementId));
  }

  async getSemesterApplication(id: string): Promise<SemesterApplication | undefined> {
    const result = await db.select().from(semesterApplications).where(eq(semesterApplications.id, id));
    return result[0];
  }

  async getSemesterApplicationByKey(announcementClassId: string, studentId: string): Promise<SemesterApplication | undefined> {
    const result = await db.select().from(semesterApplications)
      .where(and(
        eq(semesterApplications.announcementClassId, announcementClassId),
        eq(semesterApplications.studentId, studentId)
      ));
    return result[0];
  }

  async createSemesterApplication(data: InsertSemesterApplication): Promise<SemesterApplication> {
    const [result] = await db.insert(semesterApplications).values(data).returning();
    return result;
  }

  async deleteSemesterApplication(id: string): Promise<void> {
    await db.delete(semesterApplications).where(eq(semesterApplications.id, id));
  }

  async deleteSemesterApplicationsByClass(announcementClassId: string): Promise<void> {
    await db.delete(semesterApplications).where(eq(semesterApplications.announcementClassId, announcementClassId));
  }

  async importCurrentClassesToAnnouncement(announcementId: string, centerId: string, actorId: string): Promise<{ classesAdded: number; recommendationsAdded: number }> {
    const currentClasses = await this.getClasses(centerId);
    const existingAnnClasses = await this.getSemesterAnnouncementClasses(announcementId);
    const existingRecs = await this.getSemesterRecommendations(announcementId);
    const centerUsers = await this.getCenterUsers(centerId);
    const userNameMap = new Map(centerUsers.map((u) => [u.id, u.name]));

    // Pre-fetch enrollments for all classes in a single query (avoid N+1).
    const enrollmentsByClass = new Map<string, Enrollment[]>();
    const classIds = currentClasses.map((c) => c.id);
    if (classIds.length > 0) {
      const allEnrollments = await db.select().from(enrollments).where(inArray(enrollments.classId, classIds));
      for (const e of allEnrollments) {
        const list = enrollmentsByClass.get(e.classId);
        if (list) list.push(e);
        else enrollmentsByClass.set(e.classId, [e]);
      }
    }

    const signature = (c: { name: string; subject: string; classLevel: string; teacherId: string | null; classroom: string | null; days: string[]; startTime: string; endTime: string; schedule: string | null }) =>
      [c.name, c.subject, c.classLevel, c.teacherId ?? "", c.classroom ?? "", [...c.days].sort().join(","), c.startTime, c.endTime, c.schedule ?? ""].join("|");

    return await db.transaction(async (tx) => {
      const sigToAnnClassId = new Map<string, string>();
      for (const ac of existingAnnClasses) {
        sigToAnnClassId.set(signature(ac), ac.id);
      }

      let classesAdded = 0;
      let sortOrder = existingAnnClasses.length;
      const classIdToAnnClassId = new Map<string, string>();

      for (const c of currentClasses) {
        const sig = signature(c);
        let annClassId = sigToAnnClassId.get(sig);
        if (!annClassId) {
          const [created] = await tx.insert(semesterAnnouncementClasses).values({
            announcementId,
            name: c.name,
            subject: c.subject,
            classLevel: c.classLevel,
            teacherName: c.teacherId ? (userNameMap.get(c.teacherId) ?? c.teacherName ?? null) : (c.teacherName ?? null),
            teacherId: c.teacherId ?? null,
            classroom: c.classroom ?? null,
            days: c.days,
            startTime: c.startTime,
            endTime: c.endTime,
            schedule: c.schedule ?? null,
            color: c.color,
            textbook: null,
            notes: null,
            sortOrder: sortOrder++,
          }).returning();
          annClassId = created.id;
          sigToAnnClassId.set(sig, annClassId);
          classesAdded++;
        }
        classIdToAnnClassId.set(c.id, annClassId);
      }

      const existingRecSet = new Set(existingRecs.map((r) => `${r.studentId}_${r.announcementClassId}`));
      const recsToInsert: InsertSemesterRecommendation[] = [];

      for (const c of currentClasses) {
        const annClassId = classIdToAnnClassId.get(c.id);
        if (!annClassId) continue;
        for (const e of enrollmentsByClass.get(c.id) ?? []) {
          const key = `${e.studentId}_${annClassId}`;
          if (existingRecSet.has(key)) continue;
          existingRecSet.add(key);
          recsToInsert.push({
            announcementId,
            announcementClassId: annClassId,
            studentId: e.studentId,
            assignedById: actorId,
            notes: null,
          });
        }
      }

      if (recsToInsert.length > 0) {
        await tx.insert(semesterRecommendations).values(recsToInsert);
      }

      return { classesAdded, recommendationsAdded: recsToInsert.length };
    });
  }

  async getSupplementaryClasses(centerId: string, startDate: string, endDate: string, teacherId?: string): Promise<SupplementaryClass[]> {
    const conditions = [
      eq(supplementaryClasses.centerId, centerId),
      gte(supplementaryClasses.date, startDate),
      lte(supplementaryClasses.date, endDate),
    ];
    if (teacherId) conditions.push(eq(supplementaryClasses.teacherId, teacherId));
    return db.select().from(supplementaryClasses).where(and(...conditions));
  }

  async getSupplementaryClass(id: string): Promise<SupplementaryClass | undefined> {
    const result = await db.select().from(supplementaryClasses).where(eq(supplementaryClasses.id, id));
    return result[0];
  }

  async createSupplementaryClass(data: InsertSupplementaryClass): Promise<SupplementaryClass> {
    const [result] = await db.insert(supplementaryClasses).values(data).returning();
    return result;
  }

  async updateSupplementaryClass(id: string, data: Partial<InsertSupplementaryClass>): Promise<SupplementaryClass> {
    const [result] = await db.update(supplementaryClasses).set(data).where(eq(supplementaryClasses.id, id)).returning();
    return result;
  }

  async deleteSupplementaryClass(id: string): Promise<void> {
    await db.delete(supplementaryStudents).where(eq(supplementaryStudents.supplementaryClassId, id));
    await db.delete(supplementaryClasses).where(eq(supplementaryClasses.id, id));
  }

  async getSupplementaryStudents(supplementaryClassId: string): Promise<SupplementaryStudent[]> {
    return db.select().from(supplementaryStudents).where(eq(supplementaryStudents.supplementaryClassId, supplementaryClassId));
  }

  async getSupplementaryStudentsByStudent(studentId: string, startDate: string, endDate: string): Promise<(SupplementaryStudent & { supplementaryClass: SupplementaryClass })[]> {
    const allStudentEntries = await db.select().from(supplementaryStudents).where(eq(supplementaryStudents.studentId, studentId));
    if (allStudentEntries.length === 0) return [];
    const classIds = allStudentEntries.map(s => s.supplementaryClassId);
    const classesInRange = await db.select().from(supplementaryClasses).where(
      and(
        inArray(supplementaryClasses.id, classIds),
        gte(supplementaryClasses.date, startDate),
        lte(supplementaryClasses.date, endDate),
      )
    );
    const classMap = new Map(classesInRange.map(c => [c.id, c]));
    return allStudentEntries
      .filter(s => classMap.has(s.supplementaryClassId))
      .map(s => ({ ...s, supplementaryClass: classMap.get(s.supplementaryClassId)! }));
  }

  async addSupplementaryStudents(supplementaryClassId: string, studentIds: string[]): Promise<SupplementaryStudent[]> {
    if (studentIds.length === 0) return [];
    const existing = await db.select().from(supplementaryStudents).where(
      and(
        eq(supplementaryStudents.supplementaryClassId, supplementaryClassId),
        inArray(supplementaryStudents.studentId, studentIds),
      )
    );
    const existingIds = new Set(existing.map(e => e.studentId));
    const newIds = studentIds.filter(id => !existingIds.has(id));
    if (newIds.length === 0) return existing;
    const inserted = await db.insert(supplementaryStudents).values(
      newIds.map(studentId => ({ supplementaryClassId, studentId }))
    ).returning();
    return [...existing, ...inserted];
  }

  async removeSupplementaryStudent(id: string): Promise<void> {
    await db.delete(supplementaryStudents).where(eq(supplementaryStudents.id, id));
  }

  async updateSupplementaryStudent(id: string, data: Partial<SupplementaryStudent>): Promise<void> {
    await db.update(supplementaryStudents).set(data).where(eq(supplementaryStudents.id, id));
  }

  async getSupplementaryClassesForReminder(tomorrowDate: string): Promise<SupplementaryClass[]> {
    return db.select().from(supplementaryClasses).where(
      and(
        eq(supplementaryClasses.date, tomorrowDate),
        eq(supplementaryClasses.sendReminder, true),
        eq(supplementaryClasses.reminderSent, false),
      )
    );
  }

  async getTextbookProgressByCenter(centerId: string, yearMonth?: string): Promise<TextbookProgress[]> {
    const conditions = [eq(textbookProgress.centerId, centerId)];
    if (yearMonth) {
      conditions.push(eq(textbookProgress.yearMonth, yearMonth));
    }
    return db.select().from(textbookProgress)
      .where(and(...conditions))
      .orderBy(desc(textbookProgress.updatedAt));
  }

  async getTextbookProgressByStudent(studentId: string, centerId: string, yearMonth?: string): Promise<TextbookProgress | undefined> {
    const conditions = [
      eq(textbookProgress.studentId, studentId),
      eq(textbookProgress.centerId, centerId),
    ];
    if (yearMonth) {
      conditions.push(eq(textbookProgress.yearMonth, yearMonth));
    }
    const result = await db.select().from(textbookProgress)
      .where(and(...conditions));
    return result[0];
  }

  async upsertTextbookProgress(data: InsertTextbookProgress): Promise<TextbookProgress> {
    const existing = await this.getTextbookProgressByStudent(data.studentId, data.centerId, data.yearMonth);
    if (existing) {
      const result = await db.update(textbookProgress)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(textbookProgress.id, existing.id))
        .returning();
      return result[0];
    }
    const result = await db.insert(textbookProgress).values(data).returning();
    return result[0];
  }

  async deleteTextbookProgress(id: string): Promise<void> {
    await db.delete(textbookProgress).where(eq(textbookProgress.id, id));
  }

  async getWorkJournals(centerId: string, teacherId?: string): Promise<WorkJournal[]> {
    const conditions = [eq(workJournals.centerId, centerId)];
    if (teacherId) {
      conditions.push(eq(workJournals.teacherId, teacherId));
    }
    return db.select().from(workJournals)
      .where(and(...conditions))
      .orderBy(desc(workJournals.updatedAt));
  }

  async getWorkJournal(id: string): Promise<WorkJournal | undefined> {
    const result = await db.select().from(workJournals).where(eq(workJournals.id, id));
    return result[0];
  }

  async createWorkJournal(data: InsertWorkJournal): Promise<WorkJournal> {
    const result = await db.insert(workJournals).values(data).returning();
    return result[0];
  }

  async updateWorkJournal(id: string, data: Partial<InsertWorkJournal>): Promise<WorkJournal> {
    const result = await db.update(workJournals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workJournals.id, id))
      .returning();
    return result[0];
  }

  async deleteWorkJournal(id: string): Promise<void> {
    await db.delete(workJournalClassNotes).where(eq(workJournalClassNotes.journalId, id));
    await db.delete(workJournalStudentNotes).where(eq(workJournalStudentNotes.journalId, id));
    await db.delete(workJournals).where(eq(workJournals.id, id));
  }

  async getWorkJournalClassNotes(journalId: string): Promise<WorkJournalClassNote[]> {
    return db.select().from(workJournalClassNotes)
      .where(eq(workJournalClassNotes.journalId, journalId));
  }

  async upsertWorkJournalClassNote(data: InsertWorkJournalClassNote): Promise<WorkJournalClassNote> {
    const existing = await db.select().from(workJournalClassNotes)
      .where(and(
        eq(workJournalClassNotes.journalId, data.journalId),
        eq(workJournalClassNotes.classId, data.classId)
      ));
    if (existing.length > 0) {
      const result = await db.update(workJournalClassNotes)
        .set({ notes: data.notes })
        .where(eq(workJournalClassNotes.id, existing[0].id))
        .returning();
      return result[0];
    }
    const result = await db.insert(workJournalClassNotes).values(data).returning();
    return result[0];
  }

  async deleteWorkJournalClassNote(id: string): Promise<void> {
    await db.delete(workJournalClassNotes).where(eq(workJournalClassNotes.id, id));
  }

  async getWorkJournalStudentNotes(journalId: string): Promise<WorkJournalStudentNote[]> {
    return db.select().from(workJournalStudentNotes)
      .where(eq(workJournalStudentNotes.journalId, journalId));
  }

  async upsertWorkJournalStudentNote(data: InsertWorkJournalStudentNote): Promise<WorkJournalStudentNote> {
    const existing = await db.select().from(workJournalStudentNotes)
      .where(and(
        eq(workJournalStudentNotes.journalId, data.journalId),
        eq(workJournalStudentNotes.studentId, data.studentId)
      ));
    if (existing.length > 0) {
      const result = await db.update(workJournalStudentNotes)
        .set({ notes: data.notes })
        .where(eq(workJournalStudentNotes.id, existing[0].id))
        .returning();
      return result[0];
    }
    const result = await db.insert(workJournalStudentNotes).values(data).returning();
    return result[0];
  }

  async deleteWorkJournalStudentNote(id: string): Promise<void> {
    await db.delete(workJournalStudentNotes).where(eq(workJournalStudentNotes.id, id));
  }

  async getSmsCredit(centerId: string): Promise<SmsCredit | undefined> {
    const result = await db.select().from(smsCredits).where(eq(smsCredits.centerId, centerId));
    return result[0];
  }

  async createSmsCredit(centerId: string): Promise<SmsCredit> {
    const result = await db.insert(smsCredits).values({ centerId, balance: 0 }).returning();
    return result[0];
  }

  async updateSmsCreditBalance(centerId: string, amount: number): Promise<SmsCredit> {
    let credit = await this.getSmsCredit(centerId);
    if (!credit) {
      credit = await this.createSmsCredit(centerId);
    }
    const result = await db.update(smsCredits)
      .set({ balance: sql`${smsCredits.balance} + ${amount}`, updatedAt: new Date() })
      .where(eq(smsCredits.centerId, centerId))
      .returning();
    return result[0];
  }

  async updateSmsCreditNotifyEnabled(centerId: string, enabled: boolean): Promise<SmsCredit> {
    let credit = await this.getSmsCredit(centerId);
    if (!credit) {
      credit = await this.createSmsCredit(centerId);
    }
    const result = await db.update(smsCredits)
      .set({ lowBalanceNotifyEnabled: enabled, updatedAt: new Date() })
      .where(eq(smsCredits.centerId, centerId))
      .returning();
    return result[0];
  }

  async getSmsCreditTransactions(centerId: string, txLimit?: number): Promise<SmsCreditTransaction[]> {
    const query = db.select().from(smsCreditTransactions)
      .where(eq(smsCreditTransactions.centerId, centerId))
      .orderBy(desc(smsCreditTransactions.createdAt));
    if (txLimit) {
      return await (query as any).limit(txLimit);
    }
    return await query;
  }

  async getAllSmsCreditTransactions(txLimit?: number): Promise<SmsCreditTransaction[]> {
    const query = db.select().from(smsCreditTransactions)
      .orderBy(desc(smsCreditTransactions.createdAt));
    if (txLimit) {
      return await (query as any).limit(txLimit);
    }
    return await query;
  }

  async createSmsCreditTransaction(data: InsertSmsCreditTransaction): Promise<SmsCreditTransaction> {
    const result = await db.insert(smsCreditTransactions).values(data).returning();
    return result[0];
  }

}

export async function seedDatabase(): Promise<void> {
  const existingCenters = await db.select().from(centers);
  if (existingCenters.length > 0) {
    return;
  }

  const [center] = await db.insert(centers).values({ name: "새결수학" }).returning();

  const [admin] = await db.insert(users).values({
    username: "admin",
    password: "5133",
    name: "관리자",
    phone: "01000000000",
    role: UserRole.ADMIN,
  }).returning();
  await db.insert(userCenters).values({ userId: admin.id, centerId: center.id });
}

// Ensure the admin user always exists (runs on every startup)
export async function ensureAdminUser(): Promise<void> {
  try {
    const existing = await db.select().from(users).where(eq(users.username, "admin")).limit(1);
    if (existing.length > 0) {
      // Admin exists — make sure password matches
      if (existing[0].password !== "5133") {
        await db.update(users).set({ password: "5133" }).where(eq(users.username, "admin"));
        console.log("[ADMIN] Admin password reset to default");
      }
      // Make sure admin is linked to at least one center
      const existingCenters = await db.select().from(centers).limit(1);
      if (existingCenters.length > 0) {
        const linked = await db.select().from(userCenters)
          .where(eq(userCenters.userId, existing[0].id)).limit(1);
        if (linked.length === 0) {
          await db.insert(userCenters).values({ userId: existing[0].id, centerId: existingCenters[0].id });
          console.log("[ADMIN] Admin linked to center");
        }
      }
      return;
    }

    // Admin doesn't exist — create it
    const existingCenters = await db.select().from(centers).limit(1);
    if (existingCenters.length === 0) {
      // No centers yet; seedDatabase will handle everything
      return;
    }

    const [admin] = await db.insert(users).values({
      username: "admin",
      password: "5133",
      name: "관리자",
      phone: "01000000000",
      role: UserRole.ADMIN,
    }).returning();
    await db.insert(userCenters).values({ userId: admin.id, centerId: existingCenters[0].id });
    console.log("[ADMIN] Admin user created");
  } catch (err: any) {
    console.error("[ADMIN] ensureAdminUser error:", err?.message);
  }
}

// Check if defaults have been initialized (use system_settings table)
async function isDefaultsInitialized(): Promise<boolean> {
  try {
    const result = await db.select().from(systemSettings).where(eq(systemSettings.key, "defaults_initialized"));
    return result.length > 0 && result[0].value === "true";
  } catch {
    return false;
  }
}

async function markDefaultsInitialized(): Promise<void> {
  try {
    await db.insert(systemSettings).values({ key: "defaults_initialized", value: "true" })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: "true", updatedAt: new Date() } });
  } catch {
    // Ignore errors
  }
}

// Ensure default categories and features exist (runs once, then skips on subsequent restarts)
export async function ensureDefaultFeatures(): Promise<void> {
  // Check if already initialized to prevent re-running on every restart
  const initialized = await isDefaultsInitialized();
  if (initialized) {
    return; // Skip - defaults already set up
  }
  
  // Default categories
  const defaultCategories = [
    { id: "cat-class-mgmt", name: "수업 관리", menuKey: "class-management", description: "수업 관련 기능들", displayOrder: 1 },
    { id: "cat-schedule", name: "선생님", menuKey: "schedule", description: "선생님 관련 기능들", displayOrder: 2 },
    { id: "cat-parent", name: "학부모", menuKey: "parent-portal", description: "학부모 관련 기능들", displayOrder: 3 },
    { id: "cat-student-mgmt", name: "학생", menuKey: "student-management", description: "학생 관련 기능들", displayOrder: 4 },
  ];

  // Ensure categories exist
  for (const category of defaultCategories) {
    const existing = await db.select().from(featureCategories).where(eq(featureCategories.id, category.id));
    if (existing.length === 0) {
      await db.insert(featureCategories).values(category);
    }
  }

  // Map parentMenuKey to categoryId
  const categoryMapping: Record<string, string> = {
    "class-management": "cat-class-mgmt",
    "schedule": "cat-schedule",
    "parent-portal": "cat-parent",
    "student-management": "cat-student-mgmt",
  };

  // Basic features (included for all centers by default)
  const basicFeatures = [
    {
      name: "시간표",
      description: "수업 시간표를 관리하고 확인할 수 있는 기본 기능입니다.",
      menuKey: "timetable",
      parentMenuKey: null,
      categoryId: null, // Independent top-level menu
      featureType: "basic" as const,
      displayOrder: 1,
    },
    {
      name: "출결 관리",
      description: "학생들의 출결을 관리하고 학부모에게 알림을 발송하는 기본 기능입니다.",
      menuKey: "attendance",
      parentMenuKey: "class-management",
      categoryId: "cat-class-mgmt",
      featureType: "basic" as const,
      displayOrder: 2,
    },
    {
      name: "수업 기록",
      description: "수업 내용과 학생별 메모를 기록하는 기본 기능입니다.",
      menuKey: "class-notes",
      parentMenuKey: "class-management",
      categoryId: "cat-class-mgmt",
      featureType: "basic" as const,
      displayOrder: 3,
    },
    {
      name: "수업 영상",
      description: "수업 영상을 업로드하고 관리하는 기본 기능입니다.",
      menuKey: "videos",
      parentMenuKey: "class-management",
      categoryId: "cat-class-mgmt",
      featureType: "basic" as const,
      displayOrder: 4,
    },
    {
      name: "업무관리",
      description: "선생님들에게 업무를 지시하고 관리하는 기본 기능입니다.",
      menuKey: "todos",
      parentMenuKey: "schedule",
      categoryId: "cat-schedule",
      featureType: "basic" as const,
      displayOrder: 5,
    },
    {
      name: "학원 캘린더",
      description: "학원 행사 및 시험 일정을 관리하는 기본 기능입니다.",
      menuKey: "academy-calendar",
      parentMenuKey: "schedule",
      categoryId: "cat-schedule",
      featureType: "basic" as const,
      displayOrder: 6,
    },
    {
      name: "학부모 연락",
      description: "학부모에게 단체 문자를 발송하는 기본 기능입니다.",
      menuKey: "contact-parents",
      parentMenuKey: "parent-portal",
      categoryId: "cat-parent",
      featureType: "basic" as const,
      displayOrder: 7,
    },
    {
      name: "교육비",
      description: "학생별 교육비를 계산하고 안내하는 기본 기능입니다.",
      menuKey: "tuition",
      parentMenuKey: "parent-portal",
      categoryId: "cat-parent",
      featureType: "basic" as const,
      displayOrder: 8,
    },
    {
      name: "교사소통",
      description: "선생님과 담당 학생 간의 1:1 채팅 기능입니다. 원장은 전체 대화를 확인할 수 있습니다.",
      menuKey: "teacher-communication",
      parentMenuKey: "parent-portal",
      categoryId: "cat-parent",
      featureType: "basic" as const,
      displayOrder: 9,
    },
    {
      name: "알림장",
      description: "학생별 일일 알림장을 작성하고 학부모에게 공유하는 기능입니다.",
      menuKey: "daily-notices",
      parentMenuKey: "parent-portal",
      categoryId: "cat-parent",
      featureType: "basic" as const,
      displayOrder: 11,
    },
    {
      name: "보충",
      description: "보충 수업 일정을 생성하고 학생/학부모에게 SMS로 안내할 수 있는 기능입니다.",
      menuKey: "supplementary",
      parentMenuKey: "student-management",
      categoryId: null,
      featureType: "basic" as const,
      displayOrder: 12,
    },
    {
      name: "상담",
      description: "학생별 상담 일지를 작성하고 관리할 수 있는 기능입니다.",
      menuKey: "counseling",
      parentMenuKey: "student-management",
      categoryId: null,
      featureType: "basic" as const,
      displayOrder: 13,
    },
    {
      name: "경영",
      description: "경영 대시보드 - 학원 경영 현황 및 분석",
      menuKey: "management",
      parentMenuKey: null,
      categoryId: null,
      featureType: "basic" as const,
      displayOrder: 100,
    },
    {
      name: "사용자 관리",
      description: "계정 생성 및 관리",
      menuKey: "users",
      parentMenuKey: null,
      categoryId: null,
      featureType: "basic" as const,
      displayOrder: 101,
    },
    {
      name: "기능 관리",
      description: "추가 기능을 등록하고 원장의 요청을 관리합니다.",
      menuKey: "feature-management",
      parentMenuKey: null,
      categoryId: null,
      featureType: "basic" as const,
      displayOrder: 102,
    },
  ];

  // Optional features (centers must enable them)
  const optionalFeatures = [
    {
      name: "스터디카페",
      description: "학생들이 자율학습 공간을 예약하고 이용할 수 있는 스터디카페 기능입니다.",
      menuKey: "study-cafe",
      parentMenuKey: null,
      categoryId: null, // Independent feature
      featureType: "optional" as const,
      displayOrder: 101,
    },
    {
      name: "교재 영상",
      description: "교재와 연동된 학습 영상을 관리하고 시청할 수 있는 기능입니다.",
      menuKey: "textbooks-videos",
      parentMenuKey: "class-management",
      categoryId: "cat-class-mgmt",
      featureType: "optional" as const,
      displayOrder: 102,
    },
    {
      name: "월간보고서",
      description: "학생별 월간 학습 현황 및 평가 보고서를 생성하고 학부모에게 전송할 수 있는 기능입니다.",
      menuKey: "student-reports",
      parentMenuKey: "parent-portal",
      categoryId: "cat-parent",
      featureType: "optional" as const,
      displayOrder: 103,
    },
    {
      name: "클리닉",
      description: "보충 수업이 필요한 학생들을 관리하고 주차별 클리닉 기록을 작성할 수 있는 기능입니다.",
      menuKey: "clinic",
      parentMenuKey: "class-management",
      categoryId: "cat-class-mgmt",
      featureType: "optional" as const,
      displayOrder: 104,
      isActive: false,
    },
    {
      name: "숙제 (사진검사)",
      description: "학생들이 사진으로 숙제를 제출하고 선생님이 확인할 수 있는 기능입니다.",
      menuKey: "homework",
      parentMenuKey: "class-management",
      categoryId: "cat-class-mgmt",
      featureType: "optional" as const,
      displayOrder: 105,
    },
    {
      name: "주간평가",
      description: "학생들의 주간 학습 평가를 관리하고 기록할 수 있는 기능입니다.",
      menuKey: "assessments",
      parentMenuKey: "class-management",
      categoryId: "cat-class-mgmt",
      featureType: "optional" as const,
      displayOrder: 106,
    },
    {
      name: "숙제 (대면검사)",
      description: "사진 제출 없이 선생님이 직접 학생과 대면하여 암기, 이해도 등을 검사하고 평가할 수 있는 기능입니다.",
      menuKey: "face-to-face-checks",
      parentMenuKey: "class-management",
      categoryId: "cat-class-mgmt",
      featureType: "optional" as const,
      displayOrder: 107,
    },
    {
      name: "발표영상",
      description: "학생들의 수업 발표 영상을 유튜브 링크로 관리하고 학생별로 확인할 수 있는 기능입니다.",
      menuKey: "presentation-videos",
      parentMenuKey: "class-management",
      categoryId: "cat-class-mgmt",
      featureType: "optional" as const,
      displayOrder: 108,
    },
    {
      name: "평가관리",
      description: "시험 생성, 응시자 선택, 점수 입력, 시험지 이미지 업로드 기능을 제공합니다. 시험지는 45일 후 자동 삭제됩니다.",
      menuKey: "exam-management",
      parentMenuKey: "class-management",
      categoryId: "cat-class-mgmt",
      featureType: "optional" as const,
      displayOrder: 109,
    },
    {
      name: "시간표 (구글캘린더 연동)",
      description: "구글 캘린더에서 수업 일정을 가져와 요일별 시간표로 정리합니다. 각 수업에 수강 학생을 등록할 수 있습니다.",
      menuKey: "google-calendar-timetable",
      parentMenuKey: "top-level",
      categoryId: null,
      featureType: "optional" as const,
      displayOrder: 110,
    },
    {
      name: "새학기안내",
      description: "새 학기 시간표 공지와 학생별 추천 수업을 안내하는 기능입니다. 학생/학부모가 추천 수업을 확인할 수 있습니다.",
      menuKey: "semester-announcements",
      parentMenuKey: "parent-portal",
      categoryId: "cat-parent",
      featureType: "optional" as const,
      displayOrder: 111,
    },
    {
      name: "업무일지",
      description: "선생님별 업무일지를 작성하고 관리할 수 있는 기능입니다. 공통 업무, 반별 업무, 학생별 업무 기록을 남길 수 있습니다.",
      menuKey: "work-journal",
      parentMenuKey: "schedule",
      categoryId: "cat-schedule",
      featureType: "optional" as const,
      displayOrder: 114,
    },
    {
      name: "신규상담",
      description: "신규 입회 상담 기록 기능입니다. 학부모가 학생 정보(이름, 성별, 학교, 학년, 목표학교)를 작성하고, 선생님이 성적과 상담내용을 기록합니다.",
      menuKey: "new-consultations",
      parentMenuKey: "schedule",
      categoryId: "cat-schedule",
      featureType: "optional" as const,
      displayOrder: 117,
    },
    {
      name: "제이컴퓨터 시간표",
      description: "선생님이 같은 시간대에 여러 수업을 배정할 수 있는 시간표 관리 기능입니다.",
      menuKey: "jcomputer-timetable",
      parentMenuKey: null,
      categoryId: null,
      featureType: "optional" as const,
      displayOrder: 115,
    },
    {
      name: "수학 오답노트",
      description: "AI가 수학 문제집 이미지에서 문제를 자동 감지하고, 선택한 문제로 오답노트를 만들어 학생에게 할당할 수 있는 기능입니다.",
      menuKey: "math-wrong-notes",
      parentMenuKey: "student-management",
      categoryId: "cat-student-mgmt",
      featureType: "optional" as const,
      displayOrder: 116,
    },
  ];

  const allFeatures = [...basicFeatures, ...optionalFeatures];

  for (const featureData of allFeatures) {
    const existingFeature = await db.select().from(features).where(eq(features.menuKey, featureData.menuKey));
    if (existingFeature.length === 0) {
      await db.insert(features).values(featureData);
    } else {
      const featureIsActive = 'isActive' in featureData ? (featureData as { isActive?: boolean }).isActive : undefined;
      const updates: Record<string, any> = {};
      if (featureData.categoryId && existingFeature[0].categoryId !== featureData.categoryId) {
        updates.categoryId = featureData.categoryId;
      }
      if (featureData.parentMenuKey && existingFeature[0].parentMenuKey !== featureData.parentMenuKey) {
        updates.parentMenuKey = featureData.parentMenuKey;
      }
      if (existingFeature[0].featureType !== featureData.featureType) {
        updates.featureType = featureData.featureType;
      }
      if (featureIsActive !== undefined && existingFeature[0].isActive !== featureIsActive) {
        updates.isActive = featureIsActive;
      }
      if (Object.keys(updates).length > 0) {
        await db.update(features)
          .set(updates)
          .where(eq(features.menuKey, featureData.menuKey));
      }
    }
  }

  // Ensure all centers have basic features enabled
  const allCenters = await db.select().from(centers);
  const allBasicFeatures = await db.select().from(features).where(eq(features.featureType, "basic"));
  
  for (const center of allCenters) {
    for (const feature of allBasicFeatures) {
      const existingCenterFeature = await db.select()
        .from(centerFeatures)
        .where(and(
          eq(centerFeatures.centerId, center.id),
          eq(centerFeatures.featureId, feature.id)
        ));
      
      if (existingCenterFeature.length === 0) {
        await db.insert(centerFeatures).values({
          centerId: center.id,
          featureId: feature.id,
          isHidden: false,
        });
      }
    }
  }
  
  // Mark defaults as initialized to prevent re-running on subsequent restarts
  await markDefaultsInitialized();
}

export async function ensureMissingFeatures(): Promise<void> {
  const requiredCategories = [
    { id: "cat-class-mgmt", name: "수업 관리", menuKey: "class-management", description: "수업 관련 기능들", displayOrder: 1 },
    { id: "cat-schedule", name: "선생님", menuKey: "schedule", description: "선생님 관련 기능들", displayOrder: 2 },
    { id: "cat-parent", name: "학부모", menuKey: "parent-portal", description: "학부모 관련 기능들", displayOrder: 3 },
    { id: "cat-student-mgmt", name: "학생", menuKey: "student-management", description: "학생 관련 기능들", displayOrder: 4 },
  ];
  for (const cat of requiredCategories) {
    const existing = await db.select().from(featureCategories).where(eq(featureCategories.id, cat.id));
    if (existing.length === 0) {
      await db.insert(featureCategories).values(cat);
      console.log(`[INIT] Added missing category: ${cat.id}`);
    }
  }

  // All features that should exist - matches ensureDefaultFeatures list
  const allRequiredFeatures = [
    // Basic features
    { name: "시간표", menuKey: "timetable", featureType: "basic" as const, displayOrder: 1, categoryId: null, parentMenuKey: null },
    { name: "출결 관리", menuKey: "attendance", featureType: "basic" as const, displayOrder: 2, categoryId: "cat-class-mgmt", parentMenuKey: "class-management" },
    { name: "수업 기록", menuKey: "class-notes", featureType: "basic" as const, displayOrder: 3, categoryId: "cat-class-mgmt", parentMenuKey: "class-management" },
    { name: "수업 영상", menuKey: "videos", featureType: "basic" as const, displayOrder: 4, categoryId: "cat-class-mgmt", parentMenuKey: "class-management" },
    { name: "업무관리", menuKey: "todos", featureType: "basic" as const, displayOrder: 5, categoryId: "cat-schedule", parentMenuKey: "schedule" },
    { name: "학원 캘린더", menuKey: "academy-calendar", featureType: "basic" as const, displayOrder: 6, categoryId: "cat-schedule", parentMenuKey: "schedule" },
    { name: "문자 전송", menuKey: "contact-parents", featureType: "basic" as const, displayOrder: 7, categoryId: "cat-parent", parentMenuKey: "parent-portal" },
    { name: "교육비", menuKey: "tuition", featureType: "basic" as const, displayOrder: 8, categoryId: "cat-parent", parentMenuKey: "parent-portal" },
    { name: "교사소통", menuKey: "teacher-communication", featureType: "basic" as const, displayOrder: 9, categoryId: "cat-parent", parentMenuKey: "parent-portal" },
    { name: "알림장", menuKey: "daily-notices", featureType: "basic" as const, displayOrder: 11, categoryId: "cat-parent", parentMenuKey: "parent-portal" },
    { name: "경영", menuKey: "management", featureType: "basic" as const, displayOrder: 100, categoryId: null, parentMenuKey: null },
    { name: "사용자 관리", menuKey: "users", featureType: "basic" as const, displayOrder: 101, categoryId: null, parentMenuKey: null },
    { name: "기능 관리", menuKey: "feature-management", featureType: "basic" as const, displayOrder: 102, categoryId: null, parentMenuKey: null },
    // Optional features
    { name: "스터디카페", menuKey: "study-cafe", featureType: "optional" as const, displayOrder: 101, categoryId: null, parentMenuKey: null },
    { name: "교재 영상", menuKey: "textbooks-videos", featureType: "optional" as const, displayOrder: 102, categoryId: "cat-class-mgmt", parentMenuKey: "class-management" },
    { name: "월간보고서", menuKey: "student-reports", featureType: "optional" as const, displayOrder: 103, categoryId: "cat-parent", parentMenuKey: "parent-portal" },
    { name: "클리닉", menuKey: "clinic", featureType: "optional" as const, displayOrder: 104, categoryId: "cat-class-mgmt", parentMenuKey: "class-management" },
    { name: "숙제 (사진검사)", menuKey: "homework", featureType: "optional" as const, displayOrder: 105, categoryId: "cat-class-mgmt", parentMenuKey: "class-management" },
    { name: "주간평가", menuKey: "assessments", featureType: "optional" as const, displayOrder: 106, categoryId: "cat-class-mgmt", parentMenuKey: "class-management" },
    { name: "숙제 (대면검사)", menuKey: "face-to-face-checks", featureType: "optional" as const, displayOrder: 107, categoryId: "cat-class-mgmt", parentMenuKey: "class-management" },
    { name: "발표영상", menuKey: "presentation-videos", featureType: "optional" as const, displayOrder: 108, categoryId: "cat-class-mgmt", parentMenuKey: "class-management" },
    { name: "평가관리", menuKey: "exam-management", featureType: "optional" as const, displayOrder: 109, categoryId: "cat-class-mgmt", parentMenuKey: "class-management" },
    { name: "시간표 (구글캘린더 연동)", menuKey: "google-calendar-timetable", featureType: "optional" as const, displayOrder: 110, categoryId: null, parentMenuKey: "top-level" },
    // Additional features that have ManualButton
    { name: "화상강의", menuKey: "video-sessions", featureType: "optional" as const, displayOrder: 112, categoryId: "cat-class-mgmt", parentMenuKey: "class-management" },
    { name: "새학기안내", menuKey: "semester-announcements", featureType: "optional" as const, displayOrder: 111, categoryId: "cat-parent", parentMenuKey: "parent-portal" },
    { name: "보충", menuKey: "supplementary", featureType: "basic" as const, displayOrder: 12, categoryId: null, parentMenuKey: "student-management" },
    { name: "상담", menuKey: "counseling", featureType: "basic" as const, displayOrder: 13, categoryId: null, parentMenuKey: "student-management" },
    { name: "종합성적추이", menuKey: "grade-trend", featureType: "basic" as const, displayOrder: 14, categoryId: null, parentMenuKey: "student-management" },
    { name: "숙제 완성도", menuKey: "homework-completion", featureType: "basic" as const, displayOrder: 15, categoryId: null, parentMenuKey: "student-management" },
    { name: "출결현황", menuKey: "attendance-status", featureType: "basic" as const, displayOrder: 16, categoryId: null, parentMenuKey: "student-management" },
    { name: "내신성적", menuKey: "school-grades", featureType: "optional" as const, displayOrder: 17, categoryId: "cat-student-mgmt", parentMenuKey: "student-management" },
    { name: "교재진도표", menuKey: "textbook-progress", featureType: "optional" as const, displayOrder: 113, categoryId: "cat-class-mgmt", parentMenuKey: "class-management" },
    { name: "업무일지", menuKey: "work-journal", featureType: "optional" as const, displayOrder: 114, categoryId: "cat-schedule", parentMenuKey: "schedule" },
    { name: "제이컴퓨터 시간표", menuKey: "jcomputer-timetable", featureType: "optional" as const, displayOrder: 115, categoryId: null, parentMenuKey: null },
    { name: "수학 오답노트", menuKey: "math-wrong-notes", featureType: "optional" as const, displayOrder: 116, categoryId: "cat-student-mgmt", parentMenuKey: "student-management" },
    { name: "신규상담", menuKey: "new-consultations", featureType: "optional" as const, displayOrder: 117, categoryId: "cat-schedule", parentMenuKey: "schedule" },
  ];

  for (const featureData of allRequiredFeatures) {
    const existing = await db.select().from(features).where(eq(features.menuKey, featureData.menuKey));
    if (existing.length === 0) {
      console.log(`[INIT] Adding missing feature: ${featureData.menuKey}`);
      await db.insert(features).values({
        name: featureData.name,
        menuKey: featureData.menuKey,
        featureType: featureData.featureType,
        displayOrder: featureData.displayOrder,
        categoryId: featureData.categoryId,
        parentMenuKey: featureData.parentMenuKey,
        description: "",
      });
    } else {
      const updates: any = {};
      if (existing[0].featureType !== featureData.featureType) {
        updates.featureType = featureData.featureType;
      }
      if (existing[0].parentMenuKey !== featureData.parentMenuKey) {
        updates.parentMenuKey = featureData.parentMenuKey;
      }
      if (featureData.categoryId && existing[0].categoryId !== featureData.categoryId) {
        updates.categoryId = featureData.categoryId;
      }
      if (Object.keys(updates).length > 0) {
        await db.update(features).set(updates).where(eq(features.menuKey, featureData.menuKey));
        console.log(`[INIT] Updated feature ${featureData.menuKey}: ${JSON.stringify(updates)}`);
      }
    }
  }
}

export const storage = new DatabaseStorage();
