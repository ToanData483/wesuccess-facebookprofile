/**
 * Facebook API Service
 * Uses Next.js API routes to proxy Apify requests (avoid CORS)
 * Requires Apify API token to be configured in Settings
 */

import { getApiKey } from "./config-store";

// Get Apify token from config store
function getApifyToken(): string {
  if (typeof window !== "undefined") {
    const token = getApiKey("apify");
    console.log("[Facebook API] Token check:", token ? "configured" : "not configured");
    return token || "";
  }
  return process.env.NEXT_PUBLIC_APIFY_TOKEN || "";
}

export interface FacebookProfile {
  username: string;
  fullName: string;
  biography: string;
  profilePicUrl: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isVerified: boolean;
  isPrivate: boolean;
  externalUrl?: string;
}

export interface FacebookVideo {
  id: string;
  shortcode: string;
  url: string;
  thumbnailUrl: string;
  videoUrl?: string; // Direct video URL for transcription
  caption: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  duration: number;
  timestamp: string;
  isVideo: boolean;
  isReel?: boolean;
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

export interface FacebookPost {
  id: string;
  shortcode: string;
  url: string;
  images: string[];
  thumbnail: string;
  caption: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  timestamp: string;
  isCarousel: boolean;
  carouselCount: number;
  reactionsBreakdown?: ReactionsBreakdown; // Detailed reaction breakdown if available
}

export interface ChannelData {
  profile: FacebookProfile;
  videos: FacebookVideo[];
  posts: FacebookPost[];
  totalVideos: number;
  totalPosts: number;
}

/**
 * Fetch Facebook profile info via API route proxy
 */
export async function getProfileInfo(
  username: string
): Promise<FacebookProfile> {
  const cleanUsername = username.replace(/^@/, "").trim();
  const token = getApifyToken();

  // Throw error if no token configured
  if (!token || token.trim() === "") {
    throw new Error("APIFY_TOKEN_REQUIRED");
  }

  try {
    // Use Next.js API route to avoid CORS
    const response = await fetch("/api/apify/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: cleanUsername, token }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Profile API error:", response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const results = await response.json();
    const data = results[0];

    if (!data) {
      throw new Error("Profile not found");
    }

    // Note: API route caches profilePicUrl, so prefer it over HD version
    // profilePicUrl is already cached local path from API, profilePicUrlHD is original URL
    return {
      username: data.username || cleanUsername,
      fullName: data.fullName || data.full_name || "",
      biography: data.biography || data.bio || "",
      profilePicUrl: data.profilePicUrl || data.profilePicUrlHD || data.profile_pic_url_hd || "",
      followersCount: data.followersCount || data.followers || 0,
      followingCount: data.followingCount || data.following || 0,
      postsCount: data.postsCount || data.posts_count || 0,
      isVerified: data.isVerified || data.verified || false,
      isPrivate: data.isPrivate || data.is_private || false,
      externalUrl: data.externalUrl || data.external_url,
    };
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    throw error;
  }
}

/**
 * Fetch Facebook user's videos/reels via facebook-posts-scraper
 * Smart Combine: Uses /api/apify/posts which returns ALL content, then filters videos
 * This reduces API calls from 3 to 2 per sync
 */
export async function getProfileVideos(
  username: string,
  limit: number = 20,
  includeVideoTranscript: boolean = true
): Promise<FacebookVideo[]> {
  const cleanUsername = username.replace(/^@/, "").trim();
  const token = getApifyToken();

  // Throw error if no token configured
  if (!token || token.trim() === "") {
    throw new Error("APIFY_TOKEN_REQUIRED");
  }

  try {
    // Smart Combine: Use /posts endpoint which now returns ALL content (posts + videos)
    // Then filter for videos only
    const response = await fetch("/api/apify/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: cleanUsername, limit, token }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Posts API error:", response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const results = await response.json();

    if (!Array.isArray(results)) {
      throw new Error("Invalid response format");
    }

    // Filter for video content only (isVideo flag set by server)
    const videoItems = results.filter((item: { isVideo?: boolean }) => item.isVideo === true);
    console.log("[getProfileVideos] Smart Combine: filtered", videoItems.length, "videos from", results.length, "items");

    return videoItems.map((item: Record<string, unknown>, index: number) => ({
      id: (item.id as string) || `video_${index}`,
      shortcode: (item.shortcode as string) || `code_${index}`,
      url: (item.url as string) || `https://www.facebook.com/watch/?v=${item.id}/`,
      thumbnailUrl: (item.thumbnail as string) || "",
      videoUrl: (item.videoUrl as string) || "",
      caption: (item.caption as string) || "",
      viewCount: (item.viewsCount as number) || (item.playsCount as number) || 0,
      likeCount: (item.likesCount as number) || 0,
      commentCount: (item.commentsCount as number) || 0,
      shareCount: (item.sharesCount as number) || 0,
      duration: (item.videoDuration as number) || 0,
      // Keep createTime as number for filtering, add timestamp as ISO string for display
      createTime: (item.createTime as number) || Date.now(),
      timestamp: item.createTime ? new Date(item.createTime as number).toISOString() : new Date().toISOString(),
      isVideo: true,
      isReel: false,
      // Pass format from API (URL-based detection)
      format: (item.format as "reel" | "video" | "photo" | "text") || "video",
    }));
  } catch (error) {
    console.error("Failed to fetch videos:", error);
    throw error;
  }
}

/**
 * Fetch Facebook user's image posts via API route proxy
 * Smart Combine: API returns ALL content, this filters for non-video posts only
 */
export async function getProfilePosts(
  username: string,
  limit: number = 20,
  dateOptions?: {
    onlyPostsNewerThan?: string;
    onlyPostsOlderThan?: string;
  }
): Promise<FacebookPost[]> {
  const cleanUsername = username.replace(/^@/, "").trim();
  const token = getApifyToken();

  // Throw error if no token configured
  if (!token || token.trim() === "") {
    throw new Error("APIFY_TOKEN_REQUIRED");
  }

  try {
    // Use Next.js API route to avoid CORS
    const response = await fetch("/api/apify/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: cleanUsername,
        limit,
        token,
        onlyPostsNewerThan: dateOptions?.onlyPostsNewerThan,
        onlyPostsOlderThan: dateOptions?.onlyPostsOlderThan,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Posts API error:", response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const results = await response.json();

    if (!Array.isArray(results)) {
      throw new Error("Invalid response format");
    }

    // Smart Combine: Filter OUT videos, keep only image/text posts
    const postItems = results.filter((item: { isVideo?: boolean }) => item.isVideo !== true);
    console.log("[getProfilePosts] Smart Combine: filtered", postItems.length, "posts from", results.length, "items");

    return postItems.map((item: Record<string, unknown>, index: number) => ({
      id: (item.id as string) || `post_${index}`,
      shortcode: (item.shortcode as string) || `code_${index}`,
      url: (item.url as string) || `https://www.facebook.com/p/${item.shortcode}/`,
      images: (item.images as string[]) || (item.childImages as string[]) || [(item.thumbnail as string)],
      thumbnail: (item.thumbnail as string) || "",
      caption: (item.caption as string) || "",
      likeCount: (item.likesCount as number) || 0,
      commentCount: (item.commentsCount as number) || 0,
      shareCount: (item.sharesCount as number) || (item.shareCount as number) || 0,
      // Keep createTime as number for filtering, add timestamp as ISO string for display
      createTime: (item.createTime as number) || Date.now(),
      timestamp: item.createTime ? new Date(item.createTime as number).toISOString() : new Date().toISOString(),
      isCarousel: (item.isCarousel as boolean) || false,
      carouselCount: (item.carouselCount as number) || 1,
      reactionsBreakdown: item.reactionsBreakdown as ReactionsBreakdown | undefined,
      // Pass format and contentType from API
      format: (item.format as "reel" | "video" | "photo" | "text") || "photo",
      contentType: (item.contentType as string) || "single_image",
    }));
  } catch (error) {
    console.error("Failed to fetch posts:", error);
    throw error;
  }
}

// Apify facebook-posts-scraper options
// Docs: https://apify.com/apify/facebook-posts-scraper/input-schema
export interface FetchOptions {
  resultsLimit?: number;
  onlyPostsNewerThan?: string; // YYYY-MM-DD format
  onlyPostsOlderThan?: string; // YYYY-MM-DD format
}

/**
 * Get full profile data (profile + posts + videos)
 * Smart Combine: Single /posts call returns ALL content, then filter client-side
 * This reduces API calls from 3 to 2 per sync (profile + posts)
 */
export async function getChannelData(
  username: string,
  options?: FetchOptions
): Promise<ChannelData> {
  const resultsLimit = options?.resultsLimit || 20;
  const cleanUsername = username.replace(/^@/, "").trim();
  const token = getApifyToken();

  if (!token || token.trim() === "") {
    throw new Error("APIFY_TOKEN_REQUIRED");
  }

  // Smart Combine: Only 2 API calls (profile + posts)
  // /posts returns ALL content (posts + videos), filter client-side
  const [profile, allContentResponse] = await Promise.all([
    getProfileInfo(username),
    fetch("/api/apify/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: cleanUsername,
        limit: resultsLimit,
        token,
        onlyPostsNewerThan: options?.onlyPostsNewerThan,
        onlyPostsOlderThan: options?.onlyPostsOlderThan,
      }),
    }),
  ]);

  if (!allContentResponse.ok) {
    const errorText = await allContentResponse.text();
    console.error("Posts API error:", allContentResponse.status, errorText);
    throw new Error(`API error: ${allContentResponse.status}`);
  }

  const allContent = await allContentResponse.json();
  if (!Array.isArray(allContent)) {
    throw new Error("Invalid response format");
  }

  // Smart Combine: Split content into posts vs videos
  const postItems = allContent.filter((item: { isVideo?: boolean }) => item.isVideo !== true);
  const videoItems = allContent.filter((item: { isVideo?: boolean }) => item.isVideo === true);

  console.log("[getChannelData] Smart Combine:", allContent.length, "items ->", postItems.length, "posts +", videoItems.length, "videos");

  // Transform posts
  const posts: FacebookPost[] = postItems.map((item: Record<string, unknown>, index: number) => ({
    id: (item.id as string) || `post_${index}`,
    shortcode: (item.shortcode as string) || `code_${index}`,
    url: (item.url as string) || `https://www.facebook.com/p/${item.shortcode}/`,
    images: (item.images as string[]) || (item.childImages as string[]) || [(item.thumbnail as string)],
    thumbnail: (item.thumbnail as string) || "",
    caption: (item.caption as string) || "",
    likeCount: (item.likesCount as number) || 0,
    commentCount: (item.commentsCount as number) || 0,
    shareCount: (item.sharesCount as number) || (item.shareCount as number) || 0,
    // Keep createTime as number for filtering, add timestamp as ISO string for display
    createTime: (item.createTime as number) || Date.now(),
    timestamp: item.createTime ? new Date(item.createTime as number).toISOString() : new Date().toISOString(),
    isCarousel: (item.isCarousel as boolean) || false,
    carouselCount: (item.carouselCount as number) || 1,
    reactionsBreakdown: item.reactionsBreakdown as ReactionsBreakdown | undefined,
    // Pass format and contentType from API
    format: (item.format as "reel" | "video" | "photo" | "text") || "photo",
    contentType: (item.contentType as string) || "single_image",
  }));

  // Transform videos
  const videos: FacebookVideo[] = videoItems.map((item: Record<string, unknown>, index: number) => ({
    id: (item.id as string) || `video_${index}`,
    shortcode: (item.shortcode as string) || `code_${index}`,
    url: (item.url as string) || `https://www.facebook.com/watch/?v=${item.id}/`,
    thumbnailUrl: (item.thumbnail as string) || "",
    videoUrl: (item.videoUrl as string) || "",
    caption: (item.caption as string) || "",
    viewCount: (item.viewsCount as number) || (item.playsCount as number) || 0,
    likeCount: (item.likesCount as number) || 0,
    commentCount: (item.commentsCount as number) || 0,
    shareCount: (item.sharesCount as number) || 0,
    duration: (item.videoDuration as number) || 0,
    // Keep createTime as number for filtering, add timestamp as ISO string for display
    createTime: (item.createTime as number) || Date.now(),
    timestamp: item.createTime ? new Date(item.createTime as number).toISOString() : new Date().toISOString(),
    isVideo: true,
    isReel: false,
    // Pass format from API (URL-based detection)
    format: (item.format as "reel" | "video" | "photo" | "text") || "video",
  }));

  console.log("[getChannelData] Photos from posts-scraper:", posts.length);
  console.log("[getChannelData] Videos from posts-scraper:", videos.length);

  // Count videos with direct URLs (from videoDeliveryLegacyFields)
  const videosWithVideoUrl = videos.filter((v) => v.videoUrl).length;
  console.log("[getChannelData] Videos with direct URLs:", videosWithVideoUrl, "/", videos.length);

  // Debug: Log sample video data
  if (videos.length > 0) {
    console.log("[getChannelData] Sample video:", {
      id: videos[0].id,
      caption: videos[0].caption?.slice(0, 30) || "(empty)",
      viewCount: videos[0].viewCount,
      hasVideoUrl: !!videos[0].videoUrl,
    });
  }

  return {
    profile,
    videos,
    posts,
    totalVideos: videos.length,
    totalPosts: posts.length,
  };
}

/**
 * Check if Apify API is configured
 */
export function isApifyConfigured(): boolean {
  if (typeof window !== "undefined") {
    const token = getApiKey("apify");
    return !!token && token.trim() !== "";
  }
  return !!process.env.NEXT_PUBLIC_APIFY_TOKEN;
}

/**
 * Calculate engagement metrics
 */
export function calculateEngagement(
  profile: FacebookProfile,
  videos: FacebookVideo[]
): {
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  engagementRate: number;
  totalViews: number;
} {
  if (videos.length === 0) {
    return {
      avgViews: 0,
      avgLikes: 0,
      avgComments: 0,
      engagementRate: 0,
      totalViews: 0,
    };
  }

  const totalViews = videos.reduce((sum, v) => sum + v.viewCount, 0);
  const totalLikes = videos.reduce((sum, v) => sum + v.likeCount, 0);
  const totalComments = videos.reduce((sum, v) => sum + v.commentCount, 0);

  const avgViews = totalViews / videos.length;
  const avgLikes = totalLikes / videos.length;
  const avgComments = totalComments / videos.length;

  // Engagement rate = (likes + comments) / followers * 100
  const engagementRate =
    profile.followersCount > 0
      ? ((avgLikes + avgComments) / profile.followersCount) * 100
      : 0;

  return {
    avgViews: Math.round(avgViews),
    avgLikes: Math.round(avgLikes),
    avgComments: Math.round(avgComments),
    engagementRate: Math.round(engagementRate * 100) / 100,
    totalViews,
  };
}
