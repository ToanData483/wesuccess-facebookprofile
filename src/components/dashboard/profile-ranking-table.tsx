"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Trophy, Medal, Award } from "lucide-react";
import type { AggregatedProfile } from "./dashboard-view";

interface ProfileRankingTableProps {
  profiles: AggregatedProfile[];
}

type SortField = "interactions" | "posts";
type SortDirection = "asc" | "desc";

// Format number with K/M suffix
function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

// Rank badge component
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center w-10 h-8 bg-yellow-100 text-yellow-700 rounded-lg font-semibold text-sm">
        <Trophy className="w-4 h-4 mr-0.5" />
        1st
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center w-10 h-8 bg-gray-100 text-gray-600 rounded-lg font-medium text-sm">
        2nd
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center w-10 h-8 bg-orange-100 text-orange-700 rounded-lg font-medium text-sm">
        3rd
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-10 h-8 text-gray-500 font-medium text-sm">
      {rank}
    </span>
  );
}

export function ProfileRankingTable({ profiles }: ProfileRankingTableProps) {
  const [sortField, setSortField] = useState<SortField>("interactions");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Sort profiles
  const sortedProfiles = [...profiles].sort((a, b) => {
    const multiplier = sortDirection === "desc" ? -1 : 1;
    if (sortField === "interactions") {
      return (a.interactions - b.interactions) * multiplier;
    }
    return (a.posts - b.posts) * multiplier;
  });

  // Handle sort click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Sort icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronDown className="w-4 h-4 text-gray-300" />;
    }
    return sortDirection === "desc"
      ? <ChevronDown className="w-4 h-4 text-[#1877F2]" />
      : <ChevronUp className="w-4 h-4 text-[#1877F2]" />;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900">📊 Profile Ranking</h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                #Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contributor
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                <button
                  onClick={() => handleSort("posts")}
                  className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors"
                >
                  📝 Posts
                  <SortIcon field="posts" />
                </button>
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                <button
                  onClick={() => handleSort("interactions")}
                  className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors"
                >
                  💬 Interactions
                  <SortIcon field="interactions" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedProfiles.map((profile, index) => {
              const rank = index + 1;
              const isTopThree = rank <= 3;

              return (
                <tr
                  key={profile.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    isTopThree ? "bg-gradient-to-r from-transparent" : ""
                  } ${rank === 1 ? "to-yellow-50/30" : rank === 2 ? "to-gray-50/50" : rank === 3 ? "to-orange-50/30" : ""}`}
                >
                  {/* Rank */}
                  <td className="px-6 py-4">
                    <RankBadge rank={rank} />
                  </td>

                  {/* Contributor (Avatar + Name) */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="relative">
                        {profile.avatar ? (
                          <img
                            src={profile.avatar}
                            alt={profile.nickname}
                            className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.nickname)}&background=1877F2&color=fff`;
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#1877F2] flex items-center justify-center text-white font-medium">
                            {profile.nickname.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {/* Top 3 badge overlay */}
                        {rank === 1 && (
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white">
                            <Trophy className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Name */}
                      <div>
                        <p className="font-medium text-gray-900">{profile.nickname}</p>
                        <p className="text-xs text-gray-500">@{profile.username}</p>
                      </div>
                    </div>
                  </td>

                  {/* Posts */}
                  <td className="px-6 py-4 text-center">
                    <span className="font-medium text-gray-900">
                      {profile.posts.toLocaleString()}
                    </span>
                  </td>

                  {/* Interactions */}
                  <td className="px-6 py-4 text-center">
                    <span className="font-semibold text-[#1877F2]">
                      {formatNumber(profile.interactions)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          💡 Interactions = Likes + Comments + Shares
        </p>
      </div>
    </div>
  );
}
