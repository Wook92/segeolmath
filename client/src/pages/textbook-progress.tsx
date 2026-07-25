import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Search, Users, BookOpen, ChevronLeft, ChevronRight, Download, Printer } from "lucide-react";
import type { User, TextbookProgress } from "@shared/schema";

const GRADE_OPTIONS = [
  "초1", "초2", "초3", "초4", "초5", "초6",
  "중1", "중2", "중3",
  "고1", "고2", "고3",
  "성인",
];

function getKoreaYearMonth(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }).substring(0, 7);
}

type EditableField = "learningLevel" | "progressBook" | "reviewBook" | "homeworkCalc" | "homeworkBook" | "notes";

function EditableCell({
  recordId,
  field,
  value,
  onSave,
}: {
  recordId: string;
  field: EditableField;
  value: string;
  onSave: (id: string, field: EditableField, value: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (localValue !== value) {
      onSave(recordId, field, localValue);
    }
  }, [localValue, value, recordId, field, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      setLocalValue(value);
      setIsEditing(false);
    }
  }, [value]);

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="h-8 text-sm border-primary"
        data-testid={`input-edit-${field}-${recordId}`}
      />
    );
  }

  return (
    <div
      className="min-h-[32px] flex items-center px-1 cursor-text rounded hover:bg-accent/50 transition-colors"
      onClick={() => setIsEditing(true)}
      data-testid={`cell-${field}-${recordId}`}
    >
      <span className="text-sm whitespace-pre-wrap break-words overflow-hidden">{value || <span className="text-muted-foreground/50">클릭하여 입력</span>}</span>
    </div>
  );
}

export default function TextbookProgressPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYearMonth, setSelectedYearMonth] = useState(getKoreaYearMonth());

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [addGradeFilter, setAddGradeFilter] = useState<string>("all");
  const [addSearchQuery, setAddSearchQuery] = useState("");

  const handlePrevMonth = () => {
    const [y, m] = selectedYearMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedYearMonth.split("-").map(Number);
    const d = new Date(y, m, 1);
    setSelectedYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const displayMonth = useMemo(() => {
    const [y, m] = selectedYearMonth.split("-").map(Number);
    return `${y}년 ${m}월`;
  }, [selectedYearMonth]);

  const { data: progressRecords = [], isLoading } = useQuery<TextbookProgress[]>({
    queryKey: ["/api/textbook-progress", selectedCenter?.id, selectedYearMonth],
    queryFn: () => fetch(`/api/textbook-progress?centerId=${selectedCenter?.id}&yearMonth=${selectedYearMonth}`).then(r => r.json()),
    enabled: !!selectedCenter?.id,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: [`/api/users?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id,
  });

  const students = useMemo(() =>
    allUsers.filter(u => u.role === 1),
    [allUsers]
  );

  const studentMap = useMemo(() => {
    const map: Record<string, User> = {};
    students.forEach(s => { map[s.id] = s; });
    return map;
  }, [students]);

  const existingStudentIds = useMemo(() =>
    new Set(progressRecords.map(r => r.studentId)),
    [progressRecords]
  );

  const filteredRecords = useMemo(() => {
    return progressRecords.filter(r => {
      const student = studentMap[r.studentId];
      if (!student) return false;
      if (gradeFilter !== "all" && student.grade !== gradeFilter) return false;
      if (searchQuery && !student.name.includes(searchQuery)) return false;
      return true;
    }).sort((a, b) => {
      const sa = studentMap[a.studentId];
      const sb = studentMap[b.studentId];
      if (!sa || !sb) return 0;
      const gradeOrder = GRADE_OPTIONS.indexOf(sa.grade || "") - GRADE_OPTIONS.indexOf(sb.grade || "");
      if (gradeOrder !== 0) return gradeOrder;
      return (sa.name || "").localeCompare(sb.name || "");
    });
  }, [progressRecords, studentMap, gradeFilter, searchQuery]);

  const availableStudents = useMemo(() => {
    return students.filter(s => {
      if (existingStudentIds.has(s.id)) return false;
      if (addGradeFilter !== "all" && s.grade !== addGradeFilter) return false;
      if (addSearchQuery && !s.name.includes(addSearchQuery)) return false;
      return true;
    }).sort((a, b) => {
      const gradeOrder = GRADE_OPTIONS.indexOf(a.grade || "") - GRADE_OPTIONS.indexOf(b.grade || "");
      if (gradeOrder !== 0) return gradeOrder;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [students, existingStudentIds, addGradeFilter, addSearchQuery]);

  const addMutation = useMutation({
    mutationFn: async (studentIds: string[]) => {
      for (const studentId of studentIds) {
        await apiRequest("POST", "/api/textbook-progress", {
          centerId: selectedCenter?.id,
          studentId,
          yearMonth: selectedYearMonth,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/textbook-progress"] });
      setIsAddOpen(false);
      setSelectedStudentIds([]);
      setAddSearchQuery("");
      setAddGradeFilter("all");
      toast({ title: "학생이 추가되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: "추가 실패", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, string> }) => {
      await apiRequest("PUT", `/api/textbook-progress/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/textbook-progress"] });
    },
    onError: (error: any) => {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/textbook-progress/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/textbook-progress"] });
      toast({ title: "삭제되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    },
  });

  const handleCellSave = useCallback((recordId: string, field: EditableField, value: string) => {
    updateMutation.mutate({ id: recordId, data: { [field]: value } });
  }, [updateMutation]);

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const uniqueGrades = useMemo(() => {
    const grades = new Set(students.map(s => s.grade).filter(Boolean));
    return GRADE_OPTIONS.filter(g => grades.has(g));
  }, [students]);

  const handleExcelDownload = () => {
    if (filteredRecords.length === 0) {
      toast({ title: "다운로드할 데이터가 없습니다", variant: "destructive" });
      return;
    }

    const BOM = "\uFEFF";
    const headers = ["학년", "이름", "학습레벨", "진도책", "복습책", "숙제연산", "숙제책", "특이사항"];
    const rows = filteredRecords.map(r => {
      const s = studentMap[r.studentId];
      return [
        s?.grade || "",
        s?.name || "",
        r.learningLevel || "",
        r.progressBook || "",
        r.reviewBook || "",
        r.homeworkCalc || "",
        r.homeworkBook || "",
        r.notes || "",
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });

    const csv = BOM + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `교재진도표_${selectedYearMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "엑셀 파일이 다운로드되었습니다" });
  };

  const handlePrint = () => {
    if (filteredRecords.length === 0) {
      toast({ title: "출력할 데이터가 없습니다", variant: "destructive" });
      return;
    }

    const rows = filteredRecords.map(r => {
      const s = studentMap[r.studentId];
      return `<tr>
        <td>${s?.grade || "-"}</td>
        <td>${s?.name || "-"}</td>
        <td>${r.learningLevel || ""}</td>
        <td>${r.progressBook || ""}</td>
        <td>${r.reviewBook || ""}</td>
        <td>${r.homeworkCalc || ""}</td>
        <td>${r.homeworkBook || ""}</td>
        <td>${r.notes || ""}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>교재 진도표 - ${displayMonth}</title>
<style>
  @page { size: landscape; margin: 15mm; }
  body { font-family: 'Noto Sans KR', sans-serif; font-size: 12px; }
  h2 { text-align: center; margin-bottom: 8px; }
  p.sub { text-align: center; color: #666; margin-bottom: 12px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
  th { background: #f0f0f0; font-weight: 600; white-space: nowrap; }
  td:first-child, td:nth-child(2) { text-align: center; white-space: nowrap; }
</style>
</head><body>
<h2>교재 진도표</h2>
<p class="sub">${selectedCenter?.name || ""} | ${displayMonth}${gradeFilter !== "all" ? ` | ${gradeFilter}` : ""}</p>
<table>
  <thead><tr>
    <th>학년</th><th>이름</th><th>학습레벨</th><th>진도책</th><th>복습책</th><th>숙제연산</th><th>숙제책</th><th>특이사항</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => { w.print(); }, 300);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-10 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 max-w-full overflow-hidden">
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2" data-testid="text-page-title">
              <BookOpen className="h-5 w-5" />
              교재 진도표
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExcelDownload} data-testid="button-excel-download">
                <Download className="h-4 w-4 mr-1" />
                엑셀
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print">
                <Printer className="h-4 w-4 mr-1" />
                출력
              </Button>
              <Button onClick={() => setIsAddOpen(true)} size="sm" data-testid="button-add-student">
                <Plus className="h-4 w-4 mr-1" />
                학생 추가
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-3 mb-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevMonth} data-testid="button-prev-month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-base font-semibold min-w-[100px] text-center" data-testid="text-current-month">
              {displayMonth}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextMonth} data-testid="button-next-month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-[120px]" data-testid="select-grade-filter">
                <SelectValue placeholder="학년" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 학년</SelectItem>
                {uniqueGrades.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="학생 이름 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
                data-testid="input-search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
            <Table className="w-full min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center whitespace-nowrap">학년</TableHead>
                  <TableHead className="text-center whitespace-nowrap">이름</TableHead>
                  <TableHead className="whitespace-nowrap">학습레벨</TableHead>
                  <TableHead className="whitespace-nowrap">진도책</TableHead>
                  <TableHead className="whitespace-nowrap">복습책</TableHead>
                  <TableHead className="whitespace-nowrap">숙제연산</TableHead>
                  <TableHead className="whitespace-nowrap">숙제책</TableHead>
                  <TableHead className="whitespace-nowrap">특이사항</TableHead>
                  <TableHead className="text-center whitespace-nowrap">삭제</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {progressRecords.length === 0
                        ? `${displayMonth}에 등록된 학생이 없습니다. '학생 추가' 버튼으로 학생을 추가해주세요.`
                        : "검색 결과가 없습니다."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => {
                    const student = studentMap[record.studentId];
                    return (
                      <TableRow key={record.id} data-testid={`row-progress-${record.id}`}>
                        <TableCell className="text-center whitespace-nowrap">
                          <Badge variant="outline" className="text-xs">{student?.grade || "-"}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-medium whitespace-nowrap">{student?.name || "-"}</TableCell>
                        <TableCell className="p-1">
                          <EditableCell recordId={record.id} field="learningLevel" value={record.learningLevel || ""} onSave={handleCellSave} />
                        </TableCell>
                        <TableCell className="p-1">
                          <EditableCell recordId={record.id} field="progressBook" value={record.progressBook || ""} onSave={handleCellSave} />
                        </TableCell>
                        <TableCell className="p-1">
                          <EditableCell recordId={record.id} field="reviewBook" value={record.reviewBook || ""} onSave={handleCellSave} />
                        </TableCell>
                        <TableCell className="p-1">
                          <EditableCell recordId={record.id} field="homeworkCalc" value={record.homeworkCalc || ""} onSave={handleCellSave} />
                        </TableCell>
                        <TableCell className="p-1">
                          <EditableCell recordId={record.id} field="homeworkBook" value={record.homeworkBook || ""} onSave={handleCellSave} />
                        </TableCell>
                        <TableCell className="p-1">
                          <EditableCell recordId={record.id} field="notes" value={record.notes || ""} onSave={handleCellSave} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => {
                              if (confirm(`${student?.name}의 진도표 데이터를 삭제하시겠습니까?`)) {
                                deleteMutation.mutate(record.id);
                              }
                            }}
                            data-testid={`button-delete-${record.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              학생 추가 ({displayMonth})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Select value={addGradeFilter} onValueChange={setAddGradeFilter}>
                <SelectTrigger className="w-[120px]" data-testid="select-add-grade-filter">
                  <SelectValue placeholder="학년" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 학년</SelectItem>
                  {uniqueGrades.map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="학생 검색"
                  value={addSearchQuery}
                  onChange={(e) => setAddSearchQuery(e.target.value)}
                  className="pl-8"
                  data-testid="input-add-search"
                />
              </div>
            </div>
            {selectedStudentIds.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {selectedStudentIds.length}명 선택됨
              </div>
            )}
            <ScrollArea className="h-[300px] border rounded-md">
              <div className="p-2 space-y-1">
                {availableStudents.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    추가할 수 있는 학생이 없습니다.
                  </div>
                ) : (
                  availableStudents.map(student => (
                    <label
                      key={student.id}
                      htmlFor={`add-student-${student.id}`}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                      data-testid={`student-option-${student.id}`}
                    >
                      <Checkbox
                        id={`add-student-${student.id}`}
                        checked={selectedStudentIds.includes(student.id)}
                        onCheckedChange={() => toggleStudentSelection(student.id)}
                      />
                      <Badge variant="outline" className="text-xs">{student.grade || "-"}</Badge>
                      <span className="text-sm font-medium">{student.name}</span>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)} data-testid="button-cancel-add">
              취소
            </Button>
            <Button
              onClick={() => addMutation.mutate(selectedStudentIds)}
              disabled={selectedStudentIds.length === 0 || addMutation.isPending}
              data-testid="button-confirm-add"
            >
              {addMutation.isPending ? "추가 중..." : `${selectedStudentIds.length}명 추가`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
