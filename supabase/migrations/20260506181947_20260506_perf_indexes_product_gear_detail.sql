/*
  # Performance indexes for product and used gear detail pages

  ## Purpose
  Speed up the most common queries hit when opening a product or gear listing detail page.

  ## New Indexes

  1. reviews(product_id, status) — filtered lookup of approved reviews for a product
  2. reviews(gear_listing_id) — lookup gear reviews by listing
  3. reviews(status, created_at DESC) — admin reviews list ordered by date
  4. seller_ratings(seller_id) — aggregate rating lookups per seller
  5. products(slug) — slug-based product lookups
  6. products(status, is_featured, review_count) — related products query
*/

CREATE INDEX IF NOT EXISTS idx_reviews_product_status
  ON reviews (product_id, status);

CREATE INDEX IF NOT EXISTS idx_reviews_gear_listing
  ON reviews (gear_listing_id);

CREATE INDEX IF NOT EXISTS idx_reviews_status_created
  ON reviews (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seller_ratings_seller_id
  ON seller_ratings (seller_id);

CREATE INDEX IF NOT EXISTS idx_products_slug
  ON products (slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_status_featured
  ON products (status, is_featured DESC, review_count DESC);
