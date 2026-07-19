// ══════════════════════════════════════════
// FIREBASE CONFIG — remplacez par votre config
// ══════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyDjGAvtVNuZNVBqLjVTOB_f3_toJDfCPU4",
  authDomain: "librairie-rayen.firebaseapp.com",
  databaseURL: "https://librairie-rayen-default-rtdb.firebaseio.com",
  projectId: "librairie-rayen",
  storageBucket: "librairie-rayen.firebasestorage.app",
  messagingSenderId: "796215384669",
  appId: "1:796215384669:web:83091e3d64ba186c684bb4"
};
let fbDb = null;
let fbStorage = null;
let fbReady = false;
let _imgCache = {};
let _idb = null;
function openIDB(){return new Promise((res,rej)=>{const req=indexedDB.open('librairie_rayen',1);req.onupgradeneeded=e=>{e.target.result.createObjectStore('images',{keyPath:'id'});};req.onsuccess=e=>{_idb=e.target.result;res(_idb);};req.onerror=()=>rej();});}
function idbSave(id,data){if(!_idb)return;try{const tx=_idb.transaction('images','readwrite');tx.objectStore('images').put({id,data});}catch(e){}}
function idbLoad(id){return new Promise(res=>{if(!_idb){res(null);return;}try{const tx=_idb.transaction('images','readonly');const req=tx.objectStore('images').get(id);req.onsuccess=e=>res(e.target.result?.data||null);req.onerror=()=>res(null);}catch(e){res(null);}});}
function idbLoadAll(){return new Promise(res=>{if(!_idb){res({});return;}try{const tx=_idb.transaction('images','readonly');const req=tx.objectStore('images').getAll();req.onsuccess=e=>{const map={};(e.target.result||[]).forEach(r=>map[r.id]=r.data);res(map);};req.onerror=()=>res({});}catch(e){res({});}});}
function idbDelete(id){if(!_idb)return;try{const tx=_idb.transaction('images','readwrite');tx.objectStore('images').delete(id);}catch(e){}}
try {
  firebase.initializeApp(firebaseConfig);
  fbDb = firebase.database();
  fbStorage = firebase.storage();
  fbDb.ref('librairie/config').on('value', snap => {
    const data = snap.val();
    if (!data) return;
    if (data.booksDB) { booksDB = data.booksDB; loadImgsIntoBooks(); if(filtSchool&&filtLv) _books = booksDB[gk(filtSchool,filtLv)]||[]; }
    if (data.schoolLevels) schoolLevels = data.schoolLevels;
    if (data.libName !== undefined) libName = data.libName;
    if (data.libTag !== undefined) libTag = data.libTag;
    if (data.libTel !== undefined) libTel = data.libTel;
    if (data.libMF !== undefined) libMF = data.libMF;
    if (data.libAddr !== undefined) libAddr = data.libAddr;
    if (data.deliveryFee !== undefined) deliveryFee = data.deliveryFee;
    if (data.deliveryNote !== undefined) deliveryNote = data.deliveryNote;
    if (data.heroSubTxt !== undefined) { heroSubTxt = data.heroSubTxt; const hs=document.getElementById('heroSub');if(hs)hs.textContent=heroSubTxt; }
    if (typeof data.orderEnabled !== 'undefined') orderEnabled = !!data.orderEnabled;
    if (data.logoUrl) logoUrl = data.logoUrl;
    if (data.logoNavUrl) logoNavUrl = data.logoNavUrl;
    if (data.adminUser !== undefined) adminUser = data.adminUser;
    if (data.adminPass !== undefined) adminPass = data.adminPass;
    syncLogos();
    if (!fbReady) { fbReady = true; buildSchoolOpts(); return; }
    buildSchoolOpts();
    if (_books.length) renderGrid(_books);
    syncOrderToggle();
    updateDeliveryNotice();
    const adm = document.getElementById('adm-page');
    if(adm && adm.classList.contains('active')){
      if(curAT===0)renderDash();
      if(curAT===5)updateStorageInfo();
      [['s-name',libName],['s-tag',libTag],['s-tel',libTel],['s-mf',libMF],['s-addr',libAddr]].forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v;});
      const sdel=document.getElementById('s-del');if(sdel)sdel.value=deliveryFee.toFixed(3);
    }
  });
  fbDb.ref('librairie/orders').on('value', snap => {
    orders = snap.val() ? Object.values(snap.val()) : [];
    try{const d=JSON.parse(localStorage.getItem('librairie_rayen_db')||'{}');d.orders=orders;localStorage.setItem('librairie_rayen_db',JSON.stringify(d));}catch(e){}
    const adm = document.getElementById('adm-page');
    if(adm && adm.classList.contains('active')){
      if(curAT===0)renderDash();
      if(curAT===1)renderOrders();
      if(curAT===3)renderClients();
      if(curAT===4)renderReceipts();
    }
  });
  fbDb.ref('librairie/reservations').on('value', snap => {
    reservations = snap.val() ? Object.values(snap.val()) : [];
    try{const d=JSON.parse(localStorage.getItem('librairie_rayen_db')||'{}');d.reservations=reservations;localStorage.setItem('librairie_rayen_db',JSON.stringify(d));}catch(e){}
    const adm = document.getElementById('adm-page');
    if(adm && adm.classList.contains('active')){
      if(curAT===0)renderDash();
      if(curAT===2)renderResvs();
      if(curAT===3)renderClients();
      if(curAT===4)renderReceipts();
    }
  });
  fbDb.ref('librairie/logos').on('value', snap => {
    const d=snap.val();if(!d)return;
    if(d.main)logoUrl=d.main;
    if(d.nav)logoNavUrl=d.nav;
    try{if(logoUrl)localStorage.setItem('librairie_logo',logoUrl);}catch(e){}
    try{if(logoNavUrl)localStorage.setItem('librairie_navlogo',logoNavUrl);}catch(e){}
    syncLogos();
  });
  fbDb.ref('librairie/bookImages').on('value', snap => {
    const imgs = snap.val();
    if(!imgs) return;
    Object.entries(imgs).forEach(([k,v])=>{
      if (typeof v === 'string') {
        _imgCache[k] = v;
        idbSave(k, v);
      }
    });
    Object.keys(booksDB).forEach(key=>{
      booksDB[key].forEach(b=>{
        const img = bookImageUtils.resolveBookImage(_imgCache, b);
        if (img) b.img = img;
      });
    });
    if(filtSchool&&filtLv){_books=booksDB[gk(filtSchool,filtLv)]||[];if(_books.length)renderGrid(_books);}
  });
} catch(e) {
  console.warn('Firebase non configuré — utilisation localStorage uniquement');
}
// ══════════════════════════════════════════
let lang='fr';
let adminUser='admin',adminPass='rayen2024';
let deliveryFee=3.000,remisePct=20,tvaPct=19;
let libName='Librairie Rayen',libTag='Ain Zaghouan · Tunis 2045';
let libTel='+216 46.881.645',libMF='1327827/GAM/000',libAddr='Ain Zaghouan, Tunis 2045';
let logoUrl='';
let logoNavUrl='';
let autoSave=true;
let autoAdjustImg=false;
let remiseEnabled=false;
let acompteEnabled=true;
let avanceException=false;
let livraisonEnabled=true;
let heroSubTxt='Parcourez par école et niveau, choisissez vos manuels, payez en toute sécurité — sans vous déplacer.';
let deliveryNote='3 à 5 jours ouvrables après confirmation de la réservation.';
let schoolLevels={'Lycée Carthage':['1ère Secondaire','2ème Secondaire','3ème Secondaire','Terminale Bac'],'Lycée Ibn Khaldoun':['7ème de base','8ème de base','9ème de base','1ère Secondaire','Terminale Bac'],'École Ariana Centre':['1ère Primaire','2ème Primaire','3ème Primaire','4ème Primaire','5ème Primaire','6ème Primaire'],'Collège Médina':['7ème de base','8ème de base','9ème de base'],'Lycée Bourguiba':['1ère Secondaire','2ème Secondaire','Terminale Bac'],'École El Menzah':['1ère Primaire','2ème Primaire','3ème Primaire','4ème Primaire','5ème Primaire','6ème Primaire']};
const CLRS=['#1B2B4B','#E8601C','#00A878','#2E4270','#C94E14','#007F5C','#243656','#4A5568'];
let booksDB={'Lycée Carthage|Terminale Bac':[{id:201,title:'Mathématiques Terminale',ean:'9789973060015',subject:'Maths',priceHT:11.765,color:CLRS[0],img:''},{id:202,title:'Physique-Chimie Terminale',ean:'9789973060022',subject:'Physique',priceHT:11.345,color:CLRS[1],img:''},{id:203,title:'SVT Terminale',ean:'9789973060039',subject:'SVT',priceHT:10.924,color:CLRS[2],img:''},{id:204,title:'Philosophie',ean:'9789973060046',subject:'Philo',priceHT:10.084,color:CLRS[3],img:''},{id:205,title:'Anglais Bac',ean:'9789973060053',subject:'Anglais',priceHT:10.504,color:CLRS[6],img:''}],'Lycée Carthage|1ère Secondaire':[{id:101,title:'Français 1ère',ean:'9789973070010',subject:'Français',priceHT:8.824,color:CLRS[0],img:''},{id:102,title:'Mathématiques 1ère',ean:'9789973070027',subject:'Maths',priceHT:8.403,color:CLRS[1],img:''},{id:103,title:'Physique-Chimie 1ère',ean:'9789973070034',subject:'Physique',priceHT:7.983,color:CLRS[2],img:''},{id:104,title:'SVT 1ère',ean:'9789973070041',subject:'SVT',priceHT:7.563,color:CLRS[3],img:''}],'Lycée Ibn Khaldoun|9ème de base':[{id:301,title:'Français 9ème',ean:'9789973080019',subject:'Français',priceHT:8.824,color:CLRS[0],img:''},{id:302,title:'Mathématiques 9ème',ean:'9789973080026',subject:'Maths',priceHT:8.403,color:CLRS[1],img:''},{id:303,title:'Physique-Chimie 9',ean:'9789973080033',subject:'Physique',priceHT:7.983,color:CLRS[5],img:''},{id:304,title:'SVT 9ème',ean:'9789973080040',subject:'SVT',priceHT:7.563,color:CLRS[2],img:''},{id:305,title:'Anglais 9ème',ean:'9789973080057',subject:'Anglais',priceHT:7.983,color:CLRS[6],img:''},{id:306,title:'اللغة العربية التاسعة',ean:'9789973080064',subject:'Arabe',priceHT:8.403,color:CLRS[3],img:''}],'École Ariana Centre|1ère Primaire':[{id:401,title:'Mon Premier Livre de Lecture',ean:'9789973090010',subject:'Français',priceHT:6.303,color:CLRS[0],img:''},{id:402,title:'Mathématiques 1',ean:'9789973090027',subject:'Maths',priceHT:5.042,color:CLRS[1],img:''},{id:403,title:'كتابي في اللغة العربية',ean:'9789973090034',subject:'Arabe',priceHT:5.882,color:CLRS[2],img:''},{id:404,title:"J'Explore le Monde",ean:'9789973090041',subject:'Éveil',priceHT:4.622,color:CLRS[3],img:''}],'École Ariana Centre|3ème Primaire':[{id:501,title:'Grammaire et Conjugaison 3',ean:'9789973100010',subject:'Français',priceHT:6.723,color:CLRS[0],img:''},{id:502,title:'Mathématiques 3',ean:'9789973100027',subject:'Maths',priceHT:5.882,color:CLRS[1],img:''},{id:503,title:'اللغة العربية - الثالثة',ean:'9789973100034',subject:'Arabe',priceHT:6.303,color:CLRS[2],img:''},{id:504,title:'Sciences Naturelles 3',ean:'9789973100041',subject:'Sciences',priceHT:5.462,color:CLRS[3],img:''}],'Collège Médina|7ème de base':[{id:701,title:'Français 7ème',ean:'9789973120015',subject:'Français',priceHT:7.983,color:CLRS[0],img:''},{id:702,title:'Mathématiques 7ème',ean:'9789973120022',subject:'Maths',priceHT:7.563,color:CLRS[1],img:''},{id:703,title:'Sciences 7ème',ean:'9789973120039',subject:'Sciences',priceHT:7.143,color:CLRS[2],img:''},{id:704,title:'Anglais 7ème',ean:'9789973120046',subject:'Anglais',priceHT:7.143,color:CLRS[6],img:''}]};
let cart={};let curPay='visa';let orders=[],reservations=[];let filtSchool='',filtLv='';let lastOrder=null;let _books=[];let orderEnabled=true;let curResPay='cash';
const T={fr:{eyebrow:"Votre librairie scolaire de confiance",h1a:"Réservez",h1b:"vos livres",h1c:"depuis chez vous.",ctabtn:"Parcourir les livres",m1:"Livres disponibles",m2:"Écoles partenaires",m3:"Modes de paiement",back:"← Accueil",p2title:"Trouvez vos livres",searchph:"Rechercher — titre, matière, EAN...",schoollbl:"École",levellbl:"Niveau",search:"Rechercher",chooseschool:"— Choisir une école —",chooselevel:"— Choisir un niveau —",total:"Total :",butnres:"Réserver",butnord:"Commander",empty1:"Sélectionnez votre école et niveau",empty2:"Utilisez les filtres ci-dessus pour trouver les manuels.",backbooks:"← Retour",p3title:"Finaliser la commande",p3sub:"Vérifiez votre sélection, remplissez vos coordonnées et confirmez.",p4title:"Réserver mes livres",p4sub:"Laissez vos coordonnées pour confirmer la réservation.","dn-title":"Délai de disponibilité",yourinfo:"Vos informations",fullname:"Nom complet",phone:"Téléphone",emaill:"Email (optionnel)",addresslbl:"Adresse de livraison",paymethod:"Mode de paiement",holder:"TITULAIRE",cardnum:"Numéro de carte",expiry:"Expiration",edinarlbl:"Numéro E-Dinar",pinlbl:"Code PIN",cash:"Espèces","cash-title":"Paiement à la livraison","cash-sub":"Vos livres seront préparés et livrés. Vous payez en espèces à la réception.",ordersumm:"Récapitulatif",confirmpay:"Confirmer la commande →",confirmres:"Confirmer la réservation 📌",secured:"Sécurisé · Données protégées",delivery:"Livraison",adminlogin:"Accès Admin",adminloginsub:"Entrez vos identifiants.",signin:"Se connecter",backsite:"← Retour au site",signout:"Déconnexion →","tab-dash":"Tableau de bord","tab-res":"Commandes","tab-resv":"Réservations","tab-cli":"Clients","tab-rec":"Reçus","tab-set":"Paramètres","receipts-list":"Tous les reçus","success-title":"Confirmé","returnhome":"Retour à l'accueil","downloadpdf":"📄 Télécharger le reçu",clickupload:"Cliquer pour télécharger le logo","opt-cash":"Espèces (à la livraison)"},en:{eyebrow:"Your trusted school bookstore",h1a:"Reserve",h1b:"your books",h1c:"from home.",ctabtn:"Browse Books",m1:"Books available",m2:"Partner schools",m3:"Payment methods",back:"← Home",p2title:"Find Your Books",searchph:"Search — title, subject, EAN...",schoollbl:"School",levellbl:"Level",search:"Search",chooseschool:"— Choose school —",chooselevel:"— Choose level —",total:"Total:",butnres:"Reserve",butnord:"Order Now",empty1:"Select your school and level",empty2:"Use the filters above to find the required books.",backbooks:"← Back",p3title:"Complete Your Order",p3sub:"Review your selection, fill in details and confirm.",p4title:"Reserve my books",p4sub:"Enter your details to confirm the reservation.","dn-title":"Delivery timeline",yourinfo:"Your Information",fullname:"Full Name",phone:"Phone",emaill:"Email (optional)",addresslbl:"Delivery Address",paymethod:"Payment Method",holder:"CARDHOLDER",cardnum:"Card Number",expiry:"Expiry",edinarlbl:"E-Dinar Number",pinlbl:"PIN Code",cash:"Cash","cash-title":"Pay on Delivery","cash-sub":"Books are prepared and delivered. You pay cash on receipt.",ordersumm:"Order Summary",confirmpay:"Confirm Order →",confirmres:"Confirm Reservation 📌",secured:"SSL Secured · Data protected",delivery:"Delivery",adminlogin:"Admin Access",adminloginsub:"Enter your credentials.",signin:"Sign In",backsite:"← Back to site",signout:"Sign Out →","tab-dash":"Dashboard","tab-res":"Orders","tab-resv":"Reservations","tab-cli":"Clients","tab-rec":"Receipts","tab-set":"Settings","receipts-list":"All Receipts","success-title":"Confirmed","returnhome":"Return to Home","downloadpdf":"📄 Download Receipt",clickupload:"Click to upload logo","opt-cash":"Cash (on delivery)"}};
const tr=k=>T[lang][k]||T.fr[k]||k;
function setLang(l){lang=l;document.querySelectorAll('.lbtn').forEach(b=>b.classList.toggle('on',b.getAttribute('onclick').includes("'"+l+"'")));document.querySelectorAll('[data-t]').forEach(el=>{const k=el.getAttribute('data-t');(el.tagName==='INPUT'||el.tagName==='TEXTAREA')?el.placeholder=tr(k):el.textContent=tr(k);});document.querySelectorAll('[data-t-opt]').forEach(el=>el.textContent=tr(el.getAttribute('data-t-opt')));document.querySelectorAll('[data-t-ph]').forEach(el=>el.placeholder=tr(el.getAttribute('data-t-ph')));document.getElementById('heroSub').textContent=l==='en'?'Browse by school and level, select your books, and pay securely — from home.':'Parcourez par école et niveau, choisissez vos manuels, payez en toute sécurité — sans vous déplacer.';document.getElementById('p2sub').textContent=l==='en'?'Select your school and level to see the required books.':'Sélectionnez votre école et votre niveau pour voir la liste des manuels.';updateDeliveryNotice();const cb=document.getElementById('cbadge');if(cb){const n=cb.textContent.match(/\d+/)?.[0]||'0';cb.textContent=n+(l==='en'?' item(s)':' article(s)');}buildSchoolOpts();if(_books.length)renderGrid(_books);if(document.getElementById('orderSumm').innerHTML)renderOrderSumm();if(document.getElementById('resSumm').innerHTML)renderResSumm();}
(function(){const bar=document.getElementById('langBar');let drag=false,ox=0,oy=0,moved=false;function start(cx,cy){drag=true;moved=false;bar.classList.add('drag');const r=bar.getBoundingClientRect();ox=cx-r.left;oy=cy-r.top;bar.style.right='auto';bar.style.left=r.left+'px';bar.style.top=r.top+'px';}function move(cx,cy){if(!drag)return;moved=true;bar.style.left=(cx-ox)+'px';bar.style.top=(cy-oy)+'px';}function end(e){if(!drag)return;drag=false;bar.classList.remove('drag');if(!moved&&e.target&&e.target.closest('.lbtn')){e.target.closest('.lbtn').click();}}bar.addEventListener('mousedown',e=>{start(e.clientX,e.clientY);e.preventDefault();});document.addEventListener('mousemove',e=>move(e.clientX,e.clientY));document.addEventListener('mouseup',e=>end(e));bar.addEventListener('touchstart',e=>{const t=e.touches[0];start(t.clientX,t.clientY);},{passive:true});document.addEventListener('touchmove',e=>{const t=e.touches[0];move(t.clientX,t.clientY);},{passive:true});document.addEventListener('touchend',e=>end(e.changedTouches?{target:e.target}:e));})();
function go(pid){['p1','p2','p3','p4','p5'].forEach(p=>document.getElementById(p).classList.remove('active'));document.getElementById(pid).classList.add('active');document.getElementById('al-page').classList.remove('vis');document.getElementById('adm-page').classList.remove('active');if(pid==='p3')renderOrderSumm();if(pid==='p4')renderResSumm();if(pid==='p5')renderDevis();syncLogos();window.scrollTo(0,0);}
function showAdminLogin(){['p1','p2','p3','p4'].forEach(p=>document.getElementById(p).classList.remove('active'));document.getElementById('adm-page').classList.remove('active');document.getElementById('al-page').classList.add('vis');}
let filtEtab='';
function getEtablissement(level){
  if(!level)return null;
  const l=level.toLowerCase().trim().replace(/['’‘èé]/g,c=>c==='è'||c==='é'?'e':c);
  if(/^(cp|ce1|ce2|cm1|cm2|maternelle|ps|ms|gs|cp1|cp2)\b/.test(l))return 'Primaire';
  if(/^[3456]\s*(e|em|eme|ieme|ième|eme|ème)\b/.test(l)||/^(troisieme|quatrieme|cinquieme|sixieme)/.test(l))return 'Collège';
  if(/^2\s*(e|em|eme|nd|nde)\b/.test(l)||/^(deuxieme|seconde)\b/.test(l))return 'Lycée';
  if(/^1\s*(e|er|re|ere|ère|ere)\b/.test(l)||/^(premiere|première)\b/.test(l))return 'Lycée';
  if(/^term/.test(l))return 'Lycée';
  return null;
}
function etabColor(e){return e==='Primaire'?{bg:'#D1FAE5',tx:'#065F46'}:e==='Collège'?{bg:'#DBEAFE',tx:'#1E40AF'}:e==='Lycée'?{bg:'#EDE9FE',tx:'#5B21B6'}:{bg:'#F1F5F9',tx:'#475569'};}
function setEtab(type){filtEtab=type;document.querySelectorAll('.etab-btn').forEach(b=>b.classList.toggle('on',b.dataset.type===type));buildSchoolOpts();document.getElementById('levelSel').innerHTML=`<option value="">${tr('chooselevel')}</option>`;}
function buildSchoolOpts(){const ss=document.getElementById('schoolSel');const cur=ss.value;ss.innerHTML=`<option value="">${tr('chooseschool')}</option>`;Object.keys(schoolLevels).forEach(s=>{if(filtEtab&&filtEtab!=='Tous'){const ok=(schoolLevels[s]||[]).some(lv=>getEtablissement(lv)===filtEtab);if(!ok)return;}const o=document.createElement('option');o.value=s;o.textContent=s;ss.appendChild(o);});ss.value=cur;}
function onSchoolChange(){const school=document.getElementById('schoolSel').value;const ls=document.getElementById('levelSel');ls.innerHTML=`<option value="">${tr('chooselevel')}</option>`;if(school&&schoolLevels[school])schoolLevels[school].forEach(lv=>{if(filtEtab&&filtEtab!=='Tous'&&getEtablissement(lv)!==filtEtab)return;const o=document.createElement('option');o.value=lv;o.textContent=lv;ls.appendChild(o);});}
function doSearch(q){document.getElementById('srchClr').classList.toggle('vis',q.length>0);if(!q.trim()){if(filtSchool&&filtLv)renderGrid(_books);else clearArea();return;}const words=q.toLowerCase().trim().split(/\s+/);const seen=new Set();const res=Object.values(booksDB).flat().filter(b=>{if(seen.has(b.id))return false;const hay=(b.title+' '+b.subject+' '+(b.ean||'')).toLowerCase();if(words.some(w=>hay.includes(w))){seen.add(b.id);return true;}return false;});if(!res.length){document.getElementById('booksArea').innerHTML=`<div class="empty-state"><span class="es-ico">🔍</span><div class="es-title">${lang==='fr'?'Aucun résultat':'No results'}</div><p>${lang==='fr'?'Essayez un autre mot.':'Try a different keyword.'}</p></div>`;return;}document.getElementById('booksArea').innerHTML=`<div class="rbanner">🔍 ${res.length} ${lang==='fr'?'résultat(s)':'result(s)'}</div><div class="bgrid">${res.map(bHTML).join('')}</div>`;document.getElementById('cartBar').classList.add('vis');}
function clearSearch(){document.getElementById('srch').value='';document.getElementById('srchClr').classList.remove('vis');if(filtSchool&&filtLv)renderGrid(_books);else clearArea();}
function clearArea(){document.getElementById('booksArea').innerHTML=`<div class="empty-state"><span class="es-ico">📚</span><div class="es-title">${tr('empty1')}</div><p>${tr('empty2')}</p></div>`;}
function gk(s,l){return s+'|'+l;}
function filterBooks(){const school=document.getElementById('schoolSel').value;const lv=document.getElementById('levelSel').value;if(!school||!lv){showToast('⚠️ '+(lang==='fr'?'Choisissez école et niveau':'Select school and level'));return;}filtSchool=school;filtLv=lv;_books=booksDB[gk(school,lv)]||[];_books.forEach(b=>{if(!b.img){const cached=bookImageUtils.resolveBookImage(_imgCache,b);if(cached){b.img=cached;return;}try{const imgKey=b.ean?bookImageUtils.normalizeBookImageKey(b.ean):null;const v=imgKey?localStorage.getItem('librairie_img_'+imgKey):null;if(v){_imgCache[imgKey]=v;b.img=v;}}catch(e){}}});cart={};renderGrid(_books);updateCart();document.getElementById('cartBar').classList.add('vis');}
function priceTTC(b){return b.priceHT;}
function bHTML(b){const qty=cart[b.id]?cart[b.id].qty:0;const sel=qty>0;const ttc=priceTTC(b);return`<div class="bcard ${sel?'sel':''}" id="bc-${b.id}" onclick="toggleBook(${b.id})"><div class="btick">✓</div><div class="bcover">${b.img?`<img src="${b.img}" alt="${b.title}">`:`<div class="bcover-fb" style="background:${b.color}">${b.subject}<br><span style="font-size:1.4rem;margin-top:4px">📖</span></div>`}<div class="bcover-ean">EAN ${b.ean||'—'}</div></div><div class="bqty" onclick="event.stopPropagation()"><button class="qbtn" onclick="adjQty(event,${b.id},-1)">−</button><div class="qnum" id="qv-${b.id}">${qty||1}</div><button class="qbtn" onclick="adjQty(event,${b.id},1)">+</button></div><div class="binfo"><div class="btitle">${b.title}</div><div class="bsubj">${b.subject}</div><div class="bfoot"><div class="bprice">${ttc.toFixed(3)} TND</div><span class="bqbadge" id="qb-${b.id}">×${qty||1}</span></div></div></div>`;}
function renderGrid(books){if(!books.length){document.getElementById('booksArea').innerHTML=`<div class="empty-state"><span class="es-ico">📭</span><div class="es-title">${lang==='fr'?'Aucun livre pour ce niveau':'No books for this level'}</div></div>`;return;}document.getElementById('booksArea').innerHTML=`<div class="rbanner">📚 ${books.length} ${lang==='fr'?'livre(s) pour':'book(s) for'} <strong>${filtSchool}</strong> — <strong>${filtLv}</strong></div><div class="bgrid">${books.map(bHTML).join('')}</div>`;}
function toggleBook(id){const all=Object.values(booksDB).flat();const b=all.find(x=>x.id===id);if(!b)return;const card=document.getElementById('bc-'+id);if(cart[id]){delete cart[id];if(card)card.classList.remove('sel');}else{cart[id]={book:b,qty:1};if(card)card.classList.add('sel');const qv=document.getElementById('qv-'+id);if(qv)qv.textContent='1';const qbg=document.getElementById('qb-'+id);if(qbg)qbg.textContent='×1';}updateCart();}
function adjQty(event,id,delta){event.stopPropagation();if(!cart[id])return;const nq=Math.max(1,cart[id].qty+delta);cart[id].qty=nq;const qv=document.getElementById('qv-'+id);if(qv)qv.textContent=nq;const qbg=document.getElementById('qb-'+id);if(qbg)qbg.textContent='×'+nq;updateCart();}
function updateCart(){const items=Object.values(cart);const totalQty=items.reduce((s,i)=>s+i.qty,0);const totalRaw=items.reduce((s,i)=>s+priceTTC(i.book)*i.qty,0);const totalTTC=remiseEnabled?totalRaw*0.9:totalRaw;document.getElementById('cbadge').textContent=totalQty+(lang==='fr'?' article(s)':' item(s)');document.getElementById('ctot').textContent=(remiseEnabled?'🏷️ ':'')+totalTTC.toFixed(3)+' TND';const dis=totalQty===0;const btnOrd=document.getElementById('btnOrd');btnOrd.style.display=orderEnabled?'flex':'none';btnOrd.disabled=dis;document.getElementById('btnRes').disabled=dis;const btnDev=document.getElementById('btnDevis');if(btnDev)btnDev.disabled=dis;}
function toggleOrderMode(enabled){orderEnabled=enabled;const lbl=document.getElementById('ord-status-lbl');const alert=document.getElementById('ord-alert');if(enabled){lbl.textContent='Les clients peuvent commander';lbl.style.color='var(--green)';if(alert)alert.style.display='none';}else{lbl.textContent='Commande en ligne désactivée';lbl.style.color='var(--oh)';if(alert)alert.style.display='block';}updateCart();showToast(enabled?'✅ Bouton Commander activé':'🔴 Bouton Commander désactivé');}
function syncOrderToggle(){const tog=document.getElementById('tog-order');if(tog){tog.checked=orderEnabled;toggleOrderMode(orderEnabled);}}
function applyRemiseBadge(){const badge=document.getElementById('remiseBadge');const btn=document.getElementById('remiseToggleBtn');if(!badge||!btn)return;if(remiseEnabled){badge.textContent='ON';badge.style.background='#20cf9e';btn.style.borderColor='#20cf9e';}else{badge.textContent='OFF';badge.style.background='rgba(255,255,255,.2)';btn.style.borderColor='rgba(255,255,255,.25)';}}
function toggleRemise(){remiseEnabled=!remiseEnabled;applyRemiseBadge();try{localStorage.setItem('librairie_remise',remiseEnabled?'1':'0');}catch(e){}updateCart();if(Object.keys(cart).length>0){renderOrderSumm();renderResSumm();}showToast(remiseEnabled?'🏷️ Remise 10% activée':'🏷️ Remise 10% désactivée');}
function toggleAcompte(){acompteEnabled=!acompteEnabled;const badge=document.getElementById('acompteBadge');const wrap=document.getElementById('acompteWrap');const area=document.getElementById('acompteInputArea');const blk=document.getElementById('avanceBlock');if(acompteEnabled){badge.textContent='ON';badge.style.background='#20cf9e';wrap.style.borderColor='#20cf9e';if(area)area.style.display='flex';if(blk)blk.style.display='block';}else{badge.textContent='OFF';badge.style.background='rgba(255,255,255,.2)';wrap.style.borderColor='rgba(255,255,255,.25)';if(area)area.style.display='none';if(blk)blk.style.display='none';}if(Object.keys(cart).length>0)renderResSumm();showToast(acompteEnabled?'💳 Avance activée':'💳 Avance désactivée');}
function toggleLivraison(){livraisonEnabled=!livraisonEnabled;const badge=document.getElementById('livraisonBadge');const btn=document.getElementById('livraisonToggleBtn');if(livraisonEnabled){badge.textContent='ON';badge.style.background='rgba(255,255,255,.2)';btn.style.borderColor='rgba(255,255,255,.25)';}else{badge.textContent='OFF';badge.style.background='#e53e3e';btn.style.borderColor='#e53e3e';}if(Object.keys(cart).length>0)renderOrderSumm();showToast(livraisonEnabled?'🚚 Frais de livraison activés':'🚚 Livraison offerte');}
function toggleException(){avanceException=!avanceException;const badge=document.getElementById('exceptionBadge');const btn=document.getElementById('exceptionBtn');if(avanceException){badge.textContent='ON';badge.style.background='orange';btn.style.borderColor='orange';const avInp=document.getElementById('avanceInput');if(avInp){avInp.placeholder='Montant libre (exception admin)';avInp.min='0';}const msg=document.getElementById('avanceMsg');if(msg){msg.style.color='orange';msg.textContent='⚡ Exception admin : avance libre, minimum 30% désactivé.';}showToast('⚡ Exception activée — avance libre');}else{badge.textContent='OFF';badge.style.background='rgba(255,255,255,.2)';btn.style.borderColor='rgba(255,165,0,.6)';const avInp=document.getElementById('avanceInput');if(avInp){avInp.placeholder='Laisser vide = 30% minimum';avInp.min='0';}const msg=document.getElementById('avanceMsg');if(msg){msg.style.color='var(--tx3)';msg.textContent='Vous pouvez payer plus de 30% si vous le souhaitez.';}showToast('⚡ Exception désactivée');}}
function checkAvance(inp){const min30=+(window._tot*0.3).toFixed(3);const val=parseFloat(inp.value);const msg=document.getElementById('avanceMsg');if(inp.value===''||isNaN(val)){inp.style.borderColor='var(--olt)';if(msg&&!avanceException){msg.style.color='var(--tx3)';msg.textContent='Laisser vide = avance par défaut ('+min30.toFixed(3)+' TND)';}return;}if(!avanceException&&val<min30){inp.style.borderColor='#D63031';if(msg){msg.style.color='#D63031';msg.textContent='⚠️ Minimum '+min30.toFixed(3)+' TND (30% du total)';}}else{inp.style.borderColor='var(--green)';if(msg){msg.style.color='var(--gh)';msg.textContent='✅ Avance : '+val.toFixed(3)+' TND — Reste : '+(window._tot-val).toFixed(3)+' TND';}}}
function getAcompteAmt(total){const min30=+(total*0.3).toFixed(3);const inpAdmin=document.getElementById('acompteInp');const inpPage=document.getElementById('avanceInput');const hasPage=inpPage&&inpPage.value!=='';const hasAdmin=inpAdmin&&inpAdmin.value!=='';const valPage=hasPage?parseFloat(inpPage.value):NaN;const valAdmin=hasAdmin?parseFloat(inpAdmin.value):NaN;const val=hasPage&&!isNaN(valPage)?valPage:(hasAdmin&&!isNaN(valAdmin)?valAdmin:NaN);if(!isNaN(val)){if(avanceException)return Math.max(0,val);return Math.max(val,min30);}return min30;}
function validateAcompteInp(inp){const total=window._tot||0;const min30=+(total*0.3).toFixed(3);const val=parseFloat(inp.value);if(!isNaN(val)&&val<min30){inp.style.background='#FFCCCC';inp.title='Minimum : '+min30.toFixed(3)+' TND (30%)';}else{inp.style.background='rgba(255,255,255,.9)';inp.title='Laisser vide = 30% · Minimum 30% du total';}if(Object.keys(cart).length>0)renderResSumm();}
function switchPay(tab){curPay=tab;const p3=document.getElementById('p3');p3.querySelectorAll('.ptab').forEach(t=>t.classList.remove('on'));p3.querySelectorAll('.ppanel').forEach(p=>p.classList.remove('on'));document.getElementById('pp-'+tab).classList.add('on');const map={visa:0,edinar:1,cash:2};p3.querySelectorAll('.ptab')[map[tab]]?.classList.add('on');}
function switchResPay(tab){curResPay=tab;['visa','edinar','cash'].forEach(t=>{document.getElementById('rtab-'+t)?.classList.toggle('on',t===tab);document.getElementById('rp-'+t)?.classList.toggle('on',t===tab);});}
function syncResCard(){const n=document.getElementById('rfname').value||'VOTRE NOM';document.getElementById('rcvNum').textContent=document.getElementById('rvc-n')?.value||'•••• •••• •••• ••••';document.getElementById('rcvName').textContent=n.toUpperCase();document.getElementById('rcvExp').textContent=document.getElementById('rvc-e')?.value||'MM/AA';}
function syncResEdinar(){document.getElementById('redNum').textContent=document.getElementById('red-n').value||'•••• •••• •••• ••••';document.getElementById('redName').textContent=(document.getElementById('rfname').value||'TITULAIRE').toUpperCase();}
function fmtCard(el){let v=el.value.replace(/\D/g,'').substring(0,16);el.value=v.replace(/(.{4})/g,'$1 ').trim();}
function fmtExp(el){let v=el.value.replace(/\D/g,'');if(v.length>=2)v=v.substring(0,2)+'/'+v.substring(2,4);el.value=v;}
function syncCard(){const n=document.getElementById('fname').value||'VOTRE NOM';const num=document.getElementById('vc-n')?.value||'•••• •••• •••• ••••';const exp=document.getElementById('vc-e')?.value||'MM/AA';document.getElementById('cvNum').textContent=num||'•••• •••• •••• ••••';document.getElementById('cvName').textContent=n.toUpperCase();document.getElementById('cvExp').textContent=exp||'MM/AA';}
function syncEdinar(){document.getElementById('edNum').textContent=document.getElementById('ed-n').value||'•••• •••• •••• ••••';document.getElementById('edName').textContent=(document.getElementById('fname').value||'TITULAIRE').toUpperCase();}
function updateDeliveryNotice(){const el=document.getElementById('deliveryNotice');if(!el)return;const acompteTxt=acompteEnabled?'<br><br>⚠️ <strong>Un acompte de 30% du montant total</strong> est requis au moment de la réservation pour confirmer votre commande.':'';el.innerHTML='Votre commande sera disponible en magasin ou livrée à domicile sous <strong>'+deliveryNote+'</strong> après confirmation de la réservation. Vous recevrez un appel de notre équipe pour vous informer de la date exacte. '+libName+' — Tél : '+libTel+'.'+acompteTxt;}
function renderOrderSumm(){const items=Object.values(cart);const ttcSum=items.reduce((s,i)=>s+priceTTC(i.book)*i.qty,0);const remiseLine=remiseEnabled?`<div class="sitem" style="color:var(--green)"><span class="si-lbl">🏷️ Remise 10%</span><span class="si-price">-${(ttcSum*0.1).toFixed(3)} TND</span></div>`:'';const ttcApres=remiseEnabled?ttcSum*0.9:ttcSum;const fraisLiv=livraisonEnabled?deliveryFee:0;window._tot=ttcApres+fraisLiv;document.getElementById('orderSumm').innerHTML=items.map(i=>`<div class="sitem"><span class="si-lbl">📖 ${i.book.title.length>22?i.book.title.substring(0,22)+'…':i.book.title}<br><span style="font-size:.7rem;color:var(--tx3)">${i.book.subject} · EAN ${i.book.ean||'—'} × ${i.qty}</span></span><span class="si-price">${(priceTTC(i.book)*i.qty).toFixed(3)} TND</span></div>`).join('')+remiseLine+(livraisonEnabled?`<div class="sitem"><span class="si-lbl">🚚 ${tr('delivery')}</span><span class="si-price">${deliveryFee.toFixed(3)} TND</span></div>`:'')+`<div class="sitem s-total"><span>Total TTC</span><span>${window._tot.toFixed(3)} TND</span></div>`;}
function renderResSumm(){const items=Object.values(cart);const ttcSum=items.reduce((s,i)=>s+priceTTC(i.book)*i.qty,0);window._tot=remiseEnabled?ttcSum*0.9:ttcSum;const remiseLine=remiseEnabled?`<div class="rs-item" style="color:var(--green)"><span>🏷️ Remise 10%</span><span>-${(ttcSum*0.1).toFixed(3)} TND</span></div>`:'';const acompteAmt=getAcompteAmt(window._tot);const reste=+(window._tot-acompteAmt).toFixed(3);const acomptePct=window._tot>0?Math.round(acompteAmt/window._tot*100):30;const acompteBlock=acompteEnabled?`<div class="rs-acompte"><span class="rs-acompte-ico">💳</span><div><div class="rs-acompte-title">${lang==='fr'?'Avance à verser ('+acomptePct+'%)':'Advance payment required ('+acomptePct+'%)'}</div><div class="rs-acompte-sub">${lang==='fr'?'Un acompte de <strong>'+acompteAmt.toFixed(3)+' TND</strong> est requis pour confirmer votre réservation. Le solde (<strong>'+reste.toFixed(3)+' TND</strong>) sera réglé à la livraison.':'An advance of <strong>'+acompteAmt.toFixed(3)+' TND</strong> is required. Balance <strong>'+reste.toFixed(3)+' TND</strong> due on delivery.'}</div></div></div>`:'';document.getElementById('resSumm').innerHTML=`<div class="rs-title">📚 ${lang==='fr'?'Livres sélectionnés':'Selected books'}</div>${items.map(i=>`<div class="rs-item"><span>${i.book.title.length>26?i.book.title.substring(0,26)+'…':i.book.title} × ${i.qty}</span><span>${(priceTTC(i.book)*i.qty).toFixed(3)} TND</span></div>`).join('')}${remiseLine}<div class="rs-total"><span>Total TTC</span><span>${window._tot.toFixed(3)} TND</span></div>${acompteBlock}`;const min30El=document.getElementById('avanceMin30');if(min30El)min30El.textContent=(window._tot*0.3).toFixed(3)+' TND';const avInp=document.getElementById('avanceInput');if(avInp&&avInp.value)checkAvance(avInp);updateDeliveryNotice();}
function renderDevis(){const items=Object.values(cart);const totBrut=items.reduce((s,i)=>s+priceTTC(i.book)*i.qty,0);const totNet=remiseEnabled?totBrut*0.9:totBrut;window._devTot=totNet;const el=document.getElementById('devisSumm');if(!el)return;const remiseLine=remiseEnabled?`<div class="rs-item" style="color:var(--green)"><span>🏷️ Remise 10%</span><span>-${(totBrut*0.1).toFixed(3)} TND</span></div>`:'';el.innerHTML=`<div class="rs-title">📚 ${filtSchool} — ${filtLv}</div>${items.map(i=>`<div class="rs-item"><span>${i.book.title.length>28?i.book.title.substring(0,28)+'…':i.book.title} × ${i.qty}</span><span>${(priceTTC(i.book)*i.qty).toFixed(3)} TND</span></div>`).join('')}${remiseLine}<div class="rs-total"><span>Total TTC</span><span>${totNet.toFixed(3)} TND</span></div><div style="margin-top:.7rem;padding:.7rem 1rem;background:#F0EEFF;border:1.5px solid #A29BFE;border-radius:var(--rs);font-size:.78rem;color:var(--tx3)">ℹ️ Ce devis est valable 30 jours. Les prix sont indicatifs et peuvent varier.</div>`;}
function dlDevisPDF(){const items=Object.values(cart);if(!items.length){showToast('⚠️ Aucun livre sélectionné');return;}const{jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4'});const W=210,H=297,M=14;const clientName=document.getElementById('dv-name')?.value.trim()||'';const clientPhone=document.getElementById('dv-phone')?.value.trim()||'';const totBrut=items.reduce((s,i)=>s+priceTTC(i.book)*i.qty,0);const remiseAmt=remiseEnabled?+(totBrut*0.1).toFixed(3):0;const tot=window._devTot||totBrut;const devisNum='DV'+Date.now().toString().slice(-6);const today=new Date().toLocaleDateString('fr-TN');let y=0;doc.setFillColor(232,96,28);doc.rect(0,0,W,3,'F');y=3;doc.setFillColor(27,43,75);doc.rect(0,y,W,42,'F');if(logoUrl){try{doc.addImage(logoUrl,'PNG',M,y+7,26,26);}catch(e){}}const tx=logoUrl?M+32:M;doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(20);doc.text(libName,tx,y+17);doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(160,180,210);doc.text('Matricule Fiscal : '+libMF,tx,y+25);doc.text(libAddr+' · Tél : '+libTel,tx,y+33);doc.setFillColor(108,92,231);doc.roundedRect(W-M-45,y+6,45,30,3,3,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text('DEVIS',W-M-22.5,y+18,{align:'center'});doc.setFontSize(8);doc.text('N° '+devisNum,W-M-22.5,y+25,{align:'center'});doc.text('Date : '+today,W-M-22.5,y+32,{align:'center'});y+=42;doc.setFillColor(232,96,28);doc.rect(0,y,W,2,'F');y+=6;const blockH=26;doc.setFillColor(245,246,249);doc.rect(M,y,85,blockH,'F');doc.setDrawColor(226,230,239);doc.setLineWidth(0.5);doc.rect(M,y,85,blockH,'S');doc.setFillColor(27,43,75);doc.rect(M,y,85,6,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text('Établissement',M+3,y+4.2);doc.setTextColor(27,43,75);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text(filtSchool,M+3,y+12);doc.setFont('helvetica','normal');doc.text('Niveau : '+filtLv,M+3,y+19);const cx=M+90;doc.setFillColor(254,240,232);doc.rect(cx,y,W-cx-M,blockH,'F');doc.setDrawColor(232,96,28);doc.rect(cx,y,W-cx-M,blockH,'S');doc.setFillColor(232,96,28);doc.rect(cx,y,W-cx-M,6,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text('Client',cx+3,y+4.2);doc.setTextColor(27,43,75);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text(clientName||'—',cx+3,y+12);doc.setFont('helvetica','normal');doc.text('Tél : '+(clientPhone||'—'),cx+3,y+19);y+=blockH+7;const colLib=M+4,colQte=W-85,colPU=W-65,colTTC=W-M;doc.setFillColor(27,43,75);doc.rect(M,y,W-2*M,9,'F');doc.setFillColor(108,92,231);doc.rect(M,y,3,9,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text('Libellé / Matière',colLib,y+5.8);doc.text('QTE',colQte,y+5.8,{align:'center'});doc.text('Prix Unitaire',colPU,y+5.8,{align:'right'});doc.text('Total TTC',colTTC,y+5.8,{align:'right'});y+=9;items.forEach((item,idx)=>{const rh=9;doc.setFillColor(idx%2===0?255:248,idx%2===0?255:249,idx%2===0?255:252);doc.rect(M,y,W-2*M,rh,'F');doc.setFillColor(108,92,231);doc.rect(M,y,1.5,rh,'F');doc.setTextColor(27,43,75);doc.setFont('helvetica','normal');doc.setFontSize(7.2);const lib=(item.book.title||'').length>40?(item.book.title||'').substring(0,39)+'…':(item.book.title||'');doc.text(lib+' ('+item.book.subject+')',colLib,y+5.8);doc.text(String(item.qty),colQte,y+5.8,{align:'center'});doc.setTextColor(100,110,130);doc.text(priceTTC(item.book).toFixed(3)+' DT',colPU,y+5.8,{align:'right'});doc.setTextColor(108,92,231);doc.setFont('helvetica','bold');doc.text((priceTTC(item.book)*item.qty).toFixed(3)+' DT',colTTC,y+5.8,{align:'right'});y+=rh;});y+=4;const tblX=W-M-70,tblW=70;if(remiseAmt>0){doc.setFillColor(245,245,245);doc.rect(tblX,y,tblW,9,'F');doc.setDrawColor(200,200,200);doc.setLineWidth(0.4);doc.rect(tblX,y,tblW,9,'S');doc.setTextColor(80,90,110);doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.text('Sous-total',tblX+4,y+5.8);doc.text(totBrut.toFixed(3)+' DT',tblX+tblW-3,y+5.8,{align:'right'});y+=10;doc.setFillColor(230,247,242);doc.rect(tblX,y,tblW,9,'F');doc.setDrawColor(32,207,158);doc.rect(tblX,y,tblW,9,'S');doc.setTextColor(0,127,92);doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.text('Remise 10%',tblX+4,y+5.8);doc.text('-'+remiseAmt.toFixed(3)+' DT',tblX+tblW-3,y+5.8,{align:'right'});y+=11;}doc.setFillColor(108,92,231);doc.rect(tblX,y,tblW,10,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('Total TTC',tblX+4,y+6.8);doc.text(tot.toFixed(3)+' DT',tblX+tblW-3,y+6.8,{align:'right'});y+=17;doc.setFillColor(240,238,255);doc.rect(M,y,W-2*M,14,'F');doc.setDrawColor(108,92,231);doc.setLineWidth(0.5);doc.rect(M,y,W-2*M,14,'S');doc.setFillColor(108,92,231);doc.rect(M,y,3,14,'F');doc.setTextColor(27,43,75);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('Conditions du devis',M+6,y+5.5);doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text("Ce devis est valable 30 jours à compter de sa date d'émission. Les prix sont en TND TTC.",M+6,y+10.5);y+=20;doc.setFillColor(108,92,231);doc.rect(0,H-18,W,14,'F');doc.setFillColor(232,96,28);doc.rect(0,H-4,W,4,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.text(libName+' · '+libAddr+' · Tél : '+libTel,W/2,H-12,{align:'center'});doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text('Devis non contractuel — valable 30 jours à compter du '+today,W/2,H-6,{align:'center'});doc.setTextColor(130,140,160);doc.setFontSize(6.5);doc.text(new Date().toLocaleString('fr-FR'),M,H-20);doc.text('Page 1/1',W-M,H-20,{align:'right'});doc.save('devis_'+libName.replace(/\s+/g,'_')+'_'+devisNum+'.pdf');showToast('📄 Devis téléchargé');}
function confirmOrder(type){let name,phone,address,payLabel;if(type==='order'){name=document.getElementById('fname').value.trim();phone=document.getElementById('fphone').value.trim();address=document.getElementById('faddr').value.trim();if(!name||!phone){showToast('⚠️ Nom et téléphone requis');return;}payLabel=curPay==='visa'?'Visa Card':curPay==='edinar'?'E-Dinar':'Espèces';}else{name=document.getElementById('rfname').value.trim();phone=document.getElementById('rfphone').value.trim();address='—';if(!name||!phone){showToast('⚠️ Nom et téléphone requis');return;}payLabel=curResPay==='visa'?'Visa Card':curResPay==='edinar'?'E-Dinar':'Espèces (livraison)';if(acompteEnabled&&!avanceException){const inpAv=document.getElementById('avanceInput');const valAv=inpAv?parseFloat(inpAv.value):NaN;const min30=+((window._tot||0)*0.3).toFixed(3);if(!isNaN(valAv)&&valAv>0&&valAv<min30){showToast('⚠️ Avance minimum : '+min30.toFixed(3)+' TND');return;}}}const items=Object.values(cart);const tot=window._tot||0;const r={id:(orders.length+reservations.length+1),type:type,name,phone,address:address||'—',school:filtSchool,level:filtLv,items:items.map(i=>({ref:i.book.ean||'—',title:i.book.title,ean:i.book.ean||'—',subject:i.book.subject,priceHT:i.book.priceHT,remise:0,tva:0,qty:i.qty,netHT:+i.book.priceHT.toFixed(3),ttc:+i.book.priceHT.toFixed(3)})),totalQty:items.reduce((s,i)=>s+i.qty,0),totalHT:+items.reduce((s,i)=>s+i.book.priceHT*i.qty,0).toFixed(3),remiseAmt:remiseEnabled?+(items.reduce((s,i)=>s+i.book.priceHT*i.qty,0)*0.1).toFixed(3):0,totalHTNet:+items.reduce((s,i)=>s+i.book.priceHT*i.qty,0).toFixed(3),totalTaxes:0,total:tot,acompteAmt:type==='reserve'&&acompteEnabled?getAcompteAmt(tot):0,payment:payLabel,status:type==='order'?'Confirmée':'En attente',date:new Date().toLocaleDateString('fr-TN')};if(type==='order')orders.push(r);else reservations.push(r);lastOrder=r;saveDataToStorage();const ico=type==='order'?'✅':'📌';const title=type==='order'?'Commande confirmée !':'Réservation confirmée !';const msg=type==='order'?`Merci, ${name} ! ${r.totalQty} livre(s) commandé(s) pour ${filtSchool} (${filtLv}). Total TTC : ${tot.toFixed(3)} DT.`:`Merci, ${name} ! ${r.totalQty} livre(s) réservé(s). Nous vous contacterons au ${phone} sous ${deliveryNote}.`;document.getElementById('succIco').textContent=ico;document.getElementById('succTitle').textContent=title;document.getElementById('succMsg').textContent=msg;document.getElementById('succModal').classList.add('vis');}
function closeModal(){document.getElementById('succModal').classList.remove('vis');cart={};_books=[];filtSchool='';filtLv='';['fname','fphone','faddr','femail','rfname','rfphone'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});go('p1');}
function dlPDF(orderData){const order=orderData||lastOrder;if(!order){showToast('Aucune commande');return;}const {jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4'});const W=210,H=297,M=14;let y=0;doc.setFillColor(232,96,28);doc.rect(0,0,W,3,'F');y=3;doc.setFillColor(27,43,75);doc.rect(0,y,W,42,'F');if(logoUrl){try{doc.addImage(logoUrl,'PNG',M,y+7,26,26);}catch(e){}}const tx=logoUrl?M+32:M;doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(20);doc.text(libName,tx,y+17);doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(160,180,210);doc.text('Matricule Fiscal : '+libMF,tx,y+25);doc.text('Point de vente : '+libName,tx,y+31);doc.text(libAddr+' · Tél : '+libTel,tx,y+37);doc.setFillColor(0,168,120);doc.roundedRect(W-M-45,y+6,45,30,3,3,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(order.type==='reserve'?'RÉSERVATION':'BON DE COMMANDE',W-M-22.5,y+16,{align:'center'});doc.setFontSize(8);doc.text('N° '+String(order.id).padStart(6,'0'),W-M-22.5,y+23,{align:'center'});doc.text('Date : '+order.date,W-M-22.5,y+30,{align:'center'});y+=42;doc.setFillColor(232,96,28);doc.rect(0,y,W,2,'F');y+=6;const blockH=32;doc.setFillColor(245,246,249);doc.rect(M,y,85,blockH,'F');doc.setDrawColor(226,230,239);doc.setLineWidth(0.5);doc.rect(M,y,85,blockH,'S');doc.setFillColor(27,43,75);doc.rect(M,y,85,6,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text('Société',M+3,y+4.2);doc.setTextColor(27,43,75);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(libName,M+3,y+11);doc.text('Mat. Fiscal : '+libMF,M+3,y+17);doc.text('Adresse : '+libAddr,M+3,y+23);doc.text('Téléphone : '+libTel,M+3,y+29);const cx=M+90;doc.setFillColor(254,240,232);doc.rect(cx,y,W-cx-M,blockH,'F');doc.setDrawColor(232,96,28);doc.rect(cx,y,W-cx-M,blockH,'S');doc.setFillColor(232,96,28);doc.rect(cx,y,W-cx-M,6,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text('client',cx+3,y+4.2);doc.setTextColor(27,43,75);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('Nom et Prénom : '+order.name,cx+3,y+11);doc.setFont('helvetica','normal');doc.text('Tél : '+order.phone,cx+3,y+17);doc.text('Adresse : '+order.address,cx+3,y+23);doc.text('École : '+order.school+' — '+order.level,cx+3,y+29);y+=blockH+7;const colRef=M,colLib=M+22,colQte=W-92,colPU=W-79,colRem=W-63,colNetHT=W-50,colTVA=W-37,colTTC=W-M;doc.setFillColor(27,43,75);doc.rect(M,y,W-2*M,9,'F');doc.setFillColor(232,96,28);doc.rect(M,y,3,9,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(7);doc.text('Référence',colRef+4,y+5.8);doc.text('Libellé',colLib,y+5.8);doc.text('QTE',colQte,y+5.8,{align:'center'});doc.text('Prix Unit (HT)',colPU,y+5.8,{align:'right'});doc.text('Remise',colRem,y+5.8,{align:'right'});doc.text('PU NetHT',colNetHT,y+5.8,{align:'right'});doc.text('TVA',colTVA,y+5.8,{align:'center'});doc.text('Total (TTC)',colTTC,y+5.8,{align:'right'});y+=9;const pageArr=[1];order.items.forEach((item,idx)=>{const rh=9;if(y+rh>H-25){pdfDrawFooter(doc,W,H,libName,libAddr,libTel,order.type);doc.setTextColor(130,140,160);doc.setFontSize(6.5);doc.text('Page '+pageArr[0],W-M,H-20,{align:'right'});y=pdfNewPage(doc,W,H,M,libName,libAddr,libTel,order.type,colRef,colLib,colQte,colPU,colRem,colNetHT,colTVA,colTTC,pageArr);}doc.setFillColor(idx%2===0?255:248,idx%2===0?255:249,idx%2===0?255:252);doc.rect(M,y,W-2*M,rh,'F');doc.setFillColor(232,96,28);doc.rect(M,y,1.5,rh,'F');doc.setTextColor(27,43,75);doc.setFont('helvetica','normal');doc.setFontSize(7.2);doc.text(item.ean.substring(0,10),colRef+2,y+5.8);const lib=(item.title||'').length>30?(item.title||'').substring(0,29)+'…':(item.title||'');doc.text(lib,colLib,y+5.8);doc.text(String(item.qty),colQte,y+5.8,{align:'center'});doc.setTextColor(100,110,130);doc.text(item.priceHT.toFixed(3)+' DT',colPU,y+5.8,{align:'right'});doc.text(item.remise+'%',colRem,y+5.8,{align:'right'});doc.setTextColor(27,43,75);doc.text(item.netHT.toFixed(3)+' DT',colNetHT,y+5.8,{align:'right'});doc.setTextColor(100,110,130);doc.text(String(item.tva),colTVA,y+5.8,{align:'center'});doc.setTextColor(232,96,28);doc.setFont('helvetica','bold');doc.text((item.ttc*item.qty).toFixed(3)+' DT',colTTC,y+5.8,{align:'right'});y+=rh;});y+=4;if(y+65>H-25){pdfDrawFooter(doc,W,H,libName,libAddr,libTel,order.type);doc.setTextColor(130,140,160);doc.setFontSize(6.5);doc.text('Page '+pageArr[0],W-M,H-20,{align:'right'});doc.addPage();pageArr[0]++;y=20;}const tblX=W-M-70,tblW=70;if(order.remiseAmt>0){doc.setFillColor(230,247,242);doc.rect(tblX,y,tblW,9,'F');doc.setDrawColor(32,207,158);doc.setLineWidth(0.4);doc.rect(tblX,y,tblW,9,'S');doc.setTextColor(0,127,92);doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.text('Remise 10%',tblX+4,y+5.8);doc.text('-'+order.remiseAmt.toFixed(3)+' DT',tblX+tblW-3,y+5.8,{align:'right'});y+=11;}doc.setFillColor(232,96,28);doc.rect(tblX,y,tblW,10,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('Total TTC',tblX+4,y+6.8);doc.text(order.total.toFixed(3)+' DT',tblX+tblW-3,y+6.8,{align:'right'});y+=13;if(order.type==='reserve'&&order.acompteAmt>0){const acompte=(order.acompteAmt).toFixed(3);const rest=(order.total-order.acompteAmt).toFixed(3);const pct=Math.round(order.acompteAmt/order.total*100);doc.setFillColor(254,240,232);doc.rect(tblX,y,tblW,8,'F');doc.setDrawColor(232,96,28);doc.setLineWidth(0.3);doc.rect(tblX,y,tblW,8,'S');doc.setTextColor(200,78,20);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('Avance ('+pct+'%)',tblX+3,y+5.2);doc.text(acompte+' DT',tblX+tblW-3,y+5.2,{align:'right'});y+=10;doc.setFillColor(230,247,242);doc.rect(tblX,y,tblW,8,'F');doc.setDrawColor(0,127,92);doc.rect(tblX,y,tblW,8,'S');doc.setTextColor(0,127,92);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('Reste à payer',tblX+3,y+5.2);doc.text(rest+' DT',tblX+tblW-3,y+5.2,{align:'right'});y+=14;}else{y+=3;}const pc=order.payment==='Visa Card'?[27,43,75]:order.payment==='E-Dinar'?[0,168,120]:[232,96,28];doc.setFillColor(...pc);doc.roundedRect(M,y,55,9,3,3,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('Mode : '+order.payment,M+4,y+5.8);y+=16;if(order.type!=='reserve'){const sigY=y;doc.setDrawColor(200,208,224);doc.setLineWidth(0.4);doc.rect(W-M-62,sigY,62,28,'S');doc.setTextColor(74,85,104);doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text('Cachet et Signature CLIENT',W-M-59,sigY+6);for(let i=0;i<3;i++){doc.setDrawColor(200,208,224);doc.setLineWidth(0.3);doc.line(W-M-58,sigY+12+(i*5),W-M-3,sigY+12+(i*5));}const stx=M,sty=sigY,stw=80,sth=28;doc.setDrawColor(30,80,160);doc.setLineWidth(0.8);doc.rect(stx,sty,stw,sth,'S');doc.setDrawColor(30,80,160);doc.setLineWidth(0.3);doc.rect(stx+1.5,sty+1.5,stw-3,sth-3,'S');doc.setTextColor(30,80,160);doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.text(libName,stx+stw/2,sty+7,{align:'center'});doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text(libAddr,stx+stw/2,sty+12.5,{align:'center'});doc.setFontSize(7);doc.text('MF: '+libMF,stx+stw/2,sty+17.5,{align:'center'});doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text(libTel,stx+stw/2,sty+23,{align:'center'});doc.setTextColor(74,85,104);doc.setFont('helvetica','bold');doc.setFontSize(7);doc.text('Cachet et Signature',stx+3,sty+sth+5);y=sigY+36;}doc.setFillColor(0,168,120);doc.rect(0,H-18,W,14,'F');doc.setFillColor(232,96,28);doc.rect(0,H-4,W,4,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.text(libName+' · '+libAddr+' · Tél : '+libTel,W/2,H-12,{align:'center'});doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text('Merci de votre confiance — conserver ce document comme preuve de votre '+(order.type==='reserve'?'réservation.':'commande.'),W/2,H-6,{align:'center'});doc.setTextColor(130,140,160);doc.setFontSize(6.5);const now=new Date();doc.text(now.toLocaleString('fr-FR'),M,H-20);doc.text('Page 1/1',W-M,H-20,{align:'right'});doc.save((order.type==='reserve'?'reservation_':'commande_')+order.name.replace(/\s+/g,'_')+'_'+String(order.id).padStart(6,'0')+'.pdf');showToast('📄 '+(lang==='fr'?'Document téléchargé':'Document downloaded'));}
function doLogin(){const u=document.getElementById('al-u').value;const p=document.getElementById('al-p').value;if(u===adminUser&&p===adminPass){document.getElementById('al-page').classList.remove('vis');openAdmin();}else{document.getElementById('alerr').textContent='✗ Identifiants incorrects.';}}
function openAdmin(){['p1','p2','p3','p4'].forEach(p=>document.getElementById(p).classList.remove('active'));document.getElementById('adm-page').classList.add('active');document.getElementById('s-name').value=libName;document.getElementById('s-tag').value=libTag;document.getElementById('s-tel').value=libTel;document.getElementById('s-mf').value=libMF;document.getElementById('s-addr').value=libAddr;document.getElementById('s-del').value=deliveryFee.toFixed(3);document.getElementById('s-usr').value=adminUser;const hsub=document.getElementById('s-hsub');if(hsub)hsub.value=heroSubTxt;const dnote=document.getElementById('s-dnote');if(dnote)dnote.value=deliveryNote;syncLogos();renderSchoolTags();buildAdmSchOpts();updateStorageInfo();syncOrderToggle();aTab(0);}
function logout(){document.getElementById('adm-page').classList.remove('active');go('p1');}
let curAT=0;
let _xlRows=[],_xlHeaders=[];
function handleExcelFile(input){
  const file=input.files[0];if(!file)return;
  const nameEl=document.getElementById('xlFileName');if(nameEl)nameEl.textContent=file.name;
  if(typeof XLSX==='undefined'){alert('La bibliothèque de lecture Excel n\'est pas chargée. Vérifiez votre connexion internet et rechargez la page.');return;}
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=new Uint8Array(e.target.result);
      const wb=XLSX.read(data,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      if(!rows||rows.length<2){alert('Fichier vide ou invalide.');return;}
      _xlHeaders=(rows[0]||[]).map(String);
      _xlRows=rows.slice(1).filter(r=>r.some(c=>String(c).trim()!==''));
      showExcelMapper();
    }catch(ex){alert('Erreur lors de la lecture du fichier : '+ex.message);}
  };
  reader.readAsArrayBuffer(file);
}
function showExcelMapper(){
  const opts=_xlHeaders.map((h,i)=>`<option value="${i}">${h||'Colonne '+(i+1)}</option>`).join('');
  const optsOpt='<option value="-1">— Aucune —</option>'+opts;
  const norm=s=>s.toLowerCase().replace(/[éèêë]/g,'e').replace(/[àâä]/g,'a').replace(/[îï]/g,'i').replace(/[ôö]/g,'o').replace(/[ùûü]/g,'u').trim();
  // Score-based detection: tries each header against each term, returns best match index
  const findCol=(...terms)=>{
    let best=-1,bestScore=0;
    _xlHeaders.forEach((h,i)=>{
      const hn=norm(h);
      let score=0;
      terms.forEach((t,ti)=>{
        if(hn===t)score+=100-ti*10; // exact match → high score
        else if(hn.startsWith(t))score+=60-ti*5;
        else if(hn.includes(t))score+=30-ti*3;
      });
      if(score>bestScore){bestScore=score;best=i;}
    });
    return best;
  };
  const iT=findCol('designation','titre','title','nom livre','libelle','lib','description');
  const iE=findCol('ean','isbn','code barre','barcode','ref article','reference','ref');
  const iSub=findCol('matiere','matieres','discipline','subject','famille','categorie');
  const iP=findCol('prix','price','tarif','montant','pvt','pvttc');
  const iS=findCol('ecole','etablissement','school','institution');
  const iL=findCol('classe','niveau','niveaux','level','class','annee');
  ['xlColTitle','xlColEan','xlColSchool','xlColLevel'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=opts;});
  ['xlColSubject','xlColPrix'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=optsOpt;});
  const s=(id,v)=>{const el=document.getElementById(id);if(el&&v>=0)el.value=v;};
  s('xlColTitle',iT);s('xlColEan',iE);s('xlColSubject',iSub);s('xlColPrix',iP);s('xlColSchool',iS);s('xlColLevel',iL);
  const w=document.getElementById('xlMapWrap');if(w)w.style.display='block';
  xlUpdatePreview();
  xlCheckConflicts();
}
function xlCheckConflicts(){
  const g=id=>{const el=document.getElementById(id);return el&&el.value!==''?+el.value:-99;};
  const map={xlColTitle:'Titre',xlColEan:'EAN/Ref',xlColSubject:'Matière',xlColPrix:'Prix',xlColSchool:'École',xlColLevel:'Niveau'};
  const used={};let conflict=false;
  Object.entries(map).forEach(([id,label])=>{
    const v=g(id);if(v<0)return;
    if(used[v]){conflict=true;}else used[v]=label;
  });
  let warn=document.getElementById('xlConflictWarn');
  if(!warn){warn=document.createElement('div');warn.id='xlConflictWarn';warn.style.cssText='margin-bottom:10px;padding:8px 12px;background:#FEF3C7;border:1.5px solid #F59E0B;border-radius:8px;font-size:.8rem;color:#92400E;font-weight:600';const w=document.getElementById('xlMapWrap');if(w)w.insertBefore(warn,w.querySelector('.twrap'));}
  warn.style.display=conflict?'block':'none';
  warn.textContent=conflict?'⚠️ Two columns point to the same index — please check the dropdowns above before importing.':'';
}
function xlUpdatePreview(){
  const g=id=>{const el=document.getElementById(id);return el?+el.value:0;};
  const go=id=>{const el=document.getElementById(id);return el?+el.value:-1;};
  const iT=g('xlColTitle'),iE=g('xlColEan'),iSub=go('xlColSubject'),iP=go('xlColPrix');
  const prev=_xlRows.slice(0,6);
  const tb=document.getElementById('xlPrevBody');
  if(tb)tb.innerHTML=prev.map(r=>`<tr>
    <td>${r[iT]||'—'}</td>
    <td style="font-size:.73rem;color:var(--tx3)">${r[iE]||'—'}</td>
    <td style="color:var(--tx2)">${iSub>=0?(r[iSub]||'—'):'—'}</td>
    <td style="color:var(--green)">${iP>=0?(r[iP]||'—'):'—'}</td>
  </tr>`).join('');
  const cnt=document.getElementById('xlCount');
  if(cnt)cnt.textContent=_xlRows.length+' ligne(s) détectée(s) · aperçu des 6 premières';
}
let _xlSchoolMap={};
const ETAB_PREFIX={'Primaire':'École Primaire','Collège':'Collège','Lycée':'Lycée'};
function xlEtabKey(exSchool,etab){return exSchool+'|||'+(etab||'Autre');}
function xlFindBestSchool(query,etab,candidates){
  if(!candidates.length)return null;
  const clean=s=>s.toLowerCase().replace(/['''\-_\.]/g,' ').split(/\s+/).filter(t=>t.length>1);
  const qTokens=clean(query);
  // First: try to find school that matches both name tokens AND etablissement type
  const prefix=(ETAB_PREFIX[etab]||'').toLowerCase();
  let bestScore=0,bestMatch=null;
  candidates.forEach(cand=>{
    const cTokens=clean(cand);
    let score=0;
    qTokens.forEach(qt=>{if(cTokens.some(ct=>ct===qt||ct.startsWith(qt)||qt.startsWith(ct)))score++;});
    if(score===0)return;
    // Bonus if the candidate school name contains the etab prefix
    const candLow=cand.toLowerCase();
    if(prefix&&candLow.includes(prefix.split(' ')[0]))score+=0.5;
    const norm=score/Math.max(qTokens.length,1);
    if(norm>bestScore){bestScore=norm;bestMatch=cand;}
  });
  return bestScore>0?bestMatch:null;
}
function xlShowSchoolMap(){
  const g=id=>{const el=document.getElementById(id);return el?+el.value:0;};
  const iS=g('xlColSchool'),iL=g('xlColLevel');
  // Build unique (excelSchool, etabType) pairs
  const pairs=[];const seen=new Set();
  _xlRows.forEach(r=>{
    const ex=String(r[iS]||'').trim();
    const lv=String(r[iL]||'').trim();
    const et=getEtablissement(lv)||'Autre';
    const k=xlEtabKey(ex,et);
    if(ex&&!seen.has(k)){seen.add(k);pairs.push({ex,et});}
  });
  const existing=Object.keys(schoolLevels);
  _xlSchoolMap={};
  pairs.forEach(({ex,et})=>{
    const suggested=xlFindBestSchool(ex,et,existing);
    const autoName=(ETAB_PREFIX[et]?ETAB_PREFIX[et]+' ':'')+ex;
    _xlSchoolMap[xlEtabKey(ex,et)]=suggested||'__NEW__:'+autoName;
  });
  const existOpts=existing.map(s=>`<option value="${s}">${s}</option>`).join('');
  const tbody=document.getElementById('xlSchoolMapBody');
  if(!tbody)return;
  const etabBadge=et=>{const col=etabColor(et);return`<span style="font-size:.7rem;background:${col.bg};color:${col.tx};border-radius:4px;padding:1px 8px;font-weight:700">${et}</span>`;};
  tbody.innerHTML=pairs.map(({ex,et})=>{
    const mapVal=_xlSchoolMap[xlEtabKey(ex,et)];
    const isNew=mapVal.startsWith('__NEW__:');
    const newName=isNew?mapVal.slice(8):'';
    const badge=isNew
      ?`<span style="background:#FEF3C7;color:#B45309;border-radius:4px;padding:1px 8px;font-size:.72rem">Sera créée</span>`
      :`<span style="background:#D1FAE5;color:#065F46;border-radius:4px;padding:1px 8px;font-size:.72rem">Trouvée ✓</span>`;
    const newOpt=`<option value="__NEW__:${newName}">➕ Créer : "${newName}"</option>`;
    return `<tr>
      <td style="font-weight:600">${ex}</td>
      <td>${etabBadge(et)}</td>
      <td style="text-align:center;color:var(--tx3)">→</td>
      <td><select class="adm-inp xl-smap" data-key="${xlEtabKey(ex,et)}" style="width:100%;font-size:.82rem">${newOpt}${existOpts}</select></td>
      <td>${badge}</td>
    </tr>`;
  }).join('');
  // Set selected values
  pairs.forEach(({ex,et})=>{
    const key=xlEtabKey(ex,et);
    const mapVal=_xlSchoolMap[key];
    const sel=tbody.querySelector(`[data-key="${key}"]`);
    if(!sel)return;
    if(mapVal.startsWith('__NEW__:')){sel.value=mapVal;}
    else{sel.value=mapVal;if(sel.value!==mapVal){sel.insertAdjacentHTML('afterbegin',`<option value="${mapVal}" selected>${mapVal}</option>`);}}
    sel.addEventListener('change',()=>{
      const tr=sel.closest('tr');const badge=tr.querySelector('td:last-child');
      if(badge)badge.innerHTML=sel.value.startsWith('__NEW__:')
        ?`<span style="background:#FEF3C7;color:#B45309;border-radius:4px;padding:1px 8px;font-size:.72rem">Sera créée</span>`
        :`<span style="background:#D1FAE5;color:#065F46;border-radius:4px;padding:1px 8px;font-size:.72rem">Confirmée ✓</span>`;
    });
  });
  document.getElementById('xlSchoolMapWrap').style.display='block';
  document.getElementById('xlSchoolMapWrap').scrollIntoView({behavior:'smooth',block:'start'});
}
function xlBackToStep1(){document.getElementById('xlSchoolMapWrap').style.display='none';}
function doExcelImport(){
  try{
  const g=id=>{const el=document.getElementById(id);return el&&el.value!==''?+el.value:0;};
  const go=id=>{const el=document.getElementById(id);return el&&el.value!==''?+el.value:-1;};
  const iT=g('xlColTitle'),iE=g('xlColEan'),iSub=go('xlColSubject'),iP=go('xlColPrix'),iS=g('xlColSchool'),iL=g('xlColLevel');
  if(!_xlRows.length){alert('Aucune donnée à importer. Veuillez d\'abord charger un fichier Excel.');return;}
  let added=0,skipped=0,schoolsCreated=0,levelsCreated=0;
  _xlRows.forEach(r=>{
    const title=String(r[iT]||'').trim();
    const ean=String(r[iE]||'').trim();
    const subject=iSub>=0?String(r[iSub]||'').trim():'';
    const prixRaw=iP>=0?parseFloat(String(r[iP]||'').replace(',','.')):0;
    const prix=isNaN(prixRaw)?0:prixRaw;
    const rawSchool=String(r[iS]||'').trim().replace(/[.#$\/\[\]]/g,'-').replace(/\s+/g,' ');
    const level=String(r[iL]||'').trim().replace(/[.#$\/\[\]]/g,'-').replace(/\s+/g,' ');
    if(!title||!rawSchool||!level){skipped++;return;}
    // Build full school name with etablissement prefix
    const etab=getEtablissement(level)||'';
    const prefix=ETAB_PREFIX[etab]?ETAB_PREFIX[etab]+' ':'';
    const pLow=prefix.toLowerCase().trim();
    const rLow=rawSchool.toLowerCase();
    // Find existing school: exact match OR prefix+rawSchool match (MUST respect etab type)
    const existingMatch=Object.keys(schoolLevels).find(s=>{
      const sLow=s.toLowerCase();
      if(sLow===rLow)return true; // exact match (rawSchool already has full name)
      if(pLow&&sLow===pLow+' '+rLow)return true; // "Collège GF" matches rawSchool="GF" etab=Collège
      return false;
    });
    const school=existingMatch||(prefix+rawSchool);
    // Create school if missing
    if(!schoolLevels[school]){schoolLevels[school]=[];schoolsCreated++;}
    // Create level if missing
    if(!schoolLevels[school].includes(level)){schoolLevels[school].push(level);levelsCreated++;}
    const key=gk(school,level);
    if(!booksDB[key])booksDB[key]=[];
    // Skip if book already exists (by EAN or title)
    const exists=booksDB[key].some(b=>(ean&&b.ean===ean)||(b.title===title));
    if(exists){skipped++;return;}
    booksDB[key].push({id:'b'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),title,ean,subject,priceHT:prix,color:''});
    added++;
  });
  syncBookImagesByEan();
  saveDataToStorage();
  if(fbDb){
    const fbSafe=k=>k.replace(/[.#$\/\[\]]/g,'_');
    const bl={};
    Object.keys(booksDB).forEach(k=>{bl[fbSafe(k)]=booksDB[k].map(b=>({id:b.id,title:b.title,ean:b.ean,subject:b.subject||'',priceHT:b.priceHT||0,color:b.color||''}));});
    const ssl={};Object.keys(schoolLevels).forEach(s=>{ssl[fbSafe(s)]=schoolLevels[s];});
    fbDb.ref('librairie/config').update({schoolLevels:ssl,booksDB:bl}).catch(()=>{});
  }
  const w=document.getElementById('xlMapWrap');if(w)w.style.display='none';
  const fn=document.getElementById('xlFileName');if(fn)fn.textContent='Aucun fichier sélectionné';
  const fi=document.getElementById('xlFile');if(fi)fi.value='';
  _xlRows=[];_xlHeaders=[];
  const msg=['✅ Importation terminée !','','📚 '+added+' livre(s) ajouté(s)','⏭️ '+skipped+' ignoré(s) (déjà présent ou données manquantes)'];
  if(schoolsCreated)msg.push('🏫 '+schoolsCreated+' école(s) créée(s)');
  if(levelsCreated)msg.push('📋 '+levelsCreated+' niveau(x) créé(s)');
  alert(msg.join('\n'));
  }catch(ex){alert('Erreur lors de l\'importation : '+ex.message);}
}
let _fourAgg=[];
function renderFournisseur(){
  const inclOrders=document.getElementById('fourInclOrders')&&document.getElementById('fourInclOrders').checked;
  const inclResvs=document.getElementById('fourInclResvs')&&document.getElementById('fourInclResvs').checked;
  const rows=[];
  if(inclOrders)orders.forEach(r=>rows.push({...r,_type:'Commande'}));
  if(inclResvs)reservations.forEach(r=>rows.push({...r,_type:'Réservation'}));
  rows.sort((a,b)=>b.id-a.id);
  const tb=document.getElementById('fourBody');if(!tb)return;
  tb.innerHTML=rows.map(r=>{
    const nb=(r.items||[]).reduce((s,x)=>s+x.qty,0);
    const d=r.date?new Date(r.date).toLocaleDateString('fr-FR'):'—';
    return `<tr>
      <td><input type="checkbox" class="four-chk" data-id="${r.id}" data-type="${r._type}" onchange="fourUpdateCount()"></td>
      <td>#${r.id}</td>
      <td><span style="background:${r._type==='Commande'?'var(--green)':'var(--orange)'};color:white;border-radius:4px;padding:1px 7px;font-size:.72rem">${r._type}</span></td>
      <td>${r.name||'—'}</td>
      <td style="font-size:.78rem">${r.school||'—'} / ${r.level||'—'}</td>
      <td style="text-align:center;font-weight:700">${nb}</td>
      <td style="font-size:.78rem">${d}</td>
    </tr>`;
  }).join('');
  fourUpdateCount();
}
function fourUpdateCount(){
  const chks=document.querySelectorAll('.four-chk:checked');
  const el=document.getElementById('fourSelCount');
  if(el)el.textContent=chks.length+' sélectionné(s)';
  const allChks=document.querySelectorAll('.four-chk');
  const ca=document.getElementById('fourChkAll');
  if(ca)ca.checked=allChks.length>0&&chks.length===allChks.length;
}
function fourSelAll(v){
  document.querySelectorAll('.four-chk').forEach(c=>{c.checked=!!v;});
  fourUpdateCount();
}
function genFournisseurCmd(){
  const chks=[...document.querySelectorAll('.four-chk:checked')];
  if(!chks.length){alert('Veuillez sélectionner au moins une commande ou réservation.');return;}
  const agg={};
  chks.forEach(c=>{
    const id=+c.dataset.id;const tp=c.dataset.type;
    const src=tp==='Commande'?orders:reservations;
    const rec=src.find(r=>r.id===id);
    if(!rec)return;
    (rec.items||[]).forEach(item=>{
      const k=item.ean||item.title;
      if(!agg[k])agg[k]={ean:item.ean||'—',title:item.title||'—',qty:0};
      agg[k].qty+=item.qty;
    });
  });
  _fourAgg=Object.values(agg).sort((a,b)=>a.title.localeCompare(b.title));
  const tbody=document.getElementById('fourResBody');
  if(!tbody)return;
  const totalQty=_fourAgg.reduce((s,x)=>s+x.qty,0);
  tbody.innerHTML=_fourAgg.map((r,i)=>`<tr>
    <td style="color:var(--tx3)">${i+1}</td>
    <td>${r.title}</td>
    <td style="font-size:.78rem;color:var(--tx3)">${r.ean}</td>
    <td style="text-align:right;font-weight:700;color:var(--orange)">${r.qty}</td>
  </tr>`).join('');
  const sumEl=document.getElementById('fourSummary');
  if(sumEl)sumEl.textContent=_fourAgg.length+' titre(s) différent(s) · '+totalQty+' exemplaire(s) au total · depuis '+chks.length+' commande(s)/réservation(s)';
  const res=document.getElementById('fourResult');
  if(res){res.style.display='block';res.scrollIntoView({behavior:'smooth',block:'start'});}
}
function dlFournisseurPDF(){
  if(!_fourAgg||!_fourAgg.length){alert('Générez d\'abord la commande.');return;}
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'mm',format:'a4'});
  const W=210,H=297,M=14;
  doc.setFillColor(0,168,120);doc.rect(0,0,W,22,'F');
  doc.setFillColor(232,96,28);doc.rect(0,22,W,3,'F');
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(15);
  doc.text(libName,M,10);
  doc.setFontSize(8.5);doc.setFont('helvetica','normal');
  doc.text(libAddr+' · Tél : '+libTel,M,16);
  doc.setTextColor(27,43,75);doc.setFont('helvetica','bold');doc.setFontSize(13);
  doc.text('BON DE COMMANDE FOURNISSEUR',W/2,33,{align:'center'});
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(100,110,130);
  doc.text('Date : '+new Date().toLocaleDateString('fr-FR'),W-M,33,{align:'right'});
  doc.setTextColor(27,43,75);doc.setFontSize(8);
  const totalQty=_fourAgg.reduce((s,x)=>s+x.qty,0);
  doc.text(_fourAgg.length+' titre(s) · '+totalQty+' exemplaire(s) au total',M,40);
  let y=47;
  const cT=M,cE=M+100,cQ=W-M;
  doc.setFillColor(27,43,75);doc.rect(M,y,W-2*M,8,'F');
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(8.5);
  doc.text('Titre',cT+2,y+5.5);doc.text('EAN',cE,y+5.5);doc.text('Qté',cQ,y+5.5,{align:'right'});
  y+=8;
  _fourAgg.forEach((r,i)=>{
    if(y+8>H-20){
      doc.setFillColor(0,168,120);doc.rect(0,H-18,W,14,'F');
      doc.setFillColor(232,96,28);doc.rect(0,H-4,W,4,'F');
      doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(8);
      doc.text(libName+' · '+libAddr+' · Tél : '+libTel,W/2,H-12,{align:'center'});
      doc.addPage();y=20;
      doc.setFillColor(27,43,75);doc.rect(M,y,W-2*M,8,'F');
      doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(8.5);
      doc.text('Titre',cT+2,y+5.5);doc.text('EAN',cE,y+5.5);doc.text('Qté',cQ,y+5.5,{align:'right'});
      y+=8;
    }
    doc.setFillColor(i%2===0?255:245,i%2===0?255:247,i%2===0?255:255);
    doc.rect(M,y,W-2*M,8,'F');
    doc.setTextColor(27,43,75);doc.setFont('helvetica','normal');doc.setFontSize(8);
    const tit=r.title.length>52?r.title.substring(0,51)+'…':r.title;
    doc.text(tit,cT+2,y+5.3);
    doc.setTextColor(100,110,130);doc.text(r.ean,cE,y+5.3);
    doc.setTextColor(232,96,28);doc.setFont('helvetica','bold');doc.setFontSize(9);
    doc.text(String(r.qty),cQ,y+5.5,{align:'right'});
    y+=8;
  });
  y+=4;
  doc.setDrawColor(200,200,210);doc.setLineWidth(0.3);doc.line(M,y,W-M,y);y+=6;
  doc.setTextColor(27,43,75);doc.setFont('helvetica','bold');doc.setFontSize(9);
  doc.text('Total : '+totalQty+' exemplaire(s)',W-M,y,{align:'right'});
  doc.setFillColor(0,168,120);doc.rect(0,H-18,W,14,'F');
  doc.setFillColor(232,96,28);doc.rect(0,H-4,W,4,'F');
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(8.5);
  doc.text(libName+' · '+libAddr+' · Tél : '+libTel,W/2,H-12,{align:'center'});
  doc.setFont('helvetica','normal');doc.setFontSize(7);
  doc.text('Document généré le '+new Date().toLocaleDateString('fr-FR'),W/2,H-6,{align:'center'});
  doc.save('commande-fournisseur-'+new Date().toISOString().slice(0,10)+'.pdf');
}
function aTab(i){curAT=i;document.querySelectorAll('.atab').forEach((t,j)=>t.classList.toggle('on',j===i));document.querySelectorAll('.tpanel').forEach((p,j)=>p.classList.toggle('on',j===i));if(i===0)renderDash();if(i===1)renderOrders();if(i===2)renderResvs();if(i===3)renderClients();if(i===4)renderReceipts();if(i===5)updateStorageInfo();if(i===6)renderFournisseur();}
function toggleDelivery(id){const o=orders.find(r=>String(r.id)===String(id));if(!o)return;o.delivered=!o.delivered;saveDataToStorage();renderOrders();showToast(o.delivered?'📦 Marquée comme livrée':'🕐 Marquée comme non livrée');}
function buildRow(r){const pc=r.payment==='Visa Card'?'bvis':r.payment==='E-Dinar'?'bedin':r.payment==='Espèces'?'bcash':'bres';const sc=r.status==='Confirmée'?'bok':'bpend';const dlvBtn=r.delivered?`<button class="del-row-btn" style="background:#20cf9e;border-color:#20cf9e;min-width:80px" onclick="toggleDelivery(${r.id})" title="Cliquer pour marquer non livrée">📦 Livré</button>`:`<button class="del-row-btn" style="background:#718096;border-color:#718096;min-width:80px" onclick="toggleDelivery(${r.id})" title="Cliquer pour marquer livrée">🕐 En cours</button>`;return`<tr style="${r.delivered?'opacity:.7':''}"><td>#${String(r.id).padStart(4,'0')}</td><td><strong>${r.name}</strong></td><td>${r.phone}</td>${r.address!==undefined?`<td style="font-size:.76rem;max-width:100px">${r.address}</td>`:''}<td>${r.school}</td><td>${r.level}</td><td>${r.totalQty}</td><td><strong>${r.total.toFixed(3)} DT</strong></td><td><span class="badge ${pc}">${r.payment}</span></td><td><span class="badge ${sc}">${r.status}</span></td><td>${r.date}</td><td style="display:flex;gap:4px">${dlvBtn}<button class="del-row-btn" onclick="deleteOrder(${r.id})" title="Supprimer">🗑️</button></td></tr>`;}
function deleteOrder(id){if(!confirm('Supprimer cette commande ?'))return;orders=orders.filter(o=>String(o.id)!==String(id));saveDataToStorage();renderOrders();renderDash();showToast('🗑️ Commande supprimée');}
function deleteReservation(id){if(!confirm('Supprimer cette réservation ?'))return;reservations=reservations.filter(r=>String(r.id)!==String(id));saveDataToStorage();renderResvs();renderDash();showToast('🗑️ Réservation supprimée');}
function renderDash(){const allRec=[...orders,...reservations];const rev=orders.reduce((s,r)=>s+r.total,0);const avances=reservations.reduce((s,r)=>s+(r.acompteAmt||0),0);const bks=allRec.reduce((s,r)=>s+r.totalQty,0);const uni=[...new Set(allRec.map(r=>r.phone))].length;document.getElementById('statsRow').innerHTML=`<div class="scard"><div class="scard-ico">📋</div><div class="scard-val">${orders.length}</div><div class="scard-lbl">Commandes</div></div><div class="scard"><div class="scard-ico">📌</div><div class="scard-val">${reservations.length}</div><div class="scard-lbl">Réservations</div></div><div class="scard"><div class="scard-ico">💰</div><div class="scard-val hi">${(rev+avances).toFixed(3)}</div><div class="scard-lbl">Revenu (DT)</div></div><div class="scard"><div class="scard-ico">👥</div><div class="scard-val">${uni}</div><div class="scard-lbl">Clients</div></div><div class="scard"><div class="scard-ico">📚</div><div class="scard-val">${bks}</div><div class="scard-lbl">Livres réservés</div></div>`;document.getElementById('recentWrap').innerHTML=`<div class="sec-h" style="margin-top:1.25rem">📋 Activité récente</div><div class="twrap"><table class="dtable"><thead><tr><th>#</th><th>Nom</th><th>Type</th><th>École</th><th>Total</th><th>Statut</th><th>Date</th></tr></thead><tbody>${[...orders,...reservations].slice(-6).reverse().map(r=>`<tr><td>#${String(r.id).padStart(4,'0')}</td><td><strong>${r.name}</strong></td><td><span class="badge ${r.type==='order'?'bvis':'bres'}">${r.type==='order'?'Commande':'Réservation'}</span></td><td>${r.school}</td><td><strong>${r.total.toFixed(3)} DT</strong></td><td><span class="badge ${r.status==='Confirmée'?'bok':'bpend'}">${r.status}</span></td><td>${r.date}</td></tr>`).join('')}</tbody></table></div>`;}
function renderOrders(){document.getElementById('ordBody').innerHTML=orders.slice().reverse().map(r=>buildRow(r)).join('');}
function confirmReservation(id){if(!confirm('Convertir cette réservation en commande payée et fermée ?'))return;const idx=reservations.findIndex(r=>String(r.id)===String(id));if(idx===-1)return;const r={...reservations[idx],type:'order',status:'Confirmée',acompteAmt:0};reservations.splice(idx,1);orders.push(r);saveDataToStorage();renderResvs();renderOrders();renderDash();showToast('✅ Réservation convertie en commande');}
function renderResvs(){document.getElementById('resvBody').innerHTML=reservations.slice().reverse().map(r=>`<tr><td>#${String(r.id).padStart(4,'0')}</td><td><strong>${r.name}</strong></td><td>${r.phone}</td><td>${r.school}</td><td>${r.level}</td><td>${r.totalQty}</td><td><strong>${r.total.toFixed(3)} DT</strong></td><td><span class="badge bcash">${r.payment}</span></td><td><span class="badge bpend">${r.status}</span></td><td>${r.date}</td><td style="display:flex;gap:4px"><button class="del-row-btn" style="background:#20cf9e;border-color:#20cf9e" onclick="confirmReservation(${r.id})" title="Convertir en commande payée">✅</button><button class="del-row-btn" onclick="deleteReservation(${r.id})" title="Supprimer">🗑️</button></td></tr>`).join('');}
function renderClients(){const m={};[...orders,...reservations].forEach(r=>{if(!m[r.phone])m[r.phone]={name:r.name,phone:r.phone,address:r.address||'—',orders:0,spent:0,last:r.date};m[r.phone].orders++;m[r.phone].spent+=r.total;m[r.phone].last=r.date;});document.getElementById('cliBody').innerHTML=Object.values(m).map((c,i)=>`<tr><td>${i+1}</td><td><strong>${c.name}</strong></td><td>${c.phone}</td><td style="font-size:.76rem">${c.address}</td><td>${c.orders}</td><td><strong>${c.spent.toFixed(3)} DT</strong></td><td>${c.last}</td></tr>`).join('');}
function dlPDFById(id){const r=[...orders,...reservations].find(r=>String(r.id)===String(id));if(r)dlPDF(r);}
function pdfDrawFooter(doc,W,H,libName,libAddr,libTel,type){doc.setFillColor(0,168,120);doc.rect(0,H-18,W,14,'F');doc.setFillColor(232,96,28);doc.rect(0,H-4,W,4,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.text(libName+' · '+libAddr+' · Tél : '+libTel,W/2,H-12,{align:'center'});doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text('Merci de votre confiance — conserver ce document comme preuve de votre '+(type==='reserve'?'réservation.':'commande.'),W/2,H-6,{align:'center'});}
function pdfNewPage(doc,W,H,M,libName,libAddr,libTel,type,colRef,colLib,colQte,colPU,colRem,colNetHT,colTVA,colTTC,pageArr){pdfDrawFooter(doc,W,H,libName,libAddr,libTel,type);doc.addPage();pageArr[0]++;doc.setFillColor(27,43,75);doc.rect(M,8,W-2*M,9,'F');doc.setFillColor(232,96,28);doc.rect(M,8,3,9,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(7);doc.text('Référence',colRef+4,13.8);doc.text('Libellé',colLib,13.8);doc.text('QTE',colQte,13.8,{align:'center'});doc.text('Prix Unit (HT)',colPU,13.8,{align:'right'});doc.text('Remise',colRem,13.8,{align:'right'});doc.text('PU NetHT',colNetHT,13.8,{align:'right'});doc.text('TVA',colTVA,13.8,{align:'center'});doc.text('Total (TTC)',colTTC,13.8,{align:'right'});return 17;}
function renderReceipts(){const all=[...orders,...reservations].slice().reverse();const w=document.getElementById('recWrap');if(!all.length){w.innerHTML=`<div style="padding:2rem;text-align:center;color:var(--tx3);font-size:.86rem">Aucun reçu pour le moment.</div>`;return;}w.innerHTML=all.map(r=>`<div class="rec-row"><div class="rec-info"><div class="rec-name">#${String(r.id).padStart(4,'0')} — ${r.name} <span class="badge ${r.type==='order'?'bvis':'bres'}" style="margin-left:4px">${r.type==='order'?'Commande':'Réservation'}</span></div><div class="rec-meta">${r.phone} · ${r.school} · ${r.level} · ${r.totalQty} livre(s) · <span class="badge ${r.payment==='Visa Card'?'bvis':r.payment==='E-Dinar'?'bedin':'bcash'}">${r.payment}</span> · ${r.date}</div></div><div class="rec-price">${r.total.toFixed(3)} DT</div><button class="rec-dl" onclick="dlPDFById(${r.id})">📄 Télécharger</button></div>`).join('');}
function saveLogos(){try{if(logoUrl)localStorage.setItem('librairie_logo',logoUrl);else localStorage.removeItem('librairie_logo');}catch(e){}try{if(logoNavUrl)localStorage.setItem('librairie_navlogo',logoNavUrl);else localStorage.removeItem('librairie_navlogo');}catch(e){}if(fbDb){fbDb.ref('librairie/logos').set({main:logoUrl||'',nav:logoNavUrl||''}).catch(()=>{});}}
function loadLogos(){try{const l=localStorage.getItem('librairie_logo');if(l&&!logoUrl)logoUrl=l;}catch(e){}try{const l=localStorage.getItem('librairie_navlogo');if(l&&!logoNavUrl)logoNavUrl=l;}catch(e){}}
function uploadLogo(input){const f=input.files[0];if(!f)return;const rd=new FileReader();rd.onload=e=>{logoUrl=e.target.result;saveLogos();if(autoSave)saveDataToStorage();syncLogos();showToast('✅ Logo page d\'accueil téléchargé');};rd.readAsDataURL(f);}
function clearLogo(){logoUrl='';saveLogos();if(autoSave)saveDataToStorage();syncLogos();showToast('🗑️ Logo page d\'accueil effacé');}
function uploadNavLogo(input){const f=input.files[0];if(!f)return;const rd=new FileReader();rd.onload=e=>{logoNavUrl=e.target.result;saveLogos();if(autoSave)saveDataToStorage();syncLogos();showToast('✅ Logo navigation téléchargé');};rd.readAsDataURL(f);}
function clearNavLogo(){logoNavUrl='';saveLogos();if(autoSave)saveDataToStorage();syncLogos();showToast('🗑️ Logo navigation effacé');}
function syncLogos(){
const heroL=logoUrl;const navL=logoNavUrl||logoUrl;
[['hLogoImg','hLogoFb',heroL],['lpImg','lpFb',heroL],['lpNavImg','lpNavFb',navL],['nLi2','nLf2',navL],['nLi3','nLf3',navL],['nLi4','nLf4',navL],['nLi5','nLf5',navL],['aLi','aLf',navL],['alLi','alLf',navL]].forEach(([ii,fi,url])=>{const img=document.getElementById(ii);const fb=document.getElementById(fi);if(!img)return;if(url){img.src=url;img.style.display='block';if(fb)fb.style.display='none';}else{img.src='';img.style.display='none';if(fb)fb.style.display='block';}});
}
function saveIdentity(){libName=document.getElementById('s-name').value||'Librairie Rayen';libTag=document.getElementById('s-tag').value;libTel=document.getElementById('s-tel').value;libMF=document.getElementById('s-mf').value;libAddr=document.getElementById('s-addr').value;[['hName',libName],['nN2',libName],['nN3',libName],['nN4',libName],['nN5',libName],['aN',libName],['alN',libName]].forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v;});document.getElementById('hTag').textContent=libTag;document.title=libName;if(autoSave)saveDataToStorage();showToast('✅ Identité sauvegardée');}
function saveTexts(){heroSubTxt=document.getElementById('s-hsub').value;deliveryFee=parseFloat(document.getElementById('s-del').value)||3;deliveryNote=document.getElementById('s-dnote').value;document.getElementById('heroSub').textContent=heroSubTxt;if(autoSave)saveDataToStorage();showToast('✅ Sauvegardé');}
function saveCreds(){const u=document.getElementById('s-usr').value.trim();const p=document.getElementById('s-pw').value;const p2=document.getElementById('s-pw2').value;if(!u){showToast('⚠️ Identifiant requis');return;}if(p&&p!==p2){showToast('⚠️ Mots de passe différents');return;}adminUser=u;if(p)adminPass=p;if(autoSave)saveDataToStorage();document.getElementById('s-pw').value='';document.getElementById('s-pw2').value='';showToast('✅ Identifiants mis à jour');}
function renderSchoolTags(){document.getElementById('schoolTags').innerHTML=Object.keys(schoolLevels).map((s,i)=>`<span class="tag">${s} <span class="xt" onclick="removeSchool(${i})">✕</span></span>`).join('');buildSchoolOpts();buildAdmSchOpts();const sfl=document.getElementById('schoolForLv');const cur=sfl.value;sfl.innerHTML='<option value="">— Sélectionner école —</option>';Object.keys(schoolLevels).forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;sfl.appendChild(o);});sfl.value=cur;}
function addSchool(){const v=document.getElementById('newSchool').value.trim();if(!v||v in schoolLevels)return;schoolLevels[v]=[];if(autoSave)saveDataToStorage();renderSchoolTags();document.getElementById('newSchool').value='';showToast('✅ École ajoutée');}
function removeSchool(i){const k=Object.keys(schoolLevels);delete schoolLevels[k[i]];if(autoSave)saveDataToStorage();renderSchoolTags();renderLvTags();}
function renderLvTags(){const school=document.getElementById('schoolForLv').value;const c=document.getElementById('levelTags');if(!school){c.innerHTML='';return;}c.innerHTML=(schoolLevels[school]||[]).map((lv,i)=>{const e=getEtablissement(lv);const col=etabColor(e);const badge=e?`<span style="font-size:.6rem;background:${col.bg};color:${col.tx};border-radius:3px;padding:0 5px;margin-left:4px;font-weight:700">${e}</span>`:'';return`<span class="tag lv">${lv}${badge} <span class="xt" onclick="removeLv('${school}',${i})">✕</span></span>`;}).join('');onSchoolChange();}
function addLevel(){const school=document.getElementById('schoolForLv').value;const v=document.getElementById('newLv').value.trim();if(!school||!v)return;if(!schoolLevels[school])schoolLevels[school]=[];if(!schoolLevels[school].includes(v))schoolLevels[school].push(v);if(autoSave)saveDataToStorage();renderLvTags();document.getElementById('newLv').value='';showToast('✅ Niveau ajouté');}
function removeLv(school,i){if(schoolLevels[school])schoolLevels[school].splice(i,1);if(autoSave)saveDataToStorage();renderLvTags();}
function buildAdmSchOpts(){const sel=document.getElementById('edSch');const cur=sel.value;sel.innerHTML='<option value="">— École —</option>';Object.keys(schoolLevels).forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;sel.appendChild(o);});sel.value=cur;}
function updEdLv(){const school=document.getElementById('edSch').value;const ls=document.getElementById('edLv');ls.innerHTML='<option value="">— Niveau —</option>';if(school&&schoolLevels[school])schoolLevels[school].forEach(lv=>{const o=document.createElement('option');o.value=lv;o.textContent=lv;ls.appendChild(o);});document.getElementById('bookEdArea').style.display='none';}
function renderBookEd(){const school=document.getElementById('edSch').value;const lv=document.getElementById('edLv').value;const area=document.getElementById('bookEdArea');if(!school||!lv){area.style.display='none';return;}area.style.display='block';const key=gk(school,lv);if(!booksDB[key])booksDB[key]=[];document.getElementById('bookRows').innerHTML=booksDB[key].map((b,i)=>`<div class="bed-row" id="bedr-${i}"><input class="bed-inp" value="${b.title}" id="bt-${i}" placeholder="Titre"><input class="bed-inp" value="${b.ean||''}" id="be-${i}" placeholder="EAN-13" maxlength="13"><input class="bed-inp" value="${b.subject}" id="bs-${i}" placeholder="Matière"><input class="bed-inp" type="number" step="0.5" value="${b.priceHT.toFixed(3)}" id="bp-${i}"><div id="bth-${i}" style="width:30px;height:30px;border-radius:5px;overflow:hidden;background:${b.color};display:flex;align-items:center;justify-content:center;font-size:.85rem;cursor:pointer;flex-shrink:0" onclick="document.getElementById('bfi-${i}').click()" title="Photo de couverture">${b.img?`<img src="${b.img}" style="width:100%;height:100%;object-fit:cover">`:'📖'}</div><input type="file" id="bfi-${i}" accept="image/*" style="display:none" onchange="uplBkImg(this,${i})"><button class="del-btn" onclick="delBkRow(${i})">✕</button></div>`).join('');}
function compressImg(dataUrl,maxW,maxH,quality,cb){const img=new Image();img.onload=()=>{let sx=0,sy=0,sw=img.width,sh=img.height;if(autoAdjustImg){const targetRatio=maxW/maxH;const imgRatio=img.width/img.height;if(imgRatio>targetRatio){sw=Math.round(img.height*targetRatio);sx=Math.round((img.width-sw)/2);}else{sh=Math.round(img.width/targetRatio);sy=Math.round((img.height-sh)/2);}const c=document.createElement('canvas');c.width=maxW;c.height=maxH;c.getContext('2d').drawImage(img,sx,sy,sw,sh,0,0,maxW,maxH);cb(c.toDataURL('image/jpeg',quality));}else{const scale=Math.min(1,maxW/img.width,maxH/img.height);const w=Math.round(img.width*scale);const h=Math.round(img.height*scale);const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);cb(c.toDataURL('image/jpeg',quality));}};img.src=dataUrl;}
function uplBkImg(input,i){const f=input.files[0];if(!f)return;const school=document.getElementById('edSch').value;const lv=document.getElementById('edLv').value;const key=gk(school,lv);if(!booksDB[key]||!booksDB[key][i])return;const book=booksDB[key][i];const bookId=book.id;showToast('⏳ Upload en cours...');const rd=new FileReader();rd.onload=e=>{compressImg(e.target.result,300,400,0.70,compressed=>{book.img=compressed;const entries=bookImageUtils.buildBookImageEntries(book, compressed);Object.entries(entries).forEach(([k,v])=>{_imgCache[k]=v;idbSave(k,v);});const th=document.getElementById('bth-'+i);if(th)th.innerHTML=`<img src="${compressed}" style="width:100%;height:100%;object-fit:cover">`;if(fbDb){const uploadPayload={};Object.entries(entries).forEach(([k,v])=>{uploadPayload[k]=v;});fbDb.ref('librairie/bookImages').update(uploadPayload).then(()=>{showToast('✅ Photo synchronisée sur tous les PCs');}).catch(()=>{showToast('✅ Photo sauvegardée dans IndexedDB');});}else{showToast('✅ Couverture mise à jour');}if(filtSchool===school&&filtLv===lv){_books=booksDB[key];renderGrid(_books);}});};rd.readAsDataURL(f);}
function addBookRow(){const school=document.getElementById('edSch').value;const lv=document.getElementById('edLv').value;if(!school||!lv)return;const key=gk(school,lv);if(!booksDB[key])booksDB[key]=[];const ean='978997'+(Math.floor(Math.random()*9000000)+1000000);booksDB[key].push({id:Date.now(),title:'Nouveau livre',ean:ean,subject:'Matière',priceHT:8.000,color:CLRS[Math.floor(Math.random()*CLRS.length)],img:''});renderBookEd();}
function delBkRow(i){const school=document.getElementById('edSch').value;const lv=document.getElementById('edLv').value;const key=gk(school,lv);if(booksDB[key])booksDB[key].splice(i,1);renderBookEd();}
function saveBooks(){const school=document.getElementById('edSch').value;const lv=document.getElementById('edLv').value;const key=gk(school,lv);if(!key||!booksDB[key])return;booksDB[key].forEach((b,i)=>{const ti=document.getElementById('bt-'+i),ei=document.getElementById('be-'+i),si=document.getElementById('bs-'+i),pi=document.getElementById('bp-'+i);if(ti)b.title=ti.value;if(ei)b.ean=ei.value;if(si)b.subject=si.value;if(pi)b.priceHT=parseFloat(pi.value)||0;});if(autoSave)saveDataToStorage();if(filtSchool===school&&filtLv===lv){_books=booksDB[key];renderGrid(_books);updateCart();}showToast('✅ Livres sauvegardés — '+school+' · '+lv);}
function showToast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('vis');setTimeout(()=>el.classList.remove('vis'),2600);}
function saveImgsLocally(){Object.keys(booksDB).forEach(key=>{booksDB[key].forEach(b=>{if(b.img)_imgCache[b.id]=b.img;});});Object.keys(_imgCache).forEach(id=>{idbSave(id,_imgCache[id]);try{localStorage.removeItem('librairie_img_'+id);}catch(e){}});try{localStorage.removeItem('librairie_rayen_imgs');}catch(e){}}
function syncBookImagesByEan(){const byEan={};Object.keys(booksDB).forEach(key=>{booksDB[key].forEach(b=>{if(!b.ean)return;const eanKey=bookImageUtils.normalizeBookImageKey(b.ean);const img=bookImageUtils.resolveBookImage(_imgCache,b);if(img){byEan[eanKey]=img;}});});Object.keys(booksDB).forEach(key=>{booksDB[key].forEach(b=>{if(!b.ean)return;const eanKey=bookImageUtils.normalizeBookImageKey(b.ean);const img=byEan[eanKey];if(img){b.img=img;if(b.id!==undefined&&b.id!==null&&b.id!=='')_imgCache[String(b.id)]=img;_imgCache[eanKey]=img;}});});}
function loadImgsIntoBooks(){try{localStorage.removeItem('librairie_rayen_imgs');}catch(e){}Object.keys(booksDB).forEach(key=>{booksDB[key].forEach(b=>{const img=bookImageUtils.resolveBookImage(_imgCache,b);if(img)b.img=img;});});syncBookImagesByEan();}
async function loadImgsFromIDB(){try{const all=await idbLoadAll();Object.assign(_imgCache,all);Object.keys(booksDB).forEach(key=>{booksDB[key].forEach(b=>{const img=bookImageUtils.resolveBookImage(_imgCache,b);if(img)b.img=img;});});syncBookImagesByEan();if(filtSchool&&filtLv){_books=booksDB[gk(filtSchool,filtLv)]||[];if(_books.length)renderGrid(_books);}}catch(e){}}
function saveDataToStorage(){
  saveImgsLocally();
  const booksDBNoImg={};Object.keys(booksDB).forEach(k=>{booksDBNoImg[k]=booksDB[k].map(b=>({id:b.id,title:b.title,ean:b.ean,subject:b.subject,priceHT:b.priceHT,color:b.color}));});
  const data={orders,reservations,schoolLevels,booksDB:booksDBNoImg,libName,libTag,libTel,libMF,libAddr,deliveryFee,remisePct,tvaPct,autoSave,adminUser,adminPass,heroSubTxt,deliveryNote};
  try{localStorage.setItem('librairie_rayen_db',JSON.stringify(data));}catch(e){console.error('❌ Erreur localStorage:',e);showToast('⚠️ Erreur sauvegarde : '+e.message);}
  if(fbDb){
    const booksLight={};Object.keys(booksDB).forEach(k=>{booksLight[k]=booksDB[k].map(b=>({id:b.id,title:b.title,ean:b.ean,subject:b.subject,priceHT:b.priceHT,color:b.color}));});
    const cfg={schoolLevels,booksDB:booksLight,libName,libTag,libTel,libMF,libAddr,deliveryFee,deliveryNote,heroSubTxt,orderEnabled,adminUser,adminPass};
    fbDb.ref('librairie/config').set(cfg).catch(e=>{console.error('❌ Erreur Firebase:',e);showToast('❌ Erreur Firebase: '+e.message);});
    const ordMap={};orders.forEach((o,i)=>ordMap['o'+i]=o);fbDb.ref('librairie/orders').set(orders.length?ordMap:null).catch(()=>{});
    const resMap={};reservations.forEach((r,i)=>resMap['r'+i]=r);fbDb.ref('librairie/reservations').set(reservations.length?resMap:null).catch(()=>{});
  }
}
function loadDataFromStorage(){try{const stored=localStorage.getItem('librairie_rayen_db');if(!stored)return;const data=JSON.parse(stored);if(data.orders)orders=data.orders;if(data.reservations)reservations=data.reservations;if(data.schoolLevels)schoolLevels=data.schoolLevels;if(data.booksDB){booksDB=data.booksDB;loadImgsIntoBooks();}if(data.libName)libName=data.libName;if(data.libTag)libTag=data.libTag;if(data.libTel)libTel=data.libTel;if(data.libMF)libMF=data.libMF;if(data.libAddr)libAddr=data.libAddr;if(data.deliveryFee)deliveryFee=data.deliveryFee;if(data.remisePct)remisePct=data.remisePct;if(data.tvaPct)tvaPct=data.tvaPct;if(typeof data.autoSave!=='undefined')autoSave=!!data.autoSave;try{const cb=document.getElementById('autoSaveChk');if(cb)cb.checked=!!autoSave;}catch(e){}if(data.adminUser)adminUser=data.adminUser;if(data.adminPass)adminPass=data.adminPass;if(data.logoUrl&&!logoUrl){logoUrl=data.logoUrl;try{localStorage.setItem('librairie_logo',logoUrl);}catch(e){}setTimeout(()=>{if(fbDb&&logoUrl)fbDb.ref('librairie/logos/main').set(logoUrl).catch(()=>{});},3000);}if(data.logoNavUrl&&!logoNavUrl){logoNavUrl=data.logoNavUrl;try{localStorage.setItem('librairie_navlogo',logoNavUrl);}catch(e){}setTimeout(()=>{if(fbDb&&logoNavUrl)fbDb.ref('librairie/logos/nav').set(logoNavUrl).catch(()=>{});},3000);}if(data.heroSubTxt)heroSubTxt=data.heroSubTxt;if(data.deliveryNote)deliveryNote=data.deliveryNote;try{const hs=document.getElementById('heroSub');if(hs&&heroSubTxt)hs.textContent=heroSubTxt;}catch(e){}}catch(e){console.error('❌ Erreur chargement:',e);}}
function clearAllData(){if(confirm('⚠️ Êtes-vous sûr(e) de vouloir effacer TOUTES les données ? Cette action est irréversible.')){localStorage.removeItem('librairie_rayen_db');orders=[];reservations=[];showToast('🗑️ Toutes les données ont été effacées');location.reload();}}
function exportData(){const data={orders,reservations,schoolLevels,booksDB,libName,libTag,libTel,libMF,libAddr,deliveryFee,remisePct,tvaPct,exportDate:new Date().toLocaleString('fr-FR')};const json=JSON.stringify(data,null,2);const blob=new Blob([json],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='librairie_rayen_backup_'+new Date().getTime()+'.json';a.click();URL.revokeObjectURL(url);showToast('📥 Données exportées en JSON');}
function updateStorageInfo(){try{const stored=localStorage.getItem('librairie_rayen_db');const size=stored?((stored.length/1024).toFixed(2)+' KB'):'Aucune donnée';const recordCount='Commandes: '+orders.length+' | Réservations: '+reservations.length+' | Écoles: '+Object.keys(schoolLevels).length;document.getElementById('storageInfo').innerHTML=size+' — '+recordCount;}catch(e){}}
function toggleAutoSave(v){autoSave=!!v;try{const cb=document.getElementById('autoSaveChk');if(cb)cb.checked=!!autoSave;}catch(e){}saveDataToStorage();updateStorageInfo();showToast(autoSave?'✅ Sauvegarde automatique activée':'🔕 Sauvegarde automatique désactivée');}
loadDataFromStorage();loadLogos();openIDB().then(()=>loadImgsFromIDB()).catch(()=>{});
try{const r=localStorage.getItem('librairie_remise');if(r!==null)remiseEnabled=(r==='1');setTimeout(applyRemiseBadge,100);}catch(e){}
buildSchoolOpts();setLang('fr');
try{syncLogos();updateStorageInfo();}catch(e){}
setTimeout(()=>{try{syncLogos();}catch(e){}},1500);
setTimeout(()=>{try{loadImgsIntoBooks();if(filtSchool&&filtLv){_books=booksDB[gk(filtSchool,filtLv)]||[];if(_books.length)renderGrid(_books);}}catch(e){}},2000);
setTimeout(()=>{try{syncLogos();}catch(e){}},4000);
