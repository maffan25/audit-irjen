/* config.js: satu-satunya berkas yang perlu kamu isi.
   AUDIT_ENDPOINT : URL Web App Google Apps Script (berakhiran /exec). Kosong = "mode uji" (data hanya di peramban ini).
   AUDIT_BASE     : alamat situs setelah di-deploy, tanpa garis miring akhir, contoh "https://audit-samasta.vercel.app".
                    Barcode akan memakai alamat ini. Kosong = memakai alamat halaman yang sedang dibuka.
   Kode akses admin: selama AUDIT_ENDPOINT kosong, memakai kode lama dari web audit kamu; bila terisi, diperiksa server (KODE_AKSES di Apps Script).
   Sunting dengan editor teks biasa, bukan Word/WPS. */
window.AUDIT_ENDPOINT = "";
window.AUDIT_BASE = "";
