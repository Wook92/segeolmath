import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { ManualButton } from "@/components/manual-button";
import { useAuth } from "@/lib/auth-context";
import { TeacherClassTabs } from "@/components/teacher-class-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  type User,
  type Class,
  type AttendanceRecord,
  UserRole,
  isAssistantTeacher,
} from "@shared/schema";
import {
  Clock,
  Users,
  CalendarDays,
  Loader2,
  UserCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Settings,
  MessageSquare,
  GraduationCap,
  KeyRound,
  History,
  Send,
  XCircle,
  Search,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { Link } from "wouter";
import { formatKoreanTime } from "@/lib/utils";

type NotificationLogInfo = { sentAt: string; status: string; messageType?: string; messageContent?: string };
type StudentWithAttendance = User & { 
  attendanceRecord: AttendanceRecord | null;
  notificationLogs: NotificationLogInfo[];
};

const GRADE_ORDER = ["초1","초2","초3","초4","초5","초6","중1","중2","중3","고1","고2","고3","성인"];

function StudentAttendanceList({
  students,
  isLoading,
  isToday,
  title,
  description,
  onRefetch,
  onUpdateStatus,
  onCancelAttendance,
  onSendSms,
  isUpdating,
  isCancelling,
  isSending,
  showGrade,
}: {
  students: StudentWithAttendance[];
  isLoading: boolean;
  isToday: boolean;
  title: string;
  description: string;
  onRefetch: () => void;
  onUpdateStatus: (studentId: string, status: string) => void;
  onCancelAttendance: (recordId: string) => void;
  onSendSms: (studentId: string, type: "check_in" | "late" | "check_out") => void;
  isUpdating: boolean;
  isCancelling: boolean;
  isSending: boolean;
  showGrade: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefetch}
          data-testid="button-refresh-students"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            학생이 없습니다
          </div>
        ) : (
          <div className="space-y-2">
            {students.map((student) => {
              const status = student.attendanceRecord?.attendanceStatus || "pending";
              return (
                <div
                  key={student.id}
                  className="flex flex-col gap-2 p-3 rounded-md bg-muted/50"
                  data-testid={`row-student-${student.id}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-medium">{student.name}</span>
                      {showGrade && student.grade && (
                        <Badge variant="outline" className="text-xs">{student.grade}</Badge>
                      )}
                      {status === "present" && (
                        <Badge variant="secondary" className="bg-emerald-600 text-white dark:bg-emerald-700">
                          <UserCheck className="w-3 h-3 mr-1" />
                          등원
                        </Badge>
                      )}
                      {status === "late" && (
                        <Badge variant="secondary" className="bg-amber-600 text-white dark:bg-amber-700">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          지각
                        </Badge>
                      )}
                      {status === "absent" && (
                        <Badge variant="secondary" className="bg-red-600 text-white dark:bg-red-700">
                          <XCircle className="w-3 h-3 mr-1" />
                          결석
                        </Badge>
                      )}
                      {status === "pending" && (
                        <Badge variant="outline" className="text-muted-foreground">
                          미확인
                        </Badge>
                      )}
                      {student.attendanceRecord && status !== "pending" && (
                        <button
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          onClick={() => {
                            const statusLabel = status === "late" ? "지각" : status === "absent" ? "결석" : "등원";
                            if (window.confirm(`${statusLabel} 기록을 취소하시겠습니까?`)) {
                              onCancelAttendance(student.attendanceRecord!.id);
                            }
                          }}
                          disabled={isCancelling}
                          data-testid={`button-cancel-attendance-${student.id}`}
                          title="출결 취소"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      {student.notificationLogs && student.notificationLogs.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          {student.notificationLogs.map((log, i) => {
                            const typeLabel = log.messageType === "check_out" ? "하원" 
                              : log.messageType === "late" ? "지각" 
                              : log.messageType === "attendance_checkin" ? "등원" 
                              : "문자";
                            const typeColor = log.messageType === "check_out" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                              : log.messageType === "late" ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300";
                            const isFailed = log.status === "failed";
                            return (
                              <Badge 
                                key={i} 
                                variant="secondary" 
                                className={`text-[10px] h-4 px-1.5 gap-0.5 cursor-help ${isFailed ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : typeColor}`}
                                data-testid={`badge-sms-log-${student.id}-${i}`}
                                title={log.messageContent || "문자 내용 없음"}
                              >
                                <MessageSquare className="w-2.5 h-2.5" />
                                {typeLabel} {formatKoreanTime(log.sentAt)}
                                {isFailed && " 실패"}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {student.attendanceRecord && (
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {status === "absent" ? "결석" : status === "late" ? `지각: ${formatKoreanTime(student.attendanceRecord.checkInAt)}` : `등원: ${formatKoreanTime(student.attendanceRecord.checkInAt)}`}
                        </span>
                        {status !== "absent" && student.attendanceRecord.checkOutAt && (
                          <span>하원: {formatKoreanTime(student.attendanceRecord.checkOutAt)}</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5 mt-2">
                      <Button
                        size="sm"
                        variant={status === "present" ? "default" : "outline"}
                        onClick={() => onUpdateStatus(student.id, "present")}
                        disabled={isUpdating}
                        data-testid={`button-status-present-${student.id}`}
                      >
                        등원
                      </Button>
                      <Button
                        size="sm"
                        variant={status === "late" ? "default" : "outline"}
                        onClick={() => onUpdateStatus(student.id, "late")}
                        disabled={isUpdating}
                        data-testid={`button-status-late-${student.id}`}
                      >
                        지각
                      </Button>
                      <Button
                        size="sm"
                        variant={status === "absent" ? "default" : "outline"}
                        onClick={() => onUpdateStatus(student.id, "absent")}
                        disabled={isUpdating}
                        data-testid={`button-status-absent-${student.id}`}
                      >
                        결석
                      </Button>
                      <div className="w-px bg-border mx-1" />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSendSms(student.id, "check_in")}
                        disabled={isSending}
                        data-testid={`button-sms-checkin-${student.id}`}
                      >
                        <Send className="w-3 h-3 mr-1" />
                        등원 알림
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSendSms(student.id, "late")}
                        disabled={isSending}
                        data-testid={`button-sms-late-${student.id}`}
                      >
                        <Send className="w-3 h-3 mr-1" />
                        지각 알림
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSendSms(student.id, "check_out")}
                        disabled={isSending}
                        data-testid={`button-sms-checkout-${student.id}`}
                      >
                        <Send className="w-3 h-3 mr-1" />
                        하원 알림
                      </Button>
                    </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AutoLateNotificationSettings({ centerId }: { centerId: string }) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [minutes, setMinutes] = useState(10);
  const [template, setTemplate] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  const { data: settings, isLoading } = useQuery<{ enabled: boolean; minutes: number; template: string }>({
    queryKey: ["/api/centers", centerId, "auto-late-settings"],
    queryFn: async () => {
      const res = await fetch(`/api/centers/${centerId}/auto-late-settings`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!centerId,
  });

  useEffect(() => {
    if (settings && !isLoaded) {
      setEnabled(settings.enabled);
      setMinutes(settings.minutes);
      setTemplate(settings.template);
      setIsLoaded(true);
    }
  }, [settings, isLoaded]);

  useEffect(() => {
    setIsLoaded(false);
  }, [centerId]);

  const saveMutation = useMutation({
    mutationFn: async (data: { enabled: boolean; minutes: number; template: string }) => {
      const res = await apiRequest("PUT", `/api/centers/${centerId}/auto-late-settings`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "자동 지각 알림 설정이 저장되었습니다" });
      invalidateQueriesStartingWith("/api/centers");
    },
    onError: () => {
      toast({ title: "설정 저장에 실패했습니다", variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({ enabled, minutes, template });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          자동 지각 알림
        </CardTitle>
        <CardDescription>
          수업 시작 후 일정 시간이 지나도 등원하지 않은 학생의 학부모에게 자동으로 알림 문자를 보냅니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">자동 지각 알림 활성화</p>
            <p className="text-xs text-muted-foreground">활성화하면 미등원 학생에게 자동으로 문자가 전송됩니다</p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => {
              setEnabled(checked);
              saveMutation.mutate({ enabled: checked, minutes, template });
            }}
            data-testid="switch-toggle-auto-late"
          />
        </div>

        {enabled && (
          <div className="space-y-2">
            <label className="text-sm font-medium">알림 시간 (수업 시작 후)</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={60}
                value={minutes}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(60, parseInt(e.target.value) || 10));
                  setMinutes(val);
                }}
                onBlur={() => {
                  saveMutation.mutate({ enabled, minutes, template });
                }}
                className="w-20"
                data-testid="input-auto-late-minutes"
              />
              <span className="text-sm text-muted-foreground">분 후 미등원 시 알림 전송</span>
            </div>
          </div>
        )}

        {saveMutation.isPending && (
          <p className="text-xs text-muted-foreground">저장 중...</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AttendancePage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  });
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("attendance");
  const [attendanceMode, setAttendanceMode] = useState<"class" | "all">("class");
  const [allStudentSearch, setAllStudentSearch] = useState("");
  const [allStudentGradeFilter, setAllStudentGradeFilter] = useState<string | null>(null);
  const [teacherViewTab, setTeacherViewTab] = useState<"my" | "assistant">("my");

  const isTeacher = user?.role === UserRole.TEACHER;
  const isTeacherOnly = user?.role === UserRole.TEACHER;
  const isPrincipalOrAdmin = user?.role && user.role >= UserRole.PRINCIPAL;

  // Get all center users (for principal/admin OR for all-student mode)
  const { data: allCenterUsers = [], isLoading: teachersLoading } = useQuery<User[]>({
    queryKey: [`/api/users?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id,
  });
  
  // Filter to show teachers and principals (role 2 and 3)
  const teachers = allCenterUsers.filter(u => u.role === UserRole.TEACHER || u.role === UserRole.PRINCIPAL);

  // Get classes for selected teacher (or current user if teacher)
  const teacherIdForClasses = isTeacher ? user?.id : selectedTeacherId;
  const { data: classes = [], isLoading: classesLoading } = useQuery<Class[]>({
    queryKey: [`/api/teachers/${teacherIdForClasses}/classes?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id && !!teacherIdForClasses,
  });

  const ownClasses = useMemo(() => classes.filter(c => c.teacherId === teacherIdForClasses), [classes, teacherIdForClasses]);
  const assistantClasses = useMemo(() => classes.filter(c => isAssistantTeacher(c, teacherIdForClasses) && c.teacherId !== teacherIdForClasses), [classes, teacherIdForClasses]);
  const hasAssistantClasses = assistantClasses.length > 0;
  const displayClasses = isTeacherOnly && hasAssistantClasses
    ? (teacherViewTab === "assistant" ? assistantClasses : ownClasses)
    : classes;

  const handleTeacherViewTabChange = useCallback((tab: "my" | "assistant") => {
    setTeacherViewTab(tab);
    setSelectedClassId(null);
  }, []);

  // Get students with attendance for selected class
  const { data: studentsWithAttendance = [], isLoading: studentsLoading, refetch: refetchStudents } = useQuery<StudentWithAttendance[]>({
    queryKey: [`/api/classes/${selectedClassId}/attendance?date=${selectedDate}`],
    enabled: !!selectedClassId && attendanceMode === "class",
  });

  // Get all students with attendance for "all students" mode
  const { data: allStudentsWithAttendance = [], isLoading: allStudentsLoading, refetch: refetchAllStudents } = useQuery<StudentWithAttendance[]>({
    queryKey: ["/api/attendance/all-students", selectedCenter?.id, selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/attendance/all-students?centerId=${selectedCenter?.id}&date=${selectedDate}`);
      if (!res.ok) throw new Error("Failed to fetch all students attendance");
      return res.json();
    },
    enabled: !!selectedCenter?.id && attendanceMode === "all",
  });

  const availableGrades = useMemo(() => {
    const grades = new Set<string>();
    allStudentsWithAttendance.forEach(s => {
      if (s.grade) grades.add(s.grade);
    });
    return GRADE_ORDER.filter(g => grades.has(g));
  }, [allStudentsWithAttendance]);

  const filteredAllStudents = useMemo(() => {
    let list = allStudentsWithAttendance;
    if (allStudentGradeFilter) {
      list = list.filter(s => s.grade === allStudentGradeFilter);
    }
    if (allStudentSearch.trim()) {
      const q = allStudentSearch.trim().toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.school?.toLowerCase().includes(q));
    }
    return list.sort((a, b) => {
      const ai = GRADE_ORDER.indexOf(a.grade || "");
      const bi = GRADE_ORDER.indexOf(b.grade || "");
      if (ai !== bi) return ai - bi;
      return a.name.localeCompare(b.name, "ko");
    });
  }, [allStudentsWithAttendance, allStudentGradeFilter, allStudentSearch]);

  const refetchCurrentStudents = () => {
    if (attendanceMode === "all") {
      refetchAllStudents();
    } else {
      refetchStudents();
    }
  };

  // Update attendance status mutation (without SMS)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ studentId, status }: { studentId: string; status: string }) => {
      const res = await apiRequest("PATCH", "/api/attendance/update-status", {
        studentId,
        centerId: selectedCenter?.id,
        classId: attendanceMode === "class" ? selectedClassId : undefined,
        status,
        date: selectedDate,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: () => {
      refetchCurrentStudents();
      invalidateQueriesStartingWith("/api/attendance");
      invalidateQueriesStartingWith("/api/classes");
      toast({ title: "출결 상태가 변경되었습니다" });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const cancelAttendanceMutation = useMutation({
    mutationFn: async (recordId: string) => {
      const res = await apiRequest("DELETE", `/api/attendance-records/${recordId}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: () => {
      refetchCurrentStudents();
      invalidateQueriesStartingWith("/api/attendance");
      invalidateQueriesStartingWith("/api/classes");
      toast({ title: "등원이 취소되었습니다" });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  // Send SMS notification mutation (separate from status)
  const sendSmsMutation = useMutation({
    mutationFn: async ({ studentId, type }: { studentId: string; type: "check_in" | "late" | "check_out" }) => {
      const res = await apiRequest("POST", "/api/attendance/send-sms", {
        studentId,
        centerId: selectedCenter?.id,
        classId: attendanceMode === "class" ? selectedClassId : undefined,
        type,
        date: selectedDate,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: () => {
      refetchCurrentStudents();
      toast({ title: "문자가 발송되었습니다" });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  // Manual check-in mutation (kept for attendance pad integration)
  const checkInMutation = useMutation({
    mutationFn: async ({ studentId, isLate }: { studentId: string; isLate: boolean }) => {
      const res = await apiRequest("POST", "/api/attendance/manual-checkin", {
        studentId,
        centerId: selectedCenter?.id,
        classId: attendanceMode === "class" ? selectedClassId : undefined,
        isLate,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: () => {
      refetchCurrentStudents();
      toast({ title: "출석 체크 완료" });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  // Auto-generate PINs mutation
  const generatePinsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/attendance-pins/auto-generate", {
        centerId: selectedCenter?.id,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to generate PINs");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const orphanMsg = data.orphansRemoved > 0
        ? ` · 사용 중지된 출결번호 ${data.orphansRemoved}건 정리됨`
        : "";
      // Build a detailed description: total students seen, created, skipped (with reasons summary)
      const totalMsg = typeof data.totalStudents === "number" ? `대상 학생 ${data.totalStudents}명 중 ` : "";
      let descParts: string[] = [];
      if (data.skipped > 0 && Array.isArray(data.details?.skipped)) {
        const reasonCounts: Record<string, number> = {};
        for (const s of data.details.skipped) {
          reasonCounts[s.reason] = (reasonCounts[s.reason] || 0) + 1;
        }
        descParts = Object.entries(reasonCounts).map(([r, c]) => `${r}: ${c}명`);
      }
      const description = descParts.length > 0
        ? `미생성 ${data.skipped}명 — ${descParts.join(", ")}${orphanMsg ? "\n" + orphanMsg.replace(/^ · /, "") : ""}`
        : (orphanMsg ? orphanMsg.replace(/^ · /, "") : undefined);
      toast({
        title: `${totalMsg}${data.created}명의 출결번호가 생성되었습니다`,
        description,
      });
      console.log("[AUTO-GEN-PIN] response", data);
      invalidateQueriesStartingWith("/api/attendance");
    },
    onError: (error: Error) => {
      toast({ title: error.message || "출결번호 생성에 실패했습니다", variant: "destructive" });
    },
  });

  const handlePrevDay = () => {
    const prev = subDays(new Date(selectedDate + "T00:00:00"), 1);
    setSelectedDate(prev.toLocaleDateString("sv-SE"));
  };

  const handleNextDay = () => {
    const next = addDays(new Date(selectedDate + "T00:00:00"), 1);
    setSelectedDate(next.toLocaleDateString("sv-SE"));
  };

  const handleToday = () => {
    setSelectedDate(new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }));
  };

  const handleSelectTeacher = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    setSelectedClassId(null);
  };

  if (!user || user.role < UserRole.TEACHER) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">접근 권한이 없습니다</p>
      </div>
    );
  }

  const isToday = selectedDate === new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" data-testid="text-page-title">출결 관리</h1>
            <ManualButton menuKey="attendance" />
          </div>
          {(user?.role === UserRole.ADMIN || user?.role === UserRole.PRINCIPAL || user?.role === UserRole.KIOSK) && (
            <div className="flex items-center gap-2">
              <Link href="/attendance-pad" target="_blank">
                <Button variant="outline" size="sm" data-testid="link-attendance-pad">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  출결 패드
                </Button>
              </Link>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="attendance" data-testid="tab-attendance">
              <UserCheck className="w-4 h-4 mr-2" />
              출석 체크
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <History className="w-4 h-4 mr-2" />
              출결 기록
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Settings className="w-4 h-4 mr-2" />
              설정
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attendance" className="space-y-4">
            {/* Mode toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant={attendanceMode === "class" ? "default" : "outline"}
                size="sm"
                onClick={() => { setAttendanceMode("class"); setAllStudentSearch(""); setAllStudentGradeFilter(null); }}
                data-testid="button-mode-class"
              >
                수업별 출결
              </Button>
              <Button
                variant={attendanceMode === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => { setAttendanceMode("all"); setSelectedClassId(null); }}
                data-testid="button-mode-all"
              >
                <Users className="w-4 h-4 mr-1" />
                전체 학생 출결
              </Button>
            </div>

            {/* Date selector */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={handlePrevDay} data-testid="button-prev-day">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-md">
                      <CalendarDays className="w-4 h-4" />
                      <span className="font-medium">
                        {format(new Date(selectedDate), "yyyy년 M월 d일 (EEE)", { locale: ko })}
                      </span>
                    </div>
                    <Button variant="outline" size="icon" onClick={handleNextDay} data-testid="button-next-day">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    {!isToday && (
                      <Button variant="ghost" size="sm" onClick={handleToday} data-testid="button-today">
                        오늘
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {attendanceMode === "class" && (
              <>
                {/* Teacher selection for principal/admin */}
                {isPrincipalOrAdmin && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <GraduationCap className="w-5 h-5" />
                        선생님 선택
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {teachersLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      ) : (teachers as User[]).length === 0 ? (
                        <p className="text-muted-foreground text-sm">등록된 선생님이 없습니다</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(teachers as User[]).map((teacher: User) => (
                            <Button
                              key={teacher.id}
                              variant={selectedTeacherId === teacher.id ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleSelectTeacher(teacher.id)}
                              data-testid={`button-teacher-${teacher.id}`}
                            >
                              {teacher.name}
                            </Button>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Classes list */}
                {(isTeacher || selectedTeacherId) && (
                  <>
                    {isPrincipalOrAdmin && selectedTeacher && (
                      <div className="text-sm text-muted-foreground">
                        {selectedTeacher.name} 선생님의 수업
                      </div>
                    )}
                    {isTeacherOnly && (
                      <TeacherClassTabs
                        teacherViewTab={teacherViewTab}
                        onTabChange={handleTeacherViewTabChange}
                        ownCount={ownClasses.length}
                        assistantCount={assistantClasses.length}
                      />
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {classesLoading ? (
                        <div className="col-span-full flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      ) : displayClasses.length === 0 ? (
                        <div className="col-span-full text-center py-8 text-muted-foreground">
                          등록된 수업이 없습니다
                        </div>
                      ) : (
                        displayClasses.map((cls) => (
                          <Card
                            key={cls.id}
                            className={`cursor-pointer transition-colors ${selectedClassId === cls.id ? "ring-2 ring-primary" : ""}`}
                            onClick={() => setSelectedClassId(cls.id)}
                            data-testid={`card-class-${cls.id}`}
                          >
                            <CardHeader className="pb-2">
                              <CardTitle className="text-lg">{cls.name} ({cls.subject})</CardTitle>
                              <CardDescription className="flex items-center gap-2 flex-wrap">
                                <Clock className="w-3 h-3" />
                                {cls.startTime} - {cls.endTime}
                                <span className="text-xs">
                                  ({cls.days.join(", ")})
                                </span>
                              </CardDescription>
                            </CardHeader>
                          </Card>
                        ))
                      )}
                    </div>
                  </>
                )}

                {/* Students list for selected class */}
                {selectedClassId && (
                  <StudentAttendanceList
                    students={studentsWithAttendance}
                    isLoading={studentsLoading}
                    isToday={isToday}
                    title="학생 목록"
                    description={(() => {
                      const cls = displayClasses.find((c) => c.id === selectedClassId);
                      return cls ? `${cls.name} (${cls.subject})` : "";
                    })()}
                    onRefetch={refetchStudents}
                    onUpdateStatus={(studentId, status) => updateStatusMutation.mutate({ studentId, status })}
                    onCancelAttendance={(recordId) => cancelAttendanceMutation.mutate(recordId)}
                    onSendSms={(studentId, type) => sendSmsMutation.mutate({ studentId, type })}
                    isUpdating={updateStatusMutation.isPending}
                    isCancelling={cancelAttendanceMutation.isPending}
                    isSending={sendSmsMutation.isPending}
                    showGrade={false}
                  />
                )}
              </>
            )}

            {attendanceMode === "all" && (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      전체 학생 출결
                    </CardTitle>
                    <CardDescription>
                      수업에 소속되지 않은 학생도 검색하여 출결할 수 있습니다 (보충 수업 등)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant={allStudentGradeFilter === null ? "default" : "outline"}
                        onClick={() => setAllStudentGradeFilter(null)}
                        data-testid="button-all-grade-filter-all"
                      >
                        전체 ({allStudentsWithAttendance.length})
                      </Button>
                      {availableGrades.map(grade => (
                        <Button
                          key={grade}
                          size="sm"
                          variant={allStudentGradeFilter === grade ? "default" : "outline"}
                          onClick={() => setAllStudentGradeFilter(allStudentGradeFilter === grade ? null : grade)}
                          data-testid={`button-all-grade-filter-${grade}`}
                        >
                          {grade} ({allStudentsWithAttendance.filter(s => s.grade === grade).length})
                        </Button>
                      ))}
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="학생 이름 또는 학교로 검색..."
                        value={allStudentSearch}
                        onChange={(e) => setAllStudentSearch(e.target.value)}
                        className="pl-9"
                        data-testid="input-all-student-search"
                      />
                    </div>
                  </CardContent>
                </Card>

                <StudentAttendanceList
                  students={filteredAllStudents}
                  isLoading={allStudentsLoading}
                  isToday={isToday}
                  title={`학생 목록 (${filteredAllStudents.length}명)`}
                  description={allStudentGradeFilter ? `${allStudentGradeFilter} 학생` : "전체 학생"}
                  onRefetch={refetchAllStudents}
                  onUpdateStatus={(studentId, status) => updateStatusMutation.mutate({ studentId, status })}
                  onCancelAttendance={(recordId) => cancelAttendanceMutation.mutate(recordId)}
                  onSendSms={(studentId, type) => sendSmsMutation.mutate({ studentId, type })}
                  isUpdating={updateStatusMutation.isPending}
                  isCancelling={cancelAttendanceMutation.isPending}
                  isSending={sendSmsMutation.isPending}
                  showGrade={true}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <AttendanceHistorySection centerId={selectedCenter?.id || ""} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            {/* Auto-generate PINs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">출결번호 자동 생성</CardTitle>
                <CardDescription>
                  학생 전화번호 뒷 4자리로 출결번호를 자동 생성합니다.
                  중복 시 가운데 4자리를 사용합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => generatePinsMutation.mutate()}
                  disabled={generatePinsMutation.isPending}
                  data-testid="button-generate-pins"
                >
                  {generatePinsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  출결번호 자동 생성
                </Button>
              </CardContent>
            </Card>

            {isPrincipalOrAdmin && selectedCenter?.id && (
              <AutoLateNotificationSettings centerId={selectedCenter.id} />
            )}

            {/* Message templates - moved to Settings > SMS tab */}
            {isPrincipalOrAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    알림 메시지 설정
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 p-4 bg-muted rounded-md">
                    <MessageSquare className="w-8 h-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">알림 메시지 설정이 이동되었습니다</p>
                      <p className="text-sm text-muted-foreground">
                        출결 알림, 선생님 출근 알림, SOLAPI 설정은 <Link href="/settings" className="underline font-medium">설정 &gt; 문자</Link> 탭에서 관리하세요.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

type Enrollment = { id: string; classId: string; studentId: string };
type ClassWithEnrollment = Class & { enrollment?: Enrollment };

function AttendanceHistorySection({ centerId }: { centerId: string }) {
  const [viewMode, setViewMode] = useState<"student" | "date">("student");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dateViewDate, setDateViewDate] = useState(new Date().toISOString().split("T")[0]);
  
  const { data: students = [], isLoading: studentsLoading } = useQuery<User[]>({
    queryKey: [`/api/users?centerId=${centerId}&role=1`],
    enabled: !!centerId,
  });

  type AttendanceRecordWithStudent = AttendanceRecord & { student?: User; class?: Class; notificationLogs?: NotificationLogInfo[] };
  
  const { data: dateViewRecords = [], isLoading: dateViewLoading } = useQuery<AttendanceRecordWithStudent[]>({
    queryKey: [`/api/attendance/by-date?centerId=${centerId}&date=${dateViewDate}`],
    enabled: !!centerId && viewMode === "date",
  });

  const studentsOnly = students.filter(s => s.role === 1);
  
  const filteredStudents = studentsOnly.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startDate = format(subMonths(startOfMonth(calendarMonth), 1), "yyyy-MM-dd");
  const endDate = format(endOfMonth(calendarMonth), "yyyy-MM-dd");

  type AttendanceRecordWithClass = AttendanceRecord & { class?: Class };
  
  const { data: attendanceHistory = [], isLoading: historyLoading } = useQuery<AttendanceRecordWithClass[]>({
    queryKey: [`/api/attendance/history/${selectedStudentId}?startDate=${startDate}&endDate=${endDate}`],
    enabled: !!selectedStudentId,
  });

  const { data: studentEnrollments = [] } = useQuery<ClassWithEnrollment[]>({
    queryKey: [`/api/students/${selectedStudentId}/classes`],
    enabled: !!selectedStudentId,
  });

  const filteredHistory = selectedClassFilter === "all" 
    ? attendanceHistory 
    : attendanceHistory.filter(r => r.classId === selectedClassFilter);

  const attendanceByDate = new Map<string, AttendanceRecordWithClass[]>();
  filteredHistory.forEach(record => {
    const dateKey = record.checkInDate;
    if (!attendanceByDate.has(dateKey)) {
      attendanceByDate.set(dateKey, []);
    }
    attendanceByDate.get(dateKey)!.push(record);
  });

  const getDateStatus = (dateStr: string): string | null => {
    const records = attendanceByDate.get(dateStr);
    if (!records || records.length === 0) return null;
    
    const hasAbsent = records.some(r => r.attendanceStatus === "absent");
    if (hasAbsent) return "absent";
    
    const hasLate = records.some(r => r.attendanceStatus === "late");
    if (hasLate) return "late";
    
    const hasPresent = records.some(r => r.attendanceStatus === "present");
    if (hasPresent) return "present";
    
    return "pending";
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "present":
        return "bg-blue-500 text-white hover:bg-blue-600";
      case "late":
        return "bg-orange-500 text-white hover:bg-orange-600";
      case "absent":
        return "bg-red-500 text-white hover:bg-red-600";
      default:
        return "";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return (
          <Badge variant="secondary" className="bg-blue-500 text-white">
            <UserCheck className="w-3 h-3 mr-1" />
            등원
          </Badge>
        );
      case "late":
        return (
          <Badge variant="secondary" className="bg-orange-500 text-white">
            <AlertTriangle className="w-3 h-3 mr-1" />
            지각
          </Badge>
        );
      case "absent":
        return (
          <Badge variant="secondary" className="bg-red-500 text-white">
            <XCircle className="w-3 h-3 mr-1" />
            결석
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            미확인
          </Badge>
        );
    }
  };

  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const startDayOfWeek = monthStart.getDay();
  const emptyDays = Array(startDayOfWeek).fill(null);

  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedDayRecords = selectedDateStr ? attendanceByDate.get(selectedDateStr) || [] : [];

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setSearchQuery("");
    setSelectedClassFilter("all");
    setSelectedDate(null);
  };

  const clearStudent = () => {
    setSelectedStudentId(null);
    setSelectedClassFilter("all");
    setSelectedDate(null);
  };

  const sortedDateViewRecords = [...dateViewRecords].sort((a, b) => {
    if (!a.checkInAt && !b.checkInAt) return 0;
    if (!a.checkInAt) return 1;
    if (!b.checkInAt) return -1;
    return new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime();
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="w-5 h-5" />
                출결 기록 조회
              </CardTitle>
              <CardDescription>
                {viewMode === "student" 
                  ? "학생을 검색하여 출결 기록을 달력으로 확인할 수 있습니다."
                  : "날짜를 선택하여 전체 학생의 등원 현황을 확인할 수 있습니다."}
              </CardDescription>
            </div>
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <Button
                variant={viewMode === "student" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("student")}
                data-testid="button-view-student"
              >
                <Users className="w-4 h-4 mr-1" />
                학생별
              </Button>
              <Button
                variant={viewMode === "date" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("date")}
                data-testid="button-view-date"
              >
                <CalendarDays className="w-4 h-4 mr-1" />
                날짜별
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "date" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setDateViewDate(format(subDays(new Date(dateViewDate), 1), "yyyy-MM-dd"))}
                  data-testid="button-prev-date"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Input
                  type="date"
                  value={dateViewDate}
                  onChange={(e) => setDateViewDate(e.target.value)}
                  className="w-auto"
                  data-testid="input-date-view"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setDateViewDate(format(addDays(new Date(dateViewDate), 1), "yyyy-MM-dd"))}
                  data-testid="button-next-date"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              
              {dateViewLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : sortedDateViewRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  해당 날짜에 출결 기록이 없습니다
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground mb-3">
                    총 {sortedDateViewRecords.length}명 등원
                  </div>
                  {sortedDateViewRecords.map((record, index) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3"
                      data-testid={`row-date-record-${record.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-muted-foreground text-sm w-6 shrink-0">{index + 1}</span>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{record.student?.name || "알 수 없음"}</div>
                          {record.class && (
                            <div className="text-xs text-muted-foreground truncate">
                              {record.class.name}{record.class.subject ? ` ${record.class.subject}반` : ""}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-3">
                          {getStatusBadge(record.attendanceStatus || "pending")}
                          <div className="text-sm text-muted-foreground">
                            {record.attendanceStatus === "absent" ? (
                              <span>결석</span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {record.checkInAt ? formatKoreanTime(record.checkInAt) : "-"}
                              </span>
                            )}
                          </div>
                        </div>
                        {record.notificationLogs && record.notificationLogs.length > 0 && (
                          <div className="flex flex-wrap justify-end gap-1">
                            {record.notificationLogs.map((log: NotificationLogInfo, i: number) => {
                              const typeLabel = log.messageType === "check_out" ? "하원" 
                                : log.messageType === "late" ? "지각" 
                                : log.messageType === "attendance_checkin" ? "등원" 
                                : "문자";
                              const typeColor = log.messageType === "check_out" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                : log.messageType === "late" ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300";
                              const isFailed = log.status === "failed";
                              return (
                                <Badge 
                                  key={i} 
                                  variant="secondary" 
                                  className={`text-[10px] h-4 px-1.5 gap-0.5 cursor-help ${isFailed ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : typeColor}`}
                                  title={log.messageContent || "문자 내용 없음"}
                                >
                                  <MessageSquare className="w-2.5 h-2.5" />
                                  {typeLabel} {formatKoreanTime(log.sentAt)}
                                  {isFailed && " 실패"}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : studentsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {selectedStudentId ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-base py-1 px-3">
                    {studentsOnly.find(s => s.id === selectedStudentId)?.name}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearStudent}
                    data-testid="button-clear-student"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="학생 이름으로 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-student-search"
                  />
                </div>
              )}
              
              {!selectedStudentId && searchQuery && (
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  {filteredStudents.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">검색 결과가 없습니다</p>
                  ) : (
                    filteredStudents.map((student) => (
                      <button
                        key={student.id}
                        className="w-full text-left px-3 py-2 hover-elevate transition-colors border-b last:border-b-0"
                        onClick={() => handleSelectStudent(student.id)}
                        data-testid={`button-search-student-${student.id}`}
                      >
                        <span className="font-medium">{student.name}</span>
                        {student.grade && (
                          <span className="ml-2 text-sm text-muted-foreground">{student.grade}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedStudentId && (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarDays className="w-5 h-5" />
                    {studentsOnly.find(s => s.id === selectedStudentId)?.name} 출결 달력
                  </CardTitle>
                  <CardDescription>
                    날짜를 클릭하면 상세 출결 내역을 볼 수 있습니다
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedClassFilter}
                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                    data-testid="select-class-filter"
                  >
                    <option value="all">전체 수업</option>
                    {studentEnrollments.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}{cls.subject ? ` (${cls.subject})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                      data-testid="button-prev-month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <h3 className="font-semibold text-lg">
                      {format(calendarMonth, "yyyy년 M월", { locale: ko })}
                    </h3>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                      data-testid="button-next-month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span>등원</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <span>지각</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span>결석</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                      <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                        {day}
                      </div>
                    ))}
                    
                    {emptyDays.map((_, index) => (
                      <div key={`empty-${index}`} className="aspect-square" />
                    ))}
                    
                    {calendarDays.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const status = getDateStatus(dateStr);
                      const isSelected = selectedDate && isSameDay(day, selectedDate);
                      const isToday = isSameDay(day, new Date());
                      
                      return (
                        <button
                          key={dateStr}
                          className={`
                            aspect-square flex items-center justify-center rounded-md text-sm
                            transition-colors relative
                            ${status ? getStatusColor(status) : "hover:bg-muted"}
                            ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}
                            ${isToday && !status ? "font-bold text-primary" : ""}
                          `}
                          onClick={() => setSelectedDate(day)}
                          data-testid={`calendar-day-${dateStr}`}
                        >
                          {format(day, "d")}
                          {attendanceByDate.get(dateStr)?.length && attendanceByDate.get(dateStr)!.length > 1 && (
                            <span className="absolute bottom-0.5 right-0.5 text-[10px] font-bold">
                              +{attendanceByDate.get(dateStr)!.length - 1}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedDate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  {format(selectedDate, "yyyy년 M월 d일 (EEE)", { locale: ko })} 출결 상세
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDayRecords.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    해당 날짜에 출결 기록이 없습니다
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDayRecords.map((record) => (
                      <div
                        key={record.id}
                        className="flex flex-col gap-2 p-3 rounded-md bg-muted/50"
                        data-testid={`row-detail-${record.id}`}
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          {record.class && (
                            <Badge variant="outline">
                              {record.class.name}{record.class.subject ? ` (${record.class.subject})` : ""}
                            </Badge>
                          )}
                          {getStatusBadge(record.attendanceStatus || "pending")}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {(record.attendanceStatus === "late" ? "지각" : record.attendanceStatus === "absent" ? "결석" : "등원")}: {formatKoreanTime(record.checkInAt)}
                          </span>
                          {record.checkOutAt && (
                            <span className="flex items-center gap-1">
                              하원: {formatKoreanTime(record.checkOutAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
