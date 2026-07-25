import { cn } from "@/lib/utils";

interface CompletionIndicatorProps {
  rate: number;
  showEmoji?: boolean;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

const getCompletionConfig = (rate: number) => {
  if (rate >= 80) return { color: "bg-blue-500", emoji: "excellent", textColor: "text-blue-600 dark:text-blue-400" };
  if (rate >= 60) return { color: "bg-green-500", emoji: "good", textColor: "text-green-600 dark:text-green-400" };
  if (rate >= 40) return { color: "bg-yellow-500", emoji: "normal", textColor: "text-yellow-600 dark:text-yellow-400" };
  if (rate >= 20) return { color: "bg-orange-500", emoji: "poor", textColor: "text-orange-600 dark:text-orange-400" };
  return { color: "bg-red-500", emoji: "bad", textColor: "text-red-600 dark:text-red-400" };
};

const sizeClasses = {
  sm: "h-1.5",
  md: "h-2",
  lg: "h-3",
};

export function CompletionIndicator({ rate, showEmoji = false, showLabel = false, size = "md" }: CompletionIndicatorProps) {
  const config = getCompletionConfig(rate);

  const getLabel = (rate: number) => {
    if (rate >= 80) return "우수";
    if (rate >= 60) return "양호";
    if (rate >= 40) return "보통";
    if (rate >= 20) return "미흡";
    return "부족";
  };

  return (
    <div className="flex items-center gap-2">
      <div className={cn("flex-1 bg-muted rounded-full overflow-hidden", sizeClasses[size])}>
        <div
          className={cn("h-full rounded-full transition-all duration-300", config.color)}
          style={{ width: `${rate}%` }}
        />
      </div>
      <span className={cn("text-sm font-medium tabular-nums", config.textColor)} data-testid="text-completion-rate">
        {rate}%{showLabel && ` (${getLabel(rate)})`}
      </span>
      {showEmoji && (
        <span className="text-lg" data-testid="emoji-completion">
          {config.emoji === "excellent" && ""}
          {config.emoji === "good" && ""}
          {config.emoji === "normal" && ""}
          {config.emoji === "poor" && ""}
          {config.emoji === "bad" && ""}
        </span>
      )}
    </div>
  );
}

export function CompletionDot({ rate }: { rate: number }) {
  const config = getCompletionConfig(rate);
  return (
    <div
      className={cn("w-2 h-2 rounded-full", config.color)}
      title={`${rate}%`}
      data-testid="dot-completion"
    />
  );
}
