
CREATE TABLE public.app_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  version text,
  image_url text,
  published_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active announcements"
  ON public.app_announcements
  FOR SELECT
  TO authenticated
  USING (is_active = true);
