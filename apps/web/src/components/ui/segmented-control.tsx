import { cn } from "@/lib/cn";

interface SegmentedOption<TValue extends string> {
  value: TValue;
  label: string;
}

interface SegmentedControlProps<TValue extends string> {
  options: Array<SegmentedOption<TValue>>;
  selected: TValue;
  onChange: (value: TValue) => void;
}

export function SegmentedControl<TValue extends string>({
  options,
  selected,
  onChange,
}: SegmentedControlProps<TValue>) {
  return (
    <div className="segmented-control" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={selected === option.value}
          className={cn(
            "segmented-control-item",
            selected === option.value && "is-active",
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
