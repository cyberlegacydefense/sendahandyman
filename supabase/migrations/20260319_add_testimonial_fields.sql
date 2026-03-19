-- Add testimonial fields to buildings table
-- Allows each building to have its own testimonial with optional building attribution

ALTER TABLE buildings
ADD COLUMN IF NOT EXISTS testimonial_text TEXT,
ADD COLUMN IF NOT EXISTS testimonial_author TEXT,
ADD COLUMN IF NOT EXISTS testimonial_is_resident BOOLEAN DEFAULT false;

-- Add comments
COMMENT ON COLUMN buildings.testimonial_text IS 'Customer testimonial/review text';
COMMENT ON COLUMN buildings.testimonial_author IS 'First name of the reviewer';
COMMENT ON COLUMN buildings.testimonial_is_resident IS 'If true, shows "[Building] Resident"; if false, shows "Verified Customer"';

-- Set default testimonial for Lumaire (Matthew's actual building)
UPDATE buildings
SET
  testimonial_text = 'I was very impressed with the gentleman who was very prompt meeting the appointment time setting. Zachary was very professional and brought all the tools necessary to complete the job, which he did very well.',
  testimonial_author = 'Matthew',
  testimonial_is_resident = true
WHERE slug = 'lumaire';
