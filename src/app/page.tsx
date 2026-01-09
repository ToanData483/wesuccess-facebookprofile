"use client";

import { useState } from "react";
import {
  Sparkles,
  Zap,
  Shield,
  Image,
  Clock,
} from "lucide-react";
import { Sidebar, Header } from "@/components/layout";
import { UrlInput } from "@/components/download/url-input";
import { VideoResult } from "@/components/download/video-result";
import { ChannelManagerView } from "@/components/channel-manager";
import { TranscriptView } from "@/components/transcript";
import { SettingsView } from "@/components/settings";
import { DashboardView } from "@/components/dashboard";
import { useDownload } from "@/hooks/use-download";

const PAGE_CONFIG: Record<string, { title: string; description: string; breadcrumb: string }> = {
  dashboard: { title: "Dashboard", description: "Your Facebook toolkit overview", breadcrumb: "Dashboard" },
  download: { title: "Download Video", description: "Download videos, reels & IGTV", breadcrumb: "Download" },
  profiles: { title: "Profile Manager", description: "Manage multiple Facebook profiles", breadcrumb: "Channels" },
  transcript: { title: "Transcripts", description: "Convert video audio to text", breadcrumb: "Transcripts" },
  support: { title: "Support", description: "Get help and documentation", breadcrumb: "Support" },
  settings: { title: "Settings", description: "Configure API keys and preferences", breadcrumb: "Settings" },
};

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { loading: downloadLoading, results, download } = useDownload();

  const config = PAGE_CONFIG[activeTab] || PAGE_CONFIG.dashboard;

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="ml-[240px]">
        <Header title={config.title} description={config.description} breadcrumb={[{ label: config.breadcrumb }]} onHomeClick={() => setActiveTab("dashboard")} />
        <div className="p-6">
          {/* Dashboard - Analytics Overview */}
          {activeTab === "dashboard" && (
            <DashboardView onNavigateToProfiles={() => setActiveTab("profiles")} />
          )}

          {/* Download */}
          {activeTab === "download" && (
            <div className="max-w-2xl mx-auto animate-fade-in">
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                <UrlInput onSubmit={download} loading={downloadLoading} />
              </div>
              <VideoResult results={results} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 mt-6">
                <FeatureCard icon={<Zap className="w-4 h-4" />} title="Fast" />
                <FeatureCard icon={<Shield className="w-4 h-4" />} title="Safe" />
                <FeatureCard icon={<Image className="w-4 h-4" />} title="HD" />
                <FeatureCard icon={<Clock className="w-4 h-4" />} title="Clean" />
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="font-medium text-gray-900 mb-4">How to use</h2>
                <ol className="space-y-3">
                  <Step number={1} text="Find the video on Facebook" />
                  <Step number={2} text="Copy the video link" />
                  <Step number={3} text="Paste & click Get Video" />
                  <Step number={4} text="Download in HD quality" />
                </ol>
              </div>
            </div>
          )}

          {/* Profile Manager */}
          {activeTab === "profiles" && <ChannelManagerView onNavigateToSettings={() => setActiveTab("settings")} />}

          {/* Transcript */}
          {activeTab === "transcript" && <TranscriptView />}

          {/* Support */}
          {activeTab === "support" && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="w-16 h-16 bg-pink-50 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-[#E1306C]" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Need Help?</h3>
                <p className="text-gray-500 mb-6">Contact us for support or feature requests.</p>
                <a href="mailto:support@wesuccess.vn" className="inline-flex items-center gap-2 px-6 py-3 bg-[#E1306C] hover:bg-[#C13584] text-white font-medium rounded-xl">
                  Contact Support
                </a>
              </div>
            </div>
          )}

          {/* Settings */}
          {activeTab === "settings" && <SettingsView />}

          <footer className="mt-12 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-400 text-center">Facebook Manager by WeSuccess</p>
          </footer>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 text-center hover:border-gray-300 transition-all">
      <div className="w-8 h-8 mx-auto mb-2 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">{icon}</div>
      <span className="text-xs font-medium text-gray-600">{title}</span>
    </div>
  );
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <li className="flex gap-3 items-center">
      <span className="flex-shrink-0 w-6 h-6 bg-pink-50 text-[#E1306C] rounded-lg flex items-center justify-center text-xs font-medium">{number}</span>
      <span className="text-sm text-gray-600">{text}</span>
    </li>
  );
}
