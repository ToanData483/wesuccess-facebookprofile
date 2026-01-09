"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Link, AlertCircle, List } from "lucide-react";
import { isValidFacebookUrl } from "@/lib/utils";

interface UrlInputProps {
  onSubmit: (urls: string[]) => void;
  loading?: boolean;
  disabled?: boolean;
}

export function UrlInput({ onSubmit, loading, disabled }: UrlInputProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [batchMode, setBatchMode] = useState(false);

  const urls = input.split(/[\n,]/).map((url) => url.trim()).filter((url) => url.length > 0);
  const urlCount = urls.length;

  const handleSubmit = () => {
    setError("");

    if (urls.length === 0) {
      setError("Please enter a Facebook URL");
      return;
    }

    if (urls.length > 10) {
      setError("Maximum 10 URLs at once");
      return;
    }

    const invalidUrls = urls.filter((url) => !isValidFacebookUrl(url));
    if (invalidUrls.length > 0) {
      setError("Invalid URL(s). Use Facebook post/reel links.");
      return;
    }

    onSubmit(urls);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !batchMode) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const btnClass = (active: boolean) =>
    `px-4 py-1.5 text-sm rounded-lg transition-colors ${active ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`;

  const inputClass = (hasError: boolean) =>
    `w-full px-4 py-3 text-base border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${hasError ? "border-red-300" : "border-slate-200"}`;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="flex justify-center gap-2">
        <button onClick={() => setBatchMode(false)} className={btnClass(!batchMode)}>
          <Link className="w-4 h-4 inline mr-1.5" />
          Single URL
        </button>
        <button onClick={() => setBatchMode(true)} className={btnClass(batchMode)}>
          <List className="w-4 h-4 inline mr-1.5" />
          Batch Mode
        </button>
      </div>

      <div className="relative">
        {batchMode ? (
          <textarea
            placeholder="Paste multiple Facebook URLs here (one per line)..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className={inputClass(!!error) + " resize-none"}
            rows={5}
            disabled={disabled}
          />
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Link className="w-5 h-5" />
            </div>
            <input
              type="text"
              placeholder="Paste Facebook URL here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className={inputClass(!!error) + " pl-12"}
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {urlCount > 1 && (
        <div className="text-center">
          <span className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full">
            {urlCount} URLs detected
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <p className="text-slate-500 text-sm text-center">
        Supports: Posts, Reels, IGTV. {batchMode ? "Max 10 URLs." : "Press Enter to download."}
      </p>

      <Button
        onClick={handleSubmit}
        loading={loading}
        disabled={disabled || !input.trim()}
        size="lg"
        className="w-full"
      >
        <Download className="w-5 h-5 mr-2" />
        {urlCount > 1 ? `Download ${urlCount} Videos` : "Get Video"}
      </Button>
    </div>
  );
}
