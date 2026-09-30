/* MoneyFlow cloud sync: Firebase Auth (Google) + Firestore. Dán cấu hình Firebase của bạn vào đây. */
const firebaseConfig={apiKey:"AIzaSyAZLbkfXtBujPW8RM4OOS9XqwDffoYaRGU",authDomain:"moneyflow-33113.firebaseapp.com",projectId:"moneyflow-33113",appId:"1:215160257459:web:85f9d70d983b09f487a9c6"};
const ok=!firebaseConfig.apiKey.startsWith('PASTE');
const H=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let user=null,fb=null,db,auth,applying=false,unsubs=[],st='';const known={transactions:new Set(),categories:new Set()},SYNC={transactions:1,categories:1};
window.mfSyncUI=()=>{const e=document.getElementById('sync');if(!e)return;
e.innerHTML='<h3 style="margin-top:0">Đồng bộ đám mây</h3>'+(!ok?'<p>Chưa cấu hình Firebase. Dữ liệu chỉ lưu trên thiết bị này.</p>':user?`<p>Đã đăng nhập: <b>${H(user.email)}</b><br><small>${st||'Dữ liệu tự đồng bộ giữa các thiết bị.'}</small></p><div class="btns"><button data-logout>Đăng xuất</button></div>`:`<p>Đăng nhập để lưu dữ liệu lên tài khoản Google của bạn và dùng trên nhiều thiết bị.</p><div class="btns"><button class="pri" data-login>Đăng nhập với Google</button></div>`)};
const mfdb=()=>window.mfDB&&window.mfDB();
const refresh=(()=>{let t;return()=>{clearTimeout(t);t=setTimeout(()=>window.mfRefresh&&window.mfRefresh(),200)}})();
/* Chặn put/delete/clear của IndexedDB để đẩy thay đổi lên Firestore */
const P=IDBObjectStore.prototype,op=P.put,od=P.delete,oc=P.clear;
const clean=v=>JSON.parse(JSON.stringify(v));
const push=(s,v)=>fb.setDoc(fb.doc(db,'users',user.uid,s,String(v.id)),clean(v)).catch(e=>{st='Lỗi đồng bộ: '+e.code;mfSyncUI()});
const rm=(s,id)=>fb.deleteDoc(fb.doc(db,'users',user.uid,s,String(id))).catch(()=>{});
P.put=function(v,k){if(!applying&&user&&fb&&SYNC[this.name])push(this.name,v);return op.call(this,v,k)};
P.delete=function(k){if(!applying&&user&&fb&&SYNC[this.name])rm(this.name,k);return od.call(this,k)};
P.clear=function(){if(!applying&&user&&fb&&SYNC[this.name])[...known[this.name]].forEach(id=>rm(this.name,id));return oc.call(this)};
const local=s=>new Promise(r=>{const q=mfdb().transaction(s).objectStore(s).getAll();q.onsuccess=()=>r(q.result)});
const apply=(s,puts,dels)=>new Promise(r=>{const t=mfdb().transaction(s,'readwrite'),o=t.objectStore(s);applying=true;puts.forEach(x=>o.put(x));dels.forEach(k=>o.delete(k));applying=false;t.oncomplete=r;t.onerror=r});
function listen(s){let first=true;return fb.onSnapshot(fb.collection(db,'users',user.uid,s),async snap=>{
 if(first){first=false;known[s]=new Set(snap.docs.map(d=>d.id));const L=await local(s),lm=new Map(L.map(x=>[x.id,x])),rm_=new Map(snap.docs.map(d=>[d.id,d.data()]));
  if(s=='categories'){await apply(s,[...rm_.values()].filter(r=>!lm.has(r.id)),[]);L.forEach(x=>{push(s,x);known[s].add(x.id)})}
  else{const up=[];rm_.forEach((r,id)=>{const l=lm.get(id);if(!l||(r.updatedAt||0)>(l.updatedAt||0))up.push(r)});await apply(s,up,[]);
   L.forEach(l=>{const r=rm_.get(l.id);if(!r||(l.updatedAt||0)>(r.updatedAt||0)){push(s,l);known[s].add(l.id)}})}
  refresh();return}
 const puts=[],dels=[];snap.docChanges().forEach(c=>{if(c.doc.metadata.hasPendingWrites)return;const id=c.doc.id;
  if(c.type=='removed'){known[s].delete(id);dels.push(id)}else{known[s].add(id);puts.push(c.doc.data())}});
 if(puts.length||dels.length){await apply(s,puts,dels);refresh()}})}
async function start(){while(!mfdb())await new Promise(r=>setTimeout(r,100));
 const prev=localStorage.getItem('mf_uid');if(prev&&prev!==user.uid){const L=await local('transactions');await apply('transactions',[],L.map(x=>x.id))}
 localStorage.setItem('mf_uid',user.uid);unsubs=[listen('transactions'),listen('categories')];mfSyncUI()}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-login],[data-logout]');if(!b||!fb)return;
 try{if('login' in b.dataset)await fb.signInWithPopup(auth,new fb.GoogleAuthProvider());else await fb.signOut(auth)}catch(x){alert('Không đăng nhập được: '+(x.code||x.message))}});
if(ok){const B='https://www.gstatic.com/firebasejs/10.12.2/',[a,f,g]=await Promise.all([import(B+'firebase-app.js'),import(B+'firebase-firestore.js'),import(B+'firebase-auth.js')]);
 fb={...f,...g};const app=a.initializeApp(firebaseConfig);auth=g.getAuth(app);
 db=f.initializeFirestore(app,{localCache:f.persistentLocalCache({tabManager:f.persistentMultipleTabManager()})});
 g.onAuthStateChanged(auth,u=>{unsubs.forEach(x=>x());unsubs=[];user=u;st='';if(u)start();else mfSyncUI()})}
mfSyncUI();
