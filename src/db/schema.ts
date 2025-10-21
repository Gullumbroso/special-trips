import { pgTable, text, timestamp, jsonb, uuid } from 'drizzle-orm/pg-core';

export const generations = pgTable('generations', {
  id: uuid('id').defaultRandom().primaryKey(),
  status: text('status', {
    enum: ['pending', 'processing', 'completed', 'failed']
  }).notNull().default('pending'),
  preferences: jsonb('preferences').notNull(),
  bundles: jsonb('bundles'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});

export type Generation = typeof generations.$inferSelect;
export type NewGeneration = typeof generations.$inferInsert;
