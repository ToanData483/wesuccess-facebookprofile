import { NextRequest, NextResponse } from "next/server";
import { cacheImages } from "@/lib/utils/image-cache";

const APIFY_BASE_URL = "https://api.apify.com/v2";
// Actor: apify/facebook-posts-scraper (official Facebook scraper)
// Docs: https://apify.com/apify/facebook-posts-scraper
const FB_POSTS_SCRAPER = "apify%2Ffacebook-posts-scraper";

export async function POST(request: NextRequest) {
  try {
    const { username, pageUrl, limit = 20, token, onlyPostsNewerThan, onlyPostsOlderThan } = await request.json();

    console.log("[FB Posts] Request:", { username, pageUrl, limit, onlyPostsNewerThan, onlyPostsOlderThan, hasToken: !!token });

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
    const input: Record<string, unknown> = {
      startUrls: [{ url: fbPageUrl, method: "GET" }],
      resultsLimit: limit,
      captionText: true,
    };

    // Add optional date filters if provided
    if (onlyPostsNewerThan) {
      input.onlyPostsNewerThan = onlyPostsNewerThan;
    }
    if (onlyPostsOlderThan) {
      input.onlyPostsOlderThan = onlyPostsOlderThan;
    }

    console.log("[FB Posts] Calling:", apiUrl.replace(token, "***"));
    console.log("[FB Posts] Input:", JSON.stringify(input));

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
      console.error("[FB Posts] Error:", response.status, errorText);
      return NextResponse.json(
        { error: `Apify error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[FB Posts] Raw items count:", Array.isArray(data) ? data.length : 0);

    // DEBUG: Log first raw item to see all available fields
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0];
      console.log("[FB Posts] DEBUG - First item keys:", Object.keys(firstItem));
      console.log("[FB Posts] DEBUG - Reaction fields:", JSON.stringify({
        likes: firstItem.likes,
        topReactionsCount: firstItem.topReactionsCount,
        reactionLikeCount: firstItem.reactionLikeCount,
        reactionLoveCount: firstItem.reactionLoveCount,
        reactionHahaCount: firstItem.reactionHahaCount,
        reactionWowCount: firstItem.reactionWowCount,
        reactionSadCount: firstItem.reactionSadCount,
        reactionAngryCount: firstItem.reactionAngryCount,
        reactionCareCount: firstItem.reactionCareCount,
      }, null, 2));
    }


    // Transform Facebook posts data
    // Smart Combine: Return ALL content (posts + videos) - client will filter
    // This reduces API calls from 3 to 2 per sync
    const allPosts = Array.isArray(data) ? data : [];

    console.log("[FB Posts] Total items from main page:", allPosts.length);

    // Collect image URLs to cache from complex Facebook media structure
    const allImageUrls: string[] = [];
    allPosts.forEach((item: Record<string, unknown>) => {
      const media = item.media as Array<{
        photo?: string;
        thumbnail?: string;
        image?: { uri?: string };
        flexible_height_image?: { uri?: string };
        video_grid_renderer?: { video?: { thumbnailImage?: { uri?: string } } };
      }> || [];

      media.forEach((m) => {
        // Get thumbnail URL
        if (m.thumbnail) allImageUrls.push(m.thumbnail);
        if (m.photo) allImageUrls.push(m.photo);
        // Get image URI from nested structure
        if (m.image?.uri) allImageUrls.push(m.image.uri);
        if (m.flexible_height_image?.uri) allImageUrls.push(m.flexible_height_image.uri);
        // Get video thumbnail
        if (m.video_grid_renderer?.video?.thumbnailImage?.uri) {
          allImageUrls.push(m.video_grid_renderer.video.thumbnailImage.uri);
        }
      });
      // Also check for single image fields
      if (item.photoUrl) allImageUrls.push(item.photoUrl as string);
      if (item.thumbnailUrl) allImageUrls.push(item.thumbnailUrl as string);
    });

    // Cache images
    console.log("[FB Posts] Caching", allImageUrls.length, "images...");
    const cachedMap = await cacheImages(allImageUrls, 5);
    console.log("[FB Posts] Cached", [...cachedMap.values()].filter(Boolean).length, "images");

    // Transform to match PostData interface
    // Handle complex Facebook media structure from Apify
    const transformedPosts = allPosts.map((item: Record<string, unknown>) => {
      const media = item.media as Array<{
        photo?: string;
        thumbnail?: string;
        type?: string;
        __typename?: string;
        is_playable?: boolean;
        videoUrl?: string;
        duration?: number;
        length_in_second?: number;
        image?: { uri?: string; height?: number; width?: number };
        flexible_height_image?: { uri?: string };
        // Direct videoDeliveryLegacyFields in media (from /reels structure)
        videoDeliveryLegacyFields?: {
          browser_native_sd_url?: string;
          browser_native_hd_url?: string;
        };
        video_grid_renderer?: {
          video?: {
            videoDeliveryLegacyFields?: {
              browser_native_sd_url?: string;
              browser_native_hd_url?: string;
            };
            playable_duration_in_ms?: number;
            thumbnailImage?: { uri?: string };
          };
        };
      }> || [];

      // Extract images and video URLs from complex Facebook media structure
      const extractedImages: string[] = [];
      let extractedVideoUrl = "";
      let isVideoPost = false;
      let videoDuration = 0;

      // Check item-level video indicators first
      if (item.isVideo === true || (item.viewsCount && (item.viewsCount as number) > 0)) {
        isVideoPost = true;
      }

      media.forEach((m) => {
        // Check if it's a video
        if (m.__typename === "Video" || m.is_playable || m.type === "video") {
          isVideoPost = true;

          // Source 1: Direct videoDeliveryLegacyFields in media item (posts-scraper structure)
          if (!extractedVideoUrl && m.videoDeliveryLegacyFields) {
            const deliveryFields = m.videoDeliveryLegacyFields;
            extractedVideoUrl = deliveryFields.browser_native_hd_url ||
                               deliveryFields.browser_native_sd_url || "";
            videoDuration = (m.length_in_second || 0) * 1000; // Convert to ms
          }

          // Source 2: video_grid_renderer.video.videoDeliveryLegacyFields (nested structure)
          if (!extractedVideoUrl) {
            const videoData = m.video_grid_renderer?.video;
            if (videoData?.videoDeliveryLegacyFields) {
              const deliveryFields = videoData.videoDeliveryLegacyFields;
              extractedVideoUrl = deliveryFields.browser_native_hd_url ||
                                 deliveryFields.browser_native_sd_url || "";
              videoDuration = videoData.playable_duration_in_ms || 0;
            }
          }

          // Source 3: Direct videoUrl in media item
          if (!extractedVideoUrl && m.videoUrl) {
            extractedVideoUrl = m.videoUrl;
            videoDuration = m.duration || 0;
          }

          // Use thumbnail for video
          const thumbUrl = m.thumbnail || m.image?.uri || m.video_grid_renderer?.video?.thumbnailImage?.uri;
          if (thumbUrl) extractedImages.push(thumbUrl);
        } else if (m.__typename === "Photo" || m.image) {
          // It's a photo - get the image URI
          const imageUrl = m.image?.uri || m.flexible_height_image?.uri || m.thumbnail || m.photo;
          if (imageUrl) extractedImages.push(imageUrl);
        } else if (m.thumbnail || m.photo) {
          // Fallback for simple structure
          extractedImages.push(m.thumbnail || m.photo || "");
        }
      });

      // Source 4: playback_video.videoDeliveryLegacyFields (reels-scraper structure)
      if (!extractedVideoUrl && isVideoPost) {
        const playbackVideo = item.playback_video as {
          videoDeliveryLegacyFields?: {
            browser_native_hd_url?: string;
            browser_native_sd_url?: string;
          };
          length_in_second?: number;
        } | undefined;

        if (playbackVideo?.videoDeliveryLegacyFields) {
          const deliveryFields = playbackVideo.videoDeliveryLegacyFields;
          extractedVideoUrl = deliveryFields.browser_native_hd_url ||
                             deliveryFields.browser_native_sd_url || "";
          videoDuration = (playbackVideo.length_in_second || 0) * 1000;
        }
      }

      // Final fallback to item-level videoUrl
      if (!extractedVideoUrl && item.videoUrl) {
        extractedVideoUrl = item.videoUrl as string;
      }

      // Cache extracted images
      const cachedImages = extractedImages.map(url => cachedMap.get(url) || url).filter(Boolean);

      // Get thumbnail - prefer first image or explicit thumbnail
      const rawThumbnail = (item.photoUrl || item.thumbnailUrl || extractedImages[0] || "") as string;
      const cachedThumb = cachedMap.get(rawThumbnail) || rawThumbnail || cachedImages[0] || "";

      // Get timestamp - handle both string and number formats
      let createTime = Date.now();
      if (item.time) {
        createTime = new Date(item.time as string).getTime();
      } else if (item.timestamp) {
        // Unix timestamp (seconds) - convert to ms
        createTime = (item.timestamp as number) * 1000;
      }

      // Extract reactions breakdown from Apify response
      // Apify returns: reactionLikeCount, reactionLoveCount, etc.
      const reactionsBreakdown = {
        like: (item.reactionLikeCount as number) || 0,
        love: (item.reactionLoveCount as number) || 0,
        haha: (item.reactionHahaCount as number) || 0,
        wow: (item.reactionWowCount as number) || 0,
        sad: (item.reactionSadCount as number) || 0,
        angry: (item.reactionAngryCount as number) || 0,
        care: (item.reactionCareCount as number) || 0,
      };
      // Check if we have actual reaction data (not all zeros)
      const hasReactionsData = Object.values(reactionsBreakdown).some(v => v > 0);

      // Determine content type for detailed classification
      const hasLink = !!(item.link || item.externalLink || item.sharedLink);
      const caption = (item.text || item.message || "") as string;
      const hasMedia = extractedImages.length > 0 || isVideoPost;
      const postUrl = (item.postUrl || item.url || "") as string;

      let contentType: string;
      if (!hasMedia && !hasLink && caption.length > 0) {
        contentType = "text_only";
      } else if (hasLink && !hasMedia) {
        contentType = "link_share";
      } else if (isVideoPost) {
        // Check if it's a multi-video carousel
        const videoCount = media.filter(m => m.__typename === "Video" || m.is_playable).length;
        if (videoCount > 1) {
          contentType = "multi_video";
        } else if (extractedImages.length > 1) {
          contentType = "mixed_media"; // Video + images
        } else {
          contentType = "single_video";
        }
      } else if (extractedImages.length > 1) {
        contentType = "multi_image";
      } else if (extractedImages.length === 1) {
        contentType = "single_image";
      } else {
        contentType = "text_only";
      }

      // Detect format from URL pattern (reel vs video vs photo vs text)
      const format = detectFormatFromUrl(postUrl, isVideoPost, hasMedia);

      return {
        id: item.postId || item.id || String(Date.now()),
        shortcode: item.postId || "",
        url: item.postUrl || item.url || "",
        images: cachedImages.length > 0 ? cachedImages : (cachedThumb ? [cachedThumb] : []),
        thumbnail: cachedThumb,
        originalThumbnail: rawThumbnail,
        caption,
        createTime,
        likesCount: (item.likes as number) || (item.reactions as number) || 0,
        commentsCount: (item.comments as number) || 0,
        sharesCount: (item.shares as number) || 0,
        hashtags: extractHashtags(caption),
        mentions: extractMentions(caption),
        isCarousel: extractedImages.length > 1,
        carouselCount: extractedImages.length || 1,
        childImages: cachedImages,
        // Facebook specific
        pageName: item.pageName || "",
        pageUrl: item.pageUrl || "",
        isVideo: isVideoPost || !!(item.videoUrl),
        videoUrl: extractedVideoUrl || (item.videoUrl as string) || "",
        videoDuration, // Duration in ms
        // Video specific fields
        viewsCount: isVideoPost ? ((item.viewsCount as number) || (item.views as number) || 0) : undefined,
        playsCount: isVideoPost ? ((item.playsCount as number) || (item.plays as number) || 0) : undefined,
        // Content type classification
        contentType,
        // Format classification (reel | video | photo | text) based on URL pattern
        format,
        // Reactions breakdown (if available from Apify)
        reactionsBreakdown: hasReactionsData ? reactionsBreakdown : undefined,
      };
    });

    // Count videos vs posts for logging
    const videoCount = transformedPosts.filter((p: { isVideo?: boolean }) => p.isVideo).length;
    const postCount = transformedPosts.length - videoCount;
    console.log("[FB Posts] Smart Combine: returning", transformedPosts.length, "items (", postCount, "posts +", videoCount, "videos)");
    return NextResponse.json(transformedPosts);
  } catch (error) {
    console.error("[FB Posts] Proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch posts", details: String(error) },
      { status: 500 }
    );
  }
}

// Helper: Extract hashtags from text
function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F]+/g) || [];
  return matches.map(tag => tag.slice(1));
}

// Helper: Extract mentions from text
function extractMentions(text: string): string[] {
  const matches = text.match(/@[\w\u00C0-\u024F]+/g) || [];
  return matches.map(mention => mention.slice(1));
}

/**
 * Detect content format from URL pattern
 * Priority: URL pattern > media analysis
 *
 * Facebook URL patterns:
 * - /reel/ or /reels/ → reel
 * - /watch/ or /videos/ → video
 * - /photo/ or /photos/ → photo
 * - /posts/ with no media → text
 */
function detectFormatFromUrl(
  url: string,
  isVideoPost: boolean,
  hasMedia: boolean
): "reel" | "video" | "photo" | "text" {
  if (!url) {
    // Fallback based on media analysis
    if (isVideoPost) return "video";
    if (hasMedia) return "photo";
    return "text";
  }

  const lowerUrl = url.toLowerCase();

  // Reel detection (highest priority for video content)
  if (lowerUrl.includes("/reel/") || lowerUrl.includes("/reels/")) {
    return "reel";
  }

  // Video detection (regular video posts)
  if (lowerUrl.includes("/watch/") || lowerUrl.includes("/videos/")) {
    return "video";
  }

  // Photo detection
  if (lowerUrl.includes("/photo/") || lowerUrl.includes("/photos/")) {
    return "photo";
  }

  // Fallback: Use media analysis
  if (isVideoPost) return "video";
  if (hasMedia) return "photo";
  return "text";
}
