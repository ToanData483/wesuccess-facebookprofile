"use client";

import { X, Copy, Download, CheckCircle } from "lucide-react";
import { useState } from "react";
import type { VideoTranscript } from "@/lib/types/channel-project";

interface TranscriptViewerDialogProps {
  transcript: VideoTranscript;
  videoTitle: string;
  onClose: () => void;
}

/**
 * Generate SRT content from transcript segments
 */
function generateSRT(segments: VideoTranscript["segments"]): string {
  if (!segments || segments.length === 0) return "";

  return segments
    .map((seg, idx) => {
      const startTime = formatSRTTime(seg.start);
      const endTime = formatSRTTime(seg.end);
      return `${idx + 1}\n${startTime} --> ${endTime}\n${seg.text}`;
    })
    .join("\n\n");
}

function formatSRTTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")},${milliseconds.toString().padStart(3, "0")}`;
}

export function TranscriptViewerDialog({
  transcript,
  videoTitle,
  onClose,
}: TranscriptViewerDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcript.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownloadSRT = () => {
    if (!transcript.segments || transcript.segments.length === 0) return;
    const srtContent = generateSRT(transcript.segments);
    const blob = new Blob([srtContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoTitle.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "_")}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTXT = () => {
    const blob = new Blob([transcript.text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoTitle.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate duration from segments if available
  const duration = transcript.segments && transcript.segments.length > 0
    ? transcript.segments[transcript.segments.length - 1].end
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div className="min-w-0 flex-1 pr-4">
            <h2 className="font-semibold text-gray-900 truncate">Transcript</h2>
            <p className="text-sm text-gray-500 truncate">{videoTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handleDownloadTXT}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              TXT
            </button>
            {transcript.segments && transcript.segments.length > 0 && (
              <button
                onClick={handleDownloadSRT}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-purple-600 hover:text-purple-700 hover:bg-cyan-50 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                SRT
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {/* Metadata */}
          <div className="flex flex-wrap gap-4 mb-4 text-sm text-gray-500">
            {transcript.language && (
              <span>Language: <span className="font-medium text-gray-700">{transcript.language}</span></span>
            )}
            {transcript.translatedLanguage && (
              <span>Translated to: <span className="font-medium text-green-600">{transcript.translatedLanguage}</span></span>
            )}
            {duration && (
              <span>Duration: <span className="font-medium text-gray-700">{Math.round(duration / 1000)}s</span></span>
            )}
            {transcript.segments && (
              <span>Segments: <span className="font-medium text-gray-700">{transcript.segments.length}</span></span>
            )}
          </div>

          {/* Translation (if available) */}
          {transcript.translatedText && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded">
                  Translation ({transcript.translatedLanguage})
                </span>
              </div>
              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                {transcript.translatedText}
              </p>
            </div>
          )}

          {/* Original Transcript Text */}
          <div className="bg-gray-50 rounded-xl p-4">
            {transcript.translatedText && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                  Original ({transcript.language})
                </span>
              </div>
            )}
            <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
              {transcript.text || "No transcript text available"}
            </p>
          </div>

          {/* Segment timestamps (collapsible) */}
          {transcript.segments && transcript.segments.length > 0 && (
            <details className="mt-4">
              <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                Show segment timestamps ({transcript.segments.length} segments)
              </summary>
              <div className="mt-2 max-h-64 overflow-y-auto bg-gray-50 rounded-lg p-3 space-y-2">
                {transcript.segments.map((segment, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-2 bg-white rounded border border-gray-100"
                  >
                    <span className="text-xs text-gray-400 font-mono whitespace-nowrap pt-0.5">
                      {(segment.start / 1000).toFixed(1)}s
                    </span>
                    <span className="text-sm text-gray-800 flex-1">{segment.text}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-cyan-500 hover:bg-purple-600 text-white font-medium rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
