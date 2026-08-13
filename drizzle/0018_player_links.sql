CREATE TABLE "player_links" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "player_links_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"player_id" integer NOT NULL,
	"platform" text NOT NULL,
	"handle" text NOT NULL,
	"normalized_handle" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plink_handle_present" CHECK (length("player_links"."handle") > 0)
);
--> statement-breakpoint
ALTER TABLE "player_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "player_links" ADD CONSTRAINT "player_links_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plink_player_platform_uq" ON "player_links" USING btree ("player_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "plink_handle_uq" ON "player_links" USING btree ("platform","normalized_handle") WHERE "player_links"."platform" <> 'website';