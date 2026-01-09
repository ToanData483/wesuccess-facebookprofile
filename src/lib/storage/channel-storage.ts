/**
 * Profile Storage - localStorage operations
 * Following TikTok Downloader pattern
 */

import type {
  ChannelProject,
  ChannelData,
} from "@/lib/types/channel-project";

const PROJECTS_KEY = "ig_channel_projects";
const DATA_PREFIX = "ig_channel_data_";

// Generate unique ID
function generateId(): string {
  return `ch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get all profile projects
export function getChannelProjects(): ChannelProject[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(PROJECTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Get single profile project
export function getChannelProject(id: string): ChannelProject | null {
  const projects = getChannelProjects();
  return projects.find((p) => p.id === id) || null;
}

// Add new profile project
export function addChannelProject(username: string): ChannelProject {
  const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();
  const projects = getChannelProjects();

  // Check if already exists
  const existing = projects.find(
    (p) => p.username.toLowerCase() === cleanUsername
  );
  if (existing) {
    return existing;
  }

  const newProject: ChannelProject = {
    id: generateId(),
    username: cleanUsername,
    addedAt: Date.now(),
    lastSyncAt: null,
    status: "pending",
  };

  projects.push(newProject);
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));

  return newProject;
}

// Update profile project
export function updateChannelProject(
  id: string,
  updates: Partial<ChannelProject>
): ChannelProject | null {
  const projects = getChannelProjects();
  const index = projects.findIndex((p) => p.id === id);

  if (index === -1) return null;

  projects[index] = { ...projects[index], ...updates };
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));

  return projects[index];
}

// Remove profile project
export function removeChannelProject(id: string): boolean {
  const projects = getChannelProjects();
  const filtered = projects.filter((p) => p.id !== id);

  if (filtered.length === projects.length) return false;

  localStorage.setItem(PROJECTS_KEY, JSON.stringify(filtered));
  // Also remove cached data
  localStorage.removeItem(`${DATA_PREFIX}${id}`);

  return true;
}

// Get profile data (cached)
export function getChannelData(projectId: string): ChannelData | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(`${DATA_PREFIX}${projectId}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Save profile data
export function saveChannelData(projectId: string, data: ChannelData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${DATA_PREFIX}${projectId}`, JSON.stringify(data));
}

// Clear profile data (keep project)
export function clearChannelData(projectId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${DATA_PREFIX}${projectId}`);
}

// Clear all data
export function clearAllChannelData(): void {
  if (typeof window === "undefined") return;

  // Clear all profile data keys
  const keys = Object.keys(localStorage).filter((k) =>
    k.startsWith(DATA_PREFIX)
  );
  keys.forEach((k) => localStorage.removeItem(k));

  // Clear projects
  localStorage.removeItem(PROJECTS_KEY);
}

// Get storage stats
export function getStorageStats(): {
  used: number;
  total: number;
  percentage: number;
  channelCount: number;
} {
  if (typeof window === "undefined") {
    return { used: 0, total: 5 * 1024 * 1024, percentage: 0, channelCount: 0 };
  }

  let used = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      used += localStorage.getItem(key)?.length || 0;
    }
  }

  const total = 5 * 1024 * 1024; // 5MB limit
  const projects = getChannelProjects();

  return {
    used,
    total,
    percentage: Math.round((used / total) * 100),
    channelCount: projects.length,
  };
}
