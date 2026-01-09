import { NextRequest, NextResponse } from "next/server";

const APIFY_BASE_URL = "https://api.apify.com/v2";
const FB_MEDIA_DOWNLOADER = "igview-owner%2Ffacebook-media-downloader";
const FB_POSTS_SCRAPER = "apify%2Ffacebook-posts-scraper";

/**
 * Check if URL is a Facebook Reel
 */
function isReelUrl(url: string): boolean {
  return /facebook\.com\/(reel|reels)\//.test(url) ||
         /facebook\.com\/share\/r\//.test(url);
}

/**
 * Download single Facebook video by URL
 * Uses Apify Reels Downloader for reels, Posts Scraper for regular videos
 */
export async function POST(request: NextRequest) {
  try {
    const { url, token } = await request.json();

    // Trim URL to remove any accidental whitespace or concatenated text
    const cleanUrl = (url || "").trim().split(/\s+/)[0];

    console.log("[Download] Request:", { url: cleanUrl, hasToken: !!token });

    if (!cleanUrl) {
      return NextResponse.json({ error: "URL required" }, { status: 400 });
    }

    if (!token) {
      return NextResponse.json({ error: "API token required" }, { status: 400 });
    }

    // Validate Facebook URL
    if (!isValidFacebookUrl(cleanUrl)) {
      return NextResponse.json({ error: "Invalid Facebook URL" }, { status: 400 });
    }

    // Use Facebook Media Downloader for video/reel downloads
    const actor = FB_MEDIA_DOWNLOADER;

    console.log("[Download] Using actor: Facebook Media Downloader");

    const apiUrl = `${APIFY_BASE_URL}/acts/${actor}/run-sync-get-dataset-items?token=${token}&memory=512`;

    // Facebook Media Downloader input format
    const input = {
      urls: [cleanUrl],
    };

    console.log("[Download] Calling Apify...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Download] Apify error:", response.status, errorText);
      return NextResponse.json(
        { error: `Apify error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[Download] Raw items:", Array.isArray(data) ? data.length : 0);

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "No video found" }, { status: 404 });
    }

    const item = data[0];

    // Debug: Log item structure to understand Apify response
    console.log("[Download] Item keys:", Object.keys(item));
    console.log("[Download] video field:", item.video ? JSON.stringify(item.video).slice(0, 1500) : "none");
    console.log("[Download] short_form_video_context:", item.short_form_video_context ? JSON.stringify(item.short_form_video_context).slice(0, 1500) : "none");

    // Extract video URL from multiple possible locations
    const videoUrl = extractVideoUrl(item);

    if (!videoUrl) {
      console.error("[Download] No video URL found in response. Full item:", JSON.stringify(item).slice(0, 1000));
      return NextResponse.json({ error: "Could not extract video URL" }, { status: 404 });
    }

    console.log("[Download] Found video URL:", videoUrl.slice(0, 100) + "...");

    // Extract thumbnail
    const thumbnail = extractThumbnail(item);

    return NextResponse.json({
      url: videoUrl,
      filename: generateFilename(cleanUrl, item),
      thumbnail,
      caption: item.text || item.message || item.caption || "",
      duration: extractDuration(item),
    });

  } catch (error) {
    console.error("[Download] Error:", error);
    return NextResponse.json(
      { error: "Failed to download video", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Validate Facebook URL - supports multiple formats
 */
function isValidFacebookUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?facebook\.com\/watch\/?(\?v=\d+)?/,
    /^https?:\/\/(www\.)?facebook\.com\/reel\/[\w-]+/,
    /^https?:\/\/(www\.)?facebook\.com\/reels\/[\w-]+/,
    /^https?:\/\/(www\.)?facebook\.com\/[\w.]+\/videos\/\d+/,
    /^https?:\/\/(www\.)?facebook\.com\/[\w.]+\/posts\/[\w-]+/,
    /^https?:\/\/(www\.)?facebook\.com\/share\/v\/[\w-]+/,
    /^https?:\/\/(www\.)?facebook\.com\/share\/r\/[\w-]+/,
    /^https?:\/\/fb\.watch\/[\w-]+/,
    /^https?:\/\/(www\.)?facebook\.com\/\d+\/videos\/\d+/,
  ];
  return patterns.some((pattern) => pattern.test(url));
}

/**
 * Extract video URL from Apify response
 * Handles multiple response structures from different actors
 */
function extractVideoUrl(item: Record<string, unknown>): string {
  // Common direct URL fields (used by Reels Downloader and others)
  const directFields = [
    "videoUrl", "video_url", "downloadUrl", "download_url",
    "hdVideoUrl", "hd_video_url", "sdVideoUrl", "sd_video_url",
    "url", "mp4Url", "mp4_url"
  ];

  for (const field of directFields) {
    const value = item[field];
    if (typeof value === "string" && value.startsWith("https://")) {
      return value;
    }
  }

  // Helper to extract from video-like object
  const extractFromVideoObject = (video: Record<string, unknown> | undefined): string => {
    if (!video) return "";

    // Check common direct fields first
    for (const field of directFields) {
      const value = video[field];
      if (typeof value === "string" && value.startsWith("https://")) {
        return value;
      }
    }

    // Playable URLs
    if (video.playable_url_quality_hd) return video.playable_url_quality_hd as string;
    if (video.playable_url) return video.playable_url as string;
    if (video.browser_native_hd_url) return video.browser_native_hd_url as string;
    if (video.browser_native_sd_url) return video.browser_native_sd_url as string;

    // videoDeliveryLegacyFields
    const legacyFields = video.videoDeliveryLegacyFields as Record<string, unknown> | undefined;
    if (legacyFields) {
      if (legacyFields.browser_native_hd_url) return legacyFields.browser_native_hd_url as string;
      if (legacyFields.browser_native_sd_url) return legacyFields.browser_native_sd_url as string;
    }

    // Nested playable_video
    const playableVideo = video.playable_video as Record<string, unknown> | undefined;
    if (playableVideo) {
      const result = extractFromVideoObject(playableVideo);
      if (result) return result;
    }

    return "";
  };

  // Source 1: video object (for reels)
  const video = item.video as Record<string, unknown> | undefined;
  const videoResult = extractFromVideoObject(video);
  if (videoResult) return videoResult;

  // Source 2: short_form_video_context (for Facebook Reels)
  const shortFormContext = item.short_form_video_context as Record<string, unknown> | undefined;
  if (shortFormContext) {
    const shortFormVideo = shortFormContext.video as Record<string, unknown> | undefined;
    const sfvResult = extractFromVideoObject(shortFormVideo);
    if (sfvResult) return sfvResult;

    const sfvPlayback = shortFormContext.playback_video as Record<string, unknown> | undefined;
    const sfvPlaybackResult = extractFromVideoObject(sfvPlayback);
    if (sfvPlaybackResult) return sfvPlaybackResult;
  }

  // Source 3: attachments array
  const attachments = (item.attachments || []) as Array<Record<string, unknown>>;
  for (const att of attachments) {
    const media = att.media as Record<string, unknown> | undefined;
    const attResult = extractFromVideoObject(media);
    if (attResult) return attResult;

    const target = att.target as Record<string, unknown> | undefined;
    if (target) {
      const targetResult = extractFromVideoObject(target);
      if (targetResult) return targetResult;
    }
  }

  // Source 4: media[] array
  const media = (item.media || []) as Array<Record<string, unknown>>;
  for (const m of media) {
    const mediaResult = extractFromVideoObject(m);
    if (mediaResult) return mediaResult;
  }

  // Source 5: playback_video
  const playbackVideo = item.playback_video as Record<string, unknown> | undefined;
  const playbackResult = extractFromVideoObject(playbackVideo);
  if (playbackResult) return playbackResult;

  // Source 6: Deep search for any video URL
  const deepSearch = (obj: unknown, depth = 0): string => {
    if (depth > 5 || !obj || typeof obj !== "object") return "";

    const record = obj as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const value = record[key];
      if (typeof value === "string" && value.startsWith("https://") &&
          (value.includes("video") || value.includes(".mp4") || key.toLowerCase().includes("video"))) {
        return value;
      }
      if (typeof value === "object" && value !== null) {
        const result = deepSearch(value, depth + 1);
        if (result) return result;
      }
    }
    return "";
  };

  return deepSearch(item);
}

/**
 * Extract thumbnail from Apify response
 */
function extractThumbnail(item: Record<string, unknown>): string {
  if (item.thumbnailUrl) return item.thumbnailUrl as string;

  const media = (item.media || []) as Array<{
    thumbnail?: string;
    image?: { uri?: string };
  }>;

  for (const m of media) {
    if (m.thumbnail) return m.thumbnail;
    if (m.image?.uri) return m.image.uri;
  }

  return "";
}

/**
 * Extract duration from Apify response
 */
function extractDuration(item: Record<string, unknown>): number {
  const media = (item.media || []) as Array<{
    length_in_second?: number;
    duration?: number;
  }>;

  for (const m of media) {
    if (m.length_in_second) return m.length_in_second * 1000;
    if (m.duration) return m.duration;
  }

  const playbackVideo = item.playback_video as { length_in_second?: number } | undefined;
  if (playbackVideo?.length_in_second) return playbackVideo.length_in_second * 1000;

  return 0;
}

/**
 * Generate filename for download
 */
function generateFilename(url: string, item: Record<string, unknown>): string {
  const postId = item.postId || item.id;
  if (postId) return `facebook_${postId}.mp4`;

  const match = url.match(/(?:reel|reels|videos)\/(\d+)/);
  if (match) return `facebook_${match[1]}.mp4`;

  return `facebook_video_${new Date().getTime()}.mp4`;
}
