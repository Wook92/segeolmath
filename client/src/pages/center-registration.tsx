import { useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Building2, User, Phone, MapPin, FileText, ArrowLeft, CheckCircle, Upload, Image, X, HelpCircle, CreditCard } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import defaultLogoUrl from "/default-login-logo.png";

const registrationSchema = z.object({
  name: z.string().min(1, "학원명을 입력해주세요"),
  businessName: z.string().optional(),
  representativeName: z.string().optional(),
  businessRegistrationNumber: z.string().optional(),
  businessAddress: z.string().optional(),
  businessPhone: z.string().optional(),
  applicantName: z.string().min(1, "신청자 이름을 입력해주세요"),
  applicantPhone: z.string().min(10, "올바른 휴대폰 번호를 입력해주세요").max(11),
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

type LogoHelpImage = {
  id: string;
  logoType: string;
  imageUrl: string;
  description: string;
};

const LOGO_TYPE_LABELS: Record<string, string> = {
  loginLogo: "로그인 페이지 로고",
  sidebarLogo: "사이드바 로고",
  favicon: "파비콘",
  attendancePadLogo: "출결패드 로고",
  shortcutIcon: "홈화면 바로가기 아이콘",
};

const LOGO_TYPE_DESCRIPTIONS: Record<string, string> = {
  loginLogo: "로그인 페이지 상단에 표시되는 로고입니다.",
  sidebarLogo: "사이드바 상단에 표시되는 로고입니다. 모바일에서는 헤더에 표시됩니다.",
  favicon: "브라우저 탭에 표시되는 작은 아이콘입니다. 32x32 크기를 권장합니다.",
  attendancePadLogo: "출결패드 화면에 표시되는 로고입니다.",
  shortcutIcon: "모바일 홈화면에 바로가기 추가 시 표시되는 아이콘입니다. 192x192 크기를 권장합니다.",
};

function LogoHelpButton({ logoType, helpImages }: { logoType: string; helpImages: LogoHelpImage[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const helpImage = helpImages.find(h => h.logoType === logoType);
  
  const label = LOGO_TYPE_LABELS[logoType] || logoType;
  const description = LOGO_TYPE_DESCRIPTIONS[logoType] || "";
  
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="ml-1 text-muted-foreground hover-elevate rounded"
        data-testid={`button-logo-help-${logoType}`}
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{label} 사용 예시</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{description}</p>
            
            {helpImage?.imageUrl ? (
              <div className="rounded-md overflow-hidden border">
                <img 
                  src={helpImage.imageUrl} 
                  alt={`${label} 사용 예시`}
                  className="w-full object-contain max-h-96"
                />
                {helpImage.description && (
                  <p className="text-xs text-muted-foreground p-2 bg-muted">{helpImage.description}</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 bg-muted rounded-md">
                <HelpCircle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">등록된 예시 이미지가 없습니다</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function CenterRegistrationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const [loginLogoFile, setLoginLogoFile] = useState<File | null>(null);
  const [loginLogoPreview, setLoginLogoPreview] = useState<string | null>(null);
  const [sidebarLogoFile, setSidebarLogoFile] = useState<File | null>(null);
  const [sidebarLogoPreview, setSidebarLogoPreview] = useState<string | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [attendancePadLogoFile, setAttendancePadLogoFile] = useState<File | null>(null);
  const [attendancePadLogoPreview, setAttendancePadLogoPreview] = useState<string | null>(null);
  const [shortcutIconFile, setShortcutIconFile] = useState<File | null>(null);
  const [shortcutIconPreview, setShortcutIconPreview] = useState<string | null>(null);
  const [tossConsentAgreed, setTossConsentAgreed] = useState(false);
  
  const loginLogoRef = useRef<HTMLInputElement>(null);
  const sidebarLogoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);
  const attendancePadLogoRef = useRef<HTMLInputElement>(null);
  const shortcutIconRef = useRef<HTMLInputElement>(null);
  
  const { data: helpImages = [] } = useQuery<LogoHelpImage[]>({
    queryKey: ["/api/logo-help-images"],
  });
  
  const handleLogoSelect = (
    file: File | undefined,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void
  ) => {
    if (file) {
      setFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const clearLogo = (
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const form = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      name: "",
      businessName: "",
      representativeName: "",
      businessRegistrationNumber: "",
      businessAddress: "",
      businessPhone: "",
      applicantName: "",
      applicantPhone: "",
    },
  });

  const onSubmit = async (data: RegistrationFormData) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });
      
      if (tossConsentAgreed) formData.append("tossConsentAgreed", "true");
      
      if (loginLogoFile) formData.append("loginLogo", loginLogoFile);
      if (sidebarLogoFile) formData.append("sidebarLogo", sidebarLogoFile);
      if (faviconFile) formData.append("favicon", faviconFile);
      if (attendancePadLogoFile) formData.append("attendancePadLogo", attendancePadLogoFile);
      if (shortcutIconFile) formData.append("shortcutIcon", shortcutIconFile);
      
      const response = await fetch("/api/center-registrations", {
        method: "POST",
        body: formData,
      });
      
      if (response.ok) {
        setIsSubmitted(true);
        toast({
          title: "신청 완료",
          description: "학원 등록 신청이 접수되었습니다. 관리자 승인 후 이용 가능합니다.",
        });
      } else {
        // Surface the actual server error. Server may return JSON OR an HTML
        // error page (proxy/CDN), so parse defensively and always include the
        // HTTP status so the user/admin can diagnose.
        const raw = await response.text().catch(() => "");
        let serverMsg = "";
        try {
          const parsed = raw ? JSON.parse(raw) : null;
          serverMsg = parsed?.error || parsed?.message || "";
        } catch {
          serverMsg = raw.slice(0, 200);
        }
        console.error("[center-registration] POST failed", {
          status: response.status,
          body: raw.slice(0, 500),
        });
        toast({
          title: "신청 실패",
          description: `[${response.status}] ${serverMsg || "학원 등록 신청에 실패했습니다."}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("[center-registration] POST exception", error);
      toast({
        title: "오류 발생",
        description: error instanceof Error ? error.message : "신청 처리 중 문제가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center">
            <img 
              src={defaultLogoUrl} 
              alt="로고" 
              className="h-40 w-auto" 
              data-testid="img-logo" 
            />
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
                <h2 className="text-xl font-semibold">신청이 완료되었습니다</h2>
                <p className="text-muted-foreground">
                  학원 등록 신청이 정상적으로 접수되었습니다.<br />
                  관리자 승인 후 안내 연락을 드리겠습니다.
                </p>
                <div className="pt-4 w-full">
                  <Link href="/login">
                    <Button className="w-full" data-testid="button-back-to-login">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      로그인 페이지로 돌아가기
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center">
          <img 
            src={defaultLogoUrl} 
            alt="로고" 
            className="h-40 w-auto" 
            data-testid="img-logo" 
          />
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">학원 등록 신청</CardTitle>
            <CardDescription>
              학원 정보를 입력하여 등록을 신청해주세요.<br />
              관리자 승인 후 원장 계정이 생성됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground border-b pb-2">학원 정보</h3>
                  
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>학원명 *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="예: OO학원"
                              className="pl-10"
                              data-testid="input-center-name"
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
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>사업자명 (상호)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="사업자등록증 상 상호명"
                            data-testid="input-business-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="representativeName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>대표자명</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="대표자 성함"
                            data-testid="input-representative-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessRegistrationNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>사업자등록번호</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="000-00-00000"
                              className="pl-10"
                              data-testid="input-business-number"
                              maxLength={12}
                              value={field.value || ""}
                              onChange={(e) => {
                                const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                                let formatted = digits;
                                if (digits.length > 3) {
                                  formatted = digits.slice(0, 3) + "-" + digits.slice(3);
                                }
                                if (digits.length > 5) {
                                  formatted = digits.slice(0, 3) + "-" + digits.slice(3, 5) + "-" + digits.slice(5);
                                }
                                field.onChange(formatted);
                              }}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>사업장 주소</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="서울시 강남구..."
                              className="pl-10"
                              data-testid="input-business-address"
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
                    name="businessPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>학원 전화번호</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="02-1234-5678"
                              className="pl-10"
                              data-testid="input-business-phone"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4 pt-4">
                  <h3 className="font-medium text-sm text-muted-foreground border-b pb-2">신청자 정보 (원장님)</h3>
                  
                  <FormField
                    control={form.control}
                    name="applicantName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>신청자 이름 *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="홍길동"
                              className="pl-10"
                              data-testid="input-applicant-name"
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
                    name="applicantPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>신청자 휴대폰 번호 *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="01012345678"
                              className="pl-10"
                              data-testid="input-applicant-phone"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          승인 시 이 번호가 로그인 아이디로 사용됩니다
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                </div>

                <div className="space-y-3 pt-4">
                  <h3 className="font-medium text-sm text-muted-foreground border-b pb-2">교육비 결제 연동 (선택)</h3>
                  <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                    <Checkbox
                      id="toss-consent"
                      checked={tossConsentAgreed}
                      onCheckedChange={(checked) => setTossConsentAgreed(checked === true)}
                      className="mt-0.5"
                      data-testid="checkbox-toss-consent"
                    />
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="toss-consent" className="text-sm cursor-pointer select-none">
                        교육비 결제 기능 사용에 동의합니다
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className="flex-shrink-0" data-testid="button-toss-consent-help">
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-pointer" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent side="top" className="max-w-xs text-left">
                          <p className="font-medium text-sm">토스페이먼츠 결제 연동 안내</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            교육비 온라인 결제 기능을 사용하기 위해 토스페이먼츠에 가맹점 등록이 필요합니다. 
                            동의 시 학원명, 사업자 정보, 대표자 정보가 결제 서비스 등록에 활용됩니다. 
                            관리자 승인 후 결제 기능이 활성화됩니다.
                          </p>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <h3 className="font-medium text-sm text-muted-foreground border-b pb-2">로고 설정 (선택)</h3>
                  <p className="text-xs text-muted-foreground">
                    로고 등록은 나중에 해도 됩니다. 로고를 등록하지 않으면 기본 이미지로 대체됩니다.
                  </p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">로그인 페이지</span>
                        <LogoHelpButton logoType="loginLogo" helpImages={helpImages} />
                      </div>
                      <div 
                        className="h-20 border rounded-md flex items-center justify-center bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors relative"
                        onClick={() => loginLogoRef.current?.click()}
                      >
                        {loginLogoPreview ? (
                          <>
                            <img src={loginLogoPreview} alt="로그인 로고" className="max-h-16 max-w-full object-contain" />
                            <button
                              type="button"
                              className="absolute top-1 right-1 p-1 bg-background/80 rounded-full"
                              onClick={(e) => { e.stopPropagation(); clearLogo(setLoginLogoFile, setLoginLogoPreview, loginLogoRef); }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <Image className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <input
                        ref={loginLogoRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleLogoSelect(e.target.files?.[0], setLoginLogoFile, setLoginLogoPreview)}
                      />
                      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => loginLogoRef.current?.click()}>
                        <Upload className="h-3 w-3 mr-1" /> 업로드
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">사이드바</span>
                        <LogoHelpButton logoType="sidebarLogo" helpImages={helpImages} />
                      </div>
                      <div 
                        className="h-20 border rounded-md flex items-center justify-center bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors relative"
                        onClick={() => sidebarLogoRef.current?.click()}
                      >
                        {sidebarLogoPreview ? (
                          <>
                            <img src={sidebarLogoPreview} alt="사이드바 로고" className="max-h-16 max-w-full object-contain" />
                            <button
                              type="button"
                              className="absolute top-1 right-1 p-1 bg-background/80 rounded-full"
                              onClick={(e) => { e.stopPropagation(); clearLogo(setSidebarLogoFile, setSidebarLogoPreview, sidebarLogoRef); }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <Image className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <input
                        ref={sidebarLogoRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleLogoSelect(e.target.files?.[0], setSidebarLogoFile, setSidebarLogoPreview)}
                      />
                      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => sidebarLogoRef.current?.click()}>
                        <Upload className="h-3 w-3 mr-1" /> 업로드
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">파비콘</span>
                        <LogoHelpButton logoType="favicon" helpImages={helpImages} />
                      </div>
                      <div 
                        className="h-20 border rounded-md flex items-center justify-center bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors relative"
                        onClick={() => faviconRef.current?.click()}
                      >
                        {faviconPreview ? (
                          <>
                            <img src={faviconPreview} alt="파비콘" className="max-h-16 max-w-full object-contain" />
                            <button
                              type="button"
                              className="absolute top-1 right-1 p-1 bg-background/80 rounded-full"
                              onClick={(e) => { e.stopPropagation(); clearLogo(setFaviconFile, setFaviconPreview, faviconRef); }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <Image className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <input
                        ref={faviconRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleLogoSelect(e.target.files?.[0], setFaviconFile, setFaviconPreview)}
                      />
                      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => faviconRef.current?.click()}>
                        <Upload className="h-3 w-3 mr-1" /> 업로드
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">출결패드</span>
                        <LogoHelpButton logoType="attendancePadLogo" helpImages={helpImages} />
                      </div>
                      <div 
                        className="h-20 border rounded-md flex items-center justify-center bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors relative"
                        onClick={() => attendancePadLogoRef.current?.click()}
                      >
                        {attendancePadLogoPreview ? (
                          <>
                            <img src={attendancePadLogoPreview} alt="출결패드 로고" className="max-h-16 max-w-full object-contain" />
                            <button
                              type="button"
                              className="absolute top-1 right-1 p-1 bg-background/80 rounded-full"
                              onClick={(e) => { e.stopPropagation(); clearLogo(setAttendancePadLogoFile, setAttendancePadLogoPreview, attendancePadLogoRef); }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <Image className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <input
                        ref={attendancePadLogoRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleLogoSelect(e.target.files?.[0], setAttendancePadLogoFile, setAttendancePadLogoPreview)}
                      />
                      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => attendancePadLogoRef.current?.click()}>
                        <Upload className="h-3 w-3 mr-1" /> 업로드
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">홈화면 바로가기</span>
                        <LogoHelpButton logoType="shortcutIcon" helpImages={helpImages} />
                      </div>
                      <div 
                        className="h-20 border rounded-md flex items-center justify-center bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors relative"
                        onClick={() => shortcutIconRef.current?.click()}
                      >
                        {shortcutIconPreview ? (
                          <>
                            <img src={shortcutIconPreview} alt="홈화면 바로가기" className="max-h-16 max-w-full object-contain" />
                            <button
                              type="button"
                              className="absolute top-1 right-1 p-1 bg-background/80 rounded-full"
                              onClick={(e) => { e.stopPropagation(); clearLogo(setShortcutIconFile, setShortcutIconPreview, shortcutIconRef); }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <Image className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <input
                        ref={shortcutIconRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleLogoSelect(e.target.files?.[0], setShortcutIconFile, setShortcutIconPreview)}
                      />
                      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => shortcutIconRef.current?.click()}>
                        <Upload className="h-3 w-3 mr-1" /> 업로드
                      </Button>
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    권장: 정사각형 이미지, 최대 5MB (파비콘: 32x32, 바로가기: 192x192)
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-submit-registration"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  등록 신청하기
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center">
              <Link href="/login">
                <Button variant="ghost" className="text-muted-foreground" data-testid="link-back-to-login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  로그인 페이지로 돌아가기
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
