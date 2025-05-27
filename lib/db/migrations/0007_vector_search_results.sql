CREATE TABLE "VectorSearchResult" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "messageId" uuid NOT NULL,
  "chatId" uuid NOT NULL,
  "improvedQueries" json NOT NULL,
  "searchTimestamp" timestamp NOT NULL DEFAULT now(),
  "citations" json NOT NULL,
  "citationCount" integer NOT NULL DEFAULT 0,
  "searchResultCounts" json NOT NULL,
  "searchDurationMs" integer,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "VectorSearchResult" ADD CONSTRAINT "VectorSearchResult_messageId_Message_v2_id_fk" 
  FOREIGN KEY ("messageId") REFERENCES "Message_v2"("id") ON DELETE CASCADE;

ALTER TABLE "VectorSearchResult" ADD CONSTRAINT "VectorSearchResult_chatId_Chat_id_fk" 
  FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE;

CREATE INDEX "idx_vector_search_message_id" ON "VectorSearchResult"("messageId");
CREATE INDEX "idx_vector_search_chat_id" ON "VectorSearchResult"("chatId"); 