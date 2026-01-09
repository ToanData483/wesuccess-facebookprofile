import { NextRequest, NextResponse } from "next/server";

const APIFY_BASE_URL = "https://api.apify.com/v2";
// Use official facebook-posts-scraper (more reliable than third-party actors)
const FB_POSTS_SCRAPER = "apify%2Ffacebook-posts-scraper";

/**
 * Get fresh video URL for download
 * Called from Profile Manager when user clicks download on a video
 *
 * Input: { postUrl: string, token: string, caption?: string }
 * Output: { videoUrl: string, filename: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { postUrl, token, caption } = await request.json();

    console.log("[Fresh URL] Request:", { postUrl, hasToken: !!token });

    if (!postUrl) {
      return NextResponse.json({ error: "Post URL required" }, { status: 400 });
    }

    if (!token) {
      return NextResponse.json({ error: "API token required" }, { status: 400 });
    }

    // Call Apify facebook-posts-scraper to get fresh video URL
    const apiUrl = `${APIFY_BASE_URL}/acts/${FB_POSTS_SCRAPER}/run-sync-get-dataset-items?token=${token}&memory=1024`;

    // facebook-posts-scraper input format
    const input = {
      startUrls: [{ url: postUrl }],
      resultsLimit: 1,
      scrapeAbout: false,
      proxyConfiguration: {
        useApifyProxy: true,
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout

    console.log("[Fresh URL] Calling Apify facebook-posts-scraper...");

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Fresh URL] Apify error:", response.status, errorText);
      return NextResponse.json(
        { error: `Apify error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[Fresh URL] Got", Array.isArray(data) ? data.length : 0, "items");

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "No video found" }, { status: 404 });
    }

    const item = data[0];
    console.log("[Fresh URL] Item keys:", Object.keys(item));

    const videoUrl = extractVideoUrl(item);

    if (!videoUrl) {
      console.error("[Fresh URL] Could not extract video URL. Item:", JSON.stringify(item).slice(0, 500));
      return NextResponse.json({ error: "Could not extract video URL" }, { status: 404 });
    }

    console.log("[Fresh URL] Success:", videoUrl.slice(0, 80) + "...");

    // Generate filename
    const filename = generateFilename(caption, item);

    return NextResponse.json({
      videoUrl,
      filename,
    });

  } catch (error) {
    console.error("[Fresh URL] Error:", error);

    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Request timeout" }, { status: 408 });
    }

    return NextResponse.json(
      { error: "Failed to get video URL", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Extract video URL from facebook-posts-scraper response
 * Handles multiple response structures
 */
function extractVideoUrl(item: Record<string, unknown>): string {
  // Direct video URL fields
  const directFields = [
    "videoUrl", "video_url", "downloadUrl", "download_url",
    "hdVideoUrl", "hd_video_url", "sdVideoUrl", "sd_video_url",
    "mp4Url", "mp4_url"
  ];

  // Check direct fields first
  for (const field of directFields) {
    const value = item[field];
    if (typeof value === "string" && value.startsWith("https://")) {
      return value;
    }
  }

  // Check video object (common in facebook-posts-scraper)
  const video = item.video as Record<string, unknown> | undefined;
  if (video) {
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
  }

  // Check media array (facebook-posts-scraper format)
  const media = item.media as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(media)) {
    for (const m of media) {
      if (m.videoUrl && typeof m.videoUrl === "string") return m.videoUrl;
      if (m.playable_url && typeof m.playable_url === "string") return m.playable_url;
      if (m.browser_native_hd_url && typeof m.browser_native_hd_url === "string") return m.browser_native_hd_url;
      if (m.browser_native_sd_url && typeof m.browser_native_sd_url === "string") return m.browser_native_sd_url;
    }
  }

  // Check short_form_video_context (for Reels)
  const shortFormContext = item.short_form_video_context as Record<string, unknown> | undefined;
  if (shortFormContext?.video) {
    const sfVideo = shortFormContext.video as Record<string, unknown>;
    if (sfVideo.playable_url_quality_hd) return sfVideo.playable_url_quality_hd as string;
    if (sfVideo.playable_url) return sfVideo.playable_url as string;
    if (sfVideo.browser_native_hd_url) return sfVideo.browser_native_hd_url as string;
  }

  // Check attachments (another common structure)
  const attachments = item.attachments as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(attachments)) {
    for (const att of attachments) {
      const attMedia = att.media as Record<string, unknown> | undefined;
      if (attMedia) {
        if (attMedia.playable_url) return attMedia.playable_url as string;
        if (attMedia.browser_native_hd_url) return attMedia.browser_native_hd_url as string;
      }
    }
  }

  // Deep search for any video URL
  const deepSearch = (obj: unknown, depth = 0): string => {
    if (depth > 4 || !obj || typeof obj !== "object") return "";

    const record = obj as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const value = record[key];
      if (typeof value === "string" && value.startsWith("https://") &&
          (value.includes("video") || value.includes(".mp4") ||
           key.toLowerCase().includes("video") || key.toLowerCase().includes("playable"))) {
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
 * Generate safe filename from caption
 */
function generateFilename(caption: string | undefined, item: Record<string, unknown>): string {
  const postId = item.postId || item.id || Date.now();

  if (caption) {
    const safeCaption = caption
      .substring(0, 40)
      .replace(/[^a-zA-Z0-9\s\u00C0-\u024F\u1E00-\u1EFF]/g, "")
      .trim()
      .replace(/\s+/g, "_");

    if (safeCaption) {
      return `${safeCaption}_${postId}.mp4`;
    }
  }

  return `facebook_${postId}.mp4`;
}
