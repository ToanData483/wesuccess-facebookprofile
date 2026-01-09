"use client";

import { useState, useCallback } from "react";
import { extractVideo } from "@/lib/api";
import { VideoResultItem } from "@/components/download/video-result";

/**
 * Trigger browser download for a video URL
 */
async function triggerDownload(videoUrl: string, filename: string): Promise<void> {
  try {
    // Fetch video as blob to force download (avoid CORS redirect issues)
    const response = await fetch(videoUrl);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup blob URL
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch {
    // Fallback: open in new tab if blob download fails
    window.open(videoUrl, "_blank");
  }
}

export function useDownload() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<VideoResultItem[]>([]);

  const download = useCallback(async (urls: string[], autoDownload = true) => {
    setLoading(true);

    // Initialize results with loading state
    setResults(urls.map((url) => ({ url, status: "loading" })));

    // Process URLs in parallel (max 3 concurrent)
    const CONCURRENCY = 3;
    const queue = [...urls.map((url, i) => ({ url, index: i }))];
    const processing: Promise<void>[] = [];

    const processUrl = async (url: string, index: number) => {
      try {
        const video = await extractVideo(url);

        // Update state
        setResults((prev) =>
          prev.map((item, idx) =>
            idx === index
              ? {
                  ...item,
                  status: "success",
                  downloadUrl: video.url,
                  filename: video.filename,
                }
              : item
          )
        );

        // Auto-download if enabled
        if (autoDownload && video.url) {
          await triggerDownload(video.url, video.filename);
        }
      } catch (err) {
        setResults((prev) =>
          prev.map((item, idx) =>
            idx === index
              ? {
                  ...item,
                  status: "error",
                  error: err instanceof Error ? err.message : "Failed to extract",
                }
              : item
          )
        );
      }
    };

    // Process with concurrency limit
    while (queue.length > 0 || processing.length > 0) {
      // Fill up to CONCURRENCY slots
      while (queue.length > 0 && processing.length < CONCURRENCY) {
        const item = queue.shift()!;
        const promise = processUrl(item.url, item.index).then(() => {
          const idx = processing.indexOf(promise);
          if (idx > -1) processing.splice(idx, 1);
        });
        processing.push(promise);
      }

      // Wait for at least one to complete
      if (processing.length > 0) {
        await Promise.race(processing);
      }
    }

    setLoading(false);
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  return { loading, results, download, clearResults };
}
