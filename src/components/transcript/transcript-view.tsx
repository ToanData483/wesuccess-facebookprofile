"use client";

import { useState } from "react";
import {
  FileText,
  Upload,
  Link as LinkIcon,
  Loader2,
  Download,
  Copy,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Languages,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getApiKey } from "@/lib/config-store";

interface TranscriptResult {
  id: string;
  text: string;
  language?: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

interface BatchItem {
  url: string;
  status: "pending" | "processing" | "completed" | "error";
  result?: TranscriptResult;
  error?: string;
}

type Mode = "single" | "batch";

export function TranscriptView() {
  const [mode, setMode] = useState<Mode>("single");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Batch mode state
  const [batchUrls, setBatchUrls] = useState("");
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    const apiKey = getApiKey("assemblyai");
    if (!apiKey) {
      setError("Please configure AssemblyAI API key in Settings first.");
      return;
    }

    // Get Apify token for Facebook URL resolution
    const apifyToken = getApiKey("apify");

    // Check if URL is a Facebook URL (not direct CDN)
    const isFacebookUrl = url.includes("facebook.com") || url.includes("fb.watch");
    const isDirectUrl = url.includes("fbcdn.net") || url.includes("video-") || url.includes("scontent");

    if (isFacebookUrl && !isDirectUrl && !apifyToken) {
      setError("Please configure Apify token in Settings to transcribe Facebook videos.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Call API route for transcription
      const response = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, apiKey, apifyToken }),
      });

      if (!response.ok) {
        const err = await response.json();
        // Show hint if available
        const errorMsg = err.hint ? `${err.error}. ${err.hint}` : err.error;
        throw new Error(errorMsg || "Transcription failed");
      }

      const data = await response.json();
      setResult({
        id: data.id || `tr_${Date.now()}`,
        text: data.text,
        language: data.language_code,
        segments: data.words?.map((w: any, i: number, arr: any[]) => {
          const nextWord = arr[i + 1];
          return {
            start: w.start / 1000,
            end: (nextWord?.start || w.end) / 1000,
            text: w.text,
          };
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadSRT = () => {
    if (!result?.segments) return;

    const srt = result.segments
      .map((seg, i) => {
        const startTime = formatSRTTime(seg.start);
        const endTime = formatSRTTime(seg.end);
        return `${i + 1}\n${startTime} --> ${endTime}\n${seg.text}\n`;
      })
      .join("\n");

    const blob = new Blob([srt], { type: "text/srt" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript_${result.id}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Batch mode handlers
  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const apiKey = getApiKey("assemblyai");
    if (!apiKey) {
      setError("Please configure AssemblyAI API key in Settings first.");
      return;
    }

    const apifyToken = getApiKey("apify");

    // Parse URLs from textarea
    const urls = batchUrls
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (urls.length === 0) return;

    // Check if any Facebook URL needs Apify token
    const hasFacebookUrl = urls.some(
      (u) => (u.includes("facebook.com") || u.includes("fb.watch")) &&
             !u.includes("fbcdn.net") && !u.includes("video-") && !u.includes("scontent")
    );

    if (hasFacebookUrl && !apifyToken) {
      setError("Please configure Apify token in Settings to transcribe Facebook videos.");
      return;
    }

    // Initialize batch items
    const items: BatchItem[] = urls.map((url) => ({
      url,
      status: "pending",
    }));
    setBatchItems(items);
    setBatchProcessing(true);
    setError(null);

    // Process sequentially (AssemblyAI has rate limits)
    for (let i = 0; i < items.length; i++) {
      // Update status to processing
      setBatchItems((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: "processing" } : item
        )
      );

      try {
        const response = await fetch("/api/transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: items[i].url, apiKey, apifyToken }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Transcription failed");
        }

        const data = await response.json();
        const transcriptResult: TranscriptResult = {
          id: data.id || `tr_${Date.now()}`,
          text: data.text,
          language: data.language_code,
          segments: data.words?.map((w: any, idx: number, arr: any[]) => {
            const nextWord = arr[idx + 1];
            return {
              start: w.start / 1000,
              end: (nextWord?.start || w.end) / 1000,
              text: w.text,
            };
          }),
        };

        setBatchItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "completed", result: transcriptResult } : item
          )
        );
      } catch (err) {
        setBatchItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, status: "error", error: err instanceof Error ? err.message : "Failed" }
              : item
          )
        );
      }
    }

    setBatchProcessing(false);
  };

  const handleDownloadItemSRT = (item: BatchItem) => {
    if (!item.result?.segments) return;

    const srt = item.result.segments
      .map((seg, i) => {
        const startTime = formatSRTTime(seg.start);
        const endTime = formatSRTTime(seg.end);
        return `${i + 1}\n${startTime} --> ${endTime}\n${seg.text}\n`;
      })
      .join("\n");

    const blob = new Blob([srt], { type: "text/srt" });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `transcript_${item.result.id}.srt`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  };

  const handleCopyItemText = (item: BatchItem) => {
    if (item.result?.text) {
      navigator.clipboard.writeText(item.result.text);
    }
  };

  const completedCount = batchItems.filter((i) => i.status === "completed").length;
  const errorCount = batchItems.filter((i) => i.status === "error").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Video Transcription</h2>
          <p className="text-sm text-gray-500">
            Convert video audio to text with AI
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setMode("single")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              mode === "single"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Single Video
          </button>
          <button
            onClick={() => setMode("batch")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              mode === "batch"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Batch Mode
          </button>
        </div>
      </div>

      {/* Single Mode */}
      {mode === "single" && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video URL
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.facebook.com/reel/..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1877F2] text-gray-900 placeholder-gray-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!url.trim() || loading}
                className="w-full py-3 px-4 bg-[#1877F2] hover:bg-[#166FE5] text-white font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Transcribing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Transcript
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <h3 className="font-medium text-gray-900">Transcript</h3>
                  {result.language && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
                      {result.language.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                  {result.segments && (
                    <button
                      onClick={handleDownloadSRT}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      <Download className="w-4 h-4" />
                      SRT
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {result.text}
                </p>
              </div>
            </div>
          )}

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <FeatureCard
              icon={<Languages className="w-5 h-5" />}
              title="90+ Languages"
              description="Auto-detect & transcribe"
            />
            <FeatureCard
              icon={<FileText className="w-5 h-5" />}
              title="SRT Export"
              description="Download subtitles"
            />
            <FeatureCard
              icon={<Sparkles className="w-5 h-5" />}
              title="AI Powered"
              description="AssemblyAI accuracy"
            />
          </div>
        </div>
      )}

      {/* Batch Mode */}
      {mode === "batch" && (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Input Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <form onSubmit={handleBatchSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video URLs (one per line)
                </label>
                <textarea
                  value={batchUrls}
                  onChange={(e) => setBatchUrls(e.target.value)}
                  placeholder={"https://www.facebook.com/reel/123...\nhttps://www.facebook.com/reel/456...\nhttps://fb.watch/abc..."}
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1877F2] text-gray-900 placeholder-gray-400 resize-none font-mono text-sm"
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {batchUrls.split("\n").filter((u) => u.trim()).length} URLs entered
                </p>
                <button
                  type="submit"
                  disabled={!batchUrls.trim() || batchProcessing}
                  className="py-2.5 px-6 bg-[#1877F2] hover:bg-[#166FE5] text-white font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {batchProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Start Batch
                    </>
                  )}
                </button>
              </div>
            </form>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>

          {/* Progress Summary */}
          {batchItems.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">Progress</h3>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-green-600">{completedCount} completed</span>
                  {errorCount > 0 && (
                    <span className="text-red-600">{errorCount} failed</span>
                  )}
                  <span className="text-gray-500">
                    {batchItems.length - completedCount - errorCount} remaining
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-[#1877F2] h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${((completedCount + errorCount) / batchItems.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Results List */}
          {batchItems.length > 0 && (
            <div className="space-y-3">
              {batchItems.map((item, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                  {/* Item Header */}
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                    onClick={() =>
                      setExpandedItem(expandedItem === index ? null : index)
                    }
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {item.status === "pending" && (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                      )}
                      {item.status === "processing" && (
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                      )}
                      {item.status === "completed" && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                      {item.status === "error" && (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      )}
                      <span className="text-sm text-gray-700 truncate">
                        {item.url}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status === "completed" && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyItemText(item);
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadItemSRT(item);
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {item.status === "completed" && (
                        expandedItem === index ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedItem === index && item.status === "completed" && item.result && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="mt-3 flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">Transcript</span>
                        {item.result.language && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
                            {item.result.language.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {item.result.text}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {item.status === "error" && item.error && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <p className="mt-2 text-sm text-red-600">{item.error}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
      <div className="w-10 h-10 bg-blue-50 rounded-lg mx-auto mb-2 flex items-center justify-center text-[#1877F2]">
        {icon}
      </div>
      <h4 className="font-medium text-gray-900 text-sm">{title}</h4>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
}
