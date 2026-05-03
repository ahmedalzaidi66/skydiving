/*
  # Seed Storefront Data v3

  Uses real existing category IDs and product IDs from the database.
  - Patches existing products with new columns (slug, category_id, main_image, images, featured, status, sku, specifications)
  - Seeds category_translations for all 4 categories x 4 languages
  - Seeds product_translations for all 8 products x 4 languages
  - Seeds cms_content for all 4 languages
  - Seeds site_settings with theme key-value pairs
*/

DO $$
DECLARE
  -- Category IDs (from actual DB)
  cat_accessories uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567804';
  cat_helmets     uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567801';
  cat_parachutes  uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567803';
  cat_suits       uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567802';

  -- Product IDs (from actual DB)
  prod_helmet   uuid := 'bdc4b8ae-8d0f-44c5-a6d8-1baa1878b10a'; -- AeroX Full-Face Helmet
  prod_canopy   uuid := 'dbb1e13f-0638-415a-9b78-1b5c8c0bf077'; -- Highlight X3 Canopy
  prod_goggles  uuid := 'afaec2d5-abd6-4899-a1d7-8a2773a0bbee'; -- NeoAir Goggles Pro
  prod_jumpsuit uuid := '732c03e5-d603-42a4-8844-76b320d700e6'; -- Phantom X Jumpsuit
  prod_alti1    uuid := '3ef3150f-2fde-4eb8-acfb-f03dd30a0321'; -- SkyDive Pro Altimeter
  prod_chute    uuid := '962126e3-037f-42e8-92bb-15a2076218c9'; -- SkySnatch Pilot Chute
  prod_rig      uuid := 'd32b9efe-c9b7-486e-946d-44476670c365'; -- Vector 3 Rig Container
  prod_alti2    uuid := '44b58b01-656a-44b3-baa5-62eb2fc8e2cd'; -- Viso II Digital Alti
BEGIN

-- ─── 1. Category Translations ─────────────────────────────────────────────────

INSERT INTO category_translations (category_id, language, name, description) VALUES
  (cat_parachutes, 'en', 'Canopies',    'High-performance parachute canopies for every skill level'),
  (cat_parachutes, 'ar', 'المظلات',    'مظلات عالية الأداء لكل مستوى مهاري'),
  (cat_parachutes, 'es', 'Paracaídas', 'Paracaídas de alto rendimiento para todos los niveles'),
  (cat_parachutes, 'de', 'Schirme',    'Hochleistungsschirme für jedes Fähigkeitsniveau'),
  (cat_helmets,    'en', 'Helmets',    'Full-face and open-face skydiving helmets'),
  (cat_helmets,    'ar', 'الخوذات',   'خوذات القفز بالمظلة بوجه كامل ومفتوح'),
  (cat_helmets,    'es', 'Cascos',     'Cascos de paracaidismo con cara completa y abierta'),
  (cat_helmets,    'de', 'Helme',      'Vollvisier- und offene Fallschirmspringerhelme'),
  (cat_suits,      'en', 'Suits',      'Jumpsuits and wingsuits for every discipline'),
  (cat_suits,      'ar', 'البدلات',   'بدلات القفز وأجنحة لكل تخصص'),
  (cat_suits,      'es', 'Trajes',     'Monos y trajes de vuelo para todas las disciplinas'),
  (cat_suits,      'de', 'Anzüge',     'Sprunganzüge und Wingsuits für jede Disziplin'),
  (cat_accessories,'en', 'Accessories','Altimeters, pilot chutes, containers and more'),
  (cat_accessories,'ar', 'الإكسسوارات','مقاييس ارتفاع ومظلات تجريبية وحقائب والمزيد'),
  (cat_accessories,'es', 'Accesorios', 'Altímetros, pilotos, contenedores y más'),
  (cat_accessories,'de', 'Zubehör',    'Höhenmesser, Pilotschirme, Container und mehr')
ON CONFLICT (category_id, language) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description;

-- ─── 2. Update Products with New Columns ──────────────────────────────────────

UPDATE products SET
  slug = 'aerox-full-face-helmet',
  category_id = cat_helmets,
  main_image = image_url,
  images = jsonb_build_array(image_url,
    'https://images.pexels.com/photos/163236/luxury-watch-watches-business-fashion-163236.jpeg?auto=compress&cs=tinysrgb&w=800'),
  featured = is_featured,
  status = 'active',
  sku = 'AXF-HLM-BL',
  compare_price = 529.00,
  specifications = '{"sizes":["S","M","L","XL"],"visor":"Dual-pane anti-fog","material":"Carbon fiber shell","weight":"520g","audio":"Ready"}'::jsonb,
  updated_at = now()
WHERE id = prod_helmet AND slug IS NULL;

UPDATE products SET
  slug = 'highlight-x3-canopy',
  category_id = cat_parachutes,
  main_image = image_url,
  images = jsonb_build_array(image_url,
    'https://images.pexels.com/photos/2041752/pexels-photo-2041752.jpeg?auto=compress&cs=tinysrgb&w=800'),
  featured = is_featured,
  status = 'active',
  sku = 'HLX3-CNP-BL',
  compare_price = 2599.00,
  specifications = '{"size":"190 sq ft","cell_count":"9","wing_loading":"1.1:1","packing_volume":"340 cu in","weight":"5.8 lbs","material":"ZP"}'::jsonb,
  updated_at = now()
WHERE id = prod_canopy AND slug IS NULL;

UPDATE products SET
  slug = 'neoair-goggles-pro',
  category_id = cat_helmets,
  main_image = image_url,
  images = jsonb_build_array(image_url),
  featured = is_featured,
  status = 'active',
  sku = 'NGP-GGL-BL',
  compare_price = 99.00,
  specifications = '{"lens":"Polycarbonate UV400","frame":"Silicone grip","vent":"Anti-fog vents","fit":"Universal"}'::jsonb,
  updated_at = now()
WHERE id = prod_goggles AND slug IS NULL;

UPDATE products SET
  slug = 'phantom-x-jumpsuit',
  category_id = cat_suits,
  main_image = image_url,
  images = jsonb_build_array(image_url,
    'https://images.pexels.com/photos/1152077/pexels-photo-1152077.jpeg?auto=compress&cs=tinysrgb&w=800'),
  featured = is_featured,
  status = 'active',
  sku = 'PHX-JMP-BL',
  compare_price = 429.00,
  specifications = '{"material":"Cordura + Spandex","sizes":["XS","S","M","L","XL","XXL"],"pockets":"4","bootie":"Detachable"}'::jsonb,
  updated_at = now()
WHERE id = prod_jumpsuit AND slug IS NULL;

UPDATE products SET
  slug = 'skydive-pro-altimeter',
  category_id = cat_accessories,
  main_image = image_url,
  images = jsonb_build_array(image_url),
  featured = is_featured,
  status = 'active',
  sku = 'SDP-ALT-BL',
  compare_price = 249.00,
  specifications = '{"display":"Analog","range":"0-15000 ft","case":"Anodized aluminum","wrist":"Universal mount"}'::jsonb,
  updated_at = now()
WHERE id = prod_alti1 AND slug IS NULL;

UPDATE products SET
  slug = 'skysnatch-pilot-chute',
  category_id = cat_accessories,
  main_image = image_url,
  images = jsonb_build_array(image_url),
  featured = is_featured,
  status = 'active',
  sku = 'SKS-PLT-BL',
  compare_price = 109.00,
  specifications = '{"size":"36 inch","material":"Mesh + ZP","handle":"Hackey style","compatibility":"Universal"}'::jsonb,
  updated_at = now()
WHERE id = prod_chute AND slug IS NULL;

UPDATE products SET
  slug = 'vector-3-rig-container',
  category_id = cat_accessories,
  main_image = image_url,
  images = jsonb_build_array(image_url,
    'https://images.pexels.com/photos/257816/pexels-photo-257816.jpeg?auto=compress&cs=tinysrgb&w=800'),
  featured = true,
  is_featured = true,
  status = 'active',
  sku = 'V3R-CNT-BL',
  compare_price = 2299.00,
  specifications = '{"compatibility":"AAD ready","reserve_size":"218-253 sq ft","main_size":"107-190 sq ft","weight":"7.0 lbs"}'::jsonb,
  updated_at = now()
WHERE id = prod_rig AND slug IS NULL;

UPDATE products SET
  slug = 'viso-ii-digital-altimeter',
  category_id = cat_accessories,
  main_image = image_url,
  images = jsonb_build_array(image_url),
  featured = is_featured,
  status = 'active',
  sku = 'VS2-DAL-BL',
  compare_price = 199.00,
  specifications = '{"display":"Digital LCD","range":"0-29500 ft","modes":"Speed + altitude","battery":"CR2032","wrist":"Universal"}'::jsonb,
  updated_at = now()
WHERE id = prod_alti2 AND slug IS NULL;

-- ─── 3. Product Translations ──────────────────────────────────────────────────

INSERT INTO product_translations (product_id, language, name, short_description, full_description, meta_title, meta_description) VALUES
  -- AeroX Full-Face Helmet
  (prod_helmet, 'en', 'AeroX Full-Face Helmet',
   'Carbon fiber full-face skydiving helmet with anti-fog dual-pane visor.',
   'The AeroX is the pinnacle of skydiving helmet technology. Its carbon fiber shell keeps weight to a minimum while providing superior protection. The dual-pane anti-fog visor ensures crystal clear vision from exit to landing. Audio-ready with integrated channels for communication systems.',
   'AeroX Full-Face Helmet | Skydiving Safety Gear', 'Buy the AeroX full-face carbon fiber helmet. Dual-pane anti-fog visor, audio ready.'),
  (prod_helmet, 'ar', 'خوذة إيرو إكس بوجه كامل',
   'خوذة قفز بالمظلة بوجه كامل من ألياف الكربون مع زجاج مزدوج مضاد للضباب.',
   'تمثل خوذة إيرو إكس قمة تقنية خوذات القفز بالمظلة. تحافظ قشرتها من ألياف الكربون على وزن منخفض مع توفير حماية فائقة.',
   'خوذة إيرو إكس بوجه كامل | معدات السلامة', 'اشترِ خوذة إيرو إكس بوجه كامل من ألياف الكربون.'),
  (prod_helmet, 'es', 'Casco AeroX de Cara Completa',
   'Casco de fibra de carbono con visera de doble panel anti-vaho.',
   'El AeroX es el pináculo de la tecnología de cascos de paracaidismo. Su carcasa de fibra de carbono mantiene el peso mínimo mientras proporciona protección superior.',
   'Casco AeroX Cara Completa | Equipo de Seguridad', 'Compra el casco AeroX de fibra de carbono. Visera doble anti-vaho.'),
  (prod_helmet, 'de', 'AeroX Vollvisierhelm',
   'Vollvisierhelm aus Kohlefaser mit beschlaghemmender Doppelscheibe.',
   'Der AeroX ist der Gipfel der Fallschirmspringerhelm-Technologie. Seine Kohlefaserschale hält das Gewicht minimal bei überlegener Schutzwirkung.',
   'AeroX Vollvisierhelm | Sicherheitsausrüstung', 'Kaufen Sie den AeroX Kohlefaser-Vollvisierhelm.'),

  -- Highlight X3 Canopy
  (prod_canopy, 'en', 'Highlight X3 Canopy',
   '9-cell high-performance parachute canopy for intermediate to expert skydivers.',
   'The Highlight X3 delivers an outstanding balance of openings, glide ratio, and responsiveness. Its 9-cell design uses zero-porosity fabric for long-lasting performance and consistent deployments.',
   'Highlight X3 Canopy | Performance Parachutes', 'Buy the Highlight X3 canopy. 9-cell ZP design for intermediate to expert skydivers.'),
  (prod_canopy, 'ar', 'مظلة هايلايت إكس3',
   'مظلة بارشوت عالية الأداء من 9 خلايا للهواة المتوسطين والمحترفين.',
   'توفر مظلة هايلايت إكس3 توازناً رائعاً بين الفتحات ونسبة الانزلاق والاستجابة.',
   'مظلة هايلايت إكس3 | مظلات عالية الأداء', 'اشترِ مظلة هايلايت إكس3.'),
  (prod_canopy, 'es', 'Paracaídas Highlight X3',
   'Paracaídas de 9 celdas de alto rendimiento para skydivers de intermedio a experto.',
   'El Highlight X3 ofrece un equilibrio sobresaliente de aperturas, relación de planeo y capacidad de respuesta.',
   'Paracaídas Highlight X3 | Paracaídas de Rendimiento', 'Compra el paracaídas Highlight X3.'),
  (prod_canopy, 'de', 'Highlight X3 Fallschirm',
   '9-Zellen-Hochleistungsschirm für mittlere bis erfahrene Fallschirmspringer.',
   'Der Highlight X3 bietet eine herausragende Balance aus Öffnungen, Gleitzahl und Reaktionsfähigkeit.',
   'Highlight X3 Schirm | Hochleistungsschirme', 'Kaufen Sie den Highlight X3 Schirm.'),

  -- NeoAir Goggles Pro
  (prod_goggles, 'en', 'NeoAir Goggles Pro',
   'UV400 polycarbonate skydiving goggles with anti-fog vents.',
   'The NeoAir Goggles Pro feature a UV400 polycarbonate lens with anti-scratch coating. The silicone frame grip prevents slippage during freefall. Compatible with most helmets.',
   'NeoAir Goggles Pro | Skydiving Goggles', 'Buy NeoAir Goggles Pro. UV400 polycarbonate lens, anti-fog design.'),
  (prod_goggles, 'ar', 'نظارات نيو إير برو',
   'نظارات قفز بالمظلة من بولي كربونات UV400 مع فتحات مضادة للضباب.',
   'تتميز نظارات نيو إير برو بعدسة بولي كربونات UV400 مع طلاء مضاد للخدش.',
   'نظارات نيو إير برو | نظارات القفز بالمظلة', 'اشترِ نظارات نيو إير برو.'),
  (prod_goggles, 'es', 'Gafas NeoAir Pro',
   'Gafas de paracaidismo de policarbonato UV400 con ventilación anti-vaho.',
   'Las Gafas NeoAir Pro presentan una lente de policarbonato UV400 con revestimiento anti-rayaduras.',
   'Gafas NeoAir Pro | Gafas de Paracaidismo', 'Compra las Gafas NeoAir Pro.'),
  (prod_goggles, 'de', 'NeoAir Pro Schutzbrille',
   'UV400-Polycarbonat-Schutzbrille mit beschlaghemmenden Lüftungsschlitzen.',
   'Die NeoAir Pro Schutzbrille verfügt über eine UV400-Polycarbonat-Linse mit Kratzschutz.',
   'NeoAir Pro Schutzbrille | Fallschirmspringer-Schutzbrille', 'Kaufen Sie die NeoAir Pro Schutzbrille.'),

  -- Phantom X Jumpsuit
  (prod_jumpsuit, 'en', 'Phantom X Jumpsuit',
   'Cordura and Spandex freefall jumpsuit with detachable booties.',
   'The Phantom X Jumpsuit is built for RW and freefly disciplines. Durable Cordura outer panels combine with Spandex side panels for optimal freedom of movement. Four deep cargo pockets and detachable booties.',
   'Phantom X Jumpsuit | Skydiving Suits', 'Buy the Phantom X jumpsuit. Cordura + Spandex, detachable booties.'),
  (prod_jumpsuit, 'ar', 'بدلة فانتوم إكس',
   'بدلة قفز حر من كوردورا وسباندكس مع أحذية قابلة للفصل.',
   'بُنيت بدلة فانتوم إكس لتخصصات العمل النسبي والطيران الحر.',
   'بدلة فانتوم إكس | بدلات القفز بالمظلة', 'اشترِ بدلة فانتوم إكس.'),
  (prod_jumpsuit, 'es', 'Mono Phantom X',
   'Mono de caída libre de Cordura y Spandex con botines desmontables.',
   'El Mono Phantom X está construido para disciplinas RW y freefly.',
   'Mono Phantom X | Trajes de Paracaidismo', 'Compra el Mono Phantom X.'),
  (prod_jumpsuit, 'de', 'Phantom X Sprunganzug',
   'Cordura und Spandex Freifallanzug mit abnehmbaren Booties.',
   'Der Phantom X Sprunganzug ist für RW- und Freefly-Disziplinen gebaut.',
   'Phantom X Sprunganzug | Fallschirmspringerbekleidung', 'Kaufen Sie den Phantom X Sprunganzug.'),

  -- SkyDive Pro Altimeter
  (prod_alti1, 'en', 'SkyDive Pro Altimeter',
   'Analog wrist altimeter with anodized aluminum case, reads to 15,000 ft.',
   'The SkyDive Pro Altimeter features a large, easy-to-read analog dial with luminescent markings for low-light jumps. Anodized aircraft-grade aluminum case is corrosion resistant. Universal wrist mount fits over most gloves.',
   'SkyDive Pro Altimeter | Skydiving Instruments', 'Buy the SkyDive Pro altimeter. Analog, 15000 ft range, luminescent dial.'),
  (prod_alti1, 'ar', 'مقياس ارتفاع سكاي دايف برو',
   'مقياس ارتفاع تناظري على المعصم بعلبة ألومنيوم مؤكسدة، يقرأ حتى 15000 قدم.',
   'يتميز مقياس ارتفاع سكاي دايف برو بمؤشر تناظري كبير سهل القراءة مع علامات مضيئة.',
   'مقياس ارتفاع سكاي دايف برو | أجهزة القفز', 'اشترِ مقياس ارتفاع سكاي دايف برو.'),
  (prod_alti1, 'es', 'Altímetro SkyDive Pro',
   'Altímetro de muñeca analógico con carcasa de aluminio anodizado, hasta 15.000 ft.',
   'El Altímetro SkyDive Pro presenta un gran dial analógico con marcas luminiscentes.',
   'Altímetro SkyDive Pro | Instrumentos de Paracaidismo', 'Compra el altímetro SkyDive Pro.'),
  (prod_alti1, 'de', 'SkyDive Pro Höhenmesser',
   'Analoger Handgelenk-Höhenmesser mit eloxiertem Aluminiumgehäuse, bis 15.000 ft.',
   'Der SkyDive Pro Höhenmesser verfügt über ein großes, leicht lesbares Analogzifferblatt mit Leuchtmarkierungen.',
   'SkyDive Pro Höhenmesser | Fallschirminstrumente', 'Kaufen Sie den SkyDive Pro Höhenmesser.'),

  -- SkySnatch Pilot Chute
  (prod_chute, 'en', 'SkySnatch Pilot Chute',
   '36-inch mesh and ZP pilot chute with hackey-style handle.',
   'The SkySnatch Pilot Chute delivers fast, reliable deployments in all conditions. 36-inch diameter combines mesh and zero-porosity panels for consistent inflation. Hackey handle is soft and grippy.',
   'SkySnatch Pilot Chute | Skydiving Deployment', 'Buy the SkySnatch pilot chute. 36-inch, mesh + ZP, hackey handle.'),
  (prod_chute, 'ar', 'مظلة سكاي سناتش التجريبية',
   'مظلة تجريبية شبكية وZP مقاس 36 بوصة بمقبض هاكي.',
   'توفر مظلة سكاي سناتش التجريبية عمليات نشر سريعة وموثوقة في جميع الأحوال.',
   'مظلة سكاي سناتش التجريبية | معدات القفز', 'اشترِ مظلة سكاي سناتش التجريبية.'),
  (prod_chute, 'es', 'Piloto SkySnatch',
   'Piloto de 36 pulgadas de malla y ZP con asa tipo hackey.',
   'El SkySnatch ofrece despliegues rápidos y confiables en todas las condiciones.',
   'Piloto SkySnatch | Despliegue de Paracaidismo', 'Compra el piloto SkySnatch.'),
  (prod_chute, 'de', 'SkySnatch Pilotschirm',
   '36-Zoll-Mesh-und-ZP-Pilotschirm mit Hackey-Griff.',
   'Der SkySnatch Pilotschirm liefert schnelle, zuverlässige Öffnungen bei allen Bedingungen.',
   'SkySnatch Pilotschirm | Fallschirmöffnung', 'Kaufen Sie den SkySnatch Pilotschirm.'),

  -- Vector 3 Rig Container
  (prod_rig, 'en', 'Vector 3 Rig Container',
   'Industry-standard AAD-compatible harness and container system.',
   'The Vector 3 is the rig trusted by skydivers worldwide. Its 3-ring release system, RSL compatibility, and custom sizing options make it the most versatile container system available. Accommodates mains from 107 to 190 sq ft.',
   'Vector 3 Rig Container | Harness Systems', 'Buy the Vector 3 rig. AAD ready, RSL compatible, custom sizing.'),
  (prod_rig, 'ar', 'حقيبة فيكتور 3',
   'نظام تسخير وحقيبة معياري الصناعة متوافق مع AAD.',
   'حقيبة فيكتور 3 هي الحقيبة التي يثق بها المظليون حول العالم.',
   'حقيبة فيكتور 3 | أنظمة التسخير', 'اشترِ حقيبة فيكتور 3. جاهزة لـ AAD.'),
  (prod_rig, 'es', 'Contenedor Vector 3',
   'Sistema de arnés y contenedor compatible con AAD, estándar de la industria.',
   'El Vector 3 es el rig de confianza de los paracaidistas de todo el mundo.',
   'Contenedor Vector 3 | Sistemas de Arnés', 'Compra el contenedor Vector 3.'),
  (prod_rig, 'de', 'Vector 3 Rig Container',
   'Branchenstandard AAD-kompatibler Gurtsystem und Container.',
   'Der Vector 3 ist das Rig, dem Fallschirmspringer weltweit vertrauen.',
   'Vector 3 Rig Container | Gurtsysteme', 'Kaufen Sie den Vector 3 Rig.'),

  -- Viso II Digital Altimeter
  (prod_alti2, 'en', 'Viso II Digital Altimeter',
   'Digital wrist altimeter with speed mode, reads to 29,500 ft.',
   'The Viso II combines altitude and speed measurement in a sleek digital display. Speed mode shows real-time freefall speed in MPH or km/h. Stores up to 200 jumps with date, altitude and speed data.',
   'Viso II Digital Altimeter | Digital Instruments', 'Buy the Viso II digital altimeter. Speed + altitude, 29500 ft range, stores 200 jumps.'),
  (prod_alti2, 'ar', 'مقياس ارتفاع فيزو الثاني الرقمي',
   'مقياس ارتفاع رقمي على المعصم مع وضع السرعة، يقرأ حتى 29500 قدم.',
   'يجمع فيزو الثاني بين قياس الارتفاع والسرعة في شاشة رقمية أنيقة.',
   'مقياس ارتفاع فيزو الثاني الرقمي | أجهزة رقمية', 'اشترِ مقياس ارتفاع فيزو الثاني الرقمي.'),
  (prod_alti2, 'es', 'Altímetro Digital Viso II',
   'Altímetro de muñeca digital con modo velocidad, hasta 29.500 ft.',
   'El Viso II combina medición de altitud y velocidad en una elegante pantalla digital.',
   'Altímetro Digital Viso II | Instrumentos Digitales', 'Compra el altímetro digital Viso II.'),
  (prod_alti2, 'de', 'Viso II Digital-Höhenmesser',
   'Digitaler Handgelenk-Höhenmesser mit Geschwindigkeitsmodus, bis 29.500 ft.',
   'Der Viso II kombiniert Höhen- und Geschwindigkeitsmessung in einem schlanken digitalen Display.',
   'Viso II Digital-Höhenmesser | Digitale Instrumente', 'Kaufen Sie den Viso II Digital-Höhenmesser.')
ON CONFLICT (product_id, language) DO UPDATE SET
  name              = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  full_description  = EXCLUDED.full_description,
  meta_title        = EXCLUDED.meta_title,
  meta_description  = EXCLUDED.meta_description;

-- ─── 4. CMS Content ───────────────────────────────────────────────────────────

INSERT INTO cms_content (language, logo, hero_title, hero_subtitle, hero_button_text, hero_image, featured_title, canopy_title, canopy_description, testimonial_title, footer_text) VALUES
  ('en', '',
   'Gear Trusted by Skydivers Worldwide',
   'Premium parachutes, helmets, jumpsuits and accessories from the world''s top manufacturers. Free shipping on orders over $500.',
   'Shop Now',
   'https://images.pexels.com/photos/1271375/pexels-photo-1271375.jpeg?auto=compress&cs=tinysrgb&w=1200',
   'Featured Gear',
   'Find Your Perfect Canopy',
   'Answer a few questions about your experience level and discipline. Our Canopy Finder will recommend the ideal parachute for you.',
   'What Skydivers Say',
   '© 2026 SkydiverGear. All rights reserved. Professional skydiving equipment.'),
  ('ar', '',
   'معدات يثق بها المظليون في جميع أنحاء العالم',
   'مظلات وخوذات وبدلات وإكسسوارات متميزة من أفضل المصنعين في العالم. شحن مجاني للطلبات فوق 500 دولار.',
   'تسوق الآن',
   'https://images.pexels.com/photos/1271375/pexels-photo-1271375.jpeg?auto=compress&cs=tinysrgb&w=1200',
   'المعدات المميزة',
   'اعثر على مظلتك المثالية',
   'أجب على بعض الأسئلة حول مستوى خبرتك. سيوصي محدد المظلة بالمظلة المثالية لك.',
   'ما يقوله المظليون',
   '© 2026 سكايدايفر جير. جميع الحقوق محفوظة.'),
  ('es', '',
   'Equipo de Confianza para Paracaidistas en Todo el Mundo',
   'Paracaídas, cascos, monos y accesorios premium de los mejores fabricantes. Envío gratuito en pedidos superiores a $500.',
   'Comprar Ahora',
   'https://images.pexels.com/photos/1271375/pexels-photo-1271375.jpeg?auto=compress&cs=tinysrgb&w=1200',
   'Equipo Destacado',
   'Encuentra tu Paracaídas Perfecto',
   'Responde preguntas sobre tu nivel de experiencia. Nuestro selector te recomendará el paracaídas ideal.',
   'Lo que Dicen los Paracaidistas',
   '© 2026 SkydiverGear. Todos los derechos reservados.'),
  ('de', '',
   'Ausrüstung, der Fallschirmspringer weltweit vertrauen',
   'Premium-Schirme, Helme, Sprunganzüge und Zubehör von den weltbesten Herstellern. Kostenloser Versand ab $500.',
   'Jetzt Einkaufen',
   'https://images.pexels.com/photos/1271375/pexels-photo-1271375.jpeg?auto=compress&cs=tinysrgb&w=1200',
   'Empfohlene Ausrüstung',
   'Finden Sie Ihren perfekten Schirm',
   'Beantworten Sie Fragen zu Ihrem Erfahrungsstand. Unser Schirmfinder empfiehlt den idealen Schirm für Sie.',
   'Was Fallschirmspringer sagen',
   '© 2026 SkydiverGear. Alle Rechte vorbehalten.')
ON CONFLICT (language) DO UPDATE SET
  hero_title         = EXCLUDED.hero_title,
  hero_subtitle      = EXCLUDED.hero_subtitle,
  hero_button_text   = EXCLUDED.hero_button_text,
  hero_image         = EXCLUDED.hero_image,
  featured_title     = EXCLUDED.featured_title,
  canopy_title       = EXCLUDED.canopy_title,
  canopy_description = EXCLUDED.canopy_description,
  testimonial_title  = EXCLUDED.testimonial_title,
  footer_text        = EXCLUDED.footer_text,
  updated_at         = now();

-- ─── 5. Theme Settings (key-value via site_settings) ──────────────────────────

INSERT INTO site_settings (key, value) VALUES
  ('theme_primary_color',         '#00BFFF'),
  ('theme_secondary_color',       '#0D1E35'),
  ('theme_accent_color',          '#FFD700'),
  ('theme_button_color',          '#00BFFF'),
  ('theme_button_text_color',     '#050A14'),
  ('theme_background_color',      '#050A14'),
  ('theme_card_background_color', '#0D1E35'),
  ('theme_border_color',          'rgba(0,191,255,0.15)'),
  ('theme_glow_color',            'rgba(0,191,255,0.08)'),
  ('theme_text_primary_color',    '#E8F4FD'),
  ('theme_text_secondary_color',  '#7EB5D6'),
  ('theme_warning_color',         '#FFB300'),
  ('theme_success_color',         '#00E676'),
  ('theme_active_preset',         'midnight-blue')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

END $$;
