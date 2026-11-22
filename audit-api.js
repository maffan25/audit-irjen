/* audit-api.js: jembatan ke Google Apps Script. Dipakai index.html (admin) dan isi.html (kementerian).
   Tanpa AUDIT_ENDPOINT, berjalan dalam "mode uji": data disimpan di peramban ini saja. */
(function(w){
var TK='audit_test_db',EP=function(){return (w.AUDIT_ENDPOINT||'').trim()};
function db(){try{return JSON.parse(localStorage.getItem(TK))||{m:{},r:{}}}catch(e){return{m:{},r:{}}}}
function put(d){localStorage.setItem(TK,JSON.stringify(d))}
function rid(){return 'S'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function lokal(a,d){
  var D=db(),m=D.m[d.mid];
  if(a==='masuk')return{ok:!!w.HASH&&d.hash===w.HASH};
  if(a==='sinkron'){D.m={};(d.daftar||[]).forEach(function(x){D.m[x.id]=x});put(D);return{ok:true}}
  if(a==='ambil'){return{ok:true,data:Object.keys(D.r).map(function(k){return D.r[k]})}}
  if(a==='audit'){var r=D.r[d.sid];if(!r)return{ok:false,error:'tidak ada'};r.aud=d.aud;r.cat=d.cat||'';r.skor=d.skor||null;r.upd=Date.now();put(D);return{ok:true}}
  if(!m||m.tk!==d.tk)return{ok:false,error:'tautan'};
  if(a==='info')return{ok:true,nama:m.name,kepala:m.head,periode:m.periode||''};
  if(a==='status')return{ok:true,data:(d.sids||[]).map(function(s){var r=D.r[s];return r&&r.mid===d.mid?{sid:s,aud:r.aud,cat:r.cat,ver:r.ver,data:r.aud==='revisi'?r.data:undefined}:null}).filter(Boolean)};
  if(a==='kirim'){var r=d.sid&&D.r[d.sid];
    if(r){if(r.mid!==d.mid||r.aud==='sah')return{ok:false,error:'terkunci'};r.data=d.data;r.ver++;r.aud='menunggu';r.upd=Date.now()}
    else{var s=rid();D.r[s]={sid:s,mid:d.mid,ver:1,at:Date.now(),upd:Date.now(),aud:'menunggu',cat:'',data:d.data};d.sid=s}
    put(D);return{ok:true,sid:d.sid}}
  return{ok:false,error:'aksi'}}
w.AUDIT={
  uji:function(){return !EP()},
  api:function(a,d){d=d||{};
    if(!EP())return Promise.resolve(lokal(a,d));
    var o=Object.assign({aksi:a},d);
    return fetch(EP(),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(o)})
      .then(function(r){return r.json()}).catch(function(){return{ok:false,error:'jaringan'}})},
  base:function(){var b=(w.AUDIT_BASE||'').trim().replace(/\/+$/,'');return b||location.href.replace(/[#?].*$/,'').replace(/[^\/]*$/,'').replace(/\/+$/,'')}
};
})(window);
