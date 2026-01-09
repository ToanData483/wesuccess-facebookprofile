import { NextRequest, NextResponse } from "next/server";
import { cacheImage } from "@/lib/utils/image-cache";

const APIFY_BASE_URL = "https://api.apify.com/v2";
// Actor: apify/facebook-posts-scraper with scrapeAbout=true for profile info
// Docs: https://apify.com/apify/facebook-posts-scraper
const FB_POSTS_SCRAPER = "apify%2Ffacebook-posts-scraper";

export async function POST(request: NextRequest) {
  try {
    const { username, pageUrl, token } = await request.json();

    console.log("[FB Profile] Request:", { username, pageUrl, hasToken: !!token });

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    if (!username && !pageUrl) {
      return NextResponse.json({ error: "Username or pageUrl required" }, { status: 400 });
    }

    // Build Facebook page URL
    // Handle both full URL and username
    let cleanUsername = username ? username.replace(/^@/, "").trim() : "";
    let fbPageUrl = pageUrl || "";

    // If user entered full URL, extract the username/page name
    if (cleanUsername.includes("facebook.com")) {
      const urlMatch = cleanUsername.match(/facebook\.com\/([^\/\?]+)/);
      if (urlMatch) {
        cleanUsername = urlMatch[1];
        fbPageUrl = `https://www.facebook.com/${cleanUsername}`;
      } else {
        fbPageUrl = cleanUsername.startsWith("http") ? cleanUsername : `https://www.facebook.com/${cleanUsername}`;
      }
    } else if (cleanUsername) {
      fbPageUrl = `https://www.facebook.com/${cleanUsername}`;
    }

    // Use lower memory to avoid hitting free tier limits (default 4096MB -> 1024MB)
    const apiUrl = `${APIFY_BASE_URL}/acts/${FB_POSTS_SCRAPER}/run-sync-get-dataset-items?token=${token}&memory=1024`;

    // facebook-posts-scraper input (official Apify actor)
    // Docs: https://apify.com/apify/facebook-posts-scraper/input-schema
    // Note: We fetch 1 post to get profile info from user field
    const input = {
      startUrls: [{ url: fbPageUrl, method: "GET" }],
      resultsLimit: 1,  // Just need profile info from 1 post
      captionText: true,
    };

    console.log("[FB Profile] Calling:", apiUrl.replace(token, "***"));
    console.log("[FB Profile] Input:", JSON.stringify(input));

    // Use AbortController with 120s timeout (Apify can take a while to scrape)
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
      console.error("[FB Profile] Error:", response.status, errorText);
      return NextResponse.json(
        { error: `Apify error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[FB Profile] Raw response:", JSON.stringify(data).substring(0, 500));

    if (Array.isArray(data) && data.length > 0) {
      const item = data[0];
      // facebook-posts-scraper returns user info in item.user object
      const user = item.user || {};

      console.log("[FB Profile] Data fields:", {
        pageName: item.pageName,
        userName: user.name,
        userProfilePic: user.profilePic ? "exists" : "missing",
        likes: item.likes,
        followers: item.followers,
      });

      // Get profile picture from user object (where facebook-posts-scraper puts it)
      const originalProfilePic = user.profilePic || item.profilePicture || item.coverPhoto || "";
      let cachedProfilePic = originalProfilePic;
      if (originalProfilePic) {
        const cached = await cacheImage(originalProfilePic);
        if (cached) {
          cachedProfilePic = cached;
          console.log("[FB Profile] Profile pic cached:", cached);
        }
      }

      // Transform to profile structure
      // Note: facebook-posts-scraper returns post author info in user object
      const transformedProfile = {
        id: user.id || item.pageId || item.id || cleanUsername,
        username: cleanUsername || item.pageName?.toLowerCase().replace(/\s+/g, "") || "",
        fullName: user.name || item.pageName || item.name || "",
        biography: item.about || item.description || item.mission || "",
        profilePicUrl: cachedProfilePic,
        profilePicUrlHD: cachedProfilePic,
        originalProfilePicUrl: originalProfilePic,
        followersCount: item.followers || item.likes || 0,
        followingCount: 0, // Facebook pages don't have following count
        postsCount: item.postsCount || 0,
        likesCount: item.likes || 0,
        isVerified: item.isVerified || item.verified || false,
        isPrivate: false, // Facebook pages are public
        externalUrl: item.website || item.externalUrl || "",
        // Facebook specific
        pageId: item.pageId || "",
        category: item.category || item.categories?.join(", ") || "",
        address: item.address || "",
        phone: item.phone || "",
        email: item.email || "",
        coverPhoto: item.coverPhoto || "",
      };

      console.log("[FB Profile] Transformed:", JSON.stringify(transformedProfile));
      return NextResponse.json([transformedProfile]);
    }
    
    console.log("[FB Profile] No data found");
    return NextResponse.json([]);
  } catch (error) {
    console.error("[FB Profile] Proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile", details: String(error) },
      { status: 500 }
    );
  }
}
