"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  ExternalLink,
  Key,
  Globe,
  Palette,
} from "lucide-react";
import { getConfig, saveConfig, type AppConfig } from "@/lib/config-store";

export function SettingsView() {
  const [config, setConfig] = useState<AppConfig>(getConfig());
  const [showTokens, setShowTokens] = useState({
    apify: false,
    assemblyai: false,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setConfig(getConfig());
  }, []);

  const handleSave = () => {
    saveConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateConfig = (key: keyof AppConfig, value: string | boolean) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-2xl animate-fade-in space-y-6">
      {/* API Configuration */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Key className="w-5 h-5 text-[#1877F2]" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-gray-900">API Configuration</h2>
            <p className="text-sm text-gray-500">Configure API keys for enhanced features</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Apify Token */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Apify API Token
              </label>
              <a
                href="https://console.apify.com/account/integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#1877F2] hover:underline flex items-center gap-1"
              >
                Get token <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <Input
                type={showTokens.apify ? "text" : "password"}
                placeholder="apify_api_..."
                value={config.apifyToken}
                onChange={(e) => updateConfig("apifyToken", e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() =>
                  setShowTokens((prev) => ({ ...prev, apify: !prev.apify }))
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showTokens.apify ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Required for Facebook data scraping and transcript extraction
            </p>
          </div>

          {/* AssemblyAI Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                AssemblyAI API Key
              </label>
              <a
                href="https://www.assemblyai.com/dashboard/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#1877F2] hover:underline flex items-center gap-1"
              >
                Get key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <Input
                type={showTokens.assemblyai ? "text" : "password"}
                placeholder="Enter AssemblyAI API key"
                value={config.assemblyaiKey}
                onChange={(e) => updateConfig("assemblyaiKey", e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() =>
                  setShowTokens((prev) => ({ ...prev, assemblyai: !prev.assemblyai }))
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showTokens.assemblyai ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Optional - For AI-powered audio transcription (Vietnamese supported)
            </p>
          </div>

        </div>
      </div>

      {/* Language & Preferences */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-gray-900">Preferences</h2>
            <p className="text-sm text-gray-500">Language and display settings</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Default Language */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Transcription Language
            </label>
            <select
              value={config.defaultLanguage}
              onChange={(e) => updateConfig("defaultLanguage", e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2] transition-all"
            >
              <option value="auto">🔍 Auto-detect (Recommended)</option>
              <option value="vi">Vietnamese (Tiếng Việt)</option>
              <option value="en">English</option>
              <option value="ja">Japanese (日本語)</option>
              <option value="ko">Korean (한국어)</option>
              <option value="zh">Chinese (中文)</option>
              <option value="th">Thai (ไทย)</option>
              <option value="id">Indonesian (Bahasa Indonesia)</option>
              <option value="es">Spanish (Español)</option>
              <option value="fr">French (Français)</option>
              <option value="de">German (Deutsch)</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Auto-detect lets AssemblyAI identify the language automatically
            </p>
          </div>

          {/* Auto Translate Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Auto-translate</p>
              <p className="text-xs text-gray-400">
                Automatically translate transcripts using AssemblyAI
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.autoTranslate}
                onChange={(e) => updateConfig("autoTranslate", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1877F2]"></div>
            </label>
          </div>

          {/* Translation Target Language - shown when auto-translate is on */}
          {config.autoTranslate && (
            <div className="ml-0 pl-4 border-l-2 border-blue-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Translate To
              </label>
              <select
                value={config.translateTargetLang || "vi"}
                onChange={(e) => updateConfig("translateTargetLang", e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2] transition-all"
              >
                <option value="vi">🇻🇳 Vietnamese (Tiếng Việt)</option>
                <option value="en">🇺🇸 English</option>
                <option value="ja">🇯🇵 Japanese (日本語)</option>
                <option value="ko">🇰🇷 Korean (한국어)</option>
                <option value="zh">🇨🇳 Chinese (中文)</option>
                <option value="th">🇹🇭 Thai (ไทย)</option>
                <option value="id">🇮🇩 Indonesian</option>
                <option value="es">🇪🇸 Spanish (Español)</option>
                <option value="fr">🇫🇷 French (Français)</option>
                <option value="de">🇩🇪 German (Deutsch)</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Transcripts will be translated to this language via AssemblyAI
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <Button onClick={handleSave} className="w-full">
        {saved ? (
          <>
            <CheckCircle className="w-4 h-4 mr-2" />
            Saved!
          </>
        ) : (
          <>
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </>
        )}
      </Button>

      {/* API Status */}
      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
          API Status
        </p>
        <div className="grid grid-cols-2 gap-3">
          <StatusBadge
            label="Apify"
            configured={!!config.apifyToken}
          />
          <StatusBadge
            label="AssemblyAI"
            configured={!!config.assemblyaiKey}
            optional
          />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  label,
  configured,
  optional,
}: {
  label: string;
  configured: boolean;
  optional?: boolean;
}) {
  return (
    <div
      className={`text-center p-3 rounded-lg ${
        configured
          ? "bg-green-50 border border-green-100"
          : optional
          ? "bg-yellow-50 border border-yellow-100"
          : "bg-red-50 border border-red-100"
      }`}
    >
      <p className="text-xs font-medium text-gray-700">{label}</p>
      <p
        className={`text-[10px] mt-0.5 ${
          configured
            ? "text-green-600"
            : optional
            ? "text-yellow-600"
            : "text-red-600"
        }`}
      >
        {configured ? "Ready" : optional ? "Optional" : "Required"}
      </p>
    </div>
  );
}
