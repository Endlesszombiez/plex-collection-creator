"use client";

import { ReactNode } from "react";

interface AnalysisCardLayoutProps {
  /** Label text shown above the content box */
  label: string;
  /** Optional element shown on the right side of the label row */
  labelAction?: ReactNode;
  /** Main content area (bullet list, textarea, etc.) */
  children: ReactNode;
  /** Movie count for the item summary */
  movieCount: number;
  /** Show count for the item summary */
  showCount: number;
  /** Primary action button */
  actionButton: ReactNode;
  /** Optional expandable content below the button */
  expandableContent?: ReactNode;
}

export function AnalysisCardLayout({
  label,
  labelAction,
  children,
  movieCount,
  showCount,
  actionButton,
  expandableContent,
}: AnalysisCardLayoutProps) {
  const totalItems = movieCount + showCount;

  return (
    <div className="flex flex-col">
      {/* Content section */}
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-2 min-h-[20px]">
            <p className="text-sm font-medium text-white/70">{label}</p>
            {labelAction}
          </div>
          <div className="h-28">{children}</div>
        </div>
        <div className="flex items-center justify-end min-h-[16px]">
          <p className="text-xs text-white/30">
            {totalItems} items ({movieCount} movies, {showCount} shows)
          </p>
        </div>
      </div>

      {/* Actions section */}
      <div className="pt-4 flex flex-col gap-3">
        <div className="flex justify-end">{actionButton}</div>
        {expandableContent}
      </div>
    </div>
  );
}
