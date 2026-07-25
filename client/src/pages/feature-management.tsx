import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Plus, 
  Settings, 
  Check, 
  X, 
  Clock, 
  Image as ImageIcon,
  FileText,
  Phone,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Send,
  Eye,
  EyeOff,
  Upload,
  Loader2,
  Video,
  Bug,
  MessageSquare
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserRole, type Feature, type FeatureRequest, type CenterFeature, type Center, type User, type FeatureSuggestion, type FeatureCategory, BugReportStatus, type BugReport } from "@shared/schema";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { ManualButton } from "@/components/manual-button";

export default function FeatureManagementPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === UserRole.ADMIN;
  const isPrincipal = user?.role === UserRole.PRINCIPAL;

  // Role-based access guard - only Admin and Principal can access
  if (!user || (user.role < UserRole.PRINCIPAL)) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold text-muted-foreground">접근 권한이 없습니다</h2>
            <p className="mt-2 text-muted-foreground">이 페이지는 원장 또는 관리자만 접근할 수 있습니다.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState(isAdmin ? "features" : "available");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isRequestSuccessDialogOpen, setIsRequestSuccessDialogOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  const [expandedFeatureCards, setExpandedFeatureCards] = useState<Set<string>>(new Set());

  // Bug report states (admin only)
  const [selectedBugReport, setSelectedBugReport] = useState<EnrichedBugReport | null>(null);
  const [bugAdminNote, setBugAdminNote] = useState("");
  const [deleteBugReportId, setDeleteBugReportId] = useState<string | null>(null);
  const [bugFilter, setBugFilter] = useState<"all" | "pending" | "resolved">("all");

  // Category management states
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isEditCategoryDialogOpen, setIsEditCategoryDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<FeatureCategory | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    menuKey: "",
    description: "",
    displayOrder: 0,
    isActive: true,
  });

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    imageUrl: "",
    videoUrl: "",
    menuKey: "",
    parentMenuKey: null as string | null,
    categoryId: null as string | null,
    featureType: "optional" as "basic" | "optional",
    displayOrder: 1,
    purchasePrice: 0,
    subscriptionPrice: 0,
  });

  const [requestFormData, setRequestFormData] = useState({
    phoneNumber: "",
    requestNote: "",
  });

  const [suggestionFormData, setSuggestionFormData] = useState({
    title: "",
    description: "",
  });

  const [isSuggestionDialogOpen, setIsSuggestionDialogOpen] = useState(false);
  const [suggestionAdminNote, setSuggestionAdminNote] = useState("");

  // Feature notification SMS states (admin only)
  const [isNotifyDialogOpen, setIsNotifyDialogOpen] = useState(false);
  const [notifyFeature, setNotifyFeature] = useState<Feature | null>(null);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifySelectedCenters, setNotifySelectedCenters] = useState<string[]>([]);
  const [isNotifySending, setIsNotifySending] = useState(false);

  // Suggestion reply SMS states (admin only)
  const [isSuggestionSmsDialogOpen, setIsSuggestionSmsDialogOpen] = useState(false);
  const [suggestionForSms, setSuggestionForSms] = useState<FeatureSuggestion | null>(null);
  const [suggestionSmsMessage, setSuggestionSmsMessage] = useState("");
  const [isSuggestionSmsSending, setIsSuggestionSmsSending] = useState(false);

  // Track seen suggestion statuses for principal notifications
  const [seenSuggestionStatuses, setSeenSuggestionStatuses] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(`suggestion-seen-statuses-${user?.id}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [responseNote, setResponseNote] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [requestStatusFilter, setRequestStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCenterForFeatures, setSelectedCenterForFeatures] = useState<string | null>(null);

  // Queries
  const { data: featureCategories = [] } = useQuery<FeatureCategory[]>({
    queryKey: ["/api/feature-categories"],
  });

  const { data: features = [], isLoading: featuresLoading } = useQuery<Feature[]>({
    queryKey: ["/api/features"],
  });

  const { data: featureRequests = [], isLoading: requestsLoading } = useQuery<FeatureRequest[]>({
    queryKey: ["/api/feature-requests", selectedCenter?.id],
    queryFn: async () => {
      const url = isAdmin 
        ? `/api/feature-requests?actorId=${user?.id}`
        : `/api/feature-requests?actorId=${user?.id}&centerId=${selectedCenter?.id}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch feature requests");
      return res.json();
    },
    enabled: !!user?.id && (isAdmin || !!selectedCenter?.id),
  });

  const { data: centerFeatures = [] } = useQuery<CenterFeature[]>({
    queryKey: ["/api/center-features", selectedCenter?.id],
    queryFn: async () => {
      const res = await fetch(`/api/center-features/${selectedCenter?.id}`);
      if (!res.ok) throw new Error("Failed to fetch center features");
      return res.json();
    },
    enabled: !!selectedCenter?.id,
  });

  const { data: centers = [] } = useQuery<Center[]>({
    queryKey: ["/api/centers"],
    enabled: isAdmin,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin || isPrincipal,
  });

  const { data: selectedCenterFeatures = [] } = useQuery<CenterFeature[]>({
    queryKey: ["/api/center-features", selectedCenterForFeatures],
    enabled: isAdmin && !!selectedCenterForFeatures,
  });

  // Feature Suggestions (새 기능 개발 요청)
  const { data: featureSuggestions = [], isLoading: suggestionsLoading } = useQuery<FeatureSuggestion[]>({
    queryKey: ["/api/feature-suggestions", selectedCenter?.id],
    queryFn: async () => {
      const url = isAdmin 
        ? `/api/feature-suggestions?actorId=${user?.id}`
        : `/api/feature-suggestions?actorId=${user?.id}&centerId=${selectedCenter?.id}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch feature suggestions");
      return res.json();
    },
    enabled: !!user?.id && (isAdmin || !!selectedCenter?.id),
  });

  // Bug reports query (admin only)
  interface EnrichedBugReport extends BugReport {
    reporterName: string;
    centerName: string;
  }
  
  const { data: bugReports = [], isLoading: bugReportsLoading } = useQuery<EnrichedBugReport[]>({
    queryKey: ["/api/bug-reports", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/bug-reports?actorId=${user?.id}`);
      if (!res.ok) throw new Error("Failed to fetch bug reports");
      return res.json();
    },
    enabled: !!user && isAdmin,
  });

  const filteredBugReports = bugReports.filter((r) => {
    if (bugFilter === "pending") return r.status === BugReportStatus.PENDING;
    if (bugFilter === "resolved") return r.status === BugReportStatus.RESOLVED;
    return true;
  });

  const pendingBugCount = bugReports.filter((r) => r.status === BugReportStatus.PENDING).length;
  const resolvedBugCount = bugReports.filter((r) => r.status === BugReportStatus.RESOLVED).length;

  // Mutations
  
  // Category mutations
  const createCategoryMutation = useMutation({
    mutationFn: async (data: typeof categoryFormData) => {
      return apiRequest("POST", `/api/feature-categories?actorId=${user?.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "상위 메뉴가 생성되었습니다" });
      setIsCategoryDialogOpen(false);
      setCategoryFormData({ name: "", menuKey: "", description: "", displayOrder: 0, isActive: true });
      queryClient.invalidateQueries({ queryKey: ["/api/feature-categories"] });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "상위 메뉴 생성에 실패했습니다", variant: "destructive" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof categoryFormData> }) => {
      return apiRequest("PATCH", `/api/feature-categories/${id}?actorId=${user?.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "상위 메뉴가 수정되었습니다" });
      setIsEditCategoryDialogOpen(false);
      setSelectedCategory(null);
      setCategoryFormData({ name: "", menuKey: "", description: "", displayOrder: 0, isActive: true });
      queryClient.invalidateQueries({ queryKey: ["/api/feature-categories"] });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "상위 메뉴 수정에 실패했습니다", variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/feature-categories/${id}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      toast({ title: "상위 메뉴가 삭제되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/feature-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/features"] });
    },
    onError: () => {
      toast({ title: "상위 메뉴 삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const createFeatureMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", `/api/features?actorId=${user?.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "기능이 등록되었습니다" });
      setIsCreateDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/features"] });
    },
    onError: () => {
      toast({ title: "기능 등록에 실패했습니다", variant: "destructive" });
    },
  });

  const updateFeatureMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      return apiRequest("PATCH", `/api/features/${id}?actorId=${user?.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "기능이 수정되었습니다" });
      setIsEditDialogOpen(false);
      setSelectedFeature(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/features"] });
    },
    onError: () => {
      toast({ title: "기능 수정에 실패했습니다", variant: "destructive" });
    },
  });

  const deleteFeatureMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/features/${id}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      toast({ title: "기능이 삭제되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/features"] });
    },
    onError: () => {
      toast({ title: "기능 삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data: { featureId: string; centerId: string; phoneNumber: string; requestNote?: string }) => {
      return apiRequest("POST", `/api/feature-requests?actorId=${user?.id}`, data);
    },
    onSuccess: () => {
      setIsRequestDialogOpen(false);
      setSelectedFeature(null);
      setRequestFormData({ phoneNumber: "", requestNote: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/feature-requests"] });
      setIsRequestSuccessDialogOpen(true);
    },
    onError: (error: any) => {
      toast({ title: error?.message || "기능 요청에 실패했습니다", variant: "destructive" });
    },
  });

  const invalidateCenterFeatures = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/center-features");
      }
    });
  };

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, status, responseNote }: { id: string; status: string; responseNote?: string }) => {
      return apiRequest("PATCH", `/api/feature-requests/${id}?actorId=${user?.id}`, { status, responseNote });
    },
    onSuccess: () => {
      toast({ title: "요청이 처리되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/feature-requests"] });
      invalidateCenterFeatures();
    },
    onError: () => {
      toast({ title: "요청 처리에 실패했습니다", variant: "destructive" });
    },
  });

  const sendCompletionSmsMutation = useMutation({
    mutationFn: async ({ requestId }: { requestId: string }) => {
      return apiRequest("POST", `/api/feature-requests/${requestId}/send-completion-sms?actorId=${user?.id}`, {});
    },
    onSuccess: () => {
      toast({ title: "완료 알림 문자가 전송되었습니다" });
    },
    onError: () => {
      toast({ title: "문자 전송에 실패했습니다", variant: "destructive" });
    },
  });

  const enableFeatureMutation = useMutation({
    mutationFn: async ({ centerId, featureId }: { centerId: string; featureId: string }) => {
      return apiRequest("POST", `/api/center-features?actorId=${user?.id}`, { centerId, featureId });
    },
    onSuccess: () => {
      toast({ title: "기능이 활성화되었습니다" });
      invalidateCenterFeatures();
    },
    onError: () => {
      toast({ title: "기능 활성화에 실패했습니다", variant: "destructive" });
    },
  });

  const disableFeatureMutation = useMutation({
    mutationFn: async ({ centerId, featureId }: { centerId: string; featureId: string }) => {
      return apiRequest("DELETE", `/api/center-features/${centerId}/${featureId}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      toast({ title: "기능이 비활성화되었습니다" });
      invalidateCenterFeatures();
    },
    onError: () => {
      toast({ title: "기능 비활성화에 실패했습니다", variant: "destructive" });
    },
  });

  const toggleAccountTypeMutation = useMutation({
    mutationFn: async ({ centerId, clinicTeacherEnabled }: { centerId: string; clinicTeacherEnabled: boolean }) => {
      return apiRequest("PATCH", `/api/centers/${centerId}`, { clinicTeacherEnabled });
    },
    onSuccess: () => {
      toast({ title: "계정 유형 설정이 변경되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/centers"] });
    },
    onError: () => {
      toast({ title: "계정 유형 설정 변경에 실패했습니다", variant: "destructive" });
    },
  });

  // Feature Suggestions Mutations
  const createSuggestionMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; centerId: string }) => {
      return apiRequest("POST", `/api/feature-suggestions?actorId=${user?.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "기능 요청이 전송되었습니다" });
      setIsSuggestionDialogOpen(false);
      setSuggestionFormData({ title: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/feature-suggestions"] });
    },
    onError: () => {
      toast({ title: "기능 요청에 실패했습니다", variant: "destructive" });
    },
  });

  const updateSuggestionMutation = useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: string; status: string; adminNote?: string }) => {
      return apiRequest("PATCH", `/api/feature-suggestions/${id}?actorId=${user?.id}`, { status, adminNote });
    },
    onSuccess: () => {
      toast({ title: "요청이 처리되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/feature-suggestions"] });
    },
    onError: () => {
      toast({ title: "요청 처리에 실패했습니다", variant: "destructive" });
    },
  });

  // Bug report mutations (admin only)
  const updateBugReportMutation = useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: string; status?: string; adminNote?: string }) => {
      const res = await apiRequest("PATCH", `/api/bug-reports/${id}?actorId=${user?.id}`, { status, adminNote });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bug-reports"] });
      setSelectedBugReport(null);
      toast({ title: "처리 완료" });
    },
    onError: () => {
      toast({ title: "처리에 실패했습니다", variant: "destructive" });
    },
  });

  const deleteBugReportMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/bug-reports/${id}?actorId=${user?.id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bug-reports"] });
      setDeleteBugReportId(null);
      toast({ title: "삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const toggleHiddenMutation = useMutation({
    mutationFn: async ({ featureId, isHidden }: { featureId: string; isHidden: boolean }) => {
      return apiRequest("PATCH", `/api/center-features/${selectedCenter?.id}/${featureId}/toggle-hidden?actorId=${user?.id}`, { isHidden });
    },
    onSuccess: () => {
      toast({ title: "기능 표시 설정이 변경되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/center-features", selectedCenter?.id] });
    },
    onError: () => {
      toast({ title: "설정 변경에 실패했습니다", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      imageUrl: "",
      videoUrl: "",
      menuKey: "",
      parentMenuKey: null,
      categoryId: null,
      featureType: "optional",
      displayOrder: 1,
      purchasePrice: 0,
      subscriptionPrice: 0,
    });
  };

  const handleImageUpload = async (file: File) => {
    if (!file || !user?.id) return;
    
    setIsUploading(true);
    try {
      const response = await fetch(`/api/features/presigned-url?actorId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadUrl, publicUrl } = await response.json();

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      setFormData(prev => ({ ...prev, imageUrl: publicUrl }));
      toast({ title: "이미지가 업로드되었습니다" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (editFileInputRef.current) editFileInputRef.current.value = "";
    } catch (error) {
      console.error("Image upload failed:", error);
      toast({ title: "이미지 업로드에 실패했습니다", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (editFileInputRef.current) editFileInputRef.current.value = "";
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditClick = (feature: Feature) => {
    setSelectedFeature(feature);
    setFormData({
      name: feature.name,
      description: feature.description || "",
      imageUrl: feature.imageUrl || "",
      videoUrl: feature.videoUrl || "",
      menuKey: feature.menuKey,
      parentMenuKey: feature.parentMenuKey,
      categoryId: feature.categoryId || null,
      featureType: feature.featureType as "basic" | "optional",
      displayOrder: feature.displayOrder || 1,
      purchasePrice: feature.purchasePrice || 0,
      subscriptionPrice: feature.subscriptionPrice || 0,
    });
    setIsEditDialogOpen(true);
  };

  const handleDetailClick = (feature: Feature) => {
    setSelectedFeature(feature);
    setIsDetailDialogOpen(true);
  };

  const handleRequestClick = (feature: Feature) => {
    setSelectedFeature(feature);
    setRequestFormData({ phoneNumber: user?.phone || "", requestNote: "" });
    setIsRequestDialogOpen(true);
  };

  const toggleRequestExpand = (id: string) => {
    setExpandedRequests(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleFeatureCardExpand = (id: string) => {
    setExpandedFeatureCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleQuickRequest = (feature: Feature) => {
    setSelectedFeature(feature);
    setRequestFormData({ phoneNumber: user?.phone || "", requestNote: "" });
    setIsRequestDialogOpen(true);
  };

  // Handle feature notification to centers (admin only)
  const handleNotifyFeature = (feature: Feature) => {
    setNotifyFeature(feature);
    setNotifyMessage(`[새결수학] 새로운 기능이 추가되었습니다!\n\n기능명: ${feature.name}\n${feature.description || ""}\n\n추가기능 메뉴에서 확인해주세요.`);
    setNotifySelectedCenters([]);
    setIsNotifyDialogOpen(true);
  };

  const handleSendNotification = async () => {
    if (!notifyFeature || notifySelectedCenters.length === 0) {
      toast({ title: "알림 발송 대상을 선택해주세요", variant: "destructive" });
      return;
    }
    if (!notifyMessage.trim()) {
      toast({ title: "메시지를 입력해주세요", variant: "destructive" });
      return;
    }

    setIsNotifySending(true);
    try {
      // Get principal phones for selected centers
      const selectedCentersData = centers.filter(c => notifySelectedCenters.includes(c.id));
      const phones: string[] = [];
      
      for (const center of selectedCentersData) {
        // Find principals for this center
        const centerPrincipals = users.filter(u => 
          u.role === UserRole.PRINCIPAL && 
          u.phone
        );
        
        // Get user centers to filter by center
        for (const principal of centerPrincipals) {
          if (principal.phone) {
            phones.push(principal.phone);
          }
        }
      }

      if (phones.length === 0) {
        toast({ title: "발송할 원장 전화번호가 없습니다", variant: "destructive" });
        setIsNotifySending(false);
        return;
      }

      const response = await apiRequest("POST", "/api/sms/direct-bulk-send", {
        phones: [...new Set(phones)],
        message: notifyMessage.trim(),
        centerName: "DMC센터",
        actorId: user?.id,
      });

      const result = response as unknown as { successCount: number; failCount: number };
      toast({ 
        title: `알림 발송 완료`,
        description: `성공: ${result.successCount}건, 실패: ${result.failCount}건`
      });
      setIsNotifyDialogOpen(false);
      setNotifyFeature(null);
    } catch (error: any) {
      toast({ 
        title: "알림 발송 실패", 
        description: error?.message || "오류가 발생했습니다",
        variant: "destructive" 
      });
    } finally {
      setIsNotifySending(false);
    }
  };

  // Handle suggestion SMS reply
  const handleSuggestionSms = (suggestion: FeatureSuggestion, type: "reply" | "completed") => {
    const requester = users.find(u => u.id === suggestion.requestedBy);
    setSuggestionForSms(suggestion);
    
    if (type === "completed") {
      setSuggestionSmsMessage(`[새결수학] 기능 개발 완료 안내\n\n안녕하세요.\n요청하신 "${suggestion.title}" 기능 개발이 완료되었습니다.\n\n추가기능 메뉴에서 확인하시고 활성화해주세요.\n\n감사합니다.`);
    } else {
      setSuggestionSmsMessage(`[새결수학] 기능 개발 요청 답변\n\n안녕하세요.\n요청하신 "${suggestion.title}"에 대한 답변입니다.\n\n(답변 내용을 입력해주세요)\n\n감사합니다.`);
    }
    setIsSuggestionSmsDialogOpen(true);
  };

  const handleSendSuggestionSms = async () => {
    if (!suggestionForSms) return;
    
    const requester = users.find(u => u.id === suggestionForSms.requestedBy);
    if (!requester?.phone) {
      toast({ title: "요청자의 전화번호가 없습니다", variant: "destructive" });
      return;
    }
    if (!suggestionSmsMessage.trim()) {
      toast({ title: "메시지를 입력해주세요", variant: "destructive" });
      return;
    }

    setIsSuggestionSmsSending(true);
    try {
      const response = await fetch(`/api/sms/send?actorId=${user?.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: requester.phone,
          text: suggestionSmsMessage.trim(),
          useSystemCredentials: true,
        }),
        credentials: "include",
      });

      if (response.ok) {
        toast({ title: "문자가 발송되었습니다" });
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({ title: "문자 발송에 실패했습니다", description: errorData.error, variant: "destructive" });
      }
      setIsSuggestionSmsDialogOpen(false);
      setSuggestionForSms(null);
    } catch (error: any) {
      toast({ 
        title: "문자 발송 실패", 
        description: error?.message || "오류가 발생했습니다",
        variant: "destructive" 
      });
    } finally {
      setIsSuggestionSmsSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />대기 중</Badge>;
      case "approved":
        return <Badge className="bg-green-500 hover:bg-green-600"><Check className="w-3 h-3 mr-1" />승인됨</Badge>;
      case "rejected":
        return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />거절됨</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCenterName = (centerId: string) => {
    const center = centers.find(c => c.id === centerId);
    return center?.name || centerId;
  };

  const getUserName = (userId: string) => {
    const foundUser = users.find(u => u.id === userId);
    return foundUser?.name || userId;
  };

  const getFeatureName = (featureId: string) => {
    const feature = features.find(f => f.id === featureId);
    return feature?.name || featureId;
  };

  // Filter features for principal view
  const optionalFeatures = features.filter(f => f.featureType === "optional" && f.isActive);
  const enabledFeatureIds = centerFeatures.map(cf => cf.featureId);
  const pendingRequestFeatureIds = featureRequests
    .filter(r => r.status === "pending")
    .map(r => r.featureId);

  const availableFeatures = optionalFeatures.filter(
    f => !enabledFeatureIds.includes(f.id) && !pendingRequestFeatureIds.includes(f.id)
  );

  // Track new features for principals (features created after last view)
  const LAST_VIEWED_KEY = "feature_management_last_viewed";
  
  const newFeatureIds = useMemo(() => {
    if (isAdmin) return new Set<string>();
    const lastViewed = localStorage.getItem(LAST_VIEWED_KEY);
    if (!lastViewed) {
      // First time viewing - all available features are "new"
      return new Set(availableFeatures.map(f => f.id));
    }
    const lastViewedDate = new Date(lastViewed);
    return new Set(
      availableFeatures
        .filter(f => f.createdAt && new Date(f.createdAt) > lastViewedDate)
        .map(f => f.id)
    );
  }, [availableFeatures, isAdmin]);

  // Mark features as viewed when principal opens the page
  useEffect(() => {
    if (!isAdmin && availableFeatures.length > 0) {
      // Delay slightly so user can see the "new" indicators before they disappear on next visit
      const timer = setTimeout(() => {
        localStorage.setItem(LAST_VIEWED_KEY, new Date().toISOString());
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isAdmin, availableFeatures.length]);

  const isNewFeature = (featureId: string) => newFeatureIds.has(featureId);

  // Calculate suggestion status updates for principals
  const suggestionUpdates = useMemo(() => {
    if (isAdmin) return { hasUpdates: false, updatedIds: new Set<string>(), count: 0 };
    
    const updatedIds = new Set<string>();
    featureSuggestions.forEach(s => {
      const seenStatus = seenSuggestionStatuses[s.id];
      // Show notification if status changed to approved or completed since last view
      if ((s.status === "approved" || s.status === "completed" || s.status === "in_review") && seenStatus !== s.status) {
        updatedIds.add(s.id);
      }
    });
    
    return { 
      hasUpdates: updatedIds.size > 0, 
      updatedIds, 
      count: updatedIds.size 
    };
  }, [featureSuggestions, seenSuggestionStatuses, isAdmin]);

  // Mark suggestion statuses as seen when viewing suggest tab
  const markSuggestionStatusesAsSeen = () => {
    if (isAdmin || featureSuggestions.length === 0) return;
    
    const newSeenStatuses: Record<string, string> = { ...seenSuggestionStatuses };
    featureSuggestions.forEach(s => {
      newSeenStatuses[s.id] = s.status;
    });
    
    setSeenSuggestionStatuses(newSeenStatuses);
    localStorage.setItem(`suggestion-seen-statuses-${user?.id}`, JSON.stringify(newSeenStatuses));
  };

  // Function to check if a suggestion has updates
  const hasSuggestionUpdate = (suggestionId: string) => suggestionUpdates.updatedIds.has(suggestionId);

  if (!user) return null;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">추가 기능 메뉴</h1>
            <p className="text-muted-foreground">
              {isAdmin ? "기능을 등록하고 원장의 요청을 관리합니다" : "추가 기능을 신청하고 상태를 확인합니다"}
            </p>
          </div>
          <ManualButton menuKey="feature-management" />
        </div>
      </div>

      {isAdmin ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col gap-4 mb-4">
            <div className="overflow-x-auto">
              <TabsList className="inline-flex w-auto">
                <TabsTrigger value="features" data-testid="tab-features">기능 관리</TabsTrigger>
                <TabsTrigger value="center-features" data-testid="tab-center-features">센터 기능 관리</TabsTrigger>
                <TabsTrigger value="requests" data-testid="tab-requests">
                  요청 관리
                  {featureRequests.filter(r => r.status === "pending").length > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {featureRequests.filter(r => r.status === "pending").length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="suggestions" data-testid="tab-suggestions">
                  개발 요청
                  {featureSuggestions.filter(s => s.status === "pending").length > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {featureSuggestions.filter(s => s.status === "pending").length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="bug-reports" data-testid="tab-bug-reports">
                  오류 제보
                  {pendingBugCount > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {pendingBugCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="features" className="space-y-6">
            {featuresLoading ? (
              <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
            ) : (
              <>
                {/* 상위 메뉴별 기능 그룹 */}
                {featureCategories.map((category) => {
                  const categoryFeatures = features.filter(f => f.categoryId === category.id);
                  // Debug log to identify categorization issue
                  console.log(`[DEBUG] Category: ${category.name} (${category.id}), Features count: ${categoryFeatures.length}`, categoryFeatures.map(f => ({ name: f.name, categoryId: f.categoryId })));
                  return (
                    <Card key={category.id} className={!category.isActive ? "opacity-60" : ""} data-testid={`card-category-${category.id}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div>
                              <CardTitle className="text-base flex items-center gap-2">
                                {category.name}
                                <Badge variant="outline" className="text-xs font-normal">
                                  {categoryFeatures.length}개 기능
                                </Badge>
                              </CardTitle>
                              <CardDescription className="text-xs">{category.description || category.menuKey}</CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedCategory(category);
                                setCategoryFormData({
                                  name: category.name,
                                  menuKey: category.menuKey,
                                  description: category.description || "",
                                  displayOrder: category.displayOrder,
                                  isActive: category.isActive,
                                });
                                setIsEditCategoryDialogOpen(true);
                              }}
                              data-testid={`button-edit-category-${category.id}`}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="text-destructive" data-testid={`button-delete-category-${category.id}`}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>상위 메뉴 삭제</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    "{category.name}" 상위 메뉴를 삭제하시겠습니까?
                                    {categoryFeatures.length > 0 && (
                                      <span className="block mt-2 text-amber-600">
                                        이 메뉴에 속한 {categoryFeatures.length}개의 기능은 독립 메뉴로 변경됩니다.
                                      </span>
                                    )}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>취소</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteCategoryMutation.mutate(category.id)}>
                                    삭제
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {categoryFeatures.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">하위 기능이 없습니다</p>
                        ) : (
                          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {categoryFeatures.map((feature) => (
                              <div key={feature.id} className="border rounded-md p-3 space-y-2" data-testid={`card-feature-${feature.id}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-medium text-sm truncate">{feature.name}</span>
                                    {feature.videoUrl && (
                                      <Badge variant="outline" className="text-xs font-normal shrink-0 gap-1 bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
                                        <Video className="w-3 h-3" />
                                        영상
                                      </Badge>
                                    )}
                                  </div>
                                  <Badge variant={feature.featureType === "basic" ? "default" : "secondary"} className="text-xs shrink-0">
                                    {feature.featureType === "basic" ? "기본" : "선택"}
                                  </Badge>
                                </div>
                                {feature.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">{feature.description}</p>
                                )}
                                <div className="flex flex-wrap gap-1.5">
                                  {feature.purchasePrice > 0 ? (
                                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                      구매 {feature.purchasePrice.toLocaleString()}원
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                      구매 무료
                                    </Badge>
                                  )}
                                  {feature.subscriptionPrice > 0 ? (
                                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                      월 {feature.subscriptionPrice.toLocaleString()}원
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                      월 무료
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex gap-1">
                                  <Button size="sm" variant="ghost" onClick={() => handleEditClick(feature)} data-testid={`button-edit-feature-${feature.id}`}>
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleNotifyFeature(feature)} data-testid={`button-notify-feature-${feature.id}`} title="센터에 알림 발송">
                                    <Send className="w-3 h-3" />
                                  </Button>
                                  {feature.featureType !== "basic" && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button size="sm" variant="ghost" className="text-destructive" data-testid={`button-delete-feature-${feature.id}`}>
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>기능 삭제</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            '{feature.name}' 기능을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>취소</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => deleteFeatureMutation.mutate(feature.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            삭제
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {/* 독립 메뉴 기능들 */}
                {(() => {
                  const independentFeatures = features.filter(f => !f.categoryId);
                  if (independentFeatures.length === 0 && featureCategories.length > 0) return null;
                  return (
                    <Card data-testid="card-independent-features">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          독립 메뉴
                          <Badge variant="outline" className="text-xs font-normal">
                            {independentFeatures.length}개 기능
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs">상위 메뉴 없이 독립적으로 표시되는 기능들</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {independentFeatures.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">등록된 기능이 없습니다</p>
                        ) : (
                          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {independentFeatures.map((feature) => (
                              <div key={feature.id} className="border rounded-md p-3 space-y-2" data-testid={`card-feature-${feature.id}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-medium text-sm truncate">{feature.name}</span>
                                    {feature.videoUrl && (
                                      <Badge variant="outline" className="text-xs font-normal shrink-0 gap-1 bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
                                        <Video className="w-3 h-3" />
                                        영상
                                      </Badge>
                                    )}
                                  </div>
                                  <Badge variant={feature.featureType === "basic" ? "default" : "secondary"} className="text-xs shrink-0">
                                    {feature.featureType === "basic" ? "기본" : "선택"}
                                  </Badge>
                                </div>
                                {feature.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">{feature.description}</p>
                                )}
                                <div className="flex flex-wrap gap-1.5">
                                  {feature.purchasePrice > 0 ? (
                                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                      구매 {feature.purchasePrice.toLocaleString()}원
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                      구매 무료
                                    </Badge>
                                  )}
                                  {feature.subscriptionPrice > 0 ? (
                                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                      월 {feature.subscriptionPrice.toLocaleString()}원
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                      월 무료
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex gap-1">
                                  <Button size="sm" variant="ghost" onClick={() => handleEditClick(feature)} data-testid={`button-edit-feature-${feature.id}`}>
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleNotifyFeature(feature)} data-testid={`button-notify-feature-${feature.id}`} title="센터에 알림 발송">
                                    <Send className="w-3 h-3" />
                                  </Button>
                                  {feature.featureType !== "basic" && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button size="sm" variant="ghost" className="text-destructive" data-testid={`button-delete-feature-${feature.id}`}>
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>기능 삭제</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            '{feature.name}' 기능을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>취소</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => deleteFeatureMutation.mutate(feature.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            삭제
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* 상위 메뉴 추가 버튼 */}
                <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full border-dashed" data-testid="button-add-category">
                      <Plus className="w-4 h-4 mr-2" />
                      상위 메뉴 추가
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>새 상위 메뉴 추가</DialogTitle>
                      <DialogDescription>기능들을 그룹화할 새로운 상위 메뉴를 생성합니다.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>메뉴 이름</Label>
                        <Input
                          value={categoryFormData.name}
                          onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                          placeholder="예: 수업 관리"
                          data-testid="input-category-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>설명 (선택)</Label>
                        <Textarea
                          value={categoryFormData.description}
                          onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                          placeholder="상위 메뉴에 대한 설명"
                          rows={2}
                          data-testid="input-category-description"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>취소</Button>
                      <Button
                        onClick={() => createCategoryMutation.mutate(categoryFormData)}
                        disabled={!categoryFormData.name || createCategoryMutation.isPending}
                        data-testid="button-submit-category"
                      >
                        생성
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </TabsContent>

          <TabsContent value="center-features" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>센터별 기능 활성화 관리</CardTitle>
                <CardDescription>
                  각 센터에서 사용할 수 있는 기능을 직접 활성화하거나 비활성화합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>센터 선택</Label>
                  <Select
                    value={selectedCenterForFeatures || ""}
                    onValueChange={(value) => setSelectedCenterForFeatures(value || null)}
                  >
                    <SelectTrigger data-testid="select-center-for-features">
                      <SelectValue placeholder="센터를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {centers.map(center => (
                        <SelectItem key={center.id} value={center.id}>
                          {center.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCenterForFeatures && (
                  <>
                    <div className="space-y-4 pt-4 border-t">
                      <h4 className="font-medium">계정 유형</h4>
                      <p className="text-sm text-muted-foreground">기본 계정: 원장, 학생, 선생</p>
                      <div className="grid gap-3">
                        <div 
                          className="flex items-center justify-between p-3 border rounded-lg"
                          data-testid="account-type-clinic-teacher"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">클리닉 선생님</div>
                            <p className="text-sm text-muted-foreground">클리닉 전담 선생님 계정 유형을 활성화합니다</p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {centers.find(c => c.id === selectedCenterForFeatures)?.clinicTeacherEnabled ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                onClick={() => toggleAccountTypeMutation.mutate({ 
                                  centerId: selectedCenterForFeatures, 
                                  clinicTeacherEnabled: false 
                                })}
                                disabled={toggleAccountTypeMutation.isPending}
                                data-testid="button-disable-clinic-teacher"
                              >
                                <X className="w-3 h-3 mr-1" />
                                비활성화
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => toggleAccountTypeMutation.mutate({ 
                                  centerId: selectedCenterForFeatures, 
                                  clinicTeacherEnabled: true 
                                })}
                                disabled={toggleAccountTypeMutation.isPending}
                                data-testid="button-enable-clinic-teacher"
                              >
                                <Check className="w-3 h-3 mr-1" />
                                활성화
                              </Button>
                            )}
                            <Badge variant={centers.find(c => c.id === selectedCenterForFeatures)?.clinicTeacherEnabled ? "default" : "secondary"}>
                              {centers.find(c => c.id === selectedCenterForFeatures)?.clinicTeacherEnabled ? "활성" : "비활성"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 선택 기능 - 상위메뉴/하위메뉴/독립메뉴로 분류 */}
                    <div className="space-y-4 pt-4 border-t">
                      <h4 className="font-medium">선택 기능 ({features.filter(f => f.featureType === "optional").length}개)</h4>
                      
                      {/* 상위메뉴별 기능 */}
                      {featureCategories.filter(cat => cat.isActive).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)).map(category => {
                        const categoryFeatures = features.filter(f => f.featureType === "optional" && f.categoryId === category.id);
                        if (categoryFeatures.length === 0) return null;
                        
                        return (
                          <div key={category.id} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-muted-foreground">{category.name}</span>
                              <Badge variant="outline" className="text-xs">상위메뉴</Badge>
                            </div>
                            <div className="grid gap-3 pl-4 border-l-2 border-muted">
                              {categoryFeatures.map(feature => {
                                const isEnabled = selectedCenterFeatures.some(cf => cf.featureId === feature.id);
                                return (
                                  <div 
                                    key={feature.id} 
                                    className="flex items-center justify-between p-3 border rounded-lg"
                                    data-testid={`center-feature-item-${feature.id}`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium">{feature.name}</div>
                                      {feature.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-1">{feature.description}</p>
                                      )}
                                      <div className="flex flex-wrap gap-1.5 mt-1">
                                        {feature.purchasePrice > 0 ? (
                                          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                            구매 {feature.purchasePrice.toLocaleString()}원
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                            구매 무료
                                          </Badge>
                                        )}
                                        {feature.subscriptionPrice > 0 ? (
                                          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                            월 {feature.subscriptionPrice.toLocaleString()}원
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                            월 무료
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                      {isEnabled ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-destructive"
                                          onClick={() => disableFeatureMutation.mutate({ 
                                            centerId: selectedCenterForFeatures, 
                                            featureId: feature.id 
                                          })}
                                          disabled={disableFeatureMutation.isPending}
                                          data-testid={`button-disable-feature-${feature.id}`}
                                        >
                                          <X className="w-3 h-3 mr-1" />
                                          비활성화
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          onClick={() => enableFeatureMutation.mutate({ 
                                            centerId: selectedCenterForFeatures, 
                                            featureId: feature.id 
                                          })}
                                          disabled={enableFeatureMutation.isPending}
                                          data-testid={`button-enable-feature-${feature.id}`}
                                        >
                                          <Check className="w-3 h-3 mr-1" />
                                          활성화
                                        </Button>
                                      )}
                                      <Badge variant={isEnabled ? "default" : "secondary"}>
                                        {isEnabled ? "활성" : "비활성"}
                                      </Badge>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* 독립메뉴 기능 */}
                      {(() => {
                        const independentFeatures = features.filter(f => f.featureType === "optional" && !f.categoryId);
                        if (independentFeatures.length === 0) return null;
                        
                        return (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-muted-foreground">독립 메뉴</span>
                              <Badge variant="outline" className="text-xs">독립메뉴</Badge>
                            </div>
                            <div className="grid gap-3">
                              {independentFeatures.map(feature => {
                                const isEnabled = selectedCenterFeatures.some(cf => cf.featureId === feature.id);
                                return (
                                  <div 
                                    key={feature.id} 
                                    className="flex items-center justify-between p-3 border rounded-lg"
                                    data-testid={`center-feature-item-${feature.id}`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium">{feature.name}</div>
                                      {feature.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-1">{feature.description}</p>
                                      )}
                                      <div className="flex flex-wrap gap-1.5 mt-1">
                                        {feature.purchasePrice > 0 ? (
                                          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                            구매 {feature.purchasePrice.toLocaleString()}원
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                            구매 무료
                                          </Badge>
                                        )}
                                        {feature.subscriptionPrice > 0 ? (
                                          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                            월 {feature.subscriptionPrice.toLocaleString()}원
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                            월 무료
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                      {isEnabled ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-destructive"
                                          onClick={() => disableFeatureMutation.mutate({ 
                                            centerId: selectedCenterForFeatures, 
                                            featureId: feature.id 
                                          })}
                                          disabled={disableFeatureMutation.isPending}
                                          data-testid={`button-disable-feature-${feature.id}`}
                                        >
                                          <X className="w-3 h-3 mr-1" />
                                          비활성화
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          onClick={() => enableFeatureMutation.mutate({ 
                                            centerId: selectedCenterForFeatures, 
                                            featureId: feature.id 
                                          })}
                                          disabled={enableFeatureMutation.isPending}
                                          data-testid={`button-enable-feature-${feature.id}`}
                                        >
                                          <Check className="w-3 h-3 mr-1" />
                                          활성화
                                        </Button>
                                      )}
                                      <Badge variant={isEnabled ? "default" : "secondary"}>
                                        {isEnabled ? "활성" : "비활성"}
                                      </Badge>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}

                {!selectedCenterForFeatures && (
                  <div className="text-center py-8 text-muted-foreground">
                    센터를 선택하면 해당 센터의 기능 활성화 상태를 확인하고 변경할 수 있습니다
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={requestStatusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setRequestStatusFilter("all")}
                data-testid="filter-all"
              >
                전체 ({featureRequests.length})
              </Button>
              <Button
                variant={requestStatusFilter === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => setRequestStatusFilter("pending")}
                data-testid="filter-pending"
              >
                대기 ({featureRequests.filter(r => r.status === "pending").length})
              </Button>
              <Button
                variant={requestStatusFilter === "approved" ? "default" : "outline"}
                size="sm"
                onClick={() => setRequestStatusFilter("approved")}
                data-testid="filter-approved"
              >
                승인 ({featureRequests.filter(r => r.status === "approved").length})
              </Button>
              <Button
                variant={requestStatusFilter === "rejected" ? "default" : "outline"}
                size="sm"
                onClick={() => setRequestStatusFilter("rejected")}
                data-testid="filter-rejected"
              >
                거절 ({featureRequests.filter(r => r.status === "rejected").length})
              </Button>
            </div>
            {requestsLoading ? (
              <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
            ) : featureRequests.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  요청된 기능이 없습니다
                </CardContent>
              </Card>
            ) : featureRequests.filter(r => requestStatusFilter === "all" || r.status === requestStatusFilter).length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  해당 상태의 요청이 없습니다
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {featureRequests.filter(r => requestStatusFilter === "all" || r.status === requestStatusFilter).map((request) => (
                  <Card key={request.id} data-testid={`card-request-${request.id}`}>
                    <CardHeader 
                      className="cursor-pointer"
                      onClick={() => toggleRequestExpand(request.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base truncate">
                              {getFeatureName(request.featureId)}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {getCenterName(request.centerId)} · {getUserName(request.requestedBy)}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(request.status)}
                          {expandedRequests.has(request.id) ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    {expandedRequests.has(request.id) && (
                      <CardContent className="pt-0 space-y-4">
                        <div className="grid gap-2 text-sm">
                          <div className="flex items-center gap-2 justify-between">
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-muted-foreground" />
                              <span>{request.phoneNumber}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => sendCompletionSmsMutation.mutate({ requestId: request.id })}
                              disabled={sendCompletionSmsMutation.isPending}
                              data-testid={`button-send-completion-sms-${request.id}`}
                            >
                              {sendCompletionSmsMutation.isPending ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4 mr-1" />
                              )}
                              완료 알림 전송
                            </Button>
                          </div>
                          {request.requestNote && (
                            <div className="flex items-start gap-2">
                              <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                              <span>{request.requestNote}</span>
                            </div>
                          )}
                          {request.responseNote && (
                            <div className="flex items-start gap-2 text-muted-foreground">
                              <span className="font-medium">관리자 메모:</span>
                              <span>{request.responseNote}</span>
                            </div>
                          )}
                        </div>
                        {request.status === "pending" && (
                          <div className="flex gap-2 pt-2">
                            <div className="flex-1">
                              <Input
                                placeholder="응답 메모 (선택)"
                                value={responseNote}
                                onChange={(e) => setResponseNote(e.target.value)}
                                data-testid={`input-response-note-${request.id}`}
                              />
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                updateRequestMutation.mutate({
                                  id: request.id,
                                  status: "approved",
                                  responseNote,
                                });
                                setResponseNote("");
                              }}
                              disabled={updateRequestMutation.isPending}
                              data-testid={`button-approve-${request.id}`}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              승인
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive"
                              onClick={() => {
                                updateRequestMutation.mutate({
                                  id: request.id,
                                  status: "rejected",
                                  responseNote,
                                });
                                setResponseNote("");
                              }}
                              disabled={updateRequestMutation.isPending}
                              data-testid={`button-reject-${request.id}`}
                            >
                              <X className="w-4 h-4 mr-1" />
                              거절
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="suggestions" className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">새 기능 개발 요청</h3>
              <p className="text-sm text-muted-foreground">원장들이 요청한 새로운 기능 개발 요청 목록입니다</p>
            </div>

            {suggestionsLoading ? (
              <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
            ) : featureSuggestions.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  새 기능 개발 요청이 없습니다
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {featureSuggestions.map((suggestion) => {
                  const centerName = centers.find(c => c.id === suggestion.centerId)?.name || "알 수 없음";
                  const requester = users.find(u => u.id === suggestion.requestedBy);
                  return (
                    <Card key={suggestion.id} data-testid={`card-admin-suggestion-${suggestion.id}`}>
                      <CardHeader>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <CardTitle className="text-base">{suggestion.title}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {centerName} · {requester?.name || "알 수 없음"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {suggestion.status === "pending" && <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />대기 중</Badge>}
                            {suggestion.status === "in_review" && <Badge variant="secondary">검토 중</Badge>}
                            {suggestion.status === "approved" && <Badge className="bg-blue-500">승인됨</Badge>}
                            {suggestion.status === "rejected" && <Badge variant="destructive">거절됨</Badge>}
                            {suggestion.status === "completed" && <Badge className="bg-green-500"><Check className="w-3 h-3 mr-1" />완료</Badge>}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-3">
                        <div className="bg-muted p-3 rounded-md">
                          <p className="text-sm whitespace-pre-wrap">{suggestion.description}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          요청일: {new Date(suggestion.createdAt!).toLocaleDateString('ko-KR')}
                        </p>
                        {suggestion.adminNote && (
                          <div className="bg-primary/10 p-3 rounded-md">
                            <p className="text-sm font-medium">관리자 메모:</p>
                            <p className="text-sm">{suggestion.adminNote}</p>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 pt-2">
                          {suggestion.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateSuggestionMutation.mutate({ id: suggestion.id, status: "in_review" })}
                                data-testid={`button-review-suggestion-${suggestion.id}`}
                              >
                                검토 시작
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => updateSuggestionMutation.mutate({ id: suggestion.id, status: "rejected", adminNote: "요청이 거절되었습니다" })}
                                data-testid={`button-reject-suggestion-${suggestion.id}`}
                              >
                                <X className="w-3 h-3 mr-1" />
                                거절
                              </Button>
                            </>
                          )}
                          {suggestion.status === "in_review" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => updateSuggestionMutation.mutate({ id: suggestion.id, status: "approved" })}
                                data-testid={`button-approve-suggestion-${suggestion.id}`}
                              >
                                <Check className="w-3 h-3 mr-1" />
                                승인
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => updateSuggestionMutation.mutate({ id: suggestion.id, status: "rejected", adminNote: "요청이 거절되었습니다" })}
                                data-testid={`button-reject-suggestion-${suggestion.id}`}
                              >
                                <X className="w-3 h-3 mr-1" />
                                거절
                              </Button>
                            </>
                          )}
                          {suggestion.status === "approved" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => updateSuggestionMutation.mutate({ id: suggestion.id, status: "completed", adminNote: "기능 개발이 완료되었습니다" })}
                                data-testid={`button-complete-suggestion-${suggestion.id}`}
                              >
                                <Check className="w-3 h-3 mr-1" />
                                개발 완료
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSuggestionSms(suggestion, "reply")}
                                data-testid={`button-sms-reply-${suggestion.id}`}
                              >
                                <Send className="w-3 h-3 mr-1" />
                                답변 문자
                              </Button>
                            </>
                          )}
                          {suggestion.status === "completed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSuggestionSms(suggestion, "completed")}
                              data-testid={`button-sms-completed-${suggestion.id}`}
                            >
                              <Send className="w-3 h-3 mr-1" />
                              완료 알림
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Bug Reports Tab (Admin) */}
          <TabsContent value="bug-reports" className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <p className="text-muted-foreground">원장님들이 제보한 오류를 확인하고 처리합니다</p>
              <div className="flex gap-2">
                <Button
                  variant={bugFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBugFilter("all")}
                  data-testid="button-bug-filter-all"
                >
                  전체 ({bugReports.length})
                </Button>
                <Button
                  variant={bugFilter === "pending" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBugFilter("pending")}
                  data-testid="button-bug-filter-pending"
                >
                  <Clock className="h-4 w-4 mr-1" />
                  대기 중 ({pendingBugCount})
                </Button>
                <Button
                  variant={bugFilter === "resolved" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBugFilter("resolved")}
                  data-testid="button-bug-filter-resolved"
                >
                  <Check className="h-4 w-4 mr-1" />
                  처리 완료 ({resolvedBugCount})
                </Button>
              </div>
            </div>

            {bugReportsLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredBugReports.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {bugFilter === "pending" ? "대기 중인 오류 제보가 없습니다" :
                   bugFilter === "resolved" ? "처리 완료된 오류 제보가 없습니다" :
                   "오류 제보가 없습니다"}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredBugReports.map((report) => (
                  <Card key={report.id} className="hover-elevate cursor-pointer" onClick={() => {
                    setSelectedBugReport(report);
                    setBugAdminNote(report.adminNote || "");
                  }} data-testid={`card-bug-report-${report.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{report.title}</CardTitle>
                          <CardDescription>
                            {report.centerName} · {report.reporterName} · {format(new Date(report.createdAt!), "yyyy.MM.dd HH:mm", { locale: ko })}
                          </CardDescription>
                        </div>
                        <Badge variant={report.status === BugReportStatus.RESOLVED ? "default" : "secondary"}>
                          {report.status === BugReportStatus.RESOLVED ? (
                            <><Check className="h-3 w-3 mr-1" /> 처리 완료</>
                          ) : (
                            <><Clock className="h-3 w-3 mr-1" /> 대기 중</>
                          )}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">{report.description}</p>
                      {report.adminNote && (
                        <div className="mt-2 p-2 bg-muted rounded-md text-sm">
                          <span className="font-medium">관리자 메모:</span> {report.adminNote}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : isPrincipal ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="mb-4 overflow-x-auto">
            <TabsList className="inline-flex w-auto">
              <TabsTrigger value="available" data-testid="tab-available">신청 가능</TabsTrigger>
              <TabsTrigger value="my-requests" data-testid="tab-my-requests">학원 요청</TabsTrigger>
              <TabsTrigger value="enabled" data-testid="tab-enabled">사용 중</TabsTrigger>
              <TabsTrigger 
                value="suggest" 
                data-testid="tab-suggest"
                onClick={markSuggestionStatusesAsSeen}
                className="relative"
              >
                개발요청
                {suggestionUpdates.count > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 text-xs">
                    {suggestionUpdates.count}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="bug-reports" data-testid="tab-bug-reports">
                오류 제보
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="available" className="space-y-6">
            {pendingRequestFeatureIds.length > 0 && (
              <p className="text-sm text-muted-foreground">
                이미 신청 중인 기능 {pendingRequestFeatureIds.length}개가 있습니다. "학원 요청" 탭에서 확인하세요.
              </p>
            )}
            {featuresLoading ? (
              <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
            ) : availableFeatures.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  신청 가능한 추가 기능이 없습니다
                </CardContent>
              </Card>
            ) : (
              <>
                {/* 상위 메뉴별 기능 그룹 */}
                {featureCategories.map((category) => {
                  const categoryFeatures = availableFeatures.filter(f => f.categoryId === category.id);
                  if (categoryFeatures.length === 0) return null;
                  return (
                    <Card key={category.id} data-testid={`card-category-${category.id}`}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          {category.name}
                          <Badge variant="outline" className="text-xs font-normal">
                            {categoryFeatures.length}개 기능
                          </Badge>
                        </CardTitle>
                        {category.description && (
                          <CardDescription className="text-xs">{category.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                          {categoryFeatures.map((feature) => (
                            <div key={feature.id} className={`border rounded-md p-3 space-y-2 ${isNewFeature(feature.id) ? "border-2 border-red-500 dark:border-red-400" : ""}`} data-testid={`card-available-feature-${feature.id}`}>
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-medium text-sm">{feature.name}</span>
                                <div className="flex items-center gap-1">
                                  {isNewFeature(feature.id) && (
                                    <Badge variant="destructive" className="text-xs shrink-0">NEW</Badge>
                                  )}
                                  <Badge variant="secondary" className="text-xs shrink-0">선택</Badge>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {feature.purchasePrice > 0 ? (
                                  <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                    구매 {feature.purchasePrice.toLocaleString()}원
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                    구매 무료
                                  </Badge>
                                )}
                                {feature.subscriptionPrice > 0 ? (
                                  <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                    월 {feature.subscriptionPrice.toLocaleString()}원
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                    월 무료
                                  </Badge>
                                )}
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="w-full" 
                                onClick={() => toggleFeatureCardExpand(feature.id)} 
                                data-testid={`button-view-feature-${feature.id}`}
                              >
                                {expandedFeatureCards.has(feature.id) ? (
                                  <>
                                    <ChevronUp className="w-3 h-3 mr-1" />
                                    접기
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3 h-3 mr-1" />
                                    기능보기
                                  </>
                                )}
                              </Button>
                              {expandedFeatureCards.has(feature.id) && (
                                <div className="space-y-3 pt-2 border-t">
                                  {feature.description && (
                                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                                  )}
                                  {feature.videoUrl && (
                                    <div className="aspect-video rounded-md overflow-hidden">
                                      <iframe
                                        className="w-full h-full"
                                        src={feature.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                                        allowFullScreen
                                      />
                                    </div>
                                  )}
                                  {feature.imageUrl && !feature.videoUrl && (
                                    <img 
                                      src={feature.imageUrl} 
                                      alt={feature.name}
                                      className="w-full rounded-md object-cover"
                                    />
                                  )}
                                  <Button 
                                    size="sm" 
                                    variant="default" 
                                    className="w-full" 
                                    onClick={() => handleQuickRequest(feature)} 
                                    data-testid={`button-request-${feature.id}`}
                                  >
                                    <Send className="w-3 h-3 mr-1" />
                                    신청
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* 독립 메뉴 기능들 */}
                {(() => {
                  const independentFeatures = availableFeatures.filter(f => !f.categoryId);
                  if (independentFeatures.length === 0) return null;
                  return (
                    <Card data-testid="card-independent-features">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          독립 메뉴
                          <Badge variant="outline" className="text-xs font-normal">
                            {independentFeatures.length}개 기능
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs">상위 메뉴 없이 독립적으로 표시되는 기능들</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                          {independentFeatures.map((feature) => (
                            <div key={feature.id} className={`border rounded-md p-3 space-y-2 ${isNewFeature(feature.id) ? "border-2 border-red-500 dark:border-red-400" : ""}`} data-testid={`card-available-feature-${feature.id}`}>
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-medium text-sm">{feature.name}</span>
                                <div className="flex items-center gap-1">
                                  {isNewFeature(feature.id) && (
                                    <Badge variant="destructive" className="text-xs shrink-0">NEW</Badge>
                                  )}
                                  <Badge variant="secondary" className="text-xs shrink-0">선택</Badge>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {feature.purchasePrice > 0 ? (
                                  <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                    구매 {feature.purchasePrice.toLocaleString()}원
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                    구매 무료
                                  </Badge>
                                )}
                                {feature.subscriptionPrice > 0 ? (
                                  <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                    월 {feature.subscriptionPrice.toLocaleString()}원
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                    월 무료
                                  </Badge>
                                )}
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="w-full" 
                                onClick={() => toggleFeatureCardExpand(feature.id)} 
                                data-testid={`button-view-feature-${feature.id}`}
                              >
                                {expandedFeatureCards.has(feature.id) ? (
                                  <>
                                    <ChevronUp className="w-3 h-3 mr-1" />
                                    접기
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3 h-3 mr-1" />
                                    기능보기
                                  </>
                                )}
                              </Button>
                              {expandedFeatureCards.has(feature.id) && (
                                <div className="space-y-3 pt-2 border-t">
                                  {feature.description && (
                                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                                  )}
                                  {feature.videoUrl && (
                                    <div className="aspect-video rounded-md overflow-hidden">
                                      <iframe
                                        className="w-full h-full"
                                        src={feature.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                                        allowFullScreen
                                      />
                                    </div>
                                  )}
                                  {feature.imageUrl && !feature.videoUrl && (
                                    <img 
                                      src={feature.imageUrl} 
                                      alt={feature.name}
                                      className="w-full rounded-md object-cover"
                                    />
                                  )}
                                  <Button 
                                    size="sm" 
                                    variant="default" 
                                    className="w-full" 
                                    onClick={() => handleQuickRequest(feature)} 
                                    data-testid={`button-request-${feature.id}`}
                                  >
                                    <Send className="w-3 h-3 mr-1" />
                                    신청
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </>
            )}
          </TabsContent>

          <TabsContent value="my-requests" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              이 학원의 모든 원장이 신청한 기능 요청 목록입니다. 한 원장이 신청하면 같은 학원의 다른 원장도 동일하게 적용됩니다.
            </p>
            {requestsLoading ? (
              <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
            ) : featureRequests.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  요청한 기능이 없습니다
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {featureRequests.map((request) => {
                  const isMyRequest = request.requestedBy === user?.id;
                  return (
                    <Card key={request.id} data-testid={`card-my-request-${request.id}`}>
                      <CardHeader>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-base">
                              {getFeatureName(request.featureId)}
                            </CardTitle>
                            <Badge variant={isMyRequest ? "default" : "outline"}>
                              {isMyRequest ? "내 신청" : `${getUserName(request.requestedBy)} 신청`}
                            </Badge>
                          </div>
                          {getStatusBadge(request.status)}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {request.requestNote && (
                          <p className="text-sm text-muted-foreground mb-2">
                            요청 메모: {request.requestNote}
                          </p>
                        )}
                        {request.responseNote && (
                          <p className="text-sm text-muted-foreground">
                            관리자 응답: {request.responseNote}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="enabled" className="space-y-6">
            {(() => {
              // Get all enabled features (both basic and optional)
              const enabledFeaturesWithInfo = centerFeatures.map(cf => {
                const feature = features.find(f => f.id === cf.featureId);
                return feature ? { ...cf, feature } : null;
              }).filter((item): item is NonNullable<typeof item> => item !== null);

              if (enabledFeaturesWithInfo.length === 0) {
                return (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      활성화된 기능이 없습니다
                    </CardContent>
                  </Card>
                );
              }

              // Group by category
              const sortedCategories = [...featureCategories].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
              
              const renderFeatureCard = (cf: typeof enabledFeaturesWithInfo[0]) => {
                const feature = cf.feature;
                const isHidden = cf.isHidden;
                const isBasic = feature.featureType === "basic";
                
                return (
                  <div 
                    key={cf.id} 
                    className={`border rounded-lg p-4 space-y-3 ${isHidden ? 'opacity-50 bg-muted/30' : ''}`}
                    data-testid={`card-enabled-feature-${cf.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{feature.name}</span>
                          {isBasic ? (
                            <Badge variant="outline" className="text-xs">기본</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">추가</Badge>
                          )}
                          {isHidden && (
                            <Badge variant="destructive" className="text-xs">
                              <EyeOff className="w-3 h-3 mr-1" />숨김
                            </Badge>
                          )}
                        </div>
                        {feature.description && (
                          <p className="text-sm text-muted-foreground mt-1">{feature.description}</p>
                        )}
                      </div>
                      <Button
                        variant={isHidden ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleHiddenMutation.mutate({ featureId: feature.id, isHidden: !isHidden })}
                        disabled={toggleHiddenMutation.isPending}
                        data-testid={`button-toggle-hidden-${cf.id}`}
                      >
                        {isHidden ? (
                          <><Eye className="w-4 h-4 mr-1" />표시</>
                        ) : (
                          <><EyeOff className="w-4 h-4 mr-1" />숨기기</>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              };

              return (
                <div className="space-y-6">
                  <p className="text-sm text-muted-foreground">
                    기능을 숨기면 해당 센터의 모든 사용자에게 메뉴가 보이지 않습니다.
                  </p>
                  
                  {/* Categorized features (하위메뉴) */}
                  {sortedCategories.map(category => {
                    const categoryFeatures = enabledFeaturesWithInfo.filter(
                      item => item.feature.categoryId === category.id
                    );
                    if (categoryFeatures.length === 0) return null;
                    
                    return (
                      <Card key={category.id}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            {category.name}
                            <Badge variant="outline" className="text-xs">상위메뉴</Badge>
                          </CardTitle>
                          <CardDescription>하위 기능 {categoryFeatures.length}개</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {categoryFeatures
                            .sort((a, b) => (a.feature.displayOrder || 0) - (b.feature.displayOrder || 0))
                            .map(renderFeatureCard)}
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Independent features (독립메뉴) */}
                  {(() => {
                    const independentFeatures = enabledFeaturesWithInfo.filter(
                      item => !item.feature.categoryId
                    );
                    if (independentFeatures.length === 0) return null;
                    
                    return (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            독립 메뉴
                            <Badge variant="outline" className="text-xs">독립메뉴</Badge>
                          </CardTitle>
                          <CardDescription>카테고리에 속하지 않는 기능 {independentFeatures.length}개</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {independentFeatures
                            .sort((a, b) => (a.feature.displayOrder || 0) - (b.feature.displayOrder || 0))
                            .map(renderFeatureCard)}
                        </CardContent>
                      </Card>
                    );
                  })()}
                </div>
              );
            })()}
          </TabsContent>

          <TabsContent value="suggest" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium">새 기능 요청</h3>
                <p className="text-sm text-muted-foreground">필요한 새로운 기능을 관리자에게 요청할 수 있습니다</p>
              </div>
              <Dialog open={isSuggestionDialogOpen} onOpenChange={setIsSuggestionDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-new-suggestion">
                    <Plus className="w-4 h-4 mr-2" />
                    새 기능 요청
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>새 기능 개발 요청</DialogTitle>
                    <DialogDescription>
                      필요한 기능을 설명해주시면 검토 후 개발을 진행합니다
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>기능 이름</Label>
                      <Input
                        value={suggestionFormData.title}
                        onChange={(e) => setSuggestionFormData({ ...suggestionFormData, title: e.target.value })}
                        placeholder="예: 학생 출석 자동 알림 기능"
                        data-testid="input-suggestion-title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>상세 설명</Label>
                      <Textarea
                        value={suggestionFormData.description}
                        onChange={(e) => setSuggestionFormData({ ...suggestionFormData, description: e.target.value })}
                        placeholder="어떤 기능이 필요하신지, 왜 필요한지 자세히 설명해주세요"
                        rows={5}
                        data-testid="input-suggestion-description"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsSuggestionDialogOpen(false)}>
                      취소
                    </Button>
                    <Button
                      onClick={() => {
                        if (selectedCenter?.id) {
                          createSuggestionMutation.mutate({
                            ...suggestionFormData,
                            centerId: selectedCenter.id,
                          });
                        }
                      }}
                      disabled={!suggestionFormData.title || !suggestionFormData.description || createSuggestionMutation.isPending}
                      data-testid="button-submit-suggestion"
                    >
                      요청 보내기
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {suggestionsLoading ? (
              <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
            ) : featureSuggestions.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  요청한 기능이 없습니다. 필요한 기능이 있으면 요청해주세요!
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {featureSuggestions.map((suggestion) => (
                  <Card 
                    key={suggestion.id} 
                    data-testid={`card-suggestion-${suggestion.id}`}
                    className={hasSuggestionUpdate(suggestion.id) ? "ring-2 ring-primary" : ""}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{suggestion.title}</CardTitle>
                          {hasSuggestionUpdate(suggestion.id) && (
                            <Badge variant="default" className="bg-orange-500 text-xs">새 업데이트</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {suggestion.status === "pending" && <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />대기 중</Badge>}
                          {suggestion.status === "in_review" && <Badge variant="secondary">검토 중</Badge>}
                          {suggestion.status === "approved" && <Badge className="bg-blue-500">승인됨</Badge>}
                          {suggestion.status === "rejected" && <Badge variant="destructive">거절됨</Badge>}
                          {suggestion.status === "completed" && <Badge className="bg-green-500"><Check className="w-3 h-3 mr-1" />완료</Badge>}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{suggestion.description}</p>
                      {suggestion.adminNote && (
                        <div className="bg-primary/10 p-3 rounded-md border border-primary/20">
                          <p className="text-sm font-medium text-primary">관리자 응답:</p>
                          <p className="text-sm">{suggestion.adminNote}</p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        요청일: {new Date(suggestion.createdAt!).toLocaleDateString('ko-KR')}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Bug Reports Tab (Principal) */}
          <TabsContent value="bug-reports" className="space-y-4">
            <p className="text-muted-foreground">내가 제보한 오류 목록입니다</p>
            {bugReportsLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : bugReports.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  제보한 오류가 없습니다
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {bugReports.map((report) => (
                  <Card key={report.id} data-testid={`card-bug-report-${report.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{report.title}</CardTitle>
                          <CardDescription>
                            {new Date(report.createdAt!).toLocaleDateString('ko-KR')}
                          </CardDescription>
                        </div>
                        <Badge variant={report.status === "resolved" ? "default" : "outline"}>
                          {report.status === "pending" && "대기 중"}
                          {report.status === "in_progress" && "처리 중"}
                          {report.status === "resolved" && "해결됨"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      <p className="text-sm whitespace-pre-wrap">{report.description}</p>
                      {report.adminNote && (
                        <div className="bg-primary/10 p-3 rounded-md border border-primary/20">
                          <p className="text-sm font-medium text-primary">관리자 응답:</p>
                          <p className="text-sm">{report.adminNote}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : null}

      {/* Edit Feature Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>기능 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>기능 이름</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-edit-feature-name"
              />
            </div>
            <div className="space-y-2">
              <Label>기능 설명</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                data-testid="input-edit-feature-description"
              />
            </div>
            <div className="space-y-2">
              <Label>설명 이미지</Label>
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  ref={editFileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                  data-testid="input-edit-feature-image-file"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => editFileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full"
                  data-testid="button-edit-upload-feature-image"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      이미지 업로드
                    </>
                  )}
                </Button>
                {formData.imageUrl && (
                  <div className="relative">
                    <img 
                      src={formData.imageUrl} 
                      alt="기능 설명 이미지" 
                      className="w-full h-32 object-cover rounded-md border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1"
                      onClick={() => setFormData(prev => ({ ...prev, imageUrl: "" }))}
                      data-testid="button-edit-remove-feature-image"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>영상 매뉴얼 (유튜브 URL)</Label>
              <Input
                value={formData.videoUrl}
                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
                data-testid="input-edit-feature-video-url"
              />
              <p className="text-xs text-muted-foreground">기능 사용법을 안내하는 유튜브 영상 URL</p>
            </div>
            <div className="space-y-2">
              <Label>상위 메뉴 선택</Label>
              <Select
                value={formData.categoryId || "none"}
                onValueChange={(value) => setFormData({ ...formData, categoryId: value === "none" ? null : value })}
              >
                <SelectTrigger data-testid="select-edit-menu-position">
                  <SelectValue placeholder="상위 메뉴 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    독립 메뉴 (상위 메뉴 없음)
                  </SelectItem>
                  {featureCategories.filter(c => c.isActive).map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                기능이 속할 상위 메뉴를 선택합니다. 독립 메뉴로 설정하면 사이드바에 별도 메뉴로 표시됩니다.
              </p>
            </div>
            <div className="space-y-2">
              <Label>기능 유형</Label>
              <Select
                value={formData.featureType}
                onValueChange={(value) => setFormData({ ...formData, featureType: value as "basic" | "optional" })}
              >
                <SelectTrigger data-testid="select-edit-feature-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">기본 기능</SelectItem>
                  <SelectItem value="optional">선택 기능</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>기능구매비 (원)</Label>
                <Input
                  type="number"
                  value={formData.purchasePrice}
                  onChange={(e) => setFormData({ ...formData, purchasePrice: parseInt(e.target.value) || 0 })}
                  placeholder="일회성 구매 비용"
                  data-testid="input-edit-purchase-price"
                />
                <p className="text-xs text-muted-foreground">일회성 구매 비용</p>
              </div>
              <div className="space-y-2">
                <Label>구독료 (원/월)</Label>
                <Input
                  type="number"
                  value={formData.subscriptionPrice}
                  onChange={(e) => setFormData({ ...formData, subscriptionPrice: parseInt(e.target.value) || 0 })}
                  placeholder="월정액 구독료"
                  data-testid="input-edit-subscription-price"
                />
                <p className="text-xs text-muted-foreground">월정액 구독료</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              취소
            </Button>
            <Button 
              onClick={() => selectedFeature && updateFeatureMutation.mutate({ id: selectedFeature.id, data: formData })}
              disabled={!formData.name || updateFeatureMutation.isPending}
              data-testid="button-update-feature"
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feature Detail Dialog (for Principal) */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedFeature?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedFeature?.videoUrl && (
              <div className="aspect-video bg-muted rounded-md overflow-hidden">
                <iframe
                  src={selectedFeature.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                  title={selectedFeature.name}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
            {selectedFeature?.imageUrl && !selectedFeature?.videoUrl && (
              <div className="aspect-video bg-muted rounded-md overflow-hidden">
                <img 
                  src={selectedFeature.imageUrl} 
                  alt={selectedFeature.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {selectedFeature?.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {selectedFeature.description}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
              닫기
            </Button>
            <Button 
              onClick={() => {
                setIsDetailDialogOpen(false);
                if (selectedFeature) handleRequestClick(selectedFeature);
              }}
              data-testid="button-request-from-detail"
            >
              <Send className="w-4 h-4 mr-2" />
              신청하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Feature Dialog (for Principal) */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>기능 신청</DialogTitle>
            <DialogDescription>
              '{selectedFeature?.name}' 기능을 신청합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>연락처 (필수)</Label>
              <Input
                value={requestFormData.phoneNumber}
                onChange={(e) => setRequestFormData({ ...requestFormData, phoneNumber: e.target.value })}
                placeholder="010-0000-0000"
                data-testid="input-request-phone"
              />
            </div>
            <div className="space-y-2">
              <Label>요청 메모 (선택)</Label>
              <Textarea
                value={requestFormData.requestNote}
                onChange={(e) => setRequestFormData({ ...requestFormData, requestNote: e.target.value })}
                placeholder="요청 사유나 문의 사항을 입력하세요"
                rows={3}
                data-testid="input-request-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRequestDialogOpen(false)}>
              취소
            </Button>
            <Button 
              onClick={() => {
                if (!requestFormData.phoneNumber) {
                  toast({ title: "연락처를 입력해주세요", variant: "destructive" });
                  return;
                }
                if (!selectedFeature || !selectedCenter) return;
                createRequestMutation.mutate({
                  featureId: selectedFeature.id,
                  centerId: selectedCenter.id,
                  phoneNumber: requestFormData.phoneNumber,
                  requestNote: requestFormData.requestNote || undefined,
                });
              }}
              disabled={!requestFormData.phoneNumber || createRequestMutation.isPending}
              data-testid="button-submit-request"
            >
              신청하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Edit Dialog */}
      <Dialog open={isEditCategoryDialogOpen} onOpenChange={setIsEditCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>상위 메뉴 수정</DialogTitle>
            <DialogDescription>
              상위 메뉴 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>메뉴 이름</Label>
              <Input
                value={categoryFormData.name}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                placeholder="예: 수업 관리"
                data-testid="input-edit-category-name"
              />
            </div>
            <div className="space-y-2">
              <Label>설명 (선택)</Label>
              <Textarea
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                placeholder="상위 메뉴에 대한 설명"
                rows={2}
                data-testid="input-edit-category-description"
              />
            </div>
            <div className="space-y-2">
              <Label>표시 순서</Label>
              <Input
                type="number"
                value={categoryFormData.displayOrder}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, displayOrder: parseInt(e.target.value) || 0 })}
                data-testid="input-edit-category-display-order"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="category-active"
                checked={categoryFormData.isActive}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, isActive: e.target.checked })}
                className="h-4 w-4"
                data-testid="input-edit-category-active"
              />
              <Label htmlFor="category-active">활성화</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditCategoryDialogOpen(false);
                setSelectedCategory(null);
              }}
            >
              취소
            </Button>
            <Button
              onClick={() => {
                if (selectedCategory) {
                  updateCategoryMutation.mutate({ id: selectedCategory.id, data: categoryFormData });
                }
              }}
              disabled={!categoryFormData.name || !categoryFormData.menuKey || updateCategoryMutation.isPending}
              data-testid="button-update-category"
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isRequestSuccessDialogOpen} onOpenChange={setIsRequestSuccessDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>기능 신청이 완료되었습니다</AlertDialogTitle>
            <AlertDialogDescription>
              빠르게 검토 후 기능을 사용할 수 있도록 안내드리겠습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsRequestSuccessDialogOpen(false)} data-testid="button-request-success-confirm">
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bug Report Detail Dialog (Admin) */}
      <Dialog open={!!selectedBugReport} onOpenChange={(open) => !open && setSelectedBugReport(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedBugReport?.title}</DialogTitle>
            <DialogDescription>
              {selectedBugReport?.centerName} · {selectedBugReport?.reporterName}
              {selectedBugReport?.createdAt && (
                <> · {format(new Date(selectedBugReport.createdAt), "yyyy년 MM월 dd일 HH:mm", { locale: ko })}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-1">오류 내용</h4>
              <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">{selectedBugReport?.description}</p>
            </div>
            <div>
              <h4 className="font-medium mb-1 flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                관리자 메모
              </h4>
              <Textarea
                value={bugAdminNote}
                onChange={(e) => setBugAdminNote(e.target.value)}
                placeholder="처리 내용이나 메모를 입력하세요..."
                rows={3}
                data-testid="textarea-bug-admin-note"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => {
                setDeleteBugReportId(selectedBugReport?.id || null);
                setSelectedBugReport(null);
              }}
              data-testid="button-delete-bug-report"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              삭제
            </Button>
            <div className="flex gap-2 flex-1 justify-end">
              {selectedBugReport?.status === BugReportStatus.PENDING ? (
                <Button
                  onClick={() => updateBugReportMutation.mutate({ 
                    id: selectedBugReport.id, 
                    status: BugReportStatus.RESOLVED,
                    adminNote: bugAdminNote 
                  })}
                  disabled={updateBugReportMutation.isPending}
                  data-testid="button-mark-bug-resolved"
                >
                  {updateBugReportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  처리 완료
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => updateBugReportMutation.mutate({ 
                      id: selectedBugReport!.id, 
                      status: BugReportStatus.PENDING,
                      adminNote: bugAdminNote 
                    })}
                    disabled={updateBugReportMutation.isPending}
                    data-testid="button-mark-bug-pending"
                  >
                    대기 중으로 변경
                  </Button>
                  <Button
                    onClick={() => updateBugReportMutation.mutate({ 
                      id: selectedBugReport!.id, 
                      adminNote: bugAdminNote 
                    })}
                    disabled={updateBugReportMutation.isPending}
                    data-testid="button-save-bug-note"
                  >
                    {updateBugReportMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    메모 저장
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bug Report Delete Confirmation (Admin) */}
      <AlertDialog open={!!deleteBugReportId} onOpenChange={(open) => !open && setDeleteBugReportId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>오류 제보 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 오류 제보를 삭제하시겠습니까? 삭제된 내용은 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteBugReportId && deleteBugReportMutation.mutate(deleteBugReportId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-bug"
            >
              {deleteBugReportMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Feature Notification Dialog (Admin) */}
      <Dialog open={isNotifyDialogOpen} onOpenChange={(open) => { if (!open) { setIsNotifyDialogOpen(false); setNotifyFeature(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>기능 알림 발송</DialogTitle>
            <DialogDescription>
              {notifyFeature?.name} 기능에 대한 알림을 센터 원장에게 발송합니다
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>발송 대상 센터</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {notifySelectedCenters.length > 0 ? `${notifySelectedCenters.length}개 센터 선택됨` : "센터를 선택해주세요"}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    if (notifySelectedCenters.length === centers.length) {
                      setNotifySelectedCenters([]);
                    } else {
                      setNotifySelectedCenters(centers.map(c => c.id));
                    }
                  }}
                >
                  {notifySelectedCenters.length === centers.length ? "전체 해제" : "전체 선택"}
                </Button>
              </div>
              <div className="max-h-[150px] overflow-y-auto border rounded-md">
                {centers.map((center) => {
                  const isSelected = notifySelectedCenters.includes(center.id);
                  return (
                    <div 
                      key={center.id}
                      className={`flex items-center gap-3 p-2 border-b last:border-b-0 cursor-pointer hover-elevate ${isSelected ? 'bg-primary/5' : ''}`}
                      onClick={() => {
                        setNotifySelectedCenters(prev => 
                          prev.includes(center.id) 
                            ? prev.filter(id => id !== center.id)
                            : [...prev, center.id]
                        );
                      }}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span className="text-sm">{center.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notify-message">메시지</Label>
              <Textarea
                id="notify-message"
                value={notifyMessage}
                onChange={(e) => setNotifyMessage(e.target.value)}
                placeholder="발송할 메시지를 입력하세요..."
                rows={6}
                data-testid="textarea-notify-message"
              />
              <p className="text-xs text-muted-foreground text-right">{notifyMessage.length}자</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsNotifyDialogOpen(false); setNotifyFeature(null); }}>취소</Button>
            <Button 
              onClick={handleSendNotification} 
              disabled={isNotifySending || !notifyMessage.trim() || notifySelectedCenters.length === 0}
              data-testid="button-send-notify"
            >
              {isNotifySending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  발송 중...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  알림 발송
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suggestion SMS Reply Dialog */}
      <Dialog open={isSuggestionSmsDialogOpen} onOpenChange={setIsSuggestionSmsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>개발요청 답변 문자</DialogTitle>
            <DialogDescription>
              "{suggestionForSms?.title}" 요청에 대한 답변 문자를 발송합니다
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">요청자 정보</p>
              <p className="text-sm text-muted-foreground">
                {users.find(u => u.id === suggestionForSms?.requestedBy)?.name || "알 수 없음"}
                {users.find(u => u.id === suggestionForSms?.requestedBy)?.phone && 
                  ` (${users.find(u => u.id === suggestionForSms?.requestedBy)?.phone})`
                }
              </p>
            </div>
            <div className="space-y-2">
              <Label>메시지</Label>
              <Textarea
                value={suggestionSmsMessage}
                onChange={(e) => setSuggestionSmsMessage(e.target.value)}
                placeholder="답변 내용을 입력하세요..."
                rows={8}
                data-testid="textarea-suggestion-sms"
              />
              <p className="text-xs text-muted-foreground text-right">{suggestionSmsMessage.length}자</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsSuggestionSmsDialogOpen(false); setSuggestionForSms(null); }}>
              취소
            </Button>
            <Button 
              onClick={handleSendSuggestionSms} 
              disabled={isSuggestionSmsSending || !suggestionSmsMessage.trim()}
              data-testid="button-send-suggestion-sms"
            >
              {isSuggestionSmsSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  발송 중...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  문자 발송
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
