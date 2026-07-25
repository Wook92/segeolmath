import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Users, Search, ChevronDown, ChevronUp, Pencil, Trash2, Phone, Calendar, Building2, BookOpen, GraduationCap, School, Upload, FileSpreadsheet, CheckCircle, XCircle, Download, KeyRound, Loader2, X, Image as ImageIcon } from "lucide-react";
import { ManualButton } from "@/components/manual-button";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateQueriesStartingWith, queryClient, ApiError } from "@/lib/queryClient";
import { UserRole, isAssistantTeacher, type User, type Center, type Class, type Enrollment, type CenterFeature, type Feature, type NewConsultation, EXIT_REASON_LIST } from "@shared/schema";
import { RoleBadge } from "@/components/role-badge";
import { EnrollmentStatusTable, normalizeGrade } from "@/components/enrollment-status-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

function StudentExitDialog({ 
  student, 
  centerId, 
  recordedBy,
  onConfirm, 
  onCancel,
  isDeleting 
}: { 
  student: User; 
  centerId: string;
  recordedBy: string;
  onConfirm: (reasons: string[], notes: string) => void; 
  onCancel: () => void;
  isDeleting: boolean;
}) {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const toggleReason = (reason: string) => {
    setSelectedReasons(prev => 
      prev.includes(reason) 
        ? prev.filter(r => r !== reason) 
        : [...prev, reason]
    );
  };

  const handleConfirm = () => {
    if (selectedReasons.length === 0) {
      return;
    }
    onConfirm(selectedReasons, notes);
  };

  return (
    <AlertDialog open onOpenChange={() => !isDeleting && onCancel()}>
      <AlertDialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>학생 퇴원 처리</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-semibold text-foreground">{student.name}</span> 학생을 퇴원 처리합니다.
            <br />퇴원 사유를 선택해주세요. (복수 선택 가능)
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-3 py-2">
          <div className="grid gap-2">
            {EXIT_REASON_LIST.map(({ key, label }) => (
              <label 
                key={key} 
                htmlFor={`reason-${key}`}
                className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  id={`reason-${key}`}
                  checked={selectedReasons.includes(label)}
                  onCheckedChange={() => toggleReason(label)}
                  data-testid={`checkbox-reason-${key}`}
                />
                <span className="text-sm cursor-pointer flex-1">
                  {label}
                </span>
              </label>
            ))}
          </div>
          
          <div className="space-y-2 pt-2">
            <Label htmlFor="exit-notes">추가 메모 (선택)</Label>
            <Textarea
              id="exit-notes"
              placeholder="퇴원 관련 추가 메모를 입력하세요..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
              rows={2}
              data-testid="textarea-exit-notes"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={isDeleting}>
            취소
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            disabled={selectedReasons.length === 0 || isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-exit"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                처리 중...
              </>
            ) : (
              "퇴원 처리"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// 새 자녀 등록 폼 (전화번호 없이 이름만으로 등록)
function NewChildForm({ parentId, centerId, actorId, onSuccess }: { parentId: string; centerId: string; actorId: string; onSuccess: () => void }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [childData, setChildData] = useState({
    name: "",
    phone: "",
    school: "",
    grade: "",
    birthDate: "",
    address: "",
    gender: "",
    enrollmentDate: "",
  });
  
  const createChildMutation = useMutation({
    mutationFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      await apiRequest("POST", `/api/parents/${parentId}/children`, {
        actorId,
        centerId,
        name: childData.name,
        phone: childData.phone || null,
        school: childData.school || null,
        grade: childData.grade || null,
        birthDate: childData.birthDate || null,
        address: childData.address || null,
        gender: childData.gender || null,
        enrollmentDate: childData.enrollmentDate || today,
        password: Math.random().toString(36).slice(-8),
      });
    },
    onSuccess: () => {
      toast({ title: "자녀가 등록되었습니다" });
      setChildData({ name: "", phone: "", school: "", grade: "", birthDate: "", address: "", gender: "", enrollmentDate: "" });
      setIsOpen(false);
      onSuccess();
    },
    onError: () => {
      toast({ title: "자녀 등록에 실패했습니다", variant: "destructive" });
    },
  });
  
  const gradeOptions = [
    "초1", "초2", "초3", "초4", "초5", "초6",
    "중1", "중2", "중3",
    "고1", "고2", "고3",
    "성인"
  ];
  
  if (!isOpen) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        className="w-full"
        onClick={() => setIsOpen(true)}
        data-testid="button-add-new-child"
      >
        <Plus className="h-4 w-4 mr-1" />
        새 자녀 등록
      </Button>
    );
  }
  
  return (
    <div className="p-3 bg-muted/50 rounded-md space-y-3">
      <p className="text-sm font-medium">새 자녀 등록</p>
      <p className="text-xs text-muted-foreground">자녀 정보를 입력해주세요. 학부모가 대신 관리합니다.</p>
      
      <div className="space-y-2">
        <Input
          placeholder="자녀 이름 *"
          value={childData.name}
          onChange={(e) => setChildData(prev => ({ ...prev, name: e.target.value }))}
          data-testid="input-child-name"
        />
        <Input
          placeholder="전화번호 (선택)"
          value={childData.phone}
          onChange={(e) => setChildData(prev => ({ ...prev, phone: e.target.value }))}
          data-testid="input-child-phone"
        />
        <Input
          placeholder="학교 (선택)"
          value={childData.school}
          onChange={(e) => setChildData(prev => ({ ...prev, school: e.target.value }))}
          data-testid="input-child-school"
        />
        <Select 
          value={childData.grade} 
          onValueChange={(v) => setChildData(prev => ({ ...prev, grade: v }))}
        >
          <SelectTrigger data-testid="select-child-grade">
            <SelectValue placeholder="학년 (선택)" />
          </SelectTrigger>
          <SelectContent>
            {gradeOptions.map(grade => (
              <SelectItem key={grade} value={grade}>{grade}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-2">추가 정보 (선택사항)</p>
          
          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground">학원 입학일</label>
              <Input
                type="date"
                value={childData.enrollmentDate}
                onChange={(e) => setChildData(prev => ({ ...prev, enrollmentDate: e.target.value }))}
                data-testid="input-child-enrollment-date"
              />
              <p className="text-xs text-muted-foreground mt-1">미입력시 오늘 날짜로 자동 설정</p>
            </div>
            
            <div>
              <label className="text-xs text-muted-foreground">생년월일</label>
              <Input
                type="date"
                value={childData.birthDate}
                onChange={(e) => setChildData(prev => ({ ...prev, birthDate: e.target.value }))}
                data-testid="input-child-birth-date"
              />
            </div>
            
            <Select 
              value={childData.gender} 
              onValueChange={(v) => setChildData(prev => ({ ...prev, gender: v }))}
            >
              <SelectTrigger data-testid="select-child-gender">
                <SelectValue placeholder="성별 (선택)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">남자</SelectItem>
                <SelectItem value="female">여자</SelectItem>
              </SelectContent>
            </Select>
            
            <Input
              placeholder="주소 (선택)"
              value={childData.address}
              onChange={(e) => setChildData(prev => ({ ...prev, address: e.target.value }))}
              data-testid="input-child-address"
            />
          </div>
        </div>
      </div>
      
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => createChildMutation.mutate()}
          disabled={!childData.name.trim() || createChildMutation.isPending}
          data-testid="button-submit-new-child"
        >
          {createChildMutation.isPending ? "등록 중..." : "등록"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setIsOpen(false);
            setChildData({ name: "", phone: "", school: "", grade: "", birthDate: "", address: "", gender: "", enrollmentDate: "" });
          }}
        >
          취소
        </Button>
      </div>
    </div>
  );
}

function CreateUserDialog({ centers, onClose, teacherOnly = false, isClinicEnabled = false, accountTypeOverride }: { centers: Center[]; onClose: () => void; teacherOnly?: boolean; isClinicEnabled?: boolean; accountTypeOverride?: "student" | "parent" }) {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    motherPhone: "",
    fatherPhone: "",
    school: "",
    grade: "",
    role: accountTypeOverride === "parent" ? "0" : "1", // Default to parent role for parent mode, student role otherwise
    centerIds: [] as string[],
    attendancePin: "",
    employmentType: "regular" as string, // 고용 형태: regular, part_time, hourly
    dailyRate: "" as string,
    wageType: "hourly" as string,
    hourlyRate: "" as string, // 시급 (아르바이트용)
    fixedWorkStart: "14:00" as string,
    fixedWorkEnd: "22:00" as string,
    fixedWorkDays: [] as string[],
    consultationImageUrl: "" as string, // 상담지 이미지 URL
    consultationNotes: "" as string, // 상담 내용
    // 정규직/파트타임 급여 설정
    baseSalary: "" as string,
    classBasePayElementary: "" as string,
    classBasePayMiddle: "" as string,
    classBasePayHigh: "" as string,
    studentThresholdElementary: "" as string,
    studentThresholdMiddle: "" as string,
    studentThresholdHigh: "" as string,
    perStudentBonusElementary: "" as string,
    perStudentBonusMiddle: "" as string,
    perStudentBonusHigh: "" as string,
    // 학생/학부모 계정 유형 (accountTypeOverride가 있으면 그 값 사용)
    accountType: (accountTypeOverride || "student") as string, // student 또는 parent
    parentId: "" as string, // 학부모 계정 ID (학부모 자녀로 생성 시)
    // 학생 추가 정보
    birthDate: "" as string,
    address: "" as string,
    gender: "" as string,
    enrollmentDate: "" as string,
  });

  // Update role when accountTypeOverride changes
  useEffect(() => {
    if (accountTypeOverride === "parent") {
      setFormData(p => ({ ...p, role: "0" }));
    } else if (accountTypeOverride === "student") {
      setFormData(p => ({ ...p, role: "1" }));
    }
  }, [accountTypeOverride]);

  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  // Teacher check-in settings state
  const [teacherCheckInCode, setTeacherCheckInCode] = useState("");
  const [teacherSmsRecipient1, setTeacherSmsRecipient1] = useState("");
  const [teacherSmsRecipient2, setTeacherSmsRecipient2] = useState("");
  
  // Consultation image upload state
  const [isUploadingConsultation, setIsUploadingConsultation] = useState(false);
  const consultationFileInputRef = useRef<HTMLInputElement>(null);

  // Handle consultation image upload
  const handleConsultationImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "이미지 파일만 업로드 가능합니다", variant: "destructive" });
      return;
    }

    setIsUploadingConsultation(true);
    try {
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          contentType: file.type,
          prefix: "consultation",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadUrl, publicUrl } = await response.json();

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload image");
      }

      setFormData((prev) => ({ ...prev, consultationImageUrl: publicUrl }));
      toast({ title: "상담지 이미지가 업로드되었습니다" });
    } catch (error) {
      console.error("Consultation image upload error:", error);
      toast({ title: "이미지 업로드에 실패했습니다", variant: "destructive" });
    } finally {
      setIsUploadingConsultation(false);
      if (consultationFileInputRef.current) {
        consultationFileInputRef.current.value = "";
      }
    }
  };

  // Auto-select center when there's only one center available
  useEffect(() => {
    if (centers.length === 1 && formData.centerIds.length === 0) {
      setFormData(prev => ({ ...prev, centerIds: [centers[0].id] }));
    }
  }, [centers]);

  const isAdmin = user?.role === UserRole.ADMIN;
  const isPrincipal = user?.role === UserRole.PRINCIPAL;
  const isTeacher = user?.role === UserRole.TEACHER || user?.role === UserRole.CLINIC_TEACHER;
  const isTeacherRole = formData.role === "2" || formData.role === "2c";
  const canSetTeacherCheckIn = (isAdmin || isPrincipal) && isTeacherRole;

  const isStudentRole = formData.role === "1" && (accountTypeOverride !== "parent");
  const enrollCenterId = formData.centerIds.length > 0 ? formData.centerIds[0] : selectedCenter?.id || (centers.length === 1 ? centers[0].id : null);

  const { data: enrollTeachers = [] } = useQuery<User[]>({
    queryKey: [`/api/users?centerId=${enrollCenterId}`],
    enabled: !!enrollCenterId && isStudentRole,
    select: (users: User[]) => users.filter(u => u.role === 2 || u.role === 3),
  });

  const { data: enrollClasses = [] } = useQuery<Class[]>({
    queryKey: [`/api/classes?centerId=${enrollCenterId}`],
    enabled: !!enrollCenterId && isStudentRole,
  });

  const teacherClasses = useMemo(() => {
    if (!selectedTeacherId) return [];
    return enrollClasses.filter(c => c.teacherId === selectedTeacherId || isAssistantTeacher(c, selectedTeacherId));
  }, [enrollClasses, selectedTeacherId]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/users", data);
      const newUser = await res.json();
      if (selectedClassIds.length > 0 && newUser?.id) {
        for (const classId of selectedClassIds) {
          try {
            await apiRequest("POST", "/api/enrollments", { studentId: newUser.id, classId });
          } catch (e) {
            console.error("Enrollment error for class", classId, e);
          }
        }
      }
      return newUser;
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/users");
      invalidateQueriesStartingWith("/api/teachers");
      invalidateQueriesStartingWith("/api/enrollments");
      invalidateQueriesStartingWith("/api/classes");
      const msg = selectedClassIds.length > 0
        ? `계정이 생성되고 ${selectedClassIds.length}개 수업에 등록되었습니다`
        : "계정이 생성되었습니다";
      toast({ title: msg });
      onClose();
    },
    onError: (error: any) => {
      const serverMessage = error instanceof ApiError ? error.serverMessage : null;
      const message = serverMessage || "계정 생성에 실패했습니다";
      toast({ title: message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.centerIds.length === 0) {
      toast({ title: "센터를 선택해주세요", variant: "destructive" });
      return;
    }
    // 학생 계정에서만 부모 전화번호 필수 (선생님/원장/출결 역할이면 학생이 아님)
    const isSubmitNonStudentRole = formData.role === "2" || formData.role === "2c" || formData.role === "3" || formData.role === "-1";
    const isStudentAccount = !isSubmitNonStudentRole && (accountTypeOverride === "student" || (!accountTypeOverride && (teacherOnly || formData.role === "1") && formData.accountType !== "parent"));
    if (isStudentAccount && !formData.motherPhone && !formData.fatherPhone) {
      toast({ title: "학부모1 또는 학부모2 전화번호를 입력해주세요", variant: "destructive" });
      return;
    }
    // Validate teacher check-in code if provided
    if (canSetTeacherCheckIn && teacherCheckInCode && !/^\d{4}$/.test(teacherCheckInCode)) {
      toast({ title: "출근코드는 4자리 숫자여야 합니다", variant: "destructive" });
      return;
    }
    const isClinicTeacher = formData.role === "2c";
    const roleValue = isClinicTeacher ? 2 : parseInt(formData.role);

    // Build teacher check-in settings array (one per selected center)
    let teacherCheckInSettings: { centerId: string; checkInCode: string; smsRecipient1: string | null; smsRecipient2: string | null }[] | undefined;
    if (canSetTeacherCheckIn && teacherCheckInCode) {
      teacherCheckInSettings = formData.centerIds.map(centerId => ({
        centerId,
        checkInCode: teacherCheckInCode,
        smsRecipient1: teacherSmsRecipient1 || null,
        smsRecipient2: teacherSmsRecipient2 || null,
      }));
    }
    
    // Build salary settings for regular/part-time teachers
    let salarySettings: {
      baseSalary: number;
      classBasePayElementary: number;
      classBasePayMiddle: number;
      classBasePayHigh: number;
      studentThresholdElementary: number;
      studentThresholdMiddle: number;
      studentThresholdHigh: number;
      perStudentBonusElementary: number;
      perStudentBonusMiddle: number;
      perStudentBonusHigh: number;
    } | undefined;
    
    if (isTeacherRole && (formData.employmentType === "regular" || formData.employmentType === "part_time")) {
      const baseSalary = parseInt(formData.baseSalary) || 0;
      const classBasePayElementary = parseInt(formData.classBasePayElementary) || 0;
      const classBasePayMiddle = parseInt(formData.classBasePayMiddle) || 0;
      const classBasePayHigh = parseInt(formData.classBasePayHigh) || 0;
      const studentThresholdElementary = parseInt(formData.studentThresholdElementary) || 0;
      const studentThresholdMiddle = parseInt(formData.studentThresholdMiddle) || 0;
      const studentThresholdHigh = parseInt(formData.studentThresholdHigh) || 0;
      const perStudentBonusElementary = parseInt(formData.perStudentBonusElementary) || 0;
      const perStudentBonusMiddle = parseInt(formData.perStudentBonusMiddle) || 0;
      const perStudentBonusHigh = parseInt(formData.perStudentBonusHigh) || 0;
      
      const hasAnyValue = baseSalary > 0 || classBasePayElementary > 0 || classBasePayMiddle > 0 || classBasePayHigh > 0 ||
        studentThresholdElementary > 0 || studentThresholdMiddle > 0 || studentThresholdHigh > 0 ||
        perStudentBonusElementary > 0 || perStudentBonusMiddle > 0 || perStudentBonusHigh > 0;
      
      if (hasAnyValue) {
        salarySettings = {
          baseSalary,
          classBasePayElementary,
          classBasePayMiddle,
          classBasePayHigh,
          studentThresholdElementary,
          studentThresholdMiddle,
          studentThresholdHigh,
          perStudentBonusElementary,
          perStudentBonusMiddle,
          perStudentBonusHigh,
        };
      }
    }
    
    // 학부모 계정인 경우 role을 0(PARENT)로 설정
    // accountTypeOverride가 있어도 선생님/원장/출결 등 다른 역할을 선택했으면 그 역할로 등록
    const effectiveAccountType = accountTypeOverride || formData.accountType;
    // 학부모 모드에서 학부모(0) 또는 학생(1)을 선택한 경우에만 학부모로 처리
    const isParentAccountType = effectiveAccountType === "parent" && (formData.role === "0" || formData.role === "1");
    const finalRole = isParentAccountType ? 0 : roleValue;
    // 학생/학부모 계정 유형 설정 (학부모/학생 역할에만 적용)
    const finalAccountType = (formData.role === "0" || formData.role === "1") 
      ? (isParentAccountType ? "parent" : "student")
      : null;
    
    const today = new Date().toISOString().split('T')[0];
    createMutation.mutate({
      username: formData.phone.replace(/-/g, ""),
      password: "1234",
      name: formData.name,
      phone: formData.phone,
      motherPhone: formData.motherPhone || null,
      fatherPhone: formData.fatherPhone || null,
      school: formData.school || null,
      grade: formData.grade || null,
      role: finalRole,
      isClinicTeacher,
      centerIds: formData.centerIds,
      attendancePin: formData.attendancePin || null,
      teacherCheckInSettings,
      employmentType: isTeacherRole ? formData.employmentType : null,
      hourlyRate: isTeacherRole && (formData.employmentType === "hourly" || (formData.employmentType === "part_time" && formData.wageType === "hourly")) && formData.hourlyRate
        ? parseInt(formData.hourlyRate)
        : null,
      wageType: isTeacherRole && (formData.employmentType === "hourly" || (formData.employmentType === "part_time" && formData.wageType === "hourly")) ? "hourly"
        : isTeacherRole && formData.employmentType === "part_time" ? "monthly"
        : null,
      salarySettings,
      consultationImageUrl: formData.consultationImageUrl || null,
      consultationNotes: formData.consultationNotes || null,
      accountType: finalAccountType,
      birthDate: formData.birthDate || null,
      address: formData.address || null,
      gender: formData.gender || null,
      enrollmentDate: formData.enrollmentDate || today,
    });
  };

  const toggleCenter = (centerId: string) => {
    setFormData((p) => ({
      ...p,
      centerIds: p.centerIds.includes(centerId)
        ? p.centerIds.filter((id) => id !== centerId)
        : [...p.centerIds, centerId],
    }));
  };

  const availableRoles = accountTypeOverride === "parent"
    ? (isAdmin || isPrincipal)
      ? [
          { value: "0", label: "학부모" },
          { value: "2", label: "선생님" },
          { value: "3", label: "원장" },
          { value: "-1", label: "출결 계정" },
        ]
      : [
          { value: "0", label: "학부모" },
        ]
    : isAdmin
    ? [
        { value: "1", label: "학생" },
        { value: "2", label: "선생님" },
        { value: "3", label: "원장" },
        { value: "-1", label: "출결 계정" },
      ]
    : isPrincipal
    ? [
        { value: "1", label: "학생" },
        { value: "2", label: "선생님" },
        { value: "3", label: "원장" },
        { value: "-1", label: "출결 계정" },
      ]
    : isTeacher
    ? [
        { value: "1", label: "학생" },
      ]
    : [
        { value: "1", label: "학생" },
        { value: "2", label: "선생님" },
      ];

  // 학생 또는 학부모 관련 필드 표시 여부 (선생님/원장/출결 역할 선택 시 학생 필드 숨김)
  const isNonStudentRole = formData.role === "2" || formData.role === "2c" || formData.role === "3" || formData.role === "-1";
  const showStudentFields = !isNonStudentRole && (teacherOnly || formData.role === "1" || accountTypeOverride === "student");
  // 학부모 계정인 경우 (학교/학년 등 학생 전용 필드 숨김)
  const isParentMode = accountTypeOverride === "parent" && !isNonStudentRole;
  // 학생 전용 필드 (학교, 학년 등) - 학부모 계정에서는 숨김
  const showStudentOnlyFields = (showStudentFields || isParentMode) && !isParentMode;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">이름</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
          placeholder="홍길동"
          required
          data-testid="input-user-name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">휴대폰 번호 (아이디)</Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
          placeholder="010-1234-5678"
          required
          data-testid="input-user-phone"
        />
      </div>

      {/* 역할 선택: teacherOnly 모드가 아닐 때 표시 (학부모 모드에서는 학부모만 선택 가능) */}
      {!teacherOnly && (
        <div className="space-y-2">
          <Label>역할</Label>
          <Select
            value={formData.role}
            onValueChange={(v) => setFormData((p) => ({ ...p, role: v }))}
          >
            <SelectTrigger data-testid="select-user-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableRoles.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Account type is now determined by the accountTypeMode toggle in UsersPage */}

      {/* Employment type for teachers */}
      {isTeacherRole && (
        <div className="space-y-2">
          <Label>고용 형태</Label>
          <Select
            value={formData.employmentType}
            onValueChange={(v) => setFormData((p) => ({ ...p, employmentType: v, wageType: v === "part_time" ? "monthly" : v === "hourly" ? "hourly" : p.wageType }))}
          >
            <SelectTrigger data-testid="select-employment-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="regular">정규직</SelectItem>
              <SelectItem value="part_time">파트타임</SelectItem>
              <SelectItem value="hourly">아르바이트</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Wage settings for hourly teachers */}
      {isTeacherRole && formData.employmentType === "hourly" && (
        <div className="space-y-3 border rounded-md p-4 bg-muted/30">
          <Label className="font-semibold">시급 설정</Label>
          <div className="space-y-2">
            <Label htmlFor="hourlyRate">시급 (원)</Label>
            <Input
              id="hourlyRate"
              type="number"
              placeholder="예: 15000"
              value={formData.hourlyRate}
              onChange={(e) => setFormData((p) => ({ ...p, hourlyRate: e.target.value }))}
              data-testid="input-hourly-rate"
            />
          </div>
          <p className="text-xs text-muted-foreground">시간표 기반으로 급여가 자동 계산됩니다</p>
        </div>
      )}

      {/* Salary settings for regular/part-time teachers */}
      {isTeacherRole && (formData.employmentType === "regular" || formData.employmentType === "part_time") && (
        <div className="space-y-4 border rounded-md p-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <Label className="font-semibold">급여 설정 (선택사항)</Label>
          </div>
          <p className="text-xs text-muted-foreground">나중에 경영 탭 &gt; 선생님에서 수정할 수 있습니다</p>

          {formData.employmentType === "part_time" && (
            <div className="flex items-center gap-2">
              <Label className="text-sm w-16">급여유형</Label>
              <div className="flex rounded-md border overflow-hidden">
                <button
                  type="button"
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    formData.wageType !== "hourly"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setFormData((p) => ({ ...p, wageType: "monthly" }))}
                  data-testid="button-create-pt-percentage"
                >
                  비율제
                </button>
                <button
                  type="button"
                  className={`px-4 py-1.5 text-sm font-medium transition-colors border-l ${
                    formData.wageType === "hourly"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setFormData((p) => ({ ...p, wageType: "hourly" }))}
                  data-testid="button-create-pt-hourly"
                >
                  시급
                </button>
              </div>
            </div>
          )}

          {formData.employmentType === "part_time" && formData.wageType === "hourly" ? (
            <div className="space-y-2">
              <Label htmlFor="create-pt-hourlyRate">시급 (원)</Label>
              <Input
                id="create-pt-hourlyRate"
                type="number"
                placeholder="예: 15000"
                value={formData.hourlyRate}
                onChange={(e) => setFormData((p) => ({ ...p, hourlyRate: e.target.value }))}
                data-testid="input-create-pt-hourly-rate"
              />
              <p className="text-xs text-muted-foreground">시간표 기반으로 급여가 자동 계산됩니다</p>
            </div>
          ) : (
          <>
          <div className="space-y-2">
            <Label htmlFor="create-base-salary">기본급 (월)</Label>
            <Input
              id="create-base-salary"
              type="number"
              placeholder="예: 2000000"
              value={formData.baseSalary}
              onChange={(e) => setFormData((p) => ({ ...p, baseSalary: e.target.value === '' ? '' : String(parseInt(e.target.value) || 0) }))}
              data-testid="input-create-base-salary"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="create-class-base-elementary">초등 수업당 기본급</Label>
              <Input
                id="create-class-base-elementary"
                type="number"
                placeholder="예: 80000"
                value={formData.classBasePayElementary}
                onChange={(e) => setFormData((p) => ({ ...p, classBasePayElementary: e.target.value === '' ? '' : String(parseInt(e.target.value) || 0) }))}
                data-testid="input-create-class-base-elementary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-class-base-middle">중등 수업당 기본급</Label>
              <Input
                id="create-class-base-middle"
                type="number"
                placeholder="예: 100000"
                value={formData.classBasePayMiddle}
                onChange={(e) => setFormData((p) => ({ ...p, classBasePayMiddle: e.target.value === '' ? '' : String(parseInt(e.target.value) || 0) }))}
                data-testid="input-create-class-base-middle"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-class-base-high">고등 수업당 기본급</Label>
              <Input
                id="create-class-base-high"
                type="number"
                placeholder="예: 120000"
                value={formData.classBasePayHigh}
                onChange={(e) => setFormData((p) => ({ ...p, classBasePayHigh: e.target.value === '' ? '' : String(parseInt(e.target.value) || 0) }))}
                data-testid="input-create-class-base-high"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="create-threshold-elementary">초등 기준 인원</Label>
              <Input
                id="create-threshold-elementary"
                type="number"
                placeholder="예: 6"
                value={formData.studentThresholdElementary}
                onChange={(e) => setFormData((p) => ({ ...p, studentThresholdElementary: e.target.value === '' ? '' : String(parseInt(e.target.value) || 0) }))}
                data-testid="input-create-threshold-elementary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-threshold-middle">중등 기준 인원</Label>
              <Input
                id="create-threshold-middle"
                type="number"
                placeholder="예: 5"
                value={formData.studentThresholdMiddle}
                onChange={(e) => setFormData((p) => ({ ...p, studentThresholdMiddle: e.target.value === '' ? '' : String(parseInt(e.target.value) || 0) }))}
                data-testid="input-create-threshold-middle"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-threshold-high">고등 기준 인원</Label>
              <Input
                id="create-threshold-high"
                type="number"
                placeholder="예: 4"
                value={formData.studentThresholdHigh}
                onChange={(e) => setFormData((p) => ({ ...p, studentThresholdHigh: e.target.value === '' ? '' : String(parseInt(e.target.value) || 0) }))}
                data-testid="input-create-threshold-high"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="create-bonus-elementary">초등 초과 추가금</Label>
              <Input
                id="create-bonus-elementary"
                type="number"
                placeholder="예: 8000"
                value={formData.perStudentBonusElementary}
                onChange={(e) => setFormData((p) => ({ ...p, perStudentBonusElementary: e.target.value === '' ? '' : String(parseInt(e.target.value) || 0) }))}
                data-testid="input-create-bonus-elementary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-bonus-middle">중등 초과 추가금</Label>
              <Input
                id="create-bonus-middle"
                type="number"
                placeholder="예: 10000"
                value={formData.perStudentBonusMiddle}
                onChange={(e) => setFormData((p) => ({ ...p, perStudentBonusMiddle: e.target.value === '' ? '' : String(parseInt(e.target.value) || 0) }))}
                data-testid="input-create-bonus-middle"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-bonus-high">고등 초과 추가금</Label>
              <Input
                id="create-bonus-high"
                type="number"
                placeholder="예: 15000"
                value={formData.perStudentBonusHigh}
                onChange={(e) => setFormData((p) => ({ ...p, perStudentBonusHigh: e.target.value === '' ? '' : String(parseInt(e.target.value) || 0) }))}
                data-testid="input-create-bonus-high"
              />
            </div>
          </div>
          </>
          )}
        </div>
      )}

      {/* Teacher check-in settings for new teachers */}
      {canSetTeacherCheckIn && (
        <div className="space-y-4 border rounded-md p-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            <Label className="font-semibold">출근 알림 설정</Label>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="create-teacher-checkin-code">출근코드 (4자리 숫자)</Label>
            <Input
              id="create-teacher-checkin-code"
              value={teacherCheckInCode}
              onChange={(e) => setTeacherCheckInCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
              maxLength={4}
              data-testid="input-create-teacher-checkin-code"
            />
            <p className="text-xs text-muted-foreground">
              출결패드에서 출근 시 입력하는 코드입니다
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-teacher-sms-1">담당 원장님 연락처 1</Label>
            <Input
              id="create-teacher-sms-1"
              value={teacherSmsRecipient1}
              onChange={(e) => setTeacherSmsRecipient1(e.target.value)}
              placeholder="010-1234-5678"
              data-testid="input-create-teacher-sms-1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-teacher-sms-2">담당 원장님 연락처 2 (선택사항)</Label>
            <Input
              id="create-teacher-sms-2"
              value={teacherSmsRecipient2}
              onChange={(e) => setTeacherSmsRecipient2(e.target.value)}
              placeholder="010-1234-5678"
              data-testid="input-create-teacher-sms-2"
            />
          </div>
          
          <p className="text-xs text-muted-foreground">
            선생님이 출근코드를 입력하면 위 연락처로 출근 알림이 전송됩니다
          </p>
        </div>
      )}

      {/* 학생 전용 필드들 - 학부모 계정에서는 숨김 */}
      {showStudentOnlyFields && (
        <>
          <div className="space-y-2">
            <Label htmlFor="motherPhone">학부모1 전화번호</Label>
            <Input
              id="motherPhone"
              value={formData.motherPhone}
              onChange={(e) => setFormData((p) => ({ ...p, motherPhone: e.target.value }))}
              placeholder="010-1234-5678"
              data-testid="input-mother-phone"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fatherPhone">학부모2 전화번호</Label>
            <Input
              id="fatherPhone"
              value={formData.fatherPhone}
              onChange={(e) => setFormData((p) => ({ ...p, fatherPhone: e.target.value }))}
              placeholder="010-1234-5678"
              data-testid="input-father-phone"
            />
          </div>

          <p className="text-xs text-muted-foreground text-amber-600">
            * 학부모1 또는 학부모2 전화번호 중 하나는 필수입니다
          </p>

          <div className="space-y-2">
            <Label htmlFor="school">학교</Label>
            <Input
              id="school"
              value={formData.school}
              onChange={(e) => setFormData((p) => ({ ...p, school: e.target.value }))}
              placeholder="예: OO초등학교"
              data-testid="input-school"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="grade">학년</Label>
            <Select
              value={formData.grade}
              onValueChange={(v) => setFormData((p) => ({ ...p, grade: v }))}
            >
              <SelectTrigger data-testid="select-grade">
                <SelectValue placeholder="학년 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="초1">초등 1학년</SelectItem>
                <SelectItem value="초2">초등 2학년</SelectItem>
                <SelectItem value="초3">초등 3학년</SelectItem>
                <SelectItem value="초4">초등 4학년</SelectItem>
                <SelectItem value="초5">초등 5학년</SelectItem>
                <SelectItem value="초6">초등 6학년</SelectItem>
                <SelectItem value="중1">중학 1학년</SelectItem>
                <SelectItem value="중2">중학 2학년</SelectItem>
                <SelectItem value="중3">중학 3학년</SelectItem>
                <SelectItem value="고1">고등 1학년</SelectItem>
                <SelectItem value="고2">고등 2학년</SelectItem>
                <SelectItem value="고3">고등 3학년</SelectItem>
                <SelectItem value="성인">성인</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 학생 추가 정보 (선택사항) - 학생 계정에서만 표시 */}
          {showStudentOnlyFields && (
          <div className="space-y-4 border rounded-md p-4 bg-muted/30">
            <div className="flex items-center gap-2">
              <Label className="font-semibold">추가 정보</Label>
              <span className="text-xs text-muted-foreground">(선택사항)</span>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="enrollmentDate">학원 입학일</Label>
              <Input
                id="enrollmentDate"
                type="date"
                value={formData.enrollmentDate}
                onChange={(e) => setFormData((p) => ({ ...p, enrollmentDate: e.target.value }))}
                data-testid="input-enrollment-date"
              />
              <p className="text-xs text-muted-foreground">미입력시 오늘 날짜로 자동 설정</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="birthDate">생년월일</Label>
              <Input
                id="birthDate"
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData((p) => ({ ...p, birthDate: e.target.value }))}
                data-testid="input-birth-date"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="gender">성별</Label>
              <Select
                value={formData.gender}
                onValueChange={(v) => setFormData((p) => ({ ...p, gender: v }))}
              >
                <SelectTrigger data-testid="select-gender">
                  <SelectValue placeholder="성별 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">남자</SelectItem>
                  <SelectItem value="female">여자</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">주소</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                placeholder="주소 입력"
                data-testid="input-address"
              />
            </div>
          </div>
        )}

          <div className="space-y-2">
            <Label htmlFor="attendancePin">출결번호</Label>
            <Input
              id="attendancePin"
              value={formData.attendancePin}
              onChange={(e) => setFormData((p) => ({ ...p, attendancePin: e.target.value }))}
              placeholder="예: 5678 (핸드폰 번호 뒷 4자리)"
              maxLength={6}
              data-testid="input-attendance-pin"
            />
            <p className="text-xs text-muted-foreground">
              미입력 시 핸드폰 번호 뒷 4자리로 자동 생성됩니다
            </p>
          </div>

          {/* 수업 등록 (선택사항) */}
          <div className="space-y-4 border rounded-md p-4 bg-muted/30">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <Label className="font-semibold">수업 등록</Label>
              <span className="text-xs text-muted-foreground">(선택사항)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              선생님을 선택하면 해당 선생님의 수업 목록이 표시됩니다
            </p>

            <div className="space-y-2">
              <Label>선생님 선택</Label>
              <Select
                value={selectedTeacherId}
                onValueChange={(v) => {
                  setSelectedTeacherId(v);
                }}
              >
                <SelectTrigger data-testid="select-enroll-teacher">
                  <SelectValue placeholder="선생님을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {enrollTeachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTeacherId && teacherClasses.length > 0 && (
              <div className="space-y-2">
                <Label>수업 선택 (복수 선택 가능)</Label>
                <div className="space-y-2 border rounded-md p-3 max-h-[200px] overflow-y-auto">
                  {teacherClasses.map((cls) => (
                    <label
                      key={cls.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded px-1 py-1"
                    >
                      <Checkbox
                        checked={selectedClassIds.includes(cls.id)}
                        onCheckedChange={(checked) => {
                          setSelectedClassIds(prev =>
                            checked
                              ? [...prev, cls.id]
                              : prev.filter(id => id !== cls.id)
                          );
                        }}
                        data-testid={`checkbox-enroll-class-${cls.id}`}
                      />
                      <span className="text-sm">{cls.name} {cls.subject}반</span>
                      {cls.startTime && cls.endTime && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {cls.startTime}~{cls.endTime}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {selectedTeacherId && teacherClasses.length === 0 && (
              <p className="text-xs text-muted-foreground">
                해당 선생님에게 등록된 수업이 없습니다
              </p>
            )}

            {selectedClassIds.length > 0 && (
              <div className="space-y-2">
                <Label className="text-primary font-medium">선택된 수업 ({selectedClassIds.length}개)</Label>
                <div className="space-y-1 border rounded-md p-3 bg-primary/5">
                  {selectedClassIds.map((classId) => {
                    const cls = enrollClasses.find(c => c.id === classId);
                    const teacher = enrollTeachers.find(t => t.id === cls?.teacherId);
                    if (!cls) return null;
                    return (
                      <div
                        key={classId}
                        className="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-accent/50"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate">{cls.name} {cls.subject}반</span>
                          {teacher && (
                            <span className="text-xs text-muted-foreground shrink-0">({teacher.name})</span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => setSelectedClassIds(prev => prev.filter(id => id !== classId))}
                          data-testid={`button-remove-class-${classId}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Consultation Image Upload */}
          <div className="space-y-4 border rounded-md p-4 bg-muted/30">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              <Label className="font-semibold">상담지</Label>
              <span className="text-xs text-muted-foreground">(선택사항)</span>
            </div>
            
            <input
              ref={consultationFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleConsultationImageUpload}
              className="hidden"
              id="consultation-image-input-create"
            />
            {formData.consultationImageUrl ? (
              <div className="space-y-2">
                <div className="relative w-full max-w-xs">
                  <img
                    src={formData.consultationImageUrl}
                    alt="상담지"
                    className="w-full h-auto rounded-md border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => setFormData((p) => ({ ...p, consultationImageUrl: "" }))}
                    data-testid="button-remove-consultation-image-create"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => consultationFileInputRef.current?.click()}
                  disabled={isUploadingConsultation}
                  data-testid="button-change-consultation-image-create"
                >
                  {isUploadingConsultation ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      이미지 변경
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => consultationFileInputRef.current?.click()}
                disabled={isUploadingConsultation}
                data-testid="button-upload-consultation-image-create"
              >
                {isUploadingConsultation ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    업로드 중...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    상담지 이미지 업로드
                  </>
                )}
              </Button>
            )}

            <div className="space-y-2">
              <Label htmlFor="consultationNotes">상담 내용</Label>
              <Textarea
                id="consultationNotes"
                value={formData.consultationNotes}
                onChange={(e) => setFormData((p) => ({ ...p, consultationNotes: e.target.value }))}
                placeholder="상담 내용을 입력하세요..."
                rows={4}
                data-testid="textarea-consultation-notes-create"
              />
            </div>
          </div>
        </>
      )}

      {/* Hide center selection when there's only one center available */}
      {centers.length > 1 && (
        <div className="space-y-2">
          <Label>센터 (복수 선택 가능)</Label>
          <div className="space-y-2 border rounded-md p-3">
            {centers.map((center) => (
              <label
                key={center.id}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={formData.centerIds.includes(center.id)}
                  onChange={() => toggleCenter(center.id)}
                  className="h-4 w-4 rounded border-input"
                  data-testid={`checkbox-center-${center.id}`}
                />
                <span className="text-sm">{center.name}</span>
              </label>
            ))}
          </div>
          {formData.centerIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              선택됨: {formData.centerIds.length}개 센터
            </p>
          )}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        기본 비밀번호: 1234
      </p>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-user">
          {createMutation.isPending ? "생성 중..." : "계정 생성"}
        </Button>
      </DialogFooter>
    </form>
  );
}


function EditUserDialog({ user: editingUser, centers, onClose, isClinicEnabled = false }: { user: User; centers: Center[]; onClose: () => void; isClinicEnabled?: boolean }) {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: editingUser.name,
    phone: editingUser.phone || editingUser.username,
    motherPhone: editingUser.motherPhone || "",
    fatherPhone: editingUser.fatherPhone || "",
    studentPhone: (editingUser as any).studentPhone || "",
    school: editingUser.school || "",
    grade: normalizeGrade(editingUser.grade),
    role: editingUser.isClinicTeacher ? "2c" : String(editingUser.role),
    attendancePin: "",
    employmentType: editingUser.employmentType || "regular",
    dailyRate: editingUser.dailyRate ? String(editingUser.dailyRate) : "",
    wageType: (editingUser as any).wageType || (editingUser.employmentType === "part_time" ? "monthly" : "hourly"),
    hourlyRate: (editingUser as any).hourlyRate ? String((editingUser as any).hourlyRate) : "",
    fixedWorkStart: (editingUser as any).fixedWorkStart || "14:00",
    fixedWorkEnd: (editingUser as any).fixedWorkEnd || "22:00",
    fixedWorkDays: (editingUser as any).fixedWorkDays || [],
    consultationImageUrl: editingUser.consultationImageUrl || "",
    consultationNotes: editingUser.consultationNotes || "",
    // 급여 설정
    baseSalary: "" as string,
    classBasePayElementary: "" as string,
    classBasePayMiddle: "" as string,
    classBasePayHigh: "" as string,
    studentThresholdElementary: "" as string,
    studentThresholdMiddle: "" as string,
    studentThresholdHigh: "" as string,
    perStudentBonusElementary: "" as string,
    perStudentBonusMiddle: "" as string,
    perStudentBonusHigh: "" as string,
    // 계정 유형
    accountType: editingUser.accountType || "student",
  });

  // Teacher check-in settings state
  const [teacherCheckInCode, setTeacherCheckInCode] = useState("");
  const [teacherSmsRecipient1, setTeacherSmsRecipient1] = useState("");
  const [teacherSmsRecipient2, setTeacherSmsRecipient2] = useState("");
  const [selectedTeacherCenterId, setSelectedTeacherCenterId] = useState<string>(selectedCenter?.id || "");
  
  // Consultation image upload state
  const [isUploadingConsultation, setIsUploadingConsultation] = useState(false);
  const consultationFileInputRef = useRef<HTMLInputElement>(null);

  const [editSelectedTeacherId, setEditSelectedTeacherId] = useState<string>("");
  const [editSelectedClassIds, setEditSelectedClassIds] = useState<string[]>([]);

  const isAdmin = user?.role === UserRole.ADMIN;
  const isPrincipal = user?.role === UserRole.PRINCIPAL;
  const isTeacher = user?.role === UserRole.TEACHER || user?.role === UserRole.CLINIC_TEACHER;
  const isStudent = editingUser.role === UserRole.STUDENT;
  const isEditingTeacher = editingUser.role === UserRole.TEACHER || editingUser.role === UserRole.CLINIC_TEACHER;
  const canEditTeacherSettings = (isAdmin || isPrincipal) && isEditingTeacher;

  const [editClassRateMode, setEditClassRateMode] = useState<"bulk" | "individual">("bulk");
  const [editClassRates, setEditClassRates] = useState<Record<string, string>>({});

  const { data: teacherClasses = [] } = useQuery<any[]>({
    queryKey: ["/api/classes", selectedCenter?.id, "teacher", editingUser.id],
    queryFn: async () => {
      if (!selectedCenter?.id) return [];
      const res = await apiRequest("GET", `/api/classes?centerId=${selectedCenter.id}`);
      const allClasses = await res.json();
      return allClasses.filter((c: any) => c.teacherId === editingUser.id || isAssistantTeacher(c, editingUser.id));
    },
    enabled: !!selectedCenter?.id && isEditingTeacher,
  });

  useEffect(() => {
    if (teacherClasses.length > 0) {
      const hasIndividual = teacherClasses.some((c: any) => c.hourlyRate);
      setEditClassRateMode(hasIndividual ? "individual" : "bulk");
      const rates: Record<string, string> = {};
      for (const c of teacherClasses) {
        rates[c.id] = c.hourlyRate ? String(c.hourlyRate) : "";
      }
      setEditClassRates(rates);
    }
  }, [teacherClasses]);

  const { data: userCenters } = useQuery<Center[]>({
    queryKey: ["/api/users", editingUser.id, "centers"],
  });

  const [selectedCenterIds, setSelectedCenterIds] = useState<string[]>([]);

  useEffect(() => {
    if (userCenters) {
      setSelectedCenterIds(userCenters.map(c => c.id));
      if (userCenters.length > 0 && !selectedTeacherCenterId) {
        const currentCenterId = selectedCenter?.id;
        const matchingCenter = currentCenterId && userCenters.find(c => c.id === currentCenterId);
        setSelectedTeacherCenterId(matchingCenter ? matchingCenter.id : userCenters[0].id);
      }
    }
  }, [userCenters, selectedTeacherCenterId]);

  // Fetch existing teacher check-in settings for selected center
  const { data: teacherCheckInSettings } = useQuery<{
    id: string;
    checkInCode: string;
    smsRecipient1: string | null;
    smsRecipient2: string | null;
  } | null>({
    queryKey: [`/api/teacher-check-in-settings?teacherId=${editingUser.id}&centerId=${selectedTeacherCenterId}`],
    enabled: !!selectedTeacherCenterId && canEditTeacherSettings,
  });

  // Populate teacher check-in settings when data loads
  useEffect(() => {
    if (teacherCheckInSettings) {
      setTeacherCheckInCode(teacherCheckInSettings.checkInCode || "");
      setTeacherSmsRecipient1(teacherCheckInSettings.smsRecipient1 || "");
      setTeacherSmsRecipient2(teacherCheckInSettings.smsRecipient2 || "");
    } else {
      // Reset fields when no settings exist for selected center
      setTeacherCheckInCode("");
      setTeacherSmsRecipient1("");
      setTeacherSmsRecipient2("");
    }
  }, [teacherCheckInSettings, selectedTeacherCenterId]);

  // Fetch existing salary settings for teacher
  type SalarySettingsType = {
    id: string;
    teacherId: string;
    centerId: string;
    baseSalary: number;
    classBasePay: number;
    classBasePayElementary: number;
    classBasePayMiddle: number;
    classBasePayHigh: number;
    studentThreshold: number;
    studentThresholdElementary: number;
    studentThresholdMiddle: number;
    studentThresholdHigh: number;
    perStudentBonus: number;
    perStudentBonusElementary: number;
    perStudentBonusMiddle: number;
    perStudentBonusHigh: number;
  };

  const { data: salarySettings } = useQuery<SalarySettingsType | null>({
    queryKey: [`/api/teacher-salary-settings/${editingUser.id}?centerId=${selectedTeacherCenterId}`],
    enabled: !!selectedTeacherCenterId && isEditingTeacher,
  });

  // Populate salary settings when data loads or center changes
  useEffect(() => {
    if (salarySettings) {
      setFormData(prev => ({
        ...prev,
        baseSalary: salarySettings.baseSalary != null ? String(salarySettings.baseSalary) : "",
        classBasePayElementary: salarySettings.classBasePayElementary != null ? String(salarySettings.classBasePayElementary) : "",
        classBasePayMiddle: salarySettings.classBasePayMiddle != null ? String(salarySettings.classBasePayMiddle) : "",
        classBasePayHigh: salarySettings.classBasePayHigh != null ? String(salarySettings.classBasePayHigh) : "",
        studentThresholdElementary: salarySettings.studentThresholdElementary != null ? String(salarySettings.studentThresholdElementary) : "",
        studentThresholdMiddle: salarySettings.studentThresholdMiddle != null ? String(salarySettings.studentThresholdMiddle) : "",
        studentThresholdHigh: salarySettings.studentThresholdHigh != null ? String(salarySettings.studentThresholdHigh) : "",
        perStudentBonusElementary: salarySettings.perStudentBonusElementary != null ? String(salarySettings.perStudentBonusElementary) : "",
        perStudentBonusMiddle: salarySettings.perStudentBonusMiddle != null ? String(salarySettings.perStudentBonusMiddle) : "",
        perStudentBonusHigh: salarySettings.perStudentBonusHigh != null ? String(salarySettings.perStudentBonusHigh) : "",
        employmentType: (salarySettings as any).employmentType || editingUser.employmentType || "",
        wageType: (salarySettings as any).wageType || editingUser.wageType || "",
        hourlyRate: (salarySettings as any).hourlyRate != null ? String((salarySettings as any).hourlyRate) : (editingUser.hourlyRate != null ? String(editingUser.hourlyRate) : ""),
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        baseSalary: "",
        classBasePayElementary: "",
        classBasePayMiddle: "",
        classBasePayHigh: "",
        studentThresholdElementary: "",
        studentThresholdMiddle: "",
        studentThresholdHigh: "",
        perStudentBonusElementary: "",
        perStudentBonusMiddle: "",
        perStudentBonusHigh: "",
        employmentType: editingUser.employmentType || "",
        wageType: editingUser.wageType || "",
        hourlyRate: editingUser.hourlyRate != null ? String(editingUser.hourlyRate) : "",
      }));
    }
  }, [salarySettings, selectedTeacherCenterId]);

  const editEnrollCenterId = selectedCenter?.id || (centers.length === 1 ? centers[0].id : (userCenters && userCenters.length > 0 ? userCenters[0].id : null));

  const { data: editEnrollTeachers = [] } = useQuery<User[]>({
    queryKey: [`/api/users?centerId=${editEnrollCenterId}`],
    enabled: !!editEnrollCenterId && isStudent,
    select: (users: User[]) => users.filter(u => u.role === 2 || u.role === 3),
  });

  const { data: editEnrollClasses = [] } = useQuery<Class[]>({
    queryKey: [`/api/classes?centerId=${editEnrollCenterId}`],
    enabled: !!editEnrollCenterId && isStudent,
  });

  const { data: existingEnrollments = [] } = useQuery<Enrollment[]>({
    queryKey: [`/api/students/${editingUser.id}/enrollments`],
    enabled: isStudent,
  });

  const existingClassIds = useMemo(() =>
    new Set(existingEnrollments.map(e => e.classId)),
    [existingEnrollments]
  );

  const editTeacherClasses = useMemo(() => {
    if (!editSelectedTeacherId) return [];
    return editEnrollClasses.filter(c => c.teacherId === editSelectedTeacherId || isAssistantTeacher(c, editSelectedTeacherId));
  }, [editEnrollClasses, editSelectedTeacherId]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/users/${editingUser.id}`, data);
      if (editSelectedClassIds.length > 0) {
        for (const classId of editSelectedClassIds) {
          if (!existingClassIds.has(classId)) {
            try {
              await apiRequest("POST", "/api/enrollments", { studentId: editingUser.id, classId });
            } catch (e) {
              console.error("Enrollment error for class", classId, e);
            }
          }
        }
      }
      return res;
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/users");
      invalidateQueriesStartingWith("/api/teachers");
      invalidateQueriesStartingWith("/api/enrollments");
      invalidateQueriesStartingWith("/api/classes");
      invalidateQueriesStartingWith("/api/teacher-schedule-hours");
      const newClassCount = editSelectedClassIds.filter(id => !existingClassIds.has(id)).length;
      const msg = newClassCount > 0
        ? `계정이 수정되고 ${newClassCount}개 수업에 등록되었습니다`
        : "계정이 수정되었습니다";
      toast({ title: msg });
      onClose();
    },
    onError: (error: any) => {
      const serverMessage = error instanceof ApiError ? error.serverMessage : null;
      toast({ title: serverMessage || "수정에 실패했습니다", variant: "destructive" });
    },
  });

  const saveTeacherCheckInMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/teacher-check-in-settings", data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/teacher-check-in-settings");
    },
    onError: (error: any) => {
      const serverMessage = error instanceof ApiError ? error.serverMessage : null;
      toast({ title: serverMessage || "출근 설정 저장 실패", variant: "destructive" });
      throw error; // Re-throw to prevent user update from proceeding
    },
  });

  const saveSalarySettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/teacher-salary-settings", { ...data, actorId: user?.id });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/teacher-salary-settings");
    },
    onError: (error: any) => {
      const serverMessage = error instanceof ApiError ? error.serverMessage : null;
      toast({ title: serverMessage || "급여 설정 저장 실패", variant: "destructive" });
    },
  });

  // Handle consultation image upload
  const handleConsultationImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "이미지 파일만 업로드 가능합니다", variant: "destructive" });
      return;
    }

    setIsUploadingConsultation(true);
    try {
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          contentType: file.type,
          prefix: "consultation",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadUrl, publicUrl } = await response.json();

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload image");
      }

      setFormData((prev) => ({ ...prev, consultationImageUrl: publicUrl }));
      toast({ title: "상담지 이미지가 업로드되었습니다" });
    } catch (error) {
      console.error("Consultation image upload error:", error);
      toast({ title: "이미지 업로드에 실패했습니다", variant: "destructive" });
    } finally {
      setIsUploadingConsultation(false);
      if (consultationFileInputRef.current) {
        consultationFileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isClinicTeacher = formData.role === "2c";
    const roleValue = isClinicTeacher ? 2 : parseInt(formData.role);
    
    try {
      // Save teacher check-in settings first if applicable
      if (canEditTeacherSettings && teacherCheckInCode && selectedTeacherCenterId) {
        if (!/^\d{4}$/.test(teacherCheckInCode)) {
          toast({ title: "출근코드는 4자리 숫자여야 합니다", variant: "destructive" });
          return;
        }
        await saveTeacherCheckInMutation.mutateAsync({
          teacherId: editingUser.id,
          centerId: selectedTeacherCenterId,
          checkInCode: teacherCheckInCode,
          smsRecipient1: teacherSmsRecipient1 || null,
          smsRecipient2: teacherSmsRecipient2 || null,
          isActive: true,
        });
      }

      if (isEditingTeacher && selectedTeacherCenterId) {
        const isHourlyTypeForSalary = formData.employmentType === "hourly" || (formData.employmentType === "part_time" && formData.wageType === "hourly");
        const hasSalaryData = formData.baseSalary !== "" || formData.classBasePayElementary !== "" || formData.classBasePayMiddle !== "" || formData.classBasePayHigh !== "";
        const hasWageData = formData.employmentType || formData.hourlyRate;
        if (hasSalaryData || hasWageData) {
          try {
            await saveSalarySettingsMutation.mutateAsync({
              teacherId: editingUser.id,
              centerId: selectedTeacherCenterId,
              baseSalary: parseInt(formData.baseSalary) || 0,
              classBasePay: parseInt(formData.classBasePayMiddle) || 0,
              classBasePayElementary: parseInt(formData.classBasePayElementary) || 0,
              classBasePayMiddle: parseInt(formData.classBasePayMiddle) || 0,
              classBasePayHigh: parseInt(formData.classBasePayHigh) || 0,
              studentThreshold: parseInt(formData.studentThresholdMiddle) || 0,
              studentThresholdElementary: parseInt(formData.studentThresholdElementary) || 0,
              studentThresholdMiddle: parseInt(formData.studentThresholdMiddle) || 0,
              studentThresholdHigh: parseInt(formData.studentThresholdHigh) || 0,
              perStudentBonus: parseInt(formData.perStudentBonusMiddle) || 0,
              perStudentBonusElementary: parseInt(formData.perStudentBonusElementary) || 0,
              perStudentBonusMiddle: parseInt(formData.perStudentBonusMiddle) || 0,
              perStudentBonusHigh: parseInt(formData.perStudentBonusHigh) || 0,
              employmentType: formData.employmentType || null,
              wageType: isHourlyTypeForSalary ? "hourly" : (formData.employmentType === "part_time" ? "monthly" : null),
              hourlyRate: isHourlyTypeForSalary && formData.hourlyRate ? parseInt(formData.hourlyRate) : null,
            });
          } catch (e) {
            console.error("Salary settings save failed:", e);
          }
        }
      }
      
      const isHourlyType = formData.employmentType === "hourly" || (formData.employmentType === "part_time" && formData.wageType === "hourly");

      let classRatesPayload: any[] | undefined = undefined;
      let classRateModePayload: string | undefined = undefined;
      if (isHourlyType && isEditingTeacher) {
        classRateModePayload = editClassRateMode;
        if (editClassRateMode === "individual") {
          classRatesPayload = Object.entries(editClassRates).map(([classId, val]) => ({
            classId,
            hourlyRate: val !== "" && val != null ? parseInt(val) : null,
          }));
        } else if (teacherClasses.length > 0) {
          classRatesPayload = teacherClasses.map((c: any) => ({ classId: c.id, hourlyRate: null }));
        }
      }

      updateMutation.mutate({
        name: formData.name,
        phone: formData.phone,
        motherPhone: formData.motherPhone || null,
        fatherPhone: formData.fatherPhone || null,
        studentPhone: formData.studentPhone || null,
        school: formData.school || null,
        grade: formData.grade || null,
        role: roleValue,
        isClinicTeacher,
        centerIds: selectedCenterIds.length > 0 ? selectedCenterIds : undefined,
        attendancePin: formData.attendancePin || undefined,
        consultationImageUrl: formData.consultationImageUrl || null,
        consultationNotes: formData.consultationNotes || null,
        classRates: classRatesPayload,
        classRateMode: classRateModePayload,
        actorId: user?.id,
      });
    } catch (err) {
      // Error already shown by mutation onError handler
    }
  };

  const toggleCenter = (centerId: string) => {
    setSelectedCenterIds((prev) =>
      prev.includes(centerId)
        ? prev.filter((id) => id !== centerId)
        : [...prev, centerId]
    );
  };

  // Show clinic teacher option only if clinic feature is enabled OR user is already a clinic teacher
  const showClinicTeacherOption = isClinicEnabled || editingUser.isClinicTeacher;
  
  // 수정 중인 사용자가 학부모 계정인지 확인
  const isEditingParent = editingUser.role === UserRole.PARENT || editingUser.accountType === "parent";
  
  const availableRoles = isEditingParent
    ? (isAdmin || isPrincipal)
      ? [
          { value: "0", label: "학부모" },
          { value: "2", label: "선생님" },
          { value: "3", label: "원장" },
          { value: "-1", label: "출결 계정" },
        ]
      : [
          { value: "0", label: "학부모" },
        ]
    : isAdmin
    ? [
        { value: "1", label: "학생" },
        { value: "2", label: "선생님" },
        ...(showClinicTeacherOption ? [{ value: "2c", label: "클리닉 선생님" }] : []),
        { value: "3", label: "원장" },
        { value: "4", label: "관리자" },
        { value: "-1", label: "출결 계정" },
      ]
    : isPrincipal
    ? [
        { value: "1", label: "학생" },
        { value: "2", label: "선생님" },
        ...(showClinicTeacherOption ? [{ value: "2c", label: "클리닉 선생님" }] : []),
        { value: "3", label: "원장" },
        { value: "-1", label: "출결 계정" },
      ]
    : isTeacher
    ? [
        { value: "1", label: "학생" },
      ]
    : [
        { value: "1", label: "학생" },
        { value: "2", label: "선생님" },
        ...(showClinicTeacherOption ? [{ value: "2c", label: "클리닉 선생님" }] : []),
      ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="edit-name">이름 *</Label>
        <Input
          id="edit-name"
          value={formData.name}
          onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
          required
          data-testid="input-edit-name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-phone">
          {(editingUser as any).parentId && editingUser.role === UserRole.STUDENT 
            ? "학부모 번호 (로그인 아이디)" 
            : "전화번호 (로그인 아이디)"}
        </Label>
        <Input
          id="edit-phone"
          value={(editingUser as any).parentId && editingUser.role === UserRole.STUDENT 
            ? (formData.motherPhone || formData.phone) 
            : formData.phone}
          disabled
          className="bg-muted cursor-not-allowed"
          data-testid="input-edit-phone"
        />
        <p className="text-xs text-muted-foreground">아이디는 변경할 수 없습니다</p>
      </div>

      {!(editingUser as any).parentId && (
        <div className="space-y-2">
          <Label htmlFor="edit-role">역할</Label>
          <Select
            value={formData.role}
            onValueChange={(v) => setFormData((p) => ({ ...p, role: v }))}
          >
            <SelectTrigger data-testid="select-edit-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableRoles.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Employment type for teachers */}
      {(isEditingTeacher || formData.role === "2" || formData.role === "2c") && (
        <div className="space-y-2">
          <Label>고용 형태</Label>
          <Select
            value={formData.employmentType}
            onValueChange={(v) => setFormData((p) => ({ ...p, employmentType: v, wageType: v === "part_time" ? "monthly" : v === "hourly" ? "hourly" : p.wageType }))}
          >
            <SelectTrigger data-testid="select-edit-employment-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="regular">정규직</SelectItem>
              <SelectItem value="part_time">파트타임</SelectItem>
              <SelectItem value="hourly">아르바이트</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {(isEditingTeacher || formData.role === "2" || formData.role === "2c") && formData.employmentType === "hourly" && (
        <div className="space-y-3 border rounded-md p-4 bg-muted/30">
          <Label className="font-semibold">시급 설정</Label>
          <div className="flex items-center gap-2">
            <Label className="text-sm w-20">적용방식</Label>
            <div className="flex rounded-md border overflow-hidden">
              <button type="button" className={`px-3 py-1.5 text-xs font-medium transition-colors ${editClassRateMode === "bulk" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`} onClick={() => setEditClassRateMode("bulk")} data-testid="button-edit-hourly-rate-mode-bulk">일괄적용</button>
              <button type="button" className={`px-3 py-1.5 text-xs font-medium transition-colors border-l ${editClassRateMode === "individual" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`} onClick={() => setEditClassRateMode("individual")} data-testid="button-edit-hourly-rate-mode-individual">별도적용</button>
            </div>
          </div>
          {editClassRateMode === "bulk" ? (
            <div className="space-y-2">
              <Label htmlFor="edit-hourlyRate">시급 (원)</Label>
              <Input id="edit-hourlyRate" type="number" placeholder="예: 15000" value={formData.hourlyRate} onChange={(e) => setFormData((p) => ({ ...p, hourlyRate: e.target.value }))} data-testid="input-edit-hourly-rate" />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="edit-hourlyRate-default">기본 시급 (원)</Label>
                <Input id="edit-hourlyRate-default" type="number" placeholder="예: 15000" value={formData.hourlyRate} onChange={(e) => setFormData((p) => ({ ...p, hourlyRate: e.target.value }))} data-testid="input-edit-default-hourly-rate" />
                <p className="text-xs text-muted-foreground">별도 시급 미설정 수업에 적용</p>
              </div>
              {teacherClasses.length === 0 ? (
                <p className="text-xs text-muted-foreground">배정된 수업이 없습니다</p>
              ) : teacherClasses.map((cls: any) => (
                <div key={cls.id} className="flex items-center gap-2">
                  <span className="text-sm w-36 truncate">{cls.name} {cls.subject}{isAssistantTeacher(cls, editingUser.id) && cls.teacherId !== editingUser.id ? " (부담임)" : ""}</span>
                  <Input type="number" placeholder={formData.hourlyRate || "0"} value={editClassRates[cls.id] || ""} onChange={(e) => setEditClassRates(prev => ({ ...prev, [cls.id]: e.target.value }))} className="w-28" data-testid={`input-edit-class-rate-${cls.id}`} />
                  <span className="text-xs text-muted-foreground">원</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">시간표 기반으로 급여가 자동 계산됩니다</p>
        </div>
      )}

      {/* Salary settings for regular/part-time teachers in edit mode */}
      {(isEditingTeacher || formData.role === "2" || formData.role === "2c") && (formData.employmentType === "regular" || formData.employmentType === "part_time") && (
        <div className="space-y-4 border rounded-md p-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <Label className="font-semibold">급여 설정</Label>
          </div>
          {userCenters && userCenters.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="edit-salary-center">급여 설정 센터</Label>
              <Select
                value={selectedTeacherCenterId}
                onValueChange={setSelectedTeacherCenterId}
              >
                <SelectTrigger data-testid="select-salary-center">
                  <SelectValue placeholder="센터 선택" />
                </SelectTrigger>
                <SelectContent>
                  {userCenters.map((center) => (
                    <SelectItem key={center.id} value={center.id}>
                      {center.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                급여 설정은 센터별로 별도 관리됩니다
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">경영 탭 &gt; 재무에서도 수정 가능합니다</p>

          {formData.employmentType === "part_time" && (
            <div className="flex items-center gap-2">
              <Label className="text-sm w-16">급여유형</Label>
              <div className="flex rounded-md border overflow-hidden">
                <button
                  type="button"
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    formData.wageType !== "hourly"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setFormData((p) => ({ ...p, wageType: "monthly" }))}
                  data-testid="button-edit-pt-percentage"
                >
                  비율제
                </button>
                <button
                  type="button"
                  className={`px-4 py-1.5 text-sm font-medium transition-colors border-l ${
                    formData.wageType === "hourly"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setFormData((p) => ({ ...p, wageType: "hourly" }))}
                  data-testid="button-edit-pt-hourly"
                >
                  시급
                </button>
              </div>
            </div>
          )}

          {formData.employmentType === "part_time" && formData.wageType === "hourly" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm w-20">적용방식</Label>
                <div className="flex rounded-md border overflow-hidden">
                  <button type="button" className={`px-3 py-1.5 text-xs font-medium transition-colors ${editClassRateMode === "bulk" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`} onClick={() => setEditClassRateMode("bulk")} data-testid="button-edit-pt-rate-mode-bulk">일괄적용</button>
                  <button type="button" className={`px-3 py-1.5 text-xs font-medium transition-colors border-l ${editClassRateMode === "individual" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`} onClick={() => setEditClassRateMode("individual")} data-testid="button-edit-pt-rate-mode-individual">별도적용</button>
                </div>
              </div>
              {editClassRateMode === "bulk" ? (
                <div className="space-y-2">
                  <Label htmlFor="edit-pt-hourlyRate">시급 (원)</Label>
                  <Input id="edit-pt-hourlyRate" type="number" placeholder="예: 15000" value={formData.hourlyRate} onChange={(e) => setFormData((p) => ({ ...p, hourlyRate: e.target.value }))} data-testid="input-edit-pt-hourly-rate" />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label htmlFor="edit-pt-hourlyRate-default">기본 시급 (원)</Label>
                    <Input id="edit-pt-hourlyRate-default" type="number" placeholder="예: 15000" value={formData.hourlyRate} onChange={(e) => setFormData((p) => ({ ...p, hourlyRate: e.target.value }))} data-testid="input-edit-pt-default-hourly-rate" />
                    <p className="text-xs text-muted-foreground">별도 시급 미설정 수업에 적용</p>
                  </div>
                  {teacherClasses.length === 0 ? (
                    <p className="text-xs text-muted-foreground">배정된 수업이 없습니다</p>
                  ) : teacherClasses.map((cls: any) => (
                    <div key={cls.id} className="flex items-center gap-2">
                      <span className="text-sm w-36 truncate">{cls.name} {cls.subject}{isAssistantTeacher(cls, editingUser.id) && cls.teacherId !== editingUser.id ? " (부담임)" : ""}</span>
                      <Input type="number" placeholder={formData.hourlyRate || "0"} value={editClassRates[cls.id] || ""} onChange={(e) => setEditClassRates(prev => ({ ...prev, [cls.id]: e.target.value }))} className="w-28" data-testid={`input-edit-pt-class-rate-${cls.id}`} />
                      <span className="text-xs text-muted-foreground">원</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">시간표 기반으로 급여가 자동 계산됩니다</p>
            </div>
          ) : (
          <>
          <div className="space-y-2">
            <Label htmlFor="edit-base-salary">기본급 (월)</Label>
            <Input
              id="edit-base-salary"
              type="number"
              placeholder="예: 2000000"
              value={formData.baseSalary}
              onChange={(e) => setFormData((p) => ({ ...p, baseSalary: e.target.value === '' ? '' : String(parseInt(e.target.value) || 0) }))}
              data-testid="input-edit-base-salary"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-class-base-elementary">초등 수업당 기본급</Label>
              <Input
                id="edit-class-base-elementary"
                type="number"
                placeholder="예: 80000"
                value={formData.classBasePayElementary || ""}
                onChange={(e) => setFormData((p) => ({ ...p, classBasePayElementary: e.target.value === '' ? '' : String(parseInt(e.target.value) || 0) }))}
                data-testid="input-edit-class-base-elementary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-class-base-middle">중등 수업당 기본급</Label>
              <Input
                id="edit-class-base-middle"
                type="number"
                placeholder="예: 100000"
                value={formData.classBasePayMiddle || ""}
                onChange={(e) => setFormData((p) => ({ ...p, classBasePayMiddle: e.target.value === '' ? '' : String(parseInt(e.target.value) || 0) }))}
                data-testid="input-edit-class-base-middle"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-class-base-high">고등 수업당 기본급</Label>
              <Input
                id="edit-class-base-high"
                type="number"
                placeholder="예: 120000"
                value={formData.classBasePayHigh || ""}
                onChange={(e) => setFormData((p) => ({ ...p, classBasePayHigh: e.target.value === '' ? '' : String(parseInt(e.target.value) || 0) }))}
                data-testid="input-edit-class-base-high"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-threshold-elementary">초등 기준 인원</Label>
              <Input
                id="edit-threshold-elementary"
                type="number"
                placeholder="예: 6"
                value={formData.studentThresholdElementary || ""}
                onChange={(e) => setFormData((p) => ({ ...p, studentThresholdElementary: e.target.value === '' ? '' : String(parseInt(e.target.value) || 0) }))}
                data-testid="input-edit-threshold-elementary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-threshold-middle">중등 기준 인원</Label>
              <Input
                id="edit-threshold-middle"
                type="number"
                placeholder="예: 5"
                value={formData.studentThresholdMiddle || ""}
                onChange={(e) => setFormData((p) => ({ ...p, studentThresholdMiddle: e.target.value === '' ? '' : String(parseInt(e.target.value) || 0) }))}
                data-testid="input-edit-threshold-middle"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-threshold-high">고등 기준 인원</Label>
              <Input
                id="edit-threshold-high"
                type="number"
                placeholder="예: 4"
                value={formData.studentThresholdHigh || ""}
                onChange={(e) => setFormData((p) => ({ ...p, studentThresholdHigh: e.target.value === '' ? '' : String(parseInt(e.target.value) || 0) }))}
                data-testid="input-edit-threshold-high"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-bonus-elementary">초등 초과 추가금</Label>
              <Input
                id="edit-bonus-elementary"
                type="number"
                placeholder="예: 8000"
                value={formData.perStudentBonusElementary || ""}
                onChange={(e) => setFormData((p) => ({ ...p, perStudentBonusElementary: e.target.value === '' ? '' : String(parseInt(e.target.value) || 0) }))}
                data-testid="input-edit-bonus-elementary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bonus-middle">중등 초과 추가금</Label>
              <Input
                id="edit-bonus-middle"
                type="number"
                placeholder="예: 10000"
                value={formData.perStudentBonusMiddle || ""}
                onChange={(e) => setFormData((p) => ({ ...p, perStudentBonusMiddle: e.target.value === '' ? '' : String(parseInt(e.target.value) || 0) }))}
                data-testid="input-edit-bonus-middle"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bonus-high">고등 초과 추가금</Label>
              <Input
                id="edit-bonus-high"
                type="number"
                placeholder="예: 15000"
                value={formData.perStudentBonusHigh || ""}
                onChange={(e) => setFormData((p) => ({ ...p, perStudentBonusHigh: e.target.value === '' ? '' : String(parseInt(e.target.value) || 0) }))}
                data-testid="input-edit-bonus-high"
              />
            </div>
          </div>
          </>
          )}
        </div>
      )}

      {(isStudent || formData.role === "1") && (
        <>
          <div className="space-y-2">
            <Label htmlFor="edit-motherPhone">
              {(editingUser as any).parentId ? "학부모1 번호" : "학부모1 전화번호"}
            </Label>
            <Input
              id="edit-motherPhone"
              value={formData.motherPhone}
              onChange={(e) => setFormData((p) => ({ ...p, motherPhone: e.target.value }))}
              placeholder="010-1234-5678"
              disabled={(editingUser as any).parentId}
              className={(editingUser as any).parentId ? "bg-muted cursor-not-allowed" : ""}
              data-testid="input-edit-mother-phone"
            />
            {(editingUser as any).parentId && (
              <p className="text-xs text-muted-foreground">학부모 계정의 로그인 번호와 동일하여 수정할 수 없습니다</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-fatherPhone">
              {(editingUser as any).parentId ? "학부모2 번호" : "학부모2 전화번호"}
            </Label>
            <Input
              id="edit-fatherPhone"
              value={formData.fatherPhone}
              onChange={(e) => setFormData((p) => ({ ...p, fatherPhone: e.target.value }))}
              placeholder="010-1234-5678"
              data-testid="input-edit-father-phone"
            />
          </div>

          {(editingUser as any).parentId && (
            <div className="space-y-2">
              <Label htmlFor="edit-studentPhone">학생 번호</Label>
              <Input
                id="edit-studentPhone"
                value={formData.studentPhone}
                onChange={(e) => setFormData((p) => ({ ...p, studentPhone: e.target.value }))}
                placeholder="010-1234-5678"
                data-testid="input-edit-student-phone"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-school">학교</Label>
            <Input
              id="edit-school"
              value={formData.school}
              onChange={(e) => setFormData((p) => ({ ...p, school: e.target.value }))}
              placeholder="예: OO초등학교"
              data-testid="input-edit-school"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-grade">학년</Label>
            <Select
              value={formData.grade}
              onValueChange={(v) => setFormData((p) => ({ ...p, grade: v }))}
            >
              <SelectTrigger data-testid="select-edit-grade">
                <SelectValue placeholder="학년 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="초1">초등 1학년</SelectItem>
                <SelectItem value="초2">초등 2학년</SelectItem>
                <SelectItem value="초3">초등 3학년</SelectItem>
                <SelectItem value="초4">초등 4학년</SelectItem>
                <SelectItem value="초5">초등 5학년</SelectItem>
                <SelectItem value="초6">초등 6학년</SelectItem>
                <SelectItem value="중1">중학 1학년</SelectItem>
                <SelectItem value="중2">중학 2학년</SelectItem>
                <SelectItem value="중3">중학 3학년</SelectItem>
                <SelectItem value="고1">고등 1학년</SelectItem>
                <SelectItem value="고2">고등 2학년</SelectItem>
                <SelectItem value="고3">고등 3학년</SelectItem>
                <SelectItem value="성인">성인</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-attendancePin">출결번호 변경</Label>
            <Input
              id="edit-attendancePin"
              value={formData.attendancePin}
              onChange={(e) => setFormData((p) => ({ ...p, attendancePin: e.target.value }))}
              placeholder="변경할 경우에만 입력"
              maxLength={6}
              data-testid="input-edit-attendance-pin"
            />
          </div>

          {/* 수업 등록/관리 */}
          <div className="space-y-4 border rounded-md p-4 bg-muted/30">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <Label className="font-semibold">수업 등록</Label>
              <span className="text-xs text-muted-foreground">(선택사항)</span>
            </div>

            {existingEnrollments.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">현재 수강 중인 수업</Label>
                <div className="space-y-1 border rounded-md p-3 bg-background">
                  {existingEnrollments.map((enrollment) => {
                    const cls = editEnrollClasses.find(c => c.id === enrollment.classId);
                    const teacher = editEnrollTeachers.find(t => t.id === cls?.teacherId);
                    if (!cls) return null;
                    return (
                      <div key={enrollment.id} className="flex items-center gap-2 py-1 px-2">
                        <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <span className="text-sm">{cls.name} {cls.subject}반</span>
                        {teacher && <span className="text-xs text-muted-foreground">({teacher.name})</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              선생님을 선택하면 해당 선생님의 수업 목록이 표시됩니다
            </p>

            <div className="space-y-2">
              <Label>선생님 선택</Label>
              <Select
                value={editSelectedTeacherId}
                onValueChange={(v) => {
                  setEditSelectedTeacherId(v);
                }}
              >
                <SelectTrigger data-testid="select-edit-enroll-teacher">
                  <SelectValue placeholder="선생님을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {editEnrollTeachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editSelectedTeacherId && editTeacherClasses.length > 0 && (
              <div className="space-y-2">
                <Label>수업 선택 (복수 선택 가능)</Label>
                <div className="space-y-2 border rounded-md p-3 max-h-[200px] overflow-y-auto">
                  {editTeacherClasses.map((cls) => {
                    const alreadyEnrolled = existingClassIds.has(cls.id);
                    return (
                      <label
                        key={cls.id}
                        className={`flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded px-1 py-1 ${alreadyEnrolled ? 'opacity-50' : ''}`}
                      >
                        <Checkbox
                          checked={alreadyEnrolled || editSelectedClassIds.includes(cls.id)}
                          disabled={alreadyEnrolled}
                          onCheckedChange={(checked) => {
                            if (alreadyEnrolled) return;
                            setEditSelectedClassIds(prev =>
                              checked
                                ? [...prev, cls.id]
                                : prev.filter(id => id !== cls.id)
                            );
                          }}
                          data-testid={`checkbox-edit-enroll-class-${cls.id}`}
                        />
                        <span className="text-sm">{cls.name} {cls.subject}반</span>
                        {alreadyEnrolled && <span className="text-xs text-green-600 ml-1">수강 중</span>}
                        {cls.startTime && cls.endTime && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            {cls.startTime}~{cls.endTime}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {editSelectedTeacherId && editTeacherClasses.length === 0 && (
              <p className="text-xs text-muted-foreground">
                해당 선생님에게 등록된 수업이 없습니다
              </p>
            )}

            {editSelectedClassIds.length > 0 && (
              <div className="space-y-2">
                <Label className="text-primary font-medium">새로 추가할 수업 ({editSelectedClassIds.length}개)</Label>
                <div className="space-y-1 border rounded-md p-3 bg-primary/5">
                  {editSelectedClassIds.map((classId) => {
                    const cls = editEnrollClasses.find(c => c.id === classId);
                    const teacher = editEnrollTeachers.find(t => t.id === cls?.teacherId);
                    if (!cls) return null;
                    return (
                      <div
                        key={classId}
                        className="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-accent/50"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate">{cls.name} {cls.subject}반</span>
                          {teacher && (
                            <span className="text-xs text-muted-foreground shrink-0">({teacher.name})</span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => setEditSelectedClassIds(prev => prev.filter(id => id !== classId))}
                          data-testid={`button-edit-remove-class-${classId}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Consultation Image Upload */}
          <div className="space-y-4 border rounded-md p-4 bg-muted/30">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              <Label className="font-semibold">상담지</Label>
              <span className="text-xs text-muted-foreground">(선택사항)</span>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-consultationImage">상담지 이미지</Label>
              <input
                ref={consultationFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleConsultationImageUpload}
                className="hidden"
                id="consultation-image-input"
              />
              {formData.consultationImageUrl ? (
                <div className="space-y-2">
                  <div className="relative w-full max-w-xs">
                    <img
                      src={formData.consultationImageUrl}
                      alt="상담지"
                      className="w-full h-auto rounded-md border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => setFormData((p) => ({ ...p, consultationImageUrl: "" }))}
                      data-testid="button-remove-consultation-image"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => consultationFileInputRef.current?.click()}
                    disabled={isUploadingConsultation}
                    data-testid="button-change-consultation-image"
                  >
                    {isUploadingConsultation ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        업로드 중...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        이미지 변경
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => consultationFileInputRef.current?.click()}
                  disabled={isUploadingConsultation}
                  data-testid="button-upload-consultation-image"
                >
                  {isUploadingConsultation ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      상담지 이미지 업로드
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-consultationNotes">상담 내용</Label>
              <Textarea
                id="edit-consultationNotes"
                value={formData.consultationNotes}
                onChange={(e) => setFormData((p) => ({ ...p, consultationNotes: e.target.value }))}
                placeholder="상담 내용을 입력하세요..."
                rows={4}
                data-testid="textarea-consultation-notes"
              />
            </div>
          </div>
        </>
      )}

      {/* Teacher check-in settings for Admin/Principal editing a teacher */}
      {canEditTeacherSettings && userCenters && userCenters.length > 0 && (
        <div className="space-y-4 border rounded-md p-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            <Label className="font-semibold">출근 알림 설정</Label>
          </div>

          {/* Center selector for teachers with multiple centers */}
          {userCenters.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="edit-teacher-center">센터 선택</Label>
              <Select
                value={selectedTeacherCenterId}
                onValueChange={setSelectedTeacherCenterId}
              >
                <SelectTrigger data-testid="select-teacher-center">
                  <SelectValue placeholder="센터 선택" />
                </SelectTrigger>
                <SelectContent>
                  {userCenters.map((center) => (
                    <SelectItem key={center.id} value={center.id}>
                      {center.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                출근 설정은 센터별로 별도 관리됩니다
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="edit-teacher-checkin-code">출근코드 (4자리 숫자)</Label>
            <Input
              id="edit-teacher-checkin-code"
              value={teacherCheckInCode}
              onChange={(e) => setTeacherCheckInCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
              maxLength={4}
              data-testid="input-edit-teacher-checkin-code"
            />
            <p className="text-xs text-muted-foreground">
              출결패드에서 출근 시 입력하는 코드입니다
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-teacher-sms-1">담당 원장님 연락처 1</Label>
            <Input
              id="edit-teacher-sms-1"
              value={teacherSmsRecipient1}
              onChange={(e) => setTeacherSmsRecipient1(e.target.value)}
              placeholder="010-1234-5678"
              data-testid="input-edit-teacher-sms-1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-teacher-sms-2">담당 원장님 연락처 2 (선택사항)</Label>
            <Input
              id="edit-teacher-sms-2"
              value={teacherSmsRecipient2}
              onChange={(e) => setTeacherSmsRecipient2(e.target.value)}
              placeholder="010-1234-5678"
              data-testid="input-edit-teacher-sms-2"
            />
          </div>
          
          <p className="text-xs text-muted-foreground">
            선생님이 출근코드를 입력하면 위 연락처로 출근 알림이 전송됩니다
          </p>
        </div>
      )}

      {/* Admin can edit centers for all users; Principal/Teacher can edit centers for students only */}
      {((isAdmin || user?.role === UserRole.PRINCIPAL || user?.role === UserRole.TEACHER) && isStudent && centers.length > 0) && (
        <div className="space-y-2">
          <Label>소속 센터 (복수 선택 가능)</Label>
          <div className="space-y-2 border rounded-md p-3">
            {centers.map((center) => (
              <label
                key={center.id}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedCenterIds.includes(center.id)}
                  onChange={() => toggleCenter(center.id)}
                  className="h-4 w-4 rounded border-input"
                  data-testid={`checkbox-edit-center-${center.id}`}
                />
                <span className="text-sm">{center.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {/* Admin can also edit centers for non-students */}
      {(isAdmin && !isStudent && centers.length > 0) && (
        <div className="space-y-2">
          <Label>소속 센터 (복수 선택 가능)</Label>
          <div className="space-y-2 border rounded-md p-3">
            {centers.map((center) => (
              <label
                key={center.id}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedCenterIds.includes(center.id)}
                  onChange={() => toggleCenter(center.id)}
                  className="h-4 w-4 rounded border-input"
                  data-testid={`checkbox-edit-center-${center.id}`}
                />
                <span className="text-sm">{center.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={updateMutation.isPending || saveTeacherCheckInMutation.isPending} data-testid="button-save-user">
          {updateMutation.isPending || saveTeacherCheckInMutation.isPending ? "저장 중..." : "저장"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function VcfImportDialog({ centers, onClose }: { centers: Center[]; onClose: () => void }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [selectedCenter, setSelectedCenter] = useState<string>(centers[0]?.id || "");
  const [step, setStep] = useState<"upload" | "review" | "result">("upload");
  const [contacts, setContacts] = useState<Array<{ name: string; phone: string; role: string; grade: string; school: string; selected: boolean }>>([]);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [parsing, setParsing] = useState(false);

  const supportsContactPicker = typeof window !== "undefined" && "contacts" in navigator && "ContactsManager" in window;

  const handleContactPicker = async () => {
    try {
      const nav = navigator as any;
      const results = await nav.contacts.select(["name", "tel"], { multiple: true });
      if (!results || results.length === 0) {
        toast({ title: "연락처가 선택되지 않았습니다", variant: "destructive" });
        return;
      }
      const parsed = results
        .filter((r: any) => r.name?.length > 0 && r.tel?.length > 0)
        .map((r: any) => {
          const name = r.name[0] || "";
          let phone = (r.tel[0] || "").replace(/[^0-9]/g, "");
          if (phone.startsWith("82") && phone.length >= 10) phone = "0" + phone.substring(2);
          if (phone.length >= 9 && phone.length <= 11 && !phone.startsWith("0")) phone = "0" + phone;
          return { name, phone, role: "student", grade: "", school: "", selected: true };
        })
        .filter((c: any) => c.name && c.phone.length >= 10);
      if (parsed.length === 0) {
        toast({ title: "유효한 연락처가 없습니다", variant: "destructive" });
        return;
      }
      setContacts(parsed);
      setStep("review");
    } catch (error: any) {
      toast({ title: error.message || "연락처를 불러올 수 없습니다", variant: "destructive" });
    }
  };

  const handleParse = async () => {
    if (!file) {
      toast({ title: "VCF 파일을 선택해주세요", variant: "destructive" });
      return;
    }
    setParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/users/vcf-parse", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "파싱 실패");
      }
      const data = await res.json();
      if (data.contacts.length === 0) {
        toast({ title: "연락처를 찾을 수 없습니다. VCF 파일을 확인해주세요.", variant: "destructive" });
        return;
      }
      setContacts(data.contacts.map((c: any) => ({ ...c, role: "student", grade: "", school: "", selected: true })));
      setStep("review");
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const registerMutation = useMutation({
    mutationFn: async () => {
      const selected = contacts.filter(c => c.selected);
      const res = await fetch("/api/users/vcf-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: selected, centerIds: [selectedCenter] }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "등록 실패");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      setStep("result");
      invalidateQueriesStartingWith("/api/users");
      if (data.success > 0) {
        toast({ title: `${data.success}명이 등록되었습니다` });
      }
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const selectedCount = contacts.filter(c => c.selected).length;

  if (step === "result" && result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-8 w-8 text-green-500" />
          <div>
            <div className="text-lg font-bold">등록 완료</div>
            <div className="text-sm text-muted-foreground">
              성공: {result.success}명 / 실패: {result.failed}명
            </div>
          </div>
        </div>
        {result.errors.length > 0 && (
          <div className="max-h-[200px] overflow-y-auto space-y-1">
            {result.errors.map((err, i) => (
              <div key={i} className="text-xs text-destructive flex items-start gap-1">
                <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                {err}
              </div>
            ))}
          </div>
        )}
        <div className="text-xs text-muted-foreground">초기 비밀번호는 1234입니다.</div>
        <DialogFooter>
          <Button onClick={onClose} data-testid="button-vcf-done">확인</Button>
        </DialogFooter>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          {contacts.length}개 연락처 중 {selectedCount}개 선택됨
        </div>
        <div className="flex gap-2 mb-2">
          <Button size="sm" variant="outline" onClick={() => setContacts(prev => prev.map(c => ({ ...c, selected: true })))} data-testid="button-vcf-select-all">전체 선택</Button>
          <Button size="sm" variant="outline" onClick={() => setContacts(prev => prev.map(c => ({ ...c, selected: false })))} data-testid="button-vcf-deselect-all">전체 해제</Button>
        </div>
        <div className="max-h-[400px] overflow-y-auto space-y-2">
          {contacts.map((contact, idx) => (
            <div key={idx} className={`p-3 border rounded-lg space-y-2 ${!contact.selected ? "opacity-50" : ""}`} data-testid={`vcf-contact-${idx}`}>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={contact.selected}
                  onChange={() => setContacts(prev => prev.map((c, i) => i === idx ? { ...c, selected: !c.selected } : c))}
                  className="h-4 w-4"
                  data-testid={`vcf-checkbox-${idx}`}
                />
                <span className="font-medium text-sm">{contact.name}</span>
                <span className="text-xs text-muted-foreground">{contact.phone}</span>
              </div>
              {contact.selected && (
                <div className="flex gap-2 ml-6">
                  <Select value={contact.role} onValueChange={(v) => setContacts(prev => prev.map((c, i) => i === idx ? { ...c, role: v } : c))}>
                    <SelectTrigger className="w-24 h-8 text-xs" data-testid={`vcf-role-${idx}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">학생</SelectItem>
                      <SelectItem value="parent">학부모</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="학년 (예: 중2)"
                    value={contact.grade}
                    onChange={(e) => setContacts(prev => prev.map((c, i) => i === idx ? { ...c, grade: e.target.value } : c))}
                    className="w-24 h-8 text-xs"
                    data-testid={`vcf-grade-${idx}`}
                  />
                  <Input
                    placeholder="학교명"
                    value={contact.school}
                    onChange={(e) => setContacts(prev => prev.map((c, i) => i === idx ? { ...c, school: e.target.value } : c))}
                    className="flex-1 h-8 text-xs"
                    data-testid={`vcf-school-${idx}`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { setStep("upload"); setContacts([]); }} data-testid="button-vcf-back">뒤로</Button>
          <Button
            onClick={() => registerMutation.mutate()}
            disabled={selectedCount === 0 || registerMutation.isPending}
            data-testid="button-vcf-register"
          >
            {registerMutation.isPending ? "등록 중..." : `${selectedCount}명 등록`}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>센터 선택</Label>
        <Select value={selectedCenter} onValueChange={setSelectedCenter}>
          <SelectTrigger data-testid="vcf-select-center">
            <SelectValue placeholder="센터 선택" />
          </SelectTrigger>
          <SelectContent>
            {centers.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {supportsContactPicker && (
        <div className="space-y-2">
          <Button
            className="w-full h-14 text-base"
            onClick={handleContactPicker}
            disabled={!selectedCenter}
            data-testid="button-contact-picker"
          >
            <Phone className="h-5 w-5 mr-2" />
            전화번호부에서 선택
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            전화번호부가 열리면 등록할 연락처를 선택하세요
          </p>
        </div>
      )}

      <div className="space-y-2">
        {supportsContactPicker && (
          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">또는 파일로 가져오기</span></div>
          </div>
        )}
        <Label>연락처 파일 (.vcf)</Label>
        <Input
          type="file"
          accept=".vcf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          data-testid="input-vcf-file"
        />
        {!supportsContactPicker && (
          <p className="text-xs text-muted-foreground">
            핸드폰 연락처 앱에서 연락처를 선택 → 공유 → 파일로 저장하면 .vcf 파일이 생성됩니다.
          </p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>취소</Button>
        <Button onClick={handleParse} disabled={!file || !selectedCenter || parsing} data-testid="button-vcf-parse">
          {parsing ? "분석 중..." : "파일에서 불러오기"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function BulkUploadDialog({ centers, onClose }: { centers: Center[]; onClose: () => void }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [selectedCenter, setSelectedCenter] = useState<string>(centers[0]?.id || "");
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/users/bulk-upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "업로드 실패");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      invalidateQueriesStartingWith("/api/users");
      if (data.success > 0) {
        toast({ title: `${data.success}명의 학생이 등록되었습니다` });
      }
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast({ title: "엑셀 파일을 선택해주세요", variant: "destructive" });
      return;
    }
    if (!selectedCenter) {
      toast({ title: "센터가 선택되지 않았습니다", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("centerIds", JSON.stringify([selectedCenter]));
    uploadMutation.mutate(formData);
  };

  const downloadTemplate = () => {
    const headers = ["이름", "학생 핸드폰번호(아이디)", "학부모1 전화번호", "학부모2 전화번호(선택)", "학교", "학년"];
    const sampleData = ["(예시삭제)홍길동", "010-5555-5555", "010-1234-5678", "010-8765-4321", "서울초등학교", "초6"];
    const csv = [headers.join(","), sampleData.join(",")].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "학생등록_양식.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-md bg-muted">
          {result.success > 0 ? (
            <CheckCircle className="h-8 w-8 text-green-600" />
          ) : (
            <XCircle className="h-8 w-8 text-destructive" />
          )}
          <div>
            <p className="font-medium">업로드 완료</p>
            <p className="text-sm text-muted-foreground">
              성공: {result.success}명 / 실패: {result.failed}명
            </p>
          </div>
        </div>
        {result.errors.length > 0 && (
          <div className="max-h-40 overflow-auto p-3 rounded-md bg-destructive/10 text-sm space-y-1">
            {result.errors.map((error, i) => (
              <p key={i} className="text-destructive">{error}</p>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>닫기</Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
        <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-sm font-medium">엑셀 파일 양식</p>
          <p className="text-xs text-muted-foreground">
            열: 이름, 학생 핸드폰번호(아이디), 학부모1 전화번호, 학부모2 전화번호(선택), 학교, 학년
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-1" />
          양식
        </Button>
      </div>

      <div className="space-y-2">
        <Label>엑셀 파일 선택</Label>
        <Input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          data-testid="input-bulk-file"
        />
        {file && (
          <p className="text-xs text-muted-foreground">{file.name}</p>
        )}
      </div>

      <div className="p-3 rounded-md bg-muted/50">
        <p className="text-sm">
          <span className="font-medium">등록 센터:</span> {centers[0]?.name || "선택된 센터 없음"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          학생들은 현재 선택된 센터에 자동으로 등록됩니다
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        기본 비밀번호: 1234
      </p>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>취소</Button>
        <Button type="submit" disabled={uploadMutation.isPending}>
          {uploadMutation.isPending ? "업로드 중..." : "업로드"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ParentBulkUploadDialog({ centers, onClose }: { centers: Center[]; onClose: () => void }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [selectedCenter, setSelectedCenter] = useState<string>(centers[0]?.id || "");
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/users/parent-bulk-upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "업로드 실패");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      invalidateQueriesStartingWith("/api/users");
      if (data.success > 0) {
        toast({ title: `${data.success}개의 학부모 계정이 등록되었습니다` });
      }
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast({ title: "엑셀 파일을 선택해주세요", variant: "destructive" });
      return;
    }
    if (!selectedCenter) {
      toast({ title: "센터가 선택되지 않았습니다", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("centerIds", JSON.stringify([selectedCenter]));
    uploadMutation.mutate(formData);
  };

  const downloadTemplate = () => {
    const headers = ["원생이름", "학부모 휴대폰번호", "학교", "학년", "출결번호"];
    // Use ="value" format to force Excel to treat phone number as text (preserves leading 0)
    const sampleData = ["(예시삭제)홍길동", "=\"01012345678\"", "서울초등학교", "초6", "5678"];
    const csv = [headers.join(","), sampleData.join(",")].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "학부모등록_양식.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-md bg-muted">
          {result.success > 0 ? (
            <CheckCircle className="h-8 w-8 text-green-600" />
          ) : (
            <XCircle className="h-8 w-8 text-destructive" />
          )}
          <div>
            <p className="font-medium">업로드 완료</p>
            <p className="text-sm text-muted-foreground">
              성공: {result.success}개 / 실패: {result.failed}개
            </p>
          </div>
        </div>
        {result.errors.length > 0 && (
          <div className="max-h-40 overflow-auto p-3 rounded-md bg-destructive/10 text-sm space-y-1">
            {result.errors.map((error, i) => (
              <p key={i} className="text-destructive">{error}</p>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>닫기</Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
        <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-sm font-medium">엑셀 파일 양식</p>
          <p className="text-xs text-muted-foreground">
            열: 원생이름, 학부모 휴대폰번호(계정 아이디), 학교, 학년, 출결번호(뒷4자리)
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-1" />
          양식
        </Button>
      </div>

      <div className="space-y-2">
        <Label>엑셀 파일 선택</Label>
        <Input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          data-testid="input-parent-bulk-file"
        />
        {file && (
          <p className="text-xs text-muted-foreground">{file.name}</p>
        )}
      </div>

      {centers.length > 1 && (
        <div className="space-y-2">
          <Label>등록 센터 선택</Label>
          <Select value={selectedCenter} onValueChange={setSelectedCenter}>
            <SelectTrigger data-testid="select-parent-bulk-center">
              <SelectValue placeholder="센터를 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              {centers.map((center) => (
                <SelectItem key={center.id} value={center.id}>
                  {center.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {centers.length === 1 && (
        <div className="p-3 rounded-md bg-muted/50">
          <p className="text-sm">
            <span className="font-medium">등록 센터:</span> {centers[0]?.name || "선택된 센터 없음"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            학부모와 자녀는 현재 선택된 센터에 자동으로 등록됩니다
          </p>
        </div>
      )}

      <div className="p-3 rounded-md bg-muted/50 border text-sm space-y-1">
        <p className="font-medium">학부모 계정 등록 안내</p>
        <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
          <li>학부모 휴대폰번호가 로그인 아이디로 사용됩니다</li>
          <li>기본 비밀번호: 1234</li>
          <li>학부모 계정과 자녀(학생) 계정이 동시에 생성됩니다</li>
          <li>출결번호는 키오스크 출석체크에 사용됩니다</li>
        </ul>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>취소</Button>
        <Button type="submit" disabled={uploadMutation.isPending}>
          {uploadMutation.isPending ? "업로드 중..." : "업로드"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function UserDetailsPanel({ userItem, onEdit, onDelete, onReinstate, allTeachers }: { userItem: User; onEdit: () => void; onDelete: () => void; onReinstate?: () => void; allTeachers?: User[] }) {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();

  const isAdmin = user?.role === UserRole.ADMIN;
  const isPrincipal = user?.role === UserRole.PRINCIPAL;
  const isTeacher = user?.role === UserRole.TEACHER;
  const isStudent = userItem.role === UserRole.STUDENT;
  const isParentAccount = userItem.role === UserRole.PARENT || userItem.accountType === "parent";

  const { data: userCenters } = useQuery<Center[]>({
    queryKey: ["/api/users", userItem.id, "centers"],
  });
  
  // 학부모 계정의 자녀 목록
  const { data: childrenData = [], refetch: refetchChildren } = useQuery<{ child: User; enrollments: any[]; hasPassword: boolean }[]>({
    queryKey: [`/api/parents/${userItem.id}/children?actorId=${user?.id}`],
    enabled: isParentAccount && !!user?.id,
  });
  const children = childrenData.map(c => c.child);
  

  const { data: enrolledClasses } = useQuery<any[]>({
    queryKey: ["/api/students", userItem.id, "classes"],
    enabled: userItem.role === UserRole.STUDENT,
  });

  const { data: attendancePin } = useQuery<{ pin: string } | null>({
    queryKey: [`/api/students/${userItem.id}/attendance-pin/${selectedCenter?.id}`],
    enabled: userItem.role === UserRole.STUDENT && !!selectedCenter?.id,
  });

  // Get homeroom teacher name
  const homeroomTeacher = allTeachers?.find(t => t.id === userItem.homeroomTeacherId);
  const isMyStudent = userItem.homeroomTeacherId === user?.id;

  // Mutation for admin/principal to assign homeroom teacher
  const assignHomeroomMutation = useMutation({
    mutationFn: async (teacherId: string | null) => {
      const res = await apiRequest("PATCH", `/api/users/${userItem.id}/homeroom-teacher`, {
        actorId: user?.id,
        teacherId,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/users");
      toast({ title: "담임 선생님이 지정되었습니다" });
    },
    onError: () => {
      toast({ title: "담임 선생님 지정에 실패했습니다", variant: "destructive" });
    },
  });

  // Mutation for teacher to claim student
  const claimStudentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/homeroom/claim", {
        teacherId: user?.id,
        studentId: userItem.id,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/users");
      invalidateQueriesStartingWith("/api/teachers");
      toast({ title: "내 학생으로 지정되었습니다" });
    },
    onError: () => {
      toast({ title: "지정에 실패했습니다", variant: "destructive" });
    },
  });

  // Mutation for teacher to unclaim student
  const unclaimStudentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/homeroom/unclaim", {
        teacherId: user?.id,
        studentId: userItem.id,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/users");
      invalidateQueriesStartingWith("/api/teachers");
      toast({ title: "내 학생 해제되었습니다" });
    },
    onError: () => {
      toast({ title: "해제에 실패했습니다", variant: "destructive" });
    },
  });

  // Mutation for admin/principal to reset password
  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/users/${userItem.id}/reset-password`, {
        actorId: user?.id,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "비밀번호가 1234로 초기화되었습니다" });
    },
    onError: () => {
      toast({ title: "비밀번호 초기화에 실패했습니다", variant: "destructive" });
    },
  });

  const handleResetPassword = () => {
    if (confirm(`${userItem.name}의 비밀번호를 1234로 초기화하시겠습니까?`)) {
      resetPasswordMutation.mutate();
    }
  };

  const deleteEnrollmentMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      await apiRequest("DELETE", `/api/enrollments/${enrollmentId}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students", userItem.id, "classes"] });
      toast({ title: "수업에서 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const handleDeleteEnrollment = (enrollmentId: string, className: string) => {
    if (confirm(`${userItem.name} 학생을 "${className}" 수업에서 삭제하시겠습니까?`)) {
      deleteEnrollmentMutation.mutate(enrollmentId);
    }
  };

  const canDeleteEnrollment = isAdmin || isPrincipal || isTeacher;
  
  // 자녀 연결 해제 mutation
  const unlinkChildMutation = useMutation({
    mutationFn: async (studentId: string) => {
      await apiRequest("DELETE", `/api/parents/${userItem.id}/children/${studentId}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      // Force refetch children list immediately
      refetchChildren();
      invalidateQueriesStartingWith("/api/parents");
      invalidateQueriesStartingWith("/api/users");
      toast({ title: "자녀 연결이 해제되었습니다" });
    },
    onError: () => {
      toast({ title: "연결 해제에 실패했습니다", variant: "destructive" });
    },
  });
  

  return (
    <div className="mt-2 overflow-hidden rounded-lg border bg-gradient-to-br from-background to-muted/30">
      <div className="p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Phone className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">연락처</p>
                <p className="font-medium">
                  {/* 학부모 자녀인 경우 자동생성된 username 대신 전화번호나 "-" 표시 */}
                  {userItem.parentId && userItem.role === UserRole.STUDENT
                    ? (userItem.phone || "-")
                    : (userItem.phone || userItem.username)
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">가입일</p>
                <p className="font-medium">
                  {userItem.createdAt ? format(new Date(userItem.createdAt), "yyyy년 M월 d일", { locale: ko }) : "-"}
                </p>
              </div>
            </div>

            {userItem.role === UserRole.STUDENT && (userItem.motherPhone || userItem.fatherPhone) && (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">학부모 연락처</p>
                  <div className="space-y-1">
                    {userItem.motherPhone && (
                      <p className="font-medium text-sm">학부모1: {userItem.motherPhone}</p>
                    )}
                    {userItem.fatherPhone && (
                      <p className="font-medium text-sm">학부모2: {userItem.fatherPhone}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {userItem.role === UserRole.STUDENT && (userItem.school || userItem.grade) && (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <School className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">학교/학년</p>
                  <p className="font-medium">
                    {userItem.school || "-"} {userItem.grade && `(${userItem.grade})`}
                  </p>
                </div>
              </div>
            )}

            {userItem.role === UserRole.STUDENT && (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <KeyRound className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">출결번호</p>
                  <p className="font-medium">
                    {attendancePin?.pin || <span className="text-muted-foreground">미등록</span>}
                  </p>
                </div>
              </div>
            )}
            
            {/* 학부모 계정: 자녀 목록 */}
            {isParentAccount && (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">연결된 자녀</p>
                  {children.length > 0 ? (
                    <div className="space-y-2 mt-1">
                      {children.map(child => (
                        <div key={child.id} className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded">
                          <div>
                            <span className="font-medium">{child.name}</span>
                            {child.grade && <span className="text-sm text-muted-foreground ml-2">({child.grade})</span>}
                          </div>
                          {(isAdmin || isPrincipal) && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                if (confirm(`${child.name} 학생의 연결을 해제하시겠습니까?`)) {
                                  unlinkChildMutation.mutate(child.id);
                                }
                              }}
                              disabled={unlinkChildMutation.isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">연결된 자녀가 없습니다</p>
                  )}
                  
                  {/* 새 자녀 등록 (전화번호 없이 이름만으로) */}
                  {(isAdmin || isPrincipal) && (
                    <div className="mt-3">
                      <NewChildForm 
                        parentId={userItem.id} 
                        centerId={selectedCenter?.id || ""} 
                        actorId={user?.id || ""}
                        onSuccess={() => {
                          invalidateQueriesStartingWith("/api/parents");
                          invalidateQueriesStartingWith("/api/users");
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {isStudent && (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <GraduationCap className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">담임 선생님</p>
                  {(isAdmin || isPrincipal) && allTeachers && allTeachers.length > 0 ? (
                    <Select
                      value={userItem.homeroomTeacherId || "none"}
                      onValueChange={(value) => assignHomeroomMutation.mutate(value === "none" ? null : value)}
                      disabled={assignHomeroomMutation.isPending}
                    >
                      <SelectTrigger className="h-8 mt-1" data-testid={`select-homeroom-${userItem.id}`}>
                        <SelectValue placeholder="담임 선생님 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">미지정</SelectItem>
                        {allTeachers.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : isTeacher ? (
                    <div className="flex items-center gap-2 mt-1">
                      <p className="font-medium">
                        {homeroomTeacher ? homeroomTeacher.name : <span className="text-muted-foreground">미지정</span>}
                      </p>
                      {isMyStudent ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unclaimStudentMutation.mutate()}
                          disabled={unclaimStudentMutation.isPending}
                          data-testid={`button-unclaim-${userItem.id}`}
                        >
                          {unclaimStudentMutation.isPending ? "해제 중..." : "내 학생 해제"}
                        </Button>
                      ) : !userItem.homeroomTeacherId ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => claimStudentMutation.mutate()}
                          disabled={claimStudentMutation.isPending}
                          data-testid={`button-claim-${userItem.id}`}
                        >
                          {claimStudentMutation.isPending ? "지정 중..." : "내 학생 지정"}
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="font-medium">
                      {homeroomTeacher ? homeroomTeacher.name : <span className="text-muted-foreground">미지정</span>}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">소속 센터</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {userCenters?.length ? (
                    userCenters.map((center) => (
                      <Badge key={center.id} variant="secondary">
                        {center.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {userItem.role === UserRole.STUDENT && enrolledClasses && enrolledClasses.length > 0 && (
          <div className="pt-3 border-t">
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">수강 중인 수업</span>
              <Badge variant="outline">{enrolledClasses.length}개</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {enrolledClasses.map((cls: any) => (
                <div
                  key={cls.id}
                  className={`flex items-center gap-3 p-3 rounded-md bg-background border ${
                    canDeleteEnrollment && cls.enrollmentId 
                      ? "cursor-pointer hover-elevate active-elevate-2" 
                      : ""
                  }`}
                  onClick={() => {
                    if (canDeleteEnrollment && cls.enrollmentId) {
                      handleDeleteEnrollment(cls.enrollmentId, cls.name);
                    }
                  }}
                  data-testid={`card-enrollment-${cls.id}`}
                >
                  <div
                    className="w-2 h-8 rounded-full"
                    style={{ backgroundColor: cls.color || "#3B82F6" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{cls.name} ({cls.subject})</p>
                    <p className="text-xs text-muted-foreground">
                      {cls.teacher?.name || "선생님 미배정"} · {cls.center?.name || ""}
                    </p>
                  </div>
                  {canDeleteEnrollment && cls.enrollmentId && (
                    <X className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {userItem.id !== user?.id && (
          <div className="flex flex-wrap gap-2 pt-3 border-t">
            <Button variant="outline" size="sm" onClick={onEdit} data-testid={`button-edit-${userItem.id}`}>
              <Pencil className="h-4 w-4 mr-1" />
              수정
            </Button>
            {(isAdmin || isPrincipal) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetPassword}
                disabled={resetPasswordMutation.isPending}
                data-testid={`button-reset-password-${userItem.id}`}
              >
                <KeyRound className="h-4 w-4 mr-1" />
                {resetPasswordMutation.isPending ? "초기화 중..." : "비밀번호 초기화"}
              </Button>
            )}
            {userItem.withdrawnAt && onReinstate && (
              <Button
                variant="outline"
                size="sm"
                className="text-emerald-600 dark:text-emerald-400"
                onClick={onReinstate}
                data-testid={`button-reinstate-${userItem.id}`}
              >
                <Users className="h-4 w-4 mr-1" />
                재원 처리
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={onDelete}
              data-testid={`button-delete-${userItem.id}`}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {userItem.withdrawnAt ? "완전 삭제" : "삭제"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}


export default function UsersPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isVcfOpen, setIsVcfOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [studentStatusFilter, setStudentStatusFilter] = useState<"active" | "withdrawn">("active");
  const [nonEnrolledTab, setNonEnrolledTab] = useState<"unregistered" | "withdrawn">("unregistered");
  const [viewingConsultation, setViewingConsultation] = useState<NewConsultation | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "grade">("name");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [studentToExit, setStudentToExit] = useState<User | null>(null);
  const [isExitProcessing, setIsExitProcessing] = useState(false);
  const [accountTypeMode, setAccountTypeMode] = useState<"student" | "parent">("student");
  const [mainViewTab, setMainViewTab] = useState<"users" | "enrollment">("users");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");

  const parseGradeToNumber = (grade: string | null): number => {
    if (!grade) return 999;
    const gradeMap: Record<string, number> = {
      "초1": 1, "초2": 2, "초3": 3, "초4": 4, "초5": 5, "초6": 6,
      "중1": 7, "중2": 8, "중3": 9,
      "고1": 10, "고2": 11, "고3": 12,
      "성인": 13,
    };
    return gradeMap[grade] ?? 999;
  };

  const isAdmin = user?.role === UserRole.ADMIN;
  const isPrincipal = user?.role === UserRole.PRINCIPAL;
  const isTeacher = user?.role === UserRole.TEACHER;

  const { data: centers } = useQuery<Center[]>({
    queryKey: [`/api/centers`],
    enabled: isAdmin,
  });

  const { data: teacherCenters } = useQuery<Center[]>({
    queryKey: [`/api/users/${user?.id}/centers`],
    enabled: isTeacher && !!user?.id,
  });

  // Check if clinic feature is enabled for the selected center
  const { data: centerFeatures = [] } = useQuery<CenterFeature[]>({
    queryKey: [`/api/center-features/${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id,
  });
  
  const { data: features = [] } = useQuery<Feature[]>({
    queryKey: ["/api/features"],
  });
  
  const isClinicEnabled = features.some(f => 
    f.menuKey === "clinic" && 
    centerFeatures.some(cf => cf.featureId === f.id && !cf.isHidden)
  );

  const usersQueryKey = selectedCenter?.id 
    ? `/api/users?centerId=${selectedCenter.id}&includeWithdrawn=true` 
    : `/api/users?includeWithdrawn=true`;
  
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: [usersQueryKey],
    enabled: (!!selectedCenter?.id || isAdmin) && !isTeacher,
  });

  const { data: teacherStudents, isLoading: loadingTeacherStudents } = useQuery<User[]>({
    queryKey: [`/api/teachers/${user?.id}/students`],
    enabled: isTeacher && !!user?.id,
  });

  // 센터에 학생 계정 또는 학부모 계정이 이미 등록되어 있는지 확인
  // 학생 계정: role이 STUDENT이고 parentId가 없는 경우 (학부모의 자녀가 아닌 독립 학생 계정)
  // 기존 학생들은 account_type이 없을 수 있으므로 role과 parentId로 판단
  const hasStudentAccounts = useMemo(() => {
    if (!users) return false;
    return users.some(u => u.role === UserRole.STUDENT && !u.parentId);
  }, [users]);
  
  // 학부모 계정: role이 PARENT인 경우
  const hasParentAccounts = useMemo(() => {
    if (!users) return false;
    return users.some(u => u.role === UserRole.PARENT);
  }, [users]);

  // 학부모 계정이 있으면 학부모 모드로, 학생 계정이 있으면 학생 모드로 자동 설정
  useEffect(() => {
    if (hasParentAccounts && !hasStudentAccounts) {
      setAccountTypeMode("parent");
    } else if (hasStudentAccounts && !hasParentAccounts) {
      setAccountTypeMode("student");
    }
  }, [hasStudentAccounts, hasParentAccounts]);
  
  // 계정 유형 변경 시 경고 표시
  const handleAccountTypeModeChange = (newMode: "student" | "parent") => {
    if (newMode === "parent" && hasStudentAccounts) {
      toast({
        title: "계정 유형 변경 불가",
        description: "이미 학생 계정이 등록되어 있어 학부모 계정 모드로 변경할 수 없습니다.",
        variant: "destructive"
      });
      return;
    }
    if (newMode === "student" && hasParentAccounts) {
      toast({
        title: "계정 유형 변경 불가",
        description: "이미 학부모 계정이 등록되어 있어 학생 계정 모드로 변경할 수 없습니다.",
        variant: "destructive"
      });
      return;
    }
    setAccountTypeMode(newMode);
  };

  // Get all teachers for homeroom assignment dropdown (all roles need this to display homeroom teacher name)
  const { data: allTeachers = [] } = useQuery<User[]>({
    queryKey: [`/api/teachers?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id,
    select: (data) => data.filter(t => t.role === UserRole.TEACHER),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/users");
      invalidateQueriesStartingWith("/api/teachers");
      invalidateQueriesStartingWith("/api/management");
      setExpandedUserId(null);
      setStudentToExit(null);
      setIsExitProcessing(false);
      toast({ title: "계정이 삭제되었습니다" });
    },
    onError: (error: any) => {
      const serverMessage = error instanceof ApiError ? error.serverMessage : null;
      toast({ title: serverMessage || "삭제에 실패했습니다", variant: "destructive" });
      setIsExitProcessing(false);
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/users/${id}/withdraw`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/users");
      invalidateQueriesStartingWith("/api/teachers");
      invalidateQueriesStartingWith("/api/management");
      invalidateQueriesStartingWith("/api/classes");
      setExpandedUserId(null);
      setStudentToExit(null);
      setIsExitProcessing(false);
      toast({ title: "퇴원 처리되었습니다", description: "퇴원생 데이터는 1년간 보관 후 완전히 삭제됩니다." });
    },
    onError: (error: any) => {
      const serverMessage = error instanceof ApiError ? error.serverMessage : null;
      toast({ title: serverMessage || "퇴원 처리에 실패했습니다", variant: "destructive" });
      setIsExitProcessing(false);
    },
  });

  const reinstateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/users/${id}/reinstate`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/users");
      invalidateQueriesStartingWith("/api/teachers");
      invalidateQueriesStartingWith("/api/management");
      invalidateQueriesStartingWith("/api/classes");
      setExpandedUserId(null);
      toast({ title: "재원 처리되었습니다", description: "학생의 기존 데이터와 수강 정보가 복구되었습니다." });
    },
    onError: (error: any) => {
      const serverMessage = error instanceof ApiError ? error.serverMessage : null;
      toast({ title: serverMessage || "재원 처리에 실패했습니다", variant: "destructive" });
    },
  });

  const displayUsers = isTeacher ? teacherStudents : users;
  const isLoadingUsers = isTeacher ? loadingTeacherStudents : isLoading;

  const normalizeSchoolName = (school: string | null): string => {
    if (!school) return "";
    let name = school.trim();
    name = name.replace(/(초등학교|초등)$/, "초");
    name = name.replace(/(중학교|중등학교|중등)$/, "중");
    name = name.replace(/(고등학교|고교)$/, "고");
    return name;
  };

  const isStudentTab = roleFilter === "1" || isTeacher;

  const studentUsers = (displayUsers ?? []).filter(u => isTeacher ? true : u.role === UserRole.STUDENT);

  const schoolOptions = (() => {
    const schoolMap = new Map<string, string>();
    studentUsers.forEach(u => {
      if (u.school) {
        const normalized = normalizeSchoolName(u.school);
        if (normalized && !schoolMap.has(normalized)) {
          schoolMap.set(normalized, normalized);
        }
      }
    });
    return Array.from(schoolMap.keys()).sort((a, b) => a.localeCompare(b, "ko"));
  })();

  const gradeFilterOptions = (() => {
    // 학년 표기 통합: "중학교 2학년" → "중2", "초등학교 6학년" → "초6" 등
    const grades = new Set<string>();
    studentUsers.forEach(u => {
      const normalized = normalizeGrade(u.grade);
      if (normalized) grades.add(normalized);
    });
    const gradeOrder: Record<string, number> = {
      "초1": 1, "초2": 2, "초3": 3, "초4": 4, "초5": 5, "초6": 6,
      "중1": 7, "중2": 8, "중3": 9,
      "고1": 10, "고2": 11, "고3": 12,
      "성인": 13,
    };
    return Array.from(grades).sort((a, b) => (gradeOrder[a] ?? 99) - (gradeOrder[b] ?? 99));
  })();

  const isNonEnrolledView = isStudentTab && !isTeacher && studentStatusFilter === "withdrawn";
  const isUnregisteredView = isNonEnrolledView && nonEnrolledTab === "unregistered";

  const { data: consultationsList = [], isLoading: isLoadingConsultations } = useQuery<NewConsultation[]>({
    queryKey: ["/api/new-consultations", selectedCenter?.id],
    queryFn: async () => {
      const res = await fetch(`/api/new-consultations?centerId=${selectedCenter!.id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedCenter?.id && isStudentTab && !isTeacher,
  });

  const [registeringConsultation, setRegisteringConsultation] = useState<NewConsultation | null>(null);
  const [regTeacherId, setRegTeacherId] = useState<string>("all");
  const [regClassId, setRegClassId] = useState<string>("");

  const { data: registerClasses = [] } = useQuery<Class[]>({
    queryKey: [`/api/classes?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id && !!registeringConsultation,
  });

  const regTeacherOptions = useMemo(() => {
    return (users ?? []).filter((u) => u.role === UserRole.TEACHER || u.role === UserRole.PRINCIPAL);
  }, [users]);

  const regFilteredClasses = useMemo(() => {
    if (regTeacherId === "all") return registerClasses;
    return registerClasses.filter(
      (cls) =>
        cls.teacherId === regTeacherId ||
        (Array.isArray(cls.assistantTeacherIds) && cls.assistantTeacherIds.includes(regTeacherId))
    );
  }, [registerClasses, regTeacherId]);

  const closeRegisterDialog = () => {
    setRegisteringConsultation(null);
    setRegTeacherId("all");
    setRegClassId("");
  };

  const registerStudentMutation = useMutation({
    mutationFn: async ({ consultation, classId }: { consultation: NewConsultation; classId: string | null }) => {
      const studentPhone = consultation.studentPhone || null;
      const parentPhone = consultation.parentPhone || null;
      const basePayload = {
        password: "1234",
        name: consultation.studentName,
        motherPhone: parentPhone,
        school: consultation.school || null,
        grade: consultation.grade || null,
        role: UserRole.STUDENT,
        accountType: "student",
        centerIds: selectedCenter?.id ? [selectedCenter.id] : [],
      };
      const primaryPhone = studentPhone || parentPhone;
      let res;
      try {
        res = await apiRequest("POST", "/api/users", {
          ...basePayload,
          username: (primaryPhone || "").replace(/\D/g, ""),
          phone: primaryPhone,
        });
      } catch (e: any) {
        // 학생 본인 번호가 없어 학부모 번호로 시도했다가 이미 등록된 번호로 실패한 경우:
        // 전화번호 없이 고유 아이디로 재시도 (학부모 번호는 motherPhone으로 보존)
        const isDup = typeof e?.message === "string" && e.message.includes("이미 등록된 전화번호");
        if (isDup && !studentPhone && parentPhone) {
          res = await apiRequest("POST", "/api/users", {
            ...basePayload,
            username: `${consultation.studentName.replace(/\s/g, "")}-${consultation.id.slice(0, 8)}`,
            phone: null,
          });
        } else {
          throw e;
        }
      }
      const newUser = await res.json();
      if (classId) {
        try {
          await apiRequest("POST", "/api/enrollments", { studentId: newUser.id, classId });
        } catch (e: any) {
          return { newUser, enrollError: e?.message || "수업 등록에 실패했습니다" };
        }
      }
      return { newUser, enrollError: null };
    },
    onSuccess: (result, vars) => {
      invalidateQueriesStartingWith("/api/users");
      invalidateQueriesStartingWith("/api/enrollments");
      invalidateQueriesStartingWith("/api/classes");
      if (result.enrollError) {
        toast({
          title: "재원생으로 등록되었습니다",
          description: `수업 등록은 실패했습니다: ${result.enrollError}. 수업은 나중에 추가해주세요.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "재원생으로 등록되었습니다",
          description: vars.classId ? "선택한 수업에도 등록되었습니다." : "수업은 나중에 등록할 수 있습니다.",
        });
      }
      closeRegisterDialog();
    },
    onError: (error: any) => {
      toast({
        title: "등록 실패",
        description: error?.message || "재원생 등록 중 오류가 발생했습니다",
        variant: "destructive",
      });
    },
  });

  const handleRegisterStudent = (classId: string | null) => {
    if (!registeringConsultation) return;
    const phone = registeringConsultation.studentPhone || registeringConsultation.parentPhone;
    if (!phone) {
      toast({
        title: "전화번호가 없습니다",
        description: "상담 기록에 학생 또는 학부모 전화번호가 있어야 등록할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }
    registerStudentMutation.mutate({ consultation: registeringConsultation, classId });
  };

  const [smsConsultation, setSmsConsultation] = useState<NewConsultation | null>(null);
  const [smsMessage, setSmsMessage] = useState("");

  const sendSmsMutation = useMutation({
    mutationFn: async ({ phone, message }: { phone: string; message: string }) => {
      const res = await apiRequest("POST", "/api/sms/direct-bulk-send", {
        phones: [phone],
        message,
        centerName: selectedCenter?.name,
        centerId: selectedCenter?.id,
        actorId: user?.id,
      });
      return res.json();
    },
    onSuccess: (result) => {
      if (result.successCount > 0) {
        toast({ title: "문자가 전송되었습니다" });
        setSmsConsultation(null);
        setSmsMessage("");
      } else {
        toast({
          title: "문자 전송 실패",
          description: "문자 전송에 실패했습니다. SMS 설정을 확인해주세요.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "문자 전송 실패",
        description: error?.message || "문자 전송 중 오류가 발생했습니다",
        variant: "destructive",
      });
    },
  });

  const findConsultationForStudent = (u: User): NewConsultation | undefined => {
    const normPhone = (s?: string | null) => (s || "").replace(/[^0-9]/g, "");
    const uName = u.name.trim();
    const uPhones = [normPhone(u.studentPhone), normPhone(u.phone), normPhone(u.motherPhone), normPhone(u.fatherPhone)].filter(Boolean);
    const sortByLatest = (list: NewConsultation[]) =>
      [...list].sort((a, b) =>
        (b.consultationDate || b.createdAt || "").toString().localeCompare((a.consultationDate || a.createdAt || "").toString())
      );
    // 1순위: 전화번호 일치 (학생/학부모 번호 모두 비교)
    const phoneMatches = consultationsList.filter((c) => {
      const cPhones = [normPhone(c.studentPhone), normPhone(c.parentPhone)].filter(Boolean);
      return cPhones.some((p) => uPhones.includes(p));
    });
    if (phoneMatches.length > 0) return sortByLatest(phoneMatches)[0];
    // 2순위: 이름 일치 + 학교/학년이 기재된 경우 반드시 일치해야 함 (동명이인 오매칭 방지)
    const nameMatches = consultationsList.filter((c) => {
      if ((c.studentName || "").trim() !== uName) return false;
      if (c.school && u.school && normalizeSchoolName(c.school) !== normalizeSchoolName(u.school)) return false;
      if (c.grade && u.grade && normalizeGrade(c.grade) !== normalizeGrade(u.grade)) return false;
      return true;
    });
    if (nameMatches.length === 1) return nameMatches[0];
    return undefined;
  };

  const unregisteredConsultations = useMemo(() => {
    const normPhone = (s?: string | null) => (s || "").replace(/[^0-9]/g, "");
    const list = consultationsList.filter((c) => {
      const name = (c.studentName || "").trim();
      const phone = normPhone(c.studentPhone);
      const isRegistered = (users ?? []).some(
        (u) =>
          u.role === UserRole.STUDENT &&
          !u.withdrawnAt &&
          (u.name.trim() === name ||
            (!!phone && (normPhone(u.studentPhone) === phone || normPhone(u.phone) === phone)))
      );
      return !isRegistered;
    });
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((c) =>
      [c.studentName, c.school, c.studentPhone, c.parentPhone]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [consultationsList, users, searchQuery]);

  const filteredUsers = (displayUsers?.filter((u) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const nameMatch = u.name.toLowerCase().includes(query);
      const usernameMatch = u.username.toLowerCase().includes(query);
      const phoneMatch = u.phone?.toLowerCase().includes(query);
      const schoolMatch = u.school?.toLowerCase().includes(query);
      if (!nameMatch && !usernameMatch && !phoneMatch && !schoolMatch) {
        return false;
      }
    }
    if (roleFilter !== "all" && u.role !== parseInt(roleFilter)) {
      return false;
    }
    // 퇴원생 표시 규칙: 학생 탭에서는 재원생/퇴원생 필터에 따라, 그 외 탭에서는 퇴원생 제외
    if (u.withdrawnAt) {
      if (!(isStudentTab && !isTeacher && studentStatusFilter === "withdrawn")) return false;
    } else if (isStudentTab && !isTeacher && studentStatusFilter === "withdrawn") {
      return false;
    }
    if (isStudentTab && schoolFilter !== "all") {
      const normalized = normalizeSchoolName(u.school);
      if (normalized !== schoolFilter) return false;
    }
    if (isStudentTab && gradeFilter !== "all") {
      if (normalizeGrade(u.grade) !== gradeFilter) return false;
    }
    return true;
  }) ?? []).sort((a, b) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name, "ko");
    } else {
      const gradeA = parseGradeToNumber(a.grade);
      const gradeB = parseGradeToNumber(b.grade);
      if (gradeA !== gradeB) return gradeA - gradeB;
      return a.name.localeCompare(b.name, "ko");
    }
  });

  const handleDeleteUser = (userToDelete: User) => {
    if (userToDelete.withdrawnAt) {
      if (confirm(`${userToDelete.name}님의 계정을 완전히 삭제하시겠습니까?\n모든 데이터가 즉시 폐기되며 복구할 수 없습니다.`)) {
        deleteMutation.mutate(userToDelete.id);
      }
      return;
    }
    if (userToDelete.role === UserRole.STUDENT) {
      setStudentToExit(userToDelete);
    } else {
      if (confirm(`${userToDelete.name}님의 계정을 삭제하시겠습니까?`)) {
        deleteMutation.mutate(userToDelete.id);
      }
    }
  };

  const handleStudentExit = async (reasons: string[], notes: string) => {
    if (!studentToExit || !selectedCenter?.id || !user?.id) return;
    
    setIsExitProcessing(true);
    try {
      await apiRequest("POST", `/api/students/${studentToExit.id}/exit-record`, {
        reasons,
        notes,
        recordedBy: user.id,
        centerId: selectedCenter.id,
      });
      withdrawMutation.mutate(studentToExit.id);
    } catch (error: any) {
      const serverMessage = error instanceof ApiError ? error.serverMessage : null;
      toast({ title: serverMessage || "퇴원 처리에 실패했습니다", variant: "destructive" });
      setIsExitProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{isTeacher ? "소속 학생" : "사용자 관리"}</h1>
          <p className="text-muted-foreground">{isTeacher ? "내 수업을 듣는 학생 목록" : "계정 생성 및 관리"}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ManualButton menuKey="users" />
            <Tabs value={mainViewTab} onValueChange={(v) => setMainViewTab(v as "users" | "enrollment")}>
              <TabsList>
                <TabsTrigger value="users" data-testid="tab-users-list">
                  <Users className="h-4 w-4 mr-1" />
                  {isTeacher ? "소속 학생" : "사용자 목록"}
                </TabsTrigger>
                <TabsTrigger value="enrollment" data-testid="tab-enrollment-status">
                  <BookOpen className="h-4 w-4 mr-1" />
                  수강과목 현황
                </TabsTrigger>
              </TabsList>
            </Tabs>
          {mainViewTab === "users" && (
          <Button 
            variant="outline" 
            onClick={() => {
              const centerId = selectedCenter?.id || (centers?.[0]?.id);
              if (centerId) {
                window.open(`/api/users/export-excel?centerId=${centerId}&accountType=${accountTypeMode}`, '_blank');
              }
            }}
            data-testid="button-export-excel"
          >
            <Download className="h-4 w-4 mr-2" />
            학생 명단 다운
          </Button>)}
          {mainViewTab === "users" && <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-bulk-upload">
                <Upload className="h-4 w-4 mr-2" />
                엑셀 일괄등록
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{accountTypeMode === "parent" ? "학부모 일괄 등록" : "학생 일괄 등록"}</DialogTitle>
                <DialogDescription>
                  {accountTypeMode === "parent" 
                    ? "엑셀 파일로 학부모 계정과 자녀를 한번에 등록합니다" 
                    : "엑셀 파일로 학생을 한번에 등록합니다"}
                </DialogDescription>
              </DialogHeader>
              {accountTypeMode === "parent" ? (
                <ParentBulkUploadDialog
                  centers={isAdmin ? (centers ?? []) : isTeacher ? (teacherCenters ?? []) : [selectedCenter!].filter(Boolean)}
                  onClose={() => setIsBulkOpen(false)}
                />
              ) : (
                <BulkUploadDialog
                  centers={isAdmin ? (centers ?? []) : isTeacher ? (teacherCenters ?? []) : [selectedCenter!].filter(Boolean)}
                  onClose={() => setIsBulkOpen(false)}
                />
              )}
            </DialogContent>
          </Dialog>}
          {mainViewTab === "users" && <Dialog open={isVcfOpen} onOpenChange={setIsVcfOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-vcf-import">
                <Phone className="h-4 w-4 mr-2" />
                연락처 가져오기
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>연락처 파일로 등록</DialogTitle>
                <DialogDescription>
                  핸드폰 연락처를 .vcf 파일로 내보낸 후 업로드하면 학생/학부모를 한번에 등록할 수 있습니다
                </DialogDescription>
              </DialogHeader>
              <VcfImportDialog
                centers={isAdmin ? (centers ?? []) : isTeacher ? (teacherCenters ?? []) : [selectedCenter!].filter(Boolean)}
                onClose={() => setIsVcfOpen(false)}
              />
            </DialogContent>
          </Dialog>}
          {mainViewTab === "users" && <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-user">
                <Plus className="h-4 w-4 mr-2" />
                {isTeacher ? "학생 등록" : "회원 등록"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {isTeacher ? "학생 등록" : "회원 등록"}
                </DialogTitle>
                <DialogDescription>
                  {isTeacher ? "학생 정보를 입력해주세요" : "회원 정보를 입력해주세요"}
                </DialogDescription>
              </DialogHeader>
              <CreateUserDialog
                centers={isAdmin ? (centers ?? []) : isTeacher ? (teacherCenters ?? []) : [selectedCenter!].filter(Boolean)}
                onClose={() => setIsCreateOpen(false)}
                teacherOnly={isTeacher}
                isClinicEnabled={isClinicEnabled}
                accountTypeOverride={isTeacher ? "student" : accountTypeMode}
              />
            </DialogContent>
          </Dialog>}
        </div>
      </div>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>계정 수정</DialogTitle>
            <DialogDescription>사용자 정보를 수정합니다</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <EditUserDialog
              user={editingUser}
              centers={isAdmin ? (centers ?? []) : isTeacher ? (teacherCenters ?? []) : [selectedCenter!].filter(Boolean)}
              onClose={() => setEditingUser(null)}
              isClinicEnabled={isClinicEnabled}
            />
          )}
        </DialogContent>
      </Dialog>

      {mainViewTab === "enrollment" && selectedCenter?.id && (
        <EnrollmentStatusTable centerId={selectedCenter.id} onEditStudent={(student) => setEditingUser(student)} currentUserId={user?.id} />
      )}

      {mainViewTab === "users" && <>
      {/* 역할 필터 탭 */}
      {(isAdmin || isPrincipal) && (
        <div className="space-y-2">
          {!isTeacher && (
            <Tabs value={roleFilter} onValueChange={setRoleFilter}>
              <TabsList>
                <TabsTrigger value="all">전체</TabsTrigger>
                <TabsTrigger value="1">학생</TabsTrigger>
                <TabsTrigger value="2">선생님</TabsTrigger>
                {(isAdmin || isPrincipal) && <TabsTrigger value="3">원장</TabsTrigger>}
              </TabsList>
            </Tabs>
          )}
          {!isTeacher && roleFilter === "1" && (
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={studentStatusFilter} onValueChange={(v) => setStudentStatusFilter(v as "active" | "withdrawn")}>
                <TabsList>
                  <TabsTrigger value="active" data-testid="tab-active-students">재원생</TabsTrigger>
                  <TabsTrigger value="withdrawn" data-testid="tab-withdrawn-students">비재원생</TabsTrigger>
                </TabsList>
              </Tabs>
              {studentStatusFilter === "withdrawn" && (
                <Tabs value={nonEnrolledTab} onValueChange={(v) => setNonEnrolledTab(v as "unregistered" | "withdrawn")}>
                  <TabsList>
                    <TabsTrigger value="unregistered" data-testid="tab-unregistered-students">미등록생</TabsTrigger>
                    <TabsTrigger value="withdrawn" data-testid="tab-exited-students">퇴원생</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </div>
          )}
        </div>
      )}

      {/* 검색창 + 정렬 (한 줄 배치) */}
      <div className="flex flex-row gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="이름, 전화번호, 학교로 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-users"
          />
        </div>
        {!isUnregisteredView && (
          <Select value={sortBy} onValueChange={(v: "name" | "grade") => setSortBy(v)}>
            <SelectTrigger className="w-24 shrink-0" data-testid="select-sort-users">
              <SelectValue placeholder="정렬" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">이름순</SelectItem>
              <SelectItem value="grade">학년순</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {isStudentTab && !isUnregisteredView && (
        <div className="flex flex-row gap-2 items-center flex-wrap">
          <Select value={schoolFilter} onValueChange={setSchoolFilter}>
            <SelectTrigger className="w-36" data-testid="select-school-filter">
              <School className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="학교 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">학교 전체</SelectItem>
              {schoolOptions.map(school => (
                <SelectItem key={school} value={school}>{school}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger className="w-28" data-testid="select-grade-filter">
              <GraduationCap className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="학년 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">학년 전체</SelectItem>
              {gradeFilterOptions.map(grade => (
                <SelectItem key={grade} value={grade}>{grade}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(schoolFilter !== "all" || gradeFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSchoolFilter("all"); setGradeFilter("all"); }}
              className="h-8 text-xs"
              data-testid="button-clear-filters"
            >
              <X className="h-3 w-3 mr-1" />
              필터 초기화
            </Button>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {isTeacher ? "학생 목록" : "사용자 목록"}
          </CardTitle>
          <CardDescription>{isUnregisteredView ? unregisteredConsultations.length : filteredUsers.length}명</CardDescription>
        </CardHeader>
        <CardContent>
          {isUnregisteredView ? (
            isLoadingConsultations ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : unregisteredConsultations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>미등록생이 없습니다</p>
                <p className="text-xs mt-1">신규상담 등록 후 아직 재원생으로 등록되지 않은 학생이 여기에 표시됩니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {unregisteredConsultations.map((c) => (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setViewingConsultation(c)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setViewingConsultation(c); } }}
                    className="w-full flex items-center gap-3 p-4 rounded-lg bg-muted/50 text-left hover-elevate cursor-pointer"
                    data-testid={`unregistered-${c.id}`}
                  >
                    <Avatar className="h-11 w-11">
                      <AvatarFallback className="text-sm font-medium bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200">
                        {c.studentName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{c.studentName}</span>
                        <span className="text-xs bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200 px-1.5 py-0.5 rounded" data-testid={`badge-unregistered-${c.id}`}>
                          미등록생
                        </span>
                        {c.school && <span className="text-xs text-muted-foreground">{c.school}</span>}
                        {c.grade && <span className="text-xs text-muted-foreground">{c.grade}</span>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {c.studentPhone || c.parentPhone || "-"}
                        {c.createdAt && (
                          <span className="ml-2 text-xs">
                            상담일 {format(new Date(c.consultationDate || c.createdAt!), "yyyy.MM.dd", { locale: ko })}
                          </span>
                        )}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!c.parentPhone}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSmsConsultation(c);
                        setSmsMessage("");
                      }}
                      data-testid={`button-send-sms-${c.id}`}
                    >
                      문자보내기
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRegisteringConsultation(c);
                      }}
                      data-testid={`button-register-student-${c.id}`}
                    >
                      재원생으로 등록
                    </Button>
                  </div>
                ))}
              </div>
            )
          ) : isLoadingUsers ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>사용자가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((userItem) => (
                <Collapsible
                  key={userItem.id}
                  open={expandedUserId === userItem.id}
                  onOpenChange={(open) => setExpandedUserId(open ? userItem.id : null)}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      className="w-full flex items-center gap-3 p-4 rounded-lg bg-muted/50 hover-elevate text-left transition-colors"
                      data-testid={`user-${userItem.id}`}
                    >
                      <Avatar className="h-11 w-11">
                        <AvatarFallback className={`text-sm font-medium ${
                          userItem.role === 4 ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200" :
                          userItem.role === 3 ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200" :
                          userItem.role === 2 ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200" :
                          userItem.role === 1 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200" :
                          "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        }`}>
                          {userItem.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{userItem.name}</span>
                          {userItem.withdrawnAt && (
                            <span className="text-xs bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded" data-testid={`badge-withdrawn-${userItem.id}`}>
                              퇴원생
                            </span>
                          )}
                          <RoleBadge role={userItem.role} isClinicTeacher={userItem.isClinicTeacher} size="sm" />
                          {userItem.role === UserRole.STUDENT && (() => {
                            const matchedConsultation = findConsultationForStudent(userItem);
                            return matchedConsultation ? (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingConsultation(matchedConsultation);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setViewingConsultation(matchedConsultation);
                                  }
                                }}
                                className="text-xs bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200 px-1.5 py-0.5 rounded cursor-pointer hover-elevate"
                                data-testid={`badge-consultation-${userItem.id}`}
                              >
                                상담기록
                              </span>
                            ) : null;
                          })()}
                          {/* 학생이 학부모 계정에 연결된 경우 학부모 이름 표시 */}
                          {userItem.parentId && userItem.role === UserRole.STUDENT && (() => {
                            const parentUser = users?.find(u => u.id === userItem.parentId);
                            return parentUser ? (
                              <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200 px-1.5 py-0.5 rounded">
                                {parentUser.name}의 자녀
                              </span>
                            ) : null;
                          })()}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {/* 학부모 자녀인 경우 username(자동생성된 아이디) 대신 전화번호/학교 표시 */}
                          {userItem.parentId && userItem.role === UserRole.STUDENT 
                            ? (userItem.phone || userItem.school || userItem.grade || "-")
                            : (userItem.phone || userItem.username)
                          }
                        </p>
                      </div>
                      <div className={`p-1.5 rounded-full transition-colors ${expandedUserId === userItem.id ? 'bg-primary/10' : ''}`}>
                        {expandedUserId === userItem.id ? (
                          <ChevronUp className="h-5 w-5 text-primary" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <UserDetailsPanel 
                      userItem={userItem}
                      onEdit={() => setEditingUser(userItem)}
                      onDelete={() => handleDeleteUser(userItem)}
                      onReinstate={() => {
                        if (confirm(`${userItem.name}님을 재원 처리하시겠습니까?\n기존 데이터와 수강 정보가 복구됩니다.`)) {
                          reinstateMutation.mutate(userItem.id);
                        }
                      }}
                      allTeachers={allTeachers}
                    />
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {studentToExit && selectedCenter && user && (
        <StudentExitDialog
          student={studentToExit}
          centerId={selectedCenter.id}
          recordedBy={user.id}
          onConfirm={handleStudentExit}
          onCancel={() => setStudentToExit(null)}
          isDeleting={isExitProcessing}
        />
      )}
      </>}

      <Dialog open={!!smsConsultation} onOpenChange={(open) => { if (!open) { setSmsConsultation(null); setSmsMessage(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-sms-dialog-title">
              {smsConsultation?.studentName} 학부모에게 문자보내기
            </DialogTitle>
            <DialogDescription>
              수신번호: {smsConsultation?.parentPhone}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>문자 내용</Label>
            <Textarea
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              placeholder="보낼 문자 내용을 입력하세요"
              rows={5}
              data-testid="input-sms-message"
            />
            <p className="text-xs text-muted-foreground text-right">{smsMessage.length}자</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setSmsConsultation(null); setSmsMessage(""); }}
              data-testid="button-cancel-sms"
            >
              취소
            </Button>
            <Button
              onClick={() => {
                if (!smsConsultation?.parentPhone) return;
                sendSmsMutation.mutate({ phone: smsConsultation.parentPhone, message: smsMessage.trim() });
              }}
              disabled={!smsMessage.trim() || sendSmsMutation.isPending}
              data-testid="button-confirm-sms"
            >
              {sendSmsMutation.isPending ? "전송 중..." : "문자 전송"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!registeringConsultation} onOpenChange={(open) => !open && closeRegisterDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-register-student-title">
              {registeringConsultation?.studentName} 재원생으로 등록
            </DialogTitle>
            <DialogDescription>
              수업을 등록할까요? 선생님과 수업을 선택하면 등록과 동시에 수업에 배정됩니다. 수업은 나중에 추가할 수도 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>선생님</Label>
              <Select
                value={regTeacherId}
                onValueChange={(v) => {
                  setRegTeacherId(v);
                  setRegClassId("");
                }}
              >
                <SelectTrigger data-testid="select-register-teacher">
                  <SelectValue placeholder="선생님 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 선생님</SelectItem>
                  {regTeacherOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>수업</Label>
              <Select value={regClassId} onValueChange={setRegClassId}>
                <SelectTrigger data-testid="select-register-class">
                  <SelectValue placeholder="수업 선택" />
                </SelectTrigger>
                <SelectContent>
                  {regFilteredClasses.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      선택 가능한 수업이 없습니다
                    </SelectItem>
                  ) : (
                    regFilteredClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name} {cls.subject}반
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={closeRegisterDialog} data-testid="button-cancel-register">
              취소
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleRegisterStudent(null)}
              disabled={registerStudentMutation.isPending}
              data-testid="button-register-later"
            >
              나중에 등록하기
            </Button>
            <Button
              onClick={() => handleRegisterStudent(regClassId)}
              disabled={!regClassId || regClassId === "__none__" || registerStudentMutation.isPending}
              data-testid="button-register-with-class"
            >
              {registerStudentMutation.isPending ? "등록 중..." : "선택한 수업으로 등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingConsultation} onOpenChange={(open) => !open && setViewingConsultation(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-consultation-detail-title">
              {viewingConsultation?.studentName} 상담 기록
            </DialogTitle>
            <DialogDescription>
              상담일: {viewingConsultation && format(new Date(viewingConsultation.consultationDate || viewingConsultation.createdAt!), "yyyy년 M월 d일", { locale: ko })}
            </DialogDescription>
          </DialogHeader>
          {viewingConsultation && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">성별</p>
                  <p data-testid="text-consultation-gender">{viewingConsultation.gender || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">학교 / 학년</p>
                  <p data-testid="text-consultation-school">{[viewingConsultation.school, viewingConsultation.grade].filter(Boolean).join(" ") || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">목표 학교</p>
                  <p data-testid="text-consultation-target-school">{viewingConsultation.targetSchool || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">수업 가능 요일</p>
                  <p data-testid="text-consultation-days">{viewingConsultation.availableDays ? viewingConsultation.availableDays.split(",").filter(Boolean).join(", ") : "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">학생 연락처</p>
                  <p data-testid="text-consultation-student-phone">{viewingConsultation.studentPhone || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">학부모 연락처</p>
                  <p data-testid="text-consultation-parent-phone">{viewingConsultation.parentPhone || "-"}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">성적</p>
                <p className="whitespace-pre-wrap" data-testid="text-consultation-scores">{viewingConsultation.scores || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">상담 내용</p>
                <p className="whitespace-pre-wrap" data-testid="text-consultation-content">{viewingConsultation.counselingContent || "-"}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingConsultation(null)} data-testid="button-close-consultation-detail">
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
