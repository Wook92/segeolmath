import { useState, useEffect, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Phone, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import defaultLogoUrl from "/default-login-logo.png";

const loginSchema = z.object({
  username: z.string().min(1, "휴대폰 번호를 입력해주세요"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem("rememberMe") === "true";
  });

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

  // Get login logo - first from localStorage, then fetch fresh data from server
  const [loginLogoUrl, setLoginLogoUrl] = useState<string>(() => {
    try {
      const storedCenter = localStorage.getItem("selectedCenter") || sessionStorage.getItem("selectedCenter");
      if (storedCenter) {
        const center = JSON.parse(storedCenter);
        const logoUrl = center.loginLogoUrl || defaultLogoUrl;
        return logoUrl !== defaultLogoUrl ? toProxyUrl(logoUrl) : logoUrl;
      }
    } catch (e) {
      // Ignore parse errors
    }
    return defaultLogoUrl;
  });

  // Fetch fresh center data to ensure logo is up-to-date
  useEffect(() => {
    const fetchFreshCenterData = async () => {
      const storedCenter = localStorage.getItem("selectedCenter") || sessionStorage.getItem("selectedCenter");
      const lastCenterId = localStorage.getItem("lastLoginCenterId");
      console.log("[Login Logo] storedCenter exists:", !!storedCenter, "lastLoginCenterId:", lastCenterId);

      // Determine which center to fetch:
      // 1) currently-selected center (active session), or
      // 2) last logged-in center (preserved across logouts)
      let targetCenterId: string | null = null;
      let cachedLogoUrl: string | null = null;
      let cachedUpdatedAt: any = null;
      if (storedCenter) {
        try {
          const c = JSON.parse(storedCenter);
          if (c?.id) {
            targetCenterId = c.id;
            cachedLogoUrl = c?.loginLogoUrl || null;
            cachedUpdatedAt = c?.updatedAt || null;
            console.log(`[Login Logo] using selectedCenter: ${c.name} (${c.id})`);
          }
        } catch (parseErr) {
          console.warn("[Login Logo] selectedCenter JSON parse failed, falling back to lastLoginCenterId", parseErr);
        }
      }
      if (!targetCenterId && lastCenterId) {
        targetCenterId = lastCenterId;
        console.log(`[Login Logo] using lastLoginCenterId: ${lastCenterId}`);
      }

      try {

        if (targetCenterId) {
          const center = { id: targetCenterId, loginLogoUrl: cachedLogoUrl, updatedAt: cachedUpdatedAt } as any;
          // Fetch fresh center data from server using public endpoint
          const res = await fetch(`/api/centers/${center.id}/public`);
          console.log(`[Login Logo] /public response status: ${res.status}`);
          if (res.ok) {
            const freshCenter = await res.json();
            console.log(`[Login Logo] freshCenter loginLogoUrl: ${freshCenter?.loginLogoUrl ? String(freshCenter.loginLogoUrl).substring(0, 80) + '...' : 'null'}, updatedAt: ${freshCenter?.updatedAt}`);
            if (freshCenter) {
              // Sync both storages for consistency across devices
              const centerData = JSON.stringify(freshCenter);
              localStorage.setItem("selectedCenter", centerData);
              sessionStorage.setItem("selectedCenter", centerData);
              // Update logo URL with cache busting and proxy conversion
              const logoUrl = freshCenter.loginLogoUrl || defaultLogoUrl;
              if (logoUrl && logoUrl !== defaultLogoUrl) {
                const proxyUrl = toProxyUrl(logoUrl);
                const separator = proxyUrl.includes('?') ? '&' : '?';
                const finalUrl = `${proxyUrl}${separator}v=${freshCenter.updatedAt || Date.now()}`;
                console.log(`[Login Logo] applying logo: ${finalUrl.substring(0, 100)}...`);
                setLoginLogoUrl(finalUrl);
              } else {
                console.log("[Login Logo] freshCenter has no loginLogoUrl, falling back to default");
                setLoginLogoUrl(logoUrl);
              }
            }
          } else {
            // /public failed — drop stale lastLoginCenterId if it caused this
            if (res.status === 404 || res.status === 400) {
              if (lastCenterId === targetCenterId) {
                console.warn(`[Login Logo] removing stale lastLoginCenterId (${targetCenterId}) due to ${res.status}`);
                localStorage.removeItem("lastLoginCenterId");
              }
            }
            // Fallback: Add cache busting to current logo
            const currentLogo = center.loginLogoUrl || defaultLogoUrl;
            if (currentLogo && currentLogo !== defaultLogoUrl) {
              const proxyUrl = toProxyUrl(currentLogo);
              const separator = proxyUrl.includes('?') ? '&' : '?';
              const finalUrl = `${proxyUrl}${separator}v=${center.updatedAt || Date.now()}`;
              console.warn(`[Login Logo] /public failed, using cached logo: ${finalUrl.substring(0, 100)}...`);
              setLoginLogoUrl(finalUrl);
            }
          }
        } else {
          console.warn("[Login Logo] No selectedCenter or lastLoginCenterId - center logo cannot be applied. The visitor must have selected this center at least once.");
        }
      } catch (e) {
        console.error("[Login Logo] fetch error:", e);
      }
    };
    fetchFreshCenterData();
  }, []);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      localStorage.setItem("rememberMe", rememberMe ? "true" : "false");
      const success = await login(data.username, data.password, rememberMe);
      if (success) {
        toast({
          title: "로그인 성공",
          description: "환영합니다!",
        });
        setLocation("/");
      } else {
        toast({
          title: "로그인 실패",
          description: "아이디 또는 비밀번호를 확인해주세요.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "오류 발생",
        description: "로그인 중 문제가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="flex flex-col items-center">
          <img 
            src={loginLogoUrl} 
            alt="이음위더스 - 학원 통합관리 시스템" 
            className="h-40 w-auto" 
            data-testid="img-logo" 
          />
        </div>

        <Card>
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-xl">로그인</CardTitle>
            <CardDescription className="text-sm">휴대폰 번호와 비밀번호를 입력해주세요</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>휴대폰 번호</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="01012345678"
                            className="pl-10"
                            autoComplete="username"
                            data-testid="input-username"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>비밀번호</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="password"
                            placeholder="비밀번호"
                            className="pl-10"
                            autoComplete="current-password"
                            data-testid="input-password"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="rememberMe"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    data-testid="checkbox-remember-me"
                  />
                  <label
                    htmlFor="rememberMe"
                    className="text-sm text-muted-foreground cursor-pointer select-none"
                  >
                    자동 로그인
                  </label>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  로그인
                </Button>
              </form>
            </Form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              담당 선생님 또는 원장님께 계정 문의주세요.
            </p>

            <div className="mt-3 pt-3 border-t">
              <p className="text-center text-sm text-muted-foreground mb-2">
                학원을 운영하시나요?
              </p>
              <Link href="/center-registration">
                <Button 
                  variant="outline" 
                  className="w-full" 
                  data-testid="button-center-registration"
                >
                  학원 등록하기
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-2">
          기본 비밀번호: 1234
        </p>
      </div>
    </div>
  );
}
