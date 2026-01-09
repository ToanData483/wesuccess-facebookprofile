"use client";

import { useState } from "react";
import { Calendar, X } from "lucide-react";

export type DateRange = "7d" | "30d" | "90d" | "6m" | "1y" | "all" | "custom";

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  customDateFrom?: string;
  customDateTo?: string;
  onCustomDateChange?: (from: string, to: string) => void;
  className?: string;
}

export const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "6m", label: "6 Months" },
  { value: "1y", label: "1 Year" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom Range" },
];

export function DateRangeFilter({
  value,
  onChange,
  customDateFrom = "",
  customDateTo = "",
  onCustomDateChange,
  className = "",
}: DateRangeFilterProps) {
  const [showCustomPicker, setShowCustomPicker] = useState(value === "custom");
  const [localFrom, setLocalFrom] = useState(customDateFrom);
  const [localTo, setLocalTo] = useState(customDateTo);

  const handleSelectChange = (newValue: DateRange) => {
    if (newValue === "custom") {
      setShowCustomPicker(true);
    } else {
      setShowCustomPicker(false);
    }
    onChange(newValue);
  };

  const handleApplyCustom = () => {
    if (localFrom && localTo) {
      onCustomDateChange?.(localFrom, localTo);
    }
  };

  const handleClearCustom = () => {
    setLocalFrom("");
    setLocalTo("");
    onCustomDateChange?.("", "");
    setShowCustomPicker(false);
    onChange("all");
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Calendar className="w-4 h-4 text-gray-400" />
      <select
        value={value}
        onChange={(e) => handleSelectChange(e.target.value as DateRange)}
        className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer"
      >
        {DATE_RANGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Custom Date Picker */}
      {showCustomPicker && (
        <div className="flex items-center gap-2 ml-2">
          <input
            type="date"
            value={localFrom}
            onChange={(e) => setLocalFrom(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            placeholder="From"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={localTo}
            onChange={(e) => setLocalTo(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            placeholder="To"
          />
          <button
            onClick={handleApplyCustom}
            disabled={!localFrom || !localTo}
            className="px-3 py-1 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Apply
          </button>
          <button
            onClick={handleClearCustom}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Clear custom range"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Show active custom range indicator */}
      {value === "custom" && customDateFrom && customDateTo && !showCustomPicker && (
        <span className="text-xs text-gray-500 ml-2">
          {customDateFrom} - {customDateTo}
        </span>
      )}
    </div>
  );
}

/**
 * Filter videos by date range
 * Facebook timestamps are in milliseconds
 */
export function filterVideosByDateRange<T extends { createTime: number }>(
  videos: T[],
  range: DateRange,
  customFrom?: string,
  customTo?: string
): T[] {
  if (range === "all") return videos;

  // Handle custom date range
  if (range === "custom" && customFrom && customTo) {
    const fromTime = new Date(customFrom).getTime();
    const toTime = new Date(customTo).setHours(23, 59, 59, 999); // End of day
    return videos.filter((video) => video.createTime >= fromTime && video.createTime <= toTime);
  }

  const now = Date.now();
  let cutoffDays: number;

  switch (range) {
    case "7d":
      cutoffDays = 7;
      break;
    case "30d":
      cutoffDays = 30;
      break;
    case "90d":
      cutoffDays = 90;
      break;
    case "6m":
      cutoffDays = 180;
      break;
    case "1y":
      cutoffDays = 365;
      break;
    default:
      return videos;
  }

  const cutoffTime = now - cutoffDays * 24 * 60 * 60 * 1000;
  return videos.filter((video) => video.createTime >= cutoffTime);
}

/**
 * Get date range label for display
 */
export function getDateRangeLabel(range: DateRange): string {
  const option = DATE_RANGE_OPTIONS.find((o) => o.value === range);
  return option?.label || "All Time";
}
