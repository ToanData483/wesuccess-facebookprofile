"use client";

import { useState, useCallback } from "react";
import {
  getChannelData,
  calculateEngagement,
  ChannelData,
  FacebookVideo,
} from "@/lib/facebook-api";

export interface ChannelState {
  loading: boolean;
  error: string | null;
  data: ChannelData | null;
  engagement: {
    avgViews: number;
    avgLikes: number;
    avgComments: number;
    engagementRate: number;
    totalViews: number;
  } | null;
}

export function useChannel() {
  const [state, setState] = useState<ChannelState>({
    loading: false,
    error: null,
    data: null,
    engagement: null,
  });

  const analyze = useCallback(async (username: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const data = await getChannelData(username);

      // Check if private
      if (data.profile.isPrivate) {
        setState({
          loading: false,
          error: null,
          data: {
            ...data,
            videos: [], // Clear videos for private accounts
          },
          engagement: null,
        });
        return;
      }

      const engagement = calculateEngagement(data.profile, data.videos);

      setState({
        loading: false,
        error: null,
        data,
        engagement,
      });
    } catch (error) {
      setState({
        loading: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch profile",
        data: null,
        engagement: null,
      });
    }
  }, []);

  const clear = useCallback(() => {
    setState({
      loading: false,
      error: null,
      data: null,
      engagement: null,
    });
  }, []);

  return {
    ...state,
    analyze,
    clear,
  };
}
