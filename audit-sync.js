/* audit-sync.js: tambahan admin: Kotak Masuk, Barcode kementerian, panel audit, sinkronisasi server.
   Memperluas index.html tanpa mengubah rumus penilaian. */
(function(){
const kode=()=>window.ADM||(()=>{try{return sessionStorage.getItem('ak')||''}catch(e){return ''}})();
const AL={menunggu:['Menunggu audit',2],revisi:['Perlu revisi',3],sah:['Disahkan',0]};
const ab=a=>a&&AL[a]?`<span class="b f${AL[a][1]}">${AL[a][0]}</span>`:'';
const tok=()=>Math.random().toString(36).slice(2,10)+Math.random().toString(36).slice(2,10);
const lnk=m=>{if(!m.tk){m.tk=tok();save()}return AUDIT.base()+'/isi.html#m='+m.id+'&k='+m.tk};
const waiting=()=>S.p.filter(p=>p.aud=='menunggu').length;

/* ---- masuk: kode diperiksa server bila endpoint terisi ---- */
const _login=login;
login=async function(){const v=$('#code').value.trim();window.ADM=v;
  if(AUDIT.uji())return _login();
  const r=await AUDIT.api('masuk',{kode:v});
  if(r.ok){AU=1;try{sessionStorage.setItem('au','1');sessionStorage.setItem('ak',v)}catch(e){}lg('Login admin');location.hash='dash';boot();autoPull()}
  else $('#er').textContent=r.error=='tunggu'?'Terlalu banyak percobaan salah. Tunggu 10 menit.':r.error=='jaringan'?'Server tidak terjangkau. Periksa AUDIT_ENDPOINT di config.js dan koneksi internet.':'Kode akses salah. Periksa kembali lalu coba lagi.'};

/* ---- sinkronisasi ---- */
async function pushM(q){const r=await AUDIT.api('sinkron',{kode:kode(),daftar:S.m.map(m=>({id:m.id,name:m.name,head:m.head,tk:(lnk(m),m.tk),periode:S.cfg.periode||''}))});
  if(!q)toast(r.ok?'Daftar kementerian terkirim ke server':'Gagal mengirim daftar ('+(r.error||'?')+')');return r.ok}
function merge(r){const d=r.data||{};let p=S.p.find(x=>x.sid==r.sid);if(!S.m.some(m=>m.id==r.mid))return 0;
  const cl={time:+d.time||0,qual:+d.qual||0,adm:+d.adm||0,impact:+d.impact||0,sat:+d.sat||0,okr:+d.okr||0};
  const b={name:d.name||'(tanpa nama)',mid:r.mid,pic:d.pic||'',date:d.date||'',status:d.status||'Belum dimulai',type:d.type||'',period:d.period||'',budget:+d.budget||0,obj:d.obj||'',kr:d.kr||'',kpis:Array.isArray(d.kpis)?d.kpis:[],benef:+d.benef||0,outcome:d.outcome||'',evidence:d.evidence||''};
  if(!p){S.p.push(Object.assign({id:uid(),sid:r.sid,src:'kementerian',weight:3,note:'',ver:r.ver,aud:r.aud||'menunggu',claim:cl},b,cl));lg('Isian baru dari '+mn(r.mid)+': '+b.name);return 1}
  if(r.ver>(p.ver||0)){Object.assign(p,b,cl,{ver:r.ver,aud:'menunggu',claim:cl});lg('Isian diperbarui oleh '+mn(r.mid)+': '+b.name);return 1}
  return 0}
async function pull(q){const r=await AUDIT.api('ambil',{kode:kode()});
  if(!r.ok){if(!q)toast('Gagal menarik isian ('+(r.error||'?')+')');return 0}
  let n=0;(r.data||[]).forEach(x=>{n+=merge(x)});if(n)save();if(!q)toast(n?n+' isian baru atau diperbarui':'Belum ada isian baru');return n}
async function pushA(p){if(!p.sid)return;const r=await AUDIT.api('audit',{kode:kode(),sid:p.sid,aud:p.aud,cat:p.note||'',skor:+sc(p).fin.toFixed(1)});if(!r.ok)toast('Tersimpan di sini, tetapi belum terkirim ke server')}
let first=1;async function autoPull(){if(!first)return;first=0;await pushM(1);if(await pull(1))R(1)}
window.syncNow=async()=>{await pushM(1);await pull();R(1)};

/* ---- navigasi ---- */
IC.box='<path d="M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5"/>';IC.qr='<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1"/>';
NAV.splice(2,0,['box','Kotak Masuk'],['qr','Barcode']);
const _R=R;R=function(k){_R(k);const a=document.querySelector('#nv a[data-p=box]'),n=waiting();if(a){const o=a.querySelector('em');if(o)o.remove();if(n)a.insertAdjacentHTML('beforeend','<em>'+n+'</em>')}};

/* ---- panel audit pada halaman proker ---- */
const DK=[['time','Ketepatan waktu',100],['qual','Kualitas pelaksanaan',100],['adm','Kepatuhan administrasi',100],['impact','Dampak (impact)',100],['sat','Kepuasan peserta (1–5)',5],['okr','Keterkaitan OKR',100]];
function audPanel(p){const c=p.claim||{},ro=p.aud=='sah';
  return`<div class="cd" style="margin-bottom:14px"><div class="hd"><div><h2>Audit isian kementerian</h2><p>Nilai klaim berasal dari kementerian. Isi nilai audit sesuai bukti; nilai audit yang dipakai pada penilaian akhir.</p></div>${ab(p.aud)}</div>
<div class="ov"><table><tr><th>Indikator</th><th>Klaim kementerian</th><th>Nilai audit</th><th>Selisih</th></tr>${DK.map(([k,l,mx])=>{const d=(+p[k]||0)-(+c[k]||0),big=Math.abs(d)>(mx==5?.75:15);return`<tr><td>${l}</td><td>${N(c[k],mx==5?1:0)}</td><td><input id="au_${k}" type="number" min="0" max="${mx}" step="${mx==5?.1:1}" value="${p[k]??0}" style="width:96px;min-height:38px" ${ro?'disabled':''}></td><td style="color:${big?'var(--c4)':'var(--mu)'};font-weight:${big?700:400}">${d>0?'+':''}${N(d,mx==5?1:0)}${big?' ⚠':''}</td></tr>`}).join('')}</table></div>
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
  Object.assign(p,v,{weight:w,note,aud:st});lg((st=='sah'?'Mengesahkan ':st=='revisi'?'Meminta revisi ':'Menyimpan audit ')+p.name+' ('+mn(p.mid)+')');save();pushA(p);toast(st=='sah'?'Disahkan':st=='revisi'?'Permintaan revisi dikirim':'Nilai audit disimpan');R(1)};
const _pp=prkPage;prkPage=function(id){const p=S.p.find(x=>x.id==id);return _pp(id)+(p&&p.src=='kementerian'?audPanel(p):'')};

/* ---- dashboard: pengingat isian baru ---- */
const _d=PG.dash;PG.dash=function(){const n=waiting();return(n?`<div class="wn" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span style="flex:1;min-width:200px"><b>${n} isian kementerian</b> menunggu audit.</span><button class="bt s p" onclick="go('box')">Buka Kotak Masuk</button></div>`:'')+_d.apply(this,arguments)};

/* ---- Kotak Masuk ---- */
PG.box=function(){const ps=S.p.filter(p=>p.src=='kementerian'),o={menunggu:0,revisi:1,sah:2};ps.sort((a,b)=>(o[a.aud]??0)-(o[b.aud]??0));
  const cnt=s=>ps.filter(p=>p.aud==s).length;
  return`<div class="hd"><div><h1>Kotak Masuk</h1><p>Isian yang dikirim kementerian lewat barcode. Buka satu isian untuk memeriksa dan memberi nilai audit.</p></div><button class="bt p" onclick="syncNow()">Tarik isian terbaru</button></div>
${AUDIT.uji()?'<div class="wn">Mode uji: server belum tersambung. Isian hanya terbaca dari peramban ini. Isi AUDIT_ENDPOINT di config.js (lihat PANDUAN-AUDIT.txt).</div>':''}
<div class="gr gs" style="margin-bottom:16px">${card(cnt('menunggu'),'Menunggu audit',1)}${card(cnt('revisi'),'Perlu revisi')}${card(cnt('sah'),'Disahkan')}${card(ps.length,'Total isian')}</div>
${ps.length?`<div class="cd ov"><table><tr><th>Program kerja</th><th>Kementerian</th><th>Penanggung jawab</th><th>Status audit</th><th>Nilai</th></tr>${ps.map(p=>{const s=sc(p).fin;return`<tr class="cl" onclick="go('prk/${p.id}')"><td><b>${E(p.name)}</b></td><td>${E(mn(p.mid))}</td><td>${E(p.pic)}</td><td>${ab(p.aud)}</td><td>${N(s)} ${bd(s)}</td></tr>`}).join('')}</table></div>`:empty('<h3>Belum ada isian</h3><p>Bagikan barcode tiap kementerian dari menu Barcode. Isian yang masuk akan muncul di sini.</p><p><button class="bt p" onclick="go(\'qr\')">Buka Barcode</button></p>')}`};

/* ---- Barcode ---- */
const qsvg=(u,b)=>QR.svg(QR.make(u),{border:b??2,dark:'#0d2a38',light:'#ffffff'});
function poster(m,cb){const u=lnk(m),q=QR.make(u),t=document.createElement('canvas');QR.canvas(t,q,12,3);const W=760,H=980,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  x.fillStyle='#fffbef';x.fillRect(0,0,W,H);x.fillStyle='#f8d24a';x.beginPath();x.moveTo(40,300);x.arc(W/2,300,W/2-40,Math.PI,0);x.lineTo(W-40,H-40);x.lineTo(40,H-40);x.closePath();x.fill();
  x.fillStyle='#0d2a38';x.textAlign='center';x.font='600 40px Fraunces,Georgia,serif';x.fillText('Penilaian Kinerja',W/2,150);x.font='700 34px "Plus Jakarta Sans",sans-serif';x.fillText(m.name.slice(0,34),W/2,205);
  const s=440;x.fillStyle='#fff';x.fillRect((W-s)/2-18,260,s+36,s+36);x.drawImage(t,(W-s)/2,278,s,s);
  x.font='600 26px "Plus Jakarta Sans",sans-serif';x.fillText('Pindai untuk mengisi program kerja',W/2,790);x.font='500 20px "Plus Jakarta Sans",sans-serif';x.fillText('Kabinet Samasta · '+(S.cfg.periode||'Audit Kinerja'),W/2,830);cb(c.toDataURL('image/png'))}
window.qrDl=id=>{const m=S.m.find(x=>x.id==id);poster(m,u=>{const a=document.createElement('a');a.href=u;a.download='barcode-'+m.name.replace(/[^\w]+/g,'-')+'.png';document.body.append(a);a.click();a.remove()})};
window.qrCopy=async id=>{const m=S.m.find(x=>x.id==id);try{await navigator.clipboard.writeText(lnk(m));toast('Tautan disalin')}catch(e){prompt('Salin tautan ini:',lnk(m))}};
window.qrReset=async id=>{const m=S.m.find(x=>x.id==id);if(!await ask(`Buat barcode baru untuk <b>${E(m.name)}</b>? Barcode dan tautan lama langsung tidak berlaku.`))return;m.tk=tok();lg('Mengganti barcode '+m.name);save();await pushM(1);R(1);toast('Barcode diganti. Bagikan yang baru.')};
window.qrPrint=()=>{if(!S.m.length)return toast('Belum ada kementerian');$('#rpt').innerHTML=S.m.map(m=>`<section class="cv" style="padding-top:20mm"><img src="${LOGO}" alt=""><h1>${E(m.name)}</h1><h2>Penilaian Kinerja Program Kerja</h2><div style="width:90mm;margin:8mm auto">${qsvg(lnk(m),2)}</div><p>Pindai barcode, lalu isi data program kerja.</p><p style="color:#555;font-size:9pt">${E(AUDIT.base())}</p></section>`).join('');setTimeout(()=>print(),300)};
PG.qr=function(){setTimeout(()=>{if(!window._qp){window._qp=1;pushM(1)}},0);const lh=/^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname)||location.protocol=='file:';
  return`<div class="hd"><div><h1>Barcode Kementerian</h1><p>Setiap kementerian punya barcode sendiri. Isian yang dikirim langsung masuk ke Kotak Masuk untuk diaudit.</p></div><button class="bt d" onclick="qrPrint()">Cetak semua barcode</button></div>
${lh?'<div class="wn x">Alamat situs masih alamat lokal ('+E(location.host||'file')+'). Barcode tidak bisa dibuka dari HP kementerian. Setelah di-deploy, isi AUDIT_BASE di config.js dengan alamat situs.</div>':''}${AUDIT.uji()?'<div class="wn">Mode uji: server belum tersambung. Isian hanya tersimpan di peramban ini. Isi AUDIT_ENDPOINT di config.js agar kementerian bisa mengirim dari perangkat mereka.</div>':''}
${S.m.length?`<div class="gr">${S.m.map(m=>`<div class="cd qrc"><div class="arc"><h3 style="margin:0">${E(m.name)}</h3><p style="color:var(--gd);font-weight:600;margin:0">${E(m.head)}</p></div><div class="qq">${qsvg(lnk(m))}</div><code>${E(lnk(m))}</code><div class="fb" style="justify-content:center;margin:0"><button class="bt s p" onclick="qrDl('${m.id}')">Unduh poster</button><button class="bt s" onclick="qrCopy('${m.id}')">Salin tautan</button><button class="bt s r" onclick="qrReset('${m.id}')">Ganti barcode</button></div></div>`).join('')}</div>`:empty('<h3>Belum ada kementerian</h3><p>Tambahkan kementerian dulu, barcode dibuat otomatis.</p><p><button class="bt p" onclick="go(\'min\')">Tambah kementerian</button></p>')}`};

boot();if(AU)autoPull();
})();
