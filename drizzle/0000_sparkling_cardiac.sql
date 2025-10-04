CREATE TYPE "public"."claim_status" AS ENUM('pending', 'verified', 'false', 'disputed', 'inconclusive');--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" text NOT NULL,
	"claim" text NOT NULL,
	"speaker" text,
	"timestamp" integer NOT NULL,
	"status" "claim_status" DEFAULT 'pending' NOT NULL,
	"verdict" text,
	"sources" text,
	"source_bias" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcript_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" text NOT NULL,
	"text" text NOT NULL,
	"start_time" integer NOT NULL,
	"end_time" integer NOT NULL,
	"processed" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"description" text,
	"channel_name" text,
	"published_at" timestamp,
	"duration" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
