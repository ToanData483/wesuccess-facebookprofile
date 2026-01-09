"use client";

import { useState, useEffect } from "react";
import { Database, HardDrive, Key, Trash2 } from "lucide-react";
import { getStorageStats, clearChannelData } from "@/lib/storage/channel-storage";

interface StorageSectionProps {
  projectId: string;
  onClear?: () => void;
}

export function StorageSection({ projectId, onClear }: StorageSectionProps) {
  const [stats, setStats] = useState({ used: 0, total: 5242880, percentage: 0, channelCount: 0 });

  useEffect(() => {
    setStats(getStorageStats());
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const storageKeys = [
    { key: "ig_channel_projects", desc: "Profile list & metadata", type: "Array<ChannelProject>" },
    { key: `ig_channel_data_${projectId.slice(0, 8)}...`, desc: "Cached profile data", type: "ChannelData" },
    { key: "fb_tools_config", desc: "API keys & settings", type: "AppConfig" },
  ];

  const storageFunctions = [
    { name: "getChannelProjects()", returns: "ChannelProject[]", desc: "Get all profiles" },
    { name: "addChannelProject(username)", returns: "ChannelProject", desc: "Add new profile" },
    { name: "updateChannelProject(id, updates)", returns: "ChannelProject | null", desc: "Update profile" },
    { name: "removeChannelProject(id)", returns: "boolean", desc: "Remove profile" },
    { name: "getChannelData(projectId)", returns: "ChannelData | null", desc: "Get cached data" },
    { name: "saveChannelData(projectId, data)", returns: "void", desc: "Cache profile data" },
    { name: "getStorageStats()", returns: "StorageStats", desc: "Get usage stats" },
  ];

  const handleClearCache = () => {
    if (confirm("Clear cached data for this profile? You will need to sync again.")) {
      clearChannelData(projectId);
      setStats(getStorageStats());
      onClear?.();
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">8. Storage Layer</h3>
        <p className="text-sm text-gray-500">localStorage keys & functions</p>
      </div>

      {/* Storage Usage */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-gray-400" />
            <h4 className="font-medium text-gray-900">Storage Usage</h4>
          </div>
          <button
            onClick={handleClearCache}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Cache
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">{formatBytes(stats.used)} used</span>
            <span className="text-gray-400">{formatBytes(stats.total)} total</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${stats.percentage > 80 ? 'bg-red-500' : stats.percentage > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(stats.percentage, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {stats.percentage}% used • {stats.channelCount} profiles stored
          </p>
        </div>

        {/* Warning */}
        {stats.percentage > 70 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
            Storage is getting full. Consider clearing old profile data.
          </div>
        )}
      </div>

      {/* localStorage Keys */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-gray-400" />
          <h4 className="font-medium text-gray-900">localStorage Keys</h4>
        </div>
        <div className="space-y-3">
          {storageKeys.map(({ key, desc, type }) => (
            <div key={key} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <code className="text-sm font-mono text-blue-600">{key}</code>
                <p className="text-xs text-gray-500 mt-1">{desc}</p>
              </div>
              <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Storage Functions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-gray-400" />
          <h4 className="font-medium text-gray-900">Storage Functions</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 font-medium text-gray-500">Function</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500">Returns</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {storageFunctions.map(({ name, returns, desc }) => (
                <tr key={name} className="hover:bg-gray-50">
                  <td className="py-2 px-3 font-mono text-xs text-purple-600">{name}</td>
                  <td className="py-2 px-3 font-mono text-xs text-gray-500">{returns}</td>
                  <td className="py-2 px-3 text-xs text-gray-600">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Limitations */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <h5 className="font-medium text-amber-800 mb-2">Limitations</h5>
        <ul className="text-sm text-amber-700 space-y-1">
          <li>• localStorage ~5MB limit per origin</li>
          <li>• Each profile data ~50-200KB depending on video count</li>
          <li>• Practical limit: ~25-50 profiles</li>
        </ul>
      </div>
    </div>
  );
}
