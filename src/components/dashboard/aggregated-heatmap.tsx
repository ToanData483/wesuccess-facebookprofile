"use client";

import { useMemo, useState } from "react";
import { X, ExternalLink } from "lucide-react";
import type { PostingActivity, HeatmapPost } from "./dashboard-view";

// Selected cell info for popup
interface SelectedCell {
  dayIdx: number;
  hourIdx: number;
  dayLabel: string;
  posts: HeatmapPost[];
}

interface AggregatedHeatmapProps {
  data: PostingActivity;
}

const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => i);

// Time ranges for density classification
const TIME_RANGES = [
  { name: "Đêm", start: 0, end: 5, emoji: "🌙", color: "bg-indigo-100 text-indigo-700" },
  { name: "Sáng sớm", start: 6, end: 8, emoji: "🌅", color: "bg-orange-100 text-orange-700" },
  { name: "Sáng", start: 9, end: 11, emoji: "☀️", color: "bg-yellow-100 text-yellow-700" },
  { name: "Trưa", start: 12, end: 13, emoji: "🌞", color: "bg-amber-100 text-amber-700" },
  { name: "Chiều", start: 14, end: 17, emoji: "🌤️", color: "bg-sky-100 text-sky-700" },
  { name: "Tối", start: 18, end: 20, emoji: "🌆", color: "bg-purple-100 text-purple-700" },
  { name: "Khuya", start: 21, end: 23, emoji: "🌃", color: "bg-slate-100 text-slate-700" },
];

export function AggregatedHeatmap({ data }: AggregatedHeatmapProps) {
  const { grid, profileGrid, maxValue, totalPosts } = data;
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);

  // Calculate thresholds for color scaling (percentile-based)
  const thresholds = useMemo(() => {
    const values = grid.flat().filter((v) => v > 0).sort((a, b) => a - b);
    if (values.length === 0) return { p25: 0, p50: 0, p75: 0, p90: 0 };

    const p25 = values[Math.floor(values.length * 0.25)] || 0;
    const p50 = values[Math.floor(values.length * 0.5)] || 0;
    const p75 = values[Math.floor(values.length * 0.75)] || 0;
    const p90 = values[Math.floor(values.length * 0.9)] || maxValue;

    return { p25, p50, p75, p90 };
  }, [grid, maxValue]);

  // Get color based on value (percentile-based)
  const getHeatmapColor = (value: number): string => {
    if (value === 0) return "#F1F5F9"; // Slate 100 - empty
    if (value <= thresholds.p25) return "#DBEAFE"; // Blue 100 - Low
    if (value <= thresholds.p50) return "#93C5FD"; // Blue 300 - Medium
    if (value <= thresholds.p75) return "#3B82F6"; // Blue 500 - High
    if (value <= thresholds.p90) return "#1D4ED8"; // Blue 700 - Very High
    return "#1E40AF"; // Blue 800 - Peak
  };

  // Get label for tooltip
  const getHeatmapLabel = (value: number): string => {
    if (value === 0) return "Không có";
    if (value <= thresholds.p25) return "Thấp";
    if (value <= thresholds.p50) return "Trung bình";
    if (value <= thresholds.p75) return "Cao";
    return "Rất cao";
  };

  // Find best posting time
  const bestTime = useMemo(() => {
    let maxVal = 0;
    let bestDay = 0;
    let bestHour = 0;

    grid.forEach((row, d) => {
      row.forEach((val, h) => {
        if (val > maxVal) {
          maxVal = val;
          bestDay = d;
          bestHour = h;
        }
      });
    });

    return { day: DAY_LABELS[bestDay], hour: bestHour, count: maxVal };
  }, [grid]);

  // Count active slots
  const activeSlots = useMemo(() => {
    return grid.flat().filter((v) => v > 0).length;
  }, [grid]);

  // Calculate density by time range
  const timeRangeDensity = useMemo(() => {
    return TIME_RANGES.map((range) => {
      let totalPosts = 0;
      let activeCells = 0;
      const totalCells = (range.end - range.start + 1) * 7; // hours * days

      for (let d = 0; d < 7; d++) {
        for (let h = range.start; h <= range.end; h++) {
          const value = grid[d][h];
          totalPosts += value;
          if (value > 0) activeCells++;
        }
      }

      return {
        ...range,
        totalPosts,
        activeCells,
        totalCells,
        density: totalCells > 0 ? (activeCells / totalCells) * 100 : 0,
        avgPosts: activeCells > 0 ? totalPosts / activeCells : 0,
      };
    }).sort((a, b) => b.totalPosts - a.totalPosts);
  }, [grid]);

  // Group posts by profile for selected cell
  const profilePostCounts = useMemo(() => {
    if (!selectedCell) return [];

    const countMap = new Map<string, { profile: HeatmapPost; count: number }>();
    selectedCell.posts.forEach((post) => {
      const existing = countMap.get(post.profileId);
      if (existing) {
        existing.count++;
      } else {
        countMap.set(post.profileId, { profile: post, count: 1 });
      }
    });

    return Array.from(countMap.values()).sort((a, b) => b.count - a.count);
  }, [selectedCell]);

  // Handle cell click
  const handleCellClick = (dayIdx: number, hourIdx: number, dayLabel: string) => {
    const posts = profileGrid[dayIdx][hourIdx];
    if (posts.length === 0) return;

    setSelectedCell({ dayIdx, hourIdx, dayLabel, posts });
  };

  // Empty state
  if (totalPosts === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          🔥 Posting Activity Heatmap
        </h3>
        <div className="text-center py-8 text-gray-500">
          Chưa có dữ liệu posting activity
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      {/* Header with legend */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            🔥 Posting Activity Heatmap
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Tổng hợp từ tất cả profiles - {totalPosts.toLocaleString()} posts
          </p>
        </div>

        {/* Color Legend */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400">Ít</span>
          <div className="flex gap-0.5">
            {["#F1F5F9", "#DBEAFE", "#93C5FD", "#3B82F6", "#1D4ED8", "#1E40AF"].map(
              (color, i) => (
                <div
                  key={i}
                  className="w-4 h-4 rounded-sm"
                  style={{ backgroundColor: color }}
                />
              )
            )}
          </div>
          <span className="text-gray-400">Nhiều</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="w-full">
        {/* Hour labels (X-axis) - Full 0-23 */}
        <div className="flex items-center mb-1">
          <div className="w-8 shrink-0" />
          <div className="flex-1 flex">
            {HOUR_LABELS.map((hour) => (
              <div
                key={hour}
                className="flex-1 text-[9px] text-gray-400 text-center font-medium"
              >
                {hour}
              </div>
            ))}
          </div>
        </div>

        {/* Grid rows */}
        {DAY_LABELS.map((dayLabel, dayIdx) => (
          <div key={dayIdx} className="flex items-center">
            {/* Day label */}
            <div className="w-8 shrink-0 text-xs text-gray-500 font-medium text-right pr-2">
              {dayLabel}
            </div>

            {/* Hour cells */}
            <div className="flex-1 flex">
              {grid[dayIdx].map((value, hourIdx) => {
                const posts = profileGrid[dayIdx][hourIdx];
                // Get unique profiles for this cell
                const uniqueProfiles = posts.reduce((acc, post) => {
                  if (!acc.find((p) => p.profileId === post.profileId)) {
                    acc.push(post);
                  }
                  return acc;
                }, [] as HeatmapPost[]);

                return (
                  <div
                    key={hourIdx}
                    className="flex-1 h-7 mx-[1px] rounded-sm transition-all duration-150 hover:scale-y-110 cursor-pointer flex items-center justify-center relative group"
                    style={{ backgroundColor: getHeatmapColor(value) }}
                    title={`${dayLabel} ${hourIdx}:00 → ${value} post(s) - Click để xem chi tiết`}
                    onClick={() => handleCellClick(dayIdx, hourIdx, dayLabel)}
                  >
                    {/* Show avatars for cells with posts */}
                    {value > 0 && uniqueProfiles.length > 0 && (
                      <div className="flex -space-x-1.5">
                        {uniqueProfiles.slice(0, 3).map((profile, idx) => (
                          <div
                            key={`${profile.profileId}-${idx}`}
                            className="w-5 h-5 rounded-full border border-white overflow-hidden bg-gray-200 flex-shrink-0"
                          >
                            {profile.avatar ? (
                              <img
                                src={profile.avatar}
                                alt={profile.nickname}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-[#1877F2] flex items-center justify-center text-white text-[8px] font-bold">
                                {profile.nickname.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        ))}
                        {uniqueProfiles.length > 3 && (
                          <div className="w-5 h-5 rounded-full border border-white bg-gray-500 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">
                            +{uniqueProfiles.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Show count badge if multiple posts */}
                    {value > 1 && (
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center text-white text-[8px] font-bold z-10">
                        {value}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Stats footer */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
        <div>
          <span className="text-gray-500">Total: </span>
          <span className="font-semibold text-gray-700">
            {totalPosts.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Peak: </span>
          <span className="font-semibold text-red-500">{maxValue}</span>
        </div>
        <div>
          <span className="text-gray-500">Best: </span>
          <span className="font-semibold text-green-600">
            {bestTime.day} {bestTime.hour}:00
          </span>
        </div>
        <div>
          <span className="text-gray-500">Active: </span>
          <span className="font-semibold text-sky-600">{activeSlots}/168</span>
        </div>
      </div>

      {/* Time Range Density Analysis */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          📊 Mật độ theo khung giờ
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {timeRangeDensity.slice(0, 4).map((range, idx) => (
            <div
              key={range.name}
              className={`px-3 py-2 rounded-lg ${range.color} relative overflow-hidden`}
            >
              {idx === 0 && (
                <div className="absolute top-1 right-1 text-[10px] bg-white/60 px-1.5 py-0.5 rounded-full font-bold">
                  🏆 Top
                </div>
              )}
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-base">{range.emoji}</span>
                <span className="font-semibold text-sm">{range.name}</span>
              </div>
              <div className="text-xs opacity-80">
                {range.start}:00 - {range.end}:59
              </div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-lg font-bold">{range.totalPosts}</span>
                <span className="text-xs opacity-70">posts</span>
              </div>
              <div className="text-[10px] opacity-60 mt-0.5">
                {range.density.toFixed(0)}% coverage
              </div>
            </div>
          ))}
        </div>

        {/* Remaining ranges in smaller format */}
        {timeRangeDensity.length > 4 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {timeRangeDensity.slice(4).map((range) => (
              <div
                key={range.name}
                className={`px-2 py-1 rounded-md text-xs ${range.color} inline-flex items-center gap-1`}
              >
                <span>{range.emoji}</span>
                <span className="font-medium">{range.name}</span>
                <span className="opacity-70">({range.totalPosts})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cell Detail Popup */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSelectedCell(null)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  📅 {selectedCell.dayLabel} - {selectedCell.hourIdx}:00
                </h3>
                <p className="text-sm text-gray-500">
                  {selectedCell.posts.length} bài đăng từ {profilePostCounts.length} profile
                </p>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {/* Profile summary */}
              <div className="flex flex-wrap gap-2 mb-4 pb-3 border-b border-gray-100">
                {profilePostCounts.map(({ profile, count }) => (
                  <div
                    key={profile.profileId}
                    className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-full text-xs"
                  >
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                      {profile.avatar ? (
                        <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#1877F2] flex items-center justify-center text-white text-[8px] font-bold">
                          {profile.nickname.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="font-medium text-gray-700">{profile.nickname}</span>
                    <span className="text-gray-500">({count})</span>
                  </div>
                ))}
              </div>

              {/* Individual posts list */}
              <div className="space-y-2">
                {selectedCell.posts.map((post, idx) => (
                  <a
                    key={`${post.postId}-${idx}`}
                    href={post.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors group"
                  >
                    {/* Thumbnail */}
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                      {post.thumbnail ? (
                        <img
                          src={post.thumbnail}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xl">
                          📝
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                          {post.avatar ? (
                            <img src={post.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-[#1877F2] flex items-center justify-center text-white text-[8px] font-bold">
                              {post.nickname.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {post.nickname}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {post.caption || "Không có caption"}
                      </p>
                    </div>

                    {/* External link icon */}
                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExternalLink className="w-4 h-4 text-blue-500" />
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setSelectedCell(null)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
