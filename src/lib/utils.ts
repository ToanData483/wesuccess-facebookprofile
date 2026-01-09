import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validate Facebook URL - supports multiple formats
 */
export function isValidFacebookUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?facebook\.com\/watch/,
    /^https?:\/\/(www\.)?facebook\.com\/reel\/[\w-]+/,
    /^https?:\/\/(www\.)?facebook\.com\/reels\/[\w-]+/,
    /^https?:\/\/(www\.)?facebook\.com\/[\w.]+\/videos\/\d+/,
    /^https?:\/\/(www\.)?facebook\.com\/[\w.]+\/posts\/[\w-]+/,
    /^https?:\/\/(www\.)?facebook\.com\/share\/v\/[\w-]+/,
    /^https?:\/\/(www\.)?facebook\.com\/share\/r\/[\w-]+/,
    /^https?:\/\/fb\.watch\/[\w-]+/,
    /^https?:\/\/(www\.)?facebook\.com\/\d+\/videos\/\d+/,
    /^https?:\/\/(www\.)?facebook\.com\/p\/[\w-]+/,
    /^https?:\/\/(www\.)?facebook\.com\/tv\/[\w-]+/,
  ];
  return patterns.some((pattern) => pattern.test(url));
}

/**
 * Extract shortcode from Facebook URL
 */
export function extractShortcode(url: string): string | null {
  const match = url.match(/\/(p|reel|reels|tv)\/([\w-]+)/);
  return match ? match[2] : null;
}

/**
 * Format number with K/M suffix
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}
