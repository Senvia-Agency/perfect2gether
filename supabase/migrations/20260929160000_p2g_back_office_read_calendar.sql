create policy "P2G Back Office reads calendar events"
on public.calendar_events
for select to authenticated
using (
  organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
  and organization_id = public.get_user_org_id(auth.uid())
  and exists (
    select 1
    from public.organization_members om
    join public.organization_profiles op on op.id = om.profile_id
    where om.organization_id = calendar_events.organization_id
      and om.user_id = auth.uid()
      and op.name = 'Back Office'
      and op.data_scope = 'all'
  )
);

alter policy "Users insert own or assigned events"
on public.calendar_events
with check (
  organization_id = public.get_user_org_id(auth.uid())
  and (
    exists (
      select 1
      from public.organization_members target_member
      where target_member.organization_id = calendar_events.organization_id
        and target_member.user_id = calendar_events.user_id
    )
    or (
      organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
      and lead_id is not null
      and public.is_org_member(user_id, organization_id)
      and exists (
        select 1
        from public.leads assigned_lead
        where assigned_lead.id = calendar_events.lead_id
          and assigned_lead.organization_id = calendar_events.organization_id
          and assigned_lead.assigned_to = calendar_events.user_id
      )
      and exists (
        select 1
        from public.organization_members actor_member
        join public.organization_profiles actor_profile on actor_profile.id = actor_member.profile_id
        where actor_member.user_id = auth.uid()
          and actor_member.organization_id = calendar_events.organization_id
          and actor_profile.name = 'Back Office'
      )
    )
  )
  and (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'admin'::app_role)
    or public.has_role(auth.uid(), 'super_admin'::app_role)
    or exists (
      select 1
      from public.organization_members om
      join public.organization_profiles op on op.id = om.profile_id
      where om.user_id = auth.uid()
        and om.organization_id = calendar_events.organization_id
        and (op.name = 'Back Office' or op.base_role = 'admin')
    )
  )
);
