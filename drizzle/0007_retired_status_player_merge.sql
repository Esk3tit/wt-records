ALTER TYPE "public"."record_status" ADD VALUE 'retired';--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "merged_into" integer;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_merged_into_players_id_fk" FOREIGN KEY ("merged_into") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;