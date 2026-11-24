/* audit-api.js: jembatan ke server (Supabase atau Google Apps Script). Dipakai index.html (admin) dan isi.html (kementerian).
   Tanpa sambungan server, berjalan dalam "mode uji": data disimpan di peramban ini saja.
   MODEL BARU: satu barcode per bulan untuk semua kementerian; tiap kementerian mengisi satu kali per bulan. */
(function(w){
var TK='audit_test_db',EP=function(){return (w.AUDIT_ENDPOINT||'').trim()};
var SB=function(){return (w.AUDIT_SUPABASE_URL||'').trim().replace(/\/+$/,'')},KY=function(){return (w.AUDIT_SUPABASE_KEY||'').trim()};
var FN={masuk:'a_masuk',sinkron:'a_sinkron',ambil:'a_ambil',audit:'a_audit',bulan:'a_bulan',lepas:'a_lepas',buka:'k_buka',pilih:'k_pilih',batal:'k_batal',kirim:'k_kirim'};
function supa(a,d){var b={};Object.keys(d).forEach(function(k){b['p_'+k]=d[k]});
  var h={'Content-Type':'application/json',apikey:KY()};if(/^eyJ/.test(KY()))h.Authorization='Bearer '+KY();
  return fetch(SB()+'/rest/v1/rpc/'+FN[a],{method:'POST',headers:h,body:JSON.stringify(b)})
    .then(function(r){return r.json()}).then(function(j){return j&&typeof j==='object'&&'ok' in j?j:{ok:false,error:'server'}})
    .catch(function(){return{ok:false,error:'jaringan'}})}
/* ---- mode uji: meniru server di peramban ini (aturan sama dengan supabase-audit.sql) ---- */
var JAM3=3*3600*1000;
function db(){var D;try{D=JSON.parse(localStorage.getItem(TK))}catch(e){}D=D||{};D.m=D.m||{};D.r=D.r||{};D.b=D.b||{};D.c=D.c||{};return D}
function put(d){localStorage.setItem(TK,JSON.stringify(d))}
function rid(){return 'S'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function tok(){return (Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)).slice(0,10)}
function cekTk(D,t){if(!t)return '';var k=Object.keys(D.b).filter(function(x){return D.b[x].token===t})[0];return k?(D.b[k].aktif?k:'!lama'):''}
function sidIsian(D,b,mid){var l=Object.keys(D.r).map(function(k){return D.r[k]}).filter(function(r){return r.bulan===b&&r.mid===mid}).sort(function(x,y){return y.at-x.at});return l[0]||null}
function bersih(D,b){var n=Date.now();Object.keys(D.c).forEach(function(k){if(D.c[k].sampai<=n)delete D.c[k]})}
function lokal(a,d){
  var D=db(),n=Date.now(),b,t;
  if(a==='masuk')return{ok:!!w.HASH&&d.hash===w.HASH};
  if(a==='sinkron'){D.m={};(d.daftar||[]).forEach(function(x){D.m[x.id]={id:x.id,name:x.name,head:x.head||''}});put(D);return{ok:true}}
  if(a==='ambil'){return{ok:true,data:Object.keys(D.r).map(function(k){return D.r[k]})}}
  if(a==='audit'){var r=D.r[d.sid];if(!r)return{ok:false,error:'tidak ada'};r.aud=d.aud;r.cat=d.cat||'';r.skor=d.skor||null;r.upd=Date.now();put(D);return{ok:true}}
  if(a==='bulan'){
    if(d.bulan){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(d.bulan))return{ok:false,error:'data'};
      if(!D.b[d.bulan])D.b[d.bulan]={kode:d.bulan,token:tok(),aktif:false};else if(d.ganti)D.b[d.bulan].token=tok();
      Object.keys(D.b).forEach(function(k){D.b[k].aktif=k===d.bulan})}
    var ak=Object.keys(D.b).filter(function(k){return D.b[k].aktif})[0];if(!ak){put(D);return{ok:true,bulan:null}}
    bersih(D);put(D);
    return{ok:true,bulan:ak,tk:D.b[ak].token,daftar:Object.keys(D.m).map(function(k){return D.m[k]}).map(function(m){var i=sidIsian(D,ak,m.id),c=D.c[ak+'|'+m.id];
      return{id:m.id,nama:m.name,kepala:m.head,st:i?'terkirim':c?'mengisi':'kosong',aud:i?i.aud:null,sid:i?i.sid:null}}).sort(function(x,y){return x.nama.localeCompare(y.nama)})}}
  if(a==='lepas'){var ab=Object.keys(D.b).filter(function(k){return D.b[k].aktif})[0];if(!ab)return{ok:false,error:'tidak ada'};
    delete D.c[ab+'|'+d.mid];if(d.hapus)Object.keys(D.r).forEach(function(k){if(D.r[k].bulan===ab&&D.r[k].mid===d.mid)delete D.r[k]});put(D);return{ok:true}}
  /* ---- sisi kementerian ---- */
  b=cekTk(D,d.tk);if(b==='!lama')return{ok:false,error:'lama'};if(!b)return{ok:false,error:'tautan'};
  if(String(d.dev||'').length<8)return{ok:false,error:'perangkat'};
  bersih(D);var key=b+'|'+d.mid,c=D.c[key],i;
  if(a==='buka'){
    Object.keys(D.c).forEach(function(k){if(D.c[k].bulan===b&&D.c[k].dev===d.dev)D.c[k].sampai=n+JAM3});
    var ms=Object.keys(D.m).map(function(k){return D.m[k]}),daftar=[],saya=[];
    ms.forEach(function(m){var ii=sidIsian(D,b,m.id),cc=D.c[b+'|'+m.id],it={id:m.id,nama:m.name,kepala:m.head};
      if((!ii||ii.aud==='revisi')&&!cc)daftar.push({id:m.id,nama:m.name,kepala:m.head,rv:!!ii&&ii.aud==='revisi'});
      if(cc&&cc.dev===d.dev){it.st=ii&&ii.aud==='revisi'?'revisi':'mengisi';if(ii){it.sid=ii.sid;it.aud=ii.aud;it.cat=ii.cat;it.ver=ii.ver;if(ii.aud==='revisi')it.data=ii.data}saya.push(it)}
      else if(ii&&ii.dev===d.dev){it.st='terkirim';it.sid=ii.sid;it.aud=ii.aud;it.cat=ii.cat;it.ver=ii.ver;saya.push(it)}});
    var srt=function(x,y){return x.nama.localeCompare(y.nama)};daftar.sort(srt);saya.sort(srt);put(D);return{ok:true,bulan:b,daftar:daftar,saya:saya}}
  if(a==='pilih'){if(!D.m[d.mid])return{ok:false,error:'tidak ada'};i=sidIsian(D,b,d.mid);if(i&&i.aud!=='revisi')return{ok:false,error:'sudah'};
    if(c&&c.dev!==d.dev)return{ok:false,error:'terpakai'};
    var mine=Object.keys(D.c).filter(function(k){return D.c[k].bulan===b&&D.c[k].dev===d.dev&&D.c[k].mid!==d.mid}).length;if(mine>=3)return{ok:false,error:'batas'};
    D.c[key]={bulan:b,mid:d.mid,dev:d.dev,sampai:n+JAM3};put(D);return{ok:true}}
  if(a==='batal'){if(c&&c.dev===d.dev)delete D.c[key];put(D);return{ok:true}}
  if(a==='kirim'){var x=d.data||{};
    if(!x.name||!x.obj)return{ok:false,error:'data'};
    if(!Array.isArray(x.kpis)||!x.kpis.length||x.kpis.length>20)return{ok:false,error:'kpi'};
    if(x.kpis.reduce(function(s,k){return s+(+k.w||0)},0)!==100)return{ok:false,error:'bobot'};
    if(!D.m[d.mid])return{ok:false,error:'tidak ada'};
    if(c&&c.dev!==d.dev)return{ok:false,error:'terpakai'};
    i=sidIsian(D,b,d.mid);
    if(i){if(i.aud!=='revisi')return{ok:false,error:'sudah'};i.data=x;i.ver++;i.aud='menunggu';i.upd=n;i.dev=d.dev;delete D.c[key];put(D);return{ok:true,sid:i.sid}}
    var s=rid();D.r[s]={sid:s,mid:d.mid,ver:1,at:n,upd:n,aud:'menunggu',cat:'',data:x,bulan:b,dev:d.dev};delete D.c[key];put(D);return{ok:true,sid:s}}
  return{ok:false,error:'aksi'}}
w.AUDIT={
  uji:function(){return !EP()&&!(SB()&&KY())},
  api:function(a,d){d=d||{};
    if(SB()&&KY())return supa(a,d);
    if(!EP())return Promise.resolve(lokal(a,d));
    var o=Object.assign({aksi:a},d);
    return fetch(EP(),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(o)})
      .then(function(r){return r.json()}).catch(function(){return{ok:false,error:'jaringan'}})},
  base:function(){var b=(w.AUDIT_BASE||'').trim().replace(/\/+$/,'');return b||location.href.replace(/[#?].*$/,'').replace(/[^\/]*$/,'').replace(/\/+$/,'')}
};
})(window);

/* efek tekan: riak + getar ringan di HP */
document.addEventListener('pointerdown',function(e){var t=e.target.closest&&e.target.closest('.bt,.tabs button,.steps button,.stk button,#sb a,.gb');if(!t||t.disabled)return;
 var r=t.getBoundingClientRect(),s=Math.max(r.width,r.height)*2,d=document.createElement('span');d.className='rpl';
 d.style.cssText='width:'+s+'px;height:'+s+'px;left:'+(e.clientX-r.left-s/2)+'px;top:'+(e.clientY-r.top-s/2)+'px';t.appendChild(d);setTimeout(function(){d.remove()},650);
 try{navigator.vibrate&&navigator.vibrate(8)}catch(x){}},{passive:true});
