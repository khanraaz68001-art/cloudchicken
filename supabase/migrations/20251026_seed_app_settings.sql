-- Seed common app settings (idempotent)
INSERT INTO app_settings (key, value)
VALUES
  ('support_whatsapp', '+91 XXXXX XXXXX')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value)
VALUES
  ('support_email', 'info@cloudchicken.com')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value)
VALUES
  ('support_location', 'Bangalore, India')
ON CONFLICT (key) DO NOTHING;

-- Note: support_location_embed intentionally left empty; admin can paste iframe HTML via the dashboard
