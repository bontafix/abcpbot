CREATE TABLE "service" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"unit" varchar(255) DEFAULT 'услуга' NOT NULL,
	"tax" varchar(20) DEFAULT 'без НДС' NOT NULL,
	"price" numeric NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" serial PRIMARY KEY NOT NULL,
	"inn" varchar(12) NOT NULL,
	"name" varchar(255) NOT NULL,
	"telegram_id" numeric NOT NULL,
	"title" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
