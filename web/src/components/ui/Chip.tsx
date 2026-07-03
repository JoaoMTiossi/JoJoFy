import type { ReactNode } from "react";

export function Chip({
  color = "#94a3b8",
  children,
  onRemove,
}: {
  color?: string;
  children: ReactNode;
  onRemove?: () => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 rounded-full hover:bg-black/20"
          aria-label="Remover"
        >
          ×
        </button>
      )}
    </span>
  );
}
