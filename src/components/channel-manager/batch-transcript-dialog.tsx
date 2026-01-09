"use client";

import { useState } from "react";
import {
  X,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  DollarSign,
} from "lucide-react";
import type { VideoData, VideoTranscript } from "@/lib/types/channel-project";
import {
  processBatchTranscripts,
  estimateTranscriptCost,
  formatDuration,
  type BatchTranscriptProgress,
} from "@/lib/services/batch-transcript-service";
import { getAssemblyAIKey } from "@/lib/assemblyai-api";

interface BatchTranscriptDialogProps {
  videos: VideoData[];
  onClose: () => void;
  onComplete: (results: Map<string, VideoTranscript>) => void;
}

export function BatchTranscriptDialog({
  videos,
  onClose,
  onComplete,
}: BatchTranscriptDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BatchTranscriptProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasApiKey = !!getAssemblyAIKey();
  const estimate = estimateTranscriptCost(videos);

  // Filter videos that can be transcribed (must have videoUrl)
  const videosToProcess = videos.filter((v) => v.videoUrl && v.videoUrl.trim() !== "" && !v.transcript?.text);
  const videosWithoutUrl = videos.filter((v) => !v.videoUrl || v.videoUrl.trim() === "");
  const videosAlreadyTranscribed = videos.filter((v) => v.transcript?.text);

  // Debug log
  console.log("[BatchTranscript] Videos analysis:", {
    total: videos.length,
    withVideoUrl: videosToProcess.length,
    withoutVideoUrl: videosWithoutUrl.length,
    alreadyTranscribed: videosAlreadyTranscribed.length,
    sampleVideo: videos[0] ? { id: videos[0].id, videoUrl: videos[0].videoUrl, hasTranscript: !!videos[0].transcript } : null,
  });

  const handleStart = async () => {
    if (!hasApiKey) {
      setError("AssemblyAI API key not configured. Please add it in Settings.");
      return;
    }

    if (videosToProcess.length === 0) {
      setError("No videos to transcribe. Videos may already have transcripts or missing video URLs.");
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      const results = await processBatchTranscripts(videosToProcess, {
        onProgress: setProgress,
        onVideoComplete: (videoId, transcript) => {
          console.log(`Transcript completed for ${videoId}`);
        },
        onVideoError: (videoId, err) => {
          console.error(`Transcript failed for ${videoId}:`, err);
        },
        onComplete: (results) => {
          onComplete(results);
        },
      });

      // Dialog will stay open showing final status
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process transcripts");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-500";
      case "processing":
        return "text-blue-500";
      case "error":
        return "text-red-500";
      default:
        return "text-gray-400";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "processing":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={!isProcessing ? onClose : undefined}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Batch Transcript Extraction</h2>
              <p className="text-sm text-gray-500">Extract transcripts using AssemblyAI</p>
            </div>
          </div>
          {!isProcessing && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
          {/* API Key Status */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              hasApiKey ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            {hasApiKey ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span className="text-sm">
              AssemblyAI: {hasApiKey ? "Connected" : "Not configured - Go to Settings"}
            </span>
          </div>

          {/* Video URL Status Warning */}
          {!progress && videosWithoutUrl.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 text-yellow-800 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">
                  {videosWithoutUrl.length} of {videos.length} video{videos.length > 1 ? "s" : ""} missing direct video URL
                </p>
                <p className="text-yellow-700 mt-1">
                  Facebook does not provide direct video URLs through the API. Please re-sync the profile to fetch updated data, or use a different transcription method.
                </p>
              </div>
            </div>
          )}

          {/* Already Transcribed Info */}
          {!progress && videosAlreadyTranscribed.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">
                {videosAlreadyTranscribed.length} video{videosAlreadyTranscribed.length > 1 ? "s" : ""} already transcribed
              </span>
            </div>
          )}

          {/* Estimate */}
          {!progress && videosToProcess.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-gray-900">Estimation</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Videos</p>
                  <p className="font-semibold text-gray-900">{videosToProcess.length}</p>
                </div>
                <div>
                  <p className="text-gray-500">Duration</p>
                  <p className="font-semibold text-gray-900">
                    {formatDuration(estimate.totalDuration)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Est. Cost</p>
                  <p className="font-semibold text-gray-900">
                    ${estimate.estimatedCost.toFixed(2)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                * Cost based on AssemblyAI pricing ($0.00025/second)
              </p>
            </div>
          )}

          {/* No Videos to Process */}
          {!progress && videosToProcess.length === 0 && (
            <div className="flex items-start gap-2 p-4 bg-gray-50 text-gray-600 rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-400" />
              <div className="text-sm">
                <p className="font-medium text-gray-900">No videos available for transcription</p>
                <p className="mt-1">
                  {videosWithoutUrl.length > 0
                    ? "The selected videos don't have direct video URLs. Facebook's API doesn't provide direct video links."
                    : videosAlreadyTranscribed.length > 0
                    ? "All selected videos have already been transcribed."
                    : "No eligible videos found."}
                </p>
              </div>
            </div>
          )}

          {/* Progress */}
          {progress && (
            <div className="space-y-3">
              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    Progress: {progress.completed + progress.failed} / {progress.total}
                  </span>
                  <span className="text-gray-400">
                    {Math.round(
                      ((progress.completed + progress.failed) / progress.total) * 100
                    )}
                    %
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 transition-all duration-300"
                    style={{
                      width: `${
                        ((progress.completed + progress.failed) / progress.total) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-4 text-sm">
                <span className="text-green-600">
                  ✓ {progress.completed} completed
                </span>
                {progress.failed > 0 && (
                  <span className="text-red-600">✗ {progress.failed} failed</span>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {progress.items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-2 rounded-lg ${
                      item.status === "processing"
                        ? "bg-blue-50"
                        : item.status === "completed"
                        ? "bg-green-50"
                        : item.status === "error"
                        ? "bg-red-50"
                        : "bg-gray-50"
                    }`}
                  >
                    {getStatusIcon(item.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{item.title}</p>
                      {item.errorMessage && (
                        <p className="text-xs text-red-500 truncate">
                          {item.errorMessage}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-xs capitalize ${getStatusColor(item.status)}`}
                    >
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
          {progress?.status === "completed" ? (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-cyan-500 hover:bg-purple-600 text-white font-medium rounded-lg"
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleStart}
                disabled={isProcessing || !hasApiKey || videosToProcess.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-purple-600 disabled:bg-purple-300 text-white font-medium rounded-lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Start Extraction
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
