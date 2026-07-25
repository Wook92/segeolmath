import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListTodo, CalendarDays } from "lucide-react";
import TodosPage from "./todos";
import AcademyCalendar from "./academy-calendar";

export default function SchedulePage() {
  const [activeTab, setActiveTab] = useState("todos");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold px-4 pt-4 md:px-6 md:pt-6">일정</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mx-4 md:mx-6">
          <TabsTrigger value="todos" data-testid="tab-todos">
            <ListTodo className="w-4 h-4 mr-2" />
            업무관리
          </TabsTrigger>
          <TabsTrigger value="calendar" data-testid="tab-calendar">
            <CalendarDays className="w-4 h-4 mr-2" />
            학원 캘린더
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="mt-4">
          <TodosPage />
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <AcademyCalendar />
        </TabsContent>
      </Tabs>
    </div>
  );
}
