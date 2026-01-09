/**
 * Image Proxy Utility
 * Note: Facebook CDN sends CORP header blocking cross-origin image loading
 * Images are now cached locally during Apify sync
 */

/**
 * Get image URL for Facebook images
 * @param url - Original Facebook CDN URL or cached local path
 * @returns URL to use (cached path if available, fallback UI avatar otherwise)
 */
export function getProxiedImageUrl(url: string | undefined): string {
  if (!url) return "";

  // Already a cached local URL
  if (url.startsWith("/cache/images/")) {
    return url;
  }

  // UI Avatars and Picsum don't need proxy
  if (url.includes("ui-avatars.com") || url.includes("picsum.photos")) {
    return url;
  }

  // For Facebook CDN URLs without cached version, return placeholder
  // This happens when viewing old data before caching was implemented
  if (isFacebookCdnUrl(url)) {
    // Return a placeholder - the actual image will fail to load due to CORP
    // Consider returning a fallback or triggering cache on-demand
    return url; // Still try direct, might work in some cases
  }

  return url;
}

/**
 * Get proxied image URL (for fetch calls, not <img> tags)
 * Note: This may timeout due to Facebook CDN blocking server requests
 */
export function getProxiedImageUrlForFetch(url: string | undefined): string {
  if (!url) return "";

  // Already a proxied URL
  if (url.startsWith("/api/proxy/image")) {
    return url;
  }

  // UI Avatars and Picsum don't need proxy
  if (url.includes("ui-avatars.com") || url.includes("picsum.photos")) {
    return url;
  }

  // Facebook CDN URLs - proxy for fetch calls
  if (
    url.includes("facebook.com") ||
    url.includes("cdnfacebook.com") ||
    url.includes("fbcdn.net") ||
    url.includes("scontent")
  ) {
    return `/api/proxy/image?url=${encodeURIComponent(url)}`;
  }

  // Return as-is for other URLs
  return url;
}

/**
 * Check if URL is an Facebook CDN URL that might have CORS issues
 */
export function isFacebookCdnUrl(url: string): boolean {
  if (!url) return false;
  return (
    url.includes("facebook.com") ||
    url.includes("cdnfacebook.com") ||
    url.includes("fbcdn.net") ||
    url.includes("scontent")
  );
}
