const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const appLang=localStorage.getItem("oa_language")||"tr";
const profiles=appLang==="en"?(window.OSMANLI_PROFILES_EN||window.OSMANLI_PROFILES):window.OSMANLI_PROFILES, names=Object.keys(profiles), aliases=window.LABEL_ALIASES;
const state={model:null,image:false,history:JSON.parse(localStorage.getItem("oa_history")||"[]"),active:null,cameraStream:null,lastPredictions:[]};
const el={status:$("#modelStatus"),dot:$("#modelDot"),file:$("#fileInput"),drop:$("#dropZone"),previewBox:$("#previewBox"),preview:$("#previewImage"),analyze:$("#analyzeButton"),result:$("#resultName"),ring:$("#confidenceRing"),preds:$("#predictionList"),notice:$("#uncertaintyNotice"),profile:$("#recognizedProfile"),toast:$("#toast"),identityIdle:$("#identityIdle"),identityReveal:$("#identityReveal"),confidenceLevel:$("#confidenceLevel"),modelDecision:$("#modelDecision"),revealOverlay:$("#revealOverlay"),revealName:$("#revealName"),revealConfidence:$("#revealConfidence")};
function toast(t){el.toast.textContent=t;el.toast.classList.add("show");setTimeout(()=>el.toast.classList.remove("show"),2600)}
function normalizeLabel(label){return aliases[label]||label}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function page(id){$$(".page").forEach(p=>p.classList.toggle("active",p.id===id));$$(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===id));scrollTo({top:0,behavior:"smooth"});if(id==="dynasty")renderTree()}
$$("[data-page]").forEach(b=>b.addEventListener("click",()=>page(b.dataset.page)));$$("[data-jump]").forEach(b=>b.addEventListener("click",()=>page(b.dataset.jump)));
function applyTheme(theme){
  const light=theme==="light";
  document.body.classList.toggle("light",light);
  const b=$("#themeButton");
  if(b){b.textContent=light?"☀":"☾";b.title=light?(appLang==="en"?"Switch to night mode":"Gece moduna geç"):(appLang==="en"?"Switch to day mode":"Gündüz moduna geç");b.setAttribute("aria-label",b.title)}
  try{localStorage.setItem("oa_theme",light?"light":"dark")}catch(e){}
}
applyTheme(localStorage.getItem("oa_theme")==="light"?"light":"dark");
$("#themeButton").onclick=()=>applyTheme(document.body.classList.contains("light")?"dark":"light");
function updateStats(){$("#analysisCount").textContent=state.history.length;$("#bestQuiz").textContent=localStorage.getItem("oa_best")||0;$("#classCount").textContent=window.MODEL_LABELS.length}
function setModelStatus(type,title,detail,progress){
  const card=$("#modelStatusCard");
  if(card){
    card.classList.remove("loading","ready","warning","error");
    card.classList.add(type||"loading");
  }
  if(el.status)el.status.textContent=title||"Model hazırlanıyor";
  const detailEl=$("#modelStatusDetail");
  if(detailEl)detailEl.textContent=detail||"Yapay zekâ dosyaları yükleniyor";
  const bar=$("#modelLoadProgress");
  if(bar)bar.style.width=`${Math.max(0,Math.min(100,progress||0))}%`;
  const retry=$("#modelRetryButton");
  if(retry)retry.classList.toggle("hidden",type!=="error");
}
function waitForLibrary(test,timeout=9000){
  return new Promise((resolve,reject)=>{
    const started=Date.now();
    const timer=setInterval(()=>{
      if(test()){clearInterval(timer);resolve(true)}
      else if(Date.now()-started>timeout){clearInterval(timer);reject(new Error("Kütüphane zaman aşımı"))}
    },120);
  });
}
async function createDirectModelAdapter(base){
  if(!window.tf)throw new Error("TensorFlow yüklenmedi");
  await window.tf.ready();
  const metadataResponse=await fetch(base+"metadata.json",{cache:"no-store"});
  if(!metadataResponse.ok)throw new Error(`metadata.json okunamadı (${metadataResponse.status})`);
  const metadata=await metadataResponse.json();
  const labels=metadata.labels||metadata.classes||window.MODEL_LABELS||[];
  const imageSize=Number(metadata.imageSize)||224;
  const layersModel=await window.tf.loadLayersModel(base+"model.json",{strict:false});
  // İlk tahminde gecikme yaşanmaması için modeli boş veriyle bir kez ısıt.
  const warmup=window.tf.zeros([1,imageSize,imageSize,3]);
  const warmResult=layersModel.predict(warmup);
  if(Array.isArray(warmResult))warmResult.forEach(t=>t.dispose());else warmResult.dispose();
  warmup.dispose();
  return {
    direct:true,
    async predict(imageSource){
      return window.tf.tidy(()=>{
        let x=window.tf.browser.fromPixels(imageSource);
        x=window.tf.image.resizeBilinear(x,[imageSize,imageSize],true);
        x=x.toFloat().div(127.5).sub(1).expandDims(0);
        const raw=layersModel.predict(x);
        const out=Array.isArray(raw)?raw[0]:raw;
        const values=Array.from(out.dataSync());
        return values.map((probability,i)=>({className:labels[i]||`Sınıf ${i+1}`,probability}));
      });
    }
  };
}
async function withTimeout(promise,ms,message){
  let timer;
  try{
    return await Promise.race([
      promise,
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),ms)})
    ]);
  }finally{clearTimeout(timer)}
}
async function loadModel(){
  if(state.model)return state.model;
  setModelStatus("loading","AI modeli hazırlanıyor","TensorFlow ve 36 padişah modeli yükleniyor",18);
  try{
    await waitForLibrary(()=>window.tf,20000);
    setModelStatus("loading","AI modeli yükleniyor","Yerel model dosyaları okunuyor",45);
    const base=new URL("model/",window.location.href).href;

    // Önce doğrudan TensorFlow yükleyicisini kullan. Bu yöntem Teachable Machine
    // yükleyicisinin bazı tarayıcılarda takılı kalması sorununu aşar.
    try{
      state.model=await withTimeout(createDirectModelAdapter(base),90000,"Doğrudan model yükleme zaman aşımı");
      console.log("Portre modeli doğrudan TensorFlow ile yüklendi.");
    }catch(directError){
      console.warn("Doğrudan yükleme başarısız, Teachable Machine deneniyor:",directError);
      await waitForLibrary(()=>window.tmImage,15000);
      setModelStatus("loading","Alternatif yükleyici deneniyor","Teachable Machine modeli açılıyor",72);
      state.model=await withTimeout(window.tmImage.load(base+"model.json",base+"metadata.json"),90000,"Alternatif model yükleme zaman aşımı");
    }

    if(!state.model||typeof state.model.predict!=="function")throw new Error("Model geçersiz yüklendi");
    setModelStatus("ready","AI tanıma hazır","36 padişah modeli başarıyla yüklendi",100);
    if(el.analyze&&state.image)el.analyze.disabled=false;
    console.log("Portre tanıma modeli hazır.");
    return state.model;
  }catch(err){
    console.error("Portre tanıma modeli yüklenemedi:",err);
    state.model=null;
    if(el.analyze)el.analyze.disabled=true;
    const fileWarning=location.protocol==="file:"?" Uygulamayı index.html ile değil START.bat ile aç.":"";
    setModelStatus("error","AI modeli yüklenemedi",`${err.message||"Bilinmeyen hata"}.${fileWarning}`,0);
    toast("AI tanıma açılamadı. Tekrar Dene düğmesine bas.");
    throw err;
  }
}
const modelRetryButton=$("#modelRetryButton");
if(modelRetryButton){modelRetryButton.onclick=()=>loadModel().catch(()=>{});modelRetryButton.classList.add("hidden");}
window.addEventListener("online",()=>{if(!state.model)loadModel().catch(()=>{})});
function chooseFile(){el.file.click()}$("#pickButton").onclick=chooseFile;$("#changeButton").onclick=chooseFile;el.drop.onclick=e=>{if(e.target.id!=="pickButton")chooseFile()};el.drop.onkeydown=e=>{if(["Enter"," "].includes(e.key))chooseFile()};
["dragenter","dragover"].forEach(x=>el.drop.addEventListener(x,e=>{e.preventDefault();el.drop.classList.add("drag")}));["dragleave","drop"].forEach(x=>el.drop.addEventListener(x,e=>{e.preventDefault();el.drop.classList.remove("drag")}));el.drop.ondrop=e=>loadFile(e.dataTransfer.files[0]);el.file.onchange=e=>loadFile(e.target.files[0]);
function loadFile(file){if(!file||!file.type.startsWith("image/"))return toast("Geçerli bir görsel seç");const r=new FileReader();r.onload=()=>{el.preview.onload=()=>{state.image=true;el.drop.classList.add("hidden");el.previewBox.classList.remove("hidden");el.analyze.disabled=!state.model};el.preview.src=r.result};r.readAsDataURL(file)}
el.analyze.onclick=async()=>{
  if(!state.model){
    try{await loadModel()}catch{return}
  }
  analyze();
};
function confidenceLabel(conf,margin){
  if(conf>=85&&margin>=25)return["Çok yüksek güven","Model kararı çok net"];
  if(conf>=70&&margin>=15)return["Yüksek güven","Model güçlü bir eşleşme buldu"];
  if(conf>=55)return["Orta güven","Sonuç kullanılabilir, fakat alternatifleri kontrol et"];
  return["Düşük güven","Daha net bir portreyle tekrar dene"];
}
function showCinematicReveal(name,conf){
  el.revealName.textContent=name;
  el.revealConfidence.textContent=`%${conf} güvenle tanındı`;
  el.revealOverlay.classList.remove("hidden");
  setTimeout(()=>el.revealOverlay.classList.add("hidden"),1700);
}
async function runPrediction(imageSource){
  if(!state.model)return toast("Model henüz hazır değil");
  let p=await state.model.predict(imageSource,false);
  p.sort((a,b)=>b.probability-a.probability);
  state.lastPredictions=p;
  const top=p[0],second=p[1],display=normalizeLabel(top.className),conf=Math.round(top.probability*100),margin=(top.probability-second.probability)*100;
  const [level,decision]=confidenceLabel(conf,margin);
  el.result.textContent=display;
  el.ring.querySelector("b").textContent=`%${conf}`;
  el.ring.style.background=`conic-gradient(var(--green) ${conf*3.6}deg,rgba(255,255,255,.06) 0deg)`;
  el.confidenceLevel.textContent=level;
  el.modelDecision.textContent=decision;
  el.identityIdle.classList.add("hidden");
  el.identityReveal.classList.remove("hidden");
  el.preds.innerHTML=p.slice(0,5).map((x,i)=>{const n=normalizeLabel(x.className),v=(x.probability*100).toFixed(1);return `<div class="prediction"><div class="prediction-head"><b>${i+1}. ${escapeHtml(n)}</b><b>%${v}</b></div><div class="bar"><i style="width:${v}%"></i></div></div>`}).join("");
  const uncertain=conf<55||margin<12;
  el.notice.classList.toggle("hidden",!uncertain);
  if(uncertain)el.notice.textContent="Sonuç belirsiz olabilir. İlk iki tahmin birbirine yakın veya güven seviyesi düşük.";
  renderProfile(display,el.profile);
  el.profile.classList.remove("hidden");
  state.history.unshift({name:display,confidence:conf,date:new Date().toLocaleString("tr-TR"),alternatives:p.slice(1,3).map(x=>normalizeLabel(x.className))});
  state.history=state.history.slice(0,30);
  localStorage.setItem("oa_history",JSON.stringify(state.history));
  updateStats();
  renderHistory();
  showCinematicReveal(display,conf);
  el.profile.scrollIntoView({behavior:"smooth",block:"start"});
}
async function analyze(){
  if(!state.model||!state.image)return;
  el.analyze.disabled=true;
  el.analyze.textContent="36 sınıf karşılaştırılıyor…";
  try{await runPrediction(el.preview)}
  catch(err){console.error(err);toast("Analiz sırasında hata oluştu")}
  finally{el.analyze.disabled=false;el.analyze.textContent="Kim Olduğunu Bul"}
}
function profileHtml(name){const p=profiles[name];if(!p)return `<h2>${escapeHtml(name)}</h2><p class="muted">Bu model etiketi için ansiklopedi profili bulunamadı.</p>`;return `<div class="profile-hero"><div><span class="kicker">${p.era.toUpperCase()} DÖNEMİ</span><h2>${name}</h2><p class="muted">${p.summary}</p></div><div class="order-badge">${p.order}. PADİŞAH</div></div><div class="profile-facts"><div class="fact"><span>Doğum</span><b>${p.birth}</b></div><div class="fact"><span>Ölüm</span><b>${p.death}</b></div><div class="fact"><span>Saltanat</span><b>${p.reign}</b></div><div class="fact"><span>Babası</span><b>${p.father}</b></div><div class="fact"><span>Dönem</span><b>${p.era}</b></div></div><div class="profile-sections"><div class="profile-section"><h3>Genel Bakış</h3><p>${p.summary}</p></div><div class="profile-section"><h3>Savaşlar ve Olaylar</h3><p>${p.military}</p></div><div class="profile-section"><h3>Yönetim Mirası</h3><p>${p.legacy}</p></div></div><div class="profile-actions"><button class="secondary" onclick="speakProfile('${name.replaceAll("'","\\'")}')">▶ Sesli Anlat</button><button class="secondary" onclick="downloadProfile('${name.replaceAll("'","\\'")}')">↓ Bilgi Dosyası</button><button class="secondary" onclick="window.print()">⎙ Yazdır</button></div>`}
function renderProfile(name,target){state.active=name;target.innerHTML=profileHtml(name)}
window.speakProfile=name=>{const p=profiles[name];if(!p)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(`${name}. ${p.summary}. Savaşlar ve olaylar: ${p.military}. Yönetim mirası: ${p.legacy}`);u.lang="tr-TR";u.rate=.93;speechSynthesis.speak(u)}
window.downloadProfile=name=>{const p=profiles[name];if(!p)return;const text=`${name}\n${p.order}. Osmanlı Padişahı\n\nDoğum: ${p.birth}\nÖlüm: ${p.death}\nSaltanat: ${p.reign}\nBabası: ${p.father}\nDönem: ${p.era}\n\nGENEL BAKIŞ\n${p.summary}\n\nSAVAŞLAR VE OLAYLAR\n${p.military}\n\nYÖNETİM MİRASI\n${p.legacy}`;const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));a.download=name.replaceAll(" ","_")+"_Bilgi_Dosyasi.txt";a.click();URL.revokeObjectURL(a.href)}
const eras={};names.forEach(n=>(eras[profiles[n].era]??=[]).push(n));$("#eraStrip").innerHTML=Object.entries(eras).map(([e,a])=>`<div class="era-card"><b>${e}</b><small>${a[0]} → ${a.at(-1)} • ${a.length} padişah</small></div>`).join("");
function fillEraFilter(){Object.keys(eras).forEach(e=>$("#eraFilter").insertAdjacentHTML("beforeend",`<option>${e}</option>`))}
function renderEncyclopedia(){const q=$("#encyclopediaSearch").value.trim().toLocaleLowerCase("tr-TR"),era=$("#eraFilter").value;const list=names.filter(n=>{const p=profiles[n],hay=`${n} ${p.summary} ${p.military} ${p.legacy} ${p.era}`.toLocaleLowerCase("tr-TR");return (!q||hay.includes(q))&&(!era||p.era===era)});$("#encyclopediaGrid").innerHTML=list.map(n=>{const p=profiles[n];return `<article class="sultan-card"><span class="num">${p.order}. PADİŞAH • ${p.era}</span><h3>${n}</h3><p>${p.summary.slice(0,130)}...</p><button class="secondary" data-open="${n}">Profili Aç</button></article>`}).join("")||`<p class="muted">Sonuç bulunamadı.</p>`}
$("#encyclopediaSearch").oninput=renderEncyclopedia;$("#eraFilter").onchange=renderEncyclopedia;$("#encyclopediaGrid").onclick=e=>{const b=e.target.closest("[data-open]");if(!b)return;renderProfile(b.dataset.open,$("#encyclopediaDetail"));$("#encyclopediaDetail").classList.remove("hidden");$("#encyclopediaDetail").scrollIntoView({behavior:"smooth"})}
function renderTimeline(){$("#timelineList").innerHTML=names.map(n=>{const p=profiles[n];return `<article class="timeline-item"><small>${p.reign} • ${p.era}</small><h3>${p.order}. ${n}</h3><p>${p.summary}</p></article>`}).join("")}
const fatherMap={"Osman Gazi":"Ertuğrul Gazi","Orhan Gazi":"Osman Gazi","I. Murad":"Orhan Gazi","Yıldırım Bayezid":"I. Murad","I. Mehmed":"Yıldırım Bayezid","II. Murad":"I. Mehmed","Fatih Sultan Mehmed":"II. Murad","II. Bayezid":"Fatih Sultan Mehmed","Yavuz Sultan Selim":"II. Bayezid","Kanuni Sultan Süleyman":"Yavuz Sultan Selim","II. Selim":"Kanuni Sultan Süleyman","III. Murad":"II. Selim","III. Mehmed":"III. Murad","I. Ahmed":"III. Mehmed","I. Mustafa":"III. Mehmed","II. Osman":"I. Ahmed","IV. Murad":"I. Ahmed","İbrahim":"I. Ahmed","IV. Mehmed":"İbrahim","II. Süleyman":"İbrahim","II. Ahmed":"İbrahim","II. Mustafa":"IV. Mehmed","III. Ahmed":"IV. Mehmed","I. Mahmud":"II. Mustafa","III. Osman":"II. Mustafa","III. Mustafa":"III. Ahmed","I. Abdülhamid":"III. Ahmed","III. Selim":"III. Mustafa","IV. Mustafa":"I. Abdülhamid","II. Mahmud":"I. Abdülhamid","Abdülmecid":"II. Mahmud","Abdülaziz":"II. Mahmud","V. Murad":"Abdülmecid","II. Abdülhamid":"Abdülmecid","V. Mehmed Reşad":"Abdülmecid","VI. Mehmed Vahdeddin":"Abdülmecid"};
let treeZoom=1;
function renderTree(){const svg=$("#dynastySvg");if(!svg)return;const NS="http://www.w3.org/2000/svg",root="Ertuğrul Gazi",all=[root,...names],children=Object.fromEntries(all.map(n=>[n,[]]));names.forEach(n=>children[fatherMap[n]]?.push(n));const order=Object.fromEntries(names.map((n,i)=>[n,i+1]));Object.values(children).forEach(a=>a.sort((x,y)=>(order[x]||0)-(order[y]||0)));const depth={};(function d(n,v){depth[n]=v;children[n].forEach(c=>d(c,v+1))})(root,0);const W=185,H=70,gx=30,gy=65,pos={};let leaf=65;(function lay(n){if(!children[n].length){pos[n]={x:leaf,y:40+depth[n]*(H+gy)};leaf+=W+gx;return pos[n].x}const xs=children[n].map(lay);pos[n]={x:(Math.min(...xs)+Math.max(...xs))/2,y:40+depth[n]*(H+gy)};return pos[n].x})(root);const width=Math.max(1800,leaf+80),height=100+(Math.max(...Object.values(depth))+1)*(H+gy);svg.setAttribute("viewBox",`0 0 ${width} ${height}`);svg.setAttribute("width",width);svg.setAttribute("height",height);svg.innerHTML="";all.forEach(p=>children[p].forEach(c=>{const a=pos[p],b=pos[c],sx=a.x+W/2,sy=a.y+H,ex=b.x+W/2,ey=b.y,my=(sy+ey)/2,path=document.createElementNS(NS,"path");path.setAttribute("d",`M${sx} ${sy}V${my}H${ex}V${ey}`);path.setAttribute("class","tree-link");svg.appendChild(path)}));all.forEach(n=>{const p=pos[n],g=document.createElementNS(NS,"g");g.setAttribute("class","tree-node");g.setAttribute("transform",`translate(${p.x},${p.y})`);const r=document.createElementNS(NS,"rect");r.setAttribute("width",W);r.setAttribute("height",H);g.appendChild(r);const t=document.createElementNS(NS,"text");t.setAttribute("x",W/2);t.setAttribute("y",30);t.setAttribute("class","tree-name");t.textContent=n;g.appendChild(t);const m=document.createElementNS(NS,"text");m.setAttribute("x",W/2);m.setAttribute("y",51);m.setAttribute("class","tree-meta");m.textContent=n===root?"Osman Gazi'nin babası":`${order[n]}. padişah • ${profiles[n].reign}`;g.appendChild(m);if(n!==root)g.onclick=()=>{page("encyclopedia");renderProfile(n,$("#encyclopediaDetail"));$("#encyclopediaDetail").classList.remove("hidden")};svg.appendChild(g)});applyTreeZoom()}
function applyTreeZoom(){
  const svg=$("#dynastySvg");
  const reset=$("#treeReset");
  if(!svg)return;
  svg.style.transform=`scale(${treeZoom})`;
  if(reset)reset.textContent=`%${Math.round(treeZoom*100)}`;
}
const treePlus=$("#treePlus");
const treeMinus=$("#treeMinus");
const treeReset=$("#treeReset");
if(treePlus)treePlus.onclick=()=>{treeZoom=Math.min(1.5,+(treeZoom+.1).toFixed(1));applyTreeZoom()};
if(treeMinus)treeMinus.onclick=()=>{treeZoom=Math.max(.5,+(treeZoom-.1).toFixed(1));applyTreeZoom()};
if(treeReset)treeReset.onclick=()=>{treeZoom=1;applyTreeZoom()};
function fillCompare(){names.forEach(n=>{$("#compareA").insertAdjacentHTML("beforeend",`<option>${n}</option>`);$("#compareB").insertAdjacentHTML("beforeend",`<option>${n}</option>`)});$("#compareA").value="Fatih Sultan Mehmed";$("#compareB").value="Kanuni Sultan Süleyman";compare()}
function compare(){const a=$("#compareA").value,b=$("#compareB").value,x=profiles[a],y=profiles[b],rows=[["Padişah sırası",x.order,y.order],["Dönem",x.era,y.era],["Doğum",x.birth,y.birth],["Saltanat",x.reign,y.reign],["Babası",x.father,y.father],["Genel bakış",x.summary,y.summary],["Askerî faaliyet",x.military,y.military],["Yönetim mirası",x.legacy,y.legacy]];$("#compareResult").innerHTML=`<table class="compare-table"><thead><tr><th>Özellik</th><th>${a}</th><th>${b}</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</tbody></table>`}$("#compareRun").onclick=compare;
const glossary=[["Akıncı","Sınır bölgelerinde keşif ve hızlı baskın yapan hafif süvari."],["Beylerbeyi","Bir eyaletin en yüksek yöneticisi."],["Cülus","Padişahın tahta çıkması."],["Defterdar","Devlet maliyesinden sorumlu yüksek görevli."],["Devşirme","Bazı Hristiyan çocukların devlet hizmeti için seçilip eğitildiği sistem."],["Divan-ı Hümayun","Devlet işlerinin görüşüldüğü en yüksek kurul."],["Enderun","Saray içindeki yönetici yetiştirme okulu."],["Ferman","Padişahın yazılı emri."],["Kaptan-ı Derya","Osmanlı donanmasının başkomutanı."],["Kazasker","Adalet ve eğitim işlerinden sorumlu yüksek görevli."],["Külliye","Cami çevresindeki medrese, imaret ve benzeri yapılar bütünü."],["Mahlas","Şairlerin kullandığı takma ad."],["Nişancı","Tuğra çeken ve arazi kayıtlarını yöneten görevli."],["Sadrazam","Padişahtan sonra devletin en yetkili yöneticisi."],["Sancak","Eyaletten küçük idarî bölge."],["Sipahi","Tımar karşılığında askerlik yapan atlı asker."],["Tımar","Devlet gelirinin hizmet karşılığı görevlilere bırakıldığı düzen."],["Tuğra","Padişahın süslü imza ve hüküm işareti."],["Vakıf","Geliri kamu yararına ayrılan mal veya kurum."],["Yeniçeri","Kapıkulu ordusunun piyade sınıfı."]];
function renderGlossary(){const q=$("#glossarySearch").value.toLocaleLowerCase("tr-TR");$("#glossaryGrid").innerHTML=glossary.filter(x=>x.join(" ").toLocaleLowerCase("tr-TR").includes(q)).map(x=>`<article class="glossary-item"><h3>${x[0]}</h3><p>${x[1]}</p></article>`).join("")}$("#glossarySearch").oninput=renderGlossary;
const quizBank=[["İstanbul'u fetheden padişah hangisidir?","Fatih Sultan Mehmed",["II. Murad","Fatih Sultan Mehmed","Yavuz Sultan Selim","Kanuni Sultan Süleyman"]],["Nizam-ı Cedid hangi padişah dönemindedir?","III. Selim",["II. Mahmud","III. Selim","I. Abdülhamid","Abdülmecid"]],["Yeniçeri Ocağı'nı kaldıran padişah kimdir?","II. Mahmud",["III. Selim","II. Mahmud","Abdülaziz","IV. Murad"]],["Mısır hangi padişah döneminde Osmanlı'ya katıldı?","Yavuz Sultan Selim",["Fatih Sultan Mehmed","Yavuz Sultan Selim","Kanuni Sultan Süleyman","II. Bayezid"]],["Lale Devri'nin padişahı kimdir?","III. Ahmed",["II. Mustafa","III. Ahmed","I. Mahmud","III. Selim"]],["Osmanlı'nın son padişahı kimdir?","VI. Mehmed Vahdeddin",["V. Mehmed Reşad","II. Abdülhamid","VI. Mehmed Vahdeddin","V. Murad"]],["Mohaç Zaferi hangi padişah dönemindedir?","Kanuni Sultan Süleyman",["Yavuz Sultan Selim","Kanuni Sultan Süleyman","II. Selim","Fatih Sultan Mehmed"]],["Fetret Devri'ni sona erdiren padişah kimdir?","I. Mehmed",["Yıldırım Bayezid","I. Mehmed","II. Murad","Orhan Gazi"]],["Hicaz Demiryolu hangi padişah döneminde yapıldı?","II. Abdülhamid",["Abdülaziz","II. Abdülhamid","V. Mehmed Reşad","Abdülmecid"]],["Sultanahmet Camii hangi padişah dönemindedir?","I. Ahmed",["III. Mehmed","I. Ahmed","II. Osman","IV. Murad"]],["Bağdat Fatihi olarak anılan padişah kimdir?","IV. Murad",["III. Murad","IV. Murad","Yavuz Sultan Selim","Kanuni Sultan Süleyman"]],["Osmanlı Beyliği'nin kurucusu kimdir?","Osman Gazi",["Ertuğrul Gazi","Osman Gazi","Orhan Gazi","I. Murad"]],["Tanzimat Fermanı hangi padişah döneminde ilan edildi?","Abdülmecid",["II. Mahmud","Abdülmecid","Abdülaziz","II. Abdülhamid"]],["Kıbrıs hangi padişah döneminde fethedildi?","II. Selim",["Kanuni Sultan Süleyman","II. Selim","III. Murad","IV. Mehmed"]],["Varna Zaferi hangi padişah dönemindedir?","II. Murad",["I. Mehmed","II. Murad","Fatih Sultan Mehmed","Yıldırım Bayezid"]]];
let qset=[],qi=0,score=0,answered=false;function startQuiz(){qset=[...quizBank].sort(()=>Math.random()-.5).slice(0,10);qi=0;score=0;showQuestion()}function showQuestion(){answered=false;const q=qset[qi];$("#quizProgress").textContent=`Soru ${qi+1}/10`;$("#quizScore").textContent=`${score} puan`;$("#quizFill").style.width=`${(qi+1)*10}%`;$("#quizQuestion").textContent=q[0];$("#quizFeedback").textContent="";$("#quizNext").disabled=true;$("#quizNext").textContent=qi===9?"Sonucu Gör":"Sonraki";$("#quizOptions").innerHTML=q[2].map(o=>`<button class="quiz-option" data-answer="${o}">${o}</button>`).join("")}$("#quizOptions").onclick=e=>{const b=e.target.closest("[data-answer]");if(!b||answered)return;answered=true;const q=qset[qi],ok=b.dataset.answer===q[1];if(ok)score+=10;$$(".quiz-option").forEach(x=>{x.disabled=true;if(x.dataset.answer===q[1])x.classList.add("correct");else if(x===b)x.classList.add("wrong")});$("#quizScore").textContent=`${score} puan`;$("#quizFeedback").textContent=ok?"Doğru!":"Doğru cevap: "+q[1];$("#quizNext").disabled=false};$("#quizNext").onclick=()=>{if(qi<9){qi++;showQuestion()}else{const best=Math.max(score,Number(localStorage.getItem("oa_best")||0));localStorage.setItem("oa_best",best);updateStats();$("#quizQuestion").textContent=`${score}/100 — ${score>=90?"Tarih Ustası":score>=70?"Başkomutan":score>=50?"Akıncı":"Çırak"}`;$("#quizOptions").innerHTML="";$("#quizFeedback").textContent="Yeni bir rastgele tur için aşağıdaki düğmeye bas.";$("#quizNext").textContent="Yeniden Başlat";$("#quizNext").onclick=()=>{startQuiz();$("#quizNext").onclick=arguments.callee}}};
const dialog=$("#searchDialog");$("#globalSearchButton").onclick=()=>dialog.showModal();$("#globalSearch").oninput=e=>{const q=e.target.value.toLocaleLowerCase("tr-TR");if(!q)return $("#globalResults").innerHTML="";const found=names.filter(n=>{const p=profiles[n];return `${n} ${p.summary} ${p.military} ${p.legacy} ${p.era}`.toLocaleLowerCase("tr-TR").includes(q)}).slice(0,12);$("#globalResults").innerHTML=found.map(n=>`<div class="search-result" data-search-name="${n}"><b>${n}</b><small>${profiles[n].era} • ${profiles[n].reign}</small></div>`).join("")||`<p class="muted">Sonuç yok.</p>`};$("#globalResults").onclick=e=>{const r=e.target.closest("[data-search-name]");if(!r)return;dialog.close();page("encyclopedia");renderProfile(r.dataset.searchName,$("#encyclopediaDetail"));$("#encyclopediaDetail").classList.remove("hidden")};

// Recognition mode tabs
$$(".mode-button").forEach(btn=>btn.addEventListener("click",()=>{
  $$(".mode-button").forEach(x=>x.classList.toggle("active",x===btn));
  const camera=btn.dataset.mode==="camera";
  $("#uploadMode").classList.toggle("hidden",camera);
  $("#cameraMode").classList.toggle("hidden",!camera);
}));

// Camera mode
const video=$("#cameraVideo"),canvas=$("#cameraCanvas"),startCam=$("#startCameraButton"),capture=$("#captureButton"),stopCam=$("#stopCameraButton");
async function startCamera(){
  try{
    state.cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:1280},height:{ideal:720}},audio:false});
    video.srcObject=state.cameraStream;
    capture.disabled=false;stopCam.disabled=false;startCam.disabled=true;
  }catch(err){console.error(err);toast("Kamera açılamadı. Tarayıcı iznini kontrol et.")}
}
function stopCamera(){
  state.cameraStream?.getTracks().forEach(t=>t.stop());
  state.cameraStream=null;video.srcObject=null;capture.disabled=true;stopCam.disabled=true;startCam.disabled=false;
}
async function captureAndAnalyze(){
  if(!state.model||!video.videoWidth)return;
  canvas.width=video.videoWidth;canvas.height=video.videoHeight;
  const ctx=canvas.getContext("2d");
  ctx.translate(canvas.width,0);ctx.scale(-1,1);ctx.drawImage(video,0,0);
  capture.disabled=true;capture.textContent="Tanınıyor…";
  try{await runPrediction(canvas)}catch(err){console.error(err);toast("Kamera analizi başarısız")}finally{capture.disabled=false;capture.textContent="Fotoğraf Çek ve Tanı"}
}
startCam.onclick=startCamera;stopCam.onclick=stopCamera;capture.onclick=captureAndAnalyze;

// Model Center
function renderModelCenter(){
  const mapped=window.MODEL_LABELS.map((label,i)=>({raw:label,standard:normalizeLabel(label),i:i+1}));
  $("#modelClassMetric").textContent=mapped.length;
  $("#modelVersionMetric").textContent="TM 2.4.14";
  const unique=new Set(mapped.map(x=>x.standard));
  const health=Math.round((unique.size/mapped.length)*100);
  $("#modelHealthFill").style.width=`${health}%`;
  $("#modelHealthTitle").textContent=health===100?"Model sınıfları eksiksiz":"Model hazır";
  $("#modelHealthText").textContent=`${mapped.length} sınıf, ${unique.size} standart padişah adı. Gönderilen model başarıyla bağlandı.`;
  $("#modelLabelGrid").innerHTML=mapped.map(x=>`<article class="label-card"><small>${x.i}. MODEL SINIFI</small><b>${escapeHtml(x.standard)}</b>${x.raw!==x.standard?`<em>Model etiketi: ${escapeHtml(x.raw)}</em>`:""}</article>`).join("");
}

// History
function renderHistory(){
  const grid=$("#historyGrid");
  if(!grid)return;
  if(!state.history.length){grid.innerHTML='<p class="muted">Henüz analiz yapılmadı.</p>';return}
  grid.innerHTML=state.history.map((h,i)=>`<article class="history-card"><small>${i+1}. ANALİZ • ${escapeHtml(h.date)}</small><h3>${escapeHtml(h.name)}</h3><p><span class="history-confidence">%${h.confidence}</span> güven</p>${h.alternatives?.length?`<p>Yakın seçenekler: ${h.alternatives.map(escapeHtml).join(", ")}</p>`:""}</article>`).join("");
}
if($("#clearHistoryButton")) $("#clearHistoryButton").onclick=()=>{if(confirm("Analiz geçmişi silinsin mi?")){state.history=[];localStorage.removeItem("oa_history");renderHistory();updateStats();toast("Geçmiş temizlendi")}};

// Keyboard shortcuts
addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="u"){e.preventDefault();page("recognition");chooseFile()}
  if(e.key==="Escape"&&state.cameraStream)stopCamera();
});

renderModelCenter();
renderHistory();



// Hanedan poster controls
let posterZoom=1;
const poster=$("#dynastyPoster");
function applyPosterZoom(){poster.style.transform=`scale(${posterZoom})`;$("#posterReset").textContent=`%${Math.round(posterZoom*100)}`}
$("#posterPlus").onclick=()=>{posterZoom=Math.min(2,+(posterZoom+.1).toFixed(1));applyPosterZoom()};
$("#posterMinus").onclick=()=>{posterZoom=Math.max(.5,+(posterZoom-.1).toFixed(1));applyPosterZoom()};
$("#posterReset").onclick=()=>{posterZoom=1;applyPosterZoom()};
$("#posterFullscreen").onclick=()=>$("#posterViewport").requestFullscreen?.();
names.forEach(n=>$("#posterSultanSelect").insertAdjacentHTML("beforeend",`<option>${n}</option>`));
$("#posterOpenProfile").onclick=()=>{const n=$("#posterSultanSelect").value;page("encyclopedia");renderProfile(n,$("#encyclopediaDetail"));$("#encyclopediaDetail").classList.remove("hidden");$("#encyclopediaDetail").scrollIntoView({behavior:"smooth"})};

// Educational local historical chat
let selectedChatSultan="Fatih Sultan Mehmed";
function renderChatSultanChoices(filter=""){
  const q=filter.trim().toLocaleLowerCase("tr-TR");
  const list=names.filter(n=>n.toLocaleLowerCase("tr-TR").includes(q));
  $("#chatSultanGrid").innerHTML=list.map(n=>`
    <button class="chat-sultan-choice ${n===selectedChatSultan?"active":""}" data-chat-sultan="${n}">
      ${n}<br><small>${profiles[n].reign}</small>
    </button>`).join("") || '<p class="muted">Padişah bulunamadı.</p>';
}
function updateChatSultan(name=selectedChatSultan){
  selectedChatSultan=name;
  $("#chatSultanSelect").value=name;
  const p=profiles[name];
  if(!p)return;
  $("#chatSultanCard").innerHTML=`<h3>${name}</h3><p>${p.era} dönemi • ${p.reign}</p><p>${p.summary}</p>`;
  $("#chatMessages").innerHTML=`<div class="message ai"><small>${name} • Eğitimsel canlandırma</small>Merhaba. Dönemim, hayatım, savaşlarım veya yönetim anlayışım hakkında soru sorabilirsin.</div>`;
  renderChatSultanChoices($("#chatSultanSearch").value);
  updateLivingSultan(name);
}
$("#chatSultanGrid").onclick=e=>{
  const b=e.target.closest("[data-chat-sultan]");
  if(!b)return;
  updateChatSultan(b.dataset.chatSultan);
};
$("#chatSultanSearch").oninput=e=>renderChatSultanChoices(e.target.value);
function historicalAnswer(name,q){
  const p=profiles[name],t=q.toLocaleLowerCase("tr-TR");
  if(/kim|kimsiniz|hayat|doğum|yaşam/.test(t))return `Ben ${name} olarak canlandırılıyorum. ${p.summary} Doğum tarihim ${p.birth}, saltanat dönemim ${p.reign}.`;
  if(/savaş|fetih|sefer|ordu|zafer/.test(t))return `Askerî faaliyetlerimle ilgili öne çıkan bilgiler şunlardır: ${p.military}`;
  if(/yönet|reform|ıslahat|devlet|kanun/.test(t))return `Yönetim ve devlet mirası açısından: ${p.legacy}`;
  if(/baba|aile|soy/.test(t))return `Babam ${p.father} olarak kayıtlıdır. Osmanlı hanedanındaki yerim ${p.order}. padişah olmamdır.`;
  if(/dönem|çağ|hangi/.test(t))return `${p.era} döneminde hüküm sürdüm. Saltanat yıllarım ${p.reign}. Bu dönemin genel özeti: ${p.summary}`;
  if(/ölüm|öldünüz|vefat/.test(t))return `Tarih kayıtlarına göre ölüm tarihim ${p.death}.`;
  return `Bu soruya uygulamadaki tarih bilgilerinden şöyle cevap verebilirim: ${p.summary} Ayrıca askerî alanda ${p.military} Yönetim açısından ise ${p.legacy}`;
}

const livingVoicePrefs={enabled:localStorage.getItem("oa_living_voice")!=="0"};
function updateLivingSultan(name){
  const p=profiles[name];if(!p)return;
  $("#livingSultanName").textContent=name;
  $("#livingSultanStatus").textContent="Sorunu bekliyor";
  $("#livingAvatar").dataset.era=p.era;
  const eraStyles={
    "Osman Gazi":"#496b48","Orhan Gazi":"#4d704e","Fatih Sultan Mehmed":"#821d2c",
    "Yavuz Sultan Selim":"#5a2025","Kanuni Sultan Süleyman":"#603b72",
    "III. Selim":"#315d6b","II. Mahmud":"#3e5968","II. Abdülhamid":"#254f4a"
  };
  $("#livingAvatar").style.setProperty("--living-robe",eraStyles[name]||"");
}
function setLivingSpeaking(active,status){
  $("#livingAvatar").classList.toggle("speaking",active);
  $("#livingWave").classList.toggle("active",active);
  $("#livingSultanStatus").textContent=status||(active?"Konuşuyor":"Sorunu bekliyor");
}
function speakLivingSultan(text){
  speechSynthesis.cancel();
  if(!livingVoicePrefs.enabled){setLivingSpeaking(false,"Cevap yazılı gösterildi");return}
  const u=new SpeechSynthesisUtterance(text);
  u.lang=appLang==="en"?"en-US":"tr-TR";
  u.rate=.91;u.pitch=.86;
  u.onstart=()=>setLivingSpeaking(true,"Konuşuyor");
  u.onend=()=>setLivingSpeaking(false,"Sorunu bekliyor");
  u.onerror=()=>setLivingSpeaking(false,"Ses tamamlanamadı");
  speechSynthesis.speak(u);
}
$("#livingVoiceEnabled").checked=livingVoicePrefs.enabled;
$("#livingVoiceEnabled").onchange=e=>{livingVoicePrefs.enabled=e.target.checked;localStorage.setItem("oa_living_voice",e.target.checked?"1":"0");if(!e.target.checked){speechSynthesis.cancel();setLivingSpeaking(false,"Sesli cevap kapalı")}};
$("#livingIntroduce").onclick=()=>{
  const name=selectedChatSultan,p=profiles[name];
  const intro=`Ben ${name}. ${p.summary} Saltanat dönemim ${p.reign}. Bana hayatım, savaşlarım ve yönetim anlayışım hakkında soru sorabilirsin.`;
  speakLivingSultan(intro);
};
$("#livingStop").onclick=()=>{speechSynthesis.cancel();setLivingSpeaking(false,"Ses durduruldu")};

function sendChatQuestion(text){
  const q=text.trim();if(!q)return;
  const name=selectedChatSultan;
  $("#chatMessages").insertAdjacentHTML("beforeend",`<div class="message user"><small>Sen</small>${escapeHtml(q)}</div>`);
  const ans=historicalAnswer(name,q);
  setTimeout(()=>{
    const box=$("#chatMessages");
    box.insertAdjacentHTML("beforeend",`<div class="message ai"><small>${name} • Eğitimsel canlandırma</small>${escapeHtml(ans)}</div>`);
    box.scrollTop=box.scrollHeight;
    speakLivingSultan(ans);
  },260);
  $("#chatInput").value="";
}
$("#chatSend").onclick=()=>sendChatQuestion($("#chatInput").value);
$("#chatInput").onkeydown=e=>{if(e.key==="Enter")sendChatQuestion(e.target.value)};
$$("[data-quick]").forEach(b=>b.onclick=()=>sendChatQuestion(b.dataset.quick));
renderChatSultanChoices();updateChatSultan(selectedChatSultan);updateLivingSultan(selectedChatSultan);

// Game tabs
$$(".game-tab").forEach(btn=>btn.onclick=()=>{
  $$(".game-tab").forEach(x=>x.classList.toggle("active",x===btn));
  $("#gameConquest").classList.toggle("hidden",btn.dataset.game!=="conquest");
  $("#gameGuess").classList.toggle("hidden",btn.dataset.game!=="guess");
  $("#gameOrder").classList.toggle("hidden",btn.dataset.game!=="order");
});

// Conquest strategy
const conquestBank=[
  {q:"1453 İstanbul kuşatmasında Boğaz'dan gelebilecek yardımı kesmek istiyorsun. En doğru hazırlık hangisi?",o:["Rumeli Hisarı'nı yaptırmak","Ordunun tamamını geri çekmek","Donanmayı dağıtmak","Kuşatmayı kışa bırakmak"],a:0,e:"Rumeli Hisarı, Boğaz geçişini denetlemek için kritik öneme sahipti."},
  {q:"Uzun bir seferde ordunun gücünü korumak için ilk öncelik ne olmalı?",o:["İkmal ve lojistik","Sadece hızlı ilerlemek","Haritasız yürümek","Bütün kuvveti tek noktaya yığmak"],a:0,e:"Lojistik ve ikmal, ordunun sürdürülebilirliği için temel şarttır."},
  {q:"Bir kaleyi kuşatırken savunmanın zayıf noktasını bulmak için ne yaparsın?",o:["Keşif ve istihbarat","Rastgele saldırı","Tüm topları saklamak","Gece gündüz aynı noktaya yürümek"],a:0,e:"Keşif ve istihbarat doğru saldırı planının temelidir."},
  {q:"Deniz gücünün önemli olduğu bir fetihte hangi karar daha mantıklıdır?",o:["Donanmayı kara ordusuyla eşgüdümlü kullanmak","Donanmayı limanda bırakmak","Yalnızca süvari göndermek","İkmal gemilerini kaldırmak"],a:0,e:"Kara ve deniz kuvvetlerinin birlikte hareket etmesi başarı şansını artırır."}
];
let conquestIndex=0,conquestScore=0,conquestAnswered=false;
function renderConquest(){const x=conquestBank[conquestIndex];conquestAnswered=false;$("#conquestScenario").textContent=x.q;$("#conquestOptions").innerHTML=x.o.map((v,i)=>`<button class="game-option" data-conquest="${i}">${v}</button>`).join("");$("#conquestFeedback").textContent="";$("#conquestNext").disabled=true;$("#conquestScore").textContent=`${conquestScore} puan`}
$("#conquestOptions").onclick=e=>{const b=e.target.closest("[data-conquest]");if(!b||conquestAnswered)return;conquestAnswered=true;const x=conquestBank[conquestIndex],sel=Number(b.dataset.conquest);if(sel===x.a)conquestScore+=25;$$("[data-conquest]").forEach((btn,i)=>{btn.disabled=true;if(i===x.a)btn.classList.add("correct");else if(i===sel)btn.classList.add("wrong")});$("#conquestFeedback").textContent=x.e;$("#conquestNext").disabled=false;$("#conquestScore").textContent=`${conquestScore} puan`};
$("#conquestNext").onclick=()=>{conquestIndex=(conquestIndex+1)%conquestBank.length;if(conquestIndex===0)conquestScore=0;renderConquest()};
renderConquest();

// Guess the Sultan
let guessTarget=null,guessScore=0;
function renderGuess(){
  guessTarget=names[Math.floor(Math.random()*names.length)];
  const p=profiles[guessTarget],options=[guessTarget];
  while(options.length<4){const n=names[Math.floor(Math.random()*names.length)];if(!options.includes(n))options.push(n)}
  options.sort(()=>Math.random()-.5);
  $("#guessClues").innerHTML=`<b>İpucu 1:</b> ${p.era} dönemindeyim.<br><b>İpucu 2:</b> Saltanatım ${p.reign}.<br><b>İpucu 3:</b> ${p.legacy}`;
  $("#guessOptions").innerHTML=options.map(n=>`<button class="game-option" data-guess="${n}">${n}</button>`).join("");
  $("#guessFeedback").textContent="";$("#guessNext").disabled=true;$("#guessScore").textContent=`${guessScore} puan`;
}
$("#guessOptions").onclick=e=>{const b=e.target.closest("[data-guess]");if(!b)return;const ok=b.dataset.guess===guessTarget;if(ok)guessScore+=20;$$("[data-guess]").forEach(x=>{x.disabled=true;if(x.dataset.guess===guessTarget)x.classList.add("correct");else if(x===b)x.classList.add("wrong")});$("#guessFeedback").textContent=ok?"Doğru!":"Doğru cevap: "+guessTarget;$("#guessNext").disabled=false;$("#guessScore").textContent=`${guessScore} puan`};
$("#guessNext").onclick=renderGuess;renderGuess();

// Throne order game
let orderRound=[];
function renderOrderGame(){
  const start=Math.floor(Math.random()*(names.length-5));
  orderRound=names.slice(start,start+5);
  const shuffled=[...orderRound].sort(()=>Math.random()-.5);
  $("#orderPool").innerHTML=shuffled.map(n=>`<button class="order-card" data-order="${n}">${n}</button>`).join("");
  $("#orderAnswer").innerHTML="";$("#orderFeedback").textContent="";$("#orderScore").textContent="0 puan";
}
$("#orderPool").onclick=e=>{const b=e.target.closest("[data-order]");if(!b)return;$("#orderAnswer").appendChild(b);if($("#orderAnswer").children.length===orderRound.length){const selected=[...$("#orderAnswer").children].map(x=>x.dataset.order),ok=selected.every((n,i)=>n===orderRound[i]);$("#orderFeedback").textContent=ok?"Mükemmel! Taht sırası doğru.":"Sıra doğru değil. Doğru sıra: "+orderRound.join(" → ");$("#orderScore").textContent=ok?"100 puan":"0 puan"}};
$("#orderReset").onclick=renderOrderGame;renderOrderGame();


$$("[data-open-game]").forEach(button=>button.addEventListener("click",()=>{
  const game=button.dataset.openGame;
  setTimeout(()=>{
    const tab=document.querySelector(`.game-tab[data-game="${game}"]`);
    if(tab)tab.click();
  },80);
}));

applyPosterZoom();



// Infinity state
const infinity=JSON.parse(localStorage.getItem("oa_infinity")||'{"xp":0,"chats":0,"games":0,"achievements":{}}');
function saveInfinity(){localStorage.setItem("oa_infinity",JSON.stringify(infinity));renderCareer();renderAchievements();renderStats()}
function addXP(amount,key){infinity.xp+=amount;if(key)infinity.achievements[key]=true;saveInfinity()}
const ranks=[
  {level:1,min:0,max:100,name:"Acemi",icon:"🛡️"},
  {level:2,min:100,max:250,name:"Yeniçeri",icon:"⚔️"},
  {level:3,min:250,max:500,name:"Akıncı",icon:"🏹"},
  {level:4,min:500,max:900,name:"Bölükbaşı",icon:"🎖️"},
  {level:5,min:900,max:1400,name:"Başbuğ",icon:"🛡️"},
  {level:6,min:1400,max:2000,name:"Ağa",icon:"👑"},
  {level:7,min:2000,max:2800,name:"Paşa",icon:"🏛️"},
  {level:8,min:2800,max:4000,name:"Sadrazam",icon:"📜"},
  {level:9,min:4000,max:7500,name:"Padişah",icon:"👑"},
  {level:10,min:7500,max:15000,name:"Yavuz",icon:"⭐"},
  {level:11,min:15000,max:25000,name:"Kanuni",icon:"⭐"},
  {level:12,min:25000,max:100000,name:"Fatih",icon:"🌟"},
  {level:13,min:100000,max:100000,name:"Cihan Hâkimi",icon:"♾️"}
];
function getCurrentRank(xp){return [...ranks].reverse().find(x=>xp>=x.min)||ranks[0]}
function renderCareer(){
  const r=getCurrentRank(infinity.xp),idx=ranks.indexOf(r),next=ranks[idx+1];
  $("#rankIcon").textContent=r.icon;$("#rankName").textContent=r.name;$("#xpText").textContent=`${infinity.xp} XP`;
  $("#nextRankText").textContent=next?`Sonraki: ${next.name} (${next.min} XP)`:"En yüksek rütbe: Cihan Hâkimi";
  const pct=next?Math.max(0,Math.min(100,((infinity.xp-r.min)/(next.min-r.min))*100)):100;
  $("#xpFill").style.width=`${pct}%`;
  const rankList=$("#rankList");if(rankList)rankList.innerHTML=ranks.map(x=>`<div class="rank-row ${infinity.xp>=x.min?"earned":"locked"}"><span>${x.level}</span><b>${x.icon} ${x.name}</b><em>${x.min} XP</em></div>`).join("");
  const charRank=$("#characterCurrentRank");if(charRank)charRank.textContent=`${r.icon} ${r.name}`;
}
const achievementDefs=[
  ["first_analysis","İlk Tanıma","◉","İlk yapay zekâ analizini tamamla."],
  ["ten_analysis","Portre Avcısı","⌕","10 farklı analiz yap."],
  ["first_chat","Tarih Sohbetçisi","✦","Bir padişaha ilk sorunu sor."],
  ["game_master","Oyun Ustası","⚔","Üç oyun oturumu tamamla."],
  ["quiz_90","Bilgi Hükümdarı","★","Bilgi yarışmasında 90 veya üstü al."],
  ["xp_500","Vezirlik Yolu","♔","500 XP kazan."]
];
function renderAchievements(){const unlocked={...infinity.achievements};if(state.history.length)unlocked.first_analysis=true;if(state.history.length>=10)unlocked.ten_analysis=true;if(infinity.chats>0)unlocked.first_chat=true;if(infinity.games>=3)unlocked.game_master=true;if(Number(localStorage.getItem("oa_best")||0)>=90)unlocked.quiz_90=true;if(infinity.xp>=500)unlocked.xp_500=true;$("#achievementGrid").innerHTML=achievementDefs.map(([k,n,i,d])=>`<article class="achievement ${unlocked[k]?"":"locked"}"><span>${i}</span><h3>${n}</h3><p>${d}</p><small>${unlocked[k]?"KAZANILDI":"KİLİTLİ"}</small></article>`).join("")}
function renderStats(){$("#statAnalyses").textContent=state.history.length;$("#statChats").textContent=infinity.chats;$("#statGames").textContent=infinity.games;$("#statXP").textContent=infinity.xp;$("#bestQuizDetailed").textContent=`${localStorage.getItem("oa_best")||0}/100`;const counts={};state.history.forEach(h=>counts[h.name]=(counts[h.name]||0)+1);const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];$("#mostRecognized").textContent=top?`${top[0]} • ${top[1]} kez`:"Henüz veri yok."}
const oldRunPrediction=runPrediction;runPrediction=async function(source){const before=state.history.length;await oldRunPrediction(source);if(state.history.length>before)addXP(25,state.history.length===1?"first_analysis":null)};

// Intro
const intro=$("#cinematicIntro");function closeIntro(){intro.classList.add("hide");setTimeout(()=>intro.remove(),900)}$("#skipIntro").onclick=closeIntro;setTimeout(closeIntro,4200);

// Full Turkish / English interface system
const I18N_EN={
"Kontrol Paneli":"Dashboard","AI Tanıma":"AI Recognition","Ansiklopedi":"Encyclopedia","Zaman Çizelgesi":"Timeline",
"Hanedan Ağacı":"Dynasty Gallery","Karşılaştır":"Compare","Bilgi Arenası":"Quiz Arena","Tarih Sözlüğü":"Glossary",
"Model Merkezi":"Model Center","Analiz Geçmişi":"Analysis History","Padişahla Konuş":"Talk to a Sultan",
"Osmanlı Oyunları":"Ottoman Games","Dijital Müze":"Digital Museum","Başarılar":"Achievements",
"Osmanlı Danışmanı":"Ottoman Advisor","İstatistikler":"Statistics","Saray Rehberi":"Palace Guide",
"Ferman Yazıcısı":"Edict Writer","Eserler Galerisi":"Monuments Gallery","Hikâye Modu":"Story Mode","Günün Görevi":"Daily Mission",
"Akıllı Arama":"Smart Search","Jüri Modu":"Jury Mode","Geçmişi yapay zekâyla keşfet":"Explore history with artificial intelligence",
"Bir portreden":"From one portrait","623 yıllık tarihe.":"to 623 years of history.",
"Portre Tanı":"Recognize a Portrait","36 Padişahı Keşfet":"Explore 36 Sultans","Osmanlı zaman aralığı":"Ottoman timeline",
"Model sınıfı":"Model classes","Toplam analiz":"Total analyses","En iyi test puanı":"Best quiz score",
"Güven Analizli Tanıma":"Confidence-Based Recognition","Gerçek Hanedan Bağları":"Real Dynastic Links",
"Akıllı Ansiklopedi":"Smart Encyclopedia","Bugün Osmanlı AI'da":"Today in Ottoman AI",
"Yapay Zekâ Destekli Dijital Tarih Platformu":"AI-Powered Digital History Platform",
"Hoş geldiniz, Osmanlı AI INFINITY PRO":"Welcome to Ottoman AI INFINITY PRO",
"Keşfetmeye Başla":"Start Exploring","Günün Tarih Bilgisi":"Historical Fact of the Day",
"Seçme Sürümü":"Selection Version","Sistem kontrol ediliyor...":"Checking system...",
"AI IDENTITY CORE":"AI IDENTITY CORE","Bu padişah kim?":"Who is this sultan?",
"Dosya Yükle":"Upload File","Kamera":"Camera","Portreyi buraya bırak":"Drop the portrait here",
"Görsel Seç":"Choose Image","Değiştir":"Change","Kim Olduğunu Bul":"Identify the Sultan",
"Kim olduğunu bulmaya hazır":"Ready to identify the sultan","TANINAN PADİŞAH":"IDENTIFIED SULTAN",
"Model kararı bekleniyor":"Waiting for model decision","GÜVEN":"CONFIDENCE","Analiz bekleniyor":"Waiting for analysis",
"OSMANLI ANSİKLOPEDİSİ":"OTTOMAN ENCYCLOPEDIA","36 Padişah, tek merkez":"36 Sultans, One Platform",
"Tüm dönemler":"All eras","Profili Aç":"Open Profile","TAHT VE DÖNÜŞÜM ZAMAN ÇİZELGESİ":"THRONE AND TRANSFORMATION TIMELINE",
"HANEDAN GALERİSİ":"DYNASTY GALLERY","36 Osmanlı padişahı tek posterde":"36 Ottoman Sultans on One Poster",
"Tam Ekran":"Fullscreen","Padişah Dosyasını Aç":"Open Sultan Profile","KARŞILAŞTIRMA LABORATUVARI":"COMPARISON LAB",
"İki hükümdarı yan yana koy":"Compare Two Rulers","Karşılaştır":"Compare","BİLGİ YARIŞMASI":"QUIZ",
"Osmanlı bilgin ne kadar güçlü?":"How strong is your Ottoman knowledge?","Sonraki":"Next","Yeniden Başlat":"Restart",
"EĞİTİMSEL TARİH ASİSTANI":"EDUCATIONAL HISTORY ASSISTANT","Padişahla konuş":"Talk to a Sultan",
"Padişah ara":"Search Sultan","Hayatını anlat":"Tell your life","Savaşları":"Campaigns","Yönetimi":"Government",
"Dönemi":"Era","Sor":"Ask","Öğrenirken oyna":"Learn by Playing","Fetih Stratejisi":"Conquest Strategy",
"Kim Bu Padişah?":"Who Is This Sultan?","Taht Sırasını Diz":"Order the Throne","Eşleştirme":"Matching",
"60 Saniye":"60 Seconds","Şehri Bul":"Find the City","Tahtı Koru":"Protect the Throne","Hazine Avı":"Treasure Hunt",
"Sonraki Görev":"Next Mission","Yeni Padişah":"New Sultan","Yeniden Karıştır":"Shuffle Again",
"DEVLET YÖNETİMİ SİMÜLASYONU":"STATE MANAGEMENT SIMULATION","İtibar":"Reputation","Hazine":"Treasury",
"Ordu":"Army","Halk":"People","Sonraki Divan":"Next Council","HARİTA VE İPUCU OYUNU":"MAP AND CLUE GAME",
"Osmanlı Hazine Avı":"Ottoman Treasure Hunt","altın":"gold","Yeni Hazine":"New Treasure",
"DİJİTAL OSMANLI MÜZESİ":"DIGITAL OTTOMAN MUSEUM","Hanedan Salonu":"Dynasty Hall",
"Yapay Zekâ Laboratuvarı":"AI Laboratory","Padişahla Sohbet":"Talk to a Sultan","Oyun Alanı":"Game Zone",
"Salona Git":"Go to Hall","Laboratuvara Git":"Go to Lab","Sohbete Git":"Go to Chat","Oyunlara Git":"Go to Games",
"MODEL MERKEZİ":"MODEL CENTER","36 sınıflı yapay zekâ modeli":"36-Class AI Model",
"MODEL SAĞLIĞI":"MODEL HEALTH","Sınıf":"Classes","Girdi boyutu":"Input size","Model altyapısı":"Model framework",
"ANALİZ GEÇMİŞİ":"ANALYSIS HISTORY","Önceki tanımalar":"Previous recognitions","Geçmişi Temizle":"Clear History",
"ROZET VE BAŞARI SİSTEMİ":"BADGES AND ACHIEVEMENTS","Kazandığın unvanlar":"Your Achievements",
"TARİHSEL STRATEJİ ASİSTANI":"HISTORICAL STRATEGY ASSISTANT","Osmanlı Danışmanı":"Ottoman Advisor",
"Plan Oluştur":"Create Plan","KİŞİSEL İLERLEME":"PERSONAL PROGRESS","İstatistikler":"Statistics",
"AI analizi":"AI analyses","Sohbet sorusu":"Chat questions","Oyun oturumu":"Game sessions","Toplam XP":"Total XP",
"En çok tanınan padişah":"Most recognized sultan","En iyi bilgi yarışması puanı":"Best quiz score",
"CANLI SARAY REHBERİ":"LIVE PALACE GUIDE","Topkapı Sarayı'nı keşfet":"Explore Topkapı Palace",
"YAPAY ZEKÂ DESTEKLİ METİN TASARIMI":"AI-ASSISTED TEXT DESIGN","Ferman Yazıcısı":"Edict Writer",
"Ferman Oluştur":"Create Edict","Seslendir":"Read Aloud","İndir":"Download","MİMARİ VE KÜLTÜR GALERİSİ":"ARCHITECTURE AND CULTURE GALLERY",
"Osmanlı eserleri ve sembolleri":"Ottoman Monuments and Symbols","Mimari":"Architecture","Paralar":"Coins","Belgeler":"Documents",
"ETKİLEŞİMLİ HİKÂYE":"INTERACTIVE STORY","Bir Osmanlı görevlisinin yolculuğu":"Journey of an Ottoman Officer",
"Hikâyeyi Baştan Başlat":"Restart Story","GÜNLÜK ÖĞRENME":"DAILY LEARNING","Günün görevi":"Daily Mission",
"OSMANLI TARİH SÖZLÜĞÜ":"OTTOMAN HISTORY GLOSSARY","Osmanlı kavramlarını öğren":"Learn Ottoman Terms",
"AKILLI ARAMA":"SMART SEARCH","Her yerde ara":"Search Everywhere","Tarih yükleniyor...":"Loading history...",
"OYUN MERKEZİ":"GAME CENTER","Üç oyun hemen hazır":"Three Games Ready Now","Doğru askerî kararları ver.":"Make the right military decisions.",
"İpuçlarından hükümdarı bul.":"Identify the ruler from clues.","Padişahları kronolojik sırala.":"Order the sultans chronologically.",
"MEVCUT RÜTBE":"CURRENT RANK","Yeniçeri":"Janissary","Beylerbeyi":"Governor-General","Vezir":"Vizier",
"Sadrazam":"Grand Vizier","Osmanlı Ustası":"Ottoman Master","Sonraki":"Next","puan":"points","Doğru!":"Correct!",
"Yanlış.":"Incorrect.","Doğru cevap:":"Correct answer:","Soru":"Question","Puan":"Score","Bugünün görevini tamamladın. Yarın yeni görev gelecek.":"You completed today's mission. A new one will arrive tomorrow.",
"Osmanlı Haritası":"Ottoman Map","Fetih Haritası":"Conquest Map","Zaman Kapısı":"Time Gate","Osmanlı Radyo Merkezi":"Ottoman Radio Center","3D Müze":"3D Museum","Hazine Odası":"Treasury Chamber","Osmanlı Escape Room":"Ottoman Escape Room","Yapay Zekâ Tarih Analizi":"AI History Analysis","Savaş Taktiği":"Battle Tactics","Günlük Görevler":"Daily Missions","Sarayım":"My Palace","Yapay Zekâ Komutan":"AI Commander","Infinity Nexus":"Infinity Nexus","Osmanlı Resim AI":"Ottoman Image AI","Osmanlıca Haber":"Ottoman-Style News","Kamera ile Tarih":"History Camera","AI Sinematik":"AI Cinematic Mode","Tarih Tartışması":"History Debate","Tarih Dedektifi":"History Detective","Savaş Simülatörü":"Battle Simulator","Divan-ı Hümayun":"Imperial Council","Sarayda Serbest Gezi":"Free Palace Roam","Silah Müzesi":"Weapons Museum","✨ En İlgi Çekici Özellikler":"✨ Most Exciting Features","✨ EN İLGİ ÇEKİCİ ÖZELLİKLER":"✨ MOST EXCITING FEATURES","150+ ÖZELLİK":"150+ FEATURES","YAPAY ZEKÂ • TARİH • 3D OYUN":"AI • HISTORY • 3D GAME","Girişi Atla":"Skip Intro","İmparatorluk Kapısını Aç":"Enter the Empire","Osmanlı AI tanıtılıyor":"Introducing Ottoman AI",
"3D Fetih Görevi":"3D Conquest Mission","36 Padişahı Yapay Zekâyla Tanıma":"AI Recognition of 36 Sultans",
"Padişahlarla ve Paşalarla Konuşma":"Talk with Sultans and Pashas","İstanbul'un Fethi Simülasyonu":"Conquest of Constantinople Simulation",
"Sanal Topkapı Sarayı ve Silah Müzesi":"Virtual Topkapi Palace and Weapons Museum",
"Fotoğraf yükle veya kamerayı kullan; padişah tahminini, güven yüzdesini ve alternatif tahminleri gör.":"Upload a photo or use the camera to see the predicted sultan, confidence score, and alternatives.",
"Kale içinde karakteri yönet, muhafızlardan kaçın ve 5 sancağı topla.":"Control your character inside the fortress, avoid the guards, and collect all 5 banners.",
"Devlet kararları ver, hazineyi ve orduyu yönet, halkın durumunu takip et.":"Make state decisions, manage the treasury and army, and monitor the people's well-being.",
"Vakaları araştır, şüphelileri sorgula, kanıtları birleştir ve suçluyu bulmaya çalış.":"Investigate cases, question suspects, connect clues, and try to identify the culprit.",
"Sarayda serbestçe gezin ve tarihî silahları keşfet.":"Explore the palace freely and discover historical weapons.",
"Tarihî olayları 3–7 sahnelik anlatılara dönüştür ve sesli anlatımla izle.":"Turn historical events into stories of 3–7 scenes and experience them with narration.",
"Osmanlı tarihiyle ilgili yazılı komutlardan yeni görseller üret. İnternet ve API anahtarı gerekebilir.":"Generate images from text prompts about Ottoman history. An internet connection and API key may be required.",
"ÖZELLİK":"FEATURE","ÖZELLİK TURU TAMAMLANDI":"FEATURE TOUR COMPLETE","Seferi Başlat":"Start Mission",
"Karakter Oluştur":"Create Character","Karakteri Kaydet":"Save Character","Karakter adı":"Character name",
"Başlangıç şehri":"Starting city","Meslek":"Role","Konum":"Location","Keşif Puanı":"Discovery Points",
"Keşfedilen Oda":"Rooms Discovered","Sesli cevapla":"Reply with voice","Ses Ayarları":"Audio Settings",
"Mehter fon müziği":"Mehter background music","Fon müziği":"Background music","Sesli anlatım":"Narration",
"Müziği Başlat / Dene":"Play / Test Music","Gündüz moduna geç":"Switch to day mode","Gece moduna geç":"Switch to night mode",
"Yeni saray bölümü keşfedildi! +100 puan":"New palace area discovered! +100 points",
"Bir bilgi noktasına biraz daha yaklaş.":"Move closer to an information point.","Henüz arşive kaydedilmiş bir inceleme yok.":"No analyses have been saved to the archive yet.",
"İnceleme arşive kaydedildi.":"Analysis saved to archive.","Görsel analiz edilemedi. Başka bir dosya dene.":"Image analysis failed. Try another file.",
"Padişah seç; hayatı ve dönemini Türkçe sesli rehber olarak dinle.":"Choose a sultan and listen to an audio guide about their life and era.",
"Tarih yükleniyor...":"Loading history...","Sistem kontrol ediliyor...":"Checking system...","Henüz veri yok.":"No data yet."
};
// Translate exact labels and known phrases inside longer text nodes too.
function translateTextNode(node){
  if(node.nodeType!==Node.TEXT_NODE)return;
  const raw=node.nodeValue,trim=raw.trim();
  if(!trim)return;
  if(I18N_EN[trim]){node.nodeValue=raw.replace(trim,I18N_EN[trim]);return;}
  let result=raw;
  const keys=Object.keys(I18N_EN).filter(k=>k.length>=5 && k.includes(' ')).sort((a,b)=>b.length-a.length);
  for(const k of keys){if(result.includes(k))result=result.split(k).join(I18N_EN[k]);}
  if(result!==raw)node.nodeValue=result;
}
function translateElementTree(root=document.body){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let n;while(n=walker.nextNode())translateTextNode(n);
  document.documentElement.lang=appLang==='en'?'en':'tr';
  const placeholders={
    "Padişah, savaş, eser veya şehir ara...":"Search sultan, war, monument or city...",
    "Padişah ara: Fatih, Murad, Abdülhamid...":"Search: Fatih, Murad, Abdülhamid...",
    "Örnek: İstanbul, Nizam-ı Cedid, Mohaç, Abdülhamid...":"Example: Istanbul, Nizam-ı Cedid, Mohács, Abdülhamid...",
    "Terim ara...":"Search term...","Hedefini yaz...":"Write your objective...",
    "Bir konu yaz...":"Write a topic...","Sorunuzu yazın...":"Write your question...",
    "Padişah, paşa veya görevli seç...":"Choose a sultan, pasha, or official...",
    "Bir olay veya dönem yaz...":"Enter an event or era...",
    "Başlık yaz...":"Enter a title...","Haber metnini buraya yapıştır...":"Paste the news text here..."
  };
  const attrs=['placeholder','title','aria-label','alt'];
  root.querySelectorAll?.('input,textarea,button,[title],[aria-label],img').forEach(el=>{
    for(const attr of attrs){const value=el.getAttribute(attr);if(!value)continue;if(placeholders[value])el.setAttribute(attr,placeholders[value]);else if(I18N_EN[value])el.setAttribute(attr,I18N_EN[value]);}
    if(el.tagName==='INPUT' && el.type==='button' && I18N_EN[el.value])el.value=I18N_EN[el.value];
  });
  const count=document.querySelector('.intro-feature-count');if(count)count.textContent=appLang==='en'?'150+ FEATURES':'150+ ÖZELLİK';
  const tagline=document.querySelector('.intro-tagline');if(tagline)tagline.textContent=appLang==='en'?'AI • HISTORY • 3D GAME':'YAPAY ZEKÂ • TARİH • 3D OYUN';
  const juryLabel=document.querySelector('#juryOverlayLabel');if(juryLabel)juryLabel.textContent=appLang==='en'?'✨ MOST EXCITING FEATURES':'✨ EN İLGİ ÇEKİCİ ÖZELLİKLER';
}
$("#languageSelect").value=appLang;
$("#languageSelect").onchange=e=>{localStorage.setItem("oa_language",e.target.value);location.reload()};
if(appLang==="en"){
  const runTranslation=()=>translateElementTree(document.body);
  runTranslation();
  const observer=new MutationObserver(records=>records.forEach(r=>{
    if(r.type==='characterData')translateTextNode(r.target);
    r.addedNodes?.forEach(n=>{
      if(n.nodeType===Node.TEXT_NODE)translateTextNode(n);
      else if(n.nodeType===Node.ELEMENT_NODE)translateElementTree(n);
    });
  }));
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
}


// Extra game tabs
const originalGameTabHandler=btn=>{const map={conquest:"#gameConquest",guess:"#gameGuess",order:"#gameOrder",memory:"#gameMemory",speed:"#gameSpeed",city:"#gameCity"};Object.values(map).forEach(sel=>$(sel)?.classList.add("hidden"));$(map[btn.dataset.game])?.classList.remove("hidden")};
$$(".game-tab").forEach(btn=>btn.addEventListener("click",()=>originalGameTabHandler(btn)));

// Memory game
const memoryPairs=[
  ["Fatih Sultan Mehmed","İstanbul'un Fethi"],["Yavuz Sultan Selim","Mısır'ın Fethi"],["Kanuni Sultan Süleyman","Mohaç"],
  ["III. Selim","Nizam-ı Cedid"],["II. Mahmud","Yeniçeri Ocağı'nın Kaldırılması"],["II. Abdülhamid","Hicaz Demiryolu"]
];
let memoryOpen=[],memoryMatched=0;
function renderMemory(){memoryOpen=[];memoryMatched=0;const deck=memoryPairs.flatMap((p,i)=>p.map(text=>({id:i,text}))).sort(()=>Math.random()-.5);$("#memoryBoard").innerHTML=deck.map((c,i)=>`<button class="memory-card" data-pair="${c.id}" data-index="${i}" data-text="${c.text}">?</button>`).join("");$("#memoryScore").textContent="0 puan"}
$("#memoryBoard").onclick=e=>{const c=e.target.closest(".memory-card");if(!c||c.classList.contains("matched")||memoryOpen.includes(c))return;c.textContent=c.dataset.text;c.classList.add("flipped");memoryOpen.push(c);if(memoryOpen.length===2){setTimeout(()=>{const [a,b]=memoryOpen;if(a.dataset.pair===b.dataset.pair){a.classList.add("matched");b.classList.add("matched");memoryMatched++;$("#memoryScore").textContent=`${memoryMatched*20} puan`;if(memoryMatched===memoryPairs.length){infinity.games++;addXP(120,"game_master")}}else{a.textContent="?";b.textContent="?";a.classList.remove("flipped");b.classList.remove("flipped")}memoryOpen=[]},550)}};
$("#memoryReset").onclick=renderMemory;renderMemory();

// Speed game
const speedBank=[
  ["İstanbul'u kim fethetti?","Fatih Sultan Mehmed",["Fatih Sultan Mehmed","Yavuz Sultan Selim","Kanuni Sultan Süleyman","II. Murad"]],
  ["Nizam-ı Cedid kimin dönemindedir?","III. Selim",["III. Selim","II. Mahmud","I. Abdülhamid","Abdülmecid"]],
  ["Son Osmanlı padişahı kimdir?","VI. Mehmed Vahdeddin",["V. Mehmed Reşad","VI. Mehmed Vahdeddin","II. Abdülhamid","V. Murad"]],
  ["Bağdat Fatihi kimdir?","IV. Murad",["IV. Murad","III. Murad","Yavuz Sultan Selim","Kanuni Sultan Süleyman"]]
];
let speedTime=60,speedScore=0,speedTimerId=null,speedCurrent=null;
function nextSpeed(){speedCurrent=speedBank[Math.floor(Math.random()*speedBank.length)];$("#speedQuestion").textContent=speedCurrent[0];$("#speedOptions").innerHTML=speedCurrent[2].sort(()=>Math.random()-.5).map(o=>`<button class="game-option" data-speed="${o}">${o}</button>`).join("")}
$("#speedStart").onclick=()=>{speedTime=60;speedScore=0;$("#speedStart").disabled=true;nextSpeed();speedTimerId=setInterval(()=>{speedTime--;$("#speedTimer").textContent=`${speedTime} sn`;if(speedTime<=0){clearInterval(speedTimerId);$("#speedQuestion").textContent=`Süre bitti • ${speedScore} puan`;$("#speedOptions").innerHTML="";$("#speedStart").disabled=false;infinity.games++;addXP(speedScore)}},1000)};
$("#speedOptions").onclick=e=>{const b=e.target.closest("[data-speed]");if(!b)return;if(b.dataset.speed===speedCurrent[1]){speedScore+=10;$("#speedFeedback").textContent="Doğru!"}else $("#speedFeedback").textContent=`Yanlış • ${speedCurrent[1]}`;nextSpeed()};

// City game
const cityBank=[["İstanbul","Fatih Sultan Mehmed"],["Belgrad","Kanuni Sultan Süleyman"],["Bursa","Orhan Gazi"],["Bağdat","IV. Murad"],["Mısır","Yavuz Sultan Selim"],["Kıbrıs","II. Selim"]];
let cityCurrent,cityScore=0;
function renderCity(){cityCurrent=cityBank[Math.floor(Math.random()*cityBank.length)];const opts=[cityCurrent[1]];while(opts.length<4){const n=names[Math.floor(Math.random()*names.length)];if(!opts.includes(n))opts.push(n)}opts.sort(()=>Math.random()-.5);$("#cityQuestion").innerHTML=`<b>${cityCurrent[0]}</b> hangi padişah döneminde fethedildi veya Osmanlı yönetimine girdi?`;$("#cityOptions").innerHTML=opts.map(n=>`<button class="game-option" data-city="${n}">${n}</button>`).join("");$("#cityFeedback").textContent="";$("#cityNext").disabled=true}
$("#cityOptions").onclick=e=>{const b=e.target.closest("[data-city]");if(!b)return;const ok=b.dataset.city===cityCurrent[1];if(ok)cityScore+=20;$$("[data-city]").forEach(x=>{x.disabled=true;if(x.dataset.city===cityCurrent[1])x.classList.add("correct");else if(x===b)x.classList.add("wrong")});$("#cityFeedback").textContent=ok?"Doğru!":`Doğru cevap: ${cityCurrent[1]}`;$("#cityScore").textContent=`${cityScore} puan`;$("#cityNext").disabled=false};
$("#cityNext").onclick=renderCity;renderCity();

// Advisor
function advisorPlan(text){const t=text.toLocaleLowerCase("tr-TR");if(/istanbul|fetih/.test(t))return ["Boğaz kontrolünü sağla ve ikmal hatlarını kes.","Donanma ile kara ordusunu eşgüdümlü kullan.","Topçu hazırlığını ve sur keşfini tamamla.","Kuşatma boyunca lojistik ve moral düzenini koru.","Fetih sonrası şehir yönetimi ve imar planını önceden hazırla."];if(/donanma|deniz/.test(t))return ["Tersane kapasitesini artır.","Denizci ve kaptan eğitimini güçlendir.","İkmal gemileri ve liman ağını hazırla.","Kara ordusuyla ortak harekât planı oluştur.","Harita, keşif ve hava şartlarını hesaba kat."];if(/modern|yenilik|reform/.test(t))return ["Eğitim ve teknik okullarla başla.","Mali kaynakları sürdürülebilir hâle getir.","Reformları küçük pilot uygulamalarla dene.","Toplum ve devlet görevlilerine yeniliğin amacını anlat.","Kurumları düzenli olarak ölç ve geliştir."];return ["Hedefi açık ve ölçülebilir hâle getir.","Coğrafya, ikmal ve zaman şartlarını incele.","Keşif ve bilgi toplamaya öncelik ver.","Alternatif plan ve geri çekilme yolu hazırla.","Sonuçları değerlendirip bir sonraki adımı güncelle."]}
function runAdvisor(text){const q=text.trim();if(!q)return;const steps=advisorPlan(q);$("#advisorOutput").innerHTML=`<h3>${escapeHtml(q)}</h3><ol>${steps.map(s=>`<li>${s}</li>`).join("")}</ol><p class="muted">Bu öneriler tarihsel ve eğitimsel bir simülasyondur.</p>`}
$("#advisorRun").onclick=()=>runAdvisor($("#advisorInput").value);$$("[data-advisor]").forEach(b=>b.onclick=()=>{ $("#advisorInput").value=b.dataset.advisor;runAdvisor(b.dataset.advisor)});

// Chat XP hook
const oldSendChatQuestion=sendChatQuestion;sendChatQuestion=function(text){const q=text.trim();if(!q)return;oldSendChatQuestion(q);infinity.chats++;addXP(10,infinity.chats===1?"first_chat":null)};

renderCareer();renderAchievements();renderStats();



// Palace guide
const palaceRooms={
  divan:{name:"Divan-ı Hümayun",text:"Devletin önemli siyasî, idarî ve hukukî işlerinin görüşüldüğü yönetim merkezidir.",items:["Sadrazam toplantılara başkanlık ederdi.","Kazasker, defterdar ve nişancı gibi görevliler katılırdı.","Padişah bazı dönemlerde toplantıları kafesli bölümden izlerdi."]},
  enderun:{name:"Enderun Mektebi",text:"Saray içinde yüksek düzey devlet adamı ve yönetici yetiştiren eğitim kurumudur.",items:["Dil, tarih, sanat ve yönetim eğitimi verilirdi.","Yetenekli öğrenciler aşamalı biçimde ilerlerdi.","Osmanlı yönetici sınıfının önemli kaynaklarından biriydi."]},
  hazine:{name:"Hazine-i Hümayun",text:"Değerli eşyaların, devlet sembollerinin ve önemli emanetlerin korunduğu bölümdür.",items:["Tören eşyaları saklanırdı.","Değerli silahlar ve mücevherler bulunurdu.","Devletin ihtişamını temsil eden eserler korunurdu."]},
  hasoda:{name:"Has Oda",text:"Padişahın özel hizmetlerinin yürütüldüğü ve kutsal emanetlerin korunduğu önemli saray bölümüdür.",items:["Saray hiyerarşisinde çok özel bir konuma sahipti.","Seçilmiş görevliler hizmet ederdi.","Tören ve özel kabul düzeniyle bağlantılıydı."]},
  mutfak:{name:"Saray Mutfakları",text:"Saray halkı, görevliler ve büyük törenler için yemek hazırlanan geniş mutfak kompleksidir.",items:["Büyük kazanlar ve uzman aşçılar bulunurdu.","Helvahane tatlı ve ilaç yapımında kullanılırdı.","Osmanlı yemek kültürünün gelişmesinde etkiliydi."]}
};
function showPalaceRoom(id){const r=palaceRooms[id];$("#palaceInfo").innerHTML=`<span class="kicker">SARAY BÖLÜMÜ</span><h3>${r.name}</h3><p>${r.text}</p><ul>${r.items.map(x=>`<li>${x}</li>`).join("")}</ul><button class="secondary" onclick="speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance('${r.name}. ${r.text.replaceAll("'","")}'),{lang:'tr-TR'}))">▶ Dinle</button>`;$$(".palace-room").forEach(b=>b.classList.toggle("active",b.dataset.room===id))}
$$(".palace-room").forEach(b=>b.onclick=()=>showPalaceRoom(b.dataset.room));showPalaceRoom("divan");

// Ferman writer
let latestFerman="";
function createFerman(){const topic=$("#fermanTopic").value.trim();if(!topic)return toast("Önce bir konu yaz");const tone=$("#fermanTone").value;const lead=tone==="kutlama"?"Şenlik ve sevinç ile duyurula ki":tone==="duyuru"?"Cümle halka malum ola ki":"Hüküm odur ki";latestFerman=`☾\n\n${lead}, ${topic} hususunda nizam ve düzen üzere hareket edile. İlim, adalet ve ortak fayda gözetile; görev alanlar vazifelerini dikkat ve doğrulukla yerine getire. Bu hükmün gereği gecikmeksizin uygulana ve sonuçları kayıt altına alına.\n\nTarih: ${new Date().toLocaleDateString("tr-TR")}\nOsmanlı AI Eğitim Fermanı`;$("#fermanPaper").innerHTML=`<div class="tughra">☾</div><h2>FERMAN</h2><p>${lead}, <strong>${escapeHtml(topic)}</strong> hususunda nizam ve düzen üzere hareket edile.</p><p>İlim, adalet ve ortak fayda gözetile; görev alanlar vazifelerini dikkat ve doğrulukla yerine getire. Bu hükmün gereği gecikmeksizin uygulana ve sonuçları kayıt altına alına.</p><div class="signature">${new Date().toLocaleDateString("tr-TR")}<br>Osmanlı AI Eğitim Fermanı</div>`;addXP(15)}
$("#fermanCreate").onclick=createFerman;$("#fermanSpeak").onclick=()=>{if(!latestFerman)return toast("Önce ferman oluştur");const u=new SpeechSynthesisUtterance(latestFerman);u.lang="tr-TR";speechSynthesis.speak(u)};$("#fermanDownload").onclick=()=>{if(!latestFerman)return toast("Önce ferman oluştur");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([latestFerman],{type:"text/plain;charset=utf-8"}));a.download="Osmanli_AI_Ferman.txt";a.click();URL.revokeObjectURL(a.href)};

// Gallery
const galleryData={
  architecture:[["🏰","Rumeli Hisarı","Fatih Sultan Mehmed","İstanbul kuşatması öncesinde Boğaz kontrolü için yaptırıldı."],["🕌","Süleymaniye Camii","Kanuni Sultan Süleyman","Mimar Sinan'ın en önemli eserlerinden biri olan büyük külliye."],["🏛","Topkapı Sarayı","Fatih Sultan Mehmed","Yüzyıllar boyunca Osmanlı yönetiminin merkezi."],["🌉","Mostar Köprüsü","Kanuni dönemi","Mimar Hayreddin tarafından inşa edilen zarif köprü."],["🕌","Sultanahmet Camii","I. Ahmed","Altı minaresiyle tanınan klasik Osmanlı eseri."],["🚂","Hicaz Demiryolu","II. Abdülhamid","Hicaz bölgesine ulaşımı kolaylaştıran önemli ulaşım projesi."]],
  coins:[["🪙","Akçe","Erken Osmanlı","Gümüş esaslı temel para birimlerinden biri."],["🟤","Mangır","Günlük alışveriş","Bakırdan basılan küçük değerli para."],["🟡","Sultani Altın","Fatih dönemi","Osmanlı'nın önemli altın para birimi."],["⚪","Kuruş","Geç Osmanlı","Zamanla para sisteminde önemli bir hesap birimi oldu."]],
  documents:[["📜","Ferman","Padişah emri","Tuğra taşıyan yazılı hükümdar emri."],["✒","Tuğra","Hükümdar simgesi","Padişahın süslü imza ve hüküm işareti."],["📖","Kanunname","Hukuk düzeni","Devlet yönetimi ve toplum düzeniyle ilgili kurallar."],["🗺","Sefer Haritası","Askerî planlama","Yol, kale, su ve ikmal noktalarını gösteren haritalar."]]
};
function renderGallery(type="architecture"){$("#galleryGrid").innerHTML=galleryData[type].map(x=>`<article class="gallery-item"><div class="gallery-icon">${x[0]}</div><small>${x[2]}</small><h3>${x[1]}</h3><p>${x[3]}</p></article>`).join("")}
$$(".gallery-tab").forEach(b=>b.onclick=()=>{$$(".gallery-tab").forEach(x=>x.classList.toggle("active",x===b));renderGallery(b.dataset.gallery)});renderGallery();

// Story mode
const storyNodes={
  start:{title:"Sınırdaki Haber",text:"Genç bir akıncısın. Komutanın, sınırdaki bir kalenin çevresinde hareketlilik olduğunu söylüyor.",choices:[["Önce keşif yap","scout",15],["Doğrudan ilerle","rush",-5],["Köylülerden bilgi al","village",10]]},
  scout:{title:"Gece Keşfi",text:"Sessizce yaklaşıp nöbet noktalarını ve ikmal yolunu belirledin.",choices:[["Haritayı komutana götür","success",20],["Tek başına kaleye sız","danger",-10]]},
  rush:{title:"Hazırlıksız İlerleyiş",text:"Yolun çamurlu ve köprünün hasarlı olduğunu geç fark ettin.",choices:[["Geri dönüp plan yap","scout",5],["İlerlemeye devam et","danger",-15]]},
  village:{title:"Halkın Bilgisi",text:"Köylüler, kaleye giden gizli bir patikayı ve su kaynağını anlattı.",choices:[["Bilgiyi doğrulamak için keşif yap","scout",15],["Hemen patikayı kullan","success",10]]},
  danger:{title:"Zorlu Sonuç",text:"Hazırlıksız kararın birliği zor durumda bıraktı. Yine de geri çekilerek tecrübe kazandın.",choices:[["Yeni göreve başla","start",0]]},
  success:{title:"Görev Başarılı",text:"Bilgi, sabır ve planlama sayesinde görev tamamlandı. Komutanın seni takdir etti.",choices:[["Yeni göreve başla","start",0]]}
};
let storyNode="start",storyPoints=0;
function renderStory(){const n=storyNodes[storyNode];$("#storyTitle").textContent=n.title;$("#storyText").textContent=n.text;$("#storyPoints").textContent=`${storyPoints} itibar`;$("#storyChoices").innerHTML=n.choices.map((c,i)=>`<button class="story-choice" data-story-index="${i}">${c[0]}</button>`).join("")}
$("#storyChoices").onclick=e=>{const b=e.target.closest("[data-story-index]");if(!b)return;const c=storyNodes[storyNode].choices[Number(b.dataset.storyIndex)];storyPoints+=c[2];storyNode=c[1];if(c[1]==="success"){addXP(50);infinity.games++;saveInfinity()}renderStory()};$("#storyRestart").onclick=()=>{storyNode="start";storyPoints=0;renderStory()};renderStory();

// Daily challenge
const dailyQuestions=[
  ["İstanbul hangi yılda fethedildi?","1453",["1299","1453","1517","1922"]],
  ["Nizam-ı Cedid hangi padişah dönemindedir?","III. Selim",["II. Mahmud","III. Selim","I. Abdülhamid","Abdülmecid"]],
  ["Mohaç Savaşı hangi padişah dönemindedir?","Kanuni Sultan Süleyman",["Fatih Sultan Mehmed","Yavuz Sultan Selim","Kanuni Sultan Süleyman","II. Selim"]],
  ["Osmanlı Beyliği'nin kurucusu kimdir?","Osman Gazi",["Ertuğrul Gazi","Osman Gazi","Orhan Gazi","I. Murad"]],
  ["Hicaz Demiryolu hangi padişah dönemindedir?","II. Abdülhamid",["Abdülaziz","II. Abdülhamid","V. Mehmed Reşad","Abdülmecid"]]
];
const todayKey=new Date().toISOString().slice(0,10),dailyIndex=Math.floor(new Date().setHours(0,0,0,0)/86400000)%dailyQuestions.length,dailyQ=dailyQuestions[dailyIndex];$("#dailyDate").textContent=new Date().toLocaleDateString("tr-TR",{dateStyle:"full"});$("#dailyQuestion").textContent=dailyQ[0];$("#dailyOptions").innerHTML=dailyQ[2].map(o=>`<button class="game-option" data-daily="${o}">${o}</button>`).join("");const dailyDone=localStorage.getItem("oa_daily")==todayKey;if(dailyDone){$("#dailyStatus").textContent="Bugünün görevini tamamladın. Yarın yeni görev gelecek.";$$("[data-daily]").forEach(x=>x.disabled=true)}
$("#dailyOptions").onclick=e=>{const b=e.target.closest("[data-daily]");if(!b||localStorage.getItem("oa_daily")==todayKey)return;const ok=b.dataset.daily===dailyQ[1];$$("[data-daily]").forEach(x=>{x.disabled=true;if(x.dataset.daily===dailyQ[1])x.classList.add("correct");else if(x===b)x.classList.add("wrong")});$("#dailyFeedback").textContent=ok?"Doğru! +25 XP":`Doğru cevap: ${dailyQ[1]}`;if(ok)addXP(25);localStorage.setItem("oa_daily",todayKey);$("#dailyStatus").textContent="Görev tamamlandı."};



// Günün tarih bilgisi ve sistem kontrolü
const historyFacts=[
  ["İstanbul'un Fethi","Fatih Sultan Mehmed, İstanbul'u fethettiğinde 21 yaşındaydı."],
  ["Uzun Saltanat","Kanuni Sultan Süleyman yaklaşık 46 yıl tahtta kaldı."],
  ["İkinci Kurucu","I. Mehmed, Fetret Devri'ni sona erdirdiği için ikinci kurucu olarak anılır."],
  ["Modernleşme","III. Selim, Nizam-ı Cedid reformları ve sürekli elçiliklerle yenilik hareketini hızlandırdı."],
  ["Ulaşım Projesi","II. Abdülhamid dönemindeki Hicaz Demiryolu, dönemin en önemli ulaşım projelerindendir."],
  ["Rumeli'ye Geçiş","Orhan Gazi döneminde Çimpe Kalesi'nin alınması, Rumeli'ye kalıcı geçişte önemli bir adımdı."],
  ["Bağdat Fatihi","IV. Murad, Bağdat'ı Safevîlerden geri aldığı için Bağdat Fatihi olarak anılır."]
];
const factIndex=Math.floor(Date.now()/86400000)%historyFacts.length;
$("#dailyHistoryTitle").textContent=historyFacts[factIndex][0];
$("#dailyHistoryFact").textContent=historyFacts[factIndex][1];
function runSystemCheck(){
  const required=["dashboard","recognition","encyclopedia","timeline","chat","games","museum","ferman","story"];
  const missing=required.filter(id=>!document.getElementById(id));
  const text=$("#systemCheckText");
  if(text)text.textContent=missing.length?`${missing.length} bölüm kontrol istiyor`:`${required.length} ana bölüm hazır`;
}
runSystemCheck();

// En İlgi Çekici Özellikler: otomatik, adım adım tanıtım turu
const jurySteps=[
 {page:"dashboard",title:"3D Fetih Görevi",titleEn:"3D Conquest Mission",text:"Kale içinde karakteri yönet, muhafızlardan kaçın ve 5 sancağı topla.",textEn:"Control your character inside the fortress, avoid the guards, and collect all 5 banners."},
 {page:"recognition",title:"36 Padişahı Yapay Zekâyla Tanıma",titleEn:"AI Recognition of 36 Sultans",text:"Fotoğraf yükle veya kamerayı kullan; padişah tahminini, güven yüzdesini ve alternatif tahminleri gör.",textEn:"Upload a photo or use the camera to see the predicted sultan, confidence score, and alternative predictions."},
 {page:"chat",title:"Padişahlarla ve Paşalarla Konuşma",titleEn:"Talk with Sultans and Pashas",text:"Fatih Sultan Mehmed, Sokollu Mehmed Paşa ve diğer tarihî kişilerle sohbet et; desteklenen yerlerde sesli cevapları dinle.",textEn:"Chat with historical figures such as Mehmed II and Sokollu Mehmed Pasha, and listen to spoken replies where supported."},
 {page:"conquestsim",title:"İstanbul'un Fethi Simülasyonu",titleEn:"Conquest of Constantinople Simulation",text:"Rumeli Hisarı'ndan son hücuma uzanan beş aşamalı fetih senaryosunu yönet.",textEn:"Manage a five-stage conquest scenario, from Rumeli Fortress to the final assault."},
 {page:"imperialdivan",title:"Divan-ı Hümayun",titleEn:"Imperial Council",text:"Devlet kararları ver, hazineyi ve orduyu yönet, halkın durumunu takip et.",textEn:"Make state decisions, manage the treasury and army, and monitor the people's well-being."},
 {page:"timeline",title:"Infinity Timeline",titleEn:"Infinity Timeline",text:"1299–1922 arasında yıl seçerek padişahları, tarihî olayları ve dönemleri keşfet.",textEn:"Choose a year between 1299 and 1922 to explore sultans, historical events, and eras."},
 {page:"detective",title:"Tarih Dedektifi",titleEn:"History Detective",text:"Vakaları araştır, şüphelileri sorgula, kanıtları birleştir ve suçluyu bulmaya çalış.",textEn:"Investigate cases, question suspects, connect clues, and try to identify the culprit."},
 {page:"museum3d",title:"Sanal Topkapı Sarayı ve Silah Müzesi",titleEn:"Virtual Topkapi Palace and Weapons Museum",text:"Sarayda serbestçe gezin ve tarihî silahları keşfet.",textEn:"Explore the palace freely and discover historical weapons."},
 {page:"cinematicai",title:"Yapay Zekâ Sinematik Modu",titleEn:"AI Cinematic Mode",text:"Tarihî olayları 3–7 sahnelik anlatılara dönüştür ve sesli anlatımla izle.",textEn:"Turn historical events into stories of 3–7 scenes and experience them with narration."},
 {page:"ottomanimage",title:"Osmanlı Resim AI",titleEn:"Ottoman Image AI",text:"Osmanlı tarihiyle ilgili yazılı komutlardan yeni görseller üret. İnternet ve API anahtarı gerekebilir.",textEn:"Generate images from text prompts about Ottoman history. An internet connection and API key may be required."}
];
let juryTimer=null,juryIndex=0,juryRunning=false;
function showJuryStep(){
  const step=jurySteps[juryIndex];
  if(document.getElementById(step.page))page(step.page);else page("dashboard");
  const card=$(".jury-demo-card");
  if(card){card.classList.remove("tour-fade");void card.offsetWidth;card.classList.add("tour-fade");}
  $("#juryDemoTitle").textContent=appLang==="en"?step.titleEn:step.title;
  $("#juryDemoText").textContent=appLang==="en"?step.textEn:step.text;
  $("#juryDemoCounter").textContent=appLang==="en"?`FEATURE ${juryIndex+1} OF ${jurySteps.length}`:`ÖZELLİK ${juryIndex+1} / ${jurySteps.length}`;
  $("#juryDemoFill").style.width=`${((juryIndex+1)/jurySteps.length)*100}%`;
}
function stopJuryMode(){juryRunning=false;clearInterval(juryTimer);$("#juryOverlay").classList.add("hidden");}
function startJuryMode(){
  stopJuryMode();juryRunning=true;juryIndex=0;$("#juryOverlay").classList.remove("hidden");showJuryStep();
  juryTimer=setInterval(()=>{juryIndex++;if(juryIndex>=jurySteps.length){stopJuryMode();page("dashboard");toast(appLang==="en"?"Feature tour complete":"Özellik turu tamamlandı");return}showJuryStep();},5200);
}
$("#juryModeButton").onclick=startJuryMode;
$("#stopJuryMode").onclick=stopJuryMode;

// Mevcut oyun sekmelerine yeni oyunları bağla
function openSelectedGame(game){
  const map={conquest:"#gameConquest",guess:"#gameGuess",order:"#gameOrder",memory:"#gameMemory",speed:"#gameSpeed",city:"#gameCity",throne:"#gameThrone",treasure:"#gameTreasure"};
  Object.values(map).forEach(selector=>document.querySelector(selector)?.classList.add("hidden"));
  document.querySelector(map[game])?.classList.remove("hidden");
}
$$(".game-tab").forEach(tab=>tab.addEventListener("click",()=>openSelectedGame(tab.dataset.game)));

// Oyun 7: Tahtı Koru
const throneEvents=[
  {title:"Hazine Açığı",text:"Uzun süren seferler nedeniyle devlet hazinesinde açık oluştu. Divan senden çözüm bekliyor.",choices:[
    ["Vergileri aniden çok yükselt",{treasury:25,people:-25,army:0},"Hazine rahatladı ancak halkın memnuniyeti ciddi biçimde azaldı."],
    ["Saray harcamalarını azalt ve ticareti destekle",{treasury:18,people:8,army:-3},"Dengeli karar: gelir arttı, halk desteği korundu."],
    ["Sorunu görmezden gel",{treasury:-20,people:-5,army:-5},"Sorun büyüdü ve devlet dengesi zayıfladı."]]},
  {title:"Sınır Tehdidi",text:"Sınırdaki kalelerden düşman hareketliliği haberi geldi.",choices:[
    ["Keşif birlikleri ve ikmal gönder",{treasury:-8,people:2,army:20},"Hazırlıklı savunma ordunun gücünü artırdı."],
    ["Bütün orduyu plansızca sefere çıkar",{treasury:-22,people:-8,army:5},"Hazırlıksız sefer kaynakları zorladı."],
    ["Kaleleri tamamen boşalt",{treasury:4,people:-20,army:-25},"Sınır güvenliği ciddi biçimde zayıfladı."]]},
  {title:"Kuraklık ve Kıtlık",text:"Bazı bölgelerde ürün azaldı ve halk yardım bekliyor.",choices:[
    ["Devlet ambarlarını aç",{treasury:-15,people:25,army:0},"Halk desteği arttı; hazine kontrollü biçimde kullanıldı."],
    ["Tüccarlarla fiyat anlaşması yap",{treasury:-6,people:14,army:0},"Piyasa dengelendi ve ihtiyaçlar kısmen karşılandı."],
    ["Yardımı reddet",{treasury:8,people:-30,army:-5},"Hazine korundu ancak toplumsal huzur bozuldu."]]},
  {title:"Yeni Teknoloji",text:"Mühendisler daha güçlü top ve gemiler için destek istiyor.",choices:[
    ["Mühendislik okuluna yatırım yap",{treasury:-14,people:5,army:22},"Uzun vadeli askerî ve bilimsel güç kazandın."],
    ["Yalnızca eski yöntemleri kullan",{treasury:3,people:-2,army:-12},"Teknolojik gerilik orduyu zayıflattı."],
    ["Bütün hazineyi tek projeye yatır",{treasury:-30,people:-10,army:15},"Ordu gelişti fakat mali denge bozuldu."]]}
];
let throneState={treasury:55,army:55,people:55,index:0,answered:false};
function clamp(v){return Math.max(0,Math.min(100,v))}
function throneReputation(){return Math.round((throneState.treasury+throneState.army+throneState.people)/3)}
function renderThrone(){
  const ev=throneEvents[throneState.index];
  throneState.answered=false;
  $("#throneTreasury").style.width=`${throneState.treasury}%`;
  $("#throneArmy").style.width=`${throneState.army}%`;
  $("#thronePeople").style.width=`${throneState.people}%`;
  $("#throneScore").textContent=`İtibar: ${throneReputation()}`;
  $("#throneEvent").innerHTML=`<h4>${ev.title}</h4><p>${ev.text}</p>`;
  $("#throneOptions").innerHTML=ev.choices.map((c,i)=>`<button class="game-option" data-throne="${i}">${c[0]}</button>`).join("");
  $("#throneFeedback").textContent="";$("#throneNext").disabled=true;
}
$("#throneOptions").onclick=e=>{
  const b=e.target.closest("[data-throne]");if(!b||throneState.answered)return;
  throneState.answered=true;const choice=throneEvents[throneState.index].choices[Number(b.dataset.throne)],d=choice[1];
  throneState.treasury=clamp(throneState.treasury+d.treasury);throneState.army=clamp(throneState.army+d.army);throneState.people=clamp(throneState.people+d.people);
  $$("[data-throne]").forEach(x=>x.disabled=true);
  b.classList.add(throneReputation()>=50?"correct":"wrong");
  $("#throneFeedback").textContent=choice[2];
  $("#throneTreasury").style.width=`${throneState.treasury}%`;$("#throneArmy").style.width=`${throneState.army}%`;$("#thronePeople").style.width=`${throneState.people}%`;
  $("#throneScore").textContent=`İtibar: ${throneReputation()}`;$("#throneNext").disabled=false;
};
$("#throneNext").onclick=()=>{
  throneState.index=(throneState.index+1)%throneEvents.length;
  if(throneState.index===0){if(typeof infinity!=="undefined"){infinity.games++;addXP(Math.max(20,throneReputation()))}toast(`Tahtı Koru turu tamamlandı: ${throneReputation()} itibar`)}
  renderThrone();
};
renderThrone();

// Oyun 8: Osmanlı Hazine Avı
const treasureRounds=[
  {place:"İstanbul",title:"Fetih Sandığı",hint:"1453 yılında fethedilen ve imparatorluğun başkenti olan şehirdeyim."},
  {place:"Bursa",title:"Kuruluş Hazinesi",hint:"Orhan Gazi döneminde fethedilen ve Osmanlı'nın ilk büyük başkenti olan şehirdeyim."},
  {place:"Edirne",title:"Rumeli Sandığı",hint:"İstanbul'dan önce başkent olan, Rumeli'deki önemli merkezdeyim."},
  {place:"Trabzon",title:"Karadeniz Hazinesi",hint:"1461 yılında Fatih tarafından alınan Karadeniz şehrindeyim."},
  {place:"Kahire",title:"Mısır Altınları",hint:"Yavuz Sultan Selim'in 1517 seferinden sonra Osmanlı yönetimine giren merkezdeyim."},
  {place:"Bağdat",title:"Doğu Hazinesi",hint:"Kanuni ve IV. Murad dönemlerinin önemli seferleriyle bilinen şehirdeyim."}
];
let treasureState={index:0,gold:0,answered:false};
function renderTreasure(){
  const r=treasureRounds[treasureState.index];treasureState.answered=false;
  $("#treasureTitle").textContent=r.title;$("#treasureHint").textContent=r.hint;$("#treasureFeedback").textContent="Haritada doğru şehri seç.";
  $("#treasureNext").disabled=true;$("#treasureScore").textContent=`${treasureState.gold} altın`;
  $$(".treasure-place").forEach(x=>{x.disabled=false;x.classList.remove("correct","wrong")});
}
$$(".treasure-place").forEach(place=>place.onclick=()=>{
  if(treasureState.answered)return;treasureState.answered=true;
  const answer=treasureRounds[treasureState.index].place,ok=place.dataset.place===answer;
  if(ok){treasureState.gold+=100;place.classList.add("correct");$("#treasureFeedback").textContent="Hazine bulundu! +100 altın ✨"}
  else{place.classList.add("wrong");document.querySelector(`.treasure-place[data-place="${answer}"]`)?.classList.add("correct");$("#treasureFeedback").textContent=`Sandık ${answer} şehrindeydi.`}
  $$(".treasure-place").forEach(x=>x.disabled=true);$("#treasureScore").textContent=`${treasureState.gold} altın`;$("#treasureNext").disabled=false;
});
$("#treasureNext").onclick=()=>{
  treasureState.index=(treasureState.index+1)%treasureRounds.length;
  if(treasureState.index===0){if(typeof infinity!=="undefined"){infinity.games++;addXP(Math.max(25,Math.round(treasureState.gold/10)))}toast(`Hazine avı tamamlandı: ${treasureState.gold} altın`);treasureState.gold=0}
  renderTreasure();
};
renderTreasure();



// Sesli Padişah
names.forEach(n=>$("#voiceSultanSelect").insertAdjacentHTML("beforeend",`<option>${n}</option>`));
$("#voiceSultanSelect").value="Fatih Sultan Mehmed";
function updateVoiceText(){
  const n=$("#voiceSultanSelect").value,p=profiles[n],mode=$("#voiceMode").value;
  $("#voiceSultanName").textContent=n;
  $("#voiceText").textContent=mode==="military"?p.military:mode==="legacy"?p.legacy:p.summary;
}
$("#voiceSultanSelect").onchange=updateVoiceText;$("#voiceMode").onchange=updateVoiceText;updateVoiceText();
$("#voicePlay").onclick=()=>{speechSynthesis.cancel();const n=$("#voiceSultanSelect").value,p=profiles[n],mode=$("#voiceMode").value,text=mode==="military"?p.military:mode==="legacy"?p.legacy:p.summary;const u=new SpeechSynthesisUtterance(`${n}. ${text}`);u.lang=appLang==="en"?"en-US":"tr-TR";u.rate=Number($("#voiceRate").value);u.onstart=()=>$(".voice-wave").classList.add("playing");u.onend=()=>$(".voice-wave").classList.remove("playing");speechSynthesis.speak(u);if(typeof addXP==="function")addXP(5)};
$("#voicePause").onclick=()=>{if(speechSynthesis.paused)speechSynthesis.resume();else speechSynthesis.pause()};
$("#voiceStop").onclick=()=>{speechSynthesis.cancel();$(".voice-wave").classList.remove("playing")};

// AI Öğretmen (yerel tarih veritabanı)
function findRelevantProfiles(q){const t=q.toLocaleLowerCase("tr-TR");return names.filter(n=>{const p=profiles[n];return `${n} ${p.summary} ${p.military} ${p.legacy} ${p.era}`.toLocaleLowerCase("tr-TR").includes(t)}).slice(0,4)}
function teacherExplain(q,level){
  const t=q.toLocaleLowerCase("tr-TR"),matches=findRelevantProfiles(q);
  let base="";
  if(/neden yüksel|yükseliş neden/.test(t))base="Osmanlı'nın yükselmesinde güçlü yönetim, düzenli ordu, uygun coğrafi konum, hoşgörülü iskân politikaları, başarılı diplomasi ve fethedilen bölgelerde düzen kurulması etkili oldu.";
  else if(/istanbul/.test(t))base="İstanbul'un fethi 1453 yılında Fatih Sultan Mehmed döneminde gerçekleşti. Rumeli Hisarı, güçlü toplar, donanma ve gemilerin karadan yürütülmesi kuşatmanın önemli hazırlıklarıydı.";
  else if(/nizam-ı cedid|nizamı cedid/.test(t))base="Nizam-ı Cedid, III. Selim döneminde orduyu ve devlet düzenini yenilemek için başlatılan reform hareketidir. Yeni bir ordu, reform hazinesi ve sürekli elçilikler bu programın parçalarıydı.";
  else if(matches.length)base=matches.map(n=>`${n}: ${profiles[n].summary}`).join(" ");
  else base="Bu soru için uygulamadaki bilgilerden kesin bir eşleşme bulunamadı. Padişah adı, savaş, dönem veya reform belirterek daha özel bir soru sor.";
  if(level==="simple")return base.split(". ").slice(0,3).join(". ")+".";
  if(level==="advanced")return `${base} Bu konuyu değerlendirirken askerî, ekonomik, idarî ve kültürel sonuçları birlikte düşünmek gerekir.`;
  return base;
}
function runTeacher(){
  const q=$("#teacherQuestion").value.trim();if(!q)return toast("Bir soru yaz");
  const task=$("#teacherTask").value,level=$("#teacherLevel").value;
  if(task==="explain")$("#teacherOutput").innerHTML=`<h3>Açıklama</h3><p>${teacherExplain(q,level)}</p>`;
  else if(task==="summary"){const text=teacherExplain(q,level);$("#teacherOutput").innerHTML=`<h3>Kısa Özet</h3><ul>${text.split(". ").filter(Boolean).slice(0,5).map(x=>`<li>${x.replace(/\.$/,"")}.</li>`).join("")}</ul>`}
  else if(task==="quiz"){const match=findRelevantProfiles(q)[0]||"Fatih Sultan Mehmed",p=profiles[match];$("#teacherOutput").innerHTML=`<h3>Mini Test</h3><ol><li>${match} hangi dönemde hüküm sürmüştür?</li><li>Saltanat yılları nedir?</li><li>En önemli askerî faaliyetlerinden biri nedir?</li></ol><details><summary>Cevapları göster</summary><p>${p.era}; ${p.reign}; ${p.military}</p></details>`}
  else {const found=names.filter(n=>q.toLocaleLowerCase("tr-TR").includes(n.toLocaleLowerCase("tr-TR"))).slice(0,2);const pair=found.length===2?found:["Fatih Sultan Mehmed","Kanuni Sultan Süleyman"],a=profiles[pair[0]],b=profiles[pair[1]];$("#teacherOutput").innerHTML=`<h3>${pair[0]} ve ${pair[1]}</h3><table class="compare-table"><tr><th>Özellik</th><th>${pair[0]}</th><th>${pair[1]}</th></tr><tr><td>Dönem</td><td>${a.era}</td><td>${b.era}</td></tr><tr><td>Saltanat</td><td>${a.reign}</td><td>${b.reign}</td></tr><tr><td>Özet</td><td>${a.summary}</td><td>${b.summary}</td></tr></table>`}
  if(typeof addXP==="function")addXP(10);
}
$("#teacherAsk").onclick=runTeacher;$("#teacherQuestion").onkeydown=e=>{if(e.key==="Enter")runTeacher()};$$("[data-teacher-q]").forEach(b=>b.onclick=()=>{$("#teacherQuestion").value=b.dataset.teacherQ;runTeacher()});

// Animasyonlu fetih haritası
const mapEvents=[
  {year:1299,text:"Osman Gazi döneminde Osmanlı Beyliği'nin kuruluş süreci."},
  {year:1326,text:"Orhan Gazi döneminde Bursa fethedildi ve başkent oldu."},
  {year:1362,text:"I. Murad döneminde Edirne alındı."},
  {year:1453,text:"Fatih Sultan Mehmed İstanbul'u fethetti."},
  {year:1461,text:"Trabzon, Fatih Sultan Mehmed tarafından alındı."},
  {year:1517,text:"Yavuz Sultan Selim döneminde Mısır Osmanlı yönetimine girdi."},
  {year:1521,text:"Kanuni döneminde Belgrad fethedildi."},
  {year:1522,text:"Rodos fethedildi."},
  {year:1534,text:"Bağdat Kanuni döneminde Osmanlı yönetimine girdi."},
  {year:1922,text:"Saltanat kaldırıldı ve Osmanlı padişahlığı sona erdi."}
];
let mapTimer=null;
function updateMap(year){
  $("#mapYearLabel").textContent=year;
  $$(".map-city").forEach(c=>c.classList.toggle("active",Number(c.dataset.year)<=year));
  const event=[...mapEvents].reverse().find(e=>e.year<=year)||mapEvents[0];
  $("#mapEvent").innerHTML=`<b>${event.year}</b> — ${event.text}`;
  const progress=(year-1299)/(1922-1299);
  const size=40+progress*480;$("#empireGlow").style.width=`${size}px`;$("#empireGlow").style.height=`${size}px`;
}
$("#mapYear").oninput=e=>updateMap(Number(e.target.value));$("#mapPlay").onclick=()=>{clearInterval(mapTimer);let y=Number($("#mapYear").value);mapTimer=setInterval(()=>{y+=4;if(y>1922){clearInterval(mapTimer);return}$("#mapYear").value=y;updateMap(y)},80)};$("#mapReset").onclick=()=>{clearInterval(mapTimer);$("#mapYear").value=1299;updateMap(1299)};updateMap(1299);

// Osmanlı TV
const radioStations=[{name:"Fetih1453 FM",freq:"90.3",icon:"🏰",program:"İstanbul'un Fethi",text:"1453 yılında Fatih Sultan Mehmed, İstanbul'un fethi için uzun bir hazırlık yaptı. Rumeli Hisarı inşa edildi, büyük toplar döküldü ve donanma güçlendirildi. Kuşatma 29 Mayıs 1453'te zaferle sonuçlandı."},{name:"Yavuz FM",freq:"91.8",icon:"⚔️",program:"Doğu Seferleri",text:"Yavuz Sultan Selim'in kısa saltanatı, Çaldıran, Mercidabık ve Ridaniye zaferleriyle Osmanlı Devleti'nin doğu ve güney yönünde büyük ölçüde genişlediği bir dönem oldu."},{name:"Kanuni FM",freq:"93.4",icon:"⚖️",program:"Kanuni'nin Çağı",text:"Kanuni Sultan Süleyman döneminde Belgrad, Rodos ve Mohaç gibi önemli başarılar elde edildi. Hukuk, mimari ve sanat alanlarında da büyük gelişmeler yaşandı."},{name:"Nizam-ı Cedid FM",freq:"95.7",icon:"📚",program:"III. Selim ve Yenilik",text:"III. Selim dönemindeki Nizam-ı Cedid hareketi, yeni bir ordu, reform hazinesi ve sürekli elçiliklerle Osmanlı modernleşmesinin önemli adımlarından biri oldu."},{name:"Hicaz Demiryolu FM",freq:"97.1",icon:"🚂",program:"Rayların Hicaz'a Yolculuğu",text:"II. Abdülhamid döneminde yapılan Hicaz Demiryolu, ulaşım ve haberleşmeyi kolaylaştıran, bağışlarla desteklenen büyük bir mühendislik projesiydi."},{name:"Preveze FM",freq:"98.6",icon:"⛵",program:"Akdeniz'de Zafer",text:"1538 Preveze Deniz Zaferi'nde Barbaros Hayreddin Paşa komutasındaki Osmanlı donanması, Akdeniz'deki üstünlüğünü güçlendirdi."},{name:"Mimar Sinan FM",freq:"99.5",icon:"🕌",program:"Taşa Yazılan Miras",text:"Mimar Sinan, Şehzade, Süleymaniye ve Selimiye camileri başta olmak üzere çok sayıda eserle klasik Osmanlı mimarisinin zirvesini temsil etti."}];let radioIndex=0,radioSpeaking=false;function renderRadio(){const s=radioStations[radioIndex];$("#radioStationName").textContent=s.name;$("#radioProgramTitle").textContent=s.program;$("#radioEpisodeTitle").textContent=s.program;$("#radioEpisodeText").textContent=s.text;const pos=((Number(s.freq)-88)/12)*100;$("#radioNeedle").style.left=`${Math.max(2,Math.min(98,pos))}%`;$("#radioStationGrid").innerHTML=radioStations.map((x,i)=>`<button class="radio-station-card ${i===radioIndex?"active":""}" data-radio="${i}"><div class="fm">${x.icon}</div><h3>${x.name}</h3><p>${x.program}</p><small>${x.freq} MHz</small></button>`).join("");$("#radioProgressFill").style.width="0%"}function stopRadioNarration(){speechSynthesis.cancel();radioSpeaking=false;$("#radioWave").classList.remove("playing");$("#radioPlay").textContent="▶"}function speakRadio(){stopRadioNarration();if(!$("#narrationEnabled").checked)return toast("Sesli anlatım ayarlardan kapalı");const s=radioStations[radioIndex],u=new SpeechSynthesisUtterance(`${s.name}. ${s.program}. ${s.text}`);u.lang=appLang==="en"?"en-US":"tr-TR";u.rate=.92;u.onstart=()=>{radioSpeaking=true;$("#radioWave").classList.add("playing");$("#radioPlay").textContent="⏸";$("#radioProgressFill").style.width="35%"};u.onend=()=>{radioSpeaking=false;$("#radioWave").classList.remove("playing");$("#radioPlay").textContent="▶";$("#radioProgressFill").style.width="100%"};speechSynthesis.speak(u)}$("#radioStationGrid").onclick=e=>{const b=e.target.closest("[data-radio]");if(!b)return;stopRadioNarration();radioIndex=Number(b.dataset.radio);renderRadio();speakRadio()};$("#radioPrevious").onclick=()=>{stopRadioNarration();radioIndex=(radioIndex-1+radioStations.length)%radioStations.length;renderRadio()};$("#radioNext").onclick=()=>{stopRadioNarration();radioIndex=(radioIndex+1)%radioStations.length;renderRadio()};$("#radioPlay").onclick=()=>{if(radioSpeaking){if(speechSynthesis.paused){speechSynthesis.resume();$("#radioPlay").textContent="⏸"}else{speechSynthesis.pause();$("#radioPlay").textContent="▶"}}else speakRadio()};$("#radioSpeak").onclick=speakRadio;$("#radioStopSpeech").onclick=stopRadioNarration;renderRadio();

const museum3dState={scene:null,camera:null,renderer:null,controls:null,clock:null,keys:{w:false,a:false,s:false,d:false},velocity:null,direction:null,interactables:[],activeItem:null,initialized:false};
function makeLabelSprite(text){const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');x.fillStyle='rgba(8,14,24,.82)';x.fillRect(0,0,512,128);x.strokeStyle='#e9c46a';x.lineWidth=4;x.strokeRect(4,4,504,120);x.fillStyle='#fff';x.font='bold 34px Georgia';x.textAlign='center';x.textBaseline='middle';x.fillText(text,256,64);const t=new THREE.CanvasTexture(c),m=new THREE.SpriteMaterial({map:t,transparent:true}),s=new THREE.Sprite(m);s.scale.set(3.8,.95,1);return s}
function addArtifact(scene,info,pos,type='box'){let g;if(type==='cannon')g=new THREE.CylinderGeometry(.35,.5,2.8,24);else if(type==='coin')g=new THREE.CylinderGeometry(.85,.85,.18,48);else if(type==='column')g=new THREE.CylinderGeometry(.35,.5,2.6,20);else g=new THREE.BoxGeometry(1.4,1.8,1.2);const m=new THREE.MeshStandardMaterial({color:info.color||0xb48a45,metalness:(type==='coin'||type==='cannon')?.6:.2,roughness:.45}),mesh=new THREE.Mesh(g,m);mesh.position.copy(pos);if(type==='cannon')mesh.rotation.z=Math.PI/2;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.info=info;scene.add(mesh);const ped=new THREE.Mesh(new THREE.BoxGeometry(2.1,.5,2.1),new THREE.MeshStandardMaterial({color:0x30394a,roughness:.8}));ped.position.set(pos.x,.25,pos.z);ped.receiveShadow=true;scene.add(ped);if(type!=='column')mesh.position.y=1.4;const label=makeLabelSprite(info.title);label.position.set(pos.x,3.15,pos.z);scene.add(label);museum3dState.interactables.push(mesh)}
function initReal3DMuseum(){if(museum3dState.initialized)return;const container=document.querySelector('#real3dContainer');if(!window.THREE){document.querySelector('#museum3dStatus').textContent='Three.js yüklenemedi';return}const scene=new THREE.Scene();scene.background=new THREE.Color(0x07101b);scene.fog=new THREE.Fog(0x07101b,18,45);const camera=new THREE.PerspectiveCamera(70,container.clientWidth/container.clientHeight,.1,100);camera.position.set(0,1.7,10);const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setSize(container.clientWidth,container.clientHeight);renderer.shadowMap.enabled=true;container.prepend(renderer.domElement);const controls=new THREE.PointerLockControls(camera,renderer.domElement);scene.add(controls.getObject());scene.add(new THREE.HemisphereLight(0xbfdfff,0x24170d,1.3));const sun=new THREE.DirectionalLight(0xffe6a8,2.2);sun.position.set(5,10,3);sun.castShadow=true;scene.add(sun);const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:0x2b2a28,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);const wallMat=new THREE.MeshStandardMaterial({color:0x5b4738,roughness:.8});[[0,3,-15,30,6,.5],[0,3,15,30,6,.5],[-15,3,0,.5,6,30],[15,3,0,.5,6,30],[0,3,0,.5,6,18],[-7.5,3,0,15,6,.5],[7.5,3,0,15,6,.5]].forEach(v=>{const [x,y,z,w,h,d]=v,o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wallMat);o.position.set(x,y,z);o.receiveShadow=true;o.castShadow=true;scene.add(o)});for(let x=-12;x<=12;x+=6){const b=new THREE.Mesh(new THREE.BoxGeometry(.35,.35,28),new THREE.MeshStandardMaterial({color:0x3a2416}));b.position.set(x,5.7,0);scene.add(b)}[[-7,4.7,-7],[7,4.7,-7],[-7,4.7,7],[7,4.7,7]].forEach(v=>{const l=new THREE.PointLight(0xffd27a,28,12,2);l.position.set(...v);l.castShadow=true;scene.add(l)});addArtifact(scene,{title:'Şahi Topu',text:'İstanbul’un fethindeki büyük kuşatma toplarını temsil eden 3D model.',color:0x474747},new THREE.Vector3(-7,1.4,-7),'cannon');addArtifact(scene,{title:'Fatih’in Miğferi',text:'Fatih Sultan Mehmed döneminin askerî gücünü temsil eden sembolik miğfer.',color:0xc9a34a},new THREE.Vector3(-7,1.4,7));addArtifact(scene,{title:'Sultani Altın',text:'Fatih döneminde basılan önemli Osmanlı altın parasını temsil eder.',color:0xffc928},new THREE.Vector3(7,1.4,-7),'coin');addArtifact(scene,{title:'Mimar Sinan Sütunu',text:'Klasik Osmanlı mimarisini temsil eden 3D sütun.',color:0xc8b08a},new THREE.Vector3(7,1.4,7),'column');const flag=new THREE.Mesh(new THREE.PlaneGeometry(4.5,2.7),new THREE.MeshStandardMaterial({color:0x8b0e18,side:THREE.DoubleSide}));flag.position.set(0,3.2,-14.65);scene.add(flag);const label=makeLabelSprite('☾  OSMANLI MÜZESİ');label.position.set(0,3.2,-14.2);label.scale.set(4.5,1.1,1);scene.add(label);museum3dState.scene=scene;museum3dState.camera=camera;museum3dState.renderer=renderer;museum3dState.controls=controls;museum3dState.clock=new THREE.Clock();museum3dState.velocity=new THREE.Vector3();museum3dState.direction=new THREE.Vector3();museum3dState.initialized=true;window.addEventListener('resize',()=>{camera.aspect=container.clientWidth/container.clientHeight;camera.updateProjectionMatrix();renderer.setSize(container.clientWidth,container.clientHeight)});document.addEventListener('keydown',e=>{if(e.code==='KeyW')museum3dState.keys.w=true;if(e.code==='KeyA')museum3dState.keys.a=true;if(e.code==='KeyS')museum3dState.keys.s=true;if(e.code==='KeyD')museum3dState.keys.d=true;if(e.code==='KeyE')inspectNearestArtifact()});document.addEventListener('keyup',e=>{if(e.code==='KeyW')museum3dState.keys.w=false;if(e.code==='KeyA')museum3dState.keys.a=false;if(e.code==='KeyS')museum3dState.keys.s=false;if(e.code==='KeyD')museum3dState.keys.d=false});(function animate(){requestAnimationFrame(animate);const d=Math.min(museum3dState.clock.getDelta(),.05);if(controls.isLocked){museum3dState.velocity.x-=museum3dState.velocity.x*8*d;museum3dState.velocity.z-=museum3dState.velocity.z*8*d;museum3dState.direction.z=Number(museum3dState.keys.w)-Number(museum3dState.keys.s);museum3dState.direction.x=Number(museum3dState.keys.d)-Number(museum3dState.keys.a);museum3dState.direction.normalize();if(museum3dState.keys.w||museum3dState.keys.s)museum3dState.velocity.z-=museum3dState.direction.z*18*d;if(museum3dState.keys.a||museum3dState.keys.d)museum3dState.velocity.x-=museum3dState.direction.x*18*d;controls.moveRight(-museum3dState.velocity.x*d);controls.moveForward(-museum3dState.velocity.z*d);const p=controls.getObject().position;p.x=Math.max(-13.5,Math.min(13.5,p.x));p.z=Math.max(-13.5,Math.min(13.5,p.z));p.y=1.7}updateNearestArtifact();renderer.render(scene,camera)})();document.querySelector('#museum3dStatus').textContent='Gerçek 3D müze hazır'}
function updateNearestArtifact(){if(!museum3dState.camera)return;let nearest=null,dist=Infinity;for(const o of museum3dState.interactables){const d=museum3dState.camera.position.distanceTo(o.position);if(d<dist){dist=d;nearest=o}}museum3dState.activeItem=dist<3.2?nearest:null;document.querySelector('#museum3dStatus').textContent=museum3dState.activeItem?'E ile incele: '+museum3dState.activeItem.userData.info.title:'Müzede dolaşıyorsun'}
function inspectNearestArtifact(){const o=museum3dState.activeItem;if(!o)return;const i=o.userData.info;document.querySelector('#real3dTitle').textContent=i.title;document.querySelector('#real3dText').textContent=i.text;document.querySelector('#real3dPanel').classList.remove('hidden')}
const enter3d=document.querySelector('#enter3dMuseum'),exit3d=document.querySelector('#exit3dMuseum'),close3d=document.querySelector('#close3dPanel'),speak3d=document.querySelector('#real3dSpeak');if(enter3d)enter3d.onclick=()=>{initReal3DMuseum();museum3dState.controls?.lock()};if(exit3d)exit3d.onclick=()=>{museum3dState.controls?.unlock();document.querySelector('#real3dPanel')?.classList.add('hidden')};if(close3d)close3d.onclick=()=>document.querySelector('#real3dPanel')?.classList.add('hidden');if(speak3d)speak3d.onclick=()=>{const title=document.querySelector('#real3dTitle')?.textContent||'',text=document.querySelector('#real3dText')?.textContent||'';speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(title+'. '+text);u.lang='tr-TR';speechSynthesis.speak(u)};

const defaultAudioPrefs={music:true,volume:35,gameAudio:true,narration:true,track:"ceddin"};
const audioPrefs={...defaultAudioPrefs,...JSON.parse(localStorage.getItem("oa_audio_prefs")||"{}")};
if(localStorage.getItem("oa_ceddin_direct_v1")!=="1"){
  audioPrefs.music=true;audioPrefs.volume=35;audioPrefs.track="ceddin";
  localStorage.setItem("oa_ceddin_direct_v1","1");
}
const mehterAudio=$("#mehterAudio");
function saveAudioPrefs(){localStorage.setItem("oa_audio_prefs",JSON.stringify(audioPrefs))}
async function applyMusicTrack(track){
  const status=$("#ceddinStatus"),select=$("#musicTrackSelect");
  audioPrefs.track=track==="ceddin"?"ceddin":"original";
  const src=audioPrefs.track==="ceddin"?mehterAudio.dataset.ceddinSrc:mehterAudio.dataset.originalSrc;
  if(select)select.value=audioPrefs.track;
  if(status){status.textContent=audioPrefs.track==="ceddin"?"Eklenen marş dosyası seçili.":"Özgün Mehter Esintisi seçili.";status.style.borderColor=audioPrefs.track==="ceddin"?"var(--green)":""}
  const resume=audioPrefs.music&&!mehterAudio.paused;
  mehterAudio.src=src;mehterAudio.load();mehterAudio.volume=audioPrefs.volume/100;saveAudioPrefs();
  if(resume){try{await mehterAudio.play()}catch(e){}}
}
async function applyAudioPrefs(){
  $("#musicEnabled").checked=audioPrefs.music;$("#musicVolume").value=audioPrefs.volume;$("#musicVolumeValue").textContent=`%${audioPrefs.volume}`;
  $("#gameAudioEnabled").checked=audioPrefs.gameAudio;$("#narrationEnabled").checked=audioPrefs.narration;$("#musicTrackSelect").value=audioPrefs.track;
  await applyMusicTrack(audioPrefs.track);mehterAudio.volume=audioPrefs.volume/100;if(!audioPrefs.music)mehterAudio.pause();
}
async function startBackgroundMusic(){if(!audioPrefs.music)return;try{mehterAudio.volume=audioPrefs.volume/100;await mehterAudio.play();$("#audioSettingsButton").textContent="🔊"}catch(e){$("#audioSettingsButton").textContent="🔇"}}
let firstAudioGesture=false;function unlockAudio(){if(firstAudioGesture)return;firstAudioGesture=true;startBackgroundMusic()}
document.addEventListener("pointerdown",unlockAudio,{once:true});document.addEventListener("keydown",unlockAudio,{once:true});

$("#musicEnabled").onchange=e=>{audioPrefs.music=e.target.checked;saveAudioPrefs();if(audioPrefs.music)startBackgroundMusic();else mehterAudio.pause()};
$("#musicVolume").oninput=e=>{audioPrefs.volume=Number(e.target.value);mehterAudio.volume=audioPrefs.volume/100;$("#musicVolumeValue").textContent=`%${audioPrefs.volume}`;saveAudioPrefs()};
$("#gameAudioEnabled").onchange=e=>{audioPrefs.gameAudio=e.target.checked;saveAudioPrefs()};$("#narrationEnabled").onchange=e=>{audioPrefs.narration=e.target.checked;saveAudioPrefs()};
$("#musicTrackSelect").onchange=async e=>{await applyMusicTrack(e.target.value);if(audioPrefs.music)startBackgroundMusic()};
$("#audioTestButton").onclick=()=>{if(mehterAudio.paused){audioPrefs.music=true;$("#musicEnabled").checked=true;startBackgroundMusic()}else mehterAudio.pause();saveAudioPrefs()};
applyAudioPrefs();

const timegateEras={"1453":{year:"1453",sultan:"Fatih Sultan Mehmed",summary:"İstanbul'un fethi ve imparatorluk başkentinin doğuşu.",radio:"Fetih1453 FM",radioIndex:0,theme:"Fetih Kırmızısı",event:"İstanbul'un Fethi"},"1512":{year:"1512",sultan:"Yavuz Sultan Selim",summary:"Çaldıran'dan Mısır'a uzanan hızlı doğu ve güney seferleri.",radio:"Yavuz FM",radioIndex:1,theme:"Sefer Toprağı",event:"Doğu Seferleri"},"1520":{year:"1520",sultan:"Kanuni Sultan Süleyman",summary:"Hukuk, mimari, diplomasi ve büyük seferlerin görkemli çağı.",radio:"Kanuni FM",radioIndex:2,theme:"Kanuni Moru",event:"Kanuni'nin Çağı"},"1876":{year:"1876",sultan:"II. Abdülhamid",summary:"Yıldız Sarayı, eğitim yatırımları ve Hicaz Demiryolu dönemi.",radio:"Hicaz Demiryolu FM",radioIndex:4,theme:"Yıldız Yeşili",event:"II. Abdülhamid Dönemi"}};
let selectedTimegateEra=localStorage.getItem("oa_timegate_era")||"1453";
function renderTimegate(){
  const e=timegateEras[selectedTimegateEra];
  $("#timegateYear").textContent=e.year;
  $("#timegateSultan").textContent=e.sultan;
  $("#timegateSummary").textContent=e.summary;
  $("#timegateChatTarget").textContent=e.sultan;
  $("#timegateRadioTarget").textContent=e.radio;
  $("#timegateThemeTarget").textContent=e.theme;
  $("#timegateEventTarget").textContent=e.event;
  const atmosphere=$("#timegateAtmosphere");
  if(atmosphere){
    atmosphere.classList.remove("era-1453","era-1512","era-1520","era-1876");
    atmosphere.classList.add(`era-${selectedTimegateEra}`);
  }
  $$(".era-card").forEach(b=>b.classList.toggle("active",b.dataset.eraKey===selectedTimegateEra));
}
function applyTimegateEra(key,showTransition=true){const e=timegateEras[key];if(!e)return;selectedTimegateEra=key;localStorage.setItem("oa_timegate_era",key);const complete=()=>{document.body.dataset.era=key;if(typeof updateChatSultan==="function")updateChatSultan(e.sultan);if(typeof radioIndex!=="undefined"){radioIndex=e.radioIndex;if(typeof renderRadio==="function")renderRadio()}renderTimegate();$("#timegateDoor").classList.add("open");setTimeout(()=>$("#timegateDoor").classList.remove("open"),1800);toast(`${e.year} dönemine geçildi: ${e.sultan}`)};if(!showTransition){complete();return}$("#timegateOverlayYear").textContent=e.year;$("#timegateOverlayText").textContent=`${e.sultan} dönemi yükleniyor • atmosfer hazırlanıyor...`;$("#timegateOverlay").classList.remove("hidden");setTimeout(()=>{complete();$("#timegateOverlay").classList.add("hidden")},1500)}
$$(".era-card").forEach(b=>b.onclick=()=>{selectedTimegateEra=b.dataset.eraKey;renderTimegate();$("#timegateDoor").classList.add("preview");setTimeout(()=>$("#timegateDoor").classList.remove("preview"),450)});
$("#openTimegate").onclick=()=>applyTimegateEra(selectedTimegateEra,true);
$("#resetTimegate").onclick=()=>{localStorage.removeItem("oa_timegate_era");delete document.body.dataset.era;selectedTimegateEra="1453";renderTimegate();toast("Günümüz temasına dönüldü")};
renderTimegate();if(localStorage.getItem("oa_timegate_era"))applyTimegateEra(selectedTimegateEra,false);


// Fetih Simülatörü
const siegeStages=[
  {
    title:"Boğazı Kontrol Et",
    text:"Bizans'a deniz yoluyla yardım gelmesini engellemek için doğru hazırlığı seç.",
    options:[
      ["Rumeli Hisarı'nı inşa et",true,20,10,0,"Boğaz kontrol altına alındı. Yardım yolları büyük ölçüde kesildi."],
      ["Donanmayı geri çek",false,-10,-5,0,"Donanmayı geri çekmek kuşatmayı zayıflatırdı."],
      ["Sadece kara ordusuna güven",false,-5,0,0,"Deniz yolları açık kaldığı için yardım gelebilirdi."],
      ["Kuşatmayı ertele",false,-15,-10,0,"Zaman kaybı savunmayı güçlendirirdi."]
    ],
    scene:"rumeliFortress"
  },
  {
    title:"Şahi Toplarını Yerleştir",
    text:"Surların dayanıklılığını azaltmak için ağır topları doğru konumlandır.",
    options:[
      ["Topları surların zayıf noktasına yerleştir",true,15,20,-25,"Keşif bilgisi sayesinde surlarda ciddi hasar oluştu."],
      ["Topları çok uzakta bırak",false,-5,-5,-5,"Menzil ve isabet gücü yetersiz kaldı."],
      ["Topları rastgele ateşle",false,-8,-10,-8,"Mühimmat boşa harcandı."],
      ["Topları kullanma",false,-10,-15,0,"Surların yıkılması çok zorlaştı."]
    ],
    scene:"shahiCannonSim"
  },
  {
    title:"Gemileri Karadan Yürüt",
    text:"Haliç girişindeki zinciri aşmak için nasıl hareket edeceksin?",
    options:[
      ["Gemileri yağlı kızaklarla karadan yürüt",true,25,20,0,"Donanma Haliç'e indirildi ve savunma şaşkına döndü."],
      ["Zincire doğrudan saldır",false,-10,-5,0,"Doğrudan saldırı büyük kayıplara yol açabilirdi."],
      ["Donanmayı beklet",false,-5,-10,0,"Kuşatma baskısı azaldı."],
      ["Bütün gemileri geri gönder",false,-15,-15,0,"Deniz desteği tamamen kaybedildi."]
    ],
    scene:"shipsScene"
  },
  {
    title:"Son Hücumu Yönet",
    text:"Surlar zayıfladı. Ordunun son hücum düzenini belirle.",
    options:[
      ["Dalgalar hâlinde koordineli hücum",true,20,15,-35,"Koordineli hücum savunmayı yordu ve gedikler genişledi."],
      ["Bütün birlikleri tek noktaya yığ",false,-10,-5,-10,"Dar alanda büyük kayıplar oluşabilirdi."],
      ["Hücumu plansız başlat",false,-15,-10,-5,"Plansızlık birliklerin uyumunu bozdu."],
      ["Geri çekil",false,-20,-20,0,"Kuşatmanın bütün baskısı kayboldu."]
    ],
    scene:"assaultScene"
  },
  {
    title:"Sancağı Dik",
    text:"Surlar aşıldı. Son adımı tamamla ve fethi ilan et.",
    options:[
      ["Osmanlı sancağını surlara dik",true,30,20,-40,"Fetih başarıyla tamamlandı. İstanbul yeni başkent oldu."],
      ["Birlikleri geri çağır",false,-20,-20,0,"Zafer fırsatı kaybedildi."],
      ["Kapıları kapatıp bekle",false,-10,-10,0,"Şehir kontrol altına alınamadı."],
      ["Sancağı sakla",false,-5,-5,0,"Zaferin ilanı gecikti."]
    ],
    scene:"flagScene"
  }
];
let siegeState={stage:0,score:0,morale:70,prep:20,wall:100,answered:false};
function clampSiege(v){return Math.max(0,Math.min(100,v))}
function showSiegeScene(sceneId){
  ["rumeliFortress","shahiCannonSim","shipsScene","assaultScene","flagScene"].forEach(id=>{
    const el=$("#"+id);if(!el)return;
    el.classList.toggle("visible-stage",id===sceneId);
    el.classList.toggle("hidden-stage",id!==sceneId);
  });
}
function updateSiegeMeters(){
  $("#moraleValue").textContent=siegeState.morale;
  $("#prepValue").textContent=siegeState.prep;
  $("#wallValue").textContent=siegeState.wall;
  $("#moraleMeter").style.width=`${siegeState.morale}%`;
  $("#prepMeter").style.width=`${siegeState.prep}%`;
  $("#wallMeter").style.width=`${siegeState.wall}%`;
  const dmg=$("#wallDamage");
  dmg.className="wall-damage";
  if(siegeState.wall<=75)dmg.classList.add("damage-1");
  if(siegeState.wall<=50)dmg.classList.add("damage-2");
  if(siegeState.wall<=20)dmg.classList.add("damage-3");
}
function renderSiegeStage(){
  const st=siegeStages[siegeState.stage];
  siegeState.answered=false;
  $("#siegeStageCounter").textContent=`${siegeState.stage+1} / ${siegeStages.length}`;
  $("#siegeAnnouncement").innerHTML=`<small>AŞAMA ${siegeState.stage+1}</small><h3>${st.title}</h3><p>${st.text}</p>`;
  $("#siegeOptions").innerHTML=st.options.map((o,i)=>`<button class="siege-option" data-siege-option="${i}">${o[0]}</button>`).join("");
  $("#siegeFeedback").textContent="";
  $("#siegeNext").disabled=true;
  showSiegeScene(st.scene);
  updateSiegeMeters();
}
$("#siegeOptions").onclick=e=>{
  const b=e.target.closest("[data-siege-option]");
  if(!b||siegeState.answered)return;
  siegeState.answered=true;
  const choice=siegeStages[siegeState.stage].options[Number(b.dataset.siegeOption)];
  const [label,correct,morale,prep,wall,feedback]=choice;
  siegeState.morale=clampSiege(siegeState.morale+morale);
  siegeState.prep=clampSiege(siegeState.prep+prep);
  siegeState.wall=clampSiege(siegeState.wall+wall);
  siegeState.score+=correct?100:20;
  $("#siegeScore").textContent=siegeState.score;
  $$(".siege-option").forEach(x=>x.disabled=true);
  b.classList.add(correct?"correct":"wrong");
  if(correct){
    const right=Number(b.dataset.siegeOption);
    $$(".siege-option").forEach((x,i)=>{if(i===right)x.classList.add("correct")});
  }
  $("#siegeFeedback").textContent=feedback;
  $("#siegeNext").disabled=false;
  updateSiegeMeters();
};
$("#siegeNext").onclick=()=>{
  if(siegeState.stage<siegeStages.length-1){
    siegeState.stage++;
    renderSiegeStage();
  }else{
    $("#siegeFeedback").innerHTML=`<b>Fetih tamamlandı!</b> Toplam puanın: ${siegeState.score}. ${siegeState.score>=450?"1453 Fetih Ustası rozetini kazandın!":"Görevi tamamladın; daha yüksek puan için yeniden dene."}`;
    $("#siegeNext").disabled=true;
    $("#siegeOptions").innerHTML="";
    if(typeof addXP==="function")addXP(Math.max(50,siegeState.score));
    if(typeof infinity!=="undefined"){infinity.games++;if(typeof saveInfinity==="function")saveInfinity()}
    if(typeof toast==="function")toast("İstanbul'un Fethi simülasyonu tamamlandı");
  }
};
$("#siegeRestart").onclick=()=>{
  siegeState={stage:0,score:0,morale:70,prep:20,wall:100,answered:false};
  $("#siegeScore").textContent="0";
  renderSiegeStage();
};
$("#fireCannonButton").onclick=()=>{
  $("#shahiCannonSim").classList.remove("fired");
  void $("#shahiCannonSim").offsetWidth;
  $("#shahiCannonSim").classList.add("fired");
  setTimeout(()=>$("#shahiCannonSim").classList.remove("fired"),700);
};
renderSiegeStage();



// V13 — İnteraktif Osmanlı Haritası
const ottomanMapEvents=[
  {year:1299,title:"Osmanlı Beyliği'nin Kuruluşu",text:"Osman Gazi döneminde Söğüt merkezli Osmanlı Beyliği'nin kuruluş süreci başladı.",sultan:"Osman Gazi",city:"Söğüt",era:"Kuruluş",area:42,origin:[43,47]},
  {year:1326,title:"Bursa'nın Fethi",text:"Orhan Gazi döneminde Bursa fethedildi ve Osmanlı'nın ilk büyük başkenti oldu.",sultan:"Orhan Gazi",city:"Bursa",era:"Kuruluş",area:72,origin:[40,44]},
  {year:1361,title:"Edirne'nin Fethi",text:"I. Murad döneminde Edirne alındı ve Rumeli'deki Osmanlı hâkimiyeti güçlendi.",sultan:"I. Murad",city:"Edirne",era:"Kuruluş",area:115,origin:[34,39]},
  {year:1453,title:"İstanbul'un Fethi",text:"Fatih Sultan Mehmed İstanbul'u fethederek şehri Osmanlı başkenti yaptı.",sultan:"Fatih Sultan Mehmed",city:"İstanbul",era:"Yükseliş",area:175,origin:[42,38]},
  {year:1461,title:"Trabzon'un Fethi",text:"Fatih Sultan Mehmed, Trabzon'u fethederek Karadeniz hâkimiyetini güçlendirdi.",sultan:"Fatih Sultan Mehmed",city:"Trabzon",era:"Yükseliş",area:205,origin:[53,40]},
  {year:1517,title:"Mısır Seferi",text:"Yavuz Sultan Selim döneminde Mısır Osmanlı yönetimine girdi.",sultan:"Yavuz Sultan Selim",city:"Kahire",era:"Yükseliş",area:275,origin:[48,56]},
  {year:1521,title:"Belgrad'ın Fethi",text:"Kanuni Sultan Süleyman döneminde Belgrad fethedildi.",sultan:"Kanuni Sultan Süleyman",city:"Belgrad",era:"Yükseliş",area:310,origin:[38,42]},
  {year:1522,title:"Rodos'un Fethi",text:"Rodos fethedilerek Doğu Akdeniz'deki Osmanlı gücü arttı.",sultan:"Kanuni Sultan Süleyman",city:"Rodos",era:"Yükseliş",area:330,origin:[42,51]},
  {year:1526,title:"Mohaç Zaferi",text:"Mohaç Meydan Muharebesi Osmanlı'nın Orta Avrupa'daki etkisini artırdı.",sultan:"Kanuni Sultan Süleyman",city:"Mohaç",era:"Yükseliş",area:355,origin:[34,38]},
  {year:1534,title:"Bağdat'ın Alınması",text:"Kanuni döneminde Bağdat Osmanlı yönetimine girdi.",sultan:"Kanuni Sultan Süleyman",city:"Bağdat",era:"Yükseliş",area:395,origin:[56,54]},
  {year:1538,title:"Preveze Deniz Zaferi",text:"Barbaros Hayreddin Paşa komutasındaki Osmanlı donanması Akdeniz üstünlüğünü güçlendirdi.",sultan:"Kanuni Sultan Süleyman",city:"Preveze",era:"Yükseliş",area:420,origin:[36,48]},
  {year:1683,title:"Viyana Seferi Dönemi",text:"Osmanlı Devleti, Avrupa'daki en geniş etkili dönemlerinden birine ulaştı.",sultan:"IV. Mehmed",city:"Viyana",era:"Duraklama",area:470,origin:[31,36]},
  {year:1922,title:"Saltanatın Sona Ermesi",text:"Saltanat kaldırıldı ve Osmanlı padişahlığı sona erdi.",sultan:"VI. Mehmed Vahdeddin",city:"İstanbul",era:"Dağılma",area:115,origin:[43,42]}
];
const cityMapInfo={
  "Söğüt":{year:1299,sultan:"Osman Gazi",text:"Osmanlı Beyliği'nin kuruluş merkezlerinden biri."},
  "Bursa":{year:1326,sultan:"Orhan Gazi",text:"Osmanlı'nın ilk büyük başkenti ve önemli kültür merkezi."},
  "Edirne":{year:1361,sultan:"I. Murad",text:"İstanbul'dan önce Osmanlı başkenti olan Rumeli şehri."},
  "İstanbul":{year:1453,sultan:"Fatih Sultan Mehmed",text:"1453'te fethedilerek Osmanlı'nın büyük başkenti oldu."},
  "Trabzon":{year:1461,sultan:"Fatih Sultan Mehmed",text:"Karadeniz hâkimiyeti açısından önemli fetih."},
  "Kahire":{year:1517,sultan:"Yavuz Sultan Selim",text:"Mısır seferinden sonra Osmanlı yönetimine giren büyük merkez."},
  "Belgrad":{year:1521,sultan:"Kanuni Sultan Süleyman",text:"Orta Avrupa seferlerinin önemli kapısı."},
  "Rodos":{year:1522,sultan:"Kanuni Sultan Süleyman",text:"Doğu Akdeniz güvenliği için stratejik ada."},
  "Mohaç":{year:1526,sultan:"Kanuni Sultan Süleyman",text:"Kısa sürede sonuçlanan büyük meydan savaşıyla bilinir."},
  "Bağdat":{year:1534,sultan:"Kanuni Sultan Süleyman",text:"Doğu siyaseti ve ticaret yolları açısından önemli şehir."},
  "Preveze":{year:1538,sultan:"Kanuni Sultan Süleyman",text:"Osmanlı deniz gücünün simge zaferlerinden biri."},
  "Viyana":{year:1683,sultan:"IV. Mehmed",text:"Osmanlı'nın Avrupa'daki ileri harekâtlarının sembol noktalarından biri."}
};
let mapYear=1299,mapTourTimer=null,mapTourRunning=false;
function currentMapEvent(year){
  return [...ottomanMapEvents].reverse().find(e=>e.year<=year)||ottomanMapEvents[0];
}
function flashMapAt(city){
  const el=document.querySelector(`.historic-city[data-city="${city}"]`);
  if(!el)return;
  const canvas=$("#ottomanMapCanvas").getBoundingClientRect(),r=el.getBoundingClientRect();
  $("#mapFlash").style.setProperty("--flash-x",`${((r.left+r.width/2-canvas.left)/canvas.width)*100}%`);
  $("#mapFlash").style.setProperty("--flash-y",`${((r.top+r.height/2-canvas.top)/canvas.height)*100}%`);
  $("#mapFlash").classList.remove("active");void $("#mapFlash").offsetWidth;$("#mapFlash").classList.add("active");
  $("#mapFlag").style.left=el.style.left;$("#mapFlag").style.top=el.style.top;$("#mapFlag").classList.add("show");
  setTimeout(()=>$("#mapFlag").classList.remove("show"),1300);
}
function renderOttomanMap(year,animate=false){
  mapYear=Number(year);
  $("#ottomanYearSlider").value=mapYear;
  const ev=currentMapEvent(mapYear);
  $("#mapYearBig").textContent=mapYear;
  $("#mapEventTitle").textContent=ev.title;$("#mapEventText").textContent=ev.text;
  $("#mapSultan").textContent=ev.sultan;$("#mapFocusCity").textContent=ev.city;$("#mapEra").textContent=ev.era;
  $("#mapCurrentSultan").textContent=ev.sultan;
  const active=$$(".historic-city").filter(c=>Number(c.dataset.year)<=mapYear);
  $$(".historic-city").forEach(c=>c.classList.toggle("active",Number(c.dataset.year)<=mapYear));
  $("#mapActiveCities").textContent=active.length;
  const idx=ottomanMapEvents.findIndex(e=>e===ev);
  $("#mapMilestoneCount").textContent=`${idx+1} / ${ottomanMapEvents.length}`;
  const pct=Math.round(((mapYear-1299)/(1922-1299))*100);
  $("#mapProgressPercent").textContent=`%${pct}`;
  const size=ev.area;
  $("#empireArea").style.width=`${size}px`;$("#empireArea").style.height=`${size}px`;$("#empireArea").style.left=`${ev.origin[0]}%`;$("#empireArea").style.top=`${ev.origin[1]}%`;
  $$(".map-milestone").forEach(b=>b.classList.toggle("active",Number(b.dataset.mapYear)===ev.year));
  if(animate)flashMapAt(ev.city);
}
function renderMapMilestones(){
  $("#mapMilestones").innerHTML=ottomanMapEvents.map(e=>`<button class="map-milestone" data-map-year="${e.year}"><small>${e.year}</small><b>${e.city}</b></button>`).join("");
}
function stopMapTour(){mapTourRunning=false;clearTimeout(mapTourTimer)}
function startMapTour(){
  stopMapTour();mapTourRunning=true;
  let idx=Math.max(0,ottomanMapEvents.findIndex(e=>e.year>=mapYear));
  const step=()=>{
    if(!mapTourRunning)return;
    if(idx>=ottomanMapEvents.length){stopMapTour();toast("Osmanlı tarih turu tamamlandı");return}
    const ev=ottomanMapEvents[idx++];
    renderOttomanMap(ev.year,true);
    mapTourTimer=setTimeout(step,Number($("#mapTourSpeed").value));
  };
  step();
}
$("#ottomanYearSlider").oninput=e=>{stopMapTour();renderOttomanMap(e.target.value,false)};
$("#mapTourPlay").onclick=startMapTour;$("#mapTourPause").onclick=stopMapTour;
$("#mapTourReset").onclick=()=>{stopMapTour();renderOttomanMap(1299,false)};
$("#mapMilestones").onclick=e=>{const b=e.target.closest("[data-map-year]");if(!b)return;stopMapTour();renderOttomanMap(Number(b.dataset.mapYear),true)};
$("#ottomanMapCanvas").onclick=e=>{
  const city=e.target.closest("[data-city]");if(!city)return;
  const info=cityMapInfo[city.dataset.city];if(!info)return;
  $("#cityInfoTitle").textContent=city.dataset.city;$("#cityInfoText").textContent=info.text;
  $("#cityInfoYear").textContent=`📅 ${info.year}`;$("#cityInfoSultan").textContent=`👑 ${info.sultan}`;
  $("#cityInfoDialog").showModal();
};
$("#cityInfoClose").onclick=()=>$("#cityInfoDialog").close();
$("#mapNarrate").onclick=()=>{
  const ev=currentMapEvent(mapYear);
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(`${ev.year}. ${ev.title}. ${ev.text}`);
  u.lang="tr-TR";u.rate=.92;speechSynthesis.speak(u);
};
renderMapMilestones();renderOttomanMap(1299,false);



// V14 — Osmanlı AI Avatarı
const aiAvatarPrefs={voice:localStorage.getItem("oa_avatar_voice")!=="0"};
const avatarGuideMap={
  "tanıma":"recognition","padişah tanıma":"recognition","ansiklopedi":"encyclopedia","zaman çizelgesi":"timeline",
  "harita":"ottomanmap","fetih simülatörü":"conquestsim","oyun":"games","müze":"museum3d","radyo":"tv",
  "zaman kapısı":"timegate","sohbet":"chat","padişahla konuş":"chat","ferman":"ferman","istatistik":"stats"
};
function setAvatarSpeaking(active,status){
  $("#aiAvatarCharacter").classList.toggle("speaking",active);
  $("#aiAvatarStatus").textContent=status||(active?"Konuşuyor":"Hazır");
}
function speakAvatar(text){
  speechSynthesis.cancel();
  if(!aiAvatarPrefs.voice){setAvatarSpeaking(false,"Sesli cevap kapalı");return}
  const u=new SpeechSynthesisUtterance(text);
  u.lang=appLang==="en"?"en-US":"tr-TR";u.rate=.94;u.pitch=.95;
  u.onstart=()=>setAvatarSpeaking(true,"Konuşuyor");
  u.onend=()=>setAvatarSpeaking(false,"Hazır");
  u.onerror=()=>setAvatarSpeaking(false,"Ses tamamlanamadı");
  speechSynthesis.speak(u);
}
function addAvatarMessage(text,type="ai",speak=true){
  const box=$("#aiAvatarMessages");
  box.insertAdjacentHTML("beforeend",`<div class="avatar-message ${type}">${escapeHtml(text)}</div>`);
  box.scrollTop=box.scrollHeight;
  if(type==="ai"&&speak)speakAvatar(text);
}
function randomSultanName(){
  return names[Math.floor(Math.random()*names.length)];
}
function avatarAnswer(query){
  const q=query.trim();if(!q)return;
  addAvatarMessage(q,"user",false);
  const t=q.toLocaleLowerCase("tr-TR");
  for(const [key,target] of Object.entries(avatarGuideMap)){
    if(t.includes(key)){
      const answer=`Seni ${key} bölümüne götürüyorum.`;
      addAvatarMessage(answer,"ai",true);
      setTimeout(()=>page(target),650);
      return;
    }
  }
  const matched=names.find(n=>t.includes(n.toLocaleLowerCase("tr-TR")))||names.find(n=>n.toLocaleLowerCase("tr-TR").split(" ").some(part=>part.length>3&&t.includes(part)));
  if(matched){
    const p=profiles[matched];
    addAvatarMessage(`${matched}: ${p.summary} Saltanat dönemi ${p.reign}. Askerî faaliyetleri: ${p.military}`,"ai",true);
    return;
  }
  if(/kim yaptı|hangi padişah|kim fethetti/.test(t)){
    addAvatarMessage("Bu soruyu daha net cevaplayabilmem için şehir, savaş veya padişah adını da yazabilirsin.","ai",true);return;
  }
  if(/ne yapabilirsin|yardım/.test(t)){
    addAvatarMessage("Seni uygulamadaki bölümlere yönlendirebilir, padişahlar hakkında bilgi verebilir, günlük bilgi söyleyebilir ve mini soru sorabilirim.","ai",true);return;
  }
  addAvatarMessage("Bu konuda uygulamadaki tarih verilerinden kesin bir eşleşme bulamadım. Bir padişah adı, şehir, savaş veya bölüm adı yazarak tekrar sorabilirsin.","ai",true);
}


$("#aiAvatarSend").onclick=()=>{avatarAnswer($("#aiAvatarInput").value);$("#aiAvatarInput").value=""};
$("#aiAvatarInput").onkeydown=e=>{if(e.key==="Enter"){$("#aiAvatarSend").click()}};
$("#aiAvatarVoice").checked=aiAvatarPrefs.voice;
$("#aiAvatarVoice").onchange=e=>{aiAvatarPrefs.voice=e.target.checked;localStorage.setItem("oa_avatar_voice",e.target.checked?"1":"0");if(!e.target.checked){speechSynthesis.cancel();setAvatarSpeaking(false,"Sesli cevap kapalı")}};
$$("[data-avatar-action]").forEach(b=>b.onclick=()=>{
  const action=b.dataset.avatarAction;
  if(action==="guide")addAvatarMessage("Şunlardan birini yazabilirsin: harita, fetih simülatörü, oyunlar, radyo, müze, zaman kapısı, ansiklopedi veya padişahla konuş.","ai",true);
  if(action==="daily"){
    const title=$("#dailyHistoryTitle")?.textContent||"Günün bilgisi";
    const fact=$("#dailyHistoryFact")?.textContent||"Osmanlı tarihi çok geniş ve zengindir.";
    addAvatarMessage(`${title}: ${fact}`,"ai",true);
  }
  if(action==="quiz"){
    const n=randomSultanName(),p=profiles[n];
    addAvatarMessage(`Mini soru: ${n} hangi dönemde hüküm sürdü? Cevap: ${p.era}.`,"ai",true);
  }
  if(action==="random"){
    const n=randomSultanName(),p=profiles[n];
    addAvatarMessage(`Bugün ${n} hakkında bilgi edinmeni öneririm. ${p.summary}`,"ai",true);
  }
});


// V15 intro
const imperialIntro=$("#imperialIntro");
const enterImperialApp=$("#enterImperialApp");
if(localStorage.getItem("oa_intro_seen")==="1")imperialIntro?.classList.add("hidden-intro");
if(enterImperialApp)enterImperialApp.onclick=()=>{
  try{localStorage.setItem("oa_intro_seen","1")}catch(e){}
  if(imperialIntro){
    imperialIntro.classList.add("hidden-intro");
    imperialIntro.style.pointerEvents="none";
    setTimeout(()=>{imperialIntro.style.display="none"},850);
  }
  if(typeof startBackgroundMusic==="function")startBackgroundMusic();
  else{
    const audio=document.getElementById("mehterAudio");
    if(audio){audio.volume=.35;audio.play().catch(()=>{})}
  }
};

// V15 Treasury Room
const treasuryArtifacts=[
  {title:"Fetih Kılıcı",icon:"⚔️",category:"SİLAH",era:"15. yüzyıl",rarity:"Efsanevi",text:"Osmanlı fetih geleneğini ve askerî gücünü temsil eden törensel kılıç modeli."},
  {title:"Osmanlı Kalkanı",icon:"🛡️",category:"SAVUNMA",era:"Klasik Dönem",rarity:"Nadir",text:"Savaş meydanlarında kullanılan kalkanların geometrik ve bitkisel süsleme anlayışını temsil eder."},
  {title:"Padişah Fermanı",icon:"📜",category:"BELGE",era:"16. yüzyıl",rarity:"Çok Nadir",text:"Padişah buyruğunu ve Osmanlı idarî düzenini temsil eden mühürlü belge."},
  {title:"Sultani Altın",icon:"🪙",category:"PARA",era:"Fatih Dönemi",rarity:"Efsanevi",text:"Fatih Sultan Mehmed döneminde basılan Osmanlı altın para geleneğini temsil eder."},
  {title:"Saray Kaftanı",icon:"👘",category:"GİYİM",era:"Klasik Dönem",rarity:"Nadir",text:"Saray dokumacılığı, kumaş sanatı ve padişah kıyafet kültürünü temsil eden kaftan."},
  {title:"Osmanlı Miğferi",icon:"🪖",category:"ZIRH",era:"15–16. yüzyıl",rarity:"Nadir",text:"Osmanlı askerî zırh geleneğini temsil eden koruyucu başlık."},
  {title:"Tuğra",icon:"☬",category:"SİMGE",era:"Hanedan",rarity:"Efsanevi",text:"Padişahın adını ve unvanlarını taşıyan, devlet belgelerinde kullanılan hükümdarlık işareti."},
  {title:"Osmanlı Sancağı",icon:"🚩",category:"SANCAK",era:"Kuruluştan Son Döneme",rarity:"Efsanevi",text:"Birliği, hâkimiyeti ve askerî teşkilatı temsil eden tarihî sancak geleneği."}
];
let treasuryIndex=0;
function renderTreasury(){
  const a=treasuryArtifacts[treasuryIndex];
  $("#treasuryList").innerHTML=treasuryArtifacts.map((x,i)=>`<button class="treasury-item ${i===treasuryIndex?"active":""}" data-treasury="${i}"><span>${x.icon}</span><div><b>${x.title}</b><small>${x.category}</small></div></button>`).join("");
  $("#treasuryArtifactIcon").textContent=a.icon;
  $("#treasuryArtifactCategory").textContent=a.category;
  $("#treasuryArtifactTitle").textContent=a.title;
  $("#treasuryArtifactText").textContent=a.text;
  $("#treasuryArtifactEra").textContent=`📅 ${a.era}`;
  $("#treasuryArtifactRarity").textContent=`💎 ${a.rarity}`;
  const daily=treasuryArtifacts[Math.floor(Date.now()/86400000)%treasuryArtifacts.length];
  $("#legendaryArtifactTitle").textContent=daily.title;
  $("#legendaryArtifactText").textContent=daily.text;
}
$("#treasuryList").onclick=e=>{const b=e.target.closest("[data-treasury]");if(!b)return;treasuryIndex=Number(b.dataset.treasury);renderTreasury()};
$("#treasuryRotate").onclick=()=>{const el=$("#treasuryArtifact");el.classList.remove("rotating");void el.offsetWidth;el.classList.add("rotating");setTimeout(()=>el.classList.remove("rotating"),2500)};
$("#treasurySpeak").onclick=()=>{const a=treasuryArtifacts[treasuryIndex];speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(`${a.title}. ${a.text}`);u.lang="tr-TR";u.rate=.92;speechSynthesis.speak(u)};
renderTreasury();


// V16 — Achievement System
const achievementState=JSON.parse(localStorage.getItem("oa_achievements")||'{"xp":0,"tasks":0,"mission":0,"unlocked":[]}');
const achievementBadges=[
  {id:"first_step",icon:"🏁",title:"İlk Adım",text:"Uygulamayı keşfetmeye başla.",xp:0},
  {id:"conqueror",icon:"⚔️",title:"Fetih Ustası",text:"Fetih Simülatörü'nü tamamla.",xp:500},
  {id:"map_master",icon:"🗺️",title:"Harita Ustası",text:"Osmanlı Haritası'nı keşfet.",xp:350},
  {id:"historian",icon:"📚",title:"Tarih Bilgini",text:"5 doğru tarih cevabı ver.",xp:250},
  {id:"museum",icon:"🏛️",title:"Müze Kâşifi",text:"3D Müze veya Hazine Odası'nı ziyaret et.",xp:200},
  {id:"radio",icon:"📻",title:"Radyo Dinleyicisi",text:"Osmanlı Radyo Merkezi'ni kullan.",xp:150},
  {id:"escape",icon:"🔐",title:"Sırlar Ustası",text:"Escape Room'u tamamla.",xp:700},
  {id:"advisor",icon:"🤖",title:"AI Dostu",text:"AI danışmana soru sor.",xp:180}
];
function saveAchievementState(){localStorage.setItem("oa_achievements",JSON.stringify(achievementState))}
function unlockAchievement(id,bonus=0){
  if(!achievementState.unlocked.includes(id)){
    achievementState.unlocked.push(id);
    achievementState.xp+=bonus;
    achievementState.tasks++;
    saveAchievementState();
    if(typeof toast==="function")toast("Yeni rozet kazandın!");
  }
  renderV16Achievements();
}
function addAchievementXp(amount){
  achievementState.xp+=amount;
  saveAchievementState();
  renderV16Achievements();
}
function renderV16Achievements(){
  if(!$("#achievementGrid"))return;
  const level=Math.floor(achievementState.xp/500)+1;
  const within=achievementState.xp%500;
  $("#achievementLevelTitle").textContent=`Seviye ${level}`;
  $("#achievementXpText").textContent=`${within} / 500 XP`;
  $("#achievementXpFill").style.width=`${(within/500)*100}%`;
  $("#achievementTotalXp").textContent=achievementState.xp;
  $("#achievementBadgeCount").textContent=`${achievementState.unlocked.length} / ${achievementBadges.length}`;
  $("#achievementTaskCount").textContent=achievementState.tasks;
  $("#achievementPercent").textContent=`%${Math.round((achievementState.unlocked.length/achievementBadges.length)*100)}`;
  $("#achievementGrid").innerHTML=achievementBadges.map(b=>`
    <article class="achievement-badge ${achievementState.unlocked.includes(b.id)?"unlocked":"locked"}">
      <div class="badge-icon">${b.icon}</div><h3>${b.title}</h3><p>${b.text}</p><small>+${b.xp} XP</small>
    </article>`).join("");
  $("#achievementMissionText").textContent=`${achievementState.mission} / 5 tamamlandı`;
  $("#achievementMissionFill").style.width=`${Math.min(100,(achievementState.mission/5)*100)}%`;
  $("#achievementClaim").disabled=achievementState.mission<5||achievementState.unlocked.includes("historian");
}
$("#achievementClaim").onclick=()=>unlockAchievement("historian",250);
unlockAchievement("first_step",0);
renderV16Achievements();

// V16 — Escape Room
const escapeRooms=[
  {
    name:"Fetih Odası",
    puzzles:[
      {q:"İstanbul'un fethi hangi yılda gerçekleşti?",clue:"Fatih Sultan Mehmed dönemini düşün.",o:["1453","1299","1517","1526"],a:0,h:"Yıl 15. yüzyılın ortasındadır."},
      {q:"Boğaz kontrolü için hangi hisar yaptırıldı?",clue:"Adı Rumeli ile başlar.",o:["Anadolu Hisarı","Rumeli Hisarı","Yedikule","Topkapı"],a:1,h:"İstanbul Boğazı'nın Avrupa yakasındadır."},
      {q:"Haliç'e girişteki zincir nasıl aşıldı?",clue:"Gemiler denizden değil başka bir yoldan geçti.",o:["Tünel kazıldı","Gemiler karadan yürütüldü","Zincir yakıldı","Köprü yapıldı"],a:1,h:"Yağlı kızaklar kullanıldı."},
      {q:"Fetih sonunda surlara ne dikildi?",clue:"Zaferi simgeleyen işaret.",o:["Saat","Osmanlı sancağı","Çan","Taç"],a:1,h:"Kırmızı bir bayrak düşün."}
    ]
  },
  {
    name:"Saray Odası",
    puzzles:[
      {q:"Divan-ı Hümayun nerede toplanırdı?",clue:"Saray yönetim merkezi.",o:["Topkapı Sarayı","Rumeli Hisarı","Süleymaniye","Bursa Ulu Cami"],a:0,h:"İstanbul'daki büyük saray."},
      {q:"Padişah buyruğuna ne ad verilir?",clue:"Mühürlü resmî belge.",o:["Ferman","Akçe","Tuğ","Kaftan"],a:0,h:"Hazine Odası'nda da örneği var."}
    ]
  },
  {
    name:"Hazine Odası",
    puzzles:[
      {q:"Osmanlı altın parasına verilen adlardan biri nedir?",clue:"Fatih döneminde basılmıştır.",o:["Sultani","Dirhem","Kuruş","Lira"],a:0,h:"Adı sultan kelimesinden gelir."},
      {q:"Padişahın imzası niteliğindeki sembol nedir?",clue:"Belgelerin üst kısmında görülür.",o:["Tuğra","Mühür","Sancak","Miğfer"],a:0,h:"V15 giriş ekranında da kullanılıyor."}
    ]
  },
  {
    name:"Sırlar Odası",
    puzzles:[
      {q:"Osmanlı Beyliği'nin kuruluş yılı olarak kabul edilen tarih hangisidir?",clue:"Giriş ekranındaki büyük yılı hatırla.",o:["1299","1453","1512","1922"],a:0,h:"13. yüzyılın sonudur."},
      {q:"Osmanlı'nın kurucusu kimdir?",clue:"Hanedanın ilk hükümdarı.",o:["Osman Gazi","Orhan Gazi","I. Murad","Fatih Sultan Mehmed"],a:0,h:"Devlet onun adını taşır."}
    ]
  }
];
let escapeState={room:0,puzzle:0,score:0,hints:3,answered:false};
function renderEscape(){
  const room=escapeRooms[escapeState.room],p=room.puzzles[escapeState.puzzle];
  $("#escapeRoomName").textContent=room.name;
  $("#escapeScore").textContent=escapeState.score;
  $("#escapeHintCount").textContent=escapeState.hints;
  $("#escapePuzzleStep").textContent=`BULMACA ${escapeState.puzzle+1} / ${room.puzzles.length}`;
  $("#escapeQuestion").textContent=p.q;
  $("#escapeClue").textContent=p.clue;
  $("#escapeDoorLabel").textContent=room.name.toUpperCase();
  $("#escapeOptions").innerHTML=p.o.map((x,i)=>`<button class="escape-option" data-escape-option="${i}">${x}</button>`).join("");
  $("#escapeFeedback").textContent="";
  $("#escapeNext").disabled=true;
  escapeState.answered=false;
  $$(".escape-room-chip").forEach((b,i)=>{b.classList.toggle("active",i===escapeState.room);b.disabled=i>escapeState.room});
}
$("#escapeOptions").onclick=e=>{
  const b=e.target.closest("[data-escape-option]");if(!b||escapeState.answered)return;
  escapeState.answered=true;
  const p=escapeRooms[escapeState.room].puzzles[escapeState.puzzle];
  const chosen=Number(b.dataset.escapeOption);
  $$(".escape-option").forEach((x,i)=>{x.disabled=true;if(i===p.a)x.classList.add("correct")});
  if(chosen===p.a){
    b.classList.add("correct");
    escapeState.score+=100;
    achievementState.mission=Math.min(5,achievementState.mission+1);
    addAchievementXp(25);
    $("#escapeFeedback").textContent="Doğru! Kilidin bir parçası açıldı.";
  }else{
    b.classList.add("wrong");
    $("#escapeFeedback").textContent=`Yanlış. Doğru cevap: ${p.o[p.a]}`;
  }
  $("#escapeScore").textContent=escapeState.score;
  $("#escapeNext").disabled=false;
  saveAchievementState();
};
$("#escapeHint").onclick=()=>{
  if(escapeState.hints<=0)return;
  escapeState.hints--;
  $("#escapeHintCount").textContent=escapeState.hints;
  const p=escapeRooms[escapeState.room].puzzles[escapeState.puzzle];
  $("#escapeFeedback").textContent=`İpucu: ${p.h}`;
};
$("#escapeNext").onclick=()=>{
  const room=escapeRooms[escapeState.room];
  if(escapeState.puzzle<room.puzzles.length-1){
    escapeState.puzzle++;
    renderEscape();
  }else if(escapeState.room<escapeRooms.length-1){
    $("#escapeDoor").classList.add("open");
    setTimeout(()=>{
      $("#escapeDoor").classList.remove("open");
      escapeState.room++;
      escapeState.puzzle=0;
      renderEscape();
    },900);
  }else{
    $("#escapeDoor").classList.add("open");
    $("#escapeFeedback").innerHTML=`<b>Tebrikler!</b> Tüm odaları tamamladın. Toplam puan: ${escapeState.score}`;
    $("#escapeOptions").innerHTML="";
    $("#escapeNext").disabled=true;
    unlockAchievement("escape",700);
  }
};
$("#escapeRestart").onclick=()=>{
  escapeState={room:0,puzzle:0,score:0,hints:3,answered:false};
  $("#escapeDoor").classList.remove("open");
  renderEscape();
};
renderEscape();


// V17 — Yapay Zekâ Tarih Analizi
const historyAnalysisBank={
  rise:{
    title:"Osmanlı'nın Yükseliş Analizi",
    base:"Osmanlı'nın yükselişinde uygun coğrafi konum, güçlü liderlik, düzenli ordu, iskân politikası, esnek yönetim ve rakip devletlerin zayıflığı birlikte etkili oldu.",
    causes:["Bizans sınırında fetih imkânı","Gaza ve fetih motivasyonu","Tımar sistemi ve düzenli askerî yapı","Hoşgörülü ve esnek yerel yönetim","Başarılı hükümdarlar ve komutanlar"],
    effects:["Balkanlarda hızlı genişleme","Yeni başkentlerin kurulması","Vergi ve insan kaynağının artması","Merkezî devlet yapısının güçlenmesi"],
    scores:[88,82,72,68]
  },
  istanbul:{
    title:"İstanbul'un Fethinin Sonuçları",
    base:"İstanbul'un fethi Osmanlı'yı büyük bir imparatorluk hâline getirirken ticaret, siyaset, askerî teknoloji ve kültür alanlarında önemli sonuçlar doğurdu.",
    causes:["Boğazların kontrolü","Anadolu-Rumeli bağlantısı","Bizans'ın Osmanlı iç işlerine etkisi","Başkent ihtiyacı"],
    effects:["İstanbul başkent oldu","Osmanlı'nın itibarı arttı","Orta Çağ'ın sonu tartışmaları güçlendi","Ticaret yolları ve deniz siyaseti değişti"],
    scores:[94,90,76,88]
  },
  kanuni:{
    title:"Kanuni Döneminin Güç Analizi",
    base:"Kanuni döneminin gücü yalnızca fetihlerden değil; hukuk, diplomasi, mimari, mali yapı ve deniz gücünün birlikte işlemesinden kaynaklandı.",
    causes:["Uzun ve istikrarlı saltanat","Güçlü kara ordusu","Barbaros ile deniz gücü","Hukuk düzenlemeleri","Mimar Sinan ve kültürel üretim"],
    effects:["Avrupa siyasetinde belirleyici güç","Akdeniz'de üstünlük","Klasik Osmanlı kurumlarının olgunlaşması","Mimari ve sanatın zirveye ulaşması"],
    scores:[96,92,80,95]
  },
  reform:{
    title:"Reformların Zorlanma Analizi",
    base:"Osmanlı reformları çoğu zaman çıkar gruplarının direnci, mali yetersizlik, savaş baskısı ve yeniliklerin toplumun tüm kesimlerine aynı hızda anlatılamaması nedeniyle zorlandı.",
    causes:["Yeniçeri ve çıkar çevrelerinin direnci","Yetersiz mali kaynak","Sık savaşlar","Merkez-taşra uyumsuzluğu","Reformların süreklilik kazanamaması"],
    effects:["Reformların yavaşlaması","Kısmi başarılar","Yeni kurumların eski kurumlarla çatışması","Modernleşme fikrinin sonraki dönemlere aktarılması"],
    scores:[58,61,55,70]
  },
  decline:{
    title:"Gerileme Sürecinin Çok Boyutlu Analizi",
    base:"Gerileme tek bir nedene bağlanamaz. Askerî teknoloji, mali yapı, yönetim, eğitim, ticaret yolları ve Avrupa'daki dönüşümler birlikte etkili oldu.",
    causes:["Askerî teknolojide geride kalma","Mali açıklar ve uzun savaşlar","Merkezî otorite sorunları","Tımar sisteminin bozulması","Avrupa'daki bilimsel ve ekonomik dönüşümler"],
    effects:["Toprak kayıpları","Vergi baskısının artması","Islahat ihtiyacının güçlenmesi","Devlet yapısında yeniden düzenleme arayışı"],
    scores:[52,48,44,60]
  }
};
function buildHistoryAnalysis(topic,mode,level,question){
  const data=historyAnalysisBank[topic]||historyAnalysisBank.rise;
  let html=`<p>${data.base}</p>`;
  if(mode==="cause"){
    html+=`<h4>Başlıca Nedenler</h4><ul>${data.causes.map(x=>`<li>${x}</li>`).join("")}</ul><h4>Başlıca Sonuçlar</h4><ul>${data.effects.map(x=>`<li>${x}</li>`).join("")}</ul>`;
  }else if(mode==="swot"){
    html+=`<h4>Güçlü Yönler</h4><ul>${data.causes.slice(0,3).map(x=>`<li>${x}</li>`).join("")}</ul><h4>Zayıf / Riskli Yönler</h4><ul>${data.effects.slice(-2).map(x=>`<li>${x}</li>`).join("")}</ul>`;
  }else if(mode==="compare"){
    html+=`<h4>Karşılaştırmalı Bakış</h4><p>Askerî başarılar kısa vadede büyümeyi hızlandırırken, yönetim ve ekonomi uzun vadede kalıcılığı belirledi. Kültür ise meşruiyet ve ortak kimlik oluşturdu.</p><ul>${data.causes.map((x,i)=>`<li>${x}: ${["kısa vadeli","orta vadeli","uzun vadeli"][i%3]} etki</li>`).join("")}</ul>`;
  }else{
    html+=`<h4>Kronolojik Akış</h4><ol>${[...data.causes,...data.effects].map(x=>`<li>${x}</li>`).join("")}</ol>`;
  }
  if(level==="simple")html=`<p>${data.base}</p><ul>${data.causes.slice(0,3).map(x=>`<li>${x}</li>`).join("")}</ul>`;
  if(level==="advanced")html+=`<h4>Analitik Sonuç</h4><p>Bu konu askerî, idarî, ekonomik ve kültürel değişkenlerin birbirini etkilediği çok nedenli bir süreçtir. Tek bir açıklama yeterli değildir.</p>`;
  if(question)html+=`<h4>Senin Sorun</h4><p>${escapeHtml(question)} sorusu bu çerçevede değerlendirildi.</p>`;
  return {data,html};
}
function runHistoryAnalysis(){
  let topic=$("#historyAnalysisTopic").value;
  const mode=$("#historyAnalysisMode").value,level=$("#historyAnalysisLevel").value,q=$("#historyAnalysisQuestion").value.trim();
  if(topic==="custom"){
    const t=q.toLocaleLowerCase("tr-TR");
    if(t.includes("istanbul"))topic="istanbul";
    else if(t.includes("kanuni"))topic="kanuni";
    else if(t.includes("reform")||t.includes("ıslahat"))topic="reform";
    else if(t.includes("gerile")||t.includes("çök"))topic="decline";
    else topic="rise";
  }
  const result=buildHistoryAnalysis(topic,mode,level,q);
  const confidence=Math.min(98,74+(q?8:0)+(topic!=="rise"?5:0));
  $("#analysisConfidence").textContent=`%${confidence}`;
  $("#analysisConfidenceText").textContent=confidence>90?"Konu ve bilgi tabanı eşleşmesi çok güçlü.":"Konu, yerel tarih bilgi tabanıyla eşleştirildi.";
  $("#analysisTitle").textContent=result.data.title;
  $("#analysisOutput").innerHTML=result.html;
  const [m,a,e,c]=result.data.scores;
  [["Military",m],["Admin",a],["Economy",e],["Culture",c]].forEach(([id,val])=>{$(`#analysis${id}`).style.width=`${val}%`;$(`#analysis${id}Value`).textContent=val});
  $("#analysisRecommendations").innerHTML=[
    ["Haritada ilgili dönemi aç","ottomanmap"],
    ["Padişahla konuş","chat"],
    ["Zaman çizelgesini incele","timeline"]
  ].map(([t,p])=>`<button data-analysis-jump="${p}">${t}</button>`).join("");
  if(typeof addAchievementXp==="function")addAchievementXp(40);
}
$("#runHistoryAnalysis").onclick=runHistoryAnalysis;
$("#historyAnalysisQuestion").onkeydown=e=>{if(e.key==="Enter")runHistoryAnalysis()};
$("#historyAnalysisTopic").onchange=e=>{if(e.target.value!=="custom")$("#historyAnalysisQuestion").value=""};
$("#analysisRecommendations").onclick=e=>{const b=e.target.closest("[data-analysis-jump]");if(b)page(b.dataset.analysisJump)};

// V17 — Savaş Taktiği
const battleUnitData={
  infantry:{name:"Piyade",icon:"⚔️",power:6,range:2,speed:4},
  archer:{name:"Okçu",icon:"🏹",power:5,range:8,speed:3},
  cavalry:{name:"Süvari",icon:"🐎",power:8,range:2,speed:9},
  artillery:{name:"Topçu",icon:"💣",power:10,range:9,speed:1},
  navy:{name:"Donanma",icon:"⛵",power:9,range:7,speed:6}
};
const battleScenarioData={
  siege:{objective:"🏰",allowed:["infantry","archer","cavalry","artillery"],ideal:{artillery:2,infantry:3,archer:2,cavalry:1},text:"Kale kuşatmasında topçu ve piyade dengesi önemlidir."},
  field:{objective:"🚩",allowed:["infantry","archer","cavalry","artillery"],ideal:{cavalry:3,infantry:3,archer:2,artillery:1},text:"Açık alanda hareket kabiliyeti ve kanat süvarileri belirleyicidir."},
  river:{objective:"🌉",allowed:["infantry","archer","cavalry","artillery"],ideal:{archer:3,infantry:3,cavalry:1,artillery:1},text:"Nehir geçişinde uzak menzil koruması ve düzenli piyade gerekir."},
  naval:{objective:"⚓",allowed:["navy","archer","artillery"],ideal:{navy:4,archer:2,artillery:2},text:"Deniz savaşında donanma ana güçtür; menzilli destek gerekir."}
};
let battleSelectedUnit="infantry";
let battlePlacements=[];
function buildBattleBoard(){
  $("#battleBoard").querySelectorAll(".battle-cell").forEach(x=>x.remove());
  for(let i=0;i<80;i++){
    const c=document.createElement("button");
    c.className="battle-cell";c.dataset.cell=i;
    $("#battleBoard").appendChild(c);
  }
}
function renderBattleScenario(){
  const sc=$("#battleScenarioSelect").value,data=battleScenarioData[sc];
  $("#battleObjective").textContent=data.objective;
  $("#battleRiver").classList.toggle("hidden",sc!=="river");
  $("#battleSea").classList.toggle("hidden",sc!=="naval");
  $$(".battle-unit").forEach(b=>{b.disabled=!data.allowed.includes(b.dataset.unit);b.classList.toggle("active",b.dataset.unit===battleSelectedUnit)});
  battlePlacements=[];renderBattlePieces();
  $("#battleScore").textContent="0";$("#battleAnalysisTitle").textContent="Taktiğini kur";$("#battleAnalysisText").textContent=data.text;$("#battleAdviceTags").innerHTML="";
}
function renderBattlePieces(){
  $$(".battle-cell").forEach(c=>c.innerHTML="");
  battlePlacements.forEach(p=>{
    const d=battleUnitData[p.unit],c=document.querySelector(`.battle-cell[data-cell="${p.cell}"]`);
    if(c)c.innerHTML=`<div class="battle-piece">${d.icon}<small>${d.name}</small></div>`;
  });
}
function analyzeBattle(){
  const sc=$("#battleScenarioSelect").value,diff=$("#battleDifficulty").value,data=battleScenarioData[sc];
  const counts={};battlePlacements.forEach(p=>counts[p.unit]=(counts[p.unit]||0)+1);
  let score=20,advice=[];
  Object.entries(data.ideal).forEach(([u,n])=>{
    const have=counts[u]||0;
    score+=Math.min(have,n)*12;
    if(have<n)advice.push(`${battleUnitData[u].name} eksik`);
  });
  if(battlePlacements.length>=6)score+=8;
  if(diff==="hard")score-=10;if(diff==="easy")score+=8;
  score=Math.max(0,Math.min(100,score));
  $("#battleScore").textContent=score;
  $("#battleAnalysisTitle").textContent=score>=80?"Güçlü Taktik":score>=60?"Dengeli Taktik":score>=40?"Riskli Taktik":"Zayıf Taktik";
  $("#battleAnalysisText").textContent=score>=80?`${data.text} Birlik dağılımın hedefe uygun ve dengeli.`:score>=60?`${data.text} Plan kullanılabilir; bazı destek birlikleri artırılmalı.`:`${data.text} Birlik dağılımı hedefe göre yetersiz veya dengesiz.`;
  if(!advice.length)advice=["Denge iyi","Hedefe uygun","Yedek birlik bırak"];
  $("#battleAdviceTags").innerHTML=advice.slice(0,4).map(x=>`<span>${x}</span>`).join("");
  if(typeof addAchievementXp==="function")addAchievementXp(Math.max(20,Math.round(score/2)));
}
buildBattleBoard();
$("#battleUnitPalette").onclick=e=>{const b=e.target.closest("[data-unit]");if(!b||b.disabled)return;battleSelectedUnit=b.dataset.unit;$("#battleSelectedUnit").textContent=battleUnitData[battleSelectedUnit].name;$$(".battle-unit").forEach(x=>x.classList.toggle("active",x===b))};
$("#battleBoard").onclick=e=>{const c=e.target.closest(".battle-cell");if(!c)return;const idx=battlePlacements.findIndex(p=>p.cell===Number(c.dataset.cell));if(idx>=0)battlePlacements.splice(idx,1);else battlePlacements.push({cell:Number(c.dataset.cell),unit:battleSelectedUnit});renderBattlePieces()};
$("#battleScenarioSelect").onchange=renderBattleScenario;
$("#battleReset").onclick=renderBattleScenario;
$("#battleAnalyze").onclick=analyzeBattle;
renderBattleScenario();


const v18PlayerMeta=JSON.parse(localStorage.getItem("oa_player_meta")||'{"coins":0,"dailyTasks":0,"analysisCount":0,"tacticsCount":0,"escapeScore":0}');
function v18SavePlayerMeta(){localStorage.setItem("oa_player_meta",JSON.stringify(v18PlayerMeta))}
function v18AddCoins(amount){v18PlayerMeta.coins+=amount;v18SavePlayerMeta();v18RenderPalace()}

const v18OriginalRunHistoryAnalysis=runHistoryAnalysis;
runHistoryAnalysis=function(){v18OriginalRunHistoryAnalysis();v18PlayerMeta.analysisCount++;v18SavePlayerMeta();v18UpdateDailyMission("analysis",1);v18RenderPalace()};
const v18OriginalAnalyzeBattle=analyzeBattle;
analyzeBattle=function(){v18OriginalAnalyzeBattle();v18PlayerMeta.tacticsCount++;v18SavePlayerMeta();v18UpdateDailyMission("tactics",1);v18RenderPalace()};

const v18TodayKey=new Date().toISOString().slice(0,10);
const v18DefaultDailyState={date:v18TodayKey,streak:1,claimed:false,missions:[
  {id:"analysis",icon:"🧠",title:"Tarih Analizi Yap",text:"Yapay Zekâ Tarih Analizi bölümünde bir rapor oluştur.",target:1,progress:0,xp:80,coins:30},
  {id:"tactics",icon:"♟️",title:"Taktiğini Sına",text:"Savaş Taktiği bölümünde bir planı analiz et.",target:1,progress:0,xp:90,coins:35},
  {id:"explore",icon:"🗺️",title:"Bir Bölüm Keşfet",text:"Harita, Müze, Radyo veya Zaman Kapısı bölümlerinden birini ziyaret et.",target:1,progress:0,xp:70,coins:25}
]};
let v18DailyState=JSON.parse(localStorage.getItem("oa_daily_state")||"null")||JSON.parse(JSON.stringify(v18DefaultDailyState));
if(v18DailyState.date!==v18TodayKey){
  const v18Yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
  const v18Old=v18DailyState;
  v18DailyState=JSON.parse(JSON.stringify(v18DefaultDailyState));
  v18DailyState.streak=v18Old.date===v18Yesterday?(Number(v18Old.streak)||1)+1:1;
}
function v18SaveDaily(){localStorage.setItem("oa_daily_state",JSON.stringify(v18DailyState))}
function v18UpdateDailyMission(id,amount=1){
  const m=v18DailyState.missions.find(x=>x.id===id);if(!m)return;
  const before=m.progress;
  m.progress=Math.min(m.target,m.progress+amount);
  if(before<m.target&&m.progress>=m.target){
    if(typeof addAchievementXp==="function")addAchievementXp(m.xp);
    v18AddCoins(m.coins);
    v18PlayerMeta.dailyTasks++;
    v18SavePlayerMeta();
    if(typeof toast==="function")toast(`Günlük görev tamamlandı: ${m.title}`);
  }
  v18SaveDaily();v18RenderDailyMissions();v18RenderPalace();
}
function v18RenderDailyMissions(){
  if(!$("#dailyMissionGrid"))return;
  const done=v18DailyState.missions.filter(m=>m.progress>=m.target).length;
  $("#dailyDateLabel").textContent=new Date().toLocaleDateString("tr-TR",{day:"2-digit",month:"long"});
  $("#dailyStreak").textContent=`${v18DailyState.streak} gün`;
  $("#dailyProgressText").textContent=`${done} / ${v18DailyState.missions.length}`;
  $("#dailyEarnedCoins").textContent=v18DailyState.missions.filter(m=>m.progress>=m.target).reduce((s,m)=>s+m.coins,0);
  $("#dailyMissionGrid").innerHTML=v18DailyState.missions.map(m=>`<article class="daily-mission-card ${m.progress>=m.target?"complete":""}"><div class="mission-icon">${m.icon}</div><h3>${m.title}</h3><p>${m.text}</p><div class="mission-progress-bar"><i style="width:${Math.min(100,(m.progress/m.target)*100)}%"></i></div><b>${m.progress} / ${m.target}</b><div class="mission-reward"><span>⭐ ${m.xp} XP</span><span>🪙 ${m.coins} Akçe</span></div></article>`).join("");
  const allDone=done===v18DailyState.missions.length;
  $("#dailyChestVisual").classList.toggle("ready",allDone&&!v18DailyState.claimed);
  $("#claimDailyChest").disabled=!allDone||v18DailyState.claimed;
  $("#dailyChestTitle").textContent=v18DailyState.claimed?"Günlük sandık açıldı":allDone?"Sandık hazır!":"3 görevi tamamla";
  $("#dailyChestText").textContent=v18DailyState.claimed?"Yarın yeni görevler ve ödüller gelecek.":"Tüm görevleri tamamlayınca 250 XP ve 100 akçe kazanırsın.";
}
$("#claimDailyChest").onclick=()=>{if(v18DailyState.claimed)return;v18DailyState.claimed=true;if(typeof addAchievementXp==="function")addAchievementXp(250);v18AddCoins(100);v18SaveDaily();v18RenderDailyMissions();toast("Günlük ödül sandığı açıldı!")};
v18RenderDailyMissions();

const v18OriginalPage=page;
page=function(id){v18OriginalPage(id);if(["ottomanmap","museum3d","tv","timegate","treasury"].includes(id))v18UpdateDailyMission("explore",1);if(id==="mypalace")v18RenderPalace();if(id==="dailymissions")v18RenderDailyMissions()};

const v18PalaceRooms=[
  {icon:"👑",title:"Taht Odası",text:"Sarayının ana salonu.",need:0},
  {icon:"📚",title:"Saray Kütüphanesi",text:"Tarih analizleri ve bilgi arşivi.",need:500},
  {icon:"💎",title:"Hazine Dairesi",text:"Akçeler ve eser koleksiyonu.",need:1000},
  {icon:"♟️",title:"Sefer Odası",text:"Savaş taktikleri ve simülasyonlar.",need:1500},
  {icon:"🌿",title:"Has Bahçe",text:"Yüksek seviyede açılan özel oda.",need:2500},
  {icon:"☬",title:"Hünkâr Dairesi",text:"En yüksek saray seviyesi.",need:4000}
];
function v18PalaceRank(xp){if(xp>=4000)return"Hünkâr Tarihçisi";if(xp>=2500)return"Saray Âlimi";if(xp>=1500)return"Baş Tarihçi";if(xp>=750)return"Osmanlı Uzmanı";if(xp>=300)return"Tarih Meraklısı";return"Çaylak Tarihçi"}
function v18RenderPalace(){
  if(!$("#palaceRoomGrid"))return;
  const xp=typeof achievementState!=="undefined"?achievementState.xp:0;
  const badges=typeof achievementState!=="undefined"?achievementState.unlocked:[];
  const level=Math.floor(xp/500)+1,within=xp%500;
  $("#palaceTitle").textContent=v18PalaceRank(xp);$("#palaceLevelFill").style.width=`${(within/500)*100}%`;$("#palaceLevelText").textContent=`Seviye ${level} • ${xp} XP`;
  $("#palaceCoins").textContent=v18PlayerMeta.coins;$("#palaceBadgeCount").textContent=badges.length;
  $("#palaceRoomGrid").innerHTML=v18PalaceRooms.map(r=>`<article class="palace-room-card ${xp>=r.need?"unlocked":"locked"}"><div class="room-icon">${r.icon}</div><h3>${r.title}</h3><p>${r.text}</p><small>${xp>=r.need?"Açıldı":`${r.need} XP gerekli`}</small></article>`).join("");
  $("#palaceBadgeShowcase").innerHTML=badges.length?badges.slice(0,8).map(id=>{const b=achievementBadges.find(x=>x.id===id);return b?`<div class="palace-badge-mini" title="${b.title}">${b.icon}</div>`:""}).join(""):'<p class="muted">Henüz rozet kazanılmadı.</p>';
  $("#palaceDailyTasks").textContent=v18PlayerMeta.dailyTasks;$("#palaceEscapeScore").textContent=v18PlayerMeta.escapeScore;$("#palaceAnalysisCount").textContent=v18PlayerMeta.analysisCount;$("#palaceTacticsCount").textContent=v18PlayerMeta.tacticsCount;
}
v18RenderPalace();


// V19 — Yapay Zekâ Komutan
const commanderMissions=[
  {
    title:"Trabzon Seferi",
    brief:"Karadeniz kıyısındaki Trabzon'u Osmanlı hâkimiyetine katmak için orduyu güvenli biçimde ilerlet.",
    difficulty:"Normal",rewardXp:350,rewardCoins:120,location:"Trabzon",target:"🏰",
    decisions:[
      {q:"Dağlık arazide ilerlerken ilk önceliğin ne olmalı?",s:"Yollar dar, ikmal zor ve hava değişken.",o:["Keşif birlikleri gönder","Bütün orduyu hızla ileri sür","İkmal kollarını geride bırak","Haritasız ilerle"],a:0,m:10,sup:10,f:"Keşif birlikleri güvenli güzergâhı belirledi."},
      {q:"Kuşatma öncesinde hangi hazırlık daha önemlidir?",s:"Şehir güçlü surlarla korunuyor.",o:["Topçu ve ikmal düzeni kur","Yalnızca süvari kullan","Donanmayı uzaklaştır","Beklemeden saldır"],a:0,m:10,sup:5,f:"Topçu ve ikmal düzeni kuşatma gücünü artırdı."},
      {q:"Son hücum nasıl yapılmalı?",s:"Surlar zayıfladı fakat savunma devam ediyor.",o:["Koordineli kara-deniz baskısı","Plansız tek hücum","Geri çekil","Bütün birlikleri tek kapıya yığ"],a:0,m:15,sup:-5,f:"Koordineli baskı savunmayı çözdü."}
    ]
  },
  {
    title:"Belgrad Seferi",
    brief:"Orta Avrupa yolunun kilidi olan Belgrad'a ilerle ve kuşatmayı yönet.",
    difficulty:"Zor",rewardXp:450,rewardCoins:150,location:"Belgrad",target:"🏯",
    decisions:[
      {q:"Nehir geçişinde nasıl güvenlik sağlarsın?",s:"Düşman okçuları karşı kıyıda bekliyor.",o:["Okçu desteğiyle köprübaşı kur","Süvariyi tek başına geçir","Gece meşalelerle ilerle","Topçuyu geride bırak"],a:0,m:5,sup:10,f:"Köprübaşı güvenli biçimde kuruldu."},
      {q:"Kaleye yaklaşırken hangi birlik öne çıkmalı?",s:"Açık araziden sonra güçlü surlar başlıyor.",o:["Topçu ve koruyucu piyade","Sadece süvari","Sadece okçu","İkmalsiz birlikler"],a:0,m:10,sup:0,f:"Topçu koruma altında mevzilendi."},
      {q:"Teslim çağrısına yanıt gelmezse ne yaparsın?",s:"Savunma sürüyor, fakat moral düşmüş durumda.",o:["Kontrollü hücum ve kuşatma baskısı","Şehri tamamen terk et","Bütün mühimmatı tek seferde kullan","Orduyu böl"],a:0,m:10,sup:-10,f:"Kontrollü hücum başarıya ulaştı."}
    ]
  },
  {
    title:"Hicaz Demiryolu Güvenliği",
    brief:"Demiryolu hattının güvenliğini sağla, ikmal merkezlerini koru ve hattı Medine'ye ulaştır.",
    difficulty:"Normal",rewardXp:300,rewardCoins:140,location:"Hicaz",target:"🚂",
    decisions:[
      {q:"Çöl hattında ilk lojistik karar ne olmalı?",s:"Su kaynakları sınırlı ve mesafeler uzun.",o:["Su ve ikmal istasyonları kur","Hattı plansız ilerlet","İşçileri dağıt","Malzemeyi tek noktada bırak"],a:0,m:10,sup:15,f:"İkmal istasyonları hattın sürekliliğini sağladı."},
      {q:"Hattı korumak için hangi yöntem daha uygundur?",s:"Bazı bölgelerde güvenlik riski var.",o:["Yerel güvenlik birlikleri ve haberleşme","Bütün hattı kapat","Trenleri durdur","Tek merkezden kontrol"],a:0,m:10,sup:5,f:"Haberleşme ve yerel güvenlik ağı kuruldu."},
      {q:"Son aşamada öncelik ne olmalı?",s:"Raylar hedefe çok yaklaştı.",o:["Köprü ve ray denetimi","Hızı artırıp kontrolleri bırak","İkmali kes","İşçileri geri çek"],a:0,m:5,sup:10,f:"Denetimler tamamlandı ve hat güvenle ilerledi."}
    ]
  }
];

let commanderState={mission:0,step:0,score:0,morale:70,supply:70,accepted:false,completed:false,rewardClaimed:false};

function currentCommanderMission(){return commanderMissions[commanderState.mission]}

function renderCommanderMission(){
  const m=currentCommanderMission();
  $("#commanderMissionTitle").textContent=m.title;
  $("#commanderMissionBrief").textContent=m.brief;
  $("#commanderDifficulty").textContent=`Zorluk: ${m.difficulty}`;
  $("#commanderReward").textContent=`Ödül: ${m.rewardXp} XP + ${m.rewardCoins} Akçe`;
  $("#commanderLocation").textContent=`Konum: ${m.location}`;
  $("#commanderTarget").textContent=m.target;
  $("#commanderMapLabel").textContent=`Hedef: ${m.location}`;
  $("#commanderDecisionPanel").classList.toggle("hidden",!commanderState.accepted||commanderState.completed);
  $("#commanderResult").classList.toggle("hidden",!commanderState.completed);
  renderCommanderProgress();
  if(commanderState.accepted&&!commanderState.completed)renderCommanderDecision();
}

function renderCommanderDecision(){
  const m=currentCommanderMission(),d=m.decisions[commanderState.step];
  $("#commanderQuestion").textContent=d.q;
  $("#commanderSituation").textContent=d.s;
  $("#commanderOptions").innerHTML=d.o.map((x,i)=>`<button class="commander-option" data-commander-option="${i}">${x}</button>`).join("");
  $("#commanderFeedback").textContent="";
  $("#commanderNextDecision").disabled=true;
}

function renderCommanderProgress(){
  const total=currentCommanderMission().decisions.length;
  $("#commanderProgressFill").style.width=`${(commanderState.step/total)*100}%`;
  $("#commanderProgressText").textContent=`${commanderState.step} / ${total}`;
  $("#commanderScore").textContent=commanderState.score;
  $("#commanderMorale").textContent=commanderState.morale;
  $("#commanderSupply").textContent=commanderState.supply;
}

function commanderSpeak(text){
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);
  u.lang="tr-TR";u.rate=.92;u.pitch=.87;
  u.onstart=()=>$("#commanderPortrait").classList.add("speaking");
  u.onend=()=>$("#commanderPortrait").classList.remove("speaking");
  u.onerror=()=>$("#commanderPortrait").classList.remove("speaking");
  speechSynthesis.speak(u);
}

$("#commanderSpeak").onclick=()=>{
  const m=currentCommanderMission();
  commanderSpeak(`${m.title}. ${m.brief}. Görev yeri ${m.location}.`);
};

$("#commanderAccept").onclick=()=>{
  commanderState.accepted=true;
  commanderState.step=0;commanderState.score=0;commanderState.morale=70;commanderState.supply=70;
  commanderState.completed=false;commanderState.rewardClaimed=false;
  $("#commanderAccept").disabled=true;
  renderCommanderMission();
  commanderSpeak("Görev kabul edildi. Kararlarını dikkatle ver.");
};

$("#commanderNewMission").onclick=()=>{
  commanderState.mission=(commanderState.mission+1)%commanderMissions.length;
  commanderState.step=0;commanderState.score=0;commanderState.morale=70;commanderState.supply=70;
  commanderState.accepted=false;commanderState.completed=false;commanderState.rewardClaimed=false;
  $("#commanderAccept").disabled=false;
  renderCommanderMission();
};

$("#commanderOptions").onclick=e=>{
  const b=e.target.closest("[data-commander-option]");
  if(!b)return;
  const d=currentCommanderMission().decisions[commanderState.step],choice=Number(b.dataset.commanderOption);
  $$(".commander-option").forEach((x,i)=>{x.disabled=true;if(i===d.a)x.classList.add("correct")});
  if(choice===d.a){
    b.classList.add("correct");
    commanderState.score+=100;
    commanderState.morale=Math.min(100,commanderState.morale+d.m);
    commanderState.supply=Math.min(100,commanderState.supply+d.sup);
    $("#commanderFeedback").textContent=d.f;
  }else{
    b.classList.add("wrong");
    commanderState.score+=25;
    commanderState.morale=Math.max(0,commanderState.morale-10);
    commanderState.supply=Math.max(0,commanderState.supply-8);
    $("#commanderFeedback").textContent=`Riskli karar. En uygun seçenek: ${d.o[d.a]}`;
  }
  $("#commanderNextDecision").disabled=false;
  renderCommanderProgress();
};

$("#commanderNextDecision").onclick=()=>{
  const m=currentCommanderMission();
  if(commanderState.step<m.decisions.length-1){
    commanderState.step++;
    renderCommanderDecision();
    renderCommanderProgress();
  }else{
    commanderState.step=m.decisions.length;
    commanderState.completed=true;
    $("#commanderDecisionPanel").classList.add("hidden");
    $("#commanderResult").classList.remove("hidden");
    const success=commanderState.score>=250;
    $("#commanderResultTitle").textContent=success?"Sefer Başarıyla Tamamlandı":"Sefer Tamamlandı";
    $("#commanderResultText").textContent=success
      ?`${m.location} görevi başarıyla sonuçlandı. Strateji puanın ${commanderState.score}.`
      :`Görev tamamlandı fakat kararların geliştirilebilir. Strateji puanın ${commanderState.score}.`;
    renderCommanderProgress();
    commanderSpeak($("#commanderResultText").textContent);
  }
};

$("#commanderClaimReward").onclick=()=>{
  if(commanderState.rewardClaimed)return;
  commanderState.rewardClaimed=true;
  const m=currentCommanderMission();
  if(typeof addAchievementXp==="function")addAchievementXp(m.rewardXp);
  if(typeof v18AddCoins==="function")v18AddCoins(m.rewardCoins);
  if(typeof toast==="function")toast(`${m.rewardXp} XP ve ${m.rewardCoins} akçe kazanıldı`);
  $("#commanderClaimReward").disabled=true;
  $("#commanderClaimReward").textContent="Ödül Alındı";
};

renderCommanderMission();

try{fillEraFilter();renderEncyclopedia();renderTimeline();fillCompare();renderGlossary();startQuiz();updateStats()}catch(startError){console.error("İsteğe bağlı bölüm başlatma hatası:",startError)}
loadModel().catch(()=>{});
if("serviceWorker" in navigator){
  navigator.serviceWorker.getRegistrations()
    .then(regs=>Promise.all(regs.map(reg=>reg.unregister())))
    .catch(console.warn);
}
// Eski sürüm önbelleğini temizle
if("caches" in window){
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k.startsWith("oa-")).map(k=>caches.delete(k))))
    .catch(console.warn);
}

console.log("Osmanlı AI MODEL FIX yüklendi");

console.log("Osmanlı AI Seçme Şovu v4.0 yüklendi");

if(appLang==="en"){
  const originalToast=toast;
  const toastMap={"36 sınıflı model hazır":"36-class model ready","Model henüz hazır değil":"Model is not ready yet",
  "Analiz sırasında hata oluştu":"An error occurred during analysis","Geçmiş temizlendi":"History cleared",
  "Jüri modu tamamlandı":"Jury mode completed","Önce bir konu yaz":"Write a topic first",
  "Önce ferman oluştur":"Create an edict first","Görev tamamlandı.":"Mission completed."};
  toast=function(t){originalToast(toastMap[t]||t)};
}


// V24 Character Creator
const playerCharacter=JSON.parse(localStorage.getItem("oa_player_character")||"null");
function renderPlayerCharacter(){const c=JSON.parse(localStorage.getItem("oa_player_character")||"null");const box=$("#characterSummary");if(!box)return;if(!c){box.innerHTML='<p>Henüz karakter oluşturulmadı.</p>';return;}box.innerHTML=`<div class="character-summary-icon">${c.icon}</div><div><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.role)} • ${escapeHtml(c.city)}</small><span id="characterCurrentRank"></span></div>`;renderCareer()}
function openCharacterCreator(){const m=$("#characterCreatorModal");if(m)m.classList.remove("hidden")}
function closeCharacterCreator(){const m=$("#characterCreatorModal");if(m)m.classList.add("hidden")}
document.addEventListener("click",e=>{if(e.target.closest("#openCharacterCreator"))openCharacterCreator();if(e.target.closest("#closeCharacterCreator")||e.target.id==="characterCreatorModal")closeCharacterCreator()});
const characterForm=$("#characterCreatorForm");if(characterForm)characterForm.addEventListener("submit",e=>{e.preventDefault();const fd=new FormData(characterForm);const c={name:String(fd.get("name")||"Zaman Yolcusu").trim().slice(0,24),role:String(fd.get("role")||"Akıncı"),city:String(fd.get("city")||"İstanbul"),icon:String(fd.get("icon")||"🧑🏻")};localStorage.setItem("oa_player_character",JSON.stringify(c));renderPlayerCharacter();closeCharacterCreator();toast("Karakterin oluşturuldu!")});
document.addEventListener("DOMContentLoaded",()=>{renderPlayerCharacter();renderCareer()});
