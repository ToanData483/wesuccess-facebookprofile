# Research Report: Apify Instagram Scrapers & Alternatives

**Date:** 2024-12-16
**Focus:** Top Apify actors, pricing, comparison with RapidAPI & JS libraries

---

## Executive Summary

Apify là platform mạnh nhất cho Instagram scraping với nhiều actors chuyên biệt. Free tier $5/month đủ cho 2,000+ posts. RapidAPI có free tier nhỏ hơn nhưng đủ cho testing. JS libraries (instagram-web-api, instatouch) hầu hết đã broken sau Instagram API changes Dec 2024.

**Recommendation:** Apify cho production, RapidAPI free tier cho MVP/testing.

---

## Top 5 Apify Instagram Actors

### 1. apify/instagram-scraper (General Purpose)

| Aspect | Details |
|--------|---------|
| **Features** | Profiles, posts, comments, hashtags, locations |
| **Output** | JSON, CSV, Excel |
| **Best For** | All-around scraping needs |
| **Pricing** | ~$0.50/1K posts |

```javascript
// Usage with Apify SDK
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: 'YOUR_TOKEN' });
const run = await client.actor('apify/instagram-scraper').call({
  directUrls: ['https://www.instagram.com/natgeo/'],
  resultsType: 'posts',
  resultsLimit: 100
});
```

### 2. apify/instagram-profile-scraper

| Aspect | Details |
|--------|---------|
| **Features** | No login required, bio, metrics, latest 12 posts |
| **Output** | JSON, CSV, Excel |
| **Best For** | Profile analysis, lead gen |
| **Pricing** | ~$0.40/1K profiles |

### 3. apify/instagram-post-scraper

| Aspect | Details |
|--------|---------|
| **Features** | Post metadata, captions, hashtags, comments |
| **Output** | JSON, CSV, Excel, XML |
| **Best For** | Content analysis, engagement tracking |
| **Pricing** | ~$0.50/1K posts |

### 4. apify/instagram-reel-scraper

| Aspect | Details |
|--------|---------|
| **Features** | Reel metadata, music, engagement, transcript |
| **Output** | JSON, CSV, Excel |
| **Best For** | Reels analytics, trend tracking |
| **Pricing** | ~$0.70/1K reels |

### 5. apify/instagram-story-scraper

| Aspect | Details |
|--------|---------|
| **Features** | Story media, interactive elements, text extraction |
| **Output** | JSON, CSV, Excel |
| **Best For** | Story archiving, competitor monitoring |
| **Pricing** | ~$0.60/1K stories |

---

## Apify Pricing Tiers

| Plan | Monthly Cost | Credits | Best For |
|------|-------------|---------|----------|
| **Free** | $0 | $5 | Testing, small projects |
| **Starter** | $39 | $39 | Individual developers |
| **Scale** | $199 | $199 | Growing businesses |
| **Business** | $999 | $999 | Large scale operations |

**Free tier capacity:** ~2,100 comments OR ~10,000 profiles OR ~10,000 posts

---

## Comparison: Apify vs RapidAPI vs JS Libraries

| Feature | Apify | RapidAPI | JS Libraries |
|---------|-------|----------|--------------|
| **Free Tier** | $5/month | 30-500 req/month | Free (self-hosted) |
| **Reliability** | 99%+ | Varies (70-95%) | Low (<50%) |
| **Maintenance** | Managed | Managed | Self-maintained |
| **Rate Limits** | Handled | API-dependent | Manual handling |
| **Data Types** | All public data | Varies by API | Limited/broken |
| **Setup** | Easy | Easy | Complex |

### JS Libraries Status (Dec 2024)

| Library | Status | Notes |
|---------|--------|-------|
| `instagram-web-api` | **BROKEN** | Deprecated API |
| `instatouch` | **BROKEN** | No longer maintained |
| `instagram-private-api` | **UNSTABLE** | 403 errors, frequent bans |
| `instaloader` (Python) | **PARTIAL** | Works with limitations |

---

## Apify Alternatives

### Enterprise-Grade
- **Bright Data** - High volume, dedicated endpoints
- **Oxylabs** - Premium proxies, large scale
- **Zyte API** - Custom scrapers, ban evasion

### No-Code Tools
- **PhantomBuster** - Ready-made scripts, marketer-friendly
- **Octoparse** - Point-and-click UI
- **ParseHub** - Visual scraper

### Budget Options
- **ThorData** - Cost-effective API
- **ScrapeUp** - Simple, lightweight
- **Lobstr.io** - Cheap scrapers

---

## Implementation for WeSuccess Instagram

### Recommended Architecture

```
┌─────────────────────────────────────────────┐
│         User Settings (localStorage)         │
├─────────────────────────────────────────────┤
│  Apify Token:  [________________]           │
│  Gemini Key:   [________________]           │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│           API Service Layer                  │
├─────────────────────────────────────────────┤
│  1. Check user's Apify token                │
│  2. If exists → Use Apify actors            │
│  3. If not → Show demo data                 │
└─────────────────────────────────────────────┘
```

### Apify Integration Code

```typescript
// lib/apify-api.ts
import { ApifyClient } from 'apify-client';

export async function getProfileWithApify(
  username: string,
  token: string
): Promise<ProfileData> {
  const client = new ApifyClient({ token });

  const run = await client.actor('apify/instagram-profile-scraper').call({
    usernames: [username]
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return transformApifyProfile(items[0]);
}

export async function getPostsWithApify(
  username: string,
  token: string,
  limit: number = 50
): Promise<Post[]> {
  const client = new ApifyClient({ token });

  const run = await client.actor('apify/instagram-post-scraper').call({
    username,
    resultsLimit: limit
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items.map(transformApifyPost);
}
```

---

## Cost Estimation

| Usage Level | Monthly Posts | Apify Cost | RapidAPI Cost |
|-------------|---------------|------------|---------------|
| **Hobby** | 1,000 | Free ($5 credit) | Free tier |
| **Small** | 10,000 | ~$5 | ~$10-20 |
| **Medium** | 50,000 | ~$25 | ~$50-100 |
| **Large** | 200,000 | ~$100 | ~$200-400 |

---

## Recommendations

### For WeSuccess Instagram App

1. **Primary:** Apify (reliable, good free tier)
2. **Fallback:** Demo data (when no API key)
3. **Optional:** RapidAPI backup

### User Flow

```
User opens app
    │
    ▼
Has Apify token? ─── No ──→ Show demo data
    │                        + prompt to add key
    Yes
    │
    ▼
Fetch real data via Apify
    │
    ▼
Analyze with Gemini
```

---

## Unresolved Questions

1. Apify actors có update kịp khi Instagram thay đổi API không?
2. Free tier $5 có đủ cho typical user monthly usage không?
3. Cần implement caching để reduce API calls?

---

## Sources

- Apify documentation & pricing pages
- RapidAPI Instagram API marketplace
- GitHub issues for instagram-private-api, instaloader
- Instagram Developer Platform announcements (Dec 2024)
