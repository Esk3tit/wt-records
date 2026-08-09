-- Contract half of 0011_portrait_columns. Safe only once a sync has re-keyed
-- every portrait, since image_key is what tells that run which objects to delete.
ALTER TABLE "vehicles" DROP COLUMN "image_url";--> statement-breakpoint
ALTER TABLE "vehicles" DROP COLUMN "image_key";