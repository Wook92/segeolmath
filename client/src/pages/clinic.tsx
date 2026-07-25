import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { queryClient, apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole, isAssistantTeacher, type User, type ClinicStudentWithDetails, type ClinicWeeklyRecord, type ClinicInstructionDefault, type ClinicSharedInstructionGroupWithMembers, type ClinicResource } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, addWeeks, subWeeks, getYear, getMonth } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Trash2, Loader2, Download, UserPlus, Settings, X, Users, Link2, FolderOpen, Upload, Search, FileText } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type WeeklyRecordWithStudent = ClinicWeeklyRecord & { clinicStudent?: ClinicStudentWithDetails };

const DAY_LABELS: Record<string, string> = {
  mon: "월",
  tue: "화",
  wed: "수",
  thu: "목",
  fri: "금",
  sat: "토",
  sun: "일",
};

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type WeekdayKey = typeof WEEKDAY_KEYS[number] | "all";

function getWeekStartDate(date: Date): string {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return format(monday, "yyyy-MM-dd");
}

export default function ClinicPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const searchString = useSearch();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddStudentDialog, setShowAddStudentDialog] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [selectedWeekday, setSelectedWeekday] = useState<WeekdayKey>("all");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("all");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [showResourcesDialog, setShowResourcesDialog] = useState(false);
  const [resourceSearchQuery, setResourceSearchQuery] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [resourceClassFilter, setResourceClassFilter] = useState<"all" | "unassigned" | string>("all");
  const [uploadClassId, setUploadClassId] = useState<string>("");
  
  const urlParams = new URLSearchParams(searchString);
  const selectedClinicType = (urlParams.get("type") as "high" | "middle") || "middle";
  
  const isTeacherOrAbove = user?.role !== undefined && user.role >= UserRole.TEACHER;
  const isClinicTeacher = user?.isClinicTeacher === true && user?.role === UserRole.CLINIC_TEACHER;
  const canEditAll = user?.role !== undefined && user.role >= UserRole.TEACHER && !isClinicTeacher;
  
  const weekStartDate = getWeekStartDate(currentWeek);
  const currentYear = getYear(currentMonth);
  const currentMonthNum = getMonth(currentMonth) + 1;

  const { data: clinicStudents = [], isLoading: studentsLoading } = useQuery<ClinicStudentWithDetails[]>({
    queryKey: [`/api/clinic-students?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter,
  });

  const { data: monthlyRecords = [], isLoading: recordsLoading } = useQuery<WeeklyRecordWithStudent[]>({
    queryKey: [`/api/clinic-weekly-records?centerId=${selectedCenter?.id}&year=${currentYear}&month=${currentMonthNum}`],
    enabled: !!selectedCenter,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: [`/api/users?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter,
  });

  const { data: sharedGroups = [] } = useQuery<ClinicSharedInstructionGroupWithMembers[]>({
    queryKey: [`/api/clinic-shared-instruction-groups?centerId=${selectedCenter?.id}&weekStartDate=${weekStartDate}`],
    enabled: !!selectedCenter,
  });

  // Fetch classes for class group selection
  const { data: allClasses = [] } = useQuery<{ id: string; name: string; subject: string; teacherId: string | null }[]>({
    queryKey: [`/api/classes?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter,
  });

  // Fetch clinic resources (PDF storage)
  const { data: clinicResources = [], isLoading: resourcesLoading } = useQuery<ClinicResource[]>({
    queryKey: [`/api/clinic-resources?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter && showResourcesDialog,
  });

  const filteredResources = useMemo(() => {
    let filtered = clinicResources;
    
    // Filter by class
    if (resourceClassFilter === "unassigned") {
      filtered = filtered.filter(r => !r.classId);
    } else if (resourceClassFilter !== "all") {
      filtered = filtered.filter(r => r.classId === resourceClassFilter);
    }
    
    // Filter by search query
    if (resourceSearchQuery.trim()) {
      const query = resourceSearchQuery.toLowerCase();
      filtered = filtered.filter(r => r.fileName.toLowerCase().includes(query));
    }
    
    return filtered;
  }, [clinicResources, resourceSearchQuery, resourceClassFilter]);

  // Get unique classes from resources for filter dropdown
  const resourceClasses = useMemo(() => {
    const classIds = new Set(clinicResources.filter(r => r.classId).map(r => r.classId!));
    return allClasses.filter(c => classIds.has(c.id));
  }, [clinicResources, allClasses]);

  const uploadResourceDirectToR2 = async (file: File, centerId: string, uploadedById: string, classId?: string) => {
    // Step 1: Get presigned URL from server
    setUploadProgress(0);
    const presignedRes = await fetch("/api/clinic-resources/presigned-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        centerId,
        fileName: file.name,
        contentType: file.type,
      }),
    });
    
    if (!presignedRes.ok) {
      const error = await presignedRes.json();
      throw new Error(error.error || "Failed to get upload URL");
    }
    
    const { uploadUrl, publicUrl } = await presignedRes.json();
    
    // Step 2: Upload directly to R2 with progress tracking
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      });
      
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error("R2 업로드에 실패했습니다"));
        }
      });
      
      xhr.addEventListener("error", () => {
        reject(new Error("네트워크 오류가 발생했습니다"));
      });
      
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });
    
    // Step 3: Confirm upload with server to create DB record
    const confirmRes = await fetch("/api/clinic-resources/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        centerId,
        classId: classId || null,
        fileName: file.name,
        filePath: publicUrl,
        isPermanent: true,
        uploadedById,
      }),
    });
    
    if (!confirmRes.ok) {
      const error = await confirmRes.json();
      throw new Error(error.error || "Failed to save file record");
    }
    
    return confirmRes.json();
  };

  const uploadResourceMutation = useMutation({
    mutationFn: async ({ file, centerId, uploadedById, classId }: { file: File; centerId: string; uploadedById: string; classId?: string }) => {
      setIsUploading(true);
      setUploadProgress(0);
      try {
        await uploadResourceDirectToR2(file, centerId, uploadedById, classId);
      } finally {
        setIsUploading(false);
        setUploadProgress(null);
      }
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/clinic-resources");
      setUploadClassId("");
      toast({ title: "파일이 업로드되었습니다" });
    },
    onError: (error: Error) => {
      toast({ title: "업로드 실패", description: error.message, variant: "destructive" });
    },
  });

  const deleteResourceMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/clinic-resources/${id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/clinic-resources");
      toast({ title: "파일이 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "삭제 실패", variant: "destructive" });
    },
  });

  const updateResourceMutation = useMutation({
    mutationFn: async ({ id, classId }: { id: string; classId: string | null }) => {
      await apiRequest("PATCH", `/api/clinic-resources/${id}`, { classId });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/clinic-resources");
      toast({ title: "반 지정이 변경되었습니다" });
    },
    onError: () => {
      toast({ title: "변경 실패", variant: "destructive" });
    },
  });

  const handleResourceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCenter || !user) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "지원하지 않는 파일 형식",
        description: "PDF, JPG, PNG, GIF, WEBP 파일만 업로드할 수 있습니다.",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }

    uploadResourceMutation.mutate({
      file,
      centerId: selectedCenter.id,
      uploadedById: user.id,
      classId: uploadClassId || undefined,
    });
    e.target.value = "";
  };

  const handleFileDrop = (file: File) => {
    if (!selectedCenter || !user) return;
    
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "지원하지 않는 파일 형식",
        description: "PDF, JPG, PNG, GIF, WEBP 파일만 업로드할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }

    uploadResourceMutation.mutate({
      file,
      centerId: selectedCenter.id,
      uploadedById: user.id,
      classId: uploadClassId || undefined,
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileDrop(files[0]);
    }
  };

  const weeklyRecords = monthlyRecords.filter(r => r.weekStartDate === weekStartDate);
  const recordMap = new Map(weeklyRecords.map(r => [r.clinicStudentId, r]));
  const activeClinicStudents = clinicStudents.filter(cs => cs.isActive);
  const teachers = allUsers.filter(u => u.role >= UserRole.TEACHER);
  const students = allUsers.filter(u => u.role === UserRole.STUDENT);

  // Group classes by teacher for dropdown
  const classesByTeacher = useMemo(() => {
    const grouped: Record<string, { teacherName: string; classes: typeof allClasses }> = {};
    const unassigned: typeof allClasses = [];
    
    // Create teacher name lookup from teachers list
    const teacherNameMap = new Map<string, string>();
    teachers.forEach((t) => {
      teacherNameMap.set(t.id, t.name);
    });
    
    allClasses.forEach((cls) => {
      if (cls.teacherId) {
        if (!grouped[cls.teacherId]) {
          grouped[cls.teacherId] = {
            teacherName: teacherNameMap.get(cls.teacherId) || "선생님",
            classes: [],
          };
        }
        grouped[cls.teacherId].classes.push(cls);
      } else {
        unassigned.push(cls);
      }
    });
    
    return { grouped, unassigned };
  }, [allClasses, teachers]);

  const toggleRecordSelection = (recordId: string) => {
    setSelectedRecordIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedRecordIds(new Set());
  };

  const batchCreateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/clinic-weekly-records/batch", {
        centerId: selectedCenter?.id,
        weekStartDate,
      });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/clinic-weekly-records");
    },
  });

  const hasAllRecords = activeClinicStudents.every(cs => recordMap.has(cs.id));
  const thisWeekStartDate = getWeekStartDate(new Date());
  const isCurrentWeek = weekStartDate === thisWeekStartDate;

  useEffect(() => {
    if (
      isCurrentWeek &&
      !recordsLoading &&
      !studentsLoading &&
      activeClinicStudents.length > 0 &&
      !hasAllRecords &&
      !batchCreateMutation.isPending
    ) {
      batchCreateMutation.mutate();
    }
  }, [weekStartDate, isCurrentWeek, recordsLoading, studentsLoading, activeClinicStudents.length, hasAllRecords]);

  // Clear selection when week changes to prevent orphaned selections
  useEffect(() => {
    setSelectedRecordIds(new Set());
  }, [weekStartDate]);

  if (!isTeacherOrAbove) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">권한이 없습니다</p>
      </div>
    );
  }

  const isLoading = studentsLoading || recordsLoading;

  const goToPreviousWeek = () => {
    const newWeek = subWeeks(currentWeek, 1);
    setCurrentWeek(newWeek);
    if (getMonth(newWeek) !== getMonth(currentWeek)) {
      setCurrentMonth(newWeek);
    }
  };

  const goToNextWeek = () => {
    const newWeek = addWeeks(currentWeek, 1);
    setCurrentWeek(newWeek);
    if (getMonth(newWeek) !== getMonth(currentWeek)) {
      setCurrentMonth(newWeek);
    }
  };

  const goToThisWeek = () => {
    const now = new Date();
    setCurrentWeek(now);
    setCurrentMonth(now);
  };


  // Helper function to get grade order for sorting (lower number = earlier grade)
  const getGradeOrder = (grade: string | null | undefined): number => {
    if (!grade) return 999; // Unknown grades at the end
    const gradeMap: Record<string, number> = {
      "초1": 1, "초2": 2, "초3": 3, "초4": 4, "초5": 5, "초6": 6,
      "중1": 7, "중2": 8, "중3": 9,
      "고1": 10, "고2": 11, "고3": 12,
      "성인": 13,
    };
    return gradeMap[grade] ?? 999;
  };

  // Compute available groups for filter buttons with class info
  const availableGroups = useMemo(() => {
    const typeFilteredStudents = activeClinicStudents.filter(cs => 
      (cs.clinicType || "middle") === selectedClinicType
    );
    const groupSet = new Set<string>();
    let hasUnregistered = false;
    
    typeFilteredStudents.forEach(cs => {
      if (cs.classGroup && cs.classGroup !== "미등록") {
        groupSet.add(cs.classGroup);
      } else {
        hasUnregistered = true;
      }
    });
    
    const groups = Array.from(groupSet)
      .sort((a, b) => a.localeCompare(b, "ko"))
      .map(groupName => {
        const matchingClass = allClasses.find(c => c.name === groupName);
        return {
          name: groupName,
          displayName: matchingClass ? `${groupName} (${matchingClass.subject})` : groupName,
        };
      });
    
    if (hasUnregistered) {
      groups.push({ name: "미등록 반", displayName: "미등록 반" });
    }
    return groups;
  }, [activeClinicStudents, selectedClinicType, allClasses]);

  const filteredClinicStudents = useMemo(() => {
    let filtered = activeClinicStudents.filter(cs => 
      (cs.clinicType || "middle") === selectedClinicType
    );
    if (selectedWeekday !== "all") {
      filtered = filtered.filter(cs => 
        Array.isArray(cs.clinicDays) && cs.clinicDays.includes(selectedWeekday)
      );
    }
    
    // Apply group filter
    if (selectedGroupFilter !== "all") {
      if (selectedGroupFilter === "미등록 반") {
        filtered = filtered.filter(cs => !cs.classGroup || cs.classGroup === "미등록");
      } else {
        filtered = filtered.filter(cs => cs.classGroup === selectedGroupFilter);
      }
    }
    
    return filtered;
  }, [activeClinicStudents, selectedWeekday, selectedClinicType, selectedGroupFilter]);

  // Sort students within each teacher group so shared group members are adjacent
  const sortStudentsBySharedGroups = (students: ClinicStudentWithDetails[]): ClinicStudentWithDetails[] => {
    if (students.length <= 1) return students;
    
    // Build a map of recordId -> clinicStudentId
    const recordToStudentMap = new Map<string, string>();
    students.forEach(cs => {
      const record = recordMap.get(cs.id);
      if (record) {
        recordToStudentMap.set(record.id, cs.id);
      }
    });
    
    // Build shared group membership: clinicStudentId -> list of group keys
    const studentGroupMembership = new Map<string, Set<string>>();
    const groupMembers = new Map<string, Set<string>>(); // groupKey -> clinicStudentIds
    
    for (const group of sharedGroups) {
      const groupKey = `${group.period}-${group.id}`;
      const memberStudentIds = new Set<string>();
      
      group.members?.forEach(member => {
        if (member.recordId) {
          const studentId = recordToStudentMap.get(member.recordId);
          if (studentId) {
            memberStudentIds.add(studentId);
            if (!studentGroupMembership.has(studentId)) {
              studentGroupMembership.set(studentId, new Set());
            }
            studentGroupMembership.get(studentId)!.add(groupKey);
          }
        }
      });
      
      if (memberStudentIds.size > 1) {
        groupMembers.set(groupKey, memberStudentIds);
      }
    }
    
    // If no shared groups, preserve the caller-provided order (e.g. 학년 정렬)
    if (groupMembers.size === 0) {
      return [...students];
    }
    
    // Preserve the caller-provided base order, then move shared-group members adjacent
    const sortedStudents = [...students];
    
    // Process each shared group and move members to be adjacent
    const result = [...sortedStudents];
    const processed = new Set<string>();
    
    // For each group, find members and move them adjacent to the first member
    const groupKeys = Array.from(groupMembers.keys());
    for (const groupKey of groupKeys) {
      const memberIds = groupMembers.get(groupKey);
      if (!memberIds) continue;
      
      const membersInResult = Array.from(memberIds).filter((id: string) => 
        result.some(cs => cs.id === id) && !processed.has(id)
      );
      
      if (membersInResult.length <= 1) continue;
      
      // Find the first member's position
      let firstPos = -1;
      for (let i = 0; i < result.length; i++) {
        if (membersInResult.includes(result[i].id)) {
          firstPos = i;
          break;
        }
      }
      
      if (firstPos === -1) continue;
      
      // Extract all members (except first) and their current positions
      const membersToMove: ClinicStudentWithDetails[] = [];
      for (let i = result.length - 1; i >= 0; i--) {
        if (i !== firstPos && membersInResult.includes(result[i].id)) {
          membersToMove.unshift(result[i]);
          result.splice(i, 1);
          if (i < firstPos) firstPos--;
        }
      }
      
      // Insert members right after the first member
      result.splice(firstPos + 1, 0, ...membersToMove);
      
      // Mark these members as processed
      membersInResult.forEach((id: string) => processed.add(id));
    }
    
    return result;
  };

  const studentsByTeacher = useMemo(() => {
    const grouped = filteredClinicStudents.reduce((acc, cs) => {
      const teacherId = cs.regularTeacherId;
      if (!acc[teacherId]) acc[teacherId] = [];
      acc[teacherId].push(cs);
      return acc;
    }, {} as Record<string, ClinicStudentWithDetails[]>);
    
    // 담당선생님 그룹 내 정렬: 1) 학년 내림차순 2) 이름 3) 공유 그룹 인접
    const sorted: Record<string, ClinicStudentWithDetails[]> = {};
    for (const [teacherId, students] of Object.entries(grouped)) {
      // 담당선생님 그룹별로 학년 내림차순 정렬(동일 학년은 이름순)
      const baseSorted = [...students].sort((a, b) => {
        const gradeA = getGradeOrder(a.grade || a.student?.grade);
        const gradeB = getGradeOrder(b.grade || b.student?.grade);
        if (gradeA !== gradeB) {
          return gradeB - gradeA;
        }
        return (a.student?.name || "").localeCompare(b.student?.name || "", "ko");
      });
      // 공유 그룹 인접 정렬을 적용하되 위 기준 정렬 순서는 유지
      sorted[teacherId] = sortStudentsBySharedGroups(baseSorted);
    }
    return sorted;
  }, [filteredClinicStudents, sharedGroups, recordMap]);

  // Recalculate member indices based on the SORTED order in studentsByTeacher
  // If members are not adjacent, treat them as individual cells (no rowSpan)
  const recordIdToGroupMap = useMemo(() => {
    const map = new Map<string, { group: ClinicSharedInstructionGroupWithMembers; memberIndex: number; totalMembers: number; isAdjacent: boolean }>();
    
    // Build flat list of all students in their actual table order (per teacher group)
    // We need to track positions within each teacher group separately
    const recordPositionInTeacherGroup = new Map<string, { position: number; teacherId: string }>();
    
    Object.entries(studentsByTeacher).forEach(([teacherId, students]) => {
      students.forEach((cs, idx) => {
        const record = recordMap.get(cs.id);
        if (record) {
          recordPositionInTeacherGroup.set(record.id, { position: idx, teacherId });
        }
      });
    });
    
    // For each shared group, check if members are adjacent
    for (const group of sharedGroups) {
      if (!group.members || group.members.length === 0) continue;
      
      // Get recordIds with their positions
      const membersWithPositions = group.members
        .filter(m => m.recordId && recordPositionInTeacherGroup.has(m.recordId))
        .map(m => ({
          recordId: m.recordId!,
          ...recordPositionInTeacherGroup.get(m.recordId!)!
        }))
        .sort((a, b) => a.position - b.position);
      
      if (membersWithPositions.length < 2) continue;
      
      // Check if all members are in the same teacher group and are adjacent
      const allSameTeacher = membersWithPositions.every(m => m.teacherId === membersWithPositions[0].teacherId);
      let isAdjacent = allSameTeacher;
      
      if (allSameTeacher) {
        // Check if positions are consecutive
        for (let i = 1; i < membersWithPositions.length; i++) {
          if (membersWithPositions[i].position !== membersWithPositions[i - 1].position + 1) {
            isAdjacent = false;
            break;
          }
        }
      }
      
      // Assign memberIndex based on sorted position
      membersWithPositions.forEach((m, idx) => {
        map.set(`${m.recordId}-${group.period}`, {
          group,
          memberIndex: isAdjacent ? idx : -1, // -1 means show individually (no rowSpan)
          totalMembers: membersWithPositions.length,
          isAdjacent
        });
      });
    }
    
    return map;
  }, [sharedGroups, studentsByTeacher, recordMap]);

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-2xl font-bold">
        {selectedClinicType === "high" ? "고등클리닉" : "중등클리닉"}
      </h1>

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="icon" onClick={goToPreviousWeek} data-testid="button-prev-week">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToThisWeek} data-testid="button-this-week">
          이번 주
        </Button>
        <span className="text-sm font-medium min-w-[140px] text-center">
          {format(startOfWeek(currentWeek, { weekStartsOn: 1 }), "yyyy년 M월 d일", { locale: ko })} 주
        </span>
        <Button variant="outline" size="icon" onClick={goToNextWeek} data-testid="button-next-week">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">요일:</span>
        <Button
          variant={selectedWeekday === "all" ? "default" : "outline"}
          size="sm"
          className="min-w-0 px-2"
          onClick={() => setSelectedWeekday("all")}
          data-testid="button-weekday-all"
        >
          전체
        </Button>
        {WEEKDAY_KEYS.map((day) => (
          <Button
            key={day}
            variant={selectedWeekday === day ? "default" : "outline"}
            size="sm"
            className="min-w-0 px-2"
            onClick={() => setSelectedWeekday(day)}
            data-testid={`button-weekday-${day}`}
          >
            {DAY_LABELS[day]}
          </Button>
        ))}
        {selectedWeekday !== "all" && (
          <span className="text-sm text-muted-foreground ml-2">
            ({filteredClinicStudents.length}명)
          </span>
        )}
      </div>

      {availableGroups.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">반:</span>
          <Button
            variant={selectedGroupFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedGroupFilter("all")}
            data-testid="button-group-all"
          >
            전체
          </Button>
          {availableGroups.map((group) => (
            <Button
              key={group.name}
              variant={selectedGroupFilter === group.name ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedGroupFilter(group.name)}
              data-testid={`button-group-${group.name}`}
            >
              {group.displayName}
            </Button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddStudentDialog(true)}
          data-testid="button-add-clinic-student"
        >
          <UserPlus className="w-4 h-4 mr-1" />
          학생 추가
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowResourcesDialog(true)}
          data-testid="button-clinic-resources"
        >
          <FolderOpen className="w-4 h-4 mr-1" />
          자료 모음
        </Button>
      </div>

      {canEditAll && selectedRecordIds.size >= 2 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBulkEditDialog(true)}
            data-testid="button-bulk-edit"
          >
            <Settings className="w-4 h-4 mr-1" />
            일괄 편집 ({selectedRecordIds.size}명)
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSelection}
            data-testid="button-clear-selection"
          >
            <X className="w-4 h-4 mr-1" />
            선택 해제
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : activeClinicStudents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          등록된 클리닉 학생이 없습니다
        </div>
      ) : filteredClinicStudents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {selectedWeekday !== "all" 
            ? `${DAY_LABELS[selectedWeekday]}요일에 등록된 학생이 없습니다`
            : "표시할 학생이 없습니다"}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-md">
              <table className="border-collapse text-sm min-w-[1200px] w-full" data-testid="clinic-table">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {canEditAll && (
                      <th className="p-2 text-center font-medium border-r w-[40px]">
                        <div className="flex flex-col items-center gap-1">
                          <span>선택</span>
                          <Checkbox
                            checked={(() => {
                              const allRecordIds: string[] = [];
                              Object.values(studentsByTeacher).forEach(students => {
                                students.forEach(cs => {
                                  const r = recordMap.get(cs.id);
                                  if (r) allRecordIds.push(r.id);
                                });
                              });
                              return allRecordIds.length > 0 && allRecordIds.every(id => selectedRecordIds.has(id));
                            })()}
                            onCheckedChange={(checked) => {
                              const allRecordIds: string[] = [];
                              Object.values(studentsByTeacher).forEach(students => {
                                students.forEach(cs => {
                                  const r = recordMap.get(cs.id);
                                  if (r) allRecordIds.push(r.id);
                                });
                              });
                              if (checked) {
                                setSelectedRecordIds(new Set([...selectedRecordIds, ...allRecordIds]));
                              } else {
                                setSelectedRecordIds(new Set());
                              }
                            }}
                            data-testid="checkbox-select-all-clinic"
                          />
                        </div>
                      </th>
                    )}
                    <th className="p-2 text-center font-medium border-r w-[80px]">담당<br/>선생님</th>
                    <th className="p-2 text-center font-medium border-r w-[80px]">이름</th>
                    <th className="p-2 text-center font-medium border-r w-[50px]">
                      학년
                    </th>
                    <th className="p-2 text-center font-medium border-r w-[60px]">학교</th>
                    <th className="p-2 text-center font-medium border-r w-[120px]">클리닉<br/>요일/시간</th>
                    <th className="p-2 text-center font-medium border-r w-[200px]">담당선생님 지시사항<br/>(1교시)</th>
                    <th className="p-2 text-center font-medium border-r w-[200px]">담당선생님 지시사항<br/>(2교시)</th>
                    <th className="p-2 text-center font-medium border-r w-[200px]">담당선생님 지시사항<br/>(3교시)</th>
                    <th className="p-2 text-center font-medium w-[250px]">클리닉 선생님 기록사항<br/><span className="text-xs text-muted-foreground">(교재명, 프린트 등, 공부한 쪽수 및 부족한 부분 기록)</span></th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(studentsByTeacher).map(([teacherId, studentsInGroup], groupIdx) => {
                    const teacher = teachers.find(t => t.id === teacherId);
                    return studentsInGroup.map((cs, idx) => {
                      const record = recordMap.get(cs.id);
                      const isFirstInGroup = idx === 0;
                      const isSelected = record ? selectedRecordIds.has(record.id) : false;
                      const period1GroupInfo = record ? recordIdToGroupMap.get(`${record.id}-period1`) : undefined;
                      const period2GroupInfo = record ? recordIdToGroupMap.get(`${record.id}-period2`) : undefined;
                      const period3GroupInfo = record ? recordIdToGroupMap.get(`${record.id}-period3`) : undefined;
                      
                      return (
                        <ClinicTableRow
                          key={cs.id}
                          clinicStudent={cs}
                          record={record}
                          teacher={teacher}
                          isFirstInGroup={isFirstInGroup}
                          groupSize={studentsInGroup.length}
                          canEditAll={canEditAll}
                          isClinicTeacher={isClinicTeacher}
                          weekStartDate={weekStartDate}
                          onEditStudent={() => setEditingStudentId(cs.id)}
                          onEditRecord={() => record && setEditingRecordId(record.id)}
                          onRecordCreated={(recordId) => setEditingRecordId(recordId)}
                          isSelected={isSelected}
                          onToggleSelect={() => record && toggleRecordSelection(record.id)}
                          period1GroupInfo={period1GroupInfo}
                          period2GroupInfo={period2GroupInfo}
                          period3GroupInfo={period3GroupInfo}
                          onEditGroup={(groupId) => setEditingGroupId(groupId)}
                        />
                      );
                    });
                  })}
                </tbody>
              </table>
        </div>
      )}

      <AddStudentDialog
        open={showAddStudentDialog}
        onOpenChange={setShowAddStudentDialog}
        students={students}
        teachers={teachers}
        centerId={selectedCenter?.id || ""}
        currentUserId={user?.id || ""}
        isAdmin={user?.role === UserRole.ADMIN || user?.role === UserRole.PRINCIPAL}
        defaultClinicType={selectedClinicType}
      />

      <EditStudentDialog
        open={!!editingStudentId}
        onOpenChange={(open) => !open && setEditingStudentId(null)}
        clinicStudent={clinicStudents.find(cs => cs.id === editingStudentId)}
        teachers={teachers}
        user={user}
        clinicStudents={clinicStudents}
        allClasses={allClasses}
      />

      <EditRecordDialog
        open={!!editingRecordId}
        onOpenChange={(open) => !open && setEditingRecordId(null)}
        record={weeklyRecords.find(r => r.id === editingRecordId)}
        clinicStudent={clinicStudents.find(cs => weeklyRecords.find(r => r.id === editingRecordId)?.clinicStudentId === cs.id)}
        canEditAll={canEditAll}
        isClinicTeacher={isClinicTeacher}
        weekStartDate={weekStartDate}
      />

      <EditSharedGroupDialog
        open={!!editingGroupId}
        onOpenChange={(open) => !open && setEditingGroupId(null)}
        group={sharedGroups.find(g => g.id === editingGroupId)}
        clinicStudents={clinicStudents}
        weeklyRecords={weeklyRecords}
      />

      <BulkEditDialog
        open={showBulkEditDialog}
        onOpenChange={(open) => {
          setShowBulkEditDialog(open);
          if (!open) clearSelection();
        }}
        selectedRecordIds={Array.from(selectedRecordIds)}
        clinicStudents={clinicStudents}
        weeklyRecords={weeklyRecords}
        teachers={teachers}
        user={user}
        allClasses={allClasses}
        weekStartDate={weekStartDate}
        centerId={selectedCenter?.id || ""}
      />

      <Dialog open={showResourcesDialog} onOpenChange={(open) => {
        setShowResourcesDialog(open);
        if (!open) setIsDragging(false);
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              자료 모음
            </DialogTitle>
          </DialogHeader>
          
          <div
            className={cn(
              "flex-1 flex flex-col relative",
              isDragging && "pointer-events-none"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg">
                <div className="text-center">
                  <Upload className="w-12 h-12 mx-auto mb-2 text-primary" />
                  <p className="text-lg font-medium text-primary">파일을 여기에 놓으세요</p>
                  <p className="text-sm text-muted-foreground">PDF, JPG, PNG, GIF, WEBP</p>
                </div>
              </div>
            )}
            
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="파일명으로 검색..."
                    value={resourceSearchQuery}
                    onChange={(e) => setResourceSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-resource-search"
                  />
                </div>
                <Select value={resourceClassFilter} onValueChange={setResourceClassFilter}>
                  <SelectTrigger className="w-[160px]" data-testid="select-resource-filter">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="unassigned">미지정</SelectItem>
                    {Object.entries(classesByTeacher.grouped).map(([teacherId, { teacherName, classes }]) => (
                      <SelectGroup key={teacherId}>
                        <SelectLabel className="text-xs font-semibold text-muted-foreground">{teacherName} 선생님</SelectLabel>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                    {classesByTeacher.unassigned.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-xs font-semibold text-muted-foreground">기타</SelectLabel>
                        {classesByTeacher.unassigned.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <Select value={uploadClassId || "none"} onValueChange={(val) => setUploadClassId(val === "none" ? "" : val)}>
                  <SelectTrigger className="flex-1" data-testid="select-upload-class">
                    <SelectValue placeholder="수업 선택 (선택사항)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미지정</SelectItem>
                    {Object.entries(classesByTeacher.grouped).map(([teacherId, { teacherName, classes }]) => (
                      <SelectGroup key={teacherId}>
                        <SelectLabel className="text-xs font-semibold text-muted-foreground">{teacherName} 선생님</SelectLabel>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                    {classesByTeacher.unassigned.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-xs font-semibold text-muted-foreground">기타</SelectLabel>
                        {classesByTeacher.unassigned.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
                <label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                    className="hidden"
                    onChange={handleResourceUpload}
                    disabled={isUploading}
                    data-testid="input-resource-upload"
                  />
                  <Button
                    variant="default"
                    size="sm"
                    disabled={isUploading}
                    asChild
                  >
                    <span className="cursor-pointer">
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-1" />
                      )}
                      파일 업로드
                    </span>
                  </Button>
                </label>
              </div>
            </div>

            {isUploading && uploadProgress !== null && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">업로드 중...</span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0">
              {resourcesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredResources.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>{resourceSearchQuery ? "검색 결과가 없습니다" : "파일을 드래그하여 업로드하세요"}</p>
                  <p className="text-xs mt-1">또는 위의 버튼을 클릭하세요</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredResources.map((resource) => {
                    const resourceClass = resource.classId ? allClasses.find(c => c.id === resource.classId) : null;
                    return (
                      <div
                        key={resource.id}
                        className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50"
                        data-testid={`resource-item-${resource.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate mb-1">{resource.fileName}</p>
                            <div className="flex items-center gap-2">
                              <Select 
                                value={resource.classId || "none"} 
                                onValueChange={(val) => {
                                  updateResourceMutation.mutate({
                                    id: resource.id,
                                    classId: val === "none" ? null : val,
                                  });
                                }}
                              >
                                <SelectTrigger className="h-7 w-[180px] text-xs" data-testid={`select-resource-class-${resource.id}`}>
                                  <SelectValue>
                                    {resourceClass ? resourceClass.name : "미지정"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">미지정</SelectItem>
                                  {Object.entries(classesByTeacher.grouped).map(([teacherId, { teacherName, classes }]) => (
                                    <SelectGroup key={teacherId}>
                                      <SelectLabel className="text-xs font-semibold text-muted-foreground">{teacherName} 선생님</SelectLabel>
                                      {classes.map((cls) => (
                                        <SelectItem key={cls.id} value={cls.id}>
                                          {cls.name}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  ))}
                                  {classesByTeacher.unassigned.length > 0 && (
                                    <SelectGroup>
                                      <SelectLabel className="text-xs font-semibold text-muted-foreground">기타</SelectLabel>
                                      {classesByTeacher.unassigned.map((cls) => (
                                        <SelectItem key={cls.id} value={cls.id}>
                                          {cls.name}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  )}
                                </SelectContent>
                              </Select>
                              <span className="text-xs text-muted-foreground">
                                {resource.createdAt && format(new Date(resource.createdAt), "yyyy-MM-dd", { locale: ko })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(resource.filePath, "_blank")}
                            data-testid={`button-download-${resource.id}`}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("이 파일을 삭제하시겠습니까?")) {
                                deleteResourceMutation.mutate(resource.id);
                              }
                            }}
                            disabled={deleteResourceMutation.isPending}
                            data-testid={`button-delete-${resource.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type SharedGroupInfo = {
  group: ClinicSharedInstructionGroupWithMembers;
  memberIndex: number;
  totalMembers: number;
  isAdjacent: boolean;
};

function ClinicTableRow({
  clinicStudent,
  record,
  teacher,
  isFirstInGroup,
  groupSize,
  canEditAll,
  isClinicTeacher,
  weekStartDate,
  onEditStudent,
  onEditRecord,
  onRecordCreated,
  isSelected,
  onToggleSelect,
  period1GroupInfo,
  period2GroupInfo,
  period3GroupInfo,
  onEditGroup,
}: {
  clinicStudent: ClinicStudentWithDetails;
  record?: ClinicWeeklyRecord;
  teacher?: User;
  isFirstInGroup: boolean;
  groupSize: number;
  canEditAll: boolean;
  isClinicTeacher: boolean;
  weekStartDate: string;
  onEditStudent: () => void;
  onEditRecord: () => void;
  onRecordCreated: (recordId: string) => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  period1GroupInfo?: SharedGroupInfo;
  period2GroupInfo?: SharedGroupInfo;
  period3GroupInfo?: SharedGroupInfo;
  onEditGroup?: (groupId: string) => void;
}) {
  const { toast } = useToast();
  
  const createRecordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/clinic-weekly-records", {
        clinicStudentId: clinicStudent.id,
        weekStartDate,
      });
      return res.json();
    },
    onError: (error) => {
      console.error("Failed to create weekly record:", error);
      toast({ 
        title: "주간 기록 생성 실패", 
        description: "잠시 후 다시 시도해주세요.",
        variant: "destructive" 
      });
    },
  });

  const clinicDaysDisplay = clinicStudent.clinicDays?.map(d => `(${DAY_LABELS[d] || d})`).join(" ") || "";
  const clinicTimeDisplay = clinicStudent.clinicTime || "";
  const dayTimeNote = record?.clinicDayTimeNote || "";
  
  const handleCellClick = async () => {
    if (createRecordMutation.isPending) return;
    if (!record) {
      try {
        const newRecord = await createRecordMutation.mutateAsync();
        // Wait for cache to be refreshed before opening dialog
        await queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === 'string' && key.startsWith('/api/clinic-weekly-records');
          }
        });
        if (newRecord?.id) {
          onRecordCreated(newRecord.id);
        }
      } catch (error) {
        // Error already handled in onError
      }
    } else {
      onEditRecord();
    }
  };

  const renderPeriodCell = (
    periodContent: string | null | undefined,
    periodKey: "period1" | "period2" | "period3",
    _unused?: boolean,
    groupInfo?: SharedGroupInfo
  ) => {
    const filePeriod = periodKey === "period1" ? "weekly_evaluation" : periodKey;
    
    // Handler for grouped cells - opens group edit dialog
    const handleGroupClick = () => {
      if (canEditAll && groupInfo && onEditGroup) {
        onEditGroup(groupInfo.group.id);
      }
    };
    
    // Adjacent group members: use rowSpan for first member, return null for others
    if (groupInfo && groupInfo.isAdjacent && groupInfo.memberIndex === 0) {
      return (
        <td 
          className="p-2 border-r cursor-pointer hover:bg-muted/50 bg-blue-50 dark:bg-blue-900/20"
          onClick={handleGroupClick}
          rowSpan={groupInfo.totalMembers}
        >
          <div className="space-y-1">
            <Badge variant="secondary" className="text-[10px] mb-1">
              <Link2 className="w-3 h-3 mr-1" />
              공통 ({groupInfo.totalMembers}명)
            </Badge>
            <CellContent 
              content={groupInfo.group.content} 
              recordId={record?.id} 
              period={filePeriod}
            />
          </div>
        </td>
      );
    }
    
    if (groupInfo && groupInfo.isAdjacent && groupInfo.memberIndex > 0) {
      return null;
    }
    
    // Non-adjacent group members: show content in each cell individually with shared indicator
    if (groupInfo && !groupInfo.isAdjacent) {
      return (
        <td 
          className="p-2 border-r cursor-pointer hover:bg-muted/50 bg-purple-50 dark:bg-purple-900/20"
          onClick={handleGroupClick}
        >
          <div className="space-y-1">
            <Badge variant="outline" className="text-[10px] mb-1 border-purple-300 dark:border-purple-600">
              <Link2 className="w-3 h-3 mr-1" />
              공통
            </Badge>
            <CellContent 
              content={groupInfo.group.content} 
              recordId={record?.id} 
              period={filePeriod}
            />
          </div>
        </td>
      );
    }

    return (
      <td 
        className="p-2 border-r cursor-pointer hover:bg-muted/50"
        onClick={canEditAll ? handleCellClick : undefined}
      >
        <CellContent 
          content={periodContent} 
          recordId={record?.id} 
          period={filePeriod}
        />
      </td>
    );
  };

  return (
    <tr className="border-b hover-elevate" data-testid={`clinic-row-${clinicStudent.id}`}>
      {canEditAll && (
        <td className="p-2 border-r text-center">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect?.()}
            disabled={!record}
            data-testid={`checkbox-select-${clinicStudent.id}`}
          />
        </td>
      )}
      {isFirstInGroup && (
        <td 
          className="p-2 border-r bg-amber-100 dark:bg-amber-900/30 font-medium text-center align-middle"
          rowSpan={groupSize}
        >
          {teacher?.name || "미지정"}
        </td>
      )}
      <td className="p-2 border-r">
        <button
          className="text-left hover:underline"
          onClick={onEditStudent}
          data-testid={`button-edit-student-${clinicStudent.id}`}
        >
          {clinicStudent.student?.name || "Unknown"}
        </button>
      </td>
      <td className="p-2 border-r text-center text-xs">
        {formatGrade(clinicStudent.grade || clinicStudent.student?.grade)}
      </td>
      <td className="p-2 border-r text-muted-foreground">
        {formatSchoolName(clinicStudent.student?.school) || "-"}
      </td>
      <td 
        className="p-2 border-r cursor-pointer hover:bg-muted/50"
        onClick={canEditAll ? handleCellClick : undefined}
      >
        <div className="text-xs">
          {clinicDaysDisplay || clinicTimeDisplay ? (
            <>
              {clinicDaysDisplay} {clinicTimeDisplay}
            </>
          ) : (
            <span className="text-muted-foreground">클릭하여 편집</span>
          )}
          {dayTimeNote && (
            <div className="text-red-600 dark:text-red-400 mt-1">{dayTimeNote}</div>
          )}
        </div>
      </td>
      {renderPeriodCell(record?.weeklyEvaluation, "period1", undefined, period1GroupInfo)}
      {renderPeriodCell(record?.period2Instruction, "period2", undefined, period2GroupInfo)}
      {renderPeriodCell(record?.period3Instruction, "period3", undefined, period3GroupInfo)}
      <td 
        className="p-2 cursor-pointer hover:bg-muted/50 group"
        onClick={handleCellClick}
      >
        {record?.clinicTeacherNotes ? (
          <div className="text-xs">
            <div 
              className="whitespace-pre-wrap text-red-600 dark:text-red-400"
              dangerouslySetInnerHTML={{ __html: formatContent(record.clinicTeacherNotes) }}
            />
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">클릭하여 편집</span>
        )}
      </td>
    </tr>
  );
}

function CellContent({ 
  content, 
  isClinicNotes 
}: { 
  content?: string | null;
  recordId?: string;
  period?: string;
  isClinicNotes?: boolean;
}) {
  if (!content) {
    return <span className="text-muted-foreground text-xs">클릭하여 편집</span>;
  }

  return (
    <div className="text-xs">
      <div 
        className={cn(
          "whitespace-pre-wrap",
          isClinicNotes && "text-red-600 dark:text-red-400"
        )}
        dangerouslySetInnerHTML={{ __html: formatContent(content) }}
      />
    </div>
  );
}

function formatContent(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-red-600 dark:text-red-400">$1</strong>')
    .replace(/__(.*?)__/g, '<u>$1</u>')
    .replace(/\n/g, '<br/>');
}

function formatSchoolName(school?: string | null): string {
  if (!school) return "";
  return school
    .replace(/초등학교$/, "초")
    .replace(/중등학교$/, "중")
    .replace(/고등학교$/, "고")
    .replace(/학교$/, "");
}

function formatGrade(grade?: string | null): string {
  if (!grade) return "-";
  const gradeMap: Record<string, string> = {
    "중학교 1학년": "중1",
    "중학교 2학년": "중2",
    "중학교 3학년": "중3",
    "고등학교 1학년": "고1",
    "고등학교 2학년": "고2",
    "고등학교 3학년": "고3",
    "성인": "성인",
  };
  return gradeMap[grade] || grade;
}

function AddStudentDialog({
  open,
  onOpenChange,
  students,
  teachers,
  centerId,
  currentUserId,
  isAdmin,
  defaultClinicType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: User[];
  teachers: User[];
  centerId: string;
  currentUserId: string;
  isAdmin: boolean;
  defaultClinicType: "high" | "middle";
}) {
  const { toast } = useToast();
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [clinicType, setClinicType] = useState<"high" | "middle">(defaultClinicType);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [clinicTime, setClinicTime] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedStudentIds([]);
      setSelectedTeacherId("");
      setClinicType(defaultClinicType);
      setSelectedDays([]);
      setClinicTime("");
      setSearchQuery("");
    }
  }, [open, defaultClinicType]);

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return sortedStudents;
    const query = searchQuery.toLowerCase();
    return sortedStudents.filter(s => 
      s.name.toLowerCase().includes(query) || 
      s.school?.toLowerCase().includes(query) ||
      s.grade?.toLowerCase().includes(query)
    );
  }, [sortedStudents, searchQuery]);

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId) 
        : [...prev, studentId]
    );
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      for (const studentId of selectedStudentIds) {
        await apiRequest("POST", "/api/clinic-students", {
          studentId,
          regularTeacherId: isAdmin ? selectedTeacherId : currentUserId,
          centerId,
          clinicType,
          clinicDays: selectedDays,
          clinicTime,
          defaultInstructions: "-",
        });
      }
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/clinic-students");
      const count = selectedStudentIds.length;
      toast({ title: `클리닉 학생 ${count}명이 등록되었습니다` });
      onOpenChange(false);
      setSelectedStudentIds([]);
      setSelectedTeacherId("");
      setSelectedDays([]);
      setClinicTime("");
      setSearchQuery("");
    },
    onError: () => {
      toast({ title: "등록 실패", variant: "destructive" });
    },
  });

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>클리닉 학생 추가</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isAdmin && (
            <div>
              <Label>담당 선생님 선택</Label>
              <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                <SelectTrigger data-testid="select-teacher">
                  <SelectValue placeholder="선생님을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div>
            <Label>학생 선택 {selectedStudentIds.length > 0 && <span className="text-muted-foreground">({selectedStudentIds.length}명 선택됨)</span>}</Label>
            <Input
              placeholder="학생 이름, 학교, 학년으로 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="mt-1"
              data-testid="input-student-search"
            />
            <div className="border rounded-md mt-2 max-h-48 overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <div className="p-3 text-center text-muted-foreground text-sm">
                  {searchQuery ? "검색 결과가 없습니다" : "등록된 학생이 없습니다"}
                </div>
              ) : (
                <>
                <label
                  className="flex items-center gap-2 p-2 hover-elevate cursor-pointer border-b bg-muted/30 sticky top-0"
                  data-testid="checkbox-select-all-students"
                >
                  <Checkbox
                    checked={filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.includes(s.id))}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        const allIds = new Set([...selectedStudentIds, ...filteredStudents.map(s => s.id)]);
                        setSelectedStudentIds(Array.from(allIds));
                      } else {
                        const filteredIds = new Set(filteredStudents.map(s => s.id));
                        setSelectedStudentIds(selectedStudentIds.filter(id => !filteredIds.has(id)));
                      }
                    }}
                  />
                  <span className="flex-1 font-medium text-sm">전체선택</span>
                  <span className="text-xs text-muted-foreground">{filteredStudents.length}명</span>
                </label>
                {filteredStudents.map(s => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 p-2 hover-elevate cursor-pointer border-b last:border-b-0"
                    data-testid={`checkbox-student-${s.id}`}
                  >
                    <Checkbox
                      checked={selectedStudentIds.includes(s.id)}
                      onCheckedChange={() => toggleStudentSelection(s.id)}
                    />
                    <span className="flex-1">{s.name}</span>
                    {s.grade && <span className="text-xs text-muted-foreground">{s.grade}</span>}
                  </label>
                ))}
                </>
              )}
            </div>
          </div>
          
          <div>
            <Label>클리닉 유형</Label>
            <div className="flex gap-2 mt-2">
              <Button
                variant={clinicType === "high" ? "default" : "outline"}
                size="sm"
                onClick={() => setClinicType("high")}
                data-testid="button-clinic-type-high-add"
              >
                고등클리닉
              </Button>
              <Button
                variant={clinicType === "middle" ? "default" : "outline"}
                size="sm"
                onClick={() => setClinicType("middle")}
                data-testid="button-clinic-type-middle-add"
              >
                중등클리닉
              </Button>
            </div>
          </div>
          
          <div>
            <Label>클리닉 요일</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(DAY_LABELS).map(([day, label]) => (
                <Button
                  key={day}
                  variant={selectedDays.includes(day) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleDay(day)}
                  data-testid={`button-day-${day}`}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label>클리닉 시간</Label>
            <Input
              value={clinicTime}
              onChange={e => setClinicTime(e.target.value)}
              placeholder="예: 12~1pm 사이 등원"
              data-testid="input-clinic-time"
            />
          </div>

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button 
            onClick={() => createMutation.mutate()} 
            disabled={selectedStudentIds.length === 0 || selectedDays.length === 0 || (isAdmin && !selectedTeacherId) || createMutation.isPending}
            data-testid="button-submit-add-student"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkEditDialog({
  open,
  onOpenChange,
  selectedRecordIds,
  clinicStudents,
  weeklyRecords,
  teachers,
  user,
  allClasses,
  weekStartDate,
  centerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRecordIds: string[];
  clinicStudents: ClinicStudentWithDetails[];
  weeklyRecords: ClinicWeeklyRecord[];
  teachers: User[];
  user?: { id: string; role: number } | null;
  allClasses: { id: string; name: string; subject: string; teacherId: string | null }[];
  weekStartDate: string;
  centerId: string;
}) {
  const { toast } = useToast();
  const [newRegularTeacherId, setNewRegularTeacherId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedClassGroup, setSelectedClassGroup] = useState("");
  const [showNewClassGroupInput, setShowNewClassGroupInput] = useState(false);
  const [newClassGroupName, setNewClassGroupName] = useState("");
  const [clinicDayTimeNote, setClinicDayTimeNote] = useState("");
  const [period1Instruction, setPeriod1Instruction] = useState("");
  const [period2Instruction, setPeriod2Instruction] = useState("");
  const [period3Instruction, setPeriod3Instruction] = useState("");

  const isPrincipalOrAdmin = user && user.role >= UserRole.PRINCIPAL;

  // Get selected clinic student IDs and record IDs from selected record IDs
  const selectedClinicStudentIds = useMemo(() => {
    const recordIdToStudentId = new Map(weeklyRecords.map(r => [r.id, r.clinicStudentId]));
    return selectedRecordIds.map(rid => recordIdToStudentId.get(rid)).filter(Boolean) as string[];
  }, [selectedRecordIds, weeklyRecords]);

  const selectedRecords = useMemo(() => {
    return weeklyRecords.filter(r => selectedRecordIds.includes(r.id));
  }, [selectedRecordIds, weeklyRecords]);

  // Get available class groups based on selected teacher - from actual classes in the database
  const getAvailableClassGroups = (): { value: string; label: string }[] => {
    const targetTeacherId = isPrincipalOrAdmin ? selectedTeacherId : user?.id;
    if (!targetTeacherId) return [];

    // Use name+subject as value to avoid duplicates when same class name has multiple subjects
    const teacherClasses = allClasses
      .filter(c => c.teacherId === targetTeacherId || isAssistantTeacher(c, targetTeacherId))
      .map(c => ({ value: `${c.name} (${c.subject})`, label: `${c.name} (${c.subject})` }));
    
    const existingGroupValues = new Set<string>();
    clinicStudents.forEach(cs => {
      if (cs.regularTeacherId === targetTeacherId && cs.classGroup && cs.classGroup !== "미등록") {
        existingGroupValues.add(cs.classGroup);
      }
    });
    
    const existingGroups = Array.from(existingGroupValues)
      .filter(g => !teacherClasses.find(tc => tc.value === g))
      .map(g => ({ value: g, label: g }));
    
    return [...teacherClasses, ...existingGroups].sort((a, b) => a.label.localeCompare(b.label, 'ko'));
  };

  const availableClassGroups = getAvailableClassGroups();

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setNewRegularTeacherId("");
      setSelectedTeacherId("");
      setSelectedClassGroup("");
      setShowNewClassGroupInput(false);
      setNewClassGroupName("");
      setClinicDayTimeNote("");
      setPeriod1Instruction("");
      setPeriod2Instruction("");
      setPeriod3Instruction("");
    }
  }, [open]);

  const effectiveClassGroup = showNewClassGroupInput ? newClassGroupName : selectedClassGroup;
  const hasResolutionMismatch = selectedRecordIds.length !== selectedClinicStudentIds.length;

  // Check if any field has content to save
  const hasTeacherChange = newRegularTeacherId.trim() !== "";
  const hasClassGroupChange = effectiveClassGroup.trim() !== "";
  const hasInstructionChange = clinicDayTimeNote.trim() !== "" || period1Instruction.trim() !== "" || period2Instruction.trim() !== "" || period3Instruction.trim() !== "";
  const hasAnyChange = hasTeacherChange || hasClassGroupChange || hasInstructionChange;

  const bulkUpdateMutation = useMutation({
    mutationFn: async () => {
      if (selectedClinicStudentIds.length === 0) {
        throw new Error("선택된 학생이 없습니다");
      }
      if (hasResolutionMismatch) {
        throw new Error("일부 학생 정보를 찾을 수 없습니다. 다시 선택해주세요.");
      }

      const promises: Promise<any>[] = [];

      // Update teacher and/or class group if specified
      if (hasTeacherChange || hasClassGroupChange) {
        selectedClinicStudentIds.forEach(id => {
          const body: any = {};
          if (hasTeacherChange) body.regularTeacherId = newRegularTeacherId;
          if (hasClassGroupChange) body.classGroup = effectiveClassGroup || null;
          promises.push(apiRequest("PATCH", `/api/clinic-students/${id}`, body));
        });
      }

      // Update instructions if any field has content
      if (hasInstructionChange) {
        selectedRecords.forEach(record => {
          const body: any = {};
          if (clinicDayTimeNote.trim()) body.clinicDayTimeNote = clinicDayTimeNote;
          if (period1Instruction.trim()) body.weeklyEvaluation = period1Instruction;
          if (period2Instruction.trim()) body.period2Instruction = period2Instruction;
          if (period3Instruction.trim()) body.period3Instruction = period3Instruction;
          
          if (Object.keys(body).length > 0) {
            promises.push(apiRequest("PATCH", `/api/clinic-weekly-records/${record.id}`, body));
          }
        });
      }

      await Promise.all(promises);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/clinic-students");
      invalidateQueriesStartingWith("/api/clinic-weekly-records");
      
      const messages: string[] = [];
      if (hasTeacherChange) messages.push("담당선생님");
      if (hasClassGroupChange) messages.push("반 배정");
      if (hasInstructionChange) messages.push("지시사항");
      toast({ title: `${selectedClinicStudentIds.length}명의 ${messages.join(", ")}이 저장되었습니다` });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ title: error instanceof Error ? error.message : "저장 실패", variant: "destructive" });
    },
  });

  // Get student names for display
  const selectedStudentNames = useMemo(() => {
    return selectedClinicStudentIds
      .map(id => clinicStudents.find(cs => cs.id === id)?.student?.name)
      .filter(Boolean)
      .slice(0, 5);
  }, [selectedClinicStudentIds, clinicStudents]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>일괄 편집 ({selectedClinicStudentIds.length}명)</DialogTitle>
          <div className="text-sm text-muted-foreground">
            {selectedStudentNames.join(", ")}
            {selectedClinicStudentIds.length > 5 && ` 외 ${selectedClinicStudentIds.length - 5}명`}
          </div>
        </DialogHeader>
        {hasResolutionMismatch && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
            일부 학생 정보를 찾을 수 없습니다. 선택을 해제하고 다시 시도해주세요.
          </div>
        )}
        <div className="space-y-6">
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-medium">담당선생님 설정</h3>
            <div>
              <Label>담당선생님 변경 (선택사항)</Label>
              <Select value={newRegularTeacherId} onValueChange={setNewRegularTeacherId}>
                <SelectTrigger data-testid="select-bulk-regular-teacher">
                  <SelectValue placeholder="변경하지 않으려면 비워두세요" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-medium">반 배정</h3>
            {isPrincipalOrAdmin && (
              <div>
                <Label>반 조회할 선생님</Label>
                <Select value={selectedTeacherId} onValueChange={(val) => {
                  setSelectedTeacherId(val);
                  setSelectedClassGroup("");
                  setShowNewClassGroupInput(false);
                  setNewClassGroupName("");
                }}>
                  <SelectTrigger data-testid="select-bulk-teacher">
                    <SelectValue placeholder="선생님을 먼저 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>반 선택 (선택사항)</Label>
              {showNewClassGroupInput ? (
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newClassGroupName}
                    onChange={e => setNewClassGroupName(e.target.value)}
                    placeholder="새 반 이름 입력"
                    data-testid="input-bulk-new-classgroup"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowNewClassGroupInput(false);
                      setNewClassGroupName("");
                    }}
                  >
                    취소
                  </Button>
                </div>
              ) : (
                <Select
                  value={selectedClassGroup}
                  onValueChange={(val) => {
                    if (val === "__new__") {
                      setShowNewClassGroupInput(true);
                      setNewClassGroupName("");
                    } else {
                      setSelectedClassGroup(val);
                    }
                  }}
                  disabled={!!isPrincipalOrAdmin && !selectedTeacherId}
                >
                  <SelectTrigger data-testid="select-bulk-classgroup">
                    <SelectValue placeholder={isPrincipalOrAdmin && !selectedTeacherId ? "선생님을 먼저 선택하세요" : "반 선택 (변경하지 않으려면 비워두세요)"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="미등록">미등록</SelectItem>
                    {availableClassGroups.map(g => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                    <div className="border-t mt-1 pt-1">
                      <SelectItem value="__new__">+ 새 반 추가</SelectItem>
                    </div>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-medium">담당선생님 지시사항</h3>
            <p className="text-sm text-muted-foreground">입력한 내용이 선택된 모든 학생에게 동일하게 적용됩니다. 비워두면 변경되지 않습니다.</p>
            
            <div>
              <Label>클리닉 요일/시간 특별 메모</Label>
              <Input
                value={clinicDayTimeNote}
                onChange={e => setClinicDayTimeNote(e.target.value)}
                placeholder="예: 1/10 안옵니다"
                className="mt-1"
                data-testid="input-bulk-daytime-note"
              />
            </div>

            <div>
              <Label>1교시 지시사항</Label>
              <Textarea
                value={period1Instruction}
                onChange={e => setPeriod1Instruction(e.target.value)}
                placeholder="1교시 지시사항 (선택)"
                rows={2}
                className="mt-1"
                data-testid="input-bulk-period1"
              />
            </div>

            <div>
              <Label>2교시 지시사항</Label>
              <Textarea
                value={period2Instruction}
                onChange={e => setPeriod2Instruction(e.target.value)}
                placeholder="2교시 지시사항 (선택)"
                rows={2}
                className="mt-1"
                data-testid="input-bulk-period2"
              />
            </div>

            <div>
              <Label>3교시 지시사항</Label>
              <Textarea
                value={period3Instruction}
                onChange={e => setPeriod3Instruction(e.target.value)}
                placeholder="3교시 지시사항 (선택)"
                rows={2}
                className="mt-1"
                data-testid="input-bulk-period3"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button
            onClick={() => bulkUpdateMutation.mutate()}
            disabled={!hasAnyChange || bulkUpdateMutation.isPending || selectedClinicStudentIds.length === 0 || hasResolutionMismatch}
          >
            {bulkUpdateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditStudentDialog({
  open,
  onOpenChange,
  clinicStudent,
  teachers,
  user,
  clinicStudents,
  allClasses,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicStudent?: ClinicStudentWithDetails;
  teachers: User[];
  user?: { id: string; role: number } | null;
  clinicStudents: ClinicStudentWithDetails[];
  allClasses: { id: string; name: string; subject: string; teacherId: string | null }[];
}) {
  const { toast } = useToast();
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [clinicTime, setClinicTime] = useState("");
  const [regularTeacherId, setRegularTeacherId] = useState("");
  const [clinicType, setClinicType] = useState<"high" | "middle">("middle");
  const [grade, setGrade] = useState("");
  const [classGroup, setClassGroup] = useState("");
  const [showNewClassGroupInput, setShowNewClassGroupInput] = useState(false);
  const [newClassGroupName, setNewClassGroupName] = useState("");
  const [classGroupTeacherId, setClassGroupTeacherId] = useState("");

  const isPrincipalOrAdmin = user && user.role >= UserRole.PRINCIPAL;

  // Get available class groups based on role and selected teacher - from actual classes in the database
  // Returns array of {value, label} for display with both name and subject
  const getAvailableClassGroups = (): { value: string; label: string }[] => {
    const targetTeacherId = isPrincipalOrAdmin ? classGroupTeacherId : user?.id;
    if (!targetTeacherId) return [];

    // Get class info from the classes table for this teacher
    // Use name+subject as value to avoid duplicates when same class name has multiple subjects
    const teacherClasses = allClasses
      .filter(c => c.teacherId === targetTeacherId || isAssistantTeacher(c, targetTeacherId))
      .map(c => ({ value: `${c.name} (${c.subject})`, label: `${c.name} (${c.subject})` }));
    
    // Also include any existing class groups from clinic students (for custom groups)
    const existingGroupValues = new Set<string>();
    clinicStudents.forEach(cs => {
      if (cs.regularTeacherId === targetTeacherId && cs.classGroup && cs.classGroup !== "미등록") {
        existingGroupValues.add(cs.classGroup);
      }
    });
    
    // Convert existing groups that are not in teacherClasses to {value, label} format
    const existingGroups = Array.from(existingGroupValues)
      .filter(g => !teacherClasses.find(tc => tc.value === g))
      .map(g => ({ value: g, label: g }));
    
    // Combine and sort by label
    return [...teacherClasses, ...existingGroups].sort((a, b) => a.label.localeCompare(b.label, 'ko'));
  };

  const availableClassGroups = getAvailableClassGroups();

  useEffect(() => {
    if (clinicStudent) {
      setSelectedDays(clinicStudent.clinicDays || []);
      setClinicTime(clinicStudent.clinicTime || "");
      setRegularTeacherId(clinicStudent.regularTeacherId || "");
      setClinicType((clinicStudent.clinicType as "high" | "middle") || "middle");
      setGrade(clinicStudent.grade || clinicStudent.student?.grade || "");
      setClassGroup(clinicStudent.classGroup || "");
      setShowNewClassGroupInput(false);
      setNewClassGroupName("");
      // For class group selection, default to the student's current teacher
      setClassGroupTeacherId(clinicStudent.regularTeacherId || "");
    }
  }, [clinicStudent]);

  const effectiveClassGroup = showNewClassGroupInput ? newClassGroupName : classGroup;

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/clinic-students/${clinicStudent?.id}`, {
        clinicDays: selectedDays,
        clinicTime,
        regularTeacherId,
        clinicType,
        grade,
        classGroup: effectiveClassGroup || null,
      });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/clinic-students");
      toast({ title: "저장되었습니다" });
      onOpenChange(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/clinic-students/${clinicStudent?.id}`, {});
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/clinic-students");
      toast({ title: "삭제되었습니다" });
      onOpenChange(false);
    },
  });

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  if (!clinicStudent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{clinicStudent.student?.name} - 클리닉 설정</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>담당선생님</Label>
            <Select value={regularTeacherId} onValueChange={setRegularTeacherId}>
              <SelectTrigger data-testid="select-teacher">
                <SelectValue placeholder="선생님 선택" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>학년</Label>
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger data-testid="select-grade">
                <SelectValue placeholder="학년 선택" />
              </SelectTrigger>
              <SelectContent>
                {["초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3", "성인"].map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>반</Label>
            {isPrincipalOrAdmin && (
              <div>
                <Select 
                  value={classGroupTeacherId} 
                  onValueChange={(val) => {
                    setClassGroupTeacherId(val);
                    setClassGroup("");
                    setShowNewClassGroupInput(false);
                    setNewClassGroupName("");
                  }}
                >
                  <SelectTrigger data-testid="select-classgroup-teacher">
                    <SelectValue placeholder="선생님을 먼저 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {showNewClassGroupInput ? (
              <div className="flex gap-2">
                <Input
                  value={newClassGroupName}
                  onChange={e => setNewClassGroupName(e.target.value)}
                  placeholder="새 반 이름 입력"
                  data-testid="input-new-classgroup"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowNewClassGroupInput(false);
                    setNewClassGroupName("");
                  }}
                >
                  취소
                </Button>
              </div>
            ) : (
              <Select 
                value={classGroup} 
                onValueChange={(val) => {
                  if (val === "__new__") {
                    setShowNewClassGroupInput(true);
                    setNewClassGroupName("");
                  } else {
                    setClassGroup(val);
                  }
                }}
                disabled={!!isPrincipalOrAdmin && !classGroupTeacherId}
              >
                <SelectTrigger data-testid="select-classgroup">
                  <SelectValue placeholder={isPrincipalOrAdmin && !classGroupTeacherId ? "선생님을 먼저 선택하세요" : "반 선택"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="미등록">미등록</SelectItem>
                  {availableClassGroups.map(g => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                  <div className="border-t mt-1 pt-1">
                    <SelectItem value="__new__">+ 새 반 추가</SelectItem>
                  </div>
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Label>클리닉 유형</Label>
            <div className="flex gap-2 mt-2">
              <Button
                variant={clinicType === "high" ? "default" : "outline"}
                size="sm"
                onClick={() => setClinicType("high")}
                data-testid="button-clinic-type-high-edit"
              >
                고등클리닉
              </Button>
              <Button
                variant={clinicType === "middle" ? "default" : "outline"}
                size="sm"
                onClick={() => setClinicType("middle")}
                data-testid="button-clinic-type-middle-edit"
              >
                중등클리닉
              </Button>
            </div>
          </div>

          <div>
            <Label>클리닉 요일</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(DAY_LABELS).map(([day, label]) => (
                <Button
                  key={day}
                  variant={selectedDays.includes(day) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleDay(day)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label>클리닉 시간</Label>
            <Input
              value={clinicTime}
              onChange={e => setClinicTime(e.target.value)}
              placeholder="예: 12~1pm 사이 등원"
            />
          </div>
        </div>
        <DialogFooter className="flex justify-between">
          <Button 
            variant="destructive" 
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            삭제
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button 
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
            >
              저장
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditRecordDialog({
  open,
  onOpenChange,
  record,
  clinicStudent,
  canEditAll,
  isClinicTeacher,
  weekStartDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: ClinicWeeklyRecord;
  clinicStudent?: ClinicStudentWithDetails;
  canEditAll: boolean;
  isClinicTeacher: boolean;
  weekStartDate: string;
}) {
  const { toast } = useToast();
  const [clinicDayTimeNote, setClinicDayTimeNote] = useState("");
  const [weeklyEvaluation, setWeeklyEvaluation] = useState("");
  const [period2Instruction, setPeriod2Instruction] = useState("");
  const [period3Instruction, setPeriod3Instruction] = useState("");
  const [clinicTeacherNotes, setClinicTeacherNotes] = useState("");

  useEffect(() => {
    if (record) {
      setClinicDayTimeNote(record.clinicDayTimeNote || "");
      setWeeklyEvaluation(record.weeklyEvaluation || "");
      setPeriod2Instruction(record.period2Instruction || "");
      setPeriod3Instruction(record.period3Instruction || "");
      setClinicTeacherNotes(record.clinicTeacherNotes || "");
    }
  }, [record]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const body: any = {};
      if (canEditAll) {
        body.clinicDayTimeNote = clinicDayTimeNote;
        body.weeklyEvaluation = weeklyEvaluation;
        body.period2Instruction = period2Instruction;
        body.period3Instruction = period3Instruction;
      }
      body.clinicTeacherNotes = clinicTeacherNotes;
      
      await apiRequest("PATCH", `/api/clinic-weekly-records/${record?.id}`, body);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/clinic-weekly-records");
      toast({ title: "저장되었습니다" });
      onOpenChange(false);
    },
  });

  if (!record || !clinicStudent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{clinicStudent.student?.name} - 주간 기록 ({weekStartDate})</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {canEditAll && (
            <>
              <div>
                <Label>클리닉 요일/ 시간 특별 메모</Label>
                <Input
                  value={clinicDayTimeNote}
                  onChange={e => setClinicDayTimeNote(e.target.value)}
                  placeholder="예: 1/10 안옵니다"
                  className="mt-1"
                />
              </div>

              <PeriodSection
                label="담당선생님 지시사항 (1교시)"
                value={weeklyEvaluation}
                onChange={setWeeklyEvaluation}
              />

              <PeriodSection
                label="담당선생님 지시사항 (2교시)"
                value={period2Instruction}
                onChange={setPeriod2Instruction}
              />

              <PeriodSection
                label="담당선생님 지시사항 (3교시)"
                value={period3Instruction}
                onChange={setPeriod3Instruction}
              />
            </>
          )}

          <PeriodSection
            label="클리닉 선생님 기록사항"
            value={clinicTeacherNotes}
            onChange={setClinicTeacherNotes}
            isClinicNotes
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button 
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PeriodSection({
  label,
  value,
  onChange,
  isClinicNotes,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  isClinicNotes?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        placeholder={`${label} 내용을 입력하세요`}
        className={cn(isClinicNotes && "text-red-600 dark:text-red-400")}
      />
    </div>
  );
}

function EditSharedGroupDialog({
  open,
  onOpenChange,
  group,
  clinicStudents,
  weeklyRecords,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: ClinicSharedInstructionGroupWithMembers;
  clinicStudents: ClinicStudentWithDetails[];
  weeklyRecords: ClinicWeeklyRecord[];
}) {
  const { toast } = useToast();
  const [content, setContent] = useState("");

  useEffect(() => {
    if (open && group) {
      setContent(group.content || "");
    }
  }, [open, group]);

  const memberStudentNames = useMemo(() => {
    if (!group?.members) return [];
    return group.members.map(member => {
      const record = weeklyRecords.find(r => r.id === member.recordId);
      if (!record) return "Unknown";
      const clinicStudent = clinicStudents.find(cs => cs.id === record.clinicStudentId);
      return clinicStudent?.student?.name || "Unknown";
    });
  }, [group, weeklyRecords, clinicStudents]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/clinic-shared-instruction-groups/${group?.id}`, {
        content,
      });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/clinic-shared-instruction-groups");
      toast({ title: "공통 지시사항이 수정되었습니다" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "수정 실패", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/clinic-shared-instruction-groups/${group?.id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/clinic-shared-instruction-groups");
      toast({ title: "그룹이 해제되었습니다" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "그룹 해제 실패", variant: "destructive" });
    },
  });

  if (!group) return null;

  const periodLabel = group.period === "period1" ? "1교시" : group.period === "period2" ? "2교시" : "3교시";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{periodLabel} 공통 지시사항 수정</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">그룹 학생 ({memberStudentNames.length}명)</Label>
            <div className="mt-2 flex flex-wrap gap-1">
              {memberStudentNames.map((name, idx) => (
                <Badge key={idx} variant="secondary">{name}</Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>공통 지시사항</Label>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={4}
              placeholder="공통 지시사항을 입력하세요"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="destructive" 
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="sm:mr-auto"
          >
            {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "그룹 해제"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button 
            onClick={() => updateMutation.mutate()}
            disabled={!content.trim() || updateMutation.isPending}
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
