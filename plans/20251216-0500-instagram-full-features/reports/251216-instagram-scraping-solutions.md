# Research Report: Instagram Scraping Solutions

**Date:** 2024-12-16
**Project:** WeSuccess Instagram Analytics

## Executive Summary

Nghiên cứu các giải pháp scraping Instagram để thay thế/bổ sung cho RapidAPI hiện tại. So sánh 3 loại giải pháp: **Apify** (platform), **RapidAPI** (APIs), và **Open Source** (instaloader). Kết luận: Apify là lựa chọn tốt nhất cho production với pay-per-result pricing và reliability cao.

## Comparison Matrix

| Solution | Cost | Rate Limits | Reliability | Setup | Best For |
|----------|------|-------------|-------------|-------|----------|
| **Apify** | $0.40-2.70/1K results | Managed | 99.9% | Easy | Production, Scale |
| **RapidAPI** | Free tier + $0.01/req | 500/month free | Varies | Easy | MVP, Testing |
| **Instaloader** | Free | ~200 req/hour | Moderate | Complex | Development, Research |

## 1. Apify Instagram Scraper

### Overview
Apify là nền tảng scraping lớn nhất, cung cấp nhiều Instagram actors khác nhau.

### Key Features
- Profile scraping: ID, username, bio, followers, following, posts
- Post scraping: captions, images, videos, likes, comments, views
- Hashtag & Location scraping
- Comment scraping
- **No login required** cho public profiles
- Anti-scraping resistance với proxy management

### Pricing (Pay-per-result)
| Type | Cost |
|------|------|
| Posts/Comments | $2.30-2.70/1K |
| Profile (keyword) | $0.02/query + $0.0005/profile |
| Profile (direct) | $0.01/profile |
| Unlimited plan | $19/month |
| **Free tier** | $5/month credit (~2K results) |

### Pros
- Reliable (99.9% success rate)
- No technical setup needed
- Proxy management included
- Multiple output formats (JSON, CSV, Excel)
- API + client libraries (Node.js, Python)

### Cons
- Cost accumulates quickly for heavy usage
- Complex billing (runtime + storage + proxy)
- Reel scraping có hạn chế

### Integration Code (Next.js)
```typescript
// lib/apify-api.ts
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

export async function scrapeInstagramProfile(username: string) {
  const run = await client.actor('apify/instagram-scraper').call({
    directUrls: [`https://www.instagram.com/${username}/`],
    resultsType: 'posts',
    resultsLimit: 30,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items;
}
```

---

## 2. RapidAPI Instagram APIs

### Available APIs

| API | Provider | Features | Free Tier |
|-----|----------|----------|-----------|
| [Instagram Scraper API](https://rapidapi.com/social-api1-instagram/api/instagram-scraper-api2/pricing) | social-api1 | Real-time, 4M+ IPs | Yes |
| [Instagram API Fast](https://rapidapi.com/mediacrawlers-mediacrawlers-default/api/instagram-api-fast-reliable-data-scraper) | mediacrawlers | 99.9% uptime | Yes |
| [Instagram 2024](https://rapidapi.com/tamtamchan/api/instagram-2024-new/pricing) | tamtamchan | Fast endpoints | Yes |

### Current Implementation (RapidAPI Instagram Scraper)
```typescript
// Đã implement trong src/lib/instagram-api.ts
const RAPIDAPI_HOST = "instagram-scraper-api2.p.rapidapi.com";

// Endpoints:
// GET /user/info?username={username}
// GET /user/posts?username={username}&count=50
```

### Pros
- Nhiều lựa chọn APIs
- Free tier đủ cho MVP
- Easy integration với fetch
- Không cần proxy setup

### Cons
- Reliability varies by provider
- Rate limits có thể thay đổi
- Một số API không maintained

---

## 3. Open Source: Instaloader

### Overview
Python command-line tool và library để download Instagram content.

**GitHub:** [instaloader/instaloader](https://github.com/instaloader/instaloader)

### Features
- Download posts, videos, Stories, Highlights, Reels
- Export captions, timestamps, geotags
- Resume interrupted downloads
- Private profile access (nếu following)

### Rate Limits
- ~200 requests/hour (Instagram enforced)
- 429 Too Many Requests nếu exceed
- Recommend 3-10s delay between requests

### Limitations
- Cần Python backend
- Rate limiting aggressive
- Account có thể bị ban nếu abuse
- Không phù hợp cho client-side web app

### Usage
```bash
# Install
pip install instaloader

# Download profile
instaloader --login your_username profile_to_download

# Python API
from instaloader import Instaloader, Profile
L = Instaloader()
profile = Profile.from_username(L.context, "natgeo")
print(profile.followers)
```

### Pros
- Free và open source
- Full control over scraping
- Detailed metadata

### Cons
- Rate limits nghiêm ngặt
- Cần backend (không client-side)
- Account risk nếu login
- Maintenance burden

---

## 4. Recommendation cho WeSuccess Instagram

### Current State
- Đang dùng RapidAPI với free tier
- Demo data fallback khi no API key

### Recommended Upgrade Path

**Phase 1: Keep RapidAPI (Current)**
- Free tier đủ cho MVP
- Demo data cho development
- Cost: $0

**Phase 2: Add Apify (Optional)**
- Khi cần scale hoặc reliability cao hơn
- Pay-per-result phù hợp usage pattern
- Cost: ~$5-20/month

**Phase 3: Hybrid Approach**
```typescript
// lib/instagram-api.ts
export async function getProfileData(username: string) {
  // Try RapidAPI first (free tier)
  try {
    return await rapidApiGetProfile(username);
  } catch (error) {
    // Fallback to Apify
    if (process.env.APIFY_API_TOKEN) {
      return await apifyGetProfile(username);
    }
    // Final fallback to demo data
    return getDemoProfile(username);
  }
}
```

### Integration Priority

| Priority | Solution | When to Use |
|----------|----------|-------------|
| 1 | RapidAPI | Default, free tier |
| 2 | Apify | Fallback, high-traffic |
| 3 | Demo Data | Development, no API key |

---

## Implementation Notes

### Environment Variables
```env
# RapidAPI (current)
NEXT_PUBLIC_RAPIDAPI_KEY=xxx

# Apify (optional upgrade)
APIFY_API_TOKEN=xxx

# Gemini (AI analysis)
NEXT_PUBLIC_GEMINI_API_KEY=xxx
```

### Package Installation
```bash
# For Apify integration
npm install apify-client
```

### Key Considerations
1. **No login approach** - Chỉ scrape public data
2. **Client-side friendly** - RapidAPI và Apify đều support
3. **Cost control** - Monitor usage, set alerts
4. **Fallback strategy** - Always have demo data

---

## Resources

### Official Documentation
- [Apify Instagram Scraper](https://apify.com/apidojo/instagram-scraper)
- [RapidAPI Instagram APIs](https://rapidapi.com/search/instagram)
- [Instaloader Docs](https://instaloader.github.io/)

### Tutorials
- [Ultimate Instagram Scraper Guide 2025](https://www.coronium.io/blog/instagram-scraper-guide)
- [How to Scrape Instagram - Matthew Clarkson](https://matthewclarkson.com.au/blog/how-to-scrape-instagram-ultimate-guide/)

### Community
- [Instaloader GitHub Issues](https://github.com/instaloader/instaloader/issues)
- [Apify Discord](https://discord.com/invite/jyEM2PRvMU)

---

## Unresolved Questions

1. Apify có bị ảnh hưởng bởi Instagram API changes không?
2. RapidAPI provider nào stable nhất trong long-term?
3. Có cần implement caching layer để reduce API calls?
