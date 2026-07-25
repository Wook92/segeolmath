import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ManualButton } from "@/components/manual-button";
import { useAuth } from "@/lib/auth-context";
import { queryClient, apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Coffee, Clock, User, RefreshCw, LogOut, AlertCircle, Settings, Trash2, Calendar, Search, Key, Pencil } from "lucide-react";
import type { Center, StudyCafeSeatWithStatus, StudyCafeReservation, User as UserType, StudyCafeFixedSeat, StudyCafeSettings } from "@shared/schema";
import { UserRole } from "@shared/schema";

interface FixedSeatWithDetails extends StudyCafeFixedSeat {
  student?: UserType;
  seat?: { seatNumber: number };
}

export default function StudyCafePage() {
  const { user, selectedCenter: globalSelectedCenter } = useAuth();
  const { toast } = useToast();
  const [selectedSeat, setSelectedSeat] = useState<StudyCafeSeatWithStatus | null>(null);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [releaseDialog, setReleaseDialog] = useState(false);
  const [fixedSeatDialog, setFixedSeatDialog] = useState(false);
  const [fixedSeatStudent, setFixedSeatStudent] = useState<string>("");
  const [fixedSeatStartDate, setFixedSeatStartDate] = useState<string>("");
  const [fixedSeatEndDate, setFixedSeatEndDate] = useState<string>("");
  const [editFixedSeatDialog, setEditFixedSeatDialog] = useState(false);
  const [editingFixedSeat, setEditingFixedSeat] = useState<FixedSeatWithDetails | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [staffReleaseDialog, setStaffReleaseDialog] = useState(false);
  const [seatToRelease, setSeatToRelease] = useState<StudyCafeSeatWithStatus | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const isStaff = !!user && user.role >= UserRole.TEACHER;
  const isStudent = !!user && user.role === UserRole.STUDENT;
  const canEditPassword = !!user && (user.role === UserRole.ADMIN || user.role === UserRole.PRINCIPAL);

  const { data: enabledCenters = [] } = useQuery<Center[]>({
    queryKey: ["/api/study-cafe/enabled-centers"],
  });

  const selectedCenter = globalSelectedCenter?.id || "";
  
  const isCenterEnabled = enabledCenters.some(ec => ec.id === selectedCenter);

  // Set default dates when dialog opens
  useEffect(() => {
    if (fixedSeatDialog && !fixedSeatStartDate) {
      const today = new Date().toISOString().split('T')[0];
      setFixedSeatStartDate(today);
      // Default end date: 1 month from today
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);
      setFixedSeatEndDate(endDate.toISOString().split('T')[0]);
    }
  }, [fixedSeatDialog, fixedSeatStartDate]);

  const { data: seats = [], isLoading, refetch } = useQuery<StudyCafeSeatWithStatus[]>({
    queryKey: ["/api/study-cafe/seats", selectedCenter],
    enabled: !!selectedCenter && isCenterEnabled,
    refetchInterval: 30000,
  });

  const { data: myReservation } = useQuery<StudyCafeReservation | null>({
    queryKey: ["/api/study-cafe/my-reservation", user?.id, selectedCenter],
    enabled: !!user?.id && !!selectedCenter && isCenterEnabled && isStudent,
    refetchInterval: 30000,
  });

  const { data: students = [] } = useQuery<UserType[]>({
    queryKey: ["/api/centers", selectedCenter, "students"],
    enabled: !!selectedCenter && isCenterEnabled && isStaff,
  });

  const { data: fixedSeats = [] } = useQuery<FixedSeatWithDetails[]>({
    queryKey: ["/api/study-cafe/fixed-seats", selectedCenter],
    enabled: !!selectedCenter && isCenterEnabled && isStaff,
  });

  const { data: cafeSettings } = useQuery<StudyCafeSettings>({
    queryKey: ["/api/study-cafe/settings", selectedCenter],
    enabled: !!selectedCenter && isCenterEnabled,
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      if (!cafeSettings) {
        throw new Error("설정을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      }
      return apiRequest("POST", "/api/study-cafe/settings", {
        centerId: selectedCenter,
        isEnabled: cafeSettings.isEnabled,
        notice: cafeSettings.notice,
        entryPassword: password,
        actorId: user?.id,
      });
    },
    onSuccess: () => {
      toast({ title: "비밀번호 변경 완료", description: "출입 비밀번호가 변경되었습니다." });
      invalidateQueriesStartingWith("/api/study-cafe");
      setPasswordDialogOpen(false);
      setNewPassword("");
    },
    onError: (error: any) => {
      toast({ title: "변경 실패", description: error.message || "비밀번호 변경에 실패했습니다.", variant: "destructive" });
    },
  });

  const reserveMutation = useMutation({
    mutationFn: async (seatId: string) => {
      return apiRequest("POST", "/api/study-cafe/reserve", {
        seatId,
        studentId: user?.id,
        centerId: selectedCenter,
        actorId: user?.id,
      });
    },
    onSuccess: () => {
      toast({ title: "좌석 예약 완료", description: "2시간 동안 좌석을 이용할 수 있습니다." });
      invalidateQueriesStartingWith("/api/study-cafe");
      setConfirmDialog(false);
      setSelectedSeat(null);
    },
    onError: (error: any) => {
      toast({ title: "예약 실패", description: error.message || "좌석 예약에 실패했습니다.", variant: "destructive" });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async (reservationId: string) => {
      return apiRequest("POST", "/api/study-cafe/release", { reservationId, actorId: user?.id });
    },
    onSuccess: () => {
      toast({ title: "좌석 반납 완료", description: "좌석이 반납되었습니다." });
      invalidateQueriesStartingWith("/api/study-cafe");
      setReleaseDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "반납 실패", description: error.message || "좌석 반납에 실패했습니다.", variant: "destructive" });
    },
  });

  const createFixedSeatMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSeat || !fixedSeatStudent) return;
      return apiRequest("POST", "/api/study-cafe/fixed-seats", {
        seatId: selectedSeat.id,
        studentId: fixedSeatStudent,
        centerId: selectedCenter,
        startDate: fixedSeatStartDate,
        endDate: fixedSeatEndDate,
        actorId: user?.id,
      });
    },
    onSuccess: () => {
      toast({ title: "고정석 지정 완료", description: "고정석이 지정되었습니다." });
      invalidateQueriesStartingWith("/api/study-cafe");
      setFixedSeatDialog(false);
      setSelectedSeat(null);
      setFixedSeatStudent("");
      setFixedSeatStartDate("");
      setFixedSeatEndDate("");
    },
    onError: (error: any) => {
      toast({ title: "고정석 지정 실패", description: error.message || "고정석 지정에 실패했습니다.", variant: "destructive" });
    },
  });

  const deleteFixedSeatMutation = useMutation({
    mutationFn: async (fixedSeatId: string) => {
      return apiRequest("DELETE", `/api/study-cafe/fixed-seats/${fixedSeatId}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      toast({ title: "고정석 해제", description: "고정석이 해제되었습니다." });
      invalidateQueriesStartingWith("/api/study-cafe");
      setEditFixedSeatDialog(false);
      setEditingFixedSeat(null);
    },
    onError: (error: any) => {
      toast({ title: "해제 실패", description: error.message || "고정석 해제에 실패했습니다.", variant: "destructive" });
    },
  });

  const updateFixedSeatMutation = useMutation({
    mutationFn: async ({ fixedSeatId, startDate, endDate }: { fixedSeatId: string; startDate: string; endDate: string }) => {
      return apiRequest("PATCH", `/api/study-cafe/fixed-seats/${fixedSeatId}`, {
        startDate,
        endDate,
        actorId: user?.id,
      });
    },
    onSuccess: () => {
      toast({ title: "고정석 수정 완료", description: "고정석 기간이 수정되었습니다." });
      invalidateQueriesStartingWith("/api/study-cafe");
      setEditFixedSeatDialog(false);
      setEditingFixedSeat(null);
    },
    onError: (error: any) => {
      toast({ title: "수정 실패", description: error.message || "고정석 수정에 실패했습니다.", variant: "destructive" });
    },
  });

  const handleSeatClick = (seat: StudyCafeSeatWithStatus) => {
    if (isStudent) {
      if (myReservation) {
        toast({ title: "이미 예약 중", description: "이미 예약 중인 좌석이 있습니다.", variant: "destructive" });
        return;
      }
      if (!seat.isAvailable) {
        return;
      }
      setSelectedSeat(seat);
      setConfirmDialog(true);
    } else if (isStaff) {
      // If it's a fixed seat, open edit dialog
      if (seat.isFixed) {
        const fixedSeat = fixedSeats.find(fs => fs.seatId === seat.id);
        if (fixedSeat) {
          setEditingFixedSeat(fixedSeat);
          setFixedSeatStartDate(fixedSeat.startDate);
          setFixedSeatEndDate(fixedSeat.endDate);
          setEditFixedSeatDialog(true);
        }
        return;
      }
      // Staff can release student reservations
      if (!seat.isAvailable && seat.reservation) {
        setSeatToRelease(seat);
        setStaffReleaseDialog(true);
        return;
      }
      // Staff can assign fixed seats to available seats
      setSelectedSeat(seat);
      setStudentSearchQuery("");
      setFixedSeatDialog(true);
    }
  };

  // Filter students based on search query
  const filteredStudents = studentSearchQuery.trim()
    ? students.filter(s => 
        s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
        (s.phone && s.phone.includes(studentSearchQuery))
      )
    : students;

  const formatRemainingTime = (minutes: number | undefined) => {
    if (minutes === undefined) return "";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}시간 ${mins}분`;
    }
    return `${mins}분`;
  };

  const mySeat = seats.find(s => s.reservation?.studentId === user?.id);

  if (!selectedCenter || !isCenterEnabled) {
    return (
      <div className="p-4 md:p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">스터디카페 이용 불가</h2>
        <p className="text-muted-foreground text-center">
          {globalSelectedCenter?.name || "현재 센터"}에서 스터디카페가 활성화되지 않았습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Coffee className="w-6 h-6" />
              스터디카페
            </h1>
            <p className="text-muted-foreground">
              {isStudent ? "좌석을 선택하여 이용하세요 (2시간)" : "좌석을 선택하여 고정석을 지정하세요"}
            </p>
          </div>
          <ManualButton menuKey="study-cafe" />
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline">{globalSelectedCenter?.name}</Badge>
          <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Key className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm text-muted-foreground">출입 비밀번호</p>
                {cafeSettings?.entryPassword ? (
                  <p className="font-mono text-lg font-bold" data-testid="text-entry-password">
                    {cafeSettings.entryPassword}
                  </p>
                ) : (
                  <p className="text-muted-foreground" data-testid="text-no-password">설정되지 않음</p>
                )}
              </div>
            </div>
            {canEditPassword && cafeSettings && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewPassword(cafeSettings.entryPassword || "");
                  setPasswordDialogOpen(true);
                }}
                data-testid="button-edit-password"
              >
                <Pencil className="w-4 h-4 mr-1" />
                비밀번호 변경
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isStudent && mySeat && myReservation && (
        <Card className="border-primary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                  {mySeat.seatNumber}
                </div>
                <div>
                  <p className="font-semibold">내 좌석</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    잔여 시간: {formatRemainingTime(mySeat.remainingMinutes)}
                  </p>
                </div>
              </div>
              <Button 
                variant="destructive" 
                onClick={() => setReleaseDialog(true)}
                data-testid="button-release"
              >
                <LogOut className="w-4 h-4 mr-1" />
                반납
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isStaff ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between flex-wrap gap-2">
              <span>좌석 배치도</span>
              <div className="flex items-center gap-4 text-sm font-normal">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-green-500" />
                  <span>이용가능</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-red-500" />
                  <span>사용중</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-blue-500" />
                  <span>고정석</span>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <SeatMap 
                  seats={seats} 
                  onSeatClick={handleSeatClick} 
                  myReservation={null}
                  userId={user?.id}
                  isStaff={true}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between flex-wrap gap-2">
              <span>좌석 배치도</span>
              <div className="flex items-center gap-4 text-sm font-normal">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-green-500" />
                  <span>이용가능</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-red-500" />
                  <span>사용중</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-blue-500" />
                  <span>고정석</span>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <SeatMap 
                  seats={seats} 
                  onSeatClick={handleSeatClick} 
                  myReservation={myReservation}
                  userId={user?.id}
                  isStaff={false}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Student reservation dialog */}
      <Dialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>좌석 예약</DialogTitle>
            <DialogDescription>
              {selectedSeat?.seatNumber}번 좌석을 예약하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              예약 시간: 2시간
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              시간이 만료되면 자동으로 좌석이 반납됩니다.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(false)}>
              취소
            </Button>
            <Button 
              onClick={() => selectedSeat && reserveMutation.mutate(selectedSeat.id)}
              disabled={reserveMutation.isPending}
              data-testid="button-confirm-reserve"
            >
              예약하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student release dialog */}
      <Dialog open={releaseDialog} onOpenChange={setReleaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>좌석 반납</DialogTitle>
            <DialogDescription>
              좌석을 반납하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseDialog(false)}>
              취소
            </Button>
            <Button 
              variant="destructive"
              onClick={() => myReservation && releaseMutation.mutate(myReservation.id)}
              disabled={releaseMutation.isPending}
              data-testid="button-confirm-release"
            >
              반납하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff fixed seat dialog */}
      <Dialog open={fixedSeatDialog} onOpenChange={(open) => {
        setFixedSeatDialog(open);
        if (!open) {
          setStudentSearchQuery("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>고정석 지정</DialogTitle>
            <DialogDescription>
              {selectedSeat?.seatNumber}번 좌석을 고정석으로 지정합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="student">학생 선택</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="이름 또는 전화번호로 검색"
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-student-search"
                />
              </div>
              {fixedSeatStudent && (
                <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-md">
                  <User className="w-4 h-4" />
                  <span className="font-medium">
                    {students.find(s => s.id === fixedSeatStudent)?.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-6 w-6"
                    onClick={() => setFixedSeatStudent("")}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
              <div className="max-h-40 overflow-y-auto border rounded-md">
                {filteredStudents.length === 0 ? (
                  <div className="py-4 px-3 text-sm text-muted-foreground text-center">
                    {studentSearchQuery ? "검색 결과가 없습니다" : "학생 이름을 검색하세요"}
                  </div>
                ) : (
                  filteredStudents.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setFixedSeatStudent(s.id)}
                      className={`w-full text-left px-3 py-2 hover-elevate ${
                        fixedSeatStudent === s.id ? "bg-primary/10" : ""
                      }`}
                      data-testid={`student-option-${s.id}`}
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground ml-2 text-sm">({s.phone})</span>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">시작일</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={fixedSeatStartDate}
                  onChange={(e) => setFixedSeatStartDate(e.target.value)}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">종료일</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={fixedSeatEndDate}
                  onChange={(e) => setFixedSeatEndDate(e.target.value)}
                  data-testid="input-end-date"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setFixedSeatDialog(false);
              setSelectedSeat(null);
              setFixedSeatStudent("");
              setFixedSeatStartDate("");
              setFixedSeatEndDate("");
            }}>
              취소
            </Button>
            <Button 
              onClick={() => createFixedSeatMutation.mutate()}
              disabled={createFixedSeatMutation.isPending || !fixedSeatStudent || !fixedSeatStartDate || !fixedSeatEndDate}
              data-testid="button-confirm-fixed-seat"
            >
              지정하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff edit fixed seat dialog */}
      <Dialog open={editFixedSeatDialog} onOpenChange={(open) => {
        setEditFixedSeatDialog(open);
        if (!open) {
          setEditingFixedSeat(null);
          setFixedSeatStartDate("");
          setFixedSeatEndDate("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>고정석 수정</DialogTitle>
            <DialogDescription>
              {editingFixedSeat?.seat?.seatNumber}번 좌석 - {editingFixedSeat?.student?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editStartDate">시작일</Label>
                <Input
                  id="editStartDate"
                  type="date"
                  value={fixedSeatStartDate}
                  onChange={(e) => setFixedSeatStartDate(e.target.value)}
                  data-testid="input-edit-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editEndDate">종료일</Label>
                <Input
                  id="editEndDate"
                  type="date"
                  value={fixedSeatEndDate}
                  onChange={(e) => setFixedSeatEndDate(e.target.value)}
                  data-testid="input-edit-end-date"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button 
              variant="destructive"
              onClick={() => editingFixedSeat && deleteFixedSeatMutation.mutate(editingFixedSeat.id)}
              disabled={deleteFixedSeatMutation.isPending}
              data-testid="button-delete-fixed-seat"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              삭제
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setEditFixedSeatDialog(false);
                setEditingFixedSeat(null);
                setFixedSeatStartDate("");
                setFixedSeatEndDate("");
              }}>
                취소
              </Button>
              <Button 
                onClick={() => editingFixedSeat && updateFixedSeatMutation.mutate({
                  fixedSeatId: editingFixedSeat.id,
                  startDate: fixedSeatStartDate,
                  endDate: fixedSeatEndDate,
                })}
                disabled={updateFixedSeatMutation.isPending || !fixedSeatStartDate || !fixedSeatEndDate}
                data-testid="button-update-fixed-seat"
              >
                수정
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff release student reservation dialog */}
      <Dialog open={staffReleaseDialog} onOpenChange={setStaffReleaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>학생 좌석 반납</DialogTitle>
            <DialogDescription>
              {seatToRelease?.seatNumber}번 좌석을 반납하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">
              <span className="font-medium">이용 중인 학생:</span>{" "}
              {seatToRelease?.reservation?.student?.name || "알 수 없음"}
            </p>
            {seatToRelease?.remainingMinutes !== undefined && (
              <p className="text-sm text-muted-foreground mt-1">
                잔여 시간: {formatRemainingTime(seatToRelease.remainingMinutes)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setStaffReleaseDialog(false);
              setSeatToRelease(null);
            }}>
              취소
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (seatToRelease?.reservation?.id) {
                  releaseMutation.mutate(seatToRelease.reservation.id);
                  setStaffReleaseDialog(false);
                  setSeatToRelease(null);
                }
              }}
              disabled={releaseMutation.isPending}
              data-testid="button-staff-release"
            >
              <LogOut className="w-4 h-4 mr-1" />
              반납하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>출입 비밀번호 변경</DialogTitle>
            <DialogDescription>
              스터디카페 출입 비밀번호를 변경합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">새 비밀번호</Label>
              <Input
                id="newPassword"
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="출입 비밀번호 입력"
                data-testid="input-new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPasswordDialogOpen(false);
              setNewPassword("");
            }}>
              취소
            </Button>
            <Button 
              onClick={() => updatePasswordMutation.mutate(newPassword)}
              disabled={updatePasswordMutation.isPending || !cafeSettings}
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

function SeatMap({ 
  seats, 
  onSeatClick, 
  myReservation,
  userId,
  isStaff = false,
}: { 
  seats: StudyCafeSeatWithStatus[]; 
  onSeatClick: (seat: StudyCafeSeatWithStatus) => void;
  myReservation: StudyCafeReservation | null | undefined;
  userId: string | undefined;
  isStaff?: boolean;
}) {
  const col0 = seats.filter(s => s.col === 0).sort((a, b) => a.row - b.row);
  const col1 = seats.filter(s => s.col === 1).sort((a, b) => a.row - b.row);
  const col2 = seats.filter(s => s.col === 2).sort((a, b) => a.row - b.row);
  const col3 = seats.filter(s => s.col === 3).sort((a, b) => a.row - b.row);
  const col4 = seats.filter(s => s.col === 4).sort((a, b) => a.row - b.row);

  const renderSeat = (seat: StudyCafeSeatWithStatus) => {
    const isMine = seat.reservation?.studentId === userId;
    const isAvailable = seat.isAvailable;
    const isFixed = seat.isFixed;
    
    let bgColor = "bg-green-500 dark:bg-green-600";
    if (isMine && !isStaff) {
      bgColor = "bg-primary";
    } else if (isFixed) {
      bgColor = "bg-blue-500 dark:bg-blue-600";
    } else if (!isAvailable) {
      bgColor = "bg-red-500 dark:bg-red-600";
    }

    const formatTime = (minutes: number | undefined) => {
      if (minutes === undefined) return "";
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return h > 0 ? `${h}h${m}m` : `${m}m`;
    };

    // For staff, they can click any seat (fixed: edit, available: assign, occupied: release)
    // For students, they can only click available seats if they don't have a reservation
    const canClick = isStaff 
      ? true
      : (isAvailable && !myReservation);

    return (
      <button
        key={seat.id}
        onClick={() => onSeatClick(seat)}
        disabled={!canClick}
        className={`
          w-16 h-20 md:w-20 md:h-24 rounded-md flex flex-col items-center justify-center
          ${bgColor} text-white font-medium
          transition-all
          ${canClick ? "cursor-pointer hover:scale-105 hover:shadow-lg" : "cursor-default opacity-80"}
        `}
        data-testid={`seat-${seat.seatNumber}`}
      >
        <span className="text-lg md:text-xl font-bold">{seat.seatNumber}</span>
        {!isAvailable && seat.remainingMinutes !== undefined && (
          <span className="text-xs opacity-80 flex items-center gap-0.5">
            <Clock className="w-3 h-3" />
            {formatTime(seat.remainingMinutes)}
          </span>
        )}
        {!isAvailable && seat.reservation?.student && (
          <span className="text-xs opacity-80 truncate max-w-full px-1">
            {seat.reservation.student.name}
          </span>
        )}
        {isFixed && seat.fixedSeat?.student && (
          <span className="text-xs opacity-80 truncate max-w-full px-1">
            {seat.fixedSeat.student.name}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="flex gap-4 md:gap-8 justify-center py-4 min-w-fit">
      <div className="flex flex-col gap-2">
        {col0.map(renderSeat)}
      </div>

      <div className="flex flex-col gap-2">
        {col1.map(renderSeat)}
      </div>

      <div className="w-4 md:w-8" />

      <div className="flex flex-col gap-2">
        {col2.map(renderSeat)}
      </div>

      <div className="flex flex-col gap-2">
        {col3.map(renderSeat)}
      </div>

      <div className="w-4 md:w-8" />

      <div className="flex flex-col gap-2">
        {col4.map(renderSeat)}
      </div>
    </div>
  );
}
