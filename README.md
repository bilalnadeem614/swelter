# Swelter

An autonomous AI agent that monitors hyperlocal heat risk and maintains OSHA compliance records for small construction and landscaping contractors. Built solo for FortyGuard's Hackathon'26.

![Swelter Dashboard](swelter_dashboard.png)

## Problem

Small contractors manage heat safety manually by checking weather apps, creating inconsistency, lack of documentation, and liability exposure. Existing tools are either informational-only or enterprise-priced.

## Solution

Swelter is a hardware-free agent that:
1. Polls the FortyGuard Temperature API for custom watch zones
2. Uses AI reasoning (Gemini LLM) to assess risk and decide actions
3. Executes alerts via Slack and logs timestamped decisions to Supabase
4. Runs autonomously on a GitHub Actions schedule

This provides small contractors enterprise-grade protection and audit trails at an accessible price.

## How it Works

![Swelter Architecture](swelter_architecture.png)

1. GitHub Actions cron triggers the `/api/check-heat` endpoint
2. FastAPI fetches current and forecast readings from FortyGuard 
3. Readings are saved to Supabase
4. FastAPI prompts Gemini with readings + previous decisions
5. Gemini returns a reasoned action (none, alert, reschedule, escalate)  
6. Action is logged to Supabase and Slack is notified if needed
7. React dashboard displays zone status and decision history

## Tech Stack
- Frontend: React on Vercel
- Backend: FastAPI on Vercel Serverless 
- Database: Supabase Postgres
- Scheduler: GitHub Actions
- LLM: Gemini API
- Notifications: Slack Webhook

## Repo Structure
- `api/` - FastAPI endpoints
- `web/` - React frontend
- `db/` - Supabase migrations
- `.github/workflows/` - GitHub Actions cron  

## Local Setup
1. Clone repo 
2. Copy `.env.example` to `.env` and populate keys
3. Run `yarn install` in `web/`
4. Run `uvicorn api.main:app` in `api/`
5. Run `yarn dev` in `web/`

## Deployment
1. Web: `yarn build` in `web/`, then `vercel --prod`  
2. API: Push to `main` branch, Vercel auto-deploys
3. DB: Push migration files in `db/`, Supabase auto-applies  
4. Cron: `.github/workflows/check-heat.yml` runs on push to `main`

## License
MIT

## Contact
Built by @bilalnadeem614 for FortyGuard Hackathon'26. Questions? Email bilalnadeem883@gmail.com.