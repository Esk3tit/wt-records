CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TABLE "vehicle_search_terms" (
	"vehicle_id" integer NOT NULL,
	"term" text NOT NULL,
	CONSTRAINT "vehicle_search_terms_vehicle_id_term_pk" PRIMARY KEY("vehicle_id","term")
);
--> statement-breakpoint
ALTER TABLE "vehicle_search_terms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vehicle_search_terms" ADD CONSTRAINT "vehicle_search_terms_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;