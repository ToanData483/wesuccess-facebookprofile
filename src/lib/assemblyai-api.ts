/**
 * AssemblyAI API Service
 * Handles video/audio transcription
 */

import { getApiKey } from "./config-store";

const ASSEMBLYAI_BASE_URL = "https://api.assemblyai.com/v2";

// Get API key from unified config store
export function getAssemblyAIKey(): string {
  if (typeof window !== "undefined") {
    return getApiKey("assemblyai") || process.env.NEXT_PUBLIC_ASSEMBLYAI_KEY || "";
  }
  return process.env.NEXT_PUBLIC_ASSEMBLYAI_KEY || "";
}

export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface TranscriptResult {
  id: string;
  status: "queued" | "processing" | "completed" | "error";
  text: string;
  words: TranscriptWord[];
  language_code: string;
  audio_duration: number;
  error?: string;
}

export interface SRTEntry {
  index: number;
  start: string;
  end: string;
  text: string;
}

/**
 * Upload audio/video file to AssemblyAI
 */
export async function uploadFile(file: File): Promise<string> {
  const apiKey = getAssemblyAIKey();
  if (!apiKey) {
    throw new Error("AssemblyAI API key not configured");
  }

  const response = await fetch(`${ASSEMBLYAI_BASE_URL}/upload`, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "Content-Type": "application/octet-stream",
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  const data = await response.json();
  return data.upload_url;
}

/**
 * Start transcription from URL
 */
export async function startTranscription(
  audioUrl: string,
  options?: {
    language_code?: string;
    speaker_labels?: boolean;
    auto_highlights?: boolean;
    sentiment_analysis?: boolean;
  }
): Promise<string> {
  const apiKey = getAssemblyAIKey();
  if (!apiKey) {
    throw new Error("AssemblyAI API key not configured");
  }

  const response = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript`, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      language_code: options?.language_code || "vi", // Default Vietnamese
      speaker_labels: options?.speaker_labels ?? false,
      auto_highlights: options?.auto_highlights ?? false,
      sentiment_analysis: options?.sentiment_analysis ?? false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Transcription start failed: ${error}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * Get transcription status/result
 */
export async function getTranscription(
  transcriptId: string
): Promise<TranscriptResult> {
  const apiKey = getAssemblyAIKey();
  if (!apiKey) {
    throw new Error("AssemblyAI API key not configured");
  }

  const response = await fetch(
    `${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`,
    {
      headers: { authorization: apiKey },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get transcription: ${response.status}`);
  }

  return response.json();
}

/**
 * Transcribe audio URL and wait for result
 */
export async function transcribeUrl(
  audioUrl: string,
  options?: {
    language_code?: string;
    onProgress?: (status: string) => void;
  }
): Promise<TranscriptResult> {
  const transcriptId = await startTranscription(audioUrl, {
    language_code: options?.language_code,
  });

  // Poll for completion (max 5 minutes)
  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    const result = await getTranscription(transcriptId);

    if (options?.onProgress) {
      options.onProgress(result.status);
    }

    if (result.status === "completed") {
      return result;
    }

    if (result.status === "error") {
      throw new Error(result.error || "Transcription failed");
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
    attempts++;
  }

  throw new Error("Transcription timeout");
}

/**
 * Convert milliseconds to SRT timestamp format (HH:MM:SS,mmm)
 */
function msToSrtTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")},${milliseconds
    .toString()
    .padStart(3, "0")}`;
}

/**
 * Generate SRT entries from transcript
 */
export function generateSRTEntries(
  words: TranscriptWord[],
  maxWordsPerLine: number = 8,
  maxDurationMs: number = 4000
): SRTEntry[] {
  const entries: SRTEntry[] = [];
  let currentEntry: TranscriptWord[] = [];
  let entryStart = 0;

  for (const word of words) {
    if (currentEntry.length === 0) {
      entryStart = word.start;
    }

    currentEntry.push(word);

    const duration = word.end - entryStart;
    const shouldBreak =
      currentEntry.length >= maxWordsPerLine || duration >= maxDurationMs;

    if (shouldBreak) {
      entries.push({
        index: entries.length + 1,
        start: msToSrtTime(entryStart),
        end: msToSrtTime(word.end),
        text: currentEntry.map((w) => w.text).join(" "),
      });
      currentEntry = [];
    }
  }

  // Add remaining words
  if (currentEntry.length > 0) {
    const lastWord = currentEntry[currentEntry.length - 1];
    entries.push({
      index: entries.length + 1,
      start: msToSrtTime(entryStart),
      end: msToSrtTime(lastWord.end),
      text: currentEntry.map((w) => w.text).join(" "),
    });
  }

  return entries;
}

/**
 * Convert SRT entries to SRT file content
 */
export function entriesToSRT(entries: SRTEntry[]): string {
  return entries
    .map(
      (entry) =>
        `${entry.index}\n${entry.start} --> ${entry.end}\n${entry.text}\n`
    )
    .join("\n");
}

/**
 * Convert SRT entries to VTT file content
 */
export function entriesToVTT(entries: SRTEntry[]): string {
  const vttEntries = entries.map((entry) => {
    // Convert SRT time format to VTT (comma to dot)
    const start = entry.start.replace(",", ".");
    const end = entry.end.replace(",", ".");
    return `${start} --> ${end}\n${entry.text}`;
  });

  return `WEBVTT\n\n${vttEntries.join("\n\n")}`;
}

/**
 * Format transcript with timestamps for display
 */
export function formatTranscriptWithTimestamps(
  words: TranscriptWord[]
): { time: string; text: string }[] {
  const entries = generateSRTEntries(words, 10, 5000);

  return entries.map((entry) => ({
    time: entry.start.replace(",", ".").substring(0, 8),
    text: entry.text,
  }));
}
