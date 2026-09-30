'use strict';
const $=s=>document.querySelector(s),app=$('#app'),dlg=$('#dlg');
const fmt=n=>new Intl.NumberFormat('vi-VN').format(Math.round(n))+' ₫';
const pc=n=>(isFinite(n)?n.toFixed(1).replace('.',','):'0')+'%';
const chg=(a,b)=>b?((a-b)/Math.abs(b)*100):(a?100:0);
const sg=n=>(n>0?'+':'')+pc(n);
const p2=n=>String(n).padStart(2,'0'),td=()=>{const d=new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())};
const dmy=s=>s.split('-').reverse().join('/');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const shift=(m,d)=>{let[y,mo]=m.split('-').map(Number);mo+=d;while(mo<1){mo+=12;y--}while(mo>12){mo-=12;y++}return y+'-'+p2(mo)};
/* ---- IndexedDB ---- */
let db;
const openDB=()=>new Promise((ok,no)=>{const r=indexedDB.open('moneyflow',1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('transactions',{keyPath:'id'});d.createObjectStore('categories',{keyPath:'id'});d.createObjectStore('settings',{keyPath:'key'})};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
const run=(s,f)=>new Promise((ok,no)=>{const t=db.transaction(s,'readwrite'),st=[].concat(s).map(n=>t.objectStore(n)),q=f(...st);t.oncomplete=()=>ok(q&&q.result);t.onerror=()=>no(t.error)});
const getAll=s=>new Promise((ok,no)=>{const q=db.transaction(s).objectStore(s).getAll();q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
const DC=[['e','🍜','Ăn uống','#f59e0b'],['e','🏠','Nhà ở','#6366f1'],['e','🚗','Di chuyển','#0ea5e9'],['e','🛒','Mua sắm','#ec4899'],['e','💡','Hóa đơn','#eab308'],['e','🎮','Giải trí','#8b5cf6'],['e','❤️','Sức khỏe','#ef4444'],['e','📚','Giáo dục','#14b8a6'],['e','✈️','Du lịch','#06b6d4'],['e','👕','Thời trang','#d946ef'],['e','🎁','Quà tặng','#f97316'],['e','📦','Khác','#64748b'],['i','💼','Lương','#0f9d6e'],['i','💰','Thưởng','#22c55e'],['i','🧑‍💻','Freelance','#10b981'],['i','📈','Đầu tư','#84cc16'],['i','🎁','Khác','#14b8a6']].map((c,i)=>({id:'c'+i,type:c[0]=='e'?'expense':'income',icon:c[1],name:c[2],color:c[3]}));
let T=[],C=[],S={theme:'system'},V='dash',M=td().slice(0,7),Y=+td().slice(0,4),RT='m',F={},CALD=null,charts=[];
const cat=id=>C.find(c=>c.id==id)||{icon:'📦',name:'Đã xóa',color:'#64748b'};
const sum=(l,t)=>l.filter(x=>x.type==t).reduce((a,x)=>a+x.amount,0);
const stat=l=>{const i=sum(l,'income'),e=sum(l,'expense');return{i,e,r:i-e,s:i?(i-e)/i*100:0}};
const inM=m=>T.filter(t=>t.date.startsWith(m)),inY=y=>T.filter(t=>t.date.startsWith(y+'-'));
const byCat=l=>{const o={};l.filter(t=>t.type=='expense').forEach(t=>o[t.categoryId]=(o[t.categoryId]||0)+t.amount);return Object.entries(o).sort((a,b)=>b[1]-a[1])};
/* ---- theme ---- */
const applyTheme=()=>{const d=S.theme=='dark'||(S.theme=='system'&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'};
matchMedia('(prefers-color-scheme:dark)').addEventListener('change',applyTheme);
const saveS=()=>run('settings',s=>s.put({key:'theme',value:S.theme}));
/* ---- ui helpers ---- */
const kpis=s=>`<div class="kpis"><div class="kpi"><small>Thu nhập</small><b class="inc">${fmt(s.i)}</b></div><div class="kpi"><small>Chi tiêu</small><b class="exp">${fmt(s.e)}</b></div><div class="kpi"><small>Còn lại</small><b>${fmt(s.r)}</b></div><div class="kpi"><small>Tỷ lệ tiết kiệm</small><b>${pc(s.s)}</b></div></div>`;
const txRow=t=>{const c=cat(t.categoryId);return`<div class="row"><div class="ic" style="background:${c.color}22">${c.icon}</div><div class="m"><b>${esc(c.name)}</b><small>${dmy(t.date)}${t.note?' · '+esc(t.note):''}</small></div><div class="a ${t.type=='income'?'inc':'exp'}">${t.type=='income'?'+':'-'}${fmt(t.amount)}</div><button data-e="${t.id}" aria-label="Sửa">✏️</button><button data-d="${t.id}" aria-label="Xóa">🗑️</button></div>`};
const empty=()=>`<div class="card empty"><b>Chưa có giao dịch</b><p>Hãy thêm giao dịch đầu tiên để bắt đầu theo dõi chi tiêu.</p><button data-add>+ Thêm giao dịch</button></div>`;
const pn=l=>`<div class="pn"><button data-p="-1">←</button><b>${l}</b><button data-p="1">→</button></div>`;
const mLabel=m=>'Tháng '+m.slice(5)+'/'+m.slice(0,4);
const catBars=l=>{const c=byCat(l),tot=c.reduce((a,x)=>a+x[1],0);return c.length?c.map(([id,v])=>{const k=cat(id);return`<div style="margin:10px 0;cursor:pointer" data-cat="${id}"><div style="display:flex;justify-content:space-between"><span>${k.icon} ${esc(k.name)}</span><span>${fmt(v)} · ${pc(v/tot*100)}</span></div><div class="bar"><i style="width:${v/tot*100}%;background:${k.color}"></i></div></div>`}).join(''):'<p class="empty">Không có chi tiêu.</p>'};
const mk=(id,cfg)=>{const e=document.getElementById(id);if(e)charts.push(new Chart(e,{...cfg,options:{responsive:true,maintainAspectRatio:false,...cfg.options}}))};
const donut=(id,l)=>{const c=byCat(l);mk(id,{type:'doughnut',data:{labels:c.map(x=>cat(x[0]).name),datasets:[{data:c.map(x=>x[1]),backgroundColor:c.map(x=>cat(x[0]).color),borderWidth:0}]},options:{plugins:{legend:{position:'right',labels:{color:getComputedStyle(document.body).color,boxWidth:12}}}}})};
const tick=()=>getComputedStyle(document.body).color;
const cmpChart=(id,a,b,la,lb)=>mk(id,{type:'bar',data:{labels:['Thu nhập','Chi tiêu','Còn lại'],datasets:[{label:la,data:[a.i,a.e,a.r],backgroundColor:'#94a3b8'},{label:lb,data:[b.i,b.e,b.r],backgroundColor:'#0f766e'}]},options:{plugins:{legend:{labels:{color:tick()}}},scales:{x:{ticks:{color:tick()}},y:{ticks:{color:tick()}}}}});
/* ---- views ---- */
function dash(){const l=inM(M),s=stat(l);
app.innerHTML=`<h2>Tổng quan — ${mLabel(M)}</h2>${pn(mLabel(M))}${T.length?kpis(s)+`<div class="card" style="margin-top:14px"><h3 style="margin-top:0">Biểu đồ thu / chi</h3><div class="cv"><canvas id="c1"></canvas></div></div><div class="card"><h3 style="margin-top:0">Chi tiêu theo danh mục</h3>${l.some(t=>t.type=='expense')?'<div class="cv"><canvas id="c2"></canvas></div>':'<p class="empty">Chưa có chi tiêu trong tháng này.</p>'}</div><div class="card"><h3 style="margin-top:0">Giao dịch gần đây</h3>${[...T].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt).slice(0,5).map(txRow).join('')}</div>`:empty()}`;
if(T.length){mk('c1',{type:'bar',data:{labels:['Thu nhập','Chi tiêu','Còn lại'],datasets:[{data:[s.i,s.e,s.r],backgroundColor:['#0f9d6e','#e2574c','#0f766e']}]},options:{plugins:{legend:{display:false}},scales:{x:{ticks:{color:tick()}},y:{ticks:{color:tick()}}}}});if(l.some(t=>t.type=='expense'))donut('c2',l)}}
function txs(){const f=F;let l=T.filter(t=>(!f.q||(t.note+cat(t.categoryId).name).toLowerCase().includes(f.q.toLowerCase()))&&(!f.m||t.date.startsWith(f.m))&&(!f.y||t.date.startsWith(f.y+'-'))&&(!f.t||t.type==f.t)&&(!f.c||t.categoryId==f.c)&&(!f.a||t.amount>=f.a)&&(!f.b||t.amount<=f.b));
l.sort((a,b)=>(f.o=='asc'?1:-1)*(a.date.localeCompare(b.date)||a.createdAt-b.createdAt));
let h='',last='';l.forEach(t=>{if(t.date!=last){h+=`<h3>${dmy(t.date)}</h3>`;last=t.date}h+=txRow(t)});
const ys=[...new Set(T.map(t=>t.date.slice(0,4)))].sort();
app.innerHTML=`<h2>Giao dịch</h2><div class="tools"><input id="fq" placeholder="Tìm kiếm" value="${esc(f.q||'')}"><input id="fm" type="month" value="${f.m||''}"><select id="fy"><option value="">Mọi năm</option>${ys.map(y=>`<option ${f.y==y?'selected':''}>${y}</option>`).join('')}</select><select id="ft"><option value="">Thu & chi</option><option value="income" ${f.t=='income'?'selected':''}>Thu nhập</option><option value="expense" ${f.t=='expense'?'selected':''}>Chi tiêu</option></select><select id="fc"><option value="">Mọi danh mục</option>${C.map(c=>`<option value="${c.id}" ${f.c==c.id?'selected':''}>${c.icon} ${esc(c.name)} (${c.type=='income'?'thu':'chi'})</option>`).join('')}</select><input id="fa" type="number" min="0" placeholder="Từ số tiền" value="${f.a||''}"><input id="fb" type="number" min="0" placeholder="Đến số tiền" value="${f.b||''}"><select id="fo"><option value="desc">Mới nhất</option><option value="asc" ${f.o=='asc'?'selected':''}>Cũ nhất</option></select><button data-clr>Xóa lọc</button></div><div class="card">${l.length?h:T.length?'<p class="empty">Không có giao dịch phù hợp.</p>':empty()}</div>`;
const g=(id,k,n)=>{$('#'+id).onchange=e=>{f[k]=n?+e.target.value||0:e.target.value;txs()}};g('fm','m');g('fy','y');g('ft','t');g('fc','c');g('fa','a',1);g('fb','b',1);g('fo','o');
$('#fq').oninput=e=>{f.q=e.target.value;const p=e.target.selectionStart;txs();const q=$('#fq');q.focus();q.setSelectionRange(p,p)}}
function rep(){const tabs=`<div class="seg"><button data-rt="m" class="${RT=='m'?'on':''}">Tháng</button><button data-rt="y" class="${RT=='y'?'on':''}">Năm</button></div>`;
if(RT=='m'){const s=stat(inM(M)),pm=shift(M,-1),ps=stat(inM(pm));
app.innerHTML=`<h2>Báo cáo</h2>${tabs}${pn(mLabel(M))}${kpis(s)}<div class="card" style="margin-top:14px"><h3 style="margin-top:0">Chi tiêu theo danh mục</h3>${s.e?'<div class="cv"><canvas id="c1"></canvas></div>':''}${catBars(inM(M))}</div><div class="card"><h3 style="margin-top:0">So sánh ${mLabel(pm)} với ${mLabel(M)}</h3><table><tr><th></th><th>T${pm.slice(5)}</th><th>T${M.slice(5)}</th><th>Đổi</th></tr>${[['Thu nhập','i'],['Chi tiêu','e'],['Còn lại','r']].map(([n,k])=>`<tr><td>${n}</td><td>${fmt(ps[k])}</td><td>${fmt(s[k])}</td><td>${sg(chg(s[k],ps[k]))}</td></tr>`).join('')}<tr><td>Tỷ lệ tiết kiệm</td><td>${pc(ps.s)}</td><td>${pc(s.s)}</td><td>${sg(chg(s.s,ps.s))}</td></tr></table><div class="cv" style="margin-top:12px"><canvas id="c2"></canvas></div></div>`;
if(s.e)donut('c1',inM(M));cmpChart('c2',ps,s,'T'+pm.slice(5),'T'+M.slice(5))}
else{const l=inY(Y),s=stat(l),ps=stat(inY(Y-1));
app.innerHTML=`<h2>Báo cáo</h2>${tabs}${pn('Năm '+Y)}<h3 style="margin-top:0">BÁO CÁO TÀI CHÍNH ${Y}</h3>${kpis(s)}<div class="card" style="margin-top:14px"><h3 style="margin-top:0">Thu nhập / chi tiêu ${Y}</h3><div class="chk"><label><input type="checkbox" data-sr="0" checked> Income</label><label><input type="checkbox" data-sr="1" checked> Expense</label><label><input type="checkbox" data-sr="2" checked> Remaining</label></div><div class="cv"><canvas id="c1"></canvas></div></div><div class="card"><h3 style="margin-top:0">Chi tiêu năm ${Y}</h3>${catBars(l)}</div><div class="card"><h3 style="margin-top:0">So sánh ${Y-1} với ${Y}</h3><table><tr><th></th><th>${Y-1}</th><th>${Y}</th><th>Đổi</th></tr>${[['Thu nhập','i'],['Chi tiêu','e'],['Còn lại','r']].map(([n,k])=>`<tr><td>${n}</td><td>${fmt(ps[k])}</td><td>${fmt(s[k])}</td><td>${sg(chg(s[k],ps[k]))}</td></tr>`).join('')}</table></div>`;
const ms=[...Array(12)].map((_,i)=>stat(inM(Y+'-'+p2(i+1))));
mk('c1',{type:'bar',data:{labels:ms.map((_,i)=>'T'+(i+1)),datasets:[{label:'Thu nhập',data:ms.map(m=>m.i),backgroundColor:'#0f9d6e'},{label:'Chi tiêu',data:ms.map(m=>m.e),backgroundColor:'#e2574c'},{label:'Còn lại',data:ms.map(m=>m.r),backgroundColor:'#0f766e'}]},options:{plugins:{legend:{display:false}},scales:{x:{ticks:{color:tick()}},y:{ticks:{color:tick()}}}}});
document.querySelectorAll('[data-sr]').forEach(e=>e.onchange=()=>{const c=charts[0];c.setDatasetVisibility(+e.dataset.sr,e.checked);c.update()})}}
function cal(){const[y,m]=M.split('-').map(Number),first=(new Date(y,m-1,1).getDay()+6)%7,n=new Date(y,m,0).getDate(),days=new Set(inM(M).map(t=>t.date));
let g=['T2','T3','T4','T5','T6','T7','CN'].map(d=>`<b>${d}</b>`).join('')+'<span></span>'.repeat(first);
for(let d=1;d<=n;d++){const k=M+'-'+p2(d);g+=`<button data-day="${k}" class="${days.has(k)?'dot':''} ${CALD==k?'sel':''}">${d}</button>`}
const dl=CALD?T.filter(t=>t.date==CALD):[];
app.innerHTML=`<h2>Lịch</h2>${pn(mLabel(M))}<div class="card"><div class="cal">${g}</div></div>${CALD?`<div class="card"><h3 style="margin-top:0">${dmy(CALD)}</h3>${dl.length?dl.map(txRow).join(''):'<p class="empty">Không có giao dịch trong ngày này.</p>'}</div>`:''}`}
function set(){app.innerHTML=`<h2>Cài đặt</h2><div class="card" id="sync"></div><div class="card"><label>Giao diện</label><select id="th"><option value="system">Theo hệ thống</option><option value="light">Sáng</option><option value="dark">Tối</option></select></div><div class="card"><h3 style="margin-top:0">Danh mục</h3>${C.map(c=>`<div class="ce"><input class="i" type="text" value="${esc(c.icon)}" data-ci="${c.id}"><input type="text" value="${esc(c.name)}" data-cn="${c.id}" aria-label="Tên"><input type="color" value="${c.color}" data-cc="${c.id}"><button data-cd="${c.id}" aria-label="Xóa">🗑️</button></div><small style="color:var(--mut)">${c.type=='income'?'Thu nhập':'Chi tiêu'}</small>`).join('')}<div class="btns"><button data-nc="expense">+ Danh mục chi</button><button data-nc="income">+ Danh mục thu</button></div></div><div class="card"><h3 style="margin-top:0">Dữ liệu</h3><div class="btns"><button data-x="json">Xuất JSON</button><button data-x="csv">Xuất CSV</button></div><div class="btns"><button id="imp">Nhập JSON</button><input id="file" type="file" accept=".json" hidden></div><div class="btns"><button data-demo>Tạo dữ liệu demo</button><button data-cdemo>Xóa dữ liệu demo</button></div><p style="color:var(--mut);font-size:13px">Dữ liệu chỉ lưu trong trình duyệt của bạn (IndexedDB), không gửi đi đâu.</p></div>`;
window.mfSyncUI&&mfSyncUI();$('#th').value=S.theme;$('#th').onchange=e=>{S.theme=e.target.value;saveS();applyTheme()};
$('#imp').onclick=()=>$('#file').click();$('#file').onchange=importJ;
const ed=(a,k)=>document.querySelectorAll('['+a+']').forEach(e=>e.onchange=async()=>{const c=C.find(x=>x.id==e.getAttribute(a));if(k=='name'&&!e.value.trim()){e.value=c.name;return}c[k]=e.value.trim()||c[k];await run('categories',s=>s.put(c))});ed('data-ci','icon');ed('data-cn','name');ed('data-cc','color')}
/* ---- actions ---- */
function form(id){const t=T.find(x=>x.id==id)||{type:'expense',amount:'',categoryId:'',date:td(),note:''};
const opts=ty=>C.filter(c=>c.type==ty).map(c=>`<option value="${c.id}" ${t.categoryId==c.id?'selected':''}>${c.icon} ${esc(c.name)}</option>`).join('');
dlg.innerHTML=`<h2>${id?'Sửa':'Thêm'} giao dịch</h2><div class="seg" id="ty"><button type="button" data-t="expense" class="${t.type=='expense'?'on':''}">Chi tiêu</button><button type="button" data-t="income" class="${t.type=='income'?'on':''}">Thu nhập</button></div><label>Số tiền (₫)</label><input id="fa2" inputmode="numeric" autocomplete="off" placeholder="150.000" value="${t.amount?new Intl.NumberFormat('vi-VN').format(t.amount):''}"><label>Danh mục</label><select id="fc2">${opts(t.type)}</select><label>Ngày</label><input id="fd" type="date" value="${t.date}"><label>Ghi chú</label><input id="fn" value="${esc(t.note)}" placeholder="Ăn trưa"><p id="er" class="exp"></p><div class="btns"><button type="button" id="cx">Hủy</button><button type="button" class="pri" id="sv">Lưu</button></div>`;
let ty=t.type;dlg.showModal();$('#fa2').focus();
$('#fa2').oninput=e=>{const d=e.target.value.replace(/\D/g,'');e.target.value=d?new Intl.NumberFormat('vi-VN').format(+d):''};
document.querySelectorAll('#ty button').forEach(b=>b.onclick=()=>{ty=b.dataset.t;document.querySelectorAll('#ty button').forEach(x=>x.classList.toggle('on',x==b));$('#fc2').innerHTML=opts(ty)});
$('#cx').onclick=()=>dlg.close();
$('#sv').onclick=async()=>{const a=+$('#fa2').value.replace(/\D/g,''),d=$('#fd').value;if(!a){$('#er').textContent='Nhập số tiền lớn hơn 0.';return}if(!d||!$('#fc2').value){$('#er').textContent='Chọn danh mục và ngày.';return}
const now=Date.now(),n={...t,id:t.id||uid(),type:ty,amount:a,categoryId:$('#fc2').value,date:d,note:$('#fn').value.trim(),createdAt:t.createdAt||now,updatedAt:now};await run('transactions',s=>s.put(n));T=await getAll('transactions');dlg.close();render()}}
const dl=(name,txt,mime)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:mime}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
function exportX(k){if(k=='json')return dl('moneyflow-backup-'+td()+'.json',JSON.stringify({app:'moneyflow',version:1,transactions:T,categories:C,settings:S},null,1),'application/json');
const q=v=>'"'+String(v).replace(/"/g,'""')+'"';dl('moneyflow-'+td()+'.csv','\ufeffNgày,Loại,Danh mục,Số tiền,Ghi chú\n'+[...T].sort((a,b)=>b.date.localeCompare(a.date)).map(t=>[dmy(t.date),t.type=='income'?'Thu nhập':'Chi tiêu',q(cat(t.categoryId).name),t.amount,q(t.note)].join(',')).join('\n'),'text/csv')}
async function importJ(e){const f=e.target.files[0];e.target.value='';if(!f)return;let d;
try{d=JSON.parse(await f.text());if(d.app!='moneyflow'||!Array.isArray(d.transactions)||!Array.isArray(d.categories))throw 0;const ids=new Set(d.categories.map(c=>c.id));if(d.categories.some(c=>!c.id||!c.name||!['income','expense'].includes(c.type)))throw 0;
if(d.transactions.some(t=>!t.id||!['income','expense'].includes(t.type)||!(t.amount>0)||!/^\d{4}-\d{2}-\d{2}$/.test(t.date)||!ids.has(t.categoryId)))throw 0}
catch{alert('File không hợp lệ. Dữ liệu hiện tại được giữ nguyên.');return}
if(!confirm('Thay toàn bộ dữ liệu hiện tại bằng file này?'))return;
await run(['transactions','categories'],(a,b)=>{a.clear();b.clear();d.transactions.forEach(x=>a.put(x));d.categories.forEach(x=>b.put(x))});T=await getAll('transactions');C=await getAll('categories');alert('Đã nhập dữ liệu.');render()}
async function demo(){const y=+td().slice(0,4),ex=C.filter(c=>c.type=='expense'),inc=C.find(c=>c.name=='Lương'),n=[];
for(let m=Math.max(1,+M.slice(5)-3);m<=+M.slice(5);m++){const k=y+'-'+p2(m);n.push({type:'income',amount:11e6+m*2e5,categoryId:inc.id,date:k+'-01',note:'Lương tháng '+m});
ex.slice(0,6).forEach((c,i)=>n.push({type:'expense',amount:(80+((m*37+i*53)%300))*1e4/2,categoryId:c.id,date:k+'-'+p2(2+i*4),note:'Demo '+c.name}))}
const now=Date.now();await run('transactions',s=>n.forEach((x,i)=>s.put({...x,id:'demo'+uid()+i,demo:true,createdAt:now+i,updatedAt:now})));T=await getAll('transactions');render()}
async function clearDemo(){await run('transactions',s=>T.filter(t=>t.demo).forEach(t=>s.delete(t.id)));T=await getAll('transactions');render()}
/* ---- router & events ---- */
function render(){charts.forEach(c=>c.destroy());charts=[];document.querySelectorAll('#nav [data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v==V));({dash,tx:txs,rep,cal,set})[V]()}
const go=v=>{V=v;render();scrollTo(0,0)};
document.addEventListener('click',async e=>{const b=e.target.closest('button,[data-cat]');if(!b)return;const d=b.dataset;
if(d.v)go(d.v);else if(b.id=='fab'||b.id=='addBtn'||'add' in d)form();
else if(d.e)form(d.e);
else if(d.d){if(confirm('Xóa giao dịch này?')){await run('transactions',s=>s.delete(d.d));T=await getAll('transactions');render()}}
else if(d.p){const n=+d.p;if(V=='rep'&&RT=='y')Y+=n;else M=shift(M,n);CALD=null;render()}
else if(d.rt){RT=d.rt;render()}
else if(d.day){CALD=d.day;render()}
else if(d.cat){F=RT=='y'&&V=='rep'?{c:d.cat,y:Y,t:'expense'}:{c:d.cat,m:M,t:'expense'};go('tx')}
else if('clr' in d){F={};render()}
else if(d.x)exportX(d.x)
else if('demo' in d)demo();else if('cdemo' in d)clearDemo();
else if(d.nc){const n={id:'c'+uid(),type:d.nc,icon:'⭐',name:'Danh mục mới',color:'#0f766e'};await run('categories',s=>s.put(n));C=await getAll('categories');render()}
else if(d.cd){if(confirm('Xóa danh mục này? Giao dịch cũ sẽ hiển thị là "Đã xóa".')){await run('categories',s=>s.delete(d.cd));C=await getAll('categories');render()}}});
(async()=>{db=await openDB();T=await getAll('transactions');C=await getAll('categories');
if(!C.length){await run('categories',s=>DC.forEach(c=>s.put(c)));C=await getAll('categories')}
const s=await getAll('settings');const t=s.find(x=>x.key=='theme');if(t)S.theme=t.value;applyTheme();render();
if('serviceWorker' in navigator)navigator.serviceWorker.register('service-worker.js').catch(()=>{})})();

window.mfDB=()=>db;window.mfRefresh=async()=>{T=await getAll('transactions');C=await getAll('categories');if(!dlg.open)render()};
