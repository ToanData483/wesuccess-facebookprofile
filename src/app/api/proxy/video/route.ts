import { NextRequest, NextResponse } from "next/server";

/**
 * Video Proxy API
 * Proxies Facebook CDN video requests to bypass CORS restrictions
 *
 * Usage: POST /api/proxy/video
 * Body: { url: "https://video.fcha1-1.fna.fbcdn.net/..." }
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: "Video URL required" },
        { status: 400 }
      );
    }

    // Validate it's a Facebook CDN URL
    if (!url.includes("fbcdn.net") && !url.includes("facebook.com")) {
      return NextResponse.json(
        { error: "Invalid video URL - must be Facebook CDN" },
        { status: 400 }
      );
    }

    console.log("[Video Proxy] Fetching:", url.substring(0, 80) + "...");

    // Fetch video from Facebook CDN
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.facebook.com/",
      },
    });

    if (!response.ok) {
      console.error("[Video Proxy] Fetch error:", response.status);
      return NextResponse.json(
        { error: `Failed to fetch video: ${response.status}` },
        { status: response.status }
      );
    }

    // Get content type and length
    const contentType = response.headers.get("content-type") || "video/mp4";
    const contentLength = response.headers.get("content-length");

    // Stream video to client
    const headers: HeadersInit = {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    };

    if (contentLength) {
      headers["Content-Length"] = contentLength;
    }

    // Return streaming response
    return new NextResponse(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("[Video Proxy] Error:", error);
    return NextResponse.json(
      { error: "Failed to proxy video", details: String(error) },
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