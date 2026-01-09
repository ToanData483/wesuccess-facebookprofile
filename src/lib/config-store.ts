/**
 * Configuration Store
 * Manages API keys and app settings in localStorage
 */

export interface AppConfig {
  apifyToken: string;
  assemblyaiKey: string;
  defaultLanguage: string; // Source language: "auto" | "vi" | "en" | etc.
  autoTranslate: boolean;
  translateTargetLang: string; // Target language for translation: "vi" | "en" | etc.
  theme: "light" | "dark";
}

const CONFIG_KEY = "fb_tools_config";

const defaultConfig: AppConfig = {
  apifyToken: "",
  assemblyaiKey: "",
  defaultLanguage: "auto",
  autoTranslate: true,
  translateTargetLang: "vi",
  theme: "light",
};

/**
 * Get full config
 */
export function getConfig(): AppConfig {
  if (typeof window === "undefined") return defaultConfig;

  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (!stored) return defaultConfig;
    return { ...defaultConfig, ...JSON.parse(stored) };
  } catch {
    return defaultConfig;
  }
}

/**
 * Save full config
 */
export function saveConfig(config: Partial<AppConfig>): void {
  if (typeof window === "undefined") return;

  const current = getConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));

  // Dispatch event for reactive updates
  window.dispatchEvent(new CustomEvent("config-changed", { detail: updated }));
}

/**
 * Get specific config value
 */
export function getConfigValue<K extends keyof AppConfig>(key: K): AppConfig[K] {
  return getConfig()[key];
}

/**
 * Set specific config value
 */
export function setConfigValue<K extends keyof AppConfig>(
  key: K,
  value: AppConfig[K]
): void {
  saveConfig({ [key]: value });
}

/**
 * Check if API is configured
 */
export function isApiConfigured(api: "apify" | "assemblyai"): boolean {
  const config = getConfig();
  switch (api) {
    case "apify":
      return !!config.apifyToken;
    case "assemblyai":
      return !!config.assemblyaiKey;
    default:
      return false;
  }
}

/**
 * Get API token/key
 */
export function getApiKey(api: "apify" | "assemblyai"): string {
  const config = getConfig();
  switch (api) {
    case "apify":
      return config.apifyToken;
    case "assemblyai":
      return config.assemblyaiKey;
    default:
      return "";
  }
}

/**
 * Clear all config
 */
export function clearConfig(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CONFIG_KEY);
  window.dispatchEvent(new CustomEvent("config-changed", { detail: defaultConfig }));
}

/**
 * React hook for config (use in components)
 */
export function useConfigListener(
  callback: (config: AppConfig) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<AppConfig>;
    callback(customEvent.detail);
  };

  window.addEventListener("config-changed", handler);
  return () => window.removeEventListener("config-changed", handler);
}
