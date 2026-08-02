-- Additive, not a rename: content pages query these columns, and Railway
-- deploys the new build in parallel with the manually-gated migration, so a
-- rename 5xxs every vehicle page in whichever direction the skew falls.
-- image_url/image_key stay until a contract migration drops them.
ALTER TABLE "vehicles" ADD COLUMN "portrait_url" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "portrait_content_id" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "portrait_key" text;--> statement-breakpoint
-- Carrying the old keys over is what lets the first content-addressed run
-- delete the objects it supersedes instead of stranding all 2,647 of them.
UPDATE "vehicles" SET "portrait_url" = "image_url", "portrait_key" = "image_key";
