-- Search index for posts: stores plain-text extraction of published
-- PortableText bodies plus an optional OpenAI embedding for vector
-- similarity queries. Kept in a separate table so the main `post` table
-- stays narrow.
CREATE TABLE IF NOT EXISTS "post_search_index" (
	"post_id" bigint PRIMARY KEY NOT NULL,
	"plain_text" text DEFAULT '' NOT NULL,
	"embedding" vector(1536),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_post_search_embedding" ON "post_search_index" USING hnsw ("embedding" vector_cosine_ops);
