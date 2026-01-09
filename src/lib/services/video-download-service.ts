/**
 * Video Download Service
 * Downloads Facebook videos with hybrid approach:
 * - Small videos (<50MB): Direct download via server proxy
 * - Large videos: Open in new tab
 *
 * Flow: Click Download → Try direct download → Fallback to new tab
 */

import { getApifyToken } from "@/lib/apify-api";

export interface DownloadProgress {
  videoId: string;
  status: "pending" | "fetching_url" | "downloading" | "completed" | "error";
  progress: number; // 0-100
  error?: string;
  filename?: string;
}

export interface DownloadResult {
  videoId: string;
  success: boolean;
  filename?: string;
  error?: string;
}

/**
 * Generate safe filename from caption
 */
function generateFilename(caption: string, shortcode: string): string {
  const safeCaption = caption
    .substring(0, 40)
    .replace(/[^a-zA-Z0-9\s\u00C0-\u024F\u1E00-\u1EFF]/g, "")
    .trim()
    .replace(/\s+/g, "_");

  return `${safeCaption || shortcode}_${Date.now()}.mp4`;
}

/**
 * Build Facebook post URL from video data
 */
function buildPostUrl(videoUrl: string | undefined, shortcode: string): string {
  // If we have a direct Facebook URL, use it
  if (videoUrl && videoUrl.includes("facebook.com")) {
    return videoUrl;
  }

  // Build URL from shortcode (postId)
  // Format: https://www.facebook.com/reel/{postId} or https://www.facebook.com/watch/?v={postId}
  if (shortcode) {
    // Try reel format first (most common for videos in Profile Manager)
    return `https://www.facebook.com/reel/${shortcode}`;
  }

  return "";
}

/**
 * Try direct download via server proxy
 * Returns true if download started, false if should fallback to window.open
 */
async function tryDirectDownload(
  url: string,
  filename: string,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; fallback?: boolean; error?: string }> {
  try {
    console.log("[Download] Trying direct download via proxy...");
    onProgress?.(60);

    const response = await fetch("/api/download/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, filename }),
    });

    // Check for fallback signals (file too large, URL expired)
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const error = await response.json();
        console.log("[Download] Proxy response:", error);
        if (error.fallback) {
          return { success: false, fallback: true, error: error.error };
        }
        return { success: false, error: error.error };
      }
      return { success: false, error: `HTTP ${response.status}` };
    }

    // Stream successful - trigger browser download
    console.log("[Download] Streaming video, triggering download...");
    onProgress?.(80);

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    // Create hidden download link
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 1000);

    onProgress?.(100);
    return { success: true };

  } catch (error) {
    console.warn("[Download] Direct download failed:", error);
    return { success: false, fallback: true, error: String(error) };
  }
}

/**
 * Fetch fresh video URL from Apify
 * Returns null if Apify unavailable (quota exceeded, no token, etc.)
 */
async function fetchFreshVideoUrl(
  postUrl: string,
  caption: string
): Promise<{ videoUrl: string; filename: string } | null> {
  const token = getApifyToken();

  if (!token) {
    console.log("[Download] No Apify token, will try direct URL");
    return null;
  }

  try {
    const response = await fetch("/api/download/fresh-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postUrl, token, caption }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.warn("[Download] Fresh URL failed:", error);
      // Return null to trigger fallback to direct URL
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn("[Download] Fetch fresh URL failed:", error);
    return null;
  }
}

/**
 * Download a single video
 * Hybrid Strategy:
 * 1. Get CDN URL (from stored or Apify)
 * 2. Try direct download via proxy (small files <50MB)
 * 3. Fallback to window.open (large files or proxy fail)
 * 4. Last resort: Open Facebook post
 */
export async function downloadVideo(
  videoUrl: string,
  caption: string,
  shortcode: string,
  onProgress?: (progress: number) => void
): Promise<DownloadResult> {
  try {
    console.log("[Download] Starting for:", shortcode, "| CDN URL:", videoUrl?.slice(0, 50) || "none");
    onProgress?.(10);

    let downloadUrl: string | null = null;
    let filename: string = generateFilename(caption, shortcode);

    // STEP 1: Get CDN URL
    if (videoUrl && videoUrl.includes("fbcdn.net")) {
      console.log("[Download] Using stored CDN URL");
      downloadUrl = videoUrl;
      onProgress?.(30);
    }

    // STEP 2: Try Apify if no CDN URL
    if (!downloadUrl) {
      const postUrl = buildPostUrl(videoUrl, shortcode);
      if (postUrl) {
        console.log("[Download] No CDN URL, trying Apify...");
        onProgress?.(20);
        const freshData = await fetchFreshVideoUrl(postUrl, caption);
        if (freshData?.videoUrl) {
          downloadUrl = freshData.videoUrl;
          filename = freshData.filename || filename;
          console.log("[Download] Got fresh URL from Apify");
        }
        onProgress?.(40);
      }
    }

    // STEP 3: No URL - fallback to Facebook post
    if (!downloadUrl) {
      const postUrl = buildPostUrl(videoUrl, shortcode);
      if (postUrl) {
        console.log("[Download] Opening Facebook post for manual download");
        window.open(postUrl, "_blank");
        return {
          videoId: shortcode,
          success: true,
          filename,
          error: "Opened Facebook post. Right-click video to save.",
        };
      }
      return {
        videoId: shortcode,
        success: false,
        error: "No video URL. Try re-syncing the profile.",
      };
    }

    // STEP 4: Try direct download via proxy (best UX)
    onProgress?.(50);
    const directResult = await tryDirectDownload(downloadUrl, filename, onProgress);

    if (directResult.success) {
      console.log("[Download] Direct download successful!");
      return {
        videoId: shortcode,
        success: true,
        filename,
      };
    }

    // STEP 5: Fallback to window.open (large files or proxy failed)
    if (directResult.fallback) {
      console.log("[Download] Fallback to new tab:", directResult.error);
      window.open(downloadUrl, "_blank");
      onProgress?.(100);
      return {
        videoId: shortcode,
        success: true,
        filename,
        error: directResult.error?.includes("too large")
          ? "Large file - opened in new tab"
          : "Opened in new tab",
      };
    }

    // Proxy failed without fallback flag
    return {
      videoId: shortcode,
      success: false,
      error: directResult.error || "Download failed",
    };

  } catch (error) {
    console.error("[Download] Error:", error);
    return {
      videoId: shortcode,
      success: false,
      error: error instanceof Error ? error.message : "Download failed",
    };
  }
}

/**
 * Download multiple videos with progress tracking
 * Downloads sequentially to avoid Apify rate limits
 */
export async function downloadVideos(
  videos: Array<{ id: string; videoUrl?: string; caption: string; shortcode: string }>,
  onProgressUpdate: (progress: Map<string, DownloadProgress>) => void
): Promise<DownloadResult[]> {
  const progressMap = new Map<string, DownloadProgress>();

  // Initialize all as pending
  videos.forEach((v) => {
    progressMap.set(v.id, {
      videoId: v.id,
      status: "pending",
      progress: 0,
    });
  });
  onProgressUpdate(new Map(progressMap));

  const results: DownloadResult[] = [];

  // Download sequentially to avoid Apify rate limits
  for (const video of videos) {
    // Update status to fetching URL
    progressMap.set(video.id, {
      videoId: video.id,
      status: "fetching_url",
      progress: 10,
    });
    onProgressUpdate(new Map(progressMap));

    const result = await downloadVideo(
      video.videoUrl || "",
      video.caption,
      video.shortcode,
      (progress) => {
        progressMap.set(video.id, {
          videoId: video.id,
          status: progress < 50 ? "fetching_url" : "downloading",
          progress,
        });
        onProgressUpdate(new Map(progressMap));
      }
    );

    // Update final status
    progressMap.set(video.id, {
      videoId: video.id,
      status: result.success ? "completed" : "error",
      progress: result.success ? 100 : 0,
      error: result.error,
      filename: result.filename,
    });
    onProgressUpdate(new Map(progressMap));

    results.push(result);

    // Delay between downloads to avoid rate limiting
    if (videos.indexOf(video) < videos.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return results;
}