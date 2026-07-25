import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ManualButton } from "@/components/manual-button";
import { useAuth } from "@/lib/auth-context";
import { queryClient, apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileText, Sparkles, Send, RefreshCw, ChevronLeft, ChevronRight, Plus, Trash2, Clock, BookOpen, ClipboardCheck, Search, BarChart3 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import type { User, Center, StudentMonthlyReport, Class as ClassType } from "@shared/schema";
import { UserRole, isAssistantTeacher } from "@shared/schema";
import { TeacherClassTabs } from "@/components/teacher-class-tabs";
import { format, startOfMonth, addMonths, subMonths } from "date-fns";
import { ko } from "date-fns/locale";

interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  attendanceRate: number;
}

interface HomeworkSummary {
  totalAssigned: number;
  completed: number;
  completionRate: number;
  byClass: { className: string; assigned: number; completed: number }[];
}

interface AssessmentSummary {
  className: string;
  scores: { date: string; score: number; maxScore: number }[];
  averageScore: number;
  trend: "improving" | "stable" | "declining";
}

interface ExamResultSummary {
  examName: string;
  examDate: string;
  score: number | null;
  maxScore: number;
  className?: string;
  rank?: number;
  totalParticipants?: number;
}

interface ReportWithDetails extends StudentMonthlyReport {
  student?: User;
  creator?: User;
}

export default function StudentReportsPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(startOfMonth(new Date()));
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [editingReport, setEditingReport] = useState<ReportWithDetails | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [smsReport, setSmsReport] = useState<ReportWithDetails | null>(null);
  const [includeStats, setIncludeStats] = useState(true);
  const [selectedRecipients, setSelectedRecipients] = useState<{ phone: string; type: string }[]>([]);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateStudentId, setGenerateStudentId] = useState<string>("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGradeTab, setSelectedGradeTab] = useState<string>("all");
  const [selectedClassTab, setSelectedClassTab] = useState<string>("all");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("all");
  const [teacherViewTab, setTeacherViewTab] = useState<"my" | "assistant">("my");
  const [smsHistoryReport, setSmsHistoryReport] = useState<ReportWithDetails | null>(null);

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth() + 1;

  // Always use sidebar-selected center
  const selectedCenterId = selectedCenter?.id || "";

  // Fetch only users from the selected center for better performance
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: [`/api/users?centerId=${selectedCenterId}`],
    enabled: !!user && !!selectedCenterId,
  });

  // Fetch only classes from the selected center for better performance
  const { data: classes = [] } = useQuery<ClassType[]>({
    queryKey: [`/api/classes?centerId=${selectedCenterId}`],
    enabled: !!user && !!selectedCenterId,
  });

  const { data: enrollments = [] } = useQuery<{ id: string; classId: string; studentId: string }[]>({
    queryKey: [`/api/enrollments?centerId=${selectedCenterId}`],
    enabled: !!user && !!selectedCenterId,
  });

  const centerClasses = classes.filter(c => c.centerId === selectedCenterId);
  const centerClassIds = centerClasses.map(c => c.id);
  const enrolledStudentIds = enrollments
    .filter(e => centerClassIds.includes(e.classId))
    .map(e => e.studentId);
  const uniqueEnrolledStudentIds = Array.from(new Set(enrolledStudentIds));

  const students = users.filter(u => u.role === UserRole.STUDENT);
  const centerStudents = students.filter(s => uniqueEnrolledStudentIds.includes(s.id));
  
  // For teachers, only show students whose homeroom teacher is themselves
  const isTeacher = user?.role === UserRole.TEACHER;
  const isAdmin = user?.role === UserRole.ADMIN;
  
  // Get teachers for admin filter
  const teachers = users.filter(u => u.role === UserRole.TEACHER || u.role === UserRole.CLINIC_TEACHER || u.role === UserRole.PRINCIPAL);
  
  // Get teacher's class IDs
  const teacherOwnClasses = isTeacher ? centerClasses.filter(c => c.teacherId === user?.id) : [];
  const teacherAssistantClasses = isTeacher ? centerClasses.filter(c => isAssistantTeacher(c, user?.id) && c.teacherId !== user?.id) : [];
  const hasAssistantClasses = teacherAssistantClasses.length > 0;
  const teacherDisplayClasses = hasAssistantClasses
    ? (teacherViewTab === "assistant" ? teacherAssistantClasses : teacherOwnClasses)
    : [...teacherOwnClasses, ...teacherAssistantClasses];
  const teacherClassIds = isTeacher ? teacherDisplayClasses.map(c => c.id) : [];
  // Get student IDs enrolled in teacher's classes
  const teacherClassStudentIds = enrollments
    .filter(e => teacherClassIds.includes(e.classId))
    .map(e => e.studentId);
  const uniqueTeacherClassStudentIds = Array.from(new Set(teacherClassStudentIds));
  
  // For admin filter by selected teacher: get that teacher's class student IDs
  const selectedTeacherClassIds = selectedTeacherId !== "all"
    ? centerClasses.filter(c => c.teacherId === selectedTeacherId || isAssistantTeacher(c, selectedTeacherId)).map(c => c.id)
    : [];
  const selectedTeacherClassStudentIds = selectedTeacherId !== "all"
    ? Array.from(new Set(enrollments.filter(e => selectedTeacherClassIds.includes(e.classId)).map(e => e.studentId)))
    : [];

  // For teachers, show students who are either:
  // 1. Their homeroom students (homeroomTeacherId === user.id)
  // 2. Enrolled in their classes
  // For admin, allow filtering by teacher (homeroom OR enrolled in teacher's classes)
  const homeroomFilteredStudents = isTeacher 
    ? centerStudents.filter(s => 
        s.homeroomTeacherId === user?.id || uniqueTeacherClassStudentIds.includes(s.id)
      )
    : selectedTeacherId !== "all"
      ? centerStudents.filter(s => s.homeroomTeacherId === selectedTeacherId || selectedTeacherClassStudentIds.includes(s.id))
      : centerStudents;

  // Grade order for sorting
  const gradeOrder = ["초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3", "성인"];
  
  // Normalize grade to short format (고등학교 2학년 -> 고2, 중학교 1학년 -> 중1)
  const normalizeGrade = (grade: string | null): string => {
    if (!grade) return "미지정";
    
    // Already in short format
    if (gradeOrder.includes(grade)) return grade;
    
    // Convert long format to short format
    const match = grade.match(/^(초등학교|중학교|고등학교)\s*(\d+)학년$/);
    if (match) {
      const schoolType = match[1] === "초등학교" ? "초" : match[1] === "중학교" ? "중" : "고";
      return `${schoolType}${match[2]}`;
    }
    
    return grade;
  };
  
  // Get available grades from students (normalized)
  const availableGrades = Array.from(new Set(homeroomFilteredStudents.map(s => normalizeGrade(s.grade))))
    .sort((a, b) => {
      const indexA = gradeOrder.indexOf(a);
      const indexB = gradeOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  
  // Filter by selected grade tab (use normalized comparison)
  const gradeFilteredStudents = selectedGradeTab === "all"
    ? homeroomFilteredStudents
    : homeroomFilteredStudents.filter(s => normalizeGrade(s.grade) === selectedGradeTab);
  
  // Get available classes for the filtered students
  const isPrincipal = user?.role === UserRole.PRINCIPAL;
  const availableClasses = (() => {
    if (isTeacher) {
      return hasAssistantClasses ? teacherDisplayClasses : centerClasses.filter(c => c.teacherId === user?.id || isAssistantTeacher(c, user?.id));
    }
    if (isPrincipal) return centerClasses.filter(c => c.teacherId === user?.id || isAssistantTeacher(c, user?.id));
    if (selectedTeacherId !== "all") return centerClasses.filter(c => c.teacherId === selectedTeacherId || isAssistantTeacher(c, selectedTeacherId));
    return centerClasses;
  })().sort((a, b) => `${a.name} ${a.subject || ""}`.localeCompare(`${b.name} ${b.subject || ""}`, 'ko'));
  
  // Filter by selected class tab
  const classFilteredStudents = selectedClassTab === "all"
    ? gradeFilteredStudents
    : gradeFilteredStudents.filter(s => {
        const studentEnrollments = enrollments.filter(e => e.studentId === s.id);
        return studentEnrollments.some(e => e.classId === selectedClassTab);
      });
  
  // Filter students by search query
  const filteredStudents = searchQuery.trim() 
    ? classFilteredStudents.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.school && s.school.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : classFilteredStudents;
  
  // Sort students alphabetically (가나다순)
  const sortedStudents = [...filteredStudents].sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const { data: reports = [], isLoading: reportsLoading, refetch: refetchReports } = useQuery<ReportWithDetails[]>({
    queryKey: [`/api/student-reports?centerId=${selectedCenterId}&year=${year}&month=${month}`],
    enabled: !!selectedCenterId,
  });

  const generateReportMutation = useMutation({
    mutationFn: async ({ studentId, instructions }: { studentId: string; instructions?: string }) => {
      const response = await apiRequest("POST", "/api/student-reports/generate", {
        studentId,
        centerId: selectedCenterId,
        year,
        month,
        createdById: user?.id,
        customInstructions: instructions || undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "보고서가 생성되었습니다" });
      setShowGenerateDialog(false);
      setGenerateStudentId("");
      setCustomInstructions("");
      refetchReports();
    },
    onError: (error) => {
      toast({ title: "보고서 생성 실패", description: error.message, variant: "destructive" });
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const response = await apiRequest("PATCH", `/api/student-reports/${id}`, {
        reportContent: content,
        actorId: user?.id,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "보고서가 수정되었습니다" });
      setEditingReport(null);
      refetchReports();
    },
    onError: (error) => {
      toast({ title: "수정 실패", description: error.message, variant: "destructive" });
    },
  });

  const refineReportMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/student-reports/${id}/refine`, {
        actorId: user?.id,
      });
      return response.json();
    },
    onSuccess: (data: StudentMonthlyReport) => {
      toast({ title: "보고서가 다듬어졌습니다" });
      setEditedContent(data.reportContent);
      refetchReports();
    },
    onError: (error) => {
      toast({ title: "다듬기 실패", description: error.message, variant: "destructive" });
    },
  });

  const sendSmsMutation = useMutation({
    mutationFn: async ({ id, recipients, includeStats }: { id: string; recipients: { phone: string; type: string }[]; includeStats: boolean }) => {
      const response = await apiRequest("POST", `/api/student-reports/${id}/send-sms`, {
        actorId: user?.id,
        recipients,
        includeStats,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "문자가 발송되었습니다" });
      setShowSmsDialog(false);
      setSmsReport(null);
      refetchReports();
    },
    onError: (error) => {
      toast({ title: "문자 발송 실패", description: error.message, variant: "destructive" });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/student-reports/${id}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      toast({ title: "보고서가 삭제되었습니다" });
      refetchReports();
    },
    onError: (error) => {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenGenerateDialog = (studentId: string) => {
    setGenerateStudentId(studentId);
    setCustomInstructions("");
    setShowGenerateDialog(true);
  };

  const handleGenerateReport = () => {
    if (generateStudentId) {
      generateReportMutation.mutate({ studentId: generateStudentId, instructions: customInstructions });
    }
  };

  const parseAttendanceSummary = (json: string | null | undefined): AttendanceSummary | null => {
    if (!json) return null;
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed.attendanceRate === 'number') return parsed;
      return null;
    } catch {
      return null;
    }
  };

  const parseHomeworkSummary = (json: string | null | undefined): HomeworkSummary | null => {
    if (!json) return null;
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed.completionRate === 'number') return parsed;
      return null;
    } catch {
      return null;
    }
  };

  const parseAssessmentSummary = (json: string | null | undefined): AssessmentSummary[] | null => {
    if (!json) return null;
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) return parsed;
      return null;
    } catch {
      return null;
    }
  };

  const parseExamResultsSummary = (json: string | null | undefined): ExamResultSummary[] | null => {
    if (!json) return null;
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      return null;
    } catch {
      return null;
    }
  };

  const handleEditReport = (report: ReportWithDetails) => {
    setEditingReport(report);
    setEditedContent(report.reportContent);
  };

  const handleSaveReport = () => {
    if (editingReport) {
      updateReportMutation.mutate({ id: editingReport.id, content: editedContent });
    }
  };

  const handleRefineReport = () => {
    if (editingReport) {
      refineReportMutation.mutate(editingReport.id);
    }
  };

  const handleOpenSmsDialog = (report: ReportWithDetails) => {
    setSmsReport(report);
    const student = report.student;
    const recipients: { phone: string; type: string }[] = [];
    if (student?.motherPhone) {
      recipients.push({ phone: student.motherPhone, type: "mother" });
    }
    if (student?.fatherPhone) {
      recipients.push({ phone: student.fatherPhone, type: "father" });
    }
    setSelectedRecipients(recipients);
    setShowSmsDialog(true);
  };

  const handleSendSms = () => {
    if (smsReport && selectedRecipients.length > 0) {
      sendSmsMutation.mutate({ id: smsReport.id, recipients: selectedRecipients, includeStats });
    }
  };

  const toggleRecipient = (phone: string, type: string) => {
    const exists = selectedRecipients.some(r => r.phone === phone);
    if (exists) {
      setSelectedRecipients(selectedRecipients.filter(r => r.phone !== phone));
    } else {
      setSelectedRecipients([...selectedRecipients, { phone, type }]);
    }
  };

  const getStudentReport = (studentId: string) => {
    return reports.find(r => r.studentId === studentId);
  };

  if (!user || user.role < UserRole.TEACHER) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">접근 권한이 없습니다.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 h-full overflow-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">학생 월간 보고서</h1>
            <p className="text-muted-foreground">AI로 학생별 월간 학습 보고서를 생성하고 학부모에게 발송합니다</p>
          </div>
          <ManualButton menuKey="student-reports" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setSelectedDate(subMonths(selectedDate, 1))}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-3 py-2 font-medium min-w-[120px] text-center">
              {format(selectedDate, "yyyy년 M월", { locale: ko })}
            </div>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={() => refetchReports()}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="학생 이름 또는 학교로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-student"
        />
      </div>

      {/* Teacher Filter (Admin only) */}
      {isAdmin && teachers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">담당 선생님:</span>
          <div className="flex flex-wrap gap-1">
            <Button
              variant={selectedTeacherId === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => { setSelectedTeacherId("all"); setSelectedClassTab("all"); }}
              data-testid="tab-teacher-all"
            >
              전체
            </Button>
            {teachers.sort((a, b) => a.name.localeCompare(b.name, 'ko')).map(teacher => (
              <Button
                key={teacher.id}
                variant={selectedTeacherId === teacher.id ? "default" : "outline"}
                size="sm"
                onClick={() => { setSelectedTeacherId(teacher.id); setSelectedClassTab("all"); }}
                data-testid={`tab-teacher-${teacher.id}`}
              >
                {teacher.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Grade Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">학년:</span>
        <div className="flex flex-wrap gap-1">
          <Button
            variant={selectedGradeTab === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedGradeTab("all")}
            data-testid="tab-grade-all"
          >
            전체
          </Button>
          {availableGrades.map(grade => (
            <Button
              key={grade}
              variant={selectedGradeTab === grade ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedGradeTab(grade)}
              data-testid={`tab-grade-${grade}`}
            >
              {grade}
            </Button>
          ))}
        </div>
        <Badge variant="secondary" className="text-sm ml-2">
          {sortedStudents.length}명
        </Badge>
      </div>

      {/* Teacher Class Tabs (Teacher only) */}
      {isTeacher && hasAssistantClasses && (
        <TeacherClassTabs
          teacherViewTab={teacherViewTab}
          onTabChange={(tab) => { setTeacherViewTab(tab); setSelectedClassTab("all"); }}
          ownCount={teacherOwnClasses.length}
          assistantCount={teacherAssistantClasses.length}
        />
      )}

      {/* Class Filter */}
      {availableClasses.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">수업:</span>
          <div className="flex flex-wrap gap-1">
            <Button
              variant={selectedClassTab === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedClassTab("all")}
              data-testid="tab-class-all"
            >
              전체
            </Button>
            {availableClasses.map(c => (
              <Button
                key={c.id}
                variant={selectedClassTab === c.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedClassTab(c.id)}
                data-testid={`tab-class-${c.id}`}
              >
                {c.name}{c.subject ? ` ${c.subject}반` : ""}
              </Button>
            ))}
          </div>
        </div>
      )}

      {(reportsLoading || usersLoading) ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : centerStudents.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">이 센터에 등록된 학생이 없습니다.</p>
          </CardContent>
        </Card>
      ) : sortedStudents.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">검색 결과가 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedStudents.map(student => {
                  const report = getStudentReport(student.id);
                  const hasMotherPhone = !!student.motherPhone;
                  const hasFatherPhone = !!student.fatherPhone;
                  
                  return (
                    <Card key={student.id} data-testid={`card-student-${student.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-base">{student.name}</CardTitle>
                          {report?.smsStatus === "sent" && (
                            <Badge
                              className="text-xs bg-green-500 text-white dark:bg-green-600 cursor-pointer hover:opacity-80"
                              onClick={(e) => { e.stopPropagation(); setSmsHistoryReport({ ...report, student }); }}
                              data-testid={`badge-sms-sent-${student.id}`}
                            >발송완료</Badge>
                          )}
                          {report?.smsStatus === "partial" && (
                            <Badge
                              variant="outline"
                              className="text-xs border-yellow-500 text-yellow-600 dark:text-yellow-400 cursor-pointer hover:opacity-80"
                              onClick={(e) => { e.stopPropagation(); setSmsHistoryReport({ ...report, student }); }}
                              data-testid={`badge-sms-partial-${student.id}`}
                            >일부발송</Badge>
                          )}
                          {report?.smsStatus === "failed" && (
                            <Badge
                              variant="destructive"
                              className="text-xs cursor-pointer hover:opacity-80"
                              onClick={(e) => { e.stopPropagation(); setSmsHistoryReport({ ...report, student }); }}
                              data-testid={`badge-sms-failed-${student.id}`}
                            >발송실패</Badge>
                          )}
                        </div>
                        <CardDescription>
                          {student.school && `${student.school}`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {report ? (
                          <>
                            {(() => {
                              const attendance = parseAttendanceSummary(report.attendanceSummary);
                              const homework = parseHomeworkSummary(report.homeworkSummary);
                              const assessments = parseAssessmentSummary(report.assessmentSummary);
                              const examResults = parseExamResultsSummary((report as any).examResultsSummary);
                              
                              return (
                                <>
                                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                  <div className="p-2 rounded-md bg-muted/50">
                                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                                      <Clock className="h-3 w-3" />
                                      <span>출석률</span>
                                    </div>
                                    <div className="font-semibold">
                                      {attendance ? `${attendance.attendanceRate}%` : "-"}
                                    </div>
                                    {attendance && attendance.lateDays > 0 && (
                                      <div className="text-muted-foreground text-[10px]">
                                        지각 {attendance.lateDays}회
                                      </div>
                                    )}
                                  </div>
                                  <div className="p-2 rounded-md bg-muted/50">
                                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                                      <BookOpen className="h-3 w-3" />
                                      <span>숙제</span>
                                    </div>
                                    <div className="font-semibold">
                                      {homework ? `${homework.completionRate}%` : "-"}
                                    </div>
                                    {homework && homework.totalAssigned > 0 && (
                                      <div className="text-muted-foreground text-[10px]">
                                        {homework.completed}/{homework.totalAssigned}
                                      </div>
                                    )}
                                  </div>
                                  <div className="p-2 rounded-md bg-muted/50">
                                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                                      <ClipboardCheck className="h-3 w-3" />
                                      <span>주간평가</span>
                                    </div>
                                    <div className="font-semibold">
                                      {assessments && assessments.length > 0 
                                        ? `${Math.round(assessments.reduce((sum, a) => sum + a.averageScore, 0) / assessments.length)}점`
                                        : "-"}
                                    </div>
                                    {assessments && assessments.length > 0 && (
                                      <div className="text-muted-foreground text-[10px]">
                                        {assessments.length}개 과목
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {examResults && examResults.length > 0 && (
                                  <div className="mt-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950/30 text-xs">
                                    <div className="flex items-center gap-1 text-muted-foreground mb-1">
                                      <ClipboardCheck className="h-3 w-3" />
                                      <span className="font-medium">평가관리 시험</span>
                                      <span className="text-[10px]">({examResults.length}건)</span>
                                    </div>
                                    <div className="space-y-1">
                                      {examResults.slice(0, 3).map((e, i) => (
                                        <div key={i} className="flex justify-between items-center">
                                          <span className="truncate mr-2">{e.examName}</span>
                                          <span className="font-semibold whitespace-nowrap">
                                            {e.score !== null && e.score !== undefined ? `${e.score}/${e.maxScore}` : "미채점"}
                                            {e.rank && e.totalParticipants && ` (${e.rank}/${e.totalParticipants}등)`}
                                          </span>
                                        </div>
                                      ))}
                                      {examResults.length > 3 && (
                                        <div className="text-muted-foreground text-[10px]">외 {examResults.length - 3}건</div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                </>
                              );
                            })()}
                            <div className="text-sm text-muted-foreground line-clamp-3 pt-1 border-t">
                              {report.reportContent}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditReport(report)}
                                data-testid={`button-edit-${student.id}`}
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                수정
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenSmsDialog(report)}
                                disabled={!hasMotherPhone && !hasFatherPhone}
                                data-testid={`button-send-${student.id}`}
                              >
                                <Send className="h-4 w-4 mr-1" />
                                발송
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteReportMutation.mutate(report.id)}
                                data-testid={`button-delete-${student.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleOpenGenerateDialog(student.id)}
                            disabled={generateReportMutation.isPending}
                            data-testid={`button-generate-${student.id}`}
                          >
                            {generateReportMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4 mr-1" />
                            )}
                            보고서 생성
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
          </div>
        </div>
      )}

      <Dialog open={!!editingReport} onOpenChange={() => setEditingReport(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingReport?.student?.name} - {format(selectedDate, "yyyy년 M월", { locale: ko })} 보고서
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>보고서 내용</Label>
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                rows={8}
                className="mt-2"
                data-testid="textarea-report-content"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {editedContent.length}자
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleRefineReport}
              disabled={refineReportMutation.isPending}
              data-testid="button-refine"
            >
              {refineReportMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              다듬기
            </Button>
            <Button
              onClick={handleSaveReport}
              disabled={updateReportMutation.isPending}
              data-testid="button-save"
            >
              {updateReportMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSmsDialog} onOpenChange={setShowSmsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>문자 발송</DialogTitle>
          </DialogHeader>
          {smsReport && smsReport.student && (
            <div className="space-y-4">
              <div>
                <Label>받는 사람</Label>
                <div className="mt-2 space-y-2">
                  {smsReport.student.motherPhone && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="mother"
                        checked={selectedRecipients.some(r => r.phone === smsReport.student?.motherPhone)}
                        onCheckedChange={() => toggleRecipient(smsReport.student!.motherPhone!, "mother")}
                        data-testid="checkbox-mother"
                      />
                      <label htmlFor="mother" className="text-sm">
                        어머니 ({smsReport.student.motherPhone})
                      </label>
                    </div>
                  )}
                  {smsReport.student.fatherPhone && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="father"
                        checked={selectedRecipients.some(r => r.phone === smsReport.student?.fatherPhone)}
                        onCheckedChange={() => toggleRecipient(smsReport.student!.fatherPhone!, "father")}
                        data-testid="checkbox-father"
                      />
                      <label htmlFor="father" className="text-sm">
                        아버지 ({smsReport.student.fatherPhone})
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/50">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="include-stats" className="text-sm cursor-pointer">
                    출석률/숙제/평가 통계 포함
                  </Label>
                </div>
                <Switch
                  id="include-stats"
                  checked={includeStats}
                  onCheckedChange={setIncludeStats}
                  data-testid="switch-include-stats"
                />
              </div>

              <div>
                <Label>문자 내용 미리보기</Label>
                <div className="mt-2 p-3 bg-muted rounded-md text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {(() => {
                    const student = smsReport.student;
                    let preview = `[학원] ${smsReport.year}년 ${smsReport.month}월 ${student?.name} 학생 보고서\n\n`;
                    if (includeStats) {
                      const attendance = parseAttendanceSummary(smsReport.attendanceSummary);
                      const homework = parseHomeworkSummary(smsReport.homeworkSummary);
                      const assessments = parseAssessmentSummary(smsReport.assessmentSummary);
                      const examResults = parseExamResultsSummary((smsReport as any).examResultsSummary);
                      if (attendance) preview += `출석률: ${attendance.attendanceRate}%\n`;
                      if (homework) preview += `숙제 완료율: ${homework.completionRate}%\n`;
                      if (assessments && assessments.length > 0) {
                        const avgScore = Math.round(assessments.reduce((sum, a) => sum + a.averageScore, 0) / assessments.length);
                        preview += `주간평가 평균: ${avgScore}점\n`;
                      }
                      if (examResults && examResults.length > 0) {
                        const scored = examResults.filter(e => e.score !== null && e.score !== undefined);
                        if (scored.length > 0) {
                          const avgPct = Math.round(scored.reduce((sum, e) => sum + (e.score! / e.maxScore) * 100, 0) / scored.length);
                          preview += `평가관리 평균: ${avgPct}점 (${scored.length}건)\n`;
                        }
                      }
                      preview += "\n";
                    }
                    preview += smsReport.reportContent;
                    return preview;
                  })()}
                </div>
                {(() => {
                    const student = smsReport.student;
                    let fullText = `[학원] ${smsReport.year}년 ${smsReport.month}월 ${student?.name} 학생 보고서\n\n`;
                    if (includeStats) {
                      const attendance = parseAttendanceSummary(smsReport.attendanceSummary);
                      const homework = parseHomeworkSummary(smsReport.homeworkSummary);
                      const assessments = parseAssessmentSummary(smsReport.assessmentSummary);
                      const examResults = parseExamResultsSummary((smsReport as any).examResultsSummary);
                      if (attendance) fullText += `출석률: ${attendance.attendanceRate}%\n`;
                      if (homework) fullText += `숙제 완료율: ${homework.completionRate}%\n`;
                      if (assessments && assessments.length > 0) {
                        const avgScore = Math.round(assessments.reduce((sum, a) => sum + a.averageScore, 0) / assessments.length);
                        fullText += `주간평가 평균: ${avgScore}점\n`;
                      }
                      if (examResults && examResults.length > 0) {
                        const scored = examResults.filter(e => e.score !== null && e.score !== undefined);
                        if (scored.length > 0) {
                          const avgPct = Math.round(scored.reduce((sum, e) => sum + (e.score! / e.maxScore) * 100, 0) / scored.length);
                          fullText += `평가관리 평균: ${avgPct}점 (${scored.length}건)\n`;
                        }
                      }
                      fullText += "\n";
                    }
                    fullText += smsReport.reportContent;
                    const byteSize = new Blob([fullText]).size;
                    return (
                      <div className="text-xs mt-1 space-y-0.5">
                        <div className="text-right">
                          <span className="text-muted-foreground">{fullText.length}자 ({byteSize}바이트)</span>
                          {byteSize > 90 && byteSize <= 2000 && (
                            <span className="text-blue-500 ml-2">LMS</span>
                          )}
                        </div>
                        {byteSize > 2000 && (
                          <div className="text-destructive text-right">2000바이트 초과 - 발송 시 내용이 자동으로 잘립니다</div>
                        )}
                      </div>
                    );
                  })()}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSmsDialog(false)}>
              취소
            </Button>
            <Button
              onClick={handleSendSms}
              disabled={sendSmsMutation.isPending || selectedRecipients.length === 0}
              data-testid="button-confirm-send"
            >
              {sendSmsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              발송하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>보고서 생성</DialogTitle>
            <DialogDescription>
              AI가 학생 데이터를 분석하여 월간 보고서를 생성합니다
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>학생</Label>
              <p className="text-sm font-medium mt-1">
                {centerStudents.find(s => s.id === generateStudentId)?.name}
              </p>
            </div>
            <div>
              <Label htmlFor="custom-instructions">AI에게 추가 요청사항 (선택)</Label>
              <Textarea
                id="custom-instructions"
                value={customInstructions}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    setCustomInstructions(e.target.value);
                  }
                }}
                placeholder="예: 수학 실력 향상에 대해 더 강조해 주세요, 다음 달 목표도 포함해 주세요"
                rows={4}
                className="mt-2"
                data-testid="textarea-custom-instructions"
              />
              <p className="text-xs text-muted-foreground mt-1">
                AI가 보고서를 작성할 때 참고할 추가 지침을 입력하세요 ({customInstructions.length}/500자)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              취소
            </Button>
            <Button
              onClick={handleGenerateReport}
              disabled={generateReportMutation.isPending}
              data-testid="button-confirm-generate"
            >
              {generateReportMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              보고서 생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!smsHistoryReport} onOpenChange={() => setSmsHistoryReport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>발송 내역</DialogTitle>
            <DialogDescription>
              {smsHistoryReport?.student?.name} - {year}년 {month}월 월간보고서
            </DialogDescription>
          </DialogHeader>
          {smsHistoryReport && (() => {
            let recipients: { phone: string; type: string; success: boolean; error?: string }[] = [];
            try {
              recipients = JSON.parse(smsHistoryReport.smsRecipients || "[]");
            } catch {}
            const successCount = recipients.filter(r => r.success).length;
            const failCount = recipients.filter(r => !r.success).length;
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="text-sm">
                    발송 시각: <span className="font-medium">{smsHistoryReport.smsSentAt ? format(new Date(smsHistoryReport.smsSentAt), "yyyy-MM-dd HH:mm", { locale: ko }) : "-"}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {successCount > 0 && (
                    <Badge className="bg-green-500 text-white dark:bg-green-600">성공 {successCount}건</Badge>
                  )}
                  {failCount > 0 && (
                    <Badge variant="destructive">실패 {failCount}건</Badge>
                  )}
                </div>
                <div className="space-y-2">
                  {recipients.map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{r.type === "mother" ? "어머니" : r.type === "father" ? "아버지" : r.type === "student" ? "학생" : r.type}</span>
                        <span className="text-muted-foreground">{r.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.success ? (
                          <Badge className="text-xs bg-green-500 text-white dark:bg-green-600">성공</Badge>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Badge variant="destructive" className="text-xs">실패</Badge>
                            {r.error && (
                              <span className="text-xs text-destructive max-w-[150px] truncate" title={r.error}>{r.error}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {recipients.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">발송 내역이 없습니다</p>
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSmsHistoryReport(null)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
