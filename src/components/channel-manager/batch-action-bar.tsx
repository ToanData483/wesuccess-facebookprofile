"use client";

import { Download, X, CheckSquare, Square, FileText, Loader2 } from "lucide-react";
import type { VideoData } from "@/lib/types/channel-project";

interface BatchActionBarProps {
  selectedVideos: VideoData[];
  totalVideos: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDownload: () => void;
  onExtractTranscripts?: () => void;
  isDownloading?: boolean;
  isExtracting?: boolean;
}

export function BatchActionBar({
  selectedVideos,
  totalVideos,
  onSelectAll,
  onClearSelection,
  onDownload,
  onExtractTranscripts,
  isDownloading = false,
  isExtracting = false,
}: BatchActionBarProps) {
  const allSelected = selectedVideos.length === totalVideos && totalVideos > 0;

  if (selectedVideos.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-[240px] right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={allSelected ? onClearSelection : onSelectAll}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-500 transition-colors"
          >
            {allSelected ? (
              <CheckSquare className="w-5 h-5" />
            ) : (
              <Square className="w-5 h-5" />
            )}
            {allSelected ? "Deselect all" : "Select all"}
          </button>

          <span className="text-sm text-gray-500">
            <span className="font-medium text-blue-500">{selectedVideos.length}</span>
            {" "}of {totalVideos} videos selected
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClearSelection}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            title="Clear selection"
          >
            <X className="w-5 h-5" />
          </button>

          {onExtractTranscripts && (
            <button
              onClick={onExtractTranscripts}
              disabled={isExtracting}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-purple-600 disabled:bg-purple-300 text-white font-medium rounded-lg transition-all"
            >
              {isExtracting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {isExtracting ? "Extracting..." : "Extract Transcripts"}
            </button>
          )}

          <button
            onClick={onDownload}
            disabled={isDownloading}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-blue-300 disabled:to-purple-400 text-white font-medium rounded-lg transition-all"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isDownloading ? "Downloading..." : `Download ${selectedVideos.length} videos`}
          </button>
        </div>
      </div>
    </div>
  );
}
