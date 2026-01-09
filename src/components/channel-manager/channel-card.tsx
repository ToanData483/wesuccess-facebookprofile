"use client";

import {
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  LayoutDashboard,
  Grid3X3,
  Film,
} from "lucide-react";
import type { ChannelProject, ChannelData } from "@/lib/types/channel-project";
import { FallbackImage } from "@/components/ui/fallback-image";

interface ChannelCardProps {
  project: ChannelProject;
  data?: ChannelData | null;
  isSelected: boolean;
  isSyncing: boolean;
  onClick: () => void;
  onSync: () => void;
  onRemove: () => void;
  onViewDashboard?: () => void;
}

export function ChannelCard({
  project,
  data,
  isSelected,
  isSyncing,
  onClick,
  onSync,
  onRemove,
  onViewDashboard,
}: ChannelCardProps) {
  // Debug: Check avatar URL and profile data
  if (typeof window !== "undefined") {
    console.log(`[ChannelCard] ${project.username}:`, {
      avatar: project.avatar?.substring(0, 60) || "none",
      followers: data?.profile?.followers,
      following: data?.profile?.following,
    });
  }

  const statusIcon = {
    pending: <Clock className="w-4 h-4 text-gray-400" />,
    syncing: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
    synced: <CheckCircle className="w-4 h-4 text-green-500" />,
    error: <AlertCircle className="w-4 h-4 text-red-500" />,
  };

  const profile = data?.profile;
  const hasData = project.status === "synced" && profile;

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? "border-[#1877F2] ring-2 ring-blue-500/20"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <FallbackImage
              src={project.avatar}
              alt={project.username}
              className="w-14 h-14 rounded-full object-cover ring-2 ring-gray-100"
              fallbackType="avatar"
              fallbackClassName="w-14 h-14 rounded-full ring-2 ring-gray-100"
              fallbackText={project.username.charAt(0).toUpperCase()}
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100">
              {statusIcon[project.status]}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-900 truncate">
                @{project.username}
              </h4>
              {profile?.isVerified && (
                <span className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                  </svg>
                </span>
              )}
            </div>
            {profile?.fullName && (
              <p className="text-sm text-gray-600 truncate">{profile.fullName}</p>
            )}
            {/* Last Synced */}
            <p className={`text-xs mt-1 flex items-center gap-1 ${
              project.status === "error" ? "text-red-500" : "text-gray-400"
            }`}>
              {project.status === "synced" && project.lastSyncAt && (
                <>
                  <Clock className="w-3 h-3" />
                  Đồng bộ {formatTimeAgo(project.lastSyncAt)}
                </>
              )}
              {project.status === "syncing" && "Đang đồng bộ..."}
              {project.status === "pending" && "Chưa đồng bộ"}
              {project.status === "error" && (project.errorMessage || "Đồng bộ thất bại")}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSync();
              }}
              disabled={isSyncing}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Sync profile"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors"
              title="Remove profile"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bio (if available) */}
        {hasData && profile.bio && (
          <p className="text-sm text-gray-500 mt-3 line-clamp-2">{profile.bio}</p>
        )}
      </div>

      {/* Stats Row - Reels | Photos (from last sync) */}
      {hasData && (
        <div className="border-t border-gray-100">
          <div className="grid grid-cols-2">
            <div className="py-3 px-4 text-center border-r border-gray-100">
              <p className="text-xl font-bold text-gray-900">{formatNumber(data?.videos?.length || 0)}</p>
              <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
                <Film className="w-3 h-3" /> Reels
              </p>
            </div>
            <div className="py-3 px-4 text-center">
              <p className="text-xl font-bold text-gray-900">{formatNumber(data?.posts?.length || 0)}</p>
              <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
                <Grid3X3 className="w-3 h-3" /> Photos
              </p>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 text-center pb-2 px-2">
            Dữ liệu từ lần sync gần nhất
          </p>
        </div>
      )}

      {/* View Dashboard Button */}
      {hasData && onViewDashboard && (
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDashboard();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all text-sm"
          >
            <LayoutDashboard className="w-4 h-4" />
            Xem Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(timestamp: number | null): string {
  if (!timestamp) return "chưa bao giờ";

  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7) return `${days} ngày trước`;

  return new Date(timestamp).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "short",
  });
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
