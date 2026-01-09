"use client";

import { useState } from "react";
import { ImageOff, Play, User } from "lucide-react";

interface FallbackImageProps {
  src?: string;
  alt?: string;
  className?: string;
  fallbackType?: "video" | "profile" | "post" | "avatar";
  fallbackClassName?: string;
  fallbackText?: string;
}

/**
 * Image component with fallback placeholder for failed loads
 * Used for Facebook CDN images that may fail due to CORP headers
 */
export function FallbackImage({
  src,
  alt = "",
  className = "",
  fallbackType = "video",
  fallbackClassName = "",
  fallbackText,
}: FallbackImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // No src provided
  if (!src) {
    return <Placeholder type={fallbackType} className={fallbackClassName || className} text={fallbackText} />;
  }

  // Image failed to load
  if (hasError) {
    return <Placeholder type={fallbackType} className={fallbackClassName || className} text={fallbackText} />;
  }

  // Use fallbackClassName for wrapper, className for img
  const wrapperClass = fallbackClassName || "w-full h-full";

  return (
    <div className={`relative ${wrapperClass}`}>
      {/* Loading skeleton */}
      {isLoading && (
        <div className="absolute inset-0 animate-pulse bg-gray-200 rounded" />
      )}
      {/* Image */}
      <img
        src={src}
        alt={alt}
        className={`${className} transition-opacity duration-200 ${isLoading ? "opacity-0" : "opacity-100"}`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          console.log("[FallbackImage] Error loading:", src?.substring(0, 50));
          setHasError(true);
          setIsLoading(false);
        }}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

function Placeholder({ type, className, text }: { type: "video" | "profile" | "post" | "avatar"; className: string; text?: string }) {
  const baseClassName = `flex items-center justify-center ${className}`;

  switch (type) {
    case "video":
      return (
        <div className={`${baseClassName} bg-gradient-to-br from-blue-100 to-cyan-100`}>
          <Play className="w-10 h-10 text-blue-300" />
        </div>
      );
    case "profile":
      return (
        <div className={`${baseClassName} bg-gradient-to-br from-blue-100 to-cyan-100`}>
          <User className="w-8 h-8 text-blue-300" />
        </div>
      );
    case "avatar":
      return (
        <div className={`${baseClassName} bg-gradient-to-br from-blue-400 via-cyan-500 to-orange-400 text-white font-semibold text-xl`}>
          {text || <User className="w-8 h-8" />}
        </div>
      );
    case "post":
      return (
        <div className={`${baseClassName} bg-gradient-to-br from-gray-100 to-gray-200`}>
          <ImageOff className="w-8 h-8 text-gray-400" />
        </div>
      );
  }
}
