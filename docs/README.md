# WeSuccess Instagram Downloader

Free Instagram video/reel downloader web app.

## Features

- Single video download (paste URL)
- Multi-URL support (max 5)
- Rate limiting (5/hour, 20/day per IP)
- No login required
- Mobile responsive
- EN/VI ready (i18n structure in place)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Icons | Lucide React |
| Hosting | Cloudflare Pages (free) |
| Video Extract | cobalt.tools API (free) |

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Main page
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── components/
│   ├── ui/               # Reusable UI components
│   │   ├── button.tsx
│   │   └── input.tsx
│   └── download/         # Download-specific components
│       ├── url-input.tsx
│       ├── video-result.tsx
│       └── rate-limit-badge.tsx
├── hooks/
│   └── use-download.ts   # Download logic hook
└── lib/
    ├── utils.ts          # Utilities
    └── api.ts            # Cobalt API integration
```

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run start
```

## Deployment

### Cloudflare Pages

1. Push to GitHub
2. Connect repo to Cloudflare Pages
3. Build settings:
   - Build command: `npm run build`
   - Output directory: `out`
4. Deploy

## Rate Limits

| Limit | Value |
|-------|-------|
| Per hour | 5 downloads |
| Per day | 20 downloads |
| Max URLs per request | 5 |

Limits stored in localStorage, reset automatically.

## API Integration

Uses [cobalt.tools](https://cobalt.tools) public API:
- Free, no API key needed
- Returns direct video URLs
- Zero bandwidth cost (direct download from Instagram CDN)

## Cost

**$0/month** - All services use free tiers.
