# Phase 1: Channel Analysis

**Status:** In Progress
**Priority:** P0

---

## Overview

Add channel/profile analysis feature - lookup username, show stats and videos.

## Requirements

- [ ] Username input component
- [ ] Profile info display (avatar, bio, followers)
- [ ] Video grid with thumbnails
- [ ] Video stats (views, likes, comments)
- [ ] Loading states and error handling

## Architecture

```
User Input (@username)
       │
       ▼
┌─────────────────┐
│  API Service    │
│  (RapidAPI)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Profile Data   │
│  + Video List   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  UI Components  │
│  Display Data   │
└─────────────────┘
```

## Implementation Steps

1. Create Instagram API service (`src/lib/instagram-api.ts`)
2. Create ProfileCard component
3. Create VideoGrid component
4. Create Channel page/tab
5. Add navigation tabs
6. Test with real usernames

## Files to Create/Modify

```
src/
├── lib/
│   └── instagram-api.ts      # NEW: API service
├── components/
│   └── channel/
│       ├── profile-card.tsx  # NEW: Profile display
│       ├── video-grid.tsx    # NEW: Video grid
│       ├── video-card.tsx    # NEW: Single video card
│       └── username-input.tsx # NEW: Username input
├── hooks/
│   └── use-channel.ts        # NEW: Channel data hook
└── app/
    └── page.tsx              # MODIFY: Add tabs
```

## API Endpoints Needed

```typescript
// Profile info
GET /user/info?username={username}

// User posts/reels
GET /user/posts?username={username}&count=50
```

## Success Criteria

- [ ] Username lookup returns profile data
- [ ] Video grid shows thumbnails + stats
- [ ] Loading skeleton while fetching
- [ ] Error message for invalid/private profiles
