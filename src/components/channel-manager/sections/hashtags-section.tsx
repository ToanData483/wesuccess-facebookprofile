"use client";

import { Hash, TrendingUp, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { ChannelData } from "@/lib/types/channel-project";

interface HashtagsSectionProps {
  data: ChannelData;
}

export function HashtagsSection({ data }: HashtagsSectionProps) {
  const { videos, analytics } = data;
  const [copied, setCopied] = useState(false);

  // Get all hashtags with their performance
  const hashtagPerformance: Record<string, { count: number; totalViews: number; totalLikes: number }> = {};

  videos.forEach((video) => {
    video.hashtags.forEach((tag) => {
      if (!hashtagPerformance[tag]) {
        hashtagPerformance[tag] = { count: 0, totalViews: 0, totalLikes: 0 };
      }
      hashtagPerformance[tag].count += 1;
      hashtagPerformance[tag].totalViews += video.metrics.views;
      hashtagPerformance[tag].totalLikes += video.metrics.likes;
    });
  });

  const sortedHashtags = Object.entries(hashtagPerformance)
    .map(([tag, stats]) => ({
      tag,
      count: stats.count,
      avgViews: Math.round(stats.totalViews / stats.count),
      avgLikes: Math.round(stats.totalLikes / stats.count),
    }))
    .sort((a, b) => b.count - a.count);

  const topByViews = [...sortedHashtags].sort((a, b) => b.avgViews - a.avgViews).slice(0, 5);
  const topByLikes = [...sortedHashtags].sort((a, b) => b.avgLikes - a.avgLikes).slice(0, 5);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const copyAllHashtags = () => {
    const text = analytics.topHashtags.slice(0, 20).map((h) => `#${h.tag}`).join(" ");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Top Hashtags Analysis</h3>
        <p className="text-sm text-gray-500">Hashtag performance & recommendations</p>
      </div>

      {/* Quick Copy */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-5 border border-blue-100">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">Quick Copy Top Hashtags</h4>
          <button
            onClick={copyAllHashtags}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-blue-200 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy All
              </>
            )}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {analytics.topHashtags.slice(0, 15).map(({ tag, count }) => (
            <span
              key={tag}
              className="px-3 py-1.5 bg-white rounded-full text-sm text-gray-700 border border-blue-200 hover:border-blue-300 cursor-pointer transition-colors"
            >
              #{tag}
              <span className="ml-1 text-gray-400">({count})</span>
            </span>
          ))}
        </div>
      </div>

      {/* Performance Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top by Views */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <h4 className="font-medium text-gray-900">Best for Views</h4>
          </div>
          <div className="space-y-3">
            {topByViews.map(({ tag, avgViews, count }, index) => (
              <div key={tag} className="flex items-center gap-3">
                <span className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-xs font-medium text-green-700">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">#{tag}</p>
                  <p className="text-xs text-gray-500">{count} posts</p>
                </div>
                <p className="text-sm font-medium text-green-600">{formatNumber(avgViews)} avg</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top by Likes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Hash className="w-5 h-5 text-blue-500" />
            <h4 className="font-medium text-gray-900">Best for Engagement</h4>
          </div>
          <div className="space-y-3">
            {topByLikes.map(({ tag, avgLikes, count }, index) => (
              <div key={tag} className="flex items-center gap-3">
                <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-700">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">#{tag}</p>
                  <p className="text-xs text-gray-500">{count} posts</p>
                </div>
                <p className="text-sm font-medium text-blue-600">{formatNumber(avgLikes)} avg</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* All Hashtags Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h4 className="font-medium text-gray-900">All Hashtags ({sortedHashtags.length})</h4>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left py-2 px-4 text-xs font-medium text-gray-500">Hashtag</th>
                <th className="text-right py-2 px-4 text-xs font-medium text-gray-500">Uses</th>
                <th className="text-right py-2 px-4 text-xs font-medium text-gray-500">Avg Views</th>
                <th className="text-right py-2 px-4 text-xs font-medium text-gray-500">Avg Likes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedHashtags.slice(0, 30).map(({ tag, count, avgViews, avgLikes }) => (
                <tr key={tag} className="hover:bg-gray-50">
                  <td className="py-2 px-4 text-sm font-medium text-gray-900">#{tag}</td>
                  <td className="text-right py-2 px-4 text-sm text-gray-600">{count}</td>
                  <td className="text-right py-2 px-4 text-sm text-gray-600">{formatNumber(avgViews)}</td>
                  <td className="text-right py-2 px-4 text-sm text-gray-600">{formatNumber(avgLikes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
