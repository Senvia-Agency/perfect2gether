BEGIN;
CREATE SCHEMA IF NOT EXISTS p2g_chat_private;
REVOKE ALL ON SCHEMA p2g_chat_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA p2g_chat_private TO authenticated;
CREATE TABLE public.p2g_chat_settings (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), max_file_bytes bigint NOT NULL CHECK(max_file_bytes>0));
INSERT INTO public.p2g_chat_settings VALUES(true,52428800);
COMMENT ON TABLE public.p2g_chat_settings IS 'Deployment operator must set max_file_bytes to the actual global Storage upload limit; bucket inherits global limit.';
CREATE TABLE public.p2g_chat_conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id), kind text NOT NULL CHECK(kind IN ('direct','group','announcement')),title text NOT NULL CHECK(length(title)<=200),direct_key text,updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,direct_key));
CREATE TABLE public.p2g_chat_members(conversation_id uuid REFERENCES public.p2g_chat_conversations(id) ON DELETE CASCADE,user_id uuid NOT NULL,role text NOT NULL CHECK(role IN ('owner','member')),last_read_at timestamptz,typing_until timestamptz,online_at timestamptz,joined_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(conversation_id,user_id));
CREATE TABLE public.p2g_chat_preferences(conversation_id uuid REFERENCES public.p2g_chat_conversations(id) ON DELETE CASCADE,user_id uuid NOT NULL,pinned boolean NOT NULL DEFAULT false,muted boolean NOT NULL DEFAULT false,archived boolean NOT NULL DEFAULT false,PRIMARY KEY(conversation_id,user_id));
CREATE TABLE public.p2g_chat_messages(id uuid PRIMARY KEY,conversation_id uuid NOT NULL REFERENCES public.p2g_chat_conversations(id),sender_id uuid NOT NULL,body text NOT NULL CHECK(length(body)<=4000),created_at timestamptz NOT NULL DEFAULT now(),edited_at timestamptz,deleted_at timestamptz,reply_to uuid REFERENCES public.p2g_chat_messages(id),forwarded boolean NOT NULL DEFAULT false,pinned boolean NOT NULL DEFAULT false);
CREATE TABLE public.p2g_chat_saved(message_id uuid REFERENCES public.p2g_chat_messages(id),user_id uuid NOT NULL,PRIMARY KEY(message_id,user_id));
CREATE TABLE public.p2g_chat_push_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid NOT NULL,message_id uuid NOT NULL,user_id uuid NOT NULL,organization_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),delivered_at timestamptz,attempts integer NOT NULL DEFAULT 0,UNIQUE(message_id,user_id));
CREATE TABLE public.p2g_chat_file_cleanup(path text PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,attempts integer NOT NULL DEFAULT 0,last_error text);
CREATE INDEX ON public.p2g_chat_messages(conversation_id,created_at DESC);
CREATE TABLE public.p2g_chat_attachments(id uuid PRIMARY KEY,message_id uuid NOT NULL REFERENCES public.p2g_chat_messages(id),path text NOT NULL UNIQUE,name text NOT NULL,mime text NOT NULL,size bigint NOT NULL CHECK(size>=0));
CREATE TABLE public.p2g_chat_reactions(message_id uuid REFERENCES public.p2g_chat_messages(id),user_id uuid NOT NULL,emoji text NOT NULL CHECK(length(emoji) BETWEEN 1 AND 32),PRIMARY KEY(message_id,user_id,emoji));
CREATE FUNCTION p2g_chat_private.active(org uuid,usr uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=org AND user_id=usr AND is_active) $$;
CREATE FUNCTION p2g_chat_private.allowed(conv uuid,writable boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
IF auth.uid() IS NULL THEN RETURN false; END IF;
IF to_regprocedure('public.p2g_mfa_required()') IS NOT NULL THEN
IF public.p2g_mfa_required() AND coalesce(auth.jwt()->>'aal','')<>'aal2' THEN RETURN false; END IF; END IF;
RETURN EXISTS(SELECT 1 FROM public.p2g_chat_members m JOIN public.p2g_chat_conversations c ON c.id=m.conversation_id WHERE c.id=conv AND m.user_id=auth.uid() AND p2g_chat_private.active(c.organization_id,auth.uid()) AND (NOT writable OR c.kind<>'announcement' OR m.role='owner')); END $$;
CREATE FUNCTION p2g_chat_private.visible(mid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.p2g_chat_messages x JOIN public.p2g_chat_members m ON m.conversation_id=x.conversation_id AND m.user_id=auth.uid() WHERE x.id=mid AND x.created_at>=m.joined_at AND p2g_chat_private.allowed(x.conversation_id)) $$;
CREATE FUNCTION p2g_chat_private.announce(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT p2g_chat_private.active(org,auth.uid()) AND (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN('admin','super_admin')) OR EXISTS(SELECT 1 FROM public.organization_members m JOIN public.organization_profiles p ON p.id=m.profile_id AND p.organization_id=m.organization_id WHERE m.organization_id=org AND m.user_id=auth.uid() AND p.base_role::text='admin')) $$;
CREATE FUNCTION p2g_chat_private.message_json(msg public.p2g_chat_messages) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT jsonb_build_object('id',msg.id,'conversation_id',msg.conversation_id,'sender_id',msg.sender_id,'body',CASE WHEN msg.deleted_at IS NULL THEN msg.body ELSE '' END,'created_at',msg.created_at,'edited_at',msg.edited_at,'deleted_at',msg.deleted_at,'reply_to',msg.reply_to,'forwarded',msg.forwarded,'pinned',msg.pinned,'saved',EXISTS(SELECT 1 FROM public.p2g_chat_saved WHERE message_id=msg.id AND user_id=auth.uid()),'attachments',CASE WHEN msg.deleted_at IS NULL THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'path',a.path,'name',a.name,'mime',a.mime,'size',a.size)) FROM public.p2g_chat_attachments a WHERE a.message_id=msg.id),'[]') ELSE '[]'::jsonb END,'reactions',coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',r.user_id,'emoji',r.emoji)) FROM public.p2g_chat_reactions r WHERE r.message_id=msg.id AND msg.deleted_at IS NULL),'[]')) $$;
CREATE FUNCTION p2g_chat_private.fold(t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT translate(lower(t),'áàãâäéèêëíìîïóòõôöúùûüç','aaaaaeeeeiiiiooooouuuuc') $$;
CREATE FUNCTION public.p2g_chat(action text,payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid(); org uuid; conv uuid; target uuid; other uuid; kind text; txt text; item jsonb; msg public.p2g_chat_messages; result jsonb; pair text; actual bigint; BEGIN
IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
IF to_regprocedure('public.p2g_mfa_required()') IS NOT NULL THEN IF public.p2g_mfa_required() AND coalesce(auth.jwt()->>'aal','')<>'aal2' THEN RAISE EXCEPTION 'MFA required'; END IF; END IF;
IF action IN('snapshot','search','create','saved') THEN org:=(payload->>'org')::uuid; IF NOT p2g_chat_private.active(org,uid) THEN RAISE EXCEPTION 'Active organization membership required'; END IF; END IF;
IF action='snapshot' THEN
SELECT jsonb_build_object('conversations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'organization_id',c.organization_id,'kind',c.kind,'title',c.title,'updated_at',c.updated_at,'pinned',coalesce(pref.pinned,false),'muted',coalesce(pref.muted,false),'archived',coalesce(pref.archived,false),'unread',(SELECT count(*) FROM public.p2g_chat_messages x WHERE x.conversation_id=c.id AND x.created_at>=me.joined_at AND x.sender_id<>uid AND x.deleted_at IS NULL AND x.created_at>coalesce(me.last_read_at,'-infinity')),'last_message',(SELECT CASE WHEN x.deleted_at IS NULL THEN x.body ELSE '' END FROM public.p2g_chat_messages x WHERE x.conversation_id=c.id AND x.created_at>=me.joined_at ORDER BY x.created_at DESC LIMIT 1),'members',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(p.full_name,'Utilizador'),'avatar',p.avatar_url,'role',m.role,'last_read_at',m.last_read_at,'typing_until',m.typing_until,'online_at',m.online_at)),'[]') FROM public.p2g_chat_members m LEFT JOIN public.profiles p ON p.id=m.user_id WHERE m.conversation_id=c.id AND p2g_chat_private.active(org,m.user_id)))) FROM public.p2g_chat_conversations c JOIN public.p2g_chat_members me ON me.conversation_id=c.id AND me.user_id=uid LEFT JOIN public.p2g_chat_preferences pref ON pref.conversation_id=c.id AND pref.user_id=uid WHERE c.organization_id=org),'[]'),'people',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(p.full_name,'Utilizador'),'avatar',p.avatar_url)) FROM public.organization_members m LEFT JOIN public.profiles p ON p.id=m.user_id WHERE m.organization_id=org AND m.is_active),'[]'),'can_announce',p2g_chat_private.announce(org),'max_file_bytes',(SELECT max_file_bytes FROM public.p2g_chat_settings)) INTO result; RETURN result;
ELSIF action='saved' THEN
RETURN coalesce((SELECT jsonb_agg(p2g_chat_private.message_json(x) ORDER BY x.created_at DESC) FROM public.p2g_chat_saved sv JOIN public.p2g_chat_messages x ON x.id=sv.message_id JOIN public.p2g_chat_conversations c ON c.id=x.conversation_id WHERE sv.user_id=uid AND c.organization_id=org AND x.deleted_at IS NULL AND p2g_chat_private.visible(x.id)),'[]');
ELSIF action='search' THEN
IF length(trim(coalesce(payload->>'query','')))=0 THEN RETURN '[]'; END IF;
RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('conversation_id',s.conversation_id,'message_id',s.id,'body',s.body)) FROM(SELECT x.* FROM public.p2g_chat_messages x JOIN public.p2g_chat_conversations c ON c.id=x.conversation_id WHERE c.organization_id=org AND p2g_chat_private.allowed(c.id) AND p2g_chat_private.visible(x.id) AND x.deleted_at IS NULL AND position(p2g_chat_private.fold(payload->>'query') IN p2g_chat_private.fold(x.body))>0 ORDER BY x.created_at DESC LIMIT 100)s),'[]');
ELSIF action='create' THEN
kind:=payload->>'kind'; txt:=trim(coalesce(payload->>'title','')); IF kind NOT IN('direct','group','announcement') OR length(txt)>200 OR (kind<>'direct' AND txt='') THEN RAISE EXCEPTION 'Invalid conversation'; END IF;
IF kind='announcement' AND NOT p2g_chat_private.announce(org) THEN RAISE EXCEPTION 'Administrator required'; END IF;
IF jsonb_typeof(payload->'participants')<>'array' THEN RAISE EXCEPTION 'Participants required'; END IF;
FOR item IN SELECT value FROM jsonb_array_elements(payload->'participants') LOOP IF NOT p2g_chat_private.active(org,(item#>>'{}')::uuid) THEN RAISE EXCEPTION 'Invalid participant'; END IF; END LOOP;
IF kind='direct' THEN SELECT min(v::text)::uuid INTO other FROM(SELECT DISTINCT (value#>>'{}')::uuid v FROM jsonb_array_elements(payload->'participants') WHERE (value#>>'{}')::uuid<>uid)s; IF other IS NULL OR (SELECT count(DISTINCT value#>>'{}') FROM jsonb_array_elements(payload->'participants') WHERE (value#>>'{}')::uuid<>uid)<>1 THEN RAISE EXCEPTION 'Direct needs one peer'; END IF; pair:=least(uid::text,other::text)||':'||greatest(uid::text,other::text); END IF;
INSERT INTO public.p2g_chat_conversations(organization_id,kind,title,direct_key) VALUES(org,kind,txt,pair) ON CONFLICT(organization_id,direct_key) DO UPDATE SET direct_key=excluded.direct_key RETURNING id INTO conv;
INSERT INTO public.p2g_chat_members(conversation_id,user_id,role) VALUES(conv,uid,'owner') ON CONFLICT DO NOTHING;
INSERT INTO public.p2g_chat_members(conversation_id,user_id,role) SELECT conv,(value#>>'{}')::uuid,'member' FROM jsonb_array_elements(payload->'participants') ON CONFLICT DO NOTHING; RETURN to_jsonb(conv);
END IF;
conv:=(payload->>'conversation')::uuid;
IF action IN('edit','delete','react','save','pin_message') THEN SELECT * INTO msg FROM public.p2g_chat_messages WHERE id=(payload->>'message')::uuid; conv:=msg.conversation_id; END IF;
IF action IN('edit','delete','react','save','pin_message') AND NOT p2g_chat_private.visible(msg.id) THEN RAISE EXCEPTION 'Message unavailable'; END IF;
IF NOT p2g_chat_private.allowed(conv,action IN('send','edit','delete','react')) THEN RAISE EXCEPTION 'Conversation access denied'; END IF;
PERFORM 1 FROM public.p2g_chat_conversations WHERE id=conv FOR UPDATE;
-- Membership and message state may change while waiting for the conversation lock.
-- Every operation below observes authorization and tombstones again under that lock.
IF NOT p2g_chat_private.allowed(conv,action IN('send','edit','delete','react')) THEN RAISE EXCEPTION 'Conversation access denied'; END IF;
IF action IN('edit','delete','react','save','pin_message') THEN
SELECT * INTO msg FROM public.p2g_chat_messages WHERE id=(payload->>'message')::uuid AND conversation_id=conv;
IF NOT FOUND OR NOT p2g_chat_private.visible(msg.id) THEN RAISE EXCEPTION 'Message unavailable'; END IF;
END IF;
SELECT organization_id INTO org FROM public.p2g_chat_conversations WHERE id=conv;
IF action='history' THEN
IF payload->>'around' IS NOT NULL THEN
IF NOT EXISTS(SELECT 1 FROM public.p2g_chat_messages WHERE id=(payload->>'around')::uuid AND conversation_id=conv AND p2g_chat_private.visible(id)) THEN RAISE EXCEPTION 'Message unavailable'; END IF;
RETURN coalesce((SELECT jsonb_agg(p2g_chat_private.message_json(s) ORDER BY s.created_at,s.id) FROM(SELECT x.* FROM public.p2g_chat_messages x WHERE x.conversation_id=conv AND p2g_chat_private.visible(x.id) AND (x.created_at,x.id)<=(SELECT t.created_at,t.id FROM public.p2g_chat_messages t WHERE t.id=(payload->>'around')::uuid) ORDER BY x.created_at DESC,x.id DESC LIMIT 60)s),'[]'); END IF;
RETURN coalesce((SELECT jsonb_agg(p2g_chat_private.message_json(s) ORDER BY s.created_at,s.id) FROM(SELECT x.* FROM public.p2g_chat_messages x WHERE x.conversation_id=conv AND p2g_chat_private.visible(x.id) AND ((payload->>'before') IS NULL OR x.created_at<(payload->>'before')::timestamptz) AND ((payload->>'search') IS NULL OR x.id::text=payload->>'search' OR (x.deleted_at IS NULL AND position(p2g_chat_private.fold(payload->>'search') IN p2g_chat_private.fold(x.body))>0)) ORDER BY x.created_at DESC,x.id DESC LIMIT 60)s),'[]');
ELSIF action='send' THEN
target:=(payload->>'id')::uuid; txt:=coalesce(payload->>'body',''); IF length(txt)>4000 OR (trim(txt)='' AND jsonb_array_length(coalesce(payload->'attachments','[]'))=0) THEN RAISE EXCEPTION 'Invalid message'; END IF;
SELECT * INTO msg FROM public.p2g_chat_messages WHERE id=target; IF FOUND THEN IF msg.sender_id<>uid OR msg.conversation_id<>conv THEN RAISE EXCEPTION 'Message id conflict'; END IF; RETURN p2g_chat_private.message_json(msg); END IF;
IF payload->>'reply_to' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.p2g_chat_messages WHERE id=(payload->>'reply_to')::uuid AND conversation_id=conv AND p2g_chat_private.visible(id)) THEN RAISE EXCEPTION 'Invalid reply'; END IF;
INSERT INTO public.p2g_chat_messages(id,conversation_id,sender_id,body,reply_to,forwarded) VALUES(target,conv,uid,txt,(payload->>'reply_to')::uuid,coalesce((payload->>'forwarded')::boolean,false)) RETURNING * INTO msg;
SELECT organization_id INTO org FROM public.p2g_chat_conversations WHERE id=conv;
FOR item IN SELECT value FROM jsonb_array_elements(coalesce(payload->'attachments','[]')) LOOP
IF item->>'path'<>org::text||'/'||conv::text||'/'||uid::text||'/'||target::text||'/'||(item->>'id')::uuid::text OR length(coalesce(item->>'name','')) NOT BETWEEN 1 AND 255 OR item->>'name' ~ '[[:cntrl:]/\\]' OR coalesce(item->>'mime','') !~ '^[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+$' THEN RAISE EXCEPTION 'Invalid attachment'; END IF;
SELECT (metadata->>'size')::bigint INTO actual FROM storage.objects WHERE bucket_id='p2g-chat-files' AND name=item->>'path' AND owner_id=uid::text AND metadata->>'mimetype'=item->>'mime';
IF actual IS NULL OR actual<0 OR actual<>(item->>'size')::bigint OR actual>(SELECT max_file_bytes FROM public.p2g_chat_settings) THEN RAISE EXCEPTION 'Attachment object mismatch'; END IF;
INSERT INTO public.p2g_chat_attachments VALUES((item->>'id')::uuid,target,item->>'path',item->>'name',item->>'mime',actual); END LOOP;
INSERT INTO public.p2g_chat_push_jobs(conversation_id,message_id,user_id,organization_id) SELECT conv,target,m.user_id,org FROM public.p2g_chat_members m LEFT JOIN public.p2g_chat_preferences p ON p.conversation_id=m.conversation_id AND p.user_id=m.user_id WHERE m.conversation_id=conv AND m.user_id<>uid AND p2g_chat_private.active(org,m.user_id) AND NOT coalesce(p.muted,false);
UPDATE public.p2g_chat_conversations SET updated_at=now() WHERE id=conv; RETURN p2g_chat_private.message_json(msg);
ELSIF action IN('edit','delete') THEN IF msg.sender_id<>uid OR msg.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Only own live messages'; END IF;
IF action='edit' THEN txt:=coalesce(payload->>'body',''); IF length(txt)>4000 OR (trim(txt)='' AND NOT EXISTS(SELECT 1 FROM public.p2g_chat_attachments WHERE message_id=msg.id)) THEN RAISE EXCEPTION 'Invalid body'; END IF; UPDATE public.p2g_chat_messages SET body=txt,edited_at=now() WHERE id=msg.id;
ELSE INSERT INTO public.p2g_chat_file_cleanup(path) SELECT path FROM public.p2g_chat_attachments WHERE message_id=msg.id ON CONFLICT DO NOTHING; UPDATE public.p2g_chat_messages SET body='',deleted_at=now() WHERE id=msg.id; END IF;
ELSIF action='react' THEN IF msg.deleted_at IS NOT NULL OR length(coalesce(payload->>'emoji','')) NOT BETWEEN 1 AND 32 THEN RAISE EXCEPTION 'Invalid reaction'; END IF; DELETE FROM public.p2g_chat_reactions WHERE message_id=msg.id AND user_id=uid AND emoji=payload->>'emoji'; IF NOT FOUND THEN INSERT INTO public.p2g_chat_reactions VALUES(msg.id,uid,payload->>'emoji'); END IF;
ELSIF action='save' THEN IF coalesce((payload->>'saved')::boolean,false) THEN INSERT INTO public.p2g_chat_saved VALUES(msg.id,uid) ON CONFLICT DO NOTHING; ELSE DELETE FROM public.p2g_chat_saved WHERE message_id=msg.id AND user_id=uid; END IF;
ELSIF action='pin_message' THEN IF NOT EXISTS(SELECT 1 FROM public.p2g_chat_members m JOIN public.p2g_chat_conversations c ON c.id=m.conversation_id WHERE m.conversation_id=conv AND m.user_id=uid AND (m.role='owner' OR c.kind='direct')) THEN RAISE EXCEPTION 'Owner required'; END IF; UPDATE public.p2g_chat_messages SET pinned=coalesce((payload->>'pinned')::boolean,false) WHERE id=msg.id;
ELSIF action='preferences' THEN INSERT INTO public.p2g_chat_preferences(conversation_id,user_id) VALUES(conv,uid) ON CONFLICT DO NOTHING; UPDATE public.p2g_chat_preferences SET pinned=coalesce((payload->>'pinned')::boolean,pinned),muted=coalesce((payload->>'muted')::boolean,muted),archived=coalesce((payload->>'archived')::boolean,archived) WHERE conversation_id=conv AND user_id=uid;
ELSIF action IN('read','typing','presence') THEN UPDATE public.p2g_chat_members SET last_read_at=CASE WHEN action='read' THEN now() ELSE last_read_at END,typing_until=CASE WHEN action='typing' THEN now()+interval '6 seconds' ELSE typing_until END,online_at=now() WHERE conversation_id=conv AND user_id=uid;
ELSIF action='manage' THEN
SELECT c.kind INTO kind FROM public.p2g_chat_conversations c WHERE c.id=conv; IF kind='direct' THEN RAISE EXCEPTION 'Direct membership immutable'; END IF;
other:=coalesce((payload->>'user')::uuid,uid);
IF payload->>'op'<>'leave' AND NOT EXISTS(SELECT 1 FROM public.p2g_chat_members WHERE conversation_id=conv AND user_id=uid AND role='owner') THEN RAISE EXCEPTION 'Owner required'; END IF;
IF payload->>'op'='rename' THEN txt:=trim(coalesce(payload->>'title','')); IF length(txt) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid title'; END IF; UPDATE public.p2g_chat_conversations SET title=txt WHERE id=conv;
ELSIF payload->>'op'='add' THEN SELECT organization_id INTO org FROM public.p2g_chat_conversations WHERE id=conv; IF NOT p2g_chat_private.active(org,other) THEN RAISE EXCEPTION 'Invalid participant'; END IF; INSERT INTO public.p2g_chat_members(conversation_id,user_id,role) VALUES(conv,other,'member') ON CONFLICT DO NOTHING;
ELSIF payload->>'op'='promote' THEN IF NOT p2g_chat_private.active(org,other) OR NOT EXISTS(SELECT 1 FROM public.p2g_chat_members WHERE conversation_id=conv AND user_id=other) THEN RAISE EXCEPTION 'Invalid participant'; END IF; UPDATE public.p2g_chat_members SET role='owner' WHERE conversation_id=conv AND user_id=other;
ELSIF payload->>'op' IN('remove','leave') THEN IF payload->>'op'='leave' THEN other:=uid; END IF; IF EXISTS(SELECT 1 FROM public.p2g_chat_members WHERE conversation_id=conv AND user_id=other AND role='owner') AND (SELECT count(*) FROM public.p2g_chat_members WHERE conversation_id=conv AND role='owner' AND p2g_chat_private.active(org,user_id))<=1 THEN RAISE EXCEPTION 'Promote another owner first'; END IF; DELETE FROM public.p2g_chat_members WHERE conversation_id=conv AND user_id=other;
ELSE RAISE EXCEPTION 'Unknown management operation'; END IF;
ELSE RAISE EXCEPTION 'Unknown chat action'; END IF; IF action IN('edit','delete','react','pin_message','manage') THEN UPDATE public.p2g_chat_conversations SET updated_at=now() WHERE id=conv; END IF; RETURN 'null'::jsonb; END $$;
CREATE FUNCTION p2g_chat_private.file_allowed(object_path text,upload boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE parts text[]:=string_to_array(object_path,'/'); conv uuid; BEGIN
IF array_length(parts,1)<>5 THEN RETURN false; END IF;
conv:=parts[2]::uuid;
IF NOT p2g_chat_private.allowed(conv,upload) OR NOT EXISTS(SELECT 1 FROM public.p2g_chat_conversations WHERE id=conv AND organization_id=parts[1]::uuid) THEN RETURN false; END IF;
PERFORM parts[4]::uuid,parts[5]::uuid;
IF upload THEN RETURN parts[3]=auth.uid()::text AND NOT EXISTS(SELECT 1 FROM public.p2g_chat_messages WHERE id=parts[4]::uuid); END IF;
RETURN EXISTS(SELECT 1 FROM public.p2g_chat_attachments a JOIN public.p2g_chat_messages m ON m.id=a.message_id WHERE a.path=object_path AND m.conversation_id=conv AND m.deleted_at IS NULL AND p2g_chat_private.visible(m.id)) OR (parts[3]=auth.uid()::text AND NOT EXISTS(SELECT 1 FROM public.p2g_chat_messages WHERE id=parts[4]::uuid));
EXCEPTION WHEN invalid_text_representation THEN RETURN false; END $$;
ALTER TABLE public.p2g_chat_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p2g_chat_saved ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p2g_chat_push_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p2g_chat_file_cleanup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.p2g_chat_preferences,public.p2g_chat_saved,public.p2g_chat_push_jobs,public.p2g_chat_file_cleanup FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.p2g_chat_preferences,public.p2g_chat_saved TO authenticated;
CREATE POLICY chat_own_preferences ON public.p2g_chat_preferences FOR SELECT TO authenticated USING(user_id=auth.uid() AND p2g_chat_private.allowed(conversation_id));
CREATE POLICY chat_own_saved ON public.p2g_chat_saved FOR SELECT TO authenticated USING(user_id=auth.uid() AND p2g_chat_private.visible(message_id));
ALTER TABLE public.p2g_chat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p2g_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p2g_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p2g_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p2g_chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p2g_chat_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_member_select ON public.p2g_chat_conversations FOR SELECT TO authenticated USING(p2g_chat_private.allowed(id));
CREATE POLICY chat_member_select ON public.p2g_chat_members FOR SELECT TO authenticated USING(p2g_chat_private.allowed(conversation_id));
CREATE POLICY chat_member_select ON public.p2g_chat_messages FOR SELECT TO authenticated USING(p2g_chat_private.visible(id));
CREATE POLICY chat_member_select ON public.p2g_chat_attachments FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.p2g_chat_messages m WHERE m.id=message_id AND m.deleted_at IS NULL AND p2g_chat_private.visible(m.id)));
CREATE POLICY chat_member_select ON public.p2g_chat_reactions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.p2g_chat_messages m WHERE m.id=message_id AND m.deleted_at IS NULL AND p2g_chat_private.visible(m.id)));
REVOKE ALL ON public.p2g_chat_settings,public.p2g_chat_conversations,public.p2g_chat_members,public.p2g_chat_messages,public.p2g_chat_attachments,public.p2g_chat_reactions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.p2g_chat_conversations,public.p2g_chat_members,public.p2g_chat_messages,public.p2g_chat_attachments,public.p2g_chat_reactions TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA p2g_chat_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION p2g_chat_private.allowed(uuid,boolean),p2g_chat_private.visible(uuid),p2g_chat_private.file_allowed(text,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.p2g_chat(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.p2g_chat(text,jsonb) TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit) VALUES('p2g-chat-files','p2g-chat-files',false,NULL);
CREATE POLICY p2g_chat_file_anon_guard ON storage.objects AS RESTRICTIVE FOR ALL TO anon USING(bucket_id<>'p2g-chat-files') WITH CHECK(bucket_id<>'p2g-chat-files');
-- Restrictive guards also constrain pre-existing permissive Storage policies.
CREATE POLICY p2g_chat_file_select_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'p2g-chat-files' OR p2g_chat_private.file_allowed(name));
CREATE POLICY p2g_chat_file_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'p2g-chat-files' OR (owner_id=auth.uid()::text AND p2g_chat_private.file_allowed(name,true)));
CREATE POLICY p2g_chat_file_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'p2g-chat-files' OR (owner_id=auth.uid()::text AND p2g_chat_private.file_allowed(name,true)));
CREATE POLICY p2g_chat_file_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'p2g-chat-files') WITH CHECK(bucket_id<>'p2g-chat-files');
CREATE POLICY p2g_chat_file_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='p2g-chat-files' AND p2g_chat_private.file_allowed(name));
CREATE POLICY p2g_chat_file_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='p2g-chat-files' AND owner_id=auth.uid()::text AND p2g_chat_private.file_allowed(name,true));
CREATE POLICY p2g_chat_file_cancel ON storage.objects FOR DELETE TO authenticated USING(bucket_id='p2g-chat-files' AND owner_id=auth.uid()::text AND p2g_chat_private.file_allowed(name,true));
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.p2g_chat_conversations,public.p2g_chat_messages; END IF; END $$;
GRANT SELECT,UPDATE ON public.p2g_chat_push_jobs,public.p2g_chat_file_cleanup TO service_role;
COMMIT;
