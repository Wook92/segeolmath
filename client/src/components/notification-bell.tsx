import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, BellRing, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import type { Notification } from "@shared/schema";
import {
  isPushSupported,
  isCurrentlySubscribed,
  subscribePush,
  type SubscribeResult,
} from "@/lib/push-notifications";

export function NotificationBell() {
  const { user } = useAuth();
  const [showPushBanner, setShowPushBanner] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    const checkPush = async () => {
      if (!user?.role) return;
      if (!isPushSupported()) return;
      if (Notification.permission === "denied") return;
      const subscribed = await isCurrentlySubscribed();
      if (!subscribed) {
        setShowPushBanner(true);
      }
    };
    if (user) checkPush();
  }, [user]);

  const { data: unreadCount = { count: 0 } } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return { count: 0 };
      const res = await fetch(`/api/notifications/unread-count?userId=${user.id}`);
      return res.json();
    },
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/notifications?userId=${user.id}`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/mark-all-read", { userId: user?.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const handleEnablePush = async () => {
    if (!user) return;
    setPushLoading(true);
    try {
      const result = await subscribePush(user.id, (user as any).currentCenterId);
      if (result.success) {
        setShowPushBanner(false);
      } else {
        alert(result.reason);
      }
    } catch (e: any) {
      alert(e?.message || "알림 설정 중 오류가 발생했습니다.");
    }
    setPushLoading(false);
  };

  const count = unreadCount?.count ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="button-notification-bell">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center text-xs px-1"
            >
              {count > 99 ? "99+" : count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        {showPushBanner && (
          <div className="p-3 bg-primary/10 border-b text-sm">
            <div className="flex items-center gap-2 mb-1">
              <BellRing className="h-4 w-4 text-primary" />
              <span className="font-medium">푸시 알림을 켜시겠어요?</span>
            </div>
            <p className="text-muted-foreground text-xs mb-2">
              앱을 열지 않아도 새 알림을 받을 수 있습니다.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={handleEnablePush}
                disabled={pushLoading}
                className="h-7 text-xs"
                data-testid="button-enable-push"
              >
                {pushLoading ? "설정 중..." : "알림 허용"}
              </Button>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold">알림</h4>
          {count > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <Check className="h-4 w-4 mr-1" />
              모두 읽음
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>알림이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.slice(0, 20).map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 hover-elevate ${!notification.isRead ? "bg-primary/5" : ""}`}
                  data-testid={`notification-item-${notification.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{notification.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notification.createdAt && formatDistanceToNow(new Date(notification.createdAt), { 
                          addSuffix: true,
                          locale: ko 
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => markAsReadMutation.mutate(notification.id)}
                          disabled={markAsReadMutation.isPending}
                          data-testid={`button-mark-read-${notification.id}`}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => deleteMutation.mutate(notification.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-notification-${notification.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
