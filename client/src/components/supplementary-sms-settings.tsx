import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";

const DEFAULT_SMS = `[{학원명}] 보충수업 안내
학생: {학생명}
날짜: {날짜}
시간: {시작시간}~{종료시간}
강의실: {강의실}
사유: {사유}`;

const DEFAULT_REMINDER = `[{학원명}] 보충 수업 안내

학생: {학생명}
날짜: {날짜}
시간: {시작시간}~{종료시간}
강의실: {강의실}
선생님: {선생님}
사유: {사유}

내일 보충 수업이 있습니다. 참석 부탁드립니다.`;

const VARIABLES = ["{학원명}", "{학생명}", "{날짜}", "{시작시간}", "{종료시간}", "{강의실}", "{사유}", "{선생님}"];

export function SmsTemplateSettings({ centerId, actorId }: { centerId: string; actorId: string }) {
  const { toast } = useToast();
  const [smsTemplate, setSmsTemplate] = useState(DEFAULT_SMS);
  const [reminderSmsTemplate, setReminderSmsTemplate] = useState(DEFAULT_REMINDER);
  const [initializedForCenter, setInitializedForCenter] = useState<string | null>(null);

  const { data: templates, isLoading } = useQuery<{ smsTemplate: string; reminderSmsTemplate: string }>({
    queryKey: [`/api/centers/${centerId}/supplementary-sms-templates`],
    enabled: !!centerId,
  });

  useEffect(() => {
    if (centerId !== initializedForCenter) {
      setInitializedForCenter(null);
    }
  }, [centerId]);

  useEffect(() => {
    if (templates && initializedForCenter === null) {
      setSmsTemplate(templates.smsTemplate || DEFAULT_SMS);
      setReminderSmsTemplate(templates.reminderSmsTemplate || DEFAULT_REMINDER);
      setInitializedForCenter(centerId);
    }
  }, [templates, initializedForCenter, centerId]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/centers/${centerId}/supplementary-sms-templates`, {
        actorId,
        smsTemplate: smsTemplate.trim() || null,
        reminderSmsTemplate: reminderSmsTemplate.trim() || null,
      }),
    onSuccess: async () => {
      await invalidateQueriesStartingWith(`/api/centers/${centerId}/supplementary-sms-templates`);
      setInitializedForCenter(centerId);
      toast({ title: "문자 서식이 저장되었습니다" });
    },
    onError: () => {
      toast({ title: "저장에 실패했습니다", variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4" data-testid="sms-template-settings">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">사용 가능한 변수 (서식에 넣으면 실제 값으로 자동 치환)</p>
          <div className="flex flex-wrap gap-1.5">
            {VARIABLES.map(v => (
              <Badge key={v} variant="outline" className="text-xs font-mono">{v}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">보충 안내 문자 서식</Label>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setSmsTemplate(DEFAULT_SMS)}
              data-testid="button-reset-sms-template"
            >
              기본값으로
            </button>
          </div>
          <p className="text-xs text-muted-foreground">보충 등록 후 학부모에게 문자를 보낼 때 사용됩니다</p>
          <textarea
            value={smsTemplate}
            onChange={e => setSmsTemplate(e.target.value)}
            placeholder={DEFAULT_SMS}
            rows={6}
            style={{ resize: "vertical" }}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-testid="textarea-sms-template"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">전날 예약 문자 서식</Label>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setReminderSmsTemplate(DEFAULT_REMINDER)}
              data-testid="button-reset-reminder-template"
            >
              기본값으로
            </button>
          </div>
          <p className="text-xs text-muted-foreground">보충 전날 자동 발송되는 알림 문자에 사용됩니다</p>
          <textarea
            value={reminderSmsTemplate}
            onChange={e => setReminderSmsTemplate(e.target.value)}
            placeholder={DEFAULT_REMINDER}
            rows={8}
            style={{ resize: "vertical" }}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-testid="textarea-reminder-template"
          />
        </CardContent>
      </Card>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full"
        data-testid="button-save-templates"
      >
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
        서식 저장
      </Button>
    </div>
  );
}
