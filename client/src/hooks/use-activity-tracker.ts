import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";

const SESSION_KEY = "activity_session_id";
const MIN_LOG_INTERVAL_MS = 3000;

function getOrCreateSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

export function useActivityTracker() {
  const [location] = useLocation();
  const { user, selectedCenter } = useAuth();
  const lastVisitTime = useRef<number>(Date.now());
  const lastLoggedPath = useRef<string>("");
  const lastLogTime = useRef<number>(0);

  const logActivity = useCallback(async (pagePath: string, durationSeconds?: number) => {
    if (!user || !selectedCenter) return;
    
    try {
      await fetch("/api/activity-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          centerId: selectedCenter.id,
          pagePath,
          sessionId: getOrCreateSessionId(),
          durationSeconds
        })
      });
    } catch (error) {
      console.error("Failed to log activity:", error);
    }
  }, [user, selectedCenter]);

  useEffect(() => {
    if (!user || !selectedCenter) return;
    
    const now = Date.now();
    
    if (lastLoggedPath.current === location) {
      return;
    }
    
    if (now - lastLogTime.current < MIN_LOG_INTERVAL_MS && lastLoggedPath.current) {
      return;
    }

    const duration = Math.round((now - lastVisitTime.current) / 1000);
    
    if (lastLoggedPath.current && duration > 0 && duration < 3600) {
      logActivity(lastLoggedPath.current, duration);
    }
    
    logActivity(location);
    lastVisitTime.current = now;
    lastLoggedPath.current = location;
    lastLogTime.current = now;
  }, [location, user, selectedCenter, logActivity]);

  useEffect(() => {
    if (!user || !selectedCenter) return;

    const handleBeforeUnload = () => {
      const endDuration = Math.round((Date.now() - lastVisitTime.current) / 1000);
      if (endDuration > 0 && endDuration < 3600) {
        navigator.sendBeacon("/api/activity-logs", JSON.stringify({
          userId: user.id,
          centerId: selectedCenter.id,
          pagePath: location,
          sessionId: getOrCreateSessionId(),
          durationSeconds: endDuration
        }));
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [location, user, selectedCenter]);
}
