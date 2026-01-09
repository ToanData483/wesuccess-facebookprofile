import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";

// Cache directory in public folder
const CACHE_DIR = path.join(process.cwd(), "public", "cache", "images");

/**
 * Generate a safe filename from URL
 */
function generateCacheFilename(url: string): string {
  // Create hash of URL for unique filename
  const hash = crypto.createHash("md5").update(url).digest("hex").substring(0, 12);
  // Extract extension from URL if possible
  const urlPath = new URL(url).pathname;
  const ext = path.extname(urlPath).split("?")[0] || ".jpg";
  return `${hash}${ext}`;
}

/**
 * Download and cache an image from Facebook CDN
 */
async function cacheImage(imageUrl: string): Promise<string | null> {
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

    // Fetch image with Facebook-like headers
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
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) {
      console.error(`[Cache Image] Failed to fetch: ${response.status}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(filepath, buffer);

    console.log(`[Cache Image] Cached: ${filename} (${buffer.length} bytes)`);
    return publicPath;
  } catch (error) {
    console.error("[Cache Image] Error:", error);
    return null;
  }
}

/**
 * POST: Cache single or multiple images
 * Body: { url: string } or { urls: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, urls } = body;

    // Single image
    if (url && typeof url === "string") {
      const cachedPath = await cacheImage(url);
      if (cachedPath) {
        return NextResponse.json({
          success: true,
          original: url,
          cached: cachedPath
        });
      }
      return NextResponse.json(
        { success: false, error: "Failed to cache image" },
        { status: 500 }
      );
    }

    // Multiple images
    if (urls && Array.isArray(urls)) {
      const results: Record<string, string | null> = {};

      // Process in parallel with limit
      const batchSize = 5;
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (imgUrl: string) => ({
            url: imgUrl,
            cached: await cacheImage(imgUrl),
          }))
        );
        batchResults.forEach(({ url: imgUrl, cached }) => {
          results[imgUrl] = cached;
        });
      }

      return NextResponse.json({
        success: true,
        results,
        cached: Object.values(results).filter(Boolean).length,
        failed: Object.values(results).filter(v => !v).length,
      });
    }

    return NextResponse.json(
      { error: "url or urls required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Cache Image] Error:", error);
    return NextResponse.json(
      { error: "Failed to cache", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET: Check if image is cached
 * Query: ?url=<encoded_url>
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  const filename = generateCacheFilename(url);
  const filepath = path.join(CACHE_DIR, filename);
  const isCached = existsSync(filepath);

  return NextResponse.json({
    url,
    cached: isCached,
    path: isCached ? `/cache/images/${filename}` : null,
  });
}
