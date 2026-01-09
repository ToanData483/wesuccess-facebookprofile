"use client";

import { useState, useEffect, useMemo } from "react";
import { Users, Plus, TrendingUp } from "lucide-react";
import type { ChannelProject, ChannelData } from "@/lib/types/channel-project";
import { getChannelProjects, getChannelData } from "@/lib/storage/channel-storage";
import { ProfileRankingTable } from "./profile-ranking-table";
import { AggregatedHeatmap } from "./aggregated-heatmap";
import { PerformanceCharts } from "./performance-charts";
import { PerformanceTimelineChart } from "./performance-timeline-chart";

// Aggregated profile data for dashboard display
export interface AggregatedProfile {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  posts: number;
  interactions: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  contentMix: {
    reels: number;
    videos: number;
    photos: number;
    text: number;
  };
}

// Post entry with profile info for heatmap
export interface HeatmapPost {
  profileId: string;
  avatar: string;
  nickname: string;
  postId: string;      // ID of the post/video
  postUrl: string;     // Direct link to the post
  caption: string;     // Post caption (truncated)
  thumbnail?: string;  // Thumbnail image
}

// Aggregated posting activity for heatmap
export interface PostingActivity {
  grid: number[][];  // 7 days x 24 hours (count)
  profileGrid: HeatmapPost[][][];  // 7 days x 24 hours x posts with profile info
  maxValue: number;
  totalPosts: number;
}

interface DashboardViewProps {
  onNavigateToProfiles?: () => void;
}

export function DashboardView({ onNavigateToProfiles }: DashboardViewProps) {
  const [projects, setProjects] = useState<ChannelProject[]>([]);
  const [channelDataMap, setChannelDataMap] = useState<Record<string, ChannelData | null>>({});

  // Load projects and data on mount
  useEffect(() => {
    const loadedProjects = getChannelProjects();
    setProjects(loadedProjects);

    // Load channel data for each project
    const dataMap: Record<string, ChannelData | null> = {};
    loadedProjects.forEach((p) => {
      dataMap[p.id] = getChannelData(p.id);
    });
    setChannelDataMap(dataMap);
  }, []);

  // Aggregate profile data for ranking table
  const aggregatedProfiles = useMemo((): AggregatedProfile[] => {
    return projects
      .map((project) => {
        const data = channelDataMap[project.id];
        if (!data) return null;

        // Count posts and calculate interactions
        const allContent = [...(data.videos || []), ...(data.posts || [])];
        const totalPosts = allContent.length;

        // Calculate total interactions (likes + comments + shares)
        let totalLikes = 0;
        let totalComments = 0;
        let totalShares = 0;

        // Content mix counters
        const contentMix = { reels: 0, videos: 0, photos: 0, text: 0 };

        // Process videos
        (data.videos || []).forEach((v) => {
          totalLikes += v.metrics?.likes || 0;
          totalComments += v.metrics?.comments || 0;
          totalShares += v.metrics?.shares || 0;

          // Classify content
          if (v.isReel || v.format === "reel") {
            contentMix.reels++;
          } else {
            contentMix.videos++;
          }
        });

        // Process posts
        (data.posts || []).forEach((p) => {
          totalLikes += p.metrics?.likes || 0;
          totalComments += p.metrics?.comments || 0;
          totalShares += p.metrics?.shares || 0;

          // Classify content by format
          if (p.format === "reel") {
            contentMix.reels++;
          } else if (p.format === "video" || p.isVideo) {
            contentMix.videos++;
          } else if (p.format === "photo") {
            contentMix.photos++;
          } else {
            contentMix.text++;
          }
        });

        const totalInteractions = totalLikes + totalComments + totalShares;

        // Calculate engagement rate
        const followers = data.profile?.followers || 0;
        const engagementRate = followers > 0 && totalPosts > 0
          ? ((totalLikes + totalComments) / totalPosts / followers) * 100
          : 0;

        return {
          id: project.id,
          username: project.username,
          nickname: data.profile?.fullName || project.nickname || project.username,
          avatar: data.profile?.avatar || project.avatar || "",
          posts: totalPosts,
          interactions: totalInteractions,
          likes: totalLikes,
          comments: totalComments,
          shares: totalShares,
          engagementRate,
          contentMix,
        };
      })
      .filter((p): p is AggregatedProfile => p !== null && p.posts > 0)
      .sort((a, b) => b.interactions - a.interactions); // Sort by interactions desc
  }, [projects, channelDataMap]);

  // Aggregate posting activity for heatmap (from ALL profiles)
  const aggregatedHeatmapData = useMemo((): PostingActivity => {
    // Initialize 7 days x 24 hours grid
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const profileGrid: HeatmapPost[][][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => [])
    );
    let totalPosts = 0;

    // Aggregate from all profiles
    projects.forEach((project) => {
      const data = channelDataMap[project.id];
      if (!data) return;

      const baseProfileInfo = {
        profileId: project.id,
        avatar: data.profile?.avatar || project.avatar || "",
        nickname: data.profile?.fullName || project.nickname || project.username,
      };

      // Process videos
      (data.videos || []).forEach((v) => {
        if (!v.createTime) return;
        const date = new Date(v.createTime);
        if (isNaN(date.getTime())) return; // Skip invalid dates
        const dayOfWeek = date.getDay(); // 0 = Sunday
        const hour = date.getHours();
        grid[dayOfWeek][hour]++;
        profileGrid[dayOfWeek][hour].push({
          ...baseProfileInfo,
          postId: v.id,
          postUrl: v.url,
          caption: v.caption?.slice(0, 100) || "",
          thumbnail: v.thumbnail,
        });
        totalPosts++;
      });

      // Process posts
      (data.posts || []).forEach((p) => {
        if (!p.createTime) return;
        const date = new Date(p.createTime);
        if (isNaN(date.getTime())) return; // Skip invalid dates
        const dayOfWeek = date.getDay();
        const hour = date.getHours();
        grid[dayOfWeek][hour]++;
        profileGrid[dayOfWeek][hour].push({
          ...baseProfileInfo,
          postId: p.id,
          postUrl: p.url,
          caption: p.caption?.slice(0, 100) || "",
          thumbnail: p.thumbnail,
        });
        totalPosts++;
      });
    });

    // Find max value
    const maxValue = Math.max(...grid.flat());

    return { grid, profileGrid, maxValue, totalPosts };
  }, [projects, channelDataMap]);

  // Aggregate content mix for pie chart
  const totalContentMix = useMemo(() => {
    const mix = { reels: 0, videos: 0, photos: 0, text: 0 };
    aggregatedProfiles.forEach((p) => {
      mix.reels += p.contentMix.reels;
      mix.videos += p.contentMix.videos;
      mix.photos += p.contentMix.photos;
      mix.text += p.contentMix.text;
    });
    return mix;
  }, [aggregatedProfiles]);

  // Empty state - no profiles synced
  if (projects.length === 0 || aggregatedProfiles.length === 0) {
    return (
      <div className="animate-fade-in">
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-20 h-20 bg-blue-50 rounded-2xl mx-auto mb-6 flex items-center justify-center">
            <TrendingUp className="w-10 h-10 text-[#1877F2]" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Chưa có dữ liệu phân tích
          </h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Thêm và đồng bộ các profile Facebook để xem analytics tổng quan, so sánh hiệu suất giữa các trang.
          </p>
          <button
            onClick={onNavigateToProfiles}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1877F2] hover:bg-[#166FE5] text-white font-medium rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5" />
            Thêm Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header with profile count badge */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Analytics Overview</h2>
          <p className="text-sm text-gray-500">So sánh hiệu suất giữa các profile</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl">
          <Users className="w-4 h-4 text-[#1877F2]" />
          <span className="text-sm font-medium text-[#1877F2]">
            {aggregatedProfiles.length} Profiles Synced
          </span>
        </div>
      </div>

      {/* Profile Ranking Table */}
      <ProfileRankingTable profiles={aggregatedProfiles} />

      {/* Aggregated Heatmap */}
      <AggregatedHeatmap data={aggregatedHeatmapData} />

      {/* Performance Timeline Chart */}
      <PerformanceTimelineChart
        projects={projects}
        channelDataMap={channelDataMap}
      />

      {/* Performance Charts */}
      <PerformanceCharts
        profiles={aggregatedProfiles}
        contentMix={totalContentMix}
      />
    </div>
  );
}
