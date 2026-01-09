'use client';

import {
  Download,
  Settings,
  Home,
  Facebook,
  HelpCircle,
  FileText,
  Users,
} from 'lucide-react';

const menuItems = [
  { id: 'dashboard', icon: Home, label: 'Dashboard' },
  { id: 'download', icon: Download, label: 'Download Video' },
  { id: 'profiles', icon: Users, label: 'Profile Manager' },
  { id: 'transcript', icon: FileText, label: 'Transcripts' },
];

const bottomItems = [
  { id: 'support', icon: HelpCircle, label: 'Support' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 h-screen w-[240px] bg-white border-r border-gray-200 flex flex-col z-50">
      <div className="h-16 flex items-center px-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 gradient-facebook rounded-xl flex items-center justify-center">
            <Facebook className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-gray-900 tracking-tight">
            Facebook Manager
          </span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                isActive
                  ? 'bg-blue-50 text-[#1877F2]'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } cursor-pointer`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium text-sm flex-1 text-left">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mx-4 border-t border-gray-100" />

      <div className="p-3 space-y-1">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                isActive ? 'bg-blue-50 text-[#1877F2]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium text-sm text-left">{item.label}</span>
            </button>
          );
        })}
      </div>

    </aside>
  );
}
