"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  RefreshCw,
  BarChart3,
  LayoutDashboard,
  LayoutList,
  Key,
  Settings,
  AlertTriangle,
} from "lucide-react";
import type {
  ChannelProject,
  ChannelData,
  VideoData,
  VideoTranscript,
} from "@/lib/types/channel-project";
import { BatchTranscriptDialog } from "./batch-transcript-dialog";
import {
  getChannelProjects,
  addChannelProject,
  removeChannelProject,
  updateChannelProject,
  getChannelData,
  saveChannelData,
} from "@/lib/storage/channel-storage";
import { getChannelData as fetchChannelData, isApifyConfigured, type FetchOptions } from "@/lib/facebook-api";
import type { AddChannelOptions, ResultsLimit } from "./add-channel-dialog";
import { AddChannelDialog } from "./add-channel-dialog";
import { ChannelCard } from "./channel-card";
import { ChannelDashboardView } from "./channel-dashboard-view";

type ViewMode = "compact" | "dashboard";

interface ChannelManagerViewProps {
  onNavigateToDownload?: (videos: any[]) => void;
  onNavigateToSettings?: () => void;
}

export function ChannelManagerView({ onNavigateToDownload, onNavigateToSettings }: ChannelManagerViewProps) {
  const [projects, setProjects] = useState<ChannelProject[]>([]);
  const [channelDataMap, setChannelDataMap] = useState<Record<string, ChannelData | null>>({});
  const [viewingDashboard, setViewingDashboard] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("compact");
  const [showTranscriptDialog, setShowTranscriptDialog] = useState(false);
  const [transcriptVideos, setTranscriptVideos] = useState<VideoData[]>([]);
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [fetchOptionsMap, setFetchOptionsMap] = useState<Record<string, FetchOptions>>({});

  // Check API configuration on mount
  useEffect(() => {
    setApiConfigured(isApifyConfigured());
    setProjects(getChannelProjects());

    // Listen for config changes
    const handleConfigChange = () => {
      setApiConfigured(isApifyConfigured());
    };
    window.addEventListener("config-changed", handleConfigChange);
    return () => window.removeEventListener("config-changed", handleConfigChange);
  }, []);

  // Load all profile data on projects change
  useEffect(() => {
    const dataMap: Record<string, ChannelData | null> = {};
    projects.forEach((p) => {
      dataMap[p.id] = getChannelData(p.id);
    });
    setChannelDataMap(dataMap);
  }, [projects]);

  const handleAddChannel = useCallback((username: string, options?: Omit<AddChannelOptions, 'username'>) => {
    const project = addChannelProject(username);
    setProjects(getChannelProjects());
    setShowAddDialog(false);

    // Save fetch options for this channel (matching Apify input schema)
    if (options) {
      setFetchOptionsMap(prev => ({
        ...prev,
        [project.id]: {
          resultsLimit: options.resultsLimit,
          onlyPostsNewerThan: options.onlyPostsNewerThan,
          onlyPostsOlderThan: options.onlyPostsOlderThan,
        }
      }));
    }

    // Auto sync new profile with options
    handleSyncChannel(project.id, options);
  }, []);

  const handleRemoveChannel = useCallback((id: string) => {
    if (confirm("Xóa trang này? Tất cả dữ liệu đã lưu sẽ bị xóa.")) {
      removeChannelProject(id);
      setProjects(getChannelProjects());
      if (viewingDashboard === id) {
        setViewingDashboard(null);
      }
    }
  }, [viewingDashboard]);

  const handleSyncChannel = useCallback(async (id: string, options?: FetchOptions) => {
    const project = projects.find((p) => p.id === id);
    if (!project || syncingIds.has(id)) return;

    setSyncingIds((prev) => new Set(prev).add(id));
    updateChannelProject(id, { status: "syncing" });
    setProjects(getChannelProjects());

    // Use provided options or saved options for this channel
    const fetchOptions = options || fetchOptionsMap[id];

    try {
      const data = await fetchChannelData(project.username, fetchOptions);

      // Debug: Log raw video data from API
      if (data.videos?.length > 0) {
        console.log("[ChannelManager] First video from API:", data.videos[0]);
        console.log("[ChannelManager] viewCount:", data.videos[0].viewCount);
      }

      // Transform to ChannelData format
      const channelData: ChannelData = {
        projectId: id,
        profile: {
          username: data.profile.username,
          fullName: data.profile.fullName,
          avatar: data.profile.profilePicUrl,
          bio: data.profile.biography,
          followers: data.profile.followersCount,
          following: 0, // Facebook pages don't have following count
          posts: data.posts.length || data.profile.postsCount, // Use fetched posts count
          isVerified: data.profile.isVerified,
          isPrivate: data.profile.isPrivate,
          externalUrl: data.profile.externalUrl,
        },
        videos: data.videos.map((v: any) => ({
          id: v.id,
          shortcode: v.shortcode,
          url: v.url,
          videoUrl: v.videoUrl || "", // Direct video URL for transcription
          thumbnail: v.thumbnailUrl,
          caption: v.caption,
          duration: v.duration,
          // Use createTime directly (already number from API), fallback to timestamp parse
          createTime: v.createTime || (v.timestamp ? new Date(v.timestamp).getTime() : Date.now()),
          metrics: {
            views: v.viewCount,
            likes: v.likeCount,
            comments: v.commentCount,
            shares: v.shareCount || 0,
            saves: 0,
            reactions: v.reactionsBreakdown, // Include reactions breakdown if available
          },
          hashtags: extractHashtags(v.caption),
          mentions: extractMentions(v.caption),
          isReel: true,
          // Format classification from API (URL-based detection)
          format: v.format || "reel",
        })),
        posts: data.posts.map((p: any) => ({
          id: p.id,
          shortcode: p.shortcode,
          url: p.url,
          images: p.images,
          thumbnail: p.thumbnail,
          caption: p.caption,
          // Use createTime directly (already number from API), fallback to timestamp parse
          createTime: p.createTime || (p.timestamp ? new Date(p.timestamp).getTime() : Date.now()),
          metrics: {
            likes: p.likeCount,
            comments: p.commentCount,
            shares: p.shareCount || 0,
            saves: 0,
            reactions: p.reactionsBreakdown, // Include reactions breakdown if available
          },
          hashtags: extractHashtags(p.caption),
          mentions: extractMentions(p.caption),
          isCarousel: p.isCarousel,
          carouselCount: p.carouselCount,
          // Content type classification from API
          contentType: p.contentType || (p.isCarousel ? "multi_image" : "single_image"),
          // Format classification from API (URL-based detection)
          format: p.format || "photo",
          isVideo: p.isVideo || false,
          videoUrl: p.videoUrl || "",
          videoDuration: p.videoDuration || 0,
        })),
        analytics: calculateAnalytics(data),
        fetchedAt: Date.now(),
      };

      saveChannelData(id, channelData);
      updateChannelProject(id, {
        status: "synced",
        lastSyncAt: Date.now(),
        avatar: data.profile.profilePicUrl,
        nickname: data.profile.fullName,
      });

      // Update profile data map
      setChannelDataMap((prev) => ({ ...prev, [id]: channelData }));
    } catch (error) {
      console.error("Sync failed:", error);
      updateChannelProject(id, {
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Sync failed",
      });
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setProjects(getChannelProjects());
    }
  }, [projects, syncingIds, fetchOptionsMap]);

  const handleSyncAll = useCallback(() => {
    projects.forEach((p) => handleSyncChannel(p.id));
  }, [projects, handleSyncChannel]);

  // Handler for batch transcript extraction
  const handleExtractTranscripts = useCallback((videos: VideoData[]) => {
    console.log("[ChannelManager] handleExtractTranscripts called with", videos.length, "videos");
    console.log("[ChannelManager] Setting showTranscriptDialog to true");
    setTranscriptVideos(videos);
    setShowTranscriptDialog(true);
  }, []);

  // Handler when transcripts are completed
  const handleTranscriptComplete = useCallback((results: Map<string, VideoTranscript>) => {
    if (!viewingDashboard) return;

    const currentData = channelDataMap[viewingDashboard];
    if (!currentData) return;

    // Update videos with transcripts
    const updatedVideos = currentData.videos.map((video) => {
      const transcript = results.get(video.id);
      if (transcript) {
        return { ...video, transcript };
      }
      return video;
    });

    // Save updated profile data
    const updatedData: ChannelData = {
      ...currentData,
      videos: updatedVideos,
    };

    saveChannelData(viewingDashboard, updatedData);
    setChannelDataMap((prev) => ({ ...prev, [viewingDashboard]: updatedData }));

    setShowTranscriptDialog(false);
    setTranscriptVideos([]);
  }, [viewingDashboard, channelDataMap]);

  // Get viewing dashboard data
  const viewingData = viewingDashboard ? channelDataMap[viewingDashboard] : null;

  // Show API configuration required message
  if (apiConfigured === false) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Quản lý Trang</h2>
            <p className="text-sm text-gray-500">
              Quản lý nhiều trang Facebook để phân tích
            </p>
          </div>
        </div>

        {/* API Configuration Required */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-8">
          <div className="flex flex-col items-center text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
              <Key className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Cần cấu hình API
            </h3>
            <p className="text-gray-600 mb-6">
              Để sử dụng Quản lý Trang, bạn cần cấu hình <strong>Apify API Token</strong> trước.
              Token này dùng để lấy dữ liệu trang Facebook và bài viết.
            </p>

            <div className="bg-white rounded-lg border border-amber-200 p-4 mb-6 w-full">
              <div className="flex items-start gap-3 text-left">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-600">
                  <p className="font-medium text-gray-800 mb-1">Cách lấy Apify Token:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Truy cập <a href="https://apify.com" target="_blank" rel="noopener noreferrer" className="text-[#1877F2] hover:underline">apify.com</a> và tạo tài khoản</li>
                    <li>Vào Settings → Integrations → API</li>
                    <li>Sao chép Personal API Token của bạn</li>
                  </ol>
                </div>
              </div>
            </div>

            <button
              onClick={onNavigateToSettings}
              disabled={!onNavigateToSettings}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
            >
              <Settings className="w-4 h-4" />
              Đi đến Cài đặt
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full Dashboard View
  if (viewMode === "dashboard" && viewingData) {
    return (
      <>
        <ChannelDashboardView
          data={viewingData}
          onBack={() => setViewMode("compact")}
          onSync={() => viewingDashboard && handleSyncChannel(viewingDashboard)}
          onExtractTranscripts={handleExtractTranscripts}
          isSyncing={viewingDashboard ? syncingIds.has(viewingDashboard) : false}
        />
        {/* Batch Transcript Dialog - must be rendered in dashboard view too */}
        {showTranscriptDialog && (
          <BatchTranscriptDialog
            videos={transcriptVideos}
            onClose={() => {
              setShowTranscriptDialog(false);
              setTranscriptVideos([]);
            }}
            onComplete={handleTranscriptComplete}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Quản lý Trang</h2>
          <p className="text-sm text-gray-500">
            Quản lý nhiều trang Facebook để phân tích
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("compact")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "compact" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              title="Xem thu gọn"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => viewingData && setViewMode("dashboard")}
              disabled={!viewingData}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "dashboard" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"} disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Dashboard đầy đủ"
            >
              <LayoutDashboard className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleSyncAll}
            disabled={projects.length === 0 || syncingIds.size > 0}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${syncingIds.size > 0 ? "animate-spin" : ""}`} />
            Đồng bộ tất cả
          </button>
          <button
            onClick={() => setShowAddDialog(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1877F2] rounded-lg hover:bg-[#166FE5]"
          >
            <Plus className="w-4 h-4" />
            Thêm Trang
          </button>
        </div>
      </div>

      {/* Content */}
      {projects.length === 0 ? (
        <EmptyState onAdd={() => setShowAddDialog(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ChannelCard
              key={project.id}
              project={project}
              data={channelDataMap[project.id]}
              isSelected={viewingDashboard === project.id}
              isSyncing={syncingIds.has(project.id)}
              onClick={() => setViewingDashboard(project.id)}
              onSync={() => handleSyncChannel(project.id)}
              onRemove={() => handleRemoveChannel(project.id)}
              onViewDashboard={() => {
                setViewingDashboard(project.id);
                setViewMode("dashboard");
              }}
            />
          ))}
        </div>
      )}

      {/* Add Dialog */}
      {showAddDialog && (
        <AddChannelDialog
          onClose={() => setShowAddDialog(false)}
          onAdd={handleAddChannel}
        />
      )}

      {/* Batch Transcript Dialog */}
      {showTranscriptDialog && (
        <BatchTranscriptDialog
          videos={transcriptVideos}
          onClose={() => {
            setShowTranscriptDialog(false);
            setTranscriptVideos([]);
          }}
          onComplete={handleTranscriptComplete}
        />
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <div className="w-16 h-16 bg-blue-50 rounded-2xl mx-auto mb-4 flex items-center justify-center">
        <BarChart3 className="w-8 h-8 text-[#1877F2]" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Chưa có Trang nào</h3>
      <p className="text-gray-500 mb-6 max-w-sm mx-auto">
        Thêm trang Facebook để theo dõi hiệu suất và xem phân tích chi tiết.
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-[#1877F2] rounded-xl hover:bg-[#166FE5]"
      >
        <Plus className="w-4 h-4" />
        Thêm Trang đầu tiên
      </button>
    </div>
  );
}

// Helper functions
function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u0080-\uFFFF]+/g) || [];
  return matches.map((m) => m.slice(1));
}

function extractMentions(text: string): string[] {
  const matches = text.match(/@[\w.]+/g) || [];
  return matches.map((m) => m.slice(1));
}

function calculateAnalytics(data: any): any {
  const videos = data.videos || [];
  const posts = data.posts || [];
  const allContent = [...videos, ...posts];

  if (!allContent.length) {
    return {
      engagementRate: 0,
      avgViews: 0,
      avgLikes: 0,
      avgComments: 0,
      avgShares: 0,
      postingFrequency: 0,
      topHashtags: [],
      bestPostingHours: [],
      growthTrend: "stable" as const,
      benchmarkRating: "average" as const,
    };
  }

  // Views only from videos (posts don't have views)
  const totalViews = videos.reduce((sum: number, v: any) => sum + (v.viewCount || 0), 0);
  const avgViews = videos.length > 0 ? Math.round(totalViews / videos.length) : 0;

  // Likes and comments from both videos and posts
  const totalVideoLikes = videos.reduce((sum: number, v: any) => sum + (v.likeCount || 0), 0);
  const totalPostLikes = posts.reduce((sum: number, p: any) => sum + (p.likeCount || 0), 0);
  const totalLikes = totalVideoLikes + totalPostLikes;

  const totalVideoComments = videos.reduce((sum: number, v: any) => sum + (v.commentCount || 0), 0);
  const totalPostComments = posts.reduce((sum: number, p: any) => sum + (p.commentCount || 0), 0);
  const totalComments = totalVideoComments + totalPostComments;

  const avgLikes = Math.round(totalLikes / allContent.length);
  const avgComments = Math.round(totalComments / allContent.length);

  const followers = data.profile.followersCount || 1;
  const engagementRate = ((avgLikes + avgComments) / followers) * 100;

  // Extract hashtags from all content
  const hashtagCounts: Record<string, number> = {};
  allContent.forEach((item: any) => {
    const tags = extractHashtags(item.caption || "");
    tags.forEach((tag) => {
      hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
    });
  });
  const topHashtags = Object.entries(hashtagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  // Calculate posting frequency (posts per week)
  const timestamps = allContent.map((item: any) =>
    new Date(item.timestamp).getTime()
  ).filter(t => !isNaN(t));

  let postingFrequency = allContent.length;
  if (timestamps.length >= 2) {
    const oldest = Math.min(...timestamps);
    const newest = Math.max(...timestamps);
    const weekSpan = Math.max(1, (newest - oldest) / (7 * 24 * 60 * 60 * 1000));
    postingFrequency = Math.round((allContent.length / weekSpan) * 10) / 10;
  }

  // Determine rating
  let benchmarkRating: "excellent" | "good" | "average" | "low" = "average";
  if (engagementRate > 5) benchmarkRating = "excellent";
  else if (engagementRate > 3) benchmarkRating = "good";
  else if (engagementRate < 1) benchmarkRating = "low";

  return {
    engagementRate: Math.round(engagementRate * 100) / 100,
    avgViews,
    avgLikes,
    avgComments,
    avgShares: 0,
    postingFrequency,
    topHashtags,
    bestPostingHours: [9, 12, 18, 21],
    growthTrend: "stable" as const,
    benchmarkRating,
  };
}
