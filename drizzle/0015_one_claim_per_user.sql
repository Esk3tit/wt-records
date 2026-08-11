-- This one constrains live data: run the pre-flight duplicate-claim check in
-- docs/deploy.md first, because a User holding two Players fails the deploy.
-- The dropped index is fully covered by the partial unique that replaces it.
DROP INDEX "ply_user_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "ply_user_uq" ON "players" USING btree ("user_id") WHERE "players"."user_id" is not null;
