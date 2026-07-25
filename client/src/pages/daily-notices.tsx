import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ManualButton } from "@/components/manual-button";
import { TeacherClassTabs } from "@/components/teacher-class-tabs";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, BookOpen, ClipboardCheck, MessageSquare, Save, User as UserIcon, Camera, Users, GraduationCap, CheckSquare, Square, Trophy, NotebookPen, Star, Send, Settings, RotateCcw, Info, Clock, BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole, isAssistantTeacher, type Homework, type FaceToFaceCheck, type User as UserType, type Class, type Enrollment, type Feature, type CenterFeature } from "@shared/schema";
import { cn } from "@/lib/utils";

const DEFAULT_DAILY_NOTICE_SMS_TEMPLATE = `[{학원명} 알림장]
{날짜} - {학생이름}

{숙제_사진검사}
{숙제_대면검사}
{숙제_완성도}
{성적}
{수업기록}
{추가알림}
{출결정보}`;

const TEMPLATE_VARIABLES = [
  { key: "{학원명}", desc: "센터(학원) 이름" },
  { key: "{날짜}", desc: "알림장 날짜 (예: 3월 19일 (수요일))" },
  { key: "{학생이름}", desc: "학생 이름" },
  { key: "{숙제_사진검사}", desc: "사진검사 숙제 목록" },
  { key: "{숙제_대면검사}", desc: "대면검사 숙제 목록" },
  { key: "{숙제_완성도}", desc: "직전 숙제 완성도 (%)" },
  { key: "{성적}", desc: "해당 날짜 시험/주간평가 성적" },
  { key: "{수업기록}", desc: "공통/개인 수업기록 + 수업태도 점수" },
  { key: "{추가알림}", desc: "선생님이 작성한 추가 알림" },
  { key: "{출결정보}", desc: "등원/하원 시간 정보" },
];

function NoticeCalendar({ 
  onDateClick,
  selectedDate,
  noticesData
}: { 
  onDateClick: (date: Date) => void;
  selectedDate: Date;
  noticesData: { date: string; hasNotice: boolean }[];
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const weekDays = ["일", "월", "화", "수", "목", "금", "토"];
  const firstDayOfMonth = monthStart.getDay();

  const hasNoticeOnDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return noticesData.some(n => n.date === dateStr && n.hasNotice);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          {format(currentMonth, "yyyy년 M월", { locale: ko })}
        </h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            data-testid="button-prev-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            data-testid="button-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="h-8 flex items-center justify-center text-sm font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}

        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="h-10" />
        ))}

        {days.map((day) => {
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selectedDate);
          const hasNotice = hasNoticeOnDate(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateClick(day)}
              className={cn(
                "h-10 rounded-md flex flex-col items-center justify-center text-sm relative hover-elevate",
                isToday && "ring-2 ring-primary",
                isSelected && "bg-primary text-primary-foreground",
                !isSelected && "hover:bg-muted"
              )}
              data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
            >
              <span>{format(day, "d")}</span>
              {hasNotice && (
                <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-green-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DailyNoticesPage() {
  const { user, selectedCenter, selectedChild, children } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [additionalNote, setAdditionalNote] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("all");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [teacherViewTab, setTeacherViewTab] = useState<"my" | "assistant">("my");
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"notices" | "settings">("notices");

  const isTeacherOrAbove = user?.role !== undefined && user.role >= UserRole.TEACHER;
  const isPrincipalOrAdmin = user?.role !== undefined && user.role >= UserRole.PRINCIPAL;
  const isStudent = user?.role === UserRole.STUDENT;
  const isParent = user?.role === UserRole.PARENT || user?.accountType === "parent";

  // For students, use their own ID
  // For parents, use selected child's ID
  useEffect(() => {
    if (isStudent && user?.id) {
      setSelectedStudentIds([user.id]);
    } else if (isParent) {
      const childId = selectedChild?.id || children?.[0]?.id;
      if (childId) {
        setSelectedStudentIds([childId]);
      }
    }
  }, [isStudent, isParent, user?.id, selectedChild?.id, children]);

  // Helper for single student mode (for viewing notices)
  const selectedStudentId = selectedStudentIds.length === 1 ? selectedStudentIds[0] : "";

  // Toggle student selection
  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev => {
      if (prev.includes(studentId)) {
        return prev.filter(id => id !== studentId);
      } else {
        return [...prev, studentId];
      }
    });
  };

  // Get all users in center (for filtering teachers)
  const { data: allUsers = [], isLoading: usersLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users", selectedCenter?.id],
    queryFn: async () => {
      if (!selectedCenter?.id) return [];
      const res = await fetch(`/api/users?centerId=${selectedCenter.id}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: isTeacherOrAbove && !!selectedCenter?.id,
  });

  // Filter teachers and students from all users (include principals in teacher list)
  const teachers = useMemo(() => 
    allUsers.filter((u) => u.role === UserRole.TEACHER || u.role === UserRole.CLINIC_TEACHER || u.role === UserRole.PRINCIPAL),
    [allUsers]
  );
  const allStudents = useMemo(() => 
    allUsers.filter((u) => u.role === UserRole.STUDENT),
    [allUsers]
  );

  // Get all classes in center (for teachers: only their classes, for principals: all)
  const { data: classes = [] } = useQuery<Class[]>({
    queryKey: ["/api/classes", selectedCenter?.id],
    queryFn: async () => {
      if (!selectedCenter?.id) return [];
      const res = await fetch(`/api/classes?centerId=${selectedCenter.id}`);
      if (!res.ok) throw new Error("Failed to fetch classes");
      return res.json();
    },
    enabled: isTeacherOrAbove && !!selectedCenter?.id,
  });

  // Get all enrollments in center
  const { data: enrollments = [] } = useQuery<Enrollment[]>({
    queryKey: ["/api/enrollments", selectedCenter?.id],
    queryFn: async () => {
      if (!selectedCenter?.id) return [];
      const res = await fetch(`/api/enrollments?centerId=${selectedCenter.id}`);
      if (!res.ok) throw new Error("Failed to fetch enrollments");
      return res.json();
    },
    enabled: isTeacherOrAbove && !!selectedCenter?.id,
  });

  const { data: features = [] } = useQuery<Feature[]>({
    queryKey: ["/api/features"],
    enabled: !!selectedCenter?.id,
  });

  const { data: centerFeatures = [] } = useQuery<CenterFeature[]>({
    queryKey: ["/api/center-features", selectedCenter?.id],
    queryFn: async () => {
      if (!selectedCenter?.id) return [];
      const res = await fetch(`/api/center-features/${selectedCenter.id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedCenter?.id,
  });

  const enabledFeatureMenuKeys = useMemo(() => {
    const enabledIds = centerFeatures.filter(cf => !cf.isHidden).map(cf => cf.featureId);
    const basicKeys = features.filter(f => f.featureType === "basic").map(f => f.menuKey);
    const enabledOptionalKeys = features
      .filter(f => f.featureType === "optional" && enabledIds.includes(f.id))
      .map(f => f.menuKey);
    return new Set([...basicKeys, ...enabledOptionalKeys]);
  }, [features, centerFeatures]);

  const isHomeworkEnabled = enabledFeatureMenuKeys.has("homework");
  const isFaceToFaceEnabled = enabledFeatureMenuKeys.has("face-to-face-checks");

  const isTeacherOnly = isTeacherOrAbove && !isPrincipalOrAdmin;

  // For teachers, filter to only their classes
  const teacherClasses = useMemo(() => {
    if (isPrincipalOrAdmin) return classes;
    return classes.filter(c => c.teacherId === user?.id || isAssistantTeacher(c, user?.id));
  }, [classes, isPrincipalOrAdmin, user?.id]);

  const ownClasses = useMemo(() => {
    if (!isTeacherOnly) return teacherClasses;
    return teacherClasses.filter(c => c.teacherId === user?.id);
  }, [teacherClasses, isTeacherOnly, user?.id]);

  const assistantClasses = useMemo(() => {
    if (!isTeacherOnly) return [];
    return teacherClasses.filter(c => isAssistantTeacher(c, user?.id) && c.teacherId !== user?.id);
  }, [teacherClasses, isTeacherOnly, user?.id]);

  const hasAssistantClasses = assistantClasses.length > 0;

  const displayClasses = useMemo(() => {
    if (isTeacherOnly && hasAssistantClasses) {
      return teacherViewTab === "assistant" ? assistantClasses : ownClasses;
    }
    return teacherClasses;
  }, [isTeacherOnly, hasAssistantClasses, teacherViewTab, assistantClasses, ownClasses, teacherClasses]);

  // Filter classes by selected teacher (only for principals)
  const filteredClasses = useMemo(() => {
    if (!isPrincipalOrAdmin) return displayClasses;
    if (selectedTeacherId === "all") return classes;
    return classes.filter(c => c.teacherId === selectedTeacherId || isAssistantTeacher(c, selectedTeacherId));
  }, [classes, displayClasses, selectedTeacherId, isPrincipalOrAdmin]);

  // Filter students by selected class (via enrollments)
  const filteredStudents = useMemo(() => {
    // For teachers (not principal/admin)
    if (!isPrincipalOrAdmin) {
      if (selectedClassId === "all") {
        // Show students from all of teacher's classes
        const teacherClassIds = displayClasses.map(c => c.id);
        if (teacherClassIds.length === 0) return allStudents;
        const studentIdsInTeacherClasses = enrollments
          .filter(e => teacherClassIds.includes(e.classId))
          .map(e => e.studentId);
        const uniqueStudentIds = Array.from(new Set(studentIdsInTeacherClasses));
        // If no students in teacher's classes, show all students
        if (uniqueStudentIds.length === 0) return allStudents;
        return allStudents.filter(s => uniqueStudentIds.includes(s.id));
      }
      // Filter by specific class
      const studentIdsInClass = enrollments
        .filter(e => e.classId === selectedClassId)
        .map(e => e.studentId);
      return allStudents.filter(s => studentIdsInClass.includes(s.id));
    }
    
    // For principals/admins
    // If no class filter, check teacher filter
    if (selectedClassId === "all") {
      // If no teacher filter, show all students
      if (selectedTeacherId === "all") return allStudents;
      
      // Filter by classes belonging to selected teacher
      const teacherClassIds = filteredClasses.map(c => c.id);
      const studentIdsInTeacherClasses = enrollments
        .filter(e => teacherClassIds.includes(e.classId))
        .map(e => e.studentId);
      const uniqueStudentIds = Array.from(new Set(studentIdsInTeacherClasses));
      return allStudents.filter(s => uniqueStudentIds.includes(s.id));
    }
    
    // Filter by specific class
    const studentIdsInClass = enrollments
      .filter(e => e.classId === selectedClassId)
      .map(e => e.studentId);
    return allStudents.filter(s => studentIdsInClass.includes(s.id));
  }, [allStudents, enrollments, filteredClasses, displayClasses, selectedClassId, selectedTeacherId, isPrincipalOrAdmin]);

  // Reset class selection when teacher changes
  useEffect(() => {
    setSelectedClassId("all");
  }, [selectedTeacherId]);

  // Reset student selection when filters change
  useEffect(() => {
    if (isTeacherOrAbove && selectedStudentIds.length > 0) {
      const validIds = selectedStudentIds.filter(id => filteredStudents.some(s => s.id === id));
      if (validIds.length !== selectedStudentIds.length) {
        setSelectedStudentIds(validIds);
      }
    }
  }, [filteredStudents, selectedStudentIds, isTeacherOrAbove]);

  // Select all students in current filter
  const selectAllStudents = () => {
    setSelectedStudentIds(filteredStudents.map(s => s.id));
  };

  // Clear all selections
  const clearAllSelections = () => {
    setSelectedStudentIds([]);
  };

  const studentsLoading = usersLoading;

  // Get homework (photo submission type) for the selected date
  const { data: homework = [], isLoading: homeworkLoading } = useQuery<(Homework & { class?: { name: string; subject: string } })[]>({
    queryKey: ["/api/students", selectedStudentId, "homework", selectedCenter?.id],
    queryFn: async () => {
      if (!selectedCenter?.id || !selectedStudentId) return [];
      const res = await fetch(`/api/students/${selectedStudentId}/homework`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch homework");
      return res.json();
    },
    enabled: !!selectedCenter?.id && !!selectedStudentId,
  });

  // Get face-to-face checks for the selected date
  const { data: faceToFaceChecks = [], isLoading: checksLoading } = useQuery<(FaceToFaceCheck & { class?: { name: string; subject: string } })[]>({
    queryKey: ["/api/students", selectedStudentId, "face-to-face-checks", selectedCenter?.id],
    queryFn: async () => {
      if (!selectedCenter?.id || !selectedStudentId) return [];
      const res = await fetch(`/api/students/${selectedStudentId}/face-to-face-checks`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch face-to-face checks");
      return res.json();
    },
    enabled: !!selectedCenter?.id && !!selectedStudentId,
  });

  // Get scores for the selected date
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const { data: scoresForDate = [], isLoading: scoresLoading } = useQuery<{
    id: string;
    type: "assessment" | "exam";
    name: string;
    score: number | null;
    maxScore: number;
    date: string;
    scope?: string;
    className: string;
    classSubject: string;
  }[]>({
    queryKey: ["/api/students", selectedStudentId, "scores-by-date", dateStr, selectedCenter?.id],
    queryFn: async () => {
      if (!selectedCenter?.id || !selectedStudentId) return [];
      const res = await fetch(`/api/students/${selectedStudentId}/scores-by-date?date=${dateStr}&centerId=${selectedCenter.id}`);
      if (!res.ok) throw new Error("Failed to fetch scores");
      return res.json();
    },
    enabled: !!selectedCenter?.id && !!selectedStudentId,
  });

  // Get class notes for the selected date
  const { data: classNotesData, isLoading: classNotesLoading } = useQuery<{
    commonNotes: {
      id: string;
      classId: string;
      className: string;
      classSubject: string;
      content: string;
      teacherName: string;
      noteDate: string;
    }[];
    studentNotes: {
      id: string;
      classId: string;
      className: string;
      classSubject: string;
      content: string;
      attitudeScore: number | null;
      teacherName: string;
      noteDate: string;
    }[];
  }>({
    queryKey: ["/api/students", selectedStudentId, "class-notes-by-date", dateStr, selectedCenter?.id],
    queryFn: async () => {
      if (!selectedCenter?.id || !selectedStudentId) return { commonNotes: [], studentNotes: [] };
      const res = await fetch(`/api/students/${selectedStudentId}/class-notes-by-date?date=${dateStr}&centerId=${selectedCenter.id}`);
      if (!res.ok) throw new Error("Failed to fetch class notes");
      return res.json();
    },
    enabled: !!selectedCenter?.id && !!selectedStudentId,
  });

  const commonClassNotes = classNotesData?.commonNotes || [];
  const studentClassNotesForDate = classNotesData?.studentNotes || [];

  const { data: attendanceForDate = [] } = useQuery<any[]>({
    queryKey: ["/api/attendance/history", selectedStudentId, dateStr],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      const res = await fetch(`/api/attendance/history/${selectedStudentId}?startDate=${dateStr}&endDate=${dateStr}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedStudentId && selectedStudentIds.length === 1,
  });

  // Get latest homework completion rate (사진검사 + 대면검사)
  type CompletionDetail = {
    completionRate: number;
    title: string;
    dueDate: string;
    className: string;
    classSubject: string;
  };
  const emptyCompletion = {
    photo: null as CompletionDetail | null,
    face: null as CompletionDetail | null,
    averageCompletionRate: null as number | null,
    completionRate: null as number | null,
    homeworkTitle: null as string | null,
    dueDate: null as string | null,
    className: "",
    classSubject: "",
  };
  const { data: latestHomeworkCompletion = emptyCompletion } = useQuery<typeof emptyCompletion>({
    queryKey: ["/api/homework-completion", selectedStudentId, "latest", selectedCenter?.id, dateStr],
    queryFn: async () => {
      if (!selectedCenter?.id || !selectedStudentId) return emptyCompletion;
      const res = await fetch(`/api/homework-completion/${selectedStudentId}/latest?centerId=${selectedCenter.id}&beforeDate=${dateStr}`);
      if (!res.ok) return emptyCompletion;
      return res.json();
    },
    enabled: !!selectedCenter?.id && !!selectedStudentId && selectedStudentIds.length === 1,
  });

  // Attitude score mutation
  const attitudeMutation = useMutation({
    mutationFn: async ({ noteId, attitudeScore, classId }: { noteId?: string; attitudeScore: number | null; classId: string }) => {
      if (noteId) {
        const existing = studentClassNotesForDate.find(n => n.id === noteId);
        const existingContent = (existing?.content ?? "").trim();
        // 평가 취소 시, 점수 외에 작성된 수업기록 내용이 없으면 기록 자체를 삭제
        if (attitudeScore === null && existingContent === "") {
          return apiRequest("DELETE", `/api/student-class-notes/${noteId}`);
        }
        return apiRequest("PATCH", `/api/student-class-notes/${noteId}`, { 
          content: existing?.content || " ",
          attitudeScore 
        });
      } else {
        return apiRequest("POST", "/api/student-class-notes", {
          classId,
          studentId: selectedStudentId,
          teacherId: user?.id,
          noteDate: dateStr,
          content: " ",
          attitudeScore,
        });
      }
    },
    onSuccess: (_, variables) => {
      toast({ title: variables.attitudeScore === null ? "수업태도 평가가 취소되었습니다" : "수업태도가 저장되었습니다" });
      invalidateQueriesStartingWith("/api/students");
      invalidateQueriesStartingWith("/api/student-class-notes");
    },
    onError: () => {
      toast({ title: "수업태도 저장에 실패했습니다", variant: "destructive" });
    },
  });

  // Get daily notice for the selected date
  const { data: dailyNotice, isLoading: noticeLoading } = useQuery({
    queryKey: ["/api/daily-notices", selectedCenter?.id, selectedStudentId, dateStr],
    queryFn: async () => {
      if (!selectedCenter?.id || !selectedStudentId) return null;
      const res = await fetch(`/api/daily-notices?centerId=${selectedCenter.id}&studentId=${selectedStudentId}&noticeDate=${dateStr}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch daily notice");
      return res.json();
    },
    enabled: !!selectedCenter?.id && !!selectedStudentId,
  });

  // Get all notices for a student (to show on calendar)
  const { data: allNotices = [] } = useQuery({
    queryKey: ["/api/daily-notices/student", selectedStudentId, selectedCenter?.id],
    queryFn: async () => {
      if (!selectedCenter?.id || !selectedStudentId) return [];
      const res = await fetch(`/api/daily-notices/student/${selectedStudentId}?centerId=${selectedCenter.id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch notices");
      return res.json();
    },
    enabled: !!selectedCenter?.id && !!selectedStudentId,
  });

  // Update additional note when notice changes
  useEffect(() => {
    setAdditionalNote(dailyNotice?.additionalNote || "");
  }, [dailyNotice]);

  // Filter homework and checks for selected date
  const homeworkForDate = homework.filter(hw => 
    format(new Date(hw.dueDate), "yyyy-MM-dd") === dateStr
  );
  const checksForDate = faceToFaceChecks.filter(check => 
    format(new Date(check.dueDate), "yyyy-MM-dd") === dateStr
  );

  // Get student name
  const selectedStudent = filteredStudents.find(s => s.id === selectedStudentId) || allStudents.find(s => s.id === selectedStudentId);

  // Save notice mutation (handles multiple students)
  const saveNoticeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCenter?.id || selectedStudentIds.length === 0 || !user?.id) {
        throw new Error("필수 정보가 누락되었습니다");
      }
      // Save notices for all selected students
      const promises = selectedStudentIds.map(studentId =>
        apiRequest("POST", "/api/daily-notices", {
          centerId: selectedCenter.id,
          studentId,
          noticeDate: dateStr,
          additionalNote,
          createdBy: user.id,
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      const count = selectedStudentIds.length;
      toast({ 
        title: "저장 완료", 
        description: count > 1 
          ? `${count}명의 학생에게 알림장이 저장되었습니다.` 
          : "알림장이 저장되었습니다." 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-notices"] });
    },
    onError: (error: any) => {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    },
  });

  const savedTemplate = selectedCenter?.dailyNoticeSmsTemplate || DEFAULT_DAILY_NOTICE_SMS_TEMPLATE;

  const buildSmsContent = () => {
    const studentName = selectedStudentIds.length === 1 && selectedStudent ? selectedStudent.name : "";
    const dateLabel = format(selectedDate, "M월 d일 (EEEE)", { locale: ko });

    let hwPhotoSection = "";
    if (selectedStudentIds.length === 1 && homeworkForDate.length > 0) {
      hwPhotoSection = "📷 숙제(사진검사):\n";
      homeworkForDate.forEach(hw => {
        hwPhotoSection += `- ${hw.title}`;
        if (hw.class) hwPhotoSection += ` (${hw.class.name} ${hw.class.subject})`;
        hwPhotoSection += "\n";
      });
    }

    let hwFaceSection = "";
    if (selectedStudentIds.length === 1 && checksForDate.length > 0) {
      hwFaceSection = "✅ 숙제(대면검사):\n";
      checksForDate.forEach(check => {
        hwFaceSection += `- ${check.title}`;
        if (check.class) hwFaceSection += ` (${check.class.name} ${check.class.subject})`;
        hwFaceSection += "\n";
      });
    }

    let scoreSection = "";
    if (selectedStudentIds.length === 1 && scoresForDate.length > 0) {
      scoreSection = "📊 성적:\n";
      scoresForDate.forEach(score => {
        scoreSection += `- ${score.name}`;
        if (score.className) scoreSection += ` (${score.className}${score.classSubject ? ` ${score.classSubject}반` : ""})`;
        if (score.score !== null) scoreSection += `: ${score.score}/${score.maxScore}점`;
        else scoreSection += ": 미채점";
        scoreSection += "\n";
      });
    }

    let notesSection = "";
    if (selectedStudentIds.length === 1 && (commonClassNotes.length > 0 || studentClassNotesForDate.length > 0)) {
      notesSection = "📝 수업기록:\n";
      commonClassNotes.forEach(n => {
        notesSection += `- [공통] ${n.className}${n.classSubject ? ` ${n.classSubject}반` : ""}: ${n.content}\n`;
      });
      studentClassNotesForDate.forEach(n => {
        let line = `- [개인] ${n.className}${n.classSubject ? ` ${n.classSubject}반` : ""}: `;
        if (n.content && n.content.trim()) line += n.content;
        if (n.attitudeScore !== null && n.attitudeScore !== undefined) line += ` (태도 ${n.attitudeScore}/10)`;
        notesSection += line + "\n";
      });
    }

    let hwCompletionSection = "";
    if (selectedStudentIds.length === 1 && (latestHomeworkCompletion.photo || latestHomeworkCompletion.face)) {
      const lines: string[] = [];
      const fmtDetail = (label: string, d: CompletionDetail) =>
        `- ${label} ${d.title} (${d.className}${d.classSubject ? ` ${d.classSubject}반` : ""}): ${d.completionRate}%`;
      if (latestHomeworkCompletion.photo) lines.push(fmtDetail("[사진검사]", latestHomeworkCompletion.photo));
      if (latestHomeworkCompletion.face) lines.push(fmtDetail("[대면검사]", latestHomeworkCompletion.face));
      if (latestHomeworkCompletion.photo && latestHomeworkCompletion.face && latestHomeworkCompletion.averageCompletionRate !== null) {
        lines.push(`- 평균: ${latestHomeworkCompletion.averageCompletionRate}%`);
      }
      hwCompletionSection = `📊 숙제 완성도:\n${lines.join("\n")}\n`;
    }

    let additionalSection = "";
    if (additionalNote) {
      additionalSection = `💬 추가 알림:\n${additionalNote}`;
    }

    let attendanceSection = "";
    if (selectedStudentIds.length === 1 && attendanceForDate.length > 0) {
      attendanceSection = "🕐 출결정보:\n";
      attendanceForDate.forEach((record: any) => {
        if (record.checkInAt) {
          const checkIn = new Date(record.checkInAt);
          attendanceSection += `- 등원: ${checkIn.getHours()}시 ${String(checkIn.getMinutes()).padStart(2, "0")}분`;
          if (record.isLate) attendanceSection += " (지각)";
          attendanceSection += "\n";
        }
        if (record.checkOutAt) {
          const checkOut = new Date(record.checkOutAt);
          attendanceSection += `- 하원: ${checkOut.getHours()}시 ${String(checkOut.getMinutes()).padStart(2, "0")}분\n`;
        }
      });
    }

    const centerName = selectedCenter?.name || "";

    let msg = savedTemplate
      .replace(/\{학원명\}/g, centerName)
      .replace(/\{날짜\}/g, dateLabel)
      .replace(/\{학생이름\}/g, studentName)
      .replace(/\{숙제_사진검사\}/g, hwPhotoSection.trim())
      .replace(/\{숙제_대면검사\}/g, hwFaceSection.trim())
      .replace(/\{성적\}/g, scoreSection.trim())
      .replace(/\{수업기록\}/g, notesSection.trim())
      .replace(/\{숙제_완성도\}/g, hwCompletionSection.trim())
      .replace(/\{추가알림\}/g, additionalSection.trim())
      .replace(/\{출결정보\}/g, attendanceSection.trim());

    return msg.replace(/\n{3,}/g, "\n\n").trim();
  };

  // SMS send mutation
  const sendSmsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/daily-notices/send-sms", {
        actorId: user?.id,
        centerId: selectedCenter?.id,
        studentIds: selectedStudentIds,
        date: dateStr,
        message: smsMessage,
      });
    },
    onSuccess: async (response: any) => {
      const data = await response.json();
      const results = data.results || [];
      const successCount = results.filter((r: any) => r.success).length;
      const failCount = results.filter((r: any) => !r.success).length;
      if (failCount > 0 && successCount === 0) {
        toast({ title: "문자 발송 실패", description: `전체 ${failCount}명 발송 실패`, variant: "destructive" });
      } else if (failCount > 0) {
        toast({ title: "문자 부분 발송", description: `${successCount}명 성공, ${failCount}명 실패` });
      } else {
        toast({ title: "문자 발송 완료", description: data.message });
      }
      setIsSmsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "문자 발송 실패", description: error?.message || "발송 중 오류가 발생했습니다", variant: "destructive" });
    },
  });

  // Create notices data for calendar
  const noticesData = allNotices.map((n: any) => ({
    date: n.noticeDate,
    hasNotice: !!n.additionalNote || homeworkForDate.length > 0 || checksForDate.length > 0,
  }));

  // Also add dates that have homework or checks
  const allDatesWithContent = new Set<string>();
  homework.forEach(hw => allDatesWithContent.add(format(new Date(hw.dueDate), "yyyy-MM-dd")));
  faceToFaceChecks.forEach(check => allDatesWithContent.add(format(new Date(check.dueDate), "yyyy-MM-dd")));
  allNotices.forEach((n: any) => allDatesWithContent.add(n.noticeDate));

  const calendarNoticesData = Array.from(allDatesWithContent).map(date => ({
    date,
    hasNotice: true,
  }));

  const isLoading = studentsLoading || homeworkLoading || checksLoading || noticeLoading || scoresLoading || classNotesLoading;

  if (!selectedCenter) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center h-full">
        <p className="text-muted-foreground">센터를 선택해주세요</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">알림장</h1>
          <ManualButton menuKey="daily-notices" />
        </div>
        {isTeacherOrAbove && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "notices" | "settings")}>
            <TabsList>
              <TabsTrigger value="notices" data-testid="tab-notices">
                <BookOpen className="h-4 w-4 mr-1" />
                알림장
              </TabsTrigger>
              <TabsTrigger value="settings" data-testid="tab-sms-settings">
                <Settings className="h-4 w-4 mr-1" />
                문자 설정
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {activeTab === "settings" && isTeacherOrAbove ? (
        <DailyNoticeSmsSettings centerId={selectedCenter.id} currentUserId={user?.id || ""} />
      ) : (
      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              날짜 선택
            </CardTitle>
            {isTeacherOrAbove && (
              <div className="pt-2 space-y-3">
                {isPrincipalOrAdmin && (
                  <div>
                    <Label htmlFor="teacher-select" className="flex items-center gap-1 mb-1">
                      <Users className="h-3.5 w-3.5" />
                      선생님
                    </Label>
                    <Select
                      value={selectedTeacherId}
                      onValueChange={setSelectedTeacherId}
                    >
                      <SelectTrigger id="teacher-select" data-testid="select-teacher">
                        <SelectValue placeholder="선생님 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체 선생님</SelectItem>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {isTeacherOnly && (
                  <TeacherClassTabs
                    teacherViewTab={teacherViewTab}
                    onTabChange={(tab) => {
                      setTeacherViewTab(tab);
                      setSelectedClassId("all");
                    }}
                    ownCount={ownClasses.length}
                    assistantCount={assistantClasses.length}
                  />
                )}
                {(displayClasses.length > 0 || isPrincipalOrAdmin) && (
                  <div>
                    <Label htmlFor="class-select" className="flex items-center gap-1 mb-1">
                      <GraduationCap className="h-3.5 w-3.5" />
                      {isPrincipalOrAdmin ? "수업" : "내 수업"}
                    </Label>
                    <Select
                      value={selectedClassId}
                      onValueChange={setSelectedClassId}
                    >
                      <SelectTrigger id="class-select" data-testid="select-class">
                        <SelectValue placeholder="수업 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체 수업</SelectItem>
                        {(isPrincipalOrAdmin ? filteredClasses : displayClasses).map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Label className="flex items-center gap-1">
                      <UserIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="shrink-0">학생 선택</span>
                    </Label>
                    {selectedStudentIds.length > 0 && (
                      <Badge variant="default" className="text-xs">{selectedStudentIds.length}명 선택</Badge>
                    )}
                    <div className="flex gap-1 ml-auto">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={selectAllStudents}
                        className="h-7 text-xs px-2"
                        data-testid="button-select-all-students"
                      >
                        <CheckSquare className="h-3 w-3 mr-1" />
                        전체
                      </Button>
                      {selectedStudentIds.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={clearAllSelections}
                          className="h-7 text-xs px-2"
                          data-testid="button-clear-selection"
                        >
                          <Square className="h-3 w-3 mr-1" />
                          해제
                        </Button>
                      )}
                    </div>
                  </div>
                  <ScrollArea className="h-[200px] border rounded-md p-2">
                    {filteredStudents.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        해당 조건의 학생이 없습니다
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {filteredStudents.map((student) => (
                          <div
                            key={student.id}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-md cursor-pointer hover-elevate",
                              selectedStudentIds.includes(student.id) && "bg-primary/10"
                            )}
                            onClick={() => toggleStudentSelection(student.id)}
                            data-testid={`student-checkbox-${student.id}`}
                          >
                            <Checkbox
                              checked={selectedStudentIds.includes(student.id)}
                              onClick={(e) => e.stopPropagation()}
                              onCheckedChange={() => toggleStudentSelection(student.id)}
                            />
                            <span className="text-sm">{student.name}</span>
                            <Badge variant="outline" className="text-xs ml-auto">{student.grade}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <NoticeCalendar
              onDateClick={setSelectedDate}
              selectedDate={selectedDate}
              noticesData={calendarNoticesData}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
              <BookOpen className="h-5 w-5" />
              {format(selectedDate, "M월 d일 (EEEE)", { locale: ko })} 알림장
              {isTeacherOrAbove && selectedStudentIds.length > 1 && (
                <Badge variant="default" className="ml-2">
                  <Users className="h-3 w-3 mr-1" />
                  {selectedStudentIds.length}명 일괄 작성
                </Badge>
              )}
              {isTeacherOrAbove && selectedStudentIds.length === 1 && selectedStudent && (
                <Badge variant="outline" className="ml-2">
                  <UserIcon className="h-3 w-3 mr-1" />
                  {selectedStudent.name}
                </Badge>
              )}
              {isStudent && user && (
                <Badge variant="outline" className="ml-2">
                  <UserIcon className="h-3 w-3 mr-1" />
                  {user.name}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {isTeacherOrAbove && selectedStudentIds.length > 1
                ? `${selectedStudentIds.length}명의 학생에게 동일한 알림장을 작성합니다`
                : "해당 날짜의 숙제와 알림 내용을 확인하세요"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedStudentIds.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {isTeacherOrAbove ? "학생을 선택해주세요" : "알림장을 불러오는 중..."}
              </div>
            ) : isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <>
                {/* Multi-select mode notice */}
                {isTeacherOrAbove && selectedStudentIds.length > 1 && (
                  <div className="p-4 border rounded-md bg-primary/5 border-primary/20">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="font-medium">일괄 작성 모드</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedStudentIds.length}명의 학생에게 동일한 추가 알림을 작성합니다. 
                      개별 숙제 정보는 학생 1명 선택 시에만 표시됩니다.
                    </p>
                  </div>
                )}

                {selectedStudentIds.length === 1 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Photo Homework Section - only show if homework feature is enabled */}
                    {isHomeworkEnabled && (
                      <div className="space-y-3 p-4 border rounded-lg bg-card">
                        <div className="flex items-center gap-2">
                          <Camera className="h-4 w-4 text-blue-500" />
                          <h3 className="font-semibold">숙제 (사진검사)</h3>
                          <Badge variant="secondary">{homeworkForDate.length}개</Badge>
                        </div>
                        {homeworkForDate.length === 0 ? (
                          <p className="text-sm text-muted-foreground">해당 날짜에 사진검사 숙제가 없습니다</p>
                        ) : (
                          <div className="space-y-2">
                            {homeworkForDate.map((hw) => (
                              <div key={hw.id} className="p-3 border rounded-md bg-muted/30">
                                <p className="font-medium">{hw.title}</p>
                                {hw.class && (
                                  <p className="text-sm text-muted-foreground">
                                    <span className="font-medium">수업:</span> {hw.class.name} {hw.class.subject}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Face-to-Face Check Section - only show if face-to-face feature is enabled */}
                    {isFaceToFaceEnabled && (
                      <div className="space-y-3 p-4 border rounded-lg bg-card">
                        <div className="flex items-center gap-2">
                          <ClipboardCheck className="h-4 w-4 text-green-500" />
                          <h3 className="font-semibold">숙제 (대면검사)</h3>
                          <Badge variant="secondary">{checksForDate.length}개</Badge>
                        </div>
                        {checksForDate.length === 0 ? (
                          <p className="text-sm text-muted-foreground">해당 날짜에 대면검사 숙제가 없습니다</p>
                        ) : (
                          <div className="space-y-2">
                          {checksForDate.map((check) => (
                            <div key={check.id} className="p-3 border rounded-md bg-muted/30">
                              <p className="font-medium">{check.title}</p>
                              {check.class && (
                                <p className="text-sm text-muted-foreground">
                                  <span className="font-medium">수업:</span> {check.class.name} {check.class.subject}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      </div>
                    )}

                    {/* Homework Completion Section */}
                    <div className="space-y-3 p-4 border rounded-lg bg-card">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-purple-500" />
                        <h3 className="font-semibold">숙제 완성도</h3>
                      </div>
                      {!latestHomeworkCompletion.photo && !latestHomeworkCompletion.face ? (
                        <p className="text-sm text-muted-foreground">직전 숙제 완성도 기록이 없습니다</p>
                      ) : (
                        <div className="space-y-2">
                          {([
                            { label: "사진검사", detail: latestHomeworkCompletion.photo },
                            { label: "대면검사", detail: latestHomeworkCompletion.face },
                          ] as const).map(({ label, detail }) =>
                            detail ? (
                              <div key={label} className="p-3 border rounded-md bg-muted/30" data-testid={`completion-${label}`}>
                                <div className="flex items-center justify-between">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-[10px]">{label}</Badge>
                                      <p className="font-medium">{detail.title}</p>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {detail.className} {detail.classSubject && `${detail.classSubject}반`}
                                      {detail.dueDate && ` · ${format(new Date(detail.dueDate + "T00:00:00"), "M/d")}`}
                                    </p>
                                  </div>
                                  <Badge variant={detail.completionRate >= 80 ? "default" : detail.completionRate >= 50 ? "secondary" : "destructive"}>
                                    {detail.completionRate}%
                                  </Badge>
                                </div>
                              </div>
                            ) : null
                          )}
                          {latestHomeworkCompletion.photo && latestHomeworkCompletion.face && latestHomeworkCompletion.averageCompletionRate !== null && (
                            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-primary/5" data-testid="completion-average">
                              <span className="text-sm font-medium">평균 완성도</span>
                              <Badge variant={latestHomeworkCompletion.averageCompletionRate >= 80 ? "default" : latestHomeworkCompletion.averageCompletionRate >= 50 ? "secondary" : "destructive"}>
                                {latestHomeworkCompletion.averageCompletionRate}%
                              </Badge>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Scores Section */}
                    <div className="space-y-3 p-4 border rounded-lg bg-card">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-amber-500" />
                        <h3 className="font-semibold">성적</h3>
                        <Badge variant="secondary">{scoresForDate.length}개</Badge>
                      </div>
                      {scoresForDate.length === 0 ? (
                        <p className="text-sm text-muted-foreground">해당 날짜에 성적이 없습니다</p>
                      ) : (
                        <div className="space-y-2">
                          {scoresForDate.map((score) => (
                            <div key={score.id} className="p-3 border rounded-md bg-muted/30">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant={score.type === "exam" ? "default" : "outline"} className="text-xs">
                                      {score.type === "exam" ? "평가" : "주간평가"}
                                    </Badge>
                                    <p className="font-medium">{score.name}</p>
                                  </div>
                                  {(score.className || score.classSubject) && (
                                    <p className="text-sm text-muted-foreground">
                                      <span className="font-medium">수업:</span> {score.className} {score.classSubject ? `${score.classSubject}반` : ""}
                                    </p>
                                  )}
                                  {score.scope && (
                                    <p className="text-sm text-muted-foreground">
                                      <span className="font-medium">범위:</span> {score.scope}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  {score.score !== null ? (
                                    <span className="text-lg font-bold">{score.score}<span className="text-sm text-muted-foreground font-normal">/{score.maxScore}</span></span>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">미채점</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Class Notes Section */}
                    <div className="space-y-3 p-4 border rounded-lg bg-card">
                      <div className="flex items-center gap-2">
                        <NotebookPen className="h-4 w-4 text-purple-500" />
                        <h3 className="font-semibold">수업기록</h3>
                        <Badge variant="secondary">{commonClassNotes.length + studentClassNotesForDate.length}개</Badge>
                      </div>
                      {commonClassNotes.length === 0 && studentClassNotesForDate.length === 0 ? (
                        <p className="text-sm text-muted-foreground">해당 날짜에 수업기록이 없습니다</p>
                      ) : (
                        <div className="space-y-2">
                          {commonClassNotes.map((note) => (
                            <div key={note.id} className="p-3 border rounded-md bg-muted/30">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">공통</Badge>
                                <span className="text-sm font-medium">{note.className} {note.classSubject ? `${note.classSubject}반` : ""}</span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                              <p className="text-xs text-muted-foreground mt-1">{note.teacherName} 선생님</p>
                            </div>
                          ))}
                          {studentClassNotesForDate.map((note) => (
                            <div key={note.id} className="p-3 border rounded-md bg-muted/30">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="default" className="text-xs">개인</Badge>
                                <span className="text-sm font-medium">{note.className} {note.classSubject ? `${note.classSubject}반` : ""}</span>
                                {note.attitudeScore !== null && note.attitudeScore !== undefined && (
                                  <Badge 
                                    variant={note.attitudeScore >= 8 ? "default" : note.attitudeScore >= 5 ? "secondary" : "destructive"} 
                                    className="text-xs ml-auto"
                                  >
                                    <Star className="h-3 w-3 mr-0.5" />
                                    태도 {note.attitudeScore}/10
                                  </Badge>
                                )}
                              </div>
                              {note.content && note.content.trim() && (
                                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">{note.teacherName} 선생님</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Attitude Score Section - only for teachers, single student */}
                    {isTeacherOrAbove && (
                      <div className="space-y-3 p-4 border rounded-lg bg-card">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <h3 className="font-semibold">수업태도 평가</h3>
                        </div>
                        {(() => {
                          const studentEnrolledClassIds = enrollments
                            .filter(e => e.studentId === selectedStudentId)
                            .map(e => e.classId);
                          const studentEnrolledClasses = classes.filter(c => studentEnrolledClassIds.includes(c.id));
                          if (studentEnrolledClasses.length === 0) {
                            return <p className="text-sm text-muted-foreground">수강 중인 수업이 없습니다</p>;
                          }
                          return (
                            <div className="grid grid-cols-1 gap-2">
                              {studentEnrolledClasses.map((cls) => {
                                const existingNote = studentClassNotesForDate.find(n => n.classId === cls.id);
                                const currentScore = existingNote?.attitudeScore;
                                return (
                                  <AttitudeSlider
                                    key={cls.id}
                                    cls={cls}
                                    currentScore={currentScore ?? null}
                                    existingNoteId={existingNote?.id}
                                    onSave={(score) => attitudeMutation.mutate({
                                      noteId: existingNote?.id,
                                      attitudeScore: score,
                                      classId: cls.id,
                                    })}
                                    onClear={existingNote?.id ? () => attitudeMutation.mutate({
                                      noteId: existingNote.id,
                                      attitudeScore: null,
                                      classId: cls.id,
                                    }) : undefined}
                                    disabled={attitudeMutation.isPending}
                                  />
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Attendance Section */}
                    <div className="space-y-3 p-4 border rounded-lg bg-card">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-teal-500" />
                        <h3 className="font-semibold">출결 기록</h3>
                        <Badge variant="secondary">{attendanceForDate.length}건</Badge>
                      </div>
                      {attendanceForDate.length === 0 ? (
                        <p className="text-sm text-muted-foreground">해당 날짜에 출결 기록이 없습니다</p>
                      ) : (
                        <div className="space-y-2">
                          {attendanceForDate.map((record: any, idx: number) => (
                            <div key={record.id || idx} className="p-3 border rounded-md bg-muted/30">
                              <div className="flex items-center gap-3 flex-wrap">
                                {record.checkInAt && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    <span className="text-sm">
                                      등원: <span className="font-medium">{format(new Date(record.checkInAt), "HH:mm")}</span>
                                    </span>
                                    {record.isLate && (
                                      <Badge variant="destructive" className="text-xs h-5">지각</Badge>
                                    )}
                                  </div>
                                )}
                                {record.checkOutAt && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span className="text-sm">
                                      하원: <span className="font-medium">{format(new Date(record.checkOutAt), "HH:mm")}</span>
                                    </span>
                                  </div>
                                )}
                              </div>
                              {record.className && (
                                <p className="text-xs text-muted-foreground mt-1">수업: {record.className}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional Note Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-orange-500" />
                    <h3 className="font-semibold">추가 알림</h3>
                  </div>
                  {isTeacherOrAbove ? (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="추가 알림 내용을 작성하세요..."
                        value={additionalNote}
                        onChange={(e) => setAdditionalNote(e.target.value)}
                        rows={4}
                        data-testid="textarea-additional-note"
                      />
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          onClick={() => saveNoticeMutation.mutate()}
                          disabled={saveNoticeMutation.isPending || selectedStudentIds.length === 0}
                          data-testid="button-save-notice"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {saveNoticeMutation.isPending 
                            ? "저장 중..." 
                            : selectedStudentIds.length > 1 
                              ? `${selectedStudentIds.length}명에게 저장` 
                              : "알림장 저장"
                          }
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSmsMessage(buildSmsContent());
                            setIsSmsDialogOpen(true);
                          }}
                          disabled={selectedStudentIds.length === 0}
                          data-testid="button-send-sms"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          학부모 문자 발송
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 border rounded-md bg-muted/30 min-h-[80px]">
                      {additionalNote ? (
                        <p className="whitespace-pre-wrap">{additionalNote}</p>
                      ) : (
                        <p className="text-muted-foreground">추가 알림 내용이 없습니다</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      <Dialog open={isSmsDialogOpen} onOpenChange={setIsSmsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              학부모 문자 발송
            </DialogTitle>
            <DialogDescription>
              {selectedStudentIds.length > 1
                ? `${selectedStudentIds.length}명의 학부모에게 문자를 발송합니다`
                : selectedStudent
                ? `${selectedStudent.name} 학부모에게 문자를 발송합니다`
                : "알림장 내용을 문자로 발송합니다"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">발송 대상</Label>
              <div className="mt-1 p-3 border rounded-md bg-muted/30 text-sm space-y-1 max-h-[120px] overflow-y-auto">
                {selectedStudentIds.map(sid => {
                  const st = filteredStudents.find(s => s.id === sid) || allStudents.find(s => s.id === sid);
                  if (!st) return null;
                  const phone = st.motherPhone || st.fatherPhone || st.phone;
                  return (
                    <div key={sid} className="flex items-center justify-between">
                      <span>{st.name}</span>
                      {phone ? (
                        <span className="text-muted-foreground text-xs">{phone}</span>
                      ) : (
                        <span className="text-destructive text-xs">연락처 없음</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {(() => {
                const noPhoneCount = selectedStudentIds.filter(sid => {
                  const st = filteredStudents.find(s => s.id === sid) || allStudents.find(s => s.id === sid);
                  return st && !(st.motherPhone || st.fatherPhone || st.phone);
                }).length;
                return noPhoneCount > 0 ? (
                  <p className="text-xs text-destructive mt-1">연락처 없는 학생 {noPhoneCount}명은 발송에서 제외됩니다</p>
                ) : null;
              })()}
            </div>
            <div>
              <Label>문자 내용</Label>
              <Textarea
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                rows={12}
                className="mt-1 font-mono text-sm"
                data-testid="textarea-sms-message"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {smsMessage.length}자 {smsMessage.length > 90 ? "(장문 LMS)" : "(단문 SMS)"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSmsDialogOpen(false)}>
              취소
            </Button>
            <Button
              onClick={() => sendSmsMutation.mutate()}
              disabled={sendSmsMutation.isPending || !smsMessage.trim()}
              data-testid="button-confirm-send-sms"
            >
              <Send className="h-4 w-4 mr-2" />
              {sendSmsMutation.isPending ? "발송 중..." : "문자 발송"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttitudeSlider({ cls, currentScore, existingNoteId, onSave, onClear, disabled }: {
  cls: { id: string; name: string; subject: string | null };
  currentScore: number | null;
  existingNoteId?: string;
  onSave: (score: number) => void;
  onClear?: () => void;
  disabled: boolean;
}) {
  const [localScore, setLocalScore] = useState<number>(currentScore ?? 5);

  useEffect(() => {
    setLocalScore(currentScore ?? 5);
  }, [currentScore]);

  return (
    <div className="p-3 border rounded-md bg-muted/30">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-medium">{cls.name} {cls.subject ? `${cls.subject}반` : ""}</span>
        <div className="flex items-center gap-2">
          {currentScore !== null && onClear && (
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              className="text-xs text-destructive/70 hover:text-destructive font-medium transition-colors px-2 py-1 rounded-md border border-destructive/30 hover:border-destructive/60 hover:bg-destructive/10"
              data-testid={`attitude-clear-${cls.id}`}
            >
              평가 취소
            </button>
          )}
          <span className={cn(
            "min-w-[2rem] text-center font-semibold text-lg",
            currentScore !== null
              ? localScore >= 8 ? "text-green-600" : localScore >= 5 ? "text-yellow-600" : "text-red-600"
              : "text-muted-foreground"
          )}>
            {currentScore !== null ? localScore : "-"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min="1"
          max="10"
          value={localScore}
          onChange={(e) => setLocalScore(parseInt(e.target.value))}
          onPointerUp={(e) => onSave(parseInt((e.target as HTMLInputElement).value))}
          disabled={disabled}
          className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
          data-testid={`attitude-slider-${cls.id}`}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>매우 나쁨</span>
        <span>보통</span>
        <span>매우 좋음</span>
      </div>
    </div>
  );
}

function DailyNoticeSmsSettings({ centerId, currentUserId }: { centerId: string; currentUserId: string }) {
  const { toast } = useToast();
  const { selectedCenter, refreshCenters } = useAuth();
  const [template, setTemplate] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const templateRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (variable: string) => {
    const textarea = templateRef.current;
    if (!textarea) {
      setTemplate(prev => prev + variable);
      setIsEditing(true);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newTemplate = template.slice(0, start) + variable + template.slice(end);
    setTemplate(newTemplate);
    setIsEditing(true);
    setTimeout(() => {
      textarea.focus();
      const newPos = start + variable.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  useEffect(() => {
    setTemplate(selectedCenter?.dailyNoticeSmsTemplate || DEFAULT_DAILY_NOTICE_SMS_TEMPLATE);
  }, [selectedCenter?.dailyNoticeSmsTemplate]);

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/centers/${centerId}/daily-notice-sms-template`, {
        smsTemplate: template,
        actorId: currentUserId,
      });
    },
    onSuccess: async () => {
      toast({ title: "저장 완료", description: "문자 서식이 저장되었습니다" });
      setIsEditing(false);
      invalidateQueriesStartingWith("/api/centers");
      await refreshCenters();
    },
    onError: (error: any) => {
      toast({ title: "저장 실패", description: error?.message || "저장 중 오류가 발생했습니다", variant: "destructive" });
    },
  });

  const previewMessage = template
    .replace(/\{학원명\}/g, selectedCenter?.name || "프라임수학")
    .replace(/\{날짜\}/g, "3월 19일 (수요일)")
    .replace(/\{학생이름\}/g, "홍길동")
    .replace(/\{숙제_사진검사\}/g, "📷 숙제(사진검사):\n- 수학 교과서 p.45 (중2-2 화목S반)")
    .replace(/\{숙제_대면검사\}/g, "✅ 숙제(대면검사):\n- 영어 단어 암기 (중2-2 개념S반)")
    .replace(/\{성적\}/g, "📊 성적:\n- 주간평가 (중2-2 화목S반): 85/100점")
    .replace(/\{수업기록\}/g, "📝 수업기록:\n- [공통] 중2-2 화목S반: 이차방정식 풀이 연습\n- [개인] 중2-2 화목S반: 문제 풀이 속도 향상 (태도 8/10)")
    .replace(/\{추가알림\}/g, "💬 추가 알림:\n내일은 수학 시험이 있습니다")
    .replace(/\{출결정보\}/g, "🕐 출결정보:\n- 등원: 14시 30분\n- 하원: 17시 00분")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            학부모 문자 서식
          </CardTitle>
          <CardDescription>
            알림장 문자 발송 시 사용할 기본 서식을 설정합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">문자 서식 템플릿</Label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTemplate(DEFAULT_DAILY_NOTICE_SMS_TEMPLATE);
                    setIsEditing(true);
                  }}
                  className="h-7 text-xs"
                  data-testid="button-reset-template"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  기본값
                </Button>
              </div>
            </div>
            <Textarea
              ref={templateRef}
              value={template}
              onChange={(e) => {
                setTemplate(e.target.value);
                setIsEditing(true);
              }}
              rows={14}
              className="font-mono text-sm"
              data-testid="textarea-sms-template"
            />
          </div>

          <div className="p-3 border rounded-md bg-blue-50 dark:bg-blue-950/30 space-y-2">
            <div className="flex items-center gap-1.5">
              <Info className="h-4 w-4 text-blue-500 shrink-0" />
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400">변수를 클릭하면 커서 위치에 삽입됩니다</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map(v => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/60 transition-colors cursor-pointer border border-blue-200 dark:border-blue-800"
                  title={v.desc}
                  data-testid={`btn-insert-var-${v.key}`}
                >
                  {v.key}
                </button>
              ))}
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t border-blue-200 dark:border-blue-800">
              {TEMPLATE_VARIABLES.map(v => (
                <div key={v.key} className="flex gap-1.5">
                  <span className="font-mono text-blue-600 dark:text-blue-400 shrink-0">{v.key}</span>
                  <span>{v.desc}</span>
                </div>
              ))}
              <p className="pt-1">데이터가 없는 변수는 자동으로 제거됩니다</p>
            </div>
          </div>

          <Button
            onClick={() => saveTemplateMutation.mutate()}
            disabled={saveTemplateMutation.isPending || !isEditing}
            className="w-full"
            data-testid="button-save-template"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveTemplateMutation.isPending ? "저장 중..." : "서식 저장"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Send className="h-5 w-5" />
            미리보기
          </CardTitle>
          <CardDescription>
            실제 데이터가 적용된 문자 예시입니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 border rounded-md bg-muted/30 font-mono text-sm whitespace-pre-wrap break-words min-h-[200px]" data-testid="sms-preview">
            {previewMessage}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {previewMessage.length}자 {previewMessage.length > 90 ? "(장문 LMS)" : "(단문 SMS)"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
