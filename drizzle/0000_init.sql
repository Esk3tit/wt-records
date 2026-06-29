CREATE TYPE "public"."branch" AS ENUM('ground', 'air', 'naval');--> statement-breakpoint
CREATE TYPE "public"."proof_kind" AS ENUM('scoreboard', 'end_game', 'end_life', 'video');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('verified', 'pending', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('viewer', 'moderator', 'admin');--> statement-breakpoint
CREATE TYPE "public"."vehicle_class" AS ENUM('light', 'medium', 'heavy', 'spg', 'spaa', 'fighter', 'attacker', 'bomber', 'heli', 'other');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mode_min_kills" (
	"mode" text NOT NULL,
	"class" "vehicle_class" NOT NULL,
	"min_kills" integer NOT NULL,
	CONSTRAINT "mode_min_kills_mode_class_pk" PRIMARY KEY("mode","class")
);
--> statement-breakpoint
ALTER TABLE "mode_min_kills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "modes" (
	"mode" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"branch" "branch" NOT NULL,
	"rules_md" text,
	"difficult_min_kills" integer,
	"is_live" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "modes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort" integer NOT NULL,
	"background_url" text,
	CONSTRAINT "nations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "nations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "player_aliases" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "player_aliases_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"player_id" integer NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'ign' NOT NULL,
	"source" text DEFAULT 'ingame' NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now(),
	"last_seen" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "player_aliases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "players" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "players_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"user_id" uuid,
	CONSTRAINT "players_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "players" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"handle" text,
	"discord_id" text,
	"google_email" text,
	"role" "role" DEFAULT 'viewer' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "record_proof" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "record_proof_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"record_id" integer NOT NULL,
	"kind" "proof_kind" NOT NULL,
	"storage_path" text,
	"original_url" text,
	"sort" integer DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE "record_proof" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "records" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "records_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vehicle_id" integer NOT NULL,
	"mode" text NOT NULL,
	"player_id" integer NOT NULL,
	"ign_snapshot" text NOT NULL,
	"display_name_snapshot" text,
	"kills" integer NOT NULL,
	"run_br" numeric(3, 1),
	"patch" text,
	"status" "record_status" DEFAULT 'pending' NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"imported_from" text,
	"submitted_by_id" uuid,
	"submitted_at" timestamp with time zone DEFAULT now(),
	"verified_at" timestamp with time zone,
	"verified_by_id" uuid,
	CONSTRAINT "rec_current_verified_ck" CHECK (not is_current or status = 'verified')
);
--> statement-breakpoint
ALTER TABLE "records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vehicle_br" (
	"vehicle_id" integer NOT NULL,
	"mode" text NOT NULL,
	"br" numeric(3, 1) NOT NULL,
	CONSTRAINT "vehicle_br_vehicle_id_mode_pk" PRIMARY KEY("vehicle_id","mode")
);
--> statement-breakpoint
ALTER TABLE "vehicle_br" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vehicles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"nation_id" integer NOT NULL,
	"branch" "branch" NOT NULL,
	"class" "vehicle_class" NOT NULL,
	"rank" integer,
	"is_premium" boolean DEFAULT false NOT NULL,
	"is_squadron" boolean DEFAULT false NOT NULL,
	"is_event" boolean DEFAULT false NOT NULL,
	"is_removed" boolean DEFAULT false NOT NULL,
	"image_url" text,
	"is_difficult" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp with time zone,
	CONSTRAINT "vehicles_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "vehicles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "vehicles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mode_min_kills" ADD CONSTRAINT "mode_min_kills_mode_modes_mode_fk" FOREIGN KEY ("mode") REFERENCES "public"."modes"("mode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_aliases" ADD CONSTRAINT "player_aliases_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_proof" ADD CONSTRAINT "record_proof_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_mode_modes_mode_fk" FOREIGN KEY ("mode") REFERENCES "public"."modes"("mode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_br" ADD CONSTRAINT "vehicle_br_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_br" ADD CONSTRAINT "vehicle_br_mode_modes_mode_fk" FOREIGN KEY ("mode") REFERENCES "public"."modes"("mode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alias_uq" ON "player_aliases" USING btree ("player_id","name","kind");--> statement-breakpoint
CREATE INDEX "ply_user_idx" ON "players" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rec_vehicle_mode_idx" ON "records" USING btree ("vehicle_id","mode");--> statement-breakpoint
CREATE UNIQUE INDEX "rec_current_uq" ON "records" USING btree ("vehicle_id","mode") WHERE is_current and status = 'verified';--> statement-breakpoint
CREATE INDEX "rec_mode_idx" ON "records" USING btree ("mode");--> statement-breakpoint
CREATE INDEX "rec_player_idx" ON "records" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "rec_kills_idx" ON "records" USING btree ("kills");--> statement-breakpoint
CREATE INDEX "veh_nation_idx" ON "vehicles" USING btree ("nation_id");--> statement-breakpoint
CREATE INDEX "veh_branch_idx" ON "vehicles" USING btree ("branch");--> statement-breakpoint
CREATE POLICY "records_anon_select_current" ON "records" AS PERMISSIVE FOR SELECT TO "anon" USING (status = 'verified' and is_current);