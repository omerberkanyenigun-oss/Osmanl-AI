(function(){
  "use strict";
  const $=s=>document.querySelector(s);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const side=$(".chat-side"), main=$(".chat-main"), sultanSearch=$("#chatSultanSearch");
  if(!side||!main)return;

  const people={
    pasa:[
      {name:"Sokollu Mehmed Paşa",title:"Sadrazam",period:"Kanuni, II. Selim ve III. Murad dönemleri",intro:"Ben Sokollu Mehmed Paşa olarak eğitimsel biçimde canlandırılıyorum. Devlet yönetimi, diplomasi ve büyük projeler hakkında konuşabiliriz.",topics:{yönet:"Divan kararlarında devletin uzun vadeli çıkarlarını, eyalet düzenini ve mali dengeyi birlikte gözetirdim.",savaş:"Askerî meselelerde yalnız meydan savaşını değil, donanma, ikmal ve diplomasiyi de bir bütün olarak değerlendirirdim.",proje:"Don–Volga ve Süveyş düşünceleri, ticaret ve deniz yollarına verilen stratejik önemin örnekleridir."}},
      {name:"Pargalı İbrahim Paşa",title:"Sadrazam",period:"Kanuni Sultan Süleyman dönemi",intro:"Ben Pargalı İbrahim Paşa olarak eğitimsel bir tarih canlandırmasıyım. Diplomasi, seferler ve saray hayatı hakkında soru sorabilirsin.",topics:{diplom:"Avrupa devletleriyle ilişkilerde elçilikler, antlaşmalar ve güç dengesi büyük önem taşırdı.",savaş:"Mohaç Seferi ve Orta Avrupa siyaseti, dönemimizin en önemli askerî ve diplomatik başlıklarındandı.",saray:"Sarayda görev, büyük yetkinin yanında ağır sorumluluk ve dikkat gerektirirdi."}},
      {name:"Köprülü Mehmed Paşa",title:"Sadrazam",period:"IV. Mehmed dönemi",intro:"Ben Köprülü Mehmed Paşa olarak canlandırılıyorum. Devlet düzeni, reformlar ve sadrazamlık hakkında konuşabiliriz.",topics:{reform:"Görevde disiplinin güçlendirilmesi, gelirlerin korunması ve yönetimde otoritenin yeniden kurulması öncelikler arasındaydı.",yönet:"Sadrazamlık, devletin günlük yönetimini yürütürken padişaha karşı büyük sorumluluk taşırdı."}}
    ],
    aga:[
      {name:"Yeniçeri Ağası",title:"Kapıkulu Ocağı Komutanı",period:"Klasik Osmanlı teşkilatı",intro:"Ben Yeniçeri Ağası makamını temsil eden eğitimsel bir canlandırmayım. Ocağın düzeni, eğitim ve saray güvenliği hakkında soru sorabilirsin.",topics:{yeniçeri:"Yeniçeriler kapıkulu piyadesiydi; ocak düzeni, eğitim, nöbet ve sefer hazırlığı önem taşırdı.",eğitim:"Talimin amacı yalnız silah kullanmak değil, birlik halinde hareket etmek ve emre uymaktı.",görev:"Yeniçeri Ağası, ocağın düzeninden ve önemli güvenlik görevlerinden sorumlu yüksek rütbeli bir görevlidir."}},
      {name:"Darüssaade Ağası",title:"Saray Görevlisi",period:"Topkapı Sarayı teşkilatı",intro:"Ben Darüssaade Ağası makamını temsil eden eğitimsel bir canlandırmayım. Saray düzeni, vakıflar ve kutsal emanetlerle ilgili görevleri anlatabilirim.",topics:{saray:"Saray, birbirine bağlı avlular ve sıkı görev düzeniyle işleyen büyük bir yönetim merkeziydi.",emanet:"Hırka-i Saadet Dairesi ve ilgili hizmetler sarayın en saygın görev alanlarındandı.",vakıf:"Bazı önemli vakıfların idaresi ve saray içindeki görev düzeni makamın sorumlulukları arasındaydı."}},
      {name:"Kapı Ağası",title:"Bâbüssaâde Sorumlusu",period:"Topkapı Sarayı teşkilatı",intro:"Ben Kapı Ağası makamını temsil eden eğitimsel bir canlandırmayım. Enderun, saray kapıları ve tören düzeni hakkında konuşabiliriz.",topics:{enderun:"Enderun, saray içinde yönetici ve devlet görevlisi yetiştiren önemli bir eğitim kurumuydu.",kapı:"Bâbüssaâde, üçüncü avluya geçişi sağlayan ve hükümdarlık merkezinin sınırını simgeleyen önemli kapıdır.",tören:"Cülus, bayramlaşma ve elçi kabulü gibi törenlerde düzen ve protokol çok önemliydi."}}
    ]
  };
  const rooms=[
    {name:"Bâb-ı Hümâyun",label:"1. Durak",text:"Sarayın anıtsal dış kapısından Birinci Avlu'ya giriyorsun. Burası saray yerleşkesinin halka en açık bölümüne açılır.",fact:"Fatih Sultan Mehmed döneminde şekillenen sarayın ana girişidir."},
    {name:"Birinci Avlu",label:"2. Durak",text:"Geniş avluda hizmet yapıları ve Aya İrini bulunur. Sarayın dış hizmet alanından yönetim merkezine doğru ilerliyorsun.",fact:"Alay Meydanı olarak da bilinen bu bölüm törenlerde kullanılırdı."},
    {name:"Bâbüsselâm",label:"3. Durak",text:"İki kuleli Orta Kapı'dan geçerek İkinci Avlu'ya ulaşıyorsun. Bu noktadan sonra sarayın resmî bölümleri başlar.",fact:"Bu kapıdan padişah dışında at üzerinde geçilmezdi."},
    {name:"Divan Meydanı",label:"4. Durak",text:"Kubbealtı'nın önündesin. Devlet işleri Divan-ı Hümâyun toplantılarında burada görüşülürdü.",fact:"Padişah toplantıları Adalet Kulesi'ndeki kafesli bölümden dinleyebilirdi."},
    {name:"Saray Mutfakları",label:"5. Durak",text:"Uzun kubbeleriyle saray mutfaklarına geldin. Binlerce saray görevlisi ve misafir için burada yemek hazırlanırdı.",fact:"Mutfaklar bugün önemli bir porselen ve mutfak eşyası koleksiyonuna ev sahipliği yapar."},
    {name:"Bâbüssaâde",label:"6. Durak",text:"Saadet Kapısı'nın önündesin. Bu kapı, padişahın özel alanı olan Üçüncü Avlu'ya açılır.",fact:"Tahta çıkış ve bayram törenlerinin önemli bir merkeziydi."},
    {name:"Arz Odası",label:"7. Durak",text:"Padişahın devlet görevlilerini ve yabancı elçileri kabul ettiği Arz Odası'ndasın.",fact:"Divan kararları sadrazam tarafından burada padişaha sunulurdu."},
    {name:"Enderun Avlusu",label:"8. Durak",text:"Saray okulunun bulunduğu Üçüncü Avlu'da ilerliyorsun. Burada devlet hizmeti için seçkin görevliler yetiştirilirdi.",fact:"Enderun eğitimi; dil, sanat, beden eğitimi ve yönetim bilgisini birlikte içerirdi."},
    {name:"Hırka-i Saadet Dairesi",label:"9. Durak",text:"Kutsal emanetlerin korunduğu dairenin önündesin. Burası sarayın en saygın ve manevi açıdan önemli bölümlerindendir.",fact:"Osmanlı döneminde burada özel hizmet ve ziyaret düzeni uygulanırdı."},
    {name:"Bağdat Köşkü",label:"10. Durak",text:"Dördüncü Avlu'nun teraslarındaki Bağdat Köşkü'ne ulaştın. Boğaz ve Haliç manzarası turun sonunu süslüyor.",fact:"IV. Murad'ın Bağdat seferinin hatırasına 17. yüzyılda yaptırılmıştır."}
  ];

  let mode="sultan", official=people.pasa[0], room=0;
  side.insertAdjacentHTML("afterbegin",`<div class="chat-character-switch"><small>KONUŞMA KİŞİSİ</small><div class="chat-character-tabs"><button class="active" data-character-mode="sultan">♔ Padişah</button><button data-character-mode="pasa">⚜ Paşa</button><button data-character-mode="aga">🛡 Ağa</button></div><div id="officialPicker" class="official-picker" hidden><label>Görevli seç<select id="officialSelect"></select></label></div></div>`);
  main.querySelector(".chat-disclaimer").insertAdjacentHTML("afterend",`<div class="topkapi-entry"><span class="palace-icon">🏰</span><div><small class="kicker">YENİ SANAL DENEYİM</small><h3>Sanal Topkapı Sarayı Turu</h3><p>10 tarihî durağı gez, sarayın bölümlerini keşfet.</p></div><button id="openTopkapiTour" class="primary">Turu Başlat</button></div><section id="topkapiTour" class="topkapi-tour hidden"><div class="tour-scene"><article class="tour-room-info"><small id="tourLabel" class="kicker"></small><h3 id="tourRoom"></h3><p id="tourText"></p><p id="tourFact" class="tour-fact"></p></article></div><div class="tour-toolbar"><button id="tourPrev" class="secondary">← Önceki</button><div><div class="tour-progress"><i id="tourProgress"></i></div><div id="tourCounter" class="tour-counter"></div></div><button id="tourNext" class="primary">Sonraki →</button></div><div id="tourRoomList" class="tour-room-list"></div></section>`);

  function listOfficials(){
    const select=$("#officialSelect");
    const list=people[mode]||[];
    select.innerHTML=list.map((p,i)=>`<option value="${i}">${esc(p.name)} — ${esc(p.title)}</option>`).join("");
    official=list[0];
  }
  function officialCard(){
    $("#chatSultanCard").innerHTML=`<span class="official-badge">${mode==="pasa"?"⚜ PAŞA":"🛡 AĞA"}</span><h3>${esc(official.name)}</h3><p>${esc(official.title)} • ${esc(official.period)}</p><p>${esc(official.intro)}</p>`;
    $("#livingSultanName").textContent=official.name;
    $("#livingSultanStatus").textContent="Sorunu bekliyor";
    $("#chatMessages").innerHTML=`<div class="message ai"><small>${esc(official.name)} • Eğitimsel canlandırma</small>${esc(official.intro)}</div>`;
    $("#chatInput").placeholder=`Örnek: ${official.title} olarak göreviniz neydi?`;
  }
  function setMode(next){
    mode=next;
    document.querySelectorAll("[data-character-mode]").forEach(b=>b.classList.toggle("active",b.dataset.characterMode===mode));
    const picker=$("#officialPicker");
    picker.hidden=mode==="sultan";
    side.classList.toggle("speaking-official",mode!=="sultan");
    if(mode==="sultan"){
      $("#chatInput").placeholder="Örnek: İstanbul'u neden fethettiniz?";
      const selected=$("#chatSultanSelect").value||"Fatih Sultan Mehmed";
      const btn=document.querySelector(`[data-chat-sultan="${CSS.escape(selected)}"]`);
      if(btn)btn.click();
    }else{ listOfficials(); officialCard(); }
  }
  function answerOfficial(q){
    const t=q.toLocaleLowerCase("tr-TR");
    for(const [key,val] of Object.entries(official.topics))if(t.includes(key))return val;
    if(/kim|tanıt|görev/.test(t))return official.intro;
    if(/dönem|ne zaman/.test(t))return `${official.period} içinde görev yapan ${official.title} makamını temsil ediyorum.`;
    if(/saray|topkapı/.test(t))return `Topkapı Sarayı yalnız bir konut değil; eğitim, yönetim, tören ve hizmet birimlerinin birlikte çalıştığı büyük bir devlet merkeziydi.`;
    return `${official.name} olarak eğitimsel canlandırma cevabım şudur: ${official.intro} Sorunu görevim, dönemim, saray düzeni veya devlet yönetimiyle ilgili daha ayrıntılı sorabilirsin.`;
  }
  function sendOfficial(q){
    q=q.trim();if(!q)return;
    const box=$("#chatMessages");
    box.insertAdjacentHTML("beforeend",`<div class="message user"><small>Sen</small>${esc(q)}</div>`);
    const ans=answerOfficial(q);
    setTimeout(()=>{box.insertAdjacentHTML("beforeend",`<div class="message ai"><small>${esc(official.name)} • Eğitimsel canlandırma</small>${esc(ans)}</div>`);box.scrollTop=box.scrollHeight;if($("#livingVoiceEnabled").checked&&"speechSynthesis" in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(ans);u.lang="tr-TR";u.rate=.91;u.pitch=.86;speechSynthesis.speak(u)}},220);
    $("#chatInput").value="";
  }
  document.querySelectorAll("[data-character-mode]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.characterMode)));
  $("#officialSelect").addEventListener("change",e=>{official=people[mode][Number(e.target.value)];officialCard()});
  $("#chatSend").addEventListener("click",e=>{if(mode!=="sultan"){e.stopImmediatePropagation();sendOfficial($("#chatInput").value)}},true);
  $("#chatInput").addEventListener("keydown",e=>{if(mode!=="sultan"&&e.key==="Enter"){e.preventDefault();e.stopImmediatePropagation();sendOfficial(e.target.value)}},true);
  $(".quick-questions").addEventListener("click",e=>{const b=e.target.closest("[data-quick]");if(mode!=="sultan"&&b){e.preventDefault();e.stopImmediatePropagation();sendOfficial(b.dataset.quick)}},true);
  $("#livingIntroduce").addEventListener("click",e=>{if(mode!=="sultan"){e.preventDefault();e.stopImmediatePropagation();sendOfficial("Kendinizi tanıtır mısınız?")}},true);

  function renderTour(){
    const r=rooms[room];
    $("#tourLabel").textContent=r.label;$("#tourRoom").textContent=r.name;$("#tourText").textContent=r.text;$("#tourFact").textContent="Biliyor muydun? "+r.fact;
    $("#tourProgress").style.width=`${((room+1)/rooms.length)*100}%`;$("#tourCounter").textContent=`${room+1} / ${rooms.length} durak`;
    $("#tourPrev").disabled=room===0;$("#tourNext").textContent=room===rooms.length-1?"Turu Tamamla ✓":"Sonraki →";
    $("#tourRoomList").innerHTML=rooms.map((x,i)=>`<button data-room="${i}" class="${i===room?"active":""}">${i+1}. ${esc(x.name)}</button>`).join("");
  }
  $("#openTopkapiTour").onclick=()=>{$("#topkapiTour").classList.toggle("hidden");$("#openTopkapiTour").textContent=$("#topkapiTour").classList.contains("hidden")?"Turu Başlat":"Turu Kapat";renderTour()};
  $("#tourPrev").onclick=()=>{room=Math.max(0,room-1);renderTour()};
  $("#tourNext").onclick=()=>{if(room<rooms.length-1){room++;renderTour()}else{room=0;renderTour();$("#topkapiTour").classList.add("hidden");$("#openTopkapiTour").textContent="Turu Yeniden Başlat";if(typeof window.toast==="function")window.toast("Topkapı Sarayı turunu tamamladın!")}};
  $("#tourRoomList").onclick=e=>{const b=e.target.closest("[data-room]");if(b){room=Number(b.dataset.room);renderTour()}};
  renderTour();
})();
