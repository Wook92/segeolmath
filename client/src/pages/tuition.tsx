import { useState, useEffect, useMemo, Fragment } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ManualButton } from "@/components/manual-button";
import { useAuth } from "@/lib/auth-context";
import { queryClient, apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, Save, Calculator, BookOpen, User, Lock, Unlock, Key, Eye, EyeOff, FileText, Upload, X, Image, Send, MessageSquare, History, CreditCard, Building, Smartphone, Clock, Book, Plus, Trash2, Edit, ChevronDown, Search, Percent } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Center, Class, User as UserType, Enrollment, TuitionGuidance, TuitionNotification, StudentTextbookPurchase, ClassTextbook } from "@shared/schema";
import { normalizeGrade } from "@/components/enrollment-status-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { UserRole } from "@shared/schema";

interface EnrollmentWithClass extends Enrollment {
  class: Class | null;
  teacher: UserType | null;
  center: Center | null;
}

interface ChildData {
  child: UserType;
  enrollments: EnrollmentWithClass[];
  hasPassword: boolean;
}

const DEFAULT_SMS_TEMPLATE = `[교육비 안내]
안녕하세요. {{학원이름}}입니다.

성명 : {{학생이름}}
청구내용 : 교육비
청구일자 : {{청구일자}}
청구금액 : {{총합계}}

─세부내역─

[수강료]
{{수강료내역}}

{{교재비내역}}[총 교육비]: {{총합계}}
─────

세부내역 확인 후 문의사항 있으시면 연락주세요.`;

const TEMPLATE_VARIABLES = [
  { key: "{{학생이름}}", desc: "학생 이름" },
  { key: "{{학원이름}}", desc: "학원 이름" },
  { key: "{{청구일자}}", desc: "발송일 (예: 2026년 3월 4일)" },
  { key: "{{수강료합계}}", desc: "수강료 합계" },
  { key: "{{교재비합계}}", desc: "교재비 합계" },
  { key: "{{총합계}}", desc: "수강료 + 교재비 합계" },
  { key: "{{수강료내역}}", desc: "수업별 수강료 상세 내역" },
  { key: "{{교재비내역}}", desc: "교재별 교재비 상세 내역 (없으면 빈값)" },
];

function SmsTemplateSettings({ centerId }: { centerId: string }) {
  const { toast } = useToast();
  const [templateText, setTemplateText] = useState("");
  const [isEdited, setIsEdited] = useState(false);

  const { data: savedTemplate, isLoading } = useQuery<{ template: string | null }>({
    queryKey: ["/api/tuition-sms-template", centerId],
    queryFn: async () => {
      const res = await fetch(`/api/tuition-sms-template/${centerId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!centerId,
  });

  useEffect(() => {
    if (savedTemplate !== undefined) {
      setTemplateText(savedTemplate?.template || DEFAULT_SMS_TEMPLATE);
      setIsEdited(false);
    }
  }, [savedTemplate]);

  const saveMutation = useMutation({
    mutationFn: async (template: string) => {
      return apiRequest("PUT", `/api/tuition-sms-template/${centerId}`, { template });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/tuition-sms-template");
      toast({ title: "문자 템플릿이 저장되었습니다." });
      setIsEdited(false);
    },
    onError: () => {
      toast({ title: "저장에 실패했습니다.", variant: "destructive" });
    },
  });

  const handleReset = () => {
    setTemplateText(DEFAULT_SMS_TEMPLATE);
    setIsEdited(true);
  };

  if (isLoading) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground">불러오는 중...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          교육비 안내 문자 템플릿
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <Label>문자 내용 템플릿</Label>
            <Textarea
              value={templateText}
              onChange={(e) => { setTemplateText(e.target.value); setIsEdited(true); }}
              rows={18}
              className="font-mono text-sm"
              data-testid="textarea-sms-template"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => saveMutation.mutate(templateText)}
                disabled={!isEdited || saveMutation.isPending}
                data-testid="button-save-sms-template"
              >
                <Save className="w-4 h-4 mr-2" />
                {saveMutation.isPending ? "저장 중..." : "저장"}
              </Button>
              <Button variant="outline" onClick={handleReset} data-testid="button-reset-sms-template">
                기본값으로 초기화
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            <Label>사용 가능한 변수</Label>
            <div className="border rounded-lg p-3 space-y-2 text-sm">
              {TEMPLATE_VARIABLES.map(v => (
                <div key={v.key} className="flex items-start gap-2">
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono whitespace-nowrap text-primary">{v.key}</code>
                  <span className="text-muted-foreground">{v.desc}</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>변수는 문자 발송 시 실제 값으로 자동 치환됩니다.</p>
              <p>커스텀 수강료가 설정된 학생은 이전 발송 내용이 우선 적용됩니다.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TuitionPage() {
  const { user, selectedCenter: authSelectedCenter, centers: authCenters } = useAuth();
  const { toast } = useToast();
  
  // For principals, use the selected center if it's one of their centers, otherwise use first available
  const isPrincipal = user?.role === UserRole.PRINCIPAL;
  const userCenterIds = authCenters?.map(c => c.id) || [];
  const selectedCenter = isPrincipal 
    ? (userCenterIds.includes(authSelectedCenter?.id || "") ? authSelectedCenter?.id : userCenterIds[0]) || ""
    : authSelectedCenter?.id || "";
  const [showPaymentNotice, setShowPaymentNotice] = useState(false);
  const [editingClass, setEditingClass] = useState<string | null>(null);
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());
  const [baseFee, setBaseFee] = useState<number>(0);
  const [additionalFee, setAdditionalFee] = useState<number>(0);

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [studentPassword, setStudentPassword] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [verificationError, setVerificationError] = useState("");

  const [guidanceText, setGuidanceText] = useState("");
  const [guidanceImages, setGuidanceImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [selectedStudentForNotify, setSelectedStudentForNotify] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("in_person");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  const [smsContent, setSmsContent] = useState<string>("");
  const [notificationTitle, setNotificationTitle] = useState<string>("");
  const [isScheduledSms, setIsScheduledSms] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("09:00");

  // Textbook tab states
  const [tbSelectedTeacher, setTbSelectedTeacher] = useState<string>("none");
  const [tbSelectedClass, setTbSelectedClass] = useState<string>("none");
  const [tbNewName, setTbNewName] = useState("");
  const [tbNewPrice, setTbNewPrice] = useState("");
  const [tbEditingId, setTbEditingId] = useState<string | null>(null);
  const [tbEditName, setTbEditName] = useState("");
  const [tbEditPrice, setTbEditPrice] = useState("");

  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyMonth, setHistoryMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [notifyTabMonth, setNotifyTabMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [notifyStudentSearch, setNotifyStudentSearch] = useState("");
  const [notifyPhoneSelections, setNotifyPhoneSelections] = useState<Record<string, string>>({});
  const [paymentTabMonth, setPaymentTabMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [tossConsentDialogOpen, setTossConsentDialogOpen] = useState(false);
  const [showPastPayments, setShowPastPayments] = useState(false);

  // Payment status tab states
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<"all" | "unsent" | "unpaid" | "paid" | "cancelled">("all");
  const [paymentSchoolLevel, setPaymentSchoolLevel] = useState<"all" | "elementary" | "middle" | "high" | "adult">("all");
  const [paymentSearchQuery, setPaymentSearchQuery] = useState("");
  const [expandedPaymentStudents, setExpandedPaymentStudents] = useState<Set<string>>(new Set());
  const [expandedHistoryNotif, setExpandedHistoryNotif] = useState<string | null>(null);
  const [historyStudentId, setHistoryStudentId] = useState<string | null>(null);

  const isAdmin = !!user && user.role === UserRole.ADMIN;
  const isPrincipalOrAdmin = !!user && user.role >= UserRole.PRINCIPAL;
  const isParent = !!user && user.role === UserRole.PARENT;
  const isStudent = !!user && user.role === UserRole.STUDENT;

  const { data: userCenters = [] } = useQuery<Center[]>({
    queryKey: [`/api/users/${user?.id}/centers`],
    enabled: !!user?.id,
  });

  const currentCenter = userCenters.find(c => c.id === selectedCenter);
  const tossConsentStatus = (currentCenter as any)?.tossConsentStatus || "none";

  const [tossApprovedDialogOpen, setTossApprovedDialogOpen] = useState(false);

  useEffect(() => {
    if (isPrincipal && currentCenter) {
      if (tossConsentStatus === "none" || tossConsentStatus === "rejected") {
        setTossConsentDialogOpen(true);
      } else if (tossConsentStatus === "approved") {
        const seenKey = `toss_approved_seen_${selectedCenter}`;
        if (!localStorage.getItem(seenKey)) {
          setTossApprovedDialogOpen(true);
          localStorage.setItem(seenKey, "true");
        }
      }
    }
  }, [isPrincipal, currentCenter, tossConsentStatus, selectedCenter]);

  const tossConsentMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/centers/${selectedCenter}/toss-consent`, { actorId: user?.id });
    },
    onSuccess: () => {
      setTossConsentDialogOpen(false);
      invalidateQueriesStartingWith(`/api/users/${user?.id}/centers`);
      toast({ title: "동의 완료", description: "승인 후 이용 가능합니다. 빠르게 승인 처리해 드리겠습니다!" });
    },
    onError: () => {
      toast({ title: "오류", description: "동의 요청에 실패했습니다.", variant: "destructive" });
    },
  });


  const { data: allCenterStats = [], isLoading: tossConsentLoading } = useQuery<any[]>({
    queryKey: ["/api/centers/stats"],
    enabled: !!user?.id && isAdmin,
  });

  const { data: pendingRegistrations = [] } = useQuery<any[]>({
    queryKey: ["/api/center-registrations", { status: "pending", actorId: user?.id }],
    queryFn: async () => {
      const res = await fetch(`/api/center-registrations?actorId=${user?.id}&status=pending`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.id && isAdmin,
  });

  const [tossApproveConfirmCenter, setTossApproveConfirmCenter] = useState<any>(null);
  const [tossApproveSendSms, setTossApproveSendSms] = useState(true);

  const tossReviewMutation = useMutation({
    mutationFn: async ({ centerId, action, sendSms }: { centerId: string; action: "approve" | "reject"; sendSms?: boolean }) => {
      return apiRequest("POST", `/api/centers/${centerId}/toss-consent-review`, { actorId: user?.id, action, sendSms });
    },
    onSuccess: (_, variables) => {
      invalidateQueriesStartingWith("/api/toss-consent-pending");
      invalidateQueriesStartingWith("/api/centers");
      setTossApproveConfirmCenter(null);
      if (variables.action === "approve") {
        toast({ title: variables.sendSms ? "승인 완료 및 문자 발송됨" : "승인되었습니다" });
      } else {
        toast({ title: "거절되었습니다" });
      }
    },
    onError: () => {
      toast({ title: "처리에 실패했습니다", variant: "destructive" });
    },
  });

  const { data: classes = [], isLoading: classesLoading } = useQuery<Class[]>({
    queryKey: [`/api/classes?centerId=${selectedCenter}`],
    enabled: !!selectedCenter && isPrincipalOrAdmin,
  });

  const { data: children = [] } = useQuery<ChildData[]>({
    queryKey: [`/api/parents/${user?.id}/children?actorId=${user?.id}`],
    enabled: !!user?.id && isParent,
  });

  const { data: studentEnrollments = [] } = useQuery<EnrollmentWithClass[]>({
    queryKey: [`/api/students/${user?.id}/enrollments`],
    enabled: !!user?.id && isStudent,
  });

  const { data: tuitionVisibility } = useQuery<{ visible: boolean }>({
    queryKey: [`/api/students/${user?.id}/tuition-visibility`],
    enabled: !!user?.id && isStudent,
  });

  const { data: passwordStatus } = useQuery<{ hasPassword: boolean }>({
    queryKey: [`/api/students/${user?.id}/tuition-password-status`],
    enabled: !!user?.id && isStudent,
  });

  const { data: pendingPayments = [] } = useQuery<TuitionNotification[]>({
    queryKey: [`/api/students/${user?.id}/tuition-notifications?centerId=${selectedCenter}`],
    enabled: !!user?.id && isStudent && !!selectedCenter,
  });

  const { data: studentTextbookPurchases = [] } = useQuery<StudentTextbookPurchase[]>({
    queryKey: [`/api/students/${user?.id}/textbook-purchases?centerId=${selectedCenter}`],
    enabled: !!user?.id && isStudent && !!selectedCenter,
  });

  const { data: tuitionGuidance } = useQuery<TuitionGuidance>({
    queryKey: [`/api/centers/${selectedCenter}/tuition-guidance`],
    enabled: !!selectedCenter,
  });

  const isTeacher = !!user && (user.role === UserRole.TEACHER || user.role === UserRole.CLINIC_TEACHER);

  const centerDetail = userCenters.find(c => c.id === selectedCenter) || null;

  const { data: centerUsers = [] } = useQuery<UserType[]>({
    queryKey: [`/api/users?centerId=${selectedCenter}`],
    enabled: !!selectedCenter && isPrincipalOrAdmin,
  });

  const { data: enrollments = [] } = useQuery<(Enrollment & { class?: Class })[]>({
    queryKey: [`/api/enrollments?centerId=${selectedCenter}`],
    enabled: !!selectedCenter && isPrincipalOrAdmin,
  });

  const { data: notificationHistory = [] } = useQuery<(TuitionNotification & { student?: UserType; parent?: UserType; sender?: UserType })[]>({
    queryKey: [`/api/centers/${selectedCenter}/tuition-notifications`],
    enabled: !!selectedCenter && isPrincipalOrAdmin,
  });

  const { data: smsTemplateData } = useQuery<{ template: string | null }>({
    queryKey: ["/api/tuition-sms-template", selectedCenter],
    queryFn: async () => {
      const res = await fetch(`/api/tuition-sms-template/${selectedCenter}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedCenter,
  });
  const savedSmsTemplate = smsTemplateData?.template || null;

  // Fetch teachers who have classes assigned (regardless of userCenters table)
  const { data: classTeachers = [] } = useQuery<UserType[]>({
    queryKey: [`/api/centers/${selectedCenter}/class-teachers`],
    enabled: !!selectedCenter && isPrincipalOrAdmin,
  });

  const students = centerUsers.filter(u => u.role === UserRole.STUDENT);
  
  // Merge centerUsers teachers with classTeachers to get all teachers with classes
  const teachers = useMemo(() => {
    const teacherMap = new Map<string, UserType>();
    // Add teachers from centerUsers (only TEACHER role, not PRINCIPAL or ADMIN)
    centerUsers.filter(u => u.role === UserRole.TEACHER || u.role === UserRole.CLINIC_TEACHER).forEach(t => teacherMap.set(t.id, t));
    // Add teachers from classTeachers (these are teachers with classes in this center)
    classTeachers.forEach(t => teacherMap.set(t.id, t));
    return Array.from(teacherMap.values());
  }, [centerUsers, classTeachers]);

  // Group classes by teacher
  const classesByTeacher = useMemo(() => {
    const activeClasses = classes.filter(c => !c.isArchived);
    const grouped: Record<string, { teacher: UserType | null; classes: Class[] }> = {};
    const unassigned: Class[] = [];
    
    // Create teacher lookup
    const teacherMap = new Map<string, UserType>();
    teachers.forEach((t) => {
      teacherMap.set(t.id, t);
    });
    
    activeClasses.forEach((cls) => {
      if (cls.teacherId) {
        if (!grouped[cls.teacherId]) {
          grouped[cls.teacherId] = {
            teacher: teacherMap.get(cls.teacherId) || null,
            classes: [],
          };
        }
        grouped[cls.teacherId].classes.push(cls);
      } else {
        unassigned.push(cls);
      }
    });
    
    // Sort teacher groups by teacher name
    const sortedGrouped = Object.entries(grouped).sort(([, a], [, b]) => {
      const nameA = a.teacher?.name || "";
      const nameB = b.teacher?.name || "";
      return nameA.localeCompare(nameB, "ko");
    });
    
    return { grouped: Object.fromEntries(sortedGrouped), unassigned };
  }, [classes, teachers]);

  interface ParentPhoneOption {
    type: "mother" | "father";
    label: string;
    phone: string;
  }

  const toggleTeacherExpanded = (teacherId: string) => {
    setExpandedTeachers(prev => {
      const next = new Set(prev);
      if (next.has(teacherId)) {
        next.delete(teacherId);
      } else {
        next.add(teacherId);
      }
      return next;
    });
  };

  const getParentPhoneOptions = (student: UserType): ParentPhoneOption[] => {
    const options: ParentPhoneOption[] = [];
    if (student.motherPhone) {
      options.push({ type: "mother", label: "어머니", phone: student.motherPhone });
    }
    if (student.fatherPhone) {
      options.push({ type: "father", label: "아버지", phone: student.fatherPhone });
    }
    return options;
  };

  const getStudentEnrollmentsForNotify = (studentId: string): (Enrollment & { class?: Class })[] => {
    return enrollments.filter(e => e.studentId === studentId);
  };

  useEffect(() => {
    if (tuitionGuidance) {
      setGuidanceText(tuitionGuidance.guidanceText || "");
      setGuidanceImages(tuitionGuidance.imageUrls || []);
    }
  }, [tuitionGuidance]);

  const updatePricingMutation = useMutation({
    mutationFn: async ({ classId, baseFee, additionalFee }: { classId: string; baseFee: number; additionalFee: number }) => {
      return apiRequest("PATCH", `/api/classes/${classId}/pricing`, {
        baseFee,
        additionalFee,
        actorId: user?.id,
      });
    },
    onSuccess: () => {
      toast({ title: "저장 완료", description: "교육비가 저장되었습니다." });
      invalidateQueriesStartingWith("/api/classes");
      invalidateQueriesStartingWith("/api/enrollments");
      setEditingClass(null);
    },
    onError: (error: any) => {
      toast({ title: "저장 실패", description: error.message || "교육비 저장에 실패했습니다.", variant: "destructive" });
    },
  });

  const setPasswordMutation = useMutation({
    mutationFn: async ({ studentId, password }: { studentId: string; password: string }) => {
      return apiRequest("POST", `/api/students/${studentId}/tuition-password`, {
        password,
        parentId: user?.id,
      });
    },
    onSuccess: () => {
      toast({ title: "저장 완료", description: "비밀번호가 설정되었습니다." });
      invalidateQueriesStartingWith("/api/parents");
      setPasswordDialogOpen(false);
      setNewPassword("");
      setConfirmPassword("");
      setSelectedChildId(null);
    },
    onError: (error: any) => {
      toast({ title: "저장 실패", description: error.message || "비밀번호 설정에 실패했습니다.", variant: "destructive" });
    },
  });

  const deletePasswordMutation = useMutation({
    mutationFn: async (studentId: string) => {
      return apiRequest("DELETE", `/api/students/${studentId}/tuition-password`, {
        parentId: user?.id,
      });
    },
    onSuccess: () => {
      toast({ title: "삭제 완료", description: "비밀번호가 삭제되었습니다." });
      invalidateQueriesStartingWith("/api/parents");
    },
    onError: (error: any) => {
      toast({ title: "삭제 실패", description: error.message || "비밀번호 삭제에 실패했습니다.", variant: "destructive" });
    },
  });

  const verifyPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      return apiRequest("POST", `/api/students/${user?.id}/tuition-password/verify`, {
        password,
      });
    },
    onSuccess: () => {
      setIsVerified(true);
      setVerificationError("");
      setStudentPassword("");
    },
    onError: (error: any) => {
      setVerificationError(error.message || "비밀번호가 일치하지 않습니다");
    },
  });

  const toggleTeacherVisibilityMutation = useMutation({
    mutationFn: async (visible: boolean) => {
      return apiRequest("PATCH", `/api/centers/${selectedCenter}/tuition-visible-to-teachers`, {
        actorId: user?.id,
        visible,
      });
    },
    onSuccess: () => {
      toast({ title: "설정이 저장되었습니다" });
      invalidateQueriesStartingWith("/api/centers");
      invalidateQueriesStartingWith("/api/users");
    },
    onError: () => {
      toast({ title: "설정 저장에 실패했습니다", variant: "destructive" });
    },
  });

  const updateGuidanceMutation = useMutation({
    mutationFn: async ({ guidanceText, imageUrls }: { guidanceText: string; imageUrls: string[] }) => {
      return apiRequest("PUT", `/api/centers/${selectedCenter}/tuition-guidance`, {
        guidanceText,
        imageUrls,
        userId: user?.id,
      });
    },
    onSuccess: () => {
      toast({ title: "저장 완료", description: "교육비 안내가 저장되었습니다." });
      invalidateQueriesStartingWith("/api/centers");
    },
    onError: (error: any) => {
      toast({ title: "저장 실패", description: error.message || "교육비 안내 저장에 실패했습니다.", variant: "destructive" });
    },
  });

  // Class textbooks query
  const { data: classTextbooksList = [] } = useQuery<ClassTextbook[]>({
    queryKey: ['/api/class-textbooks', selectedCenter],
    queryFn: () => fetch(`/api/class-textbooks?centerId=${selectedCenter}`).then(r => r.json()),
    enabled: !!selectedCenter && isPrincipalOrAdmin,
  });

  // Textbook purchases query
  const { data: textbookPurchases = [] } = useQuery<StudentTextbookPurchase[]>({
    queryKey: [`/api/student-textbook-purchases?centerId=${selectedCenter}`],
    enabled: !!selectedCenter && isPrincipalOrAdmin,
  });

  const createClassTextbookMutation = useMutation({
    mutationFn: async (data: { classId: string; centerId: string; name: string; price: number }) => {
      return apiRequest("POST", `/api/class-textbooks?actorId=${user?.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "교재 등록 완료" });
      invalidateQueriesStartingWith("/api/class-textbooks");
      setTbNewName("");
      setTbNewPrice("");
    },
    onError: () => {
      toast({ title: "등록 실패", variant: "destructive" });
    },
  });

  const updateClassTextbookMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; price: number } }) => {
      return apiRequest("PATCH", `/api/class-textbooks/${id}?actorId=${user?.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "교재 수정 완료" });
      invalidateQueriesStartingWith("/api/class-textbooks");
      setTbEditingId(null);
    },
    onError: () => {
      toast({ title: "수정 실패", variant: "destructive" });
    },
  });

  const deleteClassTextbookMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/class-textbooks/${id}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      toast({ title: "교재 삭제 완료" });
      invalidateQueriesStartingWith("/api/class-textbooks");
      invalidateQueriesStartingWith("/api/student-textbook-purchases");
    },
    onError: () => {
      toast({ title: "삭제 실패", variant: "destructive" });
    },
  });

  const toggleStudentTextbookMutation = useMutation({
    mutationFn: async ({ classTextbookId, studentId, checked }: { classTextbookId: string; studentId: string; checked: boolean }) => {
      if (checked) {
        const alreadyExists = textbookPurchases.some(p => p.classTextbookId === classTextbookId && p.studentId === studentId);
        if (alreadyExists) return;
        const ct = classTextbooksList.find(t => t.id === classTextbookId);
        if (!ct) throw new Error("교재 정보를 찾을 수 없습니다");
        return apiRequest("POST", `/api/student-textbook-purchases?actorId=${user?.id}`, {
          studentId,
          centerId: selectedCenter,
          textbookName: ct.name,
          price: ct.price,
          purchaseDate: format(new Date(), "yyyy-MM-dd"),
          classTextbookId,
        });
      } else {
        const existing = textbookPurchases.find(p => p.classTextbookId === classTextbookId && p.studentId === studentId);
        if (existing) {
          return apiRequest("DELETE", `/api/student-textbook-purchases/${existing.id}?actorId=${user?.id}`);
        }
      }
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/student-textbook-purchases");
    },
    onError: () => {
      toast({ title: "저장 실패", variant: "destructive" });
    },
  });

  const deleteTextbookMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/student-textbook-purchases/${id}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      toast({ title: "교재비 삭제 완료" });
      invalidateQueriesStartingWith("/api/student-textbook-purchases");
    },
    onError: () => {
      toast({ title: "삭제 실패", variant: "destructive" });
    },
  });

  const getStudentsForClass = (classId: string): UserType[] => {
    if (!classId || classId === "none") return [];
    const classEnrollments = enrollments.filter(e => e.classId === classId);
    const studentIds = classEnrollments.map(e => e.studentId);
    return students.filter(s => studentIds.includes(s.id));
  };

  const tbClassTextbooks = classTextbooksList.filter(t => t.classId === tbSelectedClass);
  const tbClassStudents = getStudentsForClass(tbSelectedClass);

  const tbTeacherClasses = (() => {
    if (tbSelectedTeacher === "none") return [];
    if (tbSelectedTeacher === "unassigned") return classesByTeacher.unassigned;
    return classesByTeacher.grouped[tbSelectedTeacher]?.classes || [];
  })();

  const sendNotificationMutation = useMutation({
    mutationFn: async (data: {
      studentId: string;
      parentId: string | null;
      centerId: string;
      title: string;
      calculatedTotal: number;
      sentAmount: number;
      feeBreakdown: { className: string; fee: number; isFirst: boolean }[];
      paymentMethod: string;
      messageContent: string;
      recipientPhone: string;
      recipientType: "mother" | "father" | null;
      textbookTotal: number;
      skipSms?: boolean;
      draftOnly?: boolean;
      scheduledDate?: string;
    }) => {
      return apiRequest("POST", "/api/tuition-notifications/send", {
        ...data,
        senderId: user?.id,
      });
    },
    onSuccess: (_data, variables) => {
      const desc = variables.draftOnly
        ? "문자 내용이 저장되었습니다. (청구서 생성 안됨)"
        : variables.skipSms
          ? "교육비 안내가 저장되었습니다."
          : (variables.scheduledDate ? "예약 문자가 등록되었습니다." : "교육비 안내 문자가 발송되었습니다.");
      toast({ title: "완료", description: desc });
      invalidateQueriesStartingWith("/api/centers");
      setNotificationDialogOpen(false);
      resetNotificationForm();
    },
    onError: (error: any) => {
      toast({ title: "실패", description: error.message || "처리에 실패했습니다.", variant: "destructive" });
    },
  });

  const markPaymentCompleteMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("PATCH", `/api/tuition-notifications/${notificationId}/payment-status`, {
        paymentStatus: "paid",
        actorId: user?.id,
      });
    },
    onSuccess: () => {
      toast({ title: "결제 완료", description: "결제 완료 처리되었습니다." });
      invalidateQueriesStartingWith("/api/students");
      invalidateQueriesStartingWith("/api/tuition-notifications");
      invalidateQueriesStartingWith("/api/monthly-financials");
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message || "결제 상태 업데이트에 실패했습니다.", variant: "destructive" });
    },
  });

  const cancelNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("PATCH", `/api/tuition-notifications/${notificationId}/payment-status`, {
        paymentStatus: "cancelled",
        actorId: user?.id,
      });
    },
    onSuccess: () => {
      toast({ title: "취소 완료", description: "교육비 안내가 취소되었습니다." });
      invalidateQueriesStartingWith("/api/students");
      invalidateQueriesStartingWith("/api/tuition-notifications");
      invalidateQueriesStartingWith("/api/centers");
      invalidateQueriesStartingWith("/api/monthly-financials");
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message || "취소에 실패했습니다.", variant: "destructive" });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await apiRequest("DELETE", `/api/tuition-notifications/${notificationId}?actorId=${encodeURIComponent(user?.id || "")}`, {
        actorId: user?.id,
      });
      return { notificationId, body: await res.json().catch(() => ({})) };
    },
    onSuccess: async ({ notificationId }) => {
      // 1) 캐시에서 해당 항목 즉시 제거 (낙관적 업데이트)
      queryClient.setQueriesData<any>(
        {
          predicate: (q) => {
            const k = q.queryKey[0];
            return typeof k === "string" && (
              k.startsWith("/api/centers") ||
              k.startsWith("/api/students") ||
              k.startsWith("/api/tuition-notifications")
            );
          },
        },
        (old: any) => {
          if (Array.isArray(old)) {
            return old.filter((n: any) => n?.id !== notificationId);
          }
          return old;
        }
      );

      // 2) 서버에서 최신 데이터 강제 재조회 (재무 매출 집계 포함)
      await queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey[0];
          return typeof k === "string" && (
            k.startsWith("/api/centers") ||
            k.startsWith("/api/students") ||
            k.startsWith("/api/tuition-notifications") ||
            k.startsWith("/api/monthly-financials")
          );
        },
        refetchType: "all",
      });

      toast({ title: "삭제 완료", description: "교육비 안내가 완전히 삭제되었습니다." });
      setPaymentStatusDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message || "삭제에 실패했습니다.", variant: "destructive" });
    },
  });

  const toggleTuitionVisibilityMutation = useMutation({
    mutationFn: async ({ studentId, visible }: { studentId: string; visible: boolean }) => {
      return apiRequest("PATCH", `/api/students/${studentId}/tuition-visibility`, { visible });
    },
    onSuccess: () => {
      toast({ title: "변경 완료", description: "교육비 공개 설정이 변경되었습니다." });
      invalidateQueriesStartingWith("/api/users");
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message || "설정 변경에 실패했습니다.", variant: "destructive" });
    },
  });

  const [editingMemoStudentId, setEditingMemoStudentId] = useState<string | null>(null);
  const [editingMemoText, setEditingMemoText] = useState("");

  const updateTuitionMemoMutation = useMutation({
    mutationFn: async ({ studentId, memo }: { studentId: string; memo: string }) => {
      return apiRequest("PATCH", `/api/students/${studentId}/tuition-memo`, { memo });
    },
    onSuccess: () => {
      toast({ title: "메모 저장 완료" });
      invalidateQueriesStartingWith("/api/users");
      setEditingMemoStudentId(null);
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message || "메모 저장에 실패했습니다.", variant: "destructive" });
    },
  });

  // Toss Payments config
  const { data: paymentConfig } = useQuery<{ configured: boolean; clientKey?: string }>({
    queryKey: [`/api/payments/config?centerId=${selectedCenter}`],
    enabled: isStudent && !!selectedCenter,
  });

  // Mutation for admin/principal to change payment status with payment method and memo
  const changePaymentStatusMutation = useMutation({
    mutationFn: async ({ notificationId, paymentStatus, paymentMethod, paymentMemo }: { 
      notificationId: string; 
      paymentStatus: string; 
      paymentMethod: string;
      paymentMemo?: string;
    }) => {
      return apiRequest("PATCH", `/api/tuition-notifications/${notificationId}/payment-status`, {
        paymentStatus,
        paymentMethod,
        paymentMemo,
        actorId: user?.id,
      });
    },
    onSuccess: () => {
      toast({ title: "결제 상태 변경", description: "결제 상태가 업데이트되었습니다." });
      invalidateQueriesStartingWith("/api/students");
      invalidateQueriesStartingWith("/api/tuition-notifications");
      invalidateQueriesStartingWith("/api/monthly-financials");
      setPaymentStatusDialogOpen(false);
      setSelectedNotificationForPayment(null);
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message || "결제 상태 업데이트에 실패했습니다.", variant: "destructive" });
    },
  });

  const [editingCustomTuition, setEditingCustomTuition] = useState<string | null>(null);
  const [customTuitionInput, setCustomTuitionInput] = useState<string>("");

  const updateCustomTuitionMutation = useMutation({
    mutationFn: async ({ studentId, amount }: { studentId: string; amount: number | null }) => {
      return apiRequest("PATCH", `/api/students/${studentId}/custom-tuition`, { amount });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/users");
      if (!discountDialogOpen) {
        toast({ title: "커스텀 수강료가 저장되었습니다" });
      }
      setEditingCustomTuition(null);
    },
    onError: () => {
      toast({ title: "저장에 실패했습니다", variant: "destructive" });
    },
  });

  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [discountStudentId, setDiscountStudentId] = useState<string | null>(null);
  const [discountRate, setDiscountRate] = useState<string>("");
  const [discountReason, setDiscountReason] = useState<string>("");
  const [discountTarget, setDiscountTarget] = useState<string>("both");

  const updateDiscountMutation = useMutation({
    mutationFn: async ({ studentId, discountRate, discountReason, discountTarget }: { studentId: string; discountRate: number | null; discountReason: string; discountTarget: string }) => {
      return apiRequest("PATCH", `/api/students/${studentId}/discount`, { discountRate, discountReason, discountTarget, actorId: user?.id });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/users");
      toast({ title: "수강료 설정이 저장되었습니다" });
      setDiscountDialogOpen(false);
    },
    onError: () => {
      toast({ title: "할인 적용에 실패했습니다", variant: "destructive" });
    },
  });

  const openTuitionEditDialog = (studentId: string) => {
    setDiscountStudentId(studentId);
    const student = students.find(s => s.id === studentId);
    setCustomTuitionInput(student?.customTuitionAmount != null ? String(student.customTuitionAmount) : "");
    setDiscountRate(student?.discountRate != null ? String(student.discountRate) : "");
    setDiscountReason(student?.discountReason || "");
    setDiscountTarget(student?.discountTarget || "both");
    setDiscountDialogOpen(true);
  };

  const [isPaymentLoading, setIsPaymentLoading] = useState(false);

  // Payment status change dialog state (for admin/principal)
  const [paymentStatusDialogOpen, setPaymentStatusDialogOpen] = useState(false);
  const [selectedNotificationForPayment, setSelectedNotificationForPayment] = useState<string | null>(null);
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>("paid");
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>(["in_person"]);
  const [paymentMemoText, setPaymentMemoText] = useState<string>("");

  const handleOpenPaymentStatusDialog = (notificationId: string, currentStatus: string, currentMethod: string, currentMemo?: string) => {
    setSelectedNotificationForPayment(notificationId);
    setSelectedPaymentStatus(currentStatus || "pending");
    const methods = currentMethod ? currentMethod.split(",").map(m => m.trim()).filter(Boolean) : ["in_person"];
    setSelectedPaymentMethods(methods);
    setPaymentMemoText(currentMemo || "");
    setPaymentStatusDialogOpen(true);
  };

  const getEffectivePaymentMethod = (notif: any): string => {
    if (notif.paymentMethod) return notif.paymentMethod;
    if (notif.tossPaymentKey || notif.tossOrderId) return "online";
    return "";
  };

  const handleTossPayment = async (notificationId: string) => {
    if (!user?.id || !paymentConfig?.configured || !paymentConfig.clientKey) {
      toast({ title: "오류", description: "결제 시스템이 준비되지 않았습니다.", variant: "destructive" });
      return;
    }

    setIsPaymentLoading(true);
    try {
      // Initiate payment to get orderId and amount
      const initiateResponse = await apiRequest("POST", "/api/payments/initiate", {
        notificationId,
        studentId: user.id,
      });

      if (!initiateResponse.ok) {
        const errorData = await initiateResponse.json();
        throw new Error(errorData.error || "결제 시작에 실패했습니다.");
      }

      const { orderId, amount, orderName, customerName } = await initiateResponse.json();

      // Load Toss Payments SDK v2
      const script = document.createElement("script");
      script.src = "https://js.tosspayments.com/v2/standard";
      script.async = true;
      document.body.appendChild(script);

      script.onload = async () => {
        try {
          const TossPayments = (window as any).TossPayments;
          if (!TossPayments) {
            toast({ title: "오류", description: "결제 시스템 로드에 실패했습니다.", variant: "destructive" });
            setIsPaymentLoading(false);
            return;
          }

          const tossPayments = TossPayments(paymentConfig.clientKey);
          const payment = tossPayments.payment({ customerKey: `student_${user!.id}` });
          
          const successUrl = `${window.location.origin}/payment-result`;
          const failUrl = `${window.location.origin}/payment-result`;

          await payment.requestPayment({
            method: "CARD",
            amount: {
              value: amount,
              currency: "KRW",
            },
            orderId,
            orderName,
            customerName,
            successUrl,
            failUrl,
          });
        } catch (error: any) {
          if (error.code !== "USER_CANCEL") {
            toast({ title: "결제 오류", description: error.message || "결제 요청에 실패했습니다.", variant: "destructive" });
          }
          setIsPaymentLoading(false);
        }
      };

      script.onerror = () => {
        toast({ title: "오류", description: "결제 시스템 로드에 실패했습니다.", variant: "destructive" });
        setIsPaymentLoading(false);
      };
    } catch (error: any) {
      toast({ title: "오류", description: error.message || "결제 시작에 실패했습니다.", variant: "destructive" });
      setIsPaymentLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) {
        toast({ title: "오류", description: `${file.name}: 이미지 파일만 업로드 가능합니다.`, variant: "destructive" });
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "오류", description: `${file.name}: 파일 크기는 5MB 이하로 제한됩니다.`, variant: "destructive" });
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setIsUploadingImage(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of validFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "tuition-guidance");

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error(`${file.name} 업로드 실패`);

        const data = await response.json();
        uploadedUrls.push(data.url);
      }
      setGuidanceImages((prev) => [...prev, ...uploadedUrls]);
      toast({ title: "업로드 완료", description: `${uploadedUrls.length}개 이미지가 추가되었습니다.` });
    } catch (error) {
      toast({ title: "업로드 실패", description: "이미지 업로드에 실패했습니다.", variant: "destructive" });
    } finally {
      setIsUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleRemoveImage = (index: number) => {
    setGuidanceImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveGuidance = () => {
    updateGuidanceMutation.mutate({
      guidanceText,
      imageUrls: guidanceImages,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: "KRW",
    }).format(amount);
  };

  const handleEditClass = (cls: Class) => {
    setEditingClass(cls.id);
    setBaseFee(cls.baseFee);
    setAdditionalFee(cls.additionalFee);
  };

  const handleSave = (classId: string) => {
    const sanitizedBaseFee = isNaN(baseFee) || baseFee < 0 ? 0 : Math.floor(baseFee);
    const sanitizedAdditionalFee = isNaN(additionalFee) || additionalFee < 0 ? 0 : Math.floor(additionalFee);
    updatePricingMutation.mutate({ classId, baseFee: sanitizedBaseFee, additionalFee: sanitizedAdditionalFee });
  };

  const handleCancel = () => {
    setEditingClass(null);
    setBaseFee(0);
    setAdditionalFee(0);
  };

  const handleOpenPasswordDialog = (childId: string) => {
    setSelectedChildId(childId);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordDialogOpen(true);
  };

  const handleSetPassword = () => {
    if (!selectedChildId) return;
    if (newPassword.length < 4) {
      toast({ title: "오류", description: "비밀번호는 4자리 이상이어야 합니다.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "오류", description: "비밀번호가 일치하지 않습니다.", variant: "destructive" });
      return;
    }
    setPasswordMutation.mutate({ studentId: selectedChildId, password: newPassword });
  };

  const handleDeletePassword = (childId: string) => {
    if (confirm("정말로 비밀번호를 삭제하시겠습니까? 학생이 비밀번호 없이 교육비를 확인할 수 있게 됩니다.")) {
      deletePasswordMutation.mutate(childId);
    }
  };

  const handleVerifyPassword = () => {
    if (!studentPassword) {
      setVerificationError("비밀번호를 입력하세요");
      return;
    }
    verifyPasswordMutation.mutate(studentPassword);
  };

  const [selectedPhoneTypes, setSelectedPhoneTypes] = useState<("mother" | "father")[]>([]);
  const [skipSms, setSkipSms] = useState(false);
  const [dialogDiscountRate, setDialogDiscountRate] = useState<string>("");
  const [dialogDiscountTarget, setDialogDiscountTarget] = useState<string>("both");
  const [dialogDiscountReason, setDialogDiscountReason] = useState<string>("");
  const [dialogDiscountChanged, setDialogDiscountChanged] = useState(false);

  const generateSmsContent = (
    studentName: string, 
    breakdown: { className: string; fee: number; isFirst: boolean }[], 
    tuitionTotal: number,
    textbookTotal: number = 0,
    centerName: string = "",
    studentId: string = "",
    discountOverride?: { rate: number; target: string; reason: string }
  ) => {
    const today = new Date();
    const billingDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
    const grandTotal = tuitionTotal + textbookTotal;
    
    const student = studentId ? students.find(s => s.id === studentId) : null;
    const dRate = discountOverride ? discountOverride.rate : (student?.discountRate ?? 0);
    const hasDiscount = dRate > 0;
    const dTarget = discountOverride ? discountOverride.target : (student?.discountTarget || "both");
    const dReason = discountOverride ? discountOverride.reason : (student?.discountReason || "");

    let feeBreakdownText = "";
    if (breakdown.length > 0) {
      const parts = breakdown.map(item => {
        const feeType = item.isFirst ? "기본금" : "추가금";
        return `${item.className} ${feeType} (${formatCurrency(item.fee)})`;
      });
      const rawSum = breakdown.reduce((sum, item) => sum + item.fee, 0);
      feeBreakdownText = parts.join(" + ") + ` = ${formatCurrency(rawSum)}`;
      if (hasDiscount && (dTarget === "tuition" || dTarget === "both")) {
        const reasonText = dReason ? ` (${dReason})` : "";
        feeBreakdownText += `\n할인 ${dRate}%${reasonText} 적용: ${formatCurrency(tuitionTotal)}`;
      }
    }

    let textbookText = "";
    if (textbookTotal > 0 && studentId) {
      const tbDetails = getStudentTextbookDetails(studentId);
      textbookText += `[교재비]\n`;
      tbDetails.forEach(tb => {
        const classLabel = tb.className ? `(${tb.className}) ` : "";
        textbookText += `${classLabel}${tb.name}: ${formatCurrency(tb.price)}\n`;
      });
      if (hasDiscount && (dTarget === "textbook" || dTarget === "both")) {
        const rawTbTotal = tbDetails.reduce((sum, tb) => sum + tb.price, 0);
        const reasonText = dReason ? ` (${dReason})` : "";
        textbookText += `교재비 소계: ${formatCurrency(rawTbTotal)}\n`;
        textbookText += `할인 ${dRate}%${reasonText} 적용: ${formatCurrency(textbookTotal)}\n\n`;
      } else {
        textbookText += `교재비 합계: ${formatCurrency(textbookTotal)}\n\n`;
      }
    }

    const displayCenterName = centerName || "학원";
    const template = savedSmsTemplate || DEFAULT_SMS_TEMPLATE;

    const content = template
      .replace(/\{\{학생이름\}\}/g, studentName)
      .replace(/\{\{학원이름\}\}/g, displayCenterName)
      .replace(/\{\{청구일자\}\}/g, billingDate)
      .replace(/\{\{수강료합계\}\}/g, formatCurrency(tuitionTotal))
      .replace(/\{\{교재비합계\}\}/g, formatCurrency(textbookTotal))
      .replace(/\{\{총합계\}\}/g, formatCurrency(grandTotal))
      .replace(/\{\{수강료내역\}\}/g, feeBreakdownText)
      .replace(/\{\{교재비내역\}\}/g, textbookText);

    return content;
  };

  const resetNotificationForm = () => {
    setSelectedStudentForNotify(null);
    setSelectedPhoneTypes([]);
    setPaymentMethod("in_person");
    setCustomAmount("");
    setUseCustomAmount(false);
    setSmsContent("");
    setSkipSms(false);
    setNotificationTitle("");
    setDialogDiscountRate("");
    setDialogDiscountTarget("both");
    setDialogDiscountReason("");
    setDialogDiscountChanged(false);
    setIsScheduledSms(false);
    setScheduledDate("");
    setScheduledTime("09:00");
  };

  const handleOpenNotificationDialog = (studentId: string) => {
    setSelectedStudentForNotify(studentId);
    const student = students.find(s => s.id === studentId);
    if (student) {
      const phoneOptions = getParentPhoneOptions(student);
      const preSelected = notifyPhoneSelections[studentId];
      if (preSelected) {
        const preArr = preSelected.split(",").filter(t => phoneOptions.find(o => o.type === t)) as ("mother" | "father")[];
        setSelectedPhoneTypes(preArr.length > 0 ? preArr : phoneOptions.map(o => o.type));
      } else {
        setSelectedPhoneTypes(phoneOptions.map(o => o.type));
      }
      
      const studentEnrollmentsData = getStudentEnrollmentsForNotify(studentId)
        .filter(e => e.class && !e.class.isArchived);
      const { total: autoTotal, breakdown } = calculateFeesFromEnrollments(studentEnrollmentsData);
      const effectiveTotal = student.customTuitionAmount != null ? student.customTuitionAmount : autoTotal;
      const textbookTotal = calculateTextbookTotal(studentId);
      const currentCenterName = userCenters.find(c => c.id === selectedCenter)?.name || "";

      setDialogDiscountRate(student.discountRate != null ? String(student.discountRate) : "");
      setDialogDiscountTarget(student.discountTarget || "both");
      setDialogDiscountReason(student.discountReason || "");
      setDialogDiscountChanged(false);

      const sHasDiscount = student.discountRate != null && student.discountRate > 0;
      const sDRate = sHasDiscount ? student.discountRate! : 0;
      const sDTarget = student.discountTarget || "both";
      const sDiscountedTuition = (sDTarget === "tuition" || sDTarget === "both") ? Math.round(effectiveTotal * (1 - sDRate / 100)) : effectiveTotal;
      const sDiscountedTextbook = (sDTarget === "textbook" || sDTarget === "both") ? Math.round(textbookTotal * (1 - sDRate / 100)) : textbookTotal;

      const defaultContent = generateSmsContent(student.name, breakdown, sDiscountedTuition, sDiscountedTextbook, currentCenterName, studentId);

      const prevNotifs = notificationHistory
        .filter(n => n.studentId === studentId && n.messageContent && n.centerId === selectedCenter)
        .sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
      setSmsContent(prevNotifs.length > 0 ? prevNotifs[0].messageContent : defaultContent);

      if (student.customTuitionAmount != null) {
        setUseCustomAmount(true);
        setCustomAmount(String(student.customTuitionAmount));
      } else {
        setUseCustomAmount(false);
        setCustomAmount("");
      }
    }
    setNotificationDialogOpen(true);
  };


  const handleSendNotification = async (mode: "send" | "draft" = "send") => {
    const draftOnly = mode === "draft";
    const skipSendingSms = draftOnly || skipSms;

    if (!selectedStudentForNotify || !selectedCenter) {
      toast({ title: "오류", description: "학생을 선택해주세요.", variant: "destructive" });
      return;
    }
    if (draftOnly && !smsContent.trim()) {
      toast({ title: "오류", description: "저장할 문자 내용을 입력해주세요.", variant: "destructive" });
      return;
    }
    if (!skipSendingSms && selectedPhoneTypes.length === 0) {
      toast({ title: "오류", description: "수신자를 선택해주세요.", variant: "destructive" });
      return;
    }

    const student = students.find(s => s.id === selectedStudentForNotify);
    if (!student) {
      toast({ title: "오류", description: "학생 정보를 찾을 수 없습니다.", variant: "destructive" });
      return;
    }

    const phonesToSend = skipSendingSms
      ? [{ type: selectedPhoneTypes[0] || "mother" as const, phone: "" }]
      : selectedPhoneTypes.map(t => ({
          type: t,
          phone: t === "mother" ? (student.motherPhone || "") : (student.fatherPhone || ""),
        })).filter(p => p.phone);

    if (!skipSendingSms && phonesToSend.length === 0) {
      toast({ title: "오류", description: "학부모 연락처를 찾을 수 없습니다.", variant: "destructive" });
      return;
    }

    const studentEnrollmentsData = getStudentEnrollmentsForNotify(selectedStudentForNotify)
      .filter(e => e.class && !e.class.isArchived);
    
    const { total: autoTotal, breakdown } = calculateFeesFromEnrollments(studentEnrollmentsData);
    const textbookTotal = calculateTextbookTotal(selectedStudentForNotify);
    const studentCustomAmount = student.customTuitionAmount;
    const total = studentCustomAmount != null ? studentCustomAmount : autoTotal;

    const sendDRate = dialogDiscountRate.trim() !== "" ? parseInt(dialogDiscountRate, 10) : 0;
    const sendDTarget = dialogDiscountTarget || "both";
    const sendDiscountedTuition = (sendDTarget === "tuition" || sendDTarget === "both") ? Math.round(total * (1 - sendDRate / 100)) : total;
    const sendDiscountedTextbook = (sendDTarget === "textbook" || sendDTarget === "both") ? Math.round(textbookTotal * (1 - sendDRate / 100)) : textbookTotal;

    if (dialogDiscountChanged) {
      const rate = dialogDiscountRate.trim() === "" ? null : parseInt(dialogDiscountRate, 10);
      if (rate !== null && (isNaN(rate) || rate < 0 || rate > 100)) {
        toast({ title: "할인율은 0~100 사이의 숫자를 입력해주세요.", variant: "destructive" });
        return;
      }
      try {
        await updateDiscountMutation.mutateAsync({
          studentId: selectedStudentForNotify,
          discountRate: rate,
          discountReason: dialogDiscountReason,
          discountTarget: dialogDiscountTarget,
        });
      } catch {
        toast({ title: "할인 설정 저장 실패", description: "할인 설정을 저장하지 못했습니다. 다시 시도해주세요.", variant: "destructive" });
        return;
      }
    }

    const isCustom = useCustomAmount && customAmount;
    const sentAmount = isCustom ? parseInt(customAmount, 10) : sendDiscountedTuition;
    const finalTextbookTotal = isCustom ? 0 : sendDiscountedTextbook;

    if (isNaN(sentAmount) || sentAmount < 0) {
      toast({ title: "오류", description: "올바른 금액을 입력해주세요.", variant: "destructive" });
      return;
    }

    let scheduledDateISO: string | undefined;
    if (!skipSendingSms && isScheduledSms && scheduledDate && scheduledTime) {
      const dt = new Date(`${scheduledDate}T${scheduledTime}:00`);
      if (dt <= new Date()) {
        toast({ title: "오류", description: "예약 시간은 현재 시간 이후여야 합니다.", variant: "destructive" });
        return;
      }
      scheduledDateISO = dt.toISOString();
    }

    for (const target of phonesToSend) {
      sendNotificationMutation.mutate({
        studentId: selectedStudentForNotify,
        parentId: null,
        centerId: selectedCenter,
        title: notificationTitle.trim() || "",
        calculatedTotal: sendDiscountedTuition,
        sentAmount,
        feeBreakdown: breakdown,
        paymentMethod,
        messageContent: smsContent,
        recipientPhone: target.phone,
        recipientType: target.type,
        textbookTotal: finalTextbookTotal,
        skipSms: skipSendingSms,
        draftOnly,
        scheduledDate: scheduledDateISO,
      });
    }
  };

  const getClassDisplayName = (cls?: Class | null) => {
    if (!cls) return "알 수 없는 수업";
    return cls.subject ? `${cls.name} ${cls.subject}반` : cls.name;
  };

  const calculateFeesFromEnrollments = (studentEnrollments: (Enrollment & { class?: Class })[]): { total: number; breakdown: { className: string; fee: number; isFirst: boolean }[] } => {
    const validEnrollments = studentEnrollments.filter(e => e.class && !e.class.isArchived);
    if (validEnrollments.length === 0) return { total: 0, breakdown: [] };

    const sortedByBaseFee = [...validEnrollments].sort((a, b) => (b.class?.baseFee || 0) - (a.class?.baseFee || 0));
    
    const breakdown = sortedByBaseFee.map((enrollment, index) => ({
      className: getClassDisplayName(enrollment.class),
      fee: index === 0 ? (enrollment.class?.baseFee || 0) : (enrollment.class?.additionalFee || 0),
      isFirst: index === 0,
    }));

    const total = breakdown.reduce((sum, item) => sum + item.fee, 0);
    return { total, breakdown };
  };

  const getStudentTextbookDetails = (studentId: string): { name: string; price: number; className: string }[] => {
    const seen = new Set<string>();
    return textbookPurchases
      .filter(p => p.studentId === studentId)
      .filter(p => {
        if (p.classTextbookId) {
          if (seen.has(p.classTextbookId)) return false;
          seen.add(p.classTextbookId);
          return true;
        }
        return true;
      })
      .map(p => {
        let className = "";
        if (p.classTextbookId) {
          const ct = classTextbooksList.find(t => t.id === p.classTextbookId);
          if (ct) {
            const cls = classes.find(c => c.id === ct.classId);
            className = cls ? `${cls.name} ${cls.subject}반` : "";
          }
        }
        return { name: p.textbookName, price: p.price, className };
      });
  };

  const calculateTextbookTotal = (studentId: string): number => {
    return getStudentTextbookDetails(studentId).reduce((sum, t) => sum + (t.price || 0), 0);
  };

  const calculateFees = (enrollments: EnrollmentWithClass[]): { total: number; breakdown: { className: string; fee: number; isFirst: boolean }[] } => {
    const validEnrollments = enrollments.filter(e => e.class && !e.class.isArchived);
    if (validEnrollments.length === 0) return { total: 0, breakdown: [] };

    const sortedByBaseFee = [...validEnrollments].sort((a, b) => (b.class?.baseFee || 0) - (a.class?.baseFee || 0));
    
    const breakdown = sortedByBaseFee.map((enrollment, index) => ({
      className: getClassDisplayName(enrollment.class),
      fee: index === 0 ? (enrollment.class?.baseFee || 0) : (enrollment.class?.additionalFee || 0),
      isFirst: index === 0,
    }));

    const total = breakdown.reduce((sum, item) => sum + item.fee, 0);
    return { total, breakdown };
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">로그인이 필요합니다</p>
      </div>
    );
  }

  if (isPrincipalOrAdmin) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <AlertDialog open={showPaymentNotice} onOpenChange={(open) => {
          if (!open) {
            const key = `tuition_payment_notice_seen_${user?.id || ""}`;
            localStorage.setItem(key, "true");
          }
          setShowPaymentNotice(open);
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl text-center">
                교육비 결제 기능 이용 가능!
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base text-center">
                담당자에게 문의하세요!
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-center">
              <AlertDialogAction data-testid="button-close-payment-notice">확인</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={tossConsentDialogOpen} onOpenChange={setTossConsentDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center text-lg">
                <CreditCard className="h-8 w-8 mx-auto mb-2 text-primary" />
                교육비 결제 기능을 활성화하시겠습니까?
              </DialogTitle>
              <DialogDescription className="text-center text-sm leading-relaxed pt-2">
                토스페이먼츠와 연동되어 교육비 결제를 간편하게 관리할 수 있습니다. 연동은 원장님 동의 후 진행되며, 필요한 정보만 안전하게 사용됩니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col gap-2 sm:flex-col">
              <Button
                onClick={() => tossConsentMutation.mutate()}
                disabled={tossConsentMutation.isPending}
                className="w-full"
                data-testid="button-toss-consent-agree"
              >
                {tossConsentMutation.isPending ? "처리 중..." : "토스페이먼츠 연동에 동의합니다"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setTossConsentDialogOpen(false)}
                className="w-full"
                data-testid="button-toss-consent-dismiss"
              >
                다음에 연동
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={tossApprovedDialogOpen} onOpenChange={setTossApprovedDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-center text-lg">
                <CreditCard className="h-8 w-8 mx-auto mb-2 text-green-600" />
                토스페이먼츠 연동이 승인되었습니다!
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center text-sm leading-relaxed">
                이제 교육비 결제 기능을 이용하실 수 있습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-center">
              <AlertDialogAction data-testid="button-toss-approved-confirm">확인</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {isPrincipal && tossConsentStatus === "pending" && (
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-blue-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">토스페이먼츠 연동 승인 대기 중</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">승인 후 이용 가능합니다. 빠르게 승인 처리해 드리겠습니다!</p>
            </div>
          </div>
        )}

        <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="w-5 h-5" />
                수강료 설정
              </DialogTitle>
              <DialogDescription>
                {discountStudentId ? students.find(s => s.id === discountStudentId)?.name : ""} 학생의 수강료와 할인을 설정합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>커스텀 수강료 (원)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={customTuitionInput}
                    onChange={(e) => setCustomTuitionInput(e.target.value)}
                    placeholder="비워두면 자동 계산"
                    data-testid="input-custom-tuition"
                  />
                  {customTuitionInput && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setCustomTuitionInput("")}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">비워두면 수업 기본금/추가금 기준으로 자동 계산됩니다.</p>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3 flex items-center gap-1">
                  <Percent className="w-4 h-4" />
                  할인 설정
                </p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">할인율 (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={discountRate}
                      onChange={(e) => setDiscountRate(e.target.value)}
                      placeholder="예: 10"
                      data-testid="input-discount-rate"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">적용 대상</Label>
                    <Select value={discountTarget} onValueChange={setDiscountTarget}>
                      <SelectTrigger data-testid="select-discount-target">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">수강료 + 교재비</SelectItem>
                        <SelectItem value="tuition">수강료만</SelectItem>
                        <SelectItem value="textbook">교재비만</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">할인 사유</Label>
                    <Input
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      placeholder="예: 형제 할인, 장기 등록 할인"
                      data-testid="input-discount-reason"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setDiscountDialogOpen(false)}
              >
                취소
              </Button>
              <Button
                onClick={() => {
                  if (discountStudentId) {
                    const rate = discountRate.trim() === "" ? null : parseInt(discountRate, 10);
                    if (rate !== null && (isNaN(rate) || rate < 0 || rate > 100)) {
                      toast({ title: "할인율은 0~100 사이의 숫자를 입력해주세요.", variant: "destructive" });
                      return;
                    }
                    const tuitionVal = customTuitionInput.trim();
                    const tuitionAmount = tuitionVal === "" ? null : parseInt(tuitionVal, 10);
                    if (tuitionAmount !== null && isNaN(tuitionAmount)) {
                      toast({ title: "올바른 수강료를 입력해주세요.", variant: "destructive" });
                      return;
                    }
                    updateCustomTuitionMutation.mutate({
                      studentId: discountStudentId,
                      amount: tuitionAmount,
                    });
                    updateDiscountMutation.mutate({
                      studentId: discountStudentId,
                      discountRate: rate,
                      discountReason: discountReason,
                      discountTarget: discountTarget,
                    });
                  }
                }}
                disabled={updateDiscountMutation.isPending || updateCustomTuitionMutation.isPending}
                data-testid="button-save-tuition-settings"
              >
                저장
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-6 h-6" />
              <h1 className="text-2xl font-bold">교육비 관리</h1>
            </div>
            <ManualButton menuKey="tuition" />
          </div>
        </div>

        <Tabs defaultValue="payment-status" className="w-full">
          <TabsList className="mb-4 h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="payment-status" data-testid="tab-payment-status">
              <CreditCard className="w-4 h-4 mr-2" />
              결제 현황
            </TabsTrigger>
            <TabsTrigger value="notification" data-testid="tab-notification">
              <Send className="w-4 h-4 mr-2" />
              교육비 안내
            </TabsTrigger>
            <TabsTrigger value="textbook" data-testid="tab-textbook">
              <Book className="w-4 h-4 mr-2" />
              교재비
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <BookOpen className="w-4 h-4 mr-2" />
              교육비 설정
            </TabsTrigger>
            <TabsTrigger value="sms-template" data-testid="tab-sms-template">
              <MessageSquare className="w-4 h-4 mr-2" />
              문자설정
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="toss-consent" data-testid="tab-toss-consent">
                <Building className="w-4 h-4 mr-2" />
                신청자 명단
                {(allCenterStats.filter((c: any) => c.tossConsentStatus === "pending").length + pendingRegistrations.filter((r: any) => r.tossConsentAgreed).length) > 0 && (
                  <Badge variant="destructive" className="ml-1.5 px-1.5 py-0 text-[10px] min-w-[18px] h-[18px]">
                    {allCenterStats.filter((c: any) => c.tossConsentStatus === "pending").length + pendingRegistrations.filter((r: any) => r.tossConsentAgreed).length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  수업별 교육비 설정
                </CardTitle>
              </CardHeader>
              <CardContent>
                {classesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <p className="text-muted-foreground">로딩 중...</p>
                  </div>
                ) : classes.filter(c => !c.isArchived).length === 0 ? (
                  <div className="flex items-center justify-center h-32">
                    <p className="text-muted-foreground">등록된 수업이 없습니다</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(classesByTeacher.grouped).map(([teacherId, { teacher, classes: teacherClasses }]) => (
                      <div key={teacherId} className="border rounded-lg overflow-hidden">
                        <button
                          type="button"
                          className="w-full bg-muted/50 px-4 py-3 border-b flex items-center justify-between hover-elevate"
                          onClick={() => toggleTeacherExpanded(teacherId)}
                          data-testid={`button-toggle-teacher-${teacherId}`}
                        >
                          <h3 className="font-semibold flex items-center gap-2">
                            <User className="w-4 h-4" />
                            {teacher?.name || "선생님"} 선생님
                            <Badge variant="secondary" className="ml-2">{teacherClasses.length}개 수업</Badge>
                          </h3>
                          <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${expandedTeachers.has(teacherId) ? "rotate-180" : ""}`} />
                        </button>
                        {expandedTeachers.has(teacherId) && (
                        <table className="w-full table-fixed">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="text-left p-3 font-medium text-sm w-[20%]">수업명</th>
                              <th className="text-left p-3 font-medium text-sm w-[20%]">과목</th>
                              <th className="text-right p-3 font-medium text-sm w-[20%]">기본금</th>
                              <th className="text-right p-3 font-medium text-sm w-[20%]">추가금</th>
                              <th className="text-center p-3 font-medium text-sm w-[20%]">관리</th>
                            </tr>
                          </thead>
                          <tbody>
                            {teacherClasses.map((cls) => (
                              <tr key={cls.id} className="border-b last:border-b-0">
                                <td className="p-3 font-medium">{cls.name}</td>
                                <td className="p-3 text-muted-foreground">{cls.subject}</td>
                                {editingClass === cls.id ? (
                                  <>
                                    <td className="p-3 text-right">
                                      <Input
                                        type="number"
                                        value={baseFee}
                                        onChange={(e) => setBaseFee(Number(e.target.value))}
                                        className="w-full text-right"
                                        data-testid={`input-base-fee-${cls.id}`}
                                      />
                                    </td>
                                    <td className="p-3 text-right">
                                      <Input
                                        type="number"
                                        value={additionalFee}
                                        onChange={(e) => setAdditionalFee(Number(e.target.value))}
                                        className="w-full text-right"
                                        data-testid={`input-additional-fee-${cls.id}`}
                                      />
                                    </td>
                                    <td className="p-3 text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        <Button 
                                          size="sm" 
                                          onClick={() => handleSave(cls.id)}
                                          disabled={updatePricingMutation.isPending}
                                          data-testid={`button-save-${cls.id}`}
                                        >
                                          <Save className="w-4 h-4 mr-1" />
                                          저장
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="outline" 
                                          onClick={handleCancel}
                                          data-testid={`button-cancel-${cls.id}`}
                                        >
                                          취소
                                        </Button>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="p-3 text-right">{formatCurrency(cls.baseFee)}</td>
                                    <td className="p-3 text-right">{formatCurrency(cls.additionalFee)}</td>
                                    <td className="p-3 text-center">
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={() => handleEditClass(cls)}
                                        data-testid={`button-edit-${cls.id}`}
                                      >
                                        수정
                                      </Button>
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        )}
                      </div>
                    ))}
                    
                    {classesByTeacher.unassigned.length > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="bg-muted/50 px-4 py-3 border-b">
                          <h3 className="font-semibold flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            담당 선생님 미지정
                            <Badge variant="outline" className="ml-2">{classesByTeacher.unassigned.length}개 수업</Badge>
                          </h3>
                        </div>
                        <table className="w-full table-fixed">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="text-left p-3 font-medium text-sm w-[20%]">수업명</th>
                              <th className="text-left p-3 font-medium text-sm w-[20%]">과목</th>
                              <th className="text-right p-3 font-medium text-sm w-[20%]">기본금</th>
                              <th className="text-right p-3 font-medium text-sm w-[20%]">추가금</th>
                              <th className="text-center p-3 font-medium text-sm w-[20%]">관리</th>
                            </tr>
                          </thead>
                          <tbody>
                            {classesByTeacher.unassigned.map((cls) => (
                              <tr key={cls.id} className="border-b last:border-b-0">
                                <td className="p-3 font-medium">{cls.name}</td>
                                <td className="p-3 text-muted-foreground">{cls.subject}</td>
                                {editingClass === cls.id ? (
                                  <>
                                    <td className="p-3 text-right">
                                      <Input
                                        type="number"
                                        value={baseFee}
                                        onChange={(e) => setBaseFee(Number(e.target.value))}
                                        className="w-full text-right"
                                        data-testid={`input-base-fee-${cls.id}`}
                                      />
                                    </td>
                                    <td className="p-3 text-right">
                                      <Input
                                        type="number"
                                        value={additionalFee}
                                        onChange={(e) => setAdditionalFee(Number(e.target.value))}
                                        className="w-full text-right"
                                        data-testid={`input-additional-fee-${cls.id}`}
                                      />
                                    </td>
                                    <td className="p-3 text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        <Button 
                                          size="sm" 
                                          onClick={() => handleSave(cls.id)}
                                          disabled={updatePricingMutation.isPending}
                                          data-testid={`button-save-${cls.id}`}
                                        >
                                          <Save className="w-4 h-4 mr-1" />
                                          저장
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="outline" 
                                          onClick={handleCancel}
                                          data-testid={`button-cancel-${cls.id}`}
                                        >
                                          취소
                                        </Button>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="p-3 text-right">{formatCurrency(cls.baseFee)}</td>
                                    <td className="p-3 text-right">{formatCurrency(cls.additionalFee)}</td>
                                    <td className="p-3 text-center">
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={() => handleEditClass(cls)}
                                        data-testid={`button-edit-${cls.id}`}
                                      >
                                        수정
                                      </Button>
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  교육비 계산 방법
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground space-y-2">
                <p>학생이 여러 수업을 수강할 경우:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>기본금이 가장 높은 수업 1개는 <strong>기본금</strong>으로 계산</li>
                  <li>나머지 수업들은 각각 <strong>추가금</strong>으로 계산</li>
                  <li>총 교육비 = 최고 기본금 + 나머지 수업들의 추가금 합계</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  교육비 규정
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="guidance-text">안내 문구</Label>
                  <Textarea
                    id="guidance-text"
                    placeholder="학부모님과 학생들에게 보여줄 교육비 안내 문구를 입력하세요..."
                    value={guidanceText}
                    onChange={(e) => setGuidanceText(e.target.value)}
                    rows={5}
                    data-testid="textarea-guidance-text"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>안내 이미지</Label>
                  <div className="flex flex-wrap gap-4">
                    {guidanceImages.map((url, index) => (
                      <div key={index} className="relative group">
                        <img 
                          src={url} 
                          alt={`안내 이미지 ${index + 1}`} 
                          className="w-32 h-32 object-cover rounded-md border"
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute -top-2 -right-2 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemoveImage(index)}
                          data-testid={`button-remove-image-${index}`}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    <label className="w-32 h-32 flex flex-col items-center justify-center border-2 border-dashed rounded-md cursor-pointer hover-elevate">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleImageUpload}
                        disabled={isUploadingImage}
                        data-testid="input-upload-image"
                      />
                      {isUploadingImage ? (
                        <span className="text-xs text-muted-foreground">업로드중...</span>
                      ) : (
                        <>
                          <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                          <span className="text-xs text-muted-foreground">이미지 추가</span>
                        </>
                      )}
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">최대 5MB, 이미지 파일만 업로드 가능</p>
                </div>

                <Button 
                  onClick={handleSaveGuidance}
                  disabled={updateGuidanceMutation.isPending}
                  data-testid="button-save-guidance"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateGuidanceMutation.isPending ? "저장중..." : "규정 저장"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  공개 설정
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>선생님에게 교육비 공개</Label>
                    <p className="text-sm text-muted-foreground">
                      활성화하면 선생님 계정에서 담당 학생들의 총 교육비를 확인할 수 있습니다
                    </p>
                  </div>
                  <Switch
                    checked={centerDetail?.tuitionVisibleToTeachers ?? false}
                    onCheckedChange={(checked) => toggleTeacherVisibilityMutation.mutate(checked)}
                    disabled={toggleTeacherVisibilityMutation.isPending}
                    data-testid="switch-tuition-visible-to-teachers"
                  />
                </div>
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="sms-template" className="space-y-6">
            <SmsTemplateSettings centerId={selectedCenter} />
          </TabsContent>

          <TabsContent value="notification" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  교육비 안내 문자 발송
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      학부모에게 교육비 안내 문자를 발송합니다. 학생을 선택하면 연결된 학부모에게 계산된 교육비가 전송됩니다.
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          const [y, m] = notifyTabMonth.split("-").map(Number);
                          const d = new Date(y, m - 2, 1);
                          setNotifyTabMonth(format(d, "yyyy-MM"));
                        }}
                        data-testid="button-notify-prev-month"
                      >
                        <ChevronDown className="w-4 h-4 rotate-90" />
                      </Button>
                      <span className="font-semibold text-base min-w-[100px] text-center" data-testid="text-notify-month">
                        {(() => {
                          const [y, m] = notifyTabMonth.split("-").map(Number);
                          return `${y}년 ${m}월`;
                        })()}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          const [y, m] = notifyTabMonth.split("-").map(Number);
                          const d = new Date(y, m, 1);
                          setNotifyTabMonth(format(d, "yyyy-MM"));
                        }}
                        data-testid="button-notify-next-month"
                      >
                        <ChevronDown className="w-4 h-4 -rotate-90" />
                      </Button>
                    </div>
                    
                    {students.length === 0 ? (
                      <p className="text-muted-foreground py-4">등록된 학생이 없습니다</p>
                    ) : (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="학생 이름 검색"
                            value={notifyStudentSearch}
                            onChange={(e) => setNotifyStudentSearch(e.target.value)}
                            className="pl-10"
                            data-testid="input-notify-student-search"
                          />
                          {notifyStudentSearch && (
                            <button
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              onClick={() => setNotifyStudentSearch("")}
                              data-testid="button-clear-notify-search"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        {(() => {
                          const searchQuery = notifyStudentSearch.trim().toLowerCase();
                          const filteredStudents = searchQuery
                            ? students.filter((s: any) => s.name?.toLowerCase().includes(searchQuery))
                            : students;

                          if (searchQuery && filteredStudents.length === 0) {
                            return <p className="text-sm text-muted-foreground text-center py-4">검색 결과가 없습니다</p>;
                          }

                          // Group students by grade (descending order: 고3 first)
                          const gradeOrder = ["성인", "고3", "고2", "고1", "중3", "중2", "중1", "초6", "초5", "초4", "초3", "초2", "초1"];
                          const studentsByGrade: Record<string, typeof students> = {};
                          filteredStudents.forEach((student: any) => {
                            const grade = normalizeGrade(student.grade) || "미지정";
                            if (!studentsByGrade[grade]) {
                              studentsByGrade[grade] = [];
                            }
                            studentsByGrade[grade].push(student);
                          });
                          Object.values(studentsByGrade).forEach(arr => arr.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ko")));
                          
                          const sortedGrades = Object.keys(studentsByGrade).sort((a, b) => {
                            const indexA = gradeOrder.indexOf(a);
                            const indexB = gradeOrder.indexOf(b);
                            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
                            if (indexA === -1) return 1;
                            if (indexB === -1) return -1;
                            return indexA - indexB;
                          });
                          
                          return sortedGrades.map((grade) => (
                            <Collapsible key={grade} defaultOpen={!!searchQuery} className="border rounded-md">
                              <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 hover-elevate rounded-md" data-testid={`trigger-grade-${grade}`}>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-lg">{grade}</span>
                                  <Badge variant="secondary">{studentsByGrade[grade].length}명</Badge>
                                </div>
                                <ChevronDown className="w-5 h-5 transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="border-t">
                                  {studentsByGrade[grade].map((student) => {
                                    const phoneOptions = getParentPhoneOptions(student);
                                    const studentEnrollmentsData = getStudentEnrollmentsForNotify(student.id);
                                    const { total: autoTotal } = calculateFeesFromEnrollments(studentEnrollmentsData);
                                    const hasCustom = student.customTuitionAmount != null;
                                    const tuitionTotal = hasCustom ? student.customTuitionAmount! : autoTotal;
                                    const textbookTotal = calculateTextbookTotal(student.id);

                                    const hasDiscount = student.discountRate != null && student.discountRate > 0;
                                    const dRate = hasDiscount ? student.discountRate! : 0;
                                    const dTarget = student.discountTarget || "both";
                                    const discountedTuition = (dTarget === "tuition" || dTarget === "both") ? Math.round(tuitionTotal * (1 - dRate / 100)) : tuitionTotal;
                                    const discountedTextbook = (dTarget === "textbook" || dTarget === "both") ? Math.round(textbookTotal * (1 - dRate / 100)) : textbookTotal;
                                    const grandTotal = discountedTuition + discountedTextbook;

                                    const studentNotifications = notificationHistory.filter(n => {
                                      if (n.studentId !== student.id) return false;
                                      if (!n.createdAt) return false;
                                      // Exclude drafts: they are saved message text only, not actual sent notifications
                                      if (n.status === "draft") return false;
                                      return format(new Date(n.createdAt), "yyyy-MM") === notifyTabMonth;
                                    });
                                    const latestNotification = studentNotifications.length > 0
                                      ? studentNotifications.reduce((latest, n) =>
                                          new Date(n.createdAt!) > new Date(latest.createdAt!) ? n : latest
                                        )
                                      : null;
                                    const hasPaidNotification = studentNotifications.some(n => n.paymentStatus === "paid");
                                    const hasPendingNotification = studentNotifications.some(n => n.paymentStatus === "pending");
                                    const aggregatedPaymentStatus: "paid" | "pending" | "cancelled" | null = studentNotifications.length === 0
                                      ? null
                                      : hasPendingNotification
                                        ? "pending"
                                        : hasPaidNotification
                                          ? "paid"
                                          : "cancelled";

                                    return (
                                      <div key={student.id} className="border-b p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-base">{student.name}</span>
                                            {hasDiscount && (
                                              <Badge variant="outline" className="text-[10px] px-1 py-0 text-orange-600 border-orange-300">
                                                {dRate}%할인
                                              </Badge>
                                            )}
                                            <Switch
                                              checked={student.tuitionVisibleToStudent !== false}
                                              onCheckedChange={(checked) => {
                                                toggleTuitionVisibilityMutation.mutate({ studentId: student.id, visible: checked });
                                              }}
                                              data-testid={`switch-tuition-visibility-${student.id}`}
                                            />
                                          </div>
                                          <div className="flex items-center gap-1">
                                            {aggregatedPaymentStatus ? (
                                              aggregatedPaymentStatus === "paid" ? (
                                                <Badge variant="default">결제완료</Badge>
                                              ) : aggregatedPaymentStatus === "cancelled" ? (
                                                <Badge variant="secondary">취소</Badge>
                                              ) : (
                                                <Badge variant="outline">결제대기</Badge>
                                              )
                                            ) : null}
                                          </div>
                                        </div>

                                        {latestNotification ? (() => {
                                          const sentTuition = latestNotification.sentAmount || 0;
                                          const sentTextbook = latestNotification.textbookTotal || 0;
                                          const sentTotal = sentTuition + sentTextbook;
                                          return (
                                            <div className="space-y-1">
                                              <div className="grid grid-cols-3 gap-2 text-sm">
                                                <div>
                                                  <span className="text-muted-foreground">수강료</span>
                                                  <div className="mt-0.5 tabular-nums">{formatCurrency(sentTuition)}</div>
                                                </div>
                                                <div>
                                                  <span className="text-muted-foreground">교재비</span>
                                                  <div className="mt-0.5 tabular-nums">{sentTextbook > 0 ? formatCurrency(sentTextbook) : "-"}</div>
                                                </div>
                                                <div>
                                                  <span className="text-muted-foreground">총 교육비</span>
                                                  <div className="mt-0.5 font-semibold tabular-nums">{formatCurrency(sentTotal)}</div>
                                                </div>
                                              </div>
                                              {(sentTuition !== discountedTuition || sentTextbook !== discountedTextbook) && (
                                                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                  <span>현재: 수강료 {formatCurrency(discountedTuition)}</span>
                                                  {discountedTextbook > 0 && <span>+ 교재비 {formatCurrency(discountedTextbook)}</span>}
                                                  <span>= {formatCurrency(grandTotal)}</span>
                                                  <button
                                                    type="button"
                                                    className="text-blue-500 hover:text-blue-700 underline ml-1"
                                                    onClick={() => { openTuitionEditDialog(student.id); }}
                                                    data-testid={`button-edit-custom-tuition-${student.id}`}
                                                  >
                                                    수정
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })() : (
                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                          <div>
                                            <span className="text-muted-foreground">수강료</span>
                                            <div className="mt-0.5">
                                              <button
                                                type="button"
                                                className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                                                onClick={() => { openTuitionEditDialog(student.id); }}
                                                data-testid={`button-edit-custom-tuition-${student.id}`}
                                              >
                                                {hasDiscount && (dTarget === "tuition" || dTarget === "both") && tuitionTotal > 0 ? (
                                                  <span className="text-orange-600 dark:text-orange-400 font-medium">{formatCurrency(discountedTuition)}</span>
                                                ) : hasCustom ? (
                                                  <span className="text-blue-600 dark:text-blue-400 font-medium">{formatCurrency(tuitionTotal)}</span>
                                                ) : (
                                                  <span>{formatCurrency(tuitionTotal)}</span>
                                                )}
                                                <Edit className="w-3 h-3 opacity-40" />
                                              </button>
                                              {hasCustom && (
                                                <div className="text-[10px] text-muted-foreground line-through">{formatCurrency(autoTotal)}</div>
                                              )}
                                            </div>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">교재비</span>
                                            <div className="mt-0.5">
                                              {hasDiscount && (dTarget === "textbook" || dTarget === "both") && textbookTotal > 0 ? (
                                                <div>
                                                  <span className="text-orange-600 dark:text-orange-400 font-medium">{formatCurrency(discountedTextbook)}</span>
                                                  <span className="text-[10px] text-muted-foreground line-through ml-1">{formatCurrency(textbookTotal)}</span>
                                                </div>
                                              ) : (
                                                <span>{formatCurrency(textbookTotal)}</span>
                                              )}
                                            </div>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">총 교육비</span>
                                            <div className="mt-0.5 font-semibold">{formatCurrency(grandTotal)}</div>
                                          </div>
                                        </div>
                                        )}

                                        {phoneOptions.length >= 2 && (
                                          <div className="flex items-center gap-2 text-sm">
                                            <Smartphone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                            <div className="flex gap-1.5">
                                              {phoneOptions.map((option) => {
                                                const currentSelections = notifyPhoneSelections[student.id]
                                                  ? notifyPhoneSelections[student.id].split(",")
                                                  : phoneOptions.map(o => o.type);
                                                const isSelected = currentSelections.includes(option.type);
                                                return (
                                                  <button
                                                    key={option.type}
                                                    type="button"
                                                    className={cn(
                                                      "px-2 py-0.5 rounded-md text-xs border transition-colors",
                                                      isSelected
                                                        ? "bg-primary text-primary-foreground border-primary"
                                                        : "bg-muted hover:bg-muted/80 border-transparent"
                                                    )}
                                                    onClick={() => {
                                                      setNotifyPhoneSelections(prev => {
                                                        const curr = prev[student.id]
                                                          ? prev[student.id].split(",")
                                                          : phoneOptions.map(o => o.type);
                                                        const next = curr.includes(option.type)
                                                          ? curr.filter(t => t !== option.type)
                                                          : [...curr, option.type];
                                                        if (next.length === 0) return prev;
                                                        return { ...prev, [student.id]: next.join(",") };
                                                      });
                                                    }}
                                                    data-testid={`button-phone-select-${student.id}-${option.type}`}
                                                  >
                                                    {option.label} ({option.phone.slice(-4)})
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                        <div className="flex items-center justify-between text-sm">
                                          <span className="text-muted-foreground">
                                            {latestNotification?.createdAt
                                              ? `${latestNotification.status === "scheduled" ? "예약 발송" : "발송"}: ${new Date(latestNotification.createdAt).toLocaleDateString("ko-KR")}`
                                              : "미발송"}
                                            {phoneOptions.length === 1 && (
                                              <span className="ml-1">({phoneOptions[0].label} {phoneOptions[0].phone.slice(-4)})</span>
                                            )}
                                          </span>
                                          <div className="flex items-center gap-1.5">
                                            <Button
                                              size="sm"
                                              className="h-7 text-xs px-2"
                                              onClick={() => handleOpenNotificationDialog(student.id)}
                                              disabled={phoneOptions.length === 0}
                                              data-testid={`button-send-notification-${student.id}`}
                                            >
                                              <Send className="w-3 h-3 mr-1" />
                                              발송
                                            </Button>
                                            {studentNotifications.length > 0 && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-xs px-2"
                                                onClick={() => {
                                                  setHistoryStudentId(student.id);
                                                  setHistoryDialogOpen(true);
                                                }}
                                                data-testid={`button-history-${student.id}`}
                                              >
                                                <History className="w-3 h-3 mr-1" />
                                                내역
                                              </Button>
                                            )}
                                            {latestNotification && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-xs px-2"
                                                onClick={() => handleOpenPaymentStatusDialog(
                                                  latestNotification.id,
                                                  latestNotification.paymentStatus,
                                                  getEffectivePaymentMethod(latestNotification),
                                                  latestNotification.paymentMemo
                                                )}
                                                data-testid={`button-change-status-${student.id}`}
                                              >
                                                상태변경
                                              </Button>
                                            )}
                                          </div>
                                        </div>

                                        {isPrincipalOrAdmin && (
                                          <div className="mt-1">
                                            {editingMemoStudentId === student.id ? (
                                              <div className="flex gap-1.5 items-start">
                                                <Textarea
                                                  value={editingMemoText}
                                                  onChange={(e) => setEditingMemoText(e.target.value)}
                                                  placeholder="교육비 관련 메모 (다음달에도 유지됩니다)"
                                                  className="text-xs min-h-[56px] resize-none flex-1"
                                                  maxLength={200}
                                                  data-testid={`textarea-tuition-memo-${student.id}`}
                                                />
                                                <div className="flex flex-col gap-1">
                                                  <Button
                                                    size="sm"
                                                    className="h-7 text-xs px-2"
                                                    onClick={() => updateTuitionMemoMutation.mutate({ studentId: student.id, memo: editingMemoText })}
                                                    disabled={updateTuitionMemoMutation.isPending}
                                                    data-testid={`button-save-memo-${student.id}`}
                                                  >
                                                    <Save className="w-3 h-3" />
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 text-xs px-2"
                                                    onClick={() => setEditingMemoStudentId(null)}
                                                    data-testid={`button-cancel-memo-${student.id}`}
                                                  >
                                                    <X className="w-3 h-3" />
                                                  </Button>
                                                </div>
                                              </div>
                                            ) : (
                                              <button
                                                type="button"
                                                className={cn(
                                                  "flex items-start gap-1.5 text-xs w-full text-left rounded px-1.5 py-1 transition-colors",
                                                  student.tuitionMemo
                                                    ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
                                                    : "text-muted-foreground hover:bg-muted/50"
                                                )}
                                                onClick={() => {
                                                  setEditingMemoStudentId(student.id);
                                                  setEditingMemoText(student.tuitionMemo || "");
                                                }}
                                                data-testid={`button-edit-memo-${student.id}`}
                                              >
                                                <Edit className="w-3 h-3 mt-0.5 shrink-0" />
                                                <span className="whitespace-pre-wrap">{student.tuitionMemo || "메모 추가"}</span>
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          ));
                        })()}
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>

            <Dialog open={notificationDialogOpen} onOpenChange={setNotificationDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                교육비 안내 문자 발송
              </DialogTitle>
            </DialogHeader>
            {selectedStudentForNotify && (
              <div className="space-y-4">
                {(() => {
                  const student = students.find(s => s.id === selectedStudentForNotify);
                  const phoneOptions = student ? getParentPhoneOptions(student) : [];
                  const studentEnrollmentsData = getStudentEnrollmentsForNotify(selectedStudentForNotify);
                  const { total: rawTotal, breakdown } = calculateFeesFromEnrollments(studentEnrollmentsData);
                  const rawTextbookTotal = calculateTextbookTotal(selectedStudentForNotify);
                  const effectiveTotal = student?.customTuitionAmount != null ? student.customTuitionAmount : rawTotal;
                  const dRate = dialogDiscountRate.trim() !== "" ? parseInt(dialogDiscountRate, 10) : 0;
                  const dHasDiscount = !isNaN(dRate) && dRate > 0;
                  const dTarget = dialogDiscountTarget || "both";
                  const total = dHasDiscount && (dTarget === "tuition" || dTarget === "both") ? Math.round(effectiveTotal * (1 - dRate / 100)) : effectiveTotal;
                  const textbookTotalForDialog = dHasDiscount && (dTarget === "textbook" || dTarget === "both") ? Math.round(rawTextbookTotal * (1 - dRate / 100)) : rawTextbookTotal;
                  
                  return (
                    <>
                      <div className="space-y-2">
                        <Label>학생</Label>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                          <User className="w-4 h-4" />
                          <span>{student?.name}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notificationTitle">제목 (학생 결제 내역에 표시)</Label>
                        <Input
                          id="notificationTitle"
                          value={notificationTitle}
                          onChange={(e) => setNotificationTitle(e.target.value)}
                          placeholder="예: 3월 수강료, 봄학기 교육비"
                          data-testid="input-notification-title"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>수신자 {phoneOptions.length > 1 && <span className="text-xs text-muted-foreground font-normal ml-1">(복수 선택 가능)</span>}</Label>
                        {phoneOptions.length >= 1 ? (
                          <div className="flex flex-col gap-1.5">
                            {phoneOptions.map((option) => {
                              const isChecked = selectedPhoneTypes.includes(option.type);
                              return (
                                <button
                                  key={option.type}
                                  type="button"
                                  className={cn(
                                    "flex items-center gap-2 p-2 rounded-md border text-sm transition-colors text-left",
                                    isChecked
                                      ? "bg-primary/10 border-primary text-primary"
                                      : "bg-muted border-transparent hover:bg-muted/80"
                                  )}
                                  onClick={() => {
                                    setSelectedPhoneTypes(prev => {
                                      if (prev.includes(option.type)) {
                                        return prev.filter(t => t !== option.type);
                                      }
                                      return [...prev, option.type];
                                    });
                                  }}
                                  data-testid={`toggle-phone-${option.type}`}
                                >
                                  <div className={cn(
                                    "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0",
                                    isChecked ? "bg-primary border-primary" : "border-muted-foreground/40"
                                  )}>
                                    {isChecked && <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 12 12"><path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                  </div>
                                  <User className="w-4 h-4 shrink-0" />
                                  <span>{option.label} ({option.phone})</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-destructive text-sm">연락처가 없습니다</div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>교육비 내역</Label>
                        <div className="p-3 bg-muted rounded-md space-y-1 text-sm">
                          {breakdown.map((item, index) => (
                            <div key={index} className="flex justify-between">
                              <span>{item.className} ({item.isFirst ? "기본" : "추가"})</span>
                              <span>{formatCurrency(item.fee)}</span>
                            </div>
                          ))}
                          <div className="border-t pt-2 mt-2 space-y-2">
                            <div className="flex items-center gap-2">
                              <Percent className="w-3.5 h-3.5 text-orange-500" />
                              <span className="text-xs font-medium text-orange-600 dark:text-orange-400">할인 설정</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={dialogDiscountRate}
                                onChange={(e) => {
                                  setDialogDiscountRate(e.target.value);
                                  setDialogDiscountChanged(true);
                                }}
                                placeholder="할인율 %"
                                className="h-7 text-xs w-20"
                                data-testid="input-dialog-discount-rate"
                              />
                              <span className="text-xs">%</span>
                              <Select value={dialogDiscountTarget} onValueChange={(v) => { setDialogDiscountTarget(v); setDialogDiscountChanged(true); }}>
                                <SelectTrigger className="h-7 text-xs flex-1" data-testid="select-dialog-discount-target">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="both">수강료+교재비</SelectItem>
                                  <SelectItem value="tuition">수강료만</SelectItem>
                                  <SelectItem value="textbook">교재비만</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Input
                              value={dialogDiscountReason}
                              onChange={(e) => { setDialogDiscountReason(e.target.value); setDialogDiscountChanged(true); }}
                              placeholder="할인 사유 (예: 형제할인)"
                              className="h-7 text-xs"
                              data-testid="input-dialog-discount-reason"
                            />
                          </div>
                          {dHasDiscount && (
                            <div className="flex justify-between text-orange-600 dark:text-orange-400 text-xs mt-1">
                              <span>할인 {dRate}% ({dTarget === "both" ? "수강료+교재비" : dTarget === "tuition" ? "수강료" : "교재비"}){dialogDiscountReason ? ` - ${dialogDiscountReason}` : ""}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-bold border-t pt-2 mt-2">
                            <span>수강료{dHasDiscount && (dTarget === "tuition" || dTarget === "both") ? " (할인적용)" : ""}</span>
                            <span>{formatCurrency(total)}</span>
                          </div>
                          {textbookTotalForDialog > 0 && (
                            <div className="flex justify-between font-bold">
                              <span>교재비{dHasDiscount && (dTarget === "textbook" || dTarget === "both") ? " (할인적용)" : ""}</span>
                              <span>{formatCurrency(textbookTotalForDialog)}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-bold text-primary">
                            <span>총 교육비</span>
                            <span>{formatCurrency(total + textbookTotalForDialog)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="useCustomAmount"
                            checked={useCustomAmount}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setUseCustomAmount(checked);
                              if (!checked) {
                                const currentCenterName = userCenters.find(c => c.id === selectedCenter)?.name || "";
                                const dOverride = { rate: dRate, target: dTarget, reason: dialogDiscountReason };
                                const newContent = generateSmsContent(student?.name || "", breakdown, total, textbookTotalForDialog, currentCenterName, selectedStudentForNotify || "", dOverride);
                                setSmsContent(newContent);
                              }
                            }}
                            className="rounded"
                          />
                          <Label htmlFor="useCustomAmount">직접 금액 입력</Label>
                        </div>
                        {useCustomAmount && (
                          <Input
                            type="number"
                            value={customAmount}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomAmount(val);
                              const amt = parseInt(val, 10);
                              if (!isNaN(amt) && amt >= 0) {
                                const amtStr = formatCurrency(amt);
                                setSmsContent(prev => {
                                  let updated = prev.replace(/청구금액\s*[:：]\s*[₩￦]?[\d,]+(?:원)?/g, `청구금액 : ${amtStr}`);
                                  updated = updated.replace(/\[총\s*교육비\]\s*[:：]?\s*[₩￦]?[\d,]+(?:원)?/g, `[총 교육비]: ${amtStr}`);
                                  return updated;
                                });
                              }
                            }}
                            placeholder="발송할 금액"
                            data-testid="input-custom-amount"
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor="smsContent">
                            문자 내용 (수정 가능)
                            {(() => {
                              const prevNotif = notificationHistory
                                .filter(n => n.studentId === selectedStudentForNotify && n.messageContent && n.centerId === selectedCenter)
                                .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0];
                              return prevNotif ? <span className="text-xs text-muted-foreground ml-2">이전 발송 내용</span> : null;
                            })()}
                          </Label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const isCustom = useCustomAmount && customAmount;
                              const finalAmount = isCustom ? parseInt(customAmount, 10) : total;
                              const tbTotal = isCustom ? 0 : textbookTotalForDialog;
                              const stId = isCustom ? "" : (selectedStudentForNotify || "");
                              const currentCenterName = userCenters.find(c => c.id === selectedCenter)?.name || "";
                              const dOverride = { rate: dRate, target: dTarget, reason: dialogDiscountReason };
                              const newContent = generateSmsContent(student?.name || "", breakdown, finalAmount, tbTotal, currentCenterName, stId, dOverride);
                              setSmsContent(newContent);
                            }}
                            data-testid="button-refresh-sms"
                          >
                            현재 금액으로 갱신
                          </Button>
                        </div>
                        <Textarea
                          id="smsContent"
                          value={smsContent}
                          onChange={(e) => setSmsContent(e.target.value)}
                          className="min-h-64 font-mono text-xs"
                          data-testid="textarea-sms-content"
                        />
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
            <DialogFooter className="!flex-col !items-stretch gap-3 overflow-x-hidden sm:!space-x-0">
              <div className="flex flex-col gap-2 w-full">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="scheduledSms"
                    checked={isScheduledSms}
                    onChange={(e) => {
                      setIsScheduledSms(e.target.checked);
                      if (e.target.checked && !scheduledDate) {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        setScheduledDate(tomorrow.toISOString().split("T")[0]);
                      }
                    }}
                    className="w-4 h-4"
                    data-testid="checkbox-scheduled-sms"
                  />
                  <label htmlFor="scheduledSms" className="text-sm text-muted-foreground cursor-pointer">
                    예약 발송
                  </label>
                </div>
                {isScheduledSms && (
                  <div className="flex flex-row gap-2 pl-6 w-full max-w-sm">
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="flex h-9 flex-1 min-w-0 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm"
                      data-testid="input-scheduled-date"
                    />
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="flex h-9 flex-1 min-w-0 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm"
                      data-testid="input-scheduled-time"
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:flex-wrap gap-2 w-full">
                <Button 
                  variant="outline" 
                  className="w-full sm:w-auto whitespace-nowrap"
                  onClick={() => {
                    setNotificationDialogOpen(false);
                    resetNotificationForm();
                  }}
                >
                  취소
                </Button>
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto whitespace-nowrap"
                  onClick={() => handleSendNotification("draft")}
                  disabled={sendNotificationMutation.isPending || !smsContent.trim()}
                  data-testid="button-save-draft"
                  title="청구서를 생성하지 않고 문자 내용만 저장합니다"
                >
                  <Save className="w-4 h-4 mr-2" />
                  문자 내용만 저장
                </Button>
                <Button
                  className="w-full sm:w-auto whitespace-nowrap"
                  onClick={() => handleSendNotification("send")}
                  disabled={sendNotificationMutation.isPending || selectedPhoneTypes.length === 0 || (isScheduledSms && (!scheduledDate || !scheduledTime))}
                  data-testid="button-confirm-send"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {sendNotificationMutation.isPending ? "처리중..." : isScheduledSms ? "예약 발송" : selectedPhoneTypes.length > 1 ? `문자 발송 (${selectedPhoneTypes.length}명)` : "문자 발송"}
                </Button>
              </div>
            </DialogFooter>
            </DialogContent>
          </Dialog>
          </TabsContent>

          <TabsContent value="textbook" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Book className="w-5 h-5" />
                  수업별 교재 관리
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-2 block">선생님 선택</Label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(classesByTeacher.grouped).map(([teacherId, { teacher }]) => (
                      <Button
                        key={teacherId}
                        size="sm"
                        variant={tbSelectedTeacher === teacherId ? "default" : "outline"}
                        onClick={() => { setTbSelectedTeacher(teacherId); setTbSelectedClass("none"); }}
                        data-testid={`button-tb-teacher-${teacherId}`}
                      >
                        {teacher?.name || "선생님"} 선생님
                      </Button>
                    ))}
                    {classesByTeacher.unassigned.length > 0 && (
                      <Button
                        size="sm"
                        variant={tbSelectedTeacher === "unassigned" ? "default" : "outline"}
                        onClick={() => { setTbSelectedTeacher("unassigned"); setTbSelectedClass("none"); }}
                        data-testid="button-tb-teacher-unassigned"
                      >
                        담당 미지정
                      </Button>
                    )}
                  </div>
                </div>

                {tbSelectedTeacher !== "none" && (
                  <div>
                    <Label className="mb-2 block">수업 선택</Label>
                    <div className="flex flex-wrap gap-2">
                      {tbTeacherClasses.map(cls => (
                        <Button
                          key={cls.id}
                          size="sm"
                          variant={tbSelectedClass === cls.id ? "default" : "outline"}
                          onClick={() => setTbSelectedClass(cls.id)}
                          data-testid={`button-tb-class-${cls.id}`}
                        >
                          {cls.name} {cls.subject}반
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {tbSelectedClass !== "none" && (
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4 space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Book className="w-4 h-4" />
                        등록된 교재 ({tbClassTextbooks.length}개)
                      </h4>

                      {tbClassTextbooks.map(tb => (
                        <div key={tb.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded" data-testid={`row-class-textbook-${tb.id}`}>
                          {tbEditingId === tb.id ? (
                            <>
                              <Input
                                value={tbEditName}
                                onChange={e => setTbEditName(e.target.value)}
                                className="flex-1"
                                placeholder="교재명"
                                data-testid="input-edit-textbook-name"
                              />
                              <Input
                                type="number"
                                value={tbEditPrice}
                                onChange={e => setTbEditPrice(e.target.value)}
                                className="w-28 text-right"
                                placeholder="가격"
                                data-testid="input-edit-textbook-price"
                              />
                              <span className="text-sm text-muted-foreground">원</span>
                              <Button size="icon" variant="ghost" onClick={() => {
                                if (tbEditName && tbEditPrice) {
                                  updateClassTextbookMutation.mutate({ id: tb.id, data: { name: tbEditName, price: parseInt(tbEditPrice) } });
                                }
                              }} data-testid="button-save-edit-textbook">
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setTbEditingId(null)} data-testid="button-cancel-edit-textbook">
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 font-medium">{tb.name}</span>
                              <span className="text-sm font-medium">{tb.price.toLocaleString()}원</span>
                              <Button size="icon" variant="ghost" onClick={() => { setTbEditingId(tb.id); setTbEditName(tb.name); setTbEditPrice(String(tb.price)); }} data-testid={`button-edit-tb-${tb.id}`}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => {
                                if (confirm("이 교재를 삭제하시겠습니까? 배부 기록도 함께 삭제됩니다.")) {
                                  deleteClassTextbookMutation.mutate(tb.id);
                                }
                              }} data-testid={`button-delete-tb-${tb.id}`}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))}

                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Input
                          value={tbNewName}
                          onChange={e => setTbNewName(e.target.value)}
                          placeholder="새 교재명"
                          className="flex-1"
                          data-testid="input-new-textbook-name"
                        />
                        <Input
                          type="number"
                          value={tbNewPrice}
                          onChange={e => setTbNewPrice(e.target.value)}
                          placeholder="가격"
                          className="w-28 text-right"
                          data-testid="input-new-textbook-price"
                        />
                        <span className="text-sm text-muted-foreground">원</span>
                        <Button
                          size="sm"
                          disabled={!tbNewName || !tbNewPrice || createClassTextbookMutation.isPending}
                          onClick={() => {
                            createClassTextbookMutation.mutate({
                              classId: tbSelectedClass,
                              centerId: selectedCenter,
                              name: tbNewName,
                              price: parseInt(tbNewPrice),
                            });
                          }}
                          data-testid="button-add-class-textbook"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          추가
                        </Button>
                      </div>
                    </div>

                    {tbClassTextbooks.length > 0 && tbClassStudents.length > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="sticky left-0 bg-background z-10 min-w-[100px]">학생</TableHead>
                                {tbClassTextbooks.map(tb => (
                                  <TableHead key={tb.id} className="text-center min-w-[120px]">
                                    <div>{tb.name}</div>
                                    <div className="text-xs text-muted-foreground font-normal">{tb.price.toLocaleString()}원</div>
                                  </TableHead>
                                ))}
                                <TableHead className="text-right min-w-[100px]">합계</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {tbClassStudents.map(student => {
                                const studentTotal = tbClassTextbooks.reduce((sum, tb) => {
                                  const has = textbookPurchases.some(p => p.classTextbookId === tb.id && p.studentId === student.id);
                                  return sum + (has ? tb.price : 0);
                                }, 0);
                                return (
                                  <TableRow key={student.id} data-testid={`row-tb-student-${student.id}`}>
                                    <TableCell className="sticky left-0 bg-background z-10 font-medium">
                                      {student.name}
                                      {student.grade && <Badge variant="outline" className="ml-1 text-xs">{student.grade}</Badge>}
                                    </TableCell>
                                    {tbClassTextbooks.map(tb => {
                                      const has = textbookPurchases.some(p => p.classTextbookId === tb.id && p.studentId === student.id);
                                      return (
                                        <TableCell key={tb.id} className="text-center">
                                          <Checkbox
                                            checked={has}
                                            onCheckedChange={(checked) => {
                                              toggleStudentTextbookMutation.mutate({
                                                classTextbookId: tb.id,
                                                studentId: student.id,
                                                checked: !!checked,
                                              });
                                            }}
                                            data-testid={`checkbox-tb-${tb.id}-${student.id}`}
                                          />
                                        </TableCell>
                                      );
                                    })}
                                    <TableCell className="text-right font-medium">
                                      {studentTotal > 0 ? `${studentTotal.toLocaleString()}원` : "-"}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                              <TableRow className="bg-muted/50 font-medium">
                                <TableCell className="sticky left-0 bg-muted/50 z-10">배부 현황</TableCell>
                                {tbClassTextbooks.map(tb => {
                                  const count = textbookPurchases.filter(p => p.classTextbookId === tb.id && tbClassStudents.some(s => s.id === p.studentId)).length;
                                  return (
                                    <TableCell key={tb.id} className="text-center text-sm">
                                      {count}/{tbClassStudents.length}
                                    </TableCell>
                                  );
                                })}
                                <TableCell className="text-right">
                                  {tbClassTextbooks.reduce((total, tb) => {
                                    const count = textbookPurchases.filter(p => p.classTextbookId === tb.id && tbClassStudents.some(s => s.id === p.studentId)).length;
                                    return total + (count * tb.price);
                                  }, 0).toLocaleString()}원
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {tbClassTextbooks.length > 0 && tbClassStudents.length === 0 && (
                      <div className="text-center text-muted-foreground py-6">
                        <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>이 수업에 등록된 학생이 없습니다</p>
                      </div>
                    )}
                  </div>
                )}

                {tbSelectedTeacher === "none" && (
                  <div className="text-center text-muted-foreground py-8">
                    <Book className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>선생님을 선택해주세요</p>
                  </div>
                )}

                {tbSelectedTeacher !== "none" && tbSelectedClass === "none" && (
                  <div className="text-center text-muted-foreground py-8">
                    <Book className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>수업을 선택해주세요</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment-status" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  결제 현황
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      <Button size="sm" variant={paymentStatusFilter === "all" ? "default" : "outline"} onClick={() => setPaymentStatusFilter("all")} data-testid="filter-payment-all">전체</Button>
                      <Button size="sm" variant={paymentStatusFilter === "unpaid" ? "destructive" : "outline"} onClick={() => setPaymentStatusFilter("unpaid")} data-testid="filter-payment-unpaid">결제대기</Button>
                      <Button size="sm" variant={paymentStatusFilter === "unsent" ? "secondary" : "outline"} onClick={() => setPaymentStatusFilter("unsent")} data-testid="filter-payment-unsent">미발송</Button>
                      <Button size="sm" variant={paymentStatusFilter === "paid" ? "default" : "outline"} onClick={() => setPaymentStatusFilter("paid")} data-testid="filter-payment-paid">결제완료</Button>
                      <Button size="sm" variant={paymentStatusFilter === "cancelled" ? "secondary" : "outline"} onClick={() => setPaymentStatusFilter("cancelled")} data-testid="filter-payment-cancelled">취소</Button>
                    </div>
                    <div className="h-6 w-px bg-border mx-1 hidden sm:block" />
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant={paymentSchoolLevel === "all" ? "default" : "outline"} onClick={() => setPaymentSchoolLevel("all")} data-testid="filter-school-all">전체</Button>
                      <Button size="sm" variant={paymentSchoolLevel === "elementary" ? "default" : "outline"} onClick={() => setPaymentSchoolLevel("elementary")} data-testid="filter-school-elementary">초등</Button>
                      <Button size="sm" variant={paymentSchoolLevel === "middle" ? "default" : "outline"} onClick={() => setPaymentSchoolLevel("middle")} data-testid="filter-school-middle">중등</Button>
                      <Button size="sm" variant={paymentSchoolLevel === "high" ? "default" : "outline"} onClick={() => setPaymentSchoolLevel("high")} data-testid="filter-school-high">고등</Button>
                      <Button size="sm" variant={paymentSchoolLevel === "adult" ? "default" : "outline"} onClick={() => setPaymentSchoolLevel("adult")} data-testid="filter-school-adult">성인</Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="학생 이름 검색..."
                        value={paymentSearchQuery}
                        onChange={(e) => setPaymentSearchQuery(e.target.value)}
                        className="pl-9"
                        data-testid="input-payment-search"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          const [y, m] = paymentTabMonth.split("-").map(Number);
                          const d = new Date(y, m - 2, 1);
                          setPaymentTabMonth(format(d, "yyyy-MM"));
                        }}
                        data-testid="button-payment-prev-month"
                      >
                        <ChevronDown className="w-4 h-4 rotate-90" />
                      </Button>
                      <span className="font-semibold text-sm min-w-[90px] text-center" data-testid="text-payment-month">
                        {(() => {
                          const [y, m] = paymentTabMonth.split("-").map(Number);
                          return `${y}년 ${m}월`;
                        })()}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          const [y, m] = paymentTabMonth.split("-").map(Number);
                          const d = new Date(y, m, 1);
                          setPaymentTabMonth(format(d, "yyyy-MM"));
                        }}
                        data-testid="button-payment-next-month"
                      >
                        <ChevronDown className="w-4 h-4 -rotate-90" />
                      </Button>
                    </div>
                  </div>

                  {(() => {
                    const gradeOrder = ["성인", "고3", "고2", "고1", "중3", "중2", "중1", "초6", "초5", "초4", "초3", "초2", "초1"];

                    const schoolLevelFilter = (grade: string) => {
                      if (paymentSchoolLevel === "all") return true;
                      const ng = normalizeGrade(grade);
                      if (paymentSchoolLevel === "elementary") return ng.startsWith("초");
                      if (paymentSchoolLevel === "middle") return ng.startsWith("중");
                      if (paymentSchoolLevel === "high") return ng.startsWith("고");
                      if (paymentSchoolLevel === "adult") return ng === "성인";
                      return true;
                    };

                    const filteredStudents = students.filter(s => {
                      if (!schoolLevelFilter(s.grade || "")) return false;
                      if (paymentSearchQuery.trim() && !s.name?.includes(paymentSearchQuery.trim())) return false;
                      return true;
                    });

                    type NotifType = TuitionNotification & { student?: UserType; parent?: UserType; sender?: UserType };
                    type StudentPaymentInfo = {
                      student: UserType;
                      latestNotification: NotifType | null;
                      allNotifications: NotifType[];
                      tuitionAmount: number;
                      textbookAmount: number;
                      totalAmount: number;
                      status: "paid" | "pending" | "cancelled" | "unsent";
                      hasPending: boolean;
                    };

                    const studentPaymentInfos: StudentPaymentInfo[] = filteredStudents.map(student => {
                      const studentNotifs = notificationHistory
                        .filter(n => {
                          if (n.studentId !== student.id) return false;
                          if (!n.createdAt) return false;
                          // Exclude drafts: they are saved message text only, not actual invoices
                          if (n.status === "draft") return false;
                          return format(new Date(n.createdAt), "yyyy-MM") === paymentTabMonth;
                        })
                        .sort((a, b) => {
                          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                          return tb - ta;
                        });
                      const latestNotification = studentNotifs.length > 0 ? studentNotifs[0] : null;

                      const tuitionAmount = studentNotifs.reduce((sum, n) => sum + (n.sentAmount || 0), 0);
                      const textbookAmount = studentNotifs.reduce((sum, n) => sum + (n.textbookTotal || 0), 0);
                      const totalAmount = tuitionAmount + textbookAmount;

                      let status: StudentPaymentInfo["status"];
                      if (studentNotifs.length === 0 || !latestNotification) {
                        status = "unsent";
                      } else {
                        const latestStatus = (latestNotification.paymentStatus as "paid" | "pending" | "cancelled") || "pending";
                        status = latestStatus;
                      }

                      const hasPending = studentNotifs.some(n => ((n.paymentStatus as string) || "pending") === "pending");

                      return { student, latestNotification, allNotifications: studentNotifs, tuitionAmount, textbookAmount, totalAmount, status, hasPending };
                    });

                    // 삭제된(퇴원) 학생: 학생 목록에는 없지만 해당 월 청구서가 있으면 "이름 (퇴원생)"으로 표시
                    const knownStudentIds = new Set(students.map(s => s.id));
                    const deletedNotifsByStudent = new Map<string, NotifType[]>();
                    notificationHistory.forEach(n => {
                      if (!n.studentId || knownStudentIds.has(n.studentId)) return;
                      if (!n.createdAt || n.status === "draft") return;
                      if (format(new Date(n.createdAt), "yyyy-MM") !== paymentTabMonth) return;
                      const arr = deletedNotifsByStudent.get(n.studentId) || [];
                      arr.push(n);
                      deletedNotifsByStudent.set(n.studentId, arr);
                    });
                    deletedNotifsByStudent.forEach((notifs, studentId) => {
                      notifs.sort((a, b) => {
                        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return tb - ta;
                      });
                      const latestNotification = notifs[0];
                      // 서버에서 퇴원 기록 이름으로 "이름 (퇴원생)" 형태의 플레이스홀더 student를 내려줌
                      const deletedStudent = (latestNotification.student || { id: studentId, name: "(퇴원생)" }) as UserType;
                      if (paymentSearchQuery.trim() && !deletedStudent.name?.includes(paymentSearchQuery.trim())) return;
                      if (!schoolLevelFilter(deletedStudent.grade || "")) return;
                      const tuitionAmount = notifs.reduce((sum, n) => sum + (n.sentAmount || 0), 0);
                      const textbookAmount = notifs.reduce((sum, n) => sum + (n.textbookTotal || 0), 0);
                      const status = ((latestNotification.paymentStatus as "paid" | "pending" | "cancelled") || "pending");
                      const hasPending = notifs.some(n => ((n.paymentStatus as string) || "pending") === "pending");
                      studentPaymentInfos.push({
                        student: deletedStudent,
                        latestNotification,
                        allNotifications: notifs,
                        tuitionAmount,
                        textbookAmount,
                        totalAmount: tuitionAmount + textbookAmount,
                        status,
                        hasPending,
                      });
                    });

                    const isPendingVisible = (i: StudentPaymentInfo) => i.status === "pending" || (i.status === "cancelled" && i.hasPending);
                    const countPaid = studentPaymentInfos.filter(i => i.status === "paid").length;
                    const countPending = studentPaymentInfos.filter(isPendingVisible).length;
                    const countUnsent = studentPaymentInfos.filter(i => i.status === "unsent").length;
                    const countCancelled = studentPaymentInfos.filter(i => i.status === "cancelled").length;
                    const amountPaid = studentPaymentInfos.reduce((sum, i) => {
                      if (i.status !== "paid" || !i.latestNotification) return sum;
                      const n = i.latestNotification;
                      return sum + (n.sentAmount || 0) + (n.textbookTotal || 0);
                    }, 0);
                    const amountPending = studentPaymentInfos.reduce((sum, i) => {
                      if (i.status === "pending" && i.latestNotification) {
                        const n = i.latestNotification;
                        return sum + (n.sentAmount || 0) + (n.textbookTotal || 0);
                      }
                      if (i.status === "cancelled" && i.hasPending) {
                        const pendingSum = i.allNotifications
                          .filter(n => ((n.paymentStatus as string) || "pending") === "pending")
                          .reduce((s, n) => s + (n.sentAmount || 0) + (n.textbookTotal || 0), 0);
                        return sum + pendingSum;
                      }
                      return sum;
                    }, 0);

                    const filtered = studentPaymentInfos.filter(info => {
                      if (paymentStatusFilter === "all") return true;
                      if (paymentStatusFilter === "unpaid") return isPendingVisible(info);
                      if (paymentStatusFilter === "unsent") return info.allNotifications.length === 0;
                      if (paymentStatusFilter === "paid") return info.status === "paid";
                      if (paymentStatusFilter === "cancelled") return info.status === "cancelled";
                      return true;
                    });

                    const studentsByGrade: Record<string, StudentPaymentInfo[]> = {};
                    filtered.forEach(info => {
                      const grade = normalizeGrade(info.student.grade) || "미지정";
                      if (!studentsByGrade[grade]) studentsByGrade[grade] = [];
                      studentsByGrade[grade].push(info);
                    });
                    Object.values(studentsByGrade).forEach(arr => arr.sort((a, b) => (a.student.name || "").localeCompare(b.student.name || "", "ko")));

                    const sortedGrades = Object.keys(studentsByGrade).sort((a, b) => {
                      const indexA = gradeOrder.indexOf(a);
                      const indexB = gradeOrder.indexOf(b);
                      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
                      if (indexA === -1) return 1;
                      if (indexB === -1) return -1;
                      return indexA - indexB;
                    });

                    return (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div className="rounded-lg border p-3 text-center" data-testid="card-total-count">
                            <div className="text-sm text-muted-foreground">전체</div>
                            <div className="text-xl font-bold" data-testid="text-total-count">{studentPaymentInfos.length}명</div>
                          </div>
                          <div className="rounded-lg border border-emerald-300 dark:border-emerald-600 p-3 text-center bg-emerald-50 dark:bg-emerald-950/30" data-testid="card-paid-count">
                            <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">결제완료</div>
                            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-200" data-testid="text-paid-count">{countPaid}명</div>
                            <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(amountPaid)}</div>
                          </div>
                          <div className="rounded-lg border border-rose-300 dark:border-rose-600 p-3 text-center bg-rose-50 dark:bg-rose-950/30" data-testid="card-pending-count">
                            <div className="text-sm font-semibold text-rose-700 dark:text-rose-300">결제대기</div>
                            <div className="text-2xl font-bold text-rose-700 dark:text-rose-200" data-testid="text-pending-count">{countPending}명</div>
                            <div className="text-xs font-medium text-rose-600 dark:text-rose-400">{formatCurrency(amountPending)}</div>
                          </div>
                          <div className="rounded-lg border p-3 text-center" data-testid="card-unsent-count">
                            <div className="text-sm text-muted-foreground">미발송</div>
                            <div className="text-xl font-bold" data-testid="text-unsent-count">{countUnsent}명</div>
                          </div>
                          <div className="rounded-lg border p-3 text-center" data-testid="card-cancelled-count">
                            <div className="text-sm text-muted-foreground">취소</div>
                            <div className="text-xl font-bold" data-testid="text-cancelled-count">{countCancelled}명</div>
                          </div>
                        </div>

                        {filtered.length === 0 ? (
                          <div className="flex items-center justify-center h-32">
                            <p className="text-muted-foreground">해당 조건에 맞는 학생이 없습니다</p>
                          </div>
                        ) : (
                          sortedGrades.map(grade => (
                            <Collapsible key={grade} defaultOpen={true} className="border rounded-md">
                              <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 hover-elevate rounded-md" data-testid={`trigger-payment-grade-${grade}`}>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-lg">{grade}</span>
                                  <Badge variant="secondary">{studentsByGrade[grade].length}명</Badge>
                                  {(() => {
                                    const gradePaid = studentsByGrade[grade].filter(i => i.status === "paid").length;
                                    const gradePending = studentsByGrade[grade].filter(isPendingVisible).length;
                                    const gradeUnsent = studentsByGrade[grade].filter(i => i.status === "unsent").length;
                                    return (
                                      <div className="flex items-center gap-1">
                                        {gradePaid > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">완료 {gradePaid}</Badge>}
                                        {gradePending > 0 && <Badge variant="destructive" className="text-[10px] h-4 px-1">대기 {gradePending}</Badge>}
                                        {gradeUnsent > 0 && <Badge variant="outline" className="text-[10px] h-4 px-1">미발송 {gradeUnsent}</Badge>}
                                      </div>
                                    );
                                  })()}
                                </div>
                                <ChevronDown className="w-5 h-5 transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="border-t">
                                  {studentsByGrade[grade].map(({ student, latestNotification: notif, allNotifications, tuitionAmount, textbookAmount, totalAmount, status }) => {
                                    const olderNotifs = allNotifications.slice(1);
                                    const hasMore = olderNotifs.length > 0;
                                    const isExpanded = expandedPaymentStudents.has(student.id);

                                    const getSingleMethodLabel = (m: string) => {
                                      if (m === "online") return "온라인결제";
                                      if (m === "in_person") return "현금결제";
                                      if (m === "bank_transfer") return "계좌이체";
                                      if (m === "card") return "카드";
                                      if (m === "zero_pay") return "제로페이";
                                      if (m === "toss") return "토스페이";
                                      return m;
                                    };
                                    const getPaymentMethodLabel = (method: string | null | undefined, n?: any) => {
                                      // 관리자가 명시적으로 지정한 결제수단을 우선 표시.
                                      // (실제 Toss 온라인 결제는 완료 시 payment_method가 'online'으로 저장되므로,
                                      //  method가 있을 때는 toss 정보보다 method를 신뢰한다.)
                                      if (method) {
                                        if (method.includes(",")) {
                                          return method.split(",").map(m => getSingleMethodLabel(m.trim())).join(", ");
                                        }
                                        return getSingleMethodLabel(method);
                                      }
                                      if (n?.tossPaymentKey || n?.tossOrderId) return "온라인결제";
                                      return "-";
                                    };

                                    const renderNotifCard = (n: typeof notif, isLatest: boolean) => {
                                      if (!n) return null;
                                      const nTuition = n.sentAmount || 0;
                                      const nTextbook = n.textbookTotal || 0;
                                      const nTotal = nTuition + nTextbook;
                                      const nStatus = (n.paymentStatus as "paid" | "pending" | "cancelled") || "pending";
                                      return (
                                        <div key={n.id} className={`p-3 space-y-2 ${!isLatest ? "bg-muted/30 border-t border-dashed" : ""}`} data-testid={isLatest ? `row-payment-${student.id}` : `row-payment-history-${n.id}`}>
                                          {isLatest ? (
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-2">
                                                <span className="font-medium text-base" data-testid={`text-student-name-${student.id}`}>{student.name}</span>
                                                {hasMore && (
                                                  <button
                                                    type="button"
                                                    className="text-xs text-primary hover:underline cursor-pointer"
                                                    onClick={() => {
                                                      setExpandedPaymentStudents(prev => {
                                                        const next = new Set(prev);
                                                        if (next.has(student.id)) next.delete(student.id);
                                                        else next.add(student.id);
                                                        return next;
                                                      });
                                                    }}
                                                    data-testid={`button-expand-history-${student.id}`}
                                                  >
                                                    {isExpanded ? "접기" : `+${olderNotifs.length}건`}
                                                  </button>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-1.5">
                                                {nStatus === "paid" ? (
                                                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">결제완료</Badge>
                                                ) : nStatus === "cancelled" ? (
                                                  <Badge variant="secondary">취소</Badge>
                                                ) : (
                                                  <Badge variant="destructive">결제대기</Badge>
                                                )}
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="flex items-center justify-between">
                                              <span className="text-muted-foreground text-xs">ㄴ 이전 내역</span>
                                              {nStatus === "paid" ? (
                                                <Badge variant="secondary" className="text-[10px] h-4 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">결제완료</Badge>
                                              ) : nStatus === "cancelled" ? (
                                                <Badge variant="secondary" className="text-[10px] h-4">취소</Badge>
                                              ) : (
                                                <Badge variant="destructive" className="text-[10px] h-4">결제대기</Badge>
                                              )}
                                            </div>
                                          )}
                                          {n.title && (
                                            <div className="text-sm text-muted-foreground" data-testid={`text-notif-title-${n.id}`}>
                                              {n.title}
                                            </div>
                                          )}
                                          <div className="grid grid-cols-3 gap-2 text-sm">
                                            <div>
                                              <span className="text-muted-foreground">수강료</span>
                                              <div className="mt-0.5 tabular-nums">{formatCurrency(nTuition)}</div>
                                            </div>
                                            <div>
                                              <span className="text-muted-foreground">교재비</span>
                                              <div className="mt-0.5 tabular-nums">{nTextbook > 0 ? formatCurrency(nTextbook) : "-"}</div>
                                            </div>
                                            <div>
                                              <span className="text-muted-foreground">총액</span>
                                              <div className="mt-0.5 font-semibold tabular-nums">{formatCurrency(nTotal)}</div>
                                            </div>
                                          </div>
                                          <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-3 text-muted-foreground">
                                              <span>{n.createdAt ? `${n.status === "scheduled" ? "예약 " : "안내: "}${new Date(n.createdAt).toLocaleDateString("ko-KR")}` : "-"}</span>
                                              {n.paidAt && <span>결제: {new Date(n.paidAt).toLocaleDateString("ko-KR")}</span>}
                                              {nStatus === "paid" && <span>{getPaymentMethodLabel(n.paymentMethod, n)}</span>}
                                            </div>
                                            {n.paymentMemo && (
                                              <div className="text-xs text-muted-foreground italic" data-testid={`text-payment-memo-${n.id}`}>
                                                메모: {n.paymentMemo}
                                              </div>
                                            )}
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-xs px-2"
                                              onClick={() => handleOpenPaymentStatusDialog(
                                                n.id,
                                                n.paymentStatus,
                                                getEffectivePaymentMethod(n),
                                                n.paymentMemo
                                              )}
                                              data-testid={isLatest ? `button-payment-status-change-${student.id}` : `button-payment-status-change-${n.id}`}
                                            >
                                              상태변경
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    };

                                    return (
                                      <div key={student.id} className="border-b">
                                        {notif ? renderNotifCard(notif, true) : (() => {
                                          const sEnrollments = getStudentEnrollmentsForNotify(student.id).filter(e => e.class && !e.class.isArchived);
                                          const { total: sAutoTotal } = calculateFeesFromEnrollments(sEnrollments);
                                          const sEffective = student.customTuitionAmount != null ? student.customTuitionAmount : sAutoTotal;
                                          const sTbTotal = calculateTextbookTotal(student.id);
                                          const sDiscRate = student.discountRate != null && student.discountRate > 0 ? student.discountRate : 0;
                                          const sDiscTarget = student.discountTarget || "both";
                                          const sTuition = sDiscRate > 0 && (sDiscTarget === "tuition" || sDiscTarget === "both") ? Math.round(sEffective * (1 - sDiscRate / 100)) : sEffective;
                                          const sTextbook = sDiscRate > 0 && (sDiscTarget === "textbook" || sDiscTarget === "both") ? Math.round(sTbTotal * (1 - sDiscRate / 100)) : sTbTotal;
                                          const sTotal = sTuition + sTextbook;
                                          return (
                                            <div className="p-3 space-y-2" data-testid={`row-payment-${student.id}`}>
                                              <div className="flex items-center justify-between">
                                                <span className="font-medium" data-testid={`text-student-name-${student.id}`}>{student.name}</span>
                                                <div className="flex items-center gap-1.5">
                                                  <Badge variant="outline" className="text-muted-foreground">미발송</Badge>
                                                </div>
                                              </div>
                                              <div className="grid grid-cols-3 gap-2 text-sm">
                                                <div>
                                                  <span className="text-muted-foreground">수강료</span>
                                                  <div className="mt-0.5 tabular-nums">{formatCurrency(sTuition)}</div>
                                                </div>
                                                <div>
                                                  <span className="text-muted-foreground">교재비</span>
                                                  <div className="mt-0.5 tabular-nums">{sTextbook > 0 ? formatCurrency(sTextbook) : "-"}</div>
                                                </div>
                                                <div>
                                                  <span className="text-muted-foreground">총액</span>
                                                  <div className="mt-0.5 font-semibold tabular-nums">{formatCurrency(sTotal)}</div>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })()}
                                        {isExpanded && olderNotifs.map(n => renderNotifCard(n, false))}
                                        {isPrincipalOrAdmin && (
                                          <div className="px-3 pb-3">
                                            {editingMemoStudentId === student.id ? (
                                              <div className="flex gap-1.5 items-start">
                                                <Textarea
                                                  value={editingMemoText}
                                                  onChange={(e) => setEditingMemoText(e.target.value)}
                                                  placeholder="교육비 관련 메모 (다음달에도 유지됩니다)"
                                                  className="text-xs min-h-[56px] resize-none flex-1"
                                                  maxLength={200}
                                                  data-testid={`textarea-payment-memo-${student.id}`}
                                                />
                                                <div className="flex flex-col gap-1">
                                                  <Button
                                                    size="sm"
                                                    className="h-7 text-xs px-2"
                                                    onClick={() => updateTuitionMemoMutation.mutate({ studentId: student.id, memo: editingMemoText })}
                                                    disabled={updateTuitionMemoMutation.isPending}
                                                    data-testid={`button-save-payment-memo-${student.id}`}
                                                  >
                                                    <Save className="w-3 h-3" />
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 text-xs px-2"
                                                    onClick={() => setEditingMemoStudentId(null)}
                                                    data-testid={`button-cancel-payment-memo-${student.id}`}
                                                  >
                                                    <X className="w-3 h-3" />
                                                  </Button>
                                                </div>
                                              </div>
                                            ) : (
                                              <button
                                                type="button"
                                                className={cn(
                                                  "flex items-start gap-1.5 text-xs w-full text-left rounded px-1.5 py-1 transition-colors",
                                                  student.tuitionMemo
                                                    ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
                                                    : "text-muted-foreground hover:bg-muted/50"
                                                )}
                                                onClick={() => {
                                                  setEditingMemoStudentId(student.id);
                                                  setEditingMemoText(student.tuitionMemo || "");
                                                }}
                                                data-testid={`button-edit-payment-memo-${student.id}`}
                                              >
                                                <Edit className="w-3 h-3 mt-0.5 shrink-0" />
                                                <span className="whitespace-pre-wrap">{student.tuitionMemo || "메모 추가"}</span>
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          ))
                        )}
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="toss-consent" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="w-5 h-5" />
                    토스페이먼츠 연동 신청자 명단
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tossConsentLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    </div>
                  ) : (() => {
                    const pendingCenters = allCenterStats.filter((c: any) => c.tossConsentStatus === "pending");
                    const approvedCenters = allCenterStats.filter((c: any) => c.tossConsentStatus === "approved");
                    const rejectedCenters = allCenterStats.filter((c: any) => c.tossConsentStatus === "rejected");
                    const pendingTossRegistrations = pendingRegistrations.filter((r: any) => r.tossConsentAgreed);

                    return (
                      <div className="space-y-6">
                        {pendingTossRegistrations.length > 0 && (
                          <div>
                            <h3 className="font-semibold text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              학원 등록 대기 ({pendingTossRegistrations.length}건)
                            </h3>
                            <p className="text-xs text-muted-foreground mb-2 pl-6">학원 등록 신청 시 교육비 결제 연동에 동의한 건입니다. 학원 등록 승인 후 자동으로 결제 연동 대기로 이동합니다.</p>
                            <div className="space-y-2">
                              {pendingTossRegistrations.map((reg: any) => (
                                <div key={reg.id} className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
                                  <div>
                                    <p className="text-base font-semibold">{reg.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {reg.applicantName}{reg.applicantPhone ? ` (${reg.applicantPhone})` : ""}
                                    </p>
                                    {reg.createdAt && (
                                      <p className="text-xs text-muted-foreground mt-1">신청일: {format(new Date(reg.createdAt), "yyyy-MM-dd HH:mm")}</p>
                                    )}
                                  </div>
                                  <Badge variant="outline" className="border-blue-300 text-blue-700 dark:text-blue-400">등록 대기</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <h3 className="font-semibold text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            승인 대기 ({pendingCenters.length}건)
                          </h3>
                          {pendingCenters.length === 0 ? (
                            <p className="text-sm text-muted-foreground pl-6">대기 중인 신청자가 없습니다</p>
                          ) : (
                            <div className="space-y-2">
                              {pendingCenters.map((center: any) => (
                                <div key={center.id} className="flex items-center justify-between bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-4">
                                  <div>
                                    <p className="text-base font-semibold">{center.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {center.principalName || "원장 미지정"}{center.principalPhone ? ` (${center.principalPhone})` : ""}
                                    </p>
                                    {center.tossConsentAt && (
                                      <p className="text-xs text-muted-foreground mt-1">신청일: {format(new Date(center.tossConsentAt), "yyyy-MM-dd HH:mm")}</p>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => tossReviewMutation.mutate({ centerId: center.id, action: "reject" })}
                                      disabled={tossReviewMutation.isPending}
                                      data-testid={`button-toss-reject-${center.id}`}
                                    >
                                      거절
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setTossApproveSendSms(true);
                                        setTossApproveConfirmCenter(center);
                                      }}
                                      disabled={tossReviewMutation.isPending}
                                      data-testid={`button-toss-approve-${center.id}`}
                                    >
                                      승인
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {approvedCenters.length > 0 && (
                          <div>
                            <h3 className="font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                              <CreditCard className="h-4 w-4" />
                              승인 완료 ({approvedCenters.length}건)
                            </h3>
                            <div className="space-y-2">
                              {approvedCenters.map((center: any) => (
                                <div key={center.id} className="flex items-center justify-between bg-green-50/50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50 rounded-lg p-4">
                                  <div>
                                    <p className="text-base font-semibold">{center.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {center.principalName || "원장 미지정"}{center.principalPhone ? ` (${center.principalPhone})` : ""}
                                    </p>
                                    {center.tossApprovedAt && (
                                      <p className="text-xs text-muted-foreground mt-1">승인일: {format(new Date(center.tossApprovedAt), "yyyy-MM-dd HH:mm")}</p>
                                    )}
                                  </div>
                                  <Badge variant="outline" className="border-green-300 text-green-700 dark:text-green-400">연동완료</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {rejectedCenters.length > 0 && (
                          <div>
                            <h3 className="font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                              <X className="h-4 w-4" />
                              거절 ({rejectedCenters.length}건)
                            </h3>
                            <div className="space-y-2">
                              {rejectedCenters.map((center: any) => (
                                <div key={center.id} className="flex items-center justify-between bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-lg p-4">
                                  <div>
                                    <p className="text-base font-semibold">{center.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {center.principalName || "원장 미지정"}{center.principalPhone ? ` (${center.principalPhone})` : ""}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setTossApproveSendSms(true);
                                      setTossApproveConfirmCenter(center);
                                    }}
                                    disabled={tossReviewMutation.isPending}
                                    data-testid={`button-toss-reapprove-${center.id}`}
                                  >
                                    승인으로 변경
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Payment status change dialog - placed outside Tabs so it renders on all tabs */}
        <Dialog open={!!tossApproveConfirmCenter} onOpenChange={(open) => !open && setTossApproveConfirmCenter(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>승인 확인</DialogTitle>
              <DialogDescription>
                <span className="font-semibold text-foreground">{tossApproveConfirmCenter?.principalName}</span> 원장님의 토스페이먼츠 연동을 승인하시겠습니까?
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 py-2">
              <Checkbox
                id="toss-approve-sms"
                checked={tossApproveSendSms}
                onCheckedChange={(checked) => setTossApproveSendSms(!!checked)}
                data-testid="checkbox-toss-approve-sms"
              />
              <Label htmlFor="toss-approve-sms" className="text-sm cursor-pointer">승인 완료 문자 발송</Label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTossApproveConfirmCenter(null)}>취소</Button>
              <Button
                onClick={() => tossApproveConfirmCenter && tossReviewMutation.mutate({ centerId: tossApproveConfirmCenter.id, action: "approve", sendSms: tossApproveSendSms })}
                disabled={tossReviewMutation.isPending}
                data-testid="button-toss-approve-confirm"
              >
                {tossReviewMutation.isPending ? "처리 중..." : "승인"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={paymentStatusDialogOpen} onOpenChange={setPaymentStatusDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                결제 상태 변경
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>결제 상태</Label>
                <Select
                  value={selectedPaymentStatus}
                  onValueChange={setSelectedPaymentStatus}
                >
                  <SelectTrigger data-testid="select-payment-status">
                    <SelectValue placeholder="결제 상태 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">결제대기</SelectItem>
                    <SelectItem value="paid">결제완료</SelectItem>
                    <SelectItem value="cancelled">취소</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedPaymentStatus === "paid" && (
                <div className="space-y-2">
                  <Label>결제 수단 (복수 선택 가능)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "in_person", label: "현금결제" },
                      { value: "bank_transfer", label: "계좌이체" },
                      { value: "card", label: "카드결제" },
                      { value: "zero_pay", label: "제로페이" },
                      { value: "online", label: "온라인결제" },
                    ].map(method => (
                      <label key={method.value} className="flex items-center gap-2 cursor-pointer p-2 rounded-md border hover:bg-muted/50 transition-colors">
                        <Checkbox
                          checked={selectedPaymentMethods.includes(method.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedPaymentMethods(prev => [...prev, method.value]);
                            } else {
                              setSelectedPaymentMethods(prev => prev.filter(m => m !== method.value));
                            }
                          }}
                          data-testid={`checkbox-payment-method-${method.value}`}
                        />
                        <span className="text-sm">{method.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>메모</Label>
                <Textarea
                  value={paymentMemoText}
                  onChange={(e) => setPaymentMemoText(e.target.value)}
                  placeholder="결제 관련 메모를 입력하세요"
                  rows={3}
                  data-testid="textarea-payment-memo"
                />
              </div>
            </div>
            <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
              {isPrincipalOrAdmin && selectedNotificationForPayment && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (!selectedNotificationForPayment) return;
                    if (window.confirm("이 청구서를 완전히 삭제하시겠습니까?\n\n취소와 다르게 학생 계정의 교육비 메뉴에서도 청구서가 완전히 사라지며, 되돌릴 수 없습니다.")) {
                      deleteNotificationMutation.mutate(selectedNotificationForPayment);
                    }
                  }}
                  disabled={deleteNotificationMutation.isPending || changePaymentStatusMutation.isPending}
                  data-testid="button-delete-payment"
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleteNotificationMutation.isPending ? "삭제 중..." : "삭제"}
                </Button>
              )}
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:ml-auto">
                <Button
                  variant="outline"
                  onClick={() => setPaymentStatusDialogOpen(false)}
                  data-testid="button-cancel-payment-status"
                  className="w-full sm:w-auto"
                >
                  취소
                </Button>
                <Button
                  onClick={() => {
                    if (selectedNotificationForPayment) {
                      changePaymentStatusMutation.mutate({
                        notificationId: selectedNotificationForPayment,
                        paymentStatus: selectedPaymentStatus,
                        paymentMethod: selectedPaymentStatus === "paid" ? selectedPaymentMethods.join(",") : "",
                        paymentMemo: paymentMemoText,
                      });
                    }
                  }}
                  disabled={changePaymentStatusMutation.isPending || deleteNotificationMutation.isPending}
                  data-testid="button-confirm-payment-status"
                  className="w-full sm:w-auto"
                >
                  {changePaymentStatusMutation.isPending ? "저장 중..." : "저장"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                {students.find(s => s.id === historyStudentId)?.name} - 발송 내역
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const [y, m] = historyMonth.split("-").map(Number);
                  const d = new Date(y, m - 2, 1);
                  setHistoryMonth(format(d, "yyyy-MM"));
                }}
                data-testid="button-history-prev-month"
              >
                <ChevronDown className="w-4 h-4 rotate-90" />
              </Button>
              <span className="font-semibold text-lg min-w-[120px] text-center" data-testid="text-history-month">
                {(() => {
                  const [y, m] = historyMonth.split("-").map(Number);
                  return `${y}년 ${m}월`;
                })()}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const [y, m] = historyMonth.split("-").map(Number);
                  const d = new Date(y, m, 1);
                  setHistoryMonth(format(d, "yyyy-MM"));
                }}
                data-testid="button-history-next-month"
              >
                <ChevronDown className="w-4 h-4 -rotate-90" />
              </Button>
            </div>
            {(() => {
              const monthNotifs = notificationHistory
                .filter(n => {
                  if (!n.createdAt) return false;
                  if (n.studentId !== historyStudentId) return false;
                  // Exclude drafts from the sending history list
                  if (n.status === "draft") return false;
                  const d = new Date(n.createdAt);
                  return format(d, "yyyy-MM") === historyMonth;
                })
                .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());

              if (monthNotifs.length === 0) {
                return <p className="text-muted-foreground py-8 text-center">해당 월에 발송 내역이 없습니다.</p>;
              }

              const paidCount = monthNotifs.filter(n => n.paymentStatus === "paid").length;
              const pendingCount = monthNotifs.filter(n => n.paymentStatus === "pending").length;
              const cancelledCount = monthNotifs.filter(n => n.paymentStatus === "cancelled").length;
              const totalAmount = monthNotifs.reduce((sum, n) => sum + (n.sentAmount || 0) + (n.textbookTotal || 0), 0);

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="border rounded-md p-2">
                      <div className="text-xs text-muted-foreground">총 발송</div>
                      <div className="font-bold">{monthNotifs.length}건</div>
                    </div>
                    <div className="border rounded-md p-2">
                      <div className="text-xs text-muted-foreground">결제완료</div>
                      <div className="font-bold text-green-600">{paidCount}건</div>
                    </div>
                    <div className="border rounded-md p-2">
                      <div className="text-xs text-muted-foreground">결제대기</div>
                      <div className="font-bold text-orange-500">{pendingCount}건</div>
                    </div>
                    <div className="border rounded-md p-2">
                      <div className="text-xs text-muted-foreground">총 금액</div>
                      <div className="font-bold">{formatCurrency(totalAmount)}</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto border rounded-md">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-2.5 font-medium">제목</th>
                          <th className="text-right p-2.5 font-medium">금액</th>
                          <th className="text-center p-2.5 font-medium">상태</th>
                          <th className="text-center p-2.5 font-medium">발송일</th>
                          <th className="text-center p-2.5 font-medium">관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthNotifs.map((notification) => {
                          const isCancelled = notification.paymentStatus === "cancelled";
                          const isPaid = notification.paymentStatus === "paid";
                          const isPending = notification.paymentStatus === "pending";

                          const isContentExpanded = expandedHistoryNotif === notification.id;

                          return (
                            <Fragment key={notification.id}>
                              <tr
                                className={`border-b ${isCancelled ? "opacity-50" : ""} cursor-pointer hover:bg-muted/30`}
                                data-testid={`history-row-${notification.id}`}
                                onClick={() => setExpandedHistoryNotif(isContentExpanded ? null : notification.id)}
                              >
                                <td className="p-2.5">
                                  <div className="flex items-center gap-1">
                                    <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isContentExpanded ? "rotate-180" : ""}`} />
                                    {notification.title || "-"}
                                  </div>
                                </td>
                                <td className={`p-2.5 text-right ${isCancelled ? "line-through" : ""}`}>
                                  {formatCurrency((notification.sentAmount || 0) + (notification.textbookTotal || 0))}
                                </td>
                                <td className="p-2.5 text-center">
                                  {isPaid ? (
                                    <Badge variant="default" className="text-xs">결제완료</Badge>
                                  ) : isCancelled ? (
                                    <Badge variant="secondary" className="text-xs">취소</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs">대기</Badge>
                                  )}
                                </td>
                                <td className="p-2.5 text-center text-xs text-muted-foreground">
                                  {notification.createdAt
                                    ? new Date(notification.createdAt).toLocaleDateString("ko-KR")
                                    : "-"}
                                </td>
                                <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-center gap-1">
                                    {isPending && (
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-7 text-xs px-2"
                                        onClick={() => {
                                          if (confirm("이 교육비 안내를 취소하시겠습니까?")) {
                                            cancelNotificationMutation.mutate(notification.id);
                                          }
                                        }}
                                        disabled={cancelNotificationMutation.isPending}
                                        data-testid={`button-cancel-notification-${notification.id}`}
                                      >
                                        취소
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs px-2"
                                      onClick={() => handleOpenPaymentStatusDialog(
                                        notification.id,
                                        notification.paymentStatus,
                                        getEffectivePaymentMethod(notification),
                                        notification.paymentMemo
                                      )}
                                      data-testid={`button-change-status-history-${notification.id}`}
                                    >
                                      상태변경
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                              {isContentExpanded && notification.messageContent && (
                                <tr key={`${notification.id}-content`}>
                                  <td colSpan={5} className="p-0">
                                    <div className="bg-muted/30 border-b px-4 py-3">
                                      <div className="text-xs font-medium text-muted-foreground mb-1.5">발송 문자 내용</div>
                                      <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed bg-background rounded-md p-3 border">{notification.messageContent}</pre>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (isParent) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-2">
          <DollarSign className="w-6 h-6" />
          <h1 className="text-2xl font-bold">교육비 안내</h1>
        </div>

        {children.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              연결된 자녀 정보가 없습니다
            </CardContent>
          </Card>
        ) : (
          children.map((childData) => {
            const { total, breakdown } = calculateFees(childData.enrollments);
            const hasPassword = childData.hasPassword || false;
            return (
              <Card key={childData.child.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      {childData.child.name}
                    </div>
                    <div className="flex items-center gap-2">
                      {hasPassword ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenPasswordDialog(childData.child.id)}
                            data-testid={`button-change-password-${childData.child.id}`}
                          >
                            <Key className="w-4 h-4 mr-1" />
                            비밀번호 변경
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeletePassword(childData.child.id)}
                            data-testid={`button-delete-password-${childData.child.id}`}
                          >
                            <Unlock className="w-4 h-4 mr-1" />
                            잠금 해제
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenPasswordDialog(childData.child.id)}
                          data-testid={`button-set-password-${childData.child.id}`}
                        >
                          <Lock className="w-4 h-4 mr-1" />
                          열람 비밀번호 설정
                        </Button>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {breakdown.length === 0 ? (
                    <p className="text-muted-foreground">수강 중인 수업이 없습니다</p>
                  ) : (
                    <div className="space-y-4">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium">수업명</th>
                            <th className="text-center p-3 font-medium">유형</th>
                            <th className="text-right p-3 font-medium">금액</th>
                          </tr>
                        </thead>
                        <tbody>
                          {breakdown.map((item, index) => (
                            <tr key={index} className="border-b">
                              <td className="p-3">{item.className}</td>
                              <td className="p-3 text-center text-muted-foreground">
                                {item.isFirst ? "기본" : "추가"}
                              </td>
                              <td className="p-3 text-right">{formatCurrency(item.fee)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="font-bold bg-muted/50">
                            <td className="p-3" colSpan={2}>총 교육비</td>
                            <td className="p-3 text-right text-lg">{formatCurrency(total)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}

        {tuitionGuidance && (tuitionGuidance.guidanceText || (tuitionGuidance.imageUrls && tuitionGuidance.imageUrls.length > 0)) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                교육비 안내
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tuitionGuidance.guidanceText && (
                <div className="whitespace-pre-wrap text-muted-foreground">
                  {tuitionGuidance.guidanceText}
                </div>
              )}
              {tuitionGuidance.imageUrls && tuitionGuidance.imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-4">
                  {tuitionGuidance.imageUrls.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={`교육비 안내 이미지 ${index + 1}`}
                      className="max-w-full md:max-w-md rounded-md border cursor-pointer"
                      onClick={() => window.open(url, '_blank')}
                      data-testid={`guidance-image-${index}`}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                교육비 열람 비밀번호 설정
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                학생이 교육비를 확인할 때 입력해야 하는 비밀번호를 설정합니다.
              </p>
              <div className="space-y-2">
                <Label htmlFor="newPassword">새 비밀번호 (4자리 이상)</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="비밀번호 입력"
                    data-testid="input-new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호 다시 입력"
                  data-testid="input-confirm-password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                취소
              </Button>
              <Button 
                onClick={handleSetPassword}
                disabled={setPasswordMutation.isPending}
                data-testid="button-save-password"
              >
                저장
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    );
  }

  if (isStudent) {
    const requiresPassword = passwordStatus?.hasPassword && !isVerified;

    if (requiresPassword) {
      return (
        <div className="p-4 md:p-6">
          <div className="flex items-center gap-2 mb-6">
            <DollarSign className="w-6 h-6" />
            <h1 className="text-2xl font-bold">교육비 안내</h1>
          </div>
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                비밀번호 입력
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                교육비를 확인하려면 학부모님이 설정한 비밀번호를 입력하세요.
              </p>
              <div className="space-y-2">
                <Label htmlFor="studentPassword">비밀번호</Label>
                <Input
                  id="studentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={studentPassword}
                  onChange={(e) => {
                    setStudentPassword(e.target.value);
                    setVerificationError("");
                  }}
                  placeholder="비밀번호 입력"
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyPassword()}
                  data-testid="input-student-password"
                />
                {verificationError && (
                  <p className="text-sm text-destructive">{verificationError}</p>
                )}
              </div>
              <Button 
                onClick={handleVerifyPassword}
                disabled={verifyPasswordMutation.isPending}
                className="w-full"
                data-testid="button-verify-password"
              >
                확인
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    const { total, breakdown } = calculateFees(studentEnrollments);

    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-2">
          <DollarSign className="w-6 h-6" />
          <h1 className="text-2xl font-bold">교육비 안내</h1>
        </div>

        {pendingPayments.length > 0 && (() => {
          const renderPaymentRow = (payment: TuitionNotification) => {
            const tuitionAmount = payment.sentAmount || 0;
            const textbookAmount = payment.textbookTotal || 0;
            const totalAmount = tuitionAmount + textbookAmount;
            const createdDate = payment.createdAt 
              ? new Date(payment.createdAt).toLocaleDateString("ko-KR") 
              : "-";
            const isPending = payment.paymentStatus === "pending";
            const isPaid = payment.paymentStatus === "paid";
            const isCancelled = payment.paymentStatus === "cancelled";
            
            return (
              <div key={payment.id} className={`rounded-md p-4 space-y-3 ${
                isPaid ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800" : 
                isCancelled ? "opacity-60 bg-muted/20 border border-dashed" :
                "bg-muted/30"
              }`}>
                {payment.title && (
                  <div className={`font-semibold text-base ${isCancelled ? "line-through text-muted-foreground" : ""}`} data-testid={`text-payment-title-${payment.id}`}>
                    {payment.title}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">
                    청구일: {createdDate}
                  </span>
                  {isPaid ? (
                    <Badge variant="default">결제 완료</Badge>
                  ) : isCancelled ? (
                    <Badge variant="destructive">취소된 결제</Badge>
                  ) : (
                    <Badge variant="outline">결제 대기</Badge>
                  )}
                </div>
                
                <div className={`space-y-2 ${isCancelled ? "line-through text-muted-foreground" : ""}`}>
                  <div className="flex justify-between text-sm">
                    <span>수강료</span>
                    <span>{formatCurrency(tuitionAmount)}</span>
                  </div>
                  {textbookAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>교재비</span>
                      <span>{formatCurrency(textbookAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>총 결제금액</span>
                    <span className="text-lg">{formatCurrency(totalAmount)}</span>
                  </div>
                </div>
                
                {isPending && (
                  <>
                    <Button 
                      className="w-full" 
                      onClick={() => handleTossPayment(payment.id)}
                      disabled={isPaymentLoading}
                      data-testid={`button-pay-${payment.id}`}
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      {isPaymentLoading ? "결제 준비 중..." : "결제하기"}
                    </Button>
                    
                    <p className="text-xs text-muted-foreground text-center">
                      카드, 계좌이체 등 다양한 결제수단을 이용하실 수 있습니다.
                    </p>
                  </>
                )}
                
                {isPaid && payment.paidAt && (
                  <p className="text-xs text-green-600 dark:text-green-400 text-center">
                    결제일: {new Date(payment.paidAt).toLocaleDateString("ko-KR")}
                  </p>
                )}

                {isCancelled && (
                  <p className="text-xs text-destructive text-center font-medium">
                    이 결제는 취소되었습니다.
                  </p>
                )}
              </div>
            );
          };

          // 현재(맨 위에 표시): 미결제 + 이번달에 청구된 항목
          // 그 외(이전 결제내역): 가장 최근순 정렬
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth();
          const isCurrentMonth = (p: TuitionNotification) => {
            if (!p.createdAt) return false;
            const d = new Date(p.createdAt);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
          };
          const getTime = (p: TuitionNotification) =>
            p.createdAt ? new Date(p.createdAt).getTime() : 0;

          const currentPayments = pendingPayments
            .filter((p) => p.paymentStatus === "pending" || isCurrentMonth(p))
            .sort((a, b) => getTime(b) - getTime(a));
          const pastPayments = pendingPayments
            .filter((p) => !(p.paymentStatus === "pending" || isCurrentMonth(p)))
            .sort((a, b) => getTime(b) - getTime(a));

          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  교육비 결제 내역
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentPayments.length > 0 ? (
                  currentPayments.map(renderPaymentRow)
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    이번 달 결제 안내 전 입니다.
                  </p>
                )}

                {pastPayments.length > 0 && (
                  <div className="pt-2 border-t">
                    <Button
                      variant="ghost"
                      className="w-full justify-center text-muted-foreground"
                      onClick={() => setShowPastPayments((v) => !v)}
                      data-testid="button-toggle-past-payments"
                    >
                      <History className="w-4 h-4 mr-2" />
                      {showPastPayments
                        ? "이전 결제내역 숨기기"
                        : `이전 결제내역 확인하기 (${pastPayments.length})`}
                      <ChevronDown
                        className={`w-4 h-4 ml-2 transition-transform ${
                          showPastPayments ? "rotate-180" : ""
                        }`}
                      />
                    </Button>
                    {showPastPayments && (
                      <div className="space-y-4 mt-4" data-testid="list-past-payments">
                        {pastPayments.map(renderPaymentRow)}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {tuitionVisibility?.visible !== false && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                {user.name}님의 교육비
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {breakdown.length === 0 && studentTextbookPurchases.length === 0 ? (
                <p className="text-muted-foreground">수강 중인 수업이 없습니다</p>
              ) : (
                <>
                  {breakdown.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      수강료
                    </h3>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium">수업명</th>
                          <th className="text-center p-3 font-medium">유형</th>
                          <th className="text-right p-3 font-medium">금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {breakdown.map((item, index) => (
                          <tr key={index} className="border-b">
                            <td className="p-3">{item.className}</td>
                            <td className="p-3 text-center text-muted-foreground">
                              {item.isFirst ? "기본" : "추가"}
                            </td>
                            <td className="p-3 text-right">{formatCurrency(item.fee)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-medium bg-muted/30">
                          <td className="p-3" colSpan={2}>수강료 합계</td>
                          <td className="p-3 text-right">{formatCurrency(total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {studentTextbookPurchases.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                      <Book className="w-4 h-4" />
                      교재비
                    </h3>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium">교재명</th>
                          <th className="text-center p-3 font-medium">구매일</th>
                          <th className="text-right p-3 font-medium">금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentTextbookPurchases.map((purchase) => (
                          <tr key={purchase.id} className="border-b">
                            <td className="p-3">{purchase.textbookName}</td>
                            <td className="p-3 text-center text-muted-foreground">
                              {purchase.purchaseDate 
                                ? new Date(purchase.purchaseDate).toLocaleDateString("ko-KR")
                                : "-"}
                            </td>
                            <td className="p-3 text-right">{formatCurrency(purchase.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-medium bg-muted/30">
                          <td className="p-3" colSpan={2}>교재비 합계</td>
                          <td className="p-3 text-right">
                            {formatCurrency(studentTextbookPurchases.reduce((sum, p) => sum + p.price, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center font-bold text-lg">
                    <span>총 교육비</span>
                    <span>
                      {formatCurrency(total + studentTextbookPurchases.reduce((sum, p) => sum + p.price, 0))}
                    </span>
                  </div>
                </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {tuitionGuidance && (tuitionGuidance.guidanceText || (tuitionGuidance.imageUrls && tuitionGuidance.imageUrls.length > 0)) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                교육비 안내
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tuitionGuidance.guidanceText && (
                <div className="whitespace-pre-wrap text-muted-foreground">
                  {tuitionGuidance.guidanceText}
                </div>
              )}
              {tuitionGuidance.imageUrls && tuitionGuidance.imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-4">
                  {tuitionGuidance.imageUrls.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={`교육비 안내 이미지 ${index + 1}`}
                      className="max-w-full md:max-w-md rounded-md border cursor-pointer"
                      onClick={() => window.open(url, '_blank')}
                      data-testid={`student-guidance-image-${index}`}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (isTeacher) {
    return <TeacherTuitionView user={user} selectedCenter={selectedCenter} />;
  }

  return (
    <div className="p-4 md:p-6">
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          교육비 페이지는 학부모, 학생, 또는 원장/관리자만 접근할 수 있습니다
        </CardContent>
      </Card>
    </div>
  );
}

interface TeacherSearchResult {
  studentId: string;
  studentName: string;
  grade: string | null;
  tuitionFee: number;
  textbookFee: number;
  totalTuition: number;
}

function TeacherTuitionView({ user, selectedCenter }: { user: UserType; selectedCenter: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusNotifId, setStatusNotifId] = useState("");
  const [statusValue, setStatusValue] = useState("pending");
  const [statusMethod, setStatusMethod] = useState("");
  const [statusMemo, setStatusMemo] = useState("");
  const { toast } = useToast();

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<TeacherSearchResult[]>({
    queryKey: [`/api/centers/${selectedCenter}/teacher-search-students`, user.id, searchTerm],
    queryFn: async () => {
      const res = await fetch(`/api/centers/${selectedCenter}/teacher-search-students?actorId=${user.id}&query=${encodeURIComponent(searchTerm)}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedCenter && !!user.id && !!searchTerm,
  });

  const { data: studentNotifications = [], isLoading: notifsLoading } = useQuery<TuitionNotification[]>({
    queryKey: [`/api/centers/${selectedCenter}/teacher-student-notifications`, user.id, selectedStudentId],
    queryFn: async () => {
      const res = await fetch(`/api/centers/${selectedCenter}/teacher-student-notifications?actorId=${user.id}&studentId=${selectedStudentId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedCenter && !!user.id && !!selectedStudentId,
  });

  const updatePaymentStatusMutation = useMutation({
    mutationFn: async (data: { id: string; paymentStatus: string; paymentMethod: string; paymentMemo: string }) => {
      return apiRequest("PATCH", `/api/tuition-notifications/${data.id}/payment-status`, {
        ...data,
        actorId: user.id,
      });
    },
    onSuccess: () => {
      toast({ title: "결제 상태가 변경되었습니다" });
      queryClient.invalidateQueries({ queryKey: [`/api/centers/${selectedCenter}/teacher-student-notifications`] });
      setStatusDialogOpen(false);
    },
    onError: () => {
      toast({ title: "상태 변경에 실패했습니다", variant: "destructive" });
    },
  });

  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return "0원";
    return amount.toLocaleString("ko-KR") + "원";
  };

  const selectedStudent = searchResults.find(s => s.studentId === selectedStudentId);

  const getPaymentMethodLabel = (method: string | null) => {
    if (!method) return "-";
    const labels: Record<string, string> = { in_person: "현금결제", bank_transfer: "계좌이체", zero_pay: "제로페이", online: "온라인결제" };
    return method.split(",").map(m => labels[m.trim()] || m.trim()).join(", ");
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setSelectedStudentId(null);
    setSearchTerm(searchQuery.trim());
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <DollarSign className="w-6 h-6" />
        <h1 className="text-2xl font-bold">교육비 결제현황</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="학생 이름을 입력하고 엔터를 누르세요"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                className="pl-9"
                data-testid="input-teacher-student-search"
              />
            </div>
            <Button onClick={handleSearch} disabled={!searchQuery.trim()} data-testid="button-teacher-search">
              검색
            </Button>
          </div>
        </CardContent>
      </Card>

      {searchTerm && !selectedStudentId && (
        <Card>
          <CardContent className="pt-6">
            {searchLoading ? (
              <div className="text-sm text-muted-foreground text-center py-4">검색 중...</div>
            ) : searchResults.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">"{searchTerm}" 검색 결과가 없습니다</div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground mb-2">검색 결과 {searchResults.length}명</p>
                {searchResults.map(s => (
                  <button
                    key={s.studentId}
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-muted rounded-md flex items-center justify-between text-sm border"
                    onClick={() => {
                      setSelectedStudentId(s.studentId);
                    }}
                    data-testid={`search-result-${s.studentId}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.studentName}</span>
                      <Badge variant="outline" className="text-xs">{s.grade || "-"}</Badge>
                    </div>
                    <span className="text-muted-foreground tabular-nums">{formatCurrency(s.totalTuition)}</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedStudentId && selectedStudent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5" />
                <span>{selectedStudent.studentName}</span>
                <Badge variant="outline">{selectedStudent.grade || "-"}</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedStudentId(null);
                }}
                data-testid="button-clear-student"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-muted-foreground">수강료</div>
                <div className="font-semibold mt-1">{formatCurrency(selectedStudent.tuitionFee)}</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-muted-foreground">교재비</div>
                <div className="font-semibold mt-1">{selectedStudent.textbookFee > 0 ? formatCurrency(selectedStudent.textbookFee) : "-"}</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-muted-foreground">총 교육비</div>
                <div className="font-bold mt-1">{formatCurrency(selectedStudent.totalTuition)}</div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <History className="w-4 h-4" />
                결제현황
              </h3>
              {notifsLoading ? (
                <div className="text-sm text-muted-foreground text-center py-4">로딩 중...</div>
              ) : studentNotifications.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">발송된 교육비 안내가 없습니다</div>
              ) : (
                <div className="space-y-3">
                  {studentNotifications.map((n) => {
                    const nTuition = n.sentAmount || 0;
                    const nTextbook = n.textbookTotal || 0;
                    const nTotal = nTuition + nTextbook;
                    const nStatus = (n.paymentStatus as "paid" | "pending" | "cancelled") || "pending";
                    return (
                      <div key={n.id} className="border rounded-lg p-3 space-y-2" data-testid={`teacher-notif-card-${n.id}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {n.status === "scheduled" ? "예약" : ""} {n.createdAt ? new Date(n.createdAt).toLocaleDateString("ko-KR") : "-"}
                          </span>
                          {nStatus === "paid" ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">결제완료</Badge>
                          ) : nStatus === "cancelled" ? (
                            <Badge variant="secondary">취소</Badge>
                          ) : (
                            <Badge variant="destructive">결제대기</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">수강료</span>
                            <div className="mt-0.5 tabular-nums">{formatCurrency(nTuition)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">교재비</span>
                            <div className="mt-0.5 tabular-nums">{nTextbook > 0 ? formatCurrency(nTextbook) : "-"}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">총액</span>
                            <div className="mt-0.5 font-semibold tabular-nums">{formatCurrency(nTotal)}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          {nStatus === "paid" ? (
                            <span className="text-xs text-muted-foreground">{getPaymentMethodLabel(n.paymentMethod)}</span>
                          ) : (
                            <span />
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2"
                            onClick={() => {
                              setStatusNotifId(n.id);
                              setStatusValue(n.paymentStatus || "pending");
                              setStatusMethod(n.paymentMethod || "");
                              setStatusMemo(n.paymentMemo || "");
                              setStatusDialogOpen(true);
                            }}
                            data-testid={`button-teacher-status-change-${n.id}`}
                          >
                            상태변경
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>결제 상태 변경</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">결제 상태</Label>
              <Select value={statusValue} onValueChange={setStatusValue}>
                <SelectTrigger className="mt-1" data-testid="select-teacher-payment-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">결제대기</SelectItem>
                  <SelectItem value="paid">결제완료</SelectItem>
                  <SelectItem value="cancelled">취소</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {statusValue === "paid" && (
              <div>
                <Label className="text-sm font-medium">결제수단</Label>
                <div className="mt-1 space-y-2">
                  {[
                    { value: "in_person", label: "현금결제" },
                    { value: "bank_transfer", label: "계좌이체" },
                    { value: "card", label: "카드결제" },
                    { value: "zero_pay", label: "제로페이" },
                    { value: "online", label: "온라인결제" },
                  ].map((opt) => {
                    const selected = statusMethod.split(",").filter(Boolean);
                    const isChecked = selected.includes(opt.value);
                    return (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const newSelected = isChecked
                              ? selected.filter(v => v !== opt.value)
                              : [...selected, opt.value];
                            setStatusMethod(newSelected.join(","));
                          }}
                          className="rounded border-gray-300"
                          data-testid={`checkbox-teacher-payment-method-${opt.value}`}
                        />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <Label className="text-sm font-medium">메모</Label>
              <Input
                value={statusMemo}
                onChange={(e) => setStatusMemo(e.target.value)}
                placeholder="메모 입력 (선택)"
                className="mt-1"
                data-testid="input-teacher-payment-memo"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>취소</Button>
            <Button
              onClick={() => {
                updatePaymentStatusMutation.mutate({
                  id: statusNotifId,
                  paymentStatus: statusValue,
                  paymentMethod: statusMethod,
                  paymentMemo: statusMemo,
                });
              }}
              disabled={updatePaymentStatusMutation.isPending}
              data-testid="button-teacher-confirm-status"
            >
              {updatePaymentStatusMutation.isPending ? "처리중..." : "변경"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
