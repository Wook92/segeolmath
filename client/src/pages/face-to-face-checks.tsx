import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ManualButton } from "@/components/manual-button";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, isWithinInterval, subDays } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Check, RefreshCw, Eye, Users, Trash2, Pencil } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth-context";
import { RateStepPicker } from "@/components/rate-step-picker";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateQueriesStartingWith, queryClient } from "@/lib/queryClient";
import { UserRole, isAssistantTeacher, type FaceToFaceCheck, type FaceToFaceCheckResult, type Class } from "@shared/schema";
import { cn } from "@/lib/utils";
import { CompletionIndicator, CompletionDot } from "@/components/completion-indicator";
import { TeacherClassTabs } from "@/components/teacher-class-tabs";
import { StudentFilterPicker } from "@/components/student-filter-picker";

function CheckCalendar({ 
  checks, 
  results,
  onDateClick,
  onCreateClick,
  isTeacher
}: { 
  checks: FaceToFaceCheck[];
  results: FaceToFaceCheckResult[];
  onDateClick: (date: Date, checks: FaceToFaceCheck[]) => void;
  onCreateClick?: (date: Date) => void;
  isTeacher?: boolean;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getChecksForDate = (date: Date) => {
    return checks.filter((c) => isSameDay(new Date(c.dueDate), date));
  };

  const getResultForCheck = (checkId: string) => {
    return results.find((r) => r.checkId === checkId);
  };

  const weekDays = ["일", "월", "화", "수", "목", "금", "토"];
  const firstDayOfMonth = monthStart.getDay();

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
            className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}

        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="h-20" />
        ))}

        {days.map((day) => {
          const dayChecks = getChecksForDate(day);
          const isToday = isSameDay(day, new Date());
          const hasChecks = dayChecks.length > 0;
          const isClickable = hasChecks || isTeacher;

          const handleClick = () => {
            if (hasChecks) {
              onDateClick(day, dayChecks);
            } else if (isTeacher && onCreateClick) {
              onCreateClick(day);
            }
          };

          return (
            <button
              key={day.toISOString()}
              onClick={handleClick}
              className={cn(
                "h-20 p-1 border rounded-md text-left transition-colors",
                isToday && "border-primary",
                isClickable && "hover-elevate cursor-pointer",
                !isSameMonth(day, currentMonth) && "opacity-50"
              )}
              data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
            >
              <div className="text-xs font-medium mb-1">{format(day, "d")}</div>
              <div className="space-y-0.5">
                {dayChecks.slice(0, 2).map((check) => {
                  const result = getResultForCheck(check.id);
                  return (
                    <div
                      key={check.id}
                      className="flex items-center gap-1"
                    >
                      <CompletionDot rate={result?.completionRate || 0} />
                      <span className="text-[10px] truncate">{check.title}</span>
                    </div>
                  );
                })}
                {dayChecks.length > 2 && (
                  <div className="text-[10px] text-muted-foreground">
                    +{dayChecks.length - 2}개
                  </div>
                )}
                {isTeacher && !hasChecks && (
                  <div className="text-[10px] text-muted-foreground flex items-center justify-center">
                    <Plus className="h-3 w-3" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CreateCheckDialog({ classes, onClose, editingCheck, initialDate, preSelectedClassId }: { 
  classes: Class[]; 
  onClose: () => void;
  editingCheck?: FaceToFaceCheck | null;
  initialDate?: string;
  preSelectedClassId?: string;
}) {
  const { toast } = useToast();
  const effectiveClassId = editingCheck?.classId || preSelectedClassId || "";
  const [formData, setFormData] = useState({
    classId: effectiveClassId,
    title: editingCheck?.title || "",
    description: editingCheck?.description || "",
    dueDate: editingCheck?.dueDate || initialDate || format(new Date(), "yyyy-MM-dd"),
  });
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    editingCheck?.studentId ? [editingCheck.studentId] : []
  );
  const [selectAll, setSelectAll] = useState(!editingCheck?.studentId);
  
  const showClassSelector = !preSelectedClassId || !!editingCheck;

  const selectedClass = classes.find((c) => c.id === formData.classId);
  
  const { data: classStudents } = useQuery<any[]>({
    queryKey: ["/api/classes", formData.classId, "students"],
    enabled: !!formData.classId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingCheck) {
        return apiRequest("PATCH", `/api/face-to-face-checks/${editingCheck.id}`, data);
      }
      if (data.studentIds && data.studentIds.length > 0) {
        return apiRequest("POST", "/api/face-to-face-checks/bulk", data);
      }
      return apiRequest("POST", "/api/face-to-face-checks", data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/face-to-face-checks");
      invalidateQueriesStartingWith("/api/students");
      toast({ title: editingCheck ? "대면검사가 수정되었습니다" : "대면검사가 등록되었습니다" });
      onClose();
    },
    onError: (error: any) => {
      console.error("Check creation error:", error);
      toast({ 
        title: "대면검사 등록에 실패했습니다", 
        description: error?.serverMessage || error?.message || "알 수 없는 오류",
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCheck) {
      createMutation.mutate({
        ...formData,
        studentId: selectedStudentIds.length === 1 ? selectedStudentIds[0] : (selectAll ? null : null),
      });
    } else if (selectAll) {
      createMutation.mutate({
        ...formData,
        studentId: null,
      });
    } else if (selectedStudentIds.length === 1) {
      createMutation.mutate({
        ...formData,
        studentId: selectedStudentIds[0],
      });
    } else {
      createMutation.mutate({
        ...formData,
        studentIds: selectedStudentIds,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {showClassSelector ? (
        <div className="space-y-2">
          <Label>수업 선택</Label>
          <Select
            value={formData.classId}
            onValueChange={(v) => {
              setFormData((p) => ({ ...p, classId: v }));
              setSelectedStudentIds([]);
              setSelectAll(true);
            }}
          >
            <SelectTrigger data-testid="select-check-class">
              <SelectValue placeholder="수업 선택" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name} ({cls.subject})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>수업</Label>
          <div className="p-2 bg-muted rounded-md text-sm">
            {selectedClass ? `${selectedClass.name} (${selectedClass.subject})` : "수업 선택됨"}
          </div>
        </div>
      )}

      {formData.classId && (
        <div className="space-y-2">
          <Label>대상 학생</Label>
          <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Checkbox 
                id="select-all-students"
                checked={selectAll} 
                onCheckedChange={() => {
                  setSelectAll(true);
                  setSelectedStudentIds([]);
                }}
                data-testid="checkbox-all-students"
              />
              <label htmlFor="select-all-students" className="text-sm font-medium cursor-pointer">
                전체 학생
              </label>
            </div>
            {(classStudents ?? []).map((student: any) => (
              <div 
                key={student.id} 
                className="flex items-center gap-2"
              >
                <Checkbox 
                  id={`student-${student.id}`}
                  checked={!selectAll && selectedStudentIds.includes(student.id)}
                  onCheckedChange={(checked) => {
                    if (selectAll) {
                      setSelectAll(false);
                      setSelectedStudentIds([student.id]);
                    } else if (checked) {
                      setSelectedStudentIds((prev) => [...prev, student.id]);
                    } else {
                      setSelectedStudentIds((prev) => prev.filter((id) => id !== student.id));
                    }
                  }}
                  data-testid={`checkbox-student-${student.id}`}
                />
                <label 
                  htmlFor={`student-${student.id}`} 
                  className="text-sm cursor-pointer"
                >
                  {student.name}
                </label>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {selectAll 
              ? "전체 학생에게 대면검사가 등록됩니다" 
              : selectedStudentIds.length > 0 
                ? `${selectedStudentIds.length}명의 학생에게 대면검사가 등록됩니다`
                : "학생을 선택해주세요"}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="title">검사 내용</Label>
        <Textarea
          id="title"
          value={formData.title}
          onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
          placeholder="예: 영어단어 1~50번 외우기"
          required
          data-testid="input-check-title"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">추가 설명 (선택)</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
          placeholder="예: 교재 2단원"
          data-testid="input-check-description"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dueDate">검사일</Label>
        <Input
          id="dueDate"
          type="date"
          value={formData.dueDate}
          onChange={(e) => setFormData((p) => ({ ...p, dueDate: e.target.value }))}
          required
          data-testid="input-check-due-date"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button 
          type="submit" 
          disabled={createMutation.isPending || (!selectAll && selectedStudentIds.length === 0)} 
          data-testid="button-create-check"
        >
          {createMutation.isPending ? (editingCheck ? "수정 중..." : "등록 중...") : (editingCheck ? "검사 수정" : "검사 등록")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ViewCheckDialog({ check, result, onClose }: { 
  check: FaceToFaceCheck; 
  result?: FaceToFaceCheckResult;
  onClose: () => void 
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold break-words">{check.title}</h3>
        {check.description && (
          <p className="text-sm text-muted-foreground mt-1">{check.description}</p>
        )}
        <p className="text-sm text-muted-foreground mt-2">
          검사일: {format(new Date(check.dueDate), "M월 d일", { locale: ko })}
        </p>
      </div>

      {result?.status === "checked" && (
        <div className="p-3 rounded-md bg-green-50 border border-green-200">
          <p className="text-sm font-medium text-green-800">검사 완료</p>
          <CompletionIndicator rate={result.completionRate || 0} />
          {result.feedback && (
            <p className="text-sm mt-2">{result.feedback}</p>
          )}
        </div>
      )}

      {result?.status === "recheck" && (
        <div className="p-3 rounded-md bg-amber-50 border border-amber-200">
          <p className="text-sm font-medium text-amber-800">재검사 필요</p>
          {result.feedback && (
            <p className="text-sm mt-1">{result.feedback}</p>
          )}
        </div>
      )}

      {(!result || result.status === "pending") && (
        <div className="p-3 rounded-md bg-muted">
          <p className="text-sm text-muted-foreground">아직 검사가 진행되지 않았습니다</p>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          닫기
        </Button>
      </DialogFooter>
    </div>
  );
}

function CheckStudentsDialog({ check, results, onClose }: { 
  check: FaceToFaceCheck;
  results: FaceToFaceCheckResult[];
  onClose: () => void 
}) {
  const { toast } = useToast();
  const [studentRates, setStudentRates] = useState<Record<string, number>>({});
  
  const { data: classStudents, isLoading, error } = useQuery<any[]>({
    queryKey: ["/api/classes", check.classId, "students"],
    enabled: !!check.classId,
  });

  const targetStudents = check.studentId 
    ? classStudents?.filter((s) => s.id === check.studentId) 
    : classStudents;

  const getResultForStudent = (studentId: string) => {
    return results.find((r) => r.checkId === check.id && r.studentId === studentId);
  };

  const getStudentRate = (studentId: string) => {
    if (studentRates[studentId] !== undefined) return studentRates[studentId];
    const result = getResultForStudent(studentId);
    return result?.completionRate || 0;
  };

  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  
  const markMutation = useMutation({
    mutationKey: ["check-student", check.id],
    mutationFn: async ({ studentId, completionRate }: { studentId: string; completionRate: number }) => {
      const existingResult = getResultForStudent(studentId);
      if (existingResult) {
        await apiRequest("PATCH", `/api/face-to-face-check-results/${existingResult.id}`, {
          status: "checked",
          completionRate,
        });
      } else {
        await apiRequest("POST", "/api/face-to-face-check-results", {
          checkId: check.id,
          studentId,
          status: "checked",
          completionRate,
        });
      }
      return { studentId };
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/face-to-face-checks");
      invalidateQueriesStartingWith("/api/face-to-face-check-results");
      // Also invalidate student-specific queries so students see the updated status
      invalidateQueriesStartingWith("/api/students/");
      toast({ title: "저장되었습니다" });
      setSavingStudentId(null);
    },
    onError: () => {
      toast({ title: "저장에 실패했습니다", variant: "destructive" });
      setSavingStudentId(null);
    },
  });

  const handleMark = (studentId: string, completionRate: number) => {
    if (savingStudentId) return;
    setSavingStudentId(studentId);
    markMutation.mutate({ studentId, completionRate });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold break-words">{check.title}</h3>
        <p className="text-sm text-muted-foreground">
          검사일: {format(new Date(check.dueDate), "M월 d일", { locale: ko })}
        </p>
      </div>

      {!check.classId ? (
        <p className="text-center py-4 text-muted-foreground">수업 정보가 없습니다</p>
      ) : error ? (
        <p className="text-center py-4 text-destructive">학생 목록을 불러오는데 실패했습니다</p>
      ) : isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {targetStudents?.map((student) => {
            const result = getResultForStudent(student.id);
            const isComplete = result?.status === "checked";
            const currentRate = getStudentRate(student.id);

            return (
              <div
                key={student.id}
                className="p-3 rounded-md bg-muted/50 space-y-2"
                data-testid={`check-student-${student.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{student.name}</span>
                    {isComplete && (
                      <Badge variant="secondary" className="text-xs">
                        검사완료
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm font-medium">{currentRate}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <RateStepPicker
                    value={currentRate}
                    onChange={(v) => setStudentRates((p) => ({ ...p, [student.id]: v }))}
                    className="flex-1"
                    testIdPrefix={`rate-${student.id}`}
                  />
                  <Button
                    size="sm"
                    onClick={() => handleMark(student.id, currentRate)}
                    disabled={savingStudentId === student.id}
                    data-testid={`button-save-${student.id}`}
                  >
                    {savingStudentId === student.id ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
          {(!targetStudents || targetStudents.length === 0) && (
            <p className="text-center py-4 text-muted-foreground">등록된 학생이 없습니다</p>
          )}
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          닫기
        </Button>
      </DialogFooter>
    </div>
  );
}

function ReviewCheckDialog({ result, onClose }: { 
  result: any;
  onClose: () => void 
}) {
  const { toast } = useToast();
  const [completionRate, setCompletionRate] = useState(result.completionRate || 0);
  const [feedback, setFeedback] = useState(result.feedback || "");

  const reviewMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!result.id) {
        throw new Error("Result ID is missing");
      }
      return apiRequest("PATCH", `/api/face-to-face-check-results/${result.id}`, data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/face-to-face-checks");
      invalidateQueriesStartingWith("/api/face-to-face-check-results");
      // Also invalidate student-specific queries so students see the updated status
      invalidateQueriesStartingWith("/api/students/");
      toast({ title: "검사가 완료되었습니다" });
      onClose();
    },
    onError: () => {
      toast({ title: "검사에 실패했습니다", variant: "destructive" });
    },
  });

  const handleReview = (status: string) => {
    reviewMutation.mutate({
      status,
      completionRate: status === "recheck" ? 0 : completionRate,
      feedback,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">{result.student?.name}의 대면검사</h3>
        <p className="text-sm text-muted-foreground">{result.check?.title}</p>
      </div>

      <div className="space-y-2">
        <Label>완성도: {completionRate}%</Label>
        <RateStepPicker
          value={completionRate}
          onChange={setCompletionRate}
          testIdPrefix="rate-completion"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="feedback">피드백</Label>
        <Textarea
          id="feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="선택사항"
          data-testid="input-feedback"
        />
      </div>

      <DialogFooter className="flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          onClick={() => handleReview("recheck")}
          disabled={reviewMutation.isPending}
          data-testid="button-recheck"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          재검사 필요
        </Button>
        <Button
          onClick={() => handleReview("checked")}
          disabled={reviewMutation.isPending}
          data-testid="button-complete-review"
        >
          <Check className="h-4 w-4 mr-2" />
          검사 완료
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function FaceToFaceChecksPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCheck, setEditingCheck] = useState<FaceToFaceCheck | null>(null);
  const [selectedCheck, setSelectedCheck] = useState<FaceToFaceCheck | null>(null);
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [checkStudentsCheck, setCheckStudentsCheck] = useState<FaceToFaceCheck | null>(null);
  const [dayCheckList, setDayCheckList] = useState<FaceToFaceCheck[] | null>(null);
  const [dayCheckDate, setDayCheckDate] = useState<string>("");
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [calendarCreateDate, setCalendarCreateDate] = useState<string>("");
  const [uncheckCheckId, setUncheckCheckId] = useState<string | null>(null);
  const [uncheckDate, setUncheckDate] = useState<string>("");
  const [teacherViewTab, setTeacherViewTab] = useState<"my" | "assistant">("my");
  const [publishedStudentId, setPublishedStudentId] = useState<string | null>(null);

  const isTeacherOrAbove = user && user.role >= UserRole.TEACHER;
  const isAdminOrPrincipal = user && user.role >= UserRole.PRINCIPAL;
  const isStudent = user && user.role === UserRole.STUDENT;

  const { data: teachers } = useQuery<any[]>({
    queryKey: [`/api/centers/${selectedCenter?.id}/teachers`],
    enabled: !!selectedCenter?.id && !!isAdminOrPrincipal,
  });

  const { data: classes } = useQuery<Class[]>({
    queryKey: [`/api/classes?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id && !!isTeacherOrAbove,
  });

  const { data: studentEnrollments } = useQuery<any[]>({
    queryKey: [`/api/students/${user?.id}/enrollments`],
    enabled: !!user?.id && !!isStudent,
  });

  const studentClasses: Class[] = studentEnrollments
    ?.filter((e: any) => e.class !== null)
    .map((e: any) => e.class as Class) || [];

  const { data: checks, isLoading: loadingChecks } = useQuery<FaceToFaceCheck[]>({
    queryKey: isTeacherOrAbove 
      ? [`/api/face-to-face-checks?centerId=${selectedCenter?.id}`]
      : [`/api/students/${user?.id}/face-to-face-checks?centerId=${selectedCenter?.id}`],
    enabled: isTeacherOrAbove ? !!selectedCenter?.id : (!!user?.id && !!selectedCenter?.id),
  });

  const { data: results } = useQuery<FaceToFaceCheckResult[]>({
    queryKey: isTeacherOrAbove
      ? [`/api/face-to-face-check-results?centerId=${selectedCenter?.id}`]
      : [`/api/students/${user?.id}/face-to-face-check-results?centerId=${selectedCenter?.id}`],
    enabled: isTeacherOrAbove ? !!selectedCenter?.id : (!!user?.id && !!selectedCenter?.id),
  });

  const { data: uncheckStudents } = useQuery<any[]>({
    queryKey: ["/api/face-to-face-checks", uncheckCheckId, "unchecked"],
    enabled: !!uncheckCheckId,
  });

  const { data: classStudentsForFilter } = useQuery<any[]>({
    queryKey: [`/api/classes/${selectedClass}/students`],
    enabled: !!isTeacherOrAbove && selectedClass !== "all",
  });

  const { data: centerStudentsForFilter } = useQuery<any[]>({
    queryKey: [`/api/centers/${selectedCenter?.id}/students`],
    enabled: !!isTeacherOrAbove && selectedClass === "all" && !!selectedCenter?.id,
  });

  const filterStudents = (selectedClass !== "all"
    ? classStudentsForFilter
    : centerStudentsForFilter?.filter((s: any) => s.role === UserRole.STUDENT)) || [];

  const { data: publishedStudentEnrollments, isLoading: loadingPublishedEnrollments } = useQuery<any[]>({
    queryKey: [`/api/students/${publishedStudentId}/enrollments`],
    enabled: !!publishedStudentId && !!isTeacherOrAbove,
  });

  useEffect(() => {
    setPublishedStudentId(null);
  }, [selectedClass, selectedTeacher, selectedCenter?.id]);

  const isTeacherOnly = user && user.role === UserRole.TEACHER;
  const teacherClasses = classes?.filter((c) => {
    if (isTeacherOnly) return c.teacherId === user.id || isAssistantTeacher(c, user.id);
    if (!selectedTeacher) return true;
    return c.teacherId === selectedTeacher || isAssistantTeacher(c, selectedTeacher);
  }) ?? [];

  const ownClasses = isTeacherOnly
    ? teacherClasses.filter((c) => c.teacherId === user.id)
    : teacherClasses;
  const assistantClasses = isTeacherOnly
    ? teacherClasses.filter((c) => isAssistantTeacher(c, user.id) && c.teacherId !== user.id)
    : [];
  const hasAssistantClasses = assistantClasses.length > 0;
  const displayClasses = isTeacherOnly && hasAssistantClasses
    ? (teacherViewTab === "assistant" ? assistantClasses : ownClasses)
    : teacherClasses;

  const isWithinDateFilter = (dueDate: string | Date) => {
    if (dateFilter === "all") return true;
    const date = new Date(dueDate);
    const today = new Date();
    
    switch (dateFilter) {
      case "today":
        return isSameDay(date, today);
      case "thisWeek":
        return isWithinInterval(date, { 
          start: startOfWeek(today, { weekStartsOn: 1 }), 
          end: endOfWeek(today, { weekStartsOn: 1 }) 
        });
      case "thisMonth":
        return isSameMonth(date, today);
      case "last7days":
        return isWithinInterval(date, { 
          start: subDays(today, 7), 
          end: today 
        });
      default:
        return true;
    }
  };

  const filteredChecks = checks?.filter((check) => {
    if (!isWithinDateFilter(check.dueDate)) return false;
    
    if (isStudent) {
      if (selectedClass !== "all" && check.classId !== selectedClass) return false;
      return true;
    }
    if (!classes || classes.length === 0) return true;
    const checkClass = classes.find((c) => c.id === check.classId);
    if (!checkClass) return true;
    if (isTeacherOnly) {
      if (hasAssistantClasses) {
        const classIds = displayClasses.map((c) => c.id);
        if (!classIds.includes(check.classId)) return false;
      } else if (checkClass.teacherId !== user.id && !isAssistantTeacher(checkClass, user.id)) {
        return false;
      }
    }
    if (isAdminOrPrincipal && selectedTeacher && checkClass.teacherId !== selectedTeacher && !isAssistantTeacher(checkClass, selectedTeacher)) return false;
    if (selectedClass !== "all" && check.classId !== selectedClass) return false;
    return true;
  }) ?? [];

  const publishedEnrolledClassIds = new Set(
    (publishedStudentEnrollments || [])
      .map((e: any) => e.classId ?? e.class?.id)
      .filter(Boolean)
  );

  const publishedChecks = publishedStudentId
    ? filteredChecks.filter((check) =>
        check.studentId === publishedStudentId ||
        (!check.studentId && publishedEnrolledClassIds.has(check.classId))
      )
    : filteredChecks;

  const filteredResults = results?.filter((result: any) => {
    const check = checks?.find((c) => c.id === result.checkId);
    if (!check) return false;
    
    if (!isWithinDateFilter(check.dueDate)) return false;
    
    if (isStudent) {
      if (selectedClass !== "all" && check.classId !== selectedClass) return false;
      return true;
    }
    if (!classes || classes.length === 0) return true;
    const checkClass = classes.find((c) => c.id === check.classId);
    if (!checkClass) return true;
    if (isTeacherOnly) {
      if (hasAssistantClasses) {
        const classIds = displayClasses.map((c) => c.id);
        if (!classIds.includes(check.classId)) return false;
      } else if (checkClass.teacherId !== user.id && !isAssistantTeacher(checkClass, user.id)) {
        return false;
      }
    }
    if (isAdminOrPrincipal && selectedTeacher && checkClass.teacherId !== selectedTeacher && !isAssistantTeacher(checkClass, selectedTeacher)) return false;
    if (selectedClass !== "all" && check.classId !== selectedClass) return false;
    return true;
  }) ?? [];

  const handleDateClick = (date: Date, dayChecks: FaceToFaceCheck[]) => {
    const dateStr = format(date, "yyyy-MM-dd");
    if (isTeacherOrAbove) {
      setDayCheckList(dayChecks);
      setDayCheckDate(dateStr);
    } else if (dayChecks.length === 1) {
      setSelectedCheck(dayChecks[0]);
    } else if (dayChecks.length > 1) {
      setDayCheckList(dayChecks);
      setDayCheckDate(dateStr);
    }
  };

  const handleCalendarCreateClick = (date: Date) => {
    setCalendarCreateDate(format(date, "yyyy-MM-dd"));
    setIsCreateOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/face-to-face-checks/${id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/face-to-face-checks");
      toast({ title: "대면검사가 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "대면검사 삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const handleDeleteCheck = (check: FaceToFaceCheck) => {
    if (confirm(`"${check.title}" 대면검사를 삭제하시겠습니까?`)) {
      deleteMutation.mutate(check.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">대면검사</h1>
            <p className="text-muted-foreground">
              {isTeacherOrAbove ? "대면검사 등록 및 관리" : "대면검사 결과 확인"}
            </p>
          </div>
          <ManualButton menuKey="face-to-face-checks" />
        </div>
        {isTeacherOrAbove && (
          <Dialog open={isCreateOpen || !!editingCheck} onOpenChange={(open) => {
            if (!open) {
              setIsCreateOpen(false);
              setEditingCheck(null);
              setCalendarCreateDate("");
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-check" onClick={() => {
                setCalendarCreateDate("");
                setIsCreateOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                대면검사 등록
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCheck ? "대면검사 수정" : "대면검사 등록"}</DialogTitle>
                <DialogDescription>{editingCheck ? "대면검사 내용을 수정합니다" : "새로운 대면검사를 등록합니다"}</DialogDescription>
              </DialogHeader>
              <CreateCheckDialog
                classes={isTeacherOnly ? displayClasses : (classes ?? [])}
                editingCheck={editingCheck}
                initialDate={calendarCreateDate}
                preSelectedClassId={selectedClass !== "all" ? selectedClass : undefined}
                onClose={() => {
                  setIsCreateOpen(false);
                  setEditingCheck(null);
                  setCalendarCreateDate("");
                }}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isAdminOrPrincipal && teachers && teachers.length > 0 && (
        <div className="space-y-3">
          <Tabs value={selectedTeacher} onValueChange={(v) => {
            setSelectedTeacher(v);
            setSelectedClass("all");
          }}>
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="" data-testid="teacher-tab-all">
                모든 선생님
              </TabsTrigger>
              {teachers.map((t: any) => (
                <TabsTrigger key={t.id} value={t.id} data-testid={`teacher-tab-${t.id}`}>
                  {t.name} 선생님
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {teacherClasses.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">수업:</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedClass === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedClass("all")}
                  data-testid="class-filter-all"
                >
                  전체
                </Button>
                {teacherClasses.map((c) => (
                  <Button
                    key={c.id}
                    variant={selectedClass === c.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedClass(c.id)}
                    data-testid={`class-filter-${c.id}`}
                  >
                    {c.name} ({c.subject})
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isTeacherOnly && teacherClasses.length > 0 && (
        <div className="space-y-3">
          <TeacherClassTabs
            teacherViewTab={teacherViewTab}
            onTabChange={(tab) => {
              setTeacherViewTab(tab);
              setSelectedClass("all");
            }}
            ownCount={ownClasses.length}
            assistantCount={assistantClasses.length}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">수업:</span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedClass === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedClass("all")}
                data-testid="teacher-class-filter-all"
              >
                전체
              </Button>
              {displayClasses.map((c) => (
                <Button
                  key={c.id}
                  variant={selectedClass === c.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedClass(c.id)}
                  data-testid={`teacher-class-filter-${c.id}`}
                >
                  {c.name} ({c.subject})
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isStudent && studentClasses.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">수업:</span>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedClass === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedClass("all")}
              data-testid="student-class-filter-all"
            >
              전체
            </Button>
            {studentClasses.map((c) => (
              <Button
                key={c.id}
                variant={selectedClass === c.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedClass(c.id)}
                data-testid={`student-class-filter-${c.id}`}
              >
                {c.name} ({c.subject})
              </Button>
            ))}
          </div>
        </div>
      )}

      {isTeacherOrAbove && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">기간:</span>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={dateFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateFilter("all")}
              data-testid="date-filter-all"
            >
              전체
            </Button>
            <Button
              variant={dateFilter === "today" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateFilter("today")}
              data-testid="date-filter-today"
            >
              오늘
            </Button>
            <Button
              variant={dateFilter === "thisWeek" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateFilter("thisWeek")}
              data-testid="date-filter-this-week"
            >
              이번 주
            </Button>
            <Button
              variant={dateFilter === "thisMonth" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateFilter("thisMonth")}
              data-testid="date-filter-this-month"
            >
              이번 달
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>대면검사 달력</CardTitle>
            <CardDescription>
              {isTeacherOrAbove 
                ? "날짜를 클릭하여 대면검사 확인 또는 등록"
                : "날짜를 클릭하여 대면검사 확인"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingChecks ? (
              <Skeleton className="h-[400px] w-full" />
            ) : (
              <CheckCalendar
                checks={filteredChecks}
                results={filteredResults}
                onDateClick={handleDateClick}
                onCreateClick={handleCalendarCreateClick}
                isTeacher={!!isTeacherOrAbove}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {isTeacherOrAbove ? "대면검사 관리" : "미완료 대면검사"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingChecks ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : isTeacherOrAbove ? (
              <Tabs defaultValue="pending" className="w-full">
                <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto gap-1">
                  <TabsTrigger value="pending" className="text-xs sm:text-sm" data-testid="tab-pending">
                    미검사 ({filteredResults.filter((r) => r.status === "pending" || !r.status).length})
                  </TabsTrigger>
                  <TabsTrigger value="checked" className="text-xs sm:text-sm" data-testid="tab-checked">
                    검사완료 ({filteredResults.filter((r) => r.status === "checked").length})
                  </TabsTrigger>
                  <TabsTrigger value="published" className="text-xs sm:text-sm" data-testid="tab-published">
                    숙제목록 ({publishedChecks.length})
                  </TabsTrigger>
                  <TabsTrigger value="unchecked" className="text-xs sm:text-sm" data-testid="tab-unchecked">
                    미검사 학생
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="pending" className="mt-3 space-y-2">
                  {filteredResults
                    .filter((r) => r.status === "pending" || !r.status)
                    .map((result: any) => {
                      const checkClass = classes?.find((c) => c.id === result.check?.classId);
                      return (
                        <button
                          key={result.id}
                          onClick={() => setSelectedResult(result)}
                          className="w-full p-3 rounded-md bg-muted/50 text-left hover-elevate"
                          data-testid={`result-item-${result.id}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{result.student?.name}</span>
                            <div className="flex items-center gap-2">
                              {checkClass && <Badge variant="secondary" className="text-xs">{checkClass.name}</Badge>}
                              <Badge variant="outline">미검사</Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{result.check?.title}</p>
                        </button>
                      );
                    })}
                  {filteredResults.filter((r) => r.status === "pending" || !r.status).length === 0 && (
                    <p className="text-center py-8 text-muted-foreground">미검사 항목이 없습니다</p>
                  )}
                </TabsContent>
                <TabsContent value="checked" className="mt-3 space-y-2">
                  {filteredResults
                    .filter((r) => r.status === "checked")
                    .map((result: any) => {
                      const checkClass = classes?.find((c) => c.id === result.check?.classId);
                      return (
                        <button
                          key={result.id}
                          onClick={() => setSelectedResult(result)}
                          className="w-full p-3 rounded-md bg-muted/50 text-left hover-elevate"
                          data-testid={`checked-item-${result.id}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{result.student?.name}</span>
                            <div className="flex items-center gap-2">
                              {checkClass && <Badge variant="secondary" className="text-xs">{checkClass.name}</Badge>}
                              <CompletionDot rate={result.completionRate || 0} />
                              <Badge variant="outline">
                                {result.completionRate}%
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{result.check?.title}</p>
                        </button>
                      );
                    })}
                  {filteredResults.filter((r) => r.status === "checked").length === 0 && (
                    <p className="text-center py-8 text-muted-foreground">검사 완료된 항목이 없습니다</p>
                  )}
                </TabsContent>
                <TabsContent value="published" className="mt-3 space-y-2">
                  <StudentFilterPicker
                    students={filterStudents}
                    selectedStudentId={publishedStudentId}
                    onSelect={setPublishedStudentId}
                  />
                  {publishedStudentId && loadingPublishedEnrollments ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : (
                  <>
                  {[...publishedChecks].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()).map((check) => {
                    const checkClass = classes?.find((c) => c.id === check.classId);
                    return (
                      <div
                        key={check.id}
                        className="p-3 rounded-md bg-muted/50"
                        data-testid={`published-check-${check.id}`}
                      >
                        <p className="font-medium break-words mb-1">{check.title}</p>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {checkClass && <Badge variant="secondary" className="text-xs">{checkClass.name}</Badge>}
                          <Badge variant="outline">
                            {format(new Date(check.dueDate), "M/d", { locale: ko })}
                          </Badge>
                        </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCheckStudentsCheck(check)}
                          data-testid={`button-check-students-${check.id}`}
                        >
                          <Users className="h-4 w-4 mr-1" />
                          학생 검사
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingCheck(check)}
                          data-testid={`button-edit-check-${check.id}`}
                        >
                          수정
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => handleDeleteCheck(check)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-check-${check.id}`}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    );
                  })}
                  {publishedChecks.length === 0 && (
                    <p className="text-center py-8 text-muted-foreground">등록된 대면검사가 없습니다</p>
                  )}
                  </>
                  )}
                </TabsContent>
                <TabsContent value="unchecked" className="mt-3 space-y-4">
                  <div className="space-y-2">
                    <Label>날짜 선택</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={uncheckDate}
                        onChange={(e) => {
                          setUncheckDate(e.target.value);
                          setUncheckCheckId(null);
                        }}
                        className="w-auto"
                        data-testid="input-unchecked-date"
                      />
                      {uncheckDate && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUncheckDate("");
                            setUncheckCheckId(null);
                          }}
                          data-testid="button-clear-unchecked-date"
                        >
                          전체 보기
                        </Button>
                      )}
                    </div>
                  </div>
                  {uncheckDate ? (
                    <div className="space-y-2">
                      <Label>대면검사 선택</Label>
                      {(() => {
                        const dayChecks = [...filteredChecks]
                          .filter((check) => format(new Date(check.dueDate), "yyyy-MM-dd") === uncheckDate)
                          .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
                        if (dayChecks.length === 0) {
                          return <p className="text-sm text-muted-foreground py-2">선택한 날짜에 등록된 대면검사가 없습니다</p>;
                        }
                        return (
                          <div className="space-y-1">
                            {dayChecks.map((check) => {
                              const checkClass = classes?.find((c) => c.id === check.classId);
                              const isActive = uncheckCheckId === check.id;
                              return (
                                <button
                                  key={check.id}
                                  type="button"
                                  onClick={() => setUncheckCheckId(check.id)}
                                  className={cn(
                                    "w-full p-3 rounded-md text-left hover-elevate",
                                    isActive ? "bg-primary text-primary-foreground" : "bg-muted/50"
                                  )}
                                  data-testid={`button-unchecked-check-${check.id}`}
                                >
                                  <span className="font-medium break-words">{check.title}</span>
                                  <span className={cn("text-sm ml-2", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                    {checkClass && `${checkClass.name} ${checkClass.subject}반`}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>대면검사 선택</Label>
                      <Select value={uncheckCheckId || ""} onValueChange={(v) => setUncheckCheckId(v || null)}>
                        <SelectTrigger data-testid="select-check-unchecked">
                          <SelectValue placeholder="대면검사를 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          {[...filteredChecks].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()).map((check) => {
                            const checkClass = classes?.find((c) => c.id === check.classId);
                            return (
                              <SelectItem key={check.id} value={check.id}>
                                {check.title} {checkClass && `(${checkClass.name})`} - {format(new Date(check.dueDate), "M/d", { locale: ko })}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {uncheckCheckId && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        미검사 학생 ({uncheckStudents?.length || 0}명)
                      </p>
                      {uncheckStudents && uncheckStudents.length > 0 ? (
                        <div className="space-y-2">
                          {uncheckStudents.map((student: any) => (
                            <div
                              key={student.id}
                              className="p-3 rounded-md bg-muted/50"
                              data-testid={`unchecked-student-${student.id}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{student.name}</span>
                                <Badge variant="destructive">미검사</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : uncheckStudents?.length === 0 ? (
                        <p className="text-center py-4 text-muted-foreground">모든 학생이 검사 완료되었습니다</p>
                      ) : null}
                    </div>
                  )}
                  {!uncheckCheckId && (
                    <p className="text-center py-8 text-muted-foreground">대면검사를 선택하면 미검사 학생 목록이 표시됩니다</p>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-3">
                {filteredChecks
                  .filter((check) => {
                    const result = filteredResults.find((r) => r.checkId === check.id);
                    return !result || result.status === "pending" || result.status === "recheck";
                  })
                  .map((check) => {
                    const result = filteredResults.find((r) => r.checkId === check.id);
                    return (
                      <button
                        key={check.id}
                        onClick={() => setSelectedCheck(check)}
                        className="w-full p-3 rounded-md bg-muted/50 text-left hover-elevate"
                        data-testid={`check-item-${check.id}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-medium break-words flex-1 min-w-0">{check.title}</span>
                          <Badge variant={result?.status === "recheck" ? "destructive" : "outline"} className="flex-shrink-0">
                            {result?.status === "recheck" ? "재검사" : "미검사"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          검사일: {format(new Date(check.dueDate), "M월 d일", { locale: ko })}
                        </p>
                      </button>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedCheck} onOpenChange={(open) => !open && setSelectedCheck(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>대면검사 상세</DialogTitle>
          </DialogHeader>
          {selectedCheck && (
            isTeacherOrAbove ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">검사 내용</p>
                  <p className="font-medium break-words">{selectedCheck.title}</p>
                </div>
                {selectedCheck.description && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">추가 설명</p>
                    <p>{selectedCheck.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">검사일</p>
                  <p>{format(new Date(selectedCheck.dueDate), "yyyy년 M월 d일", { locale: ko })}</p>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setSelectedCheck(null)}>
                    닫기
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => {
                      if (confirm(`"${selectedCheck.title}" 대면검사를 삭제하시겠습니까?`)) {
                        deleteMutation.mutate(selectedCheck.id);
                        setSelectedCheck(null);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    data-testid="button-delete-check"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    삭제
                  </Button>
                  <Button onClick={() => {
                    setSelectedCheck(null);
                    setEditingCheck(selectedCheck);
                  }} data-testid="button-edit-check">
                    수정
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <ViewCheckDialog
                check={selectedCheck}
                result={results?.find((r) => r.checkId === selectedCheck.id)}
                onClose={() => setSelectedCheck(null)}
              />
            )
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedResult} onOpenChange={(open) => !open && setSelectedResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>대면검사</DialogTitle>
          </DialogHeader>
          {selectedResult && (
            <ReviewCheckDialog
              result={selectedResult}
              onClose={() => setSelectedResult(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!dayCheckList} onOpenChange={(open) => {
        if (!open) {
          setDayCheckList(null);
          setDayCheckDate("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dayCheckDate && format(new Date(dayCheckDate), "M월 d일", { locale: ko })} 대면검사
            </DialogTitle>
            <DialogDescription>
              {isTeacherOrAbove ? "대면검사를 선택하여 확인하거나 수정하세요" : "확인할 대면검사를 선택하세요"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {dayCheckList?.map((check) => {
              const result = results?.find((r) => r.checkId === check.id);
              const checkClass = classes?.find((c) => c.id === check.classId);
              return (
                <div
                  key={check.id}
                  className="w-full p-3 rounded-md bg-muted/50 hover-elevate"
                  data-testid={`day-check-${check.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => {
                        setDayCheckList(null);
                        setDayCheckDate("");
                        setSelectedCheck(check);
                      }}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="font-medium break-words whitespace-normal">{check.title}</span>
                        <CompletionDot rate={result?.completionRate || 0} />
                      </div>
                      {checkClass && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {checkClass.name} ({checkClass.subject})
                        </div>
                      )}
                    </button>
                    {isTeacherOrAbove && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDayCheckList(null);
                            setDayCheckDate("");
                            setEditingCheck(check);
                          }}
                          data-testid={`button-edit-day-check-${check.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            handleDeleteCheck(check);
                            setDayCheckList(null);
                            setDayCheckDate("");
                          }}
                          data-testid={`button-delete-day-check-${check.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {isTeacherOrAbove && dayCheckDate && (
            <DialogFooter>
              <Button
                onClick={() => {
                  setDayCheckList(null);
                  setCalendarCreateDate(dayCheckDate);
                  setDayCheckDate("");
                  setIsCreateOpen(true);
                }}
                data-testid="button-add-check-on-date"
              >
                <Plus className="h-4 w-4 mr-2" />
                대면검사 추가
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!checkStudentsCheck} onOpenChange={(open) => !open && setCheckStudentsCheck(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>학생 검사</DialogTitle>
            <DialogDescription>학생별 대면검사 완료 여부를 체크하세요</DialogDescription>
          </DialogHeader>
          {checkStudentsCheck && results && (
            <CheckStudentsDialog
              check={checkStudentsCheck}
              results={results}
              onClose={() => setCheckStudentsCheck(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
