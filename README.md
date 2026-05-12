# EVA — Executive Virtual Assistant

Voice-first AI executive assistant for Chef Claus. Built on Next.js, Claude API, Supabase.

## Quick Start

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd eva-app
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env.local
```
Fill in:
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `NEXT_PUBLIC_SUPABASE_URL` — from your Supabase project
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase
- `CRON_SECRET` — any random string (for scheduled jobs)

### 3. Supabase Setup
Run the SQL from `lib/supabase.ts` (the SCHEMA_SQL export) in your Supabase SQL editor to create the tables.

### 4. Run Locally
```bash
npm run dev
```
Open http://localhost:3000

### 5. Deploy to Vercel
Connect this GitHub repo to Vercel. Add environment variables in Vercel dashboard. Deploy.

### 6. Add to Phone
Open the deployed URL on your phone → Share → Add to Home Screen. EVA is now an app icon.

## Architecture

```
Phone (PWA)  ←→  Vercel (Next.js)  ←→  Claude API (Sonnet)
                      ↕                       ↕
                  Supabase              MCP Servers
              (memory, logs)     (Gmail, Calendar, Shopify, QB)
                                        ↕
                                    Web Search
```

## Cron Schedule (UTC → PT)
- 6:00 AM PT: Morning brief
- Every 2 hours: Anomaly monitoring  
- 8:30 PM PT: Evening review

## Voice
- Input: Web Speech API (browser native)
- Output: Browser TTS with Australian voice preference
- Upgrade path: ElevenLabs for custom Australian voice
