"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  Line,
} from "recharts";
import {
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Search,
  CheckSquare,
  Square,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  Mic,
  Sparkles,
  Play,
  Image as ImageIcon,
} from "lucide-react";
import type { VideoData, PostData, ChannelProfile } from "@/lib/types/channel-project";
import { classifyTopics, detectTopicKeyword, isAIClassificationAvailable } from "@/lib/ai-classify";

// ============================================
// TYPES
// ============================================

interface ProcessedPost {
  postId: string;
  date: string;
  time: string;
  text: string;
  format: "reel" | "photo" | "video" | "text";
  mediaCount: number;
  likes: number;
  comments: number;
  shares: number;
  views: number | null;
  duration: number | null;
  hashtags: string[];
  topic: string;
  // Computed
  engagement: number;
  shortTitle: string;
  viewEngagementRate: string | null;
  durationMin: string | null;
  // Media & URL
  thumbnail: string;
  url: string;
}

interface AnalyticsDashboardProps {
  videos: VideoData[];
  posts: PostData[];
  profile: ChannelProfile;
  // Action callbacks for Details tab
  onDownloadVideos?: (videos: VideoData[]) => void;
  onViewTranscript?: (video: VideoData) => void;
  onFetchTranscript?: (video: VideoData) => void;
  onFetchTranscripts?: (videos: VideoData[]) => void; // Batch transcript fetch
  onExportData?: () => void;
  onSync?: () => void;
  isSyncing?: boolean;
  fetchingTranscriptIds?: Set<string>; // Track which videos are being transcribed
}

// ============================================
// COLORS
// ============================================

const FORMAT_COLORS: Record<string, string> = {
  Reel: "#EC4899",
  Photo: "#3B82F6",
  Video: "#F59E0B",
  Text: "#6B7280",
};

const TOPIC_COLORS: Record<string, string> = {
  "General": "#8B5CF6",
  "Entertainment": "#06B6D4",
  "Education": "#F59E0B",
  "Business": "#EC4899",
  "Lifestyle": "#10B981",
};

const CHART_COLORS = ["#EC4899", "#3B82F6", "#F59E0B", "#10B981", "#8B5CF6", "#06B6D4"];

// Distinct colors for each reaction - no duplicates
const REACTION_COLORS: Record<string, string> = {
  Like: "#1877F2",   // Facebook blue
  Love: "#E4405F",   // Red/pink heart
  Care: "#F7B928",   // Yellow/orange hug
  Haha: "#FBBF24",   // Bright yellow laugh - distinct from Care
  Wow: "#A855F7",    // Purple surprise
  Sad: "#3B82F6",    // Blue sad
  Angry: "#DC2626",  // Red angry - distinct from Love
};

// ============================================
// MAIN COMPONENT
// ============================================

export function AnalyticsDashboard({
  videos,
  posts,
  profile,
  onDownloadVideos,
  onViewTranscript,
  onFetchTranscript,
  onFetchTranscripts,
  onExportData,
  onSync,
  isSyncing = false,
  fetchingTranscriptIds = new Set(),
}: AnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "formats" | "details" | "analysis">("overview");
  const [sortField, setSortField] = useState<keyof ProcessedPost>("engagement");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const [filterFormat, setFilterFormat] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedRankingIds, setExpandedRankingIds] = useState<Set<string>>(new Set());

  // AI Topic Classification state
  const [aiTopics, setAiTopics] = useState<Map<string, { topic: string; confidence: number; keywords: string[] }>>(new Map());
  const [isClassifying, setIsClassifying] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);

  // Zoom state for timeline charts with multi-level zoom
  // Zoom levels: "all" -> "week" -> "3days" -> "day" -> "12hours" -> "6hours"
  type ZoomLevel = "all" | "week" | "3days" | "day" | "12hours" | "6hours";
  const ZOOM_LEVELS: ZoomLevel[] = ["all", "week", "3days", "day", "12hours", "6hours"];
  const [dailyZoomLevel, setDailyZoomLevel] = useState<ZoomLevel>("all");
  const [dailyZoomCenter, setDailyZoomCenter] = useState<number>(0);
  const [reactionZoomLevel, setReactionZoomLevel] = useState<ZoomLevel>("all");
  const [reactionZoomCenter, setReactionZoomCenter] = useState<number>(0);
  const dailyChartRef = useRef<HTMLDivElement>(null);
  const reactionChartRef = useRef<HTMLDivElement>(null);

  // Check if AI is available on mount
  useEffect(() => {
    setAiEnabled(isAIClassificationAvailable());
  }, []);

  // Auto-classify topics when data changes and AI is available
  useEffect(() => {
    if (!aiEnabled || (videos.length === 0 && posts.length === 0)) return;

    const classifyAll = async () => {
      setIsClassifying(true);
      try {
        // Prepare content items
        const contentItems = [
          ...videos.map((v) => ({
            id: v.id,
            caption: v.caption || "",
            hashtags: v.hashtags || [],
          })),
          ...posts.map((p) => ({
            id: p.id,
            caption: p.caption || "",
            hashtags: p.hashtags || [],
          })),
        ];

        // Classify all content
        const results = await classifyTopics(contentItems);

        // Update state with results
        const topicMap = new Map<string, { topic: string; confidence: number; keywords: string[] }>();
        results.forEach((r) => {
          topicMap.set(r.id, {
            topic: r.topic,
            confidence: r.confidence,
            keywords: r.keywords,
          });
        });
        setAiTopics(topicMap);

        console.log(`[Analytics] AI classified ${results.length} items, ${results.filter(r => r.fromCache).length} from cache`);
      } catch (error) {
        console.error("[Analytics] AI classification error:", error);
      } finally {
        setIsClassifying(false);
      }
    };

    classifyAll();
  }, [videos, posts, aiEnabled]);

  // ============================================
  // PROCESS DATA
  // ============================================

  // Helper: Get topic (AI if available, fallback to keyword)
  const getTopic = (id: string, caption: string, hashtags: string[]): string => {
    const aiResult = aiTopics.get(id);
    if (aiResult && aiResult.confidence > 0.3) {
      return aiResult.topic;
    }
    return detectTopicKeyword(caption, hashtags);
  };

  // Transform videos and posts into unified format
  const processedPosts = useMemo((): ProcessedPost[] => {
    const allPosts: ProcessedPost[] = [];

    // Process videos (reels or regular videos)
    videos.forEach((v) => {
      const date = new Date(v.createTime);
      // Use format field from API (URL-based detection) if available
      // Defaults to "reel" for backwards compatibility since videos array typically contains reels
      const apiFormat = (v as unknown as { format?: "reel" | "video" | "photo" | "text" }).format;

      allPosts.push({
        postId: v.id,
        date: date.toISOString().split("T")[0],
        time: date.toTimeString().slice(0, 5),
        text: v.caption || "",
        format: apiFormat || "reel",
        mediaCount: 1,
        likes: v.metrics.likes,
        comments: v.metrics.comments,
        shares: v.metrics.shares,
        views: v.metrics.views,
        duration: v.duration ? Math.round(v.duration / 1000) : null, // ms to seconds
        hashtags: v.hashtags || [],
        topic: getTopic(v.id, v.caption || "", v.hashtags || []),
        engagement: v.metrics.likes + v.metrics.comments + v.metrics.shares,
        shortTitle: (v.caption || "").length > 50 ? (v.caption || "").substring(0, 50) + "..." : (v.caption || "No caption"),
        viewEngagementRate: v.metrics.views > 0
          ? ((v.metrics.likes + v.metrics.comments + v.metrics.shares) / v.metrics.views * 100).toFixed(2)
          : null,
        durationMin: v.duration ? (v.duration / 60000).toFixed(1) : null,
        thumbnail: v.thumbnail || "",
        url: v.url || "",
      });
    });

    // Process posts
    posts.forEach((p) => {
      const date = new Date(p.createTime);
      // Use format field from API (URL-based detection) if available
      // Fallback to contentType-based detection for backwards compatibility
      const apiFormat = (p as unknown as { format?: "reel" | "video" | "photo" | "text" }).format;
      const contentType = (p as unknown as { contentType?: string }).contentType;

      let format: "reel" | "photo" | "video" | "text" = "photo";
      if (apiFormat) {
        // Use URL-based format from API
        format = apiFormat;
      } else if (contentType === "single_video" || contentType === "multi_video") {
        format = "video";
      } else if (contentType === "text_only" || contentType === "link_share") {
        format = "text";
      }

      allPosts.push({
        postId: p.id,
        date: date.toISOString().split("T")[0],
        time: date.toTimeString().slice(0, 5),
        text: p.caption || "",
        format,
        mediaCount: p.isCarousel ? (p.carouselCount || 1) : 1,
        likes: p.metrics.likes,
        comments: p.metrics.comments,
        shares: p.metrics.shares,
        views: null,
        duration: null,
        hashtags: p.hashtags || [],
        topic: getTopic(p.id, p.caption || "", p.hashtags || []),
        engagement: p.metrics.likes + p.metrics.comments + p.metrics.shares,
        shortTitle: (p.caption || "").length > 50 ? (p.caption || "").substring(0, 50) + "..." : (p.caption || "No caption"),
        viewEngagementRate: null,
        durationMin: null,
        thumbnail: p.thumbnail || (p.images && p.images[0]) || "",
        url: p.url || "",
      });
    });

    return allPosts;
  }, [videos, posts, aiTopics]);

  // Filter posts by format and search query
  const filteredPosts = useMemo(() => {
    let result = processedPosts;
    if (filterFormat !== "all") {
      result = result.filter((p) => p.format === filterFormat);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.text.toLowerCase().includes(query) ||
        p.hashtags.some((tag) => tag.toLowerCase().includes(query))
      );
    }
    return result;
  }, [processedPosts, filterFormat, searchQuery]);

  // Sort posts
  const sortedPosts = useMemo(() => {
    return [...filteredPosts].sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
      }
      return 0;
    });
  }, [filteredPosts, sortField, sortDirection]);

  // Export to Excel (CSV format compatible with Excel)
  const exportToExcel = () => {
    // Prepare data for export
    const exportData = sortedPosts.map((post: ProcessedPost, index: number) => ({
      "STT": index + 1,
      "Hạng": index + 1,
      "Format": post.format.toUpperCase(),
      "Ngày": post.date,
      "Giờ": post.time,
      "Nội dung": post.text.replace(/"/g, '""'), // Escape quotes for CSV
      "Views": post.views || "",
      "Likes": post.likes,
      "Comments": post.comments,
      "Shares": post.shares,
      "Engagement": post.engagement,
      "View Rate (%)": post.viewEngagementRate || "",
      "Duration (phút)": post.durationMin || "",
      "Topic": post.topic,
      "Hashtags": post.hashtags.join(", "),
      "URL": post.url,
    }));

    // Convert to CSV
    const headers = Object.keys(exportData[0] || {});
    const csvContent = [
      headers.join(","),
      ...exportData.map((row: Record<string, string | number>) =>
        headers.map(header => {
          const value = row[header];
          // Wrap in quotes if contains comma, newline, or quote
          if (typeof value === "string" && (value.includes(",") || value.includes("\n") || value.includes('"'))) {
            return `"${value}"`;
          }
          return value;
        }).join(",")
      )
    ].join("\n");

    // Add BOM for Excel UTF-8 compatibility
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${profile.username}_analytics_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ============================================
  // SELECTION HELPERS
  // ============================================

  const toggleSelection = (postId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(sortedPosts.map((p) => p.postId)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const isAllSelected = sortedPosts.length > 0 && selectedIds.size === sortedPosts.length;

  // Toggle expand/collapse caption row
  const toggleExpand = (postId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  // Expand all / Collapse all
  const expandAll = () => setExpandedIds(new Set(sortedPosts.map((p) => p.postId)));
  const collapseAll = () => setExpandedIds(new Set());

  // Toggle expand/collapse for ranking items
  const toggleRankingExpand = (rankingKey: string, postId: string) => {
    const key = `${rankingKey}-${postId}`;
    setExpandedRankingIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Get selected videos for download/transcript
  const selectedVideos = useMemo(() => {
    return videos.filter((v) => selectedIds.has(v.id));
  }, [videos, selectedIds]);

  // Get selected reels count
  const selectedReelsCount = useMemo(() => {
    return sortedPosts.filter((p) => p.format === "reel" && selectedIds.has(p.postId)).length;
  }, [sortedPosts, selectedIds]);

  // Get videos needing transcript (no transcript yet)
  const videosNeedingTranscript = useMemo(() => {
    return selectedVideos.filter((v) => !v.transcript);
  }, [selectedVideos]);

  // Get videos with transcript
  const videosWithTranscript = useMemo(() => {
    return selectedVideos.filter((v) => v.transcript);
  }, [selectedVideos]);

  // Check if any selected videos are currently being transcribed
  const isAnyTranscribing = useMemo(() => {
    return selectedVideos.some((v) => fetchingTranscriptIds.has(v.id));
  }, [selectedVideos, fetchingTranscriptIds]);

  // ============================================
  // COMPUTED STATISTICS
  // ============================================

  const stats = useMemo(() => {
    // Video content (reel + video) - has views
    const reels = processedPosts.filter((p) => p.format === "reel");
    const regularVideos = processedPosts.filter((p) => p.format === "video");
    const allVideoContent = [...reels, ...regularVideos];

    // Static content (photo + text) - no views
    const photos = processedPosts.filter((p) => p.format === "photo");
    const textPosts = processedPosts.filter((p) => p.format === "text");
    const staticContent = [...photos, ...textPosts];

    // Total views from video content (reels + videos)
    const totalViews = allVideoContent.reduce((sum, p) => sum + (p.views || 0), 0);
    const totalEngagement = processedPosts.reduce((sum, p) => sum + p.engagement, 0);

    // Video content metrics (reel + video)
    const videoLikes = allVideoContent.reduce((sum, p) => sum + p.likes, 0);
    const videoComments = allVideoContent.reduce((sum, p) => sum + p.comments, 0);
    const videoShares = allVideoContent.reduce((sum, p) => sum + p.shares, 0);

    // Static content metrics (photo + text)
    const staticLikes = staticContent.reduce((sum, p) => sum + p.likes, 0);
    const staticComments = staticContent.reduce((sum, p) => sum + p.comments, 0);
    const staticShares = staticContent.reduce((sum, p) => sum + p.shares, 0);

    // Rate calculations
    // Video content: Rate = metric / views * 100%
    // Static content: Rate = metric / engagement * 100% (since no views available)
    const staticEngagement = staticLikes + staticComments + staticShares;

    return {
      totalPosts: processedPosts.length,
      totalLikes: processedPosts.reduce((sum, p) => sum + p.likes, 0),
      totalComments: processedPosts.reduce((sum, p) => sum + p.comments, 0),
      totalShares: processedPosts.reduce((sum, p) => sum + p.shares, 0),
      totalEngagement,
      totalViews,
      avgEngagement: processedPosts.length > 0 ? Math.round(totalEngagement / processedPosts.length) : 0,
      avgVideoViews: allVideoContent.length > 0 ? Math.round(totalViews / allVideoContent.length) : 0,
      avgVideoEngagementRate: allVideoContent.length > 0
        ? (allVideoContent.reduce((sum, p) => sum + parseFloat(p.viewEngagementRate || "0"), 0) / allVideoContent.length).toFixed(2)
        : "0.00",
      // Video content Rate (based on views) - includes reels + videos
      videoLikeRate: totalViews > 0 ? ((videoLikes / totalViews) * 100).toFixed(2) : "0.00",
      videoCommentRate: totalViews > 0 ? ((videoComments / totalViews) * 100).toFixed(2) : "0.00",
      videoShareRate: totalViews > 0 ? ((videoShares / totalViews) * 100).toFixed(2) : "0.00",
      // Static content Rate (% of total engagement)
      staticLikeRate: staticEngagement > 0 ? ((staticLikes / staticEngagement) * 100).toFixed(1) : "0.0",
      staticCommentRate: staticEngagement > 0 ? ((staticComments / staticEngagement) * 100).toFixed(1) : "0.0",
      staticShareRate: staticEngagement > 0 ? ((staticShares / staticEngagement) * 100).toFixed(1) : "0.0",
      // Counts by format
      reelCount: reels.length,
      videoCount: regularVideos.length,
      photoCount: photos.length,
      textCount: textPosts.length,
      videoContentCount: allVideoContent.length,
      staticContentCount: staticContent.length,
    };
  }, [processedPosts]);

  // Format Distribution
  // Format Distribution - based on ENGAGEMENT not post count
  const formatDistribution = useMemo(() => {
    const formats: Record<string, { count: number; engagement: number }> = {};
    processedPosts.forEach((p) => {
      const key = p.format.charAt(0).toUpperCase() + p.format.slice(1);
      if (!formats[key]) formats[key] = { count: 0, engagement: 0 };
      formats[key].count += 1;
      formats[key].engagement += p.engagement;
    });
    return Object.entries(formats).map(([name, data]) => ({
      name,
      value: data.engagement, // Use engagement for pie chart
      count: data.count,
    }));
  }, [processedPosts]);

  // Topic Distribution
  const topicDistribution = useMemo(() => {
    const topics: Record<string, number> = {};
    processedPosts.forEach((p) => {
      topics[p.topic] = (topics[p.topic] || 0) + 1;
    });
    return Object.entries(topics)
      .map(([name, value]) => ({
        name,
        value,
        engagement: processedPosts
          .filter((p) => p.topic === name)
          .reduce((sum, p) => sum + p.engagement, 0),
      }))
      .sort((a, b) => b.engagement - a.engagement);
  }, [processedPosts]);

  // Format Performance type
  interface FormatPerformanceItem {
    format: string;
    count: number;
    avgLikes: number;
    avgComments: number;
    avgShares: number;
    avgEngagement: number;
    totalViews: number | null;
    avgViews: number | null;
  }

  // Format Performance - Video format also has views like Reel
  const formatPerformance = useMemo((): FormatPerformanceItem[] => {
    const formats = ["reel", "video", "photo", "text"]; // Reorder: video with views next to reel
    return formats
      .map((format) => {
        const formatPosts = processedPosts.filter((p) => p.format === format);
        if (formatPosts.length === 0) return null;
        // Both reel and video formats have views
        const hasViews = format === "reel" || format === "video";
        const totalViews = hasViews ? formatPosts.reduce((sum, p) => sum + (p.views || 0), 0) : null;
        return {
          format: format.charAt(0).toUpperCase() + format.slice(1),
          count: formatPosts.length,
          avgLikes: Math.round(formatPosts.reduce((sum, p) => sum + p.likes, 0) / formatPosts.length),
          avgComments: Math.round(formatPosts.reduce((sum, p) => sum + p.comments, 0) / formatPosts.length * 10) / 10,
          avgShares: Math.round(formatPosts.reduce((sum, p) => sum + p.shares, 0) / formatPosts.length),
          avgEngagement: Math.round(formatPosts.reduce((sum, p) => sum + p.engagement, 0) / formatPosts.length),
          totalViews,
          avgViews: hasViews && totalViews !== null
            ? Math.round(totalViews / formatPosts.length)
            : null,
        };
      })
      .filter((item): item is FormatPerformanceItem => item !== null);
  }, [processedPosts]);

  // Reel vs Photo Comparison - Total metrics and performance ratio
  const reelVsPhotoComparison = useMemo(() => {
    const reels = processedPosts.filter((p) => p.format === "reel");
    const photos = processedPosts.filter((p) => p.format === "photo");

    const reelTotals = {
      likes: reels.reduce((sum, p) => sum + p.likes, 0),
      comments: reels.reduce((sum, p) => sum + p.comments, 0),
      shares: reels.reduce((sum, p) => sum + p.shares, 0),
      engagement: reels.reduce((sum, p) => sum + p.engagement, 0),
    };

    const photoTotals = {
      likes: photos.reduce((sum, p) => sum + p.likes, 0),
      comments: photos.reduce((sum, p) => sum + p.comments, 0),
      shares: photos.reduce((sum, p) => sum + p.shares, 0),
      engagement: photos.reduce((sum, p) => sum + p.engagement, 0),
    };

    // Average per post
    const reelAvg = {
      likes: reels.length > 0 ? Math.round(reelTotals.likes / reels.length) : 0,
      comments: reels.length > 0 ? Math.round(reelTotals.comments / reels.length * 10) / 10 : 0,
      shares: reels.length > 0 ? Math.round(reelTotals.shares / reels.length) : 0,
      engagement: reels.length > 0 ? Math.round(reelTotals.engagement / reels.length) : 0,
    };

    const photoAvg = {
      likes: photos.length > 0 ? Math.round(photoTotals.likes / photos.length) : 0,
      comments: photos.length > 0 ? Math.round(photoTotals.comments / photos.length * 10) / 10 : 0,
      shares: photos.length > 0 ? Math.round(photoTotals.shares / photos.length) : 0,
      engagement: photos.length > 0 ? Math.round(photoTotals.engagement / photos.length) : 0,
    };

    // Performance ratio (Reel / Photo) - how many times better Reel performs
    const ratio = {
      likes: photoAvg.likes > 0 ? Math.round(reelAvg.likes / photoAvg.likes * 10) / 10 : 0,
      comments: photoAvg.comments > 0 ? Math.round(reelAvg.comments / photoAvg.comments * 10) / 10 : 0,
      shares: photoAvg.shares > 0 ? Math.round(reelAvg.shares / photoAvg.shares * 10) / 10 : 0,
      engagement: photoAvg.engagement > 0 ? Math.round(reelAvg.engagement / photoAvg.engagement * 10) / 10 : 0,
    };

    // Chart data for grouped bar
    const chartData = [
      { metric: "Tổng Likes", Reel: reelTotals.likes, Photo: photoTotals.likes },
      { metric: "Tổng Comments", Reel: reelTotals.comments, Photo: photoTotals.comments },
      { metric: "Tổng Shares", Reel: reelTotals.shares, Photo: photoTotals.shares },
      { metric: "TB Engagement", Reel: reelAvg.engagement, Photo: photoAvg.engagement },
    ];

    return { reelTotals, photoTotals, reelAvg, photoAvg, ratio, chartData, reelCount: reels.length, photoCount: photos.length };
  }, [processedPosts]);

  // Reaction Breakdown - Use reactions breakdown if available, fallback to total likes
  const reactionBreakdown = useMemo(() => {
    const totals = { like: 0, love: 0, care: 0, haha: 0, wow: 0, sad: 0, angry: 0 };
    let hasReactionsData = false;

    videos.forEach((v) => {
      if (v.metrics.reactions) {
        hasReactionsData = true;
        totals.like += v.metrics.reactions.like || 0;
        totals.love += v.metrics.reactions.love || 0;
        totals.care += v.metrics.reactions.care || 0;
        totals.haha += v.metrics.reactions.haha || 0;
        totals.wow += v.metrics.reactions.wow || 0;
        totals.sad += v.metrics.reactions.sad || 0;
        totals.angry += v.metrics.reactions.angry || 0;
      }
    });

    posts.forEach((p) => {
      if (p.metrics.reactions) {
        hasReactionsData = true;
        totals.like += p.metrics.reactions.like || 0;
        totals.love += p.metrics.reactions.love || 0;
        totals.care += p.metrics.reactions.care || 0;
        totals.haha += p.metrics.reactions.haha || 0;
        totals.wow += p.metrics.reactions.wow || 0;
        totals.sad += p.metrics.reactions.sad || 0;
        totals.angry += p.metrics.reactions.angry || 0;
      }
    });

    // If no reactions breakdown data, use total likes as "Like" reaction
    if (!hasReactionsData) {
      const totalLikes = videos.reduce((sum, v) => sum + v.metrics.likes, 0) +
                        posts.reduce((sum, p) => sum + p.metrics.likes, 0);
      if (totalLikes > 0) {
        return [{ name: "Like", value: totalLikes, color: REACTION_COLORS.Like }];
      }
      return [];
    }

    return [
      { name: "Like", value: totals.like, color: REACTION_COLORS.Like },
      { name: "Love", value: totals.love, color: REACTION_COLORS.Love },
      { name: "Care", value: totals.care, color: REACTION_COLORS.Care },
      { name: "Haha", value: totals.haha, color: REACTION_COLORS.Haha },
      { name: "Wow", value: totals.wow, color: REACTION_COLORS.Wow },
      { name: "Sad", value: totals.sad, color: REACTION_COLORS.Sad },
      { name: "Angry", value: totals.angry, color: REACTION_COLORS.Angry },
    ].filter((r) => r.value > 0);
  }, [videos, posts]);

  // Duration Analysis (Reels only)
  const durationAnalysis = useMemo(() => {
    const reels = processedPosts.filter((p) => p.format === "reel" && p.duration);
    if (reels.length === 0) return [];

    const ranges = [
      { label: "< 1 phút", min: 0, max: 60 },
      { label: "1-2 phút", min: 60, max: 120 },
      { label: "2-3 phút", min: 120, max: 180 },
      { label: "> 3 phút", min: 180, max: Infinity },
    ];

    return ranges.map((range) => {
      const inRange = reels.filter((r) => (r.duration || 0) >= range.min && (r.duration || 0) < range.max);
      return {
        range: range.label,
        count: inRange.length,
        avgViews: inRange.length > 0 ? Math.round(inRange.reduce((sum, r) => sum + (r.views || 0), 0) / inRange.length) : 0,
        avgEngagement: inRange.length > 0 ? Math.round(inRange.reduce((sum, r) => sum + r.engagement, 0) / inRange.length) : 0,
      };
    });
  }, [processedPosts]);

  // Top Posts
  const topPosts = useMemo(() => {
    const reels = processedPosts.filter((p) => p.format === "reel");
    return {
      byEngagement: [...processedPosts].sort((a, b) => b.engagement - a.engagement).slice(0, 5),
      byViews: [...reels].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5),
      byShares: [...processedPosts].sort((a, b) => b.shares - a.shares).slice(0, 5),
      byEngagementRate: [...reels]
        .filter((r) => r.viewEngagementRate)
        .sort((a, b) => parseFloat(b.viewEngagementRate || "0") - parseFloat(a.viewEngagementRate || "0"))
        .slice(0, 5),
    };
  }, [processedPosts]);

  // Daily Performance - with hourly breakdown for deep zoom
  const dailyPerformance = useMemo(() => {
    const byDate: Record<string, { date: string; posts: number; engagement: number; views: number; reels: number; photos: number }> = {};
    processedPosts.forEach((p) => {
      if (!byDate[p.date]) {
        byDate[p.date] = { date: p.date, posts: 0, engagement: 0, views: 0, reels: 0, photos: 0 };
      }
      byDate[p.date].posts++;
      byDate[p.date].engagement += p.engagement;
      byDate[p.date].views += p.views || 0;
      if (p.format === "reel") byDate[p.date].reels++;
      if (p.format === "photo") byDate[p.date].photos++;
    });
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [processedPosts]);

  // Hourly Performance - for deep zoom levels
  const hourlyPerformance = useMemo(() => {
    const byHour: Record<string, { datetime: string; date: string; hour: number; posts: number; engagement: number; views: number }> = {};
    processedPosts.forEach((p) => {
      // Extract hour from time field (format: "HH:MM")
      const hour = parseInt(p.time?.split(":")[0] || "12", 10);
      const key = `${p.date} ${hour.toString().padStart(2, "0")}:00`;
      if (!byHour[key]) {
        byHour[key] = { datetime: key, date: p.date, hour, posts: 0, engagement: 0, views: 0 };
      }
      byHour[key].posts++;
      byHour[key].engagement += p.engagement;
      byHour[key].views += p.views || 0;
    });
    return Object.values(byHour).sort((a, b) => a.datetime.localeCompare(b.datetime));
  }, [processedPosts]);

  // Reaction Trends by Date - aggregate reactions per day
  const reactionTrends = useMemo(() => {
    const byDate: Record<string, {
      date: string;
      Like: number;
      Love: number;
      Care: number;
      Haha: number;
      Wow: number;
      Sad: number;
      Angry: number;
    }> = {};

    // Aggregate from videos
    videos.forEach((v) => {
      const date = new Date(v.createTime).toISOString().split("T")[0];
      if (!byDate[date]) {
        byDate[date] = { date, Like: 0, Love: 0, Care: 0, Haha: 0, Wow: 0, Sad: 0, Angry: 0 };
      }
      if (v.metrics.reactions) {
        byDate[date].Like += v.metrics.reactions.like || 0;
        byDate[date].Love += v.metrics.reactions.love || 0;
        byDate[date].Care += v.metrics.reactions.care || 0;
        byDate[date].Haha += v.metrics.reactions.haha || 0;
        byDate[date].Wow += v.metrics.reactions.wow || 0;
        byDate[date].Sad += v.metrics.reactions.sad || 0;
        byDate[date].Angry += v.metrics.reactions.angry || 0;
      } else {
        // Fallback: use likes as Like reaction
        byDate[date].Like += v.metrics.likes || 0;
      }
    });

    // Aggregate from posts
    posts.forEach((p) => {
      const date = new Date(p.createTime).toISOString().split("T")[0];
      if (!byDate[date]) {
        byDate[date] = { date, Like: 0, Love: 0, Care: 0, Haha: 0, Wow: 0, Sad: 0, Angry: 0 };
      }
      if (p.metrics.reactions) {
        byDate[date].Like += p.metrics.reactions.like || 0;
        byDate[date].Love += p.metrics.reactions.love || 0;
        byDate[date].Care += p.metrics.reactions.care || 0;
        byDate[date].Haha += p.metrics.reactions.haha || 0;
        byDate[date].Wow += p.metrics.reactions.wow || 0;
        byDate[date].Sad += p.metrics.reactions.sad || 0;
        byDate[date].Angry += p.metrics.reactions.angry || 0;
      } else {
        // Fallback: use likes as Like reaction
        byDate[date].Like += p.metrics.likes || 0;
      }
    });

    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [videos, posts]);

  // ============================================
  // HELPERS
  // ============================================

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num?.toLocaleString() || "0";
  };

  const getRankBadge = (rank: number): string => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return String(rank);
  };

  const getFormatIcon = (format: string): string => {
    switch (format.toLowerCase()) {
      case "reel": return "🎬";
      case "photo": return "📷";
      case "video": return "🎥";
      default: return "📝";
    }
  };

  // Get zoom label for display
  const getZoomLabel = (level: ZoomLevel): string => {
    switch (level) {
      case "all": return "Tất cả";
      case "week": return "7 ngày";
      case "3days": return "3 ngày";
      case "day": return "1 ngày";
      case "12hours": return "12 giờ";
      case "6hours": return "6 giờ";
    }
  };

  // Get filtered data based on zoom level for daily performance
  const getZoomedDailyData = useMemo(() => {
    if (dailyZoomLevel === "all") {
      return dailyPerformance;
    }

    // For day/hour levels, use hourly data with actual data points
    if (dailyZoomLevel === "day" || dailyZoomLevel === "12hours" || dailyZoomLevel === "6hours") {
      if (hourlyPerformance.length === 0) return dailyPerformance;

      // Get unique dates from hourly data
      const uniqueDates = [...new Set(hourlyPerformance.map(h => h.date))].sort();

      // Select date based on center position (default to most recent)
      const dateIdx = Math.min(
        Math.max(0, Math.floor((dailyZoomCenter / hourlyPerformance.length) * uniqueDates.length) || uniqueDates.length - 1),
        uniqueDates.length - 1
      );

      // Get data for selected date(s)
      let selectedDates: string[];
      if (dailyZoomLevel === "day") {
        selectedDates = [uniqueDates[dateIdx]];
      } else if (dailyZoomLevel === "12hours") {
        selectedDates = uniqueDates.slice(Math.max(0, dateIdx - 1), dateIdx + 1);
      } else {
        selectedDates = [uniqueDates[dateIdx]];
      }

      // Filter hourly data for selected dates
      const filtered = hourlyPerformance
        .filter(h => selectedDates.includes(h.date))
        .map(h => ({
          date: `${h.hour.toString().padStart(2, "0")}:00`, // "14:00"
          posts: h.posts,
          engagement: h.engagement,
          views: h.views,
          reels: 0,
          photos: 0,
        }));

      // If 6hours, take last 6 data points
      if (dailyZoomLevel === "6hours" && filtered.length > 6) {
        return filtered.slice(-6);
      }
      // If 12hours, take last 12 data points
      if (dailyZoomLevel === "12hours" && filtered.length > 12) {
        return filtered.slice(-12);
      }

      return filtered.length > 0 ? filtered : dailyPerformance.slice(-1);
    }

    // For week/3days, use daily data - take from end (most recent)
    const daysToShow = dailyZoomLevel === "week" ? 7 : 3;
    const startIdx = Math.max(0, dailyPerformance.length - daysToShow);
    return dailyPerformance.slice(startIdx);
  }, [dailyZoomLevel, dailyZoomCenter, dailyPerformance, hourlyPerformance]);

  // Get filtered data for reaction trends
  // Hourly Reaction Trends - for deep zoom levels (day/12hours/6hours)
  const hourlyReactionTrends = useMemo(() => {
    const byHour: Record<string, { datetime: string; date: string; hour: number; Like: number; Love: number; Care: number; Haha: number; Wow: number; Sad: number; Angry: number }> = {};

    // Aggregate from videos
    videos.forEach((v) => {
      const date = new Date(v.createTime).toISOString().split("T")[0];
      const hour = new Date(v.createTime).getHours();
      const key = `${date} ${hour.toString().padStart(2, "0")}:00`;

      if (!byHour[key]) {
        byHour[key] = { datetime: key, date, hour, Like: 0, Love: 0, Care: 0, Haha: 0, Wow: 0, Sad: 0, Angry: 0 };
      }
      if (v.metrics.reactions) {
        byHour[key].Like += v.metrics.reactions.like || 0;
        byHour[key].Love += v.metrics.reactions.love || 0;
        byHour[key].Care += v.metrics.reactions.care || 0;
        byHour[key].Haha += v.metrics.reactions.haha || 0;
        byHour[key].Wow += v.metrics.reactions.wow || 0;
        byHour[key].Sad += v.metrics.reactions.sad || 0;
        byHour[key].Angry += v.metrics.reactions.angry || 0;
      } else {
        byHour[key].Like += v.metrics.likes || 0;
      }
    });

    // Aggregate from posts
    posts.forEach((p) => {
      const date = new Date(p.createTime).toISOString().split("T")[0];
      const hour = new Date(p.createTime).getHours();
      const key = `${date} ${hour.toString().padStart(2, "0")}:00`;

      if (!byHour[key]) {
        byHour[key] = { datetime: key, date, hour, Like: 0, Love: 0, Care: 0, Haha: 0, Wow: 0, Sad: 0, Angry: 0 };
      }
      if (p.metrics.reactions) {
        byHour[key].Like += p.metrics.reactions.like || 0;
        byHour[key].Love += p.metrics.reactions.love || 0;
        byHour[key].Care += p.metrics.reactions.care || 0;
        byHour[key].Haha += p.metrics.reactions.haha || 0;
        byHour[key].Wow += p.metrics.reactions.wow || 0;
        byHour[key].Sad += p.metrics.reactions.sad || 0;
        byHour[key].Angry += p.metrics.reactions.angry || 0;
      } else {
        byHour[key].Like += p.metrics.likes || 0;
      }
    });

    return Object.values(byHour).sort((a, b) => a.datetime.localeCompare(b.datetime));
  }, [videos, posts]);

  const getZoomedReactionData = useMemo(() => {
    if (reactionZoomLevel === "all") {
      return reactionTrends;
    }

    // For day/hour levels, use hourly data with actual data points
    if (reactionZoomLevel === "day" || reactionZoomLevel === "12hours" || reactionZoomLevel === "6hours") {
      if (hourlyReactionTrends.length === 0) return reactionTrends;

      // Get unique dates from hourly data
      const uniqueDates = [...new Set(hourlyReactionTrends.map(h => h.date))].sort();

      // Select date based on center position
      const dateIdx = Math.min(
        Math.max(0, Math.floor((reactionZoomCenter / hourlyReactionTrends.length) * uniqueDates.length) || uniqueDates.length - 1),
        uniqueDates.length - 1
      );

      // Get data for selected date(s)
      let selectedDates: string[];
      if (reactionZoomLevel === "day") {
        selectedDates = [uniqueDates[dateIdx]];
      } else if (reactionZoomLevel === "12hours") {
        // Get last 1-2 dates if not enough hours in one day
        selectedDates = uniqueDates.slice(Math.max(0, dateIdx - 1), dateIdx + 1);
      } else {
        // 6hours - just use selected date
        selectedDates = [uniqueDates[dateIdx]];
      }

      // Filter hourly data for selected dates
      const filtered = hourlyReactionTrends
        .filter(h => selectedDates.includes(h.date))
        .map(h => ({
          ...h,
          date: `${h.hour.toString().padStart(2, "0")}:00`, // "14:00"
        }));

      // If 6hours, take last 6 data points
      if (reactionZoomLevel === "6hours" && filtered.length > 6) {
        return filtered.slice(-6);
      }
      // If 12hours, take last 12 data points
      if (reactionZoomLevel === "12hours" && filtered.length > 12) {
        return filtered.slice(-12);
      }

      return filtered.length > 0 ? filtered : reactionTrends.slice(-1);
    }

    // For week/3days, use daily data - take from end (most recent)
    const daysToShow = reactionZoomLevel === "week" ? 7 : 3;
    const startIdx = Math.max(0, reactionTrends.length - daysToShow);
    return reactionTrends.slice(startIdx);
  }, [reactionZoomLevel, reactionZoomCenter, reactionTrends, hourlyReactionTrends]);

  // Posting Activity Heatmap Data - Aggregate by day of week (0-6) and hour (0-23)
  const postingHeatmapData = useMemo(() => {
    // Initialize 7 days x 24 hours grid
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

    // Aggregate from videos
    videos.forEach((v) => {
      const date = new Date(v.createTime);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
      const hour = date.getHours();
      grid[dayOfWeek][hour]++;
    });

    // Aggregate from posts
    posts.forEach((p) => {
      const date = new Date(p.createTime);
      const dayOfWeek = date.getDay();
      const hour = date.getHours();
      grid[dayOfWeek][hour]++;
    });

    // Calculate statistics for smart color scaling
    const allValues = grid.flat().filter(v => v > 0); // Non-zero values only
    const maxValue = Math.max(1, ...grid.flat());
    const totalPosts = allValues.reduce((sum, v) => sum + v, 0);

    // Calculate percentiles for better color distribution
    const sortedValues = [...allValues].sort((a, b) => a - b);
    const p25 = sortedValues[Math.floor(sortedValues.length * 0.25)] || 1;
    const p50 = sortedValues[Math.floor(sortedValues.length * 0.5)] || 1;
    const p75 = sortedValues[Math.floor(sortedValues.length * 0.75)] || 1;
    const p90 = sortedValues[Math.floor(sortedValues.length * 0.9)] || maxValue;

    return { grid, maxValue, totalPosts, thresholds: { p25, p50, p75, p90 } };
  }, [videos, posts]);

  // Heatmap color scale helper - percentile-based for better distribution
  const getHeatmapColor = (value: number, data: typeof postingHeatmapData): string => {
    if (value === 0) return "#F1F5F9"; // Slate 100 - empty (light bg)
    const { thresholds, maxValue } = data;

    // Use percentile-based thresholds for meaningful color distribution
    if (value <= thresholds.p25) return "#0EA5E9"; // Sky 500 - Low
    if (value <= thresholds.p50) return "#06B6D4"; // Cyan 500 - Medium
    if (value <= thresholds.p75) return "#10B981"; // Emerald 500 - Good
    if (value <= thresholds.p90) return "#F59E0B"; // Amber 500 - High
    if (value === maxValue) return "#EF4444"; // Red 500 - Peak
    return "#F97316"; // Orange 500 - Very High
  };

  const getHeatmapLabel = (value: number, data: typeof postingHeatmapData): string => {
    if (value === 0) return "Không có";
    const { thresholds, maxValue } = data;
    if (value <= thresholds.p25) return "Thấp";
    if (value <= thresholds.p50) return "TB";
    if (value <= thresholds.p75) return "Khá";
    if (value <= thresholds.p90) return "Cao";
    if (value === maxValue) return "Peak";
    return "Rất cao";
  };

  // Native wheel event handlers to properly block page scroll
  // React's onWheel doesn't support { passive: false } needed to preventDefault
  useEffect(() => {
    const dailyEl = dailyChartRef.current;
    const reactionEl = reactionChartRef.current;

    const handleDailyWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const currentIdx = ZOOM_LEVELS.indexOf(dailyZoomLevel);
      if (e.deltaY < 0 && currentIdx < ZOOM_LEVELS.length - 1) {
        setDailyZoomLevel(ZOOM_LEVELS[currentIdx + 1]);
        if (dailyZoomCenter === 0) setDailyZoomCenter(Math.floor(dailyPerformance.length / 2));
      } else if (e.deltaY > 0 && currentIdx > 0) {
        setDailyZoomLevel(ZOOM_LEVELS[currentIdx - 1]);
      }
    };

    const handleReactionWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const currentIdx = ZOOM_LEVELS.indexOf(reactionZoomLevel);
      if (e.deltaY < 0 && currentIdx < ZOOM_LEVELS.length - 1) {
        setReactionZoomLevel(ZOOM_LEVELS[currentIdx + 1]);
        if (reactionZoomCenter === 0) setReactionZoomCenter(Math.floor(reactionTrends.length / 2));
      } else if (e.deltaY > 0 && currentIdx > 0) {
        setReactionZoomLevel(ZOOM_LEVELS[currentIdx - 1]);
      }
    };

    // Add with { passive: false } to allow preventDefault
    if (dailyEl) dailyEl.addEventListener("wheel", handleDailyWheel, { passive: false });
    if (reactionEl) reactionEl.addEventListener("wheel", handleReactionWheel, { passive: false });

    return () => {
      if (dailyEl) dailyEl.removeEventListener("wheel", handleDailyWheel);
      if (reactionEl) reactionEl.removeEventListener("wheel", handleReactionWheel);
    };
  }, [dailyZoomLevel, reactionZoomLevel, dailyZoomCenter, reactionZoomCenter, dailyPerformance.length, reactionTrends.length, hourlyReactionTrends.length, ZOOM_LEVELS]);

  // Custom Tooltip - use explicit types to avoid recharts type issues
  const CustomTooltip = (props: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string }) => {
    const { active, payload, label } = props;
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/98 px-4 py-3 rounded-xl shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: { name?: string; value?: number; color?: string }, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: <strong>{entry.value?.toLocaleString()}</strong>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm">
        {[
          { id: "overview", label: "📈 Tổng quan" },
          { id: "formats", label: "🎬 Formats" },
          { id: "details", label: "📋 Chi tiết" },
          { id: "analysis", label: "🔍 Phân tích" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
              activeTab === tab.id
                ? "bg-gradient-to-r from-[#1877F2] to-[#EC4899] text-white"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Stats Row 1 - Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Tổng bài đăng", value: stats.totalPosts, icon: "📝", color: "#1877F2" },
              { label: "Tổng Likes", value: formatNumber(stats.totalLikes), icon: "👍", color: "#1877F2" },
              { label: "Tổng Comments", value: stats.totalComments, icon: "💬", color: "#F59E0B" },
              { label: "Tổng Shares", value: stats.totalShares, icon: "🔄", color: "#8B5CF6" },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-4 shadow-sm"
                style={{ borderLeft: `4px solid ${stat.color}` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{stat.icon}</span>
                  <span className="text-gray-500 text-xs font-medium">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold" style={{ color: stat.color }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Stats Row 2 - Engagement Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Tổng Views", value: formatNumber(stats.totalViews), icon: "👁️", color: "#EC4899", sub: `${stats.reelCount} reels + ${stats.videoCount} videos` },
              { label: "Avg Views/Video", value: formatNumber(stats.avgVideoViews), icon: "📊", color: "#8B5CF6", sub: `${stats.videoContentCount} video content` },
              { label: "Tổng Engagement", value: formatNumber(stats.totalEngagement), icon: "🔥", color: "#F59E0B", sub: "Like + Comment + Share" },
              { label: "Avg Engagement Rate", value: stats.avgVideoEngagementRate + "%", icon: "📈", color: "#10B981", sub: "Video content" },
            ].map((stat, i) => (
              <div
                key={i}
                className="rounded-2xl p-4"
                style={{ background: `linear-gradient(135deg, ${stat.color}15 0%, ${stat.color}05 100%)`, border: `1px solid ${stat.color}30` }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{stat.icon}</span>
                  <span className="text-gray-500 text-xs font-medium">{stat.label}</span>
                </div>
                <div className="text-3xl font-bold" style={{ color: stat.color }}>
                  {stat.value}
                </div>
                <div className="text-xs text-gray-400 mt-1">{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Stats Row 3 - Rate Metrics by Type */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Video Content Rates (Reels + Videos) */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🎬</span>
                <h3 className="font-semibold text-gray-900">Video Content Rate</h3>
                <span className="text-sm text-gray-600 font-medium ml-auto bg-pink-50 px-3 py-1 rounded-full">
                  {stats.reelCount} reels + {stats.videoCount} videos • <span className="font-bold text-[#EC4899]">{formatNumber(stats.totalViews)}</span> views
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-xl bg-blue-50">
                  <div className="text-2xl font-bold text-[#1877F2]">{stats.videoLikeRate}%</div>
                  <div className="text-xs text-gray-500 mt-1">👍 Like Rate</div>
                  <div className="text-[10px] text-gray-400">Likes / Views</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-amber-50">
                  <div className="text-2xl font-bold text-[#F59E0B]">{stats.videoCommentRate}%</div>
                  <div className="text-xs text-gray-500 mt-1">💬 Comment Rate</div>
                  <div className="text-[10px] text-gray-400">Comments / Views</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-purple-50">
                  <div className="text-2xl font-bold text-[#8B5CF6]">{stats.videoShareRate}%</div>
                  <div className="text-xs text-gray-500 mt-1">🔄 Share Rate</div>
                  <div className="text-[10px] text-gray-400">Shares / Views</div>
                </div>
              </div>
            </div>

            {/* Static Content Rates (Photos + Text) */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">📷</span>
                <h3 className="font-semibold text-gray-900">Static Content Rate</h3>
                <span className="text-sm text-gray-600 font-medium ml-auto bg-blue-50 px-3 py-1 rounded-full">
                  {stats.photoCount} photos + {stats.textCount} text • <span className="font-bold text-[#3B82F6]">% of engagement</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-xl bg-blue-50">
                  <div className="text-2xl font-bold text-[#1877F2]">{stats.staticLikeRate}%</div>
                  <div className="text-xs text-gray-500 mt-1">👍 Like Rate</div>
                  <div className="text-[10px] text-gray-400">% of Engagement</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-amber-50">
                  <div className="text-2xl font-bold text-[#F59E0B]">{stats.staticCommentRate}%</div>
                  <div className="text-xs text-gray-500 mt-1">💬 Comment Rate</div>
                  <div className="text-[10px] text-gray-400">% of Engagement</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-purple-50">
                  <div className="text-2xl font-bold text-[#8B5CF6]">{stats.staticShareRate}%</div>
                  <div className="text-xs text-gray-500 mt-1">🔄 Share Rate</div>
                  <div className="text-[10px] text-gray-400">% of Engagement</div>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Format Distribution Pie - by ENGAGEMENT */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Phân bố Format <span className="text-sm font-normal text-gray-400">(theo Engagement)</span></h3>
              <div className="flex items-center">
                <ResponsiveContainer width="55%" height={220}>
                  <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <Pie
                      data={formatDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      dataKey="value"
                      label={({ percent }: { percent?: number }) => `${((percent || 0) * 100).toFixed(0)}%`}
                      labelLine={{ stroke: '#94A3B8', strokeWidth: 1 }}
                    >
                      {formatDistribution.map((entry, index) => (
                        <Cell key={index} fill={FORMAT_COLORS[entry.name] || CHART_COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {formatDistribution.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ background: FORMAT_COLORS[item.name] || CHART_COLORS[i] }}
                      />
                      <span className="flex-1 font-medium">{item.name}</span>
                      <div className="text-right">
                        <span className="font-semibold">{formatNumber(item.value)}</span>
                        <span className="text-xs text-gray-400 ml-1">eng</span>
                        <div className="text-xs text-gray-400">{item.count} posts</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Topic Distribution */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                🏷️ Chủ đề nội dung
                {aiEnabled && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                    <Sparkles className="w-3 h-3" />
                    AI
                    {isClassifying && <Loader2 className="w-3 h-3 animate-spin" />}
                  </span>
                )}
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topicDistribution.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="engagement" radius={[0, 8, 8, 0]}>
                    {topicDistribution.slice(0, 5).map((entry, index) => (
                      <Cell key={index} fill={TOPIC_COLORS[entry.name] || CHART_COLORS[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily Performance Chart - Multi-level scroll zoom (native event) */}
          <div
            ref={dailyChartRef}
            className="bg-white rounded-2xl p-6 shadow-sm cursor-ns-resize"
            style={{ touchAction: "none", overscrollBehavior: "contain" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">📅 Hiệu suất theo thời gian</h3>
              <span className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-full font-medium">
                {getZoomLabel(dailyZoomLevel)}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={getZoomedDailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fontWeight: 500, fill: "#374151" }}
                  axisLine={{ stroke: "#D1D5DB" }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12, fontWeight: 500, fill: "#374151" }}
                  axisLine={{ stroke: "#D1D5DB" }}
                  tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12, fontWeight: 500, fill: "#374151" }}
                  axisLine={{ stroke: "#D1D5DB" }}
                  tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: "13px", fontWeight: 600, paddingTop: "8px" }}
                  formatter={(value) => <span className="text-gray-800">{value}</span>}
                />
                <Bar yAxisId="left" dataKey="engagement" name="📊 Engagement" fill="#1877F2" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="views" name="👁️ Views" stroke="#EC4899" strokeWidth={3} dot={{ fill: "#EC4899", r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Posting Activity Heatmap - Day of Week x Hour aggregated across all weeks */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">🔥 Posting Activity Heatmap</h3>
              {/* Color Legend */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">Ít</span>
                <div className="flex gap-0.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: "#F1F5F9" }} title="Không có" />
                  <div className="w-3 h-3 rounded-sm" style={{ background: "#0EA5E9" }} title="Thấp" />
                  <div className="w-3 h-3 rounded-sm" style={{ background: "#06B6D4" }} title="TB" />
                  <div className="w-3 h-3 rounded-sm" style={{ background: "#10B981" }} title="Khá" />
                  <div className="w-3 h-3 rounded-sm" style={{ background: "#F59E0B" }} title="Cao" />
                  <div className="w-3 h-3 rounded-sm" style={{ background: "#EF4444" }} title="Peak" />
                </div>
                <span className="text-gray-400">Nhiều</span>
              </div>
            </div>

            {/* Heatmap Grid - Full width responsive */}
            <div className="w-full">
              {/* Hour labels (X-axis) - all 24 hours */}
              <div className="flex items-center mb-1">
                <div className="w-8 shrink-0" /> {/* Empty corner for day labels */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="flex-1 text-center text-[10px] text-gray-400 font-medium">
                    {h}
                  </div>
                ))}
              </div>

              {/* Day rows - full width cells */}
              {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((dayLabel, dayIdx) => (
                <div key={dayIdx} className="flex items-center mb-[3px]">
                  <div className="w-8 shrink-0 text-xs text-gray-500 font-medium text-right pr-2">
                    {dayLabel}
                  </div>
                  {postingHeatmapData.grid[dayIdx].map((value, hourIdx) => (
                    <div
                      key={hourIdx}
                      className="flex-1 h-7 mx-[1px] rounded-sm transition-all duration-150 hover:scale-y-110 cursor-pointer flex items-center justify-center"
                      style={{ backgroundColor: getHeatmapColor(value, postingHeatmapData) }}
                      title={`${dayLabel} ${hourIdx}:00 → ${value} post(s) (${getHeatmapLabel(value, postingHeatmapData)})`}
                    >
                      {/* Show count on cells with posts */}
                      {value > 0 && (
                        <span className={`text-[10px] font-bold ${value >= postingHeatmapData.thresholds.p50 ? "text-white" : "text-gray-600"}`}>
                          {value}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Summary stats */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100 text-sm">
              <div>
                <span className="text-gray-500">Tổng: </span>
                <span className="font-semibold text-gray-900">{videos.length + posts.length}</span>
              </div>
              <div>
                <span className="text-gray-500">Peak: </span>
                <span className="font-semibold text-red-500">{postingHeatmapData.maxValue}</span>
              </div>
              <div>
                <span className="text-gray-500">Best: </span>
                <span className="font-semibold text-emerald-600">
                  {(() => {
                    let maxVal = 0;
                    let bestDay = 0;
                    let bestHour = 0;
                    postingHeatmapData.grid.forEach((row, d) => {
                      row.forEach((val, h) => {
                        if (val > maxVal) {
                          maxVal = val;
                          bestDay = d;
                          bestHour = h;
                        }
                      });
                    });
                    const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
                    return maxVal > 0 ? `${days[bestDay]} ${bestHour}:00` : "N/A";
                  })()}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Active: </span>
                <span className="font-semibold text-sky-600">
                  {postingHeatmapData.grid.flat().filter(v => v > 0).length}/168
                </span>
              </div>
            </div>
          </div>

          {/* Reaction Breakdown + Trends - Side by Side */}
          {reactionBreakdown.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Phân bố Reactions */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">😍 Phân bố Reactions</h3>
                <div className="flex gap-4 flex-wrap">
                  {reactionBreakdown.map((reaction, i) => {
                    const total = reactionBreakdown.reduce((sum, r) => sum + r.value, 0);
                    const percent = ((reaction.value / total) * 100).toFixed(1);
                    return (
                      <div key={i} className="flex-1 min-w-[120px]">
                        <div className="flex justify-between mb-2">
                          <span className="font-medium text-sm">{reaction.name}</span>
                          <span className="font-semibold text-sm" style={{ color: reaction.color }}>
                            {reaction.value.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded overflow-hidden">
                          <div
                            className="h-full rounded transition-all"
                            style={{ width: `${percent}%`, background: reaction.color }}
                          />
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{percent}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reaction Trends Chart - Multi-level scroll zoom (native event) */}
              <div
                ref={reactionChartRef}
                className="bg-white rounded-2xl p-6 shadow-sm cursor-ns-resize"
                style={{ touchAction: "none", overscrollBehavior: "contain" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">📈 Reaction Trends</h3>
                  <span className="text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded-full font-medium">
                    {getZoomLabel(reactionZoomLevel)}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={getZoomedReactionData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fontWeight: 500, fill: "#374151" }}
                      tickFormatter={(value) => {
                        // For hourly data (format: "2024-12-19 14:00"), show hour
                        if (value && value.includes(" ")) {
                          const timePart = value.split(" ")[1]; // "14:00"
                          return timePart || value;
                        }
                        // For daily data, show day/month
                        const d = new Date(value);
                        if (!isNaN(d.getTime())) {
                          return `${d.getDate()}/${d.getMonth() + 1}`;
                        }
                        return value;
                      }}
                      axisLine={{ stroke: "#D1D5DB" }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fontWeight: 500, fill: "#374151" }}
                      axisLine={{ stroke: "#D1D5DB" }}
                      tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value}
                    />
                    <Tooltip
                      content={(props) => {
                        const { active, payload, label } = props;
                        if (active && payload && payload.length) {
                          const reactionEmojis: Record<string, string> = {
                            Like: "👍", Love: "❤️", Care: "🤗", Haha: "😂",
                            Wow: "😮", Sad: "😢", Angry: "😡"
                          };
                          return (
                            <div className="bg-white px-4 py-3 rounded-xl shadow-lg border border-gray-200">
                              <p className="font-bold text-gray-900 mb-2">{label}</p>
                              {payload.map((entry, index) => (
                                <p key={index} className="text-sm flex items-center gap-2 font-medium" style={{ color: entry.color }}>
                                  <span>{reactionEmojis[entry.name as string] || ""}</span>
                                  <span>{entry.name}:</span>
                                  <strong>{(entry.value as number)?.toLocaleString()}</strong>
                                </p>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "13px", fontWeight: 600, paddingTop: "10px" }}
                      formatter={(value) => {
                        const emojis: Record<string, string> = {
                          Like: "👍", Love: "❤️", Care: "🤗", Haha: "😂",
                          Wow: "😮", Sad: "😢", Angry: "😡"
                        };
                        return <span className="text-gray-800 font-semibold">{emojis[value] || ""} {value}</span>;
                      }}
                    />
                    <Line type="monotone" dataKey="Like" stroke={REACTION_COLORS.Like} strokeWidth={3} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Love" stroke={REACTION_COLORS.Love} strokeWidth={3} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Care" stroke={REACTION_COLORS.Care} strokeWidth={2.5} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="Haha" stroke={REACTION_COLORS.Haha} strokeWidth={2.5} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="Wow" stroke={REACTION_COLORS.Wow} strokeWidth={2} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="Sad" stroke={REACTION_COLORS.Sad} strokeWidth={2} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="Angry" stroke={REACTION_COLORS.Angry} strokeWidth={2} dot={{ r: 2 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: FORMATS */}
      {activeTab === "formats" && (
        <div className="space-y-6">
          {/* Format Comparison Cards - 2 columns for balance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {formatPerformance.map((format, i) => {
              const totalEngagement = format.avgEngagement * format.count;

              return (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-6 shadow-sm"
                  style={{ borderTop: `4px solid ${FORMAT_COLORS[format.format]}` }}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <span className="text-3xl">{getFormatIcon(format.format)}</span>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{format.format}</h3>
                      <p className="text-gray-500 text-sm">{format.count} bài đăng</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-[#1877F2]">{format.avgLikes}</div>
                      <div className="text-xs text-gray-500">Avg Likes</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-[#F59E0B]">{format.avgComments}</div>
                      <div className="text-xs text-gray-500">Avg Comments</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-[#8B5CF6]">{format.avgShares}</div>
                      <div className="text-xs text-gray-500">Avg Shares</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-[#10B981]">{format.avgEngagement}</div>
                      <div className="text-xs text-gray-500">Avg Engagement</div>
                    </div>
                  </div>

                  {/* Video content (Reel/Video): Show Avg Views */}
                  {format.avgViews !== null && format.avgViews > 0 && (
                    <div className="mt-4 bg-gradient-to-r from-pink-50 to-pink-100/50 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-[#EC4899]">{formatNumber(format.avgViews)}</div>
                      <div className="text-xs text-gray-500">Avg Views per {format.format}</div>
                      <div className="text-[11px] text-gray-400 mt-1">Total: {formatNumber(format.totalViews || 0)} views</div>
                    </div>
                  )}

                  {/* Static content (Photo/Text): Show Total Engagement instead */}
                  {(format.avgViews === null || format.avgViews === 0) && (
                    <div className="mt-4 bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-[#3B82F6]">{formatNumber(totalEngagement)}</div>
                      <div className="text-xs text-gray-500">Total Engagement</div>
                      <div className="text-[11px] text-gray-400 mt-1">Avg per post: {format.avgEngagement}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Duration Analysis */}
          {durationAnalysis.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">⏱️ Phân tích độ dài Reel</h3>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={durationAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="avgViews" name="Avg Views" fill="#EC4899" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="avgEngagement" name="Avg Engagement" fill="#1877F2" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="count" name="Số lượng" stroke="#10B981" strokeWidth={3} dot={{ fill: "#10B981", r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>

              {/* Duration Summary Cards */}
              <div className="grid grid-cols-4 gap-3 mt-4">
                {durationAnalysis.map((item, idx) => {
                  const icons = ["⚡", "🎯", "📈", "🔥"];
                  const colors = ["bg-pink-50 border-pink-200", "bg-blue-50 border-blue-200", "bg-green-50 border-green-200", "bg-orange-50 border-orange-200"];
                  const textColors = ["text-pink-600", "text-blue-600", "text-green-600", "text-orange-600"];
                  return (
                    <div key={idx} className={`${colors[idx]} border rounded-xl p-3 text-center`}>
                      <div className="text-lg mb-1">{icons[idx]}</div>
                      <div className={`text-2xl font-bold ${textColors[idx]}`}>{item.count}</div>
                      <div className="text-xs text-gray-500 mt-1">{item.range}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reel vs Photo Comparison */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">📊 So sánh Reel vs Photo</h3>
            <p className="text-sm text-gray-500 mb-4">Tổng metrics theo từng format</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={reelVsPhotoComparison.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="Reel" name="🎬 Reel" fill="#EC4899" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Photo" name="📷 Photo" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Performance Ratio Cards */}
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-500 mb-3">Tỷ lệ hiệu suất Reel/Photo</p>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-pink-500">{reelVsPhotoComparison.ratio.likes}x</div>
                  <div className="text-xs text-gray-400 mt-1">Tổng Likes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-500">{reelVsPhotoComparison.ratio.comments}x</div>
                  <div className="text-xs text-gray-400 mt-1">Tổng Comments</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-violet-500">{reelVsPhotoComparison.ratio.shares}x</div>
                  <div className="text-xs text-gray-400 mt-1">Tổng Shares</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-500">{reelVsPhotoComparison.ratio.engagement}x</div>
                  <div className="text-xs text-gray-400 mt-1">TB Engagement</div>
                </div>
              </div>
              {/* Explanation note */}
              <p className="text-xs text-gray-400 mt-3 italic">
                💡 Tỷ lệ = TB mỗi Reel / TB mỗi Photo. VD: 24x nghĩa là mỗi Reel có likes gấp 24 lần mỗi Photo.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB: DETAILS */}
      {activeTab === "details" && (
        <div className="space-y-4">
          {/* Header with Actions */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between flex-wrap gap-3">
                {/* Left: Filter & Sort */}
                <div className="flex items-center gap-3 flex-wrap">
                  <select
                    value={filterFormat}
                    onChange={(e) => setFilterFormat(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                  >
                    <option value="all">📋 Tất cả ({processedPosts.length})</option>
                    <option value="reel">🎬 Reels ({processedPosts.filter(p => p.format === "reel").length})</option>
                    <option value="photo">📷 Photos ({processedPosts.filter(p => p.format === "photo").length})</option>
                    <option value="video">🎥 Videos ({processedPosts.filter(p => p.format === "video").length})</option>
                    <option value="text">📝 Text ({processedPosts.filter(p => p.format === "text").length})</option>
                  </select>
                  <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as keyof ProcessedPost)}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                  >
                    <option value="engagement">Sort: Engagement</option>
                    <option value="likes">Sort: Likes</option>
                    <option value="comments">Sort: Comments</option>
                    <option value="shares">Sort: Shares</option>
                    <option value="views">Sort: Views</option>
                    <option value="date">Sort: Date</option>
                  </select>
                  <button
                    onClick={() => setSortDirection((d) => (d === "desc" ? "asc" : "desc"))}
                    className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm hover:bg-gray-50"
                  >
                    {sortDirection === "desc" ? "↓ Cao → Thấp" : "↑ Thấp → Cao"}
                  </button>
                </div>

                {/* Right: Search & Actions */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search caption, hashtag..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  {/* Expand/Collapse toggle */}
                  <button
                    onClick={() => expandedIds.size > 0 ? collapseAll() : expandAll()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200"
                    title={expandedIds.size > 0 ? "Thu gọn tất cả" : "Mở rộng tất cả"}
                  >
                    {expandedIds.size > 0 ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Thu gọn
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Mở rộng
                      </>
                    )}
                  </button>
                  <button
                    onClick={exportToExcel}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Export Excel
                  </button>
                  <button
                    onClick={onSync}
                    disabled={isSyncing}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? "Syncing..." : "Sync"}
                  </button>
                </div>
              </div>

              {/* Selection Actions Bar */}
              {selectedIds.size > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-gray-600">
                    Đã chọn <strong>{selectedIds.size}</strong> mục
                    {selectedReelsCount > 0 && ` (${selectedReelsCount} reels)`}
                  </span>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Bỏ chọn
                  </button>

                  {/* Download Button - for all selected reels */}
                  {selectedReelsCount > 0 && onDownloadVideos && (
                    <button
                      onClick={() => onDownloadVideos(selectedVideos)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600"
                    >
                      <Download className="w-4 h-4" />
                      Download ({selectedReelsCount})
                    </button>
                  )}

                  {/* View Transcripts Button - for videos that have transcript */}
                  {videosWithTranscript.length > 0 && onViewTranscript && (
                    <button
                      onClick={() => onViewTranscript(videosWithTranscript[0])}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600"
                      title={videosWithTranscript.length > 1 ? `${videosWithTranscript.length} videos có transcript` : "View transcript"}
                    >
                      <FileText className="w-4 h-4" />
                      View ({videosWithTranscript.length})
                    </button>
                  )}

                  {/* Get Transcripts Button - for videos without transcript */}
                  {videosNeedingTranscript.length > 0 && (onFetchTranscripts || onFetchTranscript) && (
                    <button
                      onClick={() => {
                        if (videosNeedingTranscript.length === 1 && onFetchTranscript) {
                          onFetchTranscript(videosNeedingTranscript[0]);
                        } else if (onFetchTranscripts) {
                          onFetchTranscripts(videosNeedingTranscript);
                        } else if (onFetchTranscript) {
                          // Fallback: fetch one by one
                          videosNeedingTranscript.forEach((v) => onFetchTranscript(v));
                        }
                      }}
                      disabled={isAnyTranscribing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-purple-500 rounded-lg hover:bg-purple-600 disabled:opacity-50"
                    >
                      {isAnyTranscribing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                      {isAnyTranscribing ? "Đang xử lý..." : `Get Transcript (${videosNeedingTranscript.length})`}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-12 py-3 px-4">
                      <button
                        onClick={() => isAllSelected ? clearSelection() : selectAll()}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {isAllSelected ? (
                          <CheckSquare className="w-5 h-5 text-blue-500" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase">Hạng</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase">Format</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase">Media</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase">Ngày</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase">Nội dung</th>
                    <th className="text-center py-3 px-3 text-xs font-medium text-gray-500 uppercase">Views</th>
                    <th className="text-center py-3 px-3 text-xs font-medium text-gray-500 uppercase">Likes</th>
                    <th className="text-center py-3 px-3 text-xs font-medium text-gray-500 uppercase">Cmt</th>
                    <th className="text-center py-3 px-3 text-xs font-medium text-gray-500 uppercase">Shares</th>
                    <th className="text-center py-3 px-3 text-xs font-medium text-gray-500 uppercase">Engagement</th>
                    <th className="text-center py-3 px-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedPosts.map((post, index) => {
                    const isSelected = selectedIds.has(post.postId);
                    const isExpanded = expandedIds.has(post.postId);
                    const isReel = post.format === "reel";
                    const originalVideo = isReel ? videos.find(v => v.id === post.postId) : null;
                    const hasLongCaption = post.text.length > 80;

                    return (
                      <tr
                        key={post.postId}
                        className={`${isSelected ? "bg-blue-50" : index % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-gray-100/50 transition-colors`}
                      >
                        <td className="py-3 px-4">
                          <button
                            onClick={() => toggleSelection(post.postId)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-blue-500" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-center text-lg">{getRankBadge(index + 1)}</td>
                        <td className="py-3 px-3">
                          <span
                            className="px-2.5 py-1 rounded-full text-xs font-semibold"
                            style={{
                              background: `${FORMAT_COLORS[post.format.charAt(0).toUpperCase() + post.format.slice(1)]}20`,
                              color: FORMAT_COLORS[post.format.charAt(0).toUpperCase() + post.format.slice(1)],
                            }}
                          >
                            {getFormatIcon(post.format)} {post.format.toUpperCase()}
                          </span>
                        </td>
                        {/* Media Thumbnail */}
                        <td className="py-3 px-3">
                          {post.thumbnail ? (
                            <a
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block relative group"
                            >
                              <img
                                src={post.thumbnail}
                                alt=""
                                className="w-16 h-16 object-cover rounded-lg border border-gray-200 group-hover:border-blue-400 transition-colors"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                              {isReel && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Play className="w-6 h-6 text-white" />
                                </div>
                              )}
                            </a>
                          ) : (
                            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                              {isReel ? <Play className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-sm text-gray-500 whitespace-nowrap">{post.date}</td>
                        <td className="py-3 px-3 min-w-[280px] max-w-[400px]">
                          {/* Expandable Caption */}
                          <div className="group">
                            <div
                              className={`text-sm text-gray-900 transition-all duration-200 ${
                                isExpanded ? "" : "line-clamp-1"
                              }`}
                            >
                              {post.text || <span className="text-gray-400 italic">No caption</span>}
                            </div>
                            {hasLongCaption && (
                              <button
                                onClick={() => toggleExpand(post.postId)}
                                className="flex items-center gap-1 mt-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-3 h-3" />
                                    Thu gọn
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3 h-3" />
                                    Xem thêm
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                          {/* Tags row + Link to original */}
                          <div className="flex gap-1 mt-1.5 flex-wrap items-center">
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                              style={{
                                background: `${TOPIC_COLORS[post.topic] || "#8B5CF6"}20`,
                                color: TOPIC_COLORS[post.topic] || "#8B5CF6",
                              }}
                            >
                              {post.topic}
                            </span>
                            {post.durationMin && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600">
                                {post.durationMin}m
                              </span>
                            )}
                            {post.url && (
                              <a
                                href={post.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Xem bài gốc
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {post.views ? (
                            <div>
                              <div className="font-semibold text-[#EC4899]">{formatNumber(post.views)}</div>
                              <div className="text-[10px] text-gray-400">{post.viewEngagementRate}%</div>
                            </div>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-[#1877F2]">{post.likes.toLocaleString()}</td>
                        <td className="py-3 px-3 text-center font-semibold text-[#F59E0B]">{post.comments}</td>
                        <td className="py-3 px-3 text-center font-semibold text-[#8B5CF6]">{post.shares}</td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block bg-gradient-to-r from-[#10B981] to-[#059669] text-white px-2.5 py-1 rounded-full font-bold text-xs">
                            {post.engagement.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center gap-1">
                            {isReel && originalVideo && onDownloadVideos && (
                              <button
                                onClick={() => onDownloadVideos([originalVideo])}
                                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            )}
                            {isReel && originalVideo && (
                              originalVideo.transcript ? (
                                // Has transcript - show VIEW button
                                onViewTranscript && (
                                  <button
                                    onClick={() => onViewTranscript(originalVideo)}
                                    className="px-2 py-1 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded transition-colors"
                                    title="View Transcript"
                                  >
                                    VIEW
                                  </button>
                                )
                              ) : (
                                // No transcript - fetch it
                                onFetchTranscript && (
                                  fetchingTranscriptIds.has(originalVideo.id) ? (
                                    <div className="p-1.5 text-purple-500">
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => onFetchTranscript(originalVideo)}
                                      className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                                      title="Get Transcript"
                                    >
                                      <Mic className="w-4 h-4" />
                                    </button>
                                  )
                                )
                              )
                            )}
                            <a
                              href={`https://facebook.com/${post.postId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="View on Facebook"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-500">
              Hiển thị {sortedPosts.length} / {processedPosts.length} mục
            </div>
          </div>
        </div>
      )}

      {/* TAB: ANALYSIS */}
      {activeTab === "analysis" && (
        <div className="space-y-6">
          {/* Highlight Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Top Engagement Post */}
            <div className="bg-gradient-to-br from-[#10B981] to-[#059669] rounded-2xl p-6 text-white">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🏆</span>
                <span className="font-semibold">Top Engagement</span>
              </div>
              <div className="text-3xl font-bold mb-2">{topPosts.byEngagement[0]?.engagement.toLocaleString()}</div>
              <div className="text-sm opacity-90 line-clamp-2">{topPosts.byEngagement[0]?.shortTitle}</div>
              <div className="mt-3 bg-white/20 rounded-lg px-3 py-2 text-xs">
                {getFormatIcon(topPosts.byEngagement[0]?.format || "")} {topPosts.byEngagement[0]?.format.toUpperCase()} • {topPosts.byEngagement[0]?.date}
              </div>
            </div>

            {/* Most Viewed Reel */}
            {topPosts.byViews[0] && (
              <div className="bg-gradient-to-br from-[#EC4899] to-[#C13584] rounded-2xl p-6 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">👁️</span>
                  <span className="font-semibold">Most Viewed Reel</span>
                </div>
                <div className="text-3xl font-bold mb-2">{formatNumber(topPosts.byViews[0]?.views || 0)} views</div>
                <div className="text-sm opacity-90 line-clamp-2">{topPosts.byViews[0]?.shortTitle}</div>
                <div className="mt-3 bg-white/20 rounded-lg px-3 py-2 text-xs">
                  Duration: {topPosts.byViews[0]?.durationMin}m • {topPosts.byViews[0]?.viewEngagementRate}% engagement rate
                </div>
              </div>
            )}

            {/* Viral King */}
            <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] rounded-2xl p-6 text-white">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🚀</span>
                <span className="font-semibold">Viral King</span>
              </div>
              <div className="text-3xl font-bold mb-2">{topPosts.byShares[0]?.shares} shares</div>
              <div className="text-sm opacity-90 line-clamp-2">{topPosts.byShares[0]?.shortTitle}</div>
              <div className="mt-3 bg-white/20 rounded-lg px-3 py-2 text-xs">
                {getFormatIcon(topPosts.byShares[0]?.format || "")} {topPosts.byShares[0]?.format.toUpperCase()} • Topic: {topPosts.byShares[0]?.topic}
              </div>
            </div>

            {/* Best Engagement Rate */}
            {topPosts.byEngagementRate[0] && (
              <div className="bg-gradient-to-br from-[#F59E0B] to-[#D97706] rounded-2xl p-6 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">📈</span>
                  <span className="font-semibold">Best Engagement Rate</span>
                </div>
                <div className="text-3xl font-bold mb-2">{topPosts.byEngagementRate[0]?.viewEngagementRate}%</div>
                <div className="text-sm opacity-90 line-clamp-2">{topPosts.byEngagementRate[0]?.shortTitle}</div>
                <div className="mt-3 bg-white/20 rounded-lg px-3 py-2 text-xs">
                  {formatNumber(topPosts.byEngagementRate[0]?.views || 0)} views → {topPosts.byEngagementRate[0]?.engagement} engagement
                </div>
              </div>
            )}
          </div>

          {/* Top 5 Rankings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top 5 by Engagement */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-4">🔥 Top 5 Engagement</h3>
              {topPosts.byEngagement.map((post, i) => {
                const rankKey = `engagement-${post.postId}`;
                const isExpanded = expandedRankingIds.has(rankKey);
                const hasLongCaption = post.text.length > 50;
                const isReel = post.format === "reel";
                return (
                  <div key={post.postId} className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
                    <span className="text-lg w-7 text-center mt-0.5">{getRankBadge(i + 1)}</span>
                    {/* Thumbnail */}
                    {post.thumbnail ? (
                      <a href={post.url} target="_blank" rel="noopener noreferrer" className="block relative group shrink-0">
                        <img src={post.thumbnail} alt="" className="w-12 h-12 object-cover rounded-lg border border-gray-200 group-hover:border-blue-400" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        {isReel && <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Play className="w-4 h-4 text-white" /></div>}
                      </a>
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 shrink-0">{isReel ? <Play className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium text-gray-900 ${isExpanded ? "" : "line-clamp-2"}`}>
                        {post.text || <span className="text-gray-400 italic">No caption</span>}
                      </div>
                      {hasLongCaption && (
                        <button
                          onClick={() => toggleRankingExpand("engagement", post.postId)}
                          className="flex items-center gap-1 mt-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
                        >
                          {isExpanded ? (
                            <><ChevronUp className="w-3 h-3" /> Thu gọn</>
                          ) : (
                            <><ChevronDown className="w-3 h-3" /> Xem thêm</>
                          )}
                        </button>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">{getFormatIcon(post.format)} {post.format} • {post.topic}</span>
                        {post.url && <a href={post.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[10px] text-blue-500 hover:text-blue-700"><ExternalLink className="w-3 h-3" /></a>}
                      </div>
                    </div>
                    <div className="font-bold text-[#10B981] whitespace-nowrap">{post.engagement.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>

            {/* Top 5 by Views */}
            {topPosts.byViews.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-base font-semibold text-gray-900 mb-4">👁️ Top 5 Views (Reels)</h3>
                {topPosts.byViews.map((post, i) => {
                  const rankKey = `views-${post.postId}`;
                  const isExpanded = expandedRankingIds.has(rankKey);
                  const hasLongCaption = post.text.length > 50;
                  return (
                    <div key={post.postId} className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
                      <span className="text-lg w-7 text-center mt-0.5">{getRankBadge(i + 1)}</span>
                      {/* Thumbnail */}
                      {post.thumbnail ? (
                        <a href={post.url} target="_blank" rel="noopener noreferrer" className="block relative group shrink-0">
                          <img src={post.thumbnail} alt="" className="w-12 h-12 object-cover rounded-lg border border-gray-200 group-hover:border-blue-400" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Play className="w-4 h-4 text-white" /></div>
                        </a>
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 shrink-0"><Play className="w-4 h-4" /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium text-gray-900 ${isExpanded ? "" : "line-clamp-2"}`}>
                          {post.text || <span className="text-gray-400 italic">No caption</span>}
                        </div>
                        {hasLongCaption && (
                          <button
                            onClick={() => toggleRankingExpand("views", post.postId)}
                            className="flex items-center gap-1 mt-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
                          >
                            {isExpanded ? (
                              <><ChevronUp className="w-3 h-3" /> Thu gọn</>
                            ) : (
                              <><ChevronDown className="w-3 h-3" /> Xem thêm</>
                            )}
                          </button>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400">{post.durationMin}m • {post.viewEngagementRate}% rate</span>
                          {post.url && <a href={post.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[10px] text-blue-500 hover:text-blue-700"><ExternalLink className="w-3 h-3" /></a>}
                        </div>
                      </div>
                      <div className="font-bold text-[#EC4899] whitespace-nowrap">{formatNumber(post.views || 0)}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Top 5 by Shares */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-4">🔄 Top 5 Shares</h3>
              {topPosts.byShares.map((post, i) => {
                const rankKey = `shares-${post.postId}`;
                const isExpanded = expandedRankingIds.has(rankKey);
                const hasLongCaption = post.text.length > 50;
                const isReel = post.format === "reel";
                return (
                  <div key={post.postId} className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
                    <span className="text-lg w-7 text-center mt-0.5">{getRankBadge(i + 1)}</span>
                    {/* Thumbnail */}
                    {post.thumbnail ? (
                      <a href={post.url} target="_blank" rel="noopener noreferrer" className="block relative group shrink-0">
                        <img src={post.thumbnail} alt="" className="w-12 h-12 object-cover rounded-lg border border-gray-200 group-hover:border-blue-400" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        {isReel && <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Play className="w-4 h-4 text-white" /></div>}
                      </a>
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 shrink-0">{isReel ? <Play className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium text-gray-900 ${isExpanded ? "" : "line-clamp-2"}`}>
                        {post.text || <span className="text-gray-400 italic">No caption</span>}
                      </div>
                      {hasLongCaption && (
                        <button
                          onClick={() => toggleRankingExpand("shares", post.postId)}
                          className="flex items-center gap-1 mt-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
                        >
                          {isExpanded ? (
                            <><ChevronUp className="w-3 h-3" /> Thu gọn</>
                          ) : (
                            <><ChevronDown className="w-3 h-3" /> Xem thêm</>
                          )}
                        </button>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">{getFormatIcon(post.format)} {post.format} • {post.topic}</span>
                        {post.url && <a href={post.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[10px] text-blue-500 hover:text-blue-700"><ExternalLink className="w-3 h-3" /></a>}
                      </div>
                    </div>
                    <div className="font-bold text-[#8B5CF6] whitespace-nowrap">{post.shares}</div>
                  </div>
                );
              })}
            </div>

            {/* Top 5 by Engagement Rate */}
            {topPosts.byEngagementRate.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-base font-semibold text-gray-900 mb-4">📊 Top 5 Engagement Rate</h3>
                {topPosts.byEngagementRate.map((post, i) => {
                  const rankKey = `engrate-${post.postId}`;
                  const isExpanded = expandedRankingIds.has(rankKey);
                  const hasLongCaption = post.text.length > 50;
                  const isReel = post.format === "reel";
                  return (
                    <div key={post.postId} className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
                      <span className="text-lg w-7 text-center mt-0.5">{getRankBadge(i + 1)}</span>
                      {/* Thumbnail */}
                      {post.thumbnail ? (
                        <a href={post.url} target="_blank" rel="noopener noreferrer" className="block relative group shrink-0">
                          <img src={post.thumbnail} alt="" className="w-12 h-12 object-cover rounded-lg border border-gray-200 group-hover:border-blue-400" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          {isReel && <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Play className="w-4 h-4 text-white" /></div>}
                        </a>
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 shrink-0">{isReel ? <Play className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium text-gray-900 ${isExpanded ? "" : "line-clamp-2"}`}>
                          {post.text || <span className="text-gray-400 italic">No caption</span>}
                        </div>
                        {hasLongCaption && (
                          <button
                            onClick={() => toggleRankingExpand("engrate", post.postId)}
                            className="flex items-center gap-1 mt-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
                          >
                            {isExpanded ? (
                              <><ChevronUp className="w-3 h-3" /> Thu gọn</>
                            ) : (
                              <><ChevronDown className="w-3 h-3" /> Xem thêm</>
                            )}
                          </button>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400">{formatNumber(post.views || 0)} views • {post.engagement} eng</span>
                          {post.url && <a href={post.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[10px] text-blue-500 hover:text-blue-700"><ExternalLink className="w-3 h-3" /></a>}
                        </div>
                      </div>
                      <div className="font-bold text-[#F59E0B] whitespace-nowrap">{post.viewEngagementRate}%</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Formula Note */}
      <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-500 border border-gray-100">
        <span className="font-medium text-gray-600">💡 Công thức:</span>
        <span className="ml-2">ENGAGEMENT = Likes + Comments + Shares</span>
        <span className="mx-2">•</span>
        <span>VIEW RATE = Engagement / Views × 100%</span>
      </div>
    </div>
  );
}

