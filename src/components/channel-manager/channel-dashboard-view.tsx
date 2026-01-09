"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  ArrowLeft,
  RefreshCw,
  Download,
  FileJson,
  Calendar,
  Search,
  X,
  Hash,
} from "lucide-react";
import type { ChannelData, VideoData, PostData } from "@/lib/types/channel-project";
import { DateRangeFilter, type DateRange, filterVideosByDateRange } from "./date-range-filter";
import { getProxiedImageUrl } from "@/lib/utils/image-proxy";
import { TranscriptViewerDialog } from "./transcript-viewer-dialog";
import { VideoDownloadDialog } from "./video-download-dialog";
import { AnalyticsDashboard } from "./analytics-dashboard";
import { getApiKey, getConfig } from "@/lib/config-store";


// Content type display configuration
const CONTENT_TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  reel: { label: "Reels", color: "#EC4899", bgColor: "bg-pink-500" },
  single_image: { label: "Single Image", color: "#3B82F6", bgColor: "bg-blue-500" },
  multi_image: { label: "Multi Image", color: "#8B5CF6", bgColor: "bg-violet-500" },
  single_video: { label: "Single Video", color: "#F59E0B", bgColor: "bg-amber-500" },
  multi_video: { label: "Multi Video", color: "#EF4444", bgColor: "bg-red-500" },
  text_only: { label: "Text Only", color: "#6B7280", bgColor: "bg-gray-500" },
  link_share: { label: "Link Share", color: "#10B981", bgColor: "bg-emerald-500" },
  mixed_media: { label: "Mixed Media", color: "#14B8A6", bgColor: "bg-teal-500" },
};


interface ChannelDashboardViewProps {
  data: ChannelData;
  onBack: () => void;
  onSync: () => void;
  onDownloadPosts?: (posts: PostData[]) => void;
  onExtractTranscripts?: (videos: VideoData[]) => void;
  isSyncing?: boolean;
}

export function ChannelDashboardView({
  data,
  onBack,
  onSync,
  onDownloadPosts,
  onExtractTranscripts,
  isSyncing,
}: ChannelDashboardViewProps) {
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [customDateFrom, setCustomDateFrom] = useState<string>("");
  const [customDateTo, setCustomDateTo] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"date" | "views" | "likes" | "comments" | "shares">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null); // For hashtag filter
  const [viewingTranscriptVideo, setViewingTranscriptVideo] = useState<VideoData | null>(null); // For transcript viewer
  const [downloadingVideos, setDownloadingVideos] = useState<VideoData[]>([]); // For download dialog
  const [fetchingTranscriptIds, setFetchingTranscriptIds] = useState<Set<string>>(new Set()); // Track videos being transcribed

  const { profile, videos, posts = [], analytics, fetchedAt } = data;

  // Filter videos by date range, search, and hashtag
  const filteredVideos = useMemo(() => {
    let result = filterVideosByDateRange(videos, dateRange, customDateFrom, customDateTo);
    // Filter by selected hashtag
    if (selectedHashtag) {
      result = result.filter((v) => v.hashtags.some((tag) => tag.toLowerCase() === selectedHashtag.toLowerCase()));
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (v) =>
          v.caption?.toLowerCase().includes(query) ||
          v.hashtags.some((tag) => tag.toLowerCase().includes(query))
      );
    }
    // Sort
    result.sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortField) {
        case "views": aVal = a.metrics.views; bVal = b.metrics.views; break;
        case "likes": aVal = a.metrics.likes; bVal = b.metrics.likes; break;
        case "comments": aVal = a.metrics.comments; bVal = b.metrics.comments; break;
        default: aVal = a.createTime; bVal = b.createTime;
      }
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });
    return result;
  }, [videos, dateRange, customDateFrom, customDateTo, selectedHashtag, searchQuery, sortField, sortOrder]);

  // Filter posts by date range, search, and hashtag
  const filteredPosts = useMemo(() => {
    if (!posts.length) return [];
    // Apply date range filter to posts too
    let result = filterVideosByDateRange(posts, dateRange, customDateFrom, customDateTo);
    // Filter by selected hashtag
    if (selectedHashtag) {
      result = result.filter((p) => p.hashtags.some((tag) => tag.toLowerCase() === selectedHashtag.toLowerCase()));
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.caption?.toLowerCase().includes(query) ||
          p.hashtags.some((tag) => tag.toLowerCase().includes(query))
      );
    }
    // Sort by likes (posts don't have views)
    result.sort((a, b) => {
      const aVal = sortField === "comments" ? a.metrics.comments : a.metrics.likes;
      const bVal = sortField === "comments" ? b.metrics.comments : b.metrics.likes;
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });
    return result;
  }, [posts, dateRange, customDateFrom, customDateTo, selectedHashtag, searchQuery, sortField, sortOrder]);

  // Generate engagement over time data for reels chart (with ID for click-to-highlight)
  // Now uses filteredVideos so chart updates with filter
  const reelsChartData = useMemo(() => {
    const sorted = [...filteredVideos].sort((a, b) => a.createTime - b.createTime);
    return sorted.map((v) => ({
      id: v.id,
      date: new Date(v.createTime).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      views: v.metrics.views,
      likes: v.metrics.likes,
      comments: v.metrics.comments,
      saves: v.metrics.saves,
    }));
  }, [filteredVideos]);

  // Generate engagement over time data for posts chart (with ID for click-to-highlight)
  // Calculate total reactions breakdown from all posts (if available)
  const reactionsData = useMemo(() => {
    const totals = {
      like: 0,
      love: 0,
      haha: 0,
      wow: 0,
      sad: 0,
      angry: 0,
      care: 0,
    };
    let hasAnyReactions = false;

    filteredPosts.forEach((p) => {
      if (p.metrics.reactions) {
        hasAnyReactions = true;
        totals.like += p.metrics.reactions.like || 0;
        totals.love += p.metrics.reactions.love || 0;
        totals.haha += p.metrics.reactions.haha || 0;
        totals.wow += p.metrics.reactions.wow || 0;
        totals.sad += p.metrics.reactions.sad || 0;
        totals.angry += p.metrics.reactions.angry || 0;
        totals.care += p.metrics.reactions.care || 0;
      }
    });

    // Also check videos
    filteredVideos.forEach((v) => {
      if (v.metrics.reactions) {
        hasAnyReactions = true;
        totals.like += v.metrics.reactions.like || 0;
        totals.love += v.metrics.reactions.love || 0;
        totals.haha += v.metrics.reactions.haha || 0;
        totals.wow += v.metrics.reactions.wow || 0;
        totals.sad += v.metrics.reactions.sad || 0;
        totals.angry += v.metrics.reactions.angry || 0;
        totals.care += v.metrics.reactions.care || 0;
      }
    });

    return hasAnyReactions ? totals : null;
  }, [filteredPosts, filteredVideos]);

    // Now uses filteredPosts so chart updates with filter
  const postsChartData = useMemo(() => {
    const sorted = [...filteredPosts].sort((a, b) => a.createTime - b.createTime);
    return sorted.map((p) => ({
      id: p.id,
      date: new Date(p.createTime).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      likes: p.metrics.likes,
      comments: p.metrics.comments,
    }));
  }, [filteredPosts]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatFullDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const exportToJson = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      profile,
      videos: filteredVideos,
      analytics,
      metadata: { fetchedAt, videoCount: filteredVideos.length, dateRange },
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `facebook_${profile.username}_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download videos using built-in dialog
  const handleDownloadVideos = (videosToDownload: VideoData[]) => {
    if (videosToDownload.length === 0) return;
    setDownloadingVideos(videosToDownload);
  };

  // Fetch transcript for a video that doesn't have one
  const handleFetchTranscript = async (video: VideoData) => {
    // Get API keys from config
    const assemblyaiKey = getApiKey("assemblyai");
    const apifyToken = getApiKey("apify");

    if (!assemblyaiKey) {
      console.error("[Transcript] AssemblyAI API key not configured");
      alert("Vui lòng cấu hình AssemblyAI API key trong Settings trước khi sử dụng tính năng này.");
      return;
    }

    // Use direct videoUrl if available (from sync), otherwise fall back to Facebook reel URL
    const directVideoUrl = video.videoUrl;
    const fallbackUrl = `https://facebook.com/reel/${video.id}`;

    // Add to fetching set
    setFetchingTranscriptIds((prev) => new Set(prev).add(video.id));

    try {
      console.log("[Transcript] Fetching for:", video.id, directVideoUrl ? "(has direct URL)" : fallbackUrl);

      // Get language preferences from config
      const config = getConfig();
      const useAutoDetect = config.defaultLanguage === "auto";

      const response = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: fallbackUrl,
          videoUrl: directVideoUrl, // Direct video URL from sync (if available)
          apiKey: assemblyaiKey,
          languageCode: useAutoDetect ? undefined : config.defaultLanguage,
          autoDetect: useAutoDetect,
          translate: config.autoTranslate,
          translateTo: config.translateTargetLang || "vi",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Transcript] API Error:", errorData);
        throw new Error(errorData.error || "Failed to fetch transcript");
      }

      const result = await response.json();
      console.log("[Transcript] Success:", result);

      // Transform AssemblyAI response to transcript format
      if (result.text) {
        const transcript = {
          text: result.text,
          segments: result.words?.map((w: { text: string; start: number; end: number }, i: number) => ({
            id: i,
            start: w.start / 1000, // Convert ms to seconds
            end: w.end / 1000,
            text: w.text,
          })) || [],
          language: result.language_code || "unknown",
          duration: result.audio_duration || 0,
          // Include translation if available
          ...(result.translation && {
            translatedText: result.translation.text,
            translatedLanguage: result.translation.language,
          }),
        };

        // Update video with transcript
        video.transcript = transcript;
        // Open transcript viewer immediately
        setViewingTranscriptVideo({ ...video, transcript });
      }
    } catch (error) {
      console.error("[Transcript] Error:", error);
      alert(`Lỗi khi lấy transcript: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      // Remove from fetching set
      setFetchingTranscriptIds((prev) => {
        const next = new Set(prev);
        next.delete(video.id);
        return next;
      });
    }
  };

  // Fetch transcripts for multiple videos (batch)
  const handleFetchTranscripts = async (videosToFetch: VideoData[]) => {
    const assemblyaiKey = getApiKey("assemblyai");
    const apifyToken = getApiKey("apify");

    if (!assemblyaiKey) {
      console.error("[Transcript] AssemblyAI API key not configured");
      alert("Vui lòng cấu hình AssemblyAI API key trong Settings trước khi sử dụng tính năng này.");
      return;
    }

    console.log(`[Transcript Batch] Starting batch fetch for ${videosToFetch.length} videos`);

    // Add all to fetching set
    setFetchingTranscriptIds((prev) => {
      const next = new Set(prev);
      videosToFetch.forEach((v) => next.add(v.id));
      return next;
    });

    // Process sequentially to avoid rate limits
    let successCount = 0;
    let failCount = 0;

    // Get language preferences from config (outside loop for efficiency)
    const config = getConfig();
    const useAutoDetect = config.defaultLanguage === "auto";

    for (const video of videosToFetch) {
      // Use direct videoUrl from sync if available
      const directVideoUrl = video.videoUrl;
      const fallbackUrl = `https://facebook.com/reel/${video.id}`;

      try {
        console.log(`[Transcript Batch] Processing ${video.id}...`, directVideoUrl ? "(has direct URL)" : "(no direct URL)");

        const response = await fetch("/api/transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: fallbackUrl,
            videoUrl: directVideoUrl, // Direct video URL from sync (if available)
            apiKey: assemblyaiKey,
            languageCode: useAutoDetect ? undefined : config.defaultLanguage,
            autoDetect: useAutoDetect,
            translate: config.autoTranslate,
            translateTo: config.translateTargetLang || "vi",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`[Transcript Batch] Error for ${video.id}:`, errorData);
          failCount++;
          continue;
        }

        const result = await response.json();

        if (result.text) {
          const transcript = {
            text: result.text,
            segments: result.words?.map((w: { text: string; start: number; end: number }, i: number) => ({
              id: i,
              start: w.start / 1000,
              end: w.end / 1000,
              text: w.text,
            })) || [],
            language: result.language_code || "unknown",
            duration: result.audio_duration || 0,
            // Include translation if available
            ...(result.translation && {
              translatedText: result.translation.text,
              translatedLanguage: result.translation.language,
            }),
          };

          video.transcript = transcript;
          successCount++;
          console.log(`[Transcript Batch] Success for ${video.id}`);
        }
      } catch (error) {
        console.error(`[Transcript Batch] Error for ${video.id}:`, error);
        failCount++;
      } finally {
        // Remove this video from fetching set
        setFetchingTranscriptIds((prev) => {
          const next = new Set(prev);
          next.delete(video.id);
          return next;
        });
      }
    }

    // Show summary
    alert(`Hoàn thành: ${successCount} thành công, ${failCount} thất bại`);
  };

  const handleSort = (field: typeof sortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Max values for chart scaling - using filtered analytics

  return (
    <div className="space-y-6 pb-24">
      {/* Header with Profile Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <ProfileAvatar profile={profile} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-gray-900">{profile.fullName || profile.username}</h2>
              {profile.isVerified && (
                <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                  </svg>
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">@{profile.username}</p>
            {profile.bio && (
              <p className="text-sm text-gray-600 mt-2 line-clamp-2">{profile.bio}</p>
            )}
          </div>
          <div className="text-right text-sm text-gray-500 flex-shrink-0">
            <p>Last synced</p>
            <p className="font-medium text-gray-700">{formatFullDate(fetchedAt)}</p>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex items-center justify-between gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-4">
          <p>
            <span className="font-medium text-gray-900">{videos.length}</span> Reels
            {posts.length > 0 && (
              <> · <span className="font-medium text-gray-900">{posts.length}</span> Posts</>
            )}
          </p>
        </div>
        <DateRangeFilter
          value={dateRange}
          onChange={setDateRange}
          customDateFrom={customDateFrom}
          customDateTo={customDateTo}
          onCustomDateChange={(from, to) => {
            setCustomDateFrom(from);
            setCustomDateTo(to);
          }}
        />
      </div>

      {/* Active Filters Breadcrumb */}
      {(dateRange !== "all" || selectedHashtag || searchQuery || sortField !== "date") && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Active filters:</span>
          {dateRange !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
              <Calendar className="w-3 h-3" />
              {dateRange === "custom" && customDateFrom && customDateTo
                ? `${customDateFrom} - ${customDateTo}`
                : dateRange}
              <button
                onClick={() => {
                  setDateRange("all");
                  setCustomDateFrom("");
                  setCustomDateTo("");
                }}
                className="ml-1 hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {selectedHashtag && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
              <Hash className="w-3 h-3" />
              {selectedHashtag}
              <button onClick={() => setSelectedHashtag(null)} className="ml-1 hover:text-green-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-100 text-purple-700 text-xs rounded-full">
              <Search className="w-3 h-3" />
              &quot;{searchQuery}&quot;
              <button onClick={() => setSearchQuery("")} className="ml-1 hover:text-purple-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {sortField !== "date" && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
              Sort: {sortField} {sortOrder === "desc" ? "↓" : "↑"}
              <button onClick={() => setSortField("date")} className="ml-1 hover:text-blue-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            onClick={() => {
              setDateRange("all");
              setCustomDateFrom("");
              setCustomDateTo("");
              setSelectedHashtag(null);
              setSearchQuery("");
              setSortField("date");
              setSortOrder("desc");
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline ml-2"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Analytics Dashboard - New Design (4 Tabs) */}
      <AnalyticsDashboard
        videos={filteredVideos}
        posts={filteredPosts}
        profile={profile}
        onDownloadVideos={handleDownloadVideos}
        onViewTranscript={setViewingTranscriptVideo}
        onFetchTranscript={handleFetchTranscript}
        onFetchTranscripts={handleFetchTranscripts}
        fetchingTranscriptIds={fetchingTranscriptIds}
        onExportData={exportToJson}
        onSync={onSync}
        isSyncing={isSyncing}
      />

      {/* Transcript Viewer Dialog */}
      {viewingTranscriptVideo?.transcript && (
        <TranscriptViewerDialog
          transcript={viewingTranscriptVideo.transcript}
          videoTitle={viewingTranscriptVideo.caption || "Untitled Video"}
          onClose={() => setViewingTranscriptVideo(null)}
        />
      )}

      {/* Video Download Dialog */}
      {downloadingVideos.length > 0 && (
        <VideoDownloadDialog
          videos={downloadingVideos}
          onClose={() => setDownloadingVideos([])}
        />
      )}
    </div>
  );
}

// Profile Avatar Component
function ProfileAvatar({ profile, size = "md" }: { profile: { username: string; avatar: string }; size?: "sm" | "md" | "lg" }) {
  const [hasError, setHasError] = useState(false);
  const proxiedAvatar = getProxiedImageUrl(profile.avatar);

  const sizeClasses = {
    sm: "w-10 h-10 text-sm",
    md: "w-14 h-14 text-xl",
    lg: "w-16 h-16 text-2xl",
  };

  if (!profile.avatar || hasError) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white font-bold flex-shrink-0`}>
        {profile.username.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={proxiedAvatar}
      alt={profile.username}
      className={`${sizeClasses[size]} rounded-full object-cover border-2 border-gray-100 flex-shrink-0`}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  );
}

// Animated Number Component - smooth transitions on value change
function AnimatedNumber({ value, className = "" }: { value: string; className?: string }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      setIsAnimating(true);
      // Short delay to trigger CSS transition
      const timer = setTimeout(() => {
        setDisplayValue(value);
        setIsAnimating(false);
      }, 150);
      prevValueRef.current = value;
      return () => clearTimeout(timer);
    }
  }, [value]);

  return (
    <span className={`inline-block transition-all duration-300 ${isAnimating ? "opacity-50 scale-95" : "opacity-100 scale-100"} ${className}`}>
      {displayValue}
    </span>
  );
}

// Simple Line Chart Component with click-to-select support
function SimpleLineChart({
  data,
  onPointClick,
  onPointSelect,
  selectedId
}: {
  data: Array<{ id: string; date: string; views: number; likes: number; comments: number; saves: number }>;
  onPointClick?: (id: string) => void;
  onPointSelect?: (id: string | null) => void;
  selectedId?: string | null;
}) {
  if (data.length === 0) return null;

  const maxViews = Math.max(...data.map((d) => d.views), 1);
  const maxLikes = Math.max(...data.map((d) => d.likes), 1);
  const maxComments = Math.max(...data.map((d) => d.comments), 1);
  const maxSaves = Math.max(...data.map((d) => d.saves), 1);

  const step = Math.max(1, Math.floor(data.length / 15));
  const sampledData = data.filter((_, i) => i % step === 0);

  const generatePath = (values: number[], max: number) => {
    if (sampledData.length < 2) return "";
    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 100 - (v / max) * 100;
      return `${x},${y}`;
    });
    return `M ${points.join(" L ")}`;
  };

  const commentsPath = generatePath(sampledData.map(d => d.comments), maxComments);
  const likesPath = generatePath(sampledData.map(d => d.likes), maxLikes);
  const viewsPath = generatePath(sampledData.map(d => d.views), maxViews);
  const savesPath = generatePath(sampledData.map(d => d.saves), maxSaves);

  return (
    <div className="relative h-full w-full">
      <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-gray-400">
        <span>{formatCompact(maxComments)}</span>
        <span>{formatCompact(Math.floor(maxComments * 0.75))}</span>
        <span>{formatCompact(Math.floor(maxComments * 0.5))}</span>
        <span>{formatCompact(Math.floor(maxComments * 0.25))}</span>
        <span>0</span>
      </div>

      <div className="absolute left-14 right-0 top-0 bottom-8">
        <div className="absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="border-t border-gray-100 w-full" />
          ))}
        </div>

        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={commentsPath} fill="none" stroke="#3B82F6" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          <path d={likesPath} fill="none" stroke="#EC4899" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          <path d={viewsPath} fill="none" stroke="#8B5CF6" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          <path d={savesPath} fill="none" stroke="#F59E0B" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        </svg>

        <div className="absolute inset-0 flex justify-between items-end">
          {sampledData.map((d, i) => {
            const commentsY = (d.comments / maxComments) * 100;
            const likesY = (d.likes / maxLikes) * 100;
            const viewsY = (d.views / maxViews) * 100;
            const savesY = (d.saves / maxSaves) * 100;
            const isSelected = selectedId === d.id;
            return (
              <div
                key={i}
                className={`relative h-full flex-1 group cursor-pointer`}
                onClick={() => {
                  // Toggle selection: click again to deselect
                  if (isSelected) {
                    onPointSelect?.(null);
                  } else {
                    onPointSelect?.(d.id);
                    onPointClick?.(d.id);
                  }
                }}
              >
                <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 ${isSelected ? 'block' : 'hidden group-hover:block'}`}>
                  <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                    <div>{d.date}</div>
                    <div className="text-purple-300">Views: {formatCompact(d.views)}</div>
                    <div className="text-blue-300">Likes: {formatCompact(d.likes)}</div>
                    <div className="text-blue-300">Comments: {formatCompact(d.comments)}</div>
                    <div className="text-amber-300">Saves: {formatCompact(d.saves)}</div>
                    <div className="text-green-300 mt-1">{isSelected ? 'Click to deselect' : 'Click to select'}</div>
                  </div>
                </div>
                <div className={`absolute rounded-full bg-blue-500 -translate-x-1/2 transition-all ${isSelected ? 'w-4 h-4 ring-2 ring-blue-300' : 'w-2 h-2 group-hover:w-3 group-hover:h-3'}`} style={{ bottom: `${commentsY}%`, left: '50%' }} />
                <div className={`absolute rounded-full bg-blue-500 -translate-x-1/2 transition-all ${isSelected ? 'w-4 h-4 ring-2 ring-blue-300' : 'w-2 h-2 group-hover:w-3 group-hover:h-3'}`} style={{ bottom: `${likesY}%`, left: '50%' }} />
                <div className={`absolute rounded-full bg-cyan-500 -translate-x-1/2 transition-all ${isSelected ? 'w-4 h-4 ring-2 ring-purple-300' : 'w-2 h-2 group-hover:w-3 group-hover:h-3'}`} style={{ bottom: `${viewsY}%`, left: '50%' }} />
                <div className={`absolute rounded-full bg-amber-500 -translate-x-1/2 transition-all ${isSelected ? 'w-4 h-4 ring-2 ring-amber-300' : 'w-2 h-2 group-hover:w-3 group-hover:h-3'}`} style={{ bottom: `${savesY}%`, left: '50%' }} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="absolute left-14 right-0 bottom-0 h-6 flex justify-between text-xs text-gray-400">
        {sampledData.filter((_, i) => i % Math.ceil(sampledData.length / 6) === 0 || i === sampledData.length - 1).map((d, i) => (
          <span key={i}>{d.date}</span>
        ))}
      </div>
    </div>
  );
}

function formatCompact(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(0)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
}

// Simple Posts Chart Component (no views, only likes and comments) with click-to-select support
function SimplePostsChart({
  data,
  onPointClick,
  onPointSelect,
  selectedId
}: {
  data: Array<{ id: string; date: string; likes: number; comments: number }>;
  onPointClick?: (id: string) => void;
  onPointSelect?: (id: string | null) => void;
  selectedId?: string | null;
}) {
  if (data.length === 0) return null;

  const maxLikes = Math.max(...data.map((d) => d.likes), 1);
  const maxComments = Math.max(...data.map((d) => d.comments), 1);

  const step = Math.max(1, Math.floor(data.length / 15));
  const sampledData = data.filter((_, i) => i % step === 0);

  const generatePath = (values: number[], max: number) => {
    if (sampledData.length < 2) return "";
    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 100 - (v / max) * 100;
      return `${x},${y}`;
    });
    return `M ${points.join(" L ")}`;
  };

  const commentsPath = generatePath(sampledData.map(d => d.comments), maxComments);
  const likesPath = generatePath(sampledData.map(d => d.likes), maxLikes);

  return (
    <div className="relative h-full w-full">
      <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-gray-400">
        <span>{formatCompact(maxLikes)}</span>
        <span>{formatCompact(Math.floor(maxLikes * 0.75))}</span>
        <span>{formatCompact(Math.floor(maxLikes * 0.5))}</span>
        <span>{formatCompact(Math.floor(maxLikes * 0.25))}</span>
        <span>0</span>
      </div>

      <div className="absolute left-14 right-0 top-0 bottom-8">
        <div className="absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="border-t border-gray-100 w-full" />
          ))}
        </div>

        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={commentsPath} fill="none" stroke="#3B82F6" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          <path d={likesPath} fill="none" stroke="#EC4899" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        </svg>

        <div className="absolute inset-0 flex justify-between items-end">
          {sampledData.map((d, i) => {
            const commentsY = (d.comments / maxComments) * 100;
            const likesY = (d.likes / maxLikes) * 100;
            const isSelected = selectedId === d.id;
            return (
              <div
                key={i}
                className={`relative h-full flex-1 group cursor-pointer`}
                onClick={() => {
                  // Toggle selection: click again to deselect
                  if (isSelected) {
                    onPointSelect?.(null);
                  } else {
                    onPointSelect?.(d.id);
                    onPointClick?.(d.id);
                  }
                }}
              >
                <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 ${isSelected ? 'block' : 'hidden group-hover:block'}`}>
                  <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                    <div>{d.date}</div>
                    <div className="text-blue-300">Likes: {formatCompact(d.likes)}</div>
                    <div className="text-blue-300">Comments: {formatCompact(d.comments)}</div>
                    <div className="text-green-300 mt-1">{isSelected ? 'Click to deselect' : 'Click to select'}</div>
                  </div>
                </div>
                <div className={`absolute rounded-full bg-blue-500 -translate-x-1/2 transition-all ${isSelected ? 'w-4 h-4 ring-2 ring-blue-300' : 'w-2 h-2 group-hover:w-3 group-hover:h-3'}`} style={{ bottom: `${commentsY}%`, left: '50%' }} />
                <div className={`absolute rounded-full bg-blue-500 -translate-x-1/2 transition-all ${isSelected ? 'w-4 h-4 ring-2 ring-blue-300' : 'w-2 h-2 group-hover:w-3 group-hover:h-3'}`} style={{ bottom: `${likesY}%`, left: '50%' }} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="absolute left-14 right-0 bottom-0 h-6 flex justify-between text-xs text-gray-400">
        {sampledData.filter((_, i) => i % Math.ceil(sampledData.length / 6) === 0 || i === sampledData.length - 1).map((d, i) => (
          <span key={i}>{d.date}</span>
        ))}
      </div>
    </div>
  );
}

// Rate Card Component - compact card for rate metrics
function RateCard({
  icon,
  label,
  value,
  description,
  color,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
  color: "pink" | "blue" | "amber" | "green";
  trend?: "up" | "down" | "stable";
}) {
  const colorClasses = {
    pink: "from-blue-500 to-rose-500 bg-blue-50 text-blue-600",
    blue: "from-blue-500 to-indigo-500 bg-blue-50 text-blue-600",
    amber: "from-amber-500 to-orange-500 bg-amber-50 text-amber-600",
    green: "from-green-500 to-emerald-500 bg-green-50 text-green-600",
  };
  const trendIcons = {
    up: "↑",
    down: "↓",
    stable: "→",
  };
  const trendColors = {
    up: "text-green-500",
    down: "text-red-500",
    stable: "text-gray-400",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${colorClasses[color].split(" ")[1]} ${colorClasses[color].split(" ")[2]}`}>
          {icon}
        </div>
        {trend && (
          <span className={`text-sm font-medium ${trendColors[trend]}`}>
            {trendIcons[trend]}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <p className="text-xs text-gray-400 mt-1">{description}</p>
    </div>
  );
}

// Content Mix Donut Chart Component - With hover tooltips
function ContentMixDonut({
  data,
}: {
  data: {
    reels: { count: number; engagement: number };
    carousel: { count: number; engagement: number };
    single: { count: number; engagement: number };
    total: number;
  };
}) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const { reels, carousel, single, total } = data;

  // Calculate percentages based on engagement
  const reelsPercent = total > 0 ? (reels.engagement / total) * 100 : 0;
  const carouselPercent = total > 0 ? (carousel.engagement / total) * 100 : 0;
  const singlePercent = total > 0 ? (single.engagement / total) * 100 : 0;

  // SVG donut chart
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  // Calculate stroke dash arrays for each segment
  const reelsStroke = (reelsPercent / 100) * circumference;
  const carouselStroke = (carouselPercent / 100) * circumference;
  const singleStroke = (singlePercent / 100) * circumference;

  // Calculate offsets - segments stack on top of each other
  const reelsOffset = 0;
  const carouselOffset = -reelsStroke;
  const singleOffset = -(reelsStroke + carouselStroke);

  if (total === 0) {
    return (
      <div className="w-32 h-32 flex items-center justify-center text-gray-400 text-sm">
        No data
      </div>
    );
  }

  const segments = [
    { key: "reels", label: "Reels", count: reels.count, engagement: reels.engagement, percent: reelsPercent, stroke: reelsStroke, offset: reelsOffset, color: "#EC4899" },
    { key: "carousel", label: "Multi-Post", count: carousel.count, engagement: carousel.engagement, percent: carouselPercent, stroke: carouselStroke, offset: carouselOffset, color: "#8B5CF6" },
    { key: "single", label: "Single Post", count: single.count, engagement: single.engagement, percent: singlePercent, stroke: singleStroke, offset: singleOffset, color: "#3B82F6" },
  ];

  return (
    <div className="relative w-32 h-32 group">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="12" />
        {/* Render segments */}
        {segments.map((seg) => seg.stroke > 0 && (
          <circle
            key={seg.key}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={hoveredSegment === seg.key ? "16" : "12"}
            strokeDasharray={`${seg.stroke} ${circumference}`}
            strokeDashoffset={seg.offset}
            className="transition-all duration-200 cursor-pointer hover:opacity-90"
            style={{ pointerEvents: 'stroke' }}
            onMouseEnter={() => setHoveredSegment(seg.key)}
            onMouseLeave={() => setHoveredSegment(null)}
          />
        ))}
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-gray-900">{formatCompact(total)}</span>
        <span className="text-xs text-gray-500">Total Eng.</span>
      </div>
      {/* Hover tooltip - always visible when segment hovered */}
      {hoveredSegment && (() => {
        const seg = segments.find(s => s.key === hoveredSegment);
        if (!seg) return null;
        return (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 -translate-y-full z-30 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap pointer-events-none">
            <div className="font-semibold text-sm" style={{ color: seg.color }}>{seg.label}</div>
            <div className="text-gray-200 mt-1">
              <div>{seg.percent.toFixed(1)}% of total engagement</div>
              <div>{seg.count} posts</div>
              <div>{formatCompact(seg.engagement)} engagement</div>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
          </div>
        );
      })()}
    </div>
  );
}

// Content Mix Legend Item
function ContentMixLegend({
  label,
  count,
  engagement,
  total,
  color,
}: {
  label: string;
  count: number;
  engagement: number;
  total: number;
  color: string;
}) {
  const percent = total > 0 ? ((engagement / total) * 100).toFixed(1) : "0.0";

  return (
    <div className="flex items-center gap-3">
      <div className={`w-3 h-3 rounded-full ${color} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-sm font-bold text-gray-900">{percent}%</span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{count} posts</span>
          <span>{formatCompact(engagement)} eng.</span>
        </div>
      </div>
    </div>
  );
}

// Posting Days Bar Chart Component

// Content Mix Legend Row - Table format with hover
function ContentMixLegendRow({
  label,
  count,
  engagement,
  total,
  color,
}: {
  label: string;
  count: number;
  engagement: number;
  total: number;
  color: string;
}) {
  // Use count-based percentage, not engagement-based
  const percent = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";

  return (
    <div className="grid grid-cols-4 gap-2 py-1.5 px-1 rounded hover:bg-gray-50 transition-colors cursor-default group">
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${color} flex-shrink-0`} />
        <span className="text-sm text-gray-700 truncate group-hover:text-gray-900">{label}</span>
      </div>
      <span className="text-sm text-gray-600 text-right">{count}</span>
      <span className="text-sm text-gray-600 text-right">{formatCompact(engagement)}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{percent}%</span>
    </div>
  );
}

// Content Mix Donut Chart V2 - Count-based (not engagement-based)
function ContentMixDonutV2({
  data,
}: {
  data: {
    groups: Record<string, { count: number; engagement: number }>;
    totalPosts: number;
    totalEngagement: number;
  };
}) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const { groups, totalPosts } = data;

  if (totalPosts === 0) {
    return (
      <div className="w-32 h-32 flex items-center justify-center text-gray-400 text-sm">
        No data
      </div>
    );
  }

  // Build segments from groups - sorted by count
  const sortedTypes = Object.entries(groups)
    .filter(([, g]) => g.count > 0)
    .sort((a, b) => b[1].count - a[1].count);

  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  // Calculate segments with cumulative offsets
  let cumulativeOffset = 0;
  const segments = sortedTypes.map(([type, group]) => {
    const percent = (group.count / totalPosts) * 100;
    const stroke = (percent / 100) * circumference;
    const offset = -cumulativeOffset;
    cumulativeOffset += stroke;

    return {
      key: type,
      label: CONTENT_TYPE_CONFIG[type]?.label || type,
      count: group.count,
      engagement: group.engagement,
      percent,
      stroke,
      offset,
      color: CONTENT_TYPE_CONFIG[type]?.color || "#6B7280",
    };
  });

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="12" />
        {/* Render segments */}
        {segments.map((seg) => seg.stroke > 0 && (
          <circle
            key={seg.key}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={hoveredSegment === seg.key ? "16" : "12"}
            strokeDasharray={`${seg.stroke} ${circumference}`}
            strokeDashoffset={seg.offset}
            className="transition-all duration-200 cursor-pointer"
            style={{ pointerEvents: "stroke" }}
            onMouseEnter={() => setHoveredSegment(seg.key)}
            onMouseLeave={() => setHoveredSegment(null)}
          />
        ))}
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-gray-900">{totalPosts}</span>
        <span className="text-xs text-gray-500">Total</span>
      </div>
      {/* Hover tooltip */}
      {hoveredSegment && (() => {
        const seg = segments.find(s => s.key === hoveredSegment);
        if (!seg) return null;
        return (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 -translate-y-full z-30 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap pointer-events-none">
            <div className="font-semibold text-sm" style={{ color: seg.color }}>{seg.label}</div>
            <div className="text-gray-200 mt-1">
              <div>{seg.percent.toFixed(1)}% of posts</div>
              <div>{seg.count} posts</div>
              <div>{formatCompact(seg.engagement)} engagement</div>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
          </div>
        );
      })()}
    </div>
  );
}

// Stacked Horizontal Bar Chart for Posting Days
function StackedPostingDaysChart({
  data,
  bestDay,
}: {
  data: Array<{
    day: string;
    reels: number;
    singleImage: number;
    multiImage: number;
    video: number;
    text: number;
    link: number;
    total: number;
    engagement: number;
    avgEngagement: number;
  }>;
  bestDay?: string;
}) {
  const maxTotal = Math.max(...data.map(d => d.total), 1);

  return (
    <div className="space-y-2">
      {data.map((item) => {
        const isBest = item.day === bestDay && item.total > 0;
        const barWidth = (item.total / maxTotal) * 100;

        // Calculate segment widths as percentage of total for this day
        const getWidth = (count: number) => item.total > 0 ? (count / item.total) * 100 : 0;

        return (
          <div key={item.day} className="group">
            <div className="flex items-center gap-2">
              {/* Day label */}
              <span className={`w-8 text-xs font-medium ${isBest ? "text-green-600" : "text-gray-600"}`}>
                {item.day}
              </span>
              {/* Stacked bar container */}
              <div className="flex-1 relative">
                <div
                  className="h-6 rounded-md overflow-hidden flex bg-gray-100"
                  style={{ width: `${Math.max(barWidth, 5)}%` }}
                >
                  {/* Reels - Pink */}
                  {item.reels > 0 && (
                    <div
                      className="h-full bg-pink-500 transition-all"
                      style={{ width: `${getWidth(item.reels)}%` }}
                      title={`Reels: ${item.reels}`}
                    />
                  )}
                  {/* Single Image - Blue */}
                  {item.singleImage > 0 && (
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${getWidth(item.singleImage)}%` }}
                      title={`Single Image: ${item.singleImage}`}
                    />
                  )}
                  {/* Multi Image - Violet */}
                  {item.multiImage > 0 && (
                    <div
                      className="h-full bg-violet-500 transition-all"
                      style={{ width: `${getWidth(item.multiImage)}%` }}
                      title={`Multi Image: ${item.multiImage}`}
                    />
                  )}
                  {/* Video - Amber */}
                  {item.video > 0 && (
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{ width: `${getWidth(item.video)}%` }}
                      title={`Video: ${item.video}`}
                    />
                  )}
                  {/* Text/Link - Gray */}
                  {(item.text + item.link) > 0 && (
                    <div
                      className="h-full bg-gray-400 transition-all"
                      style={{ width: `${getWidth(item.text + item.link)}%` }}
                      title={`Text/Link: ${item.text + item.link}`}
                    />
                  )}
                </div>
                {/* Hover tooltip */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-10">
                  <div className="bg-gray-900 text-white text-xs rounded px-2 py-1.5 whitespace-nowrap">
                    <div className="font-medium border-b border-gray-700 pb-1 mb-1">{item.day} - {item.total} posts</div>
                    {item.reels > 0 && <div className="text-pink-300">Reels: {item.reels}</div>}
                    {item.singleImage > 0 && <div className="text-blue-300">Single Image: {item.singleImage}</div>}
                    {item.multiImage > 0 && <div className="text-violet-300">Multi Image: {item.multiImage}</div>}
                    {item.video > 0 && <div className="text-amber-300">Video: {item.video}</div>}
                    {(item.text + item.link) > 0 && <div className="text-gray-300">Text/Link: {item.text + item.link}</div>}
                    <div className="border-t border-gray-700 pt-1 mt-1">Avg Eng: {formatCompact(item.avgEngagement)}</div>
                  </div>
                </div>
              </div>
              {/* Total count */}
              <span className={`w-6 text-xs text-right ${isBest ? "font-bold text-green-600" : "text-gray-500"}`}>
                {item.total}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PostingDaysChart({
  data,
  bestDay,
}: {
  data: Array<{ day: string; engagement: number; count: number; avgEngagement: number }>;
  bestDay?: string;
}) {
  const maxAvg = Math.max(...data.map((d) => d.avgEngagement), 1);
  const chartHeight = 120;

  return (
    <div className="flex items-end justify-between gap-2" style={{ height: chartHeight + 24 }}>
      {data.map((item) => {
        const barHeight = maxAvg > 0 ? (item.avgEngagement / maxAvg) * chartHeight : 0;
        const isBest = item.day === bestDay && item.count > 0;

        return (
          <div key={item.day} className="flex-1 flex flex-col items-center">
            {/* Bar container */}
            <div className="relative group w-full flex items-end justify-center" style={{ height: chartHeight }}>
              <div
                className={`w-full max-w-10 rounded-t-lg transition-all duration-300 ${
                  isBest
                    ? "bg-gradient-to-t from-green-500 to-green-400"
                    : item.count > 0
                    ? "bg-gradient-to-t from-blue-500 to-blue-400"
                    : "bg-gray-200"
                }`}
                style={{ height: Math.max(barHeight, 4) }}
              />
              {/* Hover tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                  <div className="font-medium">{item.day}</div>
                  <div>{item.count} posts</div>
                  <div>Avg: {formatCompact(item.avgEngagement)}</div>
                  <div>Total: {formatCompact(item.engagement)}</div>
                </div>
              </div>
            </div>
            {/* Day label */}
            <span className={`text-xs ${isBest ? "font-bold text-green-600" : "text-gray-500"}`}>
              {item.day}
            </span>
          </div>
        );
      })}
    </div>
  );
}


// Engagement Distribution Chart V3 - Score-based (Reactions + Shares + Comments)
function EngagementDistributionChart({
  data,
}: {
  data: {
    reels: { count: number; score: number };
    image: { count: number; score: number };
    post: { count: number; score: number };
    totalScore: number;
    totalPosts: number;
  };
}) {
  const { reels, image, post, totalScore } = data;

  const items = [
    { key: "reels", label: "Reels", score: reels.score, count: reels.count, color: "#EC4899" },
    { key: "image", label: "Image", score: image.score, count: image.count, color: "#3B82F6" },
    { key: "post", label: "Post", score: post.score, count: post.count, color: "#10B981" },
  ].filter(item => item.count > 0);

  const maxScore = Math.max(...items.map(i => i.score), 1);

  if (items.length === 0) {
    return <div className="text-center text-gray-400 py-4">No score data</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const barWidth = maxScore > 0 ? (item.score / maxScore) * 100 : 0;
        const avgScore = item.count > 0 ? Math.round(item.score / item.count) : 0;
        const sharePercent = totalScore > 0 ? ((item.score / totalScore) * 100).toFixed(1) : "0";

        return (
          <div key={item.key} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{sharePercent}%</span>
                <span className="text-sm font-semibold text-gray-900">{formatCompact(item.score)}</span>
              </div>
            </div>
            <div className="relative">
              <div className="h-5 rounded-md bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-md transition-all duration-500"
                  style={{ width: `${Math.max(barWidth, 2)}%`, backgroundColor: item.color }}
                />
              </div>
              {/* Hover tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                  <div className="font-medium" style={{ color: item.color }}>{item.label}</div>
                  <div>{item.count} posts</div>
                  <div>Total Score: {formatCompact(item.score)}</div>
                  <div>Avg: {formatCompact(avgScore)}/post</div>
                  <div>Share: {sharePercent}%</div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}




// Content Mix Donut Chart V3 - Score-based with beautiful hover (like reference)
function ContentMixDonutV3({
  data,
}: {
  data: {
    reels: { count: number; score: number };
    image: { count: number; score: number };
    post: { count: number; score: number };
    totalScore: number;
    totalPosts: number;
  };
}) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const { reels, image, post, totalScore } = data;

  if (totalScore === 0) {
    return (
      <div className="w-40 h-40 flex items-center justify-center text-gray-400 text-sm">
        No data
      </div>
    );
  }

  const radius = 50;
  const innerRadius = 30;
  const circumference = 2 * Math.PI * radius;

  // Calculate percentages based on score
  const reelsPercent = (reels.score / totalScore) * 100;
  const imagePercent = (image.score / totalScore) * 100;
  const postPercent = (post.score / totalScore) * 100;

  // Calculate strokes
  const reelsStroke = (reelsPercent / 100) * circumference;
  const imageStroke = (imagePercent / 100) * circumference;
  const postStroke = (postPercent / 100) * circumference;

  // Offsets
  let offset = 0;
  const segments = [
    { key: "reels", label: "Reels", count: reels.count, score: reels.score, percent: reelsPercent, stroke: reelsStroke, offset: -offset, color: "#EC4899" },
  ];
  offset += reelsStroke;
  segments.push({ key: "image", label: "Image", count: image.count, score: image.score, percent: imagePercent, stroke: imageStroke, offset: -offset, color: "#3B82F6" });
  offset += imageStroke;
  segments.push({ key: "post", label: "Post", count: post.count, score: post.score, percent: postPercent, stroke: postStroke, offset: -offset, color: "#10B981" });

  const hoveredSeg = segments.find(s => s.key === hoveredSegment);

  return (
    <div className="relative w-48 h-48">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
        {/* Background circle */}
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="20" />
        {/* Render segments */}
        {segments.filter(seg => seg.stroke > 0).map((seg) => (
          <circle
            key={seg.key}
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={hoveredSegment === seg.key ? "24" : "20"}
            strokeDasharray={`${seg.stroke} ${circumference}`}
            strokeDashoffset={seg.offset}
            className="transition-all duration-200 cursor-pointer"
            style={{ pointerEvents: "stroke" }}
            onMouseEnter={() => setHoveredSegment(seg.key)}
            onMouseLeave={() => setHoveredSegment(null)}
          />
        ))}
      </svg>
      {/* Center content - shows hovered data or total */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {hoveredSeg ? (
          <>
            <span className="text-lg font-bold" style={{ color: hoveredSeg.color }}>{hoveredSeg.label}</span>
            <span className="text-2xl font-bold text-gray-900">{formatCompact(hoveredSeg.score)}</span>
            <span className="text-xs text-gray-500">{hoveredSeg.count} posts ({hoveredSeg.percent.toFixed(1)}%)</span>
          </>
        ) : (
          <>
            <span className="text-sm text-gray-500">Total Score</span>
            <span className="text-2xl font-bold text-gray-900">{formatCompact(totalScore)}</span>
            <span className="text-xs text-gray-500">{data.totalPosts} posts</span>
          </>
        )}
      </div>
    </div>
  );
}

// Stacked Posting Days Chart V2 - Simplified 3 categories with labels on segments
function StackedPostingDaysChartV2({
  data,
  bestDay,
}: {
  data: Array<{
    day: string;
    reels: number;
    reelsScore: number;
    image: number;
    imageScore: number;
    post: number;
    postScore: number;
    total: number;
    totalScore: number;
  }>;
  bestDay?: string;
}) {
  const maxScore = Math.max(...data.map(d => d.totalScore), 1);

  return (
    <div className="space-y-2">
      {data.map((item) => {
        const isBest = item.day === bestDay && item.totalScore > 0;
        const barWidth = (item.totalScore / maxScore) * 100;

        // Calculate segment widths
        const reelsWidth = item.totalScore > 0 ? (item.reelsScore / item.totalScore) * 100 : 0;
        const imageWidth = item.totalScore > 0 ? (item.imageScore / item.totalScore) * 100 : 0;
        const postWidth = item.totalScore > 0 ? (item.postScore / item.totalScore) * 100 : 0;

        return (
          <div key={item.day} className="group">
            <div className="flex items-center gap-3">
              {/* Day label */}
              <span className={`w-8 text-xs font-medium ${isBest ? "text-green-600" : "text-gray-600"}`}>
                {item.day}
              </span>
              {/* Stacked bar */}
              <div className="flex-1">
                <div
                  className="h-7 rounded-md overflow-hidden flex transition-all duration-300"
                  style={{ width: `${Math.max(barWidth, 8)}%` }}
                >
                  {/* Reels - Pink */}
                  {item.reelsScore > 0 && (
                    <div
                      className="h-full bg-pink-500 flex items-center justify-center relative group/seg"
                      style={{ width: `${reelsWidth}%`, minWidth: reelsWidth > 10 ? "auto" : "0" }}
                    >
                      {reelsWidth > 15 && (
                        <span className="text-[10px] font-medium text-white">{item.reels}</span>
                      )}
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover/seg:block z-10 pointer-events-none">
                        <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                          Reels: {item.reels} ({formatCompact(item.reelsScore)} pts)
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Image - Blue */}
                  {item.imageScore > 0 && (
                    <div
                      className="h-full bg-blue-500 flex items-center justify-center relative group/seg"
                      style={{ width: `${imageWidth}%`, minWidth: imageWidth > 10 ? "auto" : "0" }}
                    >
                      {imageWidth > 15 && (
                        <span className="text-[10px] font-medium text-white">{item.image}</span>
                      )}
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover/seg:block z-10 pointer-events-none">
                        <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                          Image: {item.image} ({formatCompact(item.imageScore)} pts)
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Post - Emerald */}
                  {item.postScore > 0 && (
                    <div
                      className="h-full bg-emerald-500 flex items-center justify-center relative group/seg"
                      style={{ width: `${postWidth}%`, minWidth: postWidth > 10 ? "auto" : "0" }}
                    >
                      {postWidth > 15 && (
                        <span className="text-[10px] font-medium text-white">{item.post}</span>
                      )}
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover/seg:block z-10 pointer-events-none">
                        <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                          Post: {item.post} ({formatCompact(item.postScore)} pts)
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Empty state */}
                  {item.totalScore === 0 && (
                    <div className="h-full bg-gray-200 w-full" />
                  )}
                </div>
              </div>
              {/* Total score */}
              <span className={`w-12 text-xs text-right ${isBest ? "font-bold text-green-600" : "text-gray-500"}`}>
                {formatCompact(item.totalScore)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}


// Reactions Breakdown Chart Component - Shows Facebook reactions breakdown (Like, Love, Haha, Wow, Sad, Angry, Care)
function ReactionsBreakdownChart({
  data,
}: {
  data: {
    like: number;
    love: number;
    haha: number;
    wow: number;
    sad: number;
    angry: number;
    care: number;
  };
}) {
  const total = data.like + data.love + data.haha + data.wow + data.sad + data.angry + data.care;
  if (total === 0) return <div className="text-center text-gray-400 py-4">No reaction data</div>;

  const items = [
    { label: "Like", value: data.like, emoji: "👍", color: "bg-blue-500" },
    { label: "Love", value: data.love, emoji: "❤️", color: "bg-red-500" },
    { label: "Haha", value: data.haha, emoji: "😆", color: "bg-yellow-500" },
    { label: "Wow", value: data.wow, emoji: "😮", color: "bg-yellow-400" },
    { label: "Sad", value: data.sad, emoji: "😢", color: "bg-yellow-600" },
    { label: "Angry", value: data.angry, emoji: "😡", color: "bg-orange-500" },
    { label: "Care", value: data.care, emoji: "🤗", color: "bg-pink-400" },
  ].filter(item => item.value > 0);

  const maxValue = Math.max(...items.map(i => i.value), 1);

  return (
    <div className="space-y-3">
      {/* Horizontal bar chart */}
      {items.map((item) => {
        const barWidth = (item.value / maxValue) * 100;
        const percent = ((item.value / total) * 100).toFixed(1);

        return (
          <div key={item.label} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">{item.emoji}</span>
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{formatCompact(item.value)}</span>
                <span className="text-xs text-gray-400">({percent}%)</span>
              </div>
            </div>
            <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${item.color} transition-all duration-500`}
                style={{ width: `${Math.max(barWidth, 2)}%` }}
              />
              {/* Hover tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap text-center">
                  <div className="flex items-center gap-1 justify-center">
                    <span className="text-base">{item.emoji}</span>
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <div>{formatCompact(item.value)} ({percent}%)</div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Summary */}
      <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-sm text-gray-500">Total Reactions</span>
        <span className="font-semibold text-gray-900">{formatCompact(total)}</span>
      </div>
    </div>
  );
}
