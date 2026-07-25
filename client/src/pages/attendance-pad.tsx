import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Center, type User, type Class, UserRole } from "@shared/schema";
import { Delete, Check, X, ArrowLeft, Settings, BookOpen, Maximize, Minimize, LogOut, ClipboardList } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
const defaultLogoUrl = "/default-login-logo.png";
import { useAuth } from "@/lib/auth-context";

function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let wakeLockSupported = false;

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
          wakeLockSupported = true;
          console.log("[WakeLock] Screen wake lock acquired");
        }
      } catch (err) {
        console.log("[WakeLock] Native wake lock failed, using video fallback:", err);
        wakeLockSupported = false;
      }
    };

    // Video-based fallback for devices that don't support Wake Lock API
    const startVideoFallback = () => {
      if (wakeLockSupported) return;
      
      if (!videoRef.current) {
        // Create a tiny, silent, looping video to keep screen awake
        const video = document.createElement("video");
        video.setAttribute("playsinline", "");
        video.setAttribute("muted", "");
        video.setAttribute("loop", "");
        video.style.position = "fixed";
        video.style.top = "-1px";
        video.style.left = "-1px";
        video.style.width = "1px";
        video.style.height = "1px";
        video.style.opacity = "0.01";
        video.style.pointerEvents = "none";
        
        // Use a data URL for a tiny transparent video
        video.src = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAA" +
          "hBtZGF0AAACrwYF//+r3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NCByMzEgOWE1ZmY0YyAtIEguMjY0L" +
          "01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjQgLSBodHRwczovL3d3dy52aWRlb2xhbi5vcmcvZ" +
          "GV2ZWxvcGVycy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0xIHJlZj0zIGRlYmxvY2s9MTowOjAgYW5hbHlzZ" +
          "T0weDM6MHgxMTMgbWU9aGV4IHN1Ym1lPTcgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MSBtZT1o" +
          "ZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xAAACiW1vb3YAAABsbXZoZAAAAAD" +
          "c7WIU3O1iFAAAA+gAAAAKAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAA" +
          "AAAAAAAAAAAAAAAAAAAAAAAIAAAB0dHJhawAAAFx0a2hkAAAAA9ztYhTc7WIUAAAAAQAAAAAAAAAKAAAAAAAAAA" +
          "AAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4AAACYbWRpYQA" +
          "AACBtZGhkAAAAANztYhTc7WIUAAAAGAAAABgVxwAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAAFWaWR" +
          "lb0hhbmRsZXIAAAABQ21pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx" +
          "1cmwgAAAAAQAAAQNzdGJsAAAAl3N0c2QAAAAAAAAAAQAAAIdhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABg" +
          "AGABIAAAASAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAAMWF2Y0MBZAAK/+E" +
          "AFmdkAAqs2UHB//oQAAADABAAAAMAIPEiWWABAAZo6+PLIsAAAAAYc3R0cwAAAAAAAAABAAAAGAAAABgAAAAUc3R" +
          "zcwAAAAAAAAABAAAAAQAAABhzdHNjAAAAAAAAAAEAAAABAAAAGAAAAAEAAAAgc3RzegAAAAAAAAAAAAAAGAAAAEQ" +
          "AAAAUAAAAE3N0Y28AAAAAAAAAAQAAADAAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXB" +
          "wbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjYwLjMuMTAw";
        
        document.body.appendChild(video);
        videoRef.current = video;
        
        // Try to play the video
        video.play().catch(() => {
          console.log("[WakeLock] Video fallback play failed");
        });
      }
    };

    requestWakeLock().then(() => {
      if (!wakeLockSupported) {
        startVideoFallback();
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock().then(() => {
          if (!wakeLockSupported) {
            startVideoFallback();
          }
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.remove();
        videoRef.current = null;
      }
    };
  }, []);
}

type CheckInState = "idle" | "mode_select" | "class_select" | "success" | "error" | "already" | "teacher_mode_select" | "teacher_success";
type AttendanceMode = "check_in" | "check_out";

interface PinValidationResult {
  success?: boolean;
  error?: string;
  type?: "student" | "teacher";
  student?: User;
  teacher?: { id: string; name: string; role: number };
  classes?: Class[];
  checkInTime?: string;
  message?: string;
}

interface CheckInResult {
  success?: boolean;
  error?: string;
  student?: User;
  teacher?: { id: string; name: string; role: number };
  checkInTime?: string;
  checkOutTime?: string;
  className?: string;
  message?: string;
  actionType?: "check_in" | "check_out";
}

export default function AttendancePadPage() {
  useWakeLock();
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [checkInState, setCheckInState] = useState<CheckInState>("idle");
  const [pinValidation, setPinValidation] = useState<PinValidationResult | null>(null);
  const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [attendanceMode, setAttendanceMode] = useState<AttendanceMode>("check_in");
  const [skipClassSelection, setSkipClassSelection] = useState(() => {
    const saved = localStorage.getItem("attendance-pad-skip-class-selection");
    return saved === "true";
  });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Real fullscreen API toggle with CSS fallback
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        // Try to use browser fullscreen API
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      // Fallback to CSS-based fullscreen for PWA environments
      console.log("[Fullscreen] API not available, using CSS fallback");
      setIsFullscreen(!isFullscreen);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Auto-request fullscreen on first user interaction (required by browsers)
  useEffect(() => {
    const requestFullscreenOnFirstClick = async () => {
      if (!document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen();
          setIsFullscreen(true);
          console.log("[Fullscreen] Activated on first click");
        } catch (err) {
          console.log("[Fullscreen] Auto-request failed, using CSS fallback");
          setIsFullscreen(true);
        }
      }
      document.removeEventListener("click", requestFullscreenOnFirstClick);
    };
    
    // Add listener for first click to trigger fullscreen (browser requirement)
    document.addEventListener("click", requestFullscreenOnFirstClick, { once: true });
    return () => document.removeEventListener("click", requestFullscreenOnFirstClick);
  }, []);

  // Fetch user's authorized centers (for non-admin users)
  const { data: userCenters = [] } = useQuery<Center[]>({
    queryKey: ["/api/users", user?.id, "centers"],
    enabled: !!user && user.role !== UserRole.ADMIN,
    staleTime: 0,
    refetchOnMount: "always",
    gcTime: 0,
  });

  // Fetch all centers (for admin users only)
  const { data: allCenters = [] } = useQuery<Center[]>({
    queryKey: ["/api/centers"],
    enabled: !!user && user.role === UserRole.ADMIN,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 30000,
    gcTime: 0,
  });

  // Determine which centers the current user can access
  const accessibleCenters = user?.role === UserRole.ADMIN ? allCenters : userCenters;

  // Debug: Log selected center's logo URL with detailed info
  useEffect(() => {
    if (selectedCenterId && accessibleCenters.length > 0) {
      const center = accessibleCenters.find(c => c.id === selectedCenterId);
      console.log("[AttendancePad] === Logo Debug Info ===");
      console.log("[AttendancePad] User role:", user?.role, "(Admin=4)");
      console.log("[AttendancePad] Accessible centers count:", accessibleCenters.length);
      console.log("[AttendancePad] Selected center ID:", selectedCenterId);
      console.log("[AttendancePad] Selected center name:", center?.name);
      console.log("[AttendancePad] attendancePadLogoUrl:", center?.attendancePadLogoUrl);
      console.log("[AttendancePad] attendancePadLogoUrl type:", typeof center?.attendancePadLogoUrl);
      console.log("[AttendancePad] attendancePadLogoUrl length:", center?.attendancePadLogoUrl?.length);
      console.log("[AttendancePad] Will use custom logo:", !!(center?.attendancePadLogoUrl && center.attendancePadLogoUrl.trim()));
      console.log("[AttendancePad] Full center object:", JSON.stringify(center, null, 2));
    }
  }, [selectedCenterId, accessibleCenters, user]);

  // Set initial center - ONLY from user's accessible centers
  useEffect(() => {
    if (accessibleCenters.length === 0) return;
    
    const savedCenterId = localStorage.getItem("attendance-pad-center");
    
    // Check if saved center is in user's accessible centers
    const savedCenterIsAccessible = savedCenterId && 
      accessibleCenters.some(c => c.id === savedCenterId);
    
    if (savedCenterIsAccessible) {
      setSelectedCenterId(savedCenterId);
      console.log("[AttendancePad] Using saved center:", savedCenterId);
    } else {
      // Use first accessible center
      const firstAccessible = accessibleCenters[0];
      setSelectedCenterId(firstAccessible.id);
      localStorage.setItem("attendance-pad-center", firstAccessible.id);
      console.log("[AttendancePad] Saved center not accessible, using first accessible:", firstAccessible.name);
    }
  }, [accessibleCenters]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleNumberClick = (num: string) => {
    if (pin.length < 4 && checkInState === "idle") {
      setPin((prev) => prev + num);
    }
  };

  const handleDelete = () => {
    if (checkInState === "idle") {
      setPin((prev) => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    setPin("");
    setCheckInState("idle");
    setPinValidation(null);
    setCheckInResult(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const validatePin = async () => {
    if (!selectedCenterId || pin.length < 4 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/attendance/validate-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centerId: selectedCenterId, pin }),
        credentials: "include",
      });

      if (response.ok) {
        const data: PinValidationResult = await response.json();
        
        // Check if this is a teacher check-in
        if (data.type === "teacher") {
          setPinValidation(data);
          setCheckInState("teacher_mode_select");
        } else {
          // Student check-in flow
          setPinValidation(data);
          setCheckInState("mode_select");
        }
      } else {
        const error = await response.json();
        setCheckInState("error");
        setCheckInResult({ error: error.error || "출결번호 확인 실패" });
        timeoutRef.current = setTimeout(handleClear, 3000);
      }
    } catch (error) {
      setCheckInState("error");
      setCheckInResult({ error: "네트워크 오류가 발생했습니다" });
      timeoutRef.current = setTimeout(handleClear, 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModeSelect = async (mode: AttendanceMode) => {
    setAttendanceMode(mode);
    if (mode === "check_out") {
      await completeCheckOut();
    } else {
      // Check-in mode - proceed to class selection or complete check-in
      if (pinValidation?.classes && pinValidation.classes.length > 1) {
        // If skipClassSelection is enabled, automatically select first class
        if (skipClassSelection) {
          await completeCheckIn(pinValidation.classes[0].id);
        } else {
          setCheckInState("class_select");
        }
      } else if (pinValidation?.classes && pinValidation.classes.length === 1) {
        await completeCheckIn(pinValidation.classes[0].id);
      } else {
        await completeCheckIn("");
      }
    }
  };

  const completeCheckOut = async () => {
    if (!selectedCenterId) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/attendance/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centerId: selectedCenterId, pin }),
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setCheckInState("success");
        setCheckInResult(data);
      } else {
        const error = await response.json();
        if (error.checkOutTime) {
          setCheckInState("already");
          setCheckInResult(error);
        } else {
          setCheckInState("error");
          setCheckInResult({ error: error.error || "하원 실패" });
        }
      }
    } catch (error) {
      setCheckInState("error");
      setCheckInResult({ error: "네트워크 오류가 발생했습니다" });
    } finally {
      setIsSubmitting(false);
      timeoutRef.current = setTimeout(handleClear, 3000);
    }
  };

  const completeCheckIn = async (classId: string) => {
    if (!selectedCenterId) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centerId: selectedCenterId, pin, classId }),
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setCheckInState("success");
        setCheckInResult(data);
      } else {
        const error = await response.json();
        if (error.checkInTime) {
          setCheckInState("already");
          setCheckInResult(error);
        } else {
          setCheckInState("error");
          setCheckInResult({ error: error.error || "출결 실패" });
        }
      }
    } catch (error) {
      setCheckInState("error");
      setCheckInResult({ error: "네트워크 오류가 발생했습니다" });
    } finally {
      setIsSubmitting(false);
      timeoutRef.current = setTimeout(handleClear, 3000);
    }
  };

  const handleTeacherPunch = async (type: "check_in" | "check_out") => {
    if (!selectedCenterId || !pinValidation?.teacher) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/teacher-work/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: pinValidation.teacher.id,
          centerId: selectedCenterId,
          type,
        }),
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setCheckInResult({
          success: true,
          teacher: pinValidation.teacher,
          message: data.message,
          actionType: data.actionType,
        });
        setCheckInState("teacher_success");
      } else {
        const error = await response.json();
        setCheckInState("error");
        setCheckInResult({ error: error.error || "출퇴근 기록 실패" });
      }
    } catch (error) {
      setCheckInState("error");
      setCheckInResult({ error: "네트워크 오류가 발생했습니다" });
    } finally {
      setIsSubmitting(false);
      timeoutRef.current = setTimeout(handleClear, 3000);
    }
  };

  const handleClassSelect = async (classId: string) => {
    await completeCheckIn(classId);
  };

  const handleCenterChange = (centerId: string) => {
    setSelectedCenterId(centerId);
    localStorage.setItem("attendance-pad-center", centerId);
    setShowSettings(false);
  };

  useEffect(() => {
    if (pin.length === 4 && checkInState === "idle") {
      validatePin();
    }
  }, [pin, checkInState]);

  const isKioskUser = user && user.role === UserRole.KIOSK;

  if (showSettings) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 space-y-6">
            <h2 className="text-xl font-semibold text-center">출결 패드 설정</h2>
            {isKioskUser && (
              <div className="text-sm text-center text-muted-foreground">
                로그인: {user.name}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">센터 선택</label>
              <Select value={selectedCenterId || ""} onValueChange={handleCenterChange}>
                <SelectTrigger data-testid="select-center">
                  <SelectValue placeholder="센터를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {accessibleCenters.map((center) => (
                    <SelectItem key={center.id} value={center.id}>
                      {center.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">반 선택 건너뛰기</label>
                <p className="text-xs text-muted-foreground">
                  여러 수업에 등록된 학생도 반 선택 없이 바로 출결 처리
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={skipClassSelection}
                onClick={() => {
                  const newValue = !skipClassSelection;
                  setSkipClassSelection(newValue);
                  localStorage.setItem("attendance-pad-skip-class-selection", String(newValue));
                }}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                  skipClassSelection ? "bg-primary" : "bg-input"
                )}
                data-testid="toggle-skip-class-selection"
              >
                <span
                  className={cn(
                    "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
                    skipClassSelection ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
            {!isKioskUser && (
              <Button
                variant="default"
                className="w-full"
                onClick={() => setLocation("/attendance")}
                data-testid="button-go-to-attendance"
              >
                <ClipboardList className="w-4 h-4 mr-2" />
                출결 관리 페이지로 이동
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowSettings(false)}
              data-testid="button-back-to-pad"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              돌아가기
            </Button>
            {isKioskUser && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={logout}
                data-testid="button-kiosk-logout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                로그아웃
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedCenter = accessibleCenters.find((c) => c.id === selectedCenterId);

  return (
    <div className={cn(
      "h-dvh bg-background flex flex-col overflow-hidden",
      isFullscreen && "fixed inset-0 z-[9999]"
    )}>
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFullscreen}
          data-testid="button-fullscreen"
        >
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowSettings(true)}
          data-testid="button-settings"
        >
          <Settings className="w-5 h-5" />
        </Button>
        {isKioskUser && (
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            data-testid="button-logout-main"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center p-1 sm:p-2 landscape:p-4 overflow-auto">
        <div className="flex flex-col landscape:flex-row landscape:gap-12 items-center justify-center w-full max-w-5xl">
          <div className="text-center mb-1 sm:mb-2 landscape:mb-0 landscape:flex-1 flex flex-col items-center justify-center">
            <img 
              src={(() => {
                const logoUrl = selectedCenter?.attendancePadLogoUrl;
                if (logoUrl && logoUrl.trim()) {
                  let proxyUrl = logoUrl;
                  if (logoUrl.startsWith("https://pub-") && logoUrl.includes(".r2.dev/")) {
                    const parts = logoUrl.split(".r2.dev/");
                    if (parts.length === 2) {
                      proxyUrl = `/api/r2-proxy/${parts[1]}`;
                    }
                  }
                  const separator = proxyUrl.includes('?') ? '&' : '?';
                  const version = selectedCenter?.updatedAt ? new Date(selectedCenter.updatedAt).getTime() : Date.now();
                  return `${proxyUrl}${separator}v=${version}`;
                }
                return defaultLogoUrl;
              })()}
              alt={selectedCenter?.name || "새결수학"} 
              className="h-12 sm:h-[7.5rem] landscape:h-24 w-auto mx-auto mb-1 sm:mb-4 landscape:mb-4" 
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                console.error("[AttendancePad] Logo load failed:", target.src);
                console.error("[AttendancePad] Falling back to default logo");
                if (!target.src.includes(defaultLogoUrl)) {
                  target.src = defaultLogoUrl;
                }
              }}
              onLoad={() => {
                console.log("[AttendancePad] Logo loaded successfully");
              }}
            />
            <div className="text-sm sm:text-xl landscape:text-lg text-muted-foreground">
              {format(currentTime, "yyyy년 M월 d일 EEEE", { locale: ko })}
            </div>
            {selectedCenter && (
              <div className="text-xs sm:text-base landscape:text-base text-muted-foreground mt-0.5 sm:mt-2">
                {selectedCenter.name}
              </div>
            )}
          </div>

          <div className="landscape:flex-1 flex flex-col items-center w-full">
            {checkInState === "idle" && (
              <>
                <div className="mb-1 sm:mb-6 landscape:mb-4">
                  <p className="text-sm sm:text-xl landscape:text-lg text-center text-muted-foreground mb-2 sm:mb-6 landscape:mb-4">
                    출결번호 4자리를 입력하세요
                  </p>
                  <div className="flex justify-center gap-2 sm:gap-4 landscape:gap-3 mb-2 sm:mb-6 landscape:mb-4">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-11 h-12 sm:w-16 sm:h-20 landscape:w-16 landscape:h-20 rounded-lg sm:rounded-xl border-2 flex items-center justify-center text-xl sm:text-4xl landscape:text-4xl font-bold",
                          pin.length > i
                            ? "border-primary bg-primary/10"
                            : "border-border"
                        )}
                      >
                        {pin[i] ? "*" : ""}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 sm:gap-3 landscape:gap-3 w-full max-w-[240px] sm:max-w-[320px] landscape:max-w-[320px] mx-auto pb-2 sm:pb-0">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                    <Button
                      key={num}
                      variant="outline"
                      className="h-12 sm:h-20 landscape:h-14 text-xl sm:text-3xl landscape:text-3xl font-bold"
                      onClick={() => handleNumberClick(num)}
                      data-testid={`button-num-${num}`}
                    >
                      {num}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    className="h-12 sm:h-20 landscape:h-14"
                    onClick={handleClear}
                    data-testid="button-clear"
                  >
                    <X className="w-5 h-5 sm:w-8 sm:h-8 landscape:w-6 landscape:h-6" />
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 sm:h-20 landscape:h-14 text-xl sm:text-3xl landscape:text-3xl font-bold"
                    onClick={() => handleNumberClick("0")}
                    data-testid="button-num-0"
                  >
                    0
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 sm:h-20 landscape:h-14"
                    onClick={handleDelete}
                    data-testid="button-delete"
                  >
                    <Delete className="w-5 h-5 sm:w-8 sm:h-8 landscape:w-6 landscape:h-6" />
                  </Button>
                </div>
              </>
            )}

            {checkInState === "mode_select" && pinValidation && (
              <div className="text-center animate-in fade-in zoom-in duration-300 w-full max-w-md landscape:max-w-md">
                <h2 className="text-2xl landscape:text-2xl font-bold mb-6 landscape:mb-4">
                  {pinValidation.student?.name}
                </h2>
                <div className="grid gap-4 landscape:gap-6">
                  <Button
                    variant="default"
                    className="h-24 landscape:h-24 text-2xl landscape:text-3xl font-bold"
                    onClick={() => handleModeSelect("check_in")}
                    disabled={isSubmitting}
                    data-testid="button-select-checkin"
                  >
                    등원
                  </Button>
                  <Button
                    variant="outline"
                    className="h-24 landscape:h-24 text-2xl landscape:text-3xl font-bold"
                    onClick={() => handleModeSelect("check_out")}
                    disabled={isSubmitting}
                    data-testid="button-select-checkout"
                  >
                    하원
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  className="mt-8 landscape:mt-6 text-lg landscape:text-base"
                  onClick={handleClear}
                  data-testid="button-cancel-mode-select"
                >
                  취소
                </Button>
              </div>
            )}

            {checkInState === "teacher_mode_select" && pinValidation && (
              <div className="text-center animate-in fade-in zoom-in duration-300 w-full max-w-md landscape:max-w-md">
                <h2 className="text-2xl landscape:text-2xl font-bold mb-6 landscape:mb-4">
                  {pinValidation.teacher?.name} 선생님
                </h2>
                <div className="grid gap-4 landscape:gap-6">
                  <Button
                    variant="default"
                    className="h-24 landscape:h-24 text-2xl landscape:text-3xl font-bold bg-blue-600 hover:bg-blue-700"
                    onClick={() => handleTeacherPunch("check_in")}
                    disabled={isSubmitting}
                    data-testid="button-teacher-checkin"
                  >
                    출근
                  </Button>
                  <Button
                    variant="outline"
                    className="h-24 landscape:h-24 text-2xl landscape:text-3xl font-bold border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                    onClick={() => handleTeacherPunch("check_out")}
                    disabled={isSubmitting}
                    data-testid="button-teacher-checkout"
                  >
                    퇴근
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  className="mt-8 landscape:mt-6 text-lg landscape:text-base"
                  onClick={handleClear}
                  data-testid="button-cancel-teacher-mode"
                >
                  취소
                </Button>
              </div>
            )}

            {checkInState === "class_select" && pinValidation && (
              <div className="text-center animate-in fade-in zoom-in duration-300 w-full max-w-md landscape:max-w-md">
                <h2 className="text-2xl landscape:text-2xl font-bold mb-2 landscape:mb-2">
                  {pinValidation.student?.name}
                </h2>
                <p className="text-lg landscape:text-lg text-muted-foreground mb-6 landscape:mb-6">
                  출결할 수업을 선택하세요
                </p>
                <div className="grid gap-3 landscape:gap-4">
                  {pinValidation.classes?.map((cls) => (
                    <Button
                      key={cls.id}
                      variant="outline"
                      className="h-16 landscape:h-20 text-xl landscape:text-2xl font-semibold justify-start px-6 landscape:px-6 gap-4 landscape:gap-4"
                      onClick={() => handleClassSelect(cls.id)}
                      disabled={isSubmitting}
                      data-testid={`button-class-${cls.id}`}
                    >
                      <BookOpen className="w-6 h-6 landscape:w-8 landscape:h-8" />
                      <span>{cls.name} {cls.subject ? `${cls.subject}반` : ''}{cls.classroom ? ` (${cls.classroom})` : ''}</span>
                    </Button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  className="mt-6 landscape:mt-6 text-lg landscape:text-base"
                  onClick={handleClear}
                  data-testid="button-cancel-class-select"
                >
                  취소
                </Button>
              </div>
            )}

            {checkInState === "success" && checkInResult && (
              <div className="text-center animate-in fade-in zoom-in duration-300">
                <div className="w-32 h-32 landscape:w-32 landscape:h-32 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6 landscape:mb-6">
                  <Check className="w-16 h-16 landscape:w-16 landscape:h-16 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-3xl landscape:text-4xl font-bold text-green-600 dark:text-green-400">
                  {checkInResult.student?.name} {attendanceMode === "check_in" ? "등원" : "하원"} 완료
                </h2>
                {!skipClassSelection && checkInResult.className && (
                  <p className="text-xl landscape:text-xl text-muted-foreground mt-2 landscape:mt-2">
                    {checkInResult.className}
                  </p>
                )}
              </div>
            )}

            {checkInState === "teacher_success" && checkInResult && (
              <div className="text-center animate-in fade-in zoom-in duration-300">
                <div className={`w-32 h-32 landscape:w-32 landscape:h-32 rounded-full flex items-center justify-center mx-auto mb-6 landscape:mb-6 ${
                  checkInResult.actionType === "check_out" 
                    ? "bg-orange-100 dark:bg-orange-900/30" 
                    : "bg-blue-100 dark:bg-blue-900/30"
                }`}>
                  <Check className={`w-16 h-16 landscape:w-16 landscape:h-16 ${
                    checkInResult.actionType === "check_out"
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-blue-600 dark:text-blue-400"
                  }`} />
                </div>
                <h2 className={`text-3xl landscape:text-4xl font-bold ${
                  checkInResult.actionType === "check_out"
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-blue-600 dark:text-blue-400"
                }`}>
                  {checkInResult.teacher?.name} 선생님 {checkInResult.actionType === "check_out" ? "퇴근!" : "출근!"}
                </h2>
                <p className="text-xl landscape:text-xl text-muted-foreground mt-2 landscape:mt-2">
                  {checkInResult.message}
                </p>
              </div>
            )}

            {checkInState === "already" && checkInResult && (
              <div className="text-center animate-in fade-in zoom-in duration-300">
                <div className="w-32 h-32 landscape:w-32 landscape:h-32 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mx-auto mb-6 landscape:mb-6">
                  <Check className="w-16 h-16 landscape:w-16 landscape:h-16 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h2 className="text-3xl landscape:text-4xl font-bold text-yellow-600 dark:text-yellow-400">
                  {checkInResult.student?.name} 이미 {attendanceMode === "check_in" ? "등원" : "하원"} 완료
                </h2>
              </div>
            )}

            {checkInState === "error" && checkInResult && (
              <div className="text-center animate-in fade-in zoom-in duration-300">
                <div className="w-32 h-32 landscape:w-32 landscape:h-32 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6 landscape:mb-6">
                  <X className="w-16 h-16 landscape:w-16 landscape:h-16 text-red-600 dark:text-red-400" />
                </div>
                <p className="text-2xl landscape:text-2xl text-red-600 dark:text-red-400 font-semibold mb-4 landscape:mb-4">
                  {checkInResult.error || "출석 실패"}
                </p>
                <Button variant="outline" onClick={handleClear} className="mt-4 landscape:mt-4 text-lg landscape:text-base h-12 landscape:h-auto px-6 landscape:px-4">
                  다시 시도
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
