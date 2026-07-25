import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface TeacherClassTabsProps {
  teacherViewTab: "my" | "assistant";
  onTabChange: (tab: "my" | "assistant") => void;
  ownCount: number;
  assistantCount: number;
}

export function TeacherClassTabs({ teacherViewTab, onTabChange, ownCount, assistantCount }: TeacherClassTabsProps) {
  if (assistantCount === 0) return null;

  return (
    <Tabs value={teacherViewTab} onValueChange={(v) => onTabChange(v as "my" | "assistant")}>
      <TabsList>
        <TabsTrigger value="my" data-testid="tab-my-classes">
          내 수업 ({ownCount})
        </TabsTrigger>
        <TabsTrigger value="assistant" data-testid="tab-assistant-classes">
          <Badge variant="outline" className="mr-1.5 border-orange-400 text-orange-600 dark:text-orange-400 text-[10px] h-4 px-1">부담임</Badge>
          부담임 수업 ({assistantCount})
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
