(()=>{
"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function openPage(id){const nav=document.querySelector(`.nav[data-page="${id}"]`);if(nav){nav.click();return;}$$('.page').forEach(p=>p.classList.toggle('active',p.id===id));}
$$('[data-nexus-open]').forEach(el=>el.addEventListener('click',e=>{if(e.target.closest('button')||el.classList.contains('nexus-card'))openPage(el.dataset.nexusOpen)}));

// Infinity açılışı ve altın parçacıklar — hiçbir zaman uygulamayı kilitlemez.
const intro=$('#nexusIntro');
if(intro){
  const seen=sessionStorage.getItem('oa_nexus_intro');
  if(seen){intro.remove();}else{
    sessionStorage.setItem('oa_nexus_intro','1');
    setTimeout(()=>intro.classList.add('leave'),1250);
    setTimeout(()=>intro.remove(),1950);
  }
}
const particleHost=$('#nexusParticles');
if(particleHost && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  for(let i=0;i<28;i++){
    const p=document.createElement('i');p.style.setProperty('--x',`${Math.random()*100}vw`);p.style.setProperty('--d',`${8+Math.random()*12}s`);p.style.setProperty('--delay',`${-Math.random()*14}s`);p.style.setProperty('--size',`${2+Math.random()*4}px`);particleHost.appendChild(p);
  }
}

const experts={
 danisman:{name:'Padişah Danışmanı',icon:'👑',lead:'Devletin uzun vadeli menfaatini, adaleti, halkı ve kurumların dengesini birlikte değerlendirir.'},
 tarihci:{name:'Tarihçi',icon:'📜',lead:'Olayı kronoloji, kaynak, sebep ve sonuç bağlantılarıyla inceler.'},
 stratejist:{name:'Stratejist',icon:'⚔️',lead:'Tarihî askerî hedefleri, lojistiği, coğrafyayı ve kararların sonuçlarını değerlendirir.'},
 osmanlica:{name:'Osmanlıca Uzmanı',icon:'🕌',lead:'Metni Osmanlı Türkçesi üslubuna yaklaştırır ve eski kelimeleri günümüz Türkçesiyle açıklar.'},
 sanatci:{name:'Sanatçı',icon:'🎨',lead:'Minyatür, hat, tezhip, çini ve dönem estetiğine uygun yaratıcı bir tasvir hazırlar.'},
 mimar:{name:'Mimarlık Uzmanı',icon:'🏛️',lead:'Yapıları, şehir düzenini, malzemeyi, oranı ve Osmanlı mimari anlayışını açıklar.'}
};
let expert='danisman';
function selectExpert(key){expert=experts[key]?key:'danisman';$$('[data-expert]').forEach(b=>b.classList.toggle('active',b.dataset.expert===expert));$('#brainExpertName').textContent=experts[expert].name;$('#brainExpertIcon').textContent=experts[expert].icon;}
$$('[data-expert]').forEach(b=>b.addEventListener('click',()=>selectExpert(b.dataset.expert)));
$$('[data-brain-q]').forEach(b=>b.addEventListener('click',()=>{$('#brainQuestion').value=b.dataset.brainQ}));
const knowledge=[
 {keys:['1453','istanbul','fetih'],title:'İstanbul’un Fethi',facts:['Osmanlı için siyasî birlik ve boğazların denetimi açısından stratejik bir hedefti.','Hazırlıkta Rumeli Hisarı, güçlü toplar, donanma ve kuşatma planı birlikte kullanıldı.','Fetih, Bizans İmparatorluğu’nun sona ermesine ve İstanbul’un Osmanlı başkenti hâline gelmesine yol açtı.']},
 {keys:['kanuni','süleyman','mohaç'],title:'Kanuni Dönemi',facts:['Merkezî idare, hukuk düzeni, diplomasi ve askerî seferler aynı dönemde güç kazandı.','Belgrad, Rodos ve Mohaç gibi gelişmeler Osmanlı’nın Avrupa’daki etkisini artırdı.','Mimari ve sanat alanında Mimar Sinan’ın eserleri dönemin kalıcı mirasları arasındadır.']},
 {keys:['mimari','cami','sinan','saray'],title:'Osmanlı Mimarisi',facts:['Kubbe, avlu, revak ve ince minareler işlev ile estetiği birleştiren başlıca unsurlardandır.','Külliyeler ibadet yanında eğitim, sağlık ve sosyal yardım işlevleri taşırdı.','Klasik dönemde oran, merkezî plan ve şehir siluetine uyum önem kazandı.']},
 {keys:['abdülhamid','demiryolu','hicaz'],title:'II. Abdülhamid Dönemi',facts:['Eğitim kurumları, haberleşme ve ulaşım ağları devlet politikalarında önemli yer tuttu.','Hicaz Demiryolu, ulaşım ve yönetim bakımından simgesel bir projeydi.','Dönem, yoğun uluslararası baskı ve içeride modernleşme çabalarının birlikte görüldüğü bir süreçti.']}
];
function specializedEnding(title,facts){
 if(expert==='danisman')return `<h4>Divan tavsiyesi</h4><p>Karar verilirken hazinenin gücü, halkın huzuru, ordunun hazırlığı ve uzun vadeli devlet düzeni birlikte korunmalıdır.</p>`;
 if(expert==='osmanlica')return `<h4>Osmanlı üslubuyla</h4><p>Mezkûr ${title.toLocaleLowerCase('tr-TR')} meselesi, devrin ahvâli ve devletin menâfii nazar-ı dikkate alınarak tetkik olunmalıdır.</p><p><b>Kelimeler:</b> mezkûr = adı geçen, ahvâl = durumlar, menâfi = yararlar, tetkik = inceleme.</p>`;
 if(expert==='sanatci')return `<h4>Sanat tasviri</h4><p>Lacivert ve altın tezhip çerçevesi, merkezde dengeli bir minyatür kompozisyonu, döneme uygun kıyafetler ve sembolik şehir silueti kullanılabilir. Tarihî kişilerin görünümü kesin portre gibi değil, temsili sanat yorumu olarak sunulmalıdır.</p>`;
 if(expert==='mimar')return `<h4>Mimari okuma</h4><p>Mekân; işlev, taşıyıcı sistem, kubbe–avlu ilişkisi, malzeme, ışık ve şehir silueti üzerinden değerlendirilmelidir.</p>`;
 if(expert==='stratejist')return `<h4>Stratejik sonuç</h4><p>Başarı; hazırlık, ikmal, coğrafya, istihbarat, zamanlama ve diplomatik şartların birlikte yönetilmesine bağlıdır.</p>`;
 return `<h4>Tarihçinin notu</h4><p>Bu açıklama genel tarih bilgisidir; ayrıntılı araştırmada birincil kaynaklar ve farklı tarihçilerin yorumları karşılaştırılmalıdır.</p>`;
}
function buildAnswer(q){
 const low=q.toLocaleLowerCase('tr-TR'),hit=knowledge.find(x=>x.keys.some(k=>low.includes(k))),e=experts[expert];
 const title=hit?hit.title:'Tarihî Değerlendirme',facts=hit?hit.facts:['Konu, gerçekleştiği dönemin coğrafyası ve güç dengeleriyle birlikte ele alınmalıdır.','Siyasî, ekonomik, askerî ve toplumsal etkenler çoğu zaman birlikte sonuç doğurur.','Kesin hüküm vermeden önce farklı kaynak ve görüşler karşılaştırılmalıdır.'];
 return `<h4>${e.icon} ${title}</h4><p><b>${e.name} bakışı:</b> ${e.lead}</p><h4>Temel değerlendirme</h4><p>• ${facts.join('</p><p>• ')}</p>${specializedEnding(title,facts)}`;
}
$('#brainAsk')?.addEventListener('click',()=>{const q=$('#brainQuestion').value.trim();if(!q){$('#brainResult').innerHTML='<p>Lütfen önce bir konu veya soru yaz.</p>';return;}$('#brainResult').innerHTML=buildAnswer(q);});
$('#brainQuestion')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.ctrlKey)$('#brainAsk').click()});
$('#brainCopy')?.addEventListener('click',async()=>{const text=$('#brainResult').innerText;try{await navigator.clipboard.writeText(text);$('#brainCopy').textContent='Kopyalandı';setTimeout(()=>$('#brainCopy').textContent='Kopyala',1200)}catch{$('#brainCopy').textContent='Seçip kopyala';}});
$('#brainSpeak')?.addEventListener('click',()=>{if(!('speechSynthesis'in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance($('#brainResult').innerText);u.lang='tr-TR';speechSynthesis.speak(u)});
selectExpert('danisman');

const sultans=[[1299,1324,'Osman Gazi','Beyliğin kuruluş ve bağımsızlaşma süreci.'],[1324,1362,'Orhan Gazi','Bursa’nın alınması ve devlet teşkilatının gelişmesi.'],[1362,1389,'I. Murad','Rumeli’de ilerleme ve merkezî yapının güçlenmesi.'],[1389,1402,'Yıldırım Bayezid','Anadolu birliği ve hızlı genişleme dönemi.'],[1402,1413,'Fetret Devri','Taht mücadeleleri ve siyasî toparlanma süreci.'],[1413,1421,'I. Mehmed','Devlet birliğinin yeniden kurulması.'],[1421,1451,'II. Murad','Balkanlarda mücadele ve fethe hazırlık.'],[1451,1481,'Fatih Sultan Mehmed','İstanbul’un fethi ve imparatorluk düzeninin kurulması.'],[1481,1512,'II. Bayezid','İç denge, denizcilik ve idarî devamlılık.'],[1512,1520,'Yavuz Sultan Selim','Doğu seferleri ve Mısır’ın Osmanlı yönetimine girmesi.'],[1520,1566,'Kanuni Sultan Süleyman','Siyasî, askerî, hukukî ve kültürel zirve.'],[1566,1699,'Klasik Dönem Padişahları','Geniş toprakların korunması ve değişen güç dengeleri.'],[1699,1792,'Değişim Dönemi Padişahları','Islahat arayışları ve Avrupa karşısında yeni denge çabaları.'],[1792,1839,'III. Selim ve II. Mahmud dönemi','Yeni ordu ve merkezîleşme reformları.'],[1839,1876,'Tanzimat Dönemi Padişahları','Hukuk, eğitim ve yönetimde modernleşme.'],[1876,1909,'II. Abdülhamid','Eğitim, ulaşım ve diplomasi ağırlıklı yönetim.'],[1909,1918,'V. Mehmed Reşad','Balkan Savaşları ve I. Dünya Savaşı yılları.'],[1918,1922,'VI. Mehmed Vahdeddin','İmparatorluğun son dönemi ve saltanatın kaldırılması.']];
const events=[[1299,'Kuruluş','Osmanlı Beyliği’nin kuruluş süreci başladı.'],[1326,'Bursa’nın Fethi','Bursa alındı ve önemli bir merkez hâline geldi.'],[1362,'Edirne’nin Alınması','Edirne Osmanlı yönetimine girdi.'],[1402,'Ankara Savaşı','Savaş sonrasında Fetret Devri başladı.'],[1453,'İstanbul’un Fethi','İstanbul fethedildi ve yeni başkent oldu.'],[1517,'Mısır Seferi','Mısır Osmanlı yönetimine girdi.'],[1526,'Mohaç Zaferi','Osmanlı Orta Avrupa’daki etkisini artırdı.'],[1571,'İnebahtı Deniz Savaşı','Akdeniz’de büyük bir deniz mücadelesi yaşandı.'],[1699,'Karlofça Antlaşması','Osmanlı’nın Avrupa’daki güç dengesi belirgin biçimde değişti.'],[1839,'Tanzimat Fermanı','Yönetim ve hukuk alanında yeni düzenlemeler ilan edildi.'],[1876,'I. Meşrutiyet','Kanun-ı Esasi ilan edildi.'],[1908,'II. Meşrutiyet','Meclisli yönetime yeniden geçildi.'],[1914,'I. Dünya Savaşı','Osmanlı Devleti savaşa katıldı.'],[1922,'Saltanatın Kaldırılması','Osmanlı saltanatı sona erdi.']];
function eraFor(y){if(y<1453)return['Kuruluş Dönemi','Beylikten devlete geçiş, Rumeli’ye açılma ve merkezî kurumların oluşma süreci.'];if(y<1579)return['Yükseliş Dönemi','Fetihler, güçlü merkezî yönetim ve klasik kurumların geliştiği dönem.'];if(y<1699)return['Denge ve Değişim','Uzun savaşların, iç düzenlemelerin ve değişen dünya şartlarının etkili olduğu dönem.'];if(y<1792)return['Gerileme ve Islahat','Askerî ve idarî yenilik arayışlarının hız kazandığı dönem.'];if(y<1876)return['Modernleşme Dönemi','Yeni kurumlar, eğitim, hukuk ve merkezî yönetim reformlarının öne çıktığı dönem.'];return['Son Dönem','Meşrutiyet, savaşlar, diplomatik baskılar ve imparatorluğun çözülme süreci.'];}
function stateFor(y){
 let m,e,d,c,h;
 if(y<1402){m=58+(y-1299)*.22;e=52+(y-1299)*.18;d=50+(y-1299)*.16;c=48+(y-1299)*.12;h='Kurumsallaşan ve genişleyen devlet';}
 else if(y<1453){m=48+(y-1402)*.45;e=50+(y-1402)*.35;d=52+(y-1402)*.28;c=50+(y-1402)*.25;h='Toparlanma ve fethe hazırlık';}
 else if(y<1579){m=82+(y-1453)*.08;e=78+(y-1453)*.06;d=76+(y-1453)*.07;c=80+(y-1453)*.08;h='Klasik çağın güçlü dengesi';}
 else if(y<1699){m=88-(y-1579)*.12;e=84-(y-1579)*.10;d=80-(y-1579)*.06;c=88-(y-1579)*.04;h='Gücü koruma ve değişime uyum';}
 else if(y<1839){m=68-(y-1699)*.05;e=65-(y-1699)*.03;d=70+(y-1699)*.02;c=72+(y-1699)*.03;h='Islahat ve yeniden yapılanma';}
 else if(y<1876){m=58+(y-1839)*.12;e=60+(y-1839)*.15;d=72+(y-1839)*.10;c=76+(y-1839)*.18;h='Modern kurumların yükselişi';}
 else {m=58-(y-1876)*.35;e=64-(y-1876)*.22;d=72-(y-1876)*.20;c=83+(y-1876)*.05;h='Yoğun baskı altında modernleşme';}
 return {m:Math.round(Math.max(20,Math.min(98,m))),e:Math.round(Math.max(20,Math.min(98,e))),d:Math.round(Math.max(20,Math.min(98,d))),c:Math.round(Math.max(20,Math.min(98,c))),h};
}
let timer=null;
function setMetric(id,value){const bar=$(`#state${id}`),label=$(`#state${id}Value`);if(bar)bar.style.width=value+'%';if(label)label.textContent=value;}
function renderYear(y){
 y=Math.max(1299,Math.min(1922,Number(y)));$('#infinityYear').value=y;$('#infinityYearLabel').textContent=y;$('#timelineMapYear').textContent=y;$('#timelineMeterFill').style.width=((y-1299)/(1922-1299)*100)+'%';
 const era=eraFor(y);$('#infinityEra').textContent=era[0];$('#infinityEraText').textContent=era[1];
 const s=[...sultans].reverse().find(x=>y>=x[0])||sultans[0];$('#infinitySultan').textContent=s[2];$('#infinitySultanText').textContent=s[3];
 const ev=[...events].sort((a,b)=>Math.abs(a[0]-y)-Math.abs(b[0]-y))[0];$('#infinityEventTitle').textContent=`${ev[0]} — ${ev[1]}`;$('#infinityEventText').textContent=ev[2];
 const st=stateFor(y);$('#stateHeadline').textContent=st.h;setMetric('Military',st.m);setMetric('Economy',st.e);setMetric('Diplomacy',st.d);setMetric('Culture',st.c);
 const map=$('#infinityMap');if(map){map.className='infinity-map '+(y<1453?'era-map-foundation':y<1699?'era-map-rise':y<1839?'era-map-change':'era-map-modern');}
 $$('.map-city').forEach(city=>city.classList.toggle('active',y>=Number(city.dataset.from)));
 const activeCities=$$('.map-city.active').map(x=>x.dataset.city);$('#mapCityInfo').textContent=activeCities.length?`${y}: Etkin merkezler — ${activeCities.join(', ')}.`:`${y}: Kuruluş çekirdeği gelişiyor.`;
}
$('#infinityYear')?.addEventListener('input',e=>renderYear(e.target.value));$('#timePrev')?.addEventListener('click',()=>renderYear(Number($('#infinityYear').value)-10));$('#timeNext')?.addEventListener('click',()=>renderYear(Number($('#infinityYear').value)+10));
$('#timePlay')?.addEventListener('click',()=>{if(timer){clearInterval(timer);timer=null;$('#timePlay').textContent='▶ Zamanı Oynat';return;}$('#timePlay').textContent='⏸ Durdur';timer=setInterval(()=>{let y=Number($('#infinityYear').value)+3;if(y>1922){clearInterval(timer);timer=null;$('#timePlay').textContent='▶ Zamanı Oynat';return;}renderYear(y)},120)});
$$('.map-city').forEach(city=>city.addEventListener('click',()=>{$('#mapCityInfo').textContent=`${city.dataset.city}, ${city.dataset.from} yılından itibaren bu temsili zaman haritasında etkin merkez olarak gösteriliyor.`;}));
if($('#infinityYear'))renderYear(1453);
})();
