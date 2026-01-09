# Channel Manager Dashboard Upgrade Plan

**Created:** 2024-12-17
**Status:** In Progress
**Project:** wesuccess-instagram

---

## 1. Overview

Upgrade Channel Manager để hiển thị full analytics dashboard theo yêu cầu 12 sections, tích hợp với 3 Apify actors:
- `apify/instagram-profile-scraper` - Profile data
- `apify/instagram-reel-scraper` - Reels/Videos data
- `apify/instagram-post-scraper` - Posts data

---

## 2. Target Architecture

### 2.1 Dashboard Sections (12 Total)

| # | Section | Data Source | Components |
|---|---------|-------------|------------|
| 1 | **Overview** | Profile + Videos | Core capabilities summary |
| 2 | **Tech Stack** | Static | Next.js, TypeScript, Tailwind, Apify |
| 3 | **File Architecture** | Static | Codebase structure visualization |
| 4 | **Data Flow** | Static | Client ↔ API ↔ Apify diagram |
| 5 | **Type System** | Static | TypeScript interfaces reference |
| 6 | **Component Breakdown** | Dynamic | Active components list |
| 7 | **API Endpoints** | Dynamic | 3 endpoints status & stats |
| 8 | **Storage Layer** | localStorage | Keys, usage, functions |
| 9 | **Analytics Calculations** | Videos data | Engagement, benchmark, growth |
| 10 | **UI/UX Design** | Static | Color palette, patterns |
| 11 | **Limitations** | Static | Tech debt, improvements |
| 12 | **Statistics** | Dynamic | File counts, LOC, metrics |

### 2.2 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Browser)                       │
├─────────────────────────────────────────────────────────────┤
│  ChannelManagerView → ChannelDashboard → 12 Sections        │
│         │                    │                               │
│         ▼                    ▼                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              localStorage (channel cache)            │    │
│  └─────────────────────────────────────────────────────┘    │
└────────────────────────────│─────────────────────────────────┘
                             │ API calls
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   NEXT.JS API ROUTES                         │
├─────────────────────────────────────────────────────────────┤
│  /api/apify/profile  →  instagram-profile-scraper           │
│  /api/apify/reels    →  instagram-reel-scraper              │
│  /api/apify/posts    →  instagram-post-scraper              │
│  /api/channels/sync  →  Orchestrate all 3 above             │
│  /api/transcripts    →  AssemblyAI (future)                 │
│  /api/download       →  Video download proxy                │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Phases

### Phase 1: Fix Current Bugs (DONE)
- [x] Fix `next.config.ts` - remove `output: "export"`
- [x] Fix Apify Reel Scraper input: `username` not `usernames`
- [x] Fix empty avatar src warning
- [x] Add debug logging

### Phase 2: API Layer Enhancement
- [ ] Update `/api/apify/profile/route.ts` - add logging
- [ ] Update `/api/apify/reels/route.ts` - verify input schema
- [ ] Create `/api/apify/posts/route.ts` - new endpoint
- [ ] Create `/api/channels/sync/route.ts` - orchestrator

### Phase 3: Type System Update
- [ ] Update `lib/types/channel-project.ts`
  - Add `PostData` interface
  - Enhance `ChannelAnalytics` with more metrics
  - Add `DashboardStats` interface

### Phase 4: Dashboard Components
- [ ] Create `channel-dashboard-view.tsx` - Main dashboard container
- [ ] Create 12 section components:
  1. `overview-section.tsx`
  2. `tech-stack-section.tsx`
  3. `architecture-section.tsx`
  4. `dataflow-section.tsx`
  5. `type-system-section.tsx`
  6. `components-section.tsx`
  7. `api-endpoints-section.tsx`
  8. `storage-section.tsx`
  9. `analytics-section.tsx`
  10. `design-section.tsx`
  11. `limitations-section.tsx`
  12. `statistics-section.tsx`

### Phase 5: Integration & Polish
- [ ] Connect all sections to real data
- [ ] Add loading states
- [ ] Add error boundaries
- [ ] Export functionality (JSON)
- [ ] Print-friendly styles

---

## 4. Apify Actors Reference

### 4.1 Instagram Profile Scraper
**Actor ID:** `apify/instagram-profile-scraper`

**Input:**
```json
{
  "usernames": ["username1", "username2"],
  "resultsLimit": 1
}
```

**Output:**
```json
{
  "id": "string",
  "username": "string",
  "fullName": "string",
  "biography": "string",
  "profilePicUrl": "string",
  "profilePicUrlHD": "string",
  "followersCount": 0,
  "followingCount": 0,
  "postsCount": 0,
  "isVerified": false,
  "isPrivate": false,
  "externalUrl": "string"
}
```

### 4.2 Instagram Reel Scraper
**Actor ID:** `apify/instagram-reel-scraper`

**Input:**
```json
{
  "username": ["username"],     // Array of usernames
  "directUrls": ["url"],        // OR direct reel URLs
  "resultsLimit": 30
}
```

**Output:**
```json
{
  "id": "string",
  "shortCode": "string",
  "caption": "string",
  "commentsCount": 0,
  "likesCount": 0,
  "viewsCount": 0,
  "playsCount": 0,
  "duration": 0,
  "timestamp": "ISO string",
  "ownerUsername": "string",
  "videoUrl": "string",
  "thumbnailUrl": "string",
  "hashtags": [],
  "mentions": []
}
```

### 4.3 Instagram Post Scraper
**Actor ID:** `apify/instagram-post-scraper`

**Input:**
```json
{
  "username": ["username"],
  "resultsLimit": 30
}
```

---

## 5. File Changes Summary

### New Files
```
src/
├── app/api/
│   ├── apify/posts/route.ts          # New
│   └── channels/sync/route.ts        # New
├── components/channel-manager/
│   ├── channel-dashboard-view.tsx    # New - Main dashboard
│   └── sections/                     # New folder
│       ├── overview-section.tsx
│       ├── analytics-section.tsx
│       ├── storage-section.tsx
│       └── statistics-section.tsx
└── lib/types/
    └── dashboard-types.ts            # New
```

### Modified Files
```
src/
├── lib/types/channel-project.ts      # Add new types
├── lib/storage/channel-storage.ts    # Add stats functions
├── components/channel-manager/
│   ├── channel-manager-view.tsx      # Add dashboard route
│   └── channel-analytics-panel.tsx   # Enhance metrics
└── app/api/apify/
    ├── profile/route.ts              # Add logging
    └── reels/route.ts                # Already fixed
```

---

## 6. Statistics Target

| Metric | Current | Target |
|--------|---------|--------|
| Files | 22 | ~35 |
| LOC | ~1,800 | ~2,700 |
| Components | 5 | 17 |
| API Routes | 2 | 5 |
| Type Definitions | 12 | 20 |

---

## 7. Priority Order

1. **HIGH:** Fix API routes (done) → Test with real data
2. **HIGH:** Create sync orchestrator endpoint
3. **MEDIUM:** Add Posts scraper integration
4. **MEDIUM:** Build dashboard sections
5. **LOW:** Static documentation sections
6. **LOW:** Export functionality

---

## 8. Next Steps

1. Test current API fix with real Apify token
2. Create `/api/channels/sync` orchestrator
3. Build `channel-dashboard-view.tsx` with sections
4. Connect real data to analytics calculations
