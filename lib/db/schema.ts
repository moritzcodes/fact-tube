import { pgTable, text, timestamp, integer, uuid, pgEnum, index } from "drizzle-orm/pg-core";

// Enum for claim status
export const claimStatusEnum = pgEnum('claim_status', [
  'pending',
  'verified',
  'false',
  'disputed',
  'inconclusive'
]);

// Claims table based on the project requirements
export const claims = pgTable("claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  videoId: text("video_id").notNull(),
  claim: text("claim").notNull(),
  speaker: text("speaker"),
  timestamp: integer("timestamp").notNull(), // timestamp in seconds
  status: claimStatusEnum("status").default('pending').notNull(),
  verdict: text("verdict"),
  sources: text("sources"), // JSON string of sources
  sourceBias: text("source_bias"), // JSON string of sources with bias information
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Index for faster queries by videoId (most common query pattern)
  videoIdIdx: index("claims_video_id_idx").on(table.videoId),
  // Composite index for ordering claims by videoId and timestamp
  videoIdTimestampIdx: index("claims_video_id_timestamp_idx").on(table.videoId, table.timestamp),
}));

// Transcript segments table for storing processed transcript chunks
export const transcriptSegments = pgTable("transcript_segments", {
  id: uuid("id").defaultRandom().primaryKey(),
  videoId: text("video_id").notNull(),
  text: text("text").notNull(),
  startTime: integer("start_time").notNull(), // in seconds
  endTime: integer("end_time").notNull(), // in seconds
  processed: timestamp("processed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Video metadata table
export const videos = pgTable("videos", {
  id: text("id").primaryKey(), // YouTube video ID
  title: text("title"),
  description: text("description"),
  channelName: text("channel_name"),
  publishedAt: timestamp("published_at"),
  duration: integer("duration"), // in seconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Type exports for TypeScript
export type Claim = typeof claims.$inferSelect;
export type NewClaim = typeof claims.$inferInsert;
export type TranscriptSegment = typeof transcriptSegments.$inferSelect;
export type NewTranscriptSegment = typeof transcriptSegments.$inferInsert;
export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;


