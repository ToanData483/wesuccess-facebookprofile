"use client";

import { useState, useEffect } from "react";
import { analyzeChannel, ChannelAnalysis } from "@/lib/gemini-api";
import { ChannelData } from "@/lib/facebook-api";

export function useAnalysis(channelData: ChannelData | null) {
  const [analysis, setAnalysis] = useState<ChannelAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (channelData && channelData.profile) {
      runAnalysis();
    } else {
      setAnalysis(null);
      setError(null);
    }
  }, [channelData?.profile?.username]);

  const runAnalysis = async () => {
    if (!channelData) return;

    setLoading(true);
    setError(null);

    try {
      const result = await analyzeChannel(channelData.profile, channelData.videos);
      setAnalysis(result);
    } catch (err) {
      console.error("Analysis error:", err);
      setError("Failed to analyze profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return {
    analysis,
    loading,
    error,
    refresh: runAnalysis,
  };
}
