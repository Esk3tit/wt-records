-- Renamed rather than dropped and recreated: image_key holds live object keys,
-- and losing them would strand every mirrored portrait in the bucket.
ALTER TABLE "vehicles" RENAME COLUMN "image_url" TO "portrait_url";--> statement-breakpoint
ALTER TABLE "vehicles" RENAME COLUMN "image_key" TO "portrait_key";--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "portrait_content_id" text;
