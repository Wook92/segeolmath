import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, BookOpen, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole, getAssistantTeacherIds, type User, type Class, type Enrollment } from "@shared/schema";

const GRADE_ORDER = ["초1","초2","초3","초4","초5","초6","중1","중2","중3","고1","고2","고3","성인"];

const GRADE_LEVEL_MAP: Record<string, string> = {
  "초1": "elementary", "초2": "elementary", "초3": "elementary",
  "초4": "elementary", "초5": "elementary", "초6": "elementary",
  "중1": "middle", "중2": "middle", "중3": "middle",
  "고1": "high", "고2": "high", "고3": "high",
  "성인": "adult",
};

export function normalizeGrade(grade: string | null | undefined): string {
  if (!grade) return "";
  const mapping: Record<string, string> = {
    "초등학교 1학년": "초1", "초등학교 2학년": "초2", "초등학교 3학년": "초3",
    "초등학교 4학년": "초4", "초등학교 5학년": "초5", "초등학교 6학년": "초6",
    "중학교 1학년": "중1", "중학교 2학년": "중2", "중학교 3학년": "중3",
    "고등학교 1학년": "고1", "고등학교 2학년": "고2", "고등학교 3학년": "고3",
  };
  return mapping[grade] || grade;
}

export function EnrollmentStatusTable({ centerId, onEditStudent, currentUserId }: { centerId: string; onEditStudent?: (student: User) => void; currentUserId?: string }) {
  const [schoolLevel, setSchoolLevel] = useState<"all" | "elementary" | "middle" | "high" | "adult">("middle");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

  const { data: allUsers = [], isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: [`/api/users?centerId=${centerId}`],
    enabled: !!centerId,
  });

  const { data: allClasses = [], isLoading: loadingClasses } = useQuery<Class[]>({
    queryKey: [`/api/classes?centerId=${centerId}`],
    enabled: !!centerId,
  });

  const { data: enrollments = [], isLoading: loadingEnrollments } = useQuery<Enrollment[]>({
    queryKey: ["/api/enrollments", centerId],
    queryFn: async () => {
      const res = await fetch(`/api/enrollments?centerId=${centerId}`);
      if (!res.ok) throw new Error("Failed to fetch enrollments");
      return res.json();
    },
    enabled: !!centerId,
  });

  const teachers = useMemo(() => {
    const teacherIds = new Set(allClasses.filter(c => !c.isArchived && c.teacherId).map(c => c.teacherId!));
    return allUsers.filter(u => teacherIds.has(u.id)).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [allClasses, allUsers]);

  const activeClasses = useMemo(() => {
    return allClasses
      .filter(c => !c.isArchived && (schoolLevel === "all" || c.classLevel === schoolLevel))
      .filter(c => !selectedTeacherId || c.teacherId === selectedTeacherId)
      .sort((a, b) => `${a.name} ${a.subject}`.localeCompare(`${b.name} ${b.subject}`, "ko"));
  }, [allClasses, schoolLevel, selectedTeacherId]);

  const enrolledInLevelStudentIds = useMemo(() => {
    if (schoolLevel === "all") return new Set<string>();
    const levelClassIds = new Set(activeClasses.map(c => c.id));
    const ids = new Set<string>();
    enrollments.forEach(e => {
      if (levelClassIds.has(e.classId)) ids.add(e.studentId);
    });
    return ids;
  }, [activeClasses, enrollments, schoolLevel]);

  const students = useMemo(() => {
    return allUsers
      .filter(u => {
        if (u.role !== UserRole.STUDENT) return false;
        if (schoolLevel === "all") return true;
        const ng = normalizeGrade(u.grade);
        const studentLevel = GRADE_LEVEL_MAP[ng];
        return studentLevel === schoolLevel || enrolledInLevelStudentIds.has(u.id);
      })
      .sort((a, b) => {
        const ag = normalizeGrade(a.grade);
        const bg = normalizeGrade(b.grade);
        const ai = GRADE_ORDER.indexOf(ag);
        const bi = GRADE_ORDER.indexOf(bg);
        const ga = ai !== -1 ? ai : -1;
        const gb = bi !== -1 ? bi : -1;
        if (ga !== gb) return gb - ga;
        return (a.name || "").localeCompare(b.name || "", "ko");
      });
  }, [allUsers, schoolLevel, enrolledInLevelStudentIds]);

  const enrollmentMap = useMemo(() => {
    const map = new Map<string, string>();
    enrollments.forEach(e => map.set(`${e.studentId}_${e.classId}`, e.id));
    return map;
  }, [enrollments]);

  const { toast } = useToast();
  const [togglingCell, setTogglingCell] = useState<string | null>(null);

  const toggleEnrollment = async (studentId: string, classId: string) => {
    const key = `${studentId}_${classId}`;
    setTogglingCell(key);
    try {
      const enrollmentId = enrollmentMap.get(key);
      if (enrollmentId) {
        await apiRequest("DELETE", `/api/enrollments/${enrollmentId}?actorId=${currentUserId || ""}`);
        toast({ title: "수강 취소됨" });
      } else {
        await apiRequest("POST", "/api/enrollments", { studentId, classId });
        toast({ title: "수강 등록됨" });
      }
      invalidateQueriesStartingWith("/api/enrollments");
      invalidateQueriesStartingWith("/api/students");
    } catch (error: any) {
      toast({ title: "오류", description: error?.message || "처리 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setTogglingCell(null);
    }
  };

  const classEnrollCounts = useMemo(() => {
    const counts = new Map<string, number>();
    activeClasses.forEach(c => counts.set(c.id, 0));
    const studentIdSet = new Set(students.map(s => s.id));
    const seen = new Set<string>();
    enrollments.forEach(e => {
      if (!counts.has(e.classId)) return;
      if (!studentIdSet.has(e.studentId)) return;
      const key = `${e.studentId}_${e.classId}`;
      if (seen.has(key)) return;
      seen.add(key);
      counts.set(e.classId, (counts.get(e.classId) || 0) + 1);
    });
    return counts;
  }, [enrollments, activeClasses, students]);

  const gradeGroups = useMemo(() => {
    const groups: { grade: string; students: User[] }[] = [];
    let currentGrade = "";
    let currentStudents: User[] = [];
    students.forEach(s => {
      const g = normalizeGrade(s.grade) || "미지정";
      if (g !== currentGrade) {
        if (currentStudents.length > 0) {
          groups.push({ grade: currentGrade, students: currentStudents });
        }
        currentGrade = g;
        currentStudents = [s];
      } else {
        currentStudents.push(s);
      }
    });
    if (currentStudents.length > 0) {
      groups.push({ grade: currentGrade, students: currentStudents });
    }
    return groups;
  }, [students]);

  if (loadingUsers || loadingClasses || loadingEnrollments) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              수강과목 현황
            </CardTitle>
            <CardDescription>학년별 학생의 수업 수강 여부를 확인합니다</CardDescription>
          </div>
          <Tabs value={schoolLevel} onValueChange={(v) => setSchoolLevel(v as "all" | "elementary" | "middle" | "high" | "adult")}>
            <TabsList>
              <TabsTrigger value="all" data-testid="tab-all">전체</TabsTrigger>
              <TabsTrigger value="elementary" data-testid="tab-elementary">초등</TabsTrigger>
              <TabsTrigger value="middle" data-testid="tab-middle">중등</TabsTrigger>
              <TabsTrigger value="high" data-testid="tab-high">고등</TabsTrigger>
              <TabsTrigger value="adult" data-testid="tab-adult">성인</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {teachers.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            <Button
              size="sm"
              variant={selectedTeacherId === null ? "default" : "outline"}
              onClick={() => setSelectedTeacherId(null)}
              className="h-7 text-xs px-2"
              data-testid="button-teacher-filter-all"
            >
              전체
            </Button>
            {teachers.map(t => (
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
      </CardHeader>
      {students.length === 0 ? (
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground py-8" data-testid="text-no-enrollment-data">
            해당 학년의 학생이 없습니다
          </div>
        </CardContent>
      ) : (
      <CardContent className="p-0">
        <div className="overflow-auto max-h-[70vh]" data-testid="enrollment-status-table">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-40">
              <tr className="border-b bg-muted">
                <th className="sticky left-0 z-50 bg-muted border-r px-2 py-2 text-left font-medium whitespace-nowrap min-w-[50px]">학년</th>
                <th className="sticky left-[50px] z-50 bg-muted border-r px-2 py-2 text-center font-medium whitespace-nowrap min-w-[40px]">인원</th>
                <th className="sticky left-[90px] z-50 bg-muted border-r px-2 py-2 text-left font-medium whitespace-nowrap min-w-[70px]">이름</th>
                <th className="sticky left-[160px] z-50 bg-muted border-r px-2 py-2 text-left font-medium whitespace-nowrap min-w-[70px]">학교</th>
                {activeClasses.map(cls => {
                  const teacher = cls.teacherId ? allUsers.find(u => u.id === cls.teacherId) : null;
                  const assistantTeacherIds = getAssistantTeacherIds(cls).filter(aid => aid !== cls.teacherId);
                  const assistantTeachers = assistantTeacherIds
                    .map(aid => allUsers.find(u => u.id === aid))
                    .filter((u): u is User => !!u);
                  return (
                    <th key={cls.id} className="px-2 py-2 text-center font-medium whitespace-nowrap border-r min-w-[60px] bg-muted">
                      <div className="text-xs leading-tight">
                        <div>{cls.name}</div>
                        <div className="text-muted-foreground">{cls.subject}반</div>
                        {teacher && <div className="text-muted-foreground font-normal">{teacher.name}</div>}
                        {assistantTeachers.map(at => (
                          <div key={at.id} className="text-orange-500 font-normal text-[10px]">부) {at.name}</div>
                        ))}
                      </div>
                    </th>
                  );
                })}
              </tr>
              <tr className="border-b font-medium sticky top-[37px] z-40">
                <td className="sticky left-0 z-50 bg-card border-r px-2 py-1.5" colSpan={2}>전체</td>
                <td className="sticky left-[90px] z-50 bg-card border-r px-2 py-1.5 text-center font-bold">{students.length}명</td>
                <td className="sticky left-[160px] z-50 bg-card border-r px-2 py-1.5"></td>
                {activeClasses.map(cls => (
                  <td key={cls.id} className="px-2 py-1.5 text-center border-r font-bold text-primary bg-card">
                    {classEnrollCounts.get(cls.id) || 0}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {gradeGroups.map(group => (
                group.students.map((student, idx) => {
                  const isNew = student.createdAt && (Date.now() - new Date(student.createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000;
                  return (
                  <tr key={student.id} className={`border-b hover:bg-muted/30 ${idx === 0 ? "border-t-2 border-t-border" : ""} ${isNew ? "bg-emerald-50 dark:bg-emerald-950/30" : ""}`}>
                    {idx === 0 && (
                      <>
                        <td className="sticky left-0 z-20 border-r px-2 py-1.5 font-semibold whitespace-nowrap bg-card" rowSpan={group.students.length}>
                          {group.grade}
                        </td>
                        <td className="sticky left-[50px] z-20 border-r px-2 py-1.5 text-center text-muted-foreground bg-card" rowSpan={group.students.length}>
                          {group.students.length}
                        </td>
                      </>
                    )}
                    <td className={`sticky left-[90px] z-20 border-r px-2 py-1.5 whitespace-nowrap font-medium ${isNew ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-card"}`}>
                      {onEditStudent ? (
                        <button
                          className={`hover:underline cursor-pointer ${isNew ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-primary"}`}
                          onClick={() => onEditStudent(student)}
                          data-testid={`btn-edit-student-${student.id}`}
                        >
                          {student.name}{isNew && " ●"}
                        </button>
                      ) : <span className={isNew ? "text-emerald-600 dark:text-emerald-400 font-bold" : ""}>{student.name}{isNew && " ●"}</span>}
                    </td>
                    <td className={`sticky left-[160px] z-20 border-r px-2 py-1.5 whitespace-nowrap text-muted-foreground text-xs ${isNew ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-card"}`}>
                      {student.school || ""}
                    </td>
                    {activeClasses.map(cls => {
                      const key = `${student.id}_${cls.id}`;
                      const enrolled = enrollmentMap.has(key);
                      const isToggling = togglingCell === key;
                      return (
                        <td
                          key={cls.id}
                          className={`px-2 py-1.5 text-center border-r cursor-pointer hover:bg-primary/10 transition-colors ${isToggling ? "opacity-50" : ""}`}
                          onClick={() => !isToggling && toggleEnrollment(student.id, cls.id)}
                          data-testid={`cell-enroll-${student.id}-${cls.id}`}
                        >
                          {isToggling ? (
                            <Loader2 className="h-3 w-3 animate-spin mx-auto" />
                          ) : enrolled ? (
                            <span className="text-primary font-bold" data-testid={`enrolled-${student.id}-${cls.id}`}>v</span>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                  );
                })
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
      )}
    </Card>
  );
}
