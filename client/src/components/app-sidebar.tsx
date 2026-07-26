import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Feature, CenterFeature, UserMenuOrder, FeatureCategory, FeatureRequest, Center, FeatureSuggestion } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Home,
  Calendar,
  CalendarDays,
  ClipboardList,
  ClipboardCheck,
  BarChart3,
  Video,
  BookOpen,
  Users,
  Building2,
  Settings,
  Stethoscope,
  UserCheck,
  FileText,
  Coffee,
  DollarSign,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  FileBarChart,
  HelpCircle,
  ListTodo,
  TrendingUp,
  PlusCircle,
  MessageSquare,
  MessageCircle,
  Bell,
  Megaphone,
  Clock,
  HeartHandshake,
  CalendarCheck,
  Wallet,
  Calculator,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/role-badge";
import { CenterSelector } from "@/components/center-selector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@shared/schema";
import defaultSidebarLogoUrl from "/default-sidebar-logo.png";

const classManagementItems = [
  { title: "출결 관리", url: "/attendance", icon: UserCheck },
  { title: "수업 기록", url: "/class-notes", icon: FileText },
  { title: "수업 영상", url: "/videos", icon: Video },
];

const classManagementUrls = classManagementItems.map(item => item.url);

const scheduleItems = [
  { title: "업무관리", url: "/todos", icon: ListTodo },
  { title: "학원 캘린더", url: "/academy-calendar", icon: CalendarDays },
  { title: "업무일지", url: "/work-journal", icon: FileText, menuKey: "work-journal" },
  { title: "신규상담", url: "/new-consultations", icon: MessageSquare, menuKey: "new-consultations" },
];

const scheduleUrls = scheduleItems.map(item => item.url);

const parentPortalItems = [
  { title: "문자 전송", url: "/contact-parents", icon: MessageSquare, menuKey: "contact-parents" },
  { title: "교사소통", url: "/teacher-communication", icon: MessageCircle, menuKey: "teacher-communication" },
  { title: "알림장", url: "/daily-notices", icon: Bell, menuKey: "daily-notices" },
];

const parentPortalUrls = parentPortalItems.map(item => item.url);

const studentManagementItems = [
  { title: "종합성적추이", url: "/grade-trend", icon: TrendingUp, menuKey: "grade-trend" },
  { title: "숙제 완성도", url: "/homework-completion", icon: ClipboardList, menuKey: "homework-completion" },
  { title: "출결현황", url: "/attendance-status", icon: CalendarCheck, menuKey: "attendance-status" },
  { title: "보충", url: "/supplementary", icon: Clock, menuKey: "supplementary" },
  { title: "상담", url: "/counseling", icon: HeartHandshake, menuKey: "counseling" },
];

const studentManagementUrls = studentManagementItems.map(item => item.url);

const kioskMenuItems = [
  { title: "출결패드", url: "/attendance-pad", icon: UserCheck },
];

const parentMenuItems = [
  { title: "홈", url: "/", icon: Home },
  { title: "알림장", url: "/daily-notices", icon: Bell },
  { title: "설정", url: "/settings", icon: Settings },
];

const studentMenuItems = [
  { title: "홈", url: "/", icon: Home },
  { title: "알림장", url: "/daily-notices", icon: Bell },
  { title: "교사소통", url: "/teacher-communication", icon: MessageCircle, menuKey: "teacher-communication" },
  { title: "설정", url: "/settings", icon: Settings },
];

// Student timetable items (shown as independent menu, not under "수업")
// When Google Calendar is NOT enabled: show 나의시간표 and 학원시간표
// When Google Calendar IS enabled: show only 시간표 (구글 캘린더 연동)
const studentTimetableItemsWithoutGoogle = [
  { title: "나의 시간표", url: "/my-timetable", icon: CalendarDays, menuKey: "my-timetable" },
  { title: "학원 시간표", url: "/timetable", icon: Calendar, menuKey: "timetable" },
];
const studentTimetableItemsWithGoogle = [
  { title: "시간표", url: "/google-calendar-timetable", icon: CalendarDays, menuKey: "google-calendar-timetable" },
];

// Student lesson submenu items (base items always shown)
const studentLessonItems = [
  { title: "수업기록", url: "/class-notes", icon: FileText, menuKey: "class-notes" },
  { title: "수업 영상", url: "/videos", icon: Video, menuKey: "videos" },
];

const studentLessonUrls = ["/class-notes", "/videos", "/homework", "/assessments", "/textbooks", "/face-to-face-checks", "/presentation-videos"];
const studentTimetableUrls = ["/google-calendar-timetable", "/timetable", "/my-timetable"];

const teacherMenuItems = [
  { title: "대시보드", url: "/", icon: Home },
  { title: "사용자 관리", url: "/users", icon: Users },
  { title: "시간표 관리", url: "/timetable", icon: Calendar },
  { title: "설정", url: "/settings", icon: Settings },
];

const principalMenuItems = [
  { title: "대시보드", url: "/", icon: Home },
  { title: "경영", url: "/management", icon: TrendingUp },
  { title: "사용자 관리", url: "/users", icon: Users },
  { title: "시간표 관리", url: "/timetable", icon: Calendar },
  { title: "설정", url: "/settings", icon: Settings },
];

const adminMenuItems = [
  { title: "대시보드", url: "/", icon: Home },
  { title: "센터 관리", url: "/centers", icon: Building2 },
  { title: "경영", url: "/management", icon: TrendingUp },
  { title: "사용자 관리", url: "/users", icon: Users },
  { title: "시간표 관리", url: "/timetable", icon: Calendar },
  { title: "설정", url: "/settings", icon: Settings },
];

// Menu item type with optional menuKey for feature filtering
type MenuItem = {
  title: string;
  url: string;
  icon: typeof Home;
  menuKey?: string;
  subItems?: { title: string; url: string }[];
};

interface AppSidebarProps {
  side?: "left" | "right";
}

export function AppSidebar({ side = "left" }: AppSidebarProps) {
  const [location] = useLocation();
  const searchString = useSearch();
  const { user, selectedCenter, isParentAccount, children: childUsers, selectedChild, selectChild, refreshChildren } = useAuth();
  const [classManagementOpen, setClassManagementOpen] = useState(() => 
    classManagementUrls.includes(location)
  );
  const [scheduleOpen, setScheduleOpen] = useState(() => 
    scheduleUrls.includes(location)
  );
  const [parentPortalOpen, setParentPortalOpen] = useState(() => 
    parentPortalUrls.includes(location)
  );
  const [studentManagementOpen, setStudentManagementOpen] = useState(() => 
    studentManagementUrls.includes(location)
  );
  const [studentLessonOpen, setStudentLessonOpen] = useState(() => 
    studentLessonUrls.includes(location)
  );
  
  const urlParams = new URLSearchParams(searchString);
  const currentClinicType = urlParams.get("type") || "middle";

  // Fetch features and center features for filtering optional menus
  // Include PARENT (role 0) which is lower than STUDENT (role 1)
  const { data: features = [] } = useQuery<Feature[]>({
    queryKey: ["/api/features"],
    enabled: !!user && (user.role >= UserRole.STUDENT || user.role === UserRole.PARENT),
  });

  // 학부모 계정의 경우 자녀의 센터 조회 (선택된 자녀 또는 첫 번째 자녀)
  const targetChildId = selectedChild?.id || (isParentAccount && childUsers.length > 0 ? childUsers[0].id : null);
  
  const { data: childCenters = [] } = useQuery<Center[]>({
    queryKey: ["/api/user-centers", targetChildId],
    queryFn: async () => {
      if (!targetChildId) return [];
      const res = await fetch(`/api/user-centers?userId=${targetChildId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isParentAccount && !!targetChildId,
  });

  // 학부모 계정: 자녀의 센터 사용 (선택된 자녀 또는 첫 번째 자녀)
  // 학생/기타: 본인 센터 사용
  const effectiveCenterId = (isParentAccount && childCenters.length > 0) 
    ? childCenters[0].id 
    : selectedCenter?.id;

  const { data: centerFeatures = [] } = useQuery<CenterFeature[]>({
    queryKey: ["/api/center-features", effectiveCenterId],
    queryFn: async () => {
      if (!effectiveCenterId) return [];
      const res = await fetch(`/api/center-features/${effectiveCenterId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!effectiveCenterId && !!user,
  });

  // Fetch user's menu order
  const { data: savedMenuOrder } = useQuery<UserMenuOrder | null>({
    queryKey: [`/api/user-menu-order?userId=${user?.id}`],
    enabled: !!user?.id,
  });

  const savedSubMenuOrder = useMemo(() => {
    if (!savedMenuOrder?.subMenuOrder) return {} as Record<string, string[]>;
    try {
      return JSON.parse(savedMenuOrder.subMenuOrder) as Record<string, string[]>;
    } catch {
      return {} as Record<string, string[]>;
    }
  }, [savedMenuOrder?.subMenuOrder]);

  // Fetch feature categories for dynamic menu groups
  const { data: featureCategories = [] } = useQuery<FeatureCategory[]>({
    queryKey: ["/api/feature-categories"],
    enabled: !!user && user.role >= UserRole.TEACHER,
  });

  // Fetch pending registration count (Admin only)
  const { data: pendingRegistrationCount = { count: 0 } } = useQuery<{ count: number }>({
    queryKey: ["/api/center-registrations-pending-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return { count: 0 };
      const res = await fetch(`/api/center-registrations-pending-count?actorId=${user.id}`);
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    enabled: !!user?.id && user.role >= UserRole.ADMIN,
    refetchInterval: 30000,
  });

  const { data: pendingTossCount = 0 } = useQuery<number>({
    queryKey: ["/api/toss-consent-pending-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const res = await fetch(`/api/toss-consent-pending?actorId=${user.id}`);
      if (!res.ok) return 0;
      const data = await res.json();
      return Array.isArray(data) ? data.length : 0;
    },
    enabled: !!user?.id && user.role >= UserRole.ADMIN,
    refetchInterval: 30000,
  });

  const { data: commUnreadData = { unreadCount: 0 } } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/teacher-student-messages/unread-total", user?.id, selectedCenter?.id],
    queryFn: async () => {
      if (!user?.id || !selectedCenter?.id) return { unreadCount: 0 };
      const res = await fetch(`/api/teacher-student-messages/unread-total?actorId=${user.id}&centerId=${selectedCenter.id}`);
      if (!res.ok) return { unreadCount: 0 };
      return res.json();
    },
    enabled: !!user?.id && !!selectedCenter?.id,
    refetchInterval: 30000,
  });
  const commUnreadCount = commUnreadData.unreadCount;

  // Fetch pending feature requests count (Admin only)
  const { data: pendingFeatureRequestCount = { count: 0 } } = useQuery<{ count: number }>({
    queryKey: ["/api/feature-requests-pending-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return { count: 0 };
      const res = await fetch(`/api/feature-requests-pending-count?actorId=${user.id}`);
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    enabled: !!user?.id && user.role >= UserRole.ADMIN,
    refetchInterval: 30000,
  });

  // Fetch approved feature requests for principals to show approval notifications
  const { data: approvedFeatureRequests = [] } = useQuery<FeatureRequest[]>({
    queryKey: ["/api/feature-requests", selectedCenter?.id, "approved"],
    queryFn: async () => {
      if (!selectedCenter?.id || !user?.id) return [];
      const res = await fetch(`/api/feature-requests?actorId=${user.id}&centerId=${selectedCenter.id}&status=approved`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedCenter?.id && !!user?.id && user.role === UserRole.PRINCIPAL,
  });

  // State for approval notification popup
  const [showApprovalPopup, setShowApprovalPopup] = useState(false);
  const [newlyApprovedFeatures, setNewlyApprovedFeatures] = useState<Feature[]>([]);
  const [showNewBasicPopup, setShowNewBasicPopup] = useState(false);
  const [newBasicFeaturesList, setNewBasicFeaturesList] = useState<Feature[]>([]);
  const [acknowledgedApprovedMenuKeys, setAcknowledgedApprovedMenuKeys] = useState<Set<string>>(() => {
    const stored = localStorage.getItem("acknowledged_approved_features");
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });
  const [acknowledgedBasicMenuKeys, setAcknowledgedBasicMenuKeys] = useState<Set<string>>(() => {
    const stored = localStorage.getItem(`seen_new_basic_features_${user?.id}`);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  // Check for newly approved features and show popup (principals only)
  useEffect(() => {
    if (user?.role !== UserRole.PRINCIPAL || !approvedFeatureRequests.length || !features.length) return;
    
    const POPUP_SHOWN_KEY = `approved_features_popup_shown_${selectedCenter?.id}`;
    const storedPopupShown = localStorage.getItem(POPUP_SHOWN_KEY);
    const popupShownIds: string[] = storedPopupShown ? JSON.parse(storedPopupShown) : [];
    
    const approvedFeatureIds = approvedFeatureRequests.map(r => r.featureId);
    const newApproved = features.filter(f => 
      approvedFeatureIds.includes(f.id) && !popupShownIds.includes(f.id)
    );
    
    if (newApproved.length > 0) {
      setNewlyApprovedFeatures(newApproved);
      setShowApprovalPopup(true);
      const newPopupShownIds = [...popupShownIds, ...newApproved.map(f => f.id)];
      localStorage.setItem(POPUP_SHOWN_KEY, JSON.stringify(newPopupShownIds));
    }
  }, [approvedFeatureRequests, features, user?.role, selectedCenter?.id]);

  // Check for new basic features and show popup (all staff)
  useEffect(() => {
    if (!user || user.role < UserRole.TEACHER || !features.length) return;

    const BASIC_POPUP_KEY = `basic_features_popup_shown_${user.id}`;
    const storedShown = localStorage.getItem(BASIC_POPUP_KEY);
    const shownMenuKeys: string[] = storedShown ? JSON.parse(storedShown) : [];

    const basicFeatures = features.filter(f => f.featureType === "basic" && f.menuKey);
    const newBasics = basicFeatures.filter(f => !shownMenuKeys.includes(f.menuKey!));

    if (newBasics.length > 0) {
      setNewBasicFeaturesList(newBasics);
      setShowNewBasicPopup(true);
      const allShown = [...shownMenuKeys, ...newBasics.map(f => f.menuKey!)];
      localStorage.setItem(BASIC_POPUP_KEY, JSON.stringify(allShown));
    }
  }, [features, user?.id, user?.role]);

  // Get menu keys that should be highlighted (approved or new basic, not yet clicked)
  const highlightedMenuKeys = useMemo(() => {
    const highlighted = new Set<string>();

    if (user?.role === UserRole.PRINCIPAL) {
      const approvedFeatureIds = approvedFeatureRequests.map(r => r.featureId);
      features
        .filter(f => approvedFeatureIds.includes(f.id) && f.menuKey)
        .forEach(f => {
          if (!acknowledgedApprovedMenuKeys.has(f.menuKey!)) highlighted.add(f.menuKey!);
        });
    }

    if (user && user.role >= UserRole.TEACHER) {
      features
        .filter(f => f.featureType === "basic" && f.menuKey)
        .forEach(f => {
          if (!acknowledgedBasicMenuKeys.has(f.menuKey!)) highlighted.add(f.menuKey!);
        });
    }

    return highlighted;
  }, [approvedFeatureRequests, features, user?.role, acknowledgedApprovedMenuKeys, acknowledgedBasicMenuKeys]);

  // Handle menu item click to acknowledge and remove highlight
  const handleMenuClick = (menuKey?: string) => {
    if (!menuKey || !highlightedMenuKeys.has(menuKey)) return;
    
    const newAcknowledgedApproved = new Set(acknowledgedApprovedMenuKeys);
    newAcknowledgedApproved.add(menuKey);
    setAcknowledgedApprovedMenuKeys(newAcknowledgedApproved);
    localStorage.setItem("acknowledged_approved_features", JSON.stringify(Array.from(newAcknowledgedApproved)));

    const newAcknowledgedBasic = new Set(acknowledgedBasicMenuKeys);
    newAcknowledgedBasic.add(menuKey);
    setAcknowledgedBasicMenuKeys(newAcknowledgedBasic);
    localStorage.setItem(`seen_new_basic_features_${user?.id}`, JSON.stringify(Array.from(newAcknowledgedBasic)));
  };

  // Calculate new features count for principals (features created after last view)
  const newFeaturesCount = useMemo(() => {
    if (!user) return 0;
    if (user.role >= UserRole.ADMIN) return 0; // Admin doesn't need new feature notifications
    if (user.role < UserRole.PRINCIPAL) return 0; // Only principals see this
    
    const LAST_VIEWED_KEY = "feature_management_last_viewed";
    const lastViewed = localStorage.getItem(LAST_VIEWED_KEY);
    
    // Get optional active features that aren't already enabled for this center
    const optionalFeatures = features.filter(f => f.featureType === "optional" && f.isActive);
    const enabledIds = centerFeatures.map(cf => cf.featureId);
    const availableFeatures = optionalFeatures.filter(f => !enabledIds.includes(f.id));
    
    if (!lastViewed) {
      // First time - all available features are "new"
      return availableFeatures.length;
    }
    
    const lastViewedDate = new Date(lastViewed);
    return availableFeatures.filter(f => f.createdAt && new Date(f.createdAt) > lastViewedDate).length;
  }, [features, centerFeatures, user?.role]);

  // Fetch feature suggestions for principals to show notification badge
  const { data: featureSuggestions = [] } = useQuery<FeatureSuggestion[]>({
    queryKey: ["/api/feature-suggestions", selectedCenter?.id],
    queryFn: async () => {
      if (!selectedCenter?.id) return [];
      const res = await fetch(`/api/feature-suggestions?centerId=${selectedCenter.id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user && user.role === UserRole.PRINCIPAL && !!selectedCenter?.id,
  });

  // State to track localStorage updates for suggestion statuses
  const [seenSuggestionStatuses, setSeenSuggestionStatuses] = useState<Record<string, string>>(() => {
    if (!user) return {};
    const STORAGE_KEY = `suggestion-seen-statuses-${user.id}`;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  });

  // Update seen statuses when location changes or localStorage is updated
  useEffect(() => {
    if (!user) return;
    const STORAGE_KEY = `suggestion-seen-statuses-${user.id}`;
    const stored = localStorage.getItem(STORAGE_KEY);
    setSeenSuggestionStatuses(stored ? JSON.parse(stored) : {});
  }, [location, user?.id]);

  // Calculate suggestion updates count for principals
  const suggestionUpdatesCount = useMemo(() => {
    if (!user || user.role !== UserRole.PRINCIPAL) return 0;
    
    let count = 0;
    featureSuggestions.forEach(s => {
      const seenStatus = seenSuggestionStatuses[s.id];
      if ((s.status === "approved" || s.status === "completed" || s.status === "in_review") && seenStatus !== s.status) {
        count++;
      }
    });
    
    return count;
  }, [featureSuggestions, seenSuggestionStatuses, user?.role]);

  // Combined notification count for feature management menu
  const featureManagementNotificationCount = useMemo(() => {
    return newFeaturesCount + suggestionUpdatesCount;
  }, [newFeaturesCount, suggestionUpdatesCount]);

  // State for dynamic category collapsibles
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  // Get enabled feature IDs for the current center (excluding hidden ones)
  const enabledFeatureIds = useMemo(() => {
    return centerFeatures
      .filter(cf => !cf.isHidden)
      .map(cf => cf.featureId);
  }, [centerFeatures]);

  // Get hidden feature IDs for the current center
  const hiddenFeatureIds = useMemo(() => {
    return new Set(
      centerFeatures
        .filter(cf => cf.isHidden)
        .map(cf => cf.featureId)
    );
  }, [centerFeatures]);

  // Build a set of menu keys for optional features that are enabled for the center
  const enabledOptionalMenuKeys = useMemo(() => {
    const optionalFeatures = features.filter(f => f.featureType === "optional");
    return new Set(
      optionalFeatures
        .filter(f => enabledFeatureIds.includes(f.id))
        .map(f => f.menuKey)
    );
  }, [features, enabledFeatureIds]);

  // Check if Google Calendar Timetable is enabled for this center
  const isGoogleCalendarTimetableEnabled = useMemo(() => {
    const gcalFeature = features.find(f => f.menuKey === "google-calendar-timetable");
    if (!gcalFeature) return false;
    
    // First, check if this center has subscribed to this feature
    if (!enabledFeatureIds.includes(gcalFeature.id)) return false;
    
    // For admin, also check if it's not hidden
    if ((user?.role ?? 0) >= UserRole.ADMIN) {
      return !hiddenFeatureIds.has(gcalFeature.id);
    }
    return true;
  }, [features, enabledFeatureIds, hiddenFeatureIds, user?.role]);

  // Build a set of menu keys for hidden features (both basic and optional)
  const hiddenMenuKeys = useMemo(() => {
    const hidden = new Set(
      features
        .filter(f => hiddenFeatureIds.has(f.id))
        .map(f => f.menuKey)
    );
    
    // When Google Calendar Timetable is enabled:
    // - Hide "시간표 관리" for teachers/principals
    // - Hide "학원 시간표" for students
    // When Google Calendar Timetable is NOT enabled:
    // - Hide "나의 시간표" (구글캘린더) for students
    if (isGoogleCalendarTimetableEnabled) {
      hidden.add("timetable"); // Hides "시간표 관리" and "학원 시간표"
    } else {
      hidden.add("google-calendar-timetable"); // Hides "나의 시간표" when feature not enabled
    }
    
    return hidden;
  }, [features, hiddenFeatureIds, isGoogleCalendarTimetableEnabled]);

  // Build a set of menu keys for optional features (regardless of enabled status)
  const optionalFeatureMenuKeys = useMemo(() => {
    return new Set(
      features
        .filter(f => f.featureType === "optional")
        .map(f => f.menuKey)
    );
  }, [features]);

  // Get enabled optional features grouped by parentMenuKey
  const optionalFeaturesByParent = useMemo(() => {
    // Include optional features + basic features that belong to a submenu (not top-level)
    const candidateFeatures = features.filter(f =>
      f.featureType === "optional" ||
      (f.featureType === "basic" && f.parentMenuKey && f.parentMenuKey !== "top-level")
    );
    const isAdmin = (user?.role ?? 0) >= UserRole.ADMIN;
    const enabledFeatures = isAdmin
      ? candidateFeatures
      : candidateFeatures.filter(f => f.featureType === "basic" || enabledFeatureIds.includes(f.id));
    
    
    const grouped: Record<string, Feature[]> = {
      "class-management": [],
      "schedule": [],
      "parent-portal": [],
      "student-management": [],
      "top-level": [],
    };
    
    enabledFeatures.forEach(f => {
      const parent = f.parentMenuKey || "top-level";
      if (grouped[parent]) {
        grouped[parent].push(f);
      } else {
        grouped["top-level"].push(f);
      }
    });
    
    // Sort each group by displayOrder
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    });
    
    return grouped;
  }, [features, enabledFeatureIds, user?.role]);

  // Group enabled optional features by categoryId (for dynamic category menus)
  const featuresByCategoryId = useMemo(() => {
    const optionalFeatures = features.filter(f => f.featureType === "optional");
    const isAdmin = (user?.role ?? 0) >= UserRole.ADMIN;
    const enabledFeatures = isAdmin
      ? optionalFeatures
      : optionalFeatures.filter(f => enabledFeatureIds.includes(f.id));
    
    const grouped: Record<string, Feature[]> = {};
    
    enabledFeatures.forEach(f => {
      if (f.categoryId) {
        if (!grouped[f.categoryId]) {
          grouped[f.categoryId] = [];
        }
        grouped[f.categoryId].push(f);
      }
    });
    
    // Sort each group by displayOrder
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    });
    
    return grouped;
  }, [features, enabledFeatureIds, user?.role]);

  // Get active categories (categories that have at least one enabled feature)
  const activeCategories = useMemo(() => {
    return featureCategories
      .filter(cat => cat.isActive && featuresByCategoryId[cat.id]?.length > 0)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [featureCategories, featuresByCategoryId]);

  // Features that should be visible to students/parents when enabled
  // 센터에서 활성화된 모든 optional 기능을 학생/학부모에게 표시
  const studentVisibleFeatures = useMemo(() => {
    const staffOnlyMenuKeys = ["student-reports", "contact-parents", "marketing-calendar"];
    const optionalFeatures = features.filter(f => f.featureType === "optional");
    return optionalFeatures.filter(f => enabledFeatureIds.includes(f.id) && !staffOnlyMenuKeys.includes(f.menuKey || ""));
  }, [features, enabledFeatureIds]);

  // Icon mapping for dynamic features
  const getFeatureIcon = (menuKey: string | null): typeof Home => {
    const iconMap: Record<string, typeof Home> = {
      "study-cafe": Coffee,
      "textbooks-videos": BookOpen,
      "student-reports": FileBarChart,
      "homework": ClipboardList,
      "assessments": BarChart3,
      "exam-management": FileText,
      "clinic": Stethoscope,
      "face-to-face-checks": ClipboardCheck,
      "presentation-videos": Video,
      "google-calendar-timetable": CalendarDays,
      "semester-announcements": Megaphone,
      "counseling": HeartHandshake,
      "grade-trend": TrendingUp,
      "homework-completion": ClipboardList,
      "attendance-status": CalendarCheck,
      "school-grades": GraduationCap,
      "textbook-progress": BookOpen,
      "jcomputer-timetable": CalendarDays,
      "math-wrong-notes": Calculator,
    };
    return iconMap[menuKey || ""] || BookOpen;
  };

  if (!user) return null;

  const getMenuItems = () => {
    if (user.role === UserRole.KIOSK) return kioskMenuItems;
    if (user.role >= UserRole.ADMIN) return adminMenuItems;
    if (user.role >= UserRole.PRINCIPAL) return principalMenuItems;
    if (user.role >= UserRole.TEACHER) return teacherMenuItems;
    // 학생과 학부모 모두 동일한 메뉴 사용
    if (user.role === UserRole.STUDENT || user.role === UserRole.PARENT) return studentMenuItems;
    return parentMenuItems;
  };

  // Filter menu items based on enabled features (Admin always sees all)
  // Uses menuKey property from menu items for data-driven filtering
  const filterMenuByFeatures = (items: MenuItem[]) => {
    // Admin always sees all menus
    if (user.role >= UserRole.ADMIN) return items;
    
    return items.filter(item => {
      // If no menuKey, this is not an optional feature - always show
      if (!item.menuKey) return true;
      // If this is an optional feature, check if it's enabled for the center
      if (optionalFeatureMenuKeys.has(item.menuKey)) {
        return enabledOptionalMenuKeys.has(item.menuKey);
      }
      // Not an optional feature, always show
      return true;
    });
  };

  const filteredMenuItems = filterMenuByFeatures(getMenuItems());
  
  // Apply custom menu order if saved
  const menuItems = useMemo(() => {
    if (!savedMenuOrder?.menuOrder) return filteredMenuItems;
    try {
      const savedOrder = JSON.parse(savedMenuOrder.menuOrder) as string[];
      // Create a map of url path to menu id for matching
      // These IDs must match the IDs used in settings.tsx getDefaultMenuItems
      const urlToMenuId: Record<string, string> = {
        "/": "home",
        "/centers": "centers",
        "/management": "management",
        "/users": "users",
        "/timetable": "timetable",
        "/tuition": "tuition",
        "/manual": "manual",
        "/settings": "settings",
        "/my-timetable": "my-timetable",
        "/videos": "videos",
        "/attendance": "attendance",
        "/class-notes": "class-notes",
        "/academy-calendar": "academy-calendar",
        "/todos": "todos",
        "/contact-parents": "contact-parents",
        "/attendance-pad": "attendance-pad",
        "/feature-management": "feature-management",
        "/homework": "homework",
        "/face-to-face-checks": "face-to-face-checks",
        "/assessments": "assessments",
        "/clinic": "clinic",
        "/textbooks": "textbooks-videos",
        "/student-reports": "student-reports",
        "/study-cafe": "study-cafe",
        "/jcomputer-timetable": "jcomputer-timetable",
        // Grouped menu mappings (for settings.tsx compatibility)
        // class-management group includes: attendance, class-notes, videos
        // schedule group includes: todos, academy-calendar
        // parent-portal group includes: contact-parents
      };
      const menuIdToUrl: Record<string, string> = {};
      Object.entries(urlToMenuId).forEach(([url, id]) => {
        menuIdToUrl[id] = url;
      });
      
      // Also add group-level IDs for backwards compatibility
      menuIdToUrl["class-management"] = "/attendance"; // First item in group
      menuIdToUrl["schedule"] = "/todos"; // First item in group
      menuIdToUrl["parent-portal"] = "/contact-parents"; // First item in group
      
      // Reorder based on saved order
      const orderedItems: typeof filteredMenuItems = [];
      const remainingItems = [...filteredMenuItems];
      
      savedOrder.forEach(menuId => {
        const url = menuIdToUrl[menuId];
        if (url) {
          const index = remainingItems.findIndex(item => item.url === url);
          if (index !== -1) {
            orderedItems.push(remainingItems[index]);
            remainingItems.splice(index, 1);
          }
        }
      });
      
      // Add any remaining items not in saved order
      return [...orderedItems, ...remainingItems];
    } catch {
      return filteredMenuItems;
    }
  }, [filteredMenuItems, savedMenuOrder]);

  const showClassManagement = user.role >= UserRole.TEACHER;
  const showSchedule = user.role >= UserRole.TEACHER;
  // 학부모 메뉴 그룹: 학생 이상 표시 (학부모 계정은 사용하지 않지만, 학생도 알림장/교육비 등 접근 필요)
  const showParentPortal = user.role >= UserRole.STUDENT;
  const showStudentManagement = user.role >= UserRole.TEACHER || user.role === UserRole.STUDENT;
  const isKiosk = user.role === UserRole.KIOSK;

  // Get top-level optional feature menu keys
  const topLevelOptionalMenuKeys = useMemo(() => {
    const topLevelFeatures = optionalFeaturesByParent["top-level"] || [];
    return topLevelFeatures.map(f => f.menuKey).filter(Boolean) as string[];
  }, [optionalFeaturesByParent]);

  // Create ordered list of all menu items including collapsible groups and optional features
  const orderedMenuKeys = useMemo(() => {
    const getDefaultOrder = (role: number): string[] => {
      if (role >= UserRole.ADMIN) {
        return ["home", "centers", "management", "users", "timetable", "class-management", "schedule", "student-management", "parent-portal", "settings"];
      } else if (role >= UserRole.PRINCIPAL) {
        return ["home", "management", "users", "timetable", "class-management", "schedule", "student-management", "parent-portal", "settings"];
      } else if (role >= UserRole.TEACHER) {
        return ["home", "users", "timetable", "class-management", "schedule", "student-management", "parent-portal", "settings"];
      } else if (role === UserRole.STUDENT || role === UserRole.PARENT) {
        return ["home", "student-timetable", "student-lesson", "student-management", "parent-portal", "settings"];
      }
      return ["home", "tuition", "settings"];
    };
    
    const defaultOrder = getDefaultOrder(user.role);
    const allDefaultKeys = [...defaultOrder];
    const settingsIndex = allDefaultKeys.indexOf("settings");
    topLevelOptionalMenuKeys.forEach(key => {
      if (!allDefaultKeys.includes(key)) {
        if (settingsIndex !== -1) {
          allDefaultKeys.splice(settingsIndex, 0, key);
        } else {
          allDefaultKeys.push(key);
        }
      }
    });
    
    if (!savedMenuOrder?.menuOrder) {
      return allDefaultKeys;
    }
    
    const validKeys = new Set([...allDefaultKeys, ...topLevelOptionalMenuKeys]);
    
    try {
      const savedOrder = JSON.parse(savedMenuOrder.menuOrder) as string[];
      
      const result: string[] = [];
      const addedKeys = new Set<string>();
      
      savedOrder.forEach(key => {
        if (validKeys.has(key) && !addedKeys.has(key)) {
          result.push(key);
          addedKeys.add(key);
        }
      });
      
      allDefaultKeys.forEach(key => {
        if (!addedKeys.has(key)) {
          result.push(key);
          addedKeys.add(key);
        }
      });
      
      return result;
    } catch {
      return allDefaultKeys;
    }
  }, [user.role, savedMenuOrder, topLevelOptionalMenuKeys]);
  

  const renderMenuItem = (item: typeof menuItems[0]) => {
    const centersBadgeCount = item.url === "/centers" ? (pendingRegistrationCount.count + pendingTossCount) : 0;
    const showCentersBadge = centersBadgeCount > 0;
    const showCommBadge = item.url === "/teacher-communication" && commUnreadCount > 0;
    
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          asChild
          isActive={location === item.url}
          data-testid={`nav-${item.url.replace("/", "") || "home"}`}
        >
          <Link href={item.url}>
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
            {showCentersBadge && (
              <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                {centersBadgeCount}
              </span>
            )}
            {showCommBadge && (
              <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                {commUnreadCount}
              </span>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  type UnifiedSubItem = 
    | { kind: "static"; menuKey: string; item: any }
    | { kind: "dynamic"; menuKey: string; feature: Feature };

  const buildOrderedSubItems = (
    staticItems: { url: string; menuKey?: string; [key: string]: any }[],
    dynamicFeatures: Feature[],
    parentKey: string
  ): UnifiedSubItem[] => {
    const unified: UnifiedSubItem[] = [];
    const addedKeys = new Set<string>();
    for (const item of staticItems) {
      const key = item.menuKey || item.url.replace("/", "");
      unified.push({ kind: "static", menuKey: key, item });
      addedKeys.add(key);
    }
    for (const feature of dynamicFeatures) {
      if (addedKeys.has(feature.menuKey)) continue;
      unified.push({ kind: "dynamic", menuKey: feature.menuKey, feature });
      addedKeys.add(feature.menuKey);
    }
    const order = savedSubMenuOrder[parentKey];
    if (!order || order.length === 0) return unified;
    const reordered = order
      .map(key => unified.find(u => u.menuKey === key))
      .filter(Boolean) as UnifiedSubItem[];
    const missing = unified.filter(u => !order.includes(u.menuKey));
    return [...reordered, ...missing];
  };

  const renderClassManagementItem = (item: typeof classManagementItems[0]) => {
    return (
      <SidebarMenuSubItem key={item.title}>
        <SidebarMenuSubButton
          asChild
          isActive={location === item.url}
          data-testid={`nav-${item.url.replace("/", "")}`}
        >
          <Link href={item.url}>
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  };

  const renderScheduleItem = (item: typeof scheduleItems[0]) => (
    <SidebarMenuSubItem key={item.title}>
      <SidebarMenuSubButton
        asChild
        isActive={location === item.url}
        data-testid={`nav-${item.url.replace("/", "")}`}
      >
        <Link href={item.url}>
          <item.icon className="h-4 w-4" />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );

  const renderScheduleManagement = () => {
    const dynamicFeatures = optionalFeaturesByParent["schedule"] || [];
    const filteredScheduleItems = scheduleItems.filter(item => {
      const menuKey = (item as any).menuKey || item.url.replace("/", "");
      if (hiddenMenuKeys.has(menuKey)) return false;
      if (menuKey === "new-consultations" && user?.isClinicTeacher) return false;
      const feature = features.find(f => f.menuKey === menuKey);
      if (feature && feature.featureType === "optional" && !enabledFeatureIds.includes(feature.id)) return false;
      return true;
    });
    const filteredDynamicFeatures = dynamicFeatures.filter(f => !hiddenMenuKeys.has(f.menuKey));
    const orderedItems = buildOrderedSubItems(filteredScheduleItems, filteredDynamicFeatures, "schedule");
    
    if (orderedItems.length === 0) return null;
    
    return (
      <Collapsible
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        className="group/schedule"
        key="schedule-management"
      >
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              isActive={scheduleUrls.includes(location)}
              data-testid="nav-schedule"
            >
              <CalendarDays className="h-4 w-4" />
              <span>선생님</span>
              <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/schedule:rotate-180" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {orderedItems.map(u => u.kind === "static" ? renderScheduleItem(u.item) : renderDynamicFeatureSubItem(u.feature))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  };

  const renderClassManagement = () => {
    const dynamicFeatures = optionalFeaturesByParent["class-management"] || [];
    const filteredClassItems = classManagementItems.filter(item => {
      const menuKey = item.url.replace("/", "");
      return !hiddenMenuKeys.has(menuKey);
    });
    const filteredDynamicFeatures = dynamicFeatures.filter(f => !hiddenMenuKeys.has(f.menuKey));
    const orderedItems = buildOrderedSubItems(filteredClassItems, filteredDynamicFeatures, "class-management");
    
    if (orderedItems.length === 0) return null;
    
    return (
      <Collapsible
        open={classManagementOpen}
        onOpenChange={setClassManagementOpen}
        className="group/collapsible"
        key="class-management"
      >
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              isActive={classManagementUrls.some(url => location.startsWith(url.split("?")[0]))}
              data-testid="nav-class-management"
            >
              <GraduationCap className="h-4 w-4" />
              <span>수업 관리</span>
              <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {orderedItems.map(u => u.kind === "static" ? renderClassManagementItem(u.item) : renderDynamicFeatureSubItem(u.feature))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  };

  const renderParentPortalItem = (item: typeof parentPortalItems[0]) => (
    <SidebarMenuSubItem key={item.title}>
      <SidebarMenuSubButton
        asChild
        isActive={location === item.url}
        data-testid={`nav-${item.url.replace("/", "")}`}
      >
        <Link href={item.url}>
          <item.icon className="h-4 w-4" />
          <span>{item.title}</span>
          {item.url === "/teacher-communication" && commUnreadCount > 0 && (
            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {commUnreadCount}
            </span>
          )}
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );

  // Render dynamic optional feature as subitem
  const isFeatureEnabled = (feature: Feature) => enabledFeatureIds.includes(feature.id);
  const isAdmin = (user?.role ?? 0) >= UserRole.ADMIN;

  const renderDynamicFeatureSubItem = (feature: Feature) => {
    const FeatureIcon = getFeatureIcon(feature.menuKey);
    const notEnabled = isAdmin && feature.featureType === "optional" && !isFeatureEnabled(feature);
    const grayClass = notEnabled ? "text-muted-foreground/50" : "";
    
    if (feature.menuKey === "clinic") {
      return (
        <>
          <SidebarMenuSubItem key={`${feature.id}-middle`}>
            <SidebarMenuSubButton
              asChild
              isActive={location === "/clinic" && currentClinicType === "middle"}
              data-testid="nav-clinic-middle"
            >
              <Link href="/clinic?type=middle">
                <FeatureIcon className={`h-4 w-4 ${grayClass}`} />
                <span className={grayClass}>중등 클리닉</span>
              </Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
          <SidebarMenuSubItem key={`${feature.id}-high`}>
            <SidebarMenuSubButton
              asChild
              isActive={location === "/clinic" && currentClinicType === "high"}
              data-testid="nav-clinic-high"
            >
              <Link href="/clinic?type=high">
                <FeatureIcon className={`h-4 w-4 ${grayClass}`} />
                <span className={grayClass}>고등 클리닉</span>
              </Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        </>
      );
    }
    
    const url = feature.menuKey === "study-cafe" ? "/study-cafe" : 
                feature.menuKey === "textbooks-videos" ? "/textbooks" : 
                feature.menuKey === "student-reports" ? "/student-reports" :
                `/${feature.menuKey}`;
    const isHighlighted = feature.menuKey && highlightedMenuKeys.has(feature.menuKey);
    const textClass = notEnabled ? "text-muted-foreground/50" : isHighlighted ? "text-yellow-500 font-medium" : "";
    return (
      <SidebarMenuSubItem key={feature.id}>
        <SidebarMenuSubButton
          asChild
          isActive={location === url}
          data-testid={`nav-${feature.menuKey}`}
          onClick={() => handleMenuClick(feature.menuKey)}
        >
          <Link href={url}>
            <FeatureIcon className={`h-4 w-4 ${grayClass}`} />
            <span className={textClass}>{feature.name}</span>
          </Link>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  };

  const renderParentPortalManagement = () => {
    const dynamicFeatures = optionalFeaturesByParent["parent-portal"] || [];
    const filteredParentItems = parentPortalItems.filter(item => {
      const menuKey = item.menuKey || item.url.replace("/", "");
      if ((user.role === UserRole.STUDENT || user.role === UserRole.PARENT) && menuKey === "contact-parents") {
        return false;
      }
      return !hiddenMenuKeys.has(menuKey);
    });
    const parentPortalMenuKeys = new Set(parentPortalItems.map(item => item.menuKey));
    const staffOnlyMenuKeys = ["student-reports", "contact-parents", "marketing-calendar", "monthly-reports"];
    const filteredDynamicFeatures = dynamicFeatures.filter(f => {
      if (hiddenMenuKeys.has(f.menuKey)) return false;
      if (parentPortalMenuKeys.has(f.menuKey)) return false;
      if ((user.role === UserRole.STUDENT || user.role === UserRole.PARENT) && staffOnlyMenuKeys.includes(f.menuKey || "")) return false;
      return true;
    });
    const orderedItems = buildOrderedSubItems(filteredParentItems, filteredDynamicFeatures, "parent-portal");

    if (orderedItems.length === 0) return null;
    
    return (
      <Collapsible
        open={parentPortalOpen}
        onOpenChange={setParentPortalOpen}
        className="group/parent"
        key="parent-portal"
      >
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              isActive={parentPortalUrls.includes(location)}
              data-testid="nav-parent-portal"
            >
              <Users className="h-4 w-4" />
              <span>학부모</span>
              <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/parent:rotate-180" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {orderedItems.map(u => u.kind === "static" ? renderParentPortalItem(u.item) : renderDynamicFeatureSubItem(u.feature))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  };

  const renderStudentManagement = () => {
    const dynamicFeatures = optionalFeaturesByParent["student-management"] || [];
    const isStudentAccount = user.role === UserRole.STUDENT;
    const studentVisibleStudentMenuKeys = ["supplementary", "grade-trend", "homework-completion", "attendance-status", "school-grades"];
    const staffOnlyMenuKeys = ["student-reports", "contact-parents", "marketing-calendar"];
    const filteredStudentItems = studentManagementItems.filter(item => {
      const menuKey = item.menuKey || item.url.replace("/", "");
      if (hiddenMenuKeys.has(menuKey)) return false;
      if (isStudentAccount && !studentVisibleStudentMenuKeys.includes(menuKey)) return false;
      return true;
    });
    const filteredDynamicFeatures = isStudentAccount
      ? dynamicFeatures.filter(f => !hiddenMenuKeys.has(f.menuKey) && !staffOnlyMenuKeys.includes(f.menuKey) && enabledFeatureIds.includes(f.id))
      : dynamicFeatures.filter(f => !hiddenMenuKeys.has(f.menuKey));
    const orderedItems = buildOrderedSubItems(filteredStudentItems, filteredDynamicFeatures, "student-management");
    
    if (orderedItems.length === 0) return null;
    
    const renderStudentStaticItem = (item: typeof studentManagementItems[0]) => {
      const ItemIcon = item.icon;
      const isHighlighted = item.menuKey && highlightedMenuKeys.has(item.menuKey);
      return (
        <SidebarMenuSubItem key={item.url}>
          <SidebarMenuSubButton
            asChild
            isActive={location === item.url}
            data-testid={`nav-${item.menuKey || item.url.replace("/", "")}`}
            onClick={() => handleMenuClick(item.menuKey)}
          >
            <Link href={item.url}>
              <ItemIcon className="h-4 w-4" />
              <span className={isHighlighted ? "text-yellow-500 font-medium" : ""}>{item.title}</span>
            </Link>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      );
    };
    
    return (
      <Collapsible
        open={studentManagementOpen}
        onOpenChange={setStudentManagementOpen}
        className="group/student"
        key="student-management"
      >
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              isActive={studentManagementUrls.includes(location)}
              data-testid="nav-student-management"
            >
              <GraduationCap className="h-4 w-4" />
              <span>학생</span>
              <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/student:rotate-180" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {orderedItems.map(u => u.kind === "static" ? renderStudentStaticItem(u.item) : renderDynamicFeatureSubItem(u.feature))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  };

  // Render a dynamic category menu (from feature_categories table)
  const renderDynamicCategory = (category: FeatureCategory) => {
    const categoryFeatures = featuresByCategoryId[category.id] || [];
    if (categoryFeatures.length === 0) return null;
    
    const isOpen = openCategories[category.id] ?? false;
    const categoryUrls = categoryFeatures.map(f => {
      if (f.menuKey === "study-cafe") return "/study-cafe";
      if (f.menuKey === "textbooks-videos") return "/textbooks";
      if (f.menuKey === "student-reports") return "/student-reports";
      return `/${f.menuKey}`;
    });
    const isActive = categoryUrls.some(url => location.startsWith(url));
    
    return (
      <Collapsible
        open={isOpen}
        onOpenChange={(open) => setOpenCategories(prev => ({ ...prev, [category.id]: open }))}
        className={`group/${category.menuKey}`}
        key={category.id}
      >
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              isActive={isActive}
              data-testid={`nav-category-${category.menuKey}`}
            >
              <BookOpen className="h-4 w-4" />
              <span>{category.name}</span>
              <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {categoryFeatures.map((feature) => renderDynamicFeatureSubItem(feature))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  };

  // Render student lesson menu (collapsible group for student accounts)
  const renderStudentLessonManagement = () => {
    // Get student-visible optional features for class-management (수업 메뉴)
    // 센터에서 활성화된 모든 class-management 관련 기능 표시
    const studentOptionalFeatures = studentVisibleFeatures.filter(f => 
      f.parentMenuKey === "class-management"
    );
    
    // Check if there are any items to show
    const hasItems = studentLessonItems.length > 0 || studentOptionalFeatures.length > 0;
    if (!hasItems) return null;
    
    return (
      <Collapsible
        open={studentLessonOpen}
        onOpenChange={setStudentLessonOpen}
        className="group/student-lesson"
        key="student-lesson"
      >
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              isActive={studentLessonUrls.includes(location)}
              data-testid="nav-student-lesson"
            >
              <GraduationCap className="h-4 w-4" />
              <span>수업</span>
              <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/student-lesson:rotate-180" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {studentLessonItems
                .filter((item) => {
                  // Hide items based on their menuKey
                  // "학원 시간표" hidden when google calendar timetable is enabled
                  // "나의 시간표" hidden when google calendar timetable is NOT enabled
                  return !hiddenMenuKeys.has(item.menuKey);
                })
                .map((item) => (
                <SidebarMenuSubItem key={item.title}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.url.replace("/", "")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
              {studentOptionalFeatures.map((feature) => renderDynamicFeatureSubItem(feature))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  };

  return (
    <Sidebar side={side}>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-4">
          {selectedCenter?.sidebarLogoUrl ? (
            <img 
              src={(() => {
                let url = selectedCenter.sidebarLogoUrl;
                // Convert R2 URLs to proxy URLs for same-origin HTTPS serving
                if (url.startsWith("https://pub-") && url.includes(".r2.dev/")) {
                  const parts = url.split(".r2.dev/");
                  if (parts.length === 2) {
                    url = `/api/r2-proxy/${parts[1]}`;
                  }
                }
                const separator = url.includes('?') ? '&' : '?';
                const version = selectedCenter.updatedAt ? new Date(selectedCenter.updatedAt).getTime() : Date.now();
                return `${url}${separator}v=${version}`;
              })()}
              alt={selectedCenter.name} 
              className="h-10 w-auto max-w-[120px] object-contain" 
            />
          ) : (
            <img src={defaultSidebarLogoUrl} alt="새결수학" className="h-10 w-auto" />
          )}
          <span className="font-bold text-lg text-sidebar-foreground">새결수학</span>
        </div>
        {isKiosk ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <RoleBadge role={user.role} isClinicTeacher={false} size="sm" />
                <span className="font-medium truncate" data-testid="text-user-name">{user.name}</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user.name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate" data-testid="text-user-name">{user.name}</span>
                  <RoleBadge role={user.role} isClinicTeacher={user.isClinicTeacher} size="sm" />
                </div>
                <p className="text-xs text-muted-foreground truncate">{user.username}</p>
              </div>
            </div>
            <div className="mt-3">
              <CenterSelector />
            </div>
            {/* 학부모 계정 자녀 선택 */}
            {isParentAccount && childUsers.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-muted-foreground mb-1.5">자녀 선택</div>
                <Select
                  value={selectedChild?.id || ""}
                  onValueChange={(childId) => {
                    const child = childUsers.find(c => c.id === childId);
                    if (child) selectChild(child);
                  }}
                >
                  <SelectTrigger className="h-9" data-testid="select-child">
                    <SelectValue placeholder="자녀 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {childUsers.map((child) => (
                      <SelectItem key={child.id} value={child.id}>
                        {child.name} {child.grade && `(${child.grade})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isParentAccount && childUsers.length === 0 && (
              <div className="mt-3 p-2 rounded-md bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">등록된 자녀가 없습니다</p>
                <p className="text-xs text-muted-foreground">원장님께 자녀 등록을 요청해주세요</p>
              </div>
            )}
          </>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>메뉴</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {orderedMenuKeys.filter(key => key !== "settings").map((menuKey) => {
                // Skip if this menu key is hidden (for basic features like timetable, tuition)
                if (hiddenMenuKeys.has(menuKey)) {
                  return null;
                }
                
                // Map menu key to URL for regular items
                const menuKeyToUrl: Record<string, string> = {
                  "home": "/",
                  "centers": "/centers",
                  "management": "/management",
                  "users": "/users",
                  "timetable": "/timetable",
                  "my-timetable": "/my-timetable",
                  "videos": "/videos",
                  "tuition": "/tuition",
                  "teacher-communication": "/teacher-communication",
                  "manual": "/manual",
                  "settings": "/settings",
                  "feature-management": "/feature-management",
                };
                
                // Handle collapsible groups - always use static menus (they include both basic and optional features)
                if (menuKey === "class-management" && showClassManagement) {
                  return renderClassManagement();
                }
                if (menuKey === "schedule" && showSchedule) {
                  return renderScheduleManagement();
                }
                if (menuKey === "parent-portal" && showParentPortal) {
                  return renderParentPortalManagement();
                }
                if (menuKey === "student-management" && showStudentManagement) {
                  return renderStudentManagement();
                }
                // Student timetable menu (for students and parents)
                if (menuKey === "student-timetable" && (user.role === UserRole.STUDENT || user.role === UserRole.PARENT)) {
                  // Show the appropriate timetable based on Google Calendar feature status
                  if (isGoogleCalendarTimetableEnabled) {
                    // Google Calendar enabled: show only 시간표 (구글 캘린더 연동)
                    const timetableItem = studentTimetableItemsWithGoogle[0];
                    const TimetableIcon = timetableItem.icon;
                    return (
                      <SidebarMenuItem key="student-timetable">
                        <SidebarMenuButton
                          asChild
                          isActive={location === "/google-calendar-timetable"}
                          data-testid={`nav-${timetableItem.menuKey}`}
                        >
                          <Link href={timetableItem.url}>
                            <TimetableIcon className="h-4 w-4" />
                            <span>{timetableItem.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  } else {
                    // Google Calendar not enabled: show 나의시간표 and 학원시간표 as independent menus
                    return (
                      <>
                        {studentTimetableItemsWithoutGoogle.map((item) => {
                          const ItemIcon = item.icon;
                          return (
                            <SidebarMenuItem key={item.menuKey}>
                              <SidebarMenuButton
                                asChild
                                isActive={location === item.url}
                                data-testid={`nav-${item.menuKey}`}
                              >
                                <Link href={item.url}>
                                  <ItemIcon className="h-4 w-4" />
                                  <span>{item.title}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </>
                    );
                  }
                }
                // Student lesson menu (for students and parents)
                if (menuKey === "student-lesson" && (user.role === UserRole.STUDENT || user.role === UserRole.PARENT)) {
                  return renderStudentLessonManagement();
                }
                
                // Handle top-level optional features (like study-cafe)
                // Skip for students - they use studentVisibleFeatures instead
                const optionalFeature = optionalFeaturesByParent["top-level"]?.find(f => f.menuKey === menuKey);
                if (optionalFeature) {
                  // Skip if this optional feature is hidden
                  if (hiddenMenuKeys.has(optionalFeature.menuKey)) {
                    return null;
                  }
                  // Skip for students/parents - they get these features via studentVisibleFeatures
                  if (user.role === UserRole.STUDENT || user.role === UserRole.PARENT) {
                    return null;
                  }
                  const FeatureIcon = getFeatureIcon(optionalFeature.menuKey);
                  const featureUrl = optionalFeature.menuKey === "study-cafe" ? "/study-cafe" : 
                              optionalFeature.menuKey === "textbooks-videos" ? "/textbooks" : 
                              optionalFeature.menuKey === "student-reports" ? "/student-reports" :
                              `/${optionalFeature.menuKey}`;
                  const topNotEnabled = isAdmin && optionalFeature.featureType === "optional" && !isFeatureEnabled(optionalFeature);
                  const topGrayClass = topNotEnabled ? "text-muted-foreground/50" : "";
                  return (
                    <SidebarMenuItem key={optionalFeature.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === featureUrl}
                        data-testid={`nav-${optionalFeature.menuKey}`}
                      >
                        <Link href={featureUrl}>
                          <FeatureIcon className={`h-4 w-4 ${topGrayClass}`} />
                          <span className={topGrayClass}>{optionalFeature.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }
                
                // Handle regular menu items
                const url = menuKeyToUrl[menuKey];
                if (!url) return null;
                
                const item = menuItems.find(m => m.url === url);
                if (!item) return null;
                
                return renderMenuItem(item);
              })}
              {/* Dynamic category menus (from feature_categories table) */}
              {/* Exclude categories that are already handled in orderedMenuItems (class-management, schedule, parent-portal) */}
              {user.role >= UserRole.TEACHER && activeCategories
                .filter(category => !["class-management", "schedule", "parent-portal", "student-management"].includes(category.menuKey || ""))
                .map(category => renderDynamicCategory(category))}
              {/* Student/Parent-visible optional features that are NOT inside the lesson menu (top-level, parent-portal) */}
              {(user.role === UserRole.STUDENT || user.role === UserRole.PARENT) && studentVisibleFeatures
                .filter(f => f.parentMenuKey !== "class-management" && f.parentMenuKey !== "parent-portal" && f.parentMenuKey !== "student-management")
                .map((feature) => {
                const FeatureIcon = getFeatureIcon(feature.menuKey);
                const url = feature.menuKey === "study-cafe" ? "/study-cafe" : 
                            feature.menuKey === "textbooks-videos" ? "/textbooks" : 
                            `/${feature.menuKey}`;
                const isHighlighted = feature.menuKey && highlightedMenuKeys.has(feature.menuKey);
                return (
                  <SidebarMenuItem key={feature.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === url}
                      data-testid={`nav-${feature.menuKey}`}
                      onClick={() => handleMenuClick(feature.menuKey)}
                    >
                      <Link href={url}>
                        <FeatureIcon className="h-4 w-4" />
                        <span className={isHighlighted ? "text-yellow-500 font-medium" : ""}>{feature.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {/* Settings menu - always at the bottom */}
              <SidebarMenuItem key="settings">
                <SidebarMenuButton
                  asChild
                  isActive={location === "/settings"}
                  data-testid="nav-settings"
                >
                  <Link href="/settings">
                    <Settings className="h-4 w-4" />
                    <span>설정</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
      </SidebarFooter>
      
      {/* Approval notification popup for principals */}
      <Dialog open={showApprovalPopup} onOpenChange={setShowApprovalPopup}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>기능 승인 완료</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              다음 기능이 승인되어 사용 가능합니다:
            </p>
            <ul className="space-y-2">
              {newlyApprovedFeatures.map(feature => (
                <li key={feature.id} className="flex items-center gap-2 text-sm">
                  <span className="text-yellow-500 font-medium">•</span>
                  <span className="font-medium">{feature.name}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              메뉴에서 노란색으로 표시된 항목을 클릭하면 해당 기능을 바로 사용할 수 있습니다.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowApprovalPopup(false)}>
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New basic feature notification popup */}
      <Dialog open={showNewBasicPopup} onOpenChange={setShowNewBasicPopup}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>새 기능 안내</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              다음 기능이 새로 추가되었습니다:
            </p>
            <ul className="space-y-2">
              {newBasicFeaturesList.map(feature => (
                <li key={feature.id} className="flex items-center gap-2 text-sm">
                  <span className="text-yellow-500 font-medium">•</span>
                  <span className="font-medium">{feature.name}</span>
                  {feature.description && (
                    <span className="text-xs text-muted-foreground">- {feature.description}</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              메뉴에서 노란색으로 표시된 항목을 클릭하면 사용할 수 있습니다.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowNewBasicPopup(false)} data-testid="button-close-new-basic-popup">
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
