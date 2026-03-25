# Sammen — AI context file

## What this is
Sammen is a workshop facilitation tool built with Next.js 14 
(App Router), Drizzle ORM, Neon (serverless Postgres), Tailwind CSS.
Deployed on Vercel at samen-alene.vercel.app.

## Critical architecture rules
- Server components MUST query db directly via getDb() — NEVER fetch()
- Client components fetch via API routes (/api/...)
- NEVER use db.transaction() — neon-http does not support it
- NEVER insert empty array — guard with if (array.length === 0) return early
- After every PATCH, update local state from response body — never from props
- NEVER use localhost or absolute URLs in server components

## Polling pattern (established, use everywhere)
- Participant pages poll every 5 seconds via useEffect + setInterval
- Admin pages poll every 10 seconds
- Polling must MERGE state, never replace:
  if incoming data is empty, keep existing local state
- Use initialized ref to prevent useEffect from overwriting 
  optimistic updates:
    const initialized = useRef(false)

## localStorage pattern (established, use everywhere)
- participantId: localStorage.getItem('samen_participant_id')
- nickname per session: localStorage.getItem('samen_nickname_' + code)
- Set on join, read on mount to survive page reload

## Database schema

sessions:
  id, code, title, mode, status, tags, allow_new_items,
  phase, dot_budget, voting_type, allow_multiple_dots,
  visibility_mode, results_visible, created_at

  mode values: 'kartlegging' | 'stemming' | 'aapne-innspill'
  status values: 'setup' | 'active' | 'paused' | 'closed'
  phase values: 'kartlegging' | 'stemming' | 'innspill'
  voting_type values: 'scale' | 'dots'
  visibility_mode values: 'manual' | 'all'

items:
  id, session_id, text, created_by, is_new, order_index,
  excluded, is_question, question_status, created_at

  question_status values: 'inactive' | 'active' | 'locked'
  is_question: true for Åpne innspill questions

innspill:
  id, session_id, question_id, participant_id, nickname,
  text, likes, created_at

innspill_likes:
  id, innspill_id, participant_id, created_at

responses:
  id, session_id, item_id, participant_id, value, created_at
  value: tag name (kartlegging), "1"-"5" (scale), 
         dot count as string (dots)

## Session flows

Kartlegging:
  setup → active (kartlegging) → paused → active (stemming) → closed

Stemming only:
  setup → active (stemming) → paused → closed

Åpne innspill:
  setup → active → paused → closed
  Questions controlled independently via question_status

## Modules and routes

/ — session overview (server, direct db)
/ny — create session (client)
/logg-inn — admin login
/admin/[code] — facilitator panel
/admin/[code]/results — results page
/delta — participant code entry
/delta/[code] — participant view (polls 5s)
/delta/[code]/resultater — participant results (polls 5s)

API routes:
  POST/PATCH /api/sessions
  GET /api/sessions/[code]
  POST/PATCH /api/items
  PATCH /api/items/[id]
  POST /api/responses
  POST /api/innspill
  POST /api/innspill/[id]/like
  DELETE /api/innspill/[id]
  GET /api/admin/[code]/summary
  GET /api/admin/[code]/innspill-summary
  GET /api/delta/[code]/innspill
  GET /api/delta/[code]/results
  POST /api/auth/login
  POST /api/auth/logout

## Recurring bugs — NEVER repeat these
- Empty array insert crashes neon-http — always guard first
- fetch() in server components crashes with ECONNREFUSED
- useEffect syncing state from props causes optimistic updates 
  to snap back — use initialized ref pattern instead
- Polling replacing state with empty data — always merge, never replace
- question_status must never be overwritten by polling — 
  only update from PATCH response
- Drizzle returns snake_case field names (question_id not questionId)
- db.transaction() not supported — use sequential inserts
