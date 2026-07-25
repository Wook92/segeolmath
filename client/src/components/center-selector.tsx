import { Building2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";

// Sort centers with priority centers at top (프라임수학 centers fixed at top)
function sortCentersWithPriority(centers: any[]) {
  // Priority keywords - centers containing these will be sorted to top
  const priorityKeywords = ["프라임수학 (DMC센터)", "프라임수학 (목동센터)", "DMC센터", "목동센터"];
  
  const getPriorityIndex = (name: string) => {
    for (let i = 0; i < priorityKeywords.length; i++) {
      if (name.includes(priorityKeywords[i])) return i;
    }
    return -1;
  };
  
  return [...centers].sort((a, b) => {
    const aIndex = getPriorityIndex(a.name);
    const bIndex = getPriorityIndex(b.name);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.name.localeCompare(b.name, 'ko');
  });
}

export function CenterSelector() {
  const { centers, selectedCenter, selectCenter } = useAuth();
  const sortedCenters = sortCentersWithPriority(centers);

  if (sortedCenters.length <= 1) {
    return (
      <div className="flex items-start gap-2 px-2 py-1 text-sm text-muted-foreground max-w-full">
        <Building2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span className="leading-tight break-words">{selectedCenter?.name || "센터 없음"}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-1 h-auto py-1 px-2 max-w-full" data-testid="button-center-selector">
          <Building2 className="h-4 w-4 flex-shrink-0 self-start mt-0.5" />
          <span className="leading-tight text-left break-words whitespace-normal">{selectedCenter?.name || "센터 선택"}</span>
          <ChevronDown className="h-4 w-4 flex-shrink-0 self-start mt-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {sortedCenters.map((center) => (
          <DropdownMenuItem
            key={center.id}
            onClick={() => selectCenter(center)}
            className={selectedCenter?.id === center.id ? "bg-accent" : ""}
            data-testid={`menu-item-center-${center.id}`}
          >
            {center.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
