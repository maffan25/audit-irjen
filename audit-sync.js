/* audit-sync.js: tambahan admin: Kotak Masuk, Barcode kementerian, panel audit, sinkronisasi server.
   Memperluas index.html tanpa mengubah rumus penilaian. */
(function(){
const kode=()=>window.ADM||(()=>{try{return sessionStorage.getItem('ak')||''}catch(e){return ''}})();
const AL={menunggu:['Menunggu audit',2],revisi:['Perlu revisi',3],sah:['Disahkan',0]};
const ab=a=>a&&AL[a]?`<span class="b f${AL[a][1]}">${AL[a][0]}</span>`:'';
let BL=null,BLERR='';   /* barcode bulan aktif dari server: {bulan, tk, daftar} */
const lnk=()=>BL&&BL.tk?AUDIT.base()+'/isi.html?k='+BL.tk:'';
const bln=b=>{try{return new Date(b+'-01T00:00:00').toLocaleDateString('id-ID',{month:'long',year:'numeric'})}catch(e){return b||''}};
const nowB=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
const waiting=()=>S.p.filter(p=>p.aud=='menunggu').length;

/* ---- masuk: kode diperiksa server bila endpoint terisi ---- */
const _login=login;
login=async function(){const v=$('#code').value.trim();window.ADM=v;
  if(AUDIT.uji())return _login();
  const r=await AUDIT.api('masuk',{kode:v});
  if(r.ok){AU=1;try{sessionStorage.setItem('au','1');sessionStorage.setItem('ak',v)}catch(e){}lg('Login admin');location.hash='dash';boot();autoPull()}
  else $('#er').textContent=r.error=='tunggu'?'Terlalu banyak percobaan salah. Tunggu 10 menit.':r.error=='jaringan'?'Server tidak terjangkau. Periksa sambungan server di config.js dan koneksi internet.':'Kode akses salah. Periksa kembali lalu coba lagi.'};

/* ---- sinkronisasi ---- */
let sigM='';const sigNow=()=>JSON.stringify(S.m.map(m=>[m.id,m.name,m.head]));
async function pushM(q){if(!S.m.length){if(!q)toast('Belum ada kementerian untuk dikirim');return false}
  const r=await AUDIT.api('sinkron',{kode:kode(),daftar:S.m.map(m=>({id:m.id,name:m.name,head:m.head}))});if(r.ok)sigM=sigNow();
  if(!q)toast(r.ok?'Daftar kementerian terkirim ke server':'Gagal mengirim daftar ('+(r.error||'?')+')');return r.ok}
function merge(r){const d=r.data||{};let p=S.p.find(x=>x.sid==r.sid);if(!S.m.some(m=>m.id==r.mid))return 0;
  const b={name:d.name||'(tanpa nama)',mid:r.mid,pic:d.pic||'',date:d.date||'',status:d.status||'Belum dimulai',type:d.type||'',period:r.bulan||d.period||'',budget:+d.budget||0,obj:d.obj||'',kr:d.kr||'',kpis:Array.isArray(d.kpis)?d.kpis:[],benef:+d.benef||0,outcome:d.outcome||'',evidence:d.evidence||''};
  if(!p){S.p.push(Object.assign({id:uid(),sid:r.sid,src:'kementerian',weight:3,note:'',ver:r.ver,aud:r.aud||'menunggu',unscored:true,time:0,qual:0,adm:0,impact:0,sat:0,okr:0},b));lg('Isian baru dari '+mn(r.mid)+': '+b.name);return 1}
  if(r.ver>(p.ver||0)){Object.assign(p,b,{ver:r.ver,aud:'menunggu'});lg('Isian diperbarui oleh '+mn(r.mid)+': '+b.name);return 1}
  return 0}
async function pull(q){const r=await AUDIT.api('ambil',{kode:kode()});
  if(!r.ok){if(!q)toast('Gagal menarik isian ('+(r.error||'?')+')');return 0}
  let n=0;(r.data||[]).forEach(x=>{n+=merge(x)});if(n)save();if(!q)toast(n?n+' isian baru atau diperbarui':'Belum ada isian baru');return n}
async function pushA(p){if(!p.sid)return;const r=await AUDIT.api('audit',{kode:kode(),sid:p.sid,aud:p.aud,cat:p.note||'',skor:+sc(p).fin.toFixed(1)});if(!r.ok)toast('Tersimpan di sini, tetapi belum terkirim ke server')}
let first=1;async function autoPull(){if(!first)return;first=0;await pushM(1);if(await pull(1))R(1)}
setInterval(()=>{if(AU&&kode()&&S.m.length&&sigNow()!==sigM){sigM=sigNow();pushM(1)}},3000);
window.syncNow=async()=>{await pushM(1);await pull();R(1)};

/* ---- navigasi ---- */
IC.box='<path d="M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5"/>';IC.qr='<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1"/>';
NAV.splice(2,0,['box','Kotak Masuk'],['qr','Barcode']);
const _R=R;R=function(k){_R(k);const a=document.querySelector('#nv a[data-p=box]'),n=waiting();if(a){const o=a.querySelector('em');if(o)o.remove();if(n)a.insertAdjacentHTML('beforeend','<em>'+n+'</em>')}};

/* ---- panel audit pada halaman proker ---- */
const DK=[['time','Ketepatan waktu',100,'Pelaksanaan sesuai jadwal rencana'],['qual','Kualitas pelaksanaan',100,'Sesuai standar dan rencana kegiatan'],['adm','Kepatuhan administrasi',100,'Proposal, LPJ, dan dokumentasi lengkap'],['impact','Dampak (impact)',100,'Perubahan nyata bagi penerima manfaat'],['sat','Kepuasan peserta (1–5)',5,'Dari survei atau bukti kepuasan'],['okr','Keterkaitan OKR',100,'Selaras dengan tujuan strategis kabinet']];
function audPanel(p){const ro=p.aud=='sah',un=p.unscored;
  return`<div class="cd" style="margin-bottom:14px"><div class="hd"><div><h2>Penilaian Inspektorat Jenderal</h2><p>Kementerian hanya mengisi informasi. OKR, KPI, dan bukti di atas masuk otomatis; nilai di bawah diisi oleh Irjen.</p></div>${ab(p.aud)}</div>
${un?'<div class="wn">Belum dinilai. Nilai akhir di atas belum final karena komponen penilaian masih kosong.</div>':''}
<div class="ov"><table><tr><th>Indikator</th><th>Nilai Irjen</th><th>Panduan</th></tr>${DK.map(([k,l,mx,h])=>`<tr><td>${l}</td><td><input id="au_${k}" type="number" min="0" max="${mx}" step="${mx==5?.1:1}" value="${un?'':(p[k]??'')}" placeholder="0–${mx}" style="width:96px;min-height:38px" ${ro?'disabled':''}></td><td style="color:var(--mu);white-space:normal">${h}</td></tr>`).join('')}</table></div>
<label class="fl"><span>Bobot proker (1–5)</span><input id="au_weight" type="number" min="1" max="5" value="${p.weight||3}" style="max-width:120px" ${ro?'disabled':''}></label>
<label class="fl"><span>Catatan audit untuk kementerian</span><textarea id="au_note" ${ro?'disabled':''}>${E(p.note)}</textarea><small>Catatan ini terlihat oleh kementerian di halaman statusnya.</small></label><div class="er" id="au_e"></div>
<div class="fb">${ro?`<button class="bt" onclick="audAct('${p.id}','menunggu')">Buka kembali audit</button>`:`<button class="bt" onclick="audAct('${p.id}','menunggu')">Simpan nilai</button><button class="bt r" onclick="audAct('${p.id}','revisi')">Minta revisi</button><button class="bt p" onclick="audAct('${p.id}','sah')">Sahkan</button>`}</div></div>`}
window.audAct=async(id,st)=>{const p=S.p.find(x=>x.id==id),e=$('#au_e'),v={};
  if(p.aud!='sah'||st=='menunggu'&&p.aud=='sah'){}
  if(p.aud=='sah'&&st=='menunggu'){p.aud='menunggu';save();pushA(p);return R(1)}
  for(const[k,l,mx]of DK){const x=$('#au_'+k).value.trim();v[k]=+x;if(x===''||!(v[k]>=0&&v[k]<=mx))return e.textContent=l+' harus diisi angka 0–'+mx+'.'}
  const w=+$('#au_weight').value,note=$('#au_note').value.trim();if(!(w>=1&&w<=5))return e.textContent='Bobot proker harus 1–5.';
  if(st=='revisi'&&!note)return e.textContent='Tulis catatan agar kementerian tahu apa yang perlu direvisi.';
  if(st=='sah'&&['Selesai','Berjalan'].includes(p.status)&&!p.evidence&&!await ask('Proker ini belum memiliki bukti. Tetap disahkan?'))return;
  Object.assign(p,v,{weight:w,note,aud:st,unscored:false});lg((st=='sah'?'Mengesahkan ':st=='revisi'?'Meminta revisi ':'Menyimpan audit ')+p.name+' ('+mn(p.mid)+')');save();pushA(p);toast(st=='sah'?'Disahkan':st=='revisi'?'Permintaan revisi dikirim':'Nilai audit disimpan');R(1)};
const _pp=prkPage;prkPage=function(id){const p=S.p.find(x=>x.id==id);return _pp(id)+(p&&p.src=='kementerian'?audPanel(p):'')};

/* ---- rata-rata skor hanya dari proker yang sudah dinilai Irjen ---- */
const _agg=agg;agg=function(ps){const o=_agg(ps),v=ps.filter(p=>!p.unscored);if(v.length==ps.length)return o;const w=v.length?_agg(v):null;KEYS.forEach(k=>o[k]=w?w[k]:0);return o};
/* ---- dashboard: pengingat isian baru ---- */
const _d=PG.dash;PG.dash=function(){const n=waiting();return(n?`<div class="wn" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span style="flex:1;min-width:200px"><b>${n} isian kementerian</b> menunggu audit.</span><button class="bt s p" onclick="go('box')">Buka Kotak Masuk</button></div>`:'')+_d.apply(this,arguments)};

/* ---- Kotak Masuk ---- */
PG.box=function(){const ps=S.p.filter(p=>p.src=='kementerian'),o={menunggu:0,revisi:1,sah:2};ps.sort((a,b)=>(o[a.aud]??0)-(o[b.aud]??0));
  const cnt=s=>ps.filter(p=>p.aud==s).length;
  return`<div class="hd"><div><h1>Kotak Masuk</h1><p>Isian yang dikirim kementerian lewat barcode. Buka satu isian untuk memeriksa dan memberi nilai audit.</p></div><button class="bt p" onclick="syncNow()">Tarik isian terbaru</button></div>
${AUDIT.uji()?'<div class="wn">Mode uji: server belum tersambung. Isian hanya terbaca dari peramban ini. Isi sambungan server di config.js (Supabase atau Apps Script, lihat PANDUAN-AUDIT.txt).</div>':''}
<div class="gr gs" style="margin-bottom:16px">${card(cnt('menunggu'),'Menunggu audit',1)}${card(cnt('revisi'),'Perlu revisi')}${card(cnt('sah'),'Disahkan')}${card(ps.length,'Total isian')}</div>
${ps.length?`<div class="cd ov"><table><tr><th>Program kerja</th><th>Kementerian</th><th>Penanggung jawab</th><th>Status</th><th>Capaian KPI</th><th>Status audit</th><th>Nilai Irjen</th></tr>${ps.map(p=>{const q=sc(p),s=q.fin;return`<tr class="cl" onclick="go('prk/${p.id}')"><td><b>${E(p.name)}</b></td><td>${E(mn(p.mid))}</td><td>${E(p.pic)}</td><td>${E(p.status)}</td><td>${N(q.kpi)}%</td><td>${ab(p.aud)}</td><td>${p.unscored?'<span class="pill">Belum dinilai</span>':N(s)+' '+bd(s)}</td></tr>`}).join('')}</table></div>`:empty('<h3>Belum ada isian</h3><p>Bagikan barcode bulan ini dari menu Barcode. Isian yang masuk akan muncul di sini.</p><p><button class="bt p" onclick="go(\'qr\')">Buka Barcode</button></p>')}`};

/* ---- Barcode: SATU barcode per bulan untuk semua kementerian ---- */
const qsvg=(u,b)=>QR.svg(QR.make(u),{border:b??4,dark:'#0d2a38',light:'#ffffff'});
const hostTxt=()=>lnk().replace(/^https?:\/\//,'');
function poster(cb){const u=lnk(),q=QR.make(u),t=document.createElement('canvas');QR.canvas(t,q,14,4);const W=760,H=1040,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  x.fillStyle='#fffbef';x.fillRect(0,0,W,H);x.fillStyle='#f8d24a';x.beginPath();x.moveTo(40,300);x.arc(W/2,300,W/2-40,Math.PI,0);x.lineTo(W-40,H-40);x.lineTo(40,H-40);x.closePath();x.fill();
  x.fillStyle='#0d2a38';x.textAlign='center';x.font='600 42px Fraunces,Georgia,serif';x.fillText('Penilaian Kinerja',W/2,150);x.font='700 34px "Plus Jakarta Sans",sans-serif';x.fillText('Bulan '+bln(BL.bulan),W/2,205);
  const s=460;x.fillStyle='#fff';x.fillRect((W-s)/2-14,262,s+28,s+28);x.drawImage(t,(W-s)/2,276,s,s);
  x.font='600 28px "Plus Jakarta Sans",sans-serif';x.fillText('Pindai, pilih kementerian, lalu isi',W/2,806);x.font='500 20px "Plus Jakarta Sans",sans-serif';x.fillText('Satu isian per kementerian untuk bulan ini',W/2,844);
  x.font='500 17px "Plus Jakarta Sans",sans-serif';x.fillText('Tidak bisa dipindai? Buka:',W/2,904);x.font='600 19px "Plus Jakarta Sans",sans-serif';x.fillText(hostTxt().slice(0,60),W/2,934);x.font='500 18px "Plus Jakarta Sans",sans-serif';x.fillText('Kabinet Samasta',W/2,990);cb(c.toDataURL('image/png'))}
window.qrDl=()=>{if(!BL||!BL.tk)return;poster(u=>{const a=document.createElement('a');a.href=u;a.download='barcode-samasta-'+BL.bulan+'.png';document.body.append(a);a.click();a.remove()})};
window.qrCopy=async()=>{try{await navigator.clipboard.writeText(lnk());toast('Tautan disalin')}catch(e){prompt('Salin tautan ini:',lnk())}};
window.qrPrint=()=>{if(!BL||!BL.tk)return toast('Aktifkan barcode bulan ini dulu');$('#rpt').innerHTML=`<section class="cv" style="padding-top:20mm"><img src="${LOGO}" alt=""><h1>Penilaian Kinerja Program Kerja</h1><h2>Bulan ${E(bln(BL.bulan))}</h2><div style="width:110mm;margin:8mm auto">${qsvg(lnk(),4)}</div><p>Pindai barcode, pilih kementerian, lalu isi data program kerja.</p><p style="color:#555;font-size:10pt">Tidak bisa dipindai? Buka: ${E(hostTxt())}</p></section>`;setTimeout(()=>print(),300)};
async function qrLoad(){const r=await AUDIT.api('bulan',{kode:kode(),bulan:'',ganti:false});
  if(!r.ok){BLERR=r.error||'?';BL=null}else{BLERR='';BL=r.bulan?r:{bulan:null}}
  const e=$('#qrx');if(e)e.innerHTML=qrView()}
async function qrSet(ganti){const sel=($('#bl_in')||{}).value||nowB(),cur=BL&&BL.bulan;
  if(ganti){if(!await ask(`Buat barcode baru untuk <b>${E(bln(sel))}</b>? Barcode dan tautan lama bulan ini langsung tidak berlaku, jadi poster yang sudah dibagikan harus diganti. Isian yang sudah masuk tetap aman.`))return}
  else if(cur&&cur!==sel){if(!await ask(`Pindah ke <b>${E(bln(sel))}</b>? Barcode <b>${E(bln(cur))}</b> langsung tidak berlaku. Isian yang sudah masuk tetap aman, dan tiap kementerian bisa mengisi satu kali lagi di bulan baru.`))return}
  await pushM(1);const r=await AUDIT.api('bulan',{kode:kode(),bulan:sel,ganti:!!ganti});
  if(!r.ok){toast('Gagal ('+(r.error||'?')+')');return}
  lg((ganti?'Mengganti barcode bulan ':'Mengaktifkan barcode bulan ')+sel);BL=r;BLERR='';toast(ganti?'Barcode diganti. Bagikan yang baru.':'Barcode bulan '+bln(sel)+' aktif');const e=$('#qrx');if(e)e.innerHTML=qrView()}
window.qrSet=qrSet;
window.qrFree=async(mid,hapus)=>{const m=S.m.find(x=>x.id==mid),nm=m?m.name:mid,d=BL&&BL.daftar.find(x=>x.id==mid);
  if(hapus){if(!await ask(`Hapus isian <b>${E(nm)}</b> bulan ini? Kementerian ini bisa memilih dan mengisi lagi. Isian beserta nilai audit yang sudah ada ikut terhapus dari server dan Kotak Masuk.`))return}
  else if(!await ask(`Lepas penahan <b>${E(nm)}</b>? Kementerian ini muncul lagi di daftar pilihan.`))return;
  const r=await AUDIT.api('lepas',{kode:kode(),mid,hapus:!!hapus});if(!r.ok)return toast('Gagal ('+(r.error||'?')+')');
  if(hapus&&d&&d.sid){S.p=S.p.filter(p=>p.sid!=d.sid);save()}
  lg((hapus?'Menghapus isian ':'Melepas penahan ')+nm);toast(hapus?'Isian dihapus, kementerian dibebaskan':'Penahan dilepas');await qrLoad();R(1)};
window.qrVerif=async()=>{await pushM();await qrLoad()};
const STK={kosong:['Belum memilih','f5'],mengisi:['Sedang mengisi','f2'],terkirim:['Sudah mengirim','f0']};
function qrView(){
  const bs=`<div class="cd" style="margin-bottom:16px"><h3 style="margin:0 0 4px">Bulan barcode</h3><p class="hint" style="margin:0 0 10px;color:var(--mu)">Satu barcode dipakai semua kementerian selama satu bulan. Ganti bulan untuk membuat barcode baru; barcode bulan lalu otomatis tidak berlaku.</p><div class="fb" style="margin:0"><input id="bl_in" type="month" value="${E(BL&&BL.bulan||nowB())}" style="width:auto;flex:1 1 170px;max-width:220px;border-radius:999px" aria-label="Bulan penilaian"><button class="bt p" onclick="qrSet(0)">${BL&&BL.bulan?'Aktifkan bulan ini':'Aktifkan barcode'}</button></div></div>`;
  if(BLERR)return bs+`<div class="wn x">${BLERR=='jaringan'?'Server tidak terjangkau. Periksa sambungan dan config.js.':BLERR=='belumkode'?'Kode admin di server belum diisi.':'Gagal memuat barcode ('+E(BLERR)+').'}</div>`;
  if(!BL)return '<div class="em">Memuat barcode…</div>';
  if(!BL.bulan)return bs+empty('<h3>Belum ada barcode aktif</h3><p>Pilih bulan di atas lalu tekan Aktifkan barcode. Barcode dibuat otomatis dan disimpan di server.</p>');
  const L=BL.daftar||[],k=L.filter(x=>x.st=='terkirim').length,lh=!(window.AUDIT_BASE||'').trim()&&(/^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname)||location.protocol=='file:');
  const warn=(lh?'<div class="wn x">Alamat situs masih alamat lokal ('+E(location.host||'file')+'). Barcode tidak bisa dibuka dari HP kementerian. Setelah di-deploy, isi AUDIT_BASE di config.js dengan alamat situs.</div>':'')+(AUDIT.uji()?'<div class="wn">Mode uji: server belum tersambung. Barcode hanya berlaku di peramban ini. Isi sambungan server di config.js (Supabase atau Apps Script).</div>':'')+(!L.length?'<div class="wn">Daftar kementerian di server masih kosong. Tambahkan kementerian di menu Kementerian, lalu tekan Periksa koneksi.</div>':'');
  return bs+warn+`<div class="gr" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));align-items:start"><div class="cd qrc"><div class="arc"><h3 style="margin:0">Barcode ${E(bln(BL.bulan))}</h3><p style="color:var(--gd);font-weight:600;margin:0">Untuk semua kementerian</p></div><div class="qq" style="width:min(100%,300px)">${qsvg(lnk())}</div><span class="pill" style="margin-bottom:8px">${k} dari ${L.length} kementerian sudah mengirim</span><code style="word-break:break-all;font-size:.78rem">${E(lnk())}</code><div class="fb" style="justify-content:center;margin:10px 0 0"><button class="bt s p" onclick="qrDl()">Unduh poster</button><button class="bt s" onclick="qrCopy()">Salin tautan</button><button class="bt s d" onclick="qrPrint()">Cetak</button><button class="bt s" onclick="qrVerif()">Periksa koneksi</button><button class="bt s r" onclick="qrSet(1)">Ganti barcode</button></div></div>
<div class="cd"><h3>Status kementerian bulan ini</h3><div class="stl2">${L.map(x=>{const t=STK[x.st]||STK.kosong;return`<div class="r"><b>${E(x.nama)}</b><span class="b ${t[1]}">${t[0]}</span>${x.aud?ab(x.aud):''}${x.st=='mengisi'?`<button class="bt s" onclick="qrFree('${E(x.id)}',0)">Lepas penahan</button>`:x.st=='terkirim'?`<button class="bt s r" onclick="qrFree('${E(x.id)}',1)">Hapus isian</button>`:''}</div>`}).join('')||'<p class="hint" style="color:var(--mu)">Belum ada kementerian.</p>'}</div><p class="hint" style="margin-top:10px;color:var(--mu)">Kementerian yang sudah mengirim atau sedang mengisi tidak muncul di daftar pilihan. Bila ada yang salah pilih, hapus isian atau lepas penahannya di sini. Isian yang diminta revisi muncul kembali di daftar pilihan.</p></div></div>`}
PG.qr=function(){setTimeout(async()=>{await pushM(1);await qrLoad()},30);
  return`<div class="hd"><div><h1>Barcode Kementerian</h1><p>Satu barcode untuk semua kementerian. Tiap kementerian memilih namanya lalu mengisi satu kali per bulan. Bulan depan, aktifkan bulan baru untuk barcode yang berbeda.</p></div></div><div id="qrx">${BL?qrView():'<div class="em">Memuat barcode…</div>'}</div>`};

boot();if(AU)autoPull();
})();
