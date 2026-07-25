import { useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface StudentLike {
  id: string;
  name?: string | null;
  grade?: string | null;
}

export function StudentFilterPicker({
  students,
  selectedStudentId,
  onSelect,
  placeholder = "학생 이름 검색",
}: {
  students: StudentLike[];
  selectedStudentId: string | null;
  onSelect: (studentId: string | null) => void;
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");

  const selected = students.find((s) => s.id === selectedStudentId);

  if (selectedStudentId) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">학생:</span>
        <Badge variant="default" className="gap-1 pr-1" data-testid="badge-selected-student-filter">
          {selected?.name || "선택한 학생"}
          <button
            type="button"
            className="ml-1 rounded-full hover:bg-primary-foreground/20 p-0.5"
            onClick={() => {
              onSelect(null);
              setSearch("");
            }}
            data-testid="button-clear-student-filter"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      </div>
    );
  }

  const trimmed = search.trim();
  const sorted = [...students].sort((a, b) => (a.name || "").localeCompare(b.name || "", "ko"));
  const matches = trimmed
    ? sorted.filter((s) => (s.name || "").includes(trimmed))
    : sorted;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="pl-8 h-9"
          data-testid="input-student-filter-search"
        />
      </div>
      {trimmed && (
        <div className="max-h-40 overflow-y-auto border rounded-md p-1 space-y-0.5">
          {matches.map((s) => (
            <Button
              key={s.id}
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start h-8"
              onClick={() => {
                onSelect(s.id);
                setSearch("");
              }}
              data-testid={`button-student-filter-${s.id}`}
            >
              <span>{s.name}</span>
              {s.grade && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {s.grade}
                </Badge>
              )}
            </Button>
          ))}
          {matches.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">검색 결과가 없습니다</p>
          )}
        </div>
      )}
    </div>
  );
}
