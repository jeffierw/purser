import { useEffect, useId, useRef, useState } from 'react';

export type CargoOption = {
  value: string;
  symbol: string;
  name: string;
};

interface CargoSelectProps {
  value: string;
  options: CargoOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
}

export function CargoSelect({ value, options, onChange, ariaLabel }: CargoSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value.toLowerCase() === value.toLowerCase());

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={options.length === 0}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-md border border-white/15 bg-[#0F1622] px-3.5 py-3 text-left font-[family-name:var(--font-display)] text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[#C4973B]/70 focus-visible:border-[#D8AB4D] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="font-[family-name:var(--font-mono)] text-[13px] tracking-wide text-[#D8AB4D]">
            {selected?.symbol ?? 'Choose'}
          </span>
          <span className="truncate text-[#94A3B8]">{selected?.name ?? 'No cargo posted'}</span>
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-[#D8AB4D] transition ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-lg border border-[#C4973B]/40 bg-[#131A26] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
        >
          {options.map((option) => {
            const active = option.value.toLowerCase() === value.toLowerCase();
            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border-0 px-3 py-2.5 text-left font-[family-name:var(--font-display)] transition ${
                    active
                      ? 'bg-[#C4973B]/15 text-white'
                      : 'bg-transparent text-[#E2E8F0] hover:bg-white/10'
                  }`}
                >
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="font-[family-name:var(--font-mono)] text-[13px] text-[#D8AB4D]">
                      {option.symbol}
                    </span>
                    <span className="truncate text-sm text-[#94A3B8]">{option.name}</span>
                  </span>
                  {active ? (
                    <span className="shrink-0 text-[11px] tracking-[0.14em] text-[#34D399]">SELECTED</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
