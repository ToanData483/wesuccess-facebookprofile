"use client";

import { useState } from "react";
import { Play, Eye, Heart, MessageCircle, Clock, Hash, Download, ExternalLink, CheckSquare, Square } from "lucide-react";
import type { ChannelData, VideoData } from "@/lib/types/channel-project";
import { FallbackImage } from "@/components/ui/fallback-image";

interface ContentSectionProps {
  data: ChannelData;
  onDownload?: (video: VideoData) => void;
  selectedVideos?: VideoData[];
  onToggleSelection?: (video: VideoData) => void;
}

type SortField = "views" | "likes" | "comments" | "date";
type SortOrder = "asc" | "desc";

export function ContentSection({ data, onDownload, selectedVideos = [], onToggleSelection }: ContentSectionProps) {
  const { videos } = data;
  const [sortField, setSortField] = useState<SortField>("views");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const sortedVideos = [...videos].sort((a, b) => {
    let aVal: number, bVal: number;
    switch (sortField) {
      case "views": aVal = a.metrics.views; bVal = b.metrics.views; break;
      case "likes": aVal = a.metrics.likes; bVal = b.metrics.likes; break;
      case "comments": aVal = a.metrics.comments; bVal = b.metrics.comments; break;
      case "date": aVal = a.createTime; bVal = b.createTime; break;
      default: aVal = a.metrics.views; bVal = b.metrics.views;
    }
    return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
  });

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const isSelected = (video: VideoData) => selectedVideos.some(v => v.id === video.id);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">6. Content Breakdown</h3>
        <p className="text-sm text-gray-500">
          {videos.length} videos analyzed
          {selectedVideos.length > 0 && (
            <span className="ml-2 text-blue-600 font-medium">
              • {selectedVideos.length} selected
            </span>
          )}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Sort by:</span>
          {(["views", "likes", "comments", "date"] as SortField[]).map((field) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                sortField === field
                  ? "bg-blue-100 text-blue-700 font-medium"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {field.charAt(0).toUpperCase() + field.slice(1)}
              {sortField === field && (
                <span className="ml-1">{sortOrder === "desc" ? "↓" : "↑"}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === "grid" ? "bg-white shadow-sm" : "text-gray-500"
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === "table" ? "bg-white shadow-sm" : "text-gray-500"
            }`}
          >
            Table
          </button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sortedVideos.slice(0, 12).map((video) => (
            <div
              key={video.id}
              className={`group bg-white rounded-xl border overflow-hidden transition-all cursor-pointer ${
                isSelected(video)
                  ? "border-blue-400 ring-2 ring-blue-200"
                  : "border-gray-200 hover:border-blue-200"
              }`}
              onClick={() => onToggleSelection?.(video)}
            >
              {/* Thumbnail */}
              <div className="relative aspect-[9/16]">
                <FallbackImage
                  src={video.thumbnail}
                  alt=""
                  className="w-full h-full object-cover"
                  fallbackType="video"
                  fallbackClassName="w-full h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {/* Selection Checkbox */}
                {onToggleSelection && (
                  <div className="absolute top-2 left-2">
                    <div className={`p-1 rounded-md transition-colors ${
                      isSelected(video) ? "bg-blue-500" : "bg-black/40 group-hover:bg-black/60"
                    }`}>
                      {isSelected(video) ? (
                        <CheckSquare className="w-4 h-4 text-white" />
                      ) : (
                        <Square className="w-4 h-4 text-white" />
                      )}
                    </div>
                  </div>
                )}

                {/* Duration Badge */}
                <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded text-xs text-white flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(video.duration)}
                </div>

                {/* Metrics Overlay */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-xs">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {formatNumber(video.metrics.views)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      {formatNumber(video.metrics.likes)}
                    </span>
                  </div>
                </div>

                {/* Hover Actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                  >
                    <ExternalLink className="w-5 h-5 text-white" />
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload?.(video);
                    }}
                    className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                  >
                    <Download className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              {/* Caption */}
              <div className="p-3">
                <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                  {video.caption || "No caption"}
                </p>
                {video.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {video.hashtags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded"
                      >
                        #{tag}
                      </span>
                    ))}
                    {video.hashtags.length > 3 && (
                      <span className="text-xs text-gray-400">
                        +{video.hashtags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {onToggleSelection && (
                    <th className="w-10 py-3 px-4"></th>
                  )}
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Video</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Views</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Likes</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Comments</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Duration</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedVideos.map((video) => (
                  <tr
                    key={video.id}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                      isSelected(video) ? "bg-blue-50" : ""
                    }`}
                    onClick={() => onToggleSelection?.(video)}
                  >
                    {onToggleSelection && (
                      <td className="py-3 px-4">
                        <div className={`p-1 rounded-md w-fit ${
                          isSelected(video) ? "text-blue-500" : "text-gray-400"
                        }`}>
                          {isSelected(video) ? (
                            <CheckSquare className="w-5 h-5" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </div>
                      </td>
                    )}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <FallbackImage
                          src={video.thumbnail}
                          alt=""
                          className="w-10 h-14 object-cover rounded"
                          fallbackType="video"
                          fallbackClassName="w-10 h-14 rounded"
                        />
                        <p className="text-sm text-gray-600 line-clamp-1 max-w-[200px]">
                          {video.caption || "No caption"}
                        </p>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-gray-900 font-medium">
                      {formatNumber(video.metrics.views)}
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-gray-600">
                      {formatNumber(video.metrics.likes)}
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-gray-600">
                      {formatNumber(video.metrics.comments)}
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-gray-500">
                      {formatDuration(video.duration)}
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-gray-500">
                      {formatDate(video.createTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Show More */}
      {videos.length > 12 && viewMode === "grid" && (
        <div className="text-center">
          <p className="text-sm text-gray-500">
            Showing 12 of {videos.length} videos
          </p>
        </div>
      )}
    </div>
  );
}
