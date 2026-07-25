import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserRole, isAssistantTeacher, type User, type Class, type WorkJournal, type WorkJournalClassNote, type WorkJournalStudentNote, type Enrollment } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isToday, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ManualButton } from "@/components/manual-button";
import {
  Plus, Loader2, Pencil, Trash2, FileText,
  ChevronLeft, ChevronRight, BookOpen, Users, User as UserIcon, ClipboardList, Check, ChevronsUpDown
} from "lucide-react";
import { cn } from "@/lib/utils";

type JournalWithDetails = WorkJournal & {
  classNotes: WorkJournalClassNote[];
  studentNotes: WorkJournalStudentNote[];
};

function ClassNoteRow({ idx, cn: classNote, myClasses, formClassNotes, setFormClassNotes }: {
  idx: number;
  cn: { classId: string; notes: string };
  myClasses: Class[];
  formClassNotes: { classId: string; notes: string }[];
  setFormClassNotes: (v: { classId: string; notes: string }[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedClass = myClasses.find(c => c.id === classNote.classId);
  const filtered = myClasses.filter(c => {
    const label = `${c.name} ${c.subject || ""}`.toLowerCase();
    return label.includes(search.toLowerCase());
  });

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="flex-1 justify-between font-normal" data-testid={`select-class-${idx}`}>
              {selectedClass ? `${selectedClass.name} ${selectedClass.subject || ""}` : "반 검색..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[300px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput placeholder="반 이름 검색..." value={search} onValueChange={setSearch} />
              <CommandList>
                <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                <CommandGroup>
                  {filtered.map(c => (
                    <CommandItem
                      key={c.id}
                      value={c.id}
                      onSelect={() => {
                        const updated = [...formClassNotes];
                        updated[idx].classId = c.id;
                        setFormClassNotes(updated);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", classNote.classId === c.id ? "opacity-100" : "opacity-0")} />
                      {c.name} {c.subject || ""}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" onClick={() => {
          setFormClassNotes(formClassNotes.filter((_, i) => i !== idx));
        }} data-testid={`button-remove-class-${idx}`}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <Textarea
        placeholder="반별 업무 내용..."
        value={classNote.notes}
        onChange={e => {
          const updated = [...formClassNotes];
          updated[idx].notes = e.target.value;
          setFormClassNotes(updated);
        }}
        rows={3}
        data-testid={`textarea-class-note-${idx}`}
      />
    </div>
  );
}

function StudentNoteRow({ idx, sn, students, formStudentNotes, setFormStudentNotes }: {
  idx: number;
  sn: { studentId: string; notes: string };
  students: User[];
  formStudentNotes: { studentId: string; notes: string }[];
  setFormStudentNotes: (v: { studentId: string; notes: string }[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedStudent = students.find(s => s.id === sn.studentId);
  const filtered = students.filter(s => {
    const label = `${s.name} ${s.grade || ""}`.toLowerCase();
    return label.includes(search.toLowerCase());
  });

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="flex-1 justify-between font-normal" data-testid={`select-student-${idx}`}>
              {selectedStudent ? `${selectedStudent.name}${selectedStudent.grade ? ` (${selectedStudent.grade})` : ""}` : "학생 검색..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[300px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput placeholder="학생 이름 검색..." value={search} onValueChange={setSearch} />
              <CommandList>
                <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                <CommandGroup>
                  {filtered.map(s => (
                    <CommandItem
                      key={s.id}
                      value={s.id}
                      onSelect={() => {
                        const updated = [...formStudentNotes];
                        updated[idx].studentId = s.id;
                        setFormStudentNotes(updated);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", sn.studentId === s.id ? "opacity-100" : "opacity-0")} />
                      {s.name} {s.grade ? `(${s.grade})` : ""}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" onClick={() => {
          setFormStudentNotes(formStudentNotes.filter((_, i) => i !== idx));
        }} data-testid={`button-remove-student-${idx}`}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <Textarea
        placeholder="학생별 업무 내용..."
        value={sn.notes}
        onChange={e => {
          const updated = [...formStudentNotes];
          updated[idx].notes = e.target.value;
          setFormStudentNotes(updated);
        }}
        rows={3}
        data-testid={`textarea-student-note-${idx}`}
      />
    </div>
  );
}

export default function WorkJournalPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const centerId = selectedCenter?.id || "";

  const isTeacher = user?.role === UserRole.TEACHER || user?.role === UserRole.CLINIC_TEACHER;
  const isManager = user ? user.role >= UserRole.PRINCIPAL : false;

  const todayKST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(todayKST));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("all");

  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingJournal, setEditingJournal] = useState<JournalWithDetails | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedJournalId, setExpandedJournalId] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, JournalWithDetails>>({});

  const [formCommonNotes, setFormCommonNotes] = useState("");
  const [formClassNotes, setFormClassNotes] = useState<{ classId: string; notes: string }[]>([]);
  const [formStudentNotes, setFormStudentNotes] = useState<{ studentId: string; notes: string }[]>([]);

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: [`/api/users?centerId=${centerId}`],
    enabled: !!centerId,
  });

  const teachers = useMemo(() =>
    allUsers.filter(u => u.role === 2 || u.role === 3),
    [allUsers]
  );

  const { data: classes = [] } = useQuery<Class[]>({
    queryKey: [`/api/classes?centerId=${centerId}`],
    enabled: !!centerId,
  });

  const { data: enrollments = [] } = useQuery<Enrollment[]>({
    queryKey: [`/api/enrollments?centerId=${centerId}`],
    enabled: !!centerId,
  });

  const effectiveTeacherId = useMemo(() => {
    if (isManager && selectedTeacherId !== "all") return selectedTeacherId;
    if (isManager) return null;
    return user?.id || null;
  }, [isManager, selectedTeacherId, user]);

  const myClasses = useMemo(() => {
    if (!user) return [];
    if (isManager && !effectiveTeacherId) return classes;
    const tid = effectiveTeacherId || user.id;
    return classes.filter(c => c.teacherId === tid || isAssistantTeacher(c, tid));
  }, [classes, user, isManager, effectiveTeacherId]);

  const students = useMemo(() => {
    const allStudents = allUsers.filter(u => u.role === UserRole.STUDENT);
    if (isManager && !effectiveTeacherId) return allStudents;
    const myClassIds = new Set(myClasses.map(c => c.id));
    const enrolledStudentIds = new Set(
      enrollments.filter(e => myClassIds.has(e.classId)).map(e => e.studentId)
    );
    return allStudents.filter(s => enrolledStudentIds.has(s.id));
  }, [allUsers, myClasses, enrollments, isManager, effectiveTeacherId]);

  const queryTeacherId = isManager
    ? (selectedTeacherId === "all" ? undefined : selectedTeacherId)
    : user?.id;

  const journalQueryUrl = queryTeacherId
    ? `/api/work-journals?actorId=${user?.id}&centerId=${centerId}&teacherId=${queryTeacherId}`
    : `/api/work-journals?actorId=${user?.id}&centerId=${centerId}`;

  const { data: journals = [], isLoading } = useQuery<WorkJournal[]>({
    queryKey: ["/api/work-journals", centerId, queryTeacherId],
    queryFn: async () => {
      const res = await fetch(journalQueryUrl);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!centerId && !!user?.id,
  });

  const journalsByDate = useMemo(() => {
    const map: Record<string, WorkJournal[]> = {};
    journals.forEach(j => {
      let key = "";
      if (j.periodType === "day") {
        key = j.periodValue;
      } else if (j.periodType === "week") {
        const match = j.periodValue.match(/^(\d{4})-W(\d{1,2})$/);
        if (match) {
          const year = parseInt(match[1]);
          const week = parseInt(match[2]);
          const jan4 = new Date(year, 0, 4);
          const jan4Dow = jan4.getDay() || 7;
          const monday = new Date(jan4);
          monday.setDate(jan4.getDate() - (jan4Dow - 1) + (week - 1) * 7);
          key = format(monday, "yyyy-MM-dd");
        }
      } else if (j.periodType === "month") {
        key = j.periodValue + "-01";
      }
      if (key) {
        if (!map[key]) map[key] = [];
        map[key].push(j);
      }
    });
    return map;
  }, [journals]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const selectedDateJournals = useMemo(() => {
    if (!selectedDate) return [];
    return journalsByDate[selectedDate] || [];
  }, [selectedDate, journalsByDate]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/work-journals", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-journals"] });
      setShowFormDialog(false);
      resetForm();
      toast({ title: "업무일지가 저장되었습니다." });
    },
    onError: (err: any) => {
      toast({ title: "저장 실패", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/work-journals/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-journals"] });
      setEditingJournal(null);
      setShowFormDialog(false);
      resetForm();
      toast({ title: "업무일지가 수정되었습니다." });
    },
    onError: (err: any) => {
      toast({ title: "수정 실패", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/work-journals/${id}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-journals"] });
      setDeleteConfirmId(null);
      setViewingJournal(null);
      toast({ title: "업무일지가 삭제되었습니다." });
    },
    onError: (err: any) => {
      toast({ title: "삭제 실패", description: err.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setFormCommonNotes("");
    setFormClassNotes([]);
    setFormStudentNotes([]);
    setEditingJournal(null);
  }

  function openCreateForDate(dateStr: string) {
    resetForm();
    setSelectedDate(dateStr);
    setShowFormDialog(true);
  }

  async function openEdit(journal: WorkJournal) {
    const res = await fetch(`/api/work-journals/${journal.id}?actorId=${user?.id}`);
    const full: JournalWithDetails = await res.json();
    setFormCommonNotes(full.commonNotes || "");
    setFormClassNotes(full.classNotes.map(cn => ({ classId: cn.classId, notes: cn.notes || "" })));
    setFormStudentNotes(full.studentNotes.map(sn => ({ studentId: sn.studentId, notes: sn.notes || "" })));
    setEditingJournal(full);
    setShowFormDialog(true);
  }

  async function toggleExpand(journal: WorkJournal) {
    if (expandedJournalId === journal.id) {
      setExpandedJournalId(null);
      return;
    }
    if (!expandedDetails[journal.id]) {
      const res = await fetch(`/api/work-journals/${journal.id}?actorId=${user?.id}`);
      const full: JournalWithDetails = await res.json();
      setExpandedDetails(prev => ({ ...prev, [journal.id]: full }));
    }
    setExpandedJournalId(journal.id);
  }

  function handleSubmit() {
    if (!centerId) {
      toast({ title: "센터를 선택해주세요.", variant: "destructive" });
      return;
    }
    const dateStr = editingJournal ? editingJournal.periodValue : selectedDate;
    if (!dateStr) {
      toast({ title: "날짜를 선택해주세요.", variant: "destructive" });
      return;
    }
    const data = {
      actorId: user?.id,
      centerId,
      periodType: "day",
      periodValue: dateStr,
      commonNotes: formCommonNotes || "",
      classNotes: formClassNotes.filter(item => item.notes.trim()),
      studentNotes: formStudentNotes.filter(item => item.notes.trim()),
    };
    if (editingJournal) {
      updateMutation.mutate({ id: editingJournal.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  function addClassNote() {
    const usedIds = formClassNotes.map(cn => cn.classId);
    const available = myClasses.filter(c => !usedIds.includes(c.id));
    if (available.length === 0) {
      toast({ title: "추가 가능한 반이 없습니다.", variant: "destructive" });
      return;
    }
    setFormClassNotes([...formClassNotes, { classId: available[0].id, notes: "" }]);
  }

  function addStudentNote() {
    const usedIds = formStudentNotes.map(sn => sn.studentId);
    const available = students.filter(s => !usedIds.includes(s.id));
    if (available.length === 0) {
      toast({ title: "추가 가능한 학생이 없습니다.", variant: "destructive" });
      return;
    }
    setFormStudentNotes([...formStudentNotes, { studentId: available[0].id, notes: "" }]);
  }

  function getTeacherName(teacherId: string) {
    return allUsers.find(u => u.id === teacherId)?.name || "알 수 없음";
  }
  function getClassName(classId: string) {
    const cls = classes.find(c => c.id === classId);
    return cls ? `${cls.name} ${cls.subject || ""}` : "알 수 없음";
  }
  function getStudentName(studentId: string) {
    return allUsers.find(u => u.id === studentId)?.name || "알 수 없음";
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const formDateLabel = editingJournal
    ? format(parseISO(editingJournal.periodValue), "yyyy년 M월 d일 (EEE)", { locale: ko })
    : selectedDate
      ? format(parseISO(selectedDate), "yyyy년 M월 d일 (EEE)", { locale: ko })
      : "";

  const formContent = (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          공통 업무 기록
        </Label>
        <Textarea
          placeholder="공통 업무 내용을 입력하세요..."
          value={formCommonNotes}
          onChange={e => setFormCommonNotes(e.target.value)}
          rows={4}
          data-testid="textarea-common-notes"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            반별 업무 기록
          </Label>
          <Button variant="outline" size="sm" onClick={addClassNote} data-testid="button-add-class-note">
            <Plus className="h-3 w-3 mr-1" /> 반 추가
          </Button>
        </div>
        {formClassNotes.map((classNote, idx) => (
          <ClassNoteRow
            key={idx}
            idx={idx}
            cn={classNote}
            myClasses={myClasses}
            formClassNotes={formClassNotes}
            setFormClassNotes={setFormClassNotes}
          />
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            학생별 업무 기록
          </Label>
          <Button variant="outline" size="sm" onClick={addStudentNote} data-testid="button-add-student-note">
            <Plus className="h-3 w-3 mr-1" /> 학생 추가
          </Button>
        </div>
        {formStudentNotes.map((sn, idx) => (
          <StudentNoteRow
            key={idx}
            idx={idx}
            sn={sn}
            students={students}
            formStudentNotes={formStudentNotes}
            setFormStudentNotes={setFormStudentNotes}
          />
        ))}
      </div>
    </div>
  );

  if (!centerId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">센터를 선택해주세요.</p>
      </div>
    );
  }

  const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6" />
          <h1 className="text-2xl font-bold">업무일지</h1>
        </div>
        <ManualButton featureKey="work-journal" />
      </div>

      {isManager && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedTeacherId === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedTeacherId("all")}
            data-testid="button-teacher-all"
          >
            전체
          </Button>
          {teachers.map(t => (
            <Button
              key={t.id}
              variant={selectedTeacherId === t.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTeacherId(t.id)}
              data-testid={`button-teacher-${t.id}`}
            >
              {t.name}
            </Button>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} data-testid="button-prev-month">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold" data-testid="text-current-month">
              {format(currentMonth, "yyyy년 M월", { locale: ko })}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} data-testid="button-next-month">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {weekDays.map((day, i) => (
              <div
                key={day}
                className={cn(
                  "text-center text-xs font-medium py-2 bg-muted",
                  i === 0 && "text-red-500",
                  i === 6 && "text-blue-500"
                )}
              >
                {day}
              </div>
            ))}

            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-background min-h-[60px] sm:min-h-[80px]" />
            ))}

            {daysInMonth.map(day => {
              const dateStr = format(day, "yyyy-MM-dd");
              const dayJournals = journalsByDate[dateStr] || [];
              const hasJournal = dayJournals.length > 0;
              const dayOfWeek = getDay(day);
              const isSelected = selectedDate === dateStr;
              const isTodayDate = isToday(day);

              return (
                <div
                  key={dateStr}
                  className={cn(
                    "bg-background min-h-[60px] sm:min-h-[80px] p-1 cursor-pointer transition-colors hover:bg-accent/50 relative",
                    isSelected && "ring-2 ring-primary ring-inset",
                    isTodayDate && "bg-primary/5"
                  )}
                  onClick={() => setSelectedDate(dateStr)}
                  data-testid={`calendar-day-${dateStr}`}
                >
                  <span className={cn(
                    "text-xs sm:text-sm font-medium inline-flex items-center justify-center w-6 h-6 rounded-full",
                    dayOfWeek === 0 && "text-red-500",
                    dayOfWeek === 6 && "text-blue-500",
                    isTodayDate && "bg-primary text-primary-foreground"
                  )}>
                    {format(day, "d")}
                  </span>
                  {hasJournal && (
                    <div className="mt-0.5 space-y-0.5">
                      {dayJournals.slice(0, 2).map(j => (
                        <div
                          key={j.id}
                          className="text-[10px] leading-tight truncate px-1 py-0.5 rounded bg-primary/10 text-primary"
                        >
                          {isManager ? getTeacherName(j.teacherId) : (j.commonNotes?.substring(0, 10) || "기록")}
                        </div>
                      ))}
                      {dayJournals.length > 2 && (
                        <div className="text-[10px] text-muted-foreground px-1">
                          +{dayJournals.length - 2}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedDate && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base" data-testid="text-selected-date">
                {format(parseISO(selectedDate), "M월 d일 (EEE)", { locale: ko })}
              </h3>
              {(isTeacher || isManager) && (
                <Button size="sm" onClick={() => openCreateForDate(selectedDate)} data-testid="button-create-journal">
                  <Plus className="h-4 w-4 mr-1" /> 작성
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-16">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : selectedDateJournals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">작성된 업무일지가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDateJournals.map(journal => {
                  const isExpanded = expandedJournalId === journal.id;
                  const detail = expandedDetails[journal.id];
                  return (
                    <div
                      key={journal.id}
                      className="border rounded-lg overflow-hidden transition-colors"
                      data-testid={`card-journal-${journal.id}`}
                    >
                      <div
                        className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => toggleExpand(journal)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <ChevronRight className={cn("h-4 w-4 flex-shrink-0 transition-transform", isExpanded && "rotate-90")} />
                            <div className="flex-1 min-w-0">
                              {isManager && (
                                <Badge variant="outline" className="text-xs mb-1">
                                  {getTeacherName(journal.teacherId)}
                                </Badge>
                              )}
                              
                            </div>
                          </div>
                          {(journal.teacherId === user?.id || isManager) && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); openEdit(journal); }} data-testid={`button-edit-${journal.id}`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); setDeleteConfirmId(journal.id); }} data-testid={`button-delete-${journal.id}`}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t px-3 pb-3 pt-2 space-y-3 bg-muted/20">
                          {!detail ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          ) : (
                            <>
                              {detail.commonNotes && (
                                <div className="space-y-1">
                                  <Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                                    <ClipboardList className="h-3.5 w-3.5" />
                                    공통 업무
                                  </Label>
                                  <div className="bg-background rounded-md p-2.5 text-sm whitespace-pre-wrap">
                                    {detail.commonNotes}
                                  </div>
                                </div>
                              )}

                              {detail.classNotes.length > 0 && (
                                <div className="space-y-1.5">
                                  <Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                                    <BookOpen className="h-3.5 w-3.5" />
                                    반별 업무
                                  </Label>
                                  {detail.classNotes.map(cnote => (
                                    <div key={cnote.id} className="bg-background rounded-md p-2.5">
                                      <div className="font-medium text-xs mb-1 text-primary">{getClassName(cnote.classId)}</div>
                                      <div className="text-sm whitespace-pre-wrap">{cnote.notes}</div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {detail.studentNotes.length > 0 && (
                                <div className="space-y-1.5">
                                  <Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                                    <UserIcon className="h-3.5 w-3.5" />
                                    학생별 업무
                                  </Label>
                                  {detail.studentNotes.map(snote => (
                                    <div key={snote.id} className="bg-background rounded-md p-2.5">
                                      <div className="font-medium text-xs mb-1 text-primary">{getStudentName(snote.studentId)}</div>
                                      <div className="text-sm whitespace-pre-wrap">{snote.notes}</div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {!detail.commonNotes && detail.classNotes.length === 0 && detail.studentNotes.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-2">기록된 내용이 없습니다.</p>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showFormDialog} onOpenChange={open => {
        if (!open) { setShowFormDialog(false); resetForm(); }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingJournal ? "업무일지 수정" : "업무일지 작성"}</DialogTitle>
            <DialogDescription>{formDateLabel}</DialogDescription>
          </DialogHeader>
          {formContent}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowFormDialog(false); resetForm(); }}>
              취소
            </Button>
            <Button onClick={handleSubmit} disabled={isPending} data-testid="button-submit-journal">
              {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingJournal ? "수정" : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onOpenChange={open => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>업무일지 삭제</DialogTitle>
            <DialogDescription>정말 이 업무일지를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>취소</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
