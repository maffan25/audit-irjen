-- AUDIT KINERJA SAMASTA: setelan database Supabase (tempel semua, lalu Run)
-- LANGKAH WAJIB: ganti tulisan GANTI-KODE-INI di bawah dengan kode rahasia admin (minimal 6 karakter).

create table if not exists pengaturan (k text primary key, v text);
create table if not exists kementerian (id text primary key, nama text, kepala text, token text, periode text);
create table if not exists isian (sid text primary key, mid text not null, ver int not null default 1, dibuat bigint, diubah bigint,
  aud text not null default 'menunggu', cat text default '', skor numeric, data jsonb not null);
create table if not exists percobaan (id int primary key default 1, gagal int default 0, sampai bigint default 0);
alter table pengaturan enable row level security;
alter table kementerian enable row level security;
alter table isian enable row level security;
alter table percobaan enable row level security;
insert into pengaturan values ('kode', 'GANTI-KODE-INI') on conflict (k) do nothing;
insert into percobaan (id) values (1) on conflict (id) do nothing;

create or replace function adm_ok(p_kode text) returns text language plpgsql security definer set search_path = public as $$
declare r percobaan; kd text; n bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  select * into r from percobaan where id = 1;
  if r.sampai > n and r.gagal >= 10 then return 'tunggu'; end if;
  select v into kd from pengaturan where k = 'kode';
  if kd is null or length(kd) < 6 or kd = 'GANTI-KODE-INI' then return 'belumkode'; end if;
  if p_kode is distinct from kd then
    update percobaan set gagal = case when r.sampai > n then r.gagal + 1 else 1 end, sampai = n + 600000 where id = 1;
    return 'kode';
  end if;
  update percobaan set gagal = 0, sampai = 0 where id = 1;
  return '';
end $$;

create or replace function a_masuk(p_kode text) returns jsonb language plpgsql security definer set search_path = public as $$
declare e text;
begin
  e := adm_ok(p_kode);
  if e <> '' then return jsonb_build_object('ok', false, 'error', e); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function a_sinkron(p_kode text, p_daftar jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare e text;
begin
  e := adm_ok(p_kode);
  if e <> '' then return jsonb_build_object('ok', false, 'error', e); end if;
  if jsonb_typeof(p_daftar) <> 'array' or jsonb_array_length(p_daftar) > 60 then return jsonb_build_object('ok', false, 'error', 'data'); end if;
  delete from kementerian where true;
  insert into kementerian (id, nama, kepala, token, periode)
    select left(x->>'id', 40), left(x->>'name', 120), left(x->>'head', 120), left(x->>'tk', 40), left(coalesce(x->>'periode', ''), 20)
    from jsonb_array_elements(p_daftar) x
    on conflict (id) do update set nama = excluded.nama, kepala = excluded.kepala, token = excluded.token, periode = excluded.periode;
  return jsonb_build_object('ok', true);
end $$;

create or replace function a_ambil(p_kode text) returns jsonb language plpgsql security definer set search_path = public as $$
declare e text; hasil jsonb;
begin
  e := adm_ok(p_kode);
  if e <> '' then return jsonb_build_object('ok', false, 'error', e); end if;
  select coalesce(jsonb_agg(jsonb_build_object('sid', i.sid, 'mid', i.mid, 'ver', i.ver, 'at', i.dibuat, 'upd', i.diubah,
    'aud', i.aud, 'cat', i.cat, 'skor', i.skor, 'data', i.data) order by i.dibuat), '[]'::jsonb) into hasil from isian i;
  return jsonb_build_object('ok', true, 'data', hasil);
end $$;

create or replace function a_audit(p_kode text, p_sid text, p_aud text, p_cat text, p_skor numeric) returns jsonb language plpgsql security definer set search_path = public as $$
declare e text;
begin
  e := adm_ok(p_kode);
  if e <> '' then return jsonb_build_object('ok', false, 'error', e); end if;
  update isian set diubah = (extract(epoch from now()) * 1000)::bigint,
    aud = case when p_aud in ('menunggu', 'revisi', 'sah') then p_aud else 'menunggu' end,
    cat = left(coalesce(p_cat, ''), 1000), skor = p_skor
  where sid = p_sid;
  if not found then return jsonb_build_object('ok', false, 'error', 'tidak ada'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function k_info(p_mid text, p_tk text) returns jsonb language plpgsql security definer set search_path = public as $$
declare k kementerian;
begin
  select * into k from kementerian x where x.id = p_mid and x.token = p_tk and coalesce(p_tk, '') <> '';
  if not found then return jsonb_build_object('ok', false, 'error', 'tautan'); end if;
  return jsonb_build_object('ok', true, 'nama', k.nama, 'kepala', k.kepala, 'periode', coalesce(k.periode, ''));
end $$;

create or replace function k_status(p_mid text, p_tk text, p_sids jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare k kementerian; hasil jsonb;
begin
  select * into k from kementerian x where x.id = p_mid and x.token = p_tk and coalesce(p_tk, '') <> '';
  if not found then return jsonb_build_object('ok', false, 'error', 'tautan'); end if;
  if jsonb_typeof(coalesce(p_sids, '[]'::jsonb)) <> 'array' then return jsonb_build_object('ok', true, 'data', '[]'::jsonb); end if;
  select coalesce(jsonb_agg(
    case when i.aud = 'revisi'
      then jsonb_build_object('sid', i.sid, 'aud', i.aud, 'cat', i.cat, 'ver', i.ver, 'data', i.data)
      else jsonb_build_object('sid', i.sid, 'aud', i.aud, 'cat', i.cat, 'ver', i.ver) end), '[]'::jsonb) into hasil
  from isian i where i.mid = p_mid and i.sid in (select jsonb_array_elements_text(p_sids) limit 50);
  return jsonb_build_object('ok', true, 'data', hasil);
end $$;

create or replace function k_kirim(p_mid text, p_tk text, p_sid text, p_data jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare k kementerian; rec isian; tw numeric; now_ms bigint := (extract(epoch from now()) * 1000)::bigint; baru text;
begin
  select * into k from kementerian x where x.id = p_mid and x.token = p_tk and coalesce(p_tk, '') <> '';
  if not found then return jsonb_build_object('ok', false, 'error', 'tautan'); end if;
  if jsonb_typeof(p_data) <> 'object' or length(p_data::text) > 20000
     or coalesce(p_data->>'name', '') = '' or coalesce(p_data->>'obj', '') = '' then
    return jsonb_build_object('ok', false, 'error', 'data');
  end if;
  if jsonb_typeof(p_data->'kpis') <> 'array' or jsonb_array_length(p_data->'kpis') not between 1 and 20 then
    return jsonb_build_object('ok', false, 'error', 'kpi');
  end if;
  begin
    select coalesce(sum((x->>'w')::numeric), 0) into tw from jsonb_array_elements(p_data->'kpis') x;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'kpi');
  end;
  if tw <> 100 then return jsonb_build_object('ok', false, 'error', 'bobot'); end if;
  if coalesce(p_sid, '') <> '' then
    select * into rec from isian i where i.sid = p_sid and i.mid = p_mid for update;
    if not found then return jsonb_build_object('ok', false, 'error', 'tidak ada'); end if;
    if rec.aud = 'sah' then return jsonb_build_object('ok', false, 'error', 'terkunci'); end if;
    update isian set ver = rec.ver + 1, diubah = now_ms, aud = 'menunggu', data = p_data where sid = p_sid;
    return jsonb_build_object('ok', true, 'sid', p_sid);
  end if;
  baru := 'S' || to_hex(now_ms) || substr(md5(random()::text), 1, 4);
  insert into isian (sid, mid, ver, dibuat, diubah, aud, cat, data) values (baru, p_mid, 1, now_ms, now_ms, 'menunggu', '', p_data);
  return jsonb_build_object('ok', true, 'sid', baru);
end $$;

revoke execute on function adm_ok(text) from public, anon, authenticated;
grant execute on function a_masuk(text), a_sinkron(text, jsonb), a_ambil(text), a_audit(text, text, text, text, numeric),
  k_info(text, text), k_status(text, text, jsonb), k_kirim(text, text, text, jsonb) to anon, authenticated;
