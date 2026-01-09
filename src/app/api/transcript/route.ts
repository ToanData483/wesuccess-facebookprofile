import { NextRequest, NextResponse } from "next/server";

const ASSEMBLYAI_BASE_URL = "https://api.assemblyai.com/v2";
const APIFY_BASE_URL = "https://api.apify.com/v2";
const FB_MEDIA_DOWNLOADER = "igview-owner%2Ffacebook-media-downloader";

interface AssemblyAITranscript {
  id: string;
  status: "queued" | "processing" | "completed" | "error";
  text: string;
  words?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  language_code?: string;
  audio_duration?: number;
  error?: string;
  speech_understanding?: {
    response?: {
      translated_texts?: Record<string, string>;
    };
  };
}

/**
 * Check if URL is a direct video URL (CDN URL)
 */
function isDirectVideoUrl(url: string): boolean {
  return url.includes("fbcdn.net") ||
         url.includes("video-") ||
         url.includes("scontent");
}

/**
 * Validate Facebook URL
 */
function isValidFacebookUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?facebook\.com\/watch\/?(\?v=\d+)?/,
    /^https?:\/\/(www\.)?facebook\.com\/reel\/[\w-]+/,
    /^https?:\/\/(www\.)?facebook\.com\/reels\/[\w-]+/,
    /^https?:\/\/(www\.)?facebook\.com\/[\w.]+\/videos\/\d+/,
    /^https?:\/\/(www\.)?facebook\.com\/[\w.]+\/posts\/[\w-]+/,
    /^https?:\/\/(www\.)?facebook\.com\/share\/v\/[\w-]+/,
    /^https?:\/\/(www\.)?facebook\.com\/share\/r\/[\w-]+/,
    /^https?:\/\/fb\.watch\/[\w-]+/,
  ];
  return patterns.some((pattern) => pattern.test(url));
}

/**
 * Resolve Facebook URL to direct video URL using Apify
 */
async function resolveVideoUrl(facebookUrl: string, apifyToken: string): Promise<string> {
  console.log("[Transcript] Resolving Facebook URL via Apify...");

  const apiUrl = `${APIFY_BASE_URL}/acts/${FB_MEDIA_DOWNLOADER}/run-sync-get-dataset-items?token=${apifyToken}&memory=512`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls: [facebookUrl] }),
  });

  if (!response.ok) {
    throw new Error(`Apify error: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("No video found");
  }

  const item = data[0];
  const videoUrl = extractVideoUrl(item);

  if (!videoUrl) {
    throw new Error("Could not extract video URL from Facebook");
  }

  console.log("[Transcript] Resolved video URL:", videoUrl.substring(0, 80) + "...");
  return videoUrl;
}

/**
 * Extract video URL from Apify response
 */
function extractVideoUrl(item: Record<string, unknown>): string {
  const directFields = [
    "videoUrl", "video_url", "downloadUrl", "download_url",
    "hdVideoUrl", "hd_video_url", "sdVideoUrl", "sd_video_url",
    "url", "mp4Url", "mp4_url"
  ];

  for (const field of directFields) {
    const value = item[field];
    if (typeof value === "string" && value.startsWith("https://")) {
      return value;
    }
  }

  const extractFromVideoObject = (video: Record<string, unknown> | undefined): string => {
    if (!video) return "";

    for (const field of directFields) {
      const value = video[field];
      if (typeof value === "string" && value.startsWith("https://")) {
        return value;
      }
    }

    if (video.playable_url_quality_hd) return video.playable_url_quality_hd as string;
    if (video.playable_url) return video.playable_url as string;
    if (video.browser_native_hd_url) return video.browser_native_hd_url as string;
    if (video.browser_native_sd_url) return video.browser_native_sd_url as string;

    const legacyFields = video.videoDeliveryLegacyFields as Record<string, unknown> | undefined;
    if (legacyFields) {
      if (legacyFields.browser_native_hd_url) return legacyFields.browser_native_hd_url as string;
      if (legacyFields.browser_native_sd_url) return legacyFields.browser_native_sd_url as string;
    }

    return "";
  };

  const video = item.video as Record<string, unknown> | undefined;
  const videoResult = extractFromVideoObject(video);
  if (videoResult) return videoResult;

  const shortFormContext = item.short_form_video_context as Record<string, unknown> | undefined;
  if (shortFormContext) {
    const shortFormVideo = shortFormContext.video as Record<string, unknown> | undefined;
    const sfvResult = extractFromVideoObject(shortFormVideo);
    if (sfvResult) return sfvResult;
  }

  // Deep search fallback
  const deepSearch = (obj: unknown, depth = 0): string => {
    if (depth > 5 || !obj || typeof obj !== "object") return "";
    const record = obj as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const value = record[key];
      if (typeof value === "string" && value.startsWith("https://") &&
          (value.includes("video") || value.includes(".mp4"))) {
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
 * POST /api/transcript
 * Transcribe video using AssemblyAI
 *
 * Supports both:
 * - Direct video URL (CDN URL)
 * - Facebook page URL (auto-resolved via Apify)
 */
export async function POST(request: NextRequest) {
  try {
    const {
      url,
      apiKey,
      apifyToken,
      videoUrl: providedVideoUrl,
      languageCode,
      autoDetect = true,
      translate = false,
      translateTo,
    } = await request.json();

    console.log("[Transcript API] Request received:", {
      hasUrl: !!url,
      hasApiKey: !!apiKey,
      hasApifyToken: !!apifyToken,
      hasDirectVideoUrl: !!providedVideoUrl,
      languageCode: languageCode || "auto-detect",
      translate,
      translateTo: translateTo || "none",
    });

    if (!apiKey) {
      return NextResponse.json(
        { error: "AssemblyAI API key required" },
        { status: 400 }
      );
    }

    // Determine video URL
    let videoUrl = providedVideoUrl || url;

    if (!videoUrl) {
      return NextResponse.json(
        { error: "Video URL required" },
        { status: 400 }
      );
    }

    // If not a direct CDN URL, try to resolve via Apify
    if (!isDirectVideoUrl(videoUrl)) {
      // Check if it's a valid Facebook URL
      if (!isValidFacebookUrl(videoUrl)) {
        return NextResponse.json(
          { error: "Invalid Facebook URL" },
          { status: 400 }
        );
      }

      // Need Apify token to resolve Facebook URL
      if (!apifyToken) {
        return NextResponse.json(
          {
            error: "Apify token required to resolve Facebook URL",
            hint: "Please configure Apify token in Settings"
          },
          { status: 400 }
        );
      }

      // Resolve Facebook URL to direct video URL
      try {
        videoUrl = await resolveVideoUrl(videoUrl, apifyToken);
      } catch (resolveError) {
        console.error("[Transcript API] Failed to resolve URL:", resolveError);
        return NextResponse.json(
          {
            error: "Failed to resolve Facebook URL",
            details: String(resolveError)
          },
          { status: 400 }
        );
      }
    }

    // Step 1: Start transcription
    console.log("[Transcript API] Starting transcription for:", videoUrl.substring(0, 80) + "...");

    const transcriptOptions: Record<string, unknown> = {
      audio_url: videoUrl,
    };

    if (languageCode && !autoDetect) {
      transcriptOptions.language_code = languageCode;
      console.log("[Transcript API] Using language:", languageCode);
    } else {
      transcriptOptions.language_detection = true;
      console.log("[Transcript API] Using auto-detect language");
    }

    if (translate && translateTo) {
      transcriptOptions.speech_understanding = {
        request: {
          translation: {
            target_languages: [translateTo],
          },
        },
      };
      console.log("[Transcript API] Translation enabled to:", translateTo);
    }

    const startResponse = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript`, {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(transcriptOptions),
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      console.error("[Transcript API] Start error:", startResponse.status, errorText);
      return NextResponse.json(
        { error: `Failed to start transcription: ${startResponse.status}`, details: errorText },
        { status: startResponse.status }
      );
    }

    const startData = await startResponse.json();
    const transcriptId = startData.id;
    console.log("[Transcript API] Transcription started, ID:", transcriptId);

    // Step 2: Poll for completion (max 5 minutes)
    const maxAttempts = 60;
    let attempts = 0;
    let result: AssemblyAITranscript | null = null;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const pollResponse = await fetch(
        `${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`,
        {
          headers: { authorization: apiKey },
        }
      );

      if (!pollResponse.ok) {
        console.error("[Transcript API] Poll error:", pollResponse.status);
        continue;
      }

      result = await pollResponse.json();
      console.log("[Transcript API] Status:", result?.status, "Attempt:", attempts + 1);

      if (result?.status === "completed") {
        console.log("[Transcript API] Transcription completed");

        const response: Record<string, unknown> = {
          id: result.id,
          text: result.text,
          words: result.words,
          language_code: result.language_code,
          audio_duration: result.audio_duration,
        };

        const translatedTexts = result.speech_understanding?.response?.translated_texts;
        if (translatedTexts && Object.keys(translatedTexts).length > 0) {
          const [targetLang, translatedText] = Object.entries(translatedTexts)[0];
          response.translation = {
            language: targetLang,
            text: translatedText,
          };
          console.log("[Transcript API] Translation included:", targetLang);
        }

        return NextResponse.json(response);
      }

      if (result?.status === "error") {
        console.error("[Transcript API] Transcription error:", result.error);
        return NextResponse.json(
          { error: result.error || "Transcription failed" },
          { status: 500 }
        );
      }

      attempts++;
    }

    console.error("[Transcript API] Timeout after", maxAttempts, "attempts");
    return NextResponse.json(
      { error: "Transcription timeout - please try again" },
      { status: 408 }
    );
  } catch (error) {
    console.error("[Transcript API] Error:", error);
    return NextResponse.json(
      { error: "Failed to transcribe", details: String(error) },
      { status: 500 }
    );
  }
}