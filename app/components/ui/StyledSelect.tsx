"use client";

import { useEffect, useRef, useState } from "react";

interface StyledSelectOption {
  value: string;
  label: string;
}

interface StyledSelectProps {
  options: StyledSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function StyledSelect({ options, value, onChange, placeholder }: StyledSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div ref={wrapperRef} className="relative z-50">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 transition-colors hover:border-slate-300"
      >
        <span>{selectedOption?.label ?? placeholder ?? "Velg"}</span>
        <span className={`text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open ? (
        <div className="absolute top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`block w-full cursor-pointer px-4 py-3 text-left text-sm hover:bg-slate-50 ${
                  isSelected ? "bg-slate-50 font-medium text-[#3b5bdb]" : "text-slate-700"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
