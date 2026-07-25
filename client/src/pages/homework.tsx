import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ManualButton } from "@/components/manual-button";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, isWithinInterval, subWeeks, subDays } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Upload, Check, RefreshCw, Eye, Camera, X, Users, Trash2, Pencil, RotateCw, Maximize2 } from "lucide-react";
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
import { UserRole, isAssistantTeacher, type Homework, type HomeworkSubmission, type Class } from "@shared/schema";
import { cn } from "@/lib/utils";
import { CompletionIndicator, CompletionDot } from "@/components/completion-indicator";
import { TeacherClassTabs } from "@/components/teacher-class-tabs";
import { StudentFilterPicker } from "@/components/student-filter-picker";

function HomeworkCalendar({ 
  homework, 
  submissions,
  onDateClick,
  onCreateClick,
  isTeacher
}: { 
  homework: Homework[];
  submissions: HomeworkSubmission[];
  onDateClick: (date: Date, hw: Homework[]) => void;
  onCreateClick?: (date: Date) => void;
  isTeacher?: boolean;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getHomeworkForDate = (date: Date) => {
    return homework.filter((hw) => isSameDay(new Date(hw.dueDate), date));
  };

  const getSubmissionForHomework = (hwId: string) => {
    return submissions.find((s) => s.homeworkId === hwId);
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
          const dayHomework = getHomeworkForDate(day);
          const isToday = isSameDay(day, new Date());
          const hasHomework = dayHomework.length > 0;
          const isClickable = hasHomework || isTeacher;

          const handleClick = () => {
            if (hasHomework) {
              onDateClick(day, dayHomework);
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
                {dayHomework.slice(0, 2).map((hw) => {
                  const sub = getSubmissionForHomework(hw.id);
                  return (
                    <div
                      key={hw.id}
                      className="flex items-center gap-1"
                    >
                      <CompletionDot rate={sub?.completionRate || 0} />
                      <span className="text-[10px] truncate">{hw.title}</span>
                    </div>
                  );
                })}
                {dayHomework.length > 2 && (
                  <div className="text-[10px] text-muted-foreground">
                    +{dayHomework.length - 2}개
                  </div>
                )}
                {isTeacher && !hasHomework && (
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

function CreateHomeworkDialog({ classes, onClose, editingHomework, initialDate, preSelectedClassId }: { 
  classes: Class[]; 
  onClose: () => void;
  editingHomework?: Homework | null;
  initialDate?: string;
  preSelectedClassId?: string;
}) {
  const { toast } = useToast();
  const effectiveClassId = editingHomework?.classId || preSelectedClassId || "";
  const [formData, setFormData] = useState({
    classId: effectiveClassId,
    title: editingHomework?.title || "",
    dueDate: editingHomework?.dueDate || initialDate || format(new Date(), "yyyy-MM-dd"),
  });
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    editingHomework?.studentId ? [editingHomework.studentId] : []
  );
  const [selectAll, setSelectAll] = useState(!editingHomework?.studentId);
  
  const showClassSelector = !preSelectedClassId || !!editingHomework;

  const selectedClass = classes.find((c) => c.id === formData.classId);
  
  const { data: classStudents } = useQuery<any[]>({
    queryKey: ["/api/classes", formData.classId, "students"],
    enabled: !!formData.classId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingHomework) {
        return apiRequest("PATCH", `/api/homework/${editingHomework.id}`, data);
      }
      if (data.studentIds && data.studentIds.length > 0) {
        return apiRequest("POST", "/api/homework/bulk", data);
      }
      return apiRequest("POST", "/api/homework", data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/homework");
      invalidateQueriesStartingWith("/api/students");
      toast({ title: editingHomework ? "숙제가 수정되었습니다" : "숙제가 출제되었습니다" });
      onClose();
    },
    onError: (error: any) => {
      console.error("Homework creation error:", error);
      toast({ 
        title: "숙제 출제에 실패했습니다", 
        description: error?.serverMessage || error?.message || "알 수 없는 오류",
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingHomework) {
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

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudentIds((prev) => 
      prev.includes(studentId) 
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
    setSelectAll(false);
  };

  const handleSelectAll = () => {
    setSelectAll(true);
    setSelectedStudentIds([]);
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
            <SelectTrigger data-testid="select-homework-class">
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
              ? "전체 학생에게 숙제가 출제됩니다" 
              : selectedStudentIds.length > 0 
                ? `${selectedStudentIds.length}명의 학생에게 숙제가 출제됩니다`
                : "학생을 선택해주세요"}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="title">숙제 내용</Label>
        <Textarea
          id="title"
          value={formData.title}
          onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
          placeholder="예: 교과서 32~35페이지 풀기"
          required
          data-testid="input-homework-title"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dueDate">마감일</Label>
        <Input
          id="dueDate"
          type="date"
          value={formData.dueDate}
          onChange={(e) => setFormData((p) => ({ ...p, dueDate: e.target.value }))}
          required
          data-testid="input-homework-due-date"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button 
          type="submit" 
          disabled={createMutation.isPending || (!selectAll && selectedStudentIds.length === 0)} 
          data-testid="button-create-homework"
        >
          {createMutation.isPending ? (editingHomework ? "수정 중..." : "출제 중...") : (editingHomework ? "숙제 수정" : "숙제 출제")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function SubmitHomeworkDialog({ homework, submission, onClose }: { 
  homework: Homework; 
  submission?: HomeworkSubmission;
  onClose: () => void 
}) {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // Load photos separately to reduce memory usage
  useEffect(() => {
    if (submission?.id) {
      setLoadingPhotos(true);
      fetch(`/api/homework-submissions/${submission.id}/photos`)
        .then(res => res.json())
        .then(data => {
          setPhotos(data.photos || []);
        })
        .catch(err => {
          console.error("Failed to load photos:", err);
        })
        .finally(() => {
          setLoadingPhotos(false);
        });
    }
  }, [submission?.id]);

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("[Homework] submitMutation started", { submissionId: submission?.id, data });
      try {
        if (submission) {
          console.log("[Homework] Updating existing submission:", submission.id);
          const result = await apiRequest("PATCH", `/api/homework-submissions/${submission.id}`, data);
          console.log("[Homework] PATCH success:", result);
          return result;
        }
        console.log("[Homework] Creating new submission");
        const result = await apiRequest("POST", "/api/homework-submissions", data);
        console.log("[Homework] POST success:", result);
        return result;
      } catch (error: any) {
        console.error("[Homework] submitMutation error:", error?.message, error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("[Homework] onSuccess called", data);
      invalidateQueriesStartingWith("/api/students");
      invalidateQueriesStartingWith("/api/homework");
      toast({ title: "숙제가 제출되었습니다" });
      onClose();
    },
    onError: (error: any) => {
      console.error("[Homework] onError called:", error?.message, error);
      toast({ title: "숙제 제출에 실패했습니다", variant: "destructive" });
    },
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    console.log("[Homework] handlePhotoUpload started, files:", files.length);
    setUploading(true);
    setUploadProgress(0);

    const uploadedPaths: string[] = [];
    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      console.log(`[Homework] Uploading file ${i + 1}/${totalFiles}:`, file.name, file.size, file.type);
      try {
        const res = await fetch("/api/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            contentType: file.type,
            prefix: "homework",
            centerId: selectedCenter?.id,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error("[Homework] Failed to get upload URL:", res.status, errorText);
          throw new Error("Failed to get upload URL");
        }

        const responseData = await res.json();
        console.log("[Homework] Server response:", JSON.stringify(responseData));
        const { uploadURL, publicUrl } = responseData;
        console.log("[Homework] Got upload URL, uploading to R2...", { uploadURL: uploadURL?.substring(0, 50), publicUrl });

        const uploadRes = await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        if (!uploadRes.ok) {
          console.error("[Homework] R2 upload failed:", uploadRes.status);
          throw new Error(`Upload failed with status ${uploadRes.status}`);
        }

        console.log("[Homework] File uploaded successfully:", publicUrl);
        uploadedPaths.push(publicUrl);
        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      } catch (error: any) {
        console.error("[Homework] Upload error:", error?.message, error);
        toast({ title: "이미지 업로드에 실패했습니다", variant: "destructive" });
      }
    }

    console.log("[Homework] All uploads complete, paths:", uploadedPaths);
    setPhotos((prev) => [...prev, ...uploadedPaths]);
    setUploading(false);
    setUploadProgress(0);
  };

  const handleSubmit = () => {
    console.log("[Homework] handleSubmit called", { 
      homeworkId: homework.id, 
      studentId: user?.id, 
      photosCount: photos.length,
      photos: photos
    });
    submitMutation.mutate({
      homeworkId: homework.id,
      studentId: user?.id,
      photos,
      status: "submitted",
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold break-words">{homework.title}</h3>
        <p className="text-sm text-muted-foreground mt-2">
          마감일: {format(new Date(homework.dueDate), "M월 d일", { locale: ko })}
        </p>
      </div>

      {submission?.status === "reviewed" && (
        <div className="p-3 rounded-md bg-green-50 border border-green-200">
          <p className="text-sm font-medium text-green-800">검사 완료</p>
          <CompletionIndicator rate={submission.completionRate || 0} />
          {submission.feedback && (
            <p className="text-sm mt-2">{submission.feedback}</p>
          )}
        </div>
      )}

      {submission?.status === "in_person" && (
        <div className="p-3 rounded-md bg-blue-50 border border-blue-200">
          <p className="text-sm font-medium text-blue-800">대면 검사 완료하였습니다</p>
        </div>
      )}

      {submission?.status === "submitted" && (
        <div className="p-3 rounded-md bg-purple-50 border border-purple-200">
          <p className="text-sm font-medium text-purple-800">제출 완료 (검사 대기중)</p>
          <p className="text-xs text-purple-600 mt-1">아래에서 사진을 수정할 수 있습니다</p>
        </div>
      )}

      {submission?.status === "resubmit" && (
        <div className="p-3 rounded-md bg-amber-50 border border-amber-200">
          <p className="text-sm font-medium text-amber-800">재제출 필요</p>
          {submission.resubmitReason && (
            <p className="text-sm mt-1">{submission.resubmitReason}</p>
          )}
        </div>
      )}

      {user?.role === UserRole.STUDENT && (!submission || submission.status === "pending" || submission.status === "submitted" || submission.status === "resubmit") && (
        <>
          <div className="space-y-2">
            <Label>사진 업로드</Label>
            <div className="max-h-[250px] overflow-y-auto pr-1">
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, i) => {
                  const imgSrc = photo.startsWith("data:") ? photo : photo;
                  return (
                    <div key={i} className="relative aspect-square rounded-md overflow-hidden bg-muted group">
                      <img src={imgSrc} alt="" className="w-full h-full object-cover" loading="lazy" />
                      <button
                        type="button"
                        onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                        data-testid={`button-delete-photo-${i}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
                <label className={cn(
                  "aspect-square rounded-md border-2 border-dashed flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors flex-col gap-1",
                  uploading && "pointer-events-none opacity-50"
                )}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={uploading}
                    data-testid="input-photo-upload"
                  />
                  {uploading ? (
                    <>
                      <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
                      <span className="text-xs text-muted-foreground">{uploadProgress}%</span>
                    </>
                  ) : (
                    <Camera className="h-6 w-6 text-muted-foreground" />
                  )}
                </label>
              </div>
            </div>
            {uploading && (
              <p className="text-xs text-muted-foreground">이미지 업로드 중... {uploadProgress}%</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitMutation.isPending || uploading}
              data-testid="button-submit-homework"
            >
              {submitMutation.isPending ? "제출 중..." : (submission?.status === "submitted" ? "수정 완료" : "숙제 제출")}
            </Button>
          </DialogFooter>
        </>
      )}

      {user?.role !== UserRole.STUDENT && (!submission || submission.status === "pending" || submission.status === "resubmit") && (
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
        </DialogFooter>
      )}
    </div>
  );
}

function InPersonCheckDialog({ homework, submissions, onClose }: { 
  homework: Homework;
  submissions: HomeworkSubmission[];
  onClose: () => void 
}) {
  const { toast } = useToast();
  const [studentRates, setStudentRates] = useState<Record<string, number>>({});
  
  const { data: classStudents, isLoading, error } = useQuery<any[]>({
    queryKey: ["/api/classes", homework.classId, "students"],
    enabled: !!homework.classId,
  });

  // Filter students based on homework target (all or specific student)
  const targetStudents = homework.studentId 
    ? classStudents?.filter((s) => s.id === homework.studentId) 
    : classStudents;

  const getSubmissionForStudent = (studentId: string) => {
    return submissions.find((s) => s.homeworkId === homework.id && s.studentId === studentId);
  };

  const getStudentRate = (studentId: string) => {
    if (studentRates[studentId] !== undefined) return studentRates[studentId];
    const sub = getSubmissionForStudent(studentId);
    return sub?.completionRate || 0;
  };

  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  
  const markMutation = useMutation({
    mutationKey: ["in-person-check", homework.id],
    mutationFn: async ({ studentId, completionRate }: { studentId: string; completionRate: number }) => {
      const existingSub = getSubmissionForStudent(studentId);
      if (existingSub) {
        await apiRequest("PATCH", `/api/homework-submissions/${existingSub.id}`, {
          status: "in_person",
          completionRate,
        });
      } else {
        await apiRequest("POST", "/api/homework-submissions", {
          homeworkId: homework.id,
          studentId,
          status: "in_person",
          completionRate,
          photos: [],
        });
      }
      return { studentId };
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/homework");
      // Also invalidate student-specific queries so students see the updated status
      invalidateQueriesStartingWith("/api/students/");
      // Force refetch unsubmitted query for any homework
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === "/api/homework" && key[2] === "unsubmitted";
        },
      });
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
        <h3 className="font-semibold break-words">{homework.title}</h3>
        <p className="text-sm text-muted-foreground">
          마감: {format(new Date(homework.dueDate), "M월 d일", { locale: ko })}
        </p>
      </div>

      {!homework.classId ? (
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
            const sub = getSubmissionForStudent(student.id);
            const isComplete = sub?.status === "in_person" || sub?.status === "reviewed";
            const currentRate = getStudentRate(student.id);

            return (
              <div
                key={student.id}
                className="p-3 rounded-md bg-muted/50 space-y-2"
                data-testid={`in-person-student-${student.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{student.name}</span>
                    {isComplete && (
                      <Badge variant="secondary" className="text-xs">
                        {sub?.status === "in_person" ? "대면검사" : "사진제출"}
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

function ZoomableImageOverlay({ photos, currentIndex, onClose, onIndexChange }: {
  photos: string[];
  currentIndex: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const lastTouchDist = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);
  const hasMoved = useRef(false);

  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  useEffect(() => { resetZoom(); setRotation(0); }, [currentIndex, resetZoom]);

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
    resetZoom();
  };

  const toggleBrowserFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen?.({ navigationUI: "hide" } as FullscreenOptions);
      }
    } catch {
      // 전체화면 미지원 브라우저는 무시
    }
  };

  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  const isSideways = rotation === 90 || rotation === 270;

  const getTouchDist = (touches: TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: TouchList) => ({
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      lastTouchDist.current = getTouchDist(e.touches);
      lastTouchCenter.current = getTouchCenter(e.touches);
    } else if (e.touches.length === 1 && scale > 1) {
      hasMoved.current = false;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx: translate.x, ty: translate.y };
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDist.current !== null) {
      e.preventDefault();
      const newDist = getTouchDist(e.touches);
      const newCenter = getTouchCenter(e.touches);
      const ratio = newDist / lastTouchDist.current;
      setScale(prev => Math.min(Math.max(prev * ratio, 1), 5));
      if (lastTouchCenter.current) {
        const dx = newCenter.x - lastTouchCenter.current.x;
        const dy = newCenter.y - lastTouchCenter.current.y;
        setTranslate(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      }
      lastTouchDist.current = newDist;
      lastTouchCenter.current = newCenter;
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      hasMoved.current = true;
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      setTranslate({ x: dragStart.current.tx + dx, y: dragStart.current.ty + dy });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    lastTouchDist.current = null;
    lastTouchCenter.current = null;
    setIsDragging(false);
    if (scale <= 1) setTranslate({ x: 0, y: 0 });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale > 1) {
      resetZoom();
    } else {
      setScale(3);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => {
      const next = Math.min(Math.max(prev * delta, 1), 5);
      if (next <= 1) setTranslate({ x: 0, y: 0 });
      return next;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      e.stopPropagation();
      hasMoved.current = false;
      dragStart.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y };
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      hasMoved.current = true;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setTranslate({ x: dragStart.current.tx + dx, y: dragStart.current.ty + dy });
    }
  };

  const handleMouseUp = () => { setIsDragging(false); };

  const handleOverlayClick = () => {
    if (!hasMoved.current && scale <= 1) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center"
      onClick={handleOverlayClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button
          className="p-2 rounded-full bg-white/20 hover:bg-white/40 text-white"
          onClick={(e) => { e.stopPropagation(); handleRotate(); }}
          data-testid="button-photo-rotate"
        >
          <RotateCw className="h-6 w-6" />
        </button>
        <button
          className="p-2 rounded-full bg-white/20 hover:bg-white/40 text-white"
          onClick={(e) => { e.stopPropagation(); toggleBrowserFullscreen(); }}
          data-testid="button-photo-fullscreen"
        >
          <Maximize2 className="h-6 w-6" />
        </button>
        <button
          className="p-2 rounded-full bg-white/20 hover:bg-white/40 text-white"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          data-testid="button-photo-close"
        >
          <X className="h-6 w-6" />
        </button>
      </div>
      {photos.length > 1 && currentIndex > 0 && (
        <button
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/20 hover:bg-white/40 text-white z-10"
          onClick={(e) => { e.stopPropagation(); onIndexChange(currentIndex - 1); }}
          data-testid="button-photo-prev"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{ width: "100%", height: "100%", touchAction: "none" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
      >
        <img
          src={photos[currentIndex]}
          alt=""
          className="object-contain rounded-lg select-none"
          style={{
            width: isSideways ? "100vh" : "100%",
            height: isSideways ? "100vw" : "100%",
            maxWidth: isSideways ? "100vh" : "100%",
            maxHeight: isSideways ? "100vw" : "100%",
            transform: `translate(${translate.x}px, ${translate.y}px) rotate(${rotation}deg) scale(${scale})`,
            transition: isDragging ? "none" : "transform 0.2s ease",
            cursor: scale > 1 ? "grab" : "default",
          }}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      {photos.length > 1 && currentIndex < photos.length - 1 && (
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/20 hover:bg-white/40 text-white z-10"
          onClick={(e) => { e.stopPropagation(); onIndexChange(currentIndex + 1); }}
          data-testid="button-photo-next"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 text-white/70 text-sm">
        <span>{currentIndex + 1} / {photos.length}</span>
        {scale > 1 && (
          <button
            className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/40 text-xs"
            onClick={(e) => { e.stopPropagation(); resetZoom(); }}
            data-testid="button-reset-zoom"
          >
            {Math.round(scale * 100)}% → 원본
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewHomeworkDialog({ submission, onClose }: { 
  submission: any;
  onClose: () => void 
}) {
  const { toast } = useToast();
  const [completionRate, setCompletionRate] = useState(submission.completionRate || 0);
  const [feedback, setFeedback] = useState(submission.feedback || "");
  const [resubmitReason, setResubmitReason] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [enlargedPhotoIndex, setEnlargedPhotoIndex] = useState<number | null>(null);

  // Load photos separately to reduce memory usage
  useEffect(() => {
    if (submission?.id) {
      setLoadingPhotos(true);
      fetch(`/api/homework-submissions/${submission.id}/photos`)
        .then(res => res.json())
        .then(data => {
          setPhotos(data.photos || []);
        })
        .catch(err => {
          console.error("Failed to load photos:", err);
        })
        .finally(() => {
          setLoadingPhotos(false);
        });
    }
  }, [submission?.id]);

  const reviewMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("[ReviewHomework] Submitting:", { submissionId: submission.id, data });
      if (!submission.id) {
        throw new Error("Submission ID is missing");
      }
      const response = await apiRequest("PATCH", `/api/homework-submissions/${submission.id}`, data);
      console.log("[ReviewHomework] Response status:", response.status);
      return response;
    },
    onSuccess: () => {
      console.log("[ReviewHomework] Success!");
      invalidateQueriesStartingWith("/api/homework");
      // Also invalidate student-specific queries so students see the updated status
      invalidateQueriesStartingWith("/api/students/");
      // Also invalidate any unsubmitted queries
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === "/api/homework" && key[2] === "unsubmitted";
        },
      });
      toast({ title: "검사가 완료되었습니다" });
      onClose();
    },
    onError: (error: any) => {
      console.error("[ReviewHomework] Error:", error);
      toast({ title: "검사에 실패했습니다", variant: "destructive" });
    },
  });

  const handleReview = (status: string) => {
    reviewMutation.mutate({
      status,
      completionRate: status === "resubmit" ? 0 : completionRate,
      feedback,
      resubmitReason: status === "resubmit" ? resubmitReason : undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">{submission.student?.name}의 숙제</h3>
        <p className="text-sm text-muted-foreground">{submission.homework?.title}</p>
      </div>

      {loadingPhotos ? (
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">사진 불러오는 중...</span>
        </div>
      ) : photos.length > 0 && (
        <div className="max-h-[300px] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-2">
            {photos.map((photo: string, i: number) => (
              <button
                key={i}
                type="button"
                className="relative aspect-square rounded-md overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEnlargedPhotoIndex(i); }}
                data-testid={`photo-review-${i}`}
              >
                <img
                  src={photo}
                  alt=""
                  className="w-full h-full object-cover pointer-events-none"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {enlargedPhotoIndex !== null && photos[enlargedPhotoIndex] && (
        <ZoomableImageOverlay
          photos={photos}
          currentIndex={enlargedPhotoIndex}
          onClose={() => setEnlargedPhotoIndex(null)}
          onIndexChange={setEnlargedPhotoIndex}
        />
      )}

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
          onClick={() => handleReview("in_person")}
          disabled={reviewMutation.isPending}
          data-testid="button-in-person"
        >
          <Eye className="h-4 w-4 mr-2" />
          대면 검사 완료
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" data-testid="button-resubmit">
              <RefreshCw className="h-4 w-4 mr-2" />
              재제출 요청
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>재제출 요청</DialogTitle>
              <DialogDescription>재제출 사유를 입력해주세요</DialogDescription>
            </DialogHeader>
            <Textarea
              value={resubmitReason}
              onChange={(e) => setResubmitReason(e.target.value)}
              placeholder="재제출 사유"
              required
              data-testid="input-resubmit-reason"
            />
            <DialogFooter>
              <Button
                onClick={() => handleReview("resubmit")}
                disabled={reviewMutation.isPending || !resubmitReason}
                data-testid="button-confirm-resubmit"
              >
                재제출 요청
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button
          onClick={() => handleReview("reviewed")}
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

export default function HomeworkPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null);
  const [selectedHomework, setSelectedHomework] = useState<Homework | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [inPersonHomework, setInPersonHomework] = useState<Homework | null>(null);
  const [dayHomeworkList, setDayHomeworkList] = useState<Homework[] | null>(null);
  const [dayHomeworkDate, setDayHomeworkDate] = useState<string>("");
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [calendarCreateDate, setCalendarCreateDate] = useState<string>("");
  const [unsubmittedHomeworkId, setUnsubmittedHomeworkId] = useState<string | null>(null);
  const [unsubmittedDate, setUnsubmittedDate] = useState<string>("");
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

  // Fetch enrolled classes for students
  const { data: studentEnrollments } = useQuery<any[]>({
    queryKey: [`/api/students/${user?.id}/enrollments`],
    enabled: !!user?.id && !!isStudent,
  });

  const studentClasses: Class[] = studentEnrollments
    ?.filter((e: any) => e.class !== null)
    .map((e: any) => e.class as Class) || [];

  const { data: homework, isLoading: loadingHomework } = useQuery<Homework[]>({
    queryKey: isTeacherOrAbove 
      ? [`/api/homework?centerId=${selectedCenter?.id}`]
      : [`/api/students/${user?.id}/homework?centerId=${selectedCenter?.id}`],
    enabled: isTeacherOrAbove ? !!selectedCenter?.id : (!!user?.id && !!selectedCenter?.id),
  });

  const { data: submissions } = useQuery<HomeworkSubmission[]>({
    queryKey: isTeacherOrAbove
      ? [`/api/homework/submissions?centerId=${selectedCenter?.id}`]
      : [`/api/students/${user?.id}/homework/submissions?centerId=${selectedCenter?.id}`],
    enabled: isTeacherOrAbove ? !!selectedCenter?.id : (!!user?.id && !!selectedCenter?.id),
  });

  const { data: unsubmittedStudents } = useQuery<any[]>({
    queryKey: ["/api/homework", unsubmittedHomeworkId, "unsubmitted"],
    enabled: !!unsubmittedHomeworkId,
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

  // No auto-selection of teacher for admin/principal - show all teachers by default

  // Get classes for selected teacher (teachers only see their own classes)
  const isTeacherOnly = user && user.role === UserRole.TEACHER;
  const teacherClasses = classes?.filter((c) => {
    if (isTeacherOnly) return c.teacherId === user.id || isAssistantTeacher(c, user.id);
    if (!selectedTeacher) return true;
    return c.teacherId === selectedTeacher || isAssistantTeacher(c, selectedTeacher);
  }) ?? [];

  const ownClasses = teacherClasses.filter((c) => {
    if (isTeacherOnly) return c.teacherId === user!.id;
    if (selectedTeacher) return c.teacherId === selectedTeacher;
    return true;
  });
  const assistantClasses = teacherClasses.filter((c) => {
    if (isTeacherOnly) return isAssistantTeacher(c, user!.id) && c.teacherId !== user!.id;
    if (selectedTeacher) return isAssistantTeacher(c, selectedTeacher) && c.teacherId !== selectedTeacher;
    return false;
  });
  const hasAssistantClasses = assistantClasses.length > 0;
  const displayClasses = isTeacherOnly && hasAssistantClasses
    ? (teacherViewTab === "assistant" ? assistantClasses : ownClasses)
    : teacherClasses;

  // Date filter helper function
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

  // Filter homework and submissions by teacher, class, and date
  const filteredHomework = homework?.filter((hw) => {
    // Apply date filter first
    if (!isWithinDateFilter(hw.dueDate)) return false;
    
    if (isStudent) {
      // Student filtering by enrolled class
      if (selectedClass !== "all" && hw.classId !== selectedClass) return false;
      return true;
    }
    // For teachers/admin: If classes haven't loaded yet, show all homework
    // This prevents empty state while data is loading
    if (!classes || classes.length === 0) return true;
    const hwClass = classes.find((c) => c.id === hw.classId);
    if (!hwClass) return true; // Show homework even if class not found in current filter
    // Teachers only see their own homework
    if (isTeacherOnly) {
      if (hasAssistantClasses) {
        const displayClassIds = displayClasses.map((c) => c.id);
        if (!displayClassIds.includes(hw.classId)) return false;
      } else if (hwClass.teacherId !== user.id && !isAssistantTeacher(hwClass, user.id)) {
        return false;
      }
    }
    if (isAdminOrPrincipal && selectedTeacher && hwClass.teacherId !== selectedTeacher && !isAssistantTeacher(hwClass, selectedTeacher)) return false;
    if (selectedClass !== "all" && hw.classId !== selectedClass) return false;
    return true;
  }) ?? [];

  const filteredSubmissions = submissions?.filter((sub: any) => {
    const hw = homework?.find((h) => h.id === sub.homeworkId);
    if (!hw) return false;
    
    // Apply date filter based on homework due date
    if (!isWithinDateFilter(hw.dueDate)) return false;
    
    if (isStudent) {
      // Student filtering by enrolled class
      if (selectedClass !== "all" && hw.classId !== selectedClass) return false;
      return true;
    }
    // For teachers/admin: If classes haven't loaded yet, show all submissions
    // This prevents empty state while data is loading
    if (!classes || classes.length === 0) return true;
    const hwClass = classes.find((c) => c.id === hw.classId);
    if (!hwClass) return true; // Show submission even if class not found in current filter
    // Teachers only see their own submissions
    if (isTeacherOnly) {
      if (hasAssistantClasses) {
        const displayClassIds = displayClasses.map((c) => c.id);
        if (!displayClassIds.includes(hw.classId)) return false;
      } else if (hwClass.teacherId !== user.id && !isAssistantTeacher(hwClass, user.id)) {
        return false;
      }
    }
    if (isAdminOrPrincipal && selectedTeacher && hwClass.teacherId !== selectedTeacher && !isAssistantTeacher(hwClass, selectedTeacher)) return false;
    if (selectedClass !== "all" && hw.classId !== selectedClass) return false;
    return true;
  }) ?? [];

  const publishedEnrolledClassIds = new Set(
    (publishedStudentEnrollments || [])
      .map((e: any) => e.classId ?? e.class?.id)
      .filter(Boolean)
  );

  const publishedHomework = publishedStudentId
    ? filteredHomework.filter((hw) =>
        hw.studentId === publishedStudentId ||
        (!hw.studentId && publishedEnrolledClassIds.has(hw.classId))
      )
    : filteredHomework;

  const handleDateClick = (date: Date, dayHomework: Homework[]) => {
    const dateStr = format(date, "yyyy-MM-dd");
    if (isTeacherOrAbove) {
      setDayHomeworkList(dayHomework);
      setDayHomeworkDate(dateStr);
    } else if (dayHomework.length === 1) {
      setSelectedHomework(dayHomework[0]);
    } else if (dayHomework.length > 1) {
      setDayHomeworkList(dayHomework);
      setDayHomeworkDate(dateStr);
    }
  };

  const handleCalendarCreateClick = (date: Date) => {
    setCalendarCreateDate(format(date, "yyyy-MM-dd"));
    setIsCreateOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/homework/${id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/homework");
      // Also invalidate student-specific queries so students see the updated list
      invalidateQueriesStartingWith("/api/students/");
      toast({ title: "숙제가 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "숙제 삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const handleDeleteHomework = (hw: Homework) => {
    if (confirm(`"${hw.title}" 숙제를 삭제하시겠습니까?`)) {
      deleteMutation.mutate(hw.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">숙제 관리</h1>
            <p className="text-muted-foreground">
              {isTeacherOrAbove ? "숙제 출제 및 검사" : "숙제 제출 및 확인"}
            </p>
          </div>
          <ManualButton menuKey="homework" />
        </div>
        {isTeacherOrAbove && (
          <Dialog open={isCreateOpen || !!editingHomework} onOpenChange={(open) => {
            if (!open) {
              setIsCreateOpen(false);
              setEditingHomework(null);
              setCalendarCreateDate("");
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-homework" onClick={() => {
                setCalendarCreateDate("");
                setIsCreateOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                숙제 출제
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingHomework ? "숙제 수정" : "숙제 출제"}</DialogTitle>
                <DialogDescription>{editingHomework ? "숙제 내용을 수정합니다" : "새로운 숙제를 출제합니다"}</DialogDescription>
              </DialogHeader>
              <CreateHomeworkDialog
                classes={isTeacherOnly ? displayClasses : (classes ?? [])}
                editingHomework={editingHomework}
                initialDate={calendarCreateDate}
                preSelectedClassId={selectedClass !== "all" ? selectedClass : undefined}
                onClose={() => {
                  setIsCreateOpen(false);
                  setEditingHomework(null);
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
            <CardTitle>숙제 달력</CardTitle>
            <CardDescription>
              {isTeacherOrAbove 
                ? "날짜를 클릭하여 숙제 확인 또는 출제"
                : "날짜를 클릭하여 숙제 확인"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHomework ? (
              <Skeleton className="h-[400px] w-full" />
            ) : (
              <HomeworkCalendar
                homework={filteredHomework}
                submissions={filteredSubmissions}
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
              {isTeacherOrAbove ? "숙제 검사" : "미완료 숙제"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHomework ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : isTeacherOrAbove ? (
              <Tabs defaultValue="pending" className="w-full">
                <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto gap-1">
                  <TabsTrigger value="pending" className="text-xs sm:text-sm" data-testid="tab-pending">
                    대기 ({filteredSubmissions.filter((s) => s.status === "submitted").length})
                  </TabsTrigger>
                  <TabsTrigger value="reviewed" className="text-xs sm:text-sm" data-testid="tab-reviewed">
                    검사완료 ({filteredSubmissions.filter((s) => s.status === "reviewed" || s.status === "in_person").length})
                  </TabsTrigger>
                  <TabsTrigger value="published" className="text-xs sm:text-sm" data-testid="tab-published">
                    숙제목록 ({publishedHomework.length})
                  </TabsTrigger>
                  <TabsTrigger value="unsubmitted" className="text-xs sm:text-sm" data-testid="tab-unsubmitted">
                    미제출
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="pending" className="mt-3 space-y-2">
                  {filteredSubmissions
                    .filter((s) => s.status === "submitted")
                    .map((sub: any) => {
                      const hwClass = classes?.find((c) => c.id === sub.homework?.classId);
                      return (
                        <button
                          key={sub.id}
                          onClick={() => setSelectedSubmission(sub)}
                          className="w-full p-3 rounded-md bg-muted/50 text-left hover-elevate"
                          data-testid={`submission-item-${sub.id}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{sub.student?.name}</span>
                            <div className="flex items-center gap-2">
                              {hwClass && <Badge variant="secondary" className="text-xs">{hwClass.name}</Badge>}
                              <Badge variant="outline">제출됨</Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{sub.homework?.title}</p>
                        </button>
                      );
                    })}
                  {filteredSubmissions.filter((s) => s.status === "submitted").length === 0 && (
                    <p className="text-center py-8 text-muted-foreground">검사 대기중인 숙제가 없습니다</p>
                  )}
                </TabsContent>
                <TabsContent value="reviewed" className="mt-3 space-y-2">
                  {filteredSubmissions
                    .filter((s) => s.status === "reviewed" || s.status === "in_person")
                    .map((sub: any) => {
                      const hwClass = classes?.find((c) => c.id === sub.homework?.classId);
                      return (
                        <button
                          key={sub.id}
                          onClick={() => setSelectedSubmission(sub)}
                          className="w-full p-3 rounded-md bg-muted/50 text-left hover-elevate"
                          data-testid={`reviewed-item-${sub.id}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{sub.student?.name}</span>
                            <div className="flex items-center gap-2">
                              {hwClass && <Badge variant="secondary" className="text-xs">{hwClass.name}</Badge>}
                              <CompletionDot rate={sub.completionRate || 0} />
                              <Badge variant="outline">
                                {sub.status === "in_person" ? "대면검사" : `${sub.completionRate}%`}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{sub.homework?.title}</p>
                        </button>
                      );
                    })}
                  {filteredSubmissions.filter((s) => s.status === "reviewed" || s.status === "in_person").length === 0 && (
                    <p className="text-center py-8 text-muted-foreground">검사 완료된 숙제가 없습니다</p>
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
                  {[...publishedHomework].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()).map((hw) => {
                    const hwClass = classes?.find((c) => c.id === hw.classId);
                    return (
                      <div
                        key={hw.id}
                        className="p-3 rounded-md bg-muted/50"
                        data-testid={`published-homework-${hw.id}`}
                      >
                        <p className="font-medium break-words mb-1">{hw.title}</p>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {hwClass && <Badge variant="secondary" className="text-xs">{hwClass.name}</Badge>}
                          <Badge variant="outline">
                            {format(new Date(hw.dueDate), "M/d", { locale: ko })}
                          </Badge>
                        </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setInPersonHomework(hw)}
                          data-testid={`button-in-person-check-${hw.id}`}
                        >
                          <Users className="h-4 w-4 mr-1" />
                          대면검사
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingHomework(hw)}
                          data-testid={`button-edit-homework-${hw.id}`}
                        >
                          수정
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => handleDeleteHomework(hw)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-homework-${hw.id}`}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    );
                  })}
                  {publishedHomework.length === 0 && (
                    <p className="text-center py-8 text-muted-foreground">출제된 숙제가 없습니다</p>
                  )}
                  </>
                  )}
                </TabsContent>
                <TabsContent value="unsubmitted" className="mt-3 space-y-4">
                  <div className="space-y-2">
                    <Label>날짜 선택</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={unsubmittedDate}
                        onChange={(e) => {
                          setUnsubmittedDate(e.target.value);
                          setUnsubmittedHomeworkId(null);
                        }}
                        className="w-auto"
                        data-testid="input-unsubmitted-date"
                      />
                      {unsubmittedDate && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUnsubmittedDate("");
                            setUnsubmittedHomeworkId(null);
                          }}
                          data-testid="button-clear-unsubmitted-date"
                        >
                          전체 보기
                        </Button>
                      )}
                    </div>
                  </div>
                  {unsubmittedDate ? (
                    <div className="space-y-2">
                      <Label>숙제 선택</Label>
                      {(() => {
                        const dayHw = [...filteredHomework]
                          .filter((hw) => format(new Date(hw.dueDate), "yyyy-MM-dd") === unsubmittedDate)
                          .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
                        if (dayHw.length === 0) {
                          return <p className="text-sm text-muted-foreground py-2">선택한 날짜에 출제된 숙제가 없습니다</p>;
                        }
                        return (
                          <div className="space-y-1">
                            {dayHw.map((hw) => {
                              const hwClass = classes?.find((c) => c.id === hw.classId);
                              const isActive = unsubmittedHomeworkId === hw.id;
                              return (
                                <button
                                  key={hw.id}
                                  type="button"
                                  onClick={() => setUnsubmittedHomeworkId(hw.id)}
                                  className={cn(
                                    "w-full p-3 rounded-md text-left hover-elevate",
                                    isActive ? "bg-primary text-primary-foreground" : "bg-muted/50"
                                  )}
                                  data-testid={`button-unsubmitted-homework-${hw.id}`}
                                >
                                  <span className="font-medium break-words">{hw.title}</span>
                                  <span className={cn("text-sm ml-2", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                    {hwClass && `${hwClass.name} ${hwClass.subject}반`}
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
                      <Label>숙제 선택</Label>
                      <Select value={unsubmittedHomeworkId || ""} onValueChange={(v) => setUnsubmittedHomeworkId(v || null)}>
                        <SelectTrigger data-testid="select-homework-unsubmitted">
                          <SelectValue placeholder="숙제를 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          {[...filteredHomework].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()).map((hw) => {
                            const hwClass = classes?.find((c) => c.id === hw.classId);
                            return (
                              <SelectItem key={hw.id} value={hw.id}>
                                {hw.title} {hwClass && `(${hwClass.name})`} - {format(new Date(hw.dueDate), "M/d", { locale: ko })}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {unsubmittedHomeworkId && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        미제출 학생 ({unsubmittedStudents?.length || 0}명)
                      </p>
                      {unsubmittedStudents && unsubmittedStudents.length > 0 ? (
                        <div className="space-y-2">
                          {unsubmittedStudents.map((student: any) => (
                            <div
                              key={student.id}
                              className="p-3 rounded-md bg-muted/50"
                              data-testid={`unsubmitted-student-${student.id}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{student.name}</span>
                                <Badge variant="destructive">미제출</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : unsubmittedStudents?.length === 0 ? (
                        <p className="text-center py-4 text-muted-foreground">모든 학생이 제출했습니다</p>
                      ) : null}
                    </div>
                  )}
                  {!unsubmittedHomeworkId && (
                    <p className="text-center py-8 text-muted-foreground">숙제를 선택하면 미제출 학생 목록이 표시됩니다</p>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-3">
                {filteredHomework
                  .filter((hw) => {
                    const sub = filteredSubmissions.find((s) => s.homeworkId === hw.id);
                    if (sub && sub.status !== "pending" && sub.status !== "resubmit") return false;
                    const now = new Date();
                    const monthStart = startOfMonth(now);
                    const monthEnd = endOfMonth(now);
                    const rangeStart = startOfWeek(monthStart, { weekStartsOn: 1 });
                    const rangeEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
                    const dueDate = new Date(hw.dueDate);
                    return isWithinInterval(dueDate, { start: rangeStart, end: rangeEnd });
                  })
                  .map((hw) => {
                    const sub = filteredSubmissions.find((s) => s.homeworkId === hw.id);
                    return (
                      <button
                        key={hw.id}
                        onClick={() => setSelectedHomework(hw)}
                        className="w-full p-3 rounded-md bg-muted/50 text-left hover-elevate"
                        data-testid={`homework-item-${hw.id}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-medium break-words flex-1 min-w-0">{hw.title}</span>
                          <Badge variant={sub?.status === "resubmit" ? "destructive" : "outline"} className="flex-shrink-0">
                            {sub?.status === "resubmit" ? "재제출" : "미제출"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          마감: {format(new Date(hw.dueDate), "M월 d일", { locale: ko })}
                        </p>
                      </button>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedHomework} onOpenChange={(open) => !open && setSelectedHomework(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>숙제 상세</DialogTitle>
          </DialogHeader>
          {selectedHomework && (
            isTeacherOrAbove ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">숙제 내용</p>
                  <p className="font-medium break-words">{selectedHomework.title}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">마감일</p>
                  <p>{format(new Date(selectedHomework.dueDate), "yyyy년 M월 d일", { locale: ko })}</p>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setSelectedHomework(null)}>
                    닫기
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => {
                      if (confirm(`"${selectedHomework.title}" 숙제를 삭제하시겠습니까?`)) {
                        deleteMutation.mutate(selectedHomework.id);
                        setSelectedHomework(null);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    data-testid="button-delete-homework"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    삭제
                  </Button>
                  <Button onClick={() => {
                    setSelectedHomework(null);
                    setEditingHomework(selectedHomework);
                  }} data-testid="button-edit-homework">
                    수정
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <SubmitHomeworkDialog
                homework={selectedHomework}
                submission={submissions?.find((s) => s.homeworkId === selectedHomework.id)}
                onClose={() => setSelectedHomework(null)}
              />
            )
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedSubmission} onOpenChange={(open) => !open && setSelectedSubmission(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto overflow-x-hidden rounded-lg">
          <DialogHeader>
            <DialogTitle>숙제 검사</DialogTitle>
          </DialogHeader>
          {selectedSubmission && (
            <ReviewHomeworkDialog
              submission={selectedSubmission}
              onClose={() => setSelectedSubmission(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!dayHomeworkList} onOpenChange={(open) => {
        if (!open) {
          setDayHomeworkList(null);
          setDayHomeworkDate("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dayHomeworkDate && format(new Date(dayHomeworkDate), "M월 d일", { locale: ko })} 숙제
            </DialogTitle>
            <DialogDescription>
              {isTeacherOrAbove ? "숙제를 선택하여 확인하거나 수정하세요" : "확인할 숙제를 선택하세요"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {dayHomeworkList?.map((hw) => {
              const sub = submissions?.find((s) => s.homeworkId === hw.id);
              const hwClass = classes?.find((c) => c.id === hw.classId);
              return (
                <div
                  key={hw.id}
                  className="w-full p-3 rounded-md bg-muted/50 hover-elevate"
                  data-testid={`day-homework-${hw.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => {
                        setDayHomeworkList(null);
                        setDayHomeworkDate("");
                        setSelectedHomework(hw);
                      }}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="font-medium break-words whitespace-normal">{hw.title}</span>
                        <CompletionDot rate={sub?.completionRate || 0} />
                      </div>
                      {hwClass && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {hwClass.name} ({hwClass.subject})
                        </div>
                      )}
                    </button>
                    {isTeacherOrAbove && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDayHomeworkList(null);
                            setDayHomeworkDate("");
                            setEditingHomework(hw);
                          }}
                          data-testid={`button-edit-day-homework-${hw.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            handleDeleteHomework(hw);
                            setDayHomeworkList(null);
                            setDayHomeworkDate("");
                          }}
                          data-testid={`button-delete-day-homework-${hw.id}`}
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
          {isTeacherOrAbove && dayHomeworkDate && (
            <DialogFooter>
              <Button
                onClick={() => {
                  setDayHomeworkList(null);
                  setCalendarCreateDate(dayHomeworkDate);
                  setDayHomeworkDate("");
                  setIsCreateOpen(true);
                }}
                data-testid="button-add-homework-on-date"
              >
                <Plus className="h-4 w-4 mr-2" />
                숙제 추가
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!inPersonHomework} onOpenChange={(open) => !open && setInPersonHomework(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>대면검사</DialogTitle>
            <DialogDescription>학생별 숙제 완료 여부를 체크하세요</DialogDescription>
          </DialogHeader>
          {inPersonHomework && submissions && (
            <InPersonCheckDialog
              homework={inPersonHomework}
              submissions={submissions}
              onClose={() => setInPersonHomework(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
