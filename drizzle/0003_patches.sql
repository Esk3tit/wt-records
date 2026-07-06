CREATE TABLE "patches" (
	"version" text PRIMARY KEY NOT NULL,
	"name" text,
	"released_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "patches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Backfill pre-existing data (fixture/demo rows): register every patch already
-- on a record, and land null-patch rows on 2.53 (the fixture's latest version).
INSERT INTO "patches" ("version")
SELECT DISTINCT "patch" FROM "records" WHERE "patch" IS NOT NULL
UNION
SELECT '2.53' WHERE EXISTS (SELECT 1 FROM "records" WHERE "patch" IS NULL);--> statement-breakpoint
UPDATE "records" SET "patch" = '2.53' WHERE "patch" IS NULL;--> statement-breakpoint
ALTER TABLE "records" ALTER COLUMN "patch" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_patch_patches_version_fk" FOREIGN KEY ("patch") REFERENCES "public"."patches"("version") ON DELETE no action ON UPDATE no action;