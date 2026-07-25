import { cn } from "@/lib/utils";

const STEPS = [0, 25, 50, 75, 100];

interface RateStepPickerProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  testIdPrefix?: string;
}

export function RateStepPicker({ value, onChange, className, testIdPrefix = "rate-step" }: RateStepPickerProps) {
  return (
    <div className={cn("px-1 py-2", className)}>
      <div className="relative flex items-center justify-between">
        <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-muted" />
        <div
          className="absolute left-2 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-primary transition-all"
          style={{ width: `calc((100% - 1rem) * ${value / 100})` }}
        />
        {STEPS.map((step) => {
          const isActive = value >= step;
          const isSelected = value === step;
          return (
            <button
              key={step}
              type="button"
              onClick={() => onChange(step)}
              className="relative z-10 flex h-8 w-8 items-center justify-center"
              aria-label={`${step}%`}
              data-testid={`${testIdPrefix}-${step}`}
            >
              <span
                className={cn(
                  "rounded-full transition-all",
                  isSelected ? "h-5 w-5 ring-2 ring-primary ring-offset-2 ring-offset-background" : "h-4 w-4",
                  isActive ? "bg-primary" : "bg-muted-foreground"
                )}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex items-center justify-between">
        {STEPS.map((step) => (
          <button
            key={step}
            type="button"
            onClick={() => onChange(step)}
            className={cn(
              "w-8 text-center text-xs",
              value === step ? "font-bold text-primary" : "text-muted-foreground"
            )}
            data-testid={`${testIdPrefix}-label-${step}`}
          >
            {step}%
          </button>
        ))}
      </div>
    </div>
  );
}
