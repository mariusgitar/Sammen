"use client";

interface ToggleOption {
  value: string;
  label: string;
  helper?: string;
}

interface ToggleButtonProps {
  options: ToggleOption[];
  value: string;
  onChange: (value: string) => void;
}

export default function ToggleButton({ options, value, onChange }: ToggleButtonProps) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className="space-y-2">
      <div className="relative flex gap-1 rounded-xl bg-slate-100 p-1">
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 rounded-lg bg-white shadow-sm transition-all duration-200"
          style={{
            width: `calc((100% - ${(options.length + 1) * 0.25}rem) / ${options.length})`,
            left: `calc(${selectedIndex} * ((100% - ${(options.length + 1) * 0.25}rem) / ${options.length}) + ${(selectedIndex + 1) * 0.25}rem)`,
          }}
        />

        {options.map((option) => {
          const isActive = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`relative z-10 flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? "text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {selectedOption?.helper ? (
        <p className="text-sm text-slate-500">{selectedOption.helper}</p>
      ) : null}
    </div>
  );
}
