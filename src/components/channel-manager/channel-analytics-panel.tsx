"use client";

import {
  Eye,
  Heart,
  MessageCircle,
  TrendingUp,
  Hash,
  Download,
  Users,
  Play,
} from "lucide-react";
import type { ChannelData } from "@/lib/types/channel-project";
import { FallbackImage } from "@/components/ui/fallback-image";

interface ChannelAnalyticsPanelProps {
  data: ChannelData;
  onDownloadVideos?: (videos: any[]) => void;
}

export function ChannelAnalyticsPanel({
  data,
  onDownloadVideos,
}: ChannelAnalyticsPanelProps) {
  const { profile, videos, analytics } = data;

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const ratingColors = {
    excellent: "bg-green-100 text-green-700",
    good: "bg-blue-100 text-blue-700",
    average: "bg-yellow-100 text-yellow-700",
    low: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-4">
          <FallbackImage
            src={profile.avatar}
            alt={profile.username}
            className="w-16 h-16 rounded-full object-cover border-2 border-gray-100"
            fallbackType="avatar"
            fallbackClassName="w-16 h-16 rounded-full border-2 border-gray-100"
            fallbackText={profile.username.charAt(0).toUpperCase()}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 text-lg">
                @{profile.username}
              </h3>
              {profile.isVerified && (
                <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                  </svg>
                </span>
              )}
            </div>
            <p className="text-gray-500">{profile.fullName}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => onDownloadVideos?.(videos)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              <Download className="w-4 h-4" />
              Download All
            </button>
          </div>
        </div>

        {/* Profile Stats */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100">
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900">
              {formatNumber(profile.followers)}
            </p>
            <p className="text-sm text-gray-500">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900">
              {formatNumber(profile.following)}
            </p>
            <p className="text-sm text-gray-500">Following</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900">
              {formatNumber(profile.posts)}
            </p>
            <p className="text-sm text-gray-500">Posts</p>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Engagement"
          value={`${analytics.engagementRate}%`}
          badge={analytics.benchmarkRating}
          badgeColor={ratingColors[analytics.benchmarkRating]}
        />
        <MetricCard
          icon={<Eye className="w-5 h-5" />}
          label="Avg Views"
          value={formatNumber(analytics.avgViews)}
        />
        <MetricCard
          icon={<Heart className="w-5 h-5" />}
          label="Avg Likes"
          value={formatNumber(analytics.avgLikes)}
        />
        <MetricCard
          icon={<MessageCircle className="w-5 h-5" />}
          label="Avg Comments"
          value={formatNumber(analytics.avgComments)}
        />
      </div>

      {/* Top Hashtags */}
      {analytics.topHashtags.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Hash className="w-5 h-5 text-gray-400" />
            <h4 className="font-medium text-gray-900">Top Hashtags</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {analytics.topHashtags.slice(0, 15).map(({ tag, count }) => (
              <span
                key={tag}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 cursor-pointer transition-colors"
              >
                #{tag}
                <span className="ml-1 text-gray-400">({count})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Videos */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 text-gray-400" />
            <h4 className="font-medium text-gray-900">Recent Videos</h4>
          </div>
          <span className="text-sm text-gray-500">{videos.length} videos</span>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {videos.slice(0, 12).map((video) => (
            <div
              key={video.id}
              className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100"
            >
              <FallbackImage
                src={video.thumbnail}
                alt=""
                className="w-full h-full object-cover"
                fallbackType="video"
                fallbackClassName="w-full h-full"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="text-center text-white">
                  <p className="text-xs font-medium">{formatNumber(video.metrics.views)}</p>
                  <p className="text-[10px] text-white/70">views</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  badge,
  badgeColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2 text-gray-400">{icon}</div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <div className="flex items-center gap-2 mt-1">
        <p className="text-sm text-gray-500">{label}</p>
        {badge && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}
