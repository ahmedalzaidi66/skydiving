/*
  # Add sort_order to categories

  ## Changes
  - `categories.sort_order` (integer, default 0) — controls display order in storefront
    and admin; lower = earlier in the row.

  ## Notes
  - Existing rows all get sort_order = 0; admin can reorder from the UI.
  - No data is removed or altered beyond adding the new column.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE categories ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS categories_sort_order_idx ON categories(sort_order);
