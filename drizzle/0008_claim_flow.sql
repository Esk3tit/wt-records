CREATE TABLE "player_claims" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "player_claims_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"player_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"note" text,
	"seed_avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "player_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "avatar_key" text;--> statement-breakpoint
ALTER TABLE "player_claims" ADD CONSTRAINT "player_claims_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_claims" ADD CONSTRAINT "player_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "claim_user_player_uq" ON "player_claims" USING btree ("user_id","player_id");--> statement-breakpoint
CREATE INDEX "claim_player_idx" ON "player_claims" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "claim_created_idx" ON "player_claims" USING btree ("created_at");