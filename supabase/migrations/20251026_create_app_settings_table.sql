-- Create a simple key/value settings table for small app-wide settings
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamp with time zone DEFAULT now()
);

-- Example: insert an empty support_whatsapp key if you want a default
-- INSERT INTO app_settings (key, value) VALUES ('support_whatsapp', '+91 XXXXX XXXXX') ON CONFLICT (key) DO NOTHING;
