# Sammen — AI context file

## What this is
Sammen is a workshop facilitation tool built with Next.js 14
(App Router), Drizzle ORM, Neon (serverless Postgres), and
Tailwind CSS. Deployed on Vercel.

## Architecture rules
- Server components query the database directly via getDb()
  from db/index.ts — never via fetch()
- Client components fetch data via API routes (/api/...)
- No transactions — neon-http driver does not support them
- All inserts are sequential
- No auth — admin access is by URL, participant access by code

## Database schema summary
- sessions: id, code, title, mode, status, tags, allow_new_items,
  phase, created_at
- items: id, session_id, text, created_by, is_new, order_index,
  excluded, created_at
- responses: id, session_id, item_id, participant_id, value,
  created_at

## Key routes
- / — session overview (server component)
- /ny — create session (client component)
- /admin/[code] — facilitator panel (server + client)
- /delta — participant code entry (client)
- /delta/[code] — participant view (client, polls every 5s)
- /api/sessions POST/PATCH
- /api/sessions/[code] GET
- /api/items POST/PATCH
- /api/responses POST
- /api/admin/[code]/summary GET

## Conventions
- Norwegian UI text throughout
- Dark theme with Tailwind
- Mobile-first

## Known limitations
- Admin auth uses a single global password (ADMIN_PASSWORD env var)
- No real-time (polling only)
- One session per workshop (no project grouping yet)
