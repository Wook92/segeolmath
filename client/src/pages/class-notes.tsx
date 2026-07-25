import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Edit, Trash2, Save, X, FileText, Users, Calendar, History, BookOpen, Search } from "lucide-react";
import { ManualButton } from "@/components/manual-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole, type Class, type ClassNoteWithTeacher, type StudentClassNoteWithDetails } from "@shared/schema";
import { cn } from "@/lib/utils";

function MonthCalendar({
  currentMonth,
  onMonthChange,
  selectedDate,
  onDateSelect,
  noteDates
}: {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  noteDates?: Set<string>;
}) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const weekDays = ["월", "화", "수", "목", "금", "토", "일"];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          data-testid="button-prev-month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold text-sm">
          {format(currentMonth, "yyyy년 M월", { locale: ko })}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onMonthChange(addMonths(currentMonth, 1))}
          data-testid="button-next-month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
            {day}
          </div>
        ))}
        {days.map((day) => {
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const dateStr = format(day, "yyyy-MM-dd");
          const hasNotes = noteDates?.has(dateStr);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              className={cn(
                "relative flex flex-col items-center justify-center p-1 rounded-md transition-colors min-h-[36px]",
                isSelected && "bg-primary text-primary-foreground",
                !isSelected && isToday && "bg-secondary",
                !isSelected && !isToday && isCurrentMonth && "hover-elevate",
                !isCurrentMonth && "opacity-30"
              )}
              data-testid={`date-${dateStr}`}
            >
              <span className="text-sm">{format(day, "d")}</span>
              {hasNotes && !isSelected && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary" />
              )}
              {hasNotes && isSelected && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary-foreground" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ClassNoteCard({ 
  note, 
  onEdit, 
  onDelete,
  canEdit
}: { 
  note: ClassNoteWithTeacher;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
}) {
  return (
    <Card className="mb-3">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                공통 기록
              </Badge>
              {note.teacher && (
                <span className="text-xs text-muted-foreground">
                  {note.teacher.name}
                </span>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
          </div>
          {canEdit && (
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" onClick={onEdit} data-testid={`button-edit-note-${note.id}`}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={onDelete} data-testid={`button-delete-note-${note.id}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StudentNoteCard({ 
  note, 
  onEdit, 
  onDelete,
  canEdit,
  showStudentName = true
}: { 
  note: StudentClassNoteWithDetails;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
  showStudentName?: boolean;
}) {
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600 dark:text-green-400";
    if (score >= 5) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <Card className="mb-3">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {showStudentName && (
                <Badge variant="outline" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {note.student?.name || "학생"}
                </Badge>
              )}
              {note.attitudeScore !== null && note.attitudeScore !== undefined && (
                <Badge variant="secondary" className="text-xs">
                  <span className={getScoreColor(note.attitudeScore)}>
                    수업태도: {note.attitudeScore}/10
                  </span>
                </Badge>
              )}
              {note.teacher && (
                <span className="text-xs text-muted-foreground">
                  {note.teacher.name}
                </span>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
          </div>
          {canEdit && (
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" onClick={onEdit} data-testid={`button-edit-student-note-${note.id}`}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={onDelete} data-testid={`button-delete-student-note-${note.id}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function NoteEditor({ 
  isOpen, 
  onClose, 
  mode,
  noteType,
  classId,
  teacherId,
  selectedDate,
  editingNote,
  students
}: { 
  isOpen: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  noteType: "class" | "student";
  classId: string;
  teacherId: string;
  selectedDate: Date;
  editingNote?: ClassNoteWithTeacher | StudentClassNoteWithDetails | null;
  students?: any[];
}) {
  const { toast } = useToast();
  const [content, setContent] = useState(editingNote?.content || "");
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    (editingNote as StudentClassNoteWithDetails)?.studentId || ""
  );
  const [attitudeScore, setAttitudeScore] = useState<number | null>(
    (editingNote as StudentClassNoteWithDetails)?.attitudeScore ?? null
  );

  useEffect(() => {
    setContent(editingNote?.content || "");
    setSelectedStudentId((editingNote as StudentClassNoteWithDetails)?.studentId || "");
    setAttitudeScore((editingNote as StudentClassNoteWithDetails)?.attitudeScore ?? null);
  }, [editingNote]);

  const createClassNoteMutation = useMutation({
    mutationFn: async (data: any) => {
      if (mode === "edit" && editingNote) {
        return apiRequest("PATCH", `/api/class-notes/${editingNote.id}`, { content: data.content });
      }
      return apiRequest("POST", "/api/class-notes", data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/class-notes");
      toast({ title: mode === "edit" ? "기록이 수정되었습니다" : "기록이 저장되었습니다" });
      onClose();
    },
    onError: () => {
      toast({ title: "기록 저장에 실패했습니다", variant: "destructive" });
    },
  });

  const createStudentNoteMutation = useMutation({
    mutationFn: async (data: any) => {
      if (mode === "edit" && editingNote) {
        return apiRequest("PATCH", `/api/student-class-notes/${editingNote.id}`, { 
          content: data.content,
          attitudeScore: data.attitudeScore
        });
      }
      return apiRequest("POST", "/api/student-class-notes", data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/student-class-notes");
      toast({ title: mode === "edit" ? "기록이 수정되었습니다" : "기록이 저장되었습니다" });
      onClose();
    },
    onError: () => {
      toast({ title: "기록 저장에 실패했습니다", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!content.trim()) {
      toast({ title: "내용을 입력해주세요", variant: "destructive" });
      return;
    }

    if (noteType === "student" && mode === "create" && !selectedStudentId) {
      toast({ title: "학생을 선택해주세요", variant: "destructive" });
      return;
    }

    const noteDate = format(selectedDate, "yyyy-MM-dd");

    if (noteType === "class") {
      createClassNoteMutation.mutate({ classId, teacherId, noteDate, content });
    } else {
      createStudentNoteMutation.mutate({ 
        classId, 
        studentId: selectedStudentId, 
        teacherId, 
        noteDate, 
        content,
        attitudeScore 
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {noteType === "class" ? "공통 수업 기록" : "학생별 수업 기록"}
            {mode === "edit" ? " 수정" : " 추가"}
          </DialogTitle>
          <DialogDescription>
            {format(selectedDate, "yyyy년 M월 d일 (EEEE)", { locale: ko })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {noteType === "student" && mode === "create" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">학생 선택</label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger data-testid="select-student">
                  <SelectValue placeholder="학생을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {students?.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name} {student.grade ? `(${student.grade})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">내용</label>
            <Textarea
              placeholder="수업 내용을 기록하세요..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[150px]"
              data-testid="input-note-content"
            />
          </div>

          {noteType === "student" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">수업 태도 점수 (선택)</label>
                {attitudeScore !== null ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAttitudeScore(null)}
                    data-testid="button-remove-score"
                  >
                    <X className="h-3 w-3 mr-1" />
                    평가 안함
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAttitudeScore(5)}
                    data-testid="button-add-score"
                  >
                    점수 평가하기
                  </Button>
                )}
              </div>
              {attitudeScore !== null && (
                <>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={attitudeScore}
                      onChange={(e) => setAttitudeScore(parseInt(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                      data-testid="input-attitude-score"
                    />
                    <span className="min-w-[2.5rem] text-center font-semibold text-lg">
                      {attitudeScore}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>매우 나쁨</span>
                    <span>보통</span>
                    <span>매우 좋음</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel">
            취소
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createClassNoteMutation.isPending || createStudentNoteMutation.isPending}
            data-testid="button-save-note"
          >
            <Save className="h-4 w-4 mr-1" />
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ClassNotesPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<"class" | "student" | "history">("class");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingNote, setEditingNote] = useState<ClassNoteWithTeacher | StudentClassNoteWithDetails | null>(null);
  const [historyStudentId, setHistoryStudentId] = useState<string>("");
  const [historyYear, setHistoryYear] = useState<number>(new Date().getFullYear());
  const [historyMonth, setHistoryMonth] = useState<number>(new Date().getMonth() + 1);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [historyStudentSearch, setHistoryStudentSearch] = useState("");
  const [viewMode, setViewMode] = useState<"teacher" | "student-search">("teacher");
  const [globalStudentSearch, setGlobalStudentSearch] = useState("");
  const [selectedSearchStudentId, setSelectedSearchStudentId] = useState<string>("");
  const [searchYear, setSearchYear] = useState<number>(new Date().getFullYear());
  const [searchMonth, setSearchMonth] = useState<number>(new Date().getMonth() + 1);

  const isParent = user && user.role === UserRole.PARENT;
  const isStudent = user && user.role === UserRole.STUDENT;
  const isStudentOrParent = isStudent || isParent;
  const isTeacher = user && user.role >= UserRole.TEACHER;
  const isPrincipalOrAbove = !!(user && user.role >= UserRole.PRINCIPAL);
  const centerId = typeof selectedCenter === 'string' ? selectedCenter : selectedCenter?.id;
  const [selectedChildId, setSelectedChildId] = useState<string>("");

  const { data: children = [] } = useQuery<any[]>({
    queryKey: [`/api/parents/${user?.id}/children`],
    enabled: !!user?.id && !!isParent,
  });

  useEffect(() => {
    if (isParent && children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [isParent, children, selectedChildId]);

  const viewingStudentId = isStudent ? user?.id : isParent ? selectedChildId : null;

  useEffect(() => {
    setSelectedClassId("");
    setSelectedTeacherId("");
    setHistoryStudentId("");
    setStudentSearchQuery("");
    setHistoryStudentSearch("");
  }, [centerId]);

  const { data: teachers = [] } = useQuery<any[]>({
    queryKey: [`/api/centers/${centerId}/teachers`],
    enabled: !!centerId && isPrincipalOrAbove,
  });

  const isTeacherOnly = !!(isTeacher && !isPrincipalOrAbove);

  const { data: centerStudents = [] } = useQuery<any[]>({
    queryKey: [`/api/centers/${centerId}/students`],
    enabled: !!centerId && isPrincipalOrAbove && viewMode === "student-search",
  });

  const { data: teacherAllClassStudents = [] } = useQuery<any[]>({
    queryKey: ["/api/teacher-class-students", user?.id, centerId],
    queryFn: async () => {
      const classesRes = await fetch(`/api/teachers/${user!.id}/classes?centerId=${centerId}`);
      if (!classesRes.ok) return [];
      const cls: any[] = await classesRes.json();
      const studentMap = new Map<string, any>();
      for (const c of cls) {
        const studentsRes = await fetch(`/api/classes/${c.id}/students`);
        if (!studentsRes.ok) continue;
        const students: any[] = await studentsRes.json();
        for (const s of students) {
          if (!studentMap.has(s.id)) studentMap.set(s.id, s);
        }
      }
      return Array.from(studentMap.values()).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ko"));
    },
    enabled: !!centerId && isTeacherOnly && viewMode === "student-search" && !!user?.id,
  });

  const searchableStudents = isPrincipalOrAbove ? centerStudents : teacherAllClassStudents;

  const filteredSearchStudents = globalStudentSearch.trim()
    ? searchableStudents
        .filter((s: any) => s.role === undefined || s.role === UserRole.STUDENT)
        .filter((s: any) => s.name?.toLowerCase().includes(globalStudentSearch.trim().toLowerCase()))
        .slice(0, 20)
    : [];

  const selectedSearchStudent = searchableStudents.find((s: any) => s.id === selectedSearchStudentId);

  const monthStartStr = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const monthEndStr = format(endOfMonth(currentMonth), "yyyy-MM-dd");
  const searchNoteDate = format(selectedDate, "yyyy-MM-dd");

  const { data: searchNoteDates } = useQuery<string[]>({
    queryKey: ["/api/students", selectedSearchStudentId, "note-dates", { start: monthStartStr, end: monthEndStr, centerId }],
    queryFn: async () => {
      const res = await fetch(`/api/students/${selectedSearchStudentId}/note-dates?startDate=${monthStartStr}&endDate=${monthEndStr}&centerId=${centerId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedSearchStudentId && viewMode === "student-search" && !!centerId,
  });
  const searchNoteDateSet = new Set(searchNoteDates || []);

  const { data: searchDayClassNotes, isLoading: searchDayClassNotesLoading } = useQuery<any[]>({
    queryKey: ["/api/students", selectedSearchStudentId, "all-class-notes", { noteDate: searchNoteDate, centerId }],
    queryFn: async () => {
      const res = await fetch(`/api/students/${selectedSearchStudentId}/all-class-notes?noteDate=${searchNoteDate}&centerId=${centerId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedSearchStudentId && viewMode === "student-search" && !!centerId,
  });

  const { data: searchDayStudentNotes, isLoading: searchDayStudentNotesLoading } = useQuery<any[]>({
    queryKey: ["/api/students", selectedSearchStudentId, "all-student-notes", { noteDate: searchNoteDate }],
    queryFn: async () => {
      const res = await fetch(`/api/students/${selectedSearchStudentId}/all-student-notes?noteDate=${searchNoteDate}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedSearchStudentId && viewMode === "student-search",
  });

  const [searchHistoryTab, setSearchHistoryTab] = useState<"class" | "student" | "history">("class");

  const { data: searchMonthlyStudentNotes, isLoading: searchMonthlyStudentNotesLoading } = useQuery<any[]>({
    queryKey: ["/api/student-class-notes/monthly", { studentId: selectedSearchStudentId, year: searchYear, month: searchMonth }],
    queryFn: async () => {
      const params = new URLSearchParams({
        studentId: selectedSearchStudentId,
        year: searchYear.toString(),
        month: searchMonth.toString(),
      });
      const res = await fetch(`/api/student-class-notes/monthly?${params.toString()}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedSearchStudentId && viewMode === "student-search" && searchHistoryTab === "history",
  });

  const { data: searchMonthlyClassNotes, isLoading: searchMonthlyClassNotesLoading } = useQuery<any[]>({
    queryKey: ["/api/class-notes/monthly-by-student", { studentId: selectedSearchStudentId, year: searchYear, month: searchMonth, centerId }],
    queryFn: async () => {
      const res = await fetch(`/api/students/${selectedSearchStudentId}/classes?centerId=${centerId}`);
      if (!res.ok) return [];
      const classes: any[] = await res.json();
      if (classes.length === 0) return [];
      const allNotes: any[] = [];
      for (const cls of classes) {
        const notesRes = await fetch(`/api/class-notes/monthly?classId=${cls.id}&year=${searchYear}&month=${searchMonth}`);
        if (notesRes.ok) {
          const notes = await notesRes.json();
          allNotes.push(...notes);
        }
      }
      allNotes.sort((a: any, b: any) => b.note_date.localeCompare(a.note_date));
      return allNotes;
    },
    enabled: !!selectedSearchStudentId && viewMode === "student-search" && searchHistoryTab === "history" && !!centerId,
  });

  const { data: studentEnrolledClasses = [], isLoading: studentClassesLoading } = useQuery<Class[]>({
    queryKey: [`/api/students/${viewingStudentId}/classes?centerId=${centerId}`],
    enabled: !!viewingStudentId && !!isStudentOrParent && !!centerId,
  });

  useEffect(() => {
    if (isStudentOrParent) {
      return;
    }
    if (isPrincipalOrAbove && teachers.length > 0 && !selectedTeacherId) {
      const selfInList = teachers.find((t: any) => t.id === user?.id);
      setSelectedTeacherId(selfInList ? selfInList.id : teachers[0].id);
    } else if (!isPrincipalOrAbove && user) {
      setSelectedTeacherId(user.id);
    }
  }, [teachers, isPrincipalOrAbove, user, selectedTeacherId, isStudentOrParent]);

  const { data: teacherClasses, isLoading: teacherClassesLoading } = useQuery<Class[]>({
    queryKey: [`/api/teachers/${selectedTeacherId}/classes?centerId=${centerId}`],
    enabled: !!selectedTeacherId && !isStudentOrParent && !!centerId,
  });

  const allClasses: Class[] = (isStudentOrParent ? studentEnrolledClasses : teacherClasses) || [];
  const classesLoading = isStudentOrParent ? studentClassesLoading : teacherClassesLoading;

  const classes = allClasses.filter((c: Class) => {
    if (!centerId) return false;
    return c.centerId === centerId;
  });

  useEffect(() => {
    if (classes.length > 0) {
      if (!selectedClassId || !classes.find(c => c.id === selectedClassId)) {
        setSelectedClassId(classes[0].id);
      }
    }
  }, [classes, selectedClassId]);

  useEffect(() => {
    setHistoryStudentId("");
    setStudentSearchQuery("");
    setHistoryStudentSearch("");
  }, [selectedClassId]);

  const noteDate = format(selectedDate, "yyyy-MM-dd");

  const { data: classNotes, isLoading: classNotesLoading } = useQuery<ClassNoteWithTeacher[]>({
    queryKey: ["/api/class-notes", { classId: selectedClassId, noteDate }],
    queryFn: async () => {
      const res = await fetch(`/api/class-notes?classId=${selectedClassId}&noteDate=${noteDate}`);
      if (!res.ok) throw new Error("Failed to fetch class notes");
      return res.json();
    },
    enabled: !!selectedClassId,
  });

  const { data: allStudentNotes, isLoading: studentNotesLoading } = useQuery<StudentClassNoteWithDetails[]>({
    queryKey: ["/api/student-class-notes", { classId: selectedClassId, noteDate }],
    queryFn: async () => {
      const res = await fetch(`/api/student-class-notes?classId=${selectedClassId}&noteDate=${noteDate}`);
      if (!res.ok) throw new Error("Failed to fetch student class notes");
      return res.json();
    },
    enabled: !!selectedClassId,
  });

  const studentNotes = (() => {
    let notes = isStudentOrParent && viewingStudentId
      ? allStudentNotes?.filter(note => note.studentId === viewingStudentId)
      : allStudentNotes;
    if (!isStudentOrParent && studentSearchQuery.trim()) {
      const query = studentSearchQuery.trim().toLowerCase();
      notes = notes?.filter(note => note.student?.name?.toLowerCase().includes(query));
    }
    return notes;
  })();

  const { data: classStudents } = useQuery<any[]>({
    queryKey: ["/api/classes", selectedClassId, "students"],
    enabled: !!selectedClassId,
  });

  const historyStudents = classStudents || [];

  const { data: monthNoteDates } = useQuery<string[]>({
    queryKey: ["/api/class-notes/dates", { classId: selectedClassId, start: monthStartStr, end: monthEndStr }],
    queryFn: async () => {
      const res = await fetch(`/api/class-notes/dates?classId=${selectedClassId}&startDate=${monthStartStr}&endDate=${monthEndStr}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedClassId,
  });
  const noteDateSet = new Set(monthNoteDates || []);

  const { data: monthlyNotes, isLoading: monthlyNotesLoading } = useQuery<any[]>({
    queryKey: ["/api/student-class-notes/monthly", { studentId: historyStudentId, classId: selectedClassId, year: historyYear, month: historyMonth }],
    queryFn: async () => {
      const params = new URLSearchParams({
        studentId: historyStudentId,
        year: historyYear.toString(),
        month: historyMonth.toString(),
      });
      if (selectedClassId) params.set("classId", selectedClassId);
      const res = await fetch(`/api/student-class-notes/monthly?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch monthly notes");
      return res.json();
    },
    enabled: !!historyStudentId && !!selectedClassId && activeTab === "history",
  });

  const { data: monthlyClassNotes, isLoading: monthlyClassNotesLoading } = useQuery<any[]>({
    queryKey: ["/api/class-notes/monthly", { classId: selectedClassId, year: historyYear, month: historyMonth }],
    queryFn: async () => {
      const res = await fetch(`/api/class-notes/monthly?classId=${selectedClassId}&year=${historyYear}&month=${historyMonth}`);
      if (!res.ok) throw new Error("Failed to fetch monthly class notes");
      return res.json();
    },
    enabled: !!selectedClassId && activeTab === "history",
  });

  const deleteClassNoteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/class-notes/${id}`),
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/class-notes");
      toast({ title: "기록이 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const deleteStudentNoteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/student-class-notes/${id}`),
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/student-class-notes");
      toast({ title: "기록이 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (isStudentOrParent && viewingStudentId) {
      setHistoryStudentId(viewingStudentId);
    }
  }, [isStudentOrParent, viewingStudentId]);

  const handleAddNote = (type: "class" | "student") => {
    if (!isTeacher) return;
    setActiveTab(type);
    setEditorMode("create");
    setEditingNote(null);
    setEditorOpen(true);
  };

  const handleEditNote = (note: ClassNoteWithTeacher | StudentClassNoteWithDetails, type: "class" | "student") => {
    if (!isTeacher) return;
    setActiveTab(type);
    setEditorMode("edit");
    setEditingNote(note);
    setEditorOpen(true);
  };

  if (!user) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        로그인이 필요합니다.
      </div>
    );
  }

  if (isParent && children.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
        <Users className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">연결된 자녀가 없습니다</p>
        <p className="text-sm">관리자에게 자녀 계정 연결을 요청해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              수업 기록
            </h1>
            <ManualButton menuKey="class-notes" />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isParent && children.length > 0 && (
              <Select 
                value={selectedChildId} 
                onValueChange={(value) => {
                  setSelectedChildId(value);
                  setSelectedClassId("");
                }}
              >
                <SelectTrigger className="w-auto min-w-[120px]" data-testid="select-child">
                  <SelectValue placeholder="자녀 선택" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child: any) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.name} {child.grade ? `(${child.grade})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* View mode toggle for teacher and above */}
        {isTeacher && !isStudentOrParent && (
          <div className="flex gap-1.5">
            <Button
              variant={viewMode === "teacher" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setViewMode("teacher");
                setSelectedSearchStudentId("");
                setGlobalStudentSearch("");
              }}
              data-testid="button-teacher-mode"
            >
              <BookOpen className="h-3.5 w-3.5 mr-1" />
              {isPrincipalOrAbove ? "선생님별 조회" : "수업별 조회"}
            </Button>
            <Button
              variant={viewMode === "student-search" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("student-search")}
              data-testid="button-student-search-mode"
            >
              <Search className="h-3.5 w-3.5 mr-1" />
              학생 검색
            </Button>
          </div>
        )}

        {/* Student search mode */}
        {isTeacher && !isStudentOrParent && viewMode === "student-search" && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="학생 이름을 입력하세요"
                value={globalStudentSearch}
                onChange={(e) => {
                  setGlobalStudentSearch(e.target.value);
                  if (!e.target.value.trim()) {
                    setSelectedSearchStudentId("");
                  }
                }}
                className="pl-10"
                data-testid="input-global-student-search"
              />
            </div>
            {globalStudentSearch.trim() && filteredSearchStudents.length > 0 && !selectedSearchStudentId && (
              <div className="flex flex-wrap gap-1.5">
                {filteredSearchStudents.map((student: any) => (
                  <Button
                    key={student.id}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedSearchStudentId(student.id);
                      setGlobalStudentSearch(student.name);
                    }}
                    data-testid={`student-search-result-${student.id}`}
                  >
                    {student.name} {student.grade ? `(${student.grade})` : ""}
                  </Button>
                ))}
              </div>
            )}
            {globalStudentSearch.trim() && filteredSearchStudents.length === 0 && !selectedSearchStudentId && (
              <p className="text-sm text-muted-foreground">검색 결과가 없습니다</p>
            )}
            {selectedSearchStudentId && selectedSearchStudent && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-sm py-1">
                  <Users className="h-3.5 w-3.5 mr-1" />
                  {selectedSearchStudent.name} {selectedSearchStudent.grade ? `(${selectedSearchStudent.grade})` : ""}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedSearchStudentId("");
                    setGlobalStudentSearch("");
                  }}
                  className="h-7 text-xs"
                  data-testid="button-clear-student-search"
                >
                  <X className="h-3 w-3 mr-1" />
                  해제
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Teacher tabs for principal/admin */}
        {isPrincipalOrAbove && viewMode === "teacher" && teachers.length > 0 && (
          <Tabs value={selectedTeacherId} onValueChange={(v) => {
            setSelectedTeacherId(v);
            setSelectedClassId("");
          }}>
            <TabsList className="flex-wrap h-auto gap-1">
              {teachers.map((teacher: any) => (
                <TabsTrigger key={teacher.id} value={teacher.id} data-testid={`teacher-tab-${teacher.id}`}>
                  {teacher.name}{teacher.id === user?.id ? " (나)" : ""}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {/* Class buttons */}
        {viewMode === "teacher" && classes.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">수업:</span>
            <div className="flex flex-wrap gap-1.5">
              {classes.map((cls) => (
                <Button
                  key={cls.id}
                  variant={selectedClassId === cls.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedClassId(cls.id)}
                  data-testid={`class-filter-${cls.id}`}
                >
                  {cls.name} {cls.subject}반
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {viewMode === "student-search" && isTeacher && !isStudentOrParent ? (
          !selectedSearchStudentId ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>학생 이름을 검색하여 수업 기록을 조회하세요</p>
            </div>
          ) : (
            <>
              <Card className="mb-4">
                <CardContent className="pt-4 pb-3">
                  <MonthCalendar
                    currentMonth={currentMonth}
                    onMonthChange={setCurrentMonth}
                    selectedDate={selectedDate}
                    onDateSelect={setSelectedDate}
                    noteDates={searchNoteDateSet}
                  />
                  <div className="text-center mt-2">
                    <Badge variant="outline" className="text-xs">
                      {format(selectedDate, "M월 d일 (EEEE)", { locale: ko })}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Tabs value={searchHistoryTab} onValueChange={(v) => setSearchHistoryTab(v as "class" | "student" | "history")}>
                <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                  <TabsList>
                    <TabsTrigger value="class" data-testid="search-tab-class-notes">
                      <FileText className="h-4 w-4 mr-1" />
                      공통 기록
                    </TabsTrigger>
                    <TabsTrigger value="student" data-testid="search-tab-student-notes">
                      <Users className="h-4 w-4 mr-1" />
                      개별 기록
                    </TabsTrigger>
                    <TabsTrigger value="history" data-testid="search-tab-history">
                      <History className="h-4 w-4 mr-1" />
                      월별 조회
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="class" className="mt-0">
                  {searchDayClassNotesLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : searchDayClassNotes && searchDayClassNotes.length > 0 ? (
                    searchDayClassNotes.map((note: any, idx: number) => (
                      <Card key={`sdc-${note.id}-${idx}`} className="mb-3">
                        <CardContent className="pt-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                <FileText className="h-3 w-3 mr-1" />
                                공통 기록
                              </Badge>
                              {note.class_name && (
                                <Badge variant="outline" className="text-xs">
                                  {note.class_name} {note.class_subject ? `${note.class_subject}반` : ""}
                                </Badge>
                              )}
                              {note.teacher_name && (
                                <span className="text-xs text-muted-foreground">{note.teacher_name}</span>
                              )}
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>{format(selectedDate, "M월 d일", { locale: ko })} 공통 기록이 없습니다</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="student" className="mt-0">
                  {searchDayStudentNotesLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : searchDayStudentNotes && searchDayStudentNotes.length > 0 ? (
                    searchDayStudentNotes.map((note: any) => (
                      <Card key={`sds-${note.id}`} className="mb-3">
                        <CardContent className="pt-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              {note.attitude_score !== null && note.attitude_score !== undefined && (
                                <Badge 
                                  variant={note.attitude_score >= 8 ? "default" : note.attitude_score >= 5 ? "secondary" : "destructive"}
                                  className="text-xs"
                                >
                                  수업태도: {note.attitude_score}/10
                                </Badge>
                              )}
                              {note.class_name && (
                                <Badge variant="outline" className="text-xs">
                                  {note.class_name} {note.class_subject ? `${note.class_subject}반` : ""}
                                </Badge>
                              )}
                              {note.teacher_name && (
                                <span className="text-xs text-muted-foreground">{note.teacher_name}</span>
                              )}
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>{format(selectedDate, "M월 d일", { locale: ko })} 개별 기록이 없습니다</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="history" className="mt-0">
                  <Card className="mb-4">
                    <CardContent className="pt-4">
                      <div className="flex flex-wrap gap-3 items-end">
                        <div className="min-w-[100px]">
                          <label className="text-sm font-medium mb-1 block">년도</label>
                          <Select value={searchYear.toString()} onValueChange={(v) => setSearchYear(parseInt(v))}>
                            <SelectTrigger data-testid="select-search-year">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[2024, 2025, 2026, 2027].map((year) => (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}년
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="min-w-[80px]">
                          <label className="text-sm font-medium mb-1 block">월</label>
                          <Select value={searchMonth.toString()} onValueChange={(v) => setSearchMonth(parseInt(v))}>
                            <SelectTrigger data-testid="select-search-month">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                                <SelectItem key={month} value={month.toString()}>
                                  {month}월
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {(searchMonthlyStudentNotesLoading || searchMonthlyClassNotesLoading) ? (
                    <div className="space-y-3">
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                  ) : (() => {
                    const hasClassNotes = searchMonthlyClassNotes && searchMonthlyClassNotes.length > 0;
                    const hasStudentNotes = searchMonthlyStudentNotes && searchMonthlyStudentNotes.length > 0;

                    if (!hasClassNotes && !hasStudentNotes) {
                      return (
                        <Card>
                          <CardContent className="py-8 text-center text-muted-foreground">
                            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>{searchYear}년 {searchMonth}월 기록이 없습니다</p>
                          </CardContent>
                        </Card>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {hasClassNotes && (
                          <div>
                            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                              <BookOpen className="h-4 w-4" />
                              공통 기록
                            </h3>
                            <div className="space-y-3">
                              {searchMonthlyClassNotes!.map((note: any, idx: number) => (
                                <Card key={`smc-${note.id}-${idx}`}>
                                  <CardContent className="pt-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <Badge variant="outline" className="text-xs">
                                          {format(new Date(note.note_date), "M월 d일 (EEE)", { locale: ko })}
                                        </Badge>
                                        <Badge variant="default" className="text-xs">공통</Badge>
                                        {note.class_name && (
                                          <Badge variant="secondary" className="text-xs">
                                            {note.class_name} {note.class_subject ? `${note.class_subject}반` : ""}
                                          </Badge>
                                        )}
                                        {note.teacher_name && (
                                          <span className="text-xs text-muted-foreground">{note.teacher_name}</span>
                                        )}
                                      </div>
                                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}

                        {hasStudentNotes && (
                          <div>
                            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              개별 기록
                            </h3>
                            <div className="space-y-3">
                              {searchMonthlyStudentNotes!.map((note: any) => (
                                <Card key={`sms-${note.id}`}>
                                  <CardContent className="pt-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <Badge variant="outline" className="text-xs">
                                          {format(new Date(note.note_date), "M월 d일 (EEE)", { locale: ko })}
                                        </Badge>
                                        {note.attitude_score !== null && note.attitude_score !== undefined && (
                                          <Badge
                                            variant={note.attitude_score >= 8 ? "default" : note.attitude_score >= 5 ? "secondary" : "destructive"}
                                            className="text-xs"
                                          >
                                            태도 {note.attitude_score}/10
                                          </Badge>
                                        )}
                                        {note.class_name && (
                                          <Badge variant="secondary" className="text-xs">
                                            {note.class_name} {note.class_subject ? `${note.class_subject}반` : ""}
                                          </Badge>
                                        )}
                                        {note.teacher_name && (
                                          <span className="text-xs text-muted-foreground">{note.teacher_name}</span>
                                        )}
                                      </div>
                                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </TabsContent>
              </Tabs>
            </>
          )
        ) : classesLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : classes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {isStudentOrParent ? "등록된 수업이 없습니다" : "선생님을 선택해주세요"}
          </div>
        ) : !selectedClassId ? (
          <div className="text-center py-8 text-muted-foreground">
            수업을 선택해주세요
          </div>
        ) : (
          <>
            {/* Monthly Calendar */}
            <Card className="mb-4">
              <CardContent className="pt-4 pb-3">
                <MonthCalendar
                  currentMonth={currentMonth}
                  onMonthChange={setCurrentMonth}
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  noteDates={noteDateSet}
                />
                <div className="text-center mt-2">
                  <Badge variant="outline" className="text-xs">
                    {format(selectedDate, "M월 d일 (EEEE)", { locale: ko })}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Tabs below calendar */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "class" | "student" | "history")}>
              <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                <TabsList>
                  <TabsTrigger value="class" data-testid="tab-class-notes">
                    <FileText className="h-4 w-4 mr-1" />
                    공통 기록
                  </TabsTrigger>
                  <TabsTrigger value="student" data-testid="tab-student-notes">
                    <Users className="h-4 w-4 mr-1" />
                    {isStudentOrParent ? (isParent ? "자녀 기록" : "나의 기록") : "학생별 기록"}
                  </TabsTrigger>
                  <TabsTrigger value="history" data-testid="tab-history-notes">
                    <History className="h-4 w-4 mr-1" />
                    월별 조회
                  </TabsTrigger>
                </TabsList>

                {isTeacher && activeTab !== "history" && (
                  <Button size="sm" onClick={() => handleAddNote(activeTab as "class" | "student")} data-testid="button-add-note">
                    <Plus className="h-4 w-4 mr-1" />
                    기록 추가
                  </Button>
                )}
              </div>

              <TabsContent value="class" className="mt-0">
                {classNotesLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : classNotes && classNotes.length > 0 ? (
                  classNotes.map((note) => (
                    <ClassNoteCard
                      key={note.id}
                      note={note}
                      onEdit={() => handleEditNote(note, "class")}
                      onDelete={() => deleteClassNoteMutation.mutate(note.id)}
                      canEdit={user.role >= UserRole.TEACHER}
                    />
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>{format(selectedDate, "M월 d일", { locale: ko })} 공통 기록이 없습니다</p>
                      {isTeacher && (
                        <Button
                          variant="ghost"
                          className="mt-2"
                          onClick={() => handleAddNote("class")}
                          data-testid="button-add-first-class-note"
                        >
                          기록 추가하기
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="student" className="mt-0">
                {!isStudentOrParent && (
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="학생 이름으로 검색"
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-student-notes"
                    />
                  </div>
                )}
                {studentNotesLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : studentNotes && studentNotes.length > 0 ? (
                  studentNotes.map((note) => (
                    <StudentNoteCard
                      key={note.id}
                      note={note}
                      onEdit={() => handleEditNote(note, "student")}
                      onDelete={() => deleteStudentNoteMutation.mutate(note.id)}
                      canEdit={user.role >= UserRole.TEACHER}
                      showStudentName={!isStudentOrParent}
                    />
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>{format(selectedDate, "M월 d일", { locale: ko })} {isStudentOrParent ? (isParent ? "자녀 기록이" : "나의 기록이") : "학생별 기록이"} 없습니다</p>
                      {isTeacher && (
                        <Button
                          variant="ghost"
                          className="mt-2"
                          onClick={() => handleAddNote("student")}
                          data-testid="button-add-first-student-note"
                        >
                          기록 추가하기
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* History Tab - Monthly view by student */}
              <TabsContent value="history" className="mt-0">
                <Card className="mb-4">
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap gap-3 items-end">
                      {!isStudentOrParent && (
                        <div className="flex-1 min-w-[150px]">
                          <label className="text-sm font-medium mb-1 block">학생 선택</label>
                          <Select value={historyStudentId} onValueChange={setHistoryStudentId}>
                            <SelectTrigger data-testid="select-history-student">
                              <SelectValue placeholder="학생을 선택하세요" />
                            </SelectTrigger>
                            <SelectContent>
                              <div className="px-2 pb-2 sticky top-0 bg-popover z-10">
                                <Input
                                  placeholder="이름 검색..."
                                  className="h-8 text-sm"
                                  value={historyStudentSearch}
                                  onChange={(e) => setHistoryStudentSearch(e.target.value)}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={(e) => e.stopPropagation()}
                                  onFocus={(e) => e.stopPropagation()}
                                  data-testid="input-search-history-student"
                                />
                              </div>
                              {(historyStudents || [])
                                .filter((student: any) => !historyStudentSearch.trim() || student.name?.toLowerCase().includes(historyStudentSearch.trim().toLowerCase()))
                                .map((student: any) => (
                                <SelectItem key={student.id} value={student.id}>
                                  {student.name} {student.grade ? `(${student.grade})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="min-w-[100px]">
                        <label className="text-sm font-medium mb-1 block">년도</label>
                        <Select value={historyYear.toString()} onValueChange={(v) => setHistoryYear(parseInt(v))}>
                          <SelectTrigger data-testid="select-history-year">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[2024, 2025, 2026, 2027].map((year) => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}년
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="min-w-[80px]">
                        <label className="text-sm font-medium mb-1 block">월</label>
                        <Select value={historyMonth.toString()} onValueChange={(v) => setHistoryMonth(parseInt(v))}>
                          <SelectTrigger data-testid="select-history-month">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                              <SelectItem key={month} value={month.toString()}>
                                {month}월
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {(monthlyClassNotesLoading || (historyStudentId && monthlyNotesLoading)) ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : (() => {
                  const hasClassNotes = monthlyClassNotes && monthlyClassNotes.length > 0;
                  const hasStudentNotes = historyStudentId && monthlyNotes && monthlyNotes.length > 0;
                  const hasAnyNotes = hasClassNotes || hasStudentNotes;

                  if (!hasAnyNotes) {
                    return (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>{historyYear}년 {historyMonth}월 기록이 없습니다</p>
                        </CardContent>
                      </Card>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {hasClassNotes && (
                        <div>
                          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            공통 기록
                          </h3>
                          <div className="space-y-3">
                            {monthlyClassNotes!.map((note: any) => (
                              <Card key={`class-${note.id}`}>
                                <CardContent className="pt-4">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <Badge variant="outline" className="text-xs">
                                          {format(new Date(note.note_date), "M월 d일 (EEE)", { locale: ko })}
                                        </Badge>
                                        <Badge variant="default" className="text-xs">공통</Badge>
                                        {note.class_name && (
                                          <Badge variant="secondary" className="text-xs">
                                            {note.class_name} {note.class_subject ? `${note.class_subject}반` : ""}
                                          </Badge>
                                        )}
                                        {note.teacher_name && (
                                          <span className="text-xs text-muted-foreground">
                                            {note.teacher_name}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {hasStudentNotes && (
                        <div>
                          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            학생별 기록
                          </h3>
                          <div className="space-y-3">
                            {monthlyNotes!.map((note: any) => (
                              <Card key={`student-${note.id}`}>
                                <CardContent className="pt-4">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <Badge variant="outline" className="text-xs">
                                          {format(new Date(note.note_date), "M월 d일 (EEE)", { locale: ko })}
                                        </Badge>
                                        {note.attitude_score !== null && (
                                          <Badge 
                                            variant={note.attitude_score >= 8 ? "default" : note.attitude_score >= 5 ? "secondary" : "destructive"}
                                            className="text-xs"
                                          >
                                            태도 {note.attitude_score}/10
                                          </Badge>
                                        )}
                                        {note.class_name && (
                                          <Badge variant="secondary" className="text-xs">
                                            {note.class_name} {note.class_subject ? `${note.class_subject}반` : ""}
                                          </Badge>
                                        )}
                                        {note.teacher_name && (
                                          <span className="text-xs text-muted-foreground">
                                            {note.teacher_name}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {/* Note Editor Dialog - Only for teachers */}
      {isTeacher && (
        <NoteEditor
          isOpen={editorOpen}
          onClose={() => {
            setEditorOpen(false);
            setEditingNote(null);
          }}
          mode={editorMode}
          noteType={activeTab === "history" ? "student" : activeTab}
          classId={selectedClassId}
          teacherId={selectedTeacherId}
          selectedDate={selectedDate}
          editingNote={editingNote}
          students={classStudents}
        />
      )}
    </div>
  );
}
