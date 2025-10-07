CREATE INDEX "claims_video_id_idx" ON "claims" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "claims_video_id_timestamp_idx" ON "claims" USING btree ("video_id","timestamp");