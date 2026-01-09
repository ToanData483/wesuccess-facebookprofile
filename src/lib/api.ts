/**
 * Facebook video download API - uses Apify facebook-posts-scraper
 */

import { getApiKey } from "./config-store";

export interface VideoInfo {
  url: string;
  filename: string;
  thumbnail?: string;
  caption?: string;
  duration?: number;
}

/**
 * Get Apify token from config store
 */
function getApifyToken(): string | null {
  if (typeof window === "undefined") return null;
  return getApiKey("apify") || null;
}

/**
 * Extract video URL using Apify API
 */
export async function extractVideo(facebookUrl: string): Promise<VideoInfo> {
  const token = getApifyToken();

  if (!token) {
    throw new Error("Please add your Apify API key in Settings first");
  }

  const response = await fetch("/api/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: facebookUrl, token }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    url: data.url,
    filename: data.filename,
    thumbnail: data.thumbnail,
    caption: data.caption,
    duration: data.duration,
  };
}

