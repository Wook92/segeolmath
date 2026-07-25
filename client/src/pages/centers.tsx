import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Building2, Users, BookOpen, MoreVertical, Pencil, Trash2, GraduationCap, X, MessageSquare, Eye, EyeOff, Coffee, Upload, ImageIcon, BarChart3, ClipboardList, Check, XCircle, Clock, AlertCircle, Search, Loader2, Send, UserCog, Crown, Save, CreditCard, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Activity, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { format } from "date-fns";
import { UserRole, type Center, type User, type Class, type CenterRegistration } from "@shared/schema";
import { RoleBadge } from "@/components/role-badge";
import { CenterUsageStats } from "@/components/center-usage-stats";
import { LogoHelpButton } from "@/components/logo-help-button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart, Area } from "recharts";

const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

function AllCentersStats() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [year, setYear] = useState(currentYear);
  const [retentionYear, setRetentionYear] = useState(currentYear);
  const [retentionMonth, setRetentionMonth] = useState(currentMonth);
  
  const { data: usageStats, isLoading: usageLoading } = useQuery<{
    year: number;
    centerCount: number;
    monthlyStats: {
      month: number;
      avgUniqueUsers: number;
      totalUniqueUsers: number;
      avgSessions: number;
      totalSessions: number;
      avgReturnRate: number;
      avgDuration: number;
    }[];
  }>({
    queryKey: [`/api/all-centers/usage-stats?year=${year}`],
  });
  
  const { data: userCountStats, isLoading: userCountLoading } = useQuery<{
    year: number;
    monthlyStats: {
      month: number;
      students: number;
      parents: number;
      teachers: number;
      principals: number;
      admins: number;
      total: number;
    }[];
    totals: {
      students: number;
      parents: number;
      teachers: number;
      principals: number;
      admins: number;
      total: number;
    };
  }>({
    queryKey: [`/api/all-centers/user-count-stats?year=${year}`],
  });
  
  const { data: retentionStats, isLoading: retentionLoading } = useQuery<{
    year: number;
    month: number;
    totalMembers: number;
    mau: number;
    avgDau: number;
    centerCount: number;
    avgDay1Retention: number | null;
    avgDay7Retention: number | null;
    avgDay30Retention: number | null;
    avgStickiness: number;
    dailyStats: {
      date: string;
      day: number;
      dau: number;
      day1Retention: number | null;
      day7Retention: number | null;
      day30Retention: number | null;
      stickiness: number;
    }[];
  }>({
    queryKey: [`/api/all-centers/retention-stats?year=${retentionYear}&month=${retentionMonth}`],
  });
  
  const years = [];
  for (let y = currentYear; y >= 2024; y--) {
    years.push(y);
  }
  
  const handleRetentionPrevMonth = () => {
    if (retentionMonth === 1) {
      setRetentionMonth(12);
      setRetentionYear(retentionYear - 1);
    } else {
      setRetentionMonth(retentionMonth - 1);
    }
  };
  const handleRetentionNextMonth = () => {
    if (retentionMonth === 12) {
      setRetentionMonth(1);
      setRetentionYear(retentionYear + 1);
    } else {
      setRetentionMonth(retentionMonth + 1);
    }
  };
  const isNextDisabled = retentionYear === currentYear && retentionMonth >= currentMonth;
  
  const getRetentionColor = (value: number | null) => {
    if (value === null || value === 0) return "text-muted-foreground";
    if (value >= 70) return "text-green-600 dark:text-green-400";
    if (value >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-500 dark:text-red-400";
  };

  // null = 아직 측정 불가(대상 날짜가 미래). 측정된 0%와 구분해 "측정 중"으로 표시.
  const fmtRet = (value: number | null) => (value === null ? "측정 중" : `${value}%`);
  
  const getDauColor = (dau: number, maxDau: number) => {
    if (dau === 0) return "";
    const ratio = maxDau > 0 ? dau / maxDau : 0;
    if (ratio >= 0.7) return "bg-primary/20";
    if (ratio >= 0.3) return "bg-primary/10";
    return "bg-primary/5";
  };
  
  const maxDau = retentionStats ? Math.max(...retentionStats.dailyStats.map(d => d.dau), 1) : 1;

  const weekDayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const firstDayOfMonth = new Date(retentionYear, retentionMonth - 1, 1).getDay();
  const daysInMonth = new Date(retentionYear, retentionMonth, 0).getDate();
  
  const tooltipStyle = {
    contentStyle: { backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' },
    labelStyle: { color: 'hsl(var(--foreground))' },
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          전체 센터 통합 통계
        </h3>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              리텐션 분석
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRetentionPrevMonth} data-testid="button-retention-prev">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[80px] text-center">{retentionYear}년 {retentionMonth}월</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRetentionNextMonth} disabled={isNextDisabled} data-testid="button-retention-next">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {retentionLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">리텐션 데이터 로딩 중...</p>
            </div>
          ) : retentionStats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-7 gap-1.5 sm:gap-2">
                <div className="text-center p-1.5 sm:p-2 bg-muted rounded-lg overflow-hidden">
                  <div className="text-sm sm:text-lg font-bold text-primary truncate">{retentionStats.totalMembers.toLocaleString()}</div>
                  <div className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">전체 회원</div>
                </div>
                <div className="text-center p-1.5 sm:p-2 bg-muted rounded-lg overflow-hidden">
                  <div className="text-sm sm:text-lg font-bold truncate">{retentionStats.mau.toLocaleString()}</div>
                  <div className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">MAU</div>
                </div>
                <div className="text-center p-1.5 sm:p-2 bg-muted rounded-lg overflow-hidden">
                  <div className="text-sm sm:text-lg font-bold truncate">{retentionStats.avgDau}</div>
                  <div className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">평균 DAU</div>
                </div>
                <div className="text-center p-1.5 sm:p-2 bg-muted rounded-lg overflow-hidden">
                  <div className={`text-sm sm:text-lg font-bold truncate ${getRetentionColor(retentionStats.avgDay1Retention)}`}>{fmtRet(retentionStats.avgDay1Retention)}</div>
                  <div className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">Day1 재방문</div>
                </div>
                <div className="text-center p-1.5 sm:p-2 bg-muted rounded-lg overflow-hidden">
                  <div className={`text-sm sm:text-lg font-bold truncate ${getRetentionColor(retentionStats.avgDay7Retention)}`}>{fmtRet(retentionStats.avgDay7Retention)}</div>
                  <div className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">Day7 재방문</div>
                </div>
                <div className="text-center p-1.5 sm:p-2 bg-muted rounded-lg overflow-hidden">
                  <div className={`text-sm sm:text-lg font-bold truncate ${getRetentionColor(retentionStats.avgDay30Retention)}`}>{fmtRet(retentionStats.avgDay30Retention)}</div>
                  <div className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">Day30 재방문</div>
                </div>
                <div className="text-center p-1.5 sm:p-2 bg-muted rounded-lg overflow-hidden">
                  <div className="text-sm sm:text-lg font-bold truncate text-blue-600 dark:text-blue-400">{retentionStats.avgStickiness}%</div>
                  <div className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">Stickiness</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">일별 DAU</div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={retentionStats.dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={1} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip {...tooltipStyle} formatter={(value: number) => [value, 'DAU']} labelFormatter={(label) => `${retentionMonth}월 ${label}일`} />
                      <Bar dataKey="dau" name="DAU" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">일별 재방문률 (D1 / D7 / D30)</div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={retentionStats.dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={1} />
                      <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                      <Tooltip {...tooltipStyle} formatter={(value: number) => [`${value}%`]} labelFormatter={(label) => `${retentionMonth}월 ${label}일`} />
                      <Legend />
                      <Line type="monotone" dataKey="day1Retention" name="Day 1" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="day7Retention" name="Day 7" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="day30Retention" name="Day 30" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">일별 Stickiness (DAU/MAU)</div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={retentionStats.dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={1} />
                      <YAxis tick={{ fontSize: 11 }} domain={[0, 'auto']} unit="%" />
                      <Tooltip {...tooltipStyle} formatter={(value: number) => [`${value}%`]} labelFormatter={(label) => `${retentionMonth}월 ${label}일`} />
                      <Area type="monotone" dataKey="stickiness" name="Stickiness" fill="hsl(var(--chart-5))" fillOpacity={0.2} stroke="hsl(var(--chart-5))" strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-7 bg-muted/50">
                  {weekDayNames.map((day) => (
                    <div key={day} className="text-center text-xs font-medium py-1.5 text-muted-foreground">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                    <div key={`empty-${i}`} className="border-t border-r last:border-r-0 p-1 min-h-[80px]" />
                  ))}
                  {retentionStats.dailyStats.map((dayStat) => (
                    <div
                      key={dayStat.day}
                      className={`border-t border-r p-1 min-h-[80px] ${getDauColor(dayStat.dau, maxDau)}`}
                    >
                      <div className="text-xs font-medium mb-0.5">{dayStat.day}</div>
                      {dayStat.dau > 0 ? (
                        <div className="space-y-0">
                          <div className="text-[10px] text-muted-foreground">DAU: <span className="font-medium text-foreground">{dayStat.dau}</span></div>
                          <div className="text-[10px] text-muted-foreground">D1: <span className={`font-medium ${getRetentionColor(dayStat.day1Retention)}`}>{fmtRet(dayStat.day1Retention)}</span></div>
                          <div className="text-[10px] text-muted-foreground">D7: <span className={`font-medium ${getRetentionColor(dayStat.day7Retention)}`}>{fmtRet(dayStat.day7Retention)}</span></div>
                          <div className="text-[10px] text-muted-foreground">D30: <span className={`font-medium ${getRetentionColor(dayStat.day30Retention)}`}>{fmtRet(dayStat.day30Retention)}</span></div>
                          <div className="text-[10px] text-muted-foreground">S: <span className="font-medium text-blue-600 dark:text-blue-400">{dayStat.stickiness}%</span></div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-muted-foreground/50">-</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-[10px] text-muted-foreground justify-center">
                <span>DAU = 일간 활성 사용자</span>
                <span>D1/D7/D30 = Day 1/7/30 재방문률</span>
                <span>S = Stickiness (DAU/MAU)</span>
                <span className="text-green-600 dark:text-green-400">■ 70%+</span>
                <span className="text-yellow-600 dark:text-yellow-400">■ 40-70%</span>
                <span className="text-red-500 dark:text-red-400">■ 40% 미만</span>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end">
        <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y.toString()}>{y}년</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {userCountStats && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">전체 계정 현황</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-1.5 sm:gap-3 mb-4">
              <div className="text-center p-1.5 sm:p-3 bg-muted rounded-lg overflow-hidden">
                <div className="text-lg sm:text-2xl font-bold text-primary truncate">{userCountStats.totals.total.toLocaleString()}</div>
                <div className="text-[9px] sm:text-xs text-muted-foreground leading-tight">전체 계정</div>
              </div>
              <div className="text-center p-1.5 sm:p-3 bg-muted rounded-lg overflow-hidden">
                <div className="text-lg sm:text-2xl font-bold truncate">{userCountStats.totals.students.toLocaleString()}</div>
                <div className="text-[9px] sm:text-xs text-muted-foreground leading-tight">학생</div>
              </div>
              <div className="text-center p-1.5 sm:p-3 bg-muted rounded-lg overflow-hidden">
                <div className="text-lg sm:text-2xl font-bold truncate">{userCountStats.totals.parents.toLocaleString()}</div>
                <div className="text-[9px] sm:text-xs text-muted-foreground leading-tight">학부모</div>
              </div>
              <div className="text-center p-1.5 sm:p-3 bg-muted rounded-lg overflow-hidden">
                <div className="text-lg sm:text-2xl font-bold truncate">{userCountStats.totals.teachers.toLocaleString()}</div>
                <div className="text-[9px] sm:text-xs text-muted-foreground leading-tight">선생님</div>
              </div>
              <div className="text-center p-1.5 sm:p-3 bg-muted rounded-lg overflow-hidden">
                <div className="text-lg sm:text-2xl font-bold truncate">{userCountStats.totals.principals.toLocaleString()}</div>
                <div className="text-[9px] sm:text-xs text-muted-foreground leading-tight">원장</div>
              </div>
              <div className="text-center p-1.5 sm:p-3 bg-muted rounded-lg overflow-hidden">
                <div className="text-lg sm:text-2xl font-bold truncate">{userCountStats.totals.admins.toLocaleString()}</div>
                <div className="text-[9px] sm:text-xs text-muted-foreground leading-tight">관리자</div>
              </div>
            </div>
            
            <div className="text-sm font-medium mb-2">월별 신규 가입자</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userCountStats.monthlyStats.map(s => ({ ...s, name: monthNames[s.month - 1] }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip {...tooltipStyle} />
                  <Legend />
                  <Bar dataKey="students" name="학생" fill="hsl(var(--chart-1))" stackId="a" />
                  <Bar dataKey="parents" name="학부모" fill="hsl(var(--chart-2))" stackId="a" />
                  <Bar dataKey="teachers" name="선생님" fill="hsl(var(--chart-3))" stackId="a" />
                  <Bar dataKey="principals" name="원장" fill="hsl(var(--chart-4))" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
      
      {usageStats && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">앱 사용 통계 ({usageStats.centerCount}개 센터 평균)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="text-sm font-medium mb-2">월별 사용자 수</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={usageStats.monthlyStats.map(s => ({ ...s, name: monthNames[s.month - 1] }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip {...tooltipStyle} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="totalUniqueUsers" name="전체 사용자" fill="hsl(var(--chart-1))" />
                    <Line yAxisId="right" type="monotone" dataKey="avgUniqueUsers" name="센터 평균" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={{ fill: 'hsl(var(--chart-5))' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium mb-2">재방문율 & 체류시간</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={usageStats.monthlyStats.map(s => ({ ...s, name: monthNames[s.month - 1] }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} domain={[0, 100]} unit="%" />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} unit="분" />
                    <Tooltip {...tooltipStyle} />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="avgReturnRate" name="재방문율 (%)" fill="hsl(var(--chart-2))" fillOpacity={0.3} stroke="hsl(var(--chart-2))" />
                    <Line yAxisId="right" type="monotone" dataKey="avgDuration" name="체류시간 (분)" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ fill: 'hsl(var(--chart-3))' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {(usageLoading || userCountLoading) && (
        <Card>
          <CardContent className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">통계를 불러오는 중...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CreateCenterDialog({ onClose, editingCenter, selectedCenter, selectCenter, refreshCenters }: { 
  onClose: () => void; 
  editingCenter?: any;
  selectedCenter?: Center | null;
  selectCenter?: (center: Center) => void;
  refreshCenters?: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(editingCenter?.name || "");
  const [businessName, setBusinessName] = useState(editingCenter?.businessName || "");
  const [representativeName, setRepresentativeName] = useState(editingCenter?.representativeName || "");
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState(editingCenter?.businessRegistrationNumber || "");
  const [businessAddress, setBusinessAddress] = useState(editingCenter?.businessAddress || "");
  const [businessPhone, setBusinessPhone] = useState(editingCenter?.businessPhone || "");
  const [domain, setDomain] = useState(editingCenter?.domain || "");
  const [principalPhone, setPrincipalPhone] = useState("");
  
  // Logo states for each type
  const [loginLogoUrl, setLoginLogoUrl] = useState(editingCenter?.loginLogoUrl || "");
  const [loginLogoFile, setLoginLogoFile] = useState<File | null>(null);
  const [loginLogoPreview, setLoginLogoPreview] = useState<string | null>(editingCenter?.loginLogoUrl || null);
  
  const [sidebarLogoUrl, setSidebarLogoUrl] = useState(editingCenter?.sidebarLogoUrl || "");
  const [sidebarLogoFile, setSidebarLogoFile] = useState<File | null>(null);
  const [sidebarLogoPreview, setSidebarLogoPreview] = useState<string | null>(editingCenter?.sidebarLogoUrl || null);
  
  const [faviconUrl, setFaviconUrl] = useState(editingCenter?.faviconUrl || "");
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(editingCenter?.faviconUrl || null);
  
  const [attendancePadLogoUrl, setAttendancePadLogoUrl] = useState(editingCenter?.attendancePadLogoUrl || "");
  const [attendancePadLogoFile, setAttendancePadLogoFile] = useState<File | null>(null);
  const [attendancePadLogoPreview, setAttendancePadLogoPreview] = useState<string | null>(editingCenter?.attendancePadLogoUrl || null);
  
  const [shortcutIconUrl, setShortcutIconUrl] = useState(editingCenter?.shortcutIconUrl || "");
  const [shortcutIconFile, setShortcutIconFile] = useState<File | null>(null);
  const [shortcutIconPreview, setShortcutIconPreview] = useState<string | null>(editingCenter?.shortcutIconUrl || null);
  
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  
  const loginLogoRef = useRef<HTMLInputElement>(null);
  
  // Update all states when editingCenter changes
  useEffect(() => {
    setName(editingCenter?.name || "");
    setBusinessName(editingCenter?.businessName || "");
    setRepresentativeName(editingCenter?.representativeName || "");
    setBusinessRegistrationNumber(editingCenter?.businessRegistrationNumber || "");
    setBusinessAddress(editingCenter?.businessAddress || "");
    setBusinessPhone(editingCenter?.businessPhone || "");
    setDomain(editingCenter?.domain || "");
    setPrincipalPhone("");
    
    // Reset logo states
    setLoginLogoUrl(editingCenter?.loginLogoUrl || "");
    setLoginLogoFile(null);
    setLoginLogoPreview(editingCenter?.loginLogoUrl || null);
    
    setSidebarLogoUrl(editingCenter?.sidebarLogoUrl || "");
    setSidebarLogoFile(null);
    setSidebarLogoPreview(editingCenter?.sidebarLogoUrl || null);
    
    setFaviconUrl(editingCenter?.faviconUrl || "");
    setFaviconFile(null);
    setFaviconPreview(editingCenter?.faviconUrl || null);
    
    setAttendancePadLogoUrl(editingCenter?.attendancePadLogoUrl || "");
    setAttendancePadLogoFile(null);
    setAttendancePadLogoPreview(editingCenter?.attendancePadLogoUrl || null);
    
    setShortcutIconUrl(editingCenter?.shortcutIconUrl || "");
    setShortcutIconFile(null);
    setShortcutIconPreview(editingCenter?.shortcutIconUrl || null);
  }, [editingCenter]);
  const sidebarLogoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);
  const attendancePadLogoRef = useRef<HTMLInputElement>(null);
  const shortcutIconRef = useRef<HTMLInputElement>(null);

  const handleLogoSelect = (
    file: File | undefined,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void
  ) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: "이미지 파일만 업로드 가능합니다", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "파일 크기는 5MB 이하만 가능합니다", variant: "destructive" });
      return;
    }
    setFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const uploadSingleLogo = async (file: File | null, existingUrl: string, folder: string): Promise<string | null> => {
    if (!file) return existingUrl || null;
    
    try {
      console.log(`[Logo Upload] Starting upload - file: ${file.name}, folder: ${folder}`);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      console.log(`[Logo Upload] Response:`, data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      
      if (!data.url) {
        throw new Error('Server did not return URL');
      }
      
      console.log(`[Logo Upload] Success - url: ${data.url}`);
      return data.url;
    } catch (error: any) {
      console.error('[Logo Upload] Failed:', error);
      toast({ title: `로고 업로드 실패: ${error?.message || '알 수 없는 오류'}`, variant: "destructive" });
      return existingUrl || null;
    }
  };

  const removeLogo = (
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void,
    setUrl: (u: string) => void,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => {
    setFile(null);
    setPreview(null);
    setUrl("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingCenter) {
        return apiRequest("PATCH", `/api/centers/${editingCenter.id}`, data);
      }
      return apiRequest("POST", "/api/centers", data);
    },
    onSuccess: async (response) => {
      // IMPORTANT: apiRequest returns a Response object, must parse JSON
      const serverData = await (response as Response).json() as Center;
      console.log("[Center Mutation] Server response (parsed):", serverData);
      console.log("[Center Mutation] Response sidebarLogoUrl:", serverData?.sidebarLogoUrl);
      
      // Check if editing current center BEFORE refreshing (closure captures old selectedCenter value)
      const isEditingCurrentCenter = editingCenter && selectedCenter?.id === editingCenter.id;
      
      invalidateQueriesStartingWith("/api/centers");
      
      // Refresh centers list in auth context first (for sidebar dropdown)
      if (refreshCenters) {
        await refreshCenters();
      }
      
      // Update selectedCenter with server response if we were editing the current center
      if (isEditingCurrentCenter && selectCenter) {
        console.log("[Center Mutation] Updating selectedCenter with server data");
        selectCenter(serverData);
      }
      
      toast({ title: editingCenter ? "센터가 수정되었습니다" : "센터가 생성되었습니다" });
      onClose();
    },
    onError: () => {
      toast({ title: editingCenter ? "센터 수정에 실패했습니다" : "센터 생성에 실패했습니다", variant: "destructive" });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploadingLogo(true);
    
    try {
      console.log("[Center Submit] Starting upload...");
      console.log("[Center Submit] attendancePadLogoFile:", attendancePadLogoFile?.name);
      console.log("[Center Submit] attendancePadLogoUrl:", attendancePadLogoUrl);
      console.log("[Center Submit] attendancePadLogoPreview:", attendancePadLogoPreview ? "exists" : "null");
      
      // Upload all logos in parallel
      const [finalLoginLogoUrl, finalSidebarLogoUrl, finalFaviconUrl, finalAttendancePadLogoUrl, finalShortcutIconUrl] = await Promise.all([
        loginLogoFile ? uploadSingleLogo(loginLogoFile, loginLogoUrl, 'center-logos/login') : (loginLogoPreview ? loginLogoUrl : null),
        sidebarLogoFile ? uploadSingleLogo(sidebarLogoFile, sidebarLogoUrl, 'center-logos/sidebar') : (sidebarLogoPreview ? sidebarLogoUrl : null),
        faviconFile ? uploadSingleLogo(faviconFile, faviconUrl, 'center-logos/favicon') : (faviconPreview ? faviconUrl : null),
        attendancePadLogoFile ? uploadSingleLogo(attendancePadLogoFile, attendancePadLogoUrl, 'center-logos/attendance-pad') : (attendancePadLogoPreview ? attendancePadLogoUrl : null),
        shortcutIconFile ? uploadSingleLogo(shortcutIconFile, shortcutIconUrl, 'center-logos/shortcut-icon') : (shortcutIconPreview ? shortcutIconUrl : null),
      ]);
      
      console.log("[Center Submit] Upload complete");
      console.log("[Center Submit] finalAttendancePadLogoUrl:", finalAttendancePadLogoUrl);
      
      const mutationData = { 
        name,
        businessName: businessName || null,
        representativeName: representativeName || null,
        businessRegistrationNumber: businessRegistrationNumber || null,
        businessAddress: businessAddress || null,
        businessPhone: businessPhone || null,
        loginLogoUrl: finalLoginLogoUrl || null,
        sidebarLogoUrl: finalSidebarLogoUrl || null,
        faviconUrl: finalFaviconUrl || null,
        attendancePadLogoUrl: finalAttendancePadLogoUrl || null,
        shortcutIconUrl: finalShortcutIconUrl || null,
        domain: domain || null,
        principalPhone: !editingCenter && principalPhone ? principalPhone : undefined,
      };
      console.log("[Center Submit] Mutation data:", mutationData);
      
      mutation.mutate(mutationData);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">센터명 *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 강남센터"
          required
          data-testid="input-center-name"
        />
      </div>

      {!editingCenter && (
        <div className="space-y-2">
          <Label htmlFor="principalPhone">원장 전화번호 <span className="text-destructive">*</span></Label>
          <Input
            id="principalPhone"
            value={principalPhone}
            onChange={(e) => setPrincipalPhone(e.target.value)}
            placeholder="예: 01012345678"
            required
            data-testid="input-principal-phone"
          />
          <p className="text-xs text-muted-foreground">
            해당 번호로 원장 계정이 자동 생성됩니다 (초기 비밀번호: 1234)
          </p>
        </div>
      )}

      <div className="border-t pt-4 mt-4">
        <p className="text-sm font-medium mb-3 text-muted-foreground">로고 설정</p>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label className="text-xs">로그인 페이지</Label>
              <LogoHelpButton logoType="loginLogo" />
            </div>
            <div className="flex flex-col items-center gap-2">
              {loginLogoPreview ? (
                <div className="relative">
                  <img src={loginLogoPreview} alt="Login logo" className="w-16 h-16 object-contain rounded-md border" />
                  <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5"
                    onClick={() => removeLogo(setLoginLogoFile, setLoginLogoPreview, setLoginLogoUrl, loginLogoRef)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="w-16 h-16 border-2 border-dashed rounded-md flex items-center justify-center bg-muted/50">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <input ref={loginLogoRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleLogoSelect(e.target.files?.[0], setLoginLogoFile, setLoginLogoPreview)} />
              <Button type="button" variant="outline" size="sm" onClick={() => loginLogoRef.current?.click()} disabled={isUploadingLogo}>
                <Upload className="h-3 w-3 mr-1" />{loginLogoPreview ? "변경" : "업로드"}
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label className="text-xs">사이드바</Label>
              <LogoHelpButton logoType="sidebarLogo" />
            </div>
            <div className="flex flex-col items-center gap-2">
              {sidebarLogoPreview ? (
                <div className="relative">
                  <img src={sidebarLogoPreview} alt="Sidebar logo" className="w-16 h-16 object-contain rounded-md border" />
                  <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5"
                    onClick={() => removeLogo(setSidebarLogoFile, setSidebarLogoPreview, setSidebarLogoUrl, sidebarLogoRef)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="w-16 h-16 border-2 border-dashed rounded-md flex items-center justify-center bg-muted/50">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <input ref={sidebarLogoRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleLogoSelect(e.target.files?.[0], setSidebarLogoFile, setSidebarLogoPreview)} />
              <Button type="button" variant="outline" size="sm" onClick={() => sidebarLogoRef.current?.click()} disabled={isUploadingLogo}>
                <Upload className="h-3 w-3 mr-1" />{sidebarLogoPreview ? "변경" : "업로드"}
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label className="text-xs">파비콘</Label>
              <LogoHelpButton logoType="favicon" />
            </div>
            <div className="flex flex-col items-center gap-2">
              {faviconPreview ? (
                <div className="relative">
                  <img src={faviconPreview} alt="Favicon" className="w-16 h-16 object-contain rounded-md border" />
                  <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5"
                    onClick={() => removeLogo(setFaviconFile, setFaviconPreview, setFaviconUrl, faviconRef)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="w-16 h-16 border-2 border-dashed rounded-md flex items-center justify-center bg-muted/50">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <input ref={faviconRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleLogoSelect(e.target.files?.[0], setFaviconFile, setFaviconPreview)} />
              <Button type="button" variant="outline" size="sm" onClick={() => faviconRef.current?.click()} disabled={isUploadingLogo}>
                <Upload className="h-3 w-3 mr-1" />{faviconPreview ? "변경" : "업로드"}
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label className="text-xs">출결패드</Label>
              <LogoHelpButton logoType="attendancePadLogo" />
            </div>
            <div className="flex flex-col items-center gap-2">
              {attendancePadLogoPreview ? (
                <div className="relative">
                  <img src={attendancePadLogoPreview} alt="Attendance Pad Logo" className="w-20 h-20 object-contain rounded-md border" />
                  <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5"
                    onClick={() => removeLogo(setAttendancePadLogoFile, setAttendancePadLogoPreview, setAttendancePadLogoUrl, attendancePadLogoRef)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="w-20 h-20 border-2 border-dashed rounded-md flex items-center justify-center bg-muted/50">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <input ref={attendancePadLogoRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleLogoSelect(e.target.files?.[0], setAttendancePadLogoFile, setAttendancePadLogoPreview)} />
              <Button type="button" variant="outline" size="sm" onClick={() => attendancePadLogoRef.current?.click()} disabled={isUploadingLogo}>
                <Upload className="h-3 w-3 mr-1" />{attendancePadLogoPreview ? "변경" : "업로드"}
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label className="text-xs">홈화면 바로가기</Label>
              <LogoHelpButton logoType="shortcutIcon" />
            </div>
            <div className="flex flex-col items-center gap-2">
              {shortcutIconPreview ? (
                <div className="relative">
                  <img src={shortcutIconPreview} alt="Shortcut Icon" className="w-20 h-20 object-contain rounded-md border" />
                  <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5"
                    onClick={() => removeLogo(setShortcutIconFile, setShortcutIconPreview, setShortcutIconUrl, shortcutIconRef)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="w-20 h-20 border-2 border-dashed rounded-md flex items-center justify-center bg-muted/50">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <input ref={shortcutIconRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleLogoSelect(e.target.files?.[0], setShortcutIconFile, setShortcutIconPreview)} />
              <Button type="button" variant="outline" size="sm" onClick={() => shortcutIconRef.current?.click()} disabled={isUploadingLogo}>
                <Upload className="h-3 w-3 mr-1" />{shortcutIconPreview ? "변경" : "업로드"}
              </Button>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">권장: 정사각형 이미지, 최대 5MB (파비콘: 32x32, 바로가기: 192x192)</p>
      </div>

      <div className="border-t pt-4 mt-4">
        <p className="text-sm font-medium mb-3 text-muted-foreground">사업자 정보 (푸터 표시용)</p>
        
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="businessName">상호명</Label>
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="예: OO학원"
              data-testid="input-business-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="representativeName">대표자명</Label>
            <Input
              id="representativeName"
              value={representativeName}
              onChange={(e) => setRepresentativeName(e.target.value)}
              placeholder="예: 홍길동"
              data-testid="input-representative-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessRegistrationNumber">사업자등록번호</Label>
            <Input
              id="businessRegistrationNumber"
              value={businessRegistrationNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '');
                let formatted = value;
                if (value.length > 3) {
                  formatted = value.slice(0, 3) + '-' + value.slice(3);
                }
                if (value.length > 5) {
                  formatted = value.slice(0, 3) + '-' + value.slice(3, 5) + '-' + value.slice(5, 10);
                }
                setBusinessRegistrationNumber(formatted);
              }}
              placeholder="OOO-OO-OOOOO"
              maxLength={12}
              data-testid="input-business-registration-number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessAddress">사업장 주소</Label>
            <Input
              id="businessAddress"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              placeholder="예: 서울시 강남구 테헤란로 123"
              data-testid="input-business-address"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessPhone">전화번호</Label>
            <Input
              id="businessPhone"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
              placeholder="예: 02-1234-5678"
              data-testid="input-business-phone"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="domain">도메인</Label>
            <Input
              id="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="예: gangnam.myacademy.com"
              data-testid="input-domain"
            />
            <p className="text-xs text-muted-foreground">
              센터 전용 도메인 주소 (선택사항)
            </p>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={mutation.isPending || isUploadingLogo} data-testid="button-save-center">
          {isUploadingLogo ? "로고 업로드 중..." : mutation.isPending ? (editingCenter ? "수정 중..." : "생성 중...") : (editingCenter ? "센터 수정" : "센터 생성")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function SolapiSettingsDialog({ center, onClose }: { center: any; onClose: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [senderNumber, setSenderNumber] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [showSavedApiKey, setShowSavedApiKey] = useState(false);
  const [showSavedApiSecret, setShowSavedApiSecret] = useState(false);
  const [revealedCredentials, setRevealedCredentials] = useState<{ apiKey?: string; apiSecret?: string } | null>(null);

  const { data: credentials, isLoading } = useQuery<any>({
    queryKey: [`/api/centers/${center.id}/solapi`],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { apiKey: string; apiSecret: string; senderNumber: string }) => {
      return apiRequest("PUT", `/api/centers/${center.id}/solapi`, data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith(`/api/centers/${center.id}/solapi`);
      toast({ title: "SOLAPI 설정이 저장되었습니다" });
      onClose();
    },
    onError: () => {
      toast({ title: "저장에 실패했습니다", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !apiSecret || !senderNumber) {
      toast({ title: "모든 필드를 입력해주세요", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ apiKey, apiSecret, senderNumber });
  };

  const handleRevealCredentials = async () => {
    if (!center?.id || !user?.id) return;
    try {
      const response = await fetch(`/api/centers/${center.id}/solapi/reveal?actorId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setRevealedCredentials(data);
      } else {
        toast({ title: "자격 증명을 가져올 수 없습니다", variant: "destructive" });
      }
    } catch {
      toast({ title: "자격 증명을 가져올 수 없습니다", variant: "destructive" });
    }
  };

  const toggleShowSavedApiKey = () => {
    if (!showSavedApiKey && !revealedCredentials) {
      handleRevealCredentials();
    }
    setShowSavedApiKey(!showSavedApiKey);
  };

  const toggleShowSavedApiSecret = () => {
    if (!showSavedApiSecret && !revealedCredentials) {
      handleRevealCredentials();
    }
    setShowSavedApiSecret(!showSavedApiSecret);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <>
          {credentials?.hasCredentials && (
            <div className="p-4 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="font-medium text-green-700 dark:text-green-300">SOLAPI 설정 완료</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">API Key:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">
                      {showSavedApiKey && revealedCredentials?.apiKey 
                        ? revealedCredentials.apiKey 
                        : credentials.apiKeyMasked || "****"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={toggleShowSavedApiKey}
                      data-testid="button-reveal-api-key"
                    >
                      {showSavedApiKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">API Secret:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">
                      {showSavedApiSecret && revealedCredentials?.apiSecret 
                        ? revealedCredentials.apiSecret 
                        : credentials.apiSecretMasked || "********"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={toggleShowSavedApiSecret}
                      data-testid="button-reveal-api-secret"
                    >
                      {showSavedApiSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">발신번호:</span>
                  <span className="font-medium">{credentials.senderNumber}</span>
                </div>
                <div className="pt-2 border-t border-green-200 dark:border-green-800">
                  <span className="text-xs text-muted-foreground">
                    마지막 업데이트: {credentials.updatedAt ? new Date(credentials.updatedAt).toLocaleString("ko-KR") : "-"}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="SOLAPI API Key"
                data-testid="input-solapi-api-key"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiSecret">API Secret</Label>
            <div className="relative">
              <Input
                id="apiSecret"
                type={showApiSecret ? "text" : "password"}
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="SOLAPI API Secret"
                data-testid="input-solapi-api-secret"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setShowApiSecret(!showApiSecret)}
              >
                {showApiSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="senderNumber">발신번호</Label>
            <Input
              id="senderNumber"
              type="tel"
              value={senderNumber}
              onChange={(e) => setSenderNumber(e.target.value)}
              placeholder="01012345678"
              data-testid="input-solapi-sender-number"
            />
            <p className="text-xs text-muted-foreground">SOLAPI에 등록된 발신번호를 입력하세요</p>
          </div>
        </>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-solapi">
          {saveMutation.isPending ? "저장 중..." : "설정 저장"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CenterSmsSendDialog({ center, onClose }: { center: any; onClose: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState<"all" | "students" | "parents" | "teachers">("all");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSending, setIsSending] = useState(false);

  const { data: students = [] } = useQuery<User[]>({
    queryKey: ["/api/centers", center.id, "students"],
  });

  const { data: teachers = [] } = useQuery<User[]>({
    queryKey: ["/api/centers", center.id, "teachers"],
  });

  const { data: solapiConfig } = useQuery<{ configured: boolean }>({
    queryKey: [`/api/centers/${center.id}/solapi`],
  });

  const getTargetUsers = () => {
    let users: User[] = [];
    if (targetType === "all") {
      users = [...students, ...teachers];
    } else if (targetType === "students") {
      users = students;
    } else if (targetType === "parents") {
      users = students.filter(s => s.motherPhone || s.fatherPhone);
    } else if (targetType === "teachers") {
      users = teachers;
    }
    
    if (searchQuery) {
      users = users.filter(u => 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.phone?.includes(searchQuery)
      );
    }
    
    return users;
  };

  const targetUsers = getTargetUsers();

  const getPhoneNumber = (user: User) => {
    if (targetType === "parents") {
      return user.motherPhone || user.fatherPhone;
    }
    return user.phone;
  };

  const getSelectedPhones = () => {
    if (selectedUsers.length === 0) {
      return targetUsers
        .map(u => getPhoneNumber(u))
        .filter((p): p is string => !!p);
    }
    return targetUsers
      .filter(u => selectedUsers.includes(u.id))
      .map(u => getPhoneNumber(u))
      .filter((p): p is string => !!p);
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === targetUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(targetUsers.map(u => u.id));
    }
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSend = async () => {
    const phones = getSelectedPhones();
    if (phones.length === 0) {
      toast({ title: "발송 대상이 없습니다", variant: "destructive" });
      return;
    }
    if (!message.trim()) {
      toast({ title: "메시지를 입력해주세요", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
      const response = await apiRequest("POST", "/api/sms/direct-bulk-send", {
        phones,
        message: message.trim(),
        centerName: center.name,
        centerId: center.id,
        actorId: user?.id,
      });

      const result = response as unknown as { successCount: number; failCount: number };
      toast({ 
        title: `문자 발송 완료`,
        description: `성공: ${result.successCount}건, 실패: ${result.failCount}건`
      });
      onClose();
    } catch (error: any) {
      toast({ 
        title: "문자 발송 실패", 
        description: error?.message || "오류가 발생했습니다",
        variant: "destructive" 
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!solapiConfig?.configured) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">SOLAPI 설정이 필요합니다</p>
          <p className="text-sm text-muted-foreground mt-1">
            센터 메뉴에서 "SOLAPI 설정"을 먼저 완료해주세요
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>닫기</Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>발송 대상</Label>
        <Select value={targetType} onValueChange={(v: any) => { setTargetType(v); setSelectedUsers([]); }}>
          <SelectTrigger data-testid="select-sms-target-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 (학생 + 선생님)</SelectItem>
            <SelectItem value="students">학생</SelectItem>
            <SelectItem value="parents">학부모</SelectItem>
            <SelectItem value="teachers">선생님</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>수신자 선택 ({selectedUsers.length > 0 ? selectedUsers.length : targetUsers.length}명)</Label>
          <Button variant="ghost" size="sm" onClick={handleSelectAll}>
            {selectedUsers.length === targetUsers.length ? "전체 해제" : "전체 선택"}
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="이름 또는 전화번호 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-sms-search"
          />
        </div>
        <div className="max-h-[200px] overflow-y-auto border rounded-md">
          {targetUsers.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground text-sm">대상이 없습니다</p>
          ) : (
            targetUsers.map((user) => {
              const phone = getPhoneNumber(user);
              const isSelected = selectedUsers.length === 0 || selectedUsers.includes(user.id);
              return (
                <div 
                  key={user.id}
                  className={`flex items-center gap-3 p-2 border-b last:border-b-0 cursor-pointer hover-elevate ${isSelected ? 'bg-primary/5' : ''}`}
                  onClick={() => handleToggleUser(user.id)}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {targetType === "parents" ? `학부모: ${phone || "전화번호 없음"}` : (phone || "전화번호 없음")}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sms-message">메시지</Label>
        <Textarea
          id="sms-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="발송할 메시지를 입력하세요..."
          rows={5}
          data-testid="textarea-sms-message"
        />
        <p className="text-xs text-muted-foreground text-right">{message.length}자</p>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>취소</Button>
        <Button 
          onClick={handleSend} 
          disabled={isSending || !message.trim() || getSelectedPhones().length === 0}
          data-testid="button-send-sms"
        >
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              발송 중...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              발송 ({getSelectedPhones().length}명)
            </>
          )}
        </Button>
      </DialogFooter>
    </div>
  );
}

function StudyCafeSettingsDialog({ center, onClose }: { center: any; onClose: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [notice, setNotice] = useState("");

  const { data: settings, isLoading } = useQuery<any>({
    queryKey: [`/api/study-cafe/settings/${center.id}`],
  });

  const isEnabled = settings?.isEnabled ?? false;

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest("POST", "/api/study-cafe/settings", {
        centerId: center.id,
        isEnabled: enabled,
        notice: notice || settings?.notice,
        actorId: user?.id,
      });
    },
    onSuccess: (_, enabled) => {
      invalidateQueriesStartingWith("/api/study-cafe");
      toast({ title: enabled ? "스터디카페가 활성화되었습니다" : "스터디카페가 비활성화되었습니다" });
    },
    onError: () => {
      toast({ title: "설정 변경에 실패했습니다", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">로딩 중...</div>
      ) : (
        <>
          <div className="flex items-center justify-between p-4 rounded-md bg-muted/50">
            <div className="flex items-center gap-3">
              <Coffee className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">스터디카페</p>
                <p className="text-sm text-muted-foreground">
                  {isEnabled ? "이 센터에서 스터디카페를 이용할 수 있습니다" : "스터디카페가 비활성화되어 있습니다"}
                </p>
              </div>
            </div>
            <Button
              variant={isEnabled ? "destructive" : "default"}
              onClick={() => toggleMutation.mutate(!isEnabled)}
              disabled={toggleMutation.isPending}
              data-testid="button-toggle-study-cafe"
            >
              {isEnabled ? "비활성화" : "활성화"}
            </Button>
          </div>

          {isEnabled && (
            <div className="space-y-2">
              <Label htmlFor="notice">공지사항</Label>
              <Input
                id="notice"
                value={notice || settings?.notice || ""}
                onChange={(e) => setNotice(e.target.value)}
                placeholder="스터디카페 이용 안내 (선택사항)"
                data-testid="input-study-cafe-notice"
              />
            </div>
          )}
        </>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          닫기
        </Button>
      </DialogFooter>
    </div>
  );
}

function CenterDetailsDialog({ 
  center, 
  type, 
  onClose 
}: { 
  center: any; 
  type: "students" | "teachers" | "classes"; 
  onClose: () => void;
}) {
  const { data: students } = useQuery<User[]>({
    queryKey: ["/api/centers", center.id, "students"],
    enabled: type === "students",
  });

  const { data: teachers } = useQuery<User[]>({
    queryKey: ["/api/centers", center.id, "teachers"],
    enabled: type === "teachers",
  });

  const { data: classes } = useQuery<Class[]>({
    queryKey: [`/api/classes?centerId=${center.id}`],
    enabled: type === "classes",
  });

  const titles = {
    students: `${center.name} - 학생 목록`,
    teachers: `${center.name} - 선생님 목록`,
    classes: `${center.name} - 수업 목록`,
  };

  const renderStudents = () => (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {students?.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">등록된 학생이 없습니다</p>
      ) : (
        students?.map((student) => (
          <div key={student.id} className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
            <Avatar>
              <AvatarFallback>{student.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium">{student.name}</p>
              <p className="text-sm text-muted-foreground">{student.phone || student.username}</p>
            </div>
            <RoleBadge role={student.role} isClinicTeacher={student.isClinicTeacher} size="sm" />
          </div>
        ))
      )}
    </div>
  );

  const renderTeachers = () => (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {teachers?.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">등록된 선생님이 없습니다</p>
      ) : (
        teachers?.map((teacher) => (
          <div key={teacher.id} className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
            <Avatar>
              <AvatarFallback>{teacher.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium">{teacher.name}</p>
              <p className="text-sm text-muted-foreground">{teacher.phone || teacher.username}</p>
            </div>
            <RoleBadge role={teacher.role} isClinicTeacher={teacher.isClinicTeacher} size="sm" />
          </div>
        ))
      )}
    </div>
  );

  const renderClasses = () => (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {classes?.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">등록된 수업이 없습니다</p>
      ) : (
        classes?.map((cls) => (
          <div key={cls.id} className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: cls.color }}
            />
            <div className="flex-1">
              <p className="font-medium">{cls.name}</p>
              <p className="text-sm text-muted-foreground">{cls.subject} · {cls.startTime}-{cls.endTime}</p>
            </div>
            <Badge variant="outline">{cls.classType === "regular" ? "정규" : "평가"}</Badge>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {type === "students" && renderStudents()}
      {type === "teachers" && renderTeachers()}
      {type === "classes" && renderClasses()}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          닫기
        </Button>
      </DialogFooter>
    </div>
  );
}

function PrincipalsManagementDialog({ center, onClose }: { center: any; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingPrincipal, setEditingPrincipal] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const { data: principals = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/centers/${center.id}/users`, { role: UserRole.PRINCIPAL }],
    queryFn: async () => {
      const res = await fetch(`/api/centers/${center.id}/users?role=${UserRole.PRINCIPAL}&actorId=${user?.id}`);
      if (!res.ok) throw new Error("Failed to fetch principals");
      const data = await res.json();
      return data.sort((a: any, b: any) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; phone: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${data.id}`, {
        name: data.name,
        phone: data.phone,
        actorId: user?.id,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "원장 정보가 수정되었습니다" });
      queryClient.invalidateQueries({ queryKey: [`/api/centers/${center.id}/users`] });
      queryClient.invalidateQueries({ queryKey: [`/api/centers/stats`] });
      setEditingPrincipal(null);
    },
    onError: () => {
      toast({ title: "원장 정보 수정에 실패했습니다", variant: "destructive" });
    },
  });

  const startEdit = (principal: any) => {
    setEditingPrincipal(principal);
    setEditName(principal.name);
    setEditPhone(principal.phone || "");
  };

  const saveEdit = () => {
    if (!editingPrincipal) return;
    updateMutation.mutate({
      id: editingPrincipal.id,
      name: editName,
      phone: editPhone,
    });
  };

  const cancelEdit = () => {
    setEditingPrincipal(null);
    setEditName("");
    setEditPhone("");
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : principals.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          등록된 원장이 없습니다
        </div>
      ) : (
        <div className="space-y-3">
          {principals.map((principal, index) => (
            <div key={principal.id} className="flex items-center gap-3 p-3 rounded-md border">
              {editingPrincipal?.id === principal.id ? (
                <div className="flex-1 space-y-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="이름"
                    data-testid="input-principal-edit-name"
                  />
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="전화번호"
                    data-testid="input-principal-edit-phone"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? "저장 중..." : "저장"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit}>
                      취소
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{principal.name}</p>
                      {index === 0 && (
                        <Badge variant="default" className="text-xs">
                          <Crown className="h-3 w-3 mr-1" />
                          대표원장
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{principal.phone || "전화번호 없음"}</p>
                    <p className="text-xs text-muted-foreground">아이디: {principal.username}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => startEdit(principal)} data-testid={`button-edit-principal-${principal.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
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

export default function CentersPage() {
  const { user, selectedCenter, selectCenter, refreshCenters } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<any>(null);
  const [detailsDialog, setDetailsDialog] = useState<{ center: any; type: "students" | "teachers" | "classes" } | null>(null);
  const [solapiCenter, setSolapiCenter] = useState<any>(null);
  const [studyCafeCenter, setStudyCafeCenter] = useState<any>(null);
  const [smsCenter, setSmsCenter] = useState<any>(null);
  const [principalsCenter, setPrincipalsCenter] = useState<any>(null);
  const [deleteConfirmCenter, setDeleteConfirmCenter] = useState<any>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [activeTab, setActiveTab] = useState("centers");
  const [centerInfoDialog, setCenterInfoDialog] = useState<any>(null);
  const [tossReviewCenter, setTossReviewCenter] = useState<any>(null);

  // Multi-center bulk SMS states
  const [selectedCentersForSms, setSelectedCentersForSms] = useState<string[]>([]);
  const [isBulkSmsDialogOpen, setIsBulkSmsDialogOpen] = useState(false);
  const [bulkSmsMessage, setBulkSmsMessage] = useState("");
  const [bulkSmsTargetType, setBulkSmsTargetType] = useState<"principals" | "teachers" | "students" | "parents">("principals");
  const [isBulkSmsSending, setIsBulkSmsSending] = useState(false);

  const isAdmin = user?.role === UserRole.ADMIN;

  const { data: centers, isLoading } = useQuery<any[]>({
    queryKey: [`/api/centers/stats`],
  });

  const { data: registrations, isLoading: isLoadingRegistrations } = useQuery<CenterRegistration[]>({
    queryKey: [`/api/center-registrations?actorId=${user?.id}`],
    enabled: isAdmin && !!user?.id,
  });

  // Fetch all users for bulk SMS
  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users", { actorId: user?.id }],
    enabled: isAdmin && !!user?.id,
  });

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingRegistration, setRejectingRegistration] = useState<CenterRegistration | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [registrationSearch, setRegistrationSearch] = useState("");
  const [registrationStatusFilter, setRegistrationStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [centerSearch, setCenterSearch] = useState("");
  
  // Sort centers with priority centers at top
  const sortCentersWithPriority = (centersToSort: any[]) => {
    const priorityNames = ["프라임수학 (DMC센터)", "프라임수학 (목동센터)"];
    return [...centersToSort].sort((a, b) => {
      const aIndex = priorityNames.indexOf(a.name);
      const bIndex = priorityNames.indexOf(b.name);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.name.localeCompare(b.name, 'ko');
    });
  };
  
  // SMS confirmation dialog states
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [approvingRegistration, setApprovingRegistration] = useState<CenterRegistration | null>(null);
  
  // Existing principal confirmation dialog states
  const [existingPrincipalDialogOpen, setExistingPrincipalDialogOpen] = useState(false);
  const [existingPrincipalInfo, setExistingPrincipalInfo] = useState<{
    exists: boolean;
    existingUser?: { id: string; name: string; phone: string };
    existingCenters?: string;
    centerCount?: number;
  } | null>(null);
  const [pendingApprovalRegistration, setPendingApprovalRegistration] = useState<CenterRegistration | null>(null);
  const builtInDefaultSmsMessage = `[이음위더스] 학원 통합 관리 앱
안녕하세요. {원장명}님!
등록 승인 완료되었습니다 😊

▪️ 갤럭시 👉 구글/크롬 앱
▪️ 아이폰 👉 사파리 앱 

이후 아래 단계 꼭 진행해주세요!
★) 우측상단 사람 이모티콘을 눌러 "홈 화면에 추가" 버튼으로 앱을 다운받아주세요.
1) [추가 기능 메뉴]에서 필요한 기능 추가
2) [사용자 관리]에서 학생 계정 엑셀 일괄 등록하기, 선생님 계정생성하기
3) [시간표 관리]에서 각 선생님별 수업 생성하기
4) 학생 계정에서 [학원 시간표]에서 수업 신청하기, 선생님/원장 계정에서 [시간표 관리]에서 시간표 누르면 학생 신청할 수 있습니다.
5) 숙제 출제한 뒤 "등록됨"에서 학생 숙제 검사 진행할 수 있습니다.

아이디: {아이디}
초기 비밀번호: 1234

감사합니다.`;
  const [smsMessage, setSmsMessage] = useState(builtInDefaultSmsMessage);

  const { data: savedTemplateData, isLoading: isTemplateLoading } = useQuery<{ key: string; value: string | null }>({
    queryKey: ["/api/system-settings/approval_sms_template", user?.id],
    queryFn: async () => {
      console.log("[Centers] Loading saved SMS template...");
      const res = await fetch(`/api/system-settings/approval_sms_template?actorId=${user?.id}`);
      if (!res.ok) {
        console.error("[Centers] Failed to load SMS template, status:", res.status);
        throw new Error("Failed to load template");
      }
      const data = await res.json();
      console.log("[Centers] Loaded SMS template:", data?.value ? `found(${data.value.length}chars)` : "null");
      return data;
    },
    enabled: !!user && user.role >= 4,
    staleTime: 1000 * 60 * 5,
  });

  const defaultSmsMessage = savedTemplateData?.value || builtInDefaultSmsMessage;

  const saveTemplateMutation = useMutation({
    mutationFn: async (template: string) => {
      console.log("[Centers] Saving SMS template, length:", template.length);
      const res = await apiRequest("PUT", `/api/system-settings/approval_sms_template?actorId=${user?.id}`, { value: template });
      console.log("[Centers] Save template response status:", res.status);
      return res;
    },
    onSuccess: () => {
      console.log("[Centers] Template saved successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings/approval_sms_template"] });
      toast({ title: "승인 문자 서식이 저장되었습니다" });
    },
    onError: (error: any) => {
      console.error("[Centers] Template save failed:", error, error?.message, error?.stack);
      toast({ title: "서식 저장에 실패했습니다", description: error?.message || "알 수 없는 오류", variant: "destructive" });
    },
  });
  
  const filteredRegistrations = registrations?.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(registrationSearch.toLowerCase());
    const matchesStatus = registrationStatusFilter === "all" || r.status === registrationStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, linkExisting = false }: { id: string; linkExisting?: boolean }) => {
      console.log("[Centers] Approving registration:", id, "by user:", user?.id, "linkExisting:", linkExisting);
      const response = await apiRequest("POST", `/api/center-registrations/${id}/approve?actorId=${user?.id}&linkExisting=${linkExisting}`);
      console.log("[Centers] Approval response:", response);
      return response;
    },
    onSuccess: async () => {
      await invalidateQueriesStartingWith("/api/center-registrations");
      await invalidateQueriesStartingWith("/api/centers");
      toast({ title: "학원 등록이 승인되었습니다" });
    },
    onError: (error: any) => {
      console.error("[Centers] Approval failed:", error);
      const message = error?.message || "승인에 실패했습니다";
      toast({ title: message, variant: "destructive" });
    },
  });
  
  // Check existing principal mutation
  const checkExistingPrincipalMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      const response = await fetch(`/api/center-registrations/${registrationId}/check-existing-principal?actorId=${user?.id}`);
      if (!response.ok) {
        // Try to surface the server's actual error message so admins can
        // diagnose problems like "신청을 찾을 수 없습니다" (e.g., when the
        // registration was deleted as a side effect of deleting an old center).
        let serverMessage = "";
        try {
          const errBody = await response.json();
          serverMessage = errBody?.error || errBody?.message || "";
        } catch {
          // Response body wasn't JSON
        }
        const err: any = new Error(serverMessage || `확인에 실패했습니다 (HTTP ${response.status})`);
        err.status = response.status;
        err.serverMessage = serverMessage;
        throw err;
      }
      return response.json();
    },
  });
  
  // Handle approve button click - first check if principal exists
  const handleApproveClick = async (registration: CenterRegistration) => {
    try {
      const result = await checkExistingPrincipalMutation.mutateAsync(registration.id);
      
      if (result.exists) {
        // Show confirmation dialog for existing principal
        setExistingPrincipalInfo(result);
        setPendingApprovalRegistration(registration);
        setExistingPrincipalDialogOpen(true);
      } else {
        // No existing principal, proceed with normal approval flow
        setApprovingRegistration(registration);
        setSmsDialogOpen(true);
      }
    } catch (error: any) {
      console.error("[Centers] Check existing principal failed:", error, "status:", error?.status);
      const description = error?.serverMessage || error?.message || "알 수 없는 오류가 발생했습니다";
      toast({
        title: "확인에 실패했습니다",
        description,
        variant: "destructive",
      });
    }
  };
  
  // Handle confirmation to link existing principal
  const handleConfirmLinkExisting = () => {
    if (pendingApprovalRegistration) {
      setExistingPrincipalDialogOpen(false);
      setApprovingRegistration(pendingApprovalRegistration);
      setSmsDialogOpen(true);
    }
  };

  // Handle bulk SMS send
  const handleBulkSmsSend = async () => {
    if (selectedCentersForSms.length === 0) {
      toast({ title: "센터를 선택해주세요", variant: "destructive" });
      return;
    }
    if (!bulkSmsMessage.trim()) {
      toast({ title: "메시지를 입력해주세요", variant: "destructive" });
      return;
    }

    setIsBulkSmsSending(true);
    try {
      // Get target users based on selected centers and target type
      const targetPhones: string[] = [];
      
      // Fetch users for each selected center
      for (const centerId of selectedCentersForSms) {
        const centerUsersResponse = await fetch(`/api/users?centerId=${centerId}`);
        const centerUsers = await centerUsersResponse.json();
        
        if (bulkSmsTargetType === "principals") {
          centerUsers.filter((u: any) => u.role === UserRole.PRINCIPAL && u.phone).forEach((u: any) => targetPhones.push(u.phone));
        } else if (bulkSmsTargetType === "teachers") {
          centerUsers.filter((u: any) => (u.role === UserRole.TEACHER || u.role === UserRole.CLINIC_TEACHER) && u.phone).forEach((u: any) => targetPhones.push(u.phone));
        } else if (bulkSmsTargetType === "students") {
          centerUsers.filter((u: any) => u.role === UserRole.STUDENT && u.phone).forEach((u: any) => targetPhones.push(u.phone));
        } else if (bulkSmsTargetType === "parents") {
          centerUsers.filter((u: any) => u.role === UserRole.PARENT && u.phone).forEach((u: any) => targetPhones.push(u.phone));
        }
      }

      const uniquePhones = [...new Set(targetPhones)];
      
      if (uniquePhones.length === 0) {
        toast({ title: "발송 대상이 없습니다", variant: "destructive" });
        setIsBulkSmsSending(false);
        return;
      }

      const response = await apiRequest("POST", "/api/sms/direct-bulk-send", {
        phones: uniquePhones,
        message: bulkSmsMessage.trim(),
        centerName: "목동센터",
        actorId: user?.id,
      });

      const result = response as unknown as { successCount: number; failCount: number };
      toast({ 
        title: `문자 발송 완료`, 
        description: `성공: ${result.successCount}건, 실패: ${result.failCount}건` 
      });
      
      setIsBulkSmsDialogOpen(false);
      setSelectedCentersForSms([]);
      setBulkSmsMessage("");
    } catch (error: any) {
      toast({ 
        title: "문자 발송 실패", 
        description: error?.message || "오류가 발생했습니다",
        variant: "destructive" 
      });
    } finally {
      setIsBulkSmsSending(false);
    }
  };

  // Toggle center selection for bulk SMS
  const toggleCenterSelection = (centerId: string) => {
    setSelectedCentersForSms(prev => 
      prev.includes(centerId) 
        ? prev.filter(id => id !== centerId)
        : [...prev, centerId]
    );
  };

  // Select all centers
  const selectAllCenters = () => {
    if (centers) {
      setSelectedCentersForSms(centers.map((c: any) => c.id));
    }
  };

  // Deselect all centers
  const deselectAllCenters = () => {
    setSelectedCentersForSms([]);
  };

  // SMS sending mutation for registration approval notification
  const sendApprovalSmsMutation = useMutation({
    mutationFn: async ({ phone, message, centerName }: { phone: string; message: string; centerName: string }) => {
      return apiRequest("POST", `/api/sms/send?actorId=${user?.id}`, {
        to: phone,
        text: message,
        centerName,
        useSystemCredentials: true, // Use admin's Solapi credentials for registration approval SMS
      });
    },
    onSuccess: () => {
      toast({ title: "승인 알림 문자가 전송되었습니다" });
    },
    onError: (error: any) => {
      console.error("[Centers] SMS send failed:", error);
      toast({ title: "문자 전송에 실패했습니다", variant: "destructive" });
    },
  });

  // Handle approval with optional SMS
  const handleApproveWithSms = async (sendSms: boolean) => {
    if (!approvingRegistration) return;
    
    // Check if we should link to existing principal
    const shouldLinkExisting = existingPrincipalInfo?.exists === true;
    
    try {
      // First approve the registration and get principal user info
      const result = await approveMutation.mutateAsync({ 
        id: approvingRegistration.id, 
        linkExisting: shouldLinkExisting 
      });
      
      // Then send SMS if requested
      if (sendSms && approvingRegistration.applicantPhone) {
        // Replace variables in message with actual values
        const principalUser = (result as any)?.principalUser;
        let finalMessage = smsMessage
          .replace(/\{센터명\}/g, approvingRegistration.name || "")
          .replace(/\{아이디\}/g, principalUser?.username || approvingRegistration.applicantPhone || "")
          .replace(/\{비밀번호\}/g, "1234")
          .replace(/\{원장명\}/g, principalUser?.name || approvingRegistration.applicantName || "");
        
        await sendApprovalSmsMutation.mutateAsync({
          phone: approvingRegistration.applicantPhone,
          message: finalMessage,
          centerName: approvingRegistration.name || "DMC센터",
        });
      }
      
      // Close dialog and reset
      setSmsDialogOpen(false);
      setApprovingRegistration(null);
      setSmsMessage(defaultSmsMessage);
      setExistingPrincipalInfo(null);
      setPendingApprovalRegistration(null);
    } catch (error) {
      console.error("[Centers] Approve with SMS failed:", error);
    }
  };

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest("POST", `/api/center-registrations/${id}/reject?actorId=${user?.id}`, { rejectReason: reason });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/center-registrations");
      setRejectDialogOpen(false);
      setRejectingRegistration(null);
      setRejectReason("");
      toast({ title: "학원 등록 신청이 거절되었습니다" });
    },
    onError: () => {
      toast({ title: "거절 처리에 실패했습니다", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/centers/${id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/centers");
      toast({ title: "센터가 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const tossApproveMutation = useMutation({
    mutationFn: async (centerId: string) => {
      return apiRequest("POST", `/api/centers/${centerId}/toss-consent-review`, { actorId: user?.id, action: "approve" });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/centers");
      setTossReviewCenter(null);
      toast({ title: "토스페이먼츠 연동이 승인되었습니다" });
    },
    onError: () => {
      toast({ title: "승인에 실패했습니다", variant: "destructive" });
    },
  });

  const tossRejectMutation = useMutation({
    mutationFn: async (centerId: string) => {
      return apiRequest("POST", `/api/centers/${centerId}/toss-consent-review`, { actorId: user?.id, action: "reject" });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/centers");
      setTossReviewCenter(null);
      toast({ title: "토스페이먼츠 연동이 거절되었습니다" });
    },
    onError: () => {
      toast({ title: "거절에 실패했습니다", variant: "destructive" });
    },
  });

  const [tossRevokeCenter, setTossRevokeCenter] = useState<any>(null);
  const tossRevokeMutation = useMutation({
    mutationFn: async (centerId: string) => {
      return apiRequest("POST", `/api/centers/${centerId}/toss-consent-review`, { actorId: user?.id, action: "revoke" });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/centers");
      setTossRevokeCenter(null);
      toast({ title: "토스페이먼츠 연동이 해제되었습니다" });
    },
    onError: () => {
      toast({ title: "연동 해제에 실패했습니다", variant: "destructive" });
    },
  });

  const pendingTossCenters = (centers || []).filter((c: any) => c.tossConsentStatus === "pending")
    .sort((a: any, b: any) => {
      const dateA = a.tossConsentAt ? new Date(a.tossConsentAt).getTime() : 0;
      const dateB = b.tossConsentAt ? new Date(b.tossConsentAt).getTime() : 0;
      return dateB - dateA;
    });
  const [tossPendingOpen, setTossPendingOpen] = useState(false);

  if (!isAdmin) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>접근 권한이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">센터 관리</h1>
          <p className="text-muted-foreground">학원 센터 생성 및 관리</p>
        </div>
        {activeTab === "centers" && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-center">
                <Plus className="h-4 w-4 mr-2" />
                센터 생성
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>새 센터 생성</DialogTitle>
                <DialogDescription>센터 정보를 입력해주세요</DialogDescription>
              </DialogHeader>
              <CreateCenterDialog onClose={() => setIsCreateOpen(false)} selectedCenter={selectedCenter} selectCenter={selectCenter} refreshCenters={refreshCenters} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {pendingTossCenters.length > 0 && (
        <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-4">
          <button
            type="button"
            className="flex items-center gap-2 w-full text-left"
            onClick={() => setTossPendingOpen(!tossPendingOpen)}
          >
            <CreditCard className="h-5 w-5 text-amber-600" />
            <p className="font-medium text-amber-900 dark:text-amber-100 flex-1">토스페이먼츠 연동 승인 대기 ({pendingTossCenters.length}건)</p>
            {tossPendingOpen ? (
              <ChevronUp className="h-4 w-4 text-amber-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-amber-600" />
            )}
          </button>
          {tossPendingOpen && (
            <div className="space-y-2 mt-3">
              {pendingTossCenters.map((center: any) => (
                <div key={center.id} className="flex items-center justify-between bg-background rounded p-3 border border-border/50">
                  <div>
                    <span className="font-medium">{center.name}</span>
                    {center.tossConsentAt && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {format(new Date(center.tossConsentAt), "yyyy-MM-dd HH:mm")} 신청
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => setTossReviewCenter(center)}
                      data-testid={`button-toss-review-${center.id}`}
                    >
                      검토
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={!!tossReviewCenter} onOpenChange={(open) => !open && setTossReviewCenter(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>토스페이먼츠 연동 승인</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{tossReviewCenter?.name}</span> 센터의 토스페이먼츠 연동을 승인하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="destructive"
              onClick={() => tossReviewCenter && tossRejectMutation.mutate(tossReviewCenter.id)}
              disabled={tossRejectMutation.isPending}
              data-testid="button-toss-reject"
            >
              {tossRejectMutation.isPending ? "처리 중..." : "거절"}
            </Button>
            <Button
              onClick={() => tossReviewCenter && tossApproveMutation.mutate(tossReviewCenter.id)}
              disabled={tossApproveMutation.isPending}
              data-testid="button-toss-approve"
            >
              {tossApproveMutation.isPending ? "처리 중..." : "승인"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tossRevokeCenter} onOpenChange={(open) => !open && setTossRevokeCenter(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>토스페이먼츠 연동 해제</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{tossRevokeCenter?.name}</span> 센터의 토스페이먼츠 결제 연동을 해제하시겠습니까?
              해제 후에는 해당 센터에서 비대면 결제 기능을 사용할 수 없게 됩니다. 다시 연동하려면 센터에서 재신청해야 합니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setTossRevokeCenter(null)}
              data-testid="button-toss-revoke-cancel"
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => tossRevokeCenter && tossRevokeMutation.mutate(tossRevokeCenter.id)}
              disabled={tossRevokeMutation.isPending}
              data-testid="button-toss-revoke-confirm"
            >
              {tossRevokeMutation.isPending ? "처리 중..." : "연동 해제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="centers" className="gap-2" data-testid="tab-centers">
            <Building2 className="h-4 w-4" />
            센터 목록
            {centers && centers.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1">
                {centers.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="registrations" className="gap-2" data-testid="tab-registrations">
            <ClipboardList className="h-4 w-4" />
            등록 신청
            {registrations && registrations.filter(r => r.status === "pending").length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1">
                {registrations.filter(r => r.status === "pending").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2" data-testid="tab-stats">
            <BarChart3 className="h-4 w-4" />
            앱 사용 통계
          </TabsTrigger>
        </TabsList>

        <TabsContent value="centers" className="mt-4 space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="센터명, 원장명 또는 원장 핸드폰 번호로 검색"
            value={centerSearch}
            onChange={(e) => setCenterSearch(e.target.value)}
            className="pl-9"
            data-testid="input-center-search"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedCentersForSms.length > 0 && (
            <>
              <Badge variant="secondary">{selectedCentersForSms.length}개 선택</Badge>
              <Button 
                size="sm" 
                variant="outline"
                onClick={deselectAllCenters}
                data-testid="button-deselect-all"
              >
                선택 해제
              </Button>
              <Button 
                size="sm"
                onClick={() => setIsBulkSmsDialogOpen(true)}
                data-testid="button-bulk-sms"
              >
                <Send className="h-4 w-4 mr-1" />
                단체 문자
              </Button>
            </>
          )}
          {selectedCentersForSms.length === 0 && centers && centers.length > 0 && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={selectAllCenters}
              data-testid="button-select-all"
            >
              전체 선택
            </Button>
          )}
        </div>
      </div>
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : centers?.filter((c: any) => 
          c.name.toLowerCase().includes(centerSearch.toLowerCase()) ||
          (c.principalName && c.principalName.toLowerCase().includes(centerSearch.toLowerCase())) ||
          (c.principalPhone && c.principalPhone.includes(centerSearch.replace(/-/g, '')))
        ).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>등록된 센터가 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortCentersWithPriority(centers?.filter((c: any) => 
            c.name.toLowerCase().includes(centerSearch.toLowerCase()) ||
            (c.principalName && c.principalName.toLowerCase().includes(centerSearch.toLowerCase())) ||
            (c.principalPhone && c.principalPhone.includes(centerSearch.replace(/-/g, '')))
          ) || []).map((center: any) => (
            <Card 
              key={center.id} 
              data-testid={`center-${center.id}`}
              className={`cursor-pointer hover-elevate transition-all ${selectedCentersForSms.includes(center.id) ? "ring-2 ring-primary" : ""}`}
              onClick={() => setCenterInfoDialog(center)}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Checkbox
                    checked={selectedCentersForSms.includes(center.id)}
                    onCheckedChange={() => toggleCenterSelection(center.id)}
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`checkbox-center-${center.id}`}
                    className="shrink-0"
                  />
                  <div className="p-2 rounded-md bg-primary/10 shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle 
                        className="text-lg break-words"
                        data-testid={`button-center-info-${center.id}`}
                      >
                        {center.name}
                      </CardTitle>
                      {center.tossConsentStatus === "approved" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-300 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950">
                          <CreditCard className="h-3 w-3 mr-0.5" />결제연동
                        </Badge>
                      )}
                      {center.tossConsentStatus === "pending" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950">
                          <Clock className="h-3 w-3 mr-0.5" />승인대기
                        </Badge>
                      )}
                    </div>
                    {center.principalName && (
                      <CardDescription className="text-xs">
                        원장: {center.principalName}{center.principalPhone ? ` (${center.principalPhone})` : ''}
                      </CardDescription>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid={`button-menu-${center.id}`} onClick={(e) => e.stopPropagation()}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={() => setEditingCenter(center)}
                      data-testid={`button-edit-${center.id}`}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      수정
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setCenterInfoDialog(center)}
                      data-testid={`button-menu-usage-stats-${center.id}`}
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      상세 정보
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setSolapiCenter(center)}
                      data-testid={`button-solapi-${center.id}`}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      SOLAPI 설정
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setSmsCenter(center)}
                      data-testid={`button-sms-${center.id}`}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      문자 발송
                    </DropdownMenuItem>
                    {center.tossConsentStatus === "approved" && (
                      <DropdownMenuItem
                        onClick={() => setTossRevokeCenter(center)}
                        data-testid={`button-toss-revoke-${center.id}`}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        결제연동 해제
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => {
                        setDeleteConfirmCenter(center);
                        setDeleteConfirmText("");
                      }}
                      data-testid={`button-delete-${center.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); setDetailsDialog({ center, type: "students" }); }}
                    className="p-3 rounded-md bg-muted hover-elevate"
                    data-testid={`button-students-${center.id}`}
                  >
                    <GraduationCap className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{center.studentCount ?? 0}</p>
                    <p className="text-xs text-muted-foreground">학생</p>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDetailsDialog({ center, type: "teachers" }); }}
                    className="p-3 rounded-md bg-muted hover-elevate"
                    data-testid={`button-teachers-${center.id}`}
                  >
                    <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{center.teacherCount ?? 0}</p>
                    <p className="text-xs text-muted-foreground">선생님</p>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDetailsDialog({ center, type: "classes" }); }}
                    className="p-3 rounded-md bg-muted hover-elevate"
                    data-testid={`button-classes-${center.id}`}
                  >
                    <BookOpen className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{center.classCount ?? 0}</p>
                    <p className="text-xs text-muted-foreground">수업</p>
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!centerInfoDialog} onOpenChange={(open) => !open && setCenterInfoDialog(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {centerInfoDialog?.name}
            </DialogTitle>
            <DialogDescription>학원 정보 및 사용 통계</DialogDescription>
          </DialogHeader>
          {centerInfoDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="flex items-start gap-2 p-2.5 bg-muted rounded-lg">
                  <Crown className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[10px] text-muted-foreground">원장</div>
                    <div className="text-sm font-medium">{centerInfoDialog.principalName || "-"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2.5 bg-muted rounded-lg">
                  <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[10px] text-muted-foreground">원장 연락처</div>
                    <div className="text-sm font-medium">{centerInfoDialog.principalPhone || "-"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2.5 bg-muted rounded-lg">
                  <ClipboardList className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[10px] text-muted-foreground">사업자등록번호</div>
                    <div className="text-sm font-medium">{centerInfoDialog.businessRegistrationNumber || "-"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2.5 bg-muted rounded-lg col-span-2 sm:col-span-1">
                  <Building2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[10px] text-muted-foreground">사업장 주소</div>
                    <div className="text-sm font-medium">{centerInfoDialog.businessAddress || "-"}</div>
                  </div>
                </div>
                {centerInfoDialog.businessName && (
                  <div className="flex items-start gap-2 p-2.5 bg-muted rounded-lg">
                    <Building2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[10px] text-muted-foreground">상호명</div>
                      <div className="text-sm font-medium">{centerInfoDialog.businessName}</div>
                    </div>
                  </div>
                )}
                {centerInfoDialog.businessPhone && (
                  <div className="flex items-start gap-2 p-2.5 bg-muted rounded-lg">
                    <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[10px] text-muted-foreground">유선번호</div>
                      <div className="text-sm font-medium">{centerInfoDialog.businessPhone}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <CenterUsageStats center={centerInfoDialog} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCenter} onOpenChange={(open) => !open && setEditingCenter(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>센터 수정</DialogTitle>
            <DialogDescription>센터 정보를 수정하세요</DialogDescription>
          </DialogHeader>
          {editingCenter && (
            <CreateCenterDialog 
              editingCenter={editingCenter} 
              onClose={() => setEditingCenter(null)}
              selectedCenter={selectedCenter}
              selectCenter={selectCenter}
              refreshCenters={refreshCenters}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsDialog} onOpenChange={(open) => !open && setDetailsDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {detailsDialog?.center.name} - {detailsDialog?.type === "students" ? "학생 목록" : detailsDialog?.type === "teachers" ? "선생님 목록" : "수업 목록"}
            </DialogTitle>
          </DialogHeader>
          {detailsDialog && (
            <CenterDetailsDialog 
              center={detailsDialog.center} 
              type={detailsDialog.type} 
              onClose={() => setDetailsDialog(null)} 
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!solapiCenter} onOpenChange={(open) => !open && setSolapiCenter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{solapiCenter?.name} - SOLAPI 설정</DialogTitle>
            <DialogDescription>SMS/카카오톡 알림 발송을 위한 SOLAPI 설정</DialogDescription>
          </DialogHeader>
          {solapiCenter && (
            <SolapiSettingsDialog 
              center={solapiCenter} 
              onClose={() => setSolapiCenter(null)} 
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!studyCafeCenter} onOpenChange={(open) => !open && setStudyCafeCenter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{studyCafeCenter?.name} - 스터디카페 설정</DialogTitle>
            <DialogDescription>스터디카페 활성화 및 공지사항 관리</DialogDescription>
          </DialogHeader>
          {studyCafeCenter && (
            <StudyCafeSettingsDialog 
              center={studyCafeCenter} 
              onClose={() => setStudyCafeCenter(null)} 
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!smsCenter} onOpenChange={(open) => !open && setSmsCenter(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{smsCenter?.name} - 문자 발송</DialogTitle>
            <DialogDescription>센터 소속 사용자에게 문자를 발송합니다</DialogDescription>
          </DialogHeader>
          {smsCenter && (
            <CenterSmsSendDialog 
              center={smsCenter} 
              onClose={() => setSmsCenter(null)} 
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!principalsCenter} onOpenChange={(open) => !open && setPrincipalsCenter(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{principalsCenter?.name} - 원장 관리</DialogTitle>
            <DialogDescription>센터 원장 목록을 확인하고 수정할 수 있습니다. 가장 먼저 등록된 원장이 대표원장으로 표시됩니다.</DialogDescription>
          </DialogHeader>
          {principalsCenter && (
            <PrincipalsManagementDialog 
              center={principalsCenter} 
              onClose={() => setPrincipalsCenter(null)} 
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmCenter} onOpenChange={(open) => !open && setDeleteConfirmCenter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">센터 삭제 확인</DialogTitle>
            <DialogDescription>
              <span className="font-semibold">{deleteConfirmCenter?.name}</span> 센터를 삭제하시겠습니까?
              <br />
              <span className="text-destructive font-medium">
                이 작업은 되돌릴 수 없으며, 모든 관련 데이터(수업, 숙제, 출결 기록, 클리닉 자료 등)가 영구적으로 삭제됩니다.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">
                삭제를 확인하려면 <span className="font-bold text-destructive">센터삭제</span>를 입력하세요
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="센터삭제"
                data-testid="input-delete-confirm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirmCenter(null)}
              data-testid="button-cancel-delete"
            >
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmText !== "센터삭제" || deleteMutation.isPending}
              onClick={() => {
                if (deleteConfirmText === "센터삭제" && deleteConfirmCenter) {
                  deleteMutation.mutate(deleteConfirmCenter.id, {
                    onSuccess: () => {
                      setDeleteConfirmCenter(null);
                      setDeleteConfirmText("");
                    }
                  });
                }
              }}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </TabsContent>

        <TabsContent value="registrations" className="mt-4">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="학원명 검색..."
                  value={registrationSearch}
                  onChange={(e) => setRegistrationSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-registration-search"
                />
              </div>
              <Select
                value={registrationStatusFilter}
                onValueChange={(value: "all" | "pending" | "approved" | "rejected") => setRegistrationStatusFilter(value)}
              >
                <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-registration-status">
                  <SelectValue placeholder="상태 필터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="pending">승인대기</SelectItem>
                  <SelectItem value="approved">승인완료</SelectItem>
                  <SelectItem value="rejected">거절</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {registrations && registrations.length > 0 && (
              <div className="flex flex-wrap gap-3 text-sm">
                <Badge variant="outline" className="gap-1">
                  전체 {registrations.length}건
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  승인대기 {registrations.filter(r => r.status === "pending").length}건
                </Badge>
                <Badge variant="default" className="gap-1 bg-green-600">
                  <Check className="h-3 w-3" />
                  승인완료 {registrations.filter(r => r.status === "approved").length}건
                </Badge>
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  거절 {registrations.filter(r => r.status === "rejected").length}건
                </Badge>
              </div>
            )}
            {isLoadingRegistrations ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-48" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-16 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredRegistrations?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{registrations?.length === 0 ? "등록 신청 내역이 없습니다" : "검색 결과가 없습니다"}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredRegistrations?.map((registration) => (
                  <Card key={registration.id} data-testid={`registration-${registration.id}`}>
                    <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg">{registration.name}</CardTitle>
                          {registration.status === "pending" && (
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" />
                              대기중
                            </Badge>
                          )}
                          {registration.status === "approved" && (
                            <Badge variant="default" className="gap-1 bg-green-600">
                              <Check className="h-3 w-3" />
                              승인됨
                            </Badge>
                          )}
                          {registration.status === "rejected" && (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              거절됨
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          신청일: {new Date(registration.createdAt).toLocaleString('ko-KR')}
                        </p>
                      </div>
                      {registration.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSmsMessage(defaultSmsMessage);
                              handleApproveClick(registration);
                            }}
                            disabled={approveMutation.isPending || checkExistingPrincipalMutation.isPending}
                            data-testid={`button-approve-${registration.id}`}
                          >
                            {checkExistingPrincipalMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4 mr-1" />
                            )}
                            승인
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setRejectingRegistration(registration);
                              setRejectDialogOpen(true);
                            }}
                            data-testid={`button-reject-${registration.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            거절
                          </Button>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">신청자</p>
                          <p className="font-medium">{registration.applicantName}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">연락처</p>
                          <p className="font-medium">{registration.applicantPhone}</p>
                        </div>
                        {registration.applicantEmail && (
                          <div>
                            <p className="text-muted-foreground">이메일</p>
                            <p className="font-medium">{registration.applicantEmail}</p>
                          </div>
                        )}
                        {registration.businessName && (
                          <div>
                            <p className="text-muted-foreground">사업자명</p>
                            <p className="font-medium">{registration.businessName}</p>
                          </div>
                        )}
                        {registration.representativeName && (
                          <div>
                            <p className="text-muted-foreground">대표자명</p>
                            <p className="font-medium">{registration.representativeName}</p>
                          </div>
                        )}
                        {registration.businessRegistrationNumber && (
                          <div>
                            <p className="text-muted-foreground">사업자등록번호</p>
                            <p className="font-medium">{registration.businessRegistrationNumber}</p>
                          </div>
                        )}
                        {registration.businessAddress && (
                          <div className="col-span-2">
                            <p className="text-muted-foreground">주소</p>
                            <p className="font-medium">{registration.businessAddress}</p>
                          </div>
                        )}
                        {registration.businessPhone && (
                          <div>
                            <p className="text-muted-foreground">학원 전화번호</p>
                            <p className="font-medium">{registration.businessPhone}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-muted-foreground">교육비 결제 연동</p>
                          <p className="font-medium">
                            {registration.tossConsentAgreed ? (
                              <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                <CreditCard className="h-3.5 w-3.5" />
                                동의함
                              </span>
                            ) : (
                              <span className="text-muted-foreground">미동의</span>
                            )}
                          </p>
                        </div>
                      </div>
                      {registration.status === "rejected" && registration.rejectReason && (
                        <div className="mt-4 p-3 bg-destructive/10 rounded-md">
                          <p className="text-sm font-medium text-destructive flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            거절 사유
                          </p>
                          <p className="text-sm mt-1">{registration.rejectReason}</p>
                        </div>
                      )}
                      {registration.status === "approved" && registration.reviewedAt && (
                        <p className="text-sm text-muted-foreground mt-3">
                          승인일: {new Date(registration.reviewedAt).toLocaleString('ko-KR')}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>학원 등록 거절</DialogTitle>
                <DialogDescription>
                  {rejectingRegistration?.name}의 등록 신청을 거절합니다. 거절 사유를 입력해주세요.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>거절 사유</Label>
                  <Input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="거절 사유를 입력해주세요"
                    data-testid="input-reject-reason"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setRejectDialogOpen(false);
                    setRejectingRegistration(null);
                    setRejectReason("");
                  }}
                >
                  취소
                </Button>
                <Button
                  variant="destructive"
                  disabled={!rejectReason.trim() || rejectMutation.isPending}
                  onClick={() => {
                    if (rejectingRegistration) {
                      rejectMutation.mutate({ id: rejectingRegistration.id, reason: rejectReason });
                    }
                  }}
                  data-testid="button-confirm-reject"
                >
                  {rejectMutation.isPending ? "처리 중..." : "거절"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="stats" className="mt-4">
          <AllCentersStats />
        </TabsContent>
      </Tabs>

      {/* Existing Principal Confirmation Dialog */}
      <Dialog open={existingPrincipalDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setExistingPrincipalDialogOpen(false);
          setExistingPrincipalInfo(null);
          setPendingApprovalRegistration(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>기존 학원이 있습니다</DialogTitle>
            <DialogDescription>
              이 전화번호로 등록된 기존 계정이 있습니다. 새 학원을 기존 계정에 추가하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">기존 원장 정보</span>
              </div>
              <div className="text-sm space-y-1 ml-6">
                <p>이름: {existingPrincipalInfo?.existingUser?.name}</p>
                <p>전화번호: {existingPrincipalInfo?.existingUser?.phone}</p>
                <p>현재 관리 학원: {existingPrincipalInfo?.existingCenters || "없음"} ({existingPrincipalInfo?.centerCount || 0}개)</p>
              </div>
            </div>
            
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                "추가"를 누르시면 <strong>{pendingApprovalRegistration?.name}</strong> 학원이 기존 원장 계정에 추가되어 
                하나의 아이디로 여러 학원을 관리할 수 있게 됩니다.
              </p>
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setExistingPrincipalDialogOpen(false);
                setExistingPrincipalInfo(null);
                setPendingApprovalRegistration(null);
              }}
            >
              취소
            </Button>
            <Button
              onClick={handleConfirmLinkExisting}
              data-testid="button-confirm-link-existing"
            >
              <Building2 className="h-4 w-4 mr-1" />
              기존 계정에 추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMS Confirmation Dialog for Registration Approval */}
      <Dialog open={smsDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setSmsDialogOpen(false);
          setApprovingRegistration(null);
          setExistingPrincipalInfo(null);
          setPendingApprovalRegistration(null);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>등록 승인 및 알림 전송</DialogTitle>
            <DialogDescription>
              {approvingRegistration?.name} 학원 등록을 승인합니다. 신청자에게 알림 문자를 전송하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">수신자</Label>
              <p className="font-medium">{approvingRegistration?.applicantName} ({approvingRegistration?.applicantPhone})</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sms-message">문자 내용 (수정 가능)</Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setSmsMessage(builtInDefaultSmsMessage);
                    }}
                    data-testid="button-reset-sms-template"
                  >
                    기본값 복원
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary"
                    onClick={() => saveTemplateMutation.mutate(smsMessage)}
                    disabled={saveTemplateMutation.isPending}
                    data-testid="button-save-sms-template"
                  >
                    {saveTemplateMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3 mr-1" />
                    )}
                    서식 저장
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                사용 가능한 변수: {"{센터명}"}, {"{아이디}"}, {"{비밀번호}"}, {"{원장명}"}
              </p>
              <Textarea
                id="sms-message"
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                rows={16}
                className="resize-none text-sm"
                data-testid="textarea-sms-message"
              />
            </div>
          </div>
          
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setSmsDialogOpen(false);
                setApprovingRegistration(null);
              }}
              disabled={approveMutation.isPending || sendApprovalSmsMutation.isPending}
              data-testid="button-cancel-approval"
            >
              취소
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleApproveWithSms(false)}
              disabled={approveMutation.isPending || sendApprovalSmsMutation.isPending}
              data-testid="button-approve-without-sms"
            >
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  처리 중...
                </>
              ) : (
                "문자 없이 승인만"
              )}
            </Button>
            <Button
              onClick={() => handleApproveWithSms(true)}
              disabled={approveMutation.isPending || sendApprovalSmsMutation.isPending || !approvingRegistration?.applicantPhone}
              data-testid="button-approve-with-sms"
            >
              {(approveMutation.isPending || sendApprovalSmsMutation.isPending) ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  처리 중...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  승인 및 문자 전송
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk SMS Dialog */}
      <Dialog open={isBulkSmsDialogOpen} onOpenChange={setIsBulkSmsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>단체 문자 발송</DialogTitle>
            <DialogDescription>
              선택한 {selectedCentersForSms.length}개 센터에 단체 문자를 발송합니다
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>발송 대상</Label>
              <Select 
                value={bulkSmsTargetType} 
                onValueChange={(v: any) => setBulkSmsTargetType(v)}
              >
                <SelectTrigger data-testid="select-bulk-sms-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="principals">원장님</SelectItem>
                  <SelectItem value="teachers">선생님</SelectItem>
                  <SelectItem value="students">학생</SelectItem>
                  <SelectItem value="parents">학부모</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>메시지</Label>
              <Textarea
                placeholder="문자 메시지를 입력해주세요"
                value={bulkSmsMessage}
                onChange={(e) => setBulkSmsMessage(e.target.value)}
                rows={6}
                data-testid="textarea-bulk-sms-message"
              />
              <p className="text-xs text-muted-foreground">
                {bulkSmsMessage.length}자 / 90자 이상 LMS 전환
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsBulkSmsDialogOpen(false)}
              disabled={isBulkSmsSending}
              data-testid="button-cancel-bulk-sms"
            >
              취소
            </Button>
            <Button 
              onClick={handleBulkSmsSend}
              disabled={isBulkSmsSending || !bulkSmsMessage.trim()}
              data-testid="button-send-bulk-sms"
            >
              {isBulkSmsSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  발송 중...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  발송
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
