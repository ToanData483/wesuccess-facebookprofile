import { NextRequest, NextResponse } from "next/server";

/**
 * Video Stream Download API
 * Streams Facebook video with Content-Disposition: attachment to trigger browser download
 *
 * Hybrid approach:
 * - Small videos (<50MB): Stream through this proxy → direct download
 * - Large videos: Return error, client will fallback to window.open()
 *
 * Usage: POST /api/download/stream
 * Body: { url: string, filename: string }
 */

const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const { url, filename } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: "Video URL required" },
        { status: 400 }
      );
    }

    // Validate Facebook CDN URL
    if (!url.includes("fbcdn.net") && !url.includes("facebook.com")) {
      return NextResponse.json(
        { error: "Invalid video URL - must be Facebook CDN" },
        { status: 400 }
      );
    }

    console.log("[Stream Download] Starting:", url.substring(0, 80) + "...");

    // First, do a HEAD request to check file size
    const headResponse = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.facebook.com/",
      },
    });

    if (!headResponse.ok) {
      console.error("[Stream Download] HEAD failed:", headResponse.status);
      return NextResponse.json(
        { error: "URL expired or invalid", fallback: true },
        { status: 410 }
      );
    }

    const contentLength = headResponse.headers.get("content-length");
    const fileSize = contentLength ? parseInt(contentLength, 10) : 0;

    console.log("[Stream Download] File size:", (fileSize / 1024 / 1024).toFixed(2), "MB");

    // Check if file is too large for proxy
    if (fileSize > MAX_SIZE_BYTES) {
      console.log("[Stream Download] File too large, suggest fallback");
      return NextResponse.json(
        {
          error: "File too large for direct download",
          size: fileSize,
          maxSize: MAX_SIZE_BYTES,
          fallback: true
        },
        { status: 413 }
      );
    }

    // Fetch the actual video
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.facebook.com/",
      },
    });

    if (!response.ok) {
      console.error("[Stream Download] Fetch error:", response.status);
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status}`, fallback: true },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "video/mp4";
    const safeFilename = (filename || "facebook_video.mp4")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .substring(0, 100);

    console.log("[Stream Download] Streaming:", safeFilename);

    // Return streaming response with attachment header
    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Content-Length": contentLength || "",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      },
    });

  } catch (error) {
    console.error("[Stream Download] Error:", error);
    return NextResponse.json(
      { error: "Download failed", details: String(error), fallback: true },
      { status: 500 }
    );
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
