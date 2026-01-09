"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle, XCircle, Loader2, RotateCcw } from "lucide-react";

export interface VideoResultItem {
  url: string;
  status: "loading" | "success" | "error";
  downloadUrl?: string;
  filename?: string;
  error?: string;
}

interface VideoResultProps {
  results: VideoResultItem[];
  onRetry?: (url: string) => void;
}

export function VideoResult({ results, onRetry }: VideoResultProps) {
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);

  if (results.length === 0) return null;

  const handleManualDownload = async (item: VideoResultItem, index: number) => {
    if (!item.downloadUrl) return;

    setDownloadingIndex(index);
    try {
      const response = await fetch(item.downloadUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = item.filename || "facebook_video.mp4";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      window.open(item.downloadUrl, "_blank");
    }
    setDownloadingIndex(null);
  };

  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const loadingCount = results.filter((r) => r.status === "loading").length;

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 space-y-4">
      {results.length > 1 && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 rounded-lg text-sm">
          <span className="text-slate-600">
            {loadingCount > 0 ? `Processing ${results.length - loadingCount}/${results.length}...` : `Completed: ${successCount} success, ${errorCount} failed`}
          </span>
          {loadingCount > 0 && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
        </div>
      )}

      <div className="space-y-3">
        {results.map((item, index) => (
          <div
            key={index}
            className={`flex items-center justify-between gap-4 p-4 rounded-xl border shadow-sm ${item.status === "error" ? "bg-red-50 border-red-200" : "bg-white border-slate-200"}`}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {item.status === "loading" && <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />}
              {item.status === "success" && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />}
              {item.status === "error" && <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}

              <div className="flex-1 min-w-0">
                <p className="text-slate-700 text-sm truncate">{item.url}</p>
                {item.status === "success" && <p className="text-green-600 text-xs mt-1">Downloaded</p>}
                {item.error && <p className="text-red-500 text-xs mt-1">{item.error}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {item.status === "success" && item.downloadUrl && (
                <Button variant="secondary" size="sm" onClick={() => handleManualDownload(item, index)} disabled={downloadingIndex === index}>
                  {downloadingIndex === index ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 mr-1" />Save Again</>}
                </Button>
              )}
              {item.status === "error" && onRetry && (
                <Button variant="secondary" size="sm" onClick={() => onRetry(item.url)}>
                  <RotateCcw className="w-4 h-4 mr-1" />Retry
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
