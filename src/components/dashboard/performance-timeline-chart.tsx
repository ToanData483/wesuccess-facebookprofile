"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { TrendingUp, ExternalLink } from "lucide-react";
import type { ChannelProject, ChannelData } from "@/lib/types/channel-project";

// Profile timeline data - per-post (not cumulative)
interface ProfileTimeline {
  id: string;
  nickname: string;
  avatar: string;
  color: string;
  totalInteractions: number;
  postCount: number;
  avgInteractions: number;
  postData: { timestamp: number; value: number; postId: string; caption: string; postUrl: string }[];
}

interface PerformanceTimelineChartProps {
  projects: ChannelProject[];
  channelDataMap: Record<string, ChannelData | null>;
}

// Profile colors
const PROFILE_COLORS = [
  "#3B82F6", "#F97316", "#10B981", "#EF4444",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F59E0B",
];

export function PerformanceTimelineChart({
  projects,
  channelDataMap,
}: PerformanceTimelineChartProps) {
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());
  const [hoveredPoint, setHoveredPoint] = useState<{
    profile: ProfileTimeline;
    point: { timestamp: number; value: number; postId: string; caption: string; postUrl: string };
    pointIndex: number;
  } | null>(null);

  // Chart dimensions
  const CHART_WIDTH = 900;
  const CHART_HEIGHT = 230;
  const PADDING = { top: 20, right: 15, bottom: 35, left: 45 };
  const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  // Build timeline data - PER POST (not cumulative)
  const profileTimelines = useMemo((): ProfileTimeline[] => {
    return projects
      .map((project, idx) => {
        const data = channelDataMap[project.id];
        if (!data) return null;

        const posts: { timestamp: number; interactions: number; postId: string; caption: string; postUrl: string }[] = [];

        (data.videos || []).forEach((v) => {
          if (!v.createTime) return;
          const ts = new Date(v.createTime).getTime();
          if (isNaN(ts)) return; // Skip invalid dates
          posts.push({
            timestamp: ts,
            interactions: (v.metrics?.likes || 0) + (v.metrics?.comments || 0) + (v.metrics?.shares || 0),
            postId: v.id,
            caption: v.caption?.slice(0, 80) || "",
            postUrl: v.url || "",
          });
        });

        (data.posts || []).forEach((p) => {
          if (!p.createTime) return;
          const ts = new Date(p.createTime).getTime();
          if (isNaN(ts)) return; // Skip invalid dates
          posts.push({
            timestamp: ts,
            interactions: (p.metrics?.likes || 0) + (p.metrics?.comments || 0) + (p.metrics?.shares || 0),
            postId: p.id,
            caption: p.caption?.slice(0, 80) || "",
            postUrl: p.url || "",
          });
        });

        posts.sort((a, b) => a.timestamp - b.timestamp);

        const postData = posts.map((p) => ({
          timestamp: p.timestamp,
          value: p.interactions,
          postId: p.postId,
          caption: p.caption,
          postUrl: p.postUrl,
        }));

        const totalInteractions = posts.reduce((sum, p) => sum + p.interactions, 0);
        const postCount = posts.length;
        const avgInteractions = postCount > 0 ? totalInteractions / postCount : 0;

        return {
          id: project.id,
          nickname: data.profile?.fullName || project.nickname || project.username,
          avatar: data.profile?.avatar || project.avatar || "",
          color: PROFILE_COLORS[idx % PROFILE_COLORS.length],
          totalInteractions,
          postCount,
          avgInteractions,
          postData,
        };
      })
      .filter((p): p is ProfileTimeline => p !== null && p.postData.length > 0);
  }, [projects, channelDataMap]);

  // Initialize selected profiles
  useEffect(() => {
    if (selectedProfiles.size === 0 && profileTimelines.length > 0) {
      setSelectedProfiles(new Set(profileTimelines.map((p) => p.id)));
    }
  }, [profileTimelines, selectedProfiles.size]);

  // Calculate time range (show all data)
  const timeRange = useMemo(() => {
    let minTime = Infinity;
    let maxTime = -Infinity;

    profileTimelines.forEach((profile) => {
      profile.postData.forEach((d) => {
        if (d.timestamp < minTime) minTime = d.timestamp;
        if (d.timestamp > maxTime) maxTime = d.timestamp;
      });
    });

    if (minTime === Infinity) {
      const now = Date.now();
      minTime = now - 30 * 24 * 60 * 60 * 1000;
      maxTime = now;
    }

    return { minTime, maxTime };
  }, [profileTimelines]);

  // Y-axis range
  const yRange = useMemo(() => {
    let maxValue = 0;
    profileTimelines.forEach((profile) => {
      if (!selectedProfiles.has(profile.id)) return;
      profile.postData.forEach((d) => {
        if (d.value > maxValue) maxValue = d.value;
      });
    });
    return { minValue: 0, maxValue: Math.max(maxValue, 100) };
  }, [profileTimelines, selectedProfiles]);

  // Scale functions
  const scaleX = useCallback((timestamp: number) => {
    const range = timeRange.maxTime - timeRange.minTime;
    if (range === 0) return PADDING.left;
    return PADDING.left + ((timestamp - timeRange.minTime) / range) * plotWidth;
  }, [timeRange, plotWidth]);

  const scaleY = useCallback((value: number) => {
    const range = yRange.maxValue - yRange.minValue;
    if (range === 0) return PADDING.top + plotHeight;
    return PADDING.top + plotHeight - ((value - yRange.minValue) / range) * plotHeight;
  }, [yRange, plotHeight]);

  // Generate path
  const generatePath = useCallback((profile: ProfileTimeline): string => {
    if (profile.postData.length === 0) return "";

    let path = `M ${scaleX(profile.postData[0].timestamp)} ${scaleY(profile.postData[0].value)}`;
    for (let i = 1; i < profile.postData.length; i++) {
      const x2 = scaleX(profile.postData[i].timestamp);
      const y2 = scaleY(profile.postData[i].value);
      path += ` L ${x2} ${y2}`;
    }
    return path;
  }, [scaleX, scaleY]);

  // Format helpers
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const range = timeRange.maxTime - timeRange.minTime;
    if (range < 2 * 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  };

  const formatValue = (value: number): string => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return Math.round(value).toString();
  };

  // Axis ticks
  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    const range = timeRange.maxTime - timeRange.minTime;
    const tickCount = 6;
    for (let i = 0; i <= tickCount; i++) {
      ticks.push(timeRange.minTime + (range * i) / tickCount);
    }
    return ticks;
  }, [timeRange]);

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i <= 4; i++) {
      ticks.push(yRange.minValue + ((yRange.maxValue - yRange.minValue) * i) / 4);
    }
    return ticks;
  }, [yRange]);

  // Total stats
  const totalSelectedInteractions = useMemo(() => {
    return profileTimelines
      .filter((p) => selectedProfiles.has(p.id))
      .reduce((sum, p) => sum + p.totalInteractions, 0);
  }, [profileTimelines, selectedProfiles]);

  const totalPosts = useMemo(() => {
    return profileTimelines
      .filter((p) => selectedProfiles.has(p.id))
      .reduce((sum, p) => sum + p.postCount, 0);
  }, [profileTimelines, selectedProfiles]);

  // Handle point hover
  const handlePointHover = (profile: ProfileTimeline, point: typeof profile.postData[0], index: number) => {
    setHoveredPoint({ profile, point, pointIndex: index + 1 });
  };

  const handlePointLeave = () => {
    setHoveredPoint(null);
  };

  if (profileTimelines.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-[#1877F2]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Hiệu suất từng bài post
          </h3>
          <p className="text-xs text-gray-500">
            {totalPosts} bài • Avg {formatValue(totalSelectedInteractions / Math.max(totalPosts, 1))}/bài
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines */}
          {yTicks.map((tick, i) => (
            <g key={`y-${i}`}>
              <line
                x1={PADDING.left} y1={scaleY(tick)}
                x2={CHART_WIDTH - PADDING.right} y2={scaleY(tick)}
                stroke="#E5E7EB" strokeDasharray="2,4"
              />
              <text
                x={PADDING.left - 6} y={scaleY(tick)}
                textAnchor="end" dominantBaseline="middle"
                className="text-[9px] fill-gray-400"
              >
                {formatValue(tick)}
              </text>
            </g>
          ))}

          {/* X-axis ticks */}
          {xTicks.map((tick, i) => (
            <text
              key={`x-${i}`}
              x={scaleX(tick)} y={PADDING.top + plotHeight + 15}
              textAnchor="middle"
              className="text-[9px] fill-gray-400"
            >
              {formatDate(tick)}
            </text>
          ))}

          {/* Lines */}
          {profileTimelines.map((profile) => {
            if (!selectedProfiles.has(profile.id)) return null;
            const path = generatePath(profile);
            if (!path) return null;
            return (
              <path
                key={`line-${profile.id}`}
                d={path}
                fill="none"
                stroke={profile.color}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}

          {/* Data points - hoverable */}
          {profileTimelines.map((profile) => {
            if (!selectedProfiles.has(profile.id)) return null;
            return profile.postData.map((d, i) => {
              const isHovered = hoveredPoint?.point.postId === d.postId && hoveredPoint?.profile.id === profile.id;
              return (
                <circle
                  key={`point-${profile.id}-${i}`}
                  cx={scaleX(d.timestamp)}
                  cy={scaleY(d.value)}
                  r={isHovered ? 5 : 3}
                  fill={profile.color}
                  stroke="white"
                  strokeWidth={isHovered ? 2 : 1}
                  className="cursor-pointer"
                  onMouseEnter={() => handlePointHover(profile, d, i)}
                  onMouseLeave={handlePointLeave}
                  onClick={() => {
                    if (d.postUrl) {
                      window.open(d.postUrl, "_blank", "noopener,noreferrer");
                    }
                  }}
                />
              );
            });
          })}

          {/* Hovered point vertical line */}
          {hoveredPoint && (
            <line
              x1={scaleX(hoveredPoint.point.timestamp)} y1={PADDING.top}
              x2={scaleX(hoveredPoint.point.timestamp)} y2={PADDING.top + plotHeight}
              stroke={hoveredPoint.profile.color}
              strokeWidth={1}
              strokeDasharray="4,4"
              pointerEvents="none"
            />
          )}
        </svg>
      </div>

      {/* Hovered Point Info Panel - Static below chart */}
      {hoveredPoint && (
        <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {hoveredPoint.profile.avatar && (
                <img
                  src={hoveredPoint.profile.avatar}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover"
                />
              )}
              <span className="text-sm font-semibold text-gray-900">
                {hoveredPoint.profile.nickname}
              </span>
              <span className="text-xs font-medium text-blue-600">
                Bài #{hoveredPoint.pointIndex}/{hoveredPoint.profile.postCount}
              </span>
            </div>
            {hoveredPoint.point.postUrl && (
              <a
                href={hoveredPoint.point.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Xem bài post</span>
              </a>
            )}
          </div>

          <div className="text-xs text-gray-500 mb-2">
            {new Date(hoveredPoint.point.timestamp).toLocaleString("vi-VN", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>

          {hoveredPoint.point.caption && (
            <div className="text-xs text-gray-600 mb-2 line-clamp-2">
              "{hoveredPoint.point.caption}..."
            </div>
          )}

          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: hoveredPoint.profile.color }}
            />
            <span className="text-lg font-bold text-gray-900">
              {formatValue(hoveredPoint.point.value)}
            </span>
            <span className="text-xs text-gray-500">tương tác</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
        {profileTimelines.map((profile) => {
          const isSelected = selectedProfiles.has(profile.id);

          return (
            <button
              key={profile.id}
              onClick={() => {
                setSelectedProfiles((prev) => {
                  const newSet = new Set(prev);
                  if (newSet.has(profile.id)) newSet.delete(profile.id);
                  else newSet.add(profile.id);
                  return newSet;
                });
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${
                isSelected
                  ? "bg-gray-100 text-gray-900 hover:bg-gray-200"
                  : "bg-gray-50 text-gray-400 hover:bg-gray-100"
              }`}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: profile.color, opacity: isSelected ? 1 : 0.4 }}
              />
              {profile.avatar && (
                <img src={profile.avatar} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
              )}
              <span className="font-medium">{profile.nickname}</span>
              <div className={`flex items-center gap-1.5 ${isSelected ? "text-gray-600" : "text-gray-300"}`}>
                <span>{profile.postCount} bài</span>
                <span>•</span>
                <span>~{formatValue(profile.avgInteractions)}/bài</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}