-- AUDIT KINERJA SAMASTA: setelan database Supabase (tempel semua, lalu Run)
-- AMAN DIJALANKAN ULANG: data lama tidak dihapus, kode admin lama tetap dipakai.
-- BARU DIPASANG? Ganti tulisan GANTI-KODE-INI di bawah dengan kode rahasia admin (minimal 6 karakter).
-- SUDAH PERNAH PASANG? Cukup tempel dan Run lagi (ini pembaruan ke BARCODE BULANAN: satu barcode untuk semua kementerian).

create table if not exists pengaturan (k text primary key, v text);
create table if not exists kementerian (id text primary key, nama text, kepala text, token text, periode text);
create table if not exists isian (sid text primary key, mid text not null, ver int not null default 1, dibuat bigint, diubah bigint,
  aud text not null default 'menunggu', cat text default '', skor numeric, data jsonb not null);
create table if not exists percobaan (id int primary key default 1, gagal int default 0, sampai bigint default 0);

-- baru: barcode bulanan, penahan pilihan kementerian, dan penanda perangkat pengisi
create table if not exists bulan (kode text primary key, token text not null, aktif boolean not null default false, dibuat bigint);
create table if not exists klaim (bulan text not null, mid text not null, dev text not null, sampai bigint not null, primary key (bulan, mid));
alter table isian add column if not exists bulan text;
alter table isian add column if not exists dev text;
update isian set bulan = to_char(to_timestamp(coalesce(dibuat, 0) / 1000.0) at time zone 'Asia/Jakarta', 'YYYY-MM') where bulan is null;
do $$ begin
  create unique index if not exists isian_satu_per_bulan on isian (bulan, mid);
exception when others then
  raise notice 'Indeks unik dilewati karena ada isian ganda lama; aturan satu kali tetap dijaga oleh fungsi server.';
end $$;

alter table pengaturan enable row level security;
alter table kementerian enable row level security;
alter table isian enable row level security;
alter table percobaan enable row level security;
alter table bulan enable row level security;
alter table klaim enable row level security;
insert into pengaturan values ('kode', 'GANTI-KODE-INI') on conflict (k) do nothing;
insert into percobaan (id) values (1) on conflict (id) do nothing;

-- fungsi lama (barcode per kementerian) dihapus agar tidak bisa dipakai lagi
drop function if exists k_info(text, text);
drop function if exists k_status(text, text, jsonb);
drop function if exists k_kirim(text, text, text, jsonb);

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

-- cek token barcode: mengembalikan kode bulan bila aktif, '!lama' bila milik bulan lalu, '' bila tidak dikenal
create or replace function tk_cek(p_tk text) returns text language plpgsql security definer set search_path = public as $$
declare b bulan;
begin
  if coalesce(p_tk, '') = '' then return ''; end if;
  select * into b from bulan x where x.token = p_tk;
  if not found then return ''; end if;
  if b.aktif then return b.kode; end if;
  return '!lama';
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
  insert into kementerian (id, nama, kepala)
    select left(x->>'id', 40), left(x->>'name', 120), left(coalesce(x->>'head', ''), 120)
    from jsonb_array_elements(p_daftar) x
    where coalesce(x->>'id', '') <> ''
    on conflict (id) do update set nama = excluded.nama, kepala = excluded.kepala;
  return jsonb_build_object('ok', true);
end $$;

create or replace function a_ambil(p_kode text) returns jsonb language plpgsql security definer set search_path = public as $$
declare e text; hasil jsonb;
begin
  e := adm_ok(p_kode);
  if e <> '' then return jsonb_build_object('ok', false, 'error', e); end if;
  select coalesce(jsonb_agg(jsonb_build_object('sid', i.sid, 'mid', i.mid, 'ver', i.ver, 'at', i.dibuat, 'upd', i.diubah,
    'aud', i.aud, 'cat', i.cat, 'skor', i.skor, 'bulan', i.bulan, 'data', i.data) order by i.dibuat), '[]'::jsonb) into hasil from isian i;
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

-- admin: ambil / aktifkan barcode bulan ini. p_bulan kosong = hanya membaca bulan aktif.
-- p_ganti = true membuat token baru untuk bulan itu (barcode lama tidak berlaku).
create or replace function a_bulan(p_kode text, p_bulan text, p_ganti boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare e text; b text; t text; daftar jsonb; n bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  e := adm_ok(p_kode);
  if e <> '' then return jsonb_build_object('ok', false, 'error', e); end if;
  if coalesce(p_bulan, '') <> '' then
    if p_bulan !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then return jsonb_build_object('ok', false, 'error', 'data'); end if;
    if not exists (select 1 from bulan where kode = p_bulan) then
      insert into bulan (kode, token, aktif, dibuat) values (p_bulan, left(replace(gen_random_uuid()::text, '-', ''), 10), false, n);
    elsif coalesce(p_ganti, false) then
      update bulan set token = left(replace(gen_random_uuid()::text, '-', ''), 10) where kode = p_bulan;
    end if;
    update bulan set aktif = (kode = p_bulan) where true;
  end if;
  select kode, token into b, t from bulan where aktif limit 1;
  if b is null then return jsonb_build_object('ok', true, 'bulan', null); end if;
  delete from klaim where sampai <= n;
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'nama', m.nama, 'kepala', coalesce(m.kepala, ''),
    'st', case when x.sid is not null then 'terkirim' when c.mid is not null then 'mengisi' else 'kosong' end,
    'aud', x.aud, 'sid', x.sid) order by m.nama), '[]'::jsonb) into daftar
  from kementerian m
  left join lateral (select i.sid, i.aud from isian i where i.bulan = b and i.mid = m.id order by i.dibuat desc limit 1) x on true
  left join klaim c on c.bulan = b and c.mid = m.id;
  return jsonb_build_object('ok', true, 'bulan', b, 'tk', t, 'daftar', daftar);
end $$;

-- admin: bebaskan kementerian (lepas penahan, atau hapus isian bulan aktif bila p_hapus = true)
create or replace function a_lepas(p_kode text, p_mid text, p_hapus boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare e text; b text;
begin
  e := adm_ok(p_kode);
  if e <> '' then return jsonb_build_object('ok', false, 'error', e); end if;
  select kode into b from bulan where aktif limit 1;
  if b is null then return jsonb_build_object('ok', false, 'error', 'tidak ada'); end if;
  delete from klaim where bulan = b and mid = p_mid;
  if coalesce(p_hapus, false) then delete from isian where bulan = b and mid = p_mid; end if;
  return jsonb_build_object('ok', true);
end $$;

-- kementerian: buka halaman. Mengembalikan daftar kementerian yang MASIH BISA dipilih dan isian milik perangkat ini.
create or replace function k_buka(p_tk text, p_dev text) returns jsonb language plpgsql security definer set search_path = public as $$
declare b text; daftar jsonb; saya jsonb; n bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  b := tk_cek(p_tk);
  if b = '!lama' then return jsonb_build_object('ok', false, 'error', 'lama'); end if;
  if b = '' then return jsonb_build_object('ok', false, 'error', 'tautan'); end if;
  if length(coalesce(p_dev, '')) < 8 then return jsonb_build_object('ok', false, 'error', 'perangkat'); end if;
  delete from klaim where bulan = b and sampai <= n;
  update klaim set sampai = n + 10800000 where bulan = b and dev = p_dev;
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'nama', m.nama, 'kepala', coalesce(m.kepala, ''), 'rv', coalesce(x.aud = 'revisi', false)) order by m.nama), '[]'::jsonb) into daftar
  from kementerian m
  left join lateral (select i.aud from isian i where i.bulan = b and i.mid = m.id order by i.dibuat desc limit 1) x on true
  where (x.aud is null or x.aud = 'revisi') and not exists (select 1 from klaim c where c.bulan = b and c.mid = m.id);
  select coalesce(jsonb_agg(jsonb_build_object('id', t.mid, 'nama', coalesce(m.nama, t.mid), 'kepala', coalesce(m.kepala, ''),
    'st', t.st, 'sid', t.sid, 'aud', t.aud, 'cat', t.cat, 'ver', t.ver, 'data', t.data) order by m.nama), '[]'::jsonb) into saya
  from (
    select c.mid, case when i.aud = 'revisi' then 'revisi' else 'mengisi' end as st, i.sid, i.aud, i.cat, i.ver,
      case when i.aud = 'revisi' then i.data end as data
    from klaim c
    left join lateral (select z.sid, z.aud, z.cat, z.ver, z.data from isian z where z.bulan = b and z.mid = c.mid order by z.dibuat desc limit 1) i on true
    where c.bulan = b and c.dev = p_dev
    union all
    select i.mid, 'terkirim', i.sid, i.aud, i.cat, i.ver, null::jsonb
    from isian i
    where i.bulan = b and i.dev = p_dev and not exists (select 1 from klaim c where c.bulan = b and c.mid = i.mid and c.dev = p_dev)
  ) t left join kementerian m on m.id = t.mid;
  return jsonb_build_object('ok', true, 'bulan', b, 'daftar', daftar, 'saya', saya);
end $$;

-- kementerian: pilih (tahan) satu kementerian selama 3 jam. Setelah dipilih, hilang dari daftar orang lain.
create or replace function k_pilih(p_tk text, p_dev text, p_mid text) returns jsonb language plpgsql security definer set search_path = public as $$
declare b text; a text; c klaim; n bigint := (extract(epoch from now()) * 1000)::bigint; aktifmu int;
begin
  b := tk_cek(p_tk);
  if b = '!lama' then return jsonb_build_object('ok', false, 'error', 'lama'); end if;
  if b = '' then return jsonb_build_object('ok', false, 'error', 'tautan'); end if;
  if length(coalesce(p_dev, '')) < 8 then return jsonb_build_object('ok', false, 'error', 'perangkat'); end if;
  perform pg_advisory_xact_lock(hashtext(b || '|' || coalesce(p_mid, '')));
  if not exists (select 1 from kementerian where id = p_mid) then return jsonb_build_object('ok', false, 'error', 'tidak ada'); end if;
  select i.aud into a from isian i where i.bulan = b and i.mid = p_mid order by i.dibuat desc limit 1;
  if a is not null and a <> 'revisi' then return jsonb_build_object('ok', false, 'error', 'sudah'); end if;
  select * into c from klaim k where k.bulan = b and k.mid = p_mid;
  if found and c.dev <> p_dev and c.sampai > n then return jsonb_build_object('ok', false, 'error', 'terpakai'); end if;
  select count(*) into aktifmu from klaim k where k.bulan = b and k.dev = p_dev and k.sampai > n and k.mid <> p_mid;
  if aktifmu >= 3 then return jsonb_build_object('ok', false, 'error', 'batas'); end if;
  insert into klaim (bulan, mid, dev, sampai) values (b, p_mid, p_dev, n + 10800000)
    on conflict (bulan, mid) do update set dev = excluded.dev, sampai = excluded.sampai;
  return jsonb_build_object('ok', true);
end $$;

-- kementerian: batalkan pilihan sendiri (kementerian muncul lagi di daftar)
create or replace function k_batal(p_tk text, p_dev text, p_mid text) returns jsonb language plpgsql security definer set search_path = public as $$
declare b text;
begin
  b := tk_cek(p_tk);
  if b = '!lama' then return jsonb_build_object('ok', false, 'error', 'lama'); end if;
  if b = '' then return jsonb_build_object('ok', false, 'error', 'tautan'); end if;
  delete from klaim where bulan = b and mid = p_mid and dev = p_dev;
  return jsonb_build_object('ok', true);
end $$;

-- kementerian: kirim isian. Satu kali per kementerian per bulan; hanya boleh dikirim ulang bila Irjen meminta revisi.
create or replace function k_kirim(p_tk text, p_dev text, p_mid text, p_data jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare b text; c klaim; rec isian; tw numeric; n bigint := (extract(epoch from now()) * 1000)::bigint; baru text;
begin
  b := tk_cek(p_tk);
  if b = '!lama' then return jsonb_build_object('ok', false, 'error', 'lama'); end if;
  if b = '' then return jsonb_build_object('ok', false, 'error', 'tautan'); end if;
  if length(coalesce(p_dev, '')) < 8 then return jsonb_build_object('ok', false, 'error', 'perangkat'); end if;
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
  perform pg_advisory_xact_lock(hashtext(b || '|' || coalesce(p_mid, '')));
  if not exists (select 1 from kementerian where id = p_mid) then return jsonb_build_object('ok', false, 'error', 'tidak ada'); end if;
  select * into c from klaim k where k.bulan = b and k.mid = p_mid;
  if found and c.dev <> p_dev and c.sampai > n then return jsonb_build_object('ok', false, 'error', 'terpakai'); end if;
  select * into rec from isian i where i.bulan = b and i.mid = p_mid order by i.dibuat desc limit 1;
  if found then
    if rec.aud <> 'revisi' then return jsonb_build_object('ok', false, 'error', 'sudah'); end if;
    update isian set ver = rec.ver + 1, diubah = n, aud = 'menunggu', data = p_data, dev = p_dev where sid = rec.sid;
    delete from klaim where bulan = b and mid = p_mid;
    return jsonb_build_object('ok', true, 'sid', rec.sid);
  end if;
  baru := 'S' || to_hex(n) || substr(md5(random()::text), 1, 4);
  insert into isian (sid, mid, ver, dibuat, diubah, aud, cat, data, bulan, dev) values (baru, p_mid, 1, n, n, 'menunggu', '', p_data, b, p_dev);
  delete from klaim where bulan = b and mid = p_mid;
  return jsonb_build_object('ok', true, 'sid', baru);
end $$;

revoke execute on function adm_ok(text) from public, anon, authenticated;
revoke execute on function tk_cek(text) from public, anon, authenticated;
grant execute on function a_masuk(text), a_sinkron(text, jsonb), a_ambil(text), a_audit(text, text, text, text, numeric),
  a_bulan(text, text, boolean), a_lepas(text, text, boolean),
  k_buka(text, text), k_pilih(text, text, text), k_batal(text, text, text), k_kirim(text, text, text, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
