ALTER TABLE organizations ADD COLUMN billing_exempt BOOLEAN DEFAULT false;
UPDATE organizations SET billing_exempt = true
WHERE id IN ('06fe9e1d-9670-45b0-8717-c5a6e90be380', '96a3950e-31be-4c6d-abed-b82968c0d7e9');