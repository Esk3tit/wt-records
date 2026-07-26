CREATE TABLE "catalog_sync_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "catalog_sync_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"finished_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ok" boolean NOT NULL,
	"detail" text
);
--> statement-breakpoint
ALTER TABLE "catalog_sync_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "sync_run_finished_idx" ON "catalog_sync_runs" USING btree ("finished_at");