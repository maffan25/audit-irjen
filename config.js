/* config.js: satu-satunya berkas yang perlu kamu isi.
   AUDIT_ENDPOINT : URL Web App Google Apps Script (berakhiran /exec). Kosong = "mode uji" (data hanya di peramban ini).
   AUDIT_BASE     : alamat situs setelah di-deploy, tanpa garis miring akhir, contoh "https://audit-samasta.vercel.app".
                    Barcode akan memakai alamat ini. Kosong = memakai alamat halaman yang sedang dibuka.
   Kode akses admin: selama AUDIT_ENDPOINT kosong, memakai kode lama dari web audit kamu; bila terisi, diperiksa server (KODE_AKSES di Apps Script).
   Barcode: SATU barcode per bulan untuk semua kementerian, dibuat dan disimpan di server lewat menu Barcode di web admin.
   Sunting dengan editor teks biasa, bukan Word/WPS. */
/* ---- PILIH SATU backend ----
   A) Supabase (disarankan bila hanya memakai HP; lihat PANDUAN-AUDIT.txt, jalankan supabase-audit.sql):
      AUDIT_SUPABASE_URL : Project URL, contoh "https://abcdxyz.supabase.co"
      AUDIT_SUPABASE_KEY : kunci publik "anon" atau "publishable" (bukan service_role / secret!)
   B) Google Apps Script: isi AUDIT_ENDPOINT saja. */
window.AUDIT_SUPABASE_URL = "https://zueapwyjymrcmlkufqqa.supabase.co";
window.AUDIT_SUPABASE_KEY = "sb_publishable_ab32EYR-Z_D0Fug02-jOEg_qEwzsvvt";
window.AUDIT_ENDPOINT = "";
window.AUDIT_BASE = "";
