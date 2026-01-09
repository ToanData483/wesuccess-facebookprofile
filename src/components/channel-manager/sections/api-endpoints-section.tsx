"use client";

import { useState } from "react";
import { Server, CheckCircle, XCircle, Clock, Copy, Check } from "lucide-react";

interface ApiEndpointsSectionProps {
  projectId: string;
}

export function ApiEndpointsSection({ projectId }: ApiEndpointsSectionProps) {
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  const endpoints = [
    {
      method: "POST",
      path: "/api/apify/profile",
      description: "Fetch Facebook profile data",
      actor: "apify/facebook-profile-scraper",
      input: `{ "username": "string", "token": "string" }`,
      output: "FacebookProfile[]",
      status: "active",
    },
    {
      method: "POST",
      path: "/api/apify/posts",
      description: "Smart Combine: Fetch ALL content (posts + videos), filter client-side",
      actor: "apify/facebook-posts-scraper",
      input: `{ "username": "string", "limit": 30, "token": "string" }`,
      output: "Array<FacebookPost | FacebookVideo> (use isVideo flag to filter)",
      status: "active",
    },
    {
      method: "POST",
      path: "/api/profiles/sync",
      description: "Sync all profile data",
      actor: "Orchestrator",
      input: `{ "projectId": "string", "username": "string" }`,
      output: "ChannelData",
      status: "planned",
    },
    {
      method: "POST",
      path: "/api/transcripts/batch",
      description: "Batch transcript extraction",
      actor: "AssemblyAI",
      input: `{ "videoUrls": "string[]" }`,
      output: "TranscriptResult[]",
      status: "planned",
    },
  ];

  const methodColors: Record<string, string> = {
    GET: "bg-green-100 text-green-700",
    POST: "bg-blue-100 text-blue-700",
    PUT: "bg-yellow-100 text-yellow-700",
    DELETE: "bg-red-100 text-red-700",
  };

  const statusColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    active: { bg: "bg-green-50", text: "text-green-600", icon: <CheckCircle className="w-4 h-4" /> },
    planned: { bg: "bg-yellow-50", text: "text-yellow-600", icon: <Clock className="w-4 h-4" /> },
    error: { bg: "bg-red-50", text: "text-red-600", icon: <XCircle className="w-4 h-4" /> },
  };

  const copyToClipboard = (text: string, endpoint: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(endpoint);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">7. API Endpoints</h3>
        <p className="text-sm text-gray-500">3 endpoints: sync, transcripts, download</p>
      </div>

      {/* Endpoints Grid */}
      <div className="space-y-4">
        {endpoints.map((endpoint) => (
          <div
            key={endpoint.path}
            className={`bg-white rounded-xl border border-gray-200 p-5 ${endpoint.status !== 'active' ? 'opacity-75' : ''}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded text-xs font-bold ${methodColors[endpoint.method]}`}>
                  {endpoint.method}
                </span>
                <code className="text-sm font-mono text-gray-900">{endpoint.path}</code>
                <button
                  onClick={() => copyToClipboard(endpoint.path, endpoint.path)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  {copiedEndpoint === endpoint.path ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${statusColors[endpoint.status].bg} ${statusColors[endpoint.status].text}`}>
                {statusColors[endpoint.status].icon}
                <span className="capitalize">{endpoint.status}</span>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 mb-4">{endpoint.description}</p>

            {/* Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-1">Actor / Service</p>
                <p className="font-mono text-xs text-purple-600">{endpoint.actor}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-1">Returns</p>
                <p className="font-mono text-xs text-blue-600">{endpoint.output}</p>
              </div>
            </div>

            {/* Input Schema */}
            <div className="mt-4 p-3 bg-gray-900 rounded-lg">
              <p className="text-xs font-medium text-gray-400 mb-2">Input Schema</p>
              <code className="text-xs text-green-400 font-mono">{endpoint.input}</code>
            </div>
          </div>
        ))}
      </div>

      {/* API Usage Example */}
      <div className="bg-gray-900 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Server className="w-5 h-5 text-gray-400" />
          <h4 className="font-medium text-white">Usage Example</h4>
        </div>
        <pre className="text-sm text-gray-300 overflow-x-auto">
          <code>{`// Fetch profile data
const response = await fetch("/api/apify/profile", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "facebook_user",
    token: "your_apify_token"
  })
});

const profile = await response.json();
console.log(profile[0].followersCount);`}</code>
        </pre>
      </div>
    </div>
  );
}
