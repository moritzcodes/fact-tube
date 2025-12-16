import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// Claims table based on the project requirements
export const claims = sqliteTable("claims", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()), // Generate UUID by default
  videoId: text("video_id").notNull(),
  claim: text("claim").notNull(),
  speaker: text("speaker"),
  timestamp: integer("timestamp").notNull(), // timestamp in seconds
  status: text("status").default('pending').notNull(), // 'pending' | 'verified' | 'false' | 'disputed' | 'inconclusive'
  verdict: text("verdict"),
  sources: text("sources"), // JSON string of sources
  sourceBias: text("source_bias"), // JSON string of sources with bias information
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
  // Index for faster queries by videoId (most common query pattern)
  videoIdIdx: index("claims_video_id_idx").on(table.videoId),
  // Composite index for ordering claims by videoId and timestamp
  videoIdTimestampIdx: index("claims_video_id_timestamp_idx").on(table.videoId, table.timestamp),
}));

// Transcript segments table for storing processed transcript chunks
export const transcriptSegments = sqliteTable("transcript_segments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  videoId: text("video_id").notNull(),
  text: text("text").notNull(),
  startTime: integer("start_time").notNull(), // in seconds
  endTime: integer("end_time").notNull(), // in seconds
  processed: integer("processed", { mode: 'timestamp' }),
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

// Video metadata table
export const videos = sqliteTable("videos", {
  id: text("id").primaryKey(), // YouTube video ID
  title: text("title"),
  description: text("description"),
  channelName: text("channel_name"),
  publishedAt: integer("published_at", { mode: 'timestamp' }),
  duration: integer("duration"), // in seconds
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

// Type exports for TypeScript
export type Claim = typeof claims.$inferSelect;
export type NewClaim = typeof claims.$inferInsert;
export type TranscriptSegment = typeof transcriptSegments.$inferSelect;
export type NewTranscriptSegment = typeof transcriptSegments.$inferInsert;
export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;


