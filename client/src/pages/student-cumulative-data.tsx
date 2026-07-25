import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { ManualButton } from "@/components/manual-button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { BarChart2, TrendingUp, TrendingDown, Clock, BookCheck, GraduationCap, Users, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { User as UserType, Class } from "@shared/schema";
import { UserRole } from "@shared/schema";

interface MonthlyData {
  month: string;
  assessment: number | null;
  homework: number | null;
  lateRatio: number | null;
}

interface StudentSummary {
  studentId: string;
  studentName: string;
  grade: string | null;
  avgAssessment: number | null;
  avgHomework: number | null;
  lateRatio: number;
  attendanceCount: number;
  classIds?: string[];
}

interface TeacherDataResponse {
  classes: { id: string; name: string; subject: string | null }[];
  students: StudentSummary[];
}

const GRADE_TABS = [
  { value: "all", label: "전체" },
  { value: "초", label: "초등" },
  { value: "중", label: "중등" },
  { value: "고", label: "고등" },
];

// 학년 축약 함수: "중학교 3학년" -> "중3", "고등학교 2학년" -> "고2"
function formatGradeShort(grade: string | null): string {
  if (!grade) return "-";
  
  // 이미 축약 형태인 경우 (초1, 중2, 고3 등)
  if (/^[초중고]\d$/.test(grade)) return grade;
  
  // "초등학교 X학년" -> "초X"
  const elemMatch = grade.match(/초등학교?\s*(\d)/);
  if (elemMatch) return `초${elemMatch[1]}`;
  
  // "중학교 X학년" -> "중X"
  const midMatch = grade.match(/중학교?\s*(\d)/);
  if (midMatch) return `중${midMatch[1]}`;
  
  // "고등학교 X학년" -> "고X"
  const highMatch = grade.match(/고등학교?\s*(\d)/);
  if (highMatch) return `고${highMatch[1]}`;
  
  return grade;
}

export default function StudentCumulativeDataPage() {
  const { user, selectedCenter } = useAuth();
  const centerId = selectedCenter?.id;
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const isStudent = !!user && user.role === UserRole.STUDENT;
  const isParent = !!user && user.role === UserRole.PARENT;
  const isTeacher = !!user && (user.role === UserRole.TEACHER || user.role === UserRole.CLINIC_TEACHER);
  const isPrincipal = !!user && user.role === UserRole.PRINCIPAL;
  const isAdmin = !!user && user.role === UserRole.ADMIN;

  const canViewAllStudents = isTeacher || isPrincipal || isAdmin;

  const { data: classes } = useQuery<Class[]>({
    queryKey: ["/api/classes", centerId],
    enabled: !!centerId && canViewAllStudents,
  });

  const studentId = isStudent ? user?.id : (isParent ? (user as any)?.childId : selectedStudent);

  const { data: monthlyData, isLoading: monthlyLoading } = useQuery<MonthlyData[]>({
    queryKey: [`/api/student-cumulative-data/${studentId}?centerId=${centerId}`],
    enabled: !!studentId && !!centerId,
  });

  const { data: teacherData, isLoading: teacherDataLoading } = useQuery<TeacherDataResponse>({
    queryKey: [`/api/cumulative-data/by-teacher/${user?.id}?centerId=${centerId}`],
    enabled: !!user?.id && !!centerId && isTeacher,
  });

  const { data: classData, isLoading: classDataLoading } = useQuery<StudentSummary[]>({
    queryKey: [`/api/cumulative-data/by-class/${selectedClass}?centerId=${centerId}`],
    enabled: selectedClass !== "all" && !!centerId && isTeacher,
  });

  // Center-wide cumulative data for principals/admins
  const { data: centerData, isLoading: centerDataLoading } = useQuery<StudentSummary[]>({
    queryKey: ["/api/cumulative-data/by-center", centerId],
    enabled: !!centerId && (isPrincipal || isAdmin),
  });

  const studentList = useMemo((): StudentSummary[] => {
    let list: StudentSummary[] = [];
    
    if (isTeacher && teacherData?.students) {
      if (selectedClass === "all") {
        list = teacherData.students;
      } else {
        list = teacherData.students.filter(s => s.classIds?.includes(selectedClass));
      }
    } else if ((isPrincipal || isAdmin) && centerData) {
      list = centerData;
    }
    
    // Filter by grade tab
    if (selectedGrade !== "all") {
      list = list.filter(s => s.grade?.startsWith(selectedGrade));
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      list = list.filter(s => 
        s.studentName.toLowerCase().includes(query) ||
        (s.grade?.toLowerCase().includes(query))
      );
    }
    
    return list;
  }, [isTeacher, teacherData, selectedClass, isPrincipal, isAdmin, centerData, selectedGrade, searchQuery]);

  const classesList = useMemo(() => {
    if (isTeacher && teacherData?.classes) return teacherData.classes;
    return classes || [];
  }, [isTeacher, teacherData, classes]);

  const chartData = useMemo(() => {
    if (!monthlyData) return [];
    return monthlyData.map(d => ({
      ...d,
      monthLabel: d.month.slice(5),
    }));
  }, [monthlyData]);

  const summaryStats = useMemo(() => {
    if (!monthlyData || monthlyData.length === 0) return null;

    const recentMonths = monthlyData.slice(-6);
    const validAssessments = recentMonths.filter(d => d.assessment !== null);
    const validHomework = recentMonths.filter(d => d.homework !== null);
    const validLateRatio = recentMonths.filter(d => d.lateRatio !== null);

    const avgAssessment = validAssessments.length > 0
      ? validAssessments.reduce((sum, d) => sum + (d.assessment || 0), 0) / validAssessments.length
      : null;
    const avgHomework = validHomework.length > 0
      ? validHomework.reduce((sum, d) => sum + (d.homework || 0), 0) / validHomework.length
      : null;
    const avgLateRatio = validLateRatio.length > 0
      ? validLateRatio.reduce((sum, d) => sum + (d.lateRatio || 0), 0) / validLateRatio.length
      : null;

    const prevMonths = monthlyData.slice(-12, -6);
    const prevAssessments = prevMonths.filter(d => d.assessment !== null);
    const prevAvgAssessment = prevAssessments.length > 0
      ? prevAssessments.reduce((sum, d) => sum + (d.assessment || 0), 0) / prevAssessments.length
      : null;

    return {
      avgAssessment,
      avgHomework,
      avgLateRatio,
      assessmentTrend: avgAssessment && prevAvgAssessment ? avgAssessment - prevAvgAssessment : null,
    };
  }, [monthlyData]);

  const getColorByValue = (value: number | null, type: "assessment" | "homework" | "late") => {
    if (value === null) return "text-muted-foreground";
    if (type === "late") {
      if (value <= 5) return "text-green-600 dark:text-green-400";
      if (value <= 15) return "text-yellow-600 dark:text-yellow-400";
      return "text-red-600 dark:text-red-400";
    }
    if (value >= 80) return "text-green-600 dark:text-green-400";
    if (value >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const renderFilters = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Grade Tabs */}
        <Tabs value={selectedGrade} onValueChange={setSelectedGrade}>
          <TabsList>
            {GRADE_TABS.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} data-testid={`tab-grade-${tab.value}`}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="학생 이름 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8"
            data-testid="input-student-search"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setSearchQuery("")}
              data-testid="button-clear-search"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
        
        {/* Class Filter (for teachers) */}
        {isTeacher && classesList.length > 0 && (
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-[180px]" data-testid="select-class-filter">
              <SelectValue placeholder="반 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 반</SelectItem>
              {classesList.map(cls => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name} {cls.subject}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      
      {/* Result count */}
      <div className="text-sm text-muted-foreground">
        총 {studentList.length}명의 학생
        {selectedGrade !== "all" && ` (${GRADE_TABS.find(t => t.value === selectedGrade)?.label})`}
        {searchQuery && ` - "${searchQuery}" 검색 결과`}
      </div>
    </div>
  );

  const renderSummaryCards = () => {
    if (!summaryStats) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              평균 평가점수 (최근 6개월)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getColorByValue(summaryStats.avgAssessment, "assessment")}`}>
              {summaryStats.avgAssessment !== null ? `${summaryStats.avgAssessment.toFixed(1)}점` : "-"}
            </div>
            {summaryStats.assessmentTrend !== null && (
              <div className={`text-sm flex items-center gap-1 ${summaryStats.assessmentTrend >= 0 ? "text-green-600" : "text-red-600"}`}>
                {summaryStats.assessmentTrend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                전기 대비 {summaryStats.assessmentTrend >= 0 ? "+" : ""}{summaryStats.assessmentTrend.toFixed(1)}점
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookCheck className="w-4 h-4" />
              평균 숙제완성도 (최근 6개월)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getColorByValue(summaryStats.avgHomework, "homework")}`}>
              {summaryStats.avgHomework !== null ? `${summaryStats.avgHomework.toFixed(1)}%` : "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              평균 지각비율 (최근 6개월)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getColorByValue(summaryStats.avgLateRatio, "late")}`}>
              {summaryStats.avgLateRatio !== null ? `${summaryStats.avgLateRatio.toFixed(1)}%` : "-"}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderChart = () => {
    if (monthlyLoading) {
      return <Skeleton className="h-[400px] w-full" />;
    }

    if (!chartData || chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-[400px] text-muted-foreground">
          데이터가 없습니다
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="monthLabel" className="text-xs" />
          <YAxis domain={[0, 100]} className="text-xs" />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            formatter={(value: any, name: string) => {
              if (value === null) return ["-", name];
              const label = name === "평가점수" ? `${value}점` : `${value}%`;
              return [label, name];
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="assessment"
            name="평가점수"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="homework"
            name="숙제완성도"
            stroke="hsl(142 76% 36%)"
            strokeWidth={2}
            dot={{ fill: "hsl(142 76% 36%)", strokeWidth: 2 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="lateRatio"
            name="지각비율"
            stroke="hsl(0 84% 60%)"
            strokeWidth={2}
            dot={{ fill: "hsl(0 84% 60%)", strokeWidth: 2 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderStudentTable = () => {
    const dataList = studentList;

    if (teacherDataLoading || centerDataLoading) {
      return <Skeleton className="h-[300px] w-full" />;
    }

    if (dataList.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          학생 데이터가 없습니다
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">학생명</TableHead>
            <TableHead className="whitespace-nowrap">학년</TableHead>
            <TableHead className="text-right whitespace-nowrap">평균 평가점수</TableHead>
            <TableHead className="text-right whitespace-nowrap">평균 숙제완성도</TableHead>
            <TableHead className="text-right whitespace-nowrap">지각비율</TableHead>
            <TableHead className="text-right whitespace-nowrap">출결횟수</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(dataList as StudentSummary[]).map((student) => (
            <TableRow
              key={student.studentId}
              className="cursor-pointer hover-elevate"
              onClick={() => setSelectedStudent(student.studentId)}
              data-testid={`row-student-${student.studentId}`}
            >
              <TableCell className="font-medium whitespace-nowrap">{student.studentName}</TableCell>
              <TableCell className="whitespace-nowrap">{formatGradeShort(student.grade)}</TableCell>
              <TableCell className={`text-right whitespace-nowrap ${getColorByValue(student.avgAssessment, "assessment")}`}>
                {student.avgAssessment !== null ? `${student.avgAssessment}점` : "-"}
              </TableCell>
              <TableCell className={`text-right whitespace-nowrap ${getColorByValue(student.avgHomework, "homework")}`}>
                {student.avgHomework !== null ? `${student.avgHomework}%` : "-"}
              </TableCell>
              <TableCell className={`text-right whitespace-nowrap ${getColorByValue(student.lateRatio, "late")}`}>
                {student.lateRatio}%
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">{student.attendanceCount}회</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart2 className="w-6 h-6" />
              학생 누적데이터
            </h1>
            <p className="text-muted-foreground">
              최근 2년간 평가점수, 숙제완성도, 출결 현황을 확인하세요
            </p>
          </div>
          <ManualButton menuKey="student-cumulative-data" />
        </div>
        {canViewAllStudents && !selectedStudent && renderFilters()}
      </div>

      {(isStudent || isParent || selectedStudent) && (
        <>
          {selectedStudent && canViewAllStudents && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedStudent("")}
                data-testid="button-back-to-list"
              >
                <X className="w-4 h-4 mr-1" />
                목록으로 돌아가기
              </Button>
              <span className="text-lg font-medium">
                {studentList.find(s => s.studentId === selectedStudent)?.studentName || 
                 teacherData?.students.find(s => s.studentId === selectedStudent)?.studentName ||
                 centerData?.find(s => s.studentId === selectedStudent)?.studentName}
              </span>
            </div>
          )}
          {renderSummaryCards()}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">월별 추이 그래프</CardTitle>
              <CardDescription>
                평가점수, 숙제완성도, 지각비율의 월별 변화를 확인하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderChart()}
            </CardContent>
          </Card>
        </>
      )}

      {canViewAllStudents && !selectedStudent && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  학생별 현황
                </CardTitle>
                <CardDescription>
                  학생을 클릭하면 상세 그래프를 확인할 수 있습니다
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {renderStudentTable()}
          </CardContent>
        </Card>
      )}

      {!isStudent && !isParent && !canViewAllStudents && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            학생 누적데이터는 학생, 학부모, 선생님, 원장, 관리자만 접근할 수 있습니다.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
