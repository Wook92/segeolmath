import { useState, useEffect, lazy, Suspense } from "react";
import { Switch, Route, Link, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { UserRole } from "@shared/schema";
import { ConsentDialog } from "@/components/consent-dialog";
import { PushNotificationPrompt } from "@/components/push-notification-manager";
import { ThemeProvider } from "@/lib/theme-provider";
import { SidebarPositionProvider, useSidebarPosition } from "@/lib/sidebar-position-context";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { CenterSelector } from "@/components/center-selector";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const TimetablePage = lazy(() => import("@/pages/timetable"));
const MyTimetablePage = lazy(() => import("@/pages/my-timetable"));
const HomeworkPage = lazy(() => import("@/pages/homework"));
const FaceToFaceChecksPage = lazy(() => import("@/pages/face-to-face-checks"));
const AssessmentsPage = lazy(() => import("@/pages/assessments"));
const VideosPage = lazy(() => import("@/pages/videos"));
const TextbooksPage = lazy(() => import("@/pages/textbooks"));
const UsersPage = lazy(() => import("@/pages/users"));
const CentersPage = lazy(() => import("@/pages/centers"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const ClinicPage = lazy(() => import("@/pages/clinic"));
const AttendancePage = lazy(() => import("@/pages/attendance"));
const AttendancePadPage = lazy(() => import("@/pages/attendance-pad"));
const ClassNotesPage = lazy(() => import("@/pages/class-notes"));
const StudyCafePage = lazy(() => import("@/pages/study-cafe"));
const TuitionPage = lazy(() => import("@/pages/tuition"));
const PaymentResultPage = lazy(() => import("@/pages/payment-result"));
const StudentReportsPage = lazy(() => import("@/pages/student-reports"));
const ManualPage = lazy(() => import("@/pages/manual"));
const TodosPage = lazy(() => import("@/pages/todos"));
const ManagementPage = lazy(() => import("@/pages/management"));
const AcademyCalendarPage = lazy(() => import("@/pages/academy-calendar"));
const SchedulePage = lazy(() => import("@/pages/schedule"));
const ParentPortalPage = lazy(() => import("@/pages/parent-portal"));
const ContactParentsPage = lazy(() => import("@/pages/contact-parents"));
const FeatureManagementPage = lazy(() => import("@/pages/feature-management"));
const CenterRegistrationPage = lazy(() => import("@/pages/center-registration"));
const PresentationVideosPage = lazy(() => import("@/pages/presentation-videos"));
const ExamManagementPage = lazy(() => import("@/pages/exam-management"));
const GoogleCalendarTimetablePage = lazy(() => import("@/pages/google-calendar-timetable"));
const TeacherCommunicationPage = lazy(() => import("@/pages/teacher-communication"));
const DailyNoticesPage = lazy(() => import("@/pages/daily-notices"));
const StudentCumulativeDataPage = lazy(() => import("@/pages/student-cumulative-data"));
const SupplementaryPage = lazy(() => import("@/pages/supplementary"));
const VideoSessionsPage = lazy(() => import("@/pages/video-sessions"));
const SemesterAnnouncementsPage = lazy(() => import("@/pages/semester-announcements"));
const CounselingPage = lazy(() => import("@/pages/counseling"));
const GradeTrendPage = lazy(() => import("@/pages/grade-trend"));
const HomeworkCompletionPage = lazy(() => import("@/pages/homework-completion"));
const AttendanceStatusPage = lazy(() => import("@/pages/attendance-status"));
const SchoolGradesPage = lazy(() => import("@/pages/school-grades"));
const TextbookProgressPage = lazy(() => import("@/pages/textbook-progress"));
const WorkJournalPage = lazy(() => import("@/pages/work-journal"));
const JComputerTimetablePage = lazy(() => import("@/pages/jcomputer-timetable"));
const SmsCreditChargePage = lazy(() => import("@/pages/sms-credit-charge"));
const MathWrongNotesPage = lazy(() => import("@/pages/math-wrong-notes"));
const NewConsultationsPage = lazy(() => import("@/pages/new-consultations")); // 신규상담
import { Loader2, User, Settings, LogOut, Download, Smartphone } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from "@/components/ui/alert-dialog";
import { PWAInstallProvider, usePWAInstall } from "@/lib/pwa-install";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { NotificationBell } from "@/components/notification-bell";
import { HomeworkDueReminder } from "@/components/homework-due-reminder";
import { BusinessFooter } from "@/components/business-footer";
import { useActivityTracker } from "@/hooks/use-activity-tracker";
const logoUrl = "/default-sidebar-logo.png";

function ProtectedRoutes() {
  const { user, isLoading, logout, selectedCenter } = useAuth();
  const { canInstall, isInstalled, promptInstall, isIOS, showIOSInstructions, setShowIOSInstructions } = usePWAInstall();
  const { position: sidebarPosition } = useSidebarPosition();
  
  useActivityTracker();

  const [showPaymentNotice, setShowPaymentNotice] = useState(false);

  useEffect(() => {
    if (user && user.role === UserRole.PRINCIPAL) {
      const key = `tuition_payment_notice_seen_${user.id}`;
      if (!localStorage.getItem(key)) {
        setShowPaymentNotice(true);
      }
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // Kiosk users should only access the attendance pad
  if (user.role === UserRole.KIOSK) {
    return <Redirect to="/attendance-pad" />;
  }

  // Show consent dialog if user hasn't agreed yet
  const needsConsent = !user.consentAgreedAt;

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <>
      {needsConsent && <ConsentDialog />}
      {!needsConsent && <PushNotificationPrompt />}
      <AlertDialog open={showPaymentNotice} onOpenChange={(open) => {
        if (!open) {
          const key = `tuition_payment_notice_seen_${user.id}`;
          localStorage.setItem(key, "true");
        }
        setShowPaymentNotice(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl text-center">
              교육비 결제 기능 이용 가능!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-center">
              담당자에게 문의하세요!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction data-testid="button-close-payment-notice">확인</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <SidebarProvider style={sidebarStyle as React.CSSProperties}>
        <div className={`flex h-screen w-full ${sidebarPosition === "right" ? "flex-row-reverse" : ""}`}>
          <div className="hidden md:block">
            <AppSidebar side={sidebarPosition} />
          </div>
        <div className="flex flex-col flex-1 min-w-0">
          <header className="sticky top-0 z-40 flex items-center justify-between gap-2 p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <SidebarTrigger className="hidden md:flex" data-testid="button-sidebar-toggle" />
              <Link href="/" className="md:hidden flex-shrink-0">
                <img 
                  src={(() => {
                    const url = selectedCenter?.sidebarLogoUrl || logoUrl;
                    if (url && url !== logoUrl) {
                      const separator = url.includes('?') ? '&' : '?';
                      return `${url}${separator}v=${selectedCenter?.updatedAt || Date.now()}`;
                    }
                    return url;
                  })()} 
                  alt={selectedCenter?.name || "새결수학"} 
                  className="h-8 w-auto" 
                  data-testid="link-logo-home" 
                />
              </Link>
              <div className="md:hidden text-sm font-medium text-muted-foreground min-w-0 overflow-hidden">
                {user?.role !== undefined && user.role >= UserRole.TEACHER && <CenterSelector />}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="button-user-menu">
                    <User className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="end">
                  <div className="flex flex-col gap-1">
                    <Link href="/settings">
                      <button className="flex items-center gap-2 px-3 py-2 rounded-md text-sm w-full hover-elevate">
                        <Settings className="h-4 w-4" />
                        설정
                      </button>
                    </Link>
                    {!isInstalled && (
                      <button
                        onClick={promptInstall}
                        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm w-full hover-elevate text-primary"
                        data-testid="button-install-app"
                      >
                        <Smartphone className="h-4 w-4" />
                        홈 화면에 추가
                      </button>
                    )}
                    {isInstalled && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground">
                        <Download className="h-4 w-4" />
                        앱 설치됨
                      </div>
                    )}
                    <button
                      onClick={logout}
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm w-full hover-elevate text-destructive"
                      data-testid="button-logout-mobile"
                    >
                      <LogOut className="h-4 w-4" />
                      로그아웃
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </header>
          <main className="flex-1 overflow-auto flex flex-col">
            <div className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
              <HomeworkDueReminder />
              <Suspense fallback={
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              }>
              <Switch>
                <Route path="/" component={DashboardPage} />
                <Route path="/timetable" component={TimetablePage} />
                <Route path="/my-timetable" component={MyTimetablePage} />
                <Route path="/homework" component={HomeworkPage} />
                <Route path="/face-to-face-checks" component={FaceToFaceChecksPage} />
                <Route path="/assessments" component={AssessmentsPage} />
                <Route path="/videos" component={VideosPage} />
                <Route path="/video-sessions" component={VideoSessionsPage} />
                <Route path="/textbooks" component={TextbooksPage} />
                <Route path="/users" component={UsersPage} />
                <Route path="/centers" component={CentersPage} />
                <Route path="/clinic" component={ClinicPage} />
                <Route path="/attendance" component={AttendancePage} />
                <Route path="/class-notes" component={ClassNotesPage} />
                <Route path="/study-cafe" component={StudyCafePage} />
                <Route path="/tuition" component={TuitionPage} />
                <Route path="/payment-result" component={PaymentResultPage} />
                <Route path="/student-reports" component={StudentReportsPage} />
                <Route path="/todos" component={TodosPage} />
                <Route path="/manual" component={ManualPage} />
                <Route path="/management" component={ManagementPage} />
                <Route path="/academy-calendar" component={AcademyCalendarPage} />
                <Route path="/schedule" component={SchedulePage} />
                <Route path="/parent-portal" component={ParentPortalPage} />
                <Route path="/contact-parents" component={ContactParentsPage} />
                <Route path="/teacher-communication" component={TeacherCommunicationPage} />
                <Route path="/daily-notices" component={DailyNoticesPage} />
                <Route path="/feature-management" component={FeatureManagementPage} />
                <Route path="/presentation-videos" component={PresentationVideosPage} />
                <Route path="/exam-management" component={ExamManagementPage} />
                <Route path="/google-calendar-timetable" component={GoogleCalendarTimetablePage} />
                <Route path="/student-cumulative-data" component={StudentCumulativeDataPage} />
                <Route path="/supplementary" component={SupplementaryPage} />
                <Route path="/counseling" component={CounselingPage} />
                <Route path="/grade-trend" component={GradeTrendPage} />
                <Route path="/homework-completion" component={HomeworkCompletionPage} />
                <Route path="/attendance-status" component={AttendanceStatusPage} />
                <Route path="/school-grades" component={SchoolGradesPage} />
                <Route path="/textbook-progress" component={TextbookProgressPage} />
                <Route path="/jcomputer-timetable" component={JComputerTimetablePage} />
                <Route path="/work-journal" component={WorkJournalPage} />
                <Route path="/new-consultations" component={NewConsultationsPage} />
                <Route path="/semester-announcements" component={SemesterAnnouncementsPage} />
                <Route path="/sms-credit-charge" component={SmsCreditChargePage} />
                <Route path="/math-wrong-notes" component={MathWrongNotesPage} />
                <Route path="/settings" component={SettingsPage} />
                <Route component={NotFound} />
              </Switch>
              </Suspense>
            </div>
            <BusinessFooter />
          </main>
          <MobileNav />
        </div>
      </div>
      
      <Dialog open={showIOSInstructions} onOpenChange={setShowIOSInstructions}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>홈 화면에 추가하기 (iPhone)</DialogTitle>
            <DialogDescription>
              아래 안내에 따라 홈 화면에 앱을 추가해주세요
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <span className="font-bold text-primary shrink-0">1</span>
              <span>Safari 브라우저 하단의 <strong>공유 버튼</strong> (□↑)을 탭하세요</span>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <span className="font-bold text-primary shrink-0">2</span>
              <span>메뉴에서 <strong>"홈 화면에 추가"</strong>를 찾아 탭하세요</span>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <span className="font-bold text-primary shrink-0">3</span>
              <span>오른쪽 상단 <strong>"추가"</strong> 버튼을 탭하면 완료!</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SidebarPositionProvider>
            <PWAInstallProvider>
              <TooltipProvider>
                <Suspense fallback={
                  <div className="min-h-screen flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                }>
                <Switch>
                  <Route path="/attendance-pad" component={AttendancePadPage} />
                  <Route path="/center-registration" component={CenterRegistrationPage} />
                  <Route component={ProtectedRoutes} />
                </Switch>
                </Suspense>
                <Toaster />
              </TooltipProvider>
            </PWAInstallProvider>
          </SidebarPositionProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
