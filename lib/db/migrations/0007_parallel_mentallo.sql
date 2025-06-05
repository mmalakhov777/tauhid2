CREATE TABLE IF NOT EXISTS "VectorSearchResult" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"messageId" uuid NOT NULL,
	"chatId" uuid NOT NULL,
	"improvedQueries" json NOT NULL,
	"searchTimestamp" timestamp DEFAULT now() NOT NULL,
	"citations" json NOT NULL,
	"citationCount" integer DEFAULT 0 NOT NULL,
	"searchResultCounts" json NOT NULL,
	"searchDurationMs" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "telegramId" integer;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "telegramUsername" varchar(32);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "telegramFirstName" varchar(64);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "telegramLastName" varchar(64);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "telegramPhotoUrl" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "telegramLanguageCode" varchar(10);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "telegramIsPremium" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "telegramAllowsWriteToPm" boolean DEFAULT false;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "VectorSearchResult" ADD CONSTRAINT "VectorSearchResult_messageId_Message_v2_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message_v2"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "VectorSearchResult" ADD CONSTRAINT "VectorSearchResult_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vector_search_message_id" ON "VectorSearchResult" USING btree ("messageId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vector_search_chat_id" ON "VectorSearchResult" USING btree ("chatId");--> statement-breakpoint
ALTER TABLE "User" ADD CONSTRAINT "User_telegramId_unique" UNIQUE("telegramId");