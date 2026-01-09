/**
 * Profile Project Types
 * Following TikTok Downloader architecture pattern
 */

// Profile project entry in storage
export interface ChannelProject {
  id: string;
  username: string;
  nickname?: string;
  avatar?: string;
  addedAt: number;
  lastSyncAt: number | null;
  status: "pending" | "syncing" | "synced" | "error";
  errorMessage?: string;
}

// Facebook profile data
export interface ChannelProfile {
  username: string;
  fullName: string;
  avatar: string;
  bio: string;
  followers: number;
  following: number;
  posts: number;
  isVerified: boolean;
  isPrivate: boolean;
  externalUrl?: string;
}

// Facebook reactions breakdown (Like, Love, Haha, Wow, Sad, Angry, Care)
export interface ReactionsBreakdown {
  like: number;
  love: number;
  haha: number;
  wow: number;
  sad: number;
  angry: number;
  care: number;
}

// Video/Reel metrics
export interface VideoMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reactions?: ReactionsBreakdown; // Detailed breakdown if available
}

// Video transcript
export interface VideoTranscript {
  text: string;
  language?: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  // Translation fields (when autoTranslate is enabled)
  translatedText?: string;
  translatedLanguage?: string;
}

// Video data
export interface VideoData {
  id: string;
  shortcode: string;
  url: string;
  videoUrl?: string;
  thumbnail: string;
  caption: string;
  duration: number;
  createTime: number;
  metrics: VideoMetrics;
  hashtags: string[];
  mentions: string[];
  transcript?: VideoTranscript;
  isReel: boolean;
  format?: ContentFormat; // URL-based format classification
}

// Post/Image metrics (no views for images)
export interface PostMetrics {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reactions?: ReactionsBreakdown; // Detailed breakdown if available
}

// Content type classification for detailed analytics
export type ContentType =
  | "text_only"     // Only text, no media
  | "single_image"  // Single image post
  | "single_video"  // Single video (not Reel)
  | "multi_image"   // Multiple images (carousel)
  | "multi_video"   // Multiple videos
  | "mixed_media"   // Mix of images and videos
  | "link_share"    // Shared link/article
  | "reel";         // Facebook Reel

// Format classification based on URL pattern (for UI display)
export type ContentFormat = "reel" | "video" | "photo" | "text";

// Post data (images, carousel)
export interface PostData {
  id: string;
  shortcode: string;
  url: string;
  images: string[]; // Array of image URLs (single or carousel)
  thumbnail: string;
  caption: string;
  createTime: number;
  metrics: PostMetrics;
  hashtags: string[];
  mentions: string[];
  isCarousel: boolean;
  carouselCount?: number; // Number of images in carousel
  // Detailed content classification
  contentType: ContentType;
  format?: ContentFormat; // URL-based format classification (reel/video/photo/text)
  isVideo?: boolean;
  videoUrl?: string;
  videoDuration?: number; // Duration in ms
}

// Profile analytics
export interface ChannelAnalytics {
  engagementRate: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  postingFrequency: number;
  topHashtags: Array<{ tag: string; count: number }>;
  bestPostingHours: number[];
  growthTrend: "up" | "down" | "stable";
  benchmarkRating: "excellent" | "good" | "average" | "low";
}

// Full profile data package
export interface ChannelData {
  projectId: string;
  profile: ChannelProfile;
  videos: VideoData[];
  posts?: PostData[]; // Image/Carousel posts (optional)
  analytics: ChannelAnalytics;
  fetchedAt: number;
}

// Download item for batch operations
export interface DownloadItem {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  status: "pending" | "downloading" | "completed" | "error";
  progress?: number;
  errorMessage?: string;
}

// Transcript item for batch operations
export interface TranscriptItem {
  id: string;
  videoUrl: string;
  title: string;
  status: "pending" | "processing" | "completed" | "error";
  transcript?: VideoTranscript;
  errorMessage?: string;
}
