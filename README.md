# Swelter

An autonomous AI agent that monitors hyperlocal heat risk and maintains OSHA compliance records for small construction and landscaping contractors. Built solo for FortyGuard's Hackathon'26.


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

1. GitHub Actions cron triggers the `/api/check-heat` endpoint
2. FastAPI fetches current and forecast readings from FortyGuard 
3. Readings are saved to Supabase
4. FastAPI prompts Gemini with readings + previous decisions
5. Gemini returns a reasoned action (none, alert, reschedule, escalate)  
6. Action is logged to Supabase and Slack is notified if needed
7. React dashboard displays zone status and decision history

## Tech Stack
- Frontend: React
- Backend: FastAPI
- Database: Supabase Postgres
- Scheduler: GitHub Actions
- LLM: Gemini API
- Notifications: Slack Webhook

## Repo Structure
- `backend/` - FastAPI endpoints
- `frontend/` - React frontend
- `db/` - Supabase migrations
- `.github/workflows/` - GitHub Actions cron

## Local Setup
1. Clone repo 
2. Copy `.env.example` to `.env` and populate keys
3. Run `npm install` in `frontend/`
4. Run `uvicorn main:app` in `backend/`
5. Run `npm run dev` in `frontend/`

## License
MIT

## Contact
Built by @bilalnadeem614 for FortyGuard Hackathon'26. Questions? Email bilalnadeem883@gmail.com.