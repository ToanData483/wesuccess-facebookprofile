"use client";

import { useState, useEffect, useRef } from "react";
import { X, Download, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import type { VideoData } from "@/lib/types/channel-project";
import {
  downloadVideo,
  downloadVideos,
  type DownloadProgress,
} from "@/lib/services/video-download-service";

interface VideoDownloadDialogProps {
  videos: VideoData[];
  onClose: () => void;
}

export function VideoDownloadDialog({ videos, onClose }: VideoDownloadDialogProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [progressMap, setProgressMap] = useState<Map<string, DownloadProgress>>(new Map());
  const [results, setResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });
  const hasStarted = useRef(false); // Prevent double execution in StrictMode

  const isSingleVideo = videos.length === 1;

  const handleDownload = async () => {
    // Prevent double execution
    if (hasStarted.current) return;
    hasStarted.current = true;
    setIsDownloading(true);

    if (isSingleVideo) {
      // Single video download
      const video = videos[0];
      setProgressMap(
        new Map([
          [video.id, { videoId: video.id, status: "downloading", progress: 0 }],
        ])
      );

      const result = await downloadVideo(
        video.videoUrl || "",
        video.caption,
        video.shortcode,
        (progress) => {
          setProgressMap(
            new Map([
              [video.id, { videoId: video.id, status: "downloading", progress }],
            ])
          );
        }
      );

      setProgressMap(
        new Map([
          [
            video.id,
            {
              videoId: video.id,
              status: result.success ? "completed" : "error",
              progress: result.success ? 100 : 0,
              error: result.error,
            },
          ],
        ])
      );

      setResults({ success: result.success ? 1 : 0, failed: result.success ? 0 : 1 });
    } else {
      // Batch download
      const downloadResults = await downloadVideos(
        videos.map((v) => ({
          id: v.id,
          videoUrl: v.videoUrl,
          caption: v.caption,
          shortcode: v.shortcode,
        })),
        setProgressMap
      );

      const success = downloadResults.filter((r) => r.success).length;
      const failed = downloadResults.filter((r) => !r.success).length;
      setResults({ success, failed });
    }

    setIsDownloading(false);
    setIsComplete(true);
  };

  // Auto-start download
  useEffect(() => {
    handleDownload();
  }, []);

  const getStatusIcon = (status: DownloadProgress["status"]) => {
    switch (status) {
      case "pending":
        return <div className="w-4 h-4 rounded-full bg-gray-200" />;
      case "fetching_url":
        return <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />;
      case "downloading":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={isComplete ? onClose : undefined} />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Download className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isSingleVideo ? "Download Video" : `Download ${videos.length} Videos`}
              </h2>
              <p className="text-sm text-gray-500">
                {isComplete
                  ? `${results.success} completed, ${results.failed} failed`
                  : isDownloading
                  ? "Downloading..."
                  : "Preparing download..."}
              </p>
            </div>
          </div>
          {isComplete && (
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {videos.map((video) => {
              const progress = progressMap.get(video.id);
              return (
                <div
                  key={video.id}
                  className={`p-3 rounded-lg border ${
                    progress?.status === "error"
                      ? "border-red-200 bg-red-50"
                      : progress?.status === "completed"
                      ? "border-green-200 bg-green-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Thumbnail */}
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">
                      {video.thumbnail ? (
                        <img
                          src={video.thumbnail}
                          alt=""
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Download className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 line-clamp-2">
                        {video.caption || "No caption"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusIcon(progress?.status || "pending")}
                        <span className="text-xs text-gray-500">
                          {progress?.status === "fetching_url"
                            ? "Fetching video URL..."
                            : progress?.status === "downloading"
                            ? `Downloading... ${progress.progress}%`
                            : progress?.status === "completed"
                            ? progress.error || "Downloaded"
                            : progress?.status === "error"
                            ? progress.error || "Failed"
                            : "Waiting..."}
                        </span>
                      </div>
                      {/* Progress bar */}
                      {progress?.status === "downloading" && (
                        <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${progress.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* No videoUrl warning */}
          {videos.some((v) => !v.videoUrl) && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                Some videos don&apos;t have direct download URLs. Re-sync the profile to get updated video URLs.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          {isComplete ? (
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Done
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                {progressMap.size > 0
                  ? `Downloading ${Array.from(progressMap.values()).filter((p) => p.status === "downloading").length} of ${videos.length}...`
                  : "Starting download..."}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
