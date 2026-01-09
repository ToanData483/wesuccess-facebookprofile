import { NextRequest, NextResponse } from "next/server";

/**
 * Image Proxy API
 * Proxies Facebook images to avoid CORS issues
 * Usage: /api/proxy/image?url=<encoded_url>
 */
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url");

    if (!url) {
      return NextResponse.json({ error: "URL required" }, { status: 400 });
    }

    // Decode and validate URL
    const decodedUrl = decodeURIComponent(url);

    // Only allow Facebook CDN URLs for security
    const allowedDomains = [
      "facebook.com",
      "cdnfacebook.com",
      "fbcdn.net",
      "scontent.cdnfacebook.com",
      "scontent-",
      "ui-avatars.com",
      "picsum.photos",
    ];

    const isAllowed = allowedDomains.some((domain) =>
      decodedUrl.includes(domain)
    );

    if (!isAllowed) {
      console.log("[Image Proxy] Blocked non-allowed domain:", decodedUrl.substring(0, 100));
      return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
    }

    // Fetch the image with timeout and retry
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    let response: Response;
    try {
      response = await fetch(decodedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.facebook.com/",
          "Origin": "https://www.facebook.com",
          "Sec-Fetch-Dest": "image",
          "Sec-Fetch-Mode": "no-cors",
          "Sec-Fetch-Site": "cross-site",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      console.log("[Image Proxy] Fetch failed:", response.status, decodedUrl.substring(0, 100));
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status }
      );
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("[Image Proxy] Error:", error);
    return NextResponse.json(
      { error: "Failed to proxy image" },
      { status: 500 }
    );
  }
}
