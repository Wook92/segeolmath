import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, subMonths, addMonths, startOfMonth, endOfMonth, getWeek, startOfWeek, endOfWeek, differenceInCalendarWeeks, eachWeekOfInterval } from "date-fns";
import { ManualButton } from "@/components/manual-button";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, BarChart3, TrendingUp, TrendingDown, Minus, ChevronDown, Trophy, Trash2, Pencil } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole, isAssistantTeacher, type Assessment, type Class, type User } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TeacherClassTabs } from "@/components/teacher-class-tabs";

function getWeekOfMonth(date: Date): number {
  const start = startOfMonth(date);
  return differenceInCalendarWeeks(date, start, { weekStartsOn: 1 }) + 1;
}

function getWeekLabel(date: Date): string {
  const month = format(date, "M");
  const week = getWeekOfMonth(date);
  return `${month}월 ${week}주차`;
}

interface ClassWeeklySummary {
  classId: string;
  className: string;
  classSubject: string | null;
  studentScores: Record<string, { name: string; scores: number[]; average: number; assessmentIds: string[] }>;
  classAverage: number;
}

interface WeeklySummary {
  weekLabel: string;
  weekStart: Date;
  weekEnd: Date;
  classSummaries: ClassWeeklySummary[];
}

function groupAssessmentsByWeekAndClass(assessments: any[]): WeeklySummary[] {
  const weekMap = new Map<string, { weekLabel: string; weekStart: Date; weekEnd: Date; classMap: Map<string, ClassWeeklySummary> }>();

  assessments.forEach((a) => {
    const date = new Date(a.assessmentDate);
    const weekLabel = getWeekLabel(date);
    const wStart = startOfWeek(date, { weekStartsOn: 1 });
    const wEnd = endOfWeek(date, { weekStartsOn: 1 });

    if (!weekMap.has(weekLabel)) {
      weekMap.set(weekLabel, {
        weekLabel,
        weekStart: wStart,
        weekEnd: wEnd,
        classMap: new Map(),
      });
    }

    const week = weekMap.get(weekLabel)!;
    const classId = a.classId;
    const className = a.class?.name || "Unknown";
    const classSubject = a.class?.subject || null;

    if (!week.classMap.has(classId)) {
      week.classMap.set(classId, {
        classId,
        className,
        classSubject,
        studentScores: {},
        classAverage: 0,
      });
    }

    const classSummary = week.classMap.get(classId)!;
    const studentId = a.studentId;
    const studentName = a.student?.name || "Unknown";

    if (!classSummary.studentScores[studentId]) {
      classSummary.studentScores[studentId] = { name: studentName, scores: [], average: 0, assessmentIds: [] };
    }
    classSummary.studentScores[studentId].scores.push(a.score);
    classSummary.studentScores[studentId].assessmentIds.push(a.id);
  });

  const result: WeeklySummary[] = [];
  weekMap.forEach((week) => {
    const classSummaries: ClassWeeklySummary[] = [];
    week.classMap.forEach((classSummary) => {
      let totalSum = 0;
      let totalCount = 0;
      Object.values(classSummary.studentScores).forEach((student) => {
        const sum = student.scores.reduce((acc, s) => acc + s, 0);
        student.average = Math.round(sum / student.scores.length);
        totalSum += student.average;
        totalCount++;
      });
      classSummary.classAverage = totalCount > 0 ? Math.round(totalSum / totalCount) : 0;
      classSummaries.push(classSummary);
    });
    result.push({
      weekLabel: week.weekLabel,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      classSummaries,
    });
  });

  return result.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
}

function WeeklyAssessmentCard({ week, canDelete, onDelete, canEdit, onEdit }: { 
  week: WeeklySummary; 
  canDelete?: boolean;
  onDelete?: (assessmentIds: string[], studentName: string) => void;
  canEdit?: boolean;
  onEdit?: (assessmentIds: string[], studentName: string, currentScores: number[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dateRange = `${format(week.weekStart, "M/d")} ~ ${format(week.weekEnd, "M/d")}`;
  const totalStudents = week.classSummaries.reduce((sum, cs) => sum + Object.keys(cs.studentScores).length, 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="p-3 rounded-md bg-muted/50 hover-elevate cursor-pointer">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
              <div className="text-left">
                <p className="font-medium">{week.weekLabel}</p>
                <p className="text-xs text-muted-foreground">{dateRange}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{week.classSummaries.length}개 수업</Badge>
              <Badge variant="outline">{totalStudents}명</Badge>
            </div>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 ml-6 space-y-4 border-l-2 border-muted pl-4">
          {week.classSummaries.map((classSummary) => {
            const studentList = Object.entries(classSummary.studentScores)
              .sort((a, b) => b[1].average - a[1].average);
            const topScore = studentList.length > 0 ? studentList[0][1].average : 0;

            return (
              <div key={classSummary.classId} className="space-y-2">
                <div className="flex items-center justify-between gap-2 pb-1 border-b">
                  <span className="text-sm font-medium">
                    {classSummary.className}
                    {classSummary.classSubject && ` (${classSummary.classSubject})`}
                  </span>
                  <Badge variant="outline">평균 {classSummary.classAverage}점</Badge>
                </div>
                {studentList.map(([studentId, student], index) => {
                  const isFirst = student.average === topScore && studentList.length > 1;
                  return (
                    <div
                      key={studentId}
                      className="flex items-center justify-between p-2 rounded-md bg-background"
                      data-testid={`student-score-${classSummary.classId}-${studentId}`}
                    >
                      <div className="flex items-center gap-2">
                        {isFirst && (
                          <Trophy className="h-4 w-4 text-yellow-500" />
                        )}
                        <span className="text-sm font-medium">{student.name}</span>
                        {isFirst && (
                          <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">1등</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {student.scores.length > 1 && (
                          <span className="text-xs text-muted-foreground">
                            ({student.scores.join(", ")})
                          </span>
                        )}
                        <Badge 
                          variant={student.average >= classSummary.classAverage ? "default" : "secondary"}
                        >
                          {student.average}점
                        </Badge>
                        {student.average > classSummary.classAverage && (
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        )}
                        {student.average < classSummary.classAverage && (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                        {canEdit && onEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(student.assessmentIds, student.name, student.scores);
                            }}
                            data-testid={`button-edit-assessment-${studentId}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        {canDelete && onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(student.assessmentIds, student.name);
                            }}
                            data-testid={`button-delete-assessment-${studentId}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ScoreBar({ score, average, maxScore = 100 }: { score: number; average: number; maxScore?: number }) {
  const scorePercent = (score / maxScore) * 100;
  const avgPercent = (average / maxScore) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground w-12">내 점수</span>
        <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden relative">
          <div
            className="h-full bg-primary rounded-md transition-all duration-500"
            style={{ width: `${scorePercent}%` }}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium">
            {score}점
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground w-12">평균</span>
        <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden relative">
          <div
            className="h-full bg-muted-foreground/30 rounded-md transition-all duration-500"
            style={{ width: `${avgPercent}%` }}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
            {average}점
          </span>
        </div>
      </div>
    </div>
  );
}

function ScoreInputDialog({ classItem, students, allCenterStudents, onClose }: { 
  classItem: Class; 
  students: User[];
  allCenterStudents: User[];
  onClose: () => void 
}) {
  const { toast } = useToast();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [assessmentDate, setAssessmentDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const displayStudents = students.length > 0 ? students : allCenterStudents;

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/assessments/bulk", data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/assessments");
      toast({ title: "평가 점수가 입력되었습니다" });
      onClose();
    },
    onError: () => {
      toast({ title: "점수 입력에 실패했습니다", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    const assessments = Object.entries(scores)
      .filter(([_, score]) => score !== undefined && score !== null && !isNaN(score))
      .map(([studentId, score]) => ({
        classId: classItem.id,
        studentId,
        score,
        maxScore: 100,
        assessmentDate,
      }));

    if (assessments.length === 0) {
      toast({ title: "점수를 입력해주세요", variant: "destructive" });
      return;
    }

    createMutation.mutate({ assessments });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="assessmentDate">평가일</Label>
        <Input
          id="assessmentDate"
          type="date"
          value={assessmentDate}
          onChange={(e) => setAssessmentDate(e.target.value)}
          data-testid="input-assessment-date"
        />
      </div>

      {displayStudents.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <p>등록된 학생이 없습니다</p>
          <p className="text-sm">먼저 학생을 수업에 등록해주세요</p>
        </div>
      ) : (
        <>
          {students.length === 0 && allCenterStudents.length > 0 && (
            <p className="text-sm text-muted-foreground bg-muted p-2 rounded-md">
              이 평가 수업에 등록된 학생이 없어 센터 전체 학생을 표시합니다
            </p>
          )}
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {displayStudents.map((student) => (
              <div key={student.id} className="flex items-center gap-3">
                <span className="flex-1 text-sm font-medium">{student.name}</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="w-24"
                  placeholder="점수"
                  value={scores[student.id] ?? ""}
                  onChange={(e) => setScores((prev) => ({
                    ...prev,
                    [student.id]: parseInt(e.target.value) || 0,
                  }))}
                  data-testid={`input-score-${student.id}`}
                />
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
            ))}
          </div>
        </>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={createMutation.isPending || displayStudents.length === 0}
          data-testid="button-submit-scores"
        >
          {createMutation.isPending ? "저장 중..." : "점수 저장"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function WeeklyBarChart({ data, title, showLegend = true }: { 
  data: { week: string; myScore: number; classAverage: number }[]; 
  title?: string;
  showLegend?: boolean;
}) {
  return (
    <div className="space-y-2">
      {(title || showLegend) && (
        <div className="flex items-center justify-between">
          {title && <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>}
          {showLegend && (
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "#1E3A5F" }} />
                <span>내 점수</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "#8B2942" }} />
                <span>반 평균</span>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={4} margin={{ left: -20, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="week" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} fontSize={11} tickLine={false} axisLine={false} width={30} />
            <Tooltip 
              formatter={(value: number, name: string) => [
                `${value}점`,
                name === "myScore" ? "내 점수" : "반 평균"
              ]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                backgroundColor: "hsl(var(--background))",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="myScore" fill="#1E3A5F" radius={[3, 3, 0, 0]} maxBarSize={35} />
            <Bar dataKey="classAverage" fill="#8B2942" radius={[3, 3, 0, 0]} maxBarSize={35} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StudentAssessments() {
  const { user, selectedCenter } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: assessments, isLoading } = useQuery<any[]>({
    queryKey: [`/api/students/${user?.id}/assessments?month=${format(currentMonth, "yyyy-MM")}&centerId=${selectedCenter?.id}`],
    enabled: !!user?.id && !!selectedCenter?.id,
  });

  const getScoreTrend = (score: number, average: number) => {
    const diff = score - average;
    if (diff > 5) return { icon: TrendingUp, className: "text-green-600 dark:text-green-400" };
    if (diff < -5) return { icon: TrendingDown, className: "text-red-600 dark:text-red-400" };
    return { icon: Minus, className: "text-muted-foreground" };
  };

  // Group assessments by class
  const groupedByClass = assessments?.reduce((acc: Record<string, any[]>, assessment: any) => {
    const classId = assessment.classId;
    if (!acc[classId]) {
      acc[classId] = [];
    }
    acc[classId].push(assessment);
    return acc;
  }, {}) || {};

  // Get weekly chart data for a specific class or all classes
  const getWeeklyChartDataForClass = (classAssessments: any[]) => {
    const weekMap = new Map<number, { scores: number[], averages: number[] }>();
    
    classAssessments.forEach((a) => {
      const date = new Date(a.assessmentDate);
      const weekNum = getWeekOfMonth(date);
      
      if (!weekMap.has(weekNum)) {
        weekMap.set(weekNum, { scores: [], averages: [] });
      }
      weekMap.get(weekNum)!.scores.push(a.score);
      weekMap.get(weekNum)!.averages.push(a.average);
    });

    return Array.from(weekMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([weekNum, data]) => ({
        week: `${weekNum}주차`,
        myScore: Math.round(data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length),
        classAverage: Math.round(data.averages.reduce((sum, s) => sum + s, 0) / data.averages.length),
      }));
  };

  // Overall weekly chart (all classes combined)
  const overallChartData = assessments?.length ? getWeeklyChartDataForClass(assessments) : [];
  
  // Overall averages
  const overallMyAverage = assessments?.length 
    ? Math.round(assessments.reduce((sum, a) => sum + a.score, 0) / assessments.length)
    : 0;
  const overallClassAverage = assessments?.length 
    ? Math.round(assessments.reduce((sum, a) => sum + a.average, 0) / assessments.length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">평가 결과</h1>
        <p className="text-muted-foreground">나의 평가 점수를 확인하세요</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {format(currentMonth, "yyyy년 M월", { locale: ko })} 평가
            </CardTitle>
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
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : !assessments?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>이번 달 평가 결과가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overall Summary Section */}
              {overallChartData.length > 0 && (
                <div className="space-y-4 p-4 rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">전체 평가 종합</h3>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-sm">
                        내 평균: {overallMyAverage}점
                      </Badge>
                      <Badge variant={overallMyAverage >= overallClassAverage ? "default" : "secondary"} className="text-sm">
                        {overallMyAverage >= overallClassAverage ? "+" : ""}{overallMyAverage - overallClassAverage}점
                      </Badge>
                    </div>
                  </div>
                  <WeeklyBarChart data={overallChartData} title="전체 주차별 성적" />
                </div>
              )}

              {/* Per-Class Charts Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">수업별 주차 성적</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {Object.entries(groupedByClass).map(([classId, classAssessments]) => {
                    const firstAssessment = classAssessments[0];
                    const className = firstAssessment.class?.name || "수업";
                    const classSubject = firstAssessment.class?.subject;
                    const isFirst = firstAssessment.isFirst;
                    const studentMonthlyAvg = firstAssessment.studentMonthlyAverage || 0;
                    const classAvg = firstAssessment.average || 0;
                    const classChartData = getWeeklyChartDataForClass(classAssessments);

                    return (
                      <Card key={classId} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {isFirst && <Trophy className="h-4 w-4 text-yellow-500" />}
                            <span className="font-medium text-sm">
                              {className}
                              {classSubject && <span className="text-muted-foreground font-normal ml-1">({classSubject})</span>}
                            </span>
                            {isFirst && (
                              <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">1등</Badge>
                            )}
                          </div>
                          <Badge variant={studentMonthlyAvg >= classAvg ? "default" : "secondary"} className="text-xs">
                            {studentMonthlyAvg >= classAvg ? "+" : ""}{studentMonthlyAvg - classAvg}점
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          {classAssessments.length}회 평가 | 내 월평균: {studentMonthlyAvg}점 | 반 평균: {classAvg}점
                        </p>
                        <WeeklyBarChart data={classChartData} showLegend={false} />
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Detailed Assessment List */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">상세 평가 내역</h3>
                {Object.entries(groupedByClass).map(([classId, classAssessments]) => {
                    const firstAssessment = classAssessments[0];
                    const className = firstAssessment.class?.name || "수업";
                    const classSubject = firstAssessment.class?.subject;
                    const isFirst = firstAssessment.isFirst;
                    const studentMonthlyAvg = firstAssessment.studentMonthlyAverage || 0;
                    const classAvg = firstAssessment.average || 0;

                    return (
                      <Collapsible key={classId}>
                        <CollapsibleTrigger className="w-full">
                          <div className="p-3 rounded-md bg-muted/50 hover-elevate cursor-pointer">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <ChevronDown className="h-4 w-4" />
                                {isFirst && <Trophy className="h-4 w-4 text-yellow-500" />}
                                <span className="font-medium text-sm">
                                  {className}
                                  {classSubject && <span className="text-muted-foreground font-normal ml-1">({classSubject})</span>}
                                </span>
                                {isFirst && (
                                  <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">1등</Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">{classAssessments.length}회</span>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 ml-4 space-y-2 border-l-2 border-muted pl-4">
                            {classAssessments
                              .sort((a: any, b: any) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime())
                              .map((assessment: any) => {
                                const trend = getScoreTrend(assessment.score, assessment.average);
                                const TrendIcon = trend.icon;

                                return (
                                  <div key={assessment.id} className="p-3 rounded-md bg-muted/30">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm text-muted-foreground">
                                        {format(new Date(assessment.assessmentDate), "M월 d일", { locale: ko })}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <Badge variant={assessment.score >= assessment.average ? "default" : "secondary"}>
                                          {assessment.score}점
                                        </Badge>
                                        <div className={cn("flex items-center gap-1", trend.className)}>
                                          <TrendIcon className="h-3 w-3" />
                                        </div>
                                      </div>
                                    </div>
                                    <ScoreBar
                                      score={assessment.score}
                                      average={assessment.average}
                                      maxScore={assessment.maxScore}
                                    />
                                  </div>
                                );
                              })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TeacherAssessments() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [selectedClassForInput, setSelectedClassForInput] = useState<Class | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");
  const [deleteConfirm, setDeleteConfirm] = useState<{ ids: string[]; name: string } | null>(null);
  const [editData, setEditData] = useState<{ ids: string[]; name: string; scores: number[] } | null>(null);
  const [editScores, setEditScores] = useState<number[]>([]);
  const [teacherViewTab, setTeacherViewTab] = useState<"my" | "assistant">("my");

  const isAdminOrPrincipalOrClinic = user && (user.role >= UserRole.PRINCIPAL || user.isClinicTeacher);
  const canDeleteAssessments = user && user.role >= UserRole.TEACHER;
  const canEditAssessments = user && user.role >= UserRole.TEACHER;

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await apiRequest("DELETE", `/api/assessments/${id}?actorId=${user?.id}`);
      }
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/assessments");
      toast({ title: "평가 점수가 삭제되었습니다" });
      setDeleteConfirm(null);
    },
    onError: () => {
      toast({ title: "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ ids, scores }: { ids: string[]; scores: number[] }) => {
      for (let i = 0; i < ids.length; i++) {
        await apiRequest("PATCH", `/api/assessments/${ids[i]}`, { score: scores[i], actorId: user?.id });
      }
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/assessments");
      toast({ title: "평가 점수가 수정되었습니다" });
      setEditData(null);
      setEditScores([]);
    },
    onError: () => {
      toast({ title: "수정에 실패했습니다", variant: "destructive" });
    },
  });

  const handleDeleteAssessment = (assessmentIds: string[], studentName: string) => {
    setDeleteConfirm({ ids: assessmentIds, name: studentName });
  };

  const handleEditAssessment = (assessmentIds: string[], studentName: string, currentScores: number[]) => {
    setEditData({ ids: assessmentIds, name: studentName, scores: currentScores });
    setEditScores([...currentScores]);
  };

  const { data: teachers } = useQuery<User[]>({
    queryKey: [`/api/centers/${selectedCenter?.id}/teachers`],
    enabled: !!selectedCenter?.id && !!isAdminOrPrincipalOrClinic,
  });

  const { data: classes, isLoading: loadingClasses } = useQuery<Class[]>({
    queryKey: [`/api/classes?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id,
  });

  // Set default teacher when data loads (for admin/principal/clinic)
  if (isAdminOrPrincipalOrClinic && teachers && teachers.length > 0 && !selectedTeacher) {
    setSelectedTeacher(teachers[0].id);
  }

  // Filter classes by teacher (teachers only see their own classes, clinic teachers see all)
  const isTeacherOnly = user && user.role === UserRole.TEACHER && !user.isClinicTeacher;
  const teacherClasses = classes?.filter((c) => {
    if (isTeacherOnly) return c.teacherId === user.id || isAssistantTeacher(c, user.id);
    if (!isAdminOrPrincipalOrClinic) return true;
    if (!selectedTeacher) return true;
    return c.teacherId === selectedTeacher || isAssistantTeacher(c, selectedTeacher);
  }) ?? [];

  const ownClasses = teacherClasses.filter((c) => isTeacherOnly ? c.teacherId === user.id : true);
  const assistantClasses = teacherClasses.filter((c) => isTeacherOnly ? (isAssistantTeacher(c, user.id) && c.teacherId !== user.id) : false);
  const hasAssistantClasses = assistantClasses.length > 0;
  const displayClasses = isTeacherOnly && hasAssistantClasses
    ? (teacherViewTab === "assistant" ? assistantClasses : ownClasses)
    : teacherClasses;

  const assessmentClasses = displayClasses.filter((c) => c.classType === "assessment");

  // Filter by selected class
  const displayAssessmentClasses = selectedClassFilter === "all"
    ? assessmentClasses
    : assessmentClasses.filter((c) => c.id === selectedClassFilter);

  const { data: students } = useQuery<User[]>({
    queryKey: [`/api/classes/${selectedClassForInput?.id}/students`],
    enabled: !!selectedClassForInput?.id,
  });

  const { data: centerStudents } = useQuery<User[]>({
    queryKey: [`/api/centers/${selectedCenter?.id}/students`],
    enabled: !!selectedCenter?.id && !!selectedClassForInput,
  });

  const { data: assessments, isLoading: loadingAssessments } = useQuery<Assessment[]>({
    queryKey: [`/api/assessments?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id,
  });

  const displayClassIds = new Set(displayClasses.map((c) => c.id));

  // Filter assessments by teacher and class
  const filteredAssessments = (assessments as any[])?.filter((a) => {
    const aClass = classes?.find((c) => c.id === a.classId);
    if (!aClass) return false;
    if (isTeacherOnly && hasAssistantClasses) {
      if (!displayClassIds.has(a.classId)) return false;
    } else {
      if (isTeacherOnly && aClass.teacherId !== user.id && !isAssistantTeacher(aClass, user.id)) return false;
    }
    if (isAdminOrPrincipalOrClinic && selectedTeacher && aClass.teacherId !== selectedTeacher && !isAssistantTeacher(aClass, selectedTeacher)) return false;
    if (selectedClassFilter !== "all" && a.classId !== selectedClassFilter) return false;
    return true;
  }) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">평가 관리</h1>
          <p className="text-muted-foreground">평가수업 점수 입력</p>
        </div>
        <ManualButton menuKey="assessments" />
      </div>

      {isAdminOrPrincipalOrClinic && teachers && teachers.length > 0 && (
        <div className="space-y-3">
          <Tabs value={selectedTeacher} onValueChange={(v) => {
            setSelectedTeacher(v);
            setSelectedClassFilter("all");
          }}>
            <TabsList className="flex-wrap h-auto gap-1">
              {teachers.map((t) => (
                <TabsTrigger key={t.id} value={t.id} data-testid={`teacher-tab-${t.id}`}>
                  {t.name} 선생님
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {assessmentClasses.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">수업:</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedClassFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedClassFilter("all")}
                  data-testid="class-filter-all"
                >
                  전체
                </Button>
                {assessmentClasses.map((c) => (
                  <Button
                    key={c.id}
                    variant={selectedClassFilter === c.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedClassFilter(c.id)}
                    data-testid={`class-filter-${c.id}`}
                  >
                    {c.name}{c.subject && ` (${c.subject})`}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isTeacherOnly && (
        <div className="space-y-3">
          <TeacherClassTabs
            teacherViewTab={teacherViewTab}
            onTabChange={(tab) => {
              setTeacherViewTab(tab);
              setSelectedClassFilter("all");
            }}
            ownCount={ownClasses.filter((c) => c.classType === "assessment").length}
            assistantCount={assistantClasses.filter((c) => c.classType === "assessment").length}
          />
          {assessmentClasses.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">수업:</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedClassFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedClassFilter("all")}
                  data-testid="class-filter-all"
                >
                  전체
                </Button>
                {assessmentClasses.map((c) => (
                  <Button
                    key={c.id}
                    variant={selectedClassFilter === c.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedClassFilter(c.id)}
                    data-testid={`class-filter-${c.id}`}
                  >
                    {c.name}{c.subject && ` (${c.subject})`}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>평가수업 목록</CardTitle>
            <CardDescription>점수를 입력할 수업을 선택하세요</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingClasses ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : displayAssessmentClasses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>평가수업이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayAssessmentClasses.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedClassForInput(cls)}
                    className="w-full p-3 rounded-md bg-muted/50 text-left hover-elevate flex items-center gap-3"
                    data-testid={`class-item-${cls.id}`}
                  >
                    <div
                      className="w-1 h-10 rounded-full"
                      style={{ backgroundColor: cls.color }}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{cls.name}{cls.subject && ` (${cls.subject})`}</p>
                    </div>
                    <Badge variant="secondary">평가</Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>주차별 평가 결과</CardTitle>
            <CardDescription>주차를 클릭하면 학생별 점수를 확인할 수 있습니다</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAssessments ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !filteredAssessments?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>평가 결과가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {groupAssessmentsByWeekAndClass(filteredAssessments).map((week) => (
                  <WeeklyAssessmentCard 
                    key={week.weekLabel} 
                    week={week} 
                    canEdit={!!canEditAssessments}
                    onEdit={handleEditAssessment}
                    canDelete={!!canDeleteAssessments}
                    onDelete={handleDeleteAssessment}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>평가 점수 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.name} 학생의 평가 점수 {deleteConfirm?.ids.length}건을 삭제하시겠습니까?
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.ids)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editData} onOpenChange={(open) => !open && setEditData(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>평가 점수 수정</DialogTitle>
            <DialogDescription>
              {editData?.name} 학생의 점수를 수정합니다
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {editScores.map((score, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-16">점수 {index + 1}</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={score}
                  onChange={(e) => {
                    const newScores = [...editScores];
                    newScores[index] = parseInt(e.target.value) || 0;
                    setEditScores(newScores);
                  }}
                  className="w-24"
                  data-testid={`input-edit-score-${index}`}
                />
                <span className="text-sm text-muted-foreground">점</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditData(null)} data-testid="button-cancel-edit">
              취소
            </Button>
            <Button 
              onClick={() => editData && editMutation.mutate({ ids: editData.ids, scores: editScores })}
              disabled={editMutation.isPending}
              data-testid="button-confirm-edit"
            >
              {editMutation.isPending ? "수정 중..." : "수정"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedClassForInput} onOpenChange={(open) => !open && setSelectedClassForInput(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedClassForInput?.name} 점수 입력</DialogTitle>
            <DialogDescription>학생별 점수를 입력하세요 (100점 만점)</DialogDescription>
          </DialogHeader>
          {selectedClassForInput && (
            <ScoreInputDialog
              classItem={selectedClassForInput}
              students={students ?? []}
              allCenterStudents={centerStudents ?? []}
              onClose={() => setSelectedClassForInput(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AssessmentsPage() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.role >= UserRole.TEACHER) {
    return <TeacherAssessments />;
  }

  return <StudentAssessments />;
}
