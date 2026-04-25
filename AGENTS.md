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
- ALL API routes must have: export const dynamic = 'force-dynamic'
- Participant-facing API routes that read session state MUST also have:
  export const fetchCache = 'force-no-store'
  and use a no-cache Neon instance:
    const sql = neon(process.env.DATABASE_URL!, {
      fetchOptions: { cache: 'no-store' },
    })
  This is critical — without it Vercel caches Neon responses and
  participants see stale session status.

## Normalization layer (use everywhere)

All session data from the database MUST pass through normalizeSession()
before being sent to the client. This lives in app/lib/normalizeSession.ts.

- Returns NormalizedSession with camelCase fields
- Maps legacy 'mode' → 'moduleType', handles 'innspill' → 'aapne-innspill'
- Derives visibility config from jsonb column with legacy fallback
- sessionStatuses is imported from db/schema — it is a plain string array,
  use .includes() to validate status values
- NEVER call normalizeSession() twice on the same object — the client
  page receives payload.session directly without re-normalizing

## resolveView — single source of truth

app/lib/resolveView.ts takes a NormalizedSession and returns a ViewState.
This is the ONLY place that decides what a participant sees.

ViewState union:
  { view: 'waiting', reason: string }
  { view: 'kartlegging' }
  { view: 'stemming' }
  { view: 'innspill' }
  { view: 'rangering' }
  { view: 'results' }
  { view: 'closed' }

Logic order:
  1. status === 'closed' → closed
  2. visibility.participant.showResults → results
  3. status !== 'active' → waiting
  4. switch on moduleType → module view

delta/[code]/page.tsx ONLY does:
  - read localStorage for participantId
  - poll /api/delta/[code]/state every 5 seconds
  - call resolveView(data.session)
  - switch on viewState.view

No other logic belongs in page.tsx.

## resolveAdminView — single source of truth for admin routing

app/lib/resolveAdminView.ts takes a NormalizedSession and returns an
AdminViewState. This is the ONLY place that decides which high-level
admin control state should be shown.

AdminViewState union:
  { state: 'setup', ... }
  { state: 'collecting', ... }
  { state: 'paused-kartlegging', ... }
  { state: 'paused-innspill', ... }
  { state: 'stemming-setup', ... }
  { state: 'stemming-active', ... }
  { state: 'rangering-active', ... }
  { state: 'closed', ... }
  { state: 'paused-generic', ... }

Each state includes:
  - facilitatorViewLabel
  - primaryAction (button label + intent)
  - secondaryActions
  - sections flags for mode-specific admin UI blocks

AdminPanel.tsx should switch on AdminViewState and must not implement
its own mode+phase+status routing matrix.

## Visibility model

sessions.visibility is a jsonb column. app/lib/getVisibility.ts
parses it with defaults. Shape:
  {
    facilitator: { showRawResponses, showDistribution, showParticipantIds }
    participant: { showOwnResponses, showAggregated, showResults }
    presentation: { showResults, pinnedItemIds[] }
  }

Legacy columns (results_visible, show_others_innspill) are kept for
backward compat. normalizeSession() derives visibility from them if
the jsonb column is empty.

## Consolidated polling endpoint

GET /api/delta/[code]/state?participantId=xxx

Returns everything the participant page needs in one call:
  { session: NormalizedSession, items, innspill, themes, ungrouped, myResponses }

This is the ONLY endpoint delta/[code]/page.tsx should poll.
delta/[code]/resultater/page.tsx also reads session state from this
endpoint (title/status/moduleType/visibility/filters/timer) and should
not fetch duplicate session payloads from other routes.
Must use force-no-store and no-cache Neon instance (see above).

Resultater page data split:
- Poll /api/delta/[code]/state every 5 seconds for session state only
  (including visibility and active filter).
- Fetch mode-specific result payloads separately, one-time per mode/visibility:
  - /api/admin/[code]/summary for kartlegging/stemming/rangering aggregates
  - /api/delta/[code]/themes for aapne-innspill themed/ungrouped innspill
- Do not add a second session polling source (no /api/sessions/[code] in
  resultater/page.tsx).

## Polling pattern (use everywhere, no exceptions)
- Participant pages poll every 5 seconds via useEffect + setInterval
- Admin pages poll every 10 seconds
- Presentation mode polls every 3 seconds
- Polling must MERGE state, never replace with empty arrays
- Use initialized useRef pattern to prevent optimistic update snap-back:
    const initialized = useRef(false)

## Module taxonomy

module_type on a session determines what the participant does.
Modules are variants of one primitive: a list of elements + participants responding.

  KATEGORISERING: 'kartlegging' — pick one tag per item
  VURDERING: 'stemming' — dot voting or 1-5 scale
  INNSPILL: 'aapne-innspill' — free text responses to questions
  PRIORITERING: 'rangering' — drag-and-drop ranking

Adding a new exercise type requires:
  1. Add moduleType value to db/schema.ts sessionModes array
  2. Add case in app/lib/resolveView.ts
  3. Add case in app/lib/resolveAdminView.ts
  4. Create app/delta/[code]/[ModuleName]View.tsx
  No changes to AdminPanel.tsx or delta/[code]/page.tsx needed.

## localStorage pattern
  samen_participant_id          — shared across all sessions
  samen_nickname_[code]         — per session
Read on mount. Set on join. Never clear unless user explicitly leaves.

## Database schema

sessions:
  id, code, title, mode, status, tags, allow_new_items,
  phase, dot_budget, voting_type, allow_multiple_dots,
  visibility (jsonb), visibility_mode, max_rank_items,
  results_visible, show_others_innspill, innspill_mode,
  innspill_max_chars, includes_stemming, created_at

  mode values: 'kartlegging' | 'stemming' | 'aapne-innspill' | 'rangering'
  status values: 'setup' | 'active' | 'paused' | 'closed'
  phase values: 'kartlegging' | 'stemming' | 'innspill' | 'rangering'

items:
  id, session_id, text, created_by, is_new, order_index,
  excluded, is_question, question_status, default_tag,
  final_tag, description, created_at

innspill:
  id, session_id, question_id, participant_id, nickname,
  text, detaljer, likes, created_at

responses:
  id, session_id, item_id, participant_id, value, created_at

themes, innspill_themes, innspill_likes: (unchanged)

## Recurring bugs — NEVER repeat these
- Empty array insert → crashes neon-http. Guard: if (arr.length === 0) return
- fetch() in server components → ECONNREFUSED. Always getDb() directly.
- useEffect syncing from props → snap-back. Use initialized useRef.
- Polling replacing state with empty data → merge, never replace.
- db.transaction() → not supported. Use sequential awaits.
- Drizzle returns snake_case from db. normalizeSession() converts to camelCase.
- question_status overwritten by polling → only update from PATCH response.
- normalizeSession() called twice on same object → second call returns wrong
  status because camelCase fields don't match snake_case reads. Call ONCE
  in the API route, never again in the client page.
- Do not add dual snake_case/camelCase field checks in client pages.
  Normalize once in API responses, then read canonical camelCase fields.
- InnspillView post-mutation refresh must use /api/delta/[code]/state,
  not /api/delta/[code]/innspill — the latter returns snake_case and
  breaks the normalization contract.
- Neon query cache → Vercel caches DB reads. All participant-facing routes
  must use fetchOptions: { cache: 'no-store' } on the neon() instance.
- sessionStatuses.includes() fails silently if sessionStatuses is not a
  plain string[] — verify it is exported as a const string array from schema.

## Design system

Light theme (participant pages):
  Background: #f8fafc
  Card: white, shadow-sm, border border-slate-100
  Primary button: bg-[#0f172a] text-white rounded-full
  Font: Barlow (next/font/google)

Dark theme (admin + /vis):
  Background: #0f172a
  Accent violet: #a78bfa
  Accent cyan: #67e8f9

Consensus colors:
  Agreement: #22c55e
  Some spread: #f59e0b
  Disagreement: #ef4444

## Auth
Middleware protects: /admin/*, /ny, /api/admin/*
Public: /delta/*, /vis/*, /api/delta/*, /api/sessions/*, /api/responses,
        /api/innspill/*
Cookie: admin_session (30 days, httpOnly)
Env: ADMIN_PASSWORD, DATABASE_URL, SAMEN_OPENROUTER_KEY
