"use client";

import { TrendingUp, TrendingDown, Minus, BarChart3, Target, Activity } from "lucide-react";
import type { ChannelData, ChannelAnalytics } from "@/lib/types/channel-project";

interface AnalyticsSectionProps {
  data: ChannelData;
}

export function AnalyticsSection({ data }: AnalyticsSectionProps) {
  const { profile, videos, analytics } = data;

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Calculate additional metrics
  const totalViews = videos.reduce((sum, v) => sum + v.metrics.views, 0);
  const totalLikes = videos.reduce((sum, v) => sum + v.metrics.likes, 0);
  const totalComments = videos.reduce((sum, v) => sum + v.metrics.comments, 0);

  // Benchmark explanations
  const benchmarkInfo = {
    excellent: { color: "text-green-600", bg: "bg-green-50", desc: ">5% engagement rate" },
    good: { color: "text-blue-600", bg: "bg-blue-50", desc: "3-5% engagement rate" },
    average: { color: "text-yellow-600", bg: "bg-yellow-50", desc: "1-3% engagement rate" },
    low: { color: "text-red-600", bg: "bg-red-50", desc: "<1% engagement rate" },
  };

  const trendIcon = {
    up: <TrendingUp className="w-4 h-4 text-green-500" />,
    down: <TrendingDown className="w-4 h-4 text-red-500" />,
    stable: <Minus className="w-4 h-4 text-gray-500" />,
  };

  const trendText = {
    up: "Growing",
    down: "Declining",
    stable: "Stable",
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">9. Analytics Calculations</h3>
        <p className="text-sm text-gray-500">Engagement rate, benchmark, growth trend</p>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Engagement Rate */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Target className="w-4 h-4 text-[#1877F2]" />
            </div>
            <span className="text-sm font-medium text-gray-500">Engagement Rate</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-2">{analytics.engagementRate}%</p>
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${benchmarkInfo[analytics.benchmarkRating].bg} ${benchmarkInfo[analytics.benchmarkRating].color}`}>
            {benchmarkInfo[analytics.benchmarkRating].desc}
          </div>
        </div>

        {/* Benchmark Rating */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Benchmark</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-2 capitalize">{analytics.benchmarkRating}</p>
          <p className="text-xs text-gray-500">Industry comparison</p>
        </div>

        {/* Growth Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Growth Trend</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            {trendIcon[analytics.growthTrend]}
            <p className="text-3xl font-bold text-gray-900">{trendText[analytics.growthTrend]}</p>
          </div>
          <p className="text-xs text-gray-500">Based on recent vs older posts</p>
        </div>
      </div>

      {/* Formulas & Calculations */}
      <div className="bg-gray-50 rounded-xl p-5">
        <h4 className="font-medium text-gray-900 mb-4">Calculation Formulas</h4>
        <div className="space-y-4 text-sm">
          {/* Engagement Rate Formula */}
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="font-mono text-gray-600 mb-2">
              <span className="text-blue-600">engagementRate</span> = (avgLikes + avgComments) / followers × 100
            </p>
            <p className="text-xs text-gray-500">
              = ({formatNumber(analytics.avgLikes)} + {formatNumber(analytics.avgComments)}) / {formatNumber(profile.followers)} × 100 = <span className="font-medium text-gray-900">{analytics.engagementRate}%</span>
            </p>
          </div>

          {/* Benchmark Rating */}
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="font-mono text-gray-600 mb-2">
              <span className="text-purple-600">benchmarkRating</span> = based on engagementRate thresholds
            </p>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {Object.entries(benchmarkInfo).map(([key, { color, desc }]) => (
                <div key={key} className={`text-center py-2 rounded ${analytics.benchmarkRating === key ? 'bg-gray-100 ring-2 ring-gray-300' : ''}`}>
                  <p className={`text-xs font-medium capitalize ${color}`}>{key}</p>
                  <p className="text-[10px] text-gray-400">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Growth Trend */}
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="font-mono text-gray-600 mb-2">
              <span className="text-blue-600">growthTrend</span> = compare avgViews (3 newest) vs (3 oldest)
            </p>
            <p className="text-xs text-gray-500">
              {">"} 20% increase → up | {">"} 20% decrease → down | else → stable
            </p>
          </div>
        </div>
      </div>

      {/* Totals Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{formatNumber(totalViews)}</p>
          <p className="text-xs text-gray-500">Total Views</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{formatNumber(totalLikes)}</p>
          <p className="text-xs text-gray-500">Total Likes</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{formatNumber(totalComments)}</p>
          <p className="text-xs text-gray-500">Total Comments</p>
        </div>
      </div>
    </div>
  );
}
