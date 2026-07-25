import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole, isAssistantTeacher, getAssistantTeacherIds, type User, type CounselingRecord, type Class, type Enrollment } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ManualButton } from "@/components/manual-button";
import { ChevronLeft, Plus, Search, Loader2, Pencil, Trash2, User as UserIcon, Calendar, FileText, GraduationCap } from "lucide-react";

const GRADE_ORDER = ["초1","초2","초3","초4","초5","초6","중1","중2","중3","고1","고2","고3","성인"];

const GRADE_LEVEL_MAP: Record<string, string> = {
  "초1": "elementary", "초2": "elementary", "초3": "elementary",
  "초4": "elementary", "초5": "elementary", "초6": "elementary",
  "중1": "middle", "중2": "middle", "중3": "middle",
  "고1": "high", "고2": "high", "고3": "high",
  "성인": "adult",
};

function normalizeGrade(grade: string | null | undefined): string {
  if (!grade) return "";
  const mapping: Record<string, string> = {
    "초등학교 1학년": "초1", "초등학교 2학년": "초2", "초등학교 3학년": "초3",
    "초등학교 4학년": "초4", "초등학교 5학년": "초5", "초등학교 6학년": "초6",
    "중학교 1학년": "중1", "중학교 2학년": "중2", "중학교 3학년": "중3",
    "고등학교 1학년": "고1", "고등학교 2학년": "고2", "고등학교 3학년": "고3",
  };
  return mapping[grade] || grade;
}

export default function CounselingPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [schoolLevel, setSchoolLevel] = useState<"all" | "elementary" | "middle" | "high" | "adult">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CounselingRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [detailTeacherFilter, setDetailTeacherFilter] = useState<string | null>(null);

  const centerId = selectedCenter?.id || "";

  const { data: allUsers = [], isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: [`/api/users?centerId=${centerId}`],
    enabled: !!centerId,
  });

  const { data: allRecords = [], isLoading: loadingRecords } = useQuery<CounselingRecord[]>({
    queryKey: ["/api/counseling-records", centerId],
    queryFn: async () => {
      const res = await fetch(`/api/counseling-records?centerId=${centerId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!centerId,
  });

  const isTeacherOnly = user?.role === UserRole.TEACHER || user?.role === UserRole.CLINIC_TEACHER;
  const isManagerOrAbove = user ? user.role >= UserRole.PRINCIPAL : false;

  const { data: allClasses = [], isLoading: loadingClasses } = useQuery<Class[]>({
    queryKey: [`/api/classes?centerId=${centerId}`],
    enabled: !!centerId && (isTeacherOnly || isManagerOrAbove),
  });

  const { data: enrollments = [], isLoading: loadingEnrollments } = useQuery<Enrollment[]>({
    queryKey: ["/api/enrollments", centerId],
    queryFn: async () => {
      const res = await fetch(`/api/enrollments?centerId=${centerId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!centerId && (isTeacherOnly || isManagerOrAbove),
  });

  const teacherList = useMemo(() => {
    const teacherIds = new Set(
      allClasses.filter(c => !c.isArchived && c.teacherId).map(c => c.teacherId!)
    );
    allClasses.filter(c => !c.isArchived).forEach(c => getAssistantTeacherIds(c).forEach(aid => teacherIds.add(aid)));
    return allUsers
      .filter(u => teacherIds.has(u.id))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [allClasses, allUsers]);

  const filteredStudentIds = useMemo(() => {
    const targetTeacherId = isTeacherOnly ? user?.id : selectedTeacherId;
    if (!targetTeacherId) return null;

    const myClassIds = new Set(
      allClasses
        .filter(c => !c.isArchived && (c.teacherId === targetTeacherId || isAssistantTeacher(c, targetTeacherId)))
        .map(c => c.id)
    );
    const studentIds = new Set<string>();
    enrollments.forEach(e => {
      if (myClassIds.has(e.classId)) studentIds.add(e.studentId);
    });
    return studentIds;
  }, [isTeacherOnly, user, allClasses, enrollments, selectedTeacherId]);

  const students = useMemo(() => {
    return allUsers
      .filter(u => {
        if (u.role !== UserRole.STUDENT) return false;
        if (filteredStudentIds && !filteredStudentIds.has(u.id)) return false;
        if (schoolLevel === "all") return true;
        const ng = normalizeGrade(u.grade);
        return GRADE_LEVEL_MAP[ng] === schoolLevel;
      })
      .filter(u => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return u.name.toLowerCase().includes(q) || u.school?.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const ag = GRADE_ORDER.indexOf(normalizeGrade(a.grade));
        const bg = GRADE_ORDER.indexOf(normalizeGrade(b.grade));
        const ga = ag !== -1 ? ag : 99;
        const gb = bg !== -1 ? bg : 99;
        if (ga !== gb) return ga - gb;
        return a.name.localeCompare(b.name, "ko");
      });
  }, [allUsers, schoolLevel, searchQuery, filteredStudentIds]);

  const recordCountByStudent = useMemo(() => {
    const map = new Map<string, number>();
    const filtered = selectedTeacherId
      ? allRecords.filter(r => r.teacherId === selectedTeacherId)
      : allRecords;
    filtered.forEach(r => {
      map.set(r.studentId, (map.get(r.studentId) || 0) + 1);
    });
    return map;
  }, [allRecords, selectedTeacherId]);

  const studentRecords = useMemo(() => {
    if (!selectedStudent) return [];
    return allRecords
      .filter(r => r.studentId === selectedStudent.id)
      .filter(r => !detailTeacherFilter || r.teacherId === detailTeacherFilter)
      .sort((a, b) => new Date(b.counselingDate).getTime() - new Date(a.counselingDate).getTime());
  }, [allRecords, selectedStudent, detailTeacherFilter]);

  const teachers = useMemo(() => {
    const map = new Map<string, User>();
    allUsers.filter(u => u.role >= UserRole.TEACHER).forEach(u => map.set(u.id, u));
    return map;
  }, [allUsers]);

  const detailTeacherList = useMemo(() => {
    if (!selectedStudent) return [];
    const teacherIds = new Set(
      allRecords.filter(r => r.studentId === selectedStudent.id).map(r => r.teacherId)
    );
    return allUsers
      .filter(u => teacherIds.has(u.id))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [selectedStudent, allRecords, allUsers]);

  const createMutation = useMutation({
    mutationFn: (data: { counselingDate: string; content: string }) =>
      apiRequest("POST", "/api/counseling-records", {
        centerId,
        studentId: selectedStudent!.id,
        teacherId: user!.id,
        counselingDate: data.counselingDate,
        content: data.content,
      }),
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/counseling-records");
      toast({ title: "상담 일지가 작성되었습니다" });
      setShowCreateDialog(false);
    },
    onError: () => toast({ title: "저장에 실패했습니다", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; counselingDate: string; content: string }) =>
      apiRequest("PATCH", `/api/counseling-records/${data.id}`, {
        counselingDate: data.counselingDate,
        content: data.content,
      }),
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/counseling-records");
      toast({ title: "상담 일지가 수정되었습니다" });
      setEditingRecord(null);
    },
    onError: () => toast({ title: "수정에 실패했습니다", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/counseling-records/${id}`),
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/counseling-records");
      toast({ title: "상담 일지가 삭제되었습니다" });
      setDeleteConfirmId(null);
    },
    onError: () => toast({ title: "삭제에 실패했습니다", variant: "destructive" }),
  });

  if (!user || !selectedCenter) return null;
  const isStaff = user.role >= UserRole.TEACHER;

  const isLoading = loadingUsers || ((isTeacherOnly || isManagerOrAbove) && (loadingClasses || loadingEnrollments));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (selectedStudent) {
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto" data-testid="counseling-detail-page">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedStudent(null)} data-testid="button-back">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate" data-testid="text-student-name">{selectedStudent.name}</h1>
            <p className="text-sm text-muted-foreground">
              {normalizeGrade(selectedStudent.grade) || "미지정"} · {selectedStudent.school || "학교 미지정"}
            </p>
          </div>
          {isStaff && (
            <Button size="sm" onClick={() => setShowCreateDialog(true)} data-testid="button-create-record">
              <Plus className="w-4 h-4 mr-1" />작성
            </Button>
          )}
        </div>

        {isStaff && detailTeacherList.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
            <Button
              size="sm"
              variant={detailTeacherFilter === null ? "default" : "outline"}
              onClick={() => setDetailTeacherFilter(null)}
              className="h-7 text-xs px-2"
              data-testid="button-detail-teacher-all"
            >
              전체
            </Button>
            {detailTeacherList.map(t => (
              <Button
                key={t.id}
                size="sm"
                variant={detailTeacherFilter === t.id ? "default" : "outline"}
                onClick={() => setDetailTeacherFilter(detailTeacherFilter === t.id ? null : t.id)}
                className="h-7 text-xs px-2"
                data-testid={`button-detail-teacher-${t.id}`}
              >
                {t.name}
              </Button>
            ))}
          </div>
        )}

        {loadingRecords ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : studentRecords.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground" data-testid="text-no-records">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>아직 상담 일지가 없습니다</p>
              {isStaff && <p className="text-xs mt-1">위의 '작성' 버튼으로 첫 상담 일지를 작성해 주세요</p>}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {studentRecords.map(record => {
              const teacher = teachers.get(record.teacherId);
              return (
                <Card key={record.id} data-testid={`card-record-${record.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="w-3 h-3 mr-1" />
                          {format(new Date(record.counselingDate + "T00:00:00"), "yyyy년 M월 d일 (EEE)", { locale: ko })}
                        </Badge>
                        {teacher && (
                          <Badge variant="secondary" className="text-xs">
                            <UserIcon className="w-3 h-3 mr-1" />{teacher.name}
                          </Badge>
                        )}
                      </div>
                      {isStaff && (
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingRecord(record)} data-testid={`button-edit-${record.id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirmId(record.id)} data-testid={`button-delete-${record.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed" data-testid={`text-content-${record.id}`}>{record.content}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <CounselingFormDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSubmit={(date, content) => createMutation.mutate({ counselingDate: date, content })}
          isPending={createMutation.isPending}
          title="상담 일지 작성"
        />

        {editingRecord && (
          <CounselingFormDialog
            open={!!editingRecord}
            onOpenChange={() => setEditingRecord(null)}
            onSubmit={(date, content) => updateMutation.mutate({ id: editingRecord.id, counselingDate: date, content })}
            isPending={updateMutation.isPending}
            title="상담 일지 수정"
            defaultDate={editingRecord.counselingDate}
            defaultContent={editingRecord.content}
          />
        )}

        <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>상담 일지 삭제</DialogTitle>
              <DialogDescription>이 상담 일지를 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>취소</Button>
              <Button variant="destructive" onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}삭제
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto" data-testid="counseling-page">
      <div className="flex items-center gap-2">
        <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">상담</h1>
        <ManualButton menuKey="counseling" />
      </div>

      <Tabs value={schoolLevel} onValueChange={(v) => setSchoolLevel(v as any)}>
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1" data-testid="tab-all">전체</TabsTrigger>
          <TabsTrigger value="elementary" className="flex-1" data-testid="tab-elementary">초등</TabsTrigger>
          <TabsTrigger value="middle" className="flex-1" data-testid="tab-middle">중등</TabsTrigger>
          <TabsTrigger value="high" className="flex-1" data-testid="tab-high">고등</TabsTrigger>
          <TabsTrigger value="adult" className="flex-1" data-testid="tab-adult">성인</TabsTrigger>
        </TabsList>
      </Tabs>

      {isManagerOrAbove && teacherList.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
          <Button
            size="sm"
            variant={selectedTeacherId === null ? "default" : "outline"}
            onClick={() => setSelectedTeacherId(null)}
            className="h-7 text-xs px-2"
            data-testid="button-teacher-filter-all"
          >
            전체
          </Button>
          {teacherList.map(t => (
            <Button
              key={t.id}
              size="sm"
              variant={selectedTeacherId === t.id ? "default" : "outline"}
              onClick={() => setSelectedTeacherId(selectedTeacherId === t.id ? null : t.id)}
              className="h-7 text-xs px-2"
              data-testid={`button-teacher-filter-${t.id}`}
            >
              {t.name}
            </Button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="학생 이름 또는 학교 검색"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-search"
        />
      </div>

      {students.length === 0 ? (
        <div className="text-center text-muted-foreground py-12" data-testid="text-no-students">
          {searchQuery ? "검색 결과가 없습니다" : "해당 학년의 학생이 없습니다"}
        </div>
      ) : (
        <div className="space-y-2">
          {students.map(student => {
            const count = recordCountByStudent.get(student.id) || 0;
            const grade = normalizeGrade(student.grade) || "미지정";
            return (
              <Card
                key={student.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => { setDetailTeacherFilter(null); setSelectedStudent(student); }}
                data-testid={`card-student-${student.id}`}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <UserIcon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate" data-testid={`text-name-${student.id}`}>{student.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{grade} · {student.school || "학교 미지정"}</p>
                    </div>
                  </div>
                  <Badge variant={count > 0 ? "default" : "outline"} className="shrink-0 text-xs" data-testid={`badge-count-${student.id}`}>
                    {count}건
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CounselingFormDialog({
  open, onOpenChange, onSubmit, isPending, title, defaultDate, defaultContent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (date: string, content: string) => void;
  isPending: boolean;
  title: string;
  defaultDate?: string;
  defaultContent?: string;
}) {
  const [date, setDate] = useState(defaultDate || format(new Date(), "yyyy-MM-dd"));
  const [content, setContent] = useState(defaultContent || "");

  const handleSubmit = () => {
    if (!date) return;
    if (!content.trim()) return;
    onSubmit(date, content.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>날짜 <span className="text-destructive">*</span></Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="input-date" />
          </div>
          <div className="space-y-2">
            <Label>상담 내용 <span className="text-destructive">*</span></Label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="상담 내용을 입력하세요"
              rows={6}
              style={{ resize: "vertical" }}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              data-testid="textarea-content"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleSubmit} disabled={isPending || !date || !content.trim()} data-testid="button-submit">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
