INSERT INTO organization_members (user_id, organization_id, role, is_active, joined_at)
VALUES 
  ('76300665-aff2-4b54-be78-b1123356e6ce', '96a3950e-31be-4c6d-abed-b82968c0d7e9', 'salesperson', true, now()),
  ('f96eca52-5546-45d5-839b-bb2a255f9549', '96a3950e-31be-4c6d-abed-b82968c0d7e9', 'viewer', true, now()),
  ('f54baad9-0482-4f73-8040-f4d1cf370f84', '96a3950e-31be-4c6d-abed-b82968c0d7e9', 'salesperson', true, now())
ON CONFLICT DO NOTHING;