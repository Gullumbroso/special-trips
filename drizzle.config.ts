import { defineConfig } from 'drizzle-kit';
import "dotenv/config";

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.SPECIAL_TRIPS_STORAGE_POSTGRES_URL!,
  },
});
