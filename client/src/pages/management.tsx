import { useState, useEffect, useMemo, Component, type ErrorInfo, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ManualButton } from "@/components/manual-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole, ExitReasons, MARKETING_CHANNEL_LIST, MarketingChannels, isAssistantTeacher, type MarketingCampaign, type MonthlyFinancialRecord, FinancialExpenseCategories, type User } from "@shared/schema";
import { TrendingDown, TrendingUp, Users, RefreshCw, BarChart3, PieChart, Clock, Calendar, AlertCircle, GraduationCap, Briefcase, DollarSign, Megaphone, Plus, Edit, Trash2, ChevronLeft, ChevronRight, ChevronDown, Calculator, Copy, School, Settings } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell, ComposedChart, Area } from "recharts";
import { format, startOfMonth, parseISO, differenceInDays } from "date-fns";
import { ko } from "date-fns/locale";
import { formatKoreanTime } from "@/lib/utils";

class ManagementErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ManagementPage ERROR]", error.message, error.stack);
    console.error("[ManagementPage ERROR INFO]", errorInfo.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 space-y-4">
          <h2 className="text-xl font-bold text-destructive">경영 페이지 로드 오류</h2>
          <p className="text-sm text-muted-foreground">오류 메시지:</p>
          <pre className="bg-muted p-4 rounded text-xs overflow-auto whitespace-pre-wrap">{this.state.error?.message}</pre>
          <pre className="bg-muted p-4 rounded text-xs overflow-auto whitespace-pre-wrap max-h-[300px]">{this.state.error?.stack}</pre>
          <Button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}>
            페이지 새로고침
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

type TeacherWorkRecord = {
  id: string;
  teacherId: string;
  centerId: string;
  workDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  workMinutes: number | null;
  noCheckOut: boolean;
  teacherName?: string;
};

type MonthlyData = {
  month: string;
  studentCount: number;
  exitCount: number;
  exitRatio: number;
  reasons: Record<string, number>;
};

type StudentTrendsData = {
  currentTotal: number;
  currentYear: number;
  lastYear: number;
  hasLastYearData: boolean;
  monthlyData: Array<{
    month: number;
    year: number;
    label: string;
    count: number;
    lastYearCount: number | null;
    delta: number;
    deltaPercent: number;
  }>;
  lastUpdated: string;
};

type MarketingComparisonData = {
  currentYear: number;
  lastYear: number;
  currentYearTotal: number;
  lastYearTotal: number;
  currentYearMonthly: { month: number; total: number }[];
  lastYearMonthly: { month: number; total: number }[];
  currentYearCampaigns: MarketingCampaign[];
  lastYearCampaigns: MarketingCampaign[];
};

type TeacherExitData = {
  teacherId: string;
  teacherName: string;
  exitCount: number;
  totalStudents: number;
  exitRatio: number;
};

function formatBudget(value: number): string {
  if (value >= 10000) {
    const man = Math.floor(value / 10000);
    const remainder = value % 10000;
    if (remainder === 0) {
      return `${man}만원`;
    } else if (remainder % 1000 === 0) {
      return `${man}만${remainder / 1000}천원`;
    } else {
      return `${man}만${remainder.toLocaleString()}원`;
    }
  }
  return `${value.toLocaleString()}원`;
}

const CHART_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#06B6D4", "#EC4899", "#84CC16", "#F97316", "#6366F1",
  "#14B8A6", "#A855F7"
];

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  return `${year.slice(2)}년 ${parseInt(m)}월`;
}

function formatMonthShort(month: string): string {
  const [, m] = month.split("-");
  return `${parseInt(m)}월`;
}

// Salary breakdown panel component for showing detailed calculation
function SalaryBreakdownPanel({ teacherId, yearMonth, centerId }: { teacherId: string; yearMonth: string; centerId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();

  type SalaryCalcType = {
    baseSalary: number;
    performanceBonus: number;
    totalSalary: number;
    breakdown: {
      classes: Array<{
        classId: string;
        className: string;
        classLevel?: string;
        studentCount: number;
        basePay: number;
        extraStudents: number;
        extraPay: number;
        totalPay: number;
        level?: string;
      }>;
      classCount: number;
      totalStudents: number;
      bonusStudents: number;
    };
  };

  type AdjustmentType = {
    id: string;
    teacherId: string;
    centerId: string;
    yearMonth: string;
    amount: number;
    description: string;
    createdAt: string;
    createdBy: string | null;
  };

  const { data: salaryCalc, isLoading } = useQuery<SalaryCalcType>({
    queryKey: [`/api/teacher-salary-calculation/${teacherId}/${yearMonth}?centerId=${centerId}`],
    enabled: !!teacherId && !!yearMonth && !!centerId,
  });

  const { data: adjustments = [] } = useQuery<AdjustmentType[]>({
    queryKey: [`/api/teacher-salary-adjustments?centerId=${centerId}&yearMonth=${yearMonth}&teacherId=${teacherId}`],
    enabled: !!teacherId && !!yearMonth && !!centerId,
  });

  const totalAdjustments = adjustments.reduce((sum, adj) => sum + adj.amount, 0);

  const [newAmount, setNewAmount] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: { teacherId: string; centerId: string; yearMonth: string; amount: number; description: string }) => {
      return apiRequest("POST", `/api/teacher-salary-adjustments?actorId=${user?.id}`, data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/teacher-salary-adjustments");
      setNewAmount("");
      setNewDescription("");
      toast({ title: "조정 항목이 추가되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "추가에 실패했습니다", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/teacher-salary-adjustments/${id}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/teacher-salary-adjustments");
      toast({ title: "조정 항목이 삭제되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const copyFromPreviousMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/teacher-salary-adjustments/copy-from-previous?actorId=${user?.id}`, {
        teacherId,
        centerId,
        yearMonth,
      });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      invalidateQueriesStartingWith("/api/teacher-salary-adjustments");
      toast({ title: data.message || "이전 달 조정 항목이 복사되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "복사에 실패했습니다", variant: "destructive" });
    },
  });

  const handleAdd = () => {
    if (!newAmount || !newDescription) {
      toast({ title: "금액과 내용을 입력해주세요", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      teacherId,
      centerId,
      yearMonth,
      amount: parseInt(newAmount),
      description: newDescription,
    });
  };

  if (isLoading) {
    return <div className="p-3 text-sm text-muted-foreground">불러오는 중...</div>;
  }

  if (!salaryCalc) {
    return <div className="p-3 text-sm text-muted-foreground">급여 정보를 불러올 수 없습니다</div>;
  }

  return (
    <div className="p-3 bg-muted/50 border-t text-sm space-y-2">
      <div className="font-medium text-xs text-muted-foreground mb-2">급여 세부 산정 내역</div>
      <div className="flex justify-between">
        <span>기본급</span>
        <span>{formatBudget(salaryCalc.baseSalary)}</span>
      </div>
      <div className="flex justify-between">
        <span>성과급 ({salaryCalc.breakdown.classCount}개 수업)</span>
        <span>{formatBudget(salaryCalc.performanceBonus)}</span>
      </div>
      {salaryCalc.breakdown.classes.length > 0 && (
        <div className="mt-2 pt-2 border-t space-y-1">
          <div className="font-medium text-xs text-muted-foreground">수업별 내역</div>
          {salaryCalc.breakdown.classes.map((cls, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="flex items-center gap-1">
                {cls.className}
                <span className="text-muted-foreground">
                  ({(cls.classLevel || cls.level) === "elementary" ? "초등" : (cls.classLevel || cls.level) === "high" ? "고등" : "중등"}, {cls.studentCount}명
                  {cls.extraStudents > 0 && <span className="text-green-600">, 초과 {cls.extraStudents}명</span>})
                  {cls.days && <span> [{cls.days}]</span>}
                </span>
              </span>
              <span>{formatBudget(cls.totalPay)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-between font-medium border-t pt-2 mt-2">
        <span>자동계산 급여</span>
        <span>{formatBudget(salaryCalc.totalSalary)}</span>
      </div>

      <div className="border-t pt-2 mt-2 space-y-2">
        <div className="font-medium text-xs text-muted-foreground">조정 항목 ({yearMonth})</div>
        {adjustments.length > 0 ? (
          <div className="space-y-1">
            {adjustments.map((adj) => (
              <div key={adj.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={adj.amount >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                    {adj.amount >= 0 ? "+" : ""}{formatBudget(adj.amount)}
                  </span>
                  <span className="text-muted-foreground">{adj.description}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => deleteMutation.mutate(adj.id)}
                  data-testid={`button-breakdown-delete-adj-${adj.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <div className="flex justify-between text-xs pt-1 font-medium">
              <span>조정 합계</span>
              <span className={totalAdjustments >= 0 ? "text-green-600" : "text-red-600"}>
                {totalAdjustments >= 0 ? "+" : ""}{formatBudget(totalAdjustments)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">조정 항목이 없습니다</span>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={() => copyFromPreviousMutation.mutate()}
              disabled={copyFromPreviousMutation.isPending}
              data-testid="button-copy-prev-adjustments"
            >
              <Copy className="h-3 w-3" />
              {copyFromPreviousMutation.isPending ? "복사 중..." : "이전 달에서 가져오기"}
            </Button>
          </div>
        )}
        <div className="flex gap-1.5 items-center">
          <Input
            type="number"
            placeholder="금액 (음수: 차감)"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            className="w-36 h-7 text-xs"
            data-testid="input-breakdown-adj-amount"
          />
          <Input
            placeholder="사유 (예: 특별수당)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="flex-1 h-7 text-xs"
            data-testid="input-breakdown-adj-description"
          />
          <Button
            size="icon"
            className="h-7 w-7"
            onClick={handleAdd}
            disabled={createMutation.isPending}
            data-testid="button-breakdown-add-adj"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">플러스: 추가 / 마이너스: 차감</p>
      </div>

      <div className="flex justify-between font-bold border-t pt-2 mt-2">
        <span>최종 급여</span>
        <span className="text-primary">{formatBudget(salaryCalc.totalSalary + totalAdjustments)}</span>
      </div>
    </div>
  );
}

function HourlySalaryBreakdownPanel({ teacherId, teacherName, hourlyRate, yearMonth, centerId }: { teacherId: string; teacherName: string; hourlyRate: number; yearMonth: string; centerId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showClassRateEditor, setShowClassRateEditor] = useState(false);
  const [classRateValues, setClassRateValues] = useState<Record<string, string>>({});

  type ScheduleDetail = {
    classId: string;
    className: string;
    day: string;
    startTime: string;
    endTime: string;
    hoursPerSession: number;
    occurrences: number;
    totalHours: number;
    classHourlyRate: number | null;
  };

  type AdjustmentType = {
    id: string;
    teacherId: string;
    centerId: string;
    yearMonth: string;
    amount: number;
    description: string;
    createdAt: string;
    createdBy: string | null;
  };

  const { data: scheduleData, isLoading } = useQuery<{ totalHours: number; details: ScheduleDetail[] }>({
    queryKey: ["/api/teacher-schedule-hours", centerId, yearMonth, teacherId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/teacher-schedule-hours?centerId=${centerId}&yearMonth=${yearMonth}&teacherId=${teacherId}`);
      const data = await res.json();
      return data[teacherId] || { totalHours: 0, details: [] };
    },
    enabled: !!teacherId && !!yearMonth && !!centerId,
  });

  const { data: adjustments = [] } = useQuery<AdjustmentType[]>({
    queryKey: [`/api/teacher-salary-adjustments?centerId=${centerId}&yearMonth=${yearMonth}&teacherId=${teacherId}`],
    enabled: !!teacherId && !!yearMonth && !!centerId,
  });

  const bulkRateMutation = useMutation({
    mutationFn: async (data: { classRates: { classId: string; hourlyRate: number | null }[]; actorId: string }) => {
      return apiRequest("PATCH", "/api/classes/bulk-hourly-rate", data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/teacher-schedule-hours");
      invalidateQueriesStartingWith("/api/classes");
      setShowClassRateEditor(false);
      toast({ title: "수업별 시급이 저장되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "저장에 실패했습니다", variant: "destructive" });
    },
  });

  const totalAdjustments = adjustments.reduce((sum, adj) => sum + adj.amount, 0);
  const hasClassSpecificRates = scheduleData?.details?.some(d => d.classHourlyRate != null) || false;
  const baseSalary = hasClassSpecificRates
    ? Math.round((scheduleData?.details || []).reduce((sum, d) => {
        const rate = d.classHourlyRate != null ? d.classHourlyRate : hourlyRate;
        return sum + rate * d.totalHours;
      }, 0))
    : Math.round(hourlyRate * (scheduleData?.totalHours || 0));

  const [newAmount, setNewAmount] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: { teacherId: string; centerId: string; yearMonth: string; amount: number; description: string }) => {
      return apiRequest("POST", `/api/teacher-salary-adjustments?actorId=${user?.id}`, data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/teacher-salary-adjustments");
      setNewAmount("");
      setNewDescription("");
      toast({ title: "조정 항목이 추가되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "추가에 실패했습니다", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/teacher-salary-adjustments/${id}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/teacher-salary-adjustments");
      toast({ title: "조정 항목이 삭제되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const copyFromPreviousMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/teacher-salary-adjustments/copy-from-previous?actorId=${user?.id}`, {
        teacherId,
        centerId,
        yearMonth,
      });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      invalidateQueriesStartingWith("/api/teacher-salary-adjustments");
      toast({ title: data.message || "이전 달 조정 항목이 복사되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "복사에 실패했습니다", variant: "destructive" });
    },
  });

  const handleAdd = () => {
    if (!newAmount || !newDescription) {
      toast({ title: "금액과 내용을 입력해주세요", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      teacherId,
      centerId,
      yearMonth,
      amount: parseInt(newAmount),
      description: newDescription,
    });
  };

  const dayLabels: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };

  if (isLoading) {
    return <div className="p-3 text-sm text-muted-foreground">불러오는 중...</div>;
  }

  const handleOpenClassRateEditor = () => {
    const initialValues: Record<string, string> = {};
    const uniqueClasses = new Map<string, { classId: string; className: string; classHourlyRate: number | null }>();
    for (const d of scheduleData?.details || []) {
      if (d.classId && !uniqueClasses.has(d.classId)) {
        uniqueClasses.set(d.classId, { classId: d.classId, className: d.className, classHourlyRate: d.classHourlyRate });
        initialValues[d.classId] = d.classHourlyRate != null ? String(d.classHourlyRate) : "";
      }
    }
    setClassRateValues(initialValues);
    setShowClassRateEditor(true);
  };

  const handleSaveClassRates = () => {
    const classRates = Object.entries(classRateValues).map(([classId, val]) => ({
      classId,
      hourlyRate: val !== "" && val != null ? parseInt(val) : null,
    }));
    bulkRateMutation.mutate({ classRates, actorId: user?.id || "" });
  };

  const handleApplyAllRate = (rate: string) => {
    const newVals: Record<string, string> = {};
    for (const key of Object.keys(classRateValues)) {
      newVals[key] = rate;
    }
    setClassRateValues(newVals);
  };

  return (
    <div className="p-3 bg-muted/50 border-t text-sm space-y-2">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium text-xs text-muted-foreground">시급 급여 산정 내역 ({yearMonth})</div>
      </div>

      {false && showClassRateEditor && (
        <div className="border rounded-md p-3 bg-background space-y-3 mb-2">
          <div className="font-medium text-xs">수업별 시급 설정</div>
          <p className="text-[10px] text-muted-foreground">비워두면 기본 시급({formatBudget(hourlyRate)})이 적용됩니다</p>
          <div className="flex items-center gap-2 mb-2">
            <Input
              type="number"
              placeholder="일괄 시급 입력"
              className="h-7 text-xs w-32"
              id="bulk-rate-input"
              data-testid="input-bulk-class-rate"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                const el = document.getElementById("bulk-rate-input") as HTMLInputElement;
                if (el?.value) handleApplyAllRate(el.value);
              }}
              data-testid="button-apply-bulk-rate"
            >
              일괄적용
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => handleApplyAllRate("")}
              data-testid="button-reset-class-rates"
            >
              초기화
            </Button>
          </div>
          <div className="space-y-2">
            {(() => {
              const uniqueClasses = new Map<string, { classId: string; className: string }>();
              for (const d of scheduleData?.details || []) {
                if (!uniqueClasses.has(d.classId)) {
                  uniqueClasses.set(d.classId, { classId: d.classId, className: d.className });
                }
              }
              return Array.from(uniqueClasses.values()).map((cls) => (
                <div key={cls.classId} className="flex items-center justify-between gap-2">
                  <span className="text-xs flex-1 min-w-0 truncate">{cls.className}</span>
                  <Input
                    type="number"
                    placeholder={String(hourlyRate)}
                    value={classRateValues[cls.classId] || ""}
                    onChange={(e) => setClassRateValues(prev => ({ ...prev, [cls.classId]: e.target.value }))}
                    className="h-7 text-xs w-28"
                    data-testid={`input-class-rate-${cls.classId}`}
                  />
                </div>
              ));
            })()}
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowClassRateEditor(false)}
              data-testid="button-cancel-class-rates"
            >
              취소
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleSaveClassRates}
              disabled={bulkRateMutation.isPending}
              data-testid="button-save-class-rates"
            >
              {bulkRateMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <span>기본 시급</span>
        <span>{formatBudget(hourlyRate)}</span>
      </div>
      <div className="flex justify-between">
        <span>총 수업시간</span>
        <span>{scheduleData?.totalHours || 0}시간</span>
      </div>

      {scheduleData?.details && scheduleData.details.length > 0 && (
        <div className="mt-2 pt-2 border-t space-y-1">
          <div className="font-medium text-xs text-muted-foreground">수업별 시간 내역</div>
          {scheduleData.details.map((detail, i) => {
            const effectiveRate = detail.classHourlyRate != null ? detail.classHourlyRate : hourlyRate;
            const salary = Math.round(effectiveRate * detail.totalHours);
            return (
              <div key={i} className="flex justify-between text-xs">
                <span className="flex items-center gap-1">
                  {detail.className}
                  {detail.isAssistant && <span className="text-orange-500 text-[10px]">(부담임)</span>}
                  <span className="text-muted-foreground">
                    ({dayLabels[detail.day] || detail.day} {detail.startTime}~{detail.endTime}, {detail.occurrences}회)
                  </span>
                  {detail.classHourlyRate && (
                    <span className="text-blue-500 text-[10px]">@{formatBudget(detail.classHourlyRate)}</span>
                  )}
                </span>
                <span>{detail.totalHours}시간 = {formatBudget(salary)}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-between font-medium border-t pt-2 mt-2">
        <span>자동계산 급여</span>
        <span>{formatBudget(baseSalary)}</span>
      </div>

      <div className="border-t pt-2 mt-2 space-y-2">
        <div className="font-medium text-xs text-muted-foreground">조정 항목 ({yearMonth})</div>
        {adjustments.length > 0 ? (
          <div className="space-y-1">
            {adjustments.map((adj) => (
              <div key={adj.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={adj.amount >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                    {adj.amount >= 0 ? "+" : ""}{formatBudget(adj.amount)}
                  </span>
                  <span className="text-muted-foreground">{adj.description}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => deleteMutation.mutate(adj.id)}
                  data-testid={`button-hourly-delete-adj-${adj.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <div className="flex justify-between text-xs pt-1 font-medium">
              <span>조정 합계</span>
              <span className={totalAdjustments >= 0 ? "text-green-600" : "text-red-600"}>
                {totalAdjustments >= 0 ? "+" : ""}{formatBudget(totalAdjustments)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">조정 항목이 없습니다</span>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={() => copyFromPreviousMutation.mutate()}
              disabled={copyFromPreviousMutation.isPending}
              data-testid="button-hourly-copy-prev-adjustments"
            >
              <Copy className="h-3 w-3" />
              {copyFromPreviousMutation.isPending ? "복사 중..." : "이전 달에서 가져오기"}
            </Button>
          </div>
        )}
        <div className="flex gap-1.5 items-center">
          <Input
            type="number"
            placeholder="금액 (음수: 차감)"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            className="w-36 h-7 text-xs"
            data-testid="input-hourly-adj-amount"
          />
          <Input
            placeholder="사유 (예: 특별수당)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="flex-1 h-7 text-xs"
            data-testid="input-hourly-adj-description"
          />
          <Button
            size="icon"
            className="h-7 w-7"
            onClick={handleAdd}
            disabled={createMutation.isPending}
            data-testid="button-hourly-add-adj"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">플러스: 추가 / 마이너스: 차감</p>
      </div>

      <div className="flex justify-between font-bold border-t pt-2 mt-2">
        <span>최종 급여</span>
        <span className="text-primary">{formatBudget(baseSalary + totalAdjustments)}</span>
      </div>
    </div>
  );
}

export default function ManagementPageWrapper() {
  return (
    <ManagementErrorBoundary>
      <ManagementPageInner />
    </ManagementErrorBoundary>
  );
}

function ManagementPageInner() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [months] = useState(12);
  const [mainTab, setMainTab] = useState("students");
  const [studentSubTab, setStudentSubTab] = useState("trend");
  
  const today = new Date();
  const [workStartDate, setWorkStartDate] = useState(() => format(startOfMonth(today), "yyyy-MM-dd"));
  const [workEndDate, setWorkEndDate] = useState(() => format(today, "yyyy-MM-dd"));
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [selectedSchoolForGrade, setSelectedSchoolForGrade] = useState<string>("all");

  const isAdmin = user?.role === UserRole.ADMIN;
  const isPrincipal = user?.role === UserRole.PRINCIPAL;
  const isAuthorized = isAdmin || isPrincipal;

  const { data: metricsData, isLoading, refetch } = useQuery<{ monthlyData: MonthlyData[] }>({
    queryKey: [`/api/management/metrics?centerId=${selectedCenter?.id}&months=${months}`],
    enabled: !!selectedCenter?.id,
  });

  const { data: studentTrends, isLoading: loadingTrends } = useQuery<StudentTrendsData>({
    queryKey: [`/api/dashboard/student-trends?centerId=${selectedCenter?.id}&actorId=${user?.id}`],
    enabled: !!user?.id && !!selectedCenter?.id,
  });

  const { data: teacherExitData = [], isLoading: loadingTeacherExit } = useQuery<TeacherExitData[]>({
    queryKey: [`/api/management/exit-records-by-teacher?centerId=${selectedCenter?.id}&months=${months}`],
    enabled: !!selectedCenter?.id && mainTab === "students",
  });

  const { data: centerAllUsers = [], isLoading: loadingStudents } = useQuery<User[]>({
    queryKey: [`/api/users?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id && mainTab === "students" && studentSubTab === "trend",
  });
  const centerStudents = centerAllUsers.filter(u => u.role === UserRole.STUDENT);

  const updateCountMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/management/update-student-count", {
        centerId: selectedCenter?.id,
      });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/management");
      toast({ title: "학생 수가 업데이트되었습니다" });
    },
    onError: () => {
      toast({ title: "업데이트에 실패했습니다", variant: "destructive" });
    },
  });

  const { data: teacherWorkRecords = [], isLoading: loadingWorkRecords } = useQuery<TeacherWorkRecord[]>({
    queryKey: [`/api/teacher-work-records?centerId=${selectedCenter?.id}&startDate=${workStartDate}&endDate=${workEndDate}`],
    enabled: !!selectedCenter?.id && !!workStartDate && !!workEndDate && mainTab === "teachers",
  });

  // Extract unique teachers from work records for filtering
  const uniqueTeachers = teacherWorkRecords.reduce((acc, record) => {
    if (record.teacherId && record.teacherName && !acc.find(t => t.id === record.teacherId)) {
      acc.push({ id: record.teacherId, name: record.teacherName });
    }
    return acc;
  }, [] as { id: string; name: string }[]).sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  // Filter work records by selected teacher
  const filteredWorkRecords = selectedTeacherId === "all" 
    ? teacherWorkRecords 
    : teacherWorkRecords.filter(r => r.teacherId === selectedTeacherId);

  const workYearMonth = workStartDate ? workStartDate.substring(0, 7) : "";

  type AbsentDetail = { date: string; hours: number; classes: string[] };
  type AbsentDaysResponse = { absentDays: AbsentDetail[]; scheduledDayCount: number; workedDayCount: number };

  const [showAbsentDeductDialog, setShowAbsentDeductDialog] = useState(false);
  const [selectedAbsentDays, setSelectedAbsentDays] = useState<AbsentDetail[]>([]);
  const [existingAbsentDeduction, setExistingAbsentDeduction] = useState<SalaryAdjustmentType | null>(null);

  const absentDeductMutation = useMutation({
    mutationFn: async (data: { teacherId: string; centerId: string; yearMonth: string; amount: number; description: string }) => {
      return apiRequest("POST", `/api/teacher-salary-adjustments?actorId=${user?.id}`, data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/teacher-salary-adjustments");
      setShowAbsentDeductDialog(false);
      setSelectedAbsentDays([]);
      toast({ title: "결근 차감이 급여 조정에 반영되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "차감 처리에 실패했습니다", variant: "destructive" });
    },
  });

  // Marketing state
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<MarketingCampaign | null>(null);
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    channel: "",
    startDate: "",
    endDate: "",
    budget: 0,
    notes: "",
  });

  const { data: marketingComparison, isLoading: loadingMarketing } = useQuery<MarketingComparisonData>({
    queryKey: ["/api/marketing-campaigns/comparison", selectedCenter?.id],
    enabled: !!selectedCenter?.id && mainTab === "marketing",
  });

  const invalidateMarketingQueries = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (Array.isArray(key) && key[0] === "/api/marketing-campaigns/comparison") return true;
        if (typeof key[0] === "string" && key[0].startsWith("/api/marketing-campaigns")) return true;
        if (Array.isArray(key) && key[0] === "/api/monthly-financial-records") return true;
        if (typeof key[0] === "string" && key[0].startsWith("/api/monthly-financial-records")) return true;
        return false;
      },
    });
  };

  const createCampaignMutation = useMutation({
    mutationFn: async (data: typeof campaignForm) => {
      return apiRequest("POST", "/api/marketing-campaigns", {
        ...data,
        centerId: selectedCenter?.id,
        createdBy: user?.id,
      });
    },
    onSuccess: () => {
      invalidateMarketingQueries();
      setShowCampaignDialog(false);
      resetCampaignForm();
      toast({ title: "캠페인이 등록되었습니다" });
    },
    onError: () => {
      toast({ title: "등록에 실패했습니다", variant: "destructive" });
    },
  });

  const updateCampaignMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof campaignForm }) => {
      return apiRequest("PATCH", `/api/marketing-campaigns/${id}`, data);
    },
    onSuccess: () => {
      invalidateMarketingQueries();
      setShowCampaignDialog(false);
      setEditingCampaign(null);
      resetCampaignForm();
      toast({ title: "캠페인이 수정되었습니다" });
    },
    onError: () => {
      toast({ title: "수정에 실패했습니다", variant: "destructive" });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/marketing-campaigns/${id}`);
    },
    onSuccess: () => {
      invalidateMarketingQueries();
      toast({ title: "캠페인이 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const resetCampaignForm = () => {
    setCampaignForm({
      name: "",
      channel: "",
      startDate: "",
      endDate: "",
      budget: 0,
      notes: "",
    });
  };

  const openEditCampaign = (campaign: MarketingCampaign) => {
    setEditingCampaign(campaign);
    setCampaignForm({
      name: campaign.name,
      channel: campaign.channel,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      budget: campaign.budget,
      notes: campaign.notes || "",
    });
    setShowCampaignDialog(true);
  };

  const handleSaveCampaign = () => {
    if (!campaignForm.name || !campaignForm.channel || !campaignForm.startDate || !campaignForm.endDate) {
      toast({ title: "필수 항목을 입력해주세요", variant: "destructive" });
      return;
    }
    if (campaignForm.budget <= 0) {
      toast({ title: "예산은 0보다 커야 합니다", variant: "destructive" });
      return;
    }
    if (new Date(campaignForm.endDate) < new Date(campaignForm.startDate)) {
      toast({ title: "종료일은 시작일 이후여야 합니다", variant: "destructive" });
      return;
    }
    if (editingCampaign) {
      updateCampaignMutation.mutate({ id: editingCampaign.id, data: campaignForm });
    } else {
      createCampaignMutation.mutate(campaignForm);
    }
  };

  const getChannelLabel = (key: string) => {
    return (MarketingChannels as Record<string, string>)[key] || key;
  };

  // Finance state
  const currentYear = new Date().getFullYear();
  const currentMonthNum = new Date().getMonth() + 1;
  const [financeYear, setFinanceYear] = useState(currentYear);
  const [selectedFinanceMonth, setSelectedFinanceMonth] = useState(
    `${currentYear}-${String(currentMonthNum).padStart(2, "0")}`
  );
  const [showFinanceDialog, setShowFinanceDialog] = useState(false);
  const [editingFinance, setEditingFinance] = useState<MonthlyFinancialRecord | null>(null);
  const [financeDialogTab, setFinanceDialogTab] = useState<"revenue" | "expense">("revenue");

  // Finance types - separated revenue and expense
  type RevenueItem = { name: string; amount: number; studentId?: string; school?: string; grade?: string; classes?: { id: string; name: string; subject: string }[] };
  type ExpenseItem = { name: string; amount: number; category: string; teacherId?: string };

  // State for expanded salary detail in finance dialog
  const [expandedSalaryTeacherId, setExpandedSalaryTeacherId] = useState<string | null>(null);
  
  // State for expanded salary breakdown in teacher settings
  const [expandedSalaryBreakdownTeacherId, setExpandedSalaryBreakdownTeacherId] = useState<string | null>(null);
  const currentYearMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [salaryBreakdownYearMonth, setSalaryBreakdownYearMonth] = useState<string>(currentYearMonth);

  // Expense category options
  const expenseCategories = [
    // 인건비 그룹
    { key: "expenseRegularSalary", label: "정규선생님 급여", group: "인건비" },
    { key: "expensePartTimeSalary", label: "파트선생님 급여", group: "인건비" },
    { key: "expenseHourlySalary", label: "아르바이트 급여", group: "인건비" },
    { key: "expenseEmployeeInsurance", label: "4대보험", group: "인건비" },
    // 고정비 그룹 - 매달 유지되는 금액
    { key: "expenseRent", label: "임대료 및 관리비", group: "고정비" },
    { key: "expenseUtilities", label: "수도광열비", group: "고정비" },
    { key: "expenseCommunication", label: "통신비", group: "고정비" },
    { key: "expenseInsurance", label: "보험료", group: "고정비" },
    { key: "expenseDepreciation", label: "감가상각비", group: "고정비" },
    // 판관비 그룹
    { key: "expenseWelfare", label: "복리후생비", group: "판관비" },
    { key: "expenseSupplies", label: "소모품비", group: "판관비" },
    { key: "expenseAdvertising", label: "광고선전비", group: "판관비" },
    { key: "expenseFees", label: "지급수수료", group: "판관비" },
    { key: "expenseVehicle", label: "차량유지비", group: "판관비" },
    { key: "expenseEducation", label: "교육운영비", group: "판관비" },
    { key: "expenseOther", label: "기타판관비", group: "판관비" },
  ];

  const getCategoryLabel = (key: string) => expenseCategories.find(c => c.key === key)?.label || key;

  const [revenueItems, setRevenueItems] = useState<RevenueItem[]>([]);
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);

  // Calculate totals
  const calculateRevenueTotal = () => revenueItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const calculateExpenseTotal = () => expenseItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const calculateExpenseByCategory = (category: string) => 
    expenseItems.filter(item => item.category === category).reduce((sum, item) => sum + (item.amount || 0), 0);

  // Build form data from items
  const buildFinanceFormFromItems = () => {
    const formData: Record<string, any> = {};
    
    // Revenue
    formData.revenueTuition = calculateRevenueTotal();
    formData.revenueTuitionDetails = JSON.stringify(revenueItems);
    
    // Expenses by category
    expenseCategories.forEach(({ key }) => {
      const categoryItems = expenseItems.filter(item => item.category === key);
      formData[key] = categoryItems.reduce((sum, item) => sum + (item.amount || 0), 0);
      formData[`${key}Details`] = JSON.stringify(categoryItems.map(item => ({ name: item.name, amount: item.amount, teacherId: item.teacherId })));
    });
    
    return formData;
  };

  // Parse items from record
  const parseItemsFromRecord = (record: MonthlyFinancialRecord) => {
    // Parse revenue
    const revenueJson = record.revenueTuitionDetails as string | null;
    let parsedRevenue: RevenueItem[] = [];
    if (revenueJson) {
      try { parsedRevenue = JSON.parse(revenueJson); } catch { parsedRevenue = []; }
    }
    if (parsedRevenue.length === 0 && record.revenueTuition > 0) {
      parsedRevenue = [{ name: "수강료", amount: record.revenueTuition }];
    }
    
    // Parse expenses
    const parsedExpenses: ExpenseItem[] = [];
    expenseCategories.forEach(({ key }) => {
      const detailsKey = `${key}Details` as keyof MonthlyFinancialRecord;
      const detailsJson = record[detailsKey] as string | null;
      if (detailsJson) {
        try {
          const items = JSON.parse(detailsJson);
          items.forEach((item: { name: string; amount: number; teacherId?: string }) => {
            parsedExpenses.push({ ...item, category: key });
          });
        } catch {}
      } else {
        const total = record[key as keyof MonthlyFinancialRecord] as number;
        if (total > 0) {
          parsedExpenses.push({ name: getCategoryLabel(key), amount: total, category: key });
        }
      }
    });
    
    return { revenue: parsedRevenue, expenses: parsedExpenses };
  };

  // Revenue item handlers
  const addRevenueItem = () => setRevenueItems(prev => [...prev, { name: "", amount: 0 }]);
  const updateRevenueItem = (index: number, field: keyof RevenueItem, value: string | number) => {
    setRevenueItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: field === "amount" ? Number(value) || 0 : value } : item
    ));
  };
  const removeRevenueItem = (index: number) => setRevenueItems(prev => prev.filter((_, i) => i !== index));

  // Expense item handlers
  const addExpenseItem = () => setExpenseItems(prev => [...prev, { name: "", amount: 0, category: "expenseOther" }]);
  const updateExpenseItem = (index: number, field: keyof ExpenseItem, value: string | number) => {
    setExpenseItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: field === "amount" ? Number(value) || 0 : value } : item
    ));
  };
  const removeExpenseItem = (index: number) => setExpenseItems(prev => prev.filter((_, i) => i !== index));

  const { data: financeRecords = [], isLoading: loadingFinance } = useQuery<MonthlyFinancialRecord[]>({
    queryKey: [`/api/monthly-financials?centerId=${selectedCenter?.id}&year=${financeYear}`],
    enabled: !!selectedCenter?.id && mainTab === "finance",
  });

  // 재무 탭에 표시할 마케팅 캠페인 (선택된 연도 기준)
  const { data: financeMarketingCampaigns = [] } = useQuery<MarketingCampaign[]>({
    queryKey: [`/api/marketing-campaigns?centerId=${selectedCenter?.id}&year=${financeYear}`],
    enabled: !!selectedCenter?.id && mainTab === "finance",
  });

  // 캠페인 startDate의 YYYY-MM을 키로 하여 월별 마케팅 비용 합계를 계산
  const marketingByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of financeMarketingCampaigns) {
      if (!c.startDate) continue;
      const ym = String(c.startDate).slice(0, 7); // YYYY-MM
      map.set(ym, (map.get(ym) || 0) + (c.budget || 0));
    }
    return map;
  }, [financeMarketingCampaigns]);

  // Get all salary settings for the center (must be before teacherList useMemo)
  type TeacherSalarySettingsType = {
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

  const { data: allSalarySettings = [] } = useQuery<TeacherSalarySettingsType[]>({
    queryKey: [`/api/teacher-salary-settings?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id && (mainTab === "teachers" || mainTab === "finance"),
  });

  // Teacher list for salary expenses
  type TeacherWithEmploymentType = { id: string; name: string; employmentType: string | null; dailyRate: number | null; hourlyRate: number | null; wageType: string | null; fixedWorkStart: string | null; fixedWorkEnd: string | null; fixedWorkDays: string[] | null };
  const { data: teacherListRaw = [], isLoading: loadingTeachers } = useQuery<any[]>({
    queryKey: [`/api/users?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id && showFinanceDialog,
    select: (data: any[]) => data.filter(u => u.role === 2 || u.role === 3),
  });
  
  const teacherList: TeacherWithEmploymentType[] = useMemo(() => {
    return teacherListRaw.map(u => {
      const centerSettings = allSalarySettings.find(s => s.teacherId === u.id);
      return {
        id: u.id,
        name: u.name,
        employmentType: (centerSettings as any)?.employmentType || u.employmentType || "regular",
        dailyRate: u.dailyRate || null,
        hourlyRate: (centerSettings as any)?.hourlyRate ?? u.hourlyRate ?? null,
        wageType: (centerSettings as any)?.wageType || u.wageType || "hourly",
        fixedWorkStart: u.fixedWorkStart || null,
        fixedWorkEnd: u.fixedWorkEnd || null,
        fixedWorkDays: u.fixedWorkDays || null,
      };
    });
  }, [teacherListRaw, allSalarySettings]);
  
  // Get work days count for hourly teachers in the selected month
  const financeDialogYearMonth = editingFinance?.yearMonth || selectedFinanceMonth;
  const { data: workDaysData = {} } = useQuery<Record<string, number>>({
    queryKey: [`/api/teacher-work-days?centerId=${selectedCenter?.id}&yearMonth=${financeDialogYearMonth}`],
    enabled: !!selectedCenter?.id && showFinanceDialog && !!financeDialogYearMonth,
  });

  const { data: scheduleHoursData = {} } = useQuery<Record<string, { totalHours: number; details: any[] }>>({
    queryKey: ["/api/teacher-schedule-hours", selectedCenter?.id, financeDialogYearMonth],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/teacher-schedule-hours?centerId=${selectedCenter?.id}&yearMonth=${financeDialogYearMonth}`);
      return res.json();
    },
    enabled: !!selectedCenter?.id && showFinanceDialog && !!financeDialogYearMonth,
  });
  
  // State for controlled teacher salary select
  const [selectedSalaryTeacher, setSelectedSalaryTeacher] = useState<string>("");

  // Salary settings state
  const [showSalarySettingsDialog, setShowSalarySettingsDialog] = useState(false);
  const [selectedTeacherForSalary, setSelectedTeacherForSalary] = useState<string>("");
  const [salarySettingsForm, setSalarySettingsForm] = useState({
    baseSalary: 0,
    classBasePay: 0,
    classBasePayElementary: 0,
    classBasePayMiddle: 0,
    classBasePayHigh: 0,
    classBasePayAdult: 0,
    studentThreshold: 0,
    studentThresholdElementary: 0,
    studentThresholdMiddle: 0,
    studentThresholdHigh: 0,
    studentThresholdAdult: 0,
    perStudentBonus: 0,
    perStudentBonusElementary: 0,
    perStudentBonusMiddle: 0,
    perStudentBonusHigh: 0,
    perStudentBonusAdult: 0,
  });

  // Get salary calculation for selected teacher
  type SalaryCalculationType = {
    baseSalary: number;
    performanceBonus: number;
    totalSalary: number;
    breakdown: {
      classes: Array<{
        classId: string;
        className: string;
        studentCount: number;
        basePay: number;
        extraStudents: number;
        extraPay: number;
        totalPay: number;
      }>;
      classCount: number;
      totalStudents: number;
      bonusStudents: number;
    };
  };

  const { data: salaryCalculation } = useQuery<SalaryCalculationType>({
    queryKey: ["/api/teacher-salary-calculation", selectedTeacherForSalary, selectedFinanceMonth, selectedCenter?.id],
    enabled: !!selectedTeacherForSalary && !!selectedCenter?.id && showSalarySettingsDialog,
  });

  // Salary adjustments (급여 조정 항목)
  type SalaryAdjustmentType = {
    id: string;
    teacherId: string;
    centerId: string;
    yearMonth: string;
    amount: number;
    description: string;
    createdAt: string;
    createdBy: string | null;
  };

  const { data: salaryAdjustments = [] } = useQuery<SalaryAdjustmentType[]>({
    queryKey: [`/api/teacher-salary-adjustments?centerId=${selectedCenter?.id}&yearMonth=${selectedFinanceMonth}&teacherId=${selectedTeacherForSalary}`],
    enabled: !!selectedTeacherForSalary && !!selectedCenter?.id && showSalarySettingsDialog,
  });

  const [newAdjustmentAmount, setNewAdjustmentAmount] = useState("");
  const [newAdjustmentDescription, setNewAdjustmentDescription] = useState("");

  const createAdjustmentMutation = useMutation({
    mutationFn: async (data: { teacherId: string; centerId: string; yearMonth: string; amount: number; description: string }) => {
      return apiRequest("POST", `/api/teacher-salary-adjustments?actorId=${user?.id}`, data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/teacher-salary-adjustments");
      setNewAdjustmentAmount("");
      setNewAdjustmentDescription("");
      toast({ title: "급여 조정 항목이 추가되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "추가에 실패했습니다", variant: "destructive" });
    },
  });

  const deleteAdjustmentMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/teacher-salary-adjustments/${id}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/teacher-salary-adjustments");
      toast({ title: "급여 조정 항목이 삭제되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const handleAddAdjustment = () => {
    if (!selectedTeacherForSalary || !selectedCenter?.id || !newAdjustmentAmount || !newAdjustmentDescription) {
      toast({ title: "금액과 내용을 입력해주세요", variant: "destructive" });
      return;
    }
    createAdjustmentMutation.mutate({
      teacherId: selectedTeacherForSalary,
      centerId: selectedCenter.id,
      yearMonth: selectedFinanceMonth,
      amount: parseInt(newAdjustmentAmount),
      description: newAdjustmentDescription,
    });
  };

  // Calculate total adjustments
  const totalAdjustments = salaryAdjustments.reduce((sum, adj) => sum + adj.amount, 0);

  const saveSalarySettingsMutation = useMutation({
    mutationFn: async (data: { teacherId: string; centerId: string; baseSalary: number; classBasePay: number; classBasePayElementary: number; classBasePayMiddle: number; classBasePayHigh: number; studentThreshold: number; studentThresholdElementary: number; studentThresholdMiddle: number; studentThresholdHigh: number; perStudentBonus: number; perStudentBonusElementary: number; perStudentBonusMiddle: number; perStudentBonusHigh: number }) => {
      return apiRequest("POST", "/api/teacher-salary-settings", { ...data, actorId: user?.id });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/teacher-salary-settings");
      invalidateQueriesStartingWith("/api/teacher-salary-calculation");
      toast({ title: "급여 설정이 저장되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "저장에 실패했습니다", variant: "destructive" });
    },
  });

  const openSalarySettings = (teacherId: string) => {
    setSelectedTeacherForSalary(teacherId);
    const existing = allSalarySettings.find(s => s.teacherId === teacherId);
    if (existing) {
      setSalarySettingsForm({
        baseSalary: existing.baseSalary,
        classBasePay: existing.classBasePay,
        classBasePayElementary: existing.classBasePayElementary ?? 0,
        classBasePayMiddle: existing.classBasePayMiddle ?? existing.classBasePay ?? 0,
        classBasePayHigh: existing.classBasePayHigh ?? existing.classBasePay ?? 0,
        classBasePayAdult: existing.classBasePayAdult ?? 0,
        studentThreshold: existing.studentThreshold,
        studentThresholdElementary: existing.studentThresholdElementary ?? 0,
        studentThresholdMiddle: existing.studentThresholdMiddle ?? existing.studentThreshold ?? 0,
        studentThresholdHigh: existing.studentThresholdHigh ?? existing.studentThreshold ?? 0,
        studentThresholdAdult: existing.studentThresholdAdult ?? 0,
        perStudentBonus: existing.perStudentBonus,
        perStudentBonusElementary: existing.perStudentBonusElementary ?? 0,
        perStudentBonusMiddle: existing.perStudentBonusMiddle ?? existing.perStudentBonus ?? 0,
        perStudentBonusHigh: existing.perStudentBonusHigh ?? existing.perStudentBonus ?? 0,
        perStudentBonusAdult: existing.perStudentBonusAdult ?? 0,
      });
    } else {
      setSalarySettingsForm({ baseSalary: 0, classBasePay: 0, classBasePayElementary: 0, classBasePayMiddle: 0, classBasePayHigh: 0, classBasePayAdult: 0, studentThreshold: 0, studentThresholdElementary: 0, studentThresholdMiddle: 0, studentThresholdHigh: 0, studentThresholdAdult: 0, perStudentBonus: 0, perStudentBonusElementary: 0, perStudentBonusMiddle: 0, perStudentBonusHigh: 0, perStudentBonusAdult: 0 });
    }
    setShowSalarySettingsDialog(true);
  };

  const handleSaveSalarySettings = () => {
    if (!selectedTeacherForSalary || !selectedCenter?.id) return;
    saveSalarySettingsMutation.mutate({
      teacherId: selectedTeacherForSalary,
      centerId: selectedCenter.id,
      ...salarySettingsForm,
    });
  };

  // Hourly teacher daily rate update mutation
  const updateWageSettingsMutation = useMutation({
    mutationFn: async ({ teacherId, ...data }: { teacherId: string; dailyRate?: number; hourlyRate?: number; wageType?: string; employmentType?: string; fixedWorkStart?: string; fixedWorkEnd?: string; fixedWorkDays?: string[]; classRates?: any[]; classRateMode?: string }) => {
      const { classRates, classRateMode, ...wageData } = data;
      const salaryPayload: any = {
        teacherId,
        centerId: selectedCenter?.id,
        actorId: user?.id,
        ...wageData,
      };
      const existingSettings = allSalarySettings.find(s => s.teacherId === teacherId);
      if (existingSettings) {
        salaryPayload.baseSalary = existingSettings.baseSalary;
        salaryPayload.classBasePay = existingSettings.classBasePay;
        salaryPayload.classBasePayElementary = existingSettings.classBasePayElementary;
        salaryPayload.classBasePayMiddle = existingSettings.classBasePayMiddle;
        salaryPayload.classBasePayHigh = existingSettings.classBasePayHigh;
        salaryPayload.classBasePayAdult = existingSettings.classBasePayAdult;
        salaryPayload.studentThreshold = existingSettings.studentThreshold;
        salaryPayload.studentThresholdElementary = existingSettings.studentThresholdElementary;
        salaryPayload.studentThresholdMiddle = existingSettings.studentThresholdMiddle;
        salaryPayload.studentThresholdHigh = existingSettings.studentThresholdHigh;
        salaryPayload.studentThresholdAdult = existingSettings.studentThresholdAdult;
        salaryPayload.perStudentBonus = existingSettings.perStudentBonus;
        salaryPayload.perStudentBonusElementary = existingSettings.perStudentBonusElementary;
        salaryPayload.perStudentBonusMiddle = existingSettings.perStudentBonusMiddle;
        salaryPayload.perStudentBonusHigh = existingSettings.perStudentBonusHigh;
        salaryPayload.perStudentBonusAdult = existingSettings.perStudentBonusAdult;
      } else {
        salaryPayload.baseSalary = 0;
        salaryPayload.classBasePay = 0;
        salaryPayload.classBasePayElementary = 0;
        salaryPayload.classBasePayMiddle = 0;
        salaryPayload.classBasePayHigh = 0;
        salaryPayload.classBasePayAdult = 0;
        salaryPayload.studentThreshold = 0;
        salaryPayload.studentThresholdElementary = 0;
        salaryPayload.studentThresholdMiddle = 0;
        salaryPayload.studentThresholdHigh = 0;
        salaryPayload.studentThresholdAdult = 0;
        salaryPayload.perStudentBonus = 0;
        salaryPayload.perStudentBonusElementary = 0;
        salaryPayload.perStudentBonusMiddle = 0;
        salaryPayload.perStudentBonusHigh = 0;
        salaryPayload.perStudentBonusAdult = 0;
      }
      await apiRequest("POST", "/api/teacher-salary-settings", salaryPayload);
      if (classRates && classRates.length > 0) {
        await apiRequest("PATCH", `/api/users/${teacherId}`, { classRates, classRateMode, actorId: user?.id });
      }
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/users");
      invalidateQueriesStartingWith("/api/teacher-salary-settings");
      invalidateQueriesStartingWith("/api/teacher-schedule-hours");
      invalidateQueriesStartingWith("/api/teacher-salary-calculation");
      invalidateQueriesStartingWith("/api/classes");
      toast({ title: "급여 설정이 저장되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "저장에 실패했습니다", variant: "destructive" });
    },
  });

  const [editingWageTeacherId, setEditingWageTeacherId] = useState<string | null>(null);
  const [editingWageType, setEditingWageType] = useState<string>("hourly");
  const [editingDailyRateValue, setEditingDailyRateValue] = useState<number>(0);
  const [editingHourlyRateValue, setEditingHourlyRateValue] = useState<number>(0);
  const [editingFixedWorkStart, setEditingFixedWorkStart] = useState<string>("14:00");
  const [editingFixedWorkEnd, setEditingFixedWorkEnd] = useState<string>("22:00");
  const [editingFixedWorkDays, setEditingFixedWorkDays] = useState<string[]>([]);
  const [editingClassRateMode, setEditingClassRateMode] = useState<"bulk" | "individual">("bulk");
  const [editingClassRates, setEditingClassRates] = useState<Record<string, string>>({});

  const { data: allCenterClasses = [] } = useQuery<any[]>({
    queryKey: [`/api/classes?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id && mainTab === "teachers",
  });

  const { data: teacherScheduleHours = {} } = useQuery<Record<string, { totalHours: number; details: any[] }>>({
    queryKey: ["/api/teacher-schedule-hours", selectedCenter?.id, salaryBreakdownYearMonth || currentYearMonth],
    queryFn: async () => {
      const ym = salaryBreakdownYearMonth || currentYearMonth;
      const res = await apiRequest("GET", `/api/teacher-schedule-hours?centerId=${selectedCenter?.id}&yearMonth=${ym}`);
      return res.json();
    },
    enabled: !!selectedCenter?.id && mainTab === "teachers",
  });

  // Get teacher/principal list for salary settings
  const { data: allTeachersForSalaryRaw = [] } = useQuery<any[]>({
    queryKey: [`/api/users?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id && mainTab === "teachers",
    select: (data: any[]) => data.filter(u => u.role === 2 || u.role === 3),
  });
  
  const allTeachersForSalary: TeacherWithEmploymentType[] = useMemo(() => {
    return allTeachersForSalaryRaw.map(u => {
      const centerSettings = allSalarySettings.find(s => s.teacherId === u.id);
      return {
        id: u.id,
        name: u.name,
        employmentType: centerSettings?.employmentType || u.employmentType || "regular",
        dailyRate: u.dailyRate || null,
        hourlyRate: centerSettings?.hourlyRate ?? u.hourlyRate ?? null,
        wageType: centerSettings?.wageType || u.wageType || "hourly",
        fixedWorkStart: u.fixedWorkStart || null,
        fixedWorkEnd: u.fixedWorkEnd || null,
        fixedWorkDays: u.fixedWorkDays || null,
      };
    });
  }, [allTeachersForSalaryRaw, allSalarySettings]);

  const selectedTeacherInfo = allTeachersForSalary.find(t => t.id === selectedTeacherId);
  const isHourlyTeacher = selectedTeacherId !== "all" && selectedTeacherInfo && (
    selectedTeacherInfo.employmentType === "hourly" || 
    (selectedTeacherInfo.employmentType === "part_time" && selectedTeacherInfo.wageType === "hourly")
  );

  const { data: absentDaysData } = useQuery<AbsentDaysResponse>({
    queryKey: ["/api/teacher-absent-days", selectedCenter?.id, workYearMonth, selectedTeacherId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/teacher-absent-days?centerId=${selectedCenter?.id}&yearMonth=${workYearMonth}&teacherId=${selectedTeacherId}`);
      return res.json();
    },
    enabled: !!selectedCenter?.id && !!workYearMonth && !!isHourlyTeacher && mainTab === "teachers",
  });

  const { data: teacherAbsentAdjustments = [] } = useQuery<SalaryAdjustmentType[]>({
    queryKey: ["/api/teacher-salary-adjustments", selectedCenter?.id, workYearMonth, selectedTeacherId, "absent-check"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/teacher-salary-adjustments?centerId=${selectedCenter?.id}&yearMonth=${workYearMonth}&teacherId=${selectedTeacherId}`);
      return res.json();
    },
    enabled: !!selectedCenter?.id && !!workYearMonth && !!isHourlyTeacher && mainTab === "teachers",
  });

  // Add teacher salary expense with auto-category based on employment type
  const addTeacherSalaryExpense = async (teacherId: string) => {
    if (!teacherId || teacherId === "__placeholder") return;
    const teacher = teacherList.find(t => t.id === teacherId);
    if (!teacher) return;
    
    // Map employment type to expense category
    const categoryMap: Record<string, string> = {
      "regular": "expenseRegularSalary",
      "part_time": "expensePartTimeSalary",
      "hourly": "expenseHourlySalary",
    };
    const category = categoryMap[teacher.employmentType || "regular"] || "expenseOther";
    
    let calculatedAmount = 0;

    const needsHourlyCalc = (teacher.employmentType === "hourly" || (teacher.employmentType === "part_time" && teacher.wageType === "hourly"));

    if (needsHourlyCalc) {
      if (teacher.hourlyRate == null) {
        toast({ 
          title: "시급 설정 없음", 
          description: `${teacher.name} 선생님의 시급이 설정되지 않았습니다. 선생님 탭에서 시급을 먼저 설정해주세요.`,
          variant: "destructive" 
        });
        setSelectedSalaryTeacher("");
        return;
      }
      const scheduleData = scheduleHoursData[teacher.id];
      if (!scheduleData || scheduleData.totalHours === 0) {
        toast({ 
          title: "시간표 수업 없음", 
          description: `${teacher.name} 선생님의 시간표에 등록된 수업이 없습니다. 시간표에서 수업을 먼저 배정해주세요.`,
          variant: "destructive" 
        });
        setSelectedSalaryTeacher("");
        return;
      }
      const hasClassRates = scheduleData.details?.some((d: any) => d.classHourlyRate != null);
      if (hasClassRates) {
        calculatedAmount = Math.round(scheduleData.details.reduce((sum: number, d: any) => {
          const rate = d.classHourlyRate != null ? d.classHourlyRate : teacher.hourlyRate!;
          return sum + rate * d.totalHours;
        }, 0));
      } else {
        calculatedAmount = Math.round(teacher.hourlyRate! * scheduleData.totalHours);
      }
      try {
        const yearMonth = editingFinance?.yearMonth || selectedFinanceMonth;
        const adjResponse = await apiRequest("GET", `/api/teacher-salary-adjustments?centerId=${selectedCenter?.id}&yearMonth=${yearMonth}&teacherId=${teacherId}`);
        const adjData = await adjResponse.json();
        if (Array.isArray(adjData) && adjData.length > 0) {
          const adjTotal = adjData.reduce((sum: number, adj: any) => sum + (adj.amount || 0), 0);
          calculatedAmount += adjTotal;
        }
      } catch (err) {
        console.error("Failed to fetch hourly teacher adjustments:", err);
      }
    } else if (teacher.employmentType === "regular" || teacher.employmentType === "part_time") {
      // Auto-calculate salary for regular/part-time teachers using salary settings
      const settings = allSalarySettings.find(s => s.teacherId === teacherId);
      if (settings) {
        // Use base salary + estimate performance from settings
        calculatedAmount = settings.baseSalary;
        
        try {
          const yearMonth = editingFinance?.yearMonth || selectedFinanceMonth;
          const response = await apiRequest("GET", `/api/teacher-salary-calculation/${teacherId}/${yearMonth}?centerId=${selectedCenter?.id}`);
          const salaryData = await response.json();
          if (salaryData && salaryData.totalSalary > 0) {
            calculatedAmount = salaryData.totalSalary;
          }
          const adjResponse = await apiRequest("GET", `/api/teacher-salary-adjustments?centerId=${selectedCenter?.id}&yearMonth=${yearMonth}&teacherId=${teacherId}`);
          const adjData = await adjResponse.json();
          if (Array.isArray(adjData) && adjData.length > 0) {
            const adjTotal = adjData.reduce((sum: number, adj: any) => sum + (adj.amount || 0), 0);
            calculatedAmount += adjTotal;
          }
        } catch (err) {
          console.error("Failed to fetch salary calculation, using base salary:", err);
        }
      } else {
        // No salary settings - warn user and don't add
        toast({ 
          title: "급여 설정 없음", 
          description: `${teacher.name} 선생님의 급여 설정이 없습니다. 선생님 탭에서 먼저 설정해주세요.`,
          variant: "destructive" 
        });
        setSelectedSalaryTeacher("");
        return; // Don't add expense without settings
      }
    }
    
    // Block adding if amount is 0 for regular/part-time
    if (calculatedAmount === 0 && (teacher.employmentType === "regular" || teacher.employmentType === "part_time")) {
      toast({ 
        title: "급여 금액 확인 필요", 
        description: `${teacher.name} 선생님의 계산된 급여가 0원입니다. 선생님 탭에서 급여 설정을 확인해주세요.`,
        variant: "destructive" 
      });
      setSelectedSalaryTeacher("");
      return; // Don't add zero expense
    }
    
    setExpenseItems(prev => [...prev, { 
      name: `${teacher.name} 선생님`, 
      amount: calculatedAmount, 
      category,
      teacherId: teacher.id,
    }]);
    
    // Reset the select after adding
    setSelectedSalaryTeacher("");
  };

  const [syncingAllSalaries, setSyncingAllSalaries] = useState(false);
  const [pendingSalarySync, setPendingSalarySync] = useState(false);

  const addAllTeacherSalaryExpenses = async () => {
    if (!teacherList.length) {
      toast({ title: "선생님 목록이 비어있습니다", variant: "destructive" });
      return;
    }
    setSyncingAllSalaries(true);
    const yearMonth = editingFinance?.yearMonth || selectedFinanceMonth;
    const newItems: ExpenseItem[] = [];
    const errors: string[] = [];

    for (const teacher of teacherList) {
      const alreadyAdded = expenseItems.some(item => item.teacherId === teacher.id);
      if (alreadyAdded) continue;

      const categoryMap: Record<string, string> = {
        "regular": "expenseRegularSalary",
        "part_time": "expensePartTimeSalary",
        "hourly": "expenseHourlySalary",
      };
      const category = categoryMap[teacher.employmentType || "regular"] || "expenseOther";
      let calculatedAmount = 0;

      const needsHourlyCalc = (teacher.employmentType === "hourly" || (teacher.employmentType === "part_time" && teacher.wageType === "hourly"));

      if (needsHourlyCalc) {
        if (teacher.hourlyRate == null) {
          errors.push(`${teacher.name}: 시급 미설정`);
          continue;
        }
        const scheduleData = scheduleHoursData[teacher.id];
        if (!scheduleData || scheduleData.totalHours === 0) {
          errors.push(`${teacher.name}: 시간표 수업 없음`);
          continue;
        }
        const hasClassRates = scheduleData.details?.some((d: any) => d.classHourlyRate != null);
        if (hasClassRates) {
          calculatedAmount = Math.round(scheduleData.details.reduce((sum: number, d: any) => {
            const rate = d.classHourlyRate != null ? d.classHourlyRate : teacher.hourlyRate!;
            return sum + rate * d.totalHours;
          }, 0));
        } else {
          calculatedAmount = Math.round(teacher.hourlyRate! * scheduleData.totalHours);
        }
        try {
          const adjResponse = await apiRequest("GET", `/api/teacher-salary-adjustments?centerId=${selectedCenter?.id}&yearMonth=${yearMonth}&teacherId=${teacher.id}`);
          const adjData = await adjResponse.json();
          if (Array.isArray(adjData) && adjData.length > 0) {
            calculatedAmount += adjData.reduce((sum: number, adj: any) => sum + (adj.amount || 0), 0);
          }
        } catch {}
      } else {
        const settings = allSalarySettings.find(s => s.teacherId === teacher.id);
        if (!settings) {
          errors.push(`${teacher.name}: 급여설정 없음`);
          continue;
        }
        calculatedAmount = settings.baseSalary;
        try {
          const response = await apiRequest("GET", `/api/teacher-salary-calculation/${teacher.id}/${yearMonth}?centerId=${selectedCenter?.id}`);
          const salaryData = await response.json();
          if (salaryData && salaryData.totalSalary > 0) {
            calculatedAmount = salaryData.totalSalary;
          }
          const adjResponse = await apiRequest("GET", `/api/teacher-salary-adjustments?centerId=${selectedCenter?.id}&yearMonth=${yearMonth}&teacherId=${teacher.id}`);
          const adjData = await adjResponse.json();
          if (Array.isArray(adjData) && adjData.length > 0) {
            calculatedAmount += adjData.reduce((sum: number, adj: any) => sum + (adj.amount || 0), 0);
          }
        } catch {}

        if (calculatedAmount === 0) {
          errors.push(`${teacher.name}: 계산된 급여 0원`);
          continue;
        }
      }

      newItems.push({
        name: `${teacher.name} 선생님`,
        amount: calculatedAmount,
        category,
        teacherId: teacher.id,
      });
    }

    if (newItems.length > 0) {
      setExpenseItems(prev => [...prev, ...newItems]);
    }
    setSyncingAllSalaries(false);

    if (errors.length > 0 && newItems.length > 0) {
      toast({ title: `${newItems.length}명 추가 완료, ${errors.length}명 제외`, description: errors.join(", ") });
    } else if (errors.length > 0 && newItems.length === 0) {
      toast({ title: "추가된 선생님이 없습니다", description: errors.join(", "), variant: "destructive" });
    } else if (newItems.length > 0) {
      toast({ title: `${newItems.length}명의 선생님 급여가 추가되었습니다` });
    } else {
      toast({ title: "모든 선생님이 이미 추가되었습니다" });
    }
  };

  useEffect(() => {
    if (pendingSalarySync && showFinanceDialog && teacherList.length > 0 && !loadingTeachers) {
      setPendingSalarySync(false);
      addAllTeacherSalaryExpenses();
    }
  }, [pendingSalarySync, showFinanceDialog, teacherList, loadingTeachers]);

  const invalidateFinanceQueries = () => {
    invalidateQueriesStartingWith("/api/monthly-financials");
  };

  const createFinanceMutation = useMutation({
    mutationFn: async (data: Record<string, any> & { yearMonth: string }) => {
      return apiRequest("POST", "/api/monthly-financials", {
        ...data,
        centerId: selectedCenter?.id,
        createdBy: user?.id,
      });
    },
    onSuccess: () => {
      invalidateFinanceQueries();
      setShowFinanceDialog(false);
      toast({ title: "재무 기록이 저장되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "저장에 실패했습니다", variant: "destructive" });
    },
  });

  const updateFinanceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      return apiRequest("PATCH", `/api/monthly-financials/${id}`, data);
    },
    onSuccess: () => {
      invalidateFinanceQueries();
      setShowFinanceDialog(false);
      setEditingFinance(null);
      toast({ title: "재무 기록이 수정되었습니다" });
    },
    onError: () => {
      toast({ title: "수정에 실패했습니다", variant: "destructive" });
    },
  });

  // Sync student tuition to finance
  const syncTuitionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCenter?.id) throw new Error("센터를 선택해주세요");
      const res = await apiRequest("POST", `/api/sync-student-tuition/${selectedCenter.id}/${selectedFinanceMonth}`, {
        actorId: user?.id,
      });
      return res.json();
    },
    onSuccess: (data: { studentCount: number; totalRevenue: number }) => {
      invalidateFinanceQueries();
      toast({ title: `교육비 동기화 완료: ${data.studentCount}명, ${formatBudget(data.totalRevenue)}` });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "동기화에 실패했습니다", variant: "destructive" });
    },
  });

  const deleteFinanceMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/monthly-financials/${id}`);
    },
    onSuccess: () => {
      invalidateFinanceQueries();
      toast({ title: "재무 기록이 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const openEditFinance = (record: MonthlyFinancialRecord) => {
    setEditingFinance(record);
    const { revenue, expenses } = parseItemsFromRecord(record);
    setRevenueItems(revenue);
    setExpenseItems(expenses);
    setFinanceDialogTab("revenue");
    setShowFinanceDialog(true);
  };

  // 대상 월(target)의 직전(가장 최근) 재무 기록을 찾는다.
  // 같은 연도 로드분에서 우선 찾고, 없으면(연도 경계) 직전 달을 직접 조회한다.
  const findPriorFinanceRecord = async (target: string): Promise<MonthlyFinancialRecord | null> => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(target)) return null;
    const sameYearPrior = financeRecords
      .filter(r => r.yearMonth < target)
      .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))[0];
    if (sameYearPrior) return sameYearPrior;
    if (!selectedCenter?.id) return null;
    const [y, m] = target.split("-").map(Number);
    const prev = new Date(y, m - 2, 1);
    const prevYearMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    try {
      const res = await apiRequest("GET", `/api/monthly-financials/${selectedCenter.id}/${prevYearMonth}`);
      const record = await res.json();
      return (record as MonthlyFinancialRecord) || null;
    } catch {
      return null;
    }
  };

  // 직전 월 기록에서 고정비 항목만 추출한다.
  const extractFixedExpenses = (record: MonthlyFinancialRecord): ExpenseItem[] => {
    const { expenses } = parseItemsFromRecord(record);
    return expenses
      .filter(item => expenseCategories.find(c => c.key === item.category)?.group === "고정비")
      .map(item => ({ name: item.name, amount: item.amount, category: item.category }));
  };

  const openNewFinance = async (yearMonth: string) => {
    setEditingFinance(null);
    setSelectedFinanceMonth(yearMonth);
    setRevenueItems([]);
    // 새 월을 작성할 때 직전(가장 최근) 월의 고정비를 그대로 가져온다.
    const priorRecord = await findPriorFinanceRecord(yearMonth);
    setExpenseItems(priorRecord ? extractFixedExpenses(priorRecord) : []);
    setFinanceDialogTab("revenue");
    setShowFinanceDialog(true);
  };

  // 고정비 섹션 수동 버튼: 기존 고정비를 직전 월 고정비로 교체한다.
  const importPreviousMonthFixedExpenses = async () => {
    const target = editingFinance?.yearMonth || selectedFinanceMonth;
    if (!target) return;
    const priorRecord = await findPriorFinanceRecord(target);
    if (!priorRecord) {
      toast({ title: "이전달 기록 없음", description: "직전 달의 재무 기록을 찾을 수 없습니다.", variant: "destructive" });
      return;
    }
    const fixed = extractFixedExpenses(priorRecord);
    if (fixed.length === 0) {
      toast({ title: "이전달 고정비 없음", description: "직전 달에 입력된 고정비가 없습니다.", variant: "destructive" });
      return;
    }
    setExpenseItems(prev => [
      ...prev.filter(item => expenseCategories.find(c => c.key === item.category)?.group !== "고정비"),
      ...fixed,
    ]);
    toast({ title: "이전달 고정비 불러옴", description: `${fixed.length}개 항목을 적용했습니다.` });
  };

  const handleSaveFinance = () => {
    const formData = buildFinanceFormFromItems();
    if (editingFinance) {
      updateFinanceMutation.mutate({ id: editingFinance.id, data: formData });
    } else {
      createFinanceMutation.mutate({ ...formData, yearMonth: selectedFinanceMonth });
    }
  };

  // Calculate finance summary
  // 마케팅 탭에서 등록된 캠페인의 예산을 해당 월의 판관비에 추가로 합산한다.
  // (record.expenseAdvertising 와는 별도로 가산되어 중복 계산되지 않도록, 캠페인 비용은
  //  마케팅 탭에서만 등록하고 광고선전비 항목은 비워두는 것을 권장)
  const calculateFinanceSummary = (
    record: MonthlyFinancialRecord | null,
    marketingExtra: number = 0,
  ) => {
    if (!record) {
      // 재무 기록이 없어도 마케팅 캠페인 비용은 표시되어야 함
      return {
        revenue: 0,
        laborCost: 0,
        operatingExpense: marketingExtra,
        operatingProfit: -marketingExtra,
        marketingExtra,
      };
    }

    const revenue = record.revenueTuition;
    const laborCost = record.expenseRegularSalary + record.expensePartTimeSalary + 
                      record.expenseHourlySalary + record.expenseEmployeeInsurance;
    const operatingExpense = record.expenseRent + record.expenseWelfare + record.expenseUtilities +
                             record.expenseCommunication + record.expenseSupplies + record.expenseAdvertising +
                             record.expenseFees + record.expenseInsurance + record.expenseDepreciation +
                             record.expenseVehicle + record.expenseEducation + record.expenseOther +
                             marketingExtra;
    const operatingProfit = revenue - laborCost - operatingExpense;
    
    return { revenue, laborCost, operatingExpense, operatingProfit, marketingExtra };
  };

  // Prepare chart data for finance
  // 재무 기록이 없는 달이라도 마케팅 캠페인 비용이 있으면 차트에 표시
  const financeChartData = (() => {
    const monthsWithData = new Set<string>();
    financeRecords.forEach(r => monthsWithData.add(r.yearMonth));
    marketingByMonth.forEach((_, ym) => monthsWithData.add(ym));

    return Array.from(monthsWithData)
      .sort((a, b) => a.localeCompare(b))
      .map(yearMonth => {
        const record = financeRecords.find(r => r.yearMonth === yearMonth) || null;
        const marketingExtra = marketingByMonth.get(yearMonth) || 0;
        const summary = calculateFinanceSummary(record, marketingExtra);
        return {
          month: formatMonthShort(yearMonth),
          fullMonth: yearMonth,
          매출: summary.revenue,
          인건비: summary.laborCost,
          판관비: summary.operatingExpense,
          영업이익: summary.operatingProfit,
        };
      });
  })();

  const monthlyData = metricsData?.monthlyData || [];
  const currentMonth = monthlyData[monthlyData.length - 1];
  const previousMonth = monthlyData[monthlyData.length - 2];

  const studentCountChange = currentMonth && previousMonth 
    ? currentMonth.studentCount - previousMonth.studentCount 
    : 0;
  const totalExits = monthlyData.reduce((sum, m) => sum + m.exitCount, 0);
  const avgExitRatio = monthlyData.length > 0 
    ? monthlyData.reduce((sum, m) => sum + m.exitRatio, 0) / monthlyData.length 
    : 0;

  const reasonTotals: Record<string, number> = {};
  monthlyData.forEach(m => {
    Object.entries(m.reasons).forEach(([reason, count]) => {
      reasonTotals[reason] = (reasonTotals[reason] || 0) + count;
    });
  });

  const sortedReasons = Object.entries(reasonTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const reasonChartData = sortedReasons.map(([reason, count], index) => ({
    reason: reason.length > 12 ? reason.slice(0, 12) + "..." : reason,
    fullReason: reason,
    count,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card className="p-8 text-center">
          <CardTitle className="text-destructive mb-2">접근 권한 없음</CardTitle>
          <CardDescription>경영 대시보드는 관리자와 원장만 접근할 수 있습니다.</CardDescription>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">경영 대시보드</h1>
          <p className="text-muted-foreground">학원 경영 현황 및 분석</p>
        </div>
        <ManualButton menuKey="management" />
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="students" data-testid="tab-students" className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">학생</span>
          </TabsTrigger>
          <TabsTrigger value="teachers" data-testid="tab-teachers" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">선생님</span>
          </TabsTrigger>
          <TabsTrigger value="finance" data-testid="tab-finance" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">재무</span>
          </TabsTrigger>
          <TabsTrigger value="marketing" data-testid="tab-marketing" className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            <span className="hidden sm:inline">마케팅</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-6 space-y-6">
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateCountMutation.mutate()}
              disabled={updateCountMutation.isPending}
              data-testid="button-update-count"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${updateCountMutation.isPending ? 'animate-spin' : ''}`} />
              현재 학생 수 업데이트
            </Button>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
                  <CardTitle className="text-sm font-medium">현재 학생 수</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currentMonth?.studentCount || 0}명</div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    {studentCountChange > 0 ? (
                      <>
                        <TrendingUp className="h-3 w-3 mr-1 text-emerald-500" />
                        <span className="text-emerald-500">+{studentCountChange}명</span>
                      </>
                    ) : studentCountChange < 0 ? (
                      <>
                        <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
                        <span className="text-red-500">{studentCountChange}명</span>
                      </>
                    ) : (
                      <span>전월 대비 변동 없음</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
                  <CardTitle className="text-sm font-medium">이번 달 퇴원</CardTitle>
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currentMonth?.exitCount || 0}명</div>
                  <p className="text-xs text-muted-foreground">
                    퇴원율 {currentMonth?.exitRatio.toFixed(1) || 0}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
                  <CardTitle className="text-sm font-medium">{months}개월 총 퇴원</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalExits}명</div>
                  <p className="text-xs text-muted-foreground">
                    평균 퇴원율 {avgExitRatio.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
                  <CardTitle className="text-sm font-medium">주요 퇴원 사유</CardTitle>
                  <PieChart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {sortedReasons.length > 0 ? (
                    <div className="space-y-1">
                      <div className="text-sm font-medium truncate">{sortedReasons[0][0]}</div>
                      <p className="text-xs text-muted-foreground">
                        {sortedReasons[0][1]}건 ({((sortedReasons[0][1] / totalExits) * 100).toFixed(0)}%)
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">데이터 없음</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <Tabs value={studentSubTab} onValueChange={setStudentSubTab} className="w-full">
            <TabsList className="flex-wrap">
              <TabsTrigger value="trend" data-testid="tab-trend">학생 수 추이</TabsTrigger>
              <TabsTrigger value="exit" data-testid="tab-exit">퇴원 분석</TabsTrigger>
              <TabsTrigger value="reasons" data-testid="tab-reasons">퇴원 사유</TabsTrigger>
            </TabsList>

            <TabsContent value="trend" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>월별 학생 수 추이</CardTitle>
                  <CardDescription>
                    {studentTrends?.currentYear}년 월별 학생 수{studentTrends?.hasLastYearData ? "와 전년 동기 비교" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTrends ? (
                    <div className="h-80 flex items-center justify-center">
                      <Skeleton className="h-full w-full" />
                    </div>
                  ) : studentTrends?.monthlyData ? (
                    (() => {
                      const hasLastYearData = studentTrends.hasLastYearData;
                      const latest = studentTrends.monthlyData.length > 0 
                        ? studentTrends.monthlyData[studentTrends.monthlyData.length - 1] 
                        : null;
                      
                      return (
                        <div className="space-y-4">
                          <div className="flex items-center flex-wrap gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--primary))' }} />
                              <span className="font-medium">{studentTrends.currentYear}년 (올해)</span>
                            </div>
                            {hasLastYearData && (
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--muted-foreground) / 0.4)' }} />
                                <span className="font-medium">{studentTrends.lastYear}년 (작년)</span>
                              </div>
                            )}
                            {hasLastYearData && latest && (
                              <Badge 
                                variant={latest.delta >= 0 ? "default" : "secondary"} 
                                className="ml-auto"
                              >
                                {latest.delta >= 0 ? (
                                  <TrendingUp className="w-3 h-3 mr-1" />
                                ) : (
                                  <TrendingDown className="w-3 h-3 mr-1" />
                                )}
                                전년 대비 {latest.delta >= 0 ? "+" : ""}{latest.delta}명 
                                ({latest.delta >= 0 ? "+" : ""}{latest.deltaPercent}%)
                              </Badge>
                            )}
                          </div>
                          <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={studentTrends.monthlyData} barCategoryGap="20%">
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                                <XAxis 
                                  dataKey="label" 
                                  className="text-xs"
                                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                  axisLine={{ stroke: 'hsl(var(--border))' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  className="text-xs"
                                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                  axisLine={false}
                                  tickLine={false}
                                  width={40}
                                />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                  }}
                                  labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 }}
                                  formatter={(value: number, name: string) => [
                                    `${value}명`,
                                    name === 'count' ? `${studentTrends.currentYear}년` : `${studentTrends.lastYear}년`
                                  ]}
                                  cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                                />
                                {hasLastYearData && (
                                  <Bar 
                                    dataKey="lastYearCount" 
                                    fill="hsl(var(--muted-foreground) / 0.4)" 
                                    radius={[4, 4, 0, 0]}
                                    name="lastYearCount"
                                    maxBarSize={40}
                                  />
                                )}
                                <Bar 
                                  dataKey="count" 
                                  fill="hsl(var(--primary))" 
                                  radius={[4, 4, 0, 0]}
                                  name="count"
                                  maxBarSize={40}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      데이터가 없습니다
                    </div>
                  )}
                </CardContent>
              </Card>

              {loadingStudents ? (
                <div className="space-y-4 mt-4">
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : (() => {
                const GRADE_ORDER = ["초1","초2","초3","초4","초5","초6","중1","중2","중3","고1","고2","고3","성인"];
                const GRADE_NORMALIZE: Record<string, string> = {
                  "초등학교 1학년": "초1", "초등학교 2학년": "초2", "초등학교 3학년": "초3",
                  "초등학교 4학년": "초4", "초등학교 5학년": "초5", "초등학교 6학년": "초6",
                  "중학교 1학년": "중1", "중학교 2학년": "중2", "중학교 3학년": "중3",
                  "고등학교 1학년": "고1", "고등학교 2학년": "고2", "고등학교 3학년": "고3",
                };
                const normalizeSchoolName = (name: string): string => {
                  if (!name) return "미지정";
                  let n = name.trim();
                  n = n.replace(/초등학교/g, "초").replace(/중학교/g, "중").replace(/고등학교/g, "고");
                  return n;
                };
                const gradeStats: Record<string, number> = {};
                const schoolStats: Record<string, number> = {};
                centerStudents.forEach((s) => {
                  const rawGrade = s.grade || "미지정";
                  const normalizedGrade = GRADE_NORMALIZE[rawGrade] || rawGrade;
                  gradeStats[normalizedGrade] = (gradeStats[normalizedGrade] || 0) + 1;
                  const normalizedSchool = normalizeSchoolName(s.school || "");
                  schoolStats[normalizedSchool] = (schoolStats[normalizedSchool] || 0) + 1;
                });
                const sortedGrades = Object.entries(gradeStats).sort((a, b) => {
                  const ai = GRADE_ORDER.indexOf(a[0]);
                  const bi = GRADE_ORDER.indexOf(b[0]);
                  if (ai !== -1 && bi !== -1) return ai - bi;
                  if (ai !== -1) return -1;
                  if (bi !== -1) return 1;
                  return a[0].localeCompare(b[0], "ko");
                });
                const sortedSchools = Object.entries(schoolStats).sort((a, b) => b[1] - a[1]);
                const gradeChartData = sortedGrades.map(([grade, count]) => ({ grade, count }));
                const totalStudents = centerStudents.length;
                const GRADE_COLORS: Record<string, string> = {
                  "초1": "#93C5FD", "초2": "#60A5FA", "초3": "#3B82F6",
                  "초4": "#2563EB", "초5": "#1D4ED8", "초6": "#1E40AF",
                  "중1": "#34D399", "중2": "#10B981", "중3": "#059669",
                  "고1": "#F59E0B", "고2": "#D97706", "고3": "#B45309",
                  "성인": "#7C3AED",
                };
                return (
                  <div className="space-y-4 mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <GraduationCap className="h-5 w-5" />
                          학년별 학생 수
                        </CardTitle>
                        <CardDescription>총 {totalStudents}명 (재원 학생 기준)</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {gradeChartData.length > 0 ? (
                          <div className="space-y-4">
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={gradeChartData}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                  <XAxis dataKey="grade" className="text-xs" />
                                  <YAxis className="text-xs" allowDecimals={false} />
                                  <Tooltip
                                    formatter={(value: number) => [`${value}명`, "학생 수"]}
                                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                                  />
                                  <Bar dataKey="count" name="학생 수" radius={[4, 4, 0, 0]} maxBarSize={50}>
                                    {gradeChartData.map((entry, index) => (
                                      <Cell key={`grade-${index}`} fill={GRADE_COLORS[entry.grade] || "hsl(var(--primary))"} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {sortedGrades.map(([grade, count]) => (
                                <div key={grade} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50">
                                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: GRADE_COLORS[grade] || "hsl(var(--primary))" }} />
                                  <span className="text-sm font-medium whitespace-nowrap">{grade}</span>
                                  <Badge variant="secondary" className="text-xs">{count}명 ({totalStudents > 0 ? ((count / totalStudents) * 100).toFixed(1) : 0}%)</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="h-64 flex items-center justify-center text-muted-foreground">학생 데이터가 없습니다</div>
                        )}
                      </CardContent>
                    </Card>

                    {(() => {
                      const filteredSchools = schoolFilter === "all"
                        ? sortedSchools
                        : sortedSchools.filter(([school]) => {
                            if (school === "미지정") return false;
                            if (schoolFilter === "elementary") return school.includes("초");
                            if (schoolFilter === "middle") return school.includes("중");
                            if (schoolFilter === "high") return school.includes("고");
                            return true;
                          });
                      const filteredTotal = filteredSchools.reduce((sum, [, c]) => sum + c, 0);
                      const chartSchools = filteredSchools.slice(0, 20);
                      const chartHeight = Math.max(200, chartSchools.length * 32);
                      return (
                        <Card>
                          <CardHeader>
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div>
                                <CardTitle className="flex items-center gap-2">
                                  <School className="h-5 w-5" />
                                  학교별 학생 수
                                </CardTitle>
                                <CardDescription className="mt-1">총 {filteredSchools.length}개 학교 · {filteredTotal}명</CardDescription>
                              </div>
                              <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                                <SelectTrigger className="w-24" data-testid="select-school-filter">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">전체</SelectItem>
                                  <SelectItem value="elementary">초등</SelectItem>
                                  <SelectItem value="middle">중등</SelectItem>
                                  <SelectItem value="high">고등</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {filteredSchools.length > 0 ? (
                              <div className="space-y-4">
                                <div style={{ height: chartHeight }}>
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartSchools.map(([school, count]) => ({ school, count, fullName: school }))} layout="vertical">
                                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                      <XAxis type="number" className="text-xs" allowDecimals={false} />
                                      <YAxis type="category" dataKey="school" width={100} className="text-xs" tick={{ fontSize: 12 }} interval={0} />
                                      <Tooltip
                                        formatter={(value: number, _name: any, props: any) => [`${value}명`, props.payload.fullName]}
                                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                                      />
                                      <Bar dataKey="count" name="학생 수" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={28} />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-12">순위</TableHead>
                                      <TableHead>학교명</TableHead>
                                      <TableHead className="text-right">학생 수</TableHead>
                                      <TableHead className="text-right">비율</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {filteredSchools.map(([school, count], index) => (
                                      <TableRow key={school}>
                                        <TableCell className="font-medium">{index + 1}</TableCell>
                                        <TableCell>{school}</TableCell>
                                        <TableCell className="text-right">{count}명</TableCell>
                                        <TableCell className="text-right">{filteredTotal > 0 ? ((count / filteredTotal) * 100).toFixed(1) : 0}%</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <div className="h-64 flex items-center justify-center text-muted-foreground">해당 학교 데이터가 없습니다</div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })()}

                    {(() => {
                      const schoolGradeMap: Record<string, Record<string, number>> = {};
                      centerStudents.forEach((s) => {
                        const rawGrade = s.grade || "미지정";
                        const normalizedGrade = GRADE_NORMALIZE[rawGrade] || rawGrade;
                        const normalizedSchool = normalizeSchoolName(s.school || "");
                        if (normalizedSchool === "미지정") return;
                        if (!schoolGradeMap[normalizedSchool]) schoolGradeMap[normalizedSchool] = {};
                        schoolGradeMap[normalizedSchool][normalizedGrade] = (schoolGradeMap[normalizedSchool][normalizedGrade] || 0) + 1;
                      });

                      const allSchoolsSorted = Object.keys(schoolGradeMap).sort((a, b) => a.localeCompare(b, "ko"));

                      if (allSchoolsSorted.length === 0) return null;

                      const targetSchools = selectedSchoolForGrade === "all"
                        ? allSchoolsSorted
                        : allSchoolsSorted.filter(s => s === selectedSchoolForGrade);

                      const allGradesInData = new Set<string>();
                      targetSchools.forEach((school) => {
                        Object.keys(schoolGradeMap[school]).forEach(g => allGradesInData.add(g));
                      });
                      const orderedGrades = GRADE_ORDER.filter(g => allGradesInData.has(g));
                      const remaining = [...allGradesInData].filter(g => !GRADE_ORDER.includes(g)).sort((a, b) => a.localeCompare(b, "ko"));
                      const finalGrades = [...orderedGrades, ...remaining];

                      const gradeAggregated: Record<string, number> = {};
                      targetSchools.forEach(school => {
                        finalGrades.forEach(g => {
                          gradeAggregated[g] = (gradeAggregated[g] || 0) + (schoolGradeMap[school][g] || 0);
                        });
                      });
                      const chartData = finalGrades.map(grade => ({ grade, count: gradeAggregated[grade] || 0 }));
                      const selectedTotal = chartData.reduce((sum, d) => sum + d.count, 0);

                      return (
                        <Card>
                          <CardHeader>
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div>
                                <CardTitle className="flex items-center gap-2">
                                  <School className="h-5 w-5" />
                                  학교별 학년 분포
                                </CardTitle>
                                <CardDescription className="mt-1">
                                  {selectedSchoolForGrade === "all" ? `전체 ${allSchoolsSorted.length}개 학교` : selectedSchoolForGrade} · 총 {selectedTotal}명
                                </CardDescription>
                              </div>
                              <Select value={selectedSchoolForGrade} onValueChange={setSelectedSchoolForGrade}>
                                <SelectTrigger className="w-40" data-testid="select-school-grade">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">전체 학교</SelectItem>
                                  {allSchoolsSorted.map(school => (
                                    <SelectItem key={school} value={school}>{school}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {chartData.length > 0 ? (
                              <div className="space-y-4">
                                <div className="h-64">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                      <XAxis dataKey="grade" className="text-xs" />
                                      <YAxis className="text-xs" allowDecimals={false} />
                                      <Tooltip
                                        formatter={(value: number) => [`${value}명`, "학생 수"]}
                                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                                      />
                                      <Bar dataKey="count" name="학생 수" radius={[4, 4, 0, 0]} maxBarSize={50}>
                                        {chartData.map((entry, index) => (
                                          <Cell key={`sg-${index}`} fill={GRADE_COLORS[entry.grade] || "hsl(var(--primary))"} />
                                        ))}
                                      </Bar>
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {chartData.filter(d => d.count > 0).map(({ grade, count }) => (
                                    <div key={grade} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50">
                                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: GRADE_COLORS[grade] || "hsl(var(--primary))" }} />
                                      <span className="text-sm font-medium whitespace-nowrap">{grade}</span>
                                      <Badge variant="secondary" className="text-xs">{count}명 ({selectedTotal > 0 ? ((count / selectedTotal) * 100).toFixed(1) : 0}%)</Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="h-64 flex items-center justify-center text-muted-foreground">학년 데이터가 없습니다</div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })()}
                  </div>
                );
              })()}
            </TabsContent>

            <TabsContent value="exit" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>월별 퇴원 현황</CardTitle>
                  <CardDescription>학생 수 대비 퇴원 비율</CardDescription>
                </CardHeader>
                <CardContent>
                  {monthlyData.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="month" 
                            tickFormatter={formatMonthShort}
                            className="text-xs"
                          />
                          <YAxis yAxisId="left" className="text-xs" />
                          <YAxis yAxisId="right" orientation="right" unit="%" className="text-xs" />
                          <Tooltip 
                            labelFormatter={formatMonth}
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                          <Legend />
                          <Bar 
                            yAxisId="left"
                            dataKey="exitCount" 
                            name="퇴원 수"
                            fill="#EF4444" 
                            radius={[4, 4, 0, 0]}
                          />
                          <Line 
                            yAxisId="right"
                            type="monotone" 
                            dataKey="exitRatio" 
                            name="퇴원율 (%)"
                            stroke="#F59E0B" 
                            strokeWidth={2}
                            dot={{ fill: '#F59E0B', strokeWidth: 2 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      데이터가 없습니다
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>담임 선생님별 퇴원 현황</CardTitle>
                  <CardDescription>최근 {months}개월간 담임 선생님별 퇴원생 비율</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTeacherExit ? (
                    <div className="h-80 flex items-center justify-center">
                      <Skeleton className="w-full h-full" />
                    </div>
                  ) : teacherExitData.length > 0 ? (
                    <div className="space-y-4">
                      {teacherExitData.some(d => d.exitCount > 0) ? (
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={teacherExitData.filter(d => d.exitCount > 0)} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis type="number" className="text-xs" />
                              <YAxis 
                                type="category" 
                                dataKey="teacherName" 
                                width={80}
                                className="text-xs"
                              />
                              <Tooltip 
                                formatter={(value: number, name: string) => {
                                  if (name === "퇴원 수") return [`${value}명`, name];
                                  if (name === "퇴원율") return [`${value}%`, name];
                                  return [value, name];
                                }}
                                contentStyle={{ 
                                  backgroundColor: 'hsl(var(--card))', 
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px'
                                }}
                              />
                              <Legend />
                              <Bar 
                                dataKey="exitCount" 
                                name="퇴원 수"
                                fill="#EF4444"
                                radius={[0, 4, 4, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-40 flex items-center justify-center text-muted-foreground border rounded-lg bg-muted/30">
                          최근 {months}개월간 퇴원 기록이 없습니다
                        </div>
                      )}
                      
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>담임 선생님</TableHead>
                              <TableHead className="text-right">담당 학생</TableHead>
                              <TableHead className="text-right">퇴원 수</TableHead>
                              <TableHead className="text-right">퇴원율</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {teacherExitData.map((data) => (
                              <TableRow key={data.teacherId}>
                                <TableCell className="font-medium">{data.teacherName}</TableCell>
                                <TableCell className="text-right">{data.totalStudents}명</TableCell>
                                <TableCell className="text-right">
                                  {data.exitCount > 0 ? (
                                    <Badge variant="destructive">{data.exitCount}명</Badge>
                                  ) : (
                                    <span className="text-muted-foreground">0명</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {data.exitRatio > 0 ? (
                                    <span className="text-destructive font-medium">{data.exitRatio}%</span>
                                  ) : (
                                    <span className="text-muted-foreground">0%</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center text-muted-foreground">
                      선생님별 퇴원 데이터가 없습니다
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reasons" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>퇴원 사유 분석</CardTitle>
                  <CardDescription>최근 {months}개월간 퇴원 사유 통계</CardDescription>
                </CardHeader>
                <CardContent>
                  {reasonChartData.length > 0 ? (
                    <div className="space-y-6">
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={reasonChartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" className="text-xs" />
                            <YAxis 
                              type="category" 
                              dataKey="reason" 
                              width={100}
                              className="text-xs"
                            />
                            <Tooltip 
                              formatter={(value: number, name, props) => [
                                `${value}건`,
                                props.payload.fullReason
                              ]}
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--card))', 
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                            />
                            <Bar dataKey="count" name="건수" radius={[0, 4, 4, 0]}>
                              {reasonChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                        {sortedReasons.map(([reason, count], index) => (
                          <div 
                            key={reason}
                            className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                          >
                            <div 
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                            />
                            <span className="text-sm truncate flex-1">{reason}</span>
                            <Badge variant="secondary" className="shrink-0">{count}건</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      데이터가 없습니다
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="teachers" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    선생님 출퇴근 기록
                  </CardTitle>
                  <CardDescription>
                    선생님들의 출근/퇴근 기록을 달력으로 확인합니다
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm shrink-0">선생님</Label>
                    <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                      <SelectTrigger className="w-32" data-testid="select-teacher-filter">
                        <SelectValue placeholder="전체" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체</SelectItem>
                        {uniqueTeachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const [y, m] = workStartDate.split("-").map(Number);
                        const prevMonth = m === 1 ? 12 : m - 1;
                        const prevYear = m === 1 ? y - 1 : y;
                        const lastDay = new Date(prevYear, prevMonth, 0).getDate();
                        setWorkStartDate(`${prevYear}-${String(prevMonth).padStart(2, "0")}-01`);
                        setWorkEndDate(`${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`);
                      }}
                      data-testid="button-prev-month"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[100px] text-center">
                      {workStartDate ? format(new Date(workStartDate), "yyyy년 M월", { locale: ko }) : "-"}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const [y, m] = workStartDate.split("-").map(Number);
                        const nextMonth = m === 12 ? 1 : m + 1;
                        const nextYear = m === 12 ? y + 1 : y;
                        const lastDay = new Date(nextYear, nextMonth, 0).getDate();
                        setWorkStartDate(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01`);
                        setWorkEndDate(`${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`);
                      }}
                      data-testid="button-next-month"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingWorkRecords ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : (
                (() => {
                  // Build calendar grid
                  const [year, month] = workStartDate.split("-").map(Number);
                  const firstDayOfMonth = new Date(year, month - 1, 1);
                  const lastDayOfMonth = new Date(year, month, 0);
                  const daysInMonth = lastDayOfMonth.getDate();
                  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
                  
                  // Group records by date
                  const recordsByDate: Record<string, typeof filteredWorkRecords> = {};
                  filteredWorkRecords.forEach(record => {
                    const dateKey = record.workDate;
                    if (!recordsByDate[dateKey]) recordsByDate[dateKey] = [];
                    recordsByDate[dateKey].push(record);
                  });
                  
                  // Calculate total work days and hours
                  const totalWorkDays = Object.keys(recordsByDate).length;
                  const totalWorkMinutes = filteredWorkRecords.reduce((sum, r) => sum + (r.workMinutes || 0), 0);
                  const totalHours = Math.floor(totalWorkMinutes / 60);
                  const totalMins = totalWorkMinutes % 60;
                  
                  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
                  
                  return (
                    <div className="space-y-4">
                      {/* Summary */}
                      <div className="flex flex-wrap gap-4 p-3 bg-muted/50 rounded-lg items-center">
                        <div>
                          <div className="text-xs text-muted-foreground">출근 일수</div>
                          <div className="text-lg font-bold">{totalWorkDays}일</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">총 근무 시간</div>
                          <div className="text-lg font-bold">{totalHours}시간 {totalMins}분</div>
                        </div>
                        {isHourlyTeacher && absentDaysData && absentDaysData.absentDays.length > 0 && (
                          <>
                            <div>
                              <div className="text-xs text-muted-foreground">결근 일수</div>
                              <div className="text-lg font-bold text-destructive">{absentDaysData.absentDays.length}일</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">결근 시간</div>
                              <div className="text-lg font-bold text-destructive">
                                {absentDaysData.absentDays.reduce((sum, d) => sum + d.hours, 0).toFixed(1)}시간
                              </div>
                            </div>
                            {isAuthorized && (
                              <Button
                                variant="destructive"
                                size="sm"
                                data-testid="button-absent-deduct"
                                onClick={() => {
                                  const existing = teacherAbsentAdjustments.find(a => a.description?.startsWith("결근 차감"));
                                  if (existing) {
                                    setExistingAbsentDeduction(existing);
                                  } else {
                                    setExistingAbsentDeduction(null);
                                  }
                                  setSelectedAbsentDays(absentDaysData.absentDays);
                                  setShowAbsentDeductDialog(true);
                                }}
                              >
                                결근 차감
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                      
                      {/* Calendar Grid */}
                      <div className="border rounded-lg overflow-hidden">
                        {/* Day headers */}
                        <div className="grid grid-cols-7 bg-muted">
                          {dayNames.map((day, i) => (
                            <div 
                              key={day} 
                              className={`p-2 text-center text-sm font-medium ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : ""}`}
                            >
                              {day}
                            </div>
                          ))}
                        </div>
                        
                        {/* Calendar cells */}
                        <div className="grid grid-cols-7">
                          {/* Empty cells for days before the 1st */}
                          {Array.from({ length: startDayOfWeek }).map((_, i) => (
                            <div key={`empty-${i}`} className="min-h-[80px] p-1 border-t border-r bg-muted/30" />
                          ))}
                          
                          {/* Day cells */}
                          {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                            const dayRecords = recordsByDate[dateStr] || [];
                            const dayOfWeek = (startDayOfWeek + i) % 7;
                            const isToday = dateStr === format(new Date(), "yyyy-MM-dd");
                            const isAbsent = isHourlyTeacher && absentDaysData?.absentDays?.some(a => a.date === dateStr);
                            
                            return (
                              <div 
                                key={day} 
                                className={`min-h-[80px] p-1 border-t border-r ${isToday ? "bg-primary/10" : ""} ${isAbsent ? "bg-red-50 dark:bg-red-950/30" : dayRecords.length > 0 ? "bg-green-50 dark:bg-green-950/30" : ""}`}
                              >
                                <div className={`text-xs font-medium mb-1 ${dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : ""}`}>
                                  {day}
                                </div>
                                {isAbsent && dayRecords.length === 0 && (
                                  <div className="text-xs p-1 rounded mb-1 bg-destructive/20 text-destructive font-medium text-center">
                                    결근
                                  </div>
                                )}
                                {dayRecords.map(record => {
                                  const workHours = record.workMinutes ? Math.floor(record.workMinutes / 60) : 0;
                                  const workMins = record.workMinutes ? record.workMinutes % 60 : 0;
                                  return (
                                    <div 
                                      key={record.id} 
                                      className={`text-xs p-1 rounded mb-1 ${record.noCheckOut ? "bg-destructive/20 text-destructive" : "bg-primary/20"}`}
                                      title={`${record.teacherName}: ${record.checkInAt ? formatKoreanTime(record.checkInAt) : "-"} ~ ${record.checkOutAt ? formatKoreanTime(record.checkOutAt) : "-"}`}
                                    >
                                      {selectedTeacherId === "all" && (
                                        <div className="font-medium truncate">{record.teacherName}</div>
                                      )}
                                      <div className="text-muted-foreground">
                                        {record.checkInAt ? formatKoreanTime(record.checkInAt) : "-"}
                                        {" ~ "}
                                        {record.noCheckOut ? "퇴근X" : record.checkOutAt ? formatKoreanTime(record.checkOutAt) : "근무중"}
                                      </div>
                                      {record.workMinutes !== null && (
                                        <div className="font-medium text-primary">
                                          {workHours}h {workMins}m
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                          
                          {/* Empty cells to complete the grid */}
                          {Array.from({ length: (7 - ((startDayOfWeek + daysInMonth) % 7)) % 7 }).map((_, i) => (
                            <div key={`empty-end-${i}`} className="min-h-[80px] p-1 border-t border-r bg-muted/30" />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>

          <Dialog open={showAbsentDeductDialog} onOpenChange={setShowAbsentDeductDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>결근 급여 차감</DialogTitle>
                <DialogDescription>
                  {selectedTeacherInfo?.name} 선생님의 결근일에 대한 급여 차감을 처리합니다.
                  시급 {selectedTeacherInfo?.hourlyRate?.toLocaleString() ?? 0}원 기준으로 계산됩니다.
                </DialogDescription>
              </DialogHeader>
              {existingAbsentDeduction && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm">
                  <div className="font-medium text-yellow-800 dark:text-yellow-200">이미 결근 차감이 존재합니다</div>
                  <div className="text-yellow-700 dark:text-yellow-300 mt-1">
                    기존 차감: {existingAbsentDeduction.amount.toLocaleString()}원 ({existingAbsentDeduction.description})
                  </div>
                  <div className="text-yellow-600 dark:text-yellow-400 mt-1 text-xs">
                    추가로 차감하면 기존 차감과 합산됩니다. 기존 차감을 먼저 삭제하려면 급여 설정에서 조정 항목을 확인하세요.
                  </div>
                </div>
              )}
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {selectedAbsentDays.map((absent, idx) => {
                  const deductAmount = Math.round((selectedTeacherInfo?.hourlyRate ?? 0) * absent.hours);
                  return (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded-lg" data-testid={`absent-day-${idx}`}>
                      <div>
                        <div className="text-sm font-medium">{absent.date}</div>
                        <div className="text-xs text-muted-foreground">
                          {absent.hours}시간 · {absent.classes.join(", ")}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-destructive">
                        -{deductAmount.toLocaleString()}원
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="font-medium">총 차감액</span>
                <span className="text-lg font-bold text-destructive">
                  -{Math.round(selectedAbsentDays.reduce((sum, a) => sum + (selectedTeacherInfo?.hourlyRate ?? 0) * a.hours, 0)).toLocaleString()}원
                </span>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAbsentDeductDialog(false)} data-testid="button-cancel-absent-deduct">
                  취소
                </Button>
                <Button
                  variant="destructive"
                  data-testid="button-confirm-absent-deduct"
                  disabled={absentDeductMutation.isPending}
                  onClick={() => {
                    if (!selectedTeacherInfo || !selectedCenter?.id) return;
                    const totalDeduct = -Math.round(selectedAbsentDays.reduce((sum, a) => sum + (selectedTeacherInfo.hourlyRate ?? 0) * a.hours, 0));
                    const dateList = selectedAbsentDays.map(a => a.date.substring(5)).join(", ");
                    absentDeductMutation.mutate({
                      teacherId: selectedTeacherInfo.id,
                      centerId: selectedCenter.id,
                      yearMonth: workYearMonth,
                      amount: totalDeduct,
                      description: `결근 차감 (${selectedAbsentDays.length}일: ${dateList})`,
                    });
                  }}
                >
                  {absentDeductMutation.isPending ? "처리중..." : "차감 적용"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Salary Settings Section */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    정규/파트 선생님 급여 설정
                  </CardTitle>
                  <CardDescription>
                    정규 및 파트타임 선생님의 기본급과 성과급을 설정합니다 (관리자/원장만 수정 가능)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">산정내역 기준월:</span>
                  <Select value={salaryBreakdownYearMonth} onValueChange={setSalaryBreakdownYearMonth}>
                    <SelectTrigger className="w-36" data-testid="select-salary-breakdown-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => {
                        const now = new Date();
                        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                        const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
                        return (
                          <SelectItem key={ym} value={ym}>{ym}</SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {allTeachersForSalary.filter(t => t.employmentType === "regular" || t.employmentType === "part_time").length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  정규 또는 파트타임 선생님이 없습니다
                </div>
              ) : (
                <div className="space-y-3">
                  {allTeachersForSalary
                    .filter(t => t.employmentType === "regular" || t.employmentType === "part_time")
                    .map(teacher => {
                      const settings = allSalarySettings.find(s => s.teacherId === teacher.id);
                      const isExpanded = expandedSalaryBreakdownTeacherId === teacher.id;
                      const isPartTime = teacher.employmentType === "part_time";
                      const partTimeWageType = teacher.wageType || "monthly";
                      const isPartTimeHourly = isPartTime && partTimeWageType === "hourly";
                      const dayLabelsInline: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };
                      return (
                        <div 
                          key={teacher.id}
                          className="rounded-lg border bg-muted/30 overflow-hidden"
                        >
                          <div className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-3">
                              <div>
                                <div className="font-medium">{teacher.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {teacher.employmentType === "regular" ? "정규 선생님" : "파트타임 선생님"}
                                  {isPartTime && (
                                    <span className="ml-1 text-xs">
                                      ({partTimeWageType === "hourly" ? "시급제" : "비율제"})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isPartTime && (
                                <div className="flex rounded-md border overflow-hidden" data-testid={`toggle-pt-wage-type-${teacher.id}`}>
                                  <button
                                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                      partTimeWageType !== "hourly"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-background text-muted-foreground hover:bg-muted"
                                    }`}
                                    onClick={() => {
                                      if (partTimeWageType !== "monthly") {
                                        updateWageSettingsMutation.mutate({
                                          teacherId: teacher.id,
                                          wageType: "monthly",
                                        });
                                      }
                                    }}
                                    data-testid={`button-pt-percentage-${teacher.id}`}
                                  >
                                    비율제
                                  </button>
                                  <button
                                    className={`px-3 py-1.5 text-xs font-medium transition-colors border-l ${
                                      partTimeWageType === "hourly"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-background text-muted-foreground hover:bg-muted"
                                    }`}
                                    onClick={() => {
                                      if (partTimeWageType !== "hourly") {
                                        updateWageSettingsMutation.mutate({
                                          teacherId: teacher.id,
                                          wageType: "hourly",
                                        });
                                      }
                                    }}
                                    data-testid={`button-pt-hourly-${teacher.id}`}
                                  >
                                    시급
                                  </button>
                                </div>
                              )}
                              {!isPartTimeHourly && (
                                <>
                                  {!settings && (
                                    <span className="text-sm text-muted-foreground mr-2">설정 없음</span>
                                  )}
                                  {settings && (
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => setExpandedSalaryBreakdownTeacherId(isExpanded ? null : teacher.id)}
                                      data-testid={`button-salary-breakdown-${teacher.id}`}
                                    >
                                      <Calculator className="h-4 w-4 mr-1" />
                                      산정내역
                                      <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                    </Button>
                                  )}
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => openSalarySettings(teacher.id)}
                                    data-testid={`button-salary-settings-${teacher.id}`}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    설정
                                  </Button>
                                </>
                              )}
                              {isPartTimeHourly && (
                                <>
                                  {teacher.hourlyRate && (
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => setExpandedSalaryBreakdownTeacherId(isExpanded ? null : teacher.id)}
                                      data-testid={`button-pt-hourly-breakdown-${teacher.id}`}
                                    >
                                      <Calculator className="h-4 w-4 mr-1" />
                                      산정내역
                                      <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                    </Button>
                                  )}
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      setEditingWageTeacherId(teacher.id);
                                      setEditingWageType("hourly");
                                      setEditingHourlyRateValue(teacher.hourlyRate || 0);
                                      const tClasses = allCenterClasses.filter((c: any) => c.teacherId === teacher.id || isAssistantTeacher(c, teacher.id));
                                      const hasIndividual = tClasses.some((c: any) => c.hourlyRate);
                                      setEditingClassRateMode(hasIndividual ? "individual" : "bulk");
                                      const rates: Record<string, string> = {};
                                      for (const c of tClasses) rates[c.id] = c.hourlyRate ? String(c.hourlyRate) : "";
                                      setEditingClassRates(rates);
                                    }}
                                    data-testid={`button-edit-pt-hourly-${teacher.id}`}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    시급설정
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          {isPartTimeHourly && editingWageTeacherId === teacher.id && (
                            <div className="border-t p-3 space-y-3">
                              <div className="flex items-center gap-2">
                                <Label className="text-sm w-20">적용방식</Label>
                                <div className="flex rounded-md border overflow-hidden">
                                  <button
                                    type="button"
                                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${editingClassRateMode === "bulk" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                                    onClick={() => setEditingClassRateMode("bulk")}
                                    data-testid={`button-pt-rate-mode-bulk-${teacher.id}`}
                                  >
                                    일괄적용
                                  </button>
                                  <button
                                    type="button"
                                    className={`px-3 py-1.5 text-xs font-medium transition-colors border-l ${editingClassRateMode === "individual" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                                    onClick={() => setEditingClassRateMode("individual")}
                                    data-testid={`button-pt-rate-mode-individual-${teacher.id}`}
                                  >
                                    별도적용
                                  </button>
                                </div>
                              </div>

                              {editingClassRateMode === "bulk" ? (
                                <div className="flex items-center gap-2">
                                  <Label className="text-sm w-20">시급</Label>
                                  <Input
                                    type="number"
                                    value={editingHourlyRateValue}
                                    onChange={(e) => setEditingHourlyRateValue(parseInt(e.target.value) || 0)}
                                    className="w-32"
                                    placeholder="시급"
                                    data-testid={`input-pt-hourly-rate-${teacher.id}`}
                                  />
                                  <span className="text-sm text-muted-foreground">원</span>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Label className="text-sm w-20">기본 시급</Label>
                                    <Input
                                      type="number"
                                      value={editingHourlyRateValue}
                                      onChange={(e) => setEditingHourlyRateValue(parseInt(e.target.value) || 0)}
                                      className="w-32"
                                      placeholder="기본 시급"
                                      data-testid={`input-pt-default-hourly-rate-${teacher.id}`}
                                    />
                                    <span className="text-xs text-muted-foreground">미설정 수업에 적용</span>
                                  </div>
                                  {(() => {
                                    const tClasses = allCenterClasses.filter((c: any) => c.teacherId === teacher.id || isAssistantTeacher(c, teacher.id));
                                    if (tClasses.length === 0) return <p className="text-xs text-muted-foreground">배정된 수업이 없습니다</p>;
                                    return tClasses.map((cls: any) => (
                                      <div key={cls.id} className="flex items-center gap-2">
                                        <span className="text-sm w-32 truncate">{cls.name} {cls.subject}{isAssistantTeacher(cls, teacher.id) && cls.teacherId !== teacher.id ? " (부담임)" : ""}</span>
                                        <Input
                                          type="number"
                                          placeholder={String(editingHourlyRateValue || teacher.hourlyRate || 0)}
                                          value={editingClassRates[cls.id] || ""}
                                          onChange={(e) => setEditingClassRates(prev => ({ ...prev, [cls.id]: e.target.value }))}
                                          className="w-28"
                                          data-testid={`input-pt-class-rate-${cls.id}`}
                                        />
                                        <span className="text-xs text-muted-foreground">원</span>
                                      </div>
                                    ));
                                  })()}
                                </div>
                              )}

                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    const tClasses = allCenterClasses.filter((c: any) => c.teacherId === teacher.id || isAssistantTeacher(c, teacher.id));
                                    let classRatesPayload: any[] | undefined = undefined;
                                    let classRateModePayload: string | undefined = undefined;
                                    if (editingClassRateMode === "individual") {
                                      classRateModePayload = "individual";
                                      classRatesPayload = Object.entries(editingClassRates).map(([classId, val]) => ({
                                        classId,
                                        hourlyRate: val !== "" && val != null ? parseInt(val) : null,
                                      }));
                                    } else if (tClasses.length > 0) {
                                      classRateModePayload = "bulk";
                                      classRatesPayload = tClasses.map((c: any) => ({ classId: c.id, hourlyRate: null }));
                                    }
                                    updateWageSettingsMutation.mutate({
                                      teacherId: teacher.id,
                                      wageType: "hourly",
                                      hourlyRate: editingHourlyRateValue,
                                      classRates: classRatesPayload,
                                      classRateMode: classRateModePayload,
                                    } as any);
                                    setEditingWageTeacherId(null);
                                  }}
                                  disabled={updateWageSettingsMutation.isPending}
                                  data-testid={`button-save-pt-hourly-${teacher.id}`}
                                >
                                  저장
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingWageTeacherId(null)}
                                  data-testid={`button-cancel-pt-hourly-${teacher.id}`}
                                >
                                  취소
                                </Button>
                              </div>
                            </div>
                          )}
                          {isPartTimeHourly && editingWageTeacherId !== teacher.id && (
                            <div className="border-t p-3 text-sm space-y-1">
                              <div className="flex gap-2">
                                <span className="text-muted-foreground">시급:</span>
                                <span className="font-medium">{teacher.hourlyRate ? formatBudget(teacher.hourlyRate) : "미설정"}</span>
                              </div>
                            </div>
                          )}
                          {isPartTimeHourly && isExpanded && teacher.hourlyRate && (
                            <HourlySalaryBreakdownPanel
                              teacherId={teacher.id}
                              teacherName={teacher.name}
                              hourlyRate={teacher.hourlyRate}
                              yearMonth={salaryBreakdownYearMonth}
                              centerId={selectedCenter?.id || ""}
                            />
                          )}
                          {!isPartTimeHourly && isExpanded && settings && (
                            <div className="border-t p-3 bg-background">
                              <SalaryBreakdownPanel 
                                teacherId={teacher.id} 
                                yearMonth={salaryBreakdownYearMonth}
                                centerId={selectedCenter?.id || ""}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hourly Teacher Wage Settings */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    아르바이트 급여 설정
                  </CardTitle>
                  <CardDescription>
                    아르바이트 선생님의 시급을 설정합니다
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {allTeachersForSalary.filter(t => t.employmentType === "hourly").length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  아르바이트 선생님이 없습니다
                </div>
              ) : (
                <div className="space-y-3">
                  {allTeachersForSalary
                    .filter(t => t.employmentType === "hourly")
                    .map(teacher => {
                      const isEditing = editingWageTeacherId === teacher.id;
                      const isExpanded = expandedSalaryBreakdownTeacherId === teacher.id;
                      return (
                        <div 
                          key={teacher.id}
                          className="p-4 rounded-lg border bg-muted/30 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{teacher.name}</div>
                              <div className="text-sm text-muted-foreground">아르바이트 선생님</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!isEditing && teacher.hourlyRate && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setExpandedSalaryBreakdownTeacherId(isExpanded ? null : teacher.id)}
                                  data-testid={`button-hourly-breakdown-${teacher.id}`}
                                >
                                  <Calculator className="h-4 w-4 mr-1" />
                                  산정내역
                                  <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                </Button>
                              )}
                              {!isEditing && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setEditingWageTeacherId(teacher.id);
                                    setEditingWageType("hourly");
                                    setEditingHourlyRateValue(teacher.hourlyRate || 0);
                                    const tClasses = allCenterClasses.filter((c: any) => c.teacherId === teacher.id || isAssistantTeacher(c, teacher.id));
                                    const hasIndividual = tClasses.some((c: any) => c.hourlyRate);
                                    setEditingClassRateMode(hasIndividual ? "individual" : "bulk");
                                    const rates: Record<string, string> = {};
                                    for (const c of tClasses) rates[c.id] = c.hourlyRate ? String(c.hourlyRate) : "";
                                    setEditingClassRates(rates);
                                  }}
                                  data-testid={`button-edit-wage-${teacher.id}`}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  수정
                                </Button>
                              )}
                            </div>
                          </div>

                          {isEditing ? (
                            <div className="space-y-4 border-t pt-3">
                              <div className="flex items-center gap-2">
                                <Label className="text-sm w-20">적용방식</Label>
                                <div className="flex rounded-md border overflow-hidden">
                                  <button
                                    type="button"
                                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${editingClassRateMode === "bulk" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                                    onClick={() => setEditingClassRateMode("bulk")}
                                    data-testid={`button-rate-mode-bulk-${teacher.id}`}
                                  >
                                    일괄적용
                                  </button>
                                  <button
                                    type="button"
                                    className={`px-3 py-1.5 text-xs font-medium transition-colors border-l ${editingClassRateMode === "individual" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                                    onClick={() => setEditingClassRateMode("individual")}
                                    data-testid={`button-rate-mode-individual-${teacher.id}`}
                                  >
                                    별도적용
                                  </button>
                                </div>
                              </div>

                              {editingClassRateMode === "bulk" ? (
                                <div className="flex items-center gap-2">
                                  <Label className="text-sm w-20">시급</Label>
                                  <Input
                                    type="number"
                                    value={editingHourlyRateValue}
                                    onChange={(e) => setEditingHourlyRateValue(parseInt(e.target.value) || 0)}
                                    className="w-32"
                                    placeholder="시급"
                                    data-testid={`input-hourly-rate-${teacher.id}`}
                                  />
                                  <span className="text-sm text-muted-foreground">원</span>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground">수업별로 시급을 개별 설정합니다. 기본 시급: {formatBudget(teacher.hourlyRate || editingHourlyRateValue)}</p>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Label className="text-sm w-20">기본 시급</Label>
                                    <Input
                                      type="number"
                                      value={editingHourlyRateValue}
                                      onChange={(e) => setEditingHourlyRateValue(parseInt(e.target.value) || 0)}
                                      className="w-32"
                                      placeholder="기본 시급"
                                      data-testid={`input-default-hourly-rate-${teacher.id}`}
                                    />
                                    <span className="text-xs text-muted-foreground">별도 시급 미설정 수업에 적용</span>
                                  </div>
                                  {(() => {
                                    const tClasses = allCenterClasses.filter((c: any) => c.teacherId === teacher.id || isAssistantTeacher(c, teacher.id));
                                    if (tClasses.length === 0) return <p className="text-xs text-muted-foreground">배정된 수업이 없습니다</p>;
                                    return tClasses.map((cls: any) => (
                                      <div key={cls.id} className="flex items-center gap-2">
                                        <span className="text-sm w-32 truncate">{cls.name} {cls.subject}{isAssistantTeacher(cls, teacher.id) && cls.teacherId !== teacher.id ? " (부담임)" : ""}</span>
                                        <Input
                                          type="number"
                                          placeholder={String(editingHourlyRateValue || teacher.hourlyRate || 0)}
                                          value={editingClassRates[cls.id] || ""}
                                          onChange={(e) => setEditingClassRates(prev => ({ ...prev, [cls.id]: e.target.value }))}
                                          className="w-28"
                                          data-testid={`input-class-rate-edit-${cls.id}`}
                                        />
                                        <span className="text-xs text-muted-foreground">원</span>
                                      </div>
                                    ));
                                  })()}
                                </div>
                              )}

                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    const tClasses = allCenterClasses.filter((c: any) => c.teacherId === teacher.id || isAssistantTeacher(c, teacher.id));
                                    let classRatesPayload: any[] | undefined = undefined;
                                    let classRateModePayload: string | undefined = undefined;
                                    if (editingClassRateMode === "individual") {
                                      classRateModePayload = "individual";
                                      classRatesPayload = Object.entries(editingClassRates).map(([classId, val]) => ({
                                        classId,
                                        hourlyRate: val !== "" && val != null ? parseInt(val) : null,
                                      }));
                                    } else if (tClasses.length > 0) {
                                      classRateModePayload = "bulk";
                                      classRatesPayload = tClasses.map((c: any) => ({ classId: c.id, hourlyRate: null }));
                                    }
                                    updateWageSettingsMutation.mutate({
                                      teacherId: teacher.id,
                                      wageType: "hourly",
                                      hourlyRate: editingHourlyRateValue,
                                      classRates: classRatesPayload,
                                      classRateMode: classRateModePayload,
                                    } as any);
                                    setEditingWageTeacherId(null);
                                  }}
                                  disabled={updateWageSettingsMutation.isPending}
                                  data-testid={`button-save-wage-${teacher.id}`}
                                >
                                  저장
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingWageTeacherId(null)}
                                  data-testid={`button-cancel-wage-${teacher.id}`}
                                >
                                  취소
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm space-y-1 border-t pt-2">
                              <div className="flex gap-2">
                                <span className="text-muted-foreground">시급:</span>
                                <span className="font-medium">{teacher.hourlyRate ? formatBudget(teacher.hourlyRate) : "미설정"}</span>
                              </div>
                            </div>
                          )}
                          {isExpanded && teacher.hourlyRate && (
                            <HourlySalaryBreakdownPanel
                              teacherId={teacher.id}
                              teacherName={teacher.name}
                              hourlyRate={teacher.hourlyRate}
                              yearMonth={salaryBreakdownYearMonth}
                              centerId={selectedCenter?.id || ""}
                            />
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance" className="mt-6 space-y-6">
          {/* Unified Year/Month Selector */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-sm font-medium text-muted-foreground">조회 기간</div>
                <Select
                  value={String(financeYear)}
                  onValueChange={(v) => {
                    const newYear = Number(v);
                    setFinanceYear(newYear);
                    const monthPart = selectedFinanceMonth.slice(5) || "01";
                    setSelectedFinanceMonth(`${newYear}-${monthPart}`);
                  }}
                >
                  <SelectTrigger className="w-28" data-testid="select-finance-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
                      <SelectItem key={y} value={String(y)}>{y}년</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedFinanceMonth.slice(5) || "01"}
                  onValueChange={(mm) => setSelectedFinanceMonth(`${financeYear}-${mm}`)}
                >
                  <SelectTrigger className="w-24" data-testid="select-finance-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => {
                      const mm = String(i + 1).padStart(2, "0");
                      return (
                        <SelectItem key={mm} value={mm}>{i + 1}월</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(() => {
              const selectedRecord = financeRecords.find(r => r.yearMonth === selectedFinanceMonth);
              const monthMarketing = marketingByMonth.get(selectedFinanceMonth) || 0;
              const summary = calculateFinanceSummary(selectedRecord || null, monthMarketing);
              return (
                <>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">매출</div>
                      <div className="text-2xl font-bold text-primary">
                        {formatBudget(summary.revenue)}
                      </div>
                      <div className="text-xs text-muted-foreground">수강료</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">인건비</div>
                      <div className="text-2xl font-bold text-orange-600">
                        {formatBudget(summary.laborCost)}
                      </div>
                      <div className="text-xs text-muted-foreground">정규/파트/알바 급여 + 4대보험</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">판관비</div>
                      <div className="text-2xl font-bold text-amber-600">
                        {formatBudget(summary.operatingExpense)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        운영 비용
                        {monthMarketing > 0 && (
                          <span> · 마케팅 {formatBudget(monthMarketing)} 포함</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">영업이익</div>
                      <div className={`text-2xl font-bold ${summary.operatingProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {summary.operatingProfit >= 0 ? '+' : ''}{formatBudget(summary.operatingProfit)}
                      </div>
                      <div className="text-xs text-muted-foreground">매출 - 인건비 - 판관비</div>
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </div>

          {/* Monthly Chart */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  월별 재무 현황 ({financeYear}년)
                </CardTitle>
                <CardDescription>
                  매출, 인건비, 판관비, 영업이익 추이
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {loadingFinance ? (
                <Skeleton className="h-64 w-full" />
              ) : financeChartData.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={financeChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis 
                        tickFormatter={(v) => formatBudget(v)} 
                        className="text-xs"
                        width={80}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [formatBudget(value), name]}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Legend />
                      <Bar dataKey="매출" fill="#3B82F6" />
                      <Bar dataKey="인건비" fill="#F97316" />
                      <Bar dataKey="판관비" fill="#F59E0B" />
                      <Line type="monotone" dataKey="영업이익" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <DollarSign className="h-10 w-10" />
                  <p>{financeYear}년 재무 기록이 없습니다</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly Records Table */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    월별 재무 기록 ({formatMonth(selectedFinanceMonth)})
                  </CardTitle>
                  <CardDescription>
                    월별 수입/지출 항목을 관리합니다
                  </CardDescription>
                </div>
                {!financeRecords.find(r => r.yearMonth === selectedFinanceMonth) && (
                  <Button
                    onClick={() => openNewFinance(selectedFinanceMonth)}
                    data-testid="button-add-finance"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    등록
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const record = financeRecords.find(r => r.yearMonth === selectedFinanceMonth);
                if (!record) {
                  return (
                    <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <DollarSign className="h-10 w-10" />
                      <p>{formatMonth(selectedFinanceMonth)} 재무 기록이 없습니다</p>
                      <Button variant="outline" onClick={() => openNewFinance(selectedFinanceMonth)}>
                        <Plus className="h-4 w-4 mr-1" />
                        재무 기록 등록
                      </Button>
                    </div>
                  );
                }
                
                const monthMarketing = marketingByMonth.get(record.yearMonth) || 0;
                const monthCampaigns = financeMarketingCampaigns.filter(c => String(c.startDate || "").slice(0, 7) === record.yearMonth);
                const summary = calculateFinanceSummary(record, monthMarketing);
                const { revenue: parsedRevenue, expenses: parsedExpenses } = parseItemsFromRecord(record);
                
                return (
                  <div className="space-y-6">
                    {/* Revenue Section */}
                    <div className="border-2 border-primary/30 rounded-lg p-4 bg-primary/5">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-primary" />
                          매출
                          <Badge className="ml-2">{formatBudget(summary.revenue)}</Badge>
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => syncTuitionMutation.mutate()}
                            disabled={syncTuitionMutation.isPending}
                            data-testid="button-sync-tuition"
                          >
                            <RefreshCw className={`h-3 w-3 mr-1 ${syncTuitionMutation.isPending ? 'animate-spin' : ''}`} />
                            교육비 동기화
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setFinanceDialogTab("revenue");
                              openEditFinance(record);
                            }}
                            data-testid="button-edit-revenue"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            수정
                          </Button>
                        </div>
                      </div>
                      {parsedRevenue.length > 0 ? (
                        <div className="space-y-1">
                          {parsedRevenue.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-background rounded px-3 py-2">
                              <div className="flex items-center gap-2">
                                {item.studentId ? (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button className="text-left hover:underline cursor-pointer">
                                        <span className="font-medium">{item.name}</span>
                                        {(item.school || item.grade) && (
                                          <span className="text-muted-foreground text-sm ml-2">
                                            {item.school} {item.grade}
                                          </span>
                                        )}
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64">
                                      <div className="space-y-2">
                                        <div className="font-medium">{item.name} 수강 수업</div>
                                        {item.classes && item.classes.length > 0 ? (
                                          <ul className="space-y-1 text-sm">
                                            {item.classes.map((cls) => (
                                              <li key={cls.id} className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-xs">{cls.subject}</Badge>
                                                {cls.name}
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <p className="text-sm text-muted-foreground">수강 수업 없음</p>
                                        )}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                ) : (
                                  <span>{item.name || '(항목명 없음)'}</span>
                                )}
                              </div>
                              <span className="font-medium">{formatBudget(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">(세부 항목 없음)</p>
                      )}
                    </div>

                    {/* Expense Section */}
                    <div className="border-2 border-destructive/30 rounded-lg p-4 bg-destructive/5">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <Briefcase className="h-5 w-5 text-destructive" />
                          지출
                          <Badge variant="destructive" className="ml-2">{formatBudget(summary.laborCost + summary.operatingExpense)}</Badge>
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setFinanceDialogTab("expense");
                              openEditFinance(record);
                              setPendingSalarySync(true);
                            }}
                            disabled={syncingAllSalaries}
                            data-testid="button-sync-labor-cost"
                          >
                            <RefreshCw className={`h-3 w-3 mr-1 ${syncingAllSalaries ? 'animate-spin' : ''}`} />
                            인건비 동기화
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setFinanceDialogTab("expense");
                              openEditFinance(record);
                            }}
                            data-testid="button-edit-expense"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            수정
                          </Button>
                        </div>
                      </div>
                      {parsedExpenses.length > 0 ? (
                        <div className="space-y-1">
                          {parsedExpenses.map((item, idx) => (
                            <div key={idx} className="flex justify-between bg-background rounded px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">{getCategoryLabel(item.category)}</Badge>
                                <span>{(item.name || '(항목명 없음)').replace(/\s*\([^)]*\)/g, '')}</span>
                              </div>
                              <span className="font-medium">{formatBudget(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">(세부 항목 없음)</p>
                      )}
                      
                      {/* Category Summary */}
                      {parsedExpenses.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="font-medium mb-2 text-sm">분류별 합계</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                            {expenseCategories.map(cat => {
                              const total = parsedExpenses.filter(e => e.category === cat.key).reduce((sum, e) => sum + e.amount, 0);
                              if (total === 0) return null;
                              return (
                                <div key={cat.key} className="flex justify-between bg-muted/50 rounded px-2 py-1">
                                  <span className="text-muted-foreground">{cat.label}</span>
                                  <span className="font-medium">{formatBudget(total)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Marketing Campaign Expenses (마케팅 탭에서 자동 합산) */}
                      {monthMarketing > 0 && (
                        <div className="mt-4 pt-4 border-t" data-testid="section-marketing-expenses">
                          <h4 className="font-medium mb-2 text-sm flex items-center gap-2">
                            마케팅 캠페인 비용
                            <Badge variant="secondary" className="text-xs">{formatBudget(monthMarketing)}</Badge>
                          </h4>
                          <p className="text-xs text-muted-foreground mb-2">
                            마케팅 탭에서 등록된 캠페인의 예산이 시작월 기준으로 판관비에 자동 합산됩니다.
                          </p>
                          <div className="space-y-1">
                            {monthCampaigns.map((c) => (
                              <div
                                key={c.id}
                                className="flex justify-between bg-background rounded px-3 py-2"
                                data-testid={`row-marketing-campaign-${c.id}`}
                              >
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">{c.channel}</Badge>
                                  <span>{c.name}</span>
                                </div>
                                <span className="font-medium">{formatBudget(c.budget)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Summary */}
                    <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">총 지출</div>
                          <div className="text-xl font-bold">
                            {formatBudget(summary.laborCost + summary.operatingExpense)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">영업이익</div>
                          <div className={`text-xl font-bold ${summary.operatingProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                            {summary.operatingProfit >= 0 ? '+' : ''}{formatBudget(summary.operatingProfit)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm(`${formatMonth(record.yearMonth)} 재무 기록을 삭제하시겠습니까?`)) {
                            deleteFinanceMutation.mutate(record.id);
                          }
                        }}
                        data-testid="button-delete-finance"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        삭제
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Finance Dialog */}
          <Dialog open={showFinanceDialog} onOpenChange={setShowFinanceDialog}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingFinance ? `${formatMonth(editingFinance.yearMonth)} 재무 수정` : `${formatMonth(selectedFinanceMonth)} 재무 등록`}
                </DialogTitle>
              </DialogHeader>
              
              {/* Tab Buttons */}
              <div className="flex gap-2 border-b pb-2">
                <Button
                  variant={financeDialogTab === "revenue" ? "default" : "outline"}
                  onClick={() => setFinanceDialogTab("revenue")}
                  className="flex-1"
                  data-testid="button-tab-revenue"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  매출
                  <Badge variant="secondary" className="ml-2">
                    {formatBudget(calculateRevenueTotal())}
                  </Badge>
                </Button>
                <Button
                  variant={financeDialogTab === "expense" ? "destructive" : "outline"}
                  onClick={() => setFinanceDialogTab("expense")}
                  className="flex-1"
                  data-testid="button-tab-expense"
                >
                  <Briefcase className="h-4 w-4 mr-2" />
                  지출
                  <Badge variant="secondary" className="ml-2">
                    {formatBudget(calculateExpenseTotal())}
                  </Badge>
                </Button>
              </div>

              <div className="space-y-6 py-4">
                {/* Revenue Section - 매출 */}
                {financeDialogTab === "revenue" && (
                  <div className="border-2 border-primary/30 rounded-lg p-4 bg-primary/5">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        매출 항목
                      </h3>
                      <Button size="sm" onClick={addRevenueItem} data-testid="button-add-revenue">
                        <Plus className="h-3 w-3 mr-1" />
                        매출 추가
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {revenueItems.map((item, index) => (
                        <div key={index} className="flex flex-wrap items-center gap-2 bg-background rounded p-2">
                          <Input
                            placeholder="매출 항목명 (예: 수강료, 교재판매)"
                            value={item.name}
                            onChange={(e) => updateRevenueItem(index, "name", e.target.value)}
                            className="flex-1 min-w-[140px]"
                            data-testid={`input-revenue-name-${index}`}
                          />
                          <div className="flex items-center gap-2 shrink-0">
                            <Input
                              type="number"
                              placeholder="금액"
                              value={item.amount || ""}
                              onChange={(e) => updateRevenueItem(index, "amount", e.target.value)}
                              className="w-28 sm:w-32"
                              data-testid={`input-revenue-amount-${index}`}
                            />
                            <span className="text-sm text-muted-foreground">원</span>
                            <Button size="icon" variant="ghost" onClick={() => removeRevenueItem(index)} data-testid={`button-remove-revenue-${index}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {revenueItems.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">매출 추가 버튼을 눌러 수강료 등을 입력하세요</p>
                      )}
                    </div>
                    {revenueItems.length > 0 && (
                      <div className="mt-4 pt-4 border-t flex justify-end">
                        <div className="text-lg font-bold text-primary">
                          합계: {formatBudget(calculateRevenueTotal())}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Expense Section - 지출 */}
                {financeDialogTab === "expense" && (
                  <div className="space-y-4">
                    {/* 인건비 섹션 */}
                    <div className="border-2 border-orange-400/30 rounded-lg p-4 bg-orange-50/50 dark:bg-orange-950/20">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          <Users className="h-5 w-5 text-orange-600" />
                          인건비
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setExpenseItems(prev => [...prev, { name: "", amount: 0, category: "expenseRegularSalary" }])}
                            data-testid="button-add-labor-expense"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            인건비 추가
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={addAllTeacherSalaryExpenses}
                            disabled={syncingAllSalaries || loadingTeachers}
                            data-testid="button-sync-all-salary"
                          >
                            <RefreshCw className={`h-3 w-3 mr-1 ${syncingAllSalaries ? 'animate-spin' : ''}`} />
                            {syncingAllSalaries ? "계산 중..." : "전체 급여 동기화"}
                          </Button>
                          <Select 
                            value={selectedSalaryTeacher} 
                            onValueChange={(v) => {
                              setSelectedSalaryTeacher(v);
                              addTeacherSalaryExpense(v);
                            }}
                          >
                            <SelectTrigger className="w-48" data-testid="select-add-teacher-salary">
                              <SelectValue placeholder={loadingTeachers ? "불러오는 중..." : "개별 추가"} />
                            </SelectTrigger>
                            <SelectContent>
                              {teacherList.length === 0 ? (
                                <SelectItem value="__none" disabled>선생님이 없습니다</SelectItem>
                              ) : (
                                teacherList.map(t => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.name} ({t.employmentType === "regular" ? "정규직" : t.employmentType === "part_time" ? "파트타임" : "아르바이트"})
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "인건비").map((item, _) => {
                          const actualIndex = expenseItems.findIndex(e => e === item);
                          return (
                            <div key={actualIndex} className="flex flex-wrap items-center gap-2 bg-background rounded p-2">
                              <Select
                                value={item.category}
                                onValueChange={(value) => updateExpenseItem(actualIndex, "category", value)}
                              >
                                <SelectTrigger className="w-36" data-testid={`select-expense-category-${actualIndex}`}>
                                  <SelectValue placeholder="분류 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  {expenseCategories.filter(c => c.group === "인건비").map(cat => (
                                    <SelectItem key={cat.key} value={cat.key}>{cat.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                placeholder="선생님 이름"
                                value={item.name}
                                onChange={(e) => updateExpenseItem(actualIndex, "name", e.target.value)}
                                className="flex-1 min-w-[120px]"
                                data-testid={`input-expense-name-${actualIndex}`}
                              />
                              <div className="flex items-center gap-2 shrink-0">
                                <Input
                                  type="number"
                                  placeholder="금액"
                                  value={item.amount || ""}
                                  onChange={(e) => updateExpenseItem(actualIndex, "amount", e.target.value)}
                                  className="w-28 sm:w-32"
                                  data-testid={`input-expense-amount-${actualIndex}`}
                                />
                                <span className="text-sm text-muted-foreground">원</span>
                                <Button size="icon" variant="ghost" onClick={() => removeExpenseItem(actualIndex)} data-testid={`button-remove-expense-${actualIndex}`}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        {expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "인건비").length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-3">인건비 추가 버튼 또는 급여 동기화로 인건비를 입력하세요</p>
                        )}
                      </div>
                      {/* 인건비 소계 */}
                      {expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "인건비").length > 0 && (
                        <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-800 flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">인건비 소계</span>
                          <span className="font-bold text-orange-600">{formatBudget(
                            expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "인건비")
                              .reduce((sum, item) => sum + (item.amount || 0), 0)
                          )}</span>
                        </div>
                      )}
                    </div>

                    {/* 고정비 섹션 - 매달 유지되는 금액 */}
                    <div className="border-2 border-blue-400/30 rounded-lg p-4 bg-blue-50/50 dark:bg-blue-950/20">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-blue-600" />
                          고정비 (매월 유지)
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" variant="outline" onClick={importPreviousMonthFixedExpenses} data-testid="button-import-prev-fixed-expense">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            이전달 고정비 가져오기
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setExpenseItems(prev => [...prev, { name: "", amount: 0, category: "expenseRent" }])} data-testid="button-add-fixed-expense">
                            <Plus className="h-3 w-3 mr-1" />
                            고정비 추가
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "고정비").map((item, _) => {
                          const actualIndex = expenseItems.findIndex(e => e === item);
                          return (
                            <div key={actualIndex} className="flex flex-wrap items-center gap-2 bg-background rounded p-2">
                              <Select
                                value={item.category}
                                onValueChange={(value) => updateExpenseItem(actualIndex, "category", value)}
                              >
                                <SelectTrigger className="w-36" data-testid={`select-expense-category-${actualIndex}`}>
                                  <SelectValue placeholder="분류 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  {expenseCategories.filter(c => c.group === "고정비").map(cat => (
                                    <SelectItem key={cat.key} value={cat.key}>{cat.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                placeholder="지출처 (예: 건물주, 한국전력)"
                                value={item.name}
                                onChange={(e) => updateExpenseItem(actualIndex, "name", e.target.value)}
                                className="flex-1 min-w-[120px]"
                                data-testid={`input-expense-name-${actualIndex}`}
                              />
                              <div className="flex items-center gap-2 shrink-0">
                                <Input
                                  type="number"
                                  placeholder="금액"
                                  value={item.amount || ""}
                                  onChange={(e) => updateExpenseItem(actualIndex, "amount", e.target.value)}
                                  className="w-28 sm:w-32"
                                  data-testid={`input-expense-amount-${actualIndex}`}
                                />
                                <span className="text-sm text-muted-foreground">원</span>
                                <Button size="icon" variant="ghost" onClick={() => removeExpenseItem(actualIndex)} data-testid={`button-remove-expense-${actualIndex}`}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        {expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "고정비").length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-3">'이전달 고정비 가져오기'로 직전 달 항목을 불러오거나, '고정비 추가'로 임대료·통신비 등 매월 발생하는 지출을 입력하세요</p>
                        )}
                      </div>
                      {/* 고정비 소계 */}
                      {expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "고정비").length > 0 && (
                        <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">고정비 소계</span>
                          <span className="font-bold text-blue-600">{formatBudget(
                            expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "고정비")
                              .reduce((sum, item) => sum + (item.amount || 0), 0)
                          )}</span>
                        </div>
                      )}
                    </div>

                    {/* 판관비 섹션 */}
                    <div className="border-2 border-amber-400/30 rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/20">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          <Briefcase className="h-5 w-5 text-amber-600" />
                          판관비 (판매/관리비)
                        </h3>
                        <Button size="sm" variant="outline" onClick={() => setExpenseItems(prev => [...prev, { name: "", amount: 0, category: "expenseWelfare" }])} data-testid="button-add-operating-expense">
                          <Plus className="h-3 w-3 mr-1" />
                          판관비 추가
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "판관비").map((item, _) => {
                          const actualIndex = expenseItems.findIndex(e => e === item);
                          return (
                            <div key={actualIndex} className="flex flex-wrap items-center gap-2 bg-background rounded p-2">
                              <Select
                                value={item.category}
                                onValueChange={(value) => updateExpenseItem(actualIndex, "category", value)}
                              >
                                <SelectTrigger className="w-36" data-testid={`select-expense-category-${actualIndex}`}>
                                  <SelectValue placeholder="분류 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  {expenseCategories.filter(c => c.group === "판관비").map(cat => (
                                    <SelectItem key={cat.key} value={cat.key}>{cat.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                placeholder="지출처 (예: 한국전력, 임대인)"
                                value={item.name}
                                onChange={(e) => updateExpenseItem(actualIndex, "name", e.target.value)}
                                className="flex-1 min-w-[120px]"
                                data-testid={`input-expense-name-${actualIndex}`}
                              />
                              <div className="flex items-center gap-2 shrink-0">
                                <Input
                                  type="number"
                                  placeholder="금액"
                                  value={item.amount || ""}
                                  onChange={(e) => updateExpenseItem(actualIndex, "amount", e.target.value)}
                                  className="w-28 sm:w-32"
                                  data-testid={`input-expense-amount-${actualIndex}`}
                                />
                                <span className="text-sm text-muted-foreground">원</span>
                                <Button size="icon" variant="ghost" onClick={() => removeExpenseItem(actualIndex)} data-testid={`button-remove-expense-${actualIndex}`}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        {expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "판관비").length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-3">판관비 추가 버튼으로 기타 지출을 입력하세요</p>
                        )}
                      </div>
                      {/* 판관비 소계 */}
                      {expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "판관비").length > 0 && (
                        <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800 flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">판관비 소계</span>
                          <span className="font-bold text-amber-600">{formatBudget(
                            expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "판관비")
                              .reduce((sum, item) => sum + (item.amount || 0), 0)
                          )}</span>
                        </div>
                      )}
                    </div>

                    {/* 지출 총합계 */}
                    {expenseItems.length > 0 && (
                      <div className="bg-destructive/10 rounded-lg p-3 flex justify-between items-center">
                        <span className="font-medium">총 지출</span>
                        <span className="text-xl font-bold text-destructive">{formatBudget(calculateExpenseTotal())}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Summary - Always visible */}
                <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-sm text-muted-foreground">총 매출</div>
                      <div className="text-xl font-bold text-primary">{formatBudget(calculateRevenueTotal())}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">총 지출</div>
                      <div className="text-xl font-bold text-destructive">{formatBudget(calculateExpenseTotal())}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">영업이익</div>
                      <div className={`text-xl font-bold ${calculateRevenueTotal() - calculateExpenseTotal() >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {calculateRevenueTotal() - calculateExpenseTotal() >= 0 ? '+' : ''}{formatBudget(calculateRevenueTotal() - calculateExpenseTotal())}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowFinanceDialog(false)}>
                  취소
                </Button>
                <Button
                  onClick={handleSaveFinance}
                  disabled={createFinanceMutation.isPending || updateFinanceMutation.isPending}
                  data-testid="button-save-finance"
                >
                  {createFinanceMutation.isPending || updateFinanceMutation.isPending ? "저장 중..." : "저장"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="marketing" className="mt-6 space-y-6">
          {/* Year-over-Year Comparison Chart */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    마케팅 예산 비교
                  </CardTitle>
                  <CardDescription>
                    올해 vs 작년 월별 마케팅 비용 비교
                  </CardDescription>
                </div>
                <Button
                  onClick={() => {
                    resetCampaignForm();
                    setEditingCampaign(null);
                    setShowCampaignDialog(true);
                  }}
                  data-testid="button-add-campaign"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  캠페인 추가
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingMarketing ? (
                <Skeleton className="h-64 w-full" />
              ) : marketingComparison ? (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">올해 총 비용</div>
                        <div className="text-2xl font-bold text-primary">
                          {formatBudget(marketingComparison.currentYearTotal)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {marketingComparison.currentYearCampaigns.length}개 캠페인
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">작년 총 비용</div>
                        <div className="text-2xl font-bold">
                          {formatBudget(marketingComparison.lastYearTotal)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {marketingComparison.lastYearCampaigns.length}개 캠페인
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">전년 대비</div>
                        {marketingComparison.lastYearTotal > 0 ? (
                          <>
                            <div className={`text-2xl font-bold flex items-center gap-1 ${
                              marketingComparison.currentYearTotal > marketingComparison.lastYearTotal 
                                ? "text-destructive" 
                                : "text-green-600"
                            }`}>
                              {marketingComparison.currentYearTotal > marketingComparison.lastYearTotal ? (
                                <TrendingUp className="h-5 w-5" />
                              ) : (
                                <TrendingDown className="h-5 w-5" />
                              )}
                              {Math.abs(Math.round(
                                ((marketingComparison.currentYearTotal - marketingComparison.lastYearTotal) / 
                                marketingComparison.lastYearTotal) * 100
                              ))}%
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {marketingComparison.currentYearTotal > marketingComparison.lastYearTotal ? "증가" : "감소"}
                            </div>
                          </>
                        ) : (
                          <div className="text-2xl font-bold text-muted-foreground">-</div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Comparison Chart */}
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={marketingComparison.currentYearMonthly.map((curr, i) => ({
                          month: `${curr.month}월`,
                          올해: curr.total,
                          작년: marketingComparison.lastYearMonthly[i]?.total || 0,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(v) => formatBudget(v)} />
                        <Tooltip formatter={(v: number) => formatBudget(v)} />
                        <Legend />
                        <Bar dataKey="올해" fill="#3B82F6" />
                        <Bar dataKey="작년" fill="#94A3B8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Megaphone className="h-10 w-10" />
                  <p>마케팅 데이터가 없습니다</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Campaign List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                캠페인 목록
              </CardTitle>
              <CardDescription>
                올해 진행한 마케팅 캠페인
              </CardDescription>
            </CardHeader>
            <CardContent>
              {marketingComparison?.currentYearCampaigns && marketingComparison.currentYearCampaigns.length > 0 ? (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">캠페인명</TableHead>
                        <TableHead className="whitespace-nowrap">채널</TableHead>
                        <TableHead className="whitespace-nowrap">시작일</TableHead>
                        <TableHead className="whitespace-nowrap">종료일</TableHead>
                        <TableHead className="whitespace-nowrap text-right">예산</TableHead>
                        <TableHead className="whitespace-nowrap">기간</TableHead>
                        <TableHead className="whitespace-nowrap text-center">관리</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marketingComparison.currentYearCampaigns.map((campaign) => {
                        const start = parseISO(campaign.startDate);
                        const end = parseISO(campaign.endDate);
                        const days = differenceInDays(end, start) + 1;
                        
                        return (
                          <TableRow key={campaign.id} data-testid={`row-campaign-${campaign.id}`}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {campaign.name}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge variant="secondary">{getChannelLabel(campaign.channel)}</Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {format(start, "M월 d일", { locale: ko })}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {format(end, "M월 d일", { locale: ko })}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right font-medium">
                              {formatBudget(campaign.budget)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {days}일
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openEditCampaign(campaign)}
                                  data-testid={`button-edit-campaign-${campaign.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm("이 캠페인을 삭제하시겠습니까?")) {
                                      deleteCampaignMutation.mutate(campaign.id);
                                    }
                                  }}
                                  data-testid={`button-delete-campaign-${campaign.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Calendar className="h-10 w-10" />
                  <p>올해 등록된 캠페인이 없습니다</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetCampaignForm();
                      setEditingCampaign(null);
                      setShowCampaignDialog(true);
                    }}
                    data-testid="button-add-campaign-empty"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    첫 캠페인 등록하기
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Campaign Dialog */}
          <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCampaign ? "캠페인 수정" : "캠페인 추가"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign-name">캠페인명 *</Label>
                  <Input
                    id="campaign-name"
                    value={campaignForm.name}
                    onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                    placeholder="예: 1월 네이버 검색광고"
                    data-testid="input-campaign-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign-channel">채널 *</Label>
                  <Select
                    value={campaignForm.channel}
                    onValueChange={(value) => setCampaignForm({ ...campaignForm, channel: value })}
                  >
                    <SelectTrigger data-testid="select-campaign-channel">
                      <SelectValue placeholder="채널 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {MARKETING_CHANNEL_LIST.map((ch) => (
                        <SelectItem key={ch.key} value={ch.key}>
                          {ch.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="campaign-start">시작일 *</Label>
                    <Input
                      id="campaign-start"
                      type="date"
                      value={campaignForm.startDate}
                      onChange={(e) => setCampaignForm({ ...campaignForm, startDate: e.target.value })}
                      data-testid="input-campaign-start"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="campaign-end">종료일 *</Label>
                    <Input
                      id="campaign-end"
                      type="date"
                      value={campaignForm.endDate}
                      onChange={(e) => setCampaignForm({ ...campaignForm, endDate: e.target.value })}
                      data-testid="input-campaign-end"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign-budget">예산 (원) *</Label>
                  <Input
                    id="campaign-budget"
                    type="number"
                    value={campaignForm.budget}
                    onChange={(e) => setCampaignForm({ ...campaignForm, budget: parseInt(e.target.value) || 0 })}
                    placeholder="예: 500000"
                    data-testid="input-campaign-budget"
                  />
                  {campaignForm.budget > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {formatBudget(campaignForm.budget)}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign-notes">메모</Label>
                  <Textarea
                    id="campaign-notes"
                    value={campaignForm.notes}
                    onChange={(e) => setCampaignForm({ ...campaignForm, notes: e.target.value })}
                    placeholder="캠페인 관련 메모"
                    rows={3}
                    data-testid="input-campaign-notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCampaignDialog(false);
                    setEditingCampaign(null);
                    resetCampaignForm();
                  }}
                  data-testid="button-cancel-campaign"
                >
                  취소
                </Button>
                <Button
                  onClick={handleSaveCampaign}
                  disabled={createCampaignMutation.isPending || updateCampaignMutation.isPending}
                  data-testid="button-save-campaign"
                >
                  {createCampaignMutation.isPending || updateCampaignMutation.isPending ? "저장 중..." : "저장"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

      {/* Salary Settings Dialog */}
      <Dialog open={showSalarySettingsDialog} onOpenChange={setShowSalarySettingsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>급여 설정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="font-medium">
                {allTeachersForSalary.find(t => t.id === selectedTeacherForSalary)?.name || "-"} 선생님
              </div>
              <div className="text-sm text-muted-foreground">
                {allTeachersForSalary.find(t => t.id === selectedTeacherForSalary)?.employmentType === "regular" 
                  ? "정규 선생님" : "파트타임 선생님"}
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="salary-base">기본급 (월)</Label>
                <Input
                  id="salary-base"
                  type="number"
                  value={salarySettingsForm.baseSalary}
                  onChange={(e) => setSalarySettingsForm({ ...salarySettingsForm, baseSalary: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                  placeholder="예: 2000000"
                  data-testid="input-salary-base"
                />
                {salarySettingsForm.baseSalary > 0 && (
                  <p className="text-xs text-muted-foreground">{formatBudget(salarySettingsForm.baseSalary)}</p>
                )}
              </div>

              <div className="border-t pt-3 mt-3">
                <div className="text-sm font-medium mb-2">성과급 설정</div>
                <p className="text-xs text-muted-foreground mb-3">
                  수업당 기본급 (초등/중등/고등 별도) + (기준 인원 초과 학생 × 초과 학생당 추가금)
                </p>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-5 gap-2 items-start">
                  <div></div>
                  <div className="text-xs font-medium text-center text-muted-foreground">초등</div>
                  <div className="text-xs font-medium text-center text-muted-foreground">중등</div>
                  <div className="text-xs font-medium text-center text-muted-foreground">고등</div>
                  <div className="text-xs font-medium text-center text-muted-foreground">성인</div>
                </div>
                <div className="grid grid-cols-5 gap-2 items-start">
                  <div className="text-xs font-medium text-muted-foreground pt-2">수업당 기본급</div>
                  <div>
                    <Input
                      id="salary-class-base-elementary"
                      type="number"
                      value={salarySettingsForm.classBasePayElementary}
                      onChange={(e) => setSalarySettingsForm({ ...salarySettingsForm, classBasePayElementary: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                      placeholder="80000"
                      data-testid="input-salary-class-base-elementary"
                    />
                    <p className={`text-xs h-4 ${salarySettingsForm.classBasePayElementary > 0 ? "text-muted-foreground" : "invisible"}`}>{salarySettingsForm.classBasePayElementary > 0 ? formatBudget(salarySettingsForm.classBasePayElementary) : "-"}</p>
                  </div>
                  <div>
                    <Input
                      id="salary-class-base-middle"
                      type="number"
                      value={salarySettingsForm.classBasePayMiddle}
                      onChange={(e) => setSalarySettingsForm({ ...salarySettingsForm, classBasePayMiddle: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                      placeholder="100000"
                      data-testid="input-salary-class-base-middle"
                    />
                    <p className={`text-xs h-4 ${salarySettingsForm.classBasePayMiddle > 0 ? "text-muted-foreground" : "invisible"}`}>{salarySettingsForm.classBasePayMiddle > 0 ? formatBudget(salarySettingsForm.classBasePayMiddle) : "-"}</p>
                  </div>
                  <div>
                    <Input
                      id="salary-class-base-high"
                      type="number"
                      value={salarySettingsForm.classBasePayHigh}
                      onChange={(e) => setSalarySettingsForm({ ...salarySettingsForm, classBasePayHigh: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                      placeholder="120000"
                      data-testid="input-salary-class-base-high"
                    />
                    <p className={`text-xs h-4 ${salarySettingsForm.classBasePayHigh > 0 ? "text-muted-foreground" : "invisible"}`}>{salarySettingsForm.classBasePayHigh > 0 ? formatBudget(salarySettingsForm.classBasePayHigh) : "-"}</p>
                  </div>
                  <div>
                    <Input
                      id="salary-class-base-adult"
                      type="number"
                      value={salarySettingsForm.classBasePayAdult}
                      onChange={(e) => setSalarySettingsForm({ ...salarySettingsForm, classBasePayAdult: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                      placeholder="150000"
                      data-testid="input-salary-class-base-adult"
                    />
                    <p className={`text-xs h-4 ${salarySettingsForm.classBasePayAdult > 0 ? "text-muted-foreground" : "invisible"}`}>{salarySettingsForm.classBasePayAdult > 0 ? formatBudget(salarySettingsForm.classBasePayAdult) : "-"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-2 items-start">
                  <div className="text-xs font-medium text-muted-foreground pt-2">기준 인원</div>
                  <div>
                    <Input
                      id="salary-threshold-elementary"
                      type="number"
                      value={salarySettingsForm.studentThresholdElementary}
                      onChange={(e) => setSalarySettingsForm({ ...salarySettingsForm, studentThresholdElementary: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                      placeholder="6"
                      data-testid="input-salary-threshold-elementary"
                    />
                  </div>
                  <div>
                    <Input
                      id="salary-threshold-middle"
                      type="number"
                      value={salarySettingsForm.studentThresholdMiddle}
                      onChange={(e) => setSalarySettingsForm({ ...salarySettingsForm, studentThresholdMiddle: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                      placeholder="5"
                      data-testid="input-salary-threshold-middle"
                    />
                  </div>
                  <div>
                    <Input
                      id="salary-threshold-high"
                      type="number"
                      value={salarySettingsForm.studentThresholdHigh}
                      onChange={(e) => setSalarySettingsForm({ ...salarySettingsForm, studentThresholdHigh: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                      placeholder="4"
                      data-testid="input-salary-threshold-high"
                    />
                  </div>
                  <div>
                    <Input
                      id="salary-threshold-adult"
                      type="number"
                      value={salarySettingsForm.studentThresholdAdult}
                      onChange={(e) => setSalarySettingsForm({ ...salarySettingsForm, studentThresholdAdult: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                      placeholder="3"
                      data-testid="input-salary-threshold-adult"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-2 items-start">
                  <div className="text-xs font-medium text-muted-foreground pt-2">초과 학생당<br/>추가금</div>
                  <div>
                    <Input
                      id="salary-per-student-elementary"
                      type="number"
                      value={salarySettingsForm.perStudentBonusElementary}
                      onChange={(e) => setSalarySettingsForm({ ...salarySettingsForm, perStudentBonusElementary: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                      placeholder="8000"
                      data-testid="input-salary-per-student-elementary"
                    />
                    <p className={`text-xs h-4 ${salarySettingsForm.perStudentBonusElementary > 0 ? "text-muted-foreground" : "invisible"}`}>{salarySettingsForm.perStudentBonusElementary > 0 ? formatBudget(salarySettingsForm.perStudentBonusElementary) : "-"}</p>
                  </div>
                  <div>
                    <Input
                      id="salary-per-student-middle"
                      type="number"
                      value={salarySettingsForm.perStudentBonusMiddle}
                      onChange={(e) => setSalarySettingsForm({ ...salarySettingsForm, perStudentBonusMiddle: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                      placeholder="10000"
                      data-testid="input-salary-per-student-middle"
                    />
                    <p className={`text-xs h-4 ${salarySettingsForm.perStudentBonusMiddle > 0 ? "text-muted-foreground" : "invisible"}`}>{salarySettingsForm.perStudentBonusMiddle > 0 ? formatBudget(salarySettingsForm.perStudentBonusMiddle) : "-"}</p>
                  </div>
                  <div>
                    <Input
                      id="salary-per-student-high"
                      type="number"
                      value={salarySettingsForm.perStudentBonusHigh}
                      onChange={(e) => setSalarySettingsForm({ ...salarySettingsForm, perStudentBonusHigh: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                      placeholder="15000"
                      data-testid="input-salary-per-student-high"
                    />
                    <p className={`text-xs h-4 ${salarySettingsForm.perStudentBonusHigh > 0 ? "text-muted-foreground" : "invisible"}`}>{salarySettingsForm.perStudentBonusHigh > 0 ? formatBudget(salarySettingsForm.perStudentBonusHigh) : "-"}</p>
                  </div>
                  <div>
                    <Input
                      id="salary-per-student-adult"
                      type="number"
                      value={salarySettingsForm.perStudentBonusAdult}
                      onChange={(e) => setSalarySettingsForm({ ...salarySettingsForm, perStudentBonusAdult: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                      placeholder="20000"
                      data-testid="input-salary-per-student-adult"
                    />
                    <p className={`text-xs h-4 ${salarySettingsForm.perStudentBonusAdult > 0 ? "text-muted-foreground" : "invisible"}`}>{salarySettingsForm.perStudentBonusAdult > 0 ? formatBudget(salarySettingsForm.perStudentBonusAdult) : "-"}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">기준 인원 초과시 추가금 발생</p>
              </div>
            </div>

            {salaryCalculation && (
              <div className="border-t pt-3 mt-3">
                <div className="text-sm font-medium mb-2">예상 급여 계산</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>기본급</span>
                    <span>{formatBudget(salaryCalculation.baseSalary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>성과급 ({salaryCalculation.breakdown.classCount}개 수업)</span>
                    <span>{formatBudget(salaryCalculation.performanceBonus)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-2">
                    <span>자동계산 급여</span>
                    <span>{formatBudget(salaryCalculation.totalSalary)}</span>
                  </div>
                  
                  {/* 급여 조정 항목 */}
                  {salaryAdjustments.length > 0 && (
                    <div className="space-y-1 pt-2">
                      {salaryAdjustments.map((adj) => (
                        <div key={adj.id} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                            <span className={adj.amount >= 0 ? "text-green-600" : "text-red-600"}>
                              {adj.amount >= 0 ? "+" : ""}{formatBudget(adj.amount)}
                            </span>
                            <span className="text-muted-foreground text-xs">{adj.description}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteAdjustmentMutation.mutate(adj.id)}
                            data-testid={`button-delete-adjustment-${adj.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {totalAdjustments !== 0 && (
                    <div className="flex justify-between text-sm pt-1">
                      <span>조정 합계</span>
                      <span className={totalAdjustments >= 0 ? "text-green-600" : "text-red-600"}>
                        {totalAdjustments >= 0 ? "+" : ""}{formatBudget(totalAdjustments)}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>최종 급여</span>
                    <span className="text-primary">{formatBudget(salaryCalculation.totalSalary + totalAdjustments)}</span>
                  </div>
                </div>
                
                {/* 조정 항목 추가 */}
                <div className="mt-3 p-3 bg-muted/30 rounded border">
                  <div className="text-xs font-medium mb-2">급여 조정 추가 ({selectedFinanceMonth})</div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="금액 (음수: 차감)"
                      value={newAdjustmentAmount}
                      onChange={(e) => setNewAdjustmentAmount(e.target.value)}
                      className="w-28"
                      data-testid="input-adjustment-amount"
                    />
                    <Input
                      placeholder="사유 (예: 특별수당, 결근 차감)"
                      value={newAdjustmentDescription}
                      onChange={(e) => setNewAdjustmentDescription(e.target.value)}
                      className="flex-1"
                      data-testid="input-adjustment-description"
                    />
                    <Button
                      size="icon"
                      onClick={handleAddAdjustment}
                      disabled={createAdjustmentMutation.isPending}
                      data-testid="button-add-adjustment"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">플러스 금액: 추가 / 마이너스 금액: 차감</p>
                </div>
                
                {salaryCalculation.breakdown.classes.length > 0 && (
                  <div className="mt-3 p-2 bg-muted/50 rounded text-xs">
                    <div className="font-medium mb-1">수업별 내역</div>
                    {salaryCalculation.breakdown.classes.map((cls, i) => (
                      <div key={i} className="flex justify-between text-muted-foreground">
                        <span>{cls.className} ({cls.studentCount}명){cls.days ? ` [${cls.days}]` : ""}</span>
                        <span>{formatBudget(cls.totalPay)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSalarySettingsDialog(false)}
              data-testid="button-cancel-salary"
            >
              취소
            </Button>
            <Button
              onClick={handleSaveSalarySettings}
              disabled={saveSalarySettingsMutation.isPending}
              data-testid="button-save-salary"
            >
              {saveSalarySettingsMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
