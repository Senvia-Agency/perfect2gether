INSERT INTO organization_members (user_id, organization_id, role, is_active, joined_at)
VALUES ('44a688ac-7124-4446-8f4d-1291782120d3', '96a3950e-31be-4c6d-abed-b82968c0d7e9', 'salesperson', true, now())
ON CONFLICT DO NOTHING;