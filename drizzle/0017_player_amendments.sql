CREATE TABLE "player_amendments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "player_amendments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"player_id" integer NOT NULL,
	"field" text NOT NULL,
	"value" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"submitted_by" uuid,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"reason" text,
	CONSTRAINT "amend_state_valid" CHECK ("player_amendments"."state" in ('pending', 'approved', 'rejected', 'superseded', 'withdrawn')),
	CONSTRAINT "amend_field_valid" CHECK ("player_amendments"."field" in ('avatar')),
	CONSTRAINT "amend_reviewer_valid" CHECK (case when "player_amendments"."state" in ('approved', 'rejected')
             then true
             else "player_amendments"."reviewed_by" is null and "player_amendments"."reviewed_at" is null end)
);
--> statement-breakpoint
ALTER TABLE "player_amendments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "player_amendments" ADD CONSTRAINT "player_amendments_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_amendments" ADD CONSTRAINT "player_amendments_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_amendments" ADD CONSTRAINT "player_amendments_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "amend_one_pending_uq" ON "player_amendments" USING btree ("player_id","field") WHERE "player_amendments"."state" = 'pending';--> statement-breakpoint
CREATE INDEX "amend_submitter_idx" ON "player_amendments" USING btree ("submitted_by","submitted_at");--> statement-breakpoint
CREATE INDEX "amend_player_idx" ON "player_amendments" USING btree ("player_id");--> statement-breakpoint
-- Live avatars are grandfathered in as approved and get no rows: a value is
-- approved because it sits on `players`. The one exception is an accountless
-- row, whose key no surface publishes and which would resurrect on a re-claim.
UPDATE "players" SET "avatar_key" = NULL
WHERE "user_id" IS NULL AND "avatar_key" IS NOT NULL;