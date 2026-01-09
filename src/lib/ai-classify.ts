/**
 * Topic Classification Service
 * Uses keyword matching for content classification
 * Includes caching to improve performance
 */

// Cache for classification results (in-memory + localStorage)
const classificationCache = new Map<string, CachedClassification>();
const CACHE_KEY = "ai_topic_classification_cache";
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedClassification {
  topic: string;
  confidence: number;
  keywords: string[];
  timestamp: number;
}

interface ContentItem {
  id: string;
  caption: string;
  hashtags?: string[];
}

interface ClassificationResult {
  id: string;
  topic: string;
  confidence: number;
  keywords: string[];
  fromCache?: boolean;
}

// Load cache from localStorage on init
function loadCache(): void {
  if (typeof window === "undefined") return;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached) as Record<string, CachedClassification>;
      const now = Date.now();

      // Load only non-expired entries
      Object.entries(data).forEach(([key, value]) => {
        if (now - value.timestamp < CACHE_EXPIRY_MS) {
          classificationCache.set(key, value);
        }
      });

      console.log(`[AI Classify] Loaded ${classificationCache.size} cached classifications`);
    }
  } catch (error) {
    console.error("[AI Classify] Failed to load cache:", error);
  }
}

// Save cache to localStorage
function saveCache(): void {
  if (typeof window === "undefined") return;

  try {
    const data: Record<string, CachedClassification> = {};
    classificationCache.forEach((value, key) => {
      data[key] = value;
    });
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("[AI Classify] Failed to save cache:", error);
  }
}

// Generate cache key from content
function getCacheKey(content: ContentItem): string {
  // Use first 200 chars of caption + hashtags for cache key
  const text = (content.caption || "").slice(0, 200) + (content.hashtags?.join(",") || "");
  // Simple hash
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `topic_${content.id}_${hash}`;
}

// Initialize cache on module load
if (typeof window !== "undefined") {
  loadCache();
}

/**
 * Classify content topics using keyword matching (with caching)
 */
export async function classifyTopics(
  contents: ContentItem[]
): Promise<ClassificationResult[]> {
  const results: ClassificationResult[] = [];

  contents.forEach((item) => {
    const cacheKey = getCacheKey(item);
    const cached = classificationCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
      results.push({
        id: item.id,
        topic: cached.topic,
        confidence: cached.confidence,
        keywords: cached.keywords,
        fromCache: true,
      });
    } else {
      // Classify using keyword matching
      const topic = detectTopicKeyword(item.caption || "", item.hashtags || []);
      const result: ClassificationResult = {
        id: item.id,
        topic,
        confidence: 0.7,
        keywords: [],
        fromCache: false,
      };

      // Cache the result
      classificationCache.set(cacheKey, {
        topic: result.topic,
        confidence: result.confidence,
        keywords: result.keywords,
        timestamp: Date.now(),
      });

      results.push(result);
    }
  });

  // Save cache
  saveCache();

  return results;
}

/**
 * Classify single content item
 */
export async function classifyTopic(
  id: string,
  caption: string,
  hashtags: string[] = []
): Promise<ClassificationResult> {
  const results = await classifyTopics([{ id, caption, hashtags }]);
  return results[0] || {
    id,
    topic: "General",
    confidence: 0,
    keywords: [],
  };
}

/**
 * Fallback: Detect topic using keywords (same as original detectTopic)
 */
export function detectTopicKeyword(caption: string, hashtags: string[]): string {
  const text = (caption + " " + hashtags.join(" ")).toLowerCase();

  const topicKeywords: Record<string, string[]> = {
    "Entertainment": ["funny", "comedy", "meme", "entertainment", "viral", "trend", "dance", "hài", "vui", "nhạc"],
    "Education": ["learn", "tutorial", "tips", "how to", "guide", "education", "knowledge", "study", "học", "kiến thức", "hướng dẫn"],
    "Business": ["business", "marketing", "money", "investment", "startup", "entrepreneur", "finance", "kinh doanh", "tiền", "đầu tư"],
    "Lifestyle": ["lifestyle", "travel", "food", "fashion", "beauty", "health", "fitness", "wellness", "du lịch", "ăn", "thời trang"],
    "Technology": ["tech", "ai", "software", "coding", "programming", "app", "digital", "công nghệ", "phần mềm"],
    "News": ["news", "breaking", "update", "current", "today", "tin", "nóng", "cập nhật"],
    "Music": ["music", "song", "singer", "nhạc", "bài hát", "ca sĩ", "cover"],
    "Gaming": ["game", "gaming", "stream", "esport", "chơi game"],
    "Food": ["food", "recipe", "cooking", "chef", "ẩm thực", "nấu ăn", "món ăn"],
    "Motivation": ["motivation", "inspire", "success", "dream", "động lực", "thành công", "truyền cảm hứng"],
  };

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some((kw) => text.includes(kw))) {
      return topic;
    }
  }

  return "General";
}

/**
 * Clear classification cache
 */
export function clearClassificationCache(): void {
  classificationCache.clear();
  if (typeof window !== "undefined") {
    localStorage.removeItem(CACHE_KEY);
  }
  console.log("[AI Classify] Cache cleared");
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { total: number; size: string } {
  const total = classificationCache.size;
  const cacheData = localStorage.getItem(CACHE_KEY) || "{}";
  const size = (cacheData.length / 1024).toFixed(2) + " KB";
  return { total, size };
}

/**
 * Check if classification is available (always true - uses keyword matching)
 */
export function isAIClassificationAvailable(): boolean {
  return true;
}
