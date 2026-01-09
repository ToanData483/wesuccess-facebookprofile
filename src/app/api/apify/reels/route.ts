import { NextRequest, NextResponse } from "next/server";
import { cacheImages } from "@/lib/utils/image-cache";

const APIFY_BASE_URL = "https://api.apify.com/v2";
// Use facebook-posts-scraper to get videos (it returns both posts and videos)
// Docs: https://apify.com/apify/facebook-posts-scraper
const FB_POSTS_SCRAPER = "apify%2Ffacebook-posts-scraper";

export async function POST(request: NextRequest) {
  try {
    const { username, pageUrl, url, limit = 20, token } = await request.json();

    console.log("[FB Reels] Request:", { username, pageUrl, url, limit, hasToken: !!token });

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    // Build Facebook reels URL (use /reels to get videoDeliveryLegacyFields with direct URLs)
    let fbReelsUrl = "";
    if (url) {
      // If URL provided, ensure it points to /reels
      fbReelsUrl = url.includes("/reels") ? url : url.replace(/\/?$/, "/reels");
    } else if (pageUrl) {
      fbReelsUrl = pageUrl.includes("/reels") ? pageUrl : pageUrl.replace(/\/?$/, "/reels");
    } else if (username) {
      let cleanUsername = username.replace(/^@/, "").trim();
      // If user entered full URL, extract the username
      if (cleanUsername.includes("facebook.com")) {
        const urlMatch = cleanUsername.match(/facebook\.com\/([^\/\?]+)/);
        if (urlMatch) {
          cleanUsername = urlMatch[1];
        }
      }
      fbReelsUrl = `https://www.facebook.com/${cleanUsername}/reels`;
    } else {
      return NextResponse.json(
        { error: "Username, pageUrl or URL required" },
        { status: 400 }
      );
    }

    console.log("[FB Reels] Using reels URL:", fbReelsUrl);

    // Use lower memory to avoid hitting free tier limits (default 4096MB -> 1024MB)
    const apiUrl = `${APIFY_BASE_URL}/acts/${FB_POSTS_SCRAPER}/run-sync-get-dataset-items?token=${token}&memory=1024`;

    // facebook-posts-scraper input (official Apify actor)
    // Docs: https://apify.com/apify/facebook-posts-scraper/input-schema
    const input = {
      startUrls: [{ url: fbReelsUrl, method: "GET" }],
      resultsLimit: limit,
      captionText: true,
    };

    console.log("[FB Reels] Calling:", apiUrl.replace(token, "***"));
    console.log("[FB Reels] Input:", JSON.stringify(input));

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
      console.error("[FB Reels] Error:", response.status, errorText);
      return NextResponse.json(
        { error: `Apify error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[FB Reels] Raw items:", Array.isArray(data) ? data.length : 0);

    // Debug: Check what fields are available in raw data
    if (Array.isArray(data) && data.length > 0) {
      const sample = data[0];
      console.log("[FB Reels] Sample item keys:", Object.keys(sample));
      console.log("[FB Reels] isVideo:", sample.isVideo, "viewsCount:", sample.viewsCount);

      // Check media array for video with videoDeliveryLegacyFields (posts-scraper /reels output)
      const sampleMedia = sample.media as Array<{ __typename?: string; videoDeliveryLegacyFields?: { browser_native_hd_url?: string } }> || [];
      const videoMedia = sampleMedia.find(m => m.__typename === "Video" && m.videoDeliveryLegacyFields);
      if (videoMedia?.videoDeliveryLegacyFields) {
        console.log("[FB Reels] media[].videoDeliveryLegacyFields found!");
        console.log("[FB Reels] browser_native_hd_url:", videoMedia.videoDeliveryLegacyFields.browser_native_hd_url?.slice(0, 80) || "EMPTY");
      } else {
        console.log("[FB Reels] media[].videoDeliveryLegacyFields: NOT FOUND, checking playback_video...");
        const pbVideo = sample.playback_video as { videoDeliveryLegacyFields?: { browser_native_hd_url?: string } } | undefined;
        if (pbVideo?.videoDeliveryLegacyFields) {
          console.log("[FB Reels] playback_video.videoDeliveryLegacyFields found!");
          console.log("[FB Reels] browser_native_hd_url:", pbVideo.videoDeliveryLegacyFields.browser_native_hd_url?.slice(0, 80) || "EMPTY");
        } else {
          console.log("[FB Reels] NO videoDeliveryLegacyFields found in any path!");
        }
      }
    }

    // Filter to only video posts using multiple indicators
    const videoPosts = Array.isArray(data)
      ? data.filter((item: Record<string, unknown>) => {
          // Direct video indicator from API
          if (item.isVideo === true) return true;
          if (item.viewsCount && (item.viewsCount as number) > 0) return true;

          const media = item.media as Array<{
            type?: string;
            __typename?: string;
            is_playable?: boolean;
            videoUrl?: string;
            video_grid_renderer?: { video?: unknown };
            length_in_second?: number;
          }> || [];
          // Check for video indicators in the complex Facebook structure
          return item.videoUrl || media.some(m =>
            m.type === "video" ||
            m.__typename === "Video" ||
            m.is_playable === true ||
            m.videoUrl ||
            m.video_grid_renderer?.video ||
            (m.length_in_second && m.length_in_second > 0)
          );
        })
      : [];

    console.log("[FB Reels] Filtered videos:", videoPosts.length);

    if (videoPosts.length > 0) {
      // Cache thumbnails from complex Facebook media structure
      const thumbnailUrls = videoPosts
        .map((item: Record<string, unknown>) => {
          const media = item.media as Array<{
            thumbnail?: string;
            image?: { uri?: string };
            video_grid_renderer?: { video?: { thumbnailImage?: { uri?: string } } };
          }> || [];
          // Get thumbnail from nested structure
          let thumbUrl = (item.thumbnailUrl || "") as string;
          for (const m of media) {
            if (m.thumbnail) { thumbUrl = m.thumbnail; break; }
            if (m.image?.uri) { thumbUrl = m.image.uri; break; }
            if (m.video_grid_renderer?.video?.thumbnailImage?.uri) {
              thumbUrl = m.video_grid_renderer.video.thumbnailImage.uri;
              break;
            }
          }
          return thumbUrl;
        })
        .filter(Boolean) as string[];

      console.log("[FB Reels] Caching", thumbnailUrls.length, "thumbnails...");
      const cachedMap = await cacheImages(thumbnailUrls, 5);
      console.log("[FB Reels] Cached", [...cachedMap.values()].filter(Boolean).length, "thumbnails");

      // Transform to video data format using complex Facebook structure
      const transformedVideos = videoPosts.map((item: Record<string, unknown>) => {
        const media = item.media as Array<{
          type?: string;
          __typename?: string;
          is_playable?: boolean;
          videoUrl?: string;
          thumbnail?: string;
          duration?: number;
          length_in_second?: number;
          image?: { uri?: string };
          // Direct videoDeliveryLegacyFields in media item (posts-scraper /reels output)
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

        // Extract video URL - direct CDN URL needed for AssemblyAI transcript
        let extractedVideoUrl = "";
        let videoDuration = 0;

        // Source 1: media[].videoDeliveryLegacyFields (posts-scraper /reels output - PRIMARY)
        // This is the most common structure when scraping /reels page with posts-scraper
        for (const m of media) {
          if (m.__typename === "Video" && m.videoDeliveryLegacyFields) {
            const deliveryFields = m.videoDeliveryLegacyFields;
            extractedVideoUrl = deliveryFields.browser_native_hd_url ||
                               deliveryFields.browser_native_sd_url || "";
            videoDuration = (m.length_in_second || 0) * 1000; // Convert to ms
            if (extractedVideoUrl) break;
          }
        }

        // Source 2: playback_video.videoDeliveryLegacyFields (reels-scraper structure)
        if (!extractedVideoUrl) {
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

        // Source 3: media[].video_grid_renderer.video.videoDeliveryLegacyFields (nested structure)
        if (!extractedVideoUrl) {
          for (const m of media) {
            if (m.__typename === "Video" || m.is_playable) {
              const videoData = m.video_grid_renderer?.video;
              if (videoData?.videoDeliveryLegacyFields) {
                const deliveryFields = videoData.videoDeliveryLegacyFields;
                extractedVideoUrl = deliveryFields.browser_native_hd_url ||
                                   deliveryFields.browser_native_sd_url || "";
                videoDuration = videoData.playable_duration_in_ms || 0;
                if (extractedVideoUrl) break;
              }
            }
            if (!extractedVideoUrl && m.videoUrl) {
              extractedVideoUrl = m.videoUrl;
              videoDuration = m.duration || 0;
            }
          }
        }

        // Final fallback to item-level videoUrl
        if (!extractedVideoUrl && item.videoUrl) {
          extractedVideoUrl = item.videoUrl as string;
        }

        // Get thumbnail from complex structure
        let thumbnail = (item.thumbnailUrl || "") as string;
        for (const m of media) {
          if (m.thumbnail) { thumbnail = m.thumbnail; break; }
          if (m.image?.uri) { thumbnail = m.image.uri; break; }
          if (m.video_grid_renderer?.video?.thumbnailImage?.uri) {
            thumbnail = m.video_grid_renderer.video.thumbnailImage.uri;
            break;
          }
        }
        const cachedThumb = cachedMap.get(thumbnail) || thumbnail;

        // Handle timestamp - both ISO string and Unix formats
        let createTime = Date.now();
        if (item.time) {
          createTime = new Date(item.time as string).getTime();
        } else if (item.timestamp) {
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
        const hasReactionsData = Object.values(reactionsBreakdown).some(v => v > 0);

        return {
          id: item.postId || item.id || String(Date.now()),
          shortCode: item.postId || "",
          caption: item.text || item.message || "",
          commentsCount: (item.comments as number) || 0,
          likesCount: (item.likes as number) || (item.reactions as number) || 0,
          // viewsCount is the correct field from posts-scraper for video views
          viewsCount: (item.viewsCount as number) || (item.views as number) || 0,
          playsCount: (item.playsCount as number) || (item.plays as number) || 0,
          sharesCount: (item.shares as number) || 0,
          duration: videoDuration || 0,
          timestamp: item.time || new Date(createTime).toISOString(),
          ownerUsername: item.pageName || "",
          videoUrl: extractedVideoUrl,
          thumbnailUrl: cachedThumb,
          originalThumbnailUrl: thumbnail,
          hashtags: extractHashtags((item.text || item.message || "") as string),
          mentions: extractMentions((item.text || item.message || "") as string),
          // Facebook specific
          postUrl: item.postUrl || item.url || "",
          pageName: item.pageName || "",
          pageUrl: item.pageUrl || "",
          // Reactions breakdown
          reactionsBreakdown: hasReactionsData ? reactionsBreakdown : undefined,
        };
      });

      console.log("[FB Reels] Success, returning", transformedVideos.length, "videos");
      return NextResponse.json(transformedVideos);
    }

    return NextResponse.json([]);
  } catch (error) {
    console.error("[FB Reels] Proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch videos", details: String(error) },
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
