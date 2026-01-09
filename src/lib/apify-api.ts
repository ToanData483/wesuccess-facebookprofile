/**
 * Apify API Service for Facebook
 * Uses apify/facebook-posts-scraper actor
 * Docs: https://apify.com/apify/facebook-posts-scraper
 */

import { getApiKey } from "./config-store";

// Get API token from unified config store
export function getApifyToken(): string {
  if (typeof window !== "undefined") {
    return getApiKey("apify") || process.env.NEXT_PUBLIC_APIFY_TOKEN || "";
  }
  return process.env.NEXT_PUBLIC_APIFY_TOKEN || "";
}

// Check if Apify is configured
export function isApifyConfigured(): boolean {
  return !!getApifyToken();
}

// === Facebook Video/Reel Result ===
export interface ApifyReelResult {
  id: string;
  shortCode: string;
  caption: string;
  commentsCount: number;
  likesCount: number;
  viewsCount: number;
  playsCount: number;
  sharesCount: number;
  duration: number;
  timestamp: string;
  ownerUsername: string;
  videoUrl: string;
  thumbnailUrl: string;
  originalThumbnailUrl?: string;
  transcript?: string;
  hashtags: string[];
  mentions: string[];
  // Facebook specific
  postUrl?: string;
  pageName?: string;
  pageUrl?: string;
}

// === Facebook Profile/Page Result ===
export interface ApifyProfileResult {
  id: string;
  username: string;
  fullName: string;
  biography: string;
  profilePicUrl: string;
  profilePicUrlHD?: string;
  originalProfilePicUrl?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  likesCount?: number;
  isVerified: boolean;
  isPrivate: boolean;
  externalUrl?: string;
  // Facebook specific
  pageId?: string;
  category?: string;
  address?: string;
  phone?: string;
  email?: string;
  coverPhoto?: string;
}

// === Facebook Post Result ===
export interface ApifyPostResult {
  id: string;
  shortcode: string;
  url: string;
  images: string[];
  thumbnail: string;
  originalThumbnail?: string;
  caption: string;
  createTime: number;
  likesCount: number;
  commentsCount: number;
  sharesCount?: number;
  hashtags: string[];
  mentions: string[];
  isCarousel: boolean;
  carouselCount: number;
  childImages?: string[];
  // Facebook specific
  pageName?: string;
  pageUrl?: string;
  isVideo?: boolean;
  videoUrl?: string;
}

/**
 * Scrape Facebook video via API route
 * Smart Combine: Uses /posts with pageUrl parameter
 */
export async function scrapeReel(url: string): Promise<ApifyReelResult | null> {
  const token = getApifyToken();
  if (!token) {
    throw new Error("Apify API token not configured");
  }

  try {
    // Smart Combine: Use /posts which now handles all content types
    const response = await fetch("/api/apify/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageUrl: url, limit: 1, token }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const results = await response.json();
    // Filter for video if multiple results returned
    const videoResult = Array.isArray(results)
      ? results.find((item: { isVideo?: boolean }) => item.isVideo === true) || results[0]
      : null;
    return videoResult || null;
  } catch (error) {
    console.error("Failed to scrape video:", error);
    throw error;
  }
}

/**
 * Scrape Facebook page/profile via API route
 */
export async function scrapeProfile(username: string): Promise<ApifyProfileResult | null> {
  const token = getApifyToken();
  if (!token) {
    throw new Error("Apify API token not configured");
  }

  const cleanUsername = username.replace(/^@/, "").trim();

  try {
    const response = await fetch("/api/apify/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: cleanUsername, token }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const results = await response.json();
    return results[0] || null;
  } catch (error) {
    console.error("Failed to scrape profile:", error);
    throw error;
  }
}

/**
 * Scrape videos from a Facebook page via API route
 * Smart Combine: Uses /posts which returns ALL content, then filters for videos
 */
export async function scrapeProfileReels(
  username: string,
  limit: number = 30
): Promise<ApifyReelResult[]> {
  const token = getApifyToken();
  if (!token) {
    throw new Error("Apify API token not configured");
  }

  const cleanUsername = username.replace(/^@/, "").trim();

  try {
    // Smart Combine: Use /posts which now returns ALL content
    const response = await fetch("/api/apify/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: cleanUsername, limit, token }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const allContent = await response.json();

    // Filter for video content only
    const videos = Array.isArray(allContent)
      ? allContent.filter((item: { isVideo?: boolean }) => item.isVideo === true)
      : [];

    console.log("[scrapeProfileReels] Smart Combine: filtered", videos.length, "videos from", allContent.length, "items");

    return videos as ApifyReelResult[];
  } catch (error) {
    console.error("Failed to scrape videos:", error);
    throw error;
  }
}

/**
 * Get channel data (profile + posts + videos)
 * Smart Combine: Uses single /posts call which returns ALL content, then filters
 * This reduces API calls from 3 to 2 per sync
 */
export async function getChannelData(username: string, options?: {
  postsLimit?: number;
  videosLimit?: number;
}): Promise<{
  profile: ApifyProfileResult | null;
  posts: ApifyPostResult[];
  videos: ApifyReelResult[];
}> {
  const token = getApifyToken();
  if (!token) {
    throw new Error("Apify API token not configured");
  }

  const cleanUsername = username.replace(/^@/, "").trim();
  const limit = Math.max(options?.postsLimit || 30, options?.videosLimit || 30);

  // Smart Combine: Only 2 API calls instead of 3
  // /posts now returns ALL content (posts + videos)
  const [profileRes, allContentRes] = await Promise.all([
    fetch("/api/apify/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: cleanUsername, token }),
    }),
    fetch("/api/apify/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: cleanUsername, limit, token }),
    }),
  ]);

  const [profileData, allContentData] = await Promise.all([
    profileRes.ok ? profileRes.json() : [],
    allContentRes.ok ? allContentRes.json() : [],
  ]);

  const allContent = Array.isArray(allContentData) ? allContentData : [];

  // Smart Combine: Filter content into posts vs videos
  const posts = allContent.filter((item: { isVideo?: boolean }) => item.isVideo !== true);
  const videos = allContent.filter((item: { isVideo?: boolean }) => item.isVideo === true);

  console.log("[getChannelData] Smart Combine:", allContent.length, "items ->", posts.length, "posts +", videos.length, "videos");

  return {
    profile: Array.isArray(profileData) ? profileData[0] || null : null,
    posts: posts as ApifyPostResult[],
    videos: videos as ApifyReelResult[],
  };
}

/**
 * Scrape posts from a Facebook page via API route
 * Smart Combine: Uses /posts which returns ALL content, filters for non-video posts
 */
export async function scrapeProfilePosts(
  username: string,
  limit: number = 30
): Promise<ApifyPostResult[]> {
  const token = getApifyToken();
  if (!token) {
    throw new Error("Apify API token not configured");
  }

  const cleanUsername = username.replace(/^@/, "").trim();

  try {
    const response = await fetch("/api/apify/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: cleanUsername, limit, token }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const allContent = await response.json();

    // Smart Combine: Filter OUT videos, keep only image/text posts
    const posts = Array.isArray(allContent)
      ? allContent.filter((item: { isVideo?: boolean }) => item.isVideo !== true)
      : [];

    console.log("[scrapeProfilePosts] Smart Combine: filtered", posts.length, "posts from", allContent.length, "items");

    return posts as ApifyPostResult[];
  } catch (error) {
    console.error("Failed to scrape posts:", error);
    throw error;
  }
}

/**
 * Quick video info (for preview)
 */
export async function getReelInfoQuick(url: string): Promise<{
  videoUrl: string;
  thumbnailUrl: string;
  caption: string;
  viewsCount: number;
  likesCount: number;
} | null> {
  const token = getApifyToken();
  if (!token) return null;

  try {
    const reel = await scrapeReel(url);
    if (!reel) return null;

    return {
      videoUrl: reel.videoUrl,
      thumbnailUrl: reel.thumbnailUrl,
      caption: reel.caption || "",
      viewsCount: reel.viewsCount || reel.playsCount || 0,
      likesCount: reel.likesCount || 0,
    };
  } catch {
    return null;
  }
}
