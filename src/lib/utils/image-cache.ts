/**
 * Image Cache Utility
 * Server-side utility for caching Facebook CDN images locally
 */

import { writeFile, mkdir, readdir, stat, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";

// Cache directory in public folder
const CACHE_DIR = path.join(process.cwd(), "public", "cache", "images");

// Cache expiration (7 days in ms)
const CACHE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Generate a safe filename from URL
 */
export function generateCacheFilename(url: string): string {
  const hash = crypto.createHash("md5").update(url).digest("hex").substring(0, 12);
  const urlPath = new URL(url).pathname;
  const ext = path.extname(urlPath).split("?")[0] || ".jpg";
  return `${hash}${ext}`;
}

/**
 * Get cached path for a URL (returns null if not cached)
 */
export function getCachedPath(url: string): string | null {
  if (!url) return null;

  const filename = generateCacheFilename(url);
  const filepath = path.join(CACHE_DIR, filename);

  if (existsSync(filepath)) {
    return `/cache/images/${filename}`;
  }
  return null;
}

/**
 * Check if URL is an Facebook CDN URL
 */
export function isFacebookCdnUrl(url: string): boolean {
  if (!url) return false;
  return (
    url.includes("facebook.com") ||
    url.includes("cdnfacebook.com") ||
    url.includes("fbcdn.net") ||
    url.includes("scontent")
  );
}

/**
 * Download and cache a single image
 * Returns cached public path or null on failure
 */
export async function cacheImage(imageUrl: string): Promise<string | null> {
  if (!imageUrl || !isFacebookCdnUrl(imageUrl)) {
    return null;
  }

  try {
    // Ensure cache directory exists
    if (!existsSync(CACHE_DIR)) {
      await mkdir(CACHE_DIR, { recursive: true });
    }

    const filename = generateCacheFilename(imageUrl);
    const filepath = path.join(CACHE_DIR, filename);
    const publicPath = `/cache/images/${filename}`;

    // Check if already cached
    if (existsSync(filepath)) {
      return publicPath;
    }

    // Fetch image with browser-like headers
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.facebook.com/",
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "cross-site",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[ImageCache] Failed to fetch ${imageUrl.substring(0, 50)}...: ${response.status}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(filepath, buffer);

    console.log(`[ImageCache] Cached: ${filename} (${(buffer.length / 1024).toFixed(1)}KB)`);
    return publicPath;
  } catch (error) {
    console.error("[ImageCache] Error caching image:", error);
    return null;
  }
}

/**
 * Cache multiple images in parallel
 * Returns map of original URL -> cached path (null if failed)
 */
export async function cacheImages(
  urls: string[],
  concurrency: number = 5
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  // Filter to only Facebook CDN URLs
  const facebookUrls = urls.filter(isFacebookCdnUrl);

  // Process in batches
  for (let i = 0; i < facebookUrls.length; i += concurrency) {
    const batch = facebookUrls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (url) => ({
        url,
        cached: await cacheImage(url),
      }))
    );

    batchResults.forEach(({ url, cached }) => {
      results.set(url, cached);
    });
  }

  return results;
}

/**
 * Clean up old cached images (older than CACHE_EXPIRATION_MS)
 */
export async function cleanupOldCache(): Promise<number> {
  if (!existsSync(CACHE_DIR)) return 0;

  let deletedCount = 0;
  const now = Date.now();

  try {
    const files = await readdir(CACHE_DIR);

    for (const file of files) {
      const filepath = path.join(CACHE_DIR, file);
      const stats = await stat(filepath);
      const age = now - stats.mtimeMs;

      if (age > CACHE_EXPIRATION_MS) {
        await unlink(filepath);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`[ImageCache] Cleaned up ${deletedCount} old cached images`);
    }
  } catch (error) {
    console.error("[ImageCache] Cleanup error:", error);
  }

  return deletedCount;
}

/**
 * Get URL with cache fallback
 * Returns cached path if available, otherwise original URL
 */
export function getImageUrl(url: string): string {
  if (!url) return "";

  // Check if already cached
  const cachedPath = getCachedPath(url);
  if (cachedPath) {
    return cachedPath;
  }

  // Return original (will fail for Facebook CDN due to CORP)
  return url;
}
