(()=>{
"use strict";
const q=s=>document.querySelector(s);
const show=(el,on=true)=>{if(el)el.classList.toggle("hidden",!on)};
const status=(el,msg,type="")=>{if(!el)return;el.textContent=msg;el.className="v29-status"+(type?" "+type:"")};
async function api(path,payload){
  const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload).replace(/[\u007f-\uffff]/g,c=>"\\u"+c.charCodeAt(0).toString(16).padStart(4,"0"))});
  let data={};try{data=await r.json()}catch(_){data={error:"Sunucudan geçersiz cevap alındı."}}
  if(!r.ok||data.ok===false)throw new Error(data.error||`Sunucu hatası (${r.status})`);return data;
}
function isOttomanPrompt(t){
  const s=(t||"").toLocaleLowerCase("tr-TR");
  const words=["osmanlı","fatih","mehmed","topkapı","sultan","padişah","yeniçeri","sipahi","akıncı","divan","hümayun","istanbul","konstantiniyye","edirne","bursa","kanuni","selim","süleyman","abdülhamid","mimar sinan","saray","cami","külliye","tuğra","çini","minyatür","mehter","kapalıçarşı","boğaziçi","rumeli","anadolu","fetih"];
  return words.some(w=>s.includes(w));
}
const prompt=q("#ottomanImagePrompt"),gen=q("#generateOttomanImage"),img=q("#ottomanGeneratedImage"),empty=q("#ottomanImageEmpty"),loading=q("#ottomanImageLoading"),actions=q("#ottomanImageActions"),imgStatus=q("#ottomanImageStatus");
q("#ottomanImageExamples")?.addEventListener("click",e=>{const b=e.target.closest("[data-prompt]");if(b&&prompt){prompt.value=b.dataset.prompt;prompt.focus()}});
async function generateImage(){
  const value=prompt?.value.trim();if(!value){status(imgStatus,"Önce bir görsel komutu yaz.","error");return}
  if(!isOttomanPrompt(value)){status(imgStatus,"Bu atölye yalnızca Osmanlı ile ilgili görseller üretir. Komutuna Osmanlı dönemi, kişi, yapı veya kültür unsuru ekle.","error");return}
  show(empty,false);show(img,false);show(actions,false);show(loading,true);status(imgStatus,"");if(gen)gen.disabled=true;
  try{const data=await api("/api/ottoman-image",{prompt:value,size:q("#ottomanImageSize")?.value||"1024x1024"});img.src=`data:${data.mime||"image/png"};base64,${data.image}`;show(img,true);show(actions,true);status(imgStatus,"Görsel başarıyla üretildi.","success")}
  catch(e){show(empty,true);status(imgStatus,e.message,"error")}
  finally{show(loading,false);if(gen)gen.disabled=false}
}
gen?.addEventListener("click",generateImage);q("#regenerateOttomanImage")?.addEventListener("click",generateImage);
q("#downloadOttomanImage")?.addEventListener("click",()=>{if(!img?.src)return;const a=document.createElement("a");a.href=img.src;a.download=`osmanli-ai-${Date.now()}.png`;a.click()});
const newsBtn=q("#interpretOttomanNews"),newsEmpty=q("#ottomanNewsEmpty"),newsLoading=q("#ottomanNewsLoading"),newsOut=q("#ottomanNewsOutput"),newsStatus=q("#ottomanNewsStatus");
async function interpretNews(){
  const title=q("#ottomanNewsTitle")?.value.trim(),body=q("#ottomanNewsBody")?.value.trim();
  if(!title||!body){status(newsStatus,"Başlık ve haber metninin ikisini de doldur.","error");return}
  show(newsEmpty,false);show(newsOut,false);show(newsLoading,true);status(newsStatus,"");newsBtn.disabled=true;
  try{const data=await api("/api/ottoman-news",{title,body,level:q("#ottomanNewsLevel")?.value||"orta"});q("#ottomanNewsOutputTitle").textContent=data.title||title;q("#ottomanNewsOutputText").textContent=data.text;show(newsOut,true);status(newsStatus,"Haber Osmanlı üslubuyla yeniden kaleme alındı.","success")}
  catch(e){show(newsEmpty,true);status(newsStatus,e.message,"error")}
  finally{show(newsLoading,false);newsBtn.disabled=false}
}
newsBtn?.addEventListener("click",interpretNews);
q("#copyOttomanNews")?.addEventListener("click",async()=>{const t=`${q("#ottomanNewsOutputTitle")?.textContent||""}\n\n${q("#ottomanNewsOutputText")?.textContent||""}`;try{await navigator.clipboard.writeText(t);status(newsStatus,"Metin panoya kopyalandı.","success")}catch(_){status(newsStatus,"Kopyalama izni verilmedi.","error")}});
q("#speakOttomanNews")?.addEventListener("click",()=>{const t=q("#ottomanNewsOutputText")?.textContent;if(!t)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang="tr-TR";u.rate=.88;speechSynthesis.speak(u)});
})();
