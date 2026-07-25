import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ManualButton } from "@/components/manual-button";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Plus, Trash2, Pencil, Users, FileImage, BarChart3, ChevronDown, Upload, X, Search, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { apiRequest, queryClient, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { isAssistantTeacher, type Class, type User } from "@shared/schema";
import { UserRole } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TeacherClassTabs } from "@/components/teacher-class-tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Exam {
  id: string;
  centerId: string;
  classId: string | null;
  name: string;
  scope: string | null;
  examDate: string;
  maxScore: number;
  createdBy: string;
  createdAt: string;
  className?: string;
  participantCount?: number;
  averageScore?: number;
}

interface ExamParticipant {
  id: string;
  examId: string;
  studentId: string;
  score: number | null;
  studentName?: string;
  studentGrade?: string | null;
}

interface ExamPaper {
  id: string;
  examId: string;
  studentId: string;
  objectKey: string;
  imageUrl: string;
  expiresAt: string;
  uploadedAt: string;
}

const GRADES = ["초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3", "성인"];

interface StudentExamResult {
  id: string;
  examId: string;
  studentId: string;
  score: number | null;
  exam: Exam | null;
  papers: ExamPaper[];
  stats: {
    maxScore: number;
    minScore: number;
    avgScore: number;
    participantCount: number;
  } | null;
}

// Student view component
function StudentExamView({ userId }: { userId: string }) {
  const [selectedPaperUrl, setSelectedPaperUrl] = useState<string | null>(null);
  
  const { data: myExams, isLoading } = useQuery<StudentExamResult[]>({
    queryKey: ["/api/student-exams", userId],
    queryFn: async () => {
      const res = await fetch(`/api/student-exams?studentId=${userId}`);
      if (!res.ok) throw new Error("Failed to fetch exams");
      return res.json();
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">나의 시험 결과</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">나의 시험 결과</h1>
      
      {!myExams?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-40 gap-4">
            <p className="text-muted-foreground">참가한 시험이 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {myExams.map(result => {
            const cardChartData = result.score !== null && result.stats ? [
              { name: "내점수", value: result.score, fill: "hsl(var(--primary))" },
              { name: "평균", value: result.stats.avgScore, fill: "hsl(var(--muted-foreground))" },
              { name: "최고점", value: result.stats.maxScore, fill: "hsl(142, 76%, 36%)" },
            ] : [];
            
            return (
            <Card key={result.id} className="hover-elevate" data-testid={`card-my-exam-${result.examId}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{result.exam?.name || "알 수 없는 시험"}</CardTitle>
                <CardDescription>
                  {result.exam?.examDate && format(new Date(result.exam.examDate), "yyyy년 M월 d일", { locale: ko })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">내 점수</span>
                  <span className="text-2xl font-bold">
                    {result.score !== null ? (
                      <>
                        {result.score}<span className="text-sm text-muted-foreground">/{result.exam?.maxScore}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground text-base">미입력</span>
                    )}
                  </span>
                </div>
                
                {/* Score comparison chart inside card */}
                {cardChartData.length > 0 && (
                  <div className="border-t pt-3">
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cardChartData} layout="vertical" margin={{ top: 5, right: 15, left: 5, bottom: 5 }}>
                          <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, result.exam?.maxScore || 100]} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={45} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '6px',
                              fontSize: '12px'
                            }} 
                          />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {cardChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                
                {result.stats && (
                  <div className="grid grid-cols-3 gap-2 text-center border-t pt-3">
                    <div>
                      <div className="text-xs text-muted-foreground">최고점</div>
                      <div className="font-semibold text-green-600">{result.stats.maxScore}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">평균</div>
                      <div className="font-semibold">{result.stats.avgScore}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">최저점</div>
                      <div className="font-semibold text-red-600">{result.stats.minScore}</div>
                    </div>
                  </div>
                )}
                
                {result.papers.length > 0 && (
                  <div className="border-t pt-3">
                    <div className="text-xs text-muted-foreground mb-2">시험지</div>
                    <div className="flex flex-wrap gap-2">
                      {result.papers.map((paper, idx) => (
                        <Button 
                          key={paper.id} 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedPaperUrl(paper.imageUrl)}
                          data-testid={`button-view-paper-${paper.id}`}
                        >
                          <FileImage className="h-3 w-3 mr-1" />
                          시험지 {result.papers.length > 1 ? idx + 1 : "보기"}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
          })}
        </div>
      )}

      {/* Paper view dialog */}
      <Dialog open={!!selectedPaperUrl} onOpenChange={() => setSelectedPaperUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>시험지</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[70vh]">
            {selectedPaperUrl && (
              <img 
                src={selectedPaperUrl} 
                alt="시험지" 
                className="w-full object-contain"
              />
            )}
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setSelectedPaperUrl(null)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Score input component with local state to prevent focus loss
function ScoreInput({ 
  initialValue, 
  participantId, 
  maxScore,
  onSave 
}: { 
  initialValue: number | null; 
  participantId: string;
  maxScore?: number;
  onSave: (participantId: string, score: number | null) => void;
}) {
  const [localValue, setLocalValue] = useState<string>(initialValue?.toString() ?? "");
  
  const handleBlur = () => {
    const numValue = localValue === "" ? null : parseInt(localValue);
    if (numValue !== initialValue) {
      onSave(participantId, numValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <Input
      type="number"
      className="w-20 ml-auto text-right"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      min={0}
      max={maxScore}
      data-testid={`input-score-${participantId}`}
    />
  );
}

export default function ExamManagement() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"list" | "stats">("list");
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isParticipantsDialogOpen, setIsParticipantsDialogOpen] = useState(false);
  const [isScoreDialogOpen, setIsScoreDialogOpen] = useState(false);
  const [isPaperUploadDialogOpen, setIsPaperUploadDialogOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [teacherViewTab, setTeacherViewTab] = useState<"my" | "assistant">("my");

  const [formData, setFormData] = useState({
    name: "",
    scope: "",
    examDate: format(new Date(), "yyyy-MM-dd"),
    maxScore: 100,
    classId: "",
    selectionType: "class" as "class" | "grade" | "students",
    selectedGrades: [] as string[],
    selectedTeacherId: "", // For principal to filter by teacher
    selectedStudentIds: [] as string[], // For direct student selection
    studentSearchQuery: "", // Search query for students
  });

  const centerId = selectedCenter?.id;
  const canManage = user && (user.role === UserRole.ADMIN || user.role === UserRole.PRINCIPAL || user.role === UserRole.TEACHER);

  const { data: exams, isLoading: examsLoading } = useQuery<Exam[]>({
    queryKey: [`/api/exams?centerId=${centerId}`],
    enabled: !!centerId,
  });

  const { data: classes } = useQuery<Class[]>({
    queryKey: [`/api/classes?centerId=${centerId}`],
    enabled: !!centerId,
  });

  // Fetch all users and filter by role on client side
  const { data: allUsers } = useQuery<User[]>({
    queryKey: [`/api/users?centerId=${centerId}`],
    enabled: !!centerId,
  });

  // Filter students from all users
  const students = allUsers?.filter(u => u.role === UserRole.STUDENT) || [];

  // Filter teachers from all users (for principal/admin's teacher filter)
  const teachers = allUsers?.filter(u => 
    u.role === UserRole.TEACHER || u.role === UserRole.PRINCIPAL
  ) || [];

  // Fetch students for the selected class
  const { data: classStudents } = useQuery<User[]>({
    queryKey: [`/api/classes/${formData.classId}/students`],
    enabled: !!formData.classId && formData.classId !== "none",
  });

  const isPrincipal = user?.role === UserRole.PRINCIPAL || user?.role === UserRole.ADMIN;
  const isTeacher = user?.role === UserRole.TEACHER || user?.role === UserRole.CLINIC_TEACHER;

  // Filter classes based on role and selected teacher
  const allFilteredClasses = classes?.filter(cls => {
    if (isPrincipal) {
      if (formData.selectedTeacherId) {
        return cls.teacherId === formData.selectedTeacherId;
      }
      return true;
    } else if (isTeacher) {
      return cls.teacherId === user?.id || isAssistantTeacher(cls, user?.id);
    }
    return true;
  }) || [];

  const teacherOwnClasses = isTeacher ? (classes?.filter(cls => cls.teacherId === user?.id) || []) : allFilteredClasses;
  const teacherAssistantClasses = isTeacher ? (classes?.filter(cls => isAssistantTeacher(cls, user?.id) && cls.teacherId !== user?.id) || []) : [];
  const hasAssistantClasses = teacherAssistantClasses.length > 0;
  const filteredClasses = isTeacher && hasAssistantClasses
    ? (teacherViewTab === "assistant" ? teacherAssistantClasses : teacherOwnClasses)
    : allFilteredClasses;

  const { data: examParticipants } = useQuery<ExamParticipant[]>({
    queryKey: [`/api/exams/${selectedExam?.id}/participants`],
    enabled: !!selectedExam?.id,
  });

  const { data: examPapers } = useQuery<ExamPaper[]>({
    queryKey: [`/api/exams/${selectedExam?.id}/papers`],
    enabled: !!selectedExam?.id,
  });

  const createExamMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", `/api/exams?actorId=${user?.id}`, {
        centerId,
        name: data.name,
        scope: data.scope || null,
        examDate: data.examDate,
        maxScore: data.maxScore,
        classId: data.classId || null,
        createdBy: user?.id,
      });
    },
    onSuccess: async (response) => {
      const newExam = await response.json();
      await invalidateQueriesStartingWith("/api/exams");
      
      // All selection types now use selectedStudentIds
      if (formData.selectedStudentIds.length > 0) {
        await addParticipantsByStudentsMutation.mutateAsync({
          examId: newExam.id,
          studentIds: formData.selectedStudentIds,
        });
      }
      
      toast({ title: "시험이 생성되었습니다" });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "시험 생성에 실패했습니다", variant: "destructive" });
    },
  });

  const updateExamMutation = useMutation({
    mutationFn: async (data: { id: string } & Partial<typeof formData>) => {
      return apiRequest("PATCH", `/api/exams/${data.id}?actorId=${user?.id}`, {
        name: data.name,
        scope: data.scope || null,
        examDate: data.examDate,
        maxScore: data.maxScore,
      });
    },
    onSuccess: async () => {
      await invalidateQueriesStartingWith("/api/exams");
      toast({ title: "시험이 수정되었습니다" });
      setIsEditDialogOpen(false);
      setSelectedExam(null);
    },
    onError: () => {
      toast({ title: "시험 수정에 실패했습니다", variant: "destructive" });
    },
  });

  const deleteExamMutation = useMutation({
    mutationFn: async (examId: string) => {
      return apiRequest("DELETE", `/api/exams/${examId}?actorId=${user?.id}`);
    },
    onSuccess: async () => {
      await invalidateQueriesStartingWith("/api/exams");
      toast({ title: "시험이 삭제되었습니다" });
      setIsDeleteDialogOpen(false);
      setExamToDelete(null);
    },
    onError: () => {
      toast({ title: "시험 삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const addParticipantsByClassMutation = useMutation({
    mutationFn: async ({ examId, classId }: { examId: string; classId: string }) => {
      return apiRequest("POST", `/api/exams/${examId}/participants/by-class?actorId=${user?.id}`, { classId });
    },
    onSuccess: async () => {
      await invalidateQueriesStartingWith("/api/exams");
    },
  });

  const addParticipantsByGradeMutation = useMutation({
    mutationFn: async ({ examId, grades }: { examId: string; grades: string[] }) => {
      return apiRequest("POST", `/api/exams/${examId}/participants/by-grade?actorId=${user?.id}`, { grades, centerId });
    },
    onSuccess: async () => {
      await invalidateQueriesStartingWith("/api/exams");
    },
  });

  const addParticipantsByStudentsMutation = useMutation({
    mutationFn: async ({ examId, studentIds }: { examId: string; studentIds: string[] }) => {
      return apiRequest("POST", `/api/exams/${examId}/participants?actorId=${user?.id}`, { studentIds });
    },
    onSuccess: async () => {
      await invalidateQueriesStartingWith("/api/exams");
    },
  });

  const updateScoreMutation = useMutation({
    mutationFn: async ({ participantId, score }: { participantId: string; score: number | null }) => {
      return apiRequest("PATCH", `/api/exam-participants/${participantId}/score?actorId=${user?.id}`, { score });
    },
    onSuccess: async () => {
      await invalidateQueriesStartingWith("/api/exams");
    },
  });

  // R2 upload hook for exam papers
  const { uploadFile: uploadToR2, isUploading: isUploadingPaper } = useUpload({
    prefix: "exam-papers",
    centerId,
  });

  const uploadPaperMutation = useMutation({
    mutationFn: async ({ examId, studentId, file }: { examId: string; studentId: string; file: File }) => {
      // Step 1: Upload file to R2
      const uploadResult = await uploadToR2(file);
      if (!uploadResult) {
        throw new Error("R2 업로드 실패");
      }

      // Step 2: Save metadata to database
      const response = await apiRequest("POST", `/api/exam-papers?actorId=${user?.id}`, {
        examId,
        studentId,
        objectKey: uploadResult.objectPath,
        imageUrl: uploadResult.publicUrl || uploadResult.uploadURL.split("?")[0],
      });
      
      return response;
    },
    onSuccess: async () => {
      await invalidateQueriesStartingWith("/api/exams");
      toast({ title: "시험지가 업로드되었습니다" });
    },
    onError: () => {
      toast({ title: "시험지 업로드에 실패했습니다", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      scope: "",
      examDate: format(new Date(), "yyyy-MM-dd"),
      maxScore: 100,
      classId: "",
      selectionType: "class",
      selectedGrades: [],
      selectedTeacherId: "",
      selectedStudentIds: [],
      studentSearchQuery: "",
    });
  };

  // Get students filtered by class (from API)
  const studentsInSelectedClass = classStudents || [];

  // Get students filtered by selected grades
  const studentsInSelectedGrades = formData.selectedGrades.length > 0
    ? students.filter(s => formData.selectedGrades.includes(s.grade || ""))
    : [];

  // Filter students by search query
  const filterStudentsBySearch = (studentList: User[]) => {
    if (!formData.studentSearchQuery.trim()) return studentList;
    const query = formData.studentSearchQuery.toLowerCase();
    return studentList.filter(s => 
      s.name.toLowerCase().includes(query) || 
      (s.grade || "").toLowerCase().includes(query)
    );
  };

  // All students filtered by search
  const allStudentsFiltered = filterStudentsBySearch(students);

  const handleCreateExam = () => {
    if (!formData.name.trim()) {
      toast({ title: "시험명을 입력해주세요", variant: "destructive" });
      return;
    }
    createExamMutation.mutate(formData);
  };

  const handleUpdateExam = () => {
    if (!selectedExam) return;
    updateExamMutation.mutate({
      id: selectedExam.id,
      name: formData.name,
      scope: formData.scope,
      examDate: formData.examDate,
      maxScore: formData.maxScore,
    });
  };

  const handleDeleteExam = () => {
    if (!examToDelete) return;
    deleteExamMutation.mutate(examToDelete.id);
  };

  const openEditDialog = (exam: Exam) => {
    setSelectedExam(exam);
    setFormData({
      ...formData,
      name: exam.name,
      scope: exam.scope || "",
      examDate: exam.examDate,
      maxScore: exam.maxScore,
      classId: exam.classId || "",
    });
    setIsEditDialogOpen(true);
  };

  const openParticipantsDialog = (exam: Exam) => {
    setSelectedExam(exam);
    setIsParticipantsDialogOpen(true);
  };

  const openScoreDialog = (exam: Exam) => {
    setSelectedExam(exam);
    setIsScoreDialogOpen(true);
  };

  const openPaperUploadDialog = (exam: Exam) => {
    setSelectedExam(exam);
    setIsPaperUploadDialogOpen(true);
  };

  const filteredExams = exams?.filter(exam => 
    exam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exam.scope?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Server already returns enriched participants with studentName and studentGrade
  // Sort by score descending (highest first), null scores at the bottom
  const participantsWithNames = (examParticipants?.map(p => ({
    ...p,
    studentName: p.studentName || "알 수 없음",
    grade: p.studentGrade || "",
  })) || []).sort((a, b) => {
    if (a.score === null && b.score === null) return 0;
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return b.score - a.score; // Descending order
  });

  const calculateStats = () => {
    if (!participantsWithNames.length || !selectedExam) return null;
    
    const scores = participantsWithNames
      .filter(p => p.score !== null)
      .map(p => p.score as number);
    
    if (!scores.length) return null;
    
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    
    return {
      average: avg.toFixed(1),
      max,
      min,
      count: scores.length,
      total: participantsWithNames.length,
    };
  };

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4" data-testid="exam-management-login-required">
        <Card>
          <CardContent className="flex items-center justify-center h-40">
            <p className="text-muted-foreground">로그인이 필요합니다</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Student view - show their exam results
  if (user.role === UserRole.STUDENT) {
    return (
      <div className="container mx-auto py-6 px-4" data-testid="exam-management-page">
        <StudentExamView userId={user.id} />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6" data-testid="exam-management-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">평가관리</h1>
            <p className="text-muted-foreground">시험 생성, 점수 입력, 시험지 관리</p>
          </div>
          <ManualButton menuKey="exam-management" />
        </div>
        {canManage && (
          <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-exam">
            <Plus className="h-4 w-4 mr-2" />
            새 시험 만들기
          </Button>
        )}
      </div>

      {isTeacher && hasAssistantClasses && (
        <TeacherClassTabs
          teacherViewTab={teacherViewTab}
          onTabChange={(tab) => { setTeacherViewTab(tab); }}
          ownCount={teacherOwnClasses.length}
          assistantCount={teacherAssistantClasses.length}
        />
      )}

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="시험명 또는 범위 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-exams"
          />
        </div>
      </div>

      {examsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredExams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-40 gap-4">
            <p className="text-muted-foreground">등록된 시험이 없습니다</p>
            {canManage && (
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                첫 시험 만들기
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredExams.map(exam => (
            <Card key={exam.id} className="hover-elevate" data-testid={`card-exam-${exam.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{exam.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(exam.examDate), "yyyy년 M월 d일", { locale: ko })}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">{exam.maxScore}점</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {exam.scope && (
                  <p className="text-sm text-muted-foreground truncate">{exam.scope}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {exam.className && (
                    <Badge variant="outline">{exam.className}</Badge>
                  )}
                  {exam.participantCount !== undefined && (
                    <Badge variant="outline">
                      <Users className="h-3 w-3 mr-1" />
                      {exam.participantCount}명
                    </Badge>
                  )}
                </div>
                
                {canManage && (
                  <div className="flex items-center gap-2 pt-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => openScoreDialog(exam)} data-testid={`button-scores-${exam.id}`}>
                      <BarChart3 className="h-3 w-3 mr-1" />
                      점수
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openPaperUploadDialog(exam)} data-testid={`button-papers-${exam.id}`}>
                      <FileImage className="h-3 w-3 mr-1" />
                      시험지
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEditDialog(exam)} data-testid={`button-edit-${exam.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { setExamToDelete(exam); setIsDeleteDialogOpen(true); }} data-testid={`button-delete-${exam.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>새 시험 만들기</DialogTitle>
            <DialogDescription>시험 정보를 입력하고 응시자를 선택하세요</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">시험명 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: 1학기 중간고사"
                data-testid="input-exam-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope">시험 범위</Label>
              <Input
                id="scope"
                value={formData.scope}
                onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                placeholder="예: 1-3단원"
                data-testid="input-exam-scope"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="examDate">시험일</Label>
                <Input
                  id="examDate"
                  type="date"
                  value={formData.examDate}
                  onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                  data-testid="input-exam-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxScore">만점</Label>
                <Input
                  id="maxScore"
                  type="number"
                  value={formData.maxScore}
                  onChange={(e) => setFormData({ ...formData, maxScore: parseInt(e.target.value) || 100 })}
                  min={1}
                  data-testid="input-max-score"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>응시자 선택 방식</Label>
              <Tabs value={formData.selectionType} onValueChange={(v) => setFormData({ ...formData, selectionType: v as "class" | "grade" | "students" })}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="class" data-testid="tab-select-by-class">반별 선택</TabsTrigger>
                  <TabsTrigger value="grade" data-testid="tab-select-by-grade">학년별 선택</TabsTrigger>
                  <TabsTrigger value="students" data-testid="tab-select-by-students">전체 학생</TabsTrigger>
                </TabsList>
                
                {/* 반별 선택: 선생님 → 반 → 학생 체크박스 */}
                <TabsContent value="class" className="mt-2 space-y-3">
                  {/* Principal can filter by teacher */}
                  {isPrincipal && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">선생님 선택</Label>
                      <Select 
                        value={formData.selectedTeacherId} 
                        onValueChange={(v) => setFormData({ ...formData, selectedTeacherId: v, classId: "", selectedStudentIds: [] })}
                      >
                        <SelectTrigger data-testid="select-teacher">
                          <SelectValue placeholder="선생님을 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">전체 선생님</SelectItem>
                          {/* Include principals in the list */}
                          {teachers?.map(teacher => (
                            <SelectItem key={teacher.id} value={teacher.id}>{teacher.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">반 선택</Label>
                    <Select value={formData.classId} onValueChange={(v) => setFormData({ ...formData, classId: v, selectedStudentIds: [] })}>
                      <SelectTrigger data-testid="select-class">
                        <SelectValue placeholder="반을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredClasses?.length === 0 ? (
                          <SelectItem value="none" disabled>수업이 없습니다</SelectItem>
                        ) : (
                          filteredClasses?.map(cls => (
                            <SelectItem key={cls.id} value={cls.id}>
                              {cls.subject} - {cls.name} {cls.teacherName && `(${cls.teacherName})`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* 반 선택 후 해당 반 학생들 체크박스 */}
                  {formData.classId && formData.classId !== "none" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {formData.selectedStudentIds.length}명 선택됨 / {studentsInSelectedClass.length}명
                        </span>
                        <div className="flex gap-1">
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setFormData({ 
                              ...formData, 
                              selectedStudentIds: studentsInSelectedClass.map(s => s.id) 
                            })}
                          >
                            전체 선택
                          </Button>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setFormData({ ...formData, selectedStudentIds: [] })}
                          >
                            전체 해제
                          </Button>
                        </div>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="학생 검색..."
                          value={formData.studentSearchQuery}
                          onChange={(e) => setFormData({ ...formData, studentSearchQuery: e.target.value })}
                          className="pl-8"
                          data-testid="input-search-class-students"
                        />
                      </div>
                      <ScrollArea className="h-40 border rounded-md p-2">
                        <div className="space-y-1">
                          {filterStudentsBySearch(studentsInSelectedClass).length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              {studentsInSelectedClass.length === 0 ? "이 반에 등록된 학생이 없습니다" : "검색 결과가 없습니다"}
                            </p>
                          ) : (
                            filterStudentsBySearch(studentsInSelectedClass).map(student => (
                              <label 
                                key={student.id} 
                                className="flex items-center gap-2 p-1 rounded hover:bg-accent cursor-pointer"
                              >
                                <Checkbox
                                  checked={formData.selectedStudentIds.includes(student.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setFormData({ 
                                        ...formData, 
                                        selectedStudentIds: [...formData.selectedStudentIds, student.id] 
                                      });
                                    } else {
                                      setFormData({ 
                                        ...formData, 
                                        selectedStudentIds: formData.selectedStudentIds.filter(id => id !== student.id) 
                                      });
                                    }
                                  }}
                                  data-testid={`checkbox-class-student-${student.id}`}
                                />
                                <span className="text-sm">{student.name}</span>
                                <span className="text-xs text-muted-foreground">{student.grade}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </TabsContent>
                
                {/* 학년별 선택: 학년 체크 → 해당 학년 학생들 체크박스 */}
                <TabsContent value="grade" className="mt-2 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">학년 선택</Label>
                    <div className="flex flex-wrap gap-2">
                      {GRADES.map(grade => (
                        <label key={grade} className="flex items-center gap-1 cursor-pointer">
                          <Checkbox
                            checked={formData.selectedGrades.includes(grade)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFormData({ ...formData, selectedGrades: [...formData.selectedGrades, grade], selectedStudentIds: [] });
                              } else {
                                setFormData({ ...formData, selectedGrades: formData.selectedGrades.filter(g => g !== grade), selectedStudentIds: [] });
                              }
                            }}
                            data-testid={`checkbox-grade-${grade}`}
                          />
                          <span className="text-sm">{grade}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  {/* 학년 선택 후 해당 학년 학생들 체크박스 */}
                  {formData.selectedGrades.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {formData.selectedStudentIds.length}명 선택됨 / {studentsInSelectedGrades.length}명
                        </span>
                        <div className="flex gap-1">
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setFormData({ 
                              ...formData, 
                              selectedStudentIds: studentsInSelectedGrades.map(s => s.id) 
                            })}
                          >
                            전체 선택
                          </Button>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setFormData({ ...formData, selectedStudentIds: [] })}
                          >
                            전체 해제
                          </Button>
                        </div>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="학생 검색..."
                          value={formData.studentSearchQuery}
                          onChange={(e) => setFormData({ ...formData, studentSearchQuery: e.target.value })}
                          className="pl-8"
                          data-testid="input-search-grade-students"
                        />
                      </div>
                      <ScrollArea className="h-40 border rounded-md p-2">
                        <div className="space-y-1">
                          {filterStudentsBySearch(studentsInSelectedGrades).length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              {studentsInSelectedGrades.length === 0 ? "선택한 학년에 학생이 없습니다" : "검색 결과가 없습니다"}
                            </p>
                          ) : (
                            filterStudentsBySearch(studentsInSelectedGrades).map(student => (
                              <label 
                                key={student.id} 
                                className="flex items-center gap-2 p-1 rounded hover:bg-accent cursor-pointer"
                              >
                                <Checkbox
                                  checked={formData.selectedStudentIds.includes(student.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setFormData({ 
                                        ...formData, 
                                        selectedStudentIds: [...formData.selectedStudentIds, student.id] 
                                      });
                                    } else {
                                      setFormData({ 
                                        ...formData, 
                                        selectedStudentIds: formData.selectedStudentIds.filter(id => id !== student.id) 
                                      });
                                    }
                                  }}
                                  data-testid={`checkbox-grade-student-${student.id}`}
                                />
                                <span className="text-sm">{student.name}</span>
                                <span className="text-xs text-muted-foreground">{student.grade}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </TabsContent>
                
                {/* 전체 학생 선택 */}
                <TabsContent value="students" className="mt-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {formData.selectedStudentIds.length}명 선택됨 / {students.length}명
                      </span>
                      <div className="flex gap-1">
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setFormData({ 
                            ...formData, 
                            selectedStudentIds: allStudentsFiltered.map(s => s.id) 
                          })}
                        >
                          검색결과 전체 선택
                        </Button>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setFormData({ ...formData, selectedStudentIds: [] })}
                        >
                          전체 해제
                        </Button>
                      </div>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="이름 또는 학년으로 검색..."
                        value={formData.studentSearchQuery}
                        onChange={(e) => setFormData({ ...formData, studentSearchQuery: e.target.value })}
                        className="pl-8"
                        data-testid="input-search-all-students"
                      />
                    </div>
                    <ScrollArea className="h-48 border rounded-md p-2">
                      <div className="space-y-1">
                        {allStudentsFiltered.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            {students.length === 0 ? "등록된 학생이 없습니다" : "검색 결과가 없습니다"}
                          </p>
                        ) : (
                          allStudentsFiltered.map(student => (
                            <label 
                              key={student.id} 
                              className="flex items-center gap-2 p-1 rounded hover:bg-accent cursor-pointer"
                            >
                              <Checkbox
                                checked={formData.selectedStudentIds.includes(student.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFormData({ 
                                      ...formData, 
                                      selectedStudentIds: [...formData.selectedStudentIds, student.id] 
                                    });
                                  } else {
                                    setFormData({ 
                                      ...formData, 
                                      selectedStudentIds: formData.selectedStudentIds.filter(id => id !== student.id) 
                                    });
                                  }
                                }}
                                data-testid={`checkbox-student-${student.id}`}
                              />
                              <span className="text-sm">{student.name}</span>
                              <span className="text-xs text-muted-foreground">{student.grade}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>취소</Button>
            <Button onClick={handleCreateExam} disabled={createExamMutation.isPending} data-testid="button-confirm-create">
              {createExamMutation.isPending ? "생성 중..." : "생성"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>시험 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">시험명</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-edit-exam-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-scope">시험 범위</Label>
              <Input
                id="edit-scope"
                value={formData.scope}
                onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                data-testid="input-edit-exam-scope"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-date">시험일</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={formData.examDate}
                  onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                  data-testid="input-edit-exam-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-maxScore">만점</Label>
                <Input
                  id="edit-maxScore"
                  type="number"
                  value={formData.maxScore}
                  onChange={(e) => setFormData({ ...formData, maxScore: parseInt(e.target.value) || 100 })}
                  min={1}
                  data-testid="input-edit-max-score"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>취소</Button>
            <Button onClick={handleUpdateExam} disabled={updateExamMutation.isPending} data-testid="button-confirm-edit">
              {updateExamMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isScoreDialogOpen} onOpenChange={setIsScoreDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedExam?.name} - 점수 입력</DialogTitle>
            <DialogDescription>
              만점: {selectedExam?.maxScore}점
              {calculateStats() && (
                <span className="ml-4">
                  평균: {calculateStats()?.average}점 | 최고: {calculateStats()?.max}점 | 최저: {calculateStats()?.min}점
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>학년</TableHead>
                  <TableHead className="text-right">점수</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participantsWithNames.map(p => (
                  <TableRow key={p.studentId}>
                    <TableCell>{p.studentName}</TableCell>
                    <TableCell>{p.grade}</TableCell>
                    <TableCell className="text-right">
                      <ScoreInput
                        key={`${p.id}-${p.score}`}
                        initialValue={p.score}
                        participantId={p.id}
                        maxScore={selectedExam?.maxScore}
                        onSave={(participantId, score) => {
                          updateScoreMutation.mutate({ participantId, score });
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsScoreDialogOpen(false)}>닫기</Button>
            <Button onClick={() => {
              setIsScoreDialogOpen(false);
              toast({ title: "저장 완료", description: "점수가 저장되었습니다." });
            }}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaperUploadDialogOpen} onOpenChange={setIsPaperUploadDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedExam?.name} - 시험지 관리</DialogTitle>
            <DialogDescription>학생별 시험지 이미지를 업로드하세요 (45일 후 자동 삭제)</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>시험지</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participantsWithNames.map(p => {
                  const papers = examPapers?.filter(ep => ep.studentId === p.studentId) || [];
                  return (
                    <TableRow key={p.studentId}>
                      <TableCell>{p.studentName}</TableCell>
                      <TableCell>
                        {papers.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {papers.map((paper, idx) => (
                              <div key={paper.id} className="flex items-center gap-1">
                                <a 
                                  href={paper.imageUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-primary hover:underline text-xs"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setSelectedPaperUrl(paper.imageUrl);
                                  }}
                                >
                                  {papers.length > 1 ? `${idx + 1}장` : "보기"}
                                </a>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5"
                                  onClick={() => {
                                    apiRequest("DELETE", `/api/exam-papers/${paper.id}?actorId=${user?.id}`).then(() => {
                                      invalidateQueriesStartingWith("/api/exams");
                                      toast({ title: "시험지가 삭제되었습니다" });
                                    });
                                  }}
                                  data-testid={`button-delete-paper-${paper.id}`}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">없음</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            multiple
                            onChange={async (e) => {
                              const files = e.target.files;
                              if (files && files.length > 0 && selectedExam) {
                                for (let i = 0; i < files.length; i++) {
                                  await uploadPaperMutation.mutateAsync({
                                    examId: selectedExam.id,
                                    studentId: p.studentId,
                                    file: files[i],
                                  });
                                }
                              }
                              e.target.value = "";
                            }}
                            data-testid={`input-upload-paper-${p.studentId}`}
                          />
                          <Button size="sm" variant="outline" asChild disabled={uploadPaperMutation.isPending}>
                            <span>
                              <Upload className="h-3 w-3 mr-1" />
                              {uploadPaperMutation.isPending ? "업로드 중..." : "업로드"}
                            </span>
                          </Button>
                        </label>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsPaperUploadDialogOpen(false)}>닫기</Button>
            <Button onClick={() => {
              setIsPaperUploadDialogOpen(false);
              toast({ title: "저장 완료", description: "시험지가 저장되었습니다." });
            }}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>시험 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              "{examToDelete?.name}" 시험을 삭제하시겠습니까?
              모든 점수와 시험지 이미지가 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExam} className="bg-destructive text-destructive-foreground hover-elevate" data-testid="button-confirm-delete">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
