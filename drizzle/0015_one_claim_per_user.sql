-- Constrains live data: run the pre-flight check in docs/deploy.md first.
-- The dropped index is fully covered by the partial unique replacing it.
DROP INDEX "ply_user_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "ply_user_uq" ON "players" USING btree ("user_id") WHERE "players"."user_id" is not null;
