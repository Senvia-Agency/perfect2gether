alter role authenticator set pgrst.db_pre_request = 'public.enforce_p2g_mfa';
notify pgrst, 'reload config';
