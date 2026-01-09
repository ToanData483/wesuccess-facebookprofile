"use client";

import { useState } from "react";
import { X, Facebook, Loader2, ChevronDown, Info, Calendar } from "lucide-react";

// Apify resultsLimit options
export const RESULTS_LIMIT_OPTIONS = [10, 20, 30, 50, 100] as const;
export type ResultsLimit = typeof RESULTS_LIMIT_OPTIONS[number];

export interface AddChannelOptions {
  username: string;
  resultsLimit: ResultsLimit;
  onlyPostsNewerThan?: string; // YYYY-MM-DD format
  onlyPostsOlderThan?: string; // YYYY-MM-DD format
}

interface AddChannelDialogProps {
  onClose: () => void;
  onAdd: (username: string, options?: Omit<AddChannelOptions, 'username'>) => void;
}

// Vietnamese translations
const VI = {
  title: "Thêm Trang Facebook",
  infoBanner: {
    title: "Hỗ trợ: Trang & Tài khoản Chuyên nghiệp",
    desc: "Tài khoản cá nhân phải bật Chế độ Chuyên nghiệp để lấy được dữ liệu.",
  },
  pageUrl: {
    label: "Đường dẫn Trang Facebook",
    placeholder: "https://www.facebook.com/tentrang",
    hint: "Dán đường dẫn đầy đủ (VD: https://www.facebook.com/NASA)",
    error: "Vui lòng nhập đường dẫn Trang Facebook hợp lệ",
  },
  examples: "Ví dụ các Trang Facebook:",
  scraperOptions: {
    title: "Tùy chọn thu thập",
    resultsLimit: {
      label: "Giới hạn kết quả",
      hint: "Số lượng tối đa bài viết cho mỗi loại (Videos + Photos)",
      posts: "bài mỗi loại",
    },
    dateFilter: {
      label: "Lọc theo khoảng thời gian",
      hint: "Chỉ lấy bài viết trong khoảng thời gian này",
      newerThan: "Từ ngày",
      olderThan: "Đến ngày",
    },
  },
  buttons: {
    cancel: "Hủy",
    add: "Thêm Trang",
    adding: "Đang thêm...",
  },
};

// Validate Facebook Page URL format
function isValidFacebookPageUrl(url: string): boolean {
  // Accept full URLs or just page names
  if (url.includes("facebook.com/")) {
    // Must be facebook.com/pagename format
    const match = url.match(/facebook\.com\/([^\/\?\s]+)/);
    return !!match && match[1].length > 0;
  }
  // If just page name, accept it (will be converted to URL)
  return url.trim().length > 0;
}

// Get date string in YYYY-MM-DD format
function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Get default dates (last 1 year)
function getDefaultDates() {
  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);

  return {
    newerThan: formatDateForInput(oneYearAgo),
    olderThan: formatDateForInput(today),
  };
}

export function AddChannelDialog({ onClose, onAdd }: AddChannelDialogProps) {
  const [pageUrl, setPageUrl] = useState("");
  const [resultsLimit, setResultsLimit] = useState<ResultsLimit>(20);
  const [useDateFilter, setUseDateFilter] = useState(false);
  const defaultDates = getDefaultDates();
  const [newerThan, setNewerThan] = useState(defaultDates.newerThan);
  const [olderThan, setOlderThan] = useState(defaultDates.olderThan);
  const [loading, setLoading] = useState(false);

  const isValidUrl = isValidFacebookPageUrl(pageUrl);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageUrl.trim() || !isValidUrl) return;

    setLoading(true);
    // Small delay to show loading state
    await new Promise((r) => setTimeout(r, 300));

    const options: Omit<AddChannelOptions, 'username'> = {
      resultsLimit,
      ...(useDateFilter && newerThan ? { onlyPostsNewerThan: newerThan } : {}),
      ...(useDateFilter && olderThan ? { onlyPostsOlderThan: olderThan } : {}),
    };

    onAdd(pageUrl.trim(), options);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <h3 className="font-semibold text-gray-900">{VI.title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="mx-5 mt-5 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-800">
            <p className="font-medium mb-0.5">{VI.infoBanner.title}</p>
            <p className="text-blue-700">{VI.infoBanner.desc}</p>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {VI.pageUrl.label}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Facebook className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                placeholder={VI.pageUrl.placeholder}
                className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 text-gray-900 placeholder-gray-400 ${
                  pageUrl && !isValidUrl
                    ? "border-red-300 focus:ring-red-500/20 focus:border-red-500"
                    : "border-gray-200 focus:ring-blue-500/20 focus:border-[#1877F2]"
                }`}
                autoFocus
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {VI.pageUrl.hint}
            </p>
            {pageUrl && !isValidUrl && (
              <p className="mt-1 text-xs text-red-500">
                {VI.pageUrl.error}
              </p>
            )}
          </div>

          {/* Quick Examples */}
          <div className="mb-5">
            <p className="text-xs text-gray-500 mb-2">{VI.examples}</p>
            <div className="flex flex-wrap gap-2">
              {[
                { name: "NASA", url: "https://www.facebook.com/NASA" },
                { name: "NatGeo", url: "https://www.facebook.com/natgeo" },
                { name: "TEDx", url: "https://www.facebook.com/TED" },
              ].map((page) => (
                <button
                  key={page.name}
                  type="button"
                  onClick={() => setPageUrl(page.url)}
                  className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600"
                >
                  {page.name}
                </button>
              ))}
            </div>
          </div>

          {/* Scraper Options - matching Apify input schema */}
          <div className="mb-5 p-4 bg-gray-50 rounded-xl space-y-4">
            <p className="text-xs font-medium text-gray-700">{VI.scraperOptions.title}</p>

            {/* Results Limit */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">{VI.scraperOptions.resultsLimit.label}</label>
              <div className="relative">
                <select
                  value={resultsLimit}
                  onChange={(e) => setResultsLimit(Number(e.target.value) as ResultsLimit)}
                  className="w-full px-3 py-2 pr-8 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1877F2] appearance-none cursor-pointer"
                >
                  {RESULTS_LIMIT_OPTIONS.map((limit) => (
                    <option key={limit} value={limit}>
                      {limit} {VI.scraperOptions.resultsLimit.posts}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {VI.scraperOptions.resultsLimit.hint}
              </p>
            </div>

            {/* Date Filter Toggle */}
            <div className="pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-xs text-gray-600">{VI.scraperOptions.dateFilter.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setUseDateFilter(!useDateFilter)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    useDateFilter ? "bg-[#1877F2]" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      useDateFilter ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Date Range Inputs */}
            {useDateFilter && (
              <div className="space-y-3 pt-2">
                {/* Warning hint */}
                <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1.5 rounded-lg">
                  {VI.scraperOptions.dateFilter.hint}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">
                      {VI.scraperOptions.dateFilter.newerThan}
                    </label>
                    <input
                      type="date"
                      value={newerThan}
                      onChange={(e) => setNewerThan(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1877F2]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">
                      {VI.scraperOptions.dateFilter.olderThan}
                    </label>
                    <input
                      type="date"
                      value={olderThan}
                      onChange={(e) => setOlderThan(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1877F2]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
            >
              {VI.buttons.cancel}
            </button>
            <button
              type="submit"
              disabled={!pageUrl.trim() || !isValidUrl || loading}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#1877F2] rounded-xl hover:bg-[#166FE5] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {VI.buttons.adding}
                </>
              ) : (
                VI.buttons.add
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
