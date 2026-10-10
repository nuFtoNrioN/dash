// Kiểm tra các file giao diện có cùng một bản không (tránh chép thiếu file)
(function(){const c=getComputedStyle(document.documentElement).getPropertyValue('--ver').trim();if(c!=='10'||window.LOOK_V!==10){const b=document.createElement('div');b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99;padding:10px 14px;background:#f0b429;color:#14121c;font:14px system-ui';b.textContent='Các file giao diện chưa được cập nhật đồng bộ (index.html, style.css, app.js, look.js phải cùng bản 10). Hãy chép đủ rồi tải lại trang.';document.body.append(b)}})();
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
function prep(){const N=S.stats.days||30;days=[];const s=new Date(S.stats.since+'T00:00:00Z');for(let i=0;i<N;i++)days.push(new Date(s.getTime()+i*864e5).toISOString().slice(0,10));
 by={view:{},copy:{},run:{}};S.stats.rows.forEach(r=>by[r.kind]&&(by[r.kind][r.day]=r.count));
 pers={};(S.stats.per||[]).forEach(r=>{const o=pers[r.script_id]=pers[r.script_id]||{copy:{},run:{}};if(o[r.kind])o[r.kind][r.day]=r.count})}
const series=k=>{const src=SEL?((pers[SEL]||{})[k]||{}):by[k];return days.map(d=>src[d]||0)};
const flag=c=>String.fromCodePoint(...[...c].map(x=>127397+x.charCodeAt(0)));
const LBL={country:c=>{if(!/^[A-Z]{2}$/.test(c)||c==='XX')return 'Không rõ';try{return flag(c)+' '+new Intl.DisplayNames(['vi'],{type:'region'}).of(c)}catch{return c}},
 ref:v=>v==='direct'?'Truy cập trực tiếp':v,device:v=>v==='mobile'?'Điện thoại':v==='desktop'?'Máy tính':v};
function barList(box,rows,label,unit){const mx=Math.max(1,...rows.map(r=>r.n));
 box.replaceChildren(...(rows.length?rows.map(r=>h('div',{},h('div',{class:'t'},h('i',{text:label(r.value)})),h('div',{class:'n',text:r.n+(unit||'')}),h('div',{class:'bar'},Object.assign(h('i'),{style:'width:'+(r.n/mx*100)+'%'})))):[h('div',{class:'empty',text:'Chưa có dữ liệu.'})]))}
function backupNote(){const t=+localStorage.getItem('noir_bk')||0,dd=t?Math.floor((Date.now()-t)/864e5):null,n=$('#bkn');n.hidden=dd!==null&&dd<14;
 if(!n.hidden)n.replaceChildren(h('span',{text:dd===null?'Bạn chưa tải bản sao lưu nào về máy.':'Đã '+dd+' ngày chưa sao lưu.'}),h('a',{href:'#/settings',text:'Sao lưu ngay'}))}
function drawOverview(){backupNote();const N=days.length;
 $$('#rng input').forEach(i=>i.checked=+i.value===RANGE);
 $('#osel').replaceChildren(h('option',{value:'',text:'Tất cả script'}),...S.scripts.map(s=>h('option',{value:s.id,text:s.title})));$('#osel').value=SEL;
 $('#strip').replaceChildren(...[['view','Lượt xem'],['copy','Lượt copy'],['run','Lượt chạy']].map(([k,l])=>{const off=SEL&&k==='view',v=series(k);return h('div',{},h('span',{text:l}),h('b',{text:off?'–':String(v.reduce((a,b)=>a+b,0))}),h('em',{text:off?'chưa tách theo script':'hôm nay '+v[N-1]}))}));
 chart();
 const mx=Math.max(1,...S.scripts.map(s=>s.runs)),t=[...S.scripts].sort((a,b)=>b.runs-a.runs).slice(0,6);
 $('#top').replaceChildren(...(t.length?t.map(s=>h('div',{},h('div',{class:'t'},h('i',{text:s.title})),h('div',{class:'n',text:s.runs+' lượt chạy'}),h('div',{class:'bar'},Object.assign(h('i'),{style:'width:'+(s.runs/mx*100)+'%'})))):[h('div',{class:'empty',text:'Chưa có script nào được chạy.'})]));
 barList($('#lc'),S.stats.countries||[],LBL.country);barList($('#lr'),S.stats.refs||[],LBL.ref);barList($('#ld'),S.stats.devices||[],LBL.device)}
function chart(){const N=days.length;if(SEL&&M==='view'){M='run';$$('#metric input').forEach(i=>i.checked=i.value===M)}$('#metric input[value=view]').disabled=!!SEL;
 const v=series(M),mx=Math.max(1,...v),P=v.map((n,i)=>[i*600/(N-1),142-n/mx*132]),line=P.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join('');
 $('#svg').innerHTML='<path d="'+line+'L600 150L0 150Z" style="fill:var(--ac);fill-opacity:.14"/><path d="'+line+'" fill="none" style="stroke:var(--ac)" stroke-width="2" vector-effect="non-scaling-stroke"/>';
 $('#d0').textContent=fmt(days[0]);$('#d1').textContent='hôm nay';const base0='Cao nhất '+mx+'/ngày, tổng '+v.reduce((a,b)=>a+b,0)+' trong '+N+' ngày';$('#tip').textContent=base0;
 const svg=$('#svg');svg.onpointermove=e=>{const r=svg.getBoundingClientRect(),i=Math.max(0,Math.min(N-1,Math.round((e.clientX-r.left)/r.width*(N-1))));$('#tip').textContent=fmt(days[i])+': '+v[i]};svg.onpointerleave=()=>$('#tip').textContent=base0}
$$('#metric input').forEach(i=>i.onchange=()=>{M=i.value;chart()});
$$('#rng input').forEach(i=>i.onchange=()=>run(async()=>{RANGE=+i.value;await load();drawOverview()}));
$('#osel').onchange=()=>{SEL=$('#osel').value;drawOverview()};

/* profile */
let BD=[],FRM=[],DEC='none',editDf=null;
function mkSeg(box,name,list){box.replaceChildren(...list.map(([v,t])=>h('label',{},h('input',{type:'radio',name,value:v}),h('span',{text:t}))))}
mkSeg($('#frs'),'fr',PF_FRAMES);mkSeg($('#fxs'),'fx',PF_FX);
const pick=(box)=>($('#'+box+' input:checked')||{}).value;
function readPR(){return{name:$('#pn').value,tagline:$('#pt').value,pronouns:$('#pp').value,location:$('#pl').value,status:$('#ps').value,bio:$('#pb').value,avatar_url:$('#pa').value.trim(),banner_url:$('#pr').value.trim(),frame:pick('frs')||'none',frame_color:$('#fa').checked?'':$('#fc').value,deco:DEC,frames:FRM.map(f=>({...f})),frame_scale:+$('#fs').value,effect:pick('fxs')||'none',badges:[...BD]}}
const pv=()=>JSON.stringify(readPR());
function prev(){$('#pvbox').replaceChildren(h('div',{class:'pvwrap'},buildProfile(readPR())))}
function drawBd(){$('#bdl').replaceChildren(...BD.map((t,i)=>h('span',{class:'chip'},t,h('button',{type:'button','aria-label':'Xoá huy hiệu',text:'✕',onclick:()=>{BD.splice(i,1);drawBd();prev();poke()}}))))}
function fillProfile(){const p=S.profile||{};$('#pn').value=p.name||'';$('#pt').value=p.tagline||'';$('#pp').value=p.pronouns||'';$('#pl').value=p.location||'';$('#ps').value=p.status||'';$('#pb').value=p.bio||'';$('#pa').value=p.avatar_url||'';$('#pr').value=p.banner_url||'';DEC=p.deco||'none';FRM=(p.frames||[]).map(f=>({...f}));$('#fs').value=p.frame_scale||130;resetDf();drawFrames();
 $$('#frs input').forEach(i=>i.checked=i.value===(p.frame||'none'));$$('#fxs input').forEach(i=>i.checked=i.value===(p.effect||'none'));$('#fa').checked=!p.frame_color;$('#fc').value=p.frame_color||'#9370ff';BD=[...(p.badges||[])];drawBd();prev();track(pv)}
$('#v-profile').addEventListener('input',prev);
$('#bda').onclick=()=>{const t=$('#bd').value.trim();if(!t)return;if(BD.length>=8){toast('Tối đa 8 huy hiệu',true);return}BD.push(t);$('#bd').value='';drawBd();prev();poke()};
$('#sp').onclick=()=>run(async()=>{const p=readPR();await api('/profile','PUT',p);S.profile=p;track(pv);toast('Đã lưu hồ sơ')});

/* khung avatar */
function tile(id,name,url){const t=h('button',{class:'tl'+(DEC===id?' on':''),type:'button',title:name,'aria-label':name,onclick:()=>{DEC=id;drawFrames();prev();poke()}},h('span',{class:'tla',text:url?'':'∅'}));
 if(url){const o=h('img',{src:url,alt:''});o.style.width=o.style.height=($('#fs').value/130*52)+'px';t.append(o)}return t}
function drawFrames(){$('#fsv').textContent=$('#fs').value+'%';
 $('#tiles').replaceChildren(tile('none','Không',''),...PF_DECOS.map(d=>tile('b:'+d.id,d.name,d.uri)),...FRM.map(f=>tile('c:'+f.id,f.name,f.url)));
 $('#dfl').replaceChildren(...FRM.map(f=>h('div',{},h('div',{class:'t'},h('i',{text:f.name})),h('div',{class:'n'},
  h('button',{class:'btn sm',type:'button',text:'Sửa',onclick:()=>{editDf=f.id;$('#dn').value=f.name;$('#du').value=f.url;$('#dsave').textContent='Cập nhật';$('#dcancel').hidden=false;$('#dn').focus()}}),' ',
  h('button',{class:'btn sm bad',type:'button',text:'Xoá',onclick:()=>{FRM=FRM.filter(z=>z.id!==f.id);if(DEC==='c:'+f.id)DEC='none';drawFrames();prev();poke()}})))))}
function resetDf(){editDf=null;$('#dn').value=$('#du').value='';$('#dsave').textContent='Thêm khung';$('#dcancel').hidden=true}
$('#dcancel').onclick=resetDf;
$('#dsave').onclick=()=>{const n=$('#dn').value.trim(),u=$('#du').value.trim();if(!n||!/^https:\/\//.test(u)){toast('Nhập tên và link ảnh bắt đầu bằng https',true);return}
 if(editDf){const f=FRM.find(z=>z.id===editDf);f.name=n;f.url=u}else{if(FRM.length>=20){toast('Tối đa 20 khung',true);return}const id='f'+Date.now().toString(36);FRM.push({id,name:n,url:u});DEC='c:'+id}
 resetDf();drawFrames();prev();poke()};
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
const sv=()=>JSON.stringify([$('#si').value,$('#st').value,$('#sg').value,($('#sst input:checked')||{}).value,$('#sd').value,$('#sc').value,$('#sp2').checked,$('#sm').value,$('#sb').value,$('#sver').value,$('#scl').value]);
function openScript(id){const sp=$('#split');editId=id&&id!=='new'?id:null;
 if(!id){sp.classList.remove('open');slist();return}
 const s=editId?S.scripts.find(x=>x.id===editId):null;if(editId&&!s){location.hash='#/scripts';return}
 $('#si').value=s?s.id:'';$('#si').disabled=!!s;$('#st').value=s?s.title:'';$('#sg').value=s?s.game:'';$('#sm').value=s?s.image_url:'';$('#sver').value=s?s.version||'':'';$('#scl').value=s?s.changelog||'':'';fillSb(s?s.tab_id:0);
 $('#sst input[value='+(s?s.status:'working')+']').checked=true;$('#sd').value=s?s.description:'';$('#sc').value=s?s.code:'';$('#sp2').checked=s?!!s.published:true;
 $('#et').textContent=s?s.title:'Script mới';$('#ds').hidden=$('#cm').hidden=!s;if(s)$('#cmt').textContent='loadstring(game:HttpGet("'+RAW+'/'+s.id+'"))()';
 sp.classList.add('open');slist();track(sv)}
$('#rs').onclick=()=>{REORD=!REORD;$('#rs').textContent=REORD?'Xong':'Sắp xếp';$('#q').hidden=REORD;if(REORD)$('#split').classList.remove('open');slist()};
$('#ns').onclick=()=>location.hash='#/scripts/new';
$('#bk').onclick=()=>location.hash='#/scripts';
$('#ss').onclick=()=>run(async()=>{const nw=!editId,body={id:$('#si').value.trim(),title:$('#st').value,game:$('#sg').value,status:$('#sst input:checked').value,description:$('#sd').value,code:$('#sc').value,published:$('#sp2').checked,image_url:$('#sm').value,tab_id:Number($('#sb').value),version:$('#sver').value,changelog:$('#scl').value};
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
const defSet=()=>({theme:{accent:'#9370ff'},bg:{active:'',mode:'fixed',interval:30,trans:'fade',blur:0,dim:40,anim:'none',glass:false,apply:'both'},backgrounds:[],layout:{links:'list'}});
const mergeSet=(s)=>{const d=defSet();s=s||{};return{theme:{...d.theme,...s.theme},bg:{...d.bg,...s.bg},backgrounds:Array.isArray(s.backgrounds)?s.backgrounds:[],layout:{...d.layout,...s.layout}}};
const SWS=['#9370ff','#4f8cff','#2ec4b6','#5fd38d','#f0b429','#ef6b73','#ff6bd6'];
let G=defSet(),editBg=null;
const gv=()=>JSON.stringify(G),live=()=>applyLook(G,'dash');
function fillSettings(){G=mergeSet(S.settings);resetBgForm();drawSet();track(gv)}
function bgRow(id,name,url){const rd=h('input',{type:'radio',name:'bgsel',value:id,onchange:()=>{G.bg.active=id;live();poke()}});rd.checked=G.bg.active===id;
 const th=h('span',{class:'th'});if(url)th.style.backgroundImage='url("'+url.replace(/"/g,'%22')+'")';
 return h('div',{},h('label',{class:'bgl'},rd,th,h('span',{text:name})),url?h('div',{},
  h('button',{class:'btn sm',type:'button',text:'Sửa',onclick:()=>{editBg=id;$('#bn').value=name;$('#bu').value=url;$('#bsave').textContent='Cập nhật';$('#bcancel').hidden=false;$('#bn').focus()}}),' ',
  h('button',{class:'btn sm bad',type:'button',text:'Xoá',onclick:()=>{G.backgrounds=G.backgrounds.filter(x=>x.id!==id);if(G.bg.active===id)G.bg.active='';drawSet();live();poke()}})):'')}
function drawSet(){
 $('#swatches').replaceChildren(...SWS.map(c=>{const b=h('button',{class:'sw1'+(G.theme.accent.toLowerCase()===c?' on':''),type:'button','aria-label':'Màu '+c,onclick:()=>{G.theme.accent=c;drawSet();live();poke()}});b.style.background=c;return b}));
 $('#ac').value=G.theme.accent;
 $('#bglist').replaceChildren(bgRow('','Không dùng hình nền',''),...G.backgrounds.map(b=>bgRow(b.id,b.name,b.url)));
 $('#rb').value=G.bg.blur;$('#vb').textContent=G.bg.blur+'px';$('#rd').value=G.bg.dim;$('#vd').textContent=G.bg.dim+'%';
 $('#gl').checked=G.bg.glass;$$('#an input').forEach(i=>i.checked=i.value===G.bg.anim);$$('#ap input').forEach(i=>i.checked=i.value===G.bg.apply);$$('#md input').forEach(i=>i.checked=i.value===G.bg.mode);$('#iv').value=String(G.bg.interval);$$('#tr input').forEach(i=>i.checked=i.value===G.bg.trans);$('#ivw').hidden=G.bg.mode!=='slide';$$('#ly input').forEach(i=>i.checked=i.value===G.layout.links);$$('#um input').forEach(i=>i.checked=i.value===(localStorage.getItem('noir_ui')||'auto'))}
function resetBgForm(){editBg=null;$('#bn').value=$('#bu').value='';$('#bsave').textContent='Thêm hình nền';$('#bcancel').hidden=true}
$('#bcancel').onclick=resetBgForm;
$('#bsave').onclick=()=>{const n=$('#bn').value.trim(),u=$('#bu').value.trim();if(!n||!/^https:\/\//.test(u)){toast('Nhập tên và link ảnh bắt đầu bằng https',true);return}
 if(editBg){const x=G.backgrounds.find(b=>b.id===editBg);x.name=n;x.url=u}else{const id='b'+Date.now().toString(36);G.backgrounds.push({id,name:n,url:u});G.bg.active=id}
 resetBgForm();drawSet();live();poke()};
$('#ac').oninput=()=>{G.theme.accent=$('#ac').value;$$('.sw1').forEach(b=>b.classList.remove('on'));live()};
$('#rb').oninput=()=>{G.bg.blur=+$('#rb').value;$('#vb').textContent=G.bg.blur+'px';live()};
$('#rd').oninput=()=>{G.bg.dim=+$('#rd').value;$('#vd').textContent=G.bg.dim+'%';live()};
$('#gl').onchange=()=>{G.bg.glass=$('#gl').checked;live();poke()};
$$('#an input').forEach(i=>i.onchange=()=>{G.bg.anim=i.value;live();poke()});
$$('#ap input').forEach(i=>i.onchange=()=>{G.bg.apply=i.value;live();poke()});
$$('#md input').forEach(i=>i.onchange=()=>{G.bg.mode=i.value;$('#ivw').hidden=i.value!=='slide';live();poke()});
$$('#tr input').forEach(i=>i.onchange=()=>{G.bg.trans=i.value;live();poke()});
$('#iv').onchange=()=>{G.bg.interval=+$('#iv').value;live();poke()};
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
