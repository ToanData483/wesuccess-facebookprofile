"use client";

import { FileCode, Folder, Code2, Braces, Server } from "lucide-react";
import type { ChannelData } from "@/lib/types/channel-project";

interface StatisticsSectionProps {
  data: ChannelData;
}

export function StatisticsSection({ data }: StatisticsSectionProps) {
  const { videos, analytics } = data;

  // Calculate video-related stats
  const totalDuration = videos.reduce((sum, v) => sum + v.duration, 0);
  const avgDuration = videos.length > 0 ? Math.round(totalDuration / videos.length) : 0;
  const totalHashtags = videos.reduce((sum, v) => sum + v.hashtags.length, 0);
  const totalMentions = videos.reduce((sum, v) => sum + v.mentions.length, 0);

  // Duration distribution
  const durationBuckets = {
    "0-15s": videos.filter(v => v.duration <= 15).length,
    "15-30s": videos.filter(v => v.duration > 15 && v.duration <= 30).length,
    "30-60s": videos.filter(v => v.duration > 30 && v.duration <= 60).length,
    "60s+": videos.filter(v => v.duration > 60).length,
  };

  const projectStats = [
    { icon: FileCode, label: "Files", value: "~35", sublabel: "TypeScript/TSX" },
    { icon: Code2, label: "Lines of Code", value: "~2,700", sublabel: "LOC" },
    { icon: Folder, label: "Components", value: "17", sublabel: "React components" },
    { icon: Server, label: "API Routes", value: "5", sublabel: "Next.js routes" },
    { icon: Braces, label: "Type Definitions", value: "20", sublabel: "Interfaces" },
  ];

  const videoStats = [
    { label: "Videos Analyzed", value: videos.length },
    { label: "Total Duration", value: `${Math.floor(totalDuration / 60)}m ${totalDuration % 60}s` },
    { label: "Avg Duration", value: `${avgDuration}s` },
    { label: "Total Hashtags", value: totalHashtags },
    { label: "Total Mentions", value: totalMentions },
    { label: "Unique Hashtags", value: analytics.topHashtags.length },
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">12. Statistics</h3>
        <p className="text-sm text-gray-500">File counts, LOC, metrics summary</p>
      </div>

      {/* Project Statistics */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h4 className="font-medium text-gray-900 mb-4">Project Statistics</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {projectStats.map(({ icon: Icon, label, value, sublabel }) => (
            <div key={label} className="text-center p-4 bg-gray-50 rounded-lg">
              <Icon className="w-6 h-6 text-gray-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-[10px] text-gray-400">{sublabel}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Video Statistics */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h4 className="font-medium text-gray-900 mb-4">Video Statistics</h4>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {videoStats.map(({ label, value }) => (
            <div key={label} className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Duration Distribution */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h4 className="font-medium text-gray-900 mb-4">Duration Distribution</h4>
        <div className="space-y-3">
          {Object.entries(durationBuckets).map(([range, count]) => {
            const percentage = videos.length > 0 ? (count / videos.length) * 100 : 0;
            return (
              <div key={range} className="flex items-center gap-4">
                <span className="w-16 text-sm font-mono text-gray-600">{range}</span>
                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-purple-500 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-16 text-right text-sm text-gray-600">
                  {count} ({Math.round(percentage)}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-gray-50 rounded-xl p-5">
        <h4 className="font-medium text-gray-900 mb-4">Summary</h4>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td className="py-2 text-gray-500">Category</td>
              <td className="py-2 text-gray-500">Count</td>
              <td className="py-2 text-gray-500">LOC (approx)</td>
            </tr>
            <tr>
              <td className="py-2 font-medium text-gray-700">Pages</td>
              <td className="py-2 text-gray-600">3</td>
              <td className="py-2 text-gray-600">500</td>
            </tr>
            <tr>
              <td className="py-2 font-medium text-gray-700">API Routes</td>
              <td className="py-2 text-gray-600">5</td>
              <td className="py-2 text-gray-600">300</td>
            </tr>
            <tr>
              <td className="py-2 font-medium text-gray-700">Components</td>
              <td className="py-2 text-gray-600">17</td>
              <td className="py-2 text-gray-600">1,500</td>
            </tr>
            <tr>
              <td className="py-2 font-medium text-gray-700">Lib/Utils</td>
              <td className="py-2 text-gray-600">10</td>
              <td className="py-2 text-gray-600">400</td>
            </tr>
            <tr className="font-medium bg-gray-100">
              <td className="py-2 text-gray-900">Total</td>
              <td className="py-2 text-gray-900">35</td>
              <td className="py-2 text-gray-900">~2,700</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
