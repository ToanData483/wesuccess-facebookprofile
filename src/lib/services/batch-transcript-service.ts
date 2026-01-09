/**
 * Batch Transcript Service
 * Handles batch transcription of videos using AssemblyAI
 */

import { transcribeUrl, getAssemblyAIKey } from "../assemblyai-api";
import { getConfig } from "../config-store";
import type { VideoData, VideoTranscript, TranscriptItem } from "../types/channel-project";

export interface BatchTranscriptProgress {
  total: number;
  completed: number;
  failed: number;
  current: string | null;
  status: "idle" | "processing" | "completed" | "error";
  items: TranscriptItem[];
}

export interface BatchTranscriptCallbacks {
  onProgress?: (progress: BatchTranscriptProgress) => void;
  onVideoComplete?: (videoId: string, transcript: VideoTranscript) => void;
  onVideoError?: (videoId: string, error: string) => void;
  onComplete?: (results: Map<string, VideoTranscript>) => void;
}

/**
 * Process batch transcription for multiple videos
 */
export async function processBatchTranscripts(
  videos: VideoData[],
  callbacks?: BatchTranscriptCallbacks
): Promise<Map<string, VideoTranscript>> {
  const apiKey = getAssemblyAIKey();
  if (!apiKey) {
    throw new Error("AssemblyAI API key not configured. Please add it in Settings.");
  }

  // Filter videos that have videoUrl and don't already have transcript
  const videosToProcess = videos.filter(
    (v) => v.videoUrl && !v.transcript?.text
  );

  if (videosToProcess.length === 0) {
    throw new Error("No videos to transcribe. Videos may already have transcripts or missing video URLs.");
  }

  const results = new Map<string, VideoTranscript>();

  // Initialize progress
  const progress: BatchTranscriptProgress = {
    total: videosToProcess.length,
    completed: 0,
    failed: 0,
    current: null,
    status: "processing",
    items: videosToProcess.map((v) => ({
      id: v.id,
      videoUrl: v.videoUrl!,
      title: v.caption?.slice(0, 50) || v.shortcode,
      status: "pending",
    })),
  };

  callbacks?.onProgress?.(progress);

  // Get language preferences from config
  const config = getConfig();
  const useAutoDetect = config.defaultLanguage === "auto";
  const languageCode = useAutoDetect ? undefined : config.defaultLanguage;

  // Process videos sequentially to avoid API rate limits
  for (const video of videosToProcess) {
    const itemIndex = progress.items.findIndex((i) => i.id === video.id);

    // Update current item status
    progress.current = video.id;
    progress.items[itemIndex].status = "processing";
    callbacks?.onProgress?.({ ...progress });

    try {
      // Call AssemblyAI transcription with language from config
      const result = await transcribeUrl(video.videoUrl!, {
        language_code: languageCode, // From config or auto-detect
        onProgress: (status) => {
          // Update item with transcription status
          callbacks?.onProgress?.({
            ...progress,
            items: progress.items.map((item) =>
              item.id === video.id
                ? { ...item, status: "processing" }
                : item
            ),
          });
        },
      });

      // Create transcript object
      const transcript: VideoTranscript = {
        text: result.text,
        language: result.language_code,
        segments: result.words?.map((w) => ({
          start: w.start,
          end: w.end,
          text: w.text,
        })),
      };

      // Store result
      results.set(video.id, transcript);

      // Update progress
      progress.completed++;
      progress.items[itemIndex].status = "completed";
      progress.items[itemIndex].transcript = transcript;

      callbacks?.onVideoComplete?.(video.id, transcript);
      callbacks?.onProgress?.({ ...progress });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Transcription failed";

      // Update progress with error
      progress.failed++;
      progress.items[itemIndex].status = "error";
      progress.items[itemIndex].errorMessage = errorMessage;

      callbacks?.onVideoError?.(video.id, errorMessage);
      callbacks?.onProgress?.({ ...progress });
    }
  }

  // Finalize
  progress.status = progress.failed === progress.total ? "error" : "completed";
  progress.current = null;
  callbacks?.onProgress?.(progress);
  callbacks?.onComplete?.(results);

  return results;
}

/**
 * Estimate cost for batch transcription
 * AssemblyAI charges $0.00025 per second of audio
 */
export function estimateTranscriptCost(videos: VideoData[]): {
  totalDuration: number;
  estimatedCost: number;
  videoCount: number;
} {
  const videosWithUrl = videos.filter((v) => v.videoUrl && !v.transcript?.text);
  const totalDuration = videosWithUrl.reduce((sum, v) => sum + (v.duration || 0), 0);

  // AssemblyAI pricing: $0.00025 per second
  const estimatedCost = totalDuration * 0.00025;

  return {
    totalDuration,
    estimatedCost,
    videoCount: videosWithUrl.length,
  };
}

/**
 * Format duration in seconds to human readable
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}
