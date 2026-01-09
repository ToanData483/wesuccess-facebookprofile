/**
 * Channel Analysis Module
 * Provides static analysis for Facebook profiles based on metrics
 */

import { FacebookProfile, FacebookVideo } from './facebook-api';

export interface AIInsight {
  category: string;
  title: string;
  description: string;
  score?: number;
  recommendations?: string[];
}

export interface ChannelAnalysis {
  summary: string;
  insights: AIInsight[];
  contentStrategy: {
    bestPostingTimes: string[];
    topPerformingContent: string[];
    contentMix: { type: string; percentage: number }[];
  };
  growthTips: string[];
  competitorComparison?: string;
}

/**
 * Format number for display
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Static analysis based on profile metrics
 */
function getStaticAnalysis(profile: FacebookProfile, videos: FacebookVideo[]): ChannelAnalysis {
  const avgViews = videos.length > 0
    ? Math.round(videos.reduce((sum, v) => sum + (v.viewCount || 0), 0) / videos.length)
    : 0;

  const avgLikes = videos.length > 0
    ? Math.round(videos.reduce((sum, v) => sum + (v.likeCount || 0), 0) / videos.length)
    : 0;

  const followerCount = profile.followersCount || 0;
  const engagementRate = followerCount > 0
    ? ((avgLikes / followerCount) * 100)
    : 0;

  return {
    summary: `@${profile.username} has ${formatNumber(followerCount)} followers with an engagement rate of ${engagementRate.toFixed(2)}%. The profile averages ${formatNumber(avgViews)} views per video.`,
    insights: [
      {
        category: 'Engagement',
        title: 'Engagement Rate',
        description: `With ${engagementRate.toFixed(2)}% engagement, the profile performs ${engagementRate > 3 ? 'above' : 'at'} industry average.`,
        score: Math.min(100, Math.round(engagementRate * 25)),
        recommendations: [
          'Reply to comments within 1 hour for better engagement',
          'Use interactive stickers in Stories',
          'Post more behind-the-scenes content'
        ]
      },
      {
        category: 'Content',
        title: 'Video Performance',
        description: `Videos average ${formatNumber(avgViews)} views and ${formatNumber(avgLikes)} likes. ${videos.length > 0 ? 'Consistent posting helps maintain audience engagement.' : 'More data needed for detailed analysis.'}`,
        score: 75,
        recommendations: [
          'Keep videos under 60 seconds for better retention',
          'Use trending audio in Reels',
          'Add captions for accessibility'
        ]
      },
      {
        category: 'Growth',
        title: 'Follower Growth Potential',
        description: `With ${formatNumber(followerCount)} followers, there's room for growth through consistent content and collaboration.`,
        score: 70,
        recommendations: [
          'Collaborate with similar-sized creators',
          'Cross-promote on other platforms',
          'Use relevant hashtags (5-10 per post)'
        ]
      },
      {
        category: 'Audience',
        title: 'Audience Quality',
        description: `The follower-to-following ratio of ${(followerCount / Math.max(1, profile.followingCount || 1)).toFixed(1)}:1 suggests ${followerCount > (profile.followingCount || 1) * 2 ? 'authentic audience growth' : 'organic engagement patterns'}.`,
        score: 80,
        recommendations: [
          'Engage with top fans regularly',
          'Create content based on audience feedback',
          'Host Q&A sessions to build community'
        ]
      }
    ],
    contentStrategy: {
      bestPostingTimes: ['Tuesday 11AM', 'Thursday 7PM', 'Saturday 10AM'],
      topPerformingContent: ['Educational content', 'Behind-the-scenes', 'Trending challenges'],
      contentMix: [
        { type: 'Reels', percentage: 60 },
        { type: 'Carousel', percentage: 25 },
        { type: 'Single Image', percentage: 15 }
      ]
    },
    growthTips: [
      'Post Reels consistently (3-5 per week)',
      'Engage with your niche community daily',
      'Analyze top-performing content and create more similar content',
      'Use Facebook Insights to optimize posting times',
      'Collaborate with creators in complementary niches'
    ]
  };
}

/**
 * Analyze profile - returns static analysis based on metrics
 */
export async function analyzeChannel(
  profile: FacebookProfile,
  videos: FacebookVideo[]
): Promise<ChannelAnalysis> {
  return getStaticAnalysis(profile, videos);
}

/**
 * Get content recommendations
 */
export async function getContentRecommendations(
  profile: FacebookProfile,
  videos: FacebookVideo[]
): Promise<string[]> {
  const analysis = await analyzeChannel(profile, videos);
  return analysis.growthTips;
}