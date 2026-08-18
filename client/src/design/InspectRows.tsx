/**
 * InspectRows.tsx — Row primitives for the Inspect panel.
 *
 * Six building blocks: ColorRow, SwatchRow, PillRow, NumberRow, SelectRow, SwitchRow.
 * Every row uses a fixed 56px label gutter (real <label htmlFor>).
 * All tokens come from CSS variables — no hex literals.
 *
 * Token mapping from the reference HTML:
 *   --ip-chrome  → var(--background)
 *   --ip-raised  → var(--card)
 *   --ip-subtle  → var(--muted)
 *   --ip-hover   → var(--accent)
 *   --ip-track   → var(--accent)
 *   --ip-line        → var(--border)
 *   --ip-line-soft   → var(--border-soft)
 *   --ip-line-strong → var(--input)
 *   --ip-fg          → var(--foreground)
 *   --ip-fg-muted    → var(--muted-foreground)
 *   --ip-ink         → var(--primary)
 *   --ip-ink-fg      → var(--primary-foreground)
 *   --ip-accent      → var(--brand)
 *   --ip-accent-soft → var(--brand-soft)
 *   --ip-accent-fg   → var(--brand-strong)
 *   --ip-info        → var(--info)
 */

import { useId, useState, type ReactNode } from "react";

// ─── Mixed sentinel ───────────────────────────────────────────────────────────
export const MIXED = Symbol("mixed");
export type MixedValue<T> = T | typeof MIXED;

// ─── Shared geometry ──────────────────────────────────────────────────────────
// One constant so every row aligns without per-row overrides.
const GUTTER = 56; // px

// ─── Row shell ────────────────────────────────────────────────────────────────
/** Base row: 56px label gutter, control flex-1. */
export function IpRow({
  label,
  htmlFor,
  children,
  alignStart,
}: {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  alignStart?: boolean;
}) {
  return (
    <div
      className={`flex gap-[10px] ${alignStart ? "items-start" : "items-center"}`}
    >
      <label
        htmlFor={htmlFor}
        className="flex-none text-[12px] font-medium leading-[1.3] text-muted-foreground"
        style={{ width: GUTTER, paddingTop: alignStart ? 2 : 0 }}
      >
        {label}
      </label>
      <div className="flex-1 min-w-0 flex items-center gap-[6px]">{children}</div>
    </div>
  );
}

/** Group block with optional eyebrow label and note. */
export function IpGroup({
  eyebrow,
  note,
  children,
}: {
  eyebrow?: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="px-[14px] py-[14px] flex flex-col gap-[10px] border-t border-border-soft first:border-t-0">
      {eyebrow && (
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-bold tracking-[.11em] text-muted-foreground/60 uppercase"
          >
            {eyebrow}
          </span>
          {note && (
            <span className="text-[10px] text-muted-foreground/40 tracking-normal normal-case font-normal">
              {note}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Field shell ──────────────────────────────────────────────────────────────
/** 32px high field box used by ColorRow, NumberRow, SelectRow. */
export function IpField({
  children,
  width,
  className,
}: {
  children: ReactNode;
  width?: number | string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-[7px] px-[9px] bg-card border border-input rounded-[8px] focus-within:border-foreground focus-within:shadow-[0_0_0_3px_rgba(30,30,33,.06)] ${className ?? ""}`}
      style={{ height: 32, flex: width ? "none" : "1 1 0", minWidth: 0, width }}
    >
      {children}
    </div>
  );
}

// ─── ColorRow ────────────────────────────────────────────────────────────────
export interface ColorRowProps {
  id?: string;
  label: string;
  /** Hex string, "transparent", or MIXED */
  value: MixedValue<string>;
  opacity?: MixedValue<number>;
  onSwatchClick?: () => void;
}

export function ColorRow({ id, label, value, opacity = 100, onSwatchClick }: ColorRowProps) {
  const innerId = useId();
  const fieldId = id ?? innerId;
  const isMixed = value === MIXED;
  const isTransparent = !isMixed && value === "transparent";

  return (
    <IpRow label={label} htmlFor={fieldId}>
      <IpField>
        {/* 16px swatch */}
        <button
          type="button"
          id={fieldId}
          onClick={onSwatchClick}
          aria-label={
            isMixed ? "Fill: Mixed" : isTransparent ? "Fill: Transparent" : `Fill: ${value}`
          }
          style={{
            width: 16,
            height: 16,
            flexShrink: 0,
            borderRadius: 4,
            border: "1px solid rgba(20,20,24,.14)",
            padding: 0,
            cursor: "pointer",
            ...(isTransparent
              ? {
                  backgroundImage:
                    "linear-gradient(45deg,#dcdce2 25%,transparent 25% 75%,#dcdce2 75%),linear-gradient(45deg,#dcdce2 25%,transparent 25% 75%,#dcdce2 75%)",
                  backgroundSize: "8px 8px",
                  backgroundPosition: "0 0, 4px 4px",
                  backgroundColor: "#fff",
                }
              : { background: isMixed ? "linear-gradient(135deg,#ccc,#fff)" : value }),
          }}
        />
        {/* Hex value */}
        <span
          className={`flex-1 text-[12px] leading-none uppercase ${
            isMixed ? "italic text-muted-foreground/50 font-sans" : "font-mono text-foreground"
          }`}
        >
          {isMixed ? "Mixed" : isTransparent ? "None" : value}
        </span>
        {/* Opacity */}
        <span className="flex-none text-[10.5px] font-mono text-muted-foreground">
          {opacity === MIXED ? "—" : `${opacity}%`}
        </span>
      </IpField>
    </IpRow>
  );
}

// ─── SwatchRow ───────────────────────────────────────────────────────────────
export interface SwatchSpec {
  color: string; // hex or "transparent"
  label: string;
}

export interface SwatchRowProps {
  swatches: SwatchSpec[];
  active?: string; // currently selected hex
  suppressGrid?: boolean; // hidden in multi-select
  onSelect: (color: string) => void;
  onMore?: () => void;
}

export function SwatchRow({
  swatches,
  active,
  suppressGrid,
  onSelect,
  onMore,
}: SwatchRowProps) {
  if (suppressGrid) return null;
  return (
    <div
      className="flex flex-wrap gap-[6px]"
      role="group"
      aria-label="Project palette"
      style={{ paddingLeft: GUTTER + 10 }}
    >
      {swatches.map((s) => {
        const isActive = s.color === active;
        const isTransparent = s.color === "transparent";
        return (
          <button
            key={s.color}
            type="button"
            onClick={() => onSelect(s.color)}
            aria-label={`${s.label}`}
            aria-pressed={isActive}
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              border: "1px solid rgba(20,20,24,.12)",
              padding: 0,
              cursor: "pointer",
              boxShadow: isActive
                ? "0 0 0 2px var(--card), 0 0 0 3.5px var(--foreground)"
                : undefined,
              ...(isTransparent
                ? {
                    backgroundImage:
                      "linear-gradient(45deg,#dcdce2 25%,transparent 25% 75%,#dcdce2 75%),linear-gradient(45deg,#dcdce2 25%,transparent 25% 75%,#dcdce2 75%)",
                    backgroundSize: "8px 8px",
                    backgroundPosition: "0 0, 4px 4px",
                    backgroundColor: "#fff",
                  }
                : { background: s.color }),
            }}
          />
        );
      })}
      {onMore && (
        <button
          type="button"
          onClick={onMore}
          aria-label="More colors"
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            border: "1px dashed var(--input)",
            background: "none",
            color: "var(--muted-foreground)",
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          +
        </button>
      )}
    </div>
  );
}

// ─── PillRow ─────────────────────────────────────────────────────────────────
export interface PillOption {
  value: string;
  label: string;
}

export interface PillRowProps {
  id?: string;
  label?: string;
  options: PillOption[];
  value: MixedValue<string>;
  onChange: (value: string) => void;
}

export function PillRow({ id, label, options, value, onChange }: PillRowProps) {
  const innerId = useId();
  const groupId = id ?? innerId;

  const pills = (
    <div
      className="flex gap-[4px] flex-1"
      role="radiogroup"
      aria-label={label ?? groupId}
    >
      {options.map((opt) => {
        const isActive = value !== MIXED && value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            className="flex-1 text-[11.5px] font-medium transition-colors rounded-[6px] border"
            style={{
              height: 30,
              padding: "0 4px",
              background: isActive ? "var(--primary)" : "var(--card)",
              borderColor: isActive ? "var(--primary)" : "var(--input)",
              color: isActive ? "var(--primary-foreground)" : "var(--muted-foreground)",
              fontWeight: isActive ? 600 : 500,
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  if (!label) return pills;

  return (
    <IpRow label={label} htmlFor={groupId}>
      {pills}
    </IpRow>
  );
}

// ─── NumberRow ───────────────────────────────────────────────────────────────
export interface NumberRowProps {
  id?: string;
  label: string;
  /** prefix shown inside the field, e.g. "W", "H", "X", "GAP" */
  prefix?: string;
  value: MixedValue<number | undefined>;
  onChange: (v: number | undefined) => void;
  min?: number;
  /** When true, shows an AUTO chip that clears the value */
  showAuto?: boolean;
  suffix?: string;
}

export function NumberRow({
  id,
  label,
  prefix,
  value,
  onChange,
  min,
  showAuto,
  suffix,
}: NumberRowProps) {
  const innerId = useId();
  const inputId = id ?? innerId;
  const [draft, setDraft] = useState<string | null>(null);

  const isMixed = value === MIXED;
  const isAuto = !isMixed && (value == null || value === (undefined as any));

  const displayValue = (() => {
    if (draft !== null) return draft;
    if (isMixed) return "";
    if (isAuto) return "";
    return String(value);
  })();

  return (
    <IpRow label={label} htmlFor={inputId}>
      <IpField>
        {prefix && (
          <span
            className="flex-none text-[10.5px] font-mono font-semibold text-muted-foreground"
            style={{ cursor: showAuto ? undefined : "ew-resize", userSelect: "none" }}
            title={showAuto ? undefined : "Drag to scrub"}
          >
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          value={displayValue}
          placeholder={isMixed ? "Mixed" : isAuto ? "auto" : ""}
          aria-label={label}
          onChange={(e) => {
            setDraft(e.target.value);
            const raw = e.target.value;
            if (raw === "") return;
            const n = Number(raw);
            if (Number.isFinite(n) && (min == null || n >= min)) onChange(n);
          }}
          onBlur={(e) => {
            setDraft(null);
            if (e.target.value === "") onChange(undefined);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const step = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
              const cur = isMixed ? 0 : Number(value ?? 0);
              const next = +(cur + (e.key === "ArrowUp" ? step : -step)).toFixed(2);
              onChange(min != null ? Math.max(min, next) : next);
            }
          }}
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-[12.5px] font-mono text-foreground placeholder:text-muted-foreground/40"
        />
        {suffix && (
          <span className="flex-none text-[10.5px] font-mono text-muted-foreground">
            {suffix}
          </span>
        )}
        {showAuto && (
          <button
            type="button"
            aria-label={`${label} auto`}
            aria-pressed={isAuto}
            onClick={() => onChange(undefined)}
            className="flex-none text-[9px] font-mono font-semibold px-[5px] py-[3px] rounded-[4px] border transition-colors"
            style={
              isAuto
                ? {
                    background: "var(--brand-soft)",
                    borderColor: "var(--brand-soft)",
                    color: "var(--brand-strong)",
                  }
                : {
                    background: "none",
                    borderColor: "var(--input)",
                    color: "var(--muted-foreground)",
                  }
            }
          >
            AUTO
          </button>
        )}
      </IpField>
    </IpRow>
  );
}

// ─── SelectRow ───────────────────────────────────────────────────────────────
export interface SelectRowProps {
  id?: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  value: MixedValue<string>;
  onChange: (v: string) => void;
}

export function SelectRow({ id, label, options, value, onChange }: SelectRowProps) {
  const innerId = useId();
  const selectId = id ?? innerId;
  const isMixed = value === MIXED;

  return (
    <IpRow label={label} htmlFor={selectId}>
      <select
        id={selectId}
        value={isMixed ? "" : (value as string)}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 h-[32px] px-[9px] pr-[28px] bg-card border border-input rounded-[8px] text-[12.5px] font-medium text-foreground appearance-none cursor-pointer"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 9 6'><path d='M1 1l3.5 3.5L8 1' fill='none' stroke='%23a3a399' stroke-width='1.4' stroke-linecap='round'/></svg>")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 9px center",
        }}
      >
        {isMixed && (
          <option value="" disabled>
            Mixed
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </IpRow>
  );
}

// ─── SwitchRow ───────────────────────────────────────────────────────────────
export interface SwitchRowProps {
  id?: string;
  label: string;
  help?: string;
  value: MixedValue<boolean>;
  onChange: (v: boolean) => void;
  optional?: boolean;
}

export function SwitchRow({ id, label, help, value, onChange, optional }: SwitchRowProps) {
  const innerId = useId();
  const switchId = id ?? innerId;
  const helpId = help ? `${switchId}-help` : undefined;
  const isMixed = value === MIXED;
  const checked = !isMixed && !!value;

  return (
    <div className="flex items-start gap-[10px]">
      {/* Copy side */}
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium leading-[1.3] text-foreground">
          {label}
          {optional && (
            <span className="ml-[5px] text-[9.5px] font-normal text-muted-foreground/40">
              optional
            </span>
          )}
        </div>
        {help && (
          <div id={helpId} className="text-[11px] leading-[1.4] text-muted-foreground/50 mt-[1px]">
            {help}
          </div>
        )}
      </div>
      {/* Switch */}
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={isMixed ? "mixed" : checked}
        aria-describedby={helpId}
        onClick={() => onChange(isMixed ? true : !checked)}
        className="flex-none rounded-full transition-colors"
        style={{
          width: 38,
          height: 22,
          padding: 2,
          border: 0,
          background: checked ? "var(--primary)" : "var(--input)",
          display: "flex",
          alignItems: "center",
          justifyContent: checked ? "flex-end" : "flex-start",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            display: "block",
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 2px rgba(0,0,0,.07)",
          }}
        />
      </button>
    </div>
  );
}

// ─── IconPillRow ─────────────────────────────────────────────────────────────
/**
 * Icon-pill group row.  Each option carries a small currentColor SVG icon
 * beside its text label.  Active pills use the ink fill (var(--primary)),
 * inverting icons automatically.
 *
 * columns: 2 for 2- or 4-option groups (ip-g2), 3 for 3- or 5-option (ip-g3).
 */
export interface IconPillOption {
  value: string;
  label: string;
  /** Inline SVG path string(s) rendered at 14×14 with currentColor. */
  icon: React.ReactNode;
}

export interface IconPillRowProps {
  id?: string;
  label?: string;
  options: IconPillOption[];
  value: MixedValue<string>;
  onChange: (value: string) => void;
  /** Override grid columns (defaults to 2 for ≤2 or 4 options, 3 otherwise) */
  columns?: 2 | 3;
}

export function IconPillRow({ id, label, options, value, onChange, columns }: IconPillRowProps) {
  const innerId = useId();
  const groupId = id ?? innerId;
  const cols = columns ?? (options.length <= 2 || options.length === 4 ? 2 : 3);

  const pills = (
    <div
      role="radiogroup"
      aria-label={label ?? groupId}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 4,
        flex: 1,
      }}
    >
      {options.map((opt) => {
        const isActive = value !== MIXED && value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            data-label={opt.label}
            onClick={() => onChange(opt.value)}
            style={{
              height: 32,
              padding: "0 6px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              border: `1px solid ${isActive ? "var(--primary)" : "var(--input)"}`,
              borderRadius: 6,
              background: isActive ? "var(--primary)" : "var(--card)",
              color: isActive ? "var(--primary-foreground)" : "var(--muted-foreground)",
              fontSize: 11,
              fontWeight: isActive ? 600 : 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <span style={{ flex: "none", opacity: isActive ? 1 : 0.9, display: "flex" }} aria-hidden="true">
              {opt.icon}
            </span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  if (!label) return pills;

  return (
    <IpRow label={label} htmlFor={groupId}>
      {pills}
    </IpRow>
  );
}

// ─── JustifySelectRow ────────────────────────────────────────────────────────
/**
 * A SelectRow with a leading glyph that reflects the current justify value.
 * The glyph is a small SVG rendered at absolute-left of the select field.
 */
export interface JustifyOption {
  value: string;
  label: string;
}

/** Map a justify value to the correct <g> variant key in the glyph */
function justifyGlyphVariant(value: MixedValue<string>): string {
  if (value === MIXED) return "Center";
  const v = value as string;
  if (v === "start") return "Start";
  if (v === "end") return "End";
  if (v === "between") return "Space between";
  if (v === "around") return "Space around";
  return "Center";
}

export interface JustifySelectRowProps {
  id?: string;
  label: string;
  options: JustifyOption[];
  value: MixedValue<string>;
  onChange: (v: string) => void;
}

export function JustifySelectRow({ id, label, options, value, onChange }: JustifySelectRowProps) {
  const innerId = useId();
  const selectId = id ?? innerId;
  const isMixed = value === MIXED;
  const variant = justifyGlyphVariant(value);

  // All five glyph groups — only the matching one is visible via display
  const groups: Array<{ key: string; children: React.ReactNode }> = [
    {
      key: "Start",
      children: (
        <>
          <rect x="1" y="1" width="1.4" height="12" rx=".7" opacity=".5" />
          <rect x="4" y="3" width="3.2" height="8" rx="1" />
          <rect x="8.2" y="3" width="3.2" height="8" rx="1" />
        </>
      ),
    },
    {
      key: "Center",
      children: (
        <>
          <rect x="1.8" y="3" width="3.2" height="8" rx="1" />
          <rect x="9" y="3" width="3.2" height="8" rx="1" />
          <rect x="6.3" y="1" width="1.4" height="12" rx=".7" opacity=".5" />
        </>
      ),
    },
    {
      key: "End",
      children: (
        <>
          <rect x="11.6" y="1" width="1.4" height="12" rx=".7" opacity=".5" />
          <rect x="2.6" y="3" width="3.2" height="8" rx="1" />
          <rect x="6.8" y="3" width="3.2" height="8" rx="1" />
        </>
      ),
    },
    {
      key: "Space between",
      children: (
        <>
          <rect x="1" y="3" width="3.2" height="8" rx="1" />
          <rect x="9.8" y="3" width="3.2" height="8" rx="1" />
        </>
      ),
    },
    {
      key: "Space around",
      children: (
        <>
          <rect x="2" y="3" width="3.2" height="8" rx="1" />
          <rect x="8.8" y="3" width="3.2" height="8" rx="1" />
          <rect x="0" y="6" width="1" height="2" rx=".5" opacity=".4" />
          <rect x="13" y="6" width="1" height="2" rx=".5" opacity=".4" />
        </>
      ),
    },
  ];

  return (
    <IpRow label={label} htmlFor={selectId}>
      <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
        {/* Leading glyph — absolutely positioned inside the select wrapper */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="currentColor"
          aria-hidden="true"
          data-justify-glyph=""
          style={{
            position: "absolute",
            left: 9,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            color: "var(--muted-foreground)",
            zIndex: 1,
          }}
        >
          {groups.map((g) => (
            <g
              key={g.key}
              data-variant={g.key}
              style={{ display: g.key === variant ? "block" : "none" }}
            >
              {g.children}
            </g>
          ))}
        </svg>
        <select
          id={selectId}
          value={isMixed ? "" : (value as string)}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            height: 32,
            paddingLeft: 32,
            paddingRight: 28,
            paddingTop: 0,
            paddingBottom: 0,
            background: "var(--card)",
            border: "1px solid var(--input)",
            borderRadius: 8,
            fontSize: 12.5,
            fontWeight: 500,
            color: "var(--foreground)",
            appearance: "none",
            cursor: "pointer",
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 9 6'><path d='M1 1l3.5 3.5L8 1' fill='none' stroke='%23a3a399' stroke-width='1.4' stroke-linecap='round'/></svg>")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 9px center",
          }}
        >
          {isMixed && (
            <option value="" disabled>
              Mixed
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </IpRow>
  );
}

// ─── NumberPairRow ────────────────────────────────────────────────────────────
/** Two number fields sharing one row label (e.g. W/H or X/Y). */
export function NumberPairRow({
  label,
  a,
  b,
}: {
  label: string;
  a: Omit<NumberRowProps, "label">;
  b: Omit<NumberRowProps, "label">;
}) {
  const innerId = useId();
  return (
    <IpRow label={label} htmlFor={innerId}>
      <div className="flex gap-[6px] flex-1 min-w-0">
        <NumberFieldInline {...a} />
        <NumberFieldInline {...b} />
      </div>
    </IpRow>
  );
}

/** Inline number field (no label, just prefix+input+AUTO) — used inside NumberPairRow. */
function NumberFieldInline({
  prefix,
  value,
  onChange,
  min,
  showAuto,
  suffix,
}: Omit<NumberRowProps, "label" | "id">) {
  const [draft, setDraft] = useState<string | null>(null);
  const isMixed = value === MIXED;
  const isAuto = !isMixed && value == null;

  return (
    <IpField className="flex-1 min-w-0">
      {prefix && (
        <span
          className="flex-none text-[10.5px] font-mono font-semibold text-muted-foreground"
          style={{ cursor: "ew-resize", userSelect: "none" }}
          title="Drag to scrub"
        >
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        aria-label={prefix ? `${prefix} size` : undefined}
        value={
          draft !== null
            ? draft
            : isMixed
            ? ""
            : isAuto
            ? ""
            : String(value)
        }
        placeholder={isMixed ? "Mixed" : "auto"}
        onChange={(e) => {
          setDraft(e.target.value);
          const raw = e.target.value;
          if (raw === "") return;
          const n = Number(raw);
          if (Number.isFinite(n) && (min == null || n >= min)) onChange(n);
        }}
        onBlur={(e) => {
          setDraft(null);
          if (e.target.value === "") onChange(undefined);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const step = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
            const cur = isMixed ? 0 : Number(value ?? 0);
            const next = +(cur + (e.key === "ArrowUp" ? step : -step)).toFixed(2);
            onChange(min != null ? Math.max(min, next) : next);
          }
        }}
        className="flex-1 min-w-0 bg-transparent border-none outline-none text-[12.5px] font-mono text-foreground placeholder:text-muted-foreground/40"
      />
      {suffix && (
        <span className="flex-none text-[10.5px] font-mono text-muted-foreground">
          {suffix}
        </span>
      )}
      {showAuto && (
        <button
          type="button"
          aria-label={prefix ? `${prefix} auto` : "auto"}
          aria-pressed={isAuto}
          onClick={() => onChange(undefined)}
          className="flex-none text-[9px] font-mono font-semibold px-[5px] py-[3px] rounded-[4px] border transition-colors"
          style={
            isAuto
              ? {
                  background: "var(--brand-soft)",
                  borderColor: "var(--brand-soft)",
                  color: "var(--brand-strong)",
                }
              : {
                  background: "none",
                  borderColor: "var(--input)",
                  color: "var(--muted-foreground)",
                }
          }
        >
          AUTO
        </button>
      )}
    </IpField>
  );
}
