# CLAUDE.md

## Project Overview

**Name:** WeSuccess Facebook Analytics
**Type:** Web App (Static)
**Purpose:** Facebook video downloader + channel analytics with AI insights

## Tech Stack

- Next.js 16 (App Router, Static Export)
- React 19
- TypeScript 5
- Tailwind CSS 4
- Cloudflare Pages / Vercel (hosting)
- cobalt.tools API (video extraction)
- RapidAPI Facebook Scraper (profile/video data)
- Gemini 1.5 Flash (AI analytics)

## Features

1. **Download Tab** - Single/batch video download via URL
2. **Channel Tab** - Profile analysis, video grid, engagement metrics
3. **Analytics Tab** - AI-powered insights, content strategy, growth tips
4. **Reports Tab** - Export CSV/JSON reports

## Key Files

```
src/
├── app/page.tsx              # Main page with tabs
├── lib/
│   ├── api.ts                # Cobalt API (video download)
│   ├── facebook-api.ts      # RapidAPI (profile/videos)
│   ├── gemini-api.ts         # Gemini AI (analytics)
│   └── report-generator.ts   # CSV/JSON export
├── hooks/
│   ├── use-download.ts       # Download logic
│   ├── use-channel.ts        # Channel data
│   └── use-analysis.ts       # AI analysis
└── components/
    ├── download/             # Download UI
    ├── channel/              # Channel analysis UI
    ├── analytics/            # AI insights UI
    └── reports/              # Export UI
```

## Commands

```bash
npm run dev      # Development server
npm run build    # Production build (static)
npm run start    # Preview production
```

## Environment Variables (Optional)

```env
NEXT_PUBLIC_RAPIDAPI_KEY=xxx     # For real Facebook data
NEXT_PUBLIC_GEMINI_API_KEY=xxx   # For real AI analysis
```

Without API keys, app uses demo data for development.

## Architecture

```
User → Next.js Static Site
         ├── Cobalt API → Facebook CDN (video download)
         ├── RapidAPI → Facebook (profile/video data)
         └── Gemini API → AI analysis
```

- All processing in browser (client-side)
- No backend needed
- Rate limiting in localStorage
- Demo data fallback when no API keys

## Deployment

Deploy to Cloudflare Pages or Vercel:
- Build: `npm run build`
- Output: `out/`

## Cost

**$0/month** using free tiers:
- Cloudflare Pages: Free
- Cobalt API: Free
- RapidAPI: Free tier (500 req/month)
- Gemini API: Free tier (1500 req/day)
