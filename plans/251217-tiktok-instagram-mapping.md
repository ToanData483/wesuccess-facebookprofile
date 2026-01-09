# TikTok → Instagram Architecture Mapping

## Executive Summary

Both projects share **identical architecture patterns**. Instagram project already adopted TikTok patterns. Key opportunities: port advanced components from TikTok to enhance Instagram.

---

## Current State Comparison

### Structure Mapping

| TikTok Project | Instagram Project | Status |
|----------------|-------------------|--------|
| `src/app/projects/page.tsx` | `src/components/channel-manager/channel-manager-view.tsx` | ✅ Implemented |
| `src/app/projects/[id]/page.tsx` | `src/components/channel-manager/channel-dashboard-view.tsx` | ✅ Just created |
| `src/components/projects/channel-card.tsx` | `src/components/channel-manager/channel-card.tsx` | ✅ Exists |
| `src/components/projects/add-channel-dialog.tsx` | `src/components/channel-manager/add-channel-dialog.tsx` | ✅ Exists |
| `src/components/dashboard/metrics-cards.tsx` | `src/components/channel-manager/channel-analytics-panel.tsx` | ⚠️ Basic version |
| `src/components/dashboard/engagement-chart.tsx` | `src/components/charts/engagement-chart.tsx` | ✅ Exists |
| `src/components/dashboard/video-table.tsx` | `src/components/channel-manager/sections/content-section.tsx` | ✅ Just created |
| `src/components/dashboard/date-range-filter.tsx` | ❌ Missing | 🔴 Need to port |
| `src/components/channel/batch-download-bar.tsx` | ❌ Missing | 🔴 Need to port |
| `src/components/channel/deep-analytics.tsx` | `src/components/channel-manager/sections/analytics-section.tsx` | ✅ Just created |
| `src/lib/types/channel-project.ts` | `src/lib/types/channel-project.ts` | ✅ Identical |
| `src/lib/storage/channel-storage.ts` | `src/lib/storage/channel-storage.ts` | ✅ Exists |
| `src/lib/sources/channel-scraper.ts` | `src/lib/instagram-api.ts` | ✅ Adapted for IG |

---

## Components to Port from TikTok

### Priority 1: Date Range Filter
**Source:** `D:\Projects\tiktok-downloader\src\components\dashboard\date-range-filter.tsx`

```typescript
type DateRange = '7d' | '30d' | '90d' | '6m' | '1y' | 'all';

// Enables temporal filtering across all dashboard components
// Critical for analytics accuracy
```

**Target:** `src/components/channel-manager/sections/date-range-filter.tsx`

### Priority 2: Batch Download Bar
**Source:** `D:\Projects\tiktok-downloader\src\components\channel\batch-download-bar.tsx`

Features to port:
- Multi-select video checkboxes
- "Download Selected" button
- "Extract Transcripts" button
- Progress indicator
- Rate limiting (2s between downloads)

**Target:** `src/components/channel-manager/batch-action-bar.tsx`

### Priority 3: Enhanced Video Table
**Source:** `D:\Projects\tiktok-downloader\src\components\dashboard\video-table.tsx`

Missing features in Instagram version:
- Text search/filter (caption + hashtags)
- Multi-column sorting
- Transcript modal with segments
- SRT export
- Batch selection

### Priority 4: Deep Analytics
**Source:** `D:\Projects\tiktok-downloader\src\components\channel\deep-analytics.tsx`

Features:
- Weekly posting pattern heatmap
- Duration analysis chart
- Growth trend indicators
- Benchmark comparison

---

## Apify Actor Mapping

### TikTok Actors
```
clockworks~free-tiktok-scraper
├── Input: { profiles: [username], resultsPerPage: 30 }
├── Output: VideoData[] with full metrics
└── Rate: ~50 videos/run

sociavault~transcript-scraper
├── Input: { videoUrl }
├── Output: { text, segments[] }
└── Rate: 1 video/run
```

### Instagram Actors (Current)
```
apify/instagram-profile-scraper
├── Input: { usernames: [username] }
├── Output: Profile data
└── Rate: 1 profile/run

apify/instagram-reel-scraper
├── Input: { username, resultsLimit: 30 }
├── Output: Reel[] with metrics
└── Rate: ~30 reels/run
```

### Missing Instagram Actors
```
❌ apify/instagram-post-scraper     → For non-reel posts
❌ assemblyai/whisper               → For transcription
❌ apify/instagram-story-scraper    → For stories (ephemeral)
❌ apify/instagram-hashtag-scraper  → For hashtag research
```

---

## Data Type Alignment

### Already Aligned ✅
```typescript
// Both use identical structure
ChannelProject { id, username, status, lastSyncAt... }
ChannelData { projectId, profile, videos, analytics, fetchedAt }
VideoData { id, url, metrics, hashtags, transcript... }
ChannelAnalytics { engagementRate, avgViews, topHashtags... }
```

### Instagram-Specific Extensions Needed
```typescript
// Instagram has additional content types
interface InstagramPost {
  type: 'reel' | 'image' | 'carousel' | 'story';
  images?: string[];  // For carousels
  expiresAt?: number; // For stories
}

// Instagram has different metrics
interface InstagramMetrics extends VideoMetrics {
  reach?: number;      // Unique accounts reached
  impressions?: number; // Total views including repeat
  saves: number;       // Bookmarks
  shares: number;      // Story shares + DMs
}
```

---

## Implementation Roadmap

### Phase 1: Port Missing Components (Day 1)
1. Copy `date-range-filter.tsx` → adapt for Instagram
2. Copy `batch-download-bar.tsx` → rename to batch-action-bar
3. Integrate date filter into dashboard-view
4. Add batch selection to content-section

### Phase 2: Enhanced Analytics (Day 2)
1. Port `deep-analytics.tsx` patterns
2. Add weekly heatmap chart
3. Add duration analysis
4. Add growth trend visualization

### Phase 3: Transcript Integration (Day 3)
1. Add AssemblyAI API integration
2. Create transcript modal component
3. Add SRT export functionality
4. Batch transcript extraction

### Phase 4: Additional Scrapers (Day 4+)
1. Add Instagram post scraper (non-reels)
2. Add hashtag research scraper
3. Add carousel support
4. Consider stories support

---

## Code Reuse Strategy

### Direct Copy (minimal changes)
- `date-range-filter.tsx` - UI agnostic
- `utils.ts` (formatNumber, formatDuration)
- Storage patterns (localStorage)
- Type definitions

### Adapt (modify for Instagram)
- `batch-download-bar.tsx` → Instagram download URLs
- `video-table.tsx` → Instagram post types
- API routes → Apify actor IDs

### Rebuild (Instagram-specific)
- Story viewer (ephemeral content)
- Carousel gallery
- Hashtag analytics deep dive

---

## Unresolved Questions

1. **Story support?** - Ephemeral content (24h) requires different handling
2. **Carousel images?** - Need image gallery component for multi-image posts
3. **Reach vs Views?** - Instagram shows "reach" for business accounts, "views" for reels
4. **API rate limits?** - Instagram scraping more restricted than TikTok
5. **Private accounts?** - TikTok mostly public, Instagram has more private accounts

---

## Next Steps

1. **Immediate:** Test current dashboard with real Apify data
2. **Short-term:** Port date-range-filter and batch-action-bar
3. **Medium-term:** Add transcript extraction with AssemblyAI
4. **Long-term:** Add post scraper for non-reel content

---

## File References

### TikTok Source Files
```
D:\Projects\tiktok-downloader\
├── src/app/projects/page.tsx
├── src/app/projects/[id]/page.tsx
├── src/components/dashboard/
│   ├── date-range-filter.tsx    ← PORT THIS
│   ├── engagement-chart.tsx
│   ├── metrics-cards.tsx
│   └── video-table.tsx          ← PORT FEATURES
├── src/components/channel/
│   ├── batch-download-bar.tsx   ← PORT THIS
│   └── deep-analytics.tsx       ← PORT PATTERNS
└── src/lib/
    ├── types/channel-project.ts
    └── storage/channel-storage.ts
```

### Instagram Target Files
```
D:\Tools MMO\wesuccess-instagram\
├── src/components/channel-manager/
│   ├── channel-manager-view.tsx     ✅
│   ├── channel-dashboard-view.tsx   ✅
│   ├── channel-card.tsx             ✅
│   ├── add-channel-dialog.tsx       ✅
│   ├── channel-analytics-panel.tsx  ✅
│   ├── sections/
│   │   ├── overview-section.tsx     ✅
│   │   ├── content-section.tsx      ✅
│   │   ├── analytics-section.tsx    ✅
│   │   ├── hashtags-section.tsx     ✅
│   │   ├── api-endpoints-section.tsx ✅
│   │   ├── storage-section.tsx      ✅
│   │   └── statistics-section.tsx   ✅
│   ├── batch-action-bar.tsx         ❌ TO CREATE
│   └── date-range-filter.tsx        ❌ TO CREATE
└── src/lib/
    ├── types/channel-project.ts     ✅
    ├── storage/channel-storage.ts   ✅
    └── instagram-api.ts             ✅
```
