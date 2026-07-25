import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ManualButton } from "@/components/manual-button";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from "date-fns";
import { ko } from "date-fns/locale";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, Flame, AlertCircle, Circle, ChevronLeft, ChevronRight, 
  Check, Trash2, Calendar, ListTodo, Repeat, User as UserIcon, AlertTriangle, CircleDot, Edit2
} from "lucide-react";
import type { TodoWithDetails, User as UserType } from "@shared/schema";

const PRIORITY_CONFIG = {
  urgent: { icon: Flame, label: "긴급", className: "text-red-600", order: 0 },
  high: { icon: AlertTriangle, label: "높음", className: "text-orange-500", order: 1 },
  medium: { icon: AlertCircle, label: "보통", className: "text-yellow-500", order: 2 },
  low: { icon: CircleDot, label: "낮음", className: "text-blue-400", order: 3 },
};

const RECURRENCE_OPTIONS = [
  { value: "none", label: "반복 없음" },
  { value: "weekly", label: "매주 반복" },
  { value: "monthly", label: "매월 반복" },
];

export default function TodosPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [sortBy, setSortBy] = useState<"priority" | "date">("priority");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoWithDetails | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

  const isAdminOrPrincipal = user && (user.role === 4 || user.role === 3);
  const isTeacher = user && (user.role === 2 || user.role === 5); // Teacher or Clinic Teacher
  const canViewOtherTeachers = isAdminOrPrincipal || isTeacher;

  const { data: staff = [] } = useQuery<UserType[]>({
    queryKey: [`/api/teachers?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id && !!canViewOtherTeachers,
  });

  // For admin/principal: view selected teacher's todos (or all if "all" is selected)
  // For teachers: view selected teacher's todos (defaults to own todos if not selected)
  const viewingUserId = canViewOtherTeachers
    ? (selectedTeacherId || (isAdminOrPrincipal ? undefined : user?.id))  // Admin/Principal can view all, Teachers default to own
    : user?.id;
  
  const isViewingAll = isAdminOrPrincipal && !selectedTeacherId;

  const todoQueryUrl = viewingUserId 
    ? `/api/todos?centerId=${selectedCenter?.id}&assigneeId=${viewingUserId}`
    : `/api/todos?centerId=${selectedCenter?.id}`;

  const { data: allTodos = [], isLoading } = useQuery<TodoWithDetails[]>({
    queryKey: [todoQueryUrl],
    enabled: !!selectedCenter?.id && (!!viewingUserId || !!isViewingAll),
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: async ({ todoId, date, assigneeId, todoTitle, isUndo }: { todoId: string; date: string; assigneeId: string; todoTitle?: string; isUndo?: boolean }) => {
      return apiRequest("POST", `/api/todos/${todoId}/toggle-complete`, {
        assigneeId,
        date,
      });
    },
    onSuccess: (_, variables) => {
      invalidateQueriesStartingWith("/api/todos");
      if (!variables.isUndo) {
        toast({
          title: "완료 상태가 변경되었습니다",
          description: variables.todoTitle ? `"${variables.todoTitle}"` : undefined,
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                toggleCompleteMutation.mutate({
                  todoId: variables.todoId,
                  date: variables.date,
                  assigneeId: variables.assigneeId,
                  isUndo: true,
                });
              }}
              data-testid="button-undo-toggle"
            >
              실행 취소
            </Button>
          ),
        });
      } else {
        toast({ title: "취소되었습니다" });
      }
    },
  });

  const deleteTodoMutation = useMutation({
    mutationFn: async (todoId: string) => {
      return apiRequest("DELETE", `/api/todos/${todoId}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      toast({ title: "업무관리가 삭제되었습니다" });
      invalidateQueriesStartingWith("/api/todos");
    },
    onError: (error: any) => {
      toast({ title: "삭제 실패", description: error?.message || "업무관리를 삭제할 수 없습니다", variant: "destructive" });
    },
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const confirmDelete = (todoId: string) => setDeleteConfirmId(todoId);
  const handleConfirmDelete = () => {
    if (deleteConfirmId) {
      deleteTodoMutation.mutate(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const todosForSelectedDate = useMemo(() => {
    const filtered = allTodos.filter((todo: TodoWithDetails) => {
      const startDateStr = todo.startDate || todo.dueDate;
      const dueDateStr = todo.dueDate;
      
      if (todo.recurrence === "none") {
        // Compare as strings directly to avoid timezone issues
        return selectedDate >= startDateStr && selectedDate <= dueDateStr;
      }
      const anchor = todo.recurrenceAnchorDate || todo.dueDate;
      if (selectedDate < anchor) return false;
      if (todo.recurrence === "weekly") {
        const targetDate = new Date(selectedDate + "T00:00:00");
        const anchorDate = new Date(anchor + "T00:00:00");
        const diffDays = Math.floor((targetDate.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays % 7 === 0;
      }
      if (todo.recurrence === "monthly") {
        const targetDay = parseInt(selectedDate.split("-")[2], 10);
        const anchorDay = parseInt(anchor.split("-")[2], 10);
        return targetDay === anchorDay;
      }
      return false;
    });

    return filtered.sort((a, b) => {
      if (sortBy === "priority") {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2) - 
               (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2);
      }
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [allTodos, selectedDate, sortBy]);

  const overdueTodos = useMemo(() => {
    if (selectedDate !== todayStr) return [];
    
    return allTodos.filter((todo: TodoWithDetails) => {
      if (todo.recurrence !== "none") return false;
      // Compare as strings to avoid timezone issues
      if (todo.dueDate >= todayStr) return false;
      
      const isCompleted = todo.assignees?.some((a: any) => {
        if (isViewingAll) return a.completedForDate === todo.dueDate;
        return a.assigneeId === viewingUserId && a.completedForDate === todo.dueDate;
      });
      return !isCompleted;
    }).sort((a: TodoWithDetails, b: TodoWithDetails) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2) - 
             (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2);
    });
  }, [allTodos, selectedDate, todayStr, isViewingAll, viewingUserId]);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getDatesWithTodos = useMemo(() => {
    const dates = new Set<string>();
    allTodos.forEach((todo: TodoWithDetails) => {
      if (todo.recurrence === "none") {
        const startDateStr = todo.startDate || todo.dueDate;
        const dueDateStr = todo.dueDate;
        calendarDays.forEach(day => {
          const dateStr = format(day, "yyyy-MM-dd");
          // Compare as strings to avoid timezone issues
          if (dateStr >= startDateStr && dateStr <= dueDateStr) {
            dates.add(dateStr);
          }
        });
      } else {
        calendarDays.forEach(day => {
          const dateStr = format(day, "yyyy-MM-dd");
          const anchor = todo.recurrenceAnchorDate || todo.dueDate;
          if (dateStr >= anchor) {
            if (todo.recurrence === "weekly") {
              const dayDate = new Date(dateStr + "T00:00:00");
              const anchorDate = new Date(anchor + "T00:00:00");
              const diffDays = Math.floor((dayDate.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
              if (diffDays % 7 === 0) dates.add(dateStr);
            } else if (todo.recurrence === "monthly") {
              const dayNum = parseInt(dateStr.split("-")[2], 10);
              const anchorDay = parseInt(anchor.split("-")[2], 10);
              if (dayNum === anchorDay) dates.add(dateStr);
            }
          }
        });
      }
    });
    return dates;
  }, [allTodos, calendarDays]);

  const isTodoCompleted = (todo: TodoWithDetails, forDate?: string, targetUserId?: string) => {
    if (!todo.assignees) return false;
    const checkDate = forDate || selectedDate;
    const checkUserId = targetUserId || viewingUserId;
    
    // When viewing all, show completed if any assignee completed it for this date
    if (isViewingAll) {
      return todo.assignees.some(a => a.completedForDate === checkDate);
    }
    
    return todo.assignees.some(
      a => a.assigneeId === checkUserId && a.completedForDate === checkDate
    );
  };
  
  // For overdue todos, get the assignee ID to use for completion toggle
  const getOverdueAssigneeId = (todo: TodoWithDetails): string | null => {
    if (!todo.assignees || !user) return null;
    // First check if current user is assigned
    const selfAssigned = todo.assignees.find(a => a.assigneeId === user.id);
    if (selfAssigned) return user.id;
    // For admin viewing a specific teacher, use that teacher's ID
    if (selectedTeacherId) {
      const teacherAssigned = todo.assignees.find(a => a.assigneeId === selectedTeacherId);
      if (teacherAssigned) return selectedTeacherId;
    }
    return null;
  };

  if (!user || user.role < 2) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            선생님 이상만 업무관리를 이용할 수 있습니다.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ListTodo className="h-6 w-6" />
            <h1 className="text-2xl font-bold">업무관리</h1>
          </div>
          <ManualButton menuKey="todos" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canViewOtherTeachers && staff.length > 0 && (
            <Select
              value={selectedTeacherId || (isAdminOrPrincipal ? "all" : user?.id || "")}
              onValueChange={(val) => setSelectedTeacherId(val === "all" ? null : val)}
            >
              <SelectTrigger className="w-[160px]" data-testid="select-teacher">
                <UserIcon className="h-4 w-4 mr-2" />
                <SelectValue placeholder="선생님 선택" />
              </SelectTrigger>
              <SelectContent>
                {isAdminOrPrincipal && <SelectItem value="all">전체 보기</SelectItem>}
                {staff.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-todo">
            <Plus className="h-4 w-4 mr-1" />
            새 할일
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium">
                {format(currentMonth, "yyyy년 M월", { locale: ko })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
              {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay())
                .fill(null)
                .map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
              {calendarDays.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const hasTodos = getDatesWithTodos.has(dateStr);
                const isSelected = selectedDate === dateStr;
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`
                      relative p-2 text-sm rounded-md hover-elevate
                      ${isToday(day) ? "font-bold" : ""}
                      ${isSelected ? "bg-primary text-primary-foreground" : ""}
                      ${!isSameMonth(day, currentMonth) ? "text-muted-foreground" : ""}
                    `}
                    data-testid={`calendar-day-${dateStr}`}
                  >
                    {format(day, "d")}
                    {hasTodos && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {format(new Date(selectedDate), "M월 d일 (EEEE)", { locale: ko })}의 할일
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as "priority" | "date")}>
                  <SelectTrigger className="w-32" data-testid="select-sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="priority">중요도순</SelectItem>
                    <SelectItem value="date">날짜순</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">로딩중...</div>
            ) : (
              <div className="space-y-4">
                {overdueTodos.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      미완료된 지난 할일 ({overdueTodos.length}개)
                    </div>
                    {overdueTodos.map((todo) => {
                      const PriorityIcon = PRIORITY_CONFIG[todo.priority as keyof typeof PRIORITY_CONFIG]?.icon || Circle;
                      const priorityClass = PRIORITY_CONFIG[todo.priority as keyof typeof PRIORITY_CONFIG]?.className || "";
                      const overdueAssigneeId = getOverdueAssigneeId(todo);
                      const isOverdueCompleted = isTodoCompleted(todo, todo.dueDate);
                      return (
                        <div
                          key={`overdue-${todo.id}`}
                          className="flex items-start gap-3 p-3 rounded-md border border-destructive/30 bg-destructive/5"
                          data-testid={`overdue-todo-${todo.id}`}
                        >
                          <Checkbox
                            checked={isOverdueCompleted}
                            onCheckedChange={() => {
                              if (overdueAssigneeId) {
                                toggleCompleteMutation.mutate({ 
                                  todoId: todo.id, 
                                  date: todo.dueDate, 
                                  assigneeId: overdueAssigneeId,
                                  todoTitle: todo.title
                                });
                              }
                            }}
                            className="mt-1"
                            data-testid={`checkbox-overdue-${todo.id}`}
                            disabled={!overdueAssigneeId || !!isViewingAll}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <PriorityIcon className={`h-4 w-4 ${priorityClass}`} />
                              <span className="font-medium">{todo.title}</span>
                              <Badge variant="destructive" className="text-xs">
                                {format(new Date(todo.dueDate), "M/d")} 마감
                              </Badge>
                            </div>
                            {todo.description && (
                              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{todo.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <UserIcon className="h-3 w-3" />
                              <span>
                                {[...new Set(todo.assignees?.map(a => a.user?.name).filter(Boolean))].join(", ") || "-"}
                              </span>
                            </div>
                          </div>
                          {(todo.creatorId === user?.id || isAdminOrPrincipal) && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingTodo(todo)}
                                data-testid={`button-edit-overdue-${todo.id}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => confirmDelete(todo.id)}
                                data-testid={`button-delete-overdue-${todo.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {todosForSelectedDate.length === 0 && overdueTodos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    이 날짜에 등록된 할일이 없습니다.
                  </div>
                ) : todosForSelectedDate.length > 0 && (
                  <div className="space-y-2">
                    {overdueTodos.length > 0 && (
                      <div className="text-sm font-medium text-muted-foreground mb-2">오늘의 할일</div>
                    )}
                    {todosForSelectedDate.map((todo) => {
                      const PriorityIcon = PRIORITY_CONFIG[todo.priority as keyof typeof PRIORITY_CONFIG]?.icon || Circle;
                      const priorityClass = PRIORITY_CONFIG[todo.priority as keyof typeof PRIORITY_CONFIG]?.className || "";
                      const completed = isTodoCompleted(todo);
                      const hasDateRange = todo.startDate && todo.startDate !== todo.dueDate;

                      return (
                        <div
                          key={todo.id}
                          className={`
                            flex items-start gap-3 p-3 rounded-md border
                            ${completed ? "bg-muted/50 opacity-60" : "bg-card"}
                          `}
                          data-testid={`todo-item-${todo.id}`}
                        >
                          <Checkbox
                            checked={completed}
                            onCheckedChange={() => toggleCompleteMutation.mutate({ 
                              todoId: todo.id, 
                              date: selectedDate, 
                              assigneeId: viewingUserId || user?.id || "",
                              todoTitle: todo.title
                            })}
                            className="mt-1"
                            data-testid={`checkbox-todo-${todo.id}`}
                            disabled={!!isViewingAll || !!(isAdminOrPrincipal && selectedTeacherId !== null && selectedTeacherId !== user?.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <PriorityIcon className={`h-4 w-4 ${priorityClass}`} />
                              <span className={`font-medium ${completed ? "line-through" : ""}`}>
                                {todo.title}
                              </span>
                              {hasDateRange && (
                                <Badge variant="secondary" className="text-xs">
                                  {format(new Date(todo.startDate!), "M/d")} ~ {format(new Date(todo.dueDate), "M/d")}
                                </Badge>
                              )}
                              {todo.recurrence !== "none" && (
                                <Badge variant="outline" className="text-xs">
                                  <Repeat className="h-3 w-3 mr-1" />
                                  {todo.recurrence === "weekly" ? "매주" : "매월"}
                                </Badge>
                              )}
                            </div>
                            {todo.description && (
                              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{todo.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <UserIcon className="h-3 w-3" />
                              <span>
                                {[...new Set(todo.assignees?.map(a => a.user?.name).filter(Boolean))].join(", ") || "-"}
                              </span>
                            </div>
                          </div>
                          {(todo.creatorId === user?.id || isAdminOrPrincipal) && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingTodo(todo)}
                                data-testid={`button-edit-todo-${todo.id}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => confirmDelete(todo.id)}
                                data-testid={`button-delete-todo-${todo.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showCreateDialog && (
        <CreateTodoDialog
          onClose={() => setShowCreateDialog(false)}
          initialDate={selectedDate}
          userId={user.id}
          centerId={selectedCenter?.id || ""}
          canAssignOthers={!!canViewOtherTeachers}
          staff={staff}
          defaultAssigneeId={selectedTeacherId}
        />
      )}

      {editingTodo && (
        <EditTodoDialog
          todo={editingTodo}
          onClose={() => setEditingTodo(null)}
          canAssignOthers={!!canViewOtherTeachers}
          staff={staff}
        />
      )}

      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>업무관리 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            이 업무관리를 완전히 삭제합니다. 반복 업무인 경우 앞으로 더 이상 표시되지 않습니다. 삭제하시겠습니까?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} data-testid="button-cancel-delete">
              취소
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleteTodoMutation.isPending} data-testid="button-confirm-delete">
              {deleteTodoMutation.isPending ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CreateTodoDialogProps {
  onClose: () => void;
  initialDate: string;
  userId: string;
  centerId: string;
  canAssignOthers: boolean;
  staff: UserType[];
  defaultAssigneeId?: string | null;
}

function CreateTodoDialog({ onClose, initialDate, userId, centerId, canAssignOthers, staff, defaultAssigneeId }: CreateTodoDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [useDateRange, setUseDateRange] = useState(false);
  const [startDate, setStartDate] = useState(initialDate);
  const [dueDate, setDueDate] = useState(initialDate);
  const [priority, setPriority] = useState("medium");
  const [recurrence, setRecurrence] = useState("none");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(
    defaultAssigneeId ? [defaultAssigneeId] : [userId]
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/todos", {
        creatorId: userId,
        centerId,
        title,
        description: description || null,
        startDate: useDateRange ? startDate : null,
        dueDate,
        priority,
        recurrence,
        assigneeIds: selectedAssignees,
      });
    },
    onSuccess: () => {
      toast({ title: "할일이 등록되었습니다" });
      invalidateQueriesStartingWith("/api/todos");
      onClose();
    },
    onError: () => {
      toast({ title: "할일 등록에 실패했습니다", variant: "destructive" });
    },
  });

  const toggleAssignee = (id: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const allAssignees = useMemo(() => {
    const list = [...staff];
    const currentUser = staff.find(t => t.id === userId);
    if (!currentUser) {
      return [{ id: userId, name: "나" } as UserType, ...staff];
    }
    return list;
  }, [staff, userId]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>새 할일 등록</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="todo-title">제목</Label>
            <Input
              id="todo-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="할일을 입력하세요"
              data-testid="input-todo-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="todo-desc">설명 (선택)</Label>
            <Textarea
              id="todo-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="상세 설명"
              className="min-h-[80px]"
              data-testid="textarea-todo-desc"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="use-date-range"
                checked={useDateRange}
                onCheckedChange={(checked) => setUseDateRange(checked === true)}
                data-testid="checkbox-date-range"
              />
              <Label htmlFor="use-date-range" className="text-sm cursor-pointer">
                기간 설정 (시작일 ~ 마감일)
              </Label>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {useDateRange ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="todo-start-date">시작일</Label>
                    <Input
                      id="todo-start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      data-testid="input-todo-start-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="todo-due-date">마감일</Label>
                    <Input
                      id="todo-due-date"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      data-testid="input-todo-due-date"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="todo-date">날짜</Label>
                  <Input
                    id="todo-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => {
                      setDueDate(e.target.value);
                      setStartDate(e.target.value);
                    }}
                    data-testid="input-todo-date"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>중요도</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="select-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_CONFIG).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        <config.icon className={`h-4 w-4 ${config.className}`} />
                        {config.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>반복</Label>
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger data-testid="select-recurrence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canAssignOthers && allAssignees.length > 0 && (
            <div className="space-y-2">
              <Label>해야할 선생님</Label>
              <div className="flex flex-wrap gap-2 p-2 border rounded-md max-h-32 overflow-y-auto">
                {allAssignees.map((t) => (
                  <Badge
                    key={t.id}
                    variant={selectedAssignees.includes(t.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleAssignee(t.id)}
                    data-testid={`assignee-${t.id}`}
                  >
                    {selectedAssignees.includes(t.id) && <Check className="h-3 w-3 mr-1" />}
                    {t.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-todo">
            취소
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!title.trim() || createMutation.isPending}
            data-testid="button-save-todo"
          >
            {createMutation.isPending ? "저장중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditTodoDialogProps {
  todo: TodoWithDetails;
  onClose: () => void;
  canAssignOthers: boolean;
  staff: UserType[];
}

function EditTodoDialog({ todo, onClose, canAssignOthers, staff }: EditTodoDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description || "");
  const [useDateRange, setUseDateRange] = useState(!!todo.startDate);
  const [startDate, setStartDate] = useState(todo.startDate || todo.dueDate);
  const [dueDate, setDueDate] = useState(todo.dueDate);
  const [priority, setPriority] = useState(todo.priority);
  const [recurrence, setRecurrence] = useState(todo.recurrence);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(
    Array.from(new Set(todo.assignees?.map(a => a.assigneeId) || []))
  );

  const { user } = useAuth();

  const updateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/todos/${todo.id}`, {
        actorId: user?.id,
        title,
        description: description || null,
        startDate: useDateRange ? startDate : null,
        dueDate,
        priority,
        recurrence,
        assigneeIds: Array.from(new Set(selectedAssignees)),
      });
    },
    onSuccess: () => {
      toast({ title: "할일이 수정되었습니다" });
      invalidateQueriesStartingWith("/api/todos");
      onClose();
    },
    onError: () => {
      toast({ title: "할일 수정에 실패했습니다", variant: "destructive" });
    },
  });

  const toggleAssignee = (id: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const allAssignees = useMemo(() => {
    const list = [...staff];
    const creatorInList = staff.find(t => t.id === todo.creatorId);
    if (!creatorInList) {
      return [{ id: todo.creatorId, name: "작성자" } as UserType, ...staff];
    }
    return list;
  }, [staff, todo.creatorId]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>할일 수정</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-todo-title">제목</Label>
            <Input
              id="edit-todo-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="할일을 입력하세요"
              data-testid="input-edit-todo-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-todo-desc">설명 (선택)</Label>
            <Textarea
              id="edit-todo-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="상세 설명"
              className="min-h-[80px]"
              data-testid="textarea-edit-todo-desc"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-use-date-range"
                checked={useDateRange}
                onCheckedChange={(checked) => setUseDateRange(checked === true)}
                data-testid="edit-checkbox-date-range"
              />
              <Label htmlFor="edit-use-date-range" className="text-sm cursor-pointer">
                기간 설정 (시작일 ~ 마감일)
              </Label>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {useDateRange ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="edit-todo-start-date">시작일</Label>
                    <Input
                      id="edit-todo-start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      data-testid="input-edit-todo-start-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-todo-due-date">마감일</Label>
                    <Input
                      id="edit-todo-due-date"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      data-testid="input-edit-todo-due-date"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit-todo-date">날짜</Label>
                  <Input
                    id="edit-todo-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => {
                      setDueDate(e.target.value);
                      setStartDate(e.target.value);
                    }}
                    data-testid="input-edit-todo-date"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>중요도</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="select-edit-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_CONFIG).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        <config.icon className={`h-4 w-4 ${config.className}`} />
                        {config.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>반복</Label>
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger data-testid="select-edit-recurrence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canAssignOthers && allAssignees.length > 0 && (
            <div className="space-y-2">
              <Label>해야할 선생님</Label>
              <div className="flex flex-wrap gap-2 p-2 border rounded-md max-h-32 overflow-y-auto">
                {allAssignees.map((t) => (
                  <Badge
                    key={t.id}
                    variant={selectedAssignees.includes(t.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleAssignee(t.id)}
                    data-testid={`edit-assignee-${t.id}`}
                  >
                    {selectedAssignees.includes(t.id) && <Check className="h-3 w-3 mr-1" />}
                    {t.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-edit-todo">
            취소
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={!title.trim() || updateMutation.isPending}
            data-testid="button-save-edit-todo"
          >
            {updateMutation.isPending ? "저장중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
