import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { UserRole, isAssistantTeacher, type User, type SchoolGrade, type SchoolSubject } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { normalizeGrade } from "@/components/enrollment-status-table";
import { Search, Plus, Pencil, Trash2, GraduationCap, TrendingUp, BookOpen, X, ArrowLeft, ChevronDown } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const GRADE_LEVEL_MAP: Record<string, string> = {
  "초1": "elementary", "초2": "elementary", "초3": "elementary",
  "초4": "elementary", "초5": "elementary", "초6": "elementary",
  "중1": "middle", "중2": "middle", "중3": "middle",
  "고1": "high", "고2": "high", "고3": "high",
  "성인": "adult",
};

const EXAM_LABELS: Record<string, string> = {
  "1-midterm": "1학기 중간",
  "1-final": "1학기 기말",
  "2-midterm": "2학기 중간",
  "2-final": "2학기 기말",
};

const EXAM_ORDER = ["1-midterm", "1-final", "2-midterm", "2-final"];

function GradeInputDialog({
  centerId, studentId, enteredById, subjectName, existingGrade, newGradeInfo, open, onOpenChange, onSuccess,
}: {
  centerId: string;
  studentId: string;
  enteredById: string;
  subjectName: string;
  existingGrade?: SchoolGrade | null;
  newGradeInfo?: { schoolLevel: string; gradeYear: number; semester: number; examType: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!existingGrade;

  const [score, setScore] = useState(existingGrade?.score !== undefined ? String(existingGrade.score) : "");
  const [grade, setGrade] = useState(existingGrade?.grade ? String(existingGrade.grade) : "");
  const [rank, setRank] = useState(existingGrade?.rank ? String(existingGrade.rank) : "");
  const [totalStudents, setTotalStudents] = useState(existingGrade?.totalStudents ? String(existingGrade.totalStudents) : "");

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEdit) {
        await apiRequest("PATCH", `/api/school-grades/${existingGrade!.id}`, data);
      } else {
        await apiRequest("POST", "/api/school-grades", data);
      }
    },
    onSuccess: () => {
      toast({ title: isEdit ? "성적이 수정되었습니다" : "성적이 등록되었습니다" });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const schoolLevel = existingGrade?.schoolLevel || newGradeInfo?.schoolLevel || "middle";
  const gradeYear = existingGrade?.gradeYear || newGradeInfo?.gradeYear || 1;
  const semester = existingGrade?.semester || newGradeInfo?.semester || 1;
  const examType = existingGrade?.examType || newGradeInfo?.examType || "midterm";

  const handleSubmit = () => {
    if (!score) {
      toast({ title: "원점수는 필수입니다", variant: "destructive" });
      return;
    }
    if (rank && !totalStudents) {
      toast({ title: "석차를 입력하면 전체 인원도 입력해야 합니다", variant: "destructive" });
      return;
    }
    mutation.mutate({
      centerId, studentId, enteredById,
      schoolLevel, gradeYear, semester, examType,
      subject: subjectName,
      score: Number(score),
      grade: grade && grade !== "none" ? Number(grade) : null,
      rank: rank ? Number(rank) : null,
      totalStudents: totalStudents ? Number(totalStudents) : null,
    });
  };

  const examLabel = `${schoolLevel === "middle" ? "중" : "고"}${gradeYear} ${EXAM_LABELS[`${semester}-${examType}`]}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{subjectName} - {examLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>원점수 *</Label>
            <Input data-testid="input-score" type="number" min={0} max={100} value={score} onChange={e => setScore(e.target.value)} placeholder="0 ~ 100" />
          </div>
          <div>
            <Label>등급 (선택)</Label>
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger data-testid="select-grade"><SelectValue placeholder="선택 안 함" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">선택 안 함</SelectItem>
                {[1,2,3,4,5,6,7,8,9].map(g => <SelectItem key={g} value={String(g)}>{g}등급</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>석차 (선택)</Label>
              <Input data-testid="input-rank" type="number" min={1} value={rank} onChange={e => setRank(e.target.value)} placeholder="등수" />
            </div>
            <div>
              <Label>전체 인원</Label>
              <Input data-testid="input-total-students" type="number" min={1} value={totalStudents} onChange={e => setTotalStudents(e.target.value)} placeholder="전체 인원" />
            </div>
          </div>
          {rank && totalStudents && Number(totalStudents) > 0 && (
            <div className="text-sm text-muted-foreground">
              백분위: <span className="font-semibold text-foreground">{((Number(rank) / Number(totalStudents)) * 100).toFixed(1)}%</span>
            </div>
          )}
          <Button data-testid="button-submit-grade" className="w-full" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "저장 중..." : isEdit ? "수정" : "등록"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SubjectDetailView({
  centerId, studentId, enteredById, subject, grades, canEdit, onBack,
}: {
  centerId: string;
  studentId: string;
  enteredById: string;
  subject: SchoolSubject;
  grades: SchoolGrade[];
  canEdit: boolean;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [editGrade, setEditGrade] = useState<SchoolGrade | null>(null);
  const [newGradeInfo, setNewGradeInfo] = useState<{ schoolLevel: string; gradeYear: number; semester: number; examType: string } | null>(null);

  const subjectGrades = useMemo(() => grades.filter(g => g.subject === subject.name), [grades, subject.name]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/school-grades/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/school-grades"] }); toast({ title: "성적이 삭제되었습니다" }); },
  });

  const schoolLevels = [
    { level: "middle", label: "중학교" },
    { level: "high", label: "고등학교" },
  ];

  const getGradeForCell = (level: string, year: number, sem: number, et: string) => {
    return subjectGrades.find(g => g.schoolLevel === level && g.gradeYear === year && g.semester === sem && g.examType === et);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-base font-semibold">{subject.name}</h2>
      </div>

      {schoolLevels.map(sl => (
        <Card key={sl.level}>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">{sl.label}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-2 font-medium text-muted-foreground w-16">학년</th>
                    <th className="text-center py-2 px-1 font-medium text-muted-foreground">1학기 중간</th>
                    <th className="text-center py-2 px-1 font-medium text-muted-foreground">1학기 기말</th>
                    <th className="text-center py-2 px-1 font-medium text-muted-foreground">2학기 중간</th>
                    <th className="text-center py-2 px-1 font-medium text-muted-foreground">2학기 기말</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3].map(year => (
                    <tr key={year} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-medium">{year}학년</td>
                      {EXAM_ORDER.map(ek => {
                        const [sem, et] = ek.split("-");
                        const existing = getGradeForCell(sl.level, year, Number(sem), et);
                        return (
                          <td key={ek} className="text-center py-2 px-1">
                            {existing ? (
                              <div className="space-y-0.5">
                                <div className="font-semibold">{existing.score}점</div>
                                <div className="text-xs text-muted-foreground flex flex-wrap justify-center gap-1">
                                  {existing.grade && <span>{existing.grade}등급</span>}
                                  {existing.rank && existing.totalStudents && (
                                    <span>{existing.rank}/{existing.totalStudents}</span>
                                  )}
                                </div>
                                {canEdit && (
                                  <div className="flex justify-center gap-0.5 mt-1">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditGrade(existing)}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate(existing.id); }}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ) : canEdit ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-muted-foreground"
                                onClick={() => setNewGradeInfo({ schoolLevel: sl.level, gradeYear: year, semester: Number(sem), examType: et })}
                                data-testid={`button-add-${sl.level}-${year}-${sem}-${et}`}
                              >
                                <Plus className="h-3 w-3 mr-0.5" />입력
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {editGrade && (
        <GradeInputDialog
          centerId={centerId}
          studentId={studentId}
          enteredById={enteredById}
          subjectName={subject.name}
          existingGrade={editGrade}
          open={!!editGrade}
          onOpenChange={(o) => { if (!o) setEditGrade(null); }}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/school-grades"] })}
        />
      )}

      {newGradeInfo && (
        <GradeInputDialog
          centerId={centerId}
          studentId={studentId}
          enteredById={enteredById}
          subjectName={subject.name}
          newGradeInfo={newGradeInfo}
          open={!!newGradeInfo}
          onOpenChange={(o) => { if (!o) setNewGradeInfo(null); }}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/school-grades"] })}
        />
      )}
    </div>
  );
}

function GradeCharts({ grades, subjects, studentName }: {
  grades: SchoolGrade[];
  subjects: SchoolSubject[];
  studentName?: string;
}) {
  const [selectedSubject, setSelectedSubject] = useState<string>("__average__");

  const subjectNames = useMemo(() => subjects.map(s => s.name), [subjects]);

  const buildChartData = (filterSubject: string | null, level: string) => {
    const points: { name: string; 원점수: number | null }[] = [];
    const levelLabel = level === "middle" ? "중" : "고";

    for (const year of [1, 2, 3]) {
      for (const ek of EXAM_ORDER) {
        const [sem, et] = ek.split("-");
        let examGrades = grades.filter(
          g => g.schoolLevel === level && g.gradeYear === year && g.semester === Number(sem) && g.examType === et
        );

        if (filterSubject) {
          examGrades = examGrades.filter(g => g.subject === filterSubject);
        }

        const label = `${levelLabel}${year} ${EXAM_LABELS[ek]}`;

        if (examGrades.length === 0) {
          points.push({ name: label, 원점수: null });
        } else {
          const avg = Math.round(examGrades.reduce((s, g) => s + g.score, 0) / examGrades.length * 10) / 10;
          points.push({ name: label, 원점수: avg });
        }
      }
    }
    return points;
  };

  const hasMiddle = grades.some(g => g.schoolLevel === "middle");
  const hasHigh = grades.some(g => g.schoolLevel === "high");

  const filterSubject = selectedSubject === "__average__" ? null : selectedSubject;

  const middleData = useMemo(() => buildChartData(filterSubject, "middle"), [grades, filterSubject]);
  const highData = useMemo(() => buildChartData(filterSubject, "high"), [grades, filterSubject]);

  const middleHasData = middleData.some(d => d.원점수 !== null);
  const highHasData = highData.some(d => d.원점수 !== null);
  const anyData = middleHasData || highHasData;

  const trimData = (data: { name: string; 원점수: number | null }[]) => {
    const first = data.findIndex(d => d.원점수 !== null);
    const last = data.length - 1 - [...data].reverse().findIndex(d => d.원점수 !== null);
    if (first === -1) return data;
    return data.slice(Math.max(0, first - 1), last + 2);
  };

  const renderChart = (data: { name: string; 원점수: number | null }[], title: string, color: string) => {
    const visible = trimData(data);
    if (!data.some(d => d.원점수 !== null)) return null;
    return (
      <div>
        <p className="text-sm font-semibold mb-2">{title}</p>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={visible} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
              <Line type="monotone" dataKey="원점수" stroke={color} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {studentName ? `${studentName} 성적 추이` : "성적 추이"}
          </CardTitle>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-chart-subject">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__average__">전체평균</SelectItem>
              {subjectNames.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pt-2 space-y-6">
        {!anyData ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {selectedSubject === "__average__" ? "등록된 성적 데이터가 없습니다" : "이 과목에 등록된 성적이 없습니다"}
          </p>
        ) : hasMiddle && hasHigh ? (
          <>
            {renderChart(middleData, "중학교 원점수 추이", "hsl(var(--primary))")}
            {renderChart(highData, "고등학교 원점수 추이", "hsl(142 71% 45%)")}
          </>
        ) : hasMiddle ? (
          renderChart(middleData, "중학교 원점수 추이", "hsl(var(--primary))")
        ) : (
          renderChart(highData, "고등학교 원점수 추이", "hsl(142 71% 45%)")
        )}
      </CardContent>
    </Card>
  );
}

function StudentGradesView({
  centerId, studentId, studentName, enteredById, canEdit,
}: {
  centerId: string;
  studentId: string;
  studentName?: string;
  enteredById: string;
  canEdit: boolean;
}) {
  const { toast } = useToast();
  const [selectedSubject, setSelectedSubject] = useState<SchoolSubject | null>(null);
  const [newSubjectName, setNewSubjectName] = useState("");

  useEffect(() => {
    setSelectedSubject(null);
    setNewSubjectName("");
  }, [studentId]);

  const { data: subjects = [] } = useQuery<SchoolSubject[]>({
    queryKey: ["/api/school-subjects", centerId, studentId],
    queryFn: async () => {
      const res = await fetch(`/api/school-subjects?centerId=${centerId}&studentId=${studentId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!centerId && !!studentId,
  });

  const { data: grades = [], isLoading } = useQuery<SchoolGrade[]>({
    queryKey: ["/api/school-grades", centerId, studentId],
    queryFn: async () => {
      const res = await fetch(`/api/school-grades?centerId=${centerId}&studentId=${studentId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!centerId && !!studentId,
  });

  const createSubjectMutation = useMutation({
    mutationFn: async (name: string) => {
      await apiRequest("POST", "/api/school-subjects", { centerId, studentId, name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/school-subjects"] });
      setNewSubjectName("");
      toast({ title: "과목이 추가되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const deleteSubjectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/school-subjects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/school-subjects"] });
      toast({ title: "과목이 삭제되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  if (selectedSubject) {
    return (
      <SubjectDetailView
        centerId={centerId}
        studentId={studentId}
        enteredById={enteredById}
        subject={selectedSubject}
        grades={grades}
        canEdit={canEdit}
        onBack={() => setSelectedSubject(null)}
      />
    );
  }

  const gradeCountBySubject = (name: string) => grades.filter(g => g.subject === name).length;

  return (
    <div className="space-y-4">
      {studentName && (
        <h2 className="text-base font-semibold">{studentName}의 내신성적</h2>
      )}

      <GradeCharts grades={grades} subjects={subjects} studentName={studentName} />

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <BookOpen className="h-4 w-4" />
          과목 목록
        </h3>
      </div>

      {canEdit && (
        <div className="flex gap-2">
          <Input
            data-testid="input-new-subject"
            value={newSubjectName}
            onChange={e => setNewSubjectName(e.target.value)}
            placeholder="새 과목명 입력 (예: 국어, 수학)"
            className="flex-1"
            onKeyDown={e => { if (e.key === "Enter" && newSubjectName.trim()) createSubjectMutation.mutate(newSubjectName.trim()); }}
          />
          <Button
            size="sm"
            onClick={() => { if (newSubjectName.trim()) createSubjectMutation.mutate(newSubjectName.trim()); }}
            disabled={createSubjectMutation.isPending || !newSubjectName.trim()}
            data-testid="button-add-subject"
          >
            <Plus className="h-4 w-4 mr-1" />
            추가
          </Button>
        </div>
      )}

      {subjects.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">
              등록된 과목이 없습니다. {canEdit ? "과목을 먼저 추가해주세요." : ""}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {subjects.map(s => {
            const count = gradeCountBySubject(s.name);
            return (
              <Card
                key={s.id}
                className="cursor-pointer hover:border-primary/50 transition-colors relative group"
                onClick={() => setSelectedSubject(s)}
                data-testid={`card-subject-${s.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{s.name}</span>
                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`"${s.name}" 과목을 삭제하시겠습니까?`)) deleteSubjectMutation.mutate(s.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        data-testid={`button-delete-subject-${s.id}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {count > 0 ? `${count}개 성적 등록됨` : "성적 미등록"}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SchoolGradesPage() {
  const { user, selectedCenter } = useAuth();
  const centerId = selectedCenter?.id || "";

  const isStudent = user?.role === UserRole.STUDENT;
  const isParent = user?.role === UserRole.PARENT;
  const isTeacher = user?.role === UserRole.TEACHER || user?.role === UserRole.CLINIC_TEACHER;
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.PRINCIPAL;

  const { data: features = [] } = useQuery<any[]>({
    queryKey: ["/api/features"],
    enabled: !!centerId,
  });

  const { data: centerFeatures = [] } = useQuery<any[]>({
    queryKey: ["/api/center-features", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const res = await fetch(`/api/center-features/${centerId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!centerId,
  });

  const isFeatureEnabled = useMemo(() => {
    if (isAdmin) return true;
    const schoolGradesFeature = features.find((f: any) => f.menuKey === "school-grades");
    if (!schoolGradesFeature) return false;
    if (schoolGradesFeature.featureType !== "optional") return true;
    return centerFeatures.some((cf: any) => cf.featureId === schoolGradesFeature.id && !cf.isHidden);
  }, [features, centerFeatures, isAdmin]);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [schoolLevel, setSchoolLevel] = useState<"all" | "middle" | "high">("all");
  const [selectedGradeNum, setSelectedGradeNum] = useState<string | null>(null);

  const { data: allCenterUsers = [] } = useQuery<User[]>({
    queryKey: [`/api/users?centerId=${centerId}`],
    enabled: !!centerId && isAdmin,
  });

  const { data: teacherClasses = [] } = useQuery<any[]>({
    queryKey: [`/api/classes?centerId=${centerId}`],
    enabled: !!centerId && isTeacher,
  });

  const teacherClassIds = useMemo(() => {
    if (!isTeacher || !user) return [];
    return teacherClasses
      .filter((c: any) => c.teacherId === user.id || isAssistantTeacher(c, user.id))
      .map((c: any) => c.id);
  }, [teacherClasses, isTeacher, user]);

  const { data: allEnrollments = [] } = useQuery<any[]>({
    queryKey: [`/api/enrollments?centerId=${centerId}`],
    enabled: !!centerId && isTeacher,
  });

  const teacherStudentIds = useMemo(() => {
    if (!isTeacher) return [];
    return [...new Set(allEnrollments.filter((e: any) => teacherClassIds.includes(e.classId)).map((e: any) => e.studentId))];
  }, [allEnrollments, teacherClassIds, isTeacher]);

  const { data: teacherStudents = [] } = useQuery<User[]>({
    queryKey: [`/api/users?centerId=${centerId}`],
    enabled: !!centerId && isTeacher,
  });

  const allStudents = useMemo(() => {
    if (isStudent) return [];
    if (isAdmin) return allCenterUsers.filter(u => u.role === UserRole.STUDENT);
    if (isTeacher) return teacherStudents.filter(u => u.role === UserRole.STUDENT && teacherStudentIds.includes(u.id));
    return [];
  }, [isStudent, isAdmin, isTeacher, allCenterUsers, teacherStudents, teacherStudentIds]);

  const filteredStudents = useMemo(() => {
    let result = allStudents;

    if (schoolLevel !== "all") {
      result = result.filter(s => {
        const g = normalizeGrade(s.grade || "");
        return GRADE_LEVEL_MAP[g] === schoolLevel;
      });
    }

    if (selectedGradeNum) {
      result = result.filter(s => normalizeGrade(s.grade || "") === selectedGradeNum);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q));
    }

    return result.sort((a, b) => {
      const ag = normalizeGrade(a.grade || "");
      const bg = normalizeGrade(b.grade || "");
      if (ag !== bg) return ag.localeCompare(bg);
      return a.name.localeCompare(b.name);
    });
  }, [allStudents, schoolLevel, selectedGradeNum, searchQuery]);

  const parentLinkedStudentId = isParent ? (user as any)?.linkedStudentIds?.[0] : null;

  const { data: linkedStudent } = useQuery<User>({
    queryKey: ["/api/users", parentLinkedStudentId],
    queryFn: async () => {
      const users = await fetch(`/api/users?centerId=${centerId}`).then(r => r.json());
      return users.find((u: any) => u.id === parentLinkedStudentId);
    },
    enabled: !!parentLinkedStudentId && !!centerId,
  });

  const activeStudentId = isStudent ? user?.id : isParent ? parentLinkedStudentId : selectedStudentId;
  const canEdit = !isParent;
  const activeStudentName = isStudent ? user?.name : isParent ? (linkedStudent?.name || "자녀") : filteredStudents.find(s => s.id === selectedStudentId)?.name;

  const gradeButtons = useMemo(() => {
    if (schoolLevel === "middle") return ["중1", "중2", "중3"];
    if (schoolLevel === "high") return ["고1", "고2", "고3"];
    return [];
  }, [schoolLevel]);

  if (!user || !centerId) return null;

  if (!isFeatureEnabled) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center gap-2 mb-6">
          <GraduationCap className="h-6 w-6" />
          <h1 className="text-xl font-bold">내신성적</h1>
        </div>
        <Card>
          <CardContent className="py-12">
            <p className="text-sm text-muted-foreground text-center">
              이 기능은 현재 센터에서 활성화되지 않았습니다.<br />
              관리자에게 기능 신청을 요청해 주세요.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <GraduationCap className="h-6 w-6" />
        <h1 className="text-xl font-bold">내신성적</h1>
      </div>

      {!isStudent && !isParent && (
        <div className="space-y-3 mb-4">
          <Tabs value={schoolLevel} onValueChange={(v) => { setSchoolLevel(v as any); setSelectedGradeNum(null); setSelectedStudentId(null); }}>
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1" data-testid="tab-all">전체</TabsTrigger>
              <TabsTrigger value="middle" className="flex-1" data-testid="tab-middle">중등</TabsTrigger>
              <TabsTrigger value="high" className="flex-1" data-testid="tab-high">고등</TabsTrigger>
            </TabsList>
          </Tabs>

          {gradeButtons.length > 0 && (
            <div className="flex gap-2">
              {gradeButtons.map(g => (
                <Button key={g} variant={selectedGradeNum === g ? "default" : "outline"} size="sm"
                  onClick={() => { setSelectedGradeNum(selectedGradeNum === g ? null : g); setSelectedStudentId(null); }}
                  data-testid={`button-grade-${g}`}
                >{g}</Button>
              ))}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input data-testid="input-search-student" className="pl-9" placeholder="학생 이름 검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>

          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[200px]">
                {filteredStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">학생이 없습니다</p>
                ) : (
                  <div className="divide-y">
                    {filteredStudents.map(s => (
                      <button key={s.id}
                        className={`w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors ${selectedStudentId === s.id ? "bg-primary/10 border-l-2 border-primary" : ""}`}
                        onClick={() => setSelectedStudentId(s.id)}
                        data-testid={`button-student-${s.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{s.name}</span>
                          <span className="text-xs text-muted-foreground">{normalizeGrade(s.grade || "")}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {activeStudentId ? (
        <StudentGradesView
          centerId={centerId}
          studentId={activeStudentId}
          studentName={activeStudentName || undefined}
          enteredById={user!.id}
          canEdit={canEdit}
        />
      ) : !isStudent && !isParent && (
        <Card>
          <CardContent className="py-12">
            <p className="text-sm text-muted-foreground text-center">학생을 선택하세요</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
