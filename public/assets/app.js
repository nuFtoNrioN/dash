// Kiểm tra các file giao diện có cùng một bản không (tránh chép thiếu file)
(function(){const c=getComputedStyle(document.documentElement).getPropertyValue('--ver').trim();if(c!=='15'||window.LOOK_V!==15){const b=document.createElement('div');b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99;padding:10px 14px;background:#f0b429;color:#14121c;font:14px system-ui';b.textContent='Các file giao diện chưa được cập nhật đồng bộ (index.html, style.css, app.js, look.js phải cùng bản 15). Hãy chép đủ rồi tải lại trang.';document.body.append(b)}})();
const $=(s)=>document.querySelector(s),$$=(s)=>[...document.querySelectorAll(s)];
const h=(t,p={},...k)=>{const e=document.createElement(t);for(const[a,v]of Object.entries(p)){if(a==='class')e.className=v;else if(a==='text')e.textContent=v;else if(a.startsWith('on'))e.addEventListener(a.slice(2),v);else e.setAttribute(a,v)}e.append(...k);return e};
const ST={working:['Đang chạy','ok'],patched:['Đã patch','bad'],outdated:['Cũ','warn']};
const TITLES={overview:'Tổng quan',profile:'Hồ sơ',links:'Links',scripts:'Scripts',tabs:'Tabs',settings:'Cài đặt'};
let S={profile:{},links:[],scripts:[],tabs:[],settings:{},stats:{rows:[],since:''}},BIO='',RAW='',M='view',base='',getter=null,dirty=false,cur='',skip=false,editId=null,days=[],by={};

let tt;function toast(m,bad){const t=$('#toast');t.textContent=m;t.className='toast'+(bad?' bad':'');t.hidden=false;clearTimeout(tt);tt=setTimeout(()=>t.hidden=true,2400)}
async function api(p,m='GET',b){const r=await fetch('/api/admin'+p,{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});let d={};try{d=await r.json()}catch{}if(r.status===401){const e=new Error('401');e.s=401;throw e}if(!r.ok)throw new Error(d.error||'Lỗi '+r.status);return d}
const run=async(f)=>{try{await f()}catch(e){if(e.s===401)gate();else toast(e.message,true)}};
function ask(msg,ok){return new Promise(res=>{$('#dmsg').textContent=msg;$('#dlg .bad').textContent=ok;const d=$('#dlg');d.returnValue='';d.onclose=()=>res(d.returnValue==='yes');d.onclick=(e)=>{if(e.target===d)d.close()};d.showModal()})}

/* gate */
function gate(){$('#app').hidden=true;$('#gate').hidden=false;$('#pw').focus()}
$('#login').onclick=async()=>{$('#gerr').textContent='';const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('#pw').value})});const d=await r.json().catch(()=>({}));if(!r.ok){$('#gerr').textContent=d.error||'Lỗi '+r.status;return}$('#pw').value='';run(boot)};
$('#pw').addEventListener('keydown',e=>{if(e.key==='Enter')$('#login').click()});
$('#out').onclick=async()=>{await fetch('/api/logout',{method:'POST'});location.reload()};

/* dirty tracking */
function track(g){getter=g;base=g();dirty=false;sync()}
function sync(){$$('.save').forEach(b=>b.disabled=!dirty);$('#sbar').hidden=!dirty}
document.addEventListener('input',()=>{if(getter){dirty=getter()!==base;sync()}});
addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();const b=$$('.save').find(x=>x.offsetParent&&!x.disabled);b&&b.click()}});
const poke=()=>document.dispatchEvent(new Event('input'));

/* routing */
addEventListener('hashchange',()=>{if(skip){skip=false;return}if(dirty&&location.hash!==cur){if(!confirm('Bỏ các thay đổi chưa lưu?')){skip=true;location.hash=cur;return}dirty=false}route()});
function route(){const[,r='overview',id]=location.hash.split('/');const v=TITLES[r]?r:'overview';cur=location.hash;if(v!=='settings'&&S.settings)applyLook(mergeSet(S.settings),'dash');
 $$('[data-r]').forEach(a=>a.classList.toggle('on',a.dataset.r===v));$$('.view').forEach(x=>x.hidden=x.id!=='v-'+v);
 document.title=TITLES[v]+' · noir dash';$('#mtitle').textContent=TITLES[v];$('#more').classList.toggle('on',v==='tabs'||v==='settings');getter=null;dirty=false;sync();
 if(v==='profile')fillProfile();if(v==='links')fillLinks();if(v==='overview')drawOverview();if(v==='scripts')openScript(id);if(v==='tabs')drawTabs();if(v==='settings')fillSettings();scrollTo(0,0)}

/* overview */
let RANGE=30,SEL='',pers={};
const fmt=d=>d.slice(8)+'/'+d.slice(5,7);
function backupNote(){const t=+localStorage.getItem('noir_bk')||0,dd=t?Math.floor((Date.now()-t)/864e5):null,n=$('#bkn');n.hidden=dd!==null&&dd<14;
 if(!n.hidden)n.replaceChildren(h('span',{text:dd===null?'Bạn chưa tải bản sao lưu nào về máy.':'Đã '+dd+' ngày chưa sao lưu.'}),h('a',{href:'#/settings',text:'Sao lưu ngay'}))}
function prep(){const N=S.stats.days||30;days=[];const s=new Date(S.stats.since+'T00:00:00Z');for(let i=0;i<N;i++)days.push(new Date(s.getTime()+i*864e5).toISOString().slice(0,10));
 by={view:{},uv:{},copy:{},run:{}};S.stats.rows.forEach(r=>by[r.kind]&&(by[r.kind][r.day]=r.count));
 pers={};(S.stats.per||[]).forEach(r=>{const o=pers[r.script_id]=pers[r.script_id]||{copy:{},run:{},open:{}};if(o[r.kind])o[r.kind][r.day]=r.count})}
const sumv=a=>a.reduce((x,y)=>x+y,0);
const series=k=>{const src=SEL?((pers[SEL]||{})[k==='view'?'open':k]||{}):by[k];return days.map(d=>src[d]||0)};
const flag=c=>String.fromCodePoint(...[...c].map(x=>127397+x.charCodeAt(0)));
const regionName=c=>{try{return new Intl.DisplayNames(['vi'],{type:'region'}).of(c)}catch{return c}};
const okCC=c=>/^[A-Z]{2}$/.test(c)&&c!=='XX';
const GRP={social:'Mạng xã hội',search:'Tìm kiếm',direct:'Truy cập trực tiếp',tag:'Link gắn nhãn',other:'Website khác'};
const LBL={country:c=>okCC(c)?flag(c)+' '+regionName(c):'Không rõ',
 city:v=>{const p=v.split('|'),c=p[0],n=p[1]||p[0];return (okCC(c)?flag(c)+' ':'')+n+(okCC(c)?', '+regionName(c):'')},
 grp:v=>GRP[v]||v,dev:v=>({mobile:'Điện thoại',desktop:'Máy tính',tablet:'Máy tính bảng'})[v]||v,id:v=>v};
function barList(box,rows,label,pct){const mx=Math.max(1,...rows.map(r=>r.n)),tot=Math.max(1,sumv(rows.map(r=>r.n)));
 box.replaceChildren(...(rows.length?rows.map(r=>h('div',{},h('div',{class:'t'},h('i',{text:label(r.value)})),h('div',{class:'n',text:r.n+(pct?' ('+Math.round(r.n/tot*100)+'%)':'')}),h('div',{class:'bar'},Object.assign(h('i'),{style:'width:'+(r.n/mx*100)+'%'})))):[h('div',{class:'empty',text:'Chưa có dữ liệu.'})]))}
function colChart(box,vals,labels,unit){const mx=Math.max(1,...vals);
 box.replaceChildren(h('div',{class:'hb'},...vals.map((n,i)=>{const b=h('i',{title:(labels[i]||i)+': '+n+(unit||''),class:n===0?'z':(n===mx?'top':'')});b.style.height=Math.max(3,n/mx*100)+'%';return b})),
  h('div',{class:'hbx'},...labels.map(t=>h('span',{text:t}))))}
function drawOverview(){backupNote();const N=days.length,st=S.stats,pv=st.prev||{},dm=st.dims||{};
 $$('#rng input').forEach(i=>i.checked=+i.value===RANGE);
 $('#osel').replaceChildren(h('option',{value:'',text:'Tất cả script'}),...S.scripts.map(s=>h('option',{value:s.id,text:s.title})));$('#osel').value=SEL;
 $('#strip').replaceChildren(...[['view',SEL?'Lượt mở popup':'Lượt xem'],['uv','Khách'],['copy','Lượt copy'],['run','Lượt chạy']].map(([k,l])=>{const off=SEL&&k==='uv',v=series(k),cur=sumv(v);let dl='';
  if(!SEL){const p=pv[k]||0;dl=p?((cur>=p?'▲ ':'▼ ')+Math.abs(Math.round((cur-p)/p*100))+'% so với kỳ trước'):(cur?'chưa có kỳ trước':'')}
  return h('div',{},h('span',{text:l}),h('b',{text:off?'–':String(cur)}),h('em',{class:'dl '+(dl[0]==='▲'?'up':dl[0]==='▼'?'dn':''),text:off?'chưa tách theo script':dl}),h('small',{text:off?'':'Hôm nay: '+v[N-1]}))}));
 const vis=Object.fromEntries((dm.visitor||[]).map(r=>[r.value,r.n])),vt=(vis.new||0)+(vis.ret||0),V=sumv(series('view')),U=sumv(series('uv')),C=sumv(series('copy')),Rn=sumv(series('run'));
 const M3=SEL?[['Tỉ lệ copy trên mở',V?Math.round(C/V*100)+'%':'–'],['Lượt chạy mỗi lượt copy',C?(Rn/C).toFixed(1):'–']]:[['Tỉ lệ copy trên xem',V?Math.round(C/V*100)+'%':'–'],['Lượt xem mỗi khách',U?(V/U).toFixed(1):'–'],['Khách quay lại',vt?Math.round((vis.ret||0)/vt*100)+'%':'–']];
 $('#kpi2').replaceChildren(...M3.map(([l,v])=>h('div',{class:'mini'},h('span',{text:l}),h('b',{text:v}))));
 chart();
 const hr=Array(24).fill(0);(dm.hour||[]).forEach(r=>{hr[+r.value]=r.n});const hmx=Math.max(...hr),ht=hr.indexOf(hmx);
 colChart($('#hrs'),hr,Array.from({length:24},(_,i)=>i%6===0||i===23?i+'h':''),' lượt');
 $('#hrt').textContent=hmx?'Đông nhất quanh '+ht+'h ('+hmx+' lượt xem). Giờ theo múi giờ Việt Nam.':'Chưa có dữ liệu giờ truy cập.';
 const wd=Array(7).fill(0),vs=series('view');days.forEach((d,i)=>{wd[(new Date(d+'T00:00:00Z').getUTCDay()+6)%7]+=vs[i]});
 colChart($('#wkd'),wd,['T2','T3','T4','T5','T6','T7','CN']);
 const tot=(o,k)=>sumv(days.map(d=>((o||{})[k]||{})[d]||0));
 const rows=S.scripts.map(s=>{const o=pers[s.id];return{s,o:tot(o,'open'),c:tot(o,'copy'),r:tot(o,'run')}}).sort((a,b)=>b.r-a.r||b.c-a.c||b.o-a.o).slice(0,12);
 $('#tscr').replaceChildren(h('div',{class:'thd'},h('span',{text:'Script'}),...['Mở','Copy','Chạy','Tỉ lệ'].map(t=>h('span',{class:'r',text:t}))),
  ...(rows.length?rows.map(({s,o,c,r})=>h('div',{class:s.id===SEL?'sel':'',onclick:()=>{SEL=SEL===s.id?'':s.id;drawOverview()}},h('span',{class:'tt',text:s.title}),h('span',{class:'r',text:String(o)}),h('span',{class:'r',text:String(c)}),h('span',{class:'r',text:String(r)}),h('span',{class:'r',text:o?Math.round(c/o*100)+'%':'–'}))):[h('div',{},h('span',{text:'Chưa có script.'}))]));
 barList($('#lgrp'),dm.srcgrp||[],LBL.grp,true);barList($('#lsrc'),dm.src||[],LBL.id);
 barList($('#lc'),dm.country||[],LBL.country);barList($('#lcity'),dm.city||[],LBL.city);
 barList($('#ld'),dm.device||[],LBL.dev,true);barList($('#los'),dm.os||[],LBL.id);barList($('#lbr'),dm.browser||[],LBL.id);barList($('#lmd'),dm.model||[],LBL.id)}
function chart(){const N=days.length;if(SEL&&M==='uv'){M='view';$$('#metric input').forEach(i=>i.checked=i.value===M)}$('#metric input[value=uv]').disabled=!!SEL;
 const v=series(M),mx=Math.max(1,...v),P=v.map((n,i)=>[i*600/(N-1),142-n/mx*132]),line=P.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join('');
 $('#svg').innerHTML='<path d="'+line+'L600 150L0 150Z" style="fill:var(--ac);fill-opacity:.14"/><path d="'+line+'" fill="none" style="stroke:var(--ac)" stroke-width="2" vector-effect="non-scaling-stroke"/>';
 $('#d0').textContent=fmt(days[0]);$('#d1').textContent='hôm nay';const base0='Cao nhất '+mx+'/ngày, tổng '+sumv(v)+' trong '+N+' ngày';$('#tip').textContent=base0;
 const svg=$('#svg');svg.onpointermove=e=>{const r=svg.getBoundingClientRect(),i=Math.max(0,Math.min(N-1,Math.round((e.clientX-r.left)/r.width*(N-1))));$('#tip').textContent=fmt(days[i])+': '+v[i]};svg.onpointerleave=()=>$('#tip').textContent=base0}
$$('#metric input').forEach(i=>i.onchange=()=>{M=i.value;chart()});
$$('#rng input').forEach(i=>i.onchange=()=>run(async()=>{RANGE=+i.value;await load();drawOverview()}));
$('#osel').onchange=()=>{SEL=$('#osel').value;drawOverview()};

/* profile */
let BD=[],FRM=[],DEC='none',editFr=null,frT=0;
function mkSeg(box,name,list){box.replaceChildren(...list.map(([v,t])=>h('label',{},h('input',{type:'radio',name,value:v}),h('span',{text:t}))))}
mkSeg($('#frs'),'fr',PF_FRAMES);mkSeg($('#fxs'),'fx',PF_FX);
const pick=(box)=>($('#'+box+' input:checked')||{}).value;
function readPR(){return{name:$('#pn').value,tagline:$('#pt').value,pronouns:$('#pp').value,location:$('#pl').value,status:$('#ps').value,bio:$('#pb').value,avatar_url:$('#pa').value.trim(),banner_url:$('#pr').value.trim(),frame:pick('frs')||'none',frame_color:$('#fa').checked?'':$('#fc').value,deco:DEC,frames:FRM.map(f=>({...f})),frame_scale:+$('#fs').value,effect:pick('fxs')||'none',badges:[...BD]}}
const pv=()=>JSON.stringify(readPR());
function prev(){$('#pvbox').replaceChildren(h('div',{class:'pvwrap'},buildProfile(readPR())))}
function drawBd(){$('#bdl').replaceChildren(...BD.map((t,i)=>h('span',{class:'chip'},t,h('button',{type:'button','aria-label':'Xoá huy hiệu',text:'✕',onclick:()=>{BD.splice(i,1);drawBd();prev();poke()}}))))}
function fillProfile(){const p=S.profile||{};$('#pn').value=p.name||'';$('#pt').value=p.tagline||'';$('#pp').value=p.pronouns||'';$('#pl').value=p.location||'';$('#ps').value=p.status||'';$('#pb').value=p.bio||'';$('#pa').value=p.avatar_url||'';$('#pr').value=p.banner_url||'';DEC=p.deco||'none';FRM=(p.frames||[]).map(f=>({...f}));$('#fs').value=p.frame_scale||130;drawFrames();
 $$('#frs input').forEach(i=>i.checked=i.value===(p.frame||'none'));$$('#fxs input').forEach(i=>i.checked=i.value===(p.effect||'none'));$('#fa').checked=!p.frame_color;$('#fc').value=p.frame_color||'#9370ff';BD=[...(p.badges||[])];drawBd();prev();track(pv)}
$('#v-profile').addEventListener('input',prev);
$('#bda').onclick=()=>{const t=$('#bd').value.trim();if(!t)return;if(BD.length>=8){toast('Tối đa 8 huy hiệu',true);return}BD.push(t);$('#bd').value='';drawBd();prev();poke()};
$('#sp').onclick=()=>run(async()=>{const p=readPR();await api('/profile','PUT',p);S.profile=p;track(pv);toast('Đã lưu hồ sơ')});

/* khung avatar */
const frName=(d)=>d==='none'?'Không dùng khung':((d.startsWith('b:')?PF_DECOS.find(z=>z.id===d.slice(2)):FRM.find(z=>z.id===d.slice(2)))||{}).name||'Khung';
const frUrl=(d)=>d==='none'?'':((d.startsWith('b:')?PF_DECOS.find(z=>z.id===d.slice(2)):FRM.find(z=>z.id===d.slice(2)))||{})[d.startsWith('b:')?'uri':'url']||'';
function frThumb(url){const box=h('div',{class:'bgp-thumb frp-t'});box.style.setProperty('--fs',$('#fs').value);box.append(h('span',{class:'frp-av'}));
 if(url){let o;if(isVid(url)){o=mkVideo(url);if(!/\.webm(\?|#|$)/i.test(url))o.style.mixBlendMode='screen'}
  else{o=h('img',{alt:'',loading:'lazy'});o.onerror=()=>{o.remove();box.append(h('span',{class:'bgp-err',text:'Không tải được'}))};o.src=url}
  o.classList.add('frp-fr');box.append(o)}return box}
function drawFrames(){$('#fsv').textContent=$('#fs').value+'%';
 $('#fpick').replaceChildren(frThumb(frUrl(DEC)),h('b',{text:frName(DEC)}),h('small',{text:'Đổi'}));if($('#frdlg').open)drawFrGrid()}
function chooseFr(id){DEC=id;$('#frdlg').close();drawFrames();prev();poke()}
function delFr(f){run(async()=>{if(!await ask('Xoá khung \"'+f.name+'\"?','Xoá'))return;FRM=FRM.filter(z=>z.id!==f.id);if(DEC==='c:'+f.id)DEC='none';drawFrames();prev();poke()})}
function frCard(id,name,url,f){const on=DEC===id,c=h('div',{class:'bgp-card'+(on?' on':''),tabindex:'0',role:'button','aria-pressed':String(on),title:name}),th=frThumb(url);
 if(f)th.append(h('div',{class:'bgp-ops'},h('button',{type:'button','aria-label':'Sửa khung',text:'✎',onclick:e=>{e.stopPropagation();openFrAdd(f)}}),h('button',{type:'button','aria-label':'Xoá khung',text:'✕',onclick:e=>{e.stopPropagation();delFr(f)}})));
 if(on)th.append(h('span',{class:'bgp-ck',text:'✓'}));
 c.append(th,h('div',{class:'bgp-name',text:name}));c.onclick=()=>chooseFr(id);c.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target===c){e.preventDefault();chooseFr(id)}};return c}
function fitGrid(g){g.style.removeProperty('--gh');const k=g.children;if(k.length>9&&g.offsetParent){const c=k[8];g.style.setProperty('--gh',(c.offsetTop+c.offsetHeight+3)+'px')}}
function drawFrGrid(){const add=h('div',{class:'bgp-card bgp-add',tabindex:'0',role:'button','aria-label':'Thêm khung',onclick:()=>openFrAdd(),onkeydown:e=>{if((e.key==='Enter'||e.key===' ')&&e.target===e.currentTarget){e.preventDefault();openFrAdd()}}},h('div',{class:'bgp-thumb',text:'+'}),h('div',{class:'bgp-name',text:'Thêm khung'}));
 $('#frgrid').replaceChildren(add,frCard('none','Không',''),...PF_DECOS.map(d=>frCard('b:'+d.id,d.name,d.uri)),...FRM.map(f=>frCard('c:'+f.id,f.name,f.url,f)));fitGrid($('#frgrid'))}
function pvFr(){const u=$('#fu').value.trim(),b=$('#frpv');b.replaceChildren();b.classList.remove('has');
 if(!/^https:\/\//.test(u)){b.append(h('span',{text:'Xem trước khung sẽ hiện ở đây'}));return}
 b.classList.add('has');b.append(frThumb(u))}
function openFrAdd(f){editFr=f?f.id:null;$('#frat').textContent=f?'Sửa khung':'Thêm khung';$('#fn').value=f?f.name:'';$('#fu').value=f?f.url:'';$('#fre').textContent='';pvFr();$('#fradd').showModal()}
$('#fpick').onclick=()=>{drawFrGrid();$('#frdlg').showModal();fitGrid($('#frgrid'))};
$('#frx').onclick=()=>$('#frdlg').close();
['#frdlg','#fradd'].forEach(s=>$(s).addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close()}));
$('#frcancel').onclick=()=>$('#fradd').close();
['#fn','#fu'].forEach(s=>$(s).addEventListener('input',()=>{$('#fre').textContent=''}));
$('#fu').addEventListener('input',()=>{clearTimeout(frT);frT=setTimeout(pvFr,350)});
['#fn','#fu'].forEach(s=>$(s).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#frsave').click()}}));
$('#frsave').onclick=()=>{const n=$('#fn').value.trim(),u=$('#fu').value.trim(),er=$('#fre');
 if(!n){er.textContent='Nhập tên khung.';$('#fn').focus();return}
 if(!/^https:\/\//.test(u)){er.textContent='Link phải bắt đầu bằng https://';$('#fu').focus();return}
 if(editFr){const f=FRM.find(z=>z.id===editFr);f.name=n;f.url=u}
 else{if(FRM.length>=20){er.textContent='Tối đa 20 khung. Hãy xoá bớt khung cũ.';return}const id='f'+Date.now().toString(36);FRM.push({id,name:n,url:u});DEC='c:'+id}
 $('#fradd').close();editFr=null;drawFrames();prev();poke()};
$('#fs').addEventListener('input',drawFrames);

/* links */
const detect=(u)=>{try{const hn=new URL(u).hostname.replace(/^www\./,''),M={'discord.gg':'discord','discord.com':'discord','tiktok.com':'tiktok','youtube.com':'youtube','youtu.be':'youtube','github.com':'github','roblox.com':'roblox','facebook.com':'facebook','fb.com':'facebook','instagram.com':'instagram','x.com':'x','twitter.com':'x','t.me':'telegram','twitch.tv':'twitch','spotify.com':'spotify','steamcommunity.com':'steam','reddit.com':'reddit'},k=Object.keys(M).find(d=>hn===d||hn.endsWith('.'+d));return k?M[k]:''}catch{return ''}};
function lrow(l={}){const slug=(l.icon||'').startsWith('si:')?l.icon.slice(3):'';
 const pf=h('select',{'aria-label':'Nền tảng'},h('option',{value:'',text:'Nền tảng khác'}),...Object.entries(PLAT).map(([k,v])=>h('option',{value:k,text:v[0]})));pf.value=PLAT[slug]?slug:'';
 const u=h('input',{class:'u',placeholder:'Dán link vào đây, ví dụ https://discord.gg/...',maxlength:'500',inputmode:'url','aria-label':'URL'}),lb=h('input',{placeholder:'Tên hiển thị',maxlength:'40','aria-label':'Tên'});
 u.value=l.url||'';lb.value=l.label||'';const nt=h('input',{class:'nt',placeholder:'Mô tả ngắn (không bắt buộc)',maxlength:'80','aria-label':'Mô tả'});nt.value=l.note||'';const sel=tabSel('social',l.tab_id);
 u.addEventListener('input',()=>{const k=detect(u.value);if(k&&!pf.value){pf.value=k;if(!lb.value)lb.value=PLAT[k][0]}});
 pf.addEventListener('change',()=>{if(pf.value&&!lb.value)lb.value=PLAT[pf.value][0]});
 const r=h('div',{class:'lr'},u,h('div',{class:'ac'},h('button',{class:'btn sm','aria-label':'Lên',text:'↑',onclick:()=>{r.previousElementSibling&&r.parentNode.insertBefore(r,r.previousElementSibling);poke()}}),h('button',{class:'btn sm','aria-label':'Xuống',text:'↓',onclick:()=>{r.nextElementSibling&&r.parentNode.insertBefore(r.nextElementSibling,r);poke()}}),h('button',{class:'btn sm bad','aria-label':'Xoá link',text:'Xoá',onclick:()=>{r.remove();poke()}})),pf,lb,nt,sel);
 r._g=()=>({icon:pf.value?'si:'+pf.value:'🔗',label:lb.value,url:u.value,tab_id:Number(sel.value),note:nt.value});return r}
const lv=()=>JSON.stringify($$('.lr').map(r=>r._g()));
function fillLinks(){const b=$('#lrows');b.replaceChildren(...S.links.map(lrow));track(lv)}
$('#al').onclick=()=>{const r=lrow();$('#lrows').append(r);r.querySelectorAll('input')[1].focus();poke()};
$('#sl').onclick=()=>run(async()=>{const links=$$('.lr').map(r=>r._g());await api('/links','PUT',{links});S.links=links;track(lv);toast('Đã lưu links')});

/* scripts */
let REORD=false;
function moveScr(i,dir){const a=S.scripts,j=i+dir;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];run(async()=>{await api('/scripts-order','PUT',{ids:a.map(s=>s.id)});await load();slist()})}
function slist(){if(REORD){$('#slist').replaceChildren(...S.scripts.map((s,i)=>h('div',{},h('div',{class:'t'},h('i',{text:s.title})),h('div',{class:'n'},h('button',{class:'btn sm',type:'button','aria-label':'Lên',text:'↑',disabled:i===0,onclick:()=>moveScr(i,-1)}),' ',h('button',{class:'btn sm',type:'button','aria-label':'Xuống',text:'↓',disabled:i===S.scripts.length-1,onclick:()=>moveScr(i,1)})))));return}
const q=$('#q').value.trim().toLowerCase(),b=$('#slist');const a=S.scripts.filter(s=>!q||(s.title+s.id).toLowerCase().includes(q));
 if(!S.scripts.length){b.replaceChildren(h('div',{class:'empty'},'Chưa có script nào.',h('br'),h('button',{class:'btn pri',text:'Tạo script đầu tiên',onclick:()=>location.hash='#/scripts/new'})));return}
 if(!a.length){b.replaceChildren(h('div',{class:'empty',text:'Không có script khớp.'}));return}
 b.replaceChildren(...a.map(s=>h('button',{class:s.id===editId?'on':'',onclick:()=>location.hash='#/scripts/'+s.id},
  h('div',{class:'t'},h('i',{class:'dot '+(ST[s.status]||ST.working)[1]}),h('i',{text:s.title}),s.published?'':h('span',{class:'tag',text:'Nháp'})),
  h('div',{class:'m',text:s.id}),h('div',{class:'n',text:s.runs+' chạy, '+s.copies+' copy'}))))}
$('#q').addEventListener('input',slist);
const sv=()=>JSON.stringify([$('#si').value,$('#st').value,$('#sg').value,($('#sst input:checked')||{}).value,$('#sd').value,$('#sc').value,$('#sp2').checked,$('#sm').value,$('#sb').value,$('#sver').value,$('#scl').value,$('#sft').value,$('#shw').value,$('#sex').value]);
async function loadVlog(s){const b=$('#vlog');b.replaceChildren();if(!s)return;
 try{const list=await api('/scripts/'+s.id+'/versions');b.replaceChildren(...list.map(v=>h('div',{},h('div',{class:'t'},h('i',{text:v.version+'   '+new Date(v.created_at).toLocaleDateString('vi-VN')})),
  h('div',{class:'n'},h('button',{class:'btn sm bad',type:'button',text:'Xoá',onclick:()=>run(async()=>{await api('/versions/'+v.id,'DELETE');loadVlog(s)})})),h('div',{class:'m',text:v.changelog||'Không có ghi chú'}))))}catch{}}
function openScript(id){const sp=$('#split');editId=id&&id!=='new'?id:null;
 if(!id){sp.classList.remove('open');slist();return}
 const s=editId?S.scripts.find(x=>x.id===editId):null;if(editId&&!s){location.hash='#/scripts';return}
 $('#si').value=s?s.id:'';$('#si').disabled=!!s;$('#st').value=s?s.title:'';$('#sg').value=s?s.game:'';$('#sm').value=s?s.image_url:'';$('#sver').value=s?s.version||'':'';$('#scl').value=s?s.changelog||'':'';$('#sft').value=s?s.features||'':'';$('#shw').value=s?s.howto||'':'';$('#sex').value=s?s.executors||'':'';loadVlog(s);fillSb(s?s.tab_id:0);
 $('#sst input[value='+(s?s.status:'working')+']').checked=true;$('#sd').value=s?s.description:'';$('#sc').value=s?s.code:'';$('#sp2').checked=s?!!s.published:true;
 $('#et').textContent=s?s.title:'Script mới';$('#ds').hidden=$('#cm').hidden=!s;if(s)$('#cmt').textContent='loadstring(game:HttpGet("'+RAW+'/'+s.id+'"))()';
 sp.classList.add('open');slist();track(sv)}
$('#rs').onclick=()=>{REORD=!REORD;$('#rs').textContent=REORD?'Xong':'Sắp xếp';$('#q').hidden=REORD;if(REORD)$('#split').classList.remove('open');slist()};
$('#ns').onclick=()=>location.hash='#/scripts/new';
$('#bk').onclick=()=>location.hash='#/scripts';
$('#ss').onclick=()=>run(async()=>{const nw=!editId,body={id:$('#si').value.trim(),title:$('#st').value,game:$('#sg').value,status:$('#sst input:checked').value,description:$('#sd').value,code:$('#sc').value,published:$('#sp2').checked,image_url:$('#sm').value,tab_id:Number($('#sb').value),version:$('#sver').value,changelog:$('#scl').value,features:$('#sft').value,howto:$('#shw').value,executors:$('#sex').value};
 if(nw)await api('/scripts','POST',body);else await api('/scripts/'+editId,'PUT',body);
 await load();dirty=false;toast(nw?'Đã tạo script':'Đã lưu script');if(nw)location.hash='#/scripts/'+body.id;else openScript(editId)});
$('#ds').onclick=()=>run(async()=>{if(!await ask('Xoá script "'+$('#st').value+'"? Link raw của nó sẽ ngừng hoạt động và không khôi phục được.','Xoá script'))return;
 await api('/scripts/'+editId,'DELETE');await load();dirty=false;toast('Đã xoá script');location.hash='#/scripts'});
$('#cc').onclick=async()=>{try{await navigator.clipboard.writeText($('#cmt').textContent);toast('Đã copy lệnh')}catch{toast('Trình duyệt chặn copy, hãy chọn và copy thủ công',true)}};

/* tabs */
function tabSel(kind,cur){const s=h('select',{'aria-label':'Tab'}),t=S.tabs.filter(x=>x.kind===kind);t.forEach(x=>s.append(h('option',{value:x.id,text:x.name})));const d=t.find(x=>x.id===cur)||t[0];if(d)s.value=d.id;return s}
function fillSb(cur){const n=tabSel('script',cur);$('#sb').innerHTML=n.innerHTML;$('#sb').value=n.value}
function moveTab(id,dir){const a=S.tabs,i=a.findIndex(t=>t.id===id);let j=i+dir;while(a[j]&&a[j].kind!==a[i].kind)j+=dir;if(!a[j])return;[a[i],a[j]]=[a[j],a[i]];run(async()=>{await api('/tabs-order','PUT',{ids:a.map(t=>t.id)});await load();drawTabs()})}
function drawTabs(){$('#trows').replaceChildren(...S.tabs.map(t=>h('div',{},h('div',{class:'t'},h('i',{text:t.name}),h('span',{class:'tag',text:t.kind==='social'?'Social':'Script'})),h('div',{class:'n'},
 h('button',{class:'btn sm','aria-label':'Lên',text:'↑',onclick:()=>moveTab(t.id,-1)}),' ',h('button',{class:'btn sm','aria-label':'Xuống',text:'↓',onclick:()=>moveTab(t.id,1)}),' ',
 h('button',{class:'btn sm',text:'Đổi tên',onclick:()=>run(async()=>{const n=prompt('Tên tab mới',t.name);if(!n||!n.trim())return;await api('/tabs/'+t.id,'PUT',{name:n});await load();drawTabs();toast('Đã lưu tab')})}),' ',
 h('button',{class:'btn sm bad',text:'Xoá',onclick:()=>run(async()=>{if(!await ask('Xoá tab "'+t.name+'"? Nội dung trong tab sẽ chuyển về tab đầu tiên cùng loại.','Xoá tab'))return;await api('/tabs/'+t.id,'DELETE');await load();drawTabs();toast('Đã xoá tab')})})))))}
$('#at').onclick=()=>run(async()=>{const n=$('#tn').value.trim();if(!n){toast('Nhập tên tab trước',true);return}await api('/tabs','POST',{name:n,kind:$('#tk input:checked').value});$('#tn').value='';await load();drawTabs();toast('Đã tạo tab')});

/* settings */
const mergeSet=(s)=>normSettings(s);
const SWS=['#9370ff','#4f8cff','#2ec4b6','#5fd38d','#f0b429','#ef6b73','#ff6bd6'];
let G=mergeSet({}),editBg=null,pvT=0,ES={page:'bio',dev:'pc'};
const gv=()=>JSON.stringify(G),live=()=>applyLook(G,'dash',{page:ES.page,dev:ES.dev});
const slotG=()=>G.bgs[ES.page],tgt=()=>ES.dev==='mobile'&&!slotG().mobile.same?slotG().mobile:slotG().pc,isSame=()=>ES.dev==='mobile'&&slotG().mobile.same;
const needImg=(T)=>(T.mode==='fixed'||T.mode==='slide')&&!G.backgrounds.some(x=>x.id===T.active)&&G.backgrounds.length;
function fillSettings(){G=mergeSet(S.settings);ES.dev=document.documentElement.dataset.ui==='mobile'?'mobile':'pc';drawSet();live();track(gv)}
const bgThumb=(url)=>{const box=h('div',{class:'bgp-thumb'});
 if(isVid(url)){const v=h('video',{preload:'metadata',playsinline:''});v.muted=true;v.src=url+(url.indexOf('#')<0?'#t=0.1':'');box.append(v)}
 else{const i=h('img',{alt:'',loading:'lazy'});i.onerror=()=>{i.remove();box.append(h('span',{class:'bgp-err',text:'Không tải được'}))};i.src=url;box.append(i)}return box};
function drawPick(T){const b=G.backgrounds.find(x=>x.id===T.active),p=$('#bpick');
 p.replaceChildren(...(b?[bgThumb(b.url),h('b',{text:b.name})]:[h('span',{class:'bgp-none',text:'—'}),h('b',{text:G.backgrounds.length?'Chưa chọn hình':'Chưa có hình nào'})]),h('small',{text:G.backgrounds.length?'Đổi':'Thêm'}))}
function chooseBg(id){const T=tgt();T.active=id;if(T.mode==='off')T.mode='fixed';$('#bgdlg').close();drawSet();live();poke()}
function delBg(b){run(async()=>{if(!await ask('Xoá hình nền \"'+b.name+'\"?','Xoá'))return;
 G.backgrounds=G.backgrounds.filter(x=>x.id!==b.id);Object.values(G.bgs).forEach(p=>[p.pc,p.mobile].forEach(c=>{if(c.active===b.id)c.active=''}));drawSet();drawGrid();live();poke()})}
function bgCard(b,T){const on=T.active===b.id,c=h('div',{class:'bgp-card'+(on?' on':''),tabindex:'0',role:'button','aria-pressed':String(on),title:b.name}),th=bgThumb(b.url);
 th.append(h('div',{class:'bgp-ops'},h('button',{type:'button','aria-label':'Sửa hình nền',text:'✎',onclick:e=>{e.stopPropagation();openBgAdd(b)}}),h('button',{type:'button','aria-label':'Xoá hình nền',text:'✕',onclick:e=>{e.stopPropagation();delBg(b)}})));
 if(on)th.append(h('span',{class:'bgp-ck',text:'✓'}));
 c.append(th,h('div',{class:'bgp-name',text:b.name}));
 c.onclick=()=>chooseBg(b.id);c.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target===c){e.preventDefault();chooseBg(b.id)}};return c}
function drawGrid(){const T=tgt(),add=h('div',{class:'bgp-card bgp-add',tabindex:'0',role:'button','aria-label':'Thêm hình nền',onclick:()=>openBgAdd(),onkeydown:e=>{if((e.key==='Enter'||e.key===' ')&&e.target===e.currentTarget){e.preventDefault();openBgAdd()}}},h('div',{class:'bgp-thumb',text:'+'}),h('div',{class:'bgp-name',text:'Thêm hình nền'}));
 $('#bggrid').replaceChildren(add,...G.backgrounds.map(b=>bgCard(b,T)));fitGrid($('#bggrid'))}
function pvBg(){const u=$('#bu').value.trim(),b=$('#bgpv');b.replaceChildren();b.classList.remove('has');
 if(!/^https:\/\//.test(u)){b.append(h('span',{text:'Xem trước hình nền sẽ hiện ở đây'}));return}
 b.classList.add('has');
 if(isVid(u))b.append(mkVideo(u));
 else{const i=h('img',{alt:''});i.onerror=()=>{b.classList.remove('has');b.replaceChildren(h('span',{text:'Không tải được hình này, kiểm tra lại link'}))};i.src=u;b.append(i)}}
function openBgAdd(b){editBg=b?b.id:null;$('#bgat').textContent=b?'Sửa hình nền':'Thêm hình nền';$('#bn').value=b?b.name:'';$('#bu').value=b?b.url:'';$('#bge').textContent='';pvBg();$('#bgadd').showModal()}
function drawSet(){
 $('#swatches').replaceChildren(...SWS.map(c=>{const b=h('button',{class:'sw1'+(G.theme.accent.toLowerCase()===c?' on':''),type:'button','aria-label':'Màu '+c,onclick:()=>{G.theme.accent=c;drawSet();live();poke()}});b.style.background=c;return b}));
 $('#ac').value=G.theme.accent;
 const sl=slotG(),T=tgt(),same=isSame();
 if(needImg(T))T.active=G.backgrounds[0].id;
 $$('#bp input').forEach(i=>i.checked=i.value===ES.page);$$('#bd input').forEach(i=>i.checked=i.value===ES.dev);
 $('#samew').hidden=ES.dev!=='mobile';$('#same').checked=sl.mobile.same;$('#samenote').hidden=!same;$('#bgcfg').hidden=same;
 $$('#md input').forEach(i=>i.checked=i.value===T.mode);
 $('#ivw').hidden=T.mode!=='slide';drawPick(T);
 $('#iv').value=String(T.interval);$$('#tr input').forEach(i=>i.checked=i.value===T.trans);
 $('#rb').value=T.blur;$('#vb').textContent=T.blur+'px';$('#rd').value=T.dim;$('#vd').textContent=T.dim+'%';
 $('#gl').checked=T.glass;$$('#an input').forEach(i=>i.checked=i.value===T.anim);
 $$('#ly input').forEach(i=>i.checked=i.value===G.layout.links);$$('#um input').forEach(i=>i.checked=i.value===(localStorage.getItem('noir_ui')||'auto'))}
$('#bpick').onclick=()=>{drawGrid();$('#bgdlg').showModal();fitGrid($('#bggrid'))};
addEventListener('resize',()=>{if($('#bgdlg').open)fitGrid($('#bggrid'));if($('#frdlg').open)fitGrid($('#frgrid'))});
$('#bgx').onclick=()=>$('#bgdlg').close();
['#bgdlg','#bgadd'].forEach(s=>$(s).addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close()}));
$('#bcancel').onclick=()=>$('#bgadd').close();
['#bn','#bu'].forEach(s=>$(s).addEventListener('input',()=>{$('#bge').textContent=''}));
$('#bu').addEventListener('input',()=>{clearTimeout(pvT);pvT=setTimeout(pvBg,350)});
['#bn','#bu'].forEach(s=>$(s).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#bsave').click()}}));
$('#bsave').onclick=()=>{const n=$('#bn').value.trim(),u=$('#bu').value.trim(),er=$('#bge');
 if(!n){er.textContent='Nhập tên hình nền.';$('#bn').focus();return}
 if(!/^https:\/\//.test(u)){er.textContent='Link phải bắt đầu bằng https://';$('#bu').focus();return}
 if(editBg){const x=G.backgrounds.find(b=>b.id===editBg);x.name=n;x.url=u}
 else{if(G.backgrounds.length>=20){er.textContent='Tối đa 20 hình nền. Hãy xoá bớt hình cũ.';return}
  const id='b'+Date.now().toString(36);G.backgrounds.push({id,name:n,url:u});const T=tgt();T.active=id;if(T.mode==='off')T.mode='fixed'}
 $('#bgadd').close();editBg=null;drawSet();drawGrid();live();poke()};
$('#ac').oninput=()=>{G.theme.accent=$('#ac').value;$$('.sw1').forEach(b=>b.classList.remove('on'));live()};
$$('#bp input').forEach(i=>i.onchange=()=>{ES.page=i.value;drawSet();live()});
$$('#bd input').forEach(i=>i.onchange=()=>{ES.dev=i.value;drawSet();live()});
$('#same').onchange=()=>{const sl=slotG();if($('#same').checked)sl.mobile.same=true;else Object.assign(sl.mobile,{...sl.pc,same:false});drawSet();live();poke()};
$$('#md input').forEach(i=>i.onchange=()=>{const T=tgt();T.mode=i.value;if(needImg(T))T.active=G.backgrounds[0].id;drawSet();live();poke()});
$$('#tr input').forEach(i=>i.onchange=()=>{tgt().trans=i.value;live();poke()});
$('#iv').onchange=()=>{tgt().interval=+$('#iv').value;live();poke()};
$('#rb').oninput=()=>{const T=tgt();T.blur=+$('#rb').value;$('#vb').textContent=T.blur+'px';live()};
$('#rd').oninput=()=>{const T=tgt();T.dim=+$('#rd').value;$('#vd').textContent=T.dim+'%';live()};
$('#gl').onchange=()=>{tgt().glass=$('#gl').checked;live();poke()};
$$('#an input').forEach(i=>i.onchange=()=>{tgt().anim=i.value;live();poke()});
$$('#ly input').forEach(i=>i.onchange=()=>{G.layout.links=i.value;poke()});
$('#sset').onclick=()=>run(async()=>{await api('/settings','PUT',G);S.settings=JSON.parse(gv());track(gv);toast('Đã lưu cài đặt')});

/* sao lưu */
$('#bkd').onclick=()=>run(async()=>{const r=await fetch('/api/admin/backup');if(r.status===401){gate();return}if(!r.ok)throw new Error('Lỗi '+r.status);
 const a=h('a',{href:URL.createObjectURL(await r.blob()),download:'noir-backup-'+new Date().toISOString().slice(0,10)+'.json'});document.body.append(a);a.click();a.remove();localStorage.setItem('noir_bk',Date.now());toast('Đã tạo bản sao lưu')});
$('#bkr').onclick=()=>$('#bkf').click();
$('#bkf').onchange=()=>run(async()=>{const f=$('#bkf').files[0];$('#bkf').value='';if(!f)return;
 if(!await ask('Khôi phục từ "'+f.name+'"? Toàn bộ hồ sơ, link, tab và script hiện tại sẽ bị thay bằng nội dung trong file.','Khôi phục'))return;
 const r=await fetch('/api/admin/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:await f.text()});const d=await r.json().catch(()=>({}));
 if(r.status===401){gate();return}if(!r.ok)throw new Error(d.error||'Lỗi '+r.status);await load();dirty=false;toast('Đã khôi phục '+(d.scripts||0)+' script và '+(d.links||0)+' link');route()});

/* giao diện điện thoại: menu Thêm, thanh lưu cố định, chọn kiểu giao diện */
$('#more').onclick=()=>{$('#msheet').hidden=false};
$('#msheet').onclick=(e)=>{if(e.target===e.currentTarget||e.target.closest('[data-go]'))$('#msheet').hidden=true};
$('#out2').onclick=()=>$('#out').click();
$('#sbtn').onclick=()=>{const b=document.querySelector('.view:not([hidden]) .save');if(b&&!b.disabled)b.click()};
$$('#um input').forEach(i=>i.onchange=()=>{localStorage.setItem('noir_ui',i.value);applyUi()});

/* boot */
async function load(){const[d,st]=await Promise.all([api('/data'),api('/stats?days='+RANGE)]);S={profile:d.profile,links:d.links,scripts:d.scripts,tabs:d.tabs,settings:d.settings,stats:st};prep()}
async function boot(){const me=await api('/me');BIO=me.bio_url||'';RAW=me.raw_url||'';if(BIO){$('#site').href=$('#site2').href=$('#site3').href=$('#site4').href=BIO}else{$('#site').hidden=$('#site2').hidden=true}
 await load();applyLook(mergeSet(S.settings),'dash');$('#gate').hidden=true;$('#app').hidden=false;route()}
fetch('/api/theme').then(r=>r.json()).then(s=>applyLook(mergeSet(s),'dash')).catch(()=>{});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
run(boot);
