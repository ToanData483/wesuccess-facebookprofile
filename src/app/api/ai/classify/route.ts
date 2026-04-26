import { NextRequest, NextResponse } from "next/server";

/**
 * AI Topic Classification API using Gemini 2.5 Flash
 * Cost-effective model for content classification
 *
 * POST /api/ai/classify
 * Body: { contents: Array<{id, caption, hashtags}>, token }
 * Returns: Array<{id, topic, confidence, keywords}>
 */

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// Predefined topics for consistent classification
const TOPICS = [
  "Entertainment",
  "Education",
  "Lifestyle",
  "Business",
  "Technology",
  "Food",
  "Travel",
  "Fashion",
  "Health",
  "Sports",
  "News",
  "Music",
  "Gaming",
  "Motivation",
  "Comedy",
  "General"
] as const;

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
}

export async function POST(request: NextRequest) {
  try {
    const { contents, token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Gemini API token required" }, { status: 400 });
    }

    if (!contents || !Array.isArray(contents) || contents.length === 0) {
      return NextResponse.json({ error: "Contents array required" }, { status: 400 });
    }

    // Batch classify up to 20 items at once for efficiency
    const batchSize = 20;
    const results: ClassificationResult[] = [];

    for (let i = 0; i < contents.length; i += batchSize) {
      const batch = contents.slice(i, i + batchSize) as ContentItem[];
      const batchResults = await classifyBatch(batch, token);
      results.push(...batchResults);
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("[AI Classify] Error:", error);
    return NextResponse.json(
      { error: "Classification failed", details: String(error) },
      { status: 500 }
    );
  }
}

async function classifyBatch(
  contents: ContentItem[],
  token: string
): Promise<ClassificationResult[]> {
  // Build prompt for batch classification
  const contentDescriptions = contents.map((item, idx) => {
    const hashtags = item.hashtags?.length ? `Hashtags: ${item.hashtags.join(", ")}` : "";
    const caption = item.caption?.slice(0, 500) || "(no caption)";
    return `[${idx}] Caption: "${caption}" ${hashtags}`;
  }).join("\n\n");

  const prompt = `You are a content classifier for Facebook posts/videos. Classify each content item into ONE of these topics:
${TOPICS.join(", ")}

For each item, respond in this exact JSON format:
[
  {"index": 0, "topic": "TopicName", "confidence": 0.85, "keywords": ["key1", "key2"]},
  ...
]

Rules:
- confidence: 0.0-1.0 based on how certain the classification is
- keywords: 2-4 key terms that influenced the decision
- If content is unclear or empty, use "General" with low confidence

Content items to classify:
${contentDescriptions}

Respond ONLY with the JSON array, no other text.`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3, // Lower temperature for consistent classification
          topP: 0.8,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI Classify] Gemini API error:", response.status, errorText);
      // Return fallback classifications
      return contents.map(item => ({
        id: item.id,
        topic: "General",
        confidence: 0,
        keywords: [],
      }));
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("[AI Classify] Failed to parse response:", responseText);
      return contents.map(item => ({
        id: item.id,
        topic: "General",
        confidence: 0,
        keywords: [],
      }));
    }

    const classifications = JSON.parse(jsonMatch[0]) as Array<{
      index: number;
      topic: string;
      confidence: number;
      keywords: string[];
    }>;

    // Map back to content IDs
    return contents.map((item, idx) => {
      const classification = classifications.find(c => c.index === idx);
      return {
        id: item.id,
        topic: classification?.topic || "General",
        confidence: classification?.confidence || 0,
        keywords: classification?.keywords || [],
      };
    });
  } catch (error) {
    console.error("[AI Classify] Request failed:", error);
    return contents.map(item => ({
      id: item.id,
      topic: "General",
      confidence: 0,
      keywords: [],
    }));
  }
}