# Swelter

An autonomous AI agent that monitors hyperlocal heat risk and maintains OSHA compliance records for small construction and landscaping contractors. Built solo for FortyGuard's Hackathon'26.

## Problem

Small contractors manage heat safety manually by checking weather apps, creating inconsistency, lack of documentation, and liability exposure. Existing tools are either informational-only, paperwork-only, or enterprise-priced hardware platforms.

## Solution

Swelter is a hardware-free agent that:
1. Polls the FortyGuard Temperature API for custom watch zones
2. Uses AI reasoning (Gemini LLM) to assess risk and decide actions
3. Surfaces its decisions through an in-app agent chat feed and a full decision audit log, and logs every decision to Supabase
4. Runs autonomously on a GitHub Actions schedule, once per zone
5. Visualizes every zone on an interactive command-center dashboard map, color-coded by current risk level
6. Sends a browser push notification (desktop/Android) for any actionable decision, in addition to logging it
7. Lets you drill into any single zone for its own conditions, active safety protocols, decision history, and a site-scoped AI assistant that only ever sees that zone's data

This provides small contractors enterprise-grade protection and audit trails at an accessible price.

## How it Works

![Swelter Architecture](swelter_architecture.png)

1. GitHub Actions cron triggers `/api/check-heat` once per active zone (each zone gets its own
   request, so a slow FortyGuard response for one zone can't cause the others to be skipped)
2. FastAPI fetches current and forecast readings from FortyGuard
3. Readings are saved to Supabase
4. FastAPI prompts Gemini with readings + previous decisions — up to 3 Gemini API keys are
   tried in order if an earlier one errors (e.g. free-tier quota), invisible to the user
5. Gemini returns a reasoned action (none, alert, reschedule, escalate) with plain-language reasoning
6. The decision is logged to Supabase
7. The website's decision audit log and interactive dashboard map both render straight from
   that same decision data
8. Any actionable decision (not `none`) also fires a browser push notification to every
   subscribed browser (desktop/Android — iOS Safari isn't supported, see Tech Stack)
9. A manual "Check Now" button on the dashboard does the same per-zone check, showing live
   progress ("Checking zone 2/3…"), via a small Vercel serverless proxy
   (`frontend/api/check-heat.ts`) that holds the check-heat secret server-side so it never
   ships in the frontend bundle
10. An AI assistant panel accepts typed questions (`POST /api/chat`) — on the dashboard it
    answers from all zones' data; on a single zone's detail page it's scoped to just that
    zone (`zone_id` param), so it can't see or recommend on other sites' data

## Tech Stack
- Frontend: React (Vite)
- Backend: FastAPI (Vercel serverless)
- Database: Supabase Postgres
- Scheduler: GitHub Actions
- LLM: Gemini API (up to 3 keys, round-robin failover)
- Mapping: react-leaflet + OpenStreetMap (Mapbox was planned but skipped — no signup/token needed)
- Push notifications: Web Push (VAPID) via `pywebpush`, desktop/Android browsers only — iOS
  Safari requires an installed home-screen PWA to receive push, which this build doesn't set up

## Repo Structure
- `backend/` - FastAPI endpoints
- `frontend/` - React frontend
- `db/` - Supabase migrations
- `.github/workflows/` - GitHub Actions cron

## Local Setup
1. Clone repo
2. Apply the SQL files in `db/migrations/` (in order) via the Supabase SQL editor — not run automatically
3. Copy `.env.example` to `.env` and populate keys (Supabase, FortyGuard, Gemini — `GEMINI_API_KEY_2`/`_3` optional — agent secret, VAPID push keys)
4. Run `npm install` in `frontend/`
5. Run `cd backend && uvicorn main:app --reload`
6. Run `npm run dev` in `frontend/` (or `npx vercel dev` to also exercise `frontend/api/check-heat.ts`
   locally — plain `npm run dev` doesn't execute serverless functions, see decisions.md)

<!-- ## License
MIT -->

## Contact
Built by @bilalnadeem614 for FortyGuard Hackathon'26. Questions? Email bilalnadeem883@gmail.com.