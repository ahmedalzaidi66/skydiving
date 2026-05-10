/*
  # Hero Slides: Add overlay_color + seed 3 default slides

  ## Changes
  1. Adds `overlay_color` column to `hero_slides` — per-slide overlay darkness (rgba string)
  2. Seeds 3 professional default slides with skydiving imagery from Pexels

  ## Modified Tables
  - `hero_slides`: new column `overlay_color` (text, default 'rgba(5,10,20,0.45)')
*/

-- 1. Add overlay_color column (safe — does nothing if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hero_slides' AND column_name = 'overlay_color'
  ) THEN
    ALTER TABLE hero_slides ADD COLUMN overlay_color text NOT NULL DEFAULT 'rgba(5,10,20,0.45)';
  END IF;
END $$;

-- 2. Seed 3 default slides only when the table is empty
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM hero_slides) = 0 THEN
    INSERT INTO hero_slides (image_url, title, subtitle, badge, button_text, button_url, sort_order, is_active, overlay_color) VALUES
    (
      'https://images.pexels.com/photos/1271375/pexels-photo-1271375.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'Tested in Real Skydives',
      'Gear trusted by 10,000+ skydivers worldwide',
      'PROFESSIONAL GRADE',
      'Shop Now',
      '/(tabs)/products',
      0,
      true,
      'rgba(5,10,20,0.45)'
    ),
    (
      'https://images.pexels.com/photos/1361369/pexels-photo-1361369.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'Find Your Perfect Canopy',
      'Expert-matched gear for your jump count and weight',
      'CANOPY ADVISOR',
      'Get Matched',
      '/(tabs)/canopy',
      1,
      true,
      'rgba(5,10,20,0.50)'
    ),
    (
      'https://images.pexels.com/photos/2280549/pexels-photo-2280549.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'Used Gear Marketplace',
      'Buy and sell trusted skydiving equipment',
      'COMMUNITY',
      'Browse Marketplace',
      '/(tabs)/marketplace',
      2,
      true,
      'rgba(5,10,20,0.40)'
    );
  END IF;
END $$;
