/*
  # Add detailed gear fields to used_gear_listings

  ## Summary
  Adds comprehensive skydiving equipment detail columns to used_gear_listings.
  This allows sellers to enter full gear specifications including make/model/size/DOM/serial
  for the rig itself and sub-components (main canopy, reserve, AAD).

  ## Modified Tables

  ### used_gear_listings — new columns added
  General gear fields:
  - make (text) — manufacturer/brand
  - model (text) — model name
  - color (text) — color description
  - size (text) — size designation
  - dom (text) — date of manufacture (stored as text for flexibility)
  - serial_number (text) — serial number
  - total_jumps (integer) — total jumps on gear
  - location (text) — seller location
  - shipping_included (boolean) — whether price includes shipping

  Main canopy sub-fields (for Complete Rig / Parachute/Rig categories):
  - main_make, main_model, main_size, main_dom, main_jumps, main_serial

  Reserve sub-fields:
  - reserve_make, reserve_model, reserve_size, reserve_dom, reserve_repacks, reserve_serial

  AAD sub-fields:
  - aad_make, aad_model, aad_dom, aad_eol, aad_jumps, aad_needs_service, aad_serial

  ## Notes
  - All new columns are nullable with safe defaults
  - No existing data is modified
  - No RLS changes needed (existing policies cover all columns)
*/

DO $$
BEGIN
  -- General gear fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'make') THEN
    ALTER TABLE used_gear_listings ADD COLUMN make text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'model') THEN
    ALTER TABLE used_gear_listings ADD COLUMN model text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'color') THEN
    ALTER TABLE used_gear_listings ADD COLUMN color text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'size') THEN
    ALTER TABLE used_gear_listings ADD COLUMN size text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'dom') THEN
    ALTER TABLE used_gear_listings ADD COLUMN dom text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'serial_number') THEN
    ALTER TABLE used_gear_listings ADD COLUMN serial_number text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'total_jumps') THEN
    ALTER TABLE used_gear_listings ADD COLUMN total_jumps integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'location') THEN
    ALTER TABLE used_gear_listings ADD COLUMN location text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'shipping_included') THEN
    ALTER TABLE used_gear_listings ADD COLUMN shipping_included boolean NOT NULL DEFAULT false;
  END IF;

  -- Main canopy sub-fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'main_make') THEN
    ALTER TABLE used_gear_listings ADD COLUMN main_make text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'main_model') THEN
    ALTER TABLE used_gear_listings ADD COLUMN main_model text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'main_size') THEN
    ALTER TABLE used_gear_listings ADD COLUMN main_size text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'main_dom') THEN
    ALTER TABLE used_gear_listings ADD COLUMN main_dom text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'main_jumps') THEN
    ALTER TABLE used_gear_listings ADD COLUMN main_jumps integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'main_serial') THEN
    ALTER TABLE used_gear_listings ADD COLUMN main_serial text NOT NULL DEFAULT '';
  END IF;

  -- Reserve sub-fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'reserve_make') THEN
    ALTER TABLE used_gear_listings ADD COLUMN reserve_make text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'reserve_model') THEN
    ALTER TABLE used_gear_listings ADD COLUMN reserve_model text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'reserve_size') THEN
    ALTER TABLE used_gear_listings ADD COLUMN reserve_size text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'reserve_dom') THEN
    ALTER TABLE used_gear_listings ADD COLUMN reserve_dom text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'reserve_repacks') THEN
    ALTER TABLE used_gear_listings ADD COLUMN reserve_repacks integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'reserve_serial') THEN
    ALTER TABLE used_gear_listings ADD COLUMN reserve_serial text NOT NULL DEFAULT '';
  END IF;

  -- AAD sub-fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'aad_make') THEN
    ALTER TABLE used_gear_listings ADD COLUMN aad_make text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'aad_model') THEN
    ALTER TABLE used_gear_listings ADD COLUMN aad_model text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'aad_dom') THEN
    ALTER TABLE used_gear_listings ADD COLUMN aad_dom text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'aad_eol') THEN
    ALTER TABLE used_gear_listings ADD COLUMN aad_eol text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'aad_jumps') THEN
    ALTER TABLE used_gear_listings ADD COLUMN aad_jumps integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'aad_needs_service') THEN
    ALTER TABLE used_gear_listings ADD COLUMN aad_needs_service boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'used_gear_listings' AND column_name = 'aad_serial') THEN
    ALTER TABLE used_gear_listings ADD COLUMN aad_serial text NOT NULL DEFAULT '';
  END IF;
END $$;
