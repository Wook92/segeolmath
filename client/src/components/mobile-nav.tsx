import { useLocation, useSearch, Link } from "wouter";
import { Home, Calendar, CalendarDays, ClipboardList, BarChart3, Video, BookOpen, MoreHorizontal, Building2, Users, Settings, Stethoscope, UserCheck, FileText, Coffee, DollarSign, FileBarChart, GraduationCap, HelpCircle, ListTodo, TrendingUp, ClipboardCheck, MessageSquare, MessageCircle, Megaphone, ChevronRight, PlusCircle, Bell, Clock, HeartHandshake, CalendarCheck, Wallet, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { UserRole, type Feature, type FeatureCategory, type CenterFeature, type FeatureSuggestion } from "@shared/schema";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

// Helper function to get icon by menu key
const getIconByMenuKey = (menuKey: string) => {
  const iconMap: Record<string, typeof Home> = {
    "study-cafe": Coffee,
    "textbooks-videos": BookOpen,
    "student-reports": FileBarChart,
    "homework": ClipboardList,
    "assessments": BarChart3,
    "exam-management": FileText,
    "face-to-face-checks": ClipboardCheck,
    "videos": Video,
    "presentation-videos": Video,
    "clinic": Stethoscope,
    "class-notes": FileText,
    "teacher-communication": MessageCircle,
    "daily-notices": Bell,
    "semester-announcements": Megaphone,
    "tuition": DollarSign,
    "school-grades": GraduationCap,
    "work-journal": FileText,
    "new-consultations": MessageSquare,
  };
  return iconMap[menuKey] || FileText;
};

// ========== STUDENT MENU ITEMS ==========
// Student timetable items (shown in 시간표 menu for students)
const studentTimetableItemsWithoutGoogle = [
  { title: "나의 시간표", url: "/my-timetable", icon: CalendarDays, menuKey: "my-timetable" },
  { title: "학원 시간표", url: "/timetable", icon: Calendar, menuKey: "timetable" },
];
const studentTimetableItemsWithGoogle = [
  { title: "시간표", url: "/google-calendar-timetable", icon: CalendarDays, menuKey: "google-calendar-timetable" },
];

// Student class items (shown in 수업 popover for students)
const studentClassItems = [
  { title: "수업기록", url: "/class-notes", icon: FileText, menuKey: "class-notes" },
  { title: "숙제", url: "/homework", icon: ClipboardList, menuKey: "homework" },
  { title: "주간평가", url: "/assessments", icon: BarChart3, menuKey: "assessments" },
  { title: "평가관리", url: "/exam-management", icon: FileText, menuKey: "exam-management" },
  { title: "대면점검", url: "/face-to-face-checks", icon: ClipboardCheck, menuKey: "face-to-face-checks" },
  { title: "수업영상", url: "/videos", icon: Video, menuKey: "videos" },
  { title: "교재영상", url: "/textbooks", icon: BookOpen, menuKey: "textbooks-videos" },
  { title: "발표영상", url: "/presentation-videos", icon: Video, menuKey: "presentation-videos" },
];
const studentClassMenuKeys = studentClassItems.map(item => item.menuKey);

// Student parent-related items (shown in 학부모 popover for students)
const studentParentItems = [
  { title: "알림장", url: "/daily-notices", icon: Bell, menuKey: "daily-notices" },
  { title: "교사소통", url: "/teacher-communication", icon: MessageCircle, menuKey: "teacher-communication" },
  { title: "교육비", url: "/tuition", icon: DollarSign, menuKey: "tuition" },
];
const studentParentMenuKeys = studentParentItems.map(item => item.menuKey);

// Student more items (remaining items for 더보기)
const studentMoreItems = [
  { title: "스터디카페", url: "/study-cafe", icon: Coffee, menuKey: "study-cafe" },
  { title: "설정", url: "/settings", icon: Settings },
];

// ========== STAFF (Teacher/Principal) MENU ITEMS ==========
// Class management items (shown in 수업관리 popover for staff)
const classManagementItemsBase = [
  { title: "출결 관리", url: "/attendance", icon: UserCheck, menuKey: "attendance" },
  { title: "숙제 관리", url: "/homework", icon: ClipboardList, menuKey: "homework" },
  { title: "수업 기록", url: "/class-notes", icon: FileText, menuKey: "class-notes" },
  { title: "주간평가", url: "/assessments", icon: BarChart3, menuKey: "assessments" },
  { title: "평가관리", url: "/exam-management", icon: FileText, menuKey: "exam-management" },
  { title: "고등클리닉", url: "/clinic?type=high", icon: Stethoscope, menuKey: "clinic" },
  { title: "중등클리닉", url: "/clinic?type=middle", icon: Stethoscope, menuKey: "clinic" },
  { title: "수업 영상", url: "/videos", icon: Video, menuKey: "videos" },
  { title: "교재 영상", url: "/textbooks", icon: BookOpen, menuKey: "textbooks-videos" },
  { title: "발표영상", url: "/presentation-videos", icon: Video, menuKey: "presentation-videos" },
  { title: "대면점검", url: "/face-to-face-checks", icon: ClipboardCheck, menuKey: "face-to-face-checks" },
];
const classManagementUrls = classManagementItemsBase.map(item => item.url.split("?")[0]);
const classManagementMenuKeys = classManagementItemsBase.map(item => item.menuKey).filter((v, i, a) => a.indexOf(v) === i);

// Schedule items (shown in 선생님 popover for staff)
const staffScheduleItems = [
  { title: "업무관리", url: "/todos", icon: ListTodo, menuKey: "todos" },
  { title: "학원달력", url: "/academy-calendar", icon: CalendarDays, menuKey: "academy-calendar" },
  { title: "업무일지", url: "/work-journal", icon: FileText, menuKey: "work-journal" },
  { title: "신규상담", url: "/new-consultations", icon: MessageSquare, menuKey: "new-consultations" },
];

const staffTimetableItems = [
  { title: "시간표", url: "/timetable", icon: Calendar, menuKey: "timetable" },
  { title: "구글시간표", url: "/google-calendar-timetable", icon: CalendarDays, menuKey: "google-calendar-timetable" },
];
const staffScheduleUrls = staffScheduleItems.map(item => item.url);

// Student management items (shown in 학생 popover for staff)
const staffStudentItems = [
  { title: "종합성적추이", url: "/grade-trend", icon: TrendingUp, menuKey: "grade-trend" },
  { title: "숙제 완성도", url: "/homework-completion", icon: ClipboardList, menuKey: "homework-completion" },
  { title: "출결현황", url: "/attendance-status", icon: CalendarCheck, menuKey: "attendance-status" },
  { title: "보충", url: "/supplementary", icon: Clock, menuKey: "supplementary" },
  { title: "상담", url: "/counseling", icon: HeartHandshake, menuKey: "counseling" },
];
const staffStudentUrls = staffStudentItems.map(item => item.url);

// Parent-related items (shown in 학부모 popover for staff)
const staffParentItems = [
  { title: "문자 전송", url: "/contact-parents", icon: MessageSquare, menuKey: "contact-parents" },
  { title: "알림장", url: "/daily-notices", icon: Bell, menuKey: "daily-notices" },
  { title: "교사소통", url: "/teacher-communication", icon: MessageCircle, menuKey: "teacher-communication" },
  { title: "월간보고서", url: "/student-reports", icon: FileBarChart, menuKey: "student-reports" },
  { title: "교육비", url: "/tuition", icon: DollarSign, menuKey: "tuition" },
];
const staffParentUrls = staffParentItems.map(item => item.url);

// ========== PARENT MENU ITEMS ==========
const parentAllItems = [
  { title: "홈", url: "/", icon: Home },
  { title: "알림장", url: "/daily-notices", icon: Bell },
  { title: "교육비", url: "/tuition", icon: DollarSign },
  { title: "설정", url: "/settings", icon: Settings },
];

export function MobileNav() {
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const { user, selectedCenter } = useAuth();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [timetableMenuOpen, setTimetableMenuOpen] = useState(false);
  const [studentClassMenuOpen, setStudentClassMenuOpen] = useState(false);
  const [studentParentMenuOpen, setStudentParentMenuOpen] = useState(false);
  const [classManagementMenuOpen, setClassManagementMenuOpen] = useState(false);
  const [scheduleMenuOpen, setScheduleMenuOpen] = useState(false);
  const [parentMenuOpen, setParentMenuOpen] = useState(false);
  const [studentManagementMenuOpen, setStudentManagementMenuOpen] = useState(false);
  const [openCategoryPopover, setOpenCategoryPopover] = useState<string | null>(null);
  const [acknowledgedBasicMenuKeys, setAcknowledgedBasicMenuKeys] = useState<Set<string>>(() => {
    const stored = localStorage.getItem(`seen_new_basic_features_${user?.id}`);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });
  
  const urlParams = new URLSearchParams(searchString);
  const currentClinicType = urlParams.get("type") || "middle";

  // Fetch feature categories for dynamic menu groups
  const { data: featureCategories = [] } = useQuery<FeatureCategory[]>({
    queryKey: ["/api/feature-categories"],
    enabled: !!user && user.role >= UserRole.TEACHER,
  });

  // Fetch features for grouping
  // Include PARENT (role 0) which is lower than STUDENT (role 1)
  const { data: features = [] } = useQuery<Feature[]>({
    queryKey: ["/api/features"],
    enabled: !!user && (user.role >= UserRole.STUDENT || user.role === UserRole.PARENT),
  });

  // Fetch center features for filtering
  const { data: centerFeatures = [] } = useQuery<CenterFeature[]>({
    queryKey: ["/api/center-features", selectedCenter?.id],
    queryFn: async () => {
      if (!selectedCenter?.id) return [];
      const res = await fetch(`/api/center-features/${selectedCenter.id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedCenter?.id && !!user,
  });

  // Get enabled feature IDs (excluding hidden ones)
  const enabledFeatureIds = useMemo(() => {
    return centerFeatures
      .filter(cf => !cf.isHidden)
      .map(cf => cf.featureId);
  }, [centerFeatures]);

  // Get hidden feature IDs (explicitly hidden by center)
  const hiddenFeatureIds = useMemo(() => {
    return new Set(
      centerFeatures
        .filter(cf => cf.isHidden)
        .map(cf => cf.featureId)
    );
  }, [centerFeatures]);

  // Check if a feature should be visible: basic/core features are visible unless explicitly hidden
  const isFeatureVisible = useCallback((feature: Feature | undefined) => {
    if (!feature) return true;
    if (feature.featureType === "basic" || feature.featureType === "core") {
      return !hiddenFeatureIds.has(feature.id);
    }
    return enabledFeatureIds.includes(feature.id);
  }, [enabledFeatureIds, hiddenFeatureIds]);

  // Fetch pending registration count (Admin only)
  const { data: pendingRegistrationCount = { count: 0 } } = useQuery<{ count: number }>({
    queryKey: ["/api/pending-registration-count"],
    enabled: !!user && user.role === UserRole.ADMIN,
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
    refetchInterval: 15000,
  });
  const commUnreadCount = commUnreadData.unreadCount;

  const { data: notifUnreadData = { count: 0 } } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return { count: 0 };
      const res = await fetch(`/api/notifications/unread-count?userId=${user.id}`);
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    enabled: !!user?.id,
    refetchInterval: 15000,
  });
  const totalNotifCount = (notifUnreadData?.count ?? 0) + commUnreadCount;

  // Fetch pending feature request count (Admin only)
  const { data: pendingFeatureRequestCount = { count: 0 } } = useQuery<{ count: number }>({
    queryKey: ["/api/pending-feature-request-count"],
    enabled: !!user && user.role === UserRole.ADMIN,
  });

  // Calculate new features count for principal
  const newFeaturesCount = useMemo(() => {
    if (!user || user.role !== UserRole.PRINCIPAL) return 0;
    const seenFeatures = (user as any).seenNewFeatures || [];
    const newFeatures = features.filter(f => 
      (f as any).isNew && 
      f.featureType === "optional" && 
      !seenFeatures.includes(f.id)
    );
    return newFeatures.length;
  }, [user, features]);

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

  const isParent = user?.role === UserRole.PARENT;
  const isStudent = user?.role === UserRole.STUDENT;
  // 학부모도 학생과 동일한 메뉴 사용
  const isStudentOrParent = isStudent || isParent;
  const isTeacher = user?.role === UserRole.TEACHER || user?.role === UserRole.CLINIC_TEACHER;
  const isPrincipal = user?.role === UserRole.PRINCIPAL;
  const isAdmin = user?.role === UserRole.ADMIN;
  const isStaff = isTeacher || isPrincipal || isAdmin;
  const canManage = isPrincipal || isAdmin;

  // Get enabled feature IDs for filtering menus
  const featuresByCategoryId = useMemo(() => {
    const grouped: Record<string, Feature[]> = {};
    features.forEach(f => {
      if (f.categoryId && enabledFeatureIds.includes(f.id)) {
        if (!grouped[f.categoryId]) grouped[f.categoryId] = [];
        grouped[f.categoryId].push(f);
      }
    });
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    });
    return grouped;
  }, [features, enabledFeatureIds]);

  // All menu keys that are shown in dedicated popovers (not in 더보기)
  const dedicatedMenuKeys = [
    ...classManagementMenuKeys,
    "todos", "academy-calendar", "work-journal", "new-consultations",
    "contact-parents", "daily-notices", "semester-announcements", "teacher-communication", "student-reports", "tuition",
    "supplementary", "counseling",
  ];

  // Get active categories with features (exclude class management and schedule-related categories)
  const activeCategories = useMemo(() => {
    return featureCategories
      .filter(cat => {
        if (!cat.isActive) return false;
        if (cat.menuKey === "class-management" || cat.name === "수업 관리") return false;
        if (cat.menuKey === "student-management" || cat.name === "학생 관리") return false;
        if (cat.menuKey === "parent-management" || cat.name === "학부모 관리") return false;
        const categoryFeatures = (featuresByCategoryId[cat.id] || [])
          .filter(f => !dedicatedMenuKeys.includes(f.menuKey || ""));
        if (categoryFeatures.length === 0) return false;
        return true;
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [featureCategories, featuresByCategoryId, dedicatedMenuKeys]);
  
  const getFilteredCategoryFeatures = (categoryId: string) => {
    return (featuresByCategoryId[categoryId] || [])
      .filter(f => !dedicatedMenuKeys.includes(f.menuKey || ""));
  };

  // Check if google-calendar-timetable is enabled for this center
  const isGoogleCalendarEnabled = useMemo(() => {
    const gcFeature = features.find(f => f.menuKey === "google-calendar-timetable");
    if (!gcFeature) return false;
    const centerFeature = centerFeatures.find(cf => cf.featureId === gcFeature.id);
    if (!centerFeature) return false;
    if (centerFeature.isHidden) return false;
    return true;
  }, [features, centerFeatures]);

  // Filter class management items based on feature activation status
  const filteredClassManagementItems = useMemo(() => {
    const baseItems = (user?.role ?? 0) >= UserRole.ADMIN
      ? classManagementItemsBase
      : classManagementItemsBase.filter(item => {
          const feature = features.find(f => f.menuKey === item.menuKey);
          return isFeatureVisible(feature);
        });
    const dynamicItems = features
      .filter(f =>
        f.featureType === "optional" &&
        f.parentMenuKey === "class-management" &&
        enabledFeatureIds.includes(f.id) &&
        !classManagementItemsBase.some(item => item.menuKey === f.menuKey)
      )
      .map(f => ({
        title: f.name,
        url: f.menuKey === "textbooks-videos" ? "/textbooks" : f.menuKey === "textbook-progress" ? "/textbook-progress" : `/${f.menuKey}`,
        icon: getIconByMenuKey(f.menuKey || ""),
        menuKey: f.menuKey || ""
      }));
    return [...baseItems, ...dynamicItems];
  }, [features, enabledFeatureIds, user?.role]);

  const filteredScheduleItems = useMemo(() => {
    return staffScheduleItems.filter(item => {
      if (item.menuKey === "new-consultations" && user?.isClinicTeacher) return false;
      if (!item.menuKey) return true;
      const feature = features.find(f => f.menuKey === item.menuKey);
      return isFeatureVisible(feature);
    });
  }, [features, isFeatureVisible, user?.isClinicTeacher]);

  // Filter student management items based on feature activation
  const filteredStaffStudentItems = useMemo(() => {
    const baseItems = staffStudentItems.filter(item => {
      if (!item.menuKey) return true;
      const feature = features.find(f => f.menuKey === item.menuKey);
      return isFeatureVisible(feature);
    });
    const dynamicItems = features
      .filter(f =>
        f.featureType === "optional" &&
        f.parentMenuKey === "student-management" &&
        enabledFeatureIds.includes(f.id) &&
        !staffStudentItems.some(item => item.menuKey === f.menuKey)
      )
      .map(f => ({
        title: f.name,
        url: `/${f.menuKey}`,
        icon: getIconByMenuKey(f.menuKey || ""),
        menuKey: f.menuKey || ""
      }));
    return [...baseItems, ...dynamicItems];
  }, [features, enabledFeatureIds]);

  // Filter parent items based on feature activation
  const filteredStaffParentItems = useMemo(() => {
    let items: typeof staffParentItems;
    if ((user?.role ?? 0) >= UserRole.ADMIN) {
      items = [...staffParentItems];
    } else {
      items = staffParentItems.filter(item => {
        if (!item.menuKey) return true;
        const feature = features.find(f => f.menuKey === item.menuKey);
        return isFeatureVisible(feature);
      });
    }
    const semesterFeature = features.find(f => f.menuKey === "semester-announcements");
    if (semesterFeature && enabledFeatureIds.includes(semesterFeature.id)) {
      items.push({ title: "새학기안내", url: "/semester-announcements", icon: Megaphone, menuKey: "semester-announcements" });
    }
    return items;
  }, [features, enabledFeatureIds, user?.role]);

  // Filter student class items based on feature activation status
  // 센터에서 활성화된 모든 class-management 관련 기능을 동적으로 표시
  const filteredStudentClassItems = useMemo(() => {
    // 기본 항목 (core/basic 기능) 필터링
    const baseItems = studentClassItems.filter(item => {
      const feature = features.find(f => f.menuKey === item.menuKey);
      return isFeatureVisible(feature);
    });
    
    // 동적으로 활성화된 class-management 기능들 추가
    const dynamicItems = features
      .filter(f => 
        f.featureType === "optional" && 
        f.parentMenuKey === "class-management" && 
        enabledFeatureIds.includes(f.id) &&
        !studentClassItems.some(item => item.menuKey === f.menuKey) // 중복 방지
      )
      .map(f => ({
        title: f.name,
        url: f.menuKey === "textbooks-videos" ? "/textbooks" : `/${f.menuKey}`,
        icon: getIconByMenuKey(f.menuKey || ""),
        menuKey: f.menuKey || ""
      }));
    
    return [...baseItems, ...dynamicItems];
  }, [features, enabledFeatureIds]);

  // Filter student parent items based on feature activation status
  const filteredStudentParentItems = useMemo(() => {
    const baseItems = studentParentItems.filter(item => {
      if (!item.menuKey) return true;
      const feature = features.find(f => f.menuKey === item.menuKey);
      return isFeatureVisible(feature);
    });
    const semesterFeature = features.find(f => f.menuKey === "semester-announcements");
    if (semesterFeature && enabledFeatureIds.includes(semesterFeature.id)) {
      baseItems.push({ title: "새학기안내", url: "/semester-announcements", icon: Megaphone, menuKey: "semester-announcements" });
    }
    return baseItems;
  }, [features, enabledFeatureIds]);

  // Filter student management items for student accounts
  const filteredStudentManagementItems = useMemo(() => {
    const studentVisibleKeys = ["supplementary", "grade-trend", "homework-completion", "attendance-status"];
    const staffOnlyMenuKeys = ["student-reports", "contact-parents", "marketing-calendar"];
    const baseItems = staffStudentItems.filter(item => {
      if (!studentVisibleKeys.includes(item.menuKey)) return false;
      const feature = features.find(f => f.menuKey === item.menuKey);
      return isFeatureVisible(feature);
    });
    const dynamicItems = features
      .filter(f =>
        f.featureType === "optional" &&
        f.parentMenuKey === "student-management" &&
        enabledFeatureIds.includes(f.id) &&
        !staffOnlyMenuKeys.includes(f.menuKey || "") &&
        !staffStudentItems.some(item => item.menuKey === f.menuKey)
      )
      .map(f => ({
        title: f.name,
        url: `/${f.menuKey}`,
        icon: getIconByMenuKey(f.menuKey || ""),
        menuKey: f.menuKey || ""
      }));
    return [...baseItems, ...dynamicItems];
  }, [features, enabledFeatureIds]);

  // Filter student timetable items based on Google Calendar status and feature activation
  const filteredStudentTimetableItems = useMemo(() => {
    const items = isGoogleCalendarEnabled 
      ? studentTimetableItemsWithGoogle 
      : studentTimetableItemsWithoutGoogle;
    const filtered = items.filter(item => {
      const feature = features.find(f => f.menuKey === item.menuKey);
      return isFeatureVisible(feature);
    });
    const jcomputerFeature = features.find(f => f.menuKey === "jcomputer-timetable");
    if (jcomputerFeature && isFeatureVisible(jcomputerFeature)) {
      filtered.push({ title: "제이컴퓨터 시간표", url: "/jcomputer-timetable", icon: CalendarDays, menuKey: "jcomputer-timetable" });
    }
    return filtered;
  }, [isGoogleCalendarEnabled, features, enabledFeatureIds]);

  // Build more items for staff (everything not in 홈, 수업관리, 일정, 학생, 학부모)
  const staffMoreItems = useMemo(() => {
    const timetableItem = isGoogleCalendarEnabled
      ? { title: "구글시간표", url: "/google-calendar-timetable", icon: CalendarDays, menuKey: "google-calendar-timetable" as string | undefined }
      : { title: "시간표", url: "/timetable", icon: Calendar, menuKey: "timetable" as string | undefined };

    const baseItems = isPrincipal ? [
      timetableItem,
      { title: "경영", url: "/management", icon: TrendingUp },
      { title: "사용자", url: "/users", icon: Users },
      { title: "센터", url: "/centers", icon: Building2 },
      { title: "스터디카페", url: "/study-cafe", icon: Coffee, menuKey: "study-cafe" },
      { title: "추가기능", url: "/feature-management", icon: PlusCircle },
      { title: "설정", url: "/settings", icon: Settings },
    ] : isAdmin ? [
      timetableItem,
      { title: "경영", url: "/management", icon: TrendingUp },
      { title: "사용자", url: "/users", icon: Users },
      { title: "센터", url: "/centers", icon: Building2 },
      { title: "스터디카페", url: "/study-cafe", icon: Coffee, menuKey: "study-cafe" },
      { title: "추가기능", url: "/feature-management", icon: PlusCircle },
      { title: "설정", url: "/settings", icon: Settings },
    ] : [
      timetableItem,
      { title: "사용자", url: "/users", icon: Users },
      { title: "스터디카페", url: "/study-cafe", icon: Coffee, menuKey: "study-cafe" },
      { title: "설정", url: "/settings", icon: Settings },
    ];
    
    const filtered = baseItems.filter(item => {
      if (!item.menuKey) return true;
      const feature = features.find(f => f.menuKey === item.menuKey);
      return isFeatureVisible(feature);
    });

    const dynamicTopLevel = features
      .filter(f =>
        f.featureType === "optional" &&
        (!f.parentMenuKey || f.parentMenuKey === "top-level") &&
        !f.categoryId &&
        enabledFeatureIds.includes(f.id) &&
        f.menuKey !== "google-calendar-timetable" &&
        f.menuKey !== "study-cafe" &&
        !filtered.some(item => item.menuKey === f.menuKey)
      )
      .map(f => {
        const iconMap: Record<string, any> = {
          "jcomputer-timetable": CalendarDays,
          "study-cafe": Coffee,
        };
        const urlMap: Record<string, string> = {
          "jcomputer-timetable": "/jcomputer-timetable",
          "study-cafe": "/study-cafe",
        };
        return {
          title: f.name,
          url: urlMap[f.menuKey || ""] || `/${f.menuKey}`,
          icon: iconMap[f.menuKey || ""] || BookOpen,
          menuKey: f.menuKey || ""
        };
      });

    const settingsIdx = filtered.findIndex(item => item.url === "/settings");
    if (settingsIdx >= 0) {
      filtered.splice(settingsIdx, 0, ...dynamicTopLevel);
    } else {
      filtered.push(...dynamicTopLevel);
    }

    return filtered;
  }, [isPrincipal, isAdmin, features, enabledFeatureIds, isGoogleCalendarEnabled]);

  // Build more items for students
  // 센터에서 활성화된 모든 top-level, parent-portal 기능을 동적으로 표시
  const filteredStudentMoreItems = useMemo(() => {
    // 기본 항목 필터링
    const baseItems = studentMoreItems.filter(item => {
      if (!item.menuKey) return true;
      const feature = features.find(f => f.menuKey === item.menuKey);
      return isFeatureVisible(feature);
    });
    
    // 동적으로 활성화된 top-level/parent-portal 기능들 추가 (class-management 제외, 이미 수업 메뉴에 있음)
    const staffOnlyMenuKeys = ["student-reports", "contact-parents", "marketing-calendar", "supplementary"];
    const dynamicItems = features
      .filter(f => 
        f.featureType === "optional" && 
        (f.parentMenuKey === "top-level" || f.parentMenuKey === "parent-portal" || (!f.parentMenuKey && !f.categoryId)) && 
        enabledFeatureIds.includes(f.id) &&
        f.menuKey !== "google-calendar-timetable" &&
        f.menuKey !== "jcomputer-timetable" &&
        !staffOnlyMenuKeys.includes(f.menuKey || "") &&
        !studentMoreItems.some(item => item.menuKey === f.menuKey)
      )
      .map(f => ({
        title: f.name,
        url: f.menuKey === "study-cafe" ? "/study-cafe" : 
             f.menuKey === "textbooks-videos" ? "/textbooks" : 
             f.menuKey === "student-reports" ? "/student-reports" :
             `/${f.menuKey}`,
        icon: getIconByMenuKey(f.menuKey || ""),
        menuKey: f.menuKey || ""
      }));
    
    return [...baseItems, ...dynamicItems];
  }, [features, enabledFeatureIds]);

  // Helper function for feature icons
  const getFeatureIcon = (menuKey: string | null) => {
    const iconMap: Record<string, any> = {
      "attendance": UserCheck,
      "homework": ClipboardList,
      "class-notes": FileText,
      "assessments": BarChart3,
      "exam-management": FileText,
      "clinic": Stethoscope,
      "videos": Video,
      "textbooks-videos": BookOpen,
      "presentation-videos": Video,
      "face-to-face-checks": ClipboardCheck,
      "study-cafe": Coffee,
      "teacher-communication": MessageCircle,
      "tuition": DollarSign,
      "counseling": HeartHandshake,
      "textbook-progress": BookOpen,
      "jcomputer-timetable": CalendarDays,
      "math-wrong-notes": Calculator,
    };
    return iconMap[menuKey || ""] || BookOpen;
  };

  const getFeatureUrl = (menuKey: string | null) => {
    const urlMap: Record<string, string> = {
      "attendance": "/attendance",
      "homework": "/homework",
      "class-notes": "/class-notes",
      "assessments": "/assessments",
      "exam-management": "/exam-management",
      "clinic": "/clinic",
      "videos": "/videos",
      "textbooks-videos": "/textbooks",
      "textbook-progress": "/textbook-progress",
      "presentation-videos": "/presentation-videos",
      "face-to-face-checks": "/face-to-face-checks",
      "study-cafe": "/study-cafe",
      "teacher-communication": "/teacher-communication",
      "tuition": "/tuition",
      "jcomputer-timetable": "/jcomputer-timetable",
      "math-wrong-notes": "/math-wrong-notes",
    };
    return urlMap[menuKey || ""] || "/";
  };

  // Check active states
  const isClassManagementActive = classManagementUrls.includes(location.split("?")[0]);
  const isScheduleActive = staffScheduleUrls.includes(location);
  const isStaffStudentActive = staffStudentUrls.includes(location);
  const isStaffParentActive = staffParentUrls.includes(location);
  const isStudentClassActive = studentClassItems.some(item => location === item.url);
  const isStudentParentActive = studentParentItems.some(item => location === item.url);
  const isTimetableActive = filteredStudentTimetableItems.some(item => location === item.url);

  // Parent navigation is simple
  if (isParent) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
        <div className="flex items-center justify-around h-16">
          {(() => {
            const semesterFeature = features.find(f => f.menuKey === "semester-announcements");
            const isSemesterEnabled = semesterFeature && enabledFeatureIds.includes(semesterFeature.id);
            const items = isSemesterEnabled
              ? [...parentAllItems.slice(0, 2), { title: "새학기안내", url: "/semester-announcements", icon: Megaphone }, ...parentAllItems.slice(2)]
              : parentAllItems;
            return items;
          })().map((item) => {
            const isActive = location === item.url;
            const isHome = item.url === "/";
            return (
              <Link
                key={item.title}
                href={item.url}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors relative",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
                data-testid={`mobile-nav-${item.url.replace("/", "") || "home"}`}
              >
                <div className="relative">
                  <item.icon className="h-5 w-5" />
                  {isHome && totalNotifCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {totalNotifCount > 99 ? "99+" : totalNotifCount}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium">{item.title}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  // Student/Parent navigation: 홈, 시간표, 수업, 학부모, 더보기
  if (isStudentOrParent) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
        <div className="flex items-center justify-around h-16">
          {/* 홈 */}
          <Link
            href="/"
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
              location === "/" ? "text-primary" : "text-muted-foreground"
            )}
            data-testid="mobile-nav-home"
          >
            <div className="relative">
              <Home className="h-5 w-5" />
              {totalNotifCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {totalNotifCount > 99 ? "99+" : totalNotifCount}
                </span>
              )}
            </div>
            <span className="text-xs font-medium">홈</span>
          </Link>

          {/* 시간표 */}
          {filteredStudentTimetableItems.length === 1 ? (
            <Link
              href={filteredStudentTimetableItems[0].url}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                isTimetableActive ? "text-primary" : "text-muted-foreground"
              )}
              data-testid="mobile-nav-timetable"
            >
              <CalendarDays className="h-5 w-5" />
              <span className="text-xs font-medium">시간표</span>
            </Link>
          ) : filteredStudentTimetableItems.length > 1 ? (
            <Popover open={timetableMenuOpen} onOpenChange={setTimetableMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                    isTimetableActive ? "text-primary" : "text-muted-foreground"
                  )}
                  data-testid="mobile-nav-timetable"
                >
                  <CalendarDays className="h-5 w-5" />
                  <span className="text-xs font-medium">시간표</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-2" align="center" side="top">
                <div className="flex flex-col gap-1">
                  {filteredStudentTimetableItems.map((item) => (
                    <button
                      key={item.url}
                      onClick={() => {
                        setLocation(item.url);
                        setTimetableMenuOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover-elevate",
                        location === item.url && "bg-accent"
                      )}
                      data-testid={`mobile-nav-timetable-${item.menuKey}`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.title}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : null}

          {/* 수업 */}
          {filteredStudentClassItems.length > 0 && (
            <Popover open={studentClassMenuOpen} onOpenChange={setStudentClassMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                    isStudentClassActive ? "text-primary" : "text-muted-foreground"
                  )}
                  data-testid="mobile-nav-student-class"
                >
                  <GraduationCap className="h-5 w-5" />
                  <span className="text-xs font-medium">수업</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-2 max-h-80 overflow-y-auto" align="center" side="top">
                <div className="flex flex-col gap-1">
                  {filteredStudentClassItems.map((item) => (
                    <button
                      key={item.url}
                      onClick={() => {
                        setLocation(item.url);
                        setStudentClassMenuOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover-elevate",
                        location === item.url && "bg-accent"
                      )}
                      data-testid={`mobile-nav-student-class-${item.url.replace("/", "")}`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.title}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* 학생 (학생 계정용) */}
          {isStudent && filteredStudentManagementItems.length > 0 && (
            <Popover open={studentManagementMenuOpen} onOpenChange={setStudentManagementMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                    filteredStudentManagementItems.some(item => location === item.url) ? "text-primary" : "text-muted-foreground"
                  )}
                  data-testid="mobile-nav-student-mgmt"
                >
                  <UserCheck className="h-5 w-5" />
                  <span className="text-xs font-medium">학생</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-2 max-h-80 overflow-y-auto" align="center" side="top">
                <div className="flex flex-col gap-1">
                  {filteredStudentManagementItems.map((item) => (
                    <button
                      key={item.url}
                      onClick={() => {
                        setLocation(item.url);
                        setStudentManagementMenuOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover-elevate",
                        location === item.url && "bg-accent"
                      )}
                      data-testid={`mobile-nav-student-mgmt-${item.url.replace("/", "")}`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.title}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* 학부모 */}
          {filteredStudentParentItems.length > 0 && (
            <Popover open={studentParentMenuOpen} onOpenChange={setStudentParentMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                    isStudentParentActive ? "text-primary" : "text-muted-foreground"
                  )}
                  data-testid="mobile-nav-student-parent"
                >
                  <div className="relative">
                    <Users className="h-5 w-5" />
                    {commUnreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {commUnreadCount > 99 ? "99+" : commUnreadCount}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium">학부모</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-2" align="center" side="top">
                <div className="flex flex-col gap-1">
                  {filteredStudentParentItems.map((item) => (
                    <button
                      key={item.url}
                      onClick={() => {
                        setLocation(item.url);
                        setStudentParentMenuOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover-elevate",
                        location === item.url && "bg-accent"
                      )}
                      data-testid={`mobile-nav-student-parent-${item.url.replace("/", "")}`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.title}
                      {item.url === "/teacher-communication" && commUnreadCount > 0 && (
                        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                          {commUnreadCount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* 더보기 */}
          <Popover open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                  filteredStudentMoreItems.some(item => location === item.url) ? "text-primary" : "text-muted-foreground"
                )}
                data-testid="mobile-nav-more"
              >
                <MoreHorizontal className="h-5 w-5" />
                <span className="text-xs font-medium">더보기</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2 max-h-80 overflow-y-auto" align="end" side="top">
              <div className="flex flex-col gap-1">
                {filteredStudentMoreItems.map((item) => (
                  <button
                    key={item.url}
                    onClick={() => {
                      setLocation(item.url);
                      setMoreMenuOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover-elevate",
                      location === item.url && "bg-accent"
                    )}
                    data-testid={`mobile-nav-more-${item.url.replace("/", "")}`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{item.title}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </nav>
    );
  }

  // Staff navigation (Teacher/Principal/Admin): 홈, 수업관리, 선생님, 학생, 학부모, 더보기
  if (isStaff) {
    const isMoreActive = staffMoreItems.some(item => location === item.url);
    
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
        <div className="flex items-center justify-around h-16">
          {/* 홈 */}
          <Link
            href="/"
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
              location === "/" ? "text-primary" : "text-muted-foreground"
            )}
            data-testid="mobile-nav-home"
          >
            <div className="relative">
              <Home className="h-5 w-5" />
              {totalNotifCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {totalNotifCount > 99 ? "99+" : totalNotifCount}
                </span>
              )}
            </div>
            <span className="text-xs font-medium">홈</span>
          </Link>

          {/* 수업관리 */}
          <Popover open={classManagementMenuOpen} onOpenChange={setClassManagementMenuOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                  isClassManagementActive ? "text-primary" : "text-muted-foreground"
                )}
                data-testid="mobile-nav-class-management"
              >
                <GraduationCap className="h-5 w-5" />
                <span className="text-xs font-medium">수업관리</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-2 max-h-80 overflow-y-auto" align="center" side="top">
              <div className="flex flex-col gap-1">
                {filteredClassManagementItems.map((item) => {
                  const itemPath = item.url.split("?")[0];
                  const itemParams = new URLSearchParams(item.url.split("?")[1] || "");
                  const itemType = itemParams.get("type");
                  const isActive = itemType 
                    ? (location === itemPath && currentClinicType === itemType)
                    : (location === itemPath);
                  return (
                    <button
                      key={item.url}
                      onClick={() => {
                        setLocation(item.url);
                        setClassManagementMenuOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover-elevate",
                        isActive && "bg-accent"
                      )}
                      data-testid={`mobile-nav-class-${item.url.replace("/", "").replace("?", "-")}`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.title}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          {/* 선생님 */}
          <Popover open={scheduleMenuOpen} onOpenChange={setScheduleMenuOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                  isScheduleActive ? "text-primary" : "text-muted-foreground"
                )}
                data-testid="mobile-nav-schedule"
              >
                <Calendar className="h-5 w-5" />
                <span className="text-xs font-medium">선생님</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-2" align="center" side="top">
              <div className="flex flex-col gap-1">
                {filteredScheduleItems.map((item) => (
                  <button
                    key={item.url}
                    onClick={() => {
                      setLocation(item.url);
                      setScheduleMenuOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover-elevate",
                      location === item.url && "bg-accent"
                    )}
                    data-testid={`mobile-nav-schedule-${item.url.replace("/", "")}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* 학생 */}
          <Popover open={studentManagementMenuOpen} onOpenChange={setStudentManagementMenuOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                  isStaffStudentActive ? "text-primary" : "text-muted-foreground"
                )}
                data-testid="mobile-nav-student-management"
              >
                <UserCheck className="h-5 w-5" />
                <span className="text-xs font-medium">학생</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-2 max-h-80 overflow-y-auto" align="center" side="top">
              <div className="flex flex-col gap-1">
                {filteredStaffStudentItems.map((item) => (
                  <button
                    key={item.url}
                    onClick={() => {
                      setLocation(item.url);
                      setStudentManagementMenuOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover-elevate",
                      location === item.url && "bg-accent"
                    )}
                    data-testid={`mobile-nav-student-${item.url.replace("/", "")}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* 학부모 */}
          <Popover open={parentMenuOpen} onOpenChange={setParentMenuOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                  isStaffParentActive ? "text-primary" : "text-muted-foreground"
                )}
                data-testid="mobile-nav-parent"
              >
                <div className="relative">
                  <Users className="h-5 w-5" />
                  {commUnreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {commUnreadCount > 99 ? "99+" : commUnreadCount}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium">학부모</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-2 max-h-80 overflow-y-auto" align="center" side="top">
              <div className="flex flex-col gap-1">
                {filteredStaffParentItems.map((item) => (
                  <button
                    key={item.url}
                    onClick={() => {
                      setLocation(item.url);
                      setParentMenuOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover-elevate",
                      location === item.url && "bg-accent"
                    )}
                    data-testid={`mobile-nav-parent-${item.url.replace("/", "")}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                    {item.url === "/teacher-communication" && commUnreadCount > 0 && (
                      <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                        {commUnreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* 더보기 */}
          <Popover open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors relative",
                  isMoreActive ? "text-primary" : "text-muted-foreground"
                )}
                data-testid="mobile-nav-more"
              >
                <div className="relative">
                  <MoreHorizontal className="h-5 w-5" />
                  {(pendingRegistrationCount.count > 0 || pendingFeatureRequestCount.count > 0 || (isPrincipal && featureManagementNotificationCount > 0)) && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                  )}
                </div>
                <span className="text-xs font-medium">더보기</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2 max-h-80 overflow-y-auto" align="end" side="top">
              <div className="flex flex-col gap-1">
                {staffMoreItems.map((item) => {
                  const showCentersBadge = item.url === "/centers" && pendingRegistrationCount.count > 0;
                  const showFeaturesBadge = item.url === "/feature-management" && pendingFeatureRequestCount.count > 0;
                  const showNewFeaturesBadge = item.url === "/feature-management" && isPrincipal && featureManagementNotificationCount > 0;
                  
                  return (
                    <button
                      key={item.url}
                      onClick={() => {
                        setLocation(item.url);
                        setMoreMenuOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover-elevate",
                        location === item.url && "bg-accent"
                      )}
                      data-testid={`mobile-nav-more-${item.url.replace("/", "")}`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1 text-left">{item.title}</span>
                      {showCentersBadge && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                          {pendingRegistrationCount.count}
                        </span>
                      )}
                      {showFeaturesBadge && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                          {pendingFeatureRequestCount.count}
                        </span>
                      )}
                      {showNewFeaturesBadge && (
                        <span className="flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                          {featureManagementNotificationCount}
                        </span>
                      )}
                    </button>
                  );
                })}
                {/* Dynamic categories */}
                {activeCategories.length > 0 && (
                  <>
                    <div className="h-px bg-border my-1" />
                    {activeCategories.map((category) => {
                      const categoryFeatures = getFilteredCategoryFeatures(category.id);
                      const isExpanded = openCategoryPopover === category.id;
                      const categoryUrls = categoryFeatures.map(f => getFeatureUrl(f.menuKey));
                      const isCategoryActive = categoryUrls.some(url => location.startsWith(url));
                      
                      if (categoryFeatures.length === 0) return null;
                      
                      return (
                        <div key={category.id}>
                          <button
                            onClick={() => setOpenCategoryPopover(isExpanded ? null : category.id)}
                            className={cn(
                              "flex items-center justify-between w-full gap-2 px-3 py-2 rounded-md text-sm hover-elevate",
                              isCategoryActive && "bg-accent"
                            )}
                            data-testid={`mobile-nav-category-${category.menuKey}`}
                          >
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-4 w-4" />
                              {category.name}
                            </div>
                            <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
                          </button>
                          {isExpanded && (
                            <div className="ml-4 mt-1 flex flex-col gap-1">
                              {categoryFeatures.map((feature) => {
                                const FeatureIcon = getFeatureIcon(feature.menuKey);
                                const featureUrl = getFeatureUrl(feature.menuKey);
                                return (
                                  <button
                                    key={feature.id}
                                    onClick={() => {
                                      setLocation(featureUrl);
                                      setMoreMenuOpen(false);
                                      setOpenCategoryPopover(null);
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover-elevate",
                                      location === featureUrl && "bg-accent"
                                    )}
                                    data-testid={`mobile-nav-feature-${feature.menuKey}`}
                                  >
                                    <FeatureIcon className="h-4 w-4" />
                                    {feature.name}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </nav>
    );
  }

  // Default fallback (should not reach here)
  return null;
}
