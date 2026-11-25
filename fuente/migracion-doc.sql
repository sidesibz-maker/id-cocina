-- 25 nov 2026 · Tipo nuevo «doc» para sincronizar el diario de servicio, la trayectoria y lo que venga
-- (id con prefijo: «diario:…», «carrera:…»). Solo amplía lo permitido: no toca ni borra ningún dato.
alter table public.id_items drop constraint id_items_kind_check;
alter table public.id_items add constraint id_items_kind_check check (kind = any (array['dish', 'menu', 'mark', 'trend', 'settings', 'sub', 'saber', 'doc']));

CREATE OR REPLACE FUNCTION public.id_push(secret text, items jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  s text := public.id_hash(secret);
  it jsonb; cur public.id_items%rowtype; at timestamptz;
  accepted int := 0; skipped int := 0;
begin
  if not exists (select 1 from public.id_spaces where space = s) then raise exception 'libreta no encontrada'; end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 200 then raise exception 'demasiados cambios de golpe'; end if;
  for it in select value from jsonb_array_elements(items) loop
    if it->>'kind' not in ('dish', 'menu', 'mark', 'trend', 'settings', 'sub', 'saber', 'doc') or coalesce(it->>'id', '') = '' or length(it->>'id') > 200
       or jsonb_typeof(it->'data') <> 'object' or octet_length((it->'data')::text) > 1500000 then
      skipped := skipped + 1; continue;
    end if;
    at := (it->>'updated_at')::timestamptz;
    select * into cur from public.id_items where space = s and kind = it->>'kind' and id = it->>'id' for update;
    if found then
      if at <= cur.updated_at then skipped := skipped + 1; continue; end if;
      insert into public.id_history (space, kind, id, data, updated_at) values (s, cur.kind, cur.id, cur.data, cur.updated_at);
      update public.id_items set data = it->'data', updated_at = at, seq = nextval('public.id_seq')
       where space = s and kind = cur.kind and id = cur.id;
    else
      if (select count(*) from public.id_items where space = s) >= 50000 then raise exception 'libreta llena'; end if;
      insert into public.id_items (space, kind, id, data, updated_at) values (s, it->>'kind', it->>'id', it->'data', at);
    end if;
    accepted := accepted + 1;
  end loop;
  return json_build_object('accepted', accepted, 'skipped', skipped);
end $function$;
