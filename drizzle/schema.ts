import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const generations = pgTable("generations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	status: text().default('pending').notNull(),
	preferences: jsonb().notNull(),
	bundles: jsonb(),
	openaiResponseId: text("openai_response_id"),
	error: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
});
