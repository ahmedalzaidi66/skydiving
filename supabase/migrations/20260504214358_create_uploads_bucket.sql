/*
  # Create 'uploads' storage bucket for used gear images

  Creates a public 'uploads' bucket for storing used gear listing images.
  Also adds RLS storage policies so authenticated users can upload,
  and anyone can read (public bucket).
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  true,
  10485760,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated users to upload to uploads bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload to uploads' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Authenticated users can upload to uploads"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'uploads');
  END IF;
END $$;

-- Allow public read on uploads bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public read access for uploads' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Public read access for uploads"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'uploads');
  END IF;
END $$;

-- Allow owners to delete their uploads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own uploads' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can delete own uploads"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'uploads' AND auth.uid() = owner);
  END IF;
END $$;
