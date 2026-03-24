/*
Run this SQL manually in the Neon SQL editor:

ALTER TABLE items ADD COLUMN excluded boolean NOT NULL DEFAULT false;
ALTER TABLE sessions ADD COLUMN phase text NOT NULL DEFAULT 'kartlegging';

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (
    char_length(code) = 6 AND code = upper(code) AND code ~ '^[A-Z2-9]+$'
  ),
  title text NOT NULL,
  mode text NOT NULL DEFAULT 'kartlegging' CHECK (mode IN ('kartlegging', 'stemming')),
  phase text NOT NULL DEFAULT 'kartlegging' CHECK (phase IN ('kartlegging', 'stemming')),
  status text NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'paused', 'closed')),
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  allow_new_items boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_by text NOT NULL DEFAULT 'facilitator',
  is_new boolean NOT NULL DEFAULT false,
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
*/

import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const sessionModes = ['kartlegging', 'stemming'] as const;
export const sessionPhases = ['kartlegging', 'stemming'] as const;
export const sessionStatuses = ['setup', 'active', 'paused', 'closed'] as const;

export type SessionMode = (typeof sessionModes)[number];
export type SessionPhase = (typeof sessionPhases)[number];
export type SessionStatus = (typeof sessionStatuses)[number];

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  mode: text('mode').$type<SessionMode>().notNull().default('kartlegging'),
  phase: text('phase').$type<SessionPhase>().notNull().default('kartlegging'),
  status: text('status').$type<SessionStatus>().notNull().default('setup'),
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
