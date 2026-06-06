CREATE TABLE IF NOT EXISTS `movie_embeddings` (
	`movie_id` text PRIMARY KEY NOT NULL,
	`title_embedding` text,
	`summary_embedding` text,
	`creator_embedding` text,
	`metadata_hash` text,
	`model_version` text,
	`created_at` integer
);
