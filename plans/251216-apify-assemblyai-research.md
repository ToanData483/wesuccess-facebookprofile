# Research Report: Apify + Assembly AI + Dashboard Visualization

**Date:** 2025-12-16
**Project:** INSTA.TOOLS (wesuccess-instagram)

---

## 1. Apify Instagram Libraries/Actors

### 1.1 Available Actors

| Actor | URL | Key Features | Pricing |
|-------|-----|--------------|---------|
| **Instagram Scraper** | [apify/instagram-scraper](https://apify.com/apify/instagram-scraper) | All-in-one: posts, profiles, hashtags, places, comments | Pay-per-result |
| **Instagram Profile Scraper** | [apify/instagram-profile-scraper](https://apify.com/apify/instagram-profile-scraper) | Followers, following, bio, posts, highlight reels | $2.60/1K results (Free), $2.30/1K (Starter) |
| **Instagram Post Scraper** | [apify/instagram-post-scraper](https://apify.com/apify/instagram-post-scraper) | Captions, likes, comments, tagged users, locations | Pay-per-result |
| **Instagram Reel Scraper** | [apify/instagram-reel-scraper](https://apify.com/apify/instagram-reel-scraper) | **Transcript**, video URL, views, shares, likes, duration | Pay-per-result |
| **Instagram Hashtag Scraper** | [apify/instagram-hashtag-scraper](https://apify.com/apify/instagram-hashtag-scraper) | Posts/reels by hashtag, engagement metrics | Pay-per-result |
| **Instagram Search Scraper** | [apify/instagram-search-scraper](https://apify.com/apify/instagram-search-scraper) | Discovery, find hashtags, profiles | Pay-per-result |
| **Instagram API Scraper** | [apify/instagram-api-scraper](https://apify.com/apify/instagram-api-scraper) | Unofficial API access (no limits) | Pay-per-result |

### 1.2 Key Features cho INSTA.TOOLS

**Instagram Reel Scraper** (RECOMMENDED cho transcript):
- ✅ Extract transcript từ reels
- ✅ Video URL (direct download)
- ✅ Caption, hashtags, mentions
- ✅ Views, likes, shares, comments
- ✅ Duration, thumbnail
- ✅ Tagged users

**Instagram Profile Scraper** (cho Channel Analytics):
- ✅ Followers/following count
- ✅ Bio, profile picture
- ✅ Post count
- ✅ Related profiles
- ✅ Highlight reels

### 1.3 API Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     INSTA.TOOLS Frontend                     │
├─────────────────────────────────────────────────────────────┤
│  Download Tab  │  Analytics Tab  │  AI Tools Tab  │ Settings │
└───────┬────────┴────────┬────────┴───────┬───────┴────┬─────┘
        │                 │                │            │
        ▼                 ▼                ▼            ▼
┌───────────────────────────────────────────────────────────┐
│                    Next.js API Routes                      │
│  /api/download  │ /api/analytics │ /api/transcript │ /api/config │
└───────┬─────────┴───────┬────────┴────────┬────────┴──────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ Apify Reel    │ │ Apify Profile │ │ AssemblyAI    │
│ Scraper       │ │ Scraper       │ │ Transcription │
└───────────────┘ └───────────────┘ └───────────────┘
```

---

## 2. Assembly AI API

### 2.1 Pricing

| Service | Price | Notes |
|---------|-------|-------|
| **Pre-recorded Speech-to-Text** | $0.15/hr | Universal model, 99 languages |
| **Streaming Speech-to-Text** | $0.15/hr | Real-time |
| **Slam-1 (Beta)** | $0.27/hr | LLM-powered, English only |
| **Entity Detection** | +$0.08/hr | Add-on |
| **Sentiment Analysis** | +$0.02/hr | Add-on |
| **Translation** | +$0.06/hr | Add-on |
| **PII Redaction** | +$0.08/hr | Add-on |

**Free Tier:** $50 credit (~185 hours transcription)

### 2.2 Vietnamese Support

- ✅ **Supported** trong Universal model
- Accuracy: "Good" (10-25% WER)
- Language code: `vi`

### 2.3 Workflow cho Video Transcript

```
1. User paste Instagram Reel URL
2. Call Apify Reel Scraper → get video URL
3. Download video → extract audio
4. Send audio to AssemblyAI → get transcript
5. Display transcript with timestamps
6. Optional: Translate transcript (Gemini API)
```

---

## 3. Dashboard Visualization Libraries

### 3.1 Recommended: Tremor + Recharts

| Library | GitHub Stars | Best For |
|---------|-------------|----------|
| **Tremor** | 35+ components | Production dashboards, Tailwind-based |
| **Recharts** | 24.8K | Simple charts, React-native API |
| **Nivo** | - | Beautiful pre-styled charts |
| **Visx** (Airbnb) | - | Full D3 control, complex viz |

**Tremor** được recommend vì:
- Built on Tailwind CSS (match với project)
- 35+ ready-to-use components
- Built on Recharts internally
- Accessible by default
- Dark/Light theme support

### 3.2 Key Chart Types cho Instagram Analytics

| Metric | Chart Type | Library Component |
|--------|------------|-------------------|
| Engagement over time | Area Chart | `<AreaChart>` |
| Post performance | Bar Chart | `<BarChart>` |
| Content distribution | Donut Chart | `<DonutChart>` |
| Followers growth | Line Chart | `<LineChart>` |
| Hashtag analysis | TreeMap | `<TreemapChart>` |
| Best posting times | Heatmap | Custom |

---

## 4. Feature Mapping vào UI Hiện Tại

### 4.1 Current UI Structure

```
Sidebar:
├── Dashboard (active)
├── Download (active)
├── Analytics (active)
├── Trending (Soon)
├── Hashtags (Soon)
├── AI Tools (Pro)
├── Support
└── Settings
```

### 4.2 Proposed Feature Mapping

#### A. Download Tab (Enhanced)

**Current:** Single URL download
**Enhanced:**
- [x] Single video download
- [ ] **Batch download** (từ profile)
- [ ] **Transcript extraction** (Apify Reel Scraper)
- [ ] **Auto-translate transcript** (Gemini API)
- [ ] Download with SRT subtitles

**UI Changes:**
```
┌─────────────────────────────────────────┐
│ Download Mode: [Single] [Batch]         │
├─────────────────────────────────────────┤
│ 🔗 Paste URL...                         │
│ ┌─────────────────────────────────────┐ │
│ │ Video Preview                       │ │
│ │ ┌─────────────────┐                 │ │
│ │ │ [Thumbnail]     │  Title...       │ │
│ │ │                 │  @username      │ │
│ │ └─────────────────┘  👁 12K  ❤️ 5K   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ☑️ Extract Transcript                   │
│ ☑️ Auto-translate (Vietnamese)          │
│                                         │
│ [Download Video] [Download SRT]         │
└─────────────────────────────────────────┘
```

#### B. Analytics Tab (Dashboard Visualization)

**Current:** Basic profile card + video grid
**Enhanced:**
- [ ] **Engagement Chart** (Area)
- [ ] **Post Performance** (Bar)
- [ ] **Content Mix** (Donut)
- [ ] **Growth Trend** (Line)
- [ ] **Best Posting Times** (Heatmap)
- [ ] **Hashtag Analysis** (TreeMap)

**UI Changes:**
```
┌──────────────────────────────────────────────────────┐
│ @username Analytics                                   │
├───────────────┬──────────────────────────────────────┤
│ Profile Card  │  ┌─────────────────────────────────┐ │
│ ┌──────────┐  │  │ Engagement Rate (30 days)       │ │
│ │ [Avatar] │  │  │ ▂▃▅▇█▆▄▃▅▇                      │ │
│ │ 1.2M     │  │  └─────────────────────────────────┘ │
│ │followers │  │  ┌──────────┐ ┌──────────┐          │
│ └──────────┘  │  │ Avg Views│ │ Avg Likes│          │
│               │  │ 45.2K    │ │ 8.7K     │          │
│               │  └──────────┘ └──────────┘          │
├───────────────┴──────────────────────────────────────┤
│ Content Performance                                   │
│ ┌─────────────────────┐ ┌─────────────────────┐      │
│ │ Content Mix         │ │ Best Posting Times  │      │
│ │ [Donut: Reels 70%]  │ │ [Heatmap]           │      │
│ │ [Posts 20%]         │ │ Mon Tue Wed...      │      │
│ │ [Stories 10%]       │ │ █▇▅▃▂▃▅▇█           │      │
│ └─────────────────────┘ └─────────────────────┘      │
└──────────────────────────────────────────────────────┘
```

#### C. AI Tools Tab (Unlock với API Keys)

**Current:** Pro badge (disabled)
**Enhanced:**
- [ ] **Video Transcript** (AssemblyAI)
- [ ] **Content Analysis** (Gemini)
- [ ] **Caption Generator** (Gemini)
- [ ] **Hashtag Suggestions** (Apify + AI)
- [ ] **Competitor Analysis**

**UI Changes:**
```
┌─────────────────────────────────────────┐
│ AI Tools                                 │
├─────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│ │ 🎙️      │ │ ✨       │ │ #️⃣      │     │
│ │Transcript│ │Caption  │ │Hashtags │     │
│ │Generator│ │Generator│ │Research │     │
│ └─────────┘ └─────────┘ └─────────┘     │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Transcript Generator                │ │
│ │ 🔗 Paste reel URL...                │ │
│ │                                     │ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │ [00:00] Hello everyone...       │ │ │
│ │ │ [00:05] Today I want to share...│ │ │
│ │ │ [00:12] First tip is...         │ │ │
│ │ └─────────────────────────────────┘ │ │
│ │                                     │ │
│ │ [Copy] [Download SRT] [Translate]   │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

#### D. Trending Tab (New Feature)

**API:** Apify Instagram Search + Hashtag Scraper

**Features:**
- [ ] Trending hashtags in niche
- [ ] Viral reels discovery
- [ ] Trending audio/sounds
- [ ] Content inspiration

#### E. Settings Tab (API Configuration)

**Current:** Gemini + Apify keys
**Enhanced:**
- [ ] **Apify API Token** (required)
- [ ] **AssemblyAI API Key** (optional)
- [ ] **Gemini API Key** (optional)
- [ ] **Default language** setting
- [ ] **Auto-translate** toggle

---

## 5. Implementation Phases

### Phase 1: Core Enhancement (Priority)
1. Integrate Apify Reel Scraper for transcript
2. Add transcript display UI
3. Improve error handling

### Phase 2: Analytics Dashboard
1. Install Tremor/Recharts
2. Create chart components
3. Fetch real engagement data
4. Implement dashboard visualizations

### Phase 3: AI Tools
1. AssemblyAI integration (better transcript)
2. Gemini translation
3. Caption generator

### Phase 4: Trending & Discovery
1. Hashtag research tool
2. Viral content discovery
3. Audio/sound trends

---

## 6. Cost Estimation

| Service | Monthly Usage | Cost |
|---------|--------------|------|
| Apify Profile Scraper | 10K results | ~$23-26 |
| Apify Reel Scraper | 5K results | ~$13 |
| AssemblyAI | 20 hours | $3 |
| Gemini API | 100K tokens | ~$0.50 |
| **Total** | | **~$40-45/month** |

---

## 7. Sources

- [Apify Instagram Scraper](https://apify.com/apify/instagram-scraper)
- [Apify Instagram Reel Scraper](https://apify.com/apify/instagram-reel-scraper)
- [Apify Instagram Profile Scraper](https://apify.com/apify/instagram-profile-scraper)
- [Apify Instagram Hashtag Scraper](https://apify.com/apify/instagram-hashtag-scraper)
- [AssemblyAI Pricing](https://www.assemblyai.com/pricing)
- [AssemblyAI Supported Languages](https://www.assemblyai.com/docs/pre-recorded-audio/supported-languages)
- [Tremor UI](https://www.tremor.so/)
- [Recharts](https://recharts.org/)
- [Best React Chart Libraries 2025](https://embeddable.com/blog/react-chart-libraries)
