"use client";

import { Eye, Heart, MessageCircle, Share2, Bookmark, TrendingUp } from "lucide-react";
import type { ChannelData, ChannelAnalytics } from "@/lib/types/channel-project";
import { FallbackImage } from "@/components/ui/fallback-image";

interface OverviewSectionProps {
  data: ChannelData;
}

export function OverviewSection({ data }: OverviewSectionProps) {
  const { profile, videos, analytics } = data;

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const ratingColors: Record<string, string> = {
    excellent: "bg-green-100 text-green-700 border-green-200",
    good: "bg-blue-100 text-blue-700 border-blue-200",
    average: "bg-yellow-100 text-yellow-700 border-yellow-200",
    low: "bg-red-100 text-red-700 border-red-200",
  };

  const capabilities = [
    { icon: Eye, label: "View Analytics", desc: "Track video performance" },
    { icon: Heart, label: "Engagement Metrics", desc: "Likes, comments analysis" },
    { icon: TrendingUp, label: "Growth Tracking", desc: "Monitor profile growth" },
    { icon: Share2, label: "Content Insights", desc: "Hashtag & posting analysis" },
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">1. Overview</h3>
        <p className="text-sm text-gray-500">Core capabilities & profile summary</p>
      </div>

      {/* Profile Summary Card */}
      <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-blue-50 rounded-xl p-6 border border-blue-100">
        <div className="flex items-start gap-4">
          <FallbackImage
            src={profile.avatar}
            alt={profile.username}
            className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
            fallbackType="profile"
            fallbackClassName="w-20 h-20 rounded-full border-4 border-white shadow-lg"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-xl font-bold text-gray-900">@{profile.username}</h4>
              {profile.isVerified && (
                <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                  </svg>
                </span>
              )}
            </div>
            <p className="text-gray-600 mb-3">{profile.fullName}</p>
            <p className="text-sm text-gray-500 line-clamp-2">{profile.bio}</p>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize ${ratingColors[analytics.benchmarkRating]}`}>
            {analytics.benchmarkRating}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-blue-200/50">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{formatNumber(profile.followers)}</p>
            <p className="text-xs text-gray-500">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{formatNumber(profile.posts)}</p>
            <p className="text-xs text-gray-500">Posts</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{analytics.engagementRate}%</p>
            <p className="text-xs text-gray-500">Engagement</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{videos.length}</p>
            <p className="text-xs text-gray-500">Reels Analyzed</p>
          </div>
        </div>
      </div>

      {/* Core Capabilities */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {capabilities.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-200 transition-colors">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
              <Icon className="w-5 h-5 text-[#1877F2]" />
            </div>
            <h5 className="font-medium text-gray-900 text-sm mb-1">{label}</h5>
            <p className="text-xs text-gray-500">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
