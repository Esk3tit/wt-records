ALTER TABLE "players" ADD COLUMN "country_code" text;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "ply_country_upper" CHECK ("players"."country_code" ~ '^[A-Z]{2}$');