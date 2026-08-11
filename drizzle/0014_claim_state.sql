ALTER TABLE "player_claims" ADD COLUMN "state" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "player_claims" ADD COLUMN "decided_by" uuid;--> statement-breakpoint
ALTER TABLE "player_claims" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "player_claims" ADD CONSTRAINT "player_claims_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "claim_one_pending_uq" ON "player_claims" USING btree ("user_id") WHERE "player_claims"."state" = 'pending';--> statement-breakpoint
ALTER TABLE "player_claims" ADD CONSTRAINT "claim_state_valid" CHECK ("player_claims"."state" in ('pending', 'denied'));