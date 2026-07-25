import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User, Center } from "@shared/schema";
import { UserRole } from "@shared/schema";
import { queryClient } from "./queryClient";
import { isPushSupported, isCurrentlySubscribed, subscribePush } from "./push-notifications";

interface AuthContextType {
  user: User | null;
  centers: Center[];
  selectedCenter: Center | null;
  isLoading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => void;
  selectCenter: (center: Center) => void;
  refreshCenters: () => Promise<void>;
  updateUser: (updatedUser: Partial<User>) => void;
  // 학부모 계정 자녀 관리
  children: User[];
  selectedChild: User | null;
  selectChild: (child: User | null) => void;
  refreshChildren: () => Promise<void>;
  isParentAccount: boolean;
  effectiveUser: User | null; // 실제 사용할 사용자 (학부모인 경우 선택된 자녀, 아니면 본인)
}

// Helper to get storage based on rememberMe preference
function getStorage(): Storage {
  const rememberMe = localStorage.getItem("rememberMe") === "true";
  return rememberMe ? localStorage : sessionStorage;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children: childrenProp }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // 학부모 계정 자녀 관리
  const [childUsers, setChildUsers] = useState<User[]>([]);
  const [selectedChild, setSelectedChild] = useState<User | null>(null);

  useEffect(() => {
    // Check both localStorage and sessionStorage for user data
    const storage = getStorage();
    const storedUser = storage.getItem("user") || localStorage.getItem("user");
    const storedCenter = storage.getItem("selectedCenter") || localStorage.getItem("selectedCenter");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchCentersForUser(parsedUser);
    }
    if (storedCenter) {
      setSelectedCenter(JSON.parse(storedCenter));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!user || !selectedCenter) return;
    const autoSubscribePush = async () => {
      try {
        if (!isPushSupported()) return;
        if (Notification.permission === "denied") return;
        const alreadySubscribed = await isCurrentlySubscribed();
        if (alreadySubscribed) return;
        if (Notification.permission === "default") {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") return;
        }
        await subscribePush(user.id, selectedCenter.id);
        console.log("[Push] Auto-subscribed successfully");
      } catch (e) {
        console.error("[Push] Auto-subscribe failed:", e);
      }
    };
    autoSubscribePush();
  }, [user, selectedCenter]);

  // Update favicon, manifest, and page title based on selected center
  useEffect(() => {
    const faviconLink = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    const appleIcon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
    const manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
    
    // Helper to convert R2 URLs to proxy URLs for same-origin HTTPS serving
    const toProxyUrl = (url: string): string => {
      if (!url) return url;
      if (url.startsWith("https://pub-") && url.includes(".r2.dev/")) {
        const parts = url.split(".r2.dev/");
        if (parts.length === 2) {
          return `/api/r2-proxy/${parts[1]}`;
        }
      }
      return url;
    };
    
    // Helper to add cache busting to URLs
    const addCacheBusting = (url: string, isDefault: boolean = false): string => {
      if (!url || isDefault) return url;
      const proxyUrl = toProxyUrl(url);
      const separator = proxyUrl.includes('?') ? '&' : '?';
      const version = selectedCenter?.updatedAt ? new Date(selectedCenter.updatedAt).getTime() : Date.now();
      return `${proxyUrl}${separator}v=${version}`;
    };
    
    const defaultFavicon = "/default-favicon.png";
    const baseFaviconUrl = selectedCenter?.faviconUrl || defaultFavicon;
    const faviconUrl = addCacheBusting(baseFaviconUrl, baseFaviconUrl === defaultFavicon);
    
    if (faviconLink) {
      faviconLink.href = faviconUrl;
    }
    if (appleIcon) {
      // Use shortcut icon for apple-touch-icon if available, otherwise use favicon
      const baseAppleUrl = (selectedCenter as any)?.shortcutIconUrl || baseFaviconUrl;
      const appleIconUrl = addCacheBusting(baseAppleUrl, baseAppleUrl === defaultFavicon);
      appleIcon.href = appleIconUrl;
    }
    
    // Update manifest link for PWA with center-specific icons and name
    if (manifestLink) {
      if (selectedCenter?.id) {
        const version = selectedCenter?.updatedAt ? new Date(selectedCenter.updatedAt).getTime() : Date.now();
        manifestLink.href = `/api/manifest?centerId=${selectedCenter.id}&v=${version}`;
      } else {
        manifestLink.href = "/api/manifest";
      }
    }
    
    // Update page title based on selected center
    if (selectedCenter?.name) {
      document.title = `${selectedCenter.name} - 학원 통합 관리`;
    } else {
      document.title = "이음위더스 - 학원 통합 관리";
    }
  }, [selectedCenter?.faviconUrl, selectedCenter?.name, selectedCenter?.id, selectedCenter?.updatedAt]);

  // For admins, fetch all centers. For others, fetch only assigned centers.
  const fetchCentersForUser = async (currentUser: User) => {
    try {
      const isAdmin = currentUser.role >= UserRole.ADMIN;
      const url = isAdmin ? "/api/centers" : `/api/users/${currentUser.id}/centers`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCenters(data);
        
        // Check if stored selectedCenter is still valid
        const storage = getStorage();
        const storedCenter = storage.getItem("selectedCenter") || localStorage.getItem("selectedCenter");
        let currentSelectedCenter = storedCenter ? JSON.parse(storedCenter) : null;
        
        // Validate that stored center exists in fetched centers
        const isValidCenter = currentSelectedCenter && data.some((c: Center) => c.id === currentSelectedCenter.id);
        
        if (!isValidCenter && data.length > 0) {
          // Stored center is invalid, use first available center
          console.log("Stored center is invalid, switching to:", data[0].name);
          setSelectedCenter(data[0]);
          // Sync both storages to ensure consistency
          localStorage.setItem("selectedCenter", JSON.stringify(data[0]));
          sessionStorage.setItem("selectedCenter", JSON.stringify(data[0]));
        } else if (isValidCenter) {
          // Update with fresh center data from server
          const freshCenter = data.find((c: Center) => c.id === currentSelectedCenter.id);
          if (freshCenter) {
            setSelectedCenter(freshCenter);
            // Sync both storages to ensure consistency
            localStorage.setItem("selectedCenter", JSON.stringify(freshCenter));
            sessionStorage.setItem("selectedCenter", JSON.stringify(freshCenter));
          }
        } else if (data.length > 0) {
          setSelectedCenter(data[0]);
          // Sync both storages to ensure consistency
          localStorage.setItem("selectedCenter", JSON.stringify(data[0]));
          sessionStorage.setItem("selectedCenter", JSON.stringify(data[0]));
        }
      }
    } catch (error) {
      console.error("Failed to fetch centers:", error);
    }
  };

  const login = async (username: string, password: string, rememberMe: boolean = true): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const data = await res.json();
        queryClient.clear();
        setUser(data.user);
        
        // Use localStorage for persistent login, sessionStorage for session-only
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem("user", JSON.stringify(data.user));
        
        // For admins, fetch all centers. For others, use centers from login response.
        const isAdmin = data.user.role >= UserRole.ADMIN;
        if (isAdmin) {
          const centersRes = await fetch("/api/centers");
          if (centersRes.ok) {
            const allCenters = await centersRes.json();
            setCenters(allCenters);
            if (allCenters.length > 0) {
              setSelectedCenter(allCenters[0]);
              // Sync both storages for consistency
              const centerData = JSON.stringify(allCenters[0]);
              localStorage.setItem("selectedCenter", centerData);
              sessionStorage.setItem("selectedCenter", centerData);
            }
          }
        } else {
          setCenters(data.centers || []);
          if (data.centers?.length > 0) {
            setSelectedCenter(data.centers[0]);
            // Sync both storages for consistency
            const centerData = JSON.stringify(data.centers[0]);
            localStorage.setItem("selectedCenter", centerData);
            sessionStorage.setItem("selectedCenter", centerData);
          }
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  };

  const logout = () => {
    // Preserve last center ID so the login page can show the correct branding
    try {
      const stored = localStorage.getItem("selectedCenter") || sessionStorage.getItem("selectedCenter");
      if (stored) {
        const c = JSON.parse(stored);
        if (c?.id) {
          localStorage.setItem("lastLoginCenterId", c.id);
        }
      }
    } catch {
      // ignore
    }
    queryClient.clear();
    setUser(null);
    setCenters([]);
    setSelectedCenter(null);
    // Clear from both storages to ensure complete logout
    localStorage.removeItem("user");
    localStorage.removeItem("selectedCenter");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("selectedCenter");
  };

  const selectCenter = (center: Center) => {
    setSelectedCenter(center);
    // Always sync both storages to ensure consistency across sessions and devices
    const centerData = JSON.stringify(center);
    localStorage.setItem("selectedCenter", centerData);
    sessionStorage.setItem("selectedCenter", centerData);
    if (center?.id) {
      localStorage.setItem("lastLoginCenterId", center.id);
    }
  };

  const refreshCenters = async () => {
    if (user) {
      await fetchCentersForUser(user);
    }
  };

  const updateUser = (updatedUser: Partial<User>) => {
    if (user) {
      const newUser = { ...user, ...updatedUser };
      setUser(newUser);
      const storage = getStorage();
      storage.setItem("user", JSON.stringify(newUser));
      localStorage.setItem("user", JSON.stringify(newUser));
    }
  };

  // 학부모 계정 여부 확인
  const isParentAccount = user?.accountType === "parent" || user?.role === UserRole.PARENT;

  // 학부모의 자녀 목록 불러오기
  const refreshChildren = async () => {
    if (!user || !isParentAccount) {
      setChildUsers([]);
      return;
    }
    try {
      const response = await fetch(`/api/parents/${user.id}/children?actorId=${user.id}`);
      if (response.ok) {
        const childrenData = await response.json();
        setChildUsers(childrenData);
        
        // 저장된 선택된 자녀 복원 또는 첫 번째 자녀 자동 선택
        const storage = getStorage();
        const storedChildId = storage.getItem("selectedChildId");
        if (storedChildId && childrenData.length > 0) {
          const storedChild = childrenData.find((c: User) => c.id === storedChildId);
          if (storedChild) {
            setSelectedChild(storedChild);
          } else if (childrenData.length > 0) {
            setSelectedChild(childrenData[0]);
          }
        } else if (childrenData.length > 0) {
          setSelectedChild(childrenData[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch children:", error);
    }
  };

  // 학부모 로그인 시 자녀 목록 불러오기
  useEffect(() => {
    if (user && isParentAccount) {
      refreshChildren();
    }
  }, [user?.id, isParentAccount]);

  // 자녀 선택
  const selectChild = (child: User | null) => {
    setSelectedChild(child);
    const storage = getStorage();
    if (child) {
      storage.setItem("selectedChildId", child.id);
      localStorage.setItem("selectedChildId", child.id);
    } else {
      storage.removeItem("selectedChildId");
      localStorage.removeItem("selectedChildId");
    }
  };

  // 실제 사용할 사용자 (학부모인 경우 선택된 자녀, 아니면 본인)
  const effectiveUser = isParentAccount && selectedChild ? selectedChild : user;

  return (
    <AuthContext.Provider value={{ 
      user, 
      centers, 
      selectedCenter, 
      isLoading, 
      login, 
      logout, 
      selectCenter, 
      refreshCenters, 
      updateUser,
      children: childUsers,
      selectedChild,
      selectChild,
      refreshChildren,
      isParentAccount,
      effectiveUser,
    }}>
      {childrenProp}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
