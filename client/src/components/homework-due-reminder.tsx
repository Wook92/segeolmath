import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@shared/schema";
import { useLocation } from "wouter";

interface HomeworkReminder {
  id: string;
  title: string;
  dueDate: string;
}

export function HomeworkDueReminder() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const isStudent = user?.role === UserRole.STUDENT;

  const { data: dueTodayHomework = [] } = useQuery<HomeworkReminder[]>({
    queryKey: ["/api/notifications/homework-reminders", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/notifications/homework-reminders?studentId=${user.id}`);
      return res.json();
    },
    enabled: isStudent && !!user?.id,
    refetchInterval: 60000,
  });

  if (!isStudent) return null;

  if (dueTodayHomework.length === 0) return null;

  return (
    <div className="mb-4 flex items-center gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/20" data-testid="homework-due-reminder">
      <div className="flex items-center gap-2 text-sm text-destructive font-medium">
        <AlertCircle className="h-4 w-4" />
        <span>오늘 마감숙제 있음</span>
      </div>
      <Button 
        size="sm" 
        variant="destructive"
        onClick={() => navigate("/homework")}
        data-testid="button-submit-homework"
      >
        제출하기
      </Button>
    </div>
  );
}
