"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { AggregatedProfile } from "./dashboard-view";

interface PerformanceChartsProps {
  profiles: AggregatedProfile[];
  contentMix: {
    reels: number;
    videos: number;
    photos: number;
    text: number;
  };
}

// Colors for content mix pie chart
const CONTENT_COLORS = {
  reels: "#E1306C",    // Instagram pink for Reels
  videos: "#1877F2",   // Facebook blue for Videos
  photos: "#10B981",   // Green for Photos
  text: "#6B7280",     // Gray for Text
};

// Colors for stacked bar chart
const INTERACTION_COLORS = {
  likes: "#E1306C",     // Pink for Likes
  comments: "#1877F2",  // Blue for Comments
  shares: "#10B981",    // Green for Shares
};

// Format percentage
function formatPercent(value: number, total: number): string {
  if (total === 0) return "0%";
  return ((value / total) * 100).toFixed(1) + "%";
}

// Format large numbers
function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

export function PerformanceCharts({ profiles, contentMix }: PerformanceChartsProps) {
  // Prepare interactions data for stacked bar chart
  const interactionsData = useMemo(() => {
    return profiles
      .map((p) => ({
        name: p.nickname,
        username: p.username,
        avatar: p.avatar,
        likes: p.likes || 0,
        comments: p.comments || 0,
        shares: p.shares || 0,
        total: (p.likes || 0) + (p.comments || 0) + (p.shares || 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10); // Top 10
  }, [profiles]);

  // Prepare content mix data for pie chart
  const contentMixData = useMemo(() => {
    const total = contentMix.reels + contentMix.videos + contentMix.photos + contentMix.text;
    return [
      { name: "Reels", value: contentMix.reels, color: CONTENT_COLORS.reels, percent: formatPercent(contentMix.reels, total) },
      { name: "Videos", value: contentMix.videos, color: CONTENT_COLORS.videos, percent: formatPercent(contentMix.videos, total) },
      { name: "Photos", value: contentMix.photos, color: CONTENT_COLORS.photos, percent: formatPercent(contentMix.photos, total) },
      { name: "Text", value: contentMix.text, color: CONTENT_COLORS.text, percent: formatPercent(contentMix.text, total) },
    ].filter((d) => d.value > 0);
  }, [contentMix]);

  const totalContent = contentMix.reels + contentMix.videos + contentMix.photos + contentMix.text;

  // Custom tooltip for stacked bar chart
  const StackedBarTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number; color: string; payload: { name: string; username: string; avatar: string; likes: number; comments: number; shares: number; total: number } }[] }) => {
    if (!active || !payload || !payload[0]) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-white px-3 py-2 shadow-lg rounded-lg border border-gray-200">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
          {data.avatar ? (
            <img src={data.avatar} alt={data.name} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#1877F2] flex items-center justify-center text-white text-xs font-bold">
              {data.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-900">{data.name}</p>
            <p className="text-xs text-gray-500">@{data.username}</p>
          </div>
        </div>
        <div className="space-y-0.5 text-xs">
          <p><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: INTERACTION_COLORS.likes }} />Likes: {formatNumber(data.likes)}</p>
          <p><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: INTERACTION_COLORS.comments }} />Comments: {formatNumber(data.comments)}</p>
          <p><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: INTERACTION_COLORS.shares }} />Shares: {formatNumber(data.shares)}</p>
          <p className="font-medium pt-1 border-t border-gray-100">Total: {formatNumber(data.total)}</p>
        </div>
      </div>
    );
  };

  // Custom tooltip for pie chart
  const PieTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { percent: string } }[] }) => {
    if (!active || !payload || !payload[0]) return null;
    return (
      <div className="bg-white px-3 py-2 shadow-lg rounded-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-900">{payload[0].name}</p>
        <p className="text-sm text-gray-600">
          {payload[0].value.toLocaleString()} posts ({payload[0].payload.percent})
        </p>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Interactions Stacked Bar Chart */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          📊 Interactions by Profile
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Likes + Comments + Shares
        </p>

        {interactionsData.length > 0 ? (
          <div className="space-y-4">
            {/* Legend */}
            <div className="flex items-center justify-end gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: INTERACTION_COLORS.likes }} />
                <span className="text-gray-600">Likes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: INTERACTION_COLORS.comments }} />
                <span className="text-gray-600">Comments</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: INTERACTION_COLORS.shares }} />
                <span className="text-gray-600">Shares</span>
              </div>
            </div>
            {/* Custom bar list with avatars */}
            <div className="space-y-3">
              {interactionsData.map((item) => {
                const maxTotal = interactionsData[0]?.total || 1;
                const likesWidth = (item.likes / maxTotal) * 100;
                const commentsWidth = (item.comments / maxTotal) * 100;
                const sharesWidth = (item.shares / maxTotal) * 100;

                return (
                  <div key={item.username} className="space-y-1.5">
                    {/* Profile info row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {item.avatar ? (
                          <img
                            src={item.avatar}
                            alt={item.name}
                            className="w-8 h-8 rounded-full object-cover border border-gray-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#1877F2] flex items-center justify-center text-white text-xs font-bold">
                            {item.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm text-gray-800 font-medium">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-700">
                        {formatNumber(item.total)}
                      </span>
                    </div>
                    {/* Stacked bar */}
                    <div className="h-7 bg-gray-100 rounded-lg overflow-hidden flex">
                      {item.likes > 0 && (
                        <div
                          className="h-full transition-all hover:opacity-80"
                          style={{ width: `${likesWidth}%`, backgroundColor: INTERACTION_COLORS.likes }}
                          title={`Likes: ${formatNumber(item.likes)}`}
                        />
                      )}
                      {item.comments > 0 && (
                        <div
                          className="h-full transition-all hover:opacity-80"
                          style={{ width: `${commentsWidth}%`, backgroundColor: INTERACTION_COLORS.comments }}
                          title={`Comments: ${formatNumber(item.comments)}`}
                        />
                      )}
                      {item.shares > 0 && (
                        <div
                          className="h-full transition-all hover:opacity-80"
                          style={{ width: `${sharesWidth}%`, backgroundColor: INTERACTION_COLORS.shares }}
                          title={`Shares: ${formatNumber(item.shares)}`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-gray-400">
            Chưa có dữ liệu interactions
          </div>
        )}
      </div>

      {/* Content Mix Pie Chart */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          🎨 Content Mix
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Phân bổ loại nội dung - {totalContent.toLocaleString()} posts
        </p>

        {contentMixData.length > 0 ? (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={contentMixData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                  label={false}
                >
                  {contentMixData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value, entry) => {
                    const item = contentMixData.find((d) => d.name === value);
                    return (
                      <span className="text-xs text-gray-600">
                        {value} {item ? `(${item.percent})` : ""}
                      </span>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-gray-400">
            Chưa có dữ liệu content
          </div>
        )}

        {/* Content stats */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-100">
          {[
            { label: "Reels", value: contentMix.reels, color: CONTENT_COLORS.reels },
            { label: "Videos", value: contentMix.videos, color: CONTENT_COLORS.videos },
            { label: "Photos", value: contentMix.photos, color: CONTENT_COLORS.photos },
            { label: "Text", value: contentMix.text, color: CONTENT_COLORS.text },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div
                className="text-lg font-semibold"
                style={{ color: item.color }}
              >
                {item.value.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
