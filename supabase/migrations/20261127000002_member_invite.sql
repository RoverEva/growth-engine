-- Owners add an existing user to a project by email. The user must have
-- signed up first (Supabase Auth). Runs as definer so it can read auth.users.
create or replace function public.add_member_by_email(p_project uuid, p_email text, p_role public.member_role)
returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
  v_user uuid;
begin
  if not public.has_project_role(p_project, 'owner') then
    raise exception 'only an owner can add members';
  end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'no account uses that email yet — ask them to sign up first';
  end if;
  insert into public.project_members (project_id, user_id, role) values (p_project, v_user, p_role)
  on conflict (project_id, user_id) do update set role = excluded.role;
  return v_user;
end $$;

-- Member list with emails, for the settings page (members only).
create or replace function public.project_member_list(p_project uuid)
returns table (user_id uuid, email text, role public.member_role)
language sql stable security definer set search_path = public, auth as $$
  select m.user_id, u.email::text, m.role
  from public.project_members m join auth.users u on u.id = m.user_id
  where m.project_id = p_project and public.has_project_role(p_project, 'viewer')
  order by m.created_at
$$;

grant execute on function public.add_member_by_email(uuid, text, public.member_role) to authenticated;
grant execute on function public.project_member_list(uuid) to authenticated;
