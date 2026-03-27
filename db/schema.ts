/*
Run this SQL manually in the Neon SQL editor:

ALTER TABLE items ADD COLUMN excluded boolean NOT NULL DEFAULT false;
ALTER TABLE items ADD COLUMN is_question boolean NOT NULL DEFAULT false;
ALTER TABLE items ADD COLUMN question_status text NOT NULL DEFAULT 'inactive';
ALTER TABLE sessions ADD COLUMN phase text NOT NULL DEFAULT 'kartlegging';
ALTER TABLE sessions ADD COLUMN dot_budget integer NOT NULL DEFAULT 5;
ALTER TABLE sessions ADD COLUMN voting_type text NOT NULL DEFAULT 'scale';
ALTER TABLE sessions ADD COLUMN allow_multiple_dots boolean NOT NULL DEFAULT true;
ALTER TABLE sessions ADD COLUMN results_visible boolean NOT NULL DEFAULT false;
ALTER TABLE sessions ADD COLUMN visibility_mode text NOT NULL DEFAULT 'manual';
ALTER TABLE sessions ADD COLUMN max_rank_items integer;
ALTER TABLE sessions ADD COLUMN show_others_innspill boolean NOT NULL DEFAULT true;
ALTER TABLE sessions ADD COLUMN innspill_mode text NOT NULL DEFAULT 'enkel';
ALTER TABLE sessions ADD COLUMN innspill_max_chars integer NOT NULL DEFAULT 100;
ALTER TABLE innspill ADD COLUMN detaljer text;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (
    char_length(code) = 6 AND code = upper(code) AND code ~ '^[A-Z2-9]+$'
  ),
  title text NOT NULL,
  mode text NOT NULL DEFAULT 'kartlegging' CHECK (mode IN ('kartlegging', 'stemming', 'aapne-innspill', 'rangering')),
  phase text NOT NULL DEFAULT 'kartlegging' CHECK (phase IN ('kartlegging', 'stemming', 'innspill', 'rangering')),
  status text NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'paused', 'closed')),
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  allow_new_items boolean NOT NULL DEFAULT true,
  visibility_mode text NOT NULL DEFAULT 'manual' CHECK (visibility_mode IN ('manual', 'all')),
  innspill_mode text NOT NULL DEFAULT 'enkel' CHECK (innspill_mode IN ('enkel', 'detaljert')),
  innspill_max_chars integer NOT NULL DEFAULT 100,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_by text NOT NULL DEFAULT 'facilitator',
  is_new boolean NOT NULL DEFAULT false,
  is_question boolean NOT NULL DEFAULT false,
  question_status text NOT NULL DEFAULT 'inactive' CHECK (question_status IN ('inactive', 'active', 'locked')),
  excluded boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  participant_id text NOT NULL,
  value text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS innspill (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  participant_id text NOT NULL,
  nickname text NOT NULL,
  text text NOT NULL,
  detaljer text,
  likes integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS innspill_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  innspill_id uuid NOT NULL REFERENCES innspill(id) ON DELETE CASCADE,
  participant_id text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
*/

import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const sessionModes = ['kartlegging', 'stemming', 'aapne-innspill', 'rangering'] as const;
export const sessionPhases = ['kartlegging', 'stemming', 'innspill', 'rangering'] as const;
export const sessionStatuses = ['setup', 'active', 'paused', 'closed'] as const;
export const votingTypes = ['scale', 'dots'] as const;
export const visibilityModes = ['manual', 'all'] as const;
export const questionStatuses = ['inactive', 'active', 'locked'] as const;
export const innspillModes = ['enkel', 'detaljert'] as const;

export type SessionMode = (typeof sessionModes)[number];
export type SessionPhase = (typeof sessionPhases)[number];
export type SessionStatus = (typeof sessionStatuses)[number];
export type VotingType = (typeof votingTypes)[number];
export type VisibilityMode = (typeof visibilityModes)[number];
export type QuestionStatus = (typeof questionStatuses)[number];
export type InnspillMode = (typeof innspillModes)[number];

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  mode: text('mode').$type<SessionMode>().notNull().default('kartlegging'),
  phase: text('phase').$type<SessionPhase>().notNull().default('kartlegging'),
  status: text('status').$type<SessionStatus>().notNull().default('setup'),
  votingType: text('voting_type').$type<VotingType>().notNull().default('scale'),
  dotBudget: integer('dot_budget').notNull().default(5),
  allowMultipleDots: boolean('allow_multiple_dots').notNull().default(true),
  resultsVisible: boolean('results_visible').notNull().default(false),
  visibilityMode: text('visibility_mode').$type<VisibilityMode>().notNull().default('manual'),
  showOthersInnspill: boolean('show_others_innspill').notNull().default(true),
  innspillMode: text('innspill_mode').$type<InnspillMode>().notNull().default('enkel'),
  innspillMaxChars: integer('innspill_max_chars').notNull().default(100),
  maxRankItems: integer('max_rank_items'),
  tags: text('tags').array().notNull().default([]),
  allowNewItems: boolean('allow_new_items').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const items = pgTable('items', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  createdBy: text('created_by').notNull().default('facilitator'),
  isNew: boolean('is_new').notNull().default(false),
  isQuestion: boolean('is_question').notNull().default(false),
  questionStatus: text('question_status').$type<QuestionStatus>().notNull().default('inactive'),
  excluded: boolean('excluded').notNull().default(false),
  orderIndex: integer('order_index').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const responses = pgTable('responses', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id')
    .notNull()
    .references(() => items.id, { onDelete: 'cascade' }),
  participantId: text('participant_id').notNull(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const innspill = pgTable('innspill', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id')
    .notNull()
    .references(() => items.id, { onDelete: 'cascade' }),
  participantId: text('participant_id').notNull(),
  nickname: text('nickname').notNull(),
  text: text('text').notNull(),
  detaljer: text('detaljer'),
  likes: integer('likes').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const innspillLikes = pgTable('innspill_likes', {
  id: uuid('id').defaultRandom().primaryKey(),
  innspillId: uuid('innspill_id')
    .notNull()
    .references(() => innspill.id, { onDelete: 'cascade' }),
  participantId: text('participant_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
