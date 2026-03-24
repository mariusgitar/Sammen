# Sammen — AI context file

## What this is
Sammen is a workshop facilitation tool built with Next.js 14 
(App Router), Drizzle ORM, Neon (serverless Postgres), and 
Tailwind CSS. Deployed on Vercel at samen-alene.vercel.app.

## Critical architecture rules
- Server components MUST query database directly via getDb() — NEVER via fetch()
- Client components fetch data via API routes (/api/...)
- NEVER use db.transaction() — neon-http does not support transactions
- All db inserts must be sequential, no transaction wrappers
- NEVER insert an empty array — always guard with if (array.length === 0) return early
- After every PATCH /api/sessions/[code], update sessionStatus state 
  from response body — never rely on prop values for current status

## Database schema
sessions:
  id, code, title, mode, status, tags, allow_new_items,
  phase, dot_budget, voting_type, allow_multiple_dots, created_at

items:
  id, session_id, text, created_by, is_new, order_index, 
  excluded, created_at

responses:
  id, session_id, item_id, participant_id, value, created_at

## Session flow
setup → active (kartlegging) → paused → active (stemming) → closed

Status controls participant access:
- setup: "ikke åpen ennå"
- active: show current phase view
- paused: "ikke åpen ennå"  
- closed: "sesjonen er avsluttet"

Phase controls which view participants see:
- kartlegging: KartleggingView
- stemming: StemmingView (scale or dots based on voting_type)

## Voting types
- mode: 'kartlegging' | 'stemming'
- voting_type: 'scale' | 'dots' (only relevant for stemming)
- dot_budget: number of dots per participant
- allow_multiple_dots: whether dots can be stacked on one item

## Key routes
- / — session overview (server component, direct db query)
- /ny — create session (client component)
- /admin/[code] — facilitator panel (AdminPanel.tsx client component)
- /admin/[code]/results — results page (server + KartleggingResults.tsx client)
- /delta — participant code entry
- /delta/[code] — participant view (client, polls every 5s)
- /logg-inn — admin login page
- /api/auth/login POST — set admin cookie
- /api/auth/logout POST — clear admin cookie  
- /api/sessions POST, PATCH
- /api/sessions/[code] GET
- /api/items POST, PATCH
- /api/responses POST
- /api/admin/[code]/summary GET

## Recurring bugs to avoid
- Empty array insert: always guard before db insert
- fetch() in server components: NEVER — query db directly
- Session status reset: always update state from PATCH response body
- localhost fetch: NEVER use absolute URLs in server components
- Transaction usage: NEVER — use sequential inserts only
