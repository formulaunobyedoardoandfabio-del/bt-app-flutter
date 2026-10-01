import { useState, useEffect, useRef, useCallback } from "react";
import { Home, MessageSquare, Trophy, Activity, User, Shield, Bell, LogOut, Trash2, Eye, Lock, Play, Plus, X, Gift, ArrowLeft, Save, Radio, Mail, KeyRound, Pause, Volume2, BellRing, Send, ChevronDown, ChevronUp, ImagePlus, Sparkles } from "lucide-react";

// ════════════════════════════════════════════════════════
// ✅ FIREBASE CONFIGURATO — bt-app-50703
// ⚠️  REGOLE FIRESTORE: vai su Firebase Console → Firestore
//     → Regole e incolla questo (per ora in modalità test):
//
//     rules_version = '2';
//     service cloud.firestore {
//       match /databases/{database}/documents {
//         match /users/{userId} {
//           allow read, write: if true; // cambia in produzione!
//         }
//         match /{document=**} {
//           allow read, write: if true;
//         }
//       }
//     }
// ════════════════════════════════════════════════════════
// ⚙️  CONFIGURA QUI LE TUE CREDENZIALI
// ════════════════════════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBwZFyFM5fBCZCJFpLxb88suIqhSgQvN4",
  authDomain:        "bt-app-50703.firebaseapp.com",
  projectId:         "bt-app-50703",
  storageBucket:     "bt-app-50703.firebasestorage.app",
  messagingSenderId: "296289249228",
  appId:             "1:296289249228:web:7235199f3d0c85c1ba9f69",
  measurementId:     "G-31NCNKY75E",
};
const EMAILJS = {
  serviceId:  "service_cvbpo2o",
  templateId: "template_nlongfo",
  publicKey:  "Ej-KJs4AIy37JvSfV",
};
// ════════════════════════════════════════════════════════

// ── MONETIZZAZIONE ──
// AdMob: banner web simulato (per APK usa @capacitor-community/admob)
// Premium: 2,99€/mese — gestito su Firebase + Stripe (o Play Billing)
// ── ANNUNCI DI PROVA (solo nell'APK di prova) ──
// Nella build "B&T - APK di prova" Codemagic accende BT_ADMOB_TEST e
// scripts/prepare_android.py scrive window.BT_ADMOB_TEST=true nella pagina: l'app usa
// allora gli annunci di prova ufficiali di Google (con la scritta "Test Ad"), così si
// vede che la pubblicità funziona senza rischiare clic non validi sugli annunci veri
// (AdMob può sospendere l'account). La build per il Play Store usa sempre quelli veri.
const ADMOB_TEST = typeof window !== "undefined" && window.BT_ADMOB_TEST === true;
const ADMOB_DEMO = "ca-app-pub-3940256099942544/"; // unità demo pubbliche di Google
// ── ID ADMOB REALI ──
const ADMOB_APP_ID     = "ca-app-pub-5787516371588469~8054706643";
const ADMOB_BANNER_ID  = ADMOB_TEST ? ADMOB_DEMO+"6300978111" : "ca-app-pub-5787516371588469/2997561321"; // banner nella Home, tra le news ("Banner nelle News" su AdMob)
const ADMOB_REWARD_ID  = ADMOB_TEST ? ADMOB_DEMO+"5224354917" : "ca-app-pub-5787516371588469/6784763097";
const ADMOB_ADAPTIVE_BANNER_ID = ADMOB_TEST ? ADMOB_DEMO+"9214589741" : "ca-app-pub-5787516371588469/3821223256"; // banner adattivo, in fondo alla classifica ("Pubblicità Banner" su AdMob)
// Spazio vuoto tra le schede in basso e il banner nativo: AdMob sconsiglia i banner a
// contatto con i pulsanti di navigazione perché causano clic accidentali, che possono
// portare alla sospensione degli annunci. L'altezza vera del banner la comunica AdMob
// (vedi bannerBus più sotto), qui c'è solo il distacco.
const AD_GAP = 10;
// Funzioni backend su Vercel (vedi cartella functions/ per il codice e
// functions/README.md per le istruzioni di deploy) che gestiscono i
// pagamenti reali con Stripe e la generazione articoli via OpenAI. Le
// chiavi (Stripe, OpenAI, Firebase) vivono solo lì come variabili
// d'ambiente Vercel — non finiscono mai in questo file né nella build APK.
const FUNCTIONS_BASE = "https://bt-app-flutter.vercel.app/api";
const ADMOB_UNIT_ID    = ADMOB_BANNER_ID; // alias per compatibilità
const PREMIUM_PRICE  = "2,99€/mese";
const PREMIUM_ANNUAL = "24,99€/anno";
// Abbonamenti spenti in questa versione. Sul Play Store un abbonamento a contenuti
// digitali non può essere venduto con Stripe dentro l'app: va venduto con Google Play
// Billing (o dal sito, senza link nell'app). Finché è false l'app mostra
// "Premium in arrivo" e non apre mai il pagamento Stripe.
const PAYMENTS_ENABLED = false;
// Finché gli abbonamenti sono spenti le funzioni Premium (notizie esclusive, dati live
// completi, audio radio) sono gratis per tutti, ma il Premium resta in vista: tasto in alto,
// scheda nel profilo e finestra con tutte le funzioni. Le pubblicità restano: le toglie solo
// un abbonamento pagato (stato "prem" nell'App, vedi adFree). Il Fanta F1 invece è bloccato
// fino a fine stagione per tutti: l'anteprima si apre solo dopo un video (vedi FantaPage).
const PREMIUM_FREE_FOR_ALL = !PAYMENTS_ENABLED;
// Dicitura richiesta dalle linee guida di Formula 1 per i progetti dei tifosi.
const F1_DISCLAIMER = "B&T App è un'app non ufficiale e non è associata in alcun modo alle società di Formula 1. F1, FORMULA ONE, FORMULA 1, FIA FORMULA ONE WORLD CHAMPIONSHIP, GRAND PRIX e i marchi correlati sono marchi di Formula One Licensing B.V.";

// ── PRIVACY E CONTATTI ──
// Pagine pubbliche richieste da Google Play (privacy policy e richiesta di
// eliminazione dell'account): sono in docs/ nel repository, pubblicate con GitHub Pages.
const SITE_URL = "https://formulaunobyedoardoandfabio-del.github.io/bt-app-flutter";
const PRIVACY_URL = SITE_URL + "/privacy.html";
const DELETE_ACCOUNT_URL = SITE_URL + "/elimina-account.html";
const CONTACT_EMAIL = "bt.formula1@gmail.com";
// Apre un link fuori dall'app: nell'APK con il browser di sistema (plugin Browser),
// sul web in una nuova scheda.
const openUrl = url => {
  try {
    const B = window.Capacitor?.Plugins?.Browser;
    if (window.Capacitor?.isNativePlatform?.() && B) { B.open({ url }); return; }
  } catch {}
  window.open(url, "_blank");
};

// ── MODERAZIONE CHAT ──
// Google Play chiede, nelle app dove gli utenti si scrivono, di poter segnalare
// messaggi, bloccare utenti e far intervenire un moderatore.
const CHAT_REPORTS_KEY = "bt-chat-reports"; // condiviso: segnalazioni da controllare nel pannello admin
const CHAT_BANNED_KEY = "bt-chat-banned";   // condiviso: utenti sospesi dalla chat
const BLOCKED_KEY = "bt-blocked";           // solo su questo telefono: utenti che non voglio più vedere
// ID autore anonimo e stabile (impronta dell'email): serve a bloccare e moderare
// senza mettere l'email nei messaggi, che tutti gli utenti possono leggere.
const authorId = email => {
  const s = String(email || "").toLowerCase().trim();
  let h1 = 0x811c9dc5, h2 = 0x9747b28c;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  return "u" + h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
};
// Stesso autore? ID con ID; il nome si usa solo quando mancano entrambi gli ID (messaggi
// vecchi), così un omonimo non viene mai scambiato per un altro utente.
const sameAuthor = (a, m) => {
  if (!a || !m) return false;
  const x = a.aid || "", y = m.aid || "";
  if (x && y) return x === y;
  if (!x && !y) return (a.name || a.user) === (m.user || m.name);
  return false;
};


// Feature gating: quali sezioni richiedono premium
const PREMIUM_FEATURES = {
  "live-lap":    "Tempi su giro in tempo reale",
  "live-bestlap":"Miglior tempo personale",
  "live-tire":   "Usura e strategia gomme",
  "live-pit":    "Conteggio pit stop",
  "live-gap":    "Distacchi dalla vetta",
  "live-radio":  "Team radio audio live",
  fanta:         "Fanta F1 completo",
};

// Categorie news "core" F1 — sempre gratis per tutti. Qualsiasi altra
// categoria (creata dall'Admin scegliendo "Altra categoria") è riservata
// agli abbonati Premium: vedi HomePage e AdminPanel.
const FREE_CATEGORIES = ["NEWS","GARA","APP","ANALISI","FANTA"];



// ── DATABASE LAYER ──
// Se Firebase è configurato usa Firestore, altrimenti window.storage (demo)
const USE_FIREBASE = true; // Firebase configurato!
let _db = null;

async function getDb() {
  if (!USE_FIREBASE) return null;
  if (_db) return _db;
  try {
    // Carica Firebase SDK via CDN (funziona senza npm)
    if (!window._firebaseLoaded) {
      await Promise.all([
        loadScript("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"),
        loadScript("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"),
      ]);
      window._firebaseLoaded = true;
    }
    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(FIREBASE_CONFIG);
    }
    _db = window.firebase.firestore();
    return _db;
  } catch (e) {
    console.error("Firebase init error:", e);
    return null;
  }
}

// ── IMMAGINI DELLE NOTIZIE (upload dall'Admin) ──
// Le foto vanno in Firestore, una per documento (shared/img-<id>), ridotte e compresse sul
// telefono. Non usiamo Firebase Storage: il bucket del progetto (….firebasestorage.app) funziona
// solo col piano Blaze, che chiede la carta di credito; senza, il caricamento restava per sempre
// su "Caricamento…". La notizia salva solo il riferimento "fsimg:<id>": tutte le notizie stanno in
// un unico documento (shared/bt-news) e Firestore accetta al massimo 1 MB per documento.
const IMG_REF = "fsimg:";
const IMG_MAX_CHARS = 600000;     // foto compressa (base64): ben sotto il limite di 1 MB
const IMG_SAVE_TIMEOUT = 20000;   // oltre, diciamo che la connessione non va invece di aspettare per sempre
const _imgCache = new Map();      // riferimento → promessa dell'immagine (data URL)
const mkImgErr = code => Object.assign(new Error(code), { code });
function readAsDataURL(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(mkImgErr("lettura")); r.readAsDataURL(file); });
}
function decodeImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(mkImgErr("formato")); i.src = src; });
}
// Ridimensiona (al massimo 1080×1350) e comprime in JPEG finché la foto non sta sotto IMG_MAX_CHARS.
async function compressImage(file) {
  const img = await decodeImage(await readAsDataURL(file));
  const w0 = img.naturalWidth, h0 = img.naturalHeight;
  if (!w0 || !h0) throw mkImgErr("formato");
  const fit = Math.min(1, 1080 / w0, 1350 / h0);
  const c = document.createElement("canvas"), g = c.getContext("2d");
  for (const [k, q] of [[1, .8], [1, .68], [.8, .62], [.64, .58], [.5, .52], [.36, .5]]) {
    c.width = Math.max(1, Math.round(w0 * fit * k)); c.height = Math.max(1, Math.round(h0 * fit * k));
    g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height); // PNG trasparenti: sfondo nero come l'app
    g.drawImage(img, 0, 0, c.width, c.height);
    const out = c.toDataURL("image/jpeg", q);
    if (out.length <= IMG_MAX_CHARS) return out;
  }
  throw mkImgErr("troppo-grande");
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(mkImgErr("timeout")), ms))]);
async function uploadImage(file) {
  const data = await compressImage(file);
  const db = await getDb();
  if (!db) return data; // senza Firebase (versione web di prova) la foto resta dentro la notizia
  const id = uid();
  await withTimeout(db.collection("shared").doc("img-" + id).set({ data, ts: Date.now() }), IMG_SAVE_TIMEOUT);
  const ref = IMG_REF + id;
  _imgCache.set(ref, Promise.resolve(data));
  return ref;
}
function loadNewsImage(src) {
  if (!src || !String(src).startsWith(IMG_REF)) return Promise.resolve(src || "");
  if (!_imgCache.has(src)) {
    const p = sg("img-" + src.slice(IMG_REF.length), true).then(d => (d && d.data) || "");
    _imgCache.set(src, p);
    p.then(u => { if (!u) _imgCache.delete(src); }); // non trovata o rete assente: si riprova la volta dopo
  }
  return _imgCache.get(src);
}
// Cancellando una notizia si cancella anche la sua foto (se nessun'altra notizia la usa).
async function dropNewsImage(src, stillUsed) {
  if (!src || !String(src).startsWith(IMG_REF) || stillUsed) return;
  _imgCache.delete(src);
  await sd("img-" + src.slice(IMG_REF.length), true);
}
function useNewsImage(src) {
  const [u, setU] = useState(src && !String(src).startsWith(IMG_REF) ? src : "");
  useEffect(() => {
    let alive = true;
    if (!src) { setU(""); return undefined; }
    if (!String(src).startsWith(IMG_REF)) { setU(src); return undefined; }
    loadNewsImage(src).then(v => { if (alive) setU(v); });
    return () => { alive = false; };
  }, [src]);
  return u;
}
// Foto della notizia intera, con le sue proporzioni: niente ritagli. Sopra possono stare etichetta e lucchetto.
// Finché la foto non c'è (o si sta caricando) resta un riquadro scuro alto minH.
const NewsPhoto = ({ src, minH = 170, maxH = 420, style, children }) => {
  const u = useNewsImage(src);
  if (!u) return <div style={{ position: "relative", height: minH, background: "#111", display: "flex", alignItems: "center", justifyContent: "center", ...style }}>{children}</div>;
  return <div style={{ position: "relative", background: "#111", ...style }}><img src={u} alt="" style={{ display: "block", width: "100%", height: "auto", maxHeight: maxH, objectFit: "contain" }} />{children}</div>;
};

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ── EMAIL (EmailJS) ──
async function sendResetEmail(toEmail, toName, resetCode) {
  if (!EMAILJS.publicKey) {
    // Demo mode: mostra il codice in console
    console.log(`[DEMO] Codice reset per ${toEmail}: ${resetCode}`);
    return true;
  }
  try {
    if (!window._emailjsLoaded) {
      await loadScript("https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js");
      window.emailjs.init({ publicKey: EMAILJS.publicKey });
      window._emailjsLoaded = true;
    }
    await window.emailjs.send(EMAILJS.serviceId, EMAILJS.templateId, {
      to_email:   toEmail,
      to_name:    toName || "Tifoso B&T",
      reset_code: resetCode,
    });
    return true;
  } catch (e) {
    console.error("EmailJS error:", e);
    return false;
  }
}


// Dati del singolo dispositivo (sessione, cookie, termini, suoni):
// restano sul telefono, MAI nel database condiviso.
const local={
  get(k){try{const v=localStorage.getItem("bt_"+k);return v?JSON.parse(v):null;}catch{return null;}},
  set(k,v){try{localStorage.setItem("bt_"+k,JSON.stringify(v));}catch{}},
  del(k){try{localStorage.removeItem("bt_"+k);}catch{}},
};
// ── CRUD FUNCTIONS ──
// Usano Firestore se configurato, altrimenti window.storage

async function dbSet(collection, docId, data) {
  if (collection === "sessions") { local.set(`sess__${docId}`, data); return; }
  const db = await getDb();
  if (db) {
    await db.collection(collection).doc(docId).set(data, { merge: true });
  } else {
    await ss(`${collection}__${docId}`, data, collection !== "sessions");
  }
}

async function dbGet(collection, docId) {
  if (collection === "sessions") return local.get(`sess__${docId}`);
  const db = await getDb();
  if (db) {
    const snap = await db.collection(collection).doc(docId).get();
    return snap.exists ? snap.data() : null;
  } else {
    return await sg(`${collection}__${docId}`, collection !== "sessions");
  }
}

async function dbDelete(collection, docId) {
  if (collection === "sessions") { local.del(`sess__${docId}`); return; }
  const db = await getDb();
  if (db) {
    await db.collection(collection).doc(docId).delete();
  } else {
    await sd(`${collection}__${docId}`, collection !== "sessions");
  }
}

// Liste condivise (chat, segnalazioni, sospensioni) per le operazioni che non devono
// sbagliare. A differenza di ss/sg non nascondono gli errori, e su Firestore usano
// operazioni atomiche: aggiungere un messaggio non riscrive più l'intera lista, che
// poteva far ricomparire messaggi appena cancellati dal moderatore.
const listOf = v => Array.isArray(v) ? v : ((v && Array.isArray(v.__arr)) ? v.__arr : []);
async function sharedAppend(k, item) {
  const db = await getDb();
  if (!db) { const arr = listOf(JSON.parse(localStorage.getItem("bt_" + k) || "[]")); arr.push(item); localStorage.setItem("bt_" + k, JSON.stringify(arr)); return; }
  await db.collection("shared").doc(k).set({ __arr: window.firebase.firestore.FieldValue.arrayUnion(JSON.parse(JSON.stringify(item))) }, { merge: true });
}
// Toglie dalla lista gli elementi per cui drop(x) è vero.
async function sharedRemoveWhere(k, drop) {
  const db = await getDb();
  if (!db) {
    const raw = localStorage.getItem("bt_" + k); if (!raw) return;
    const arr = listOf(JSON.parse(raw)); const next = arr.filter(x => !drop(x));
    if (next.length !== arr.length) localStorage.setItem("bt_" + k, JSON.stringify(next));
    return;
  }
  const ref = db.collection("shared").doc(k);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref); if (!snap.exists) return;
    const arr = listOf(snap.data()); const next = arr.filter(x => !drop(x));
    if (next.length !== arr.length) tx.set(ref, { __arr: next }, { merge: true });
  });
}
// Email degli account con questo nome (al massimo 2: basta a sapere se è unico).
async function emailsWithName(name) {
  const db = await getDb();
  if (db) { const snap = await db.collection("users").where("name", "==", name).limit(2).get(); return snap.docs.map(d => (d.data() || {}).email || d.id); }
  const out = [];
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith("bt_users__")) continue;
    const v = JSON.parse(localStorage.getItem(k) || "null");
    if (v && v.name === name) out.push(v.email || k.slice(10));
  }
  return out.slice(0, 2);
}

// Feedback inviati da un utente (documenti "bt-feedback-<id>" con user = email):
// servono all'eliminazione dell'account.
async function deleteUserFeedback(email) {
  const db = await getDb();
  if (db) {
    const snap = await db.collection("shared").where("user", "==", email).get();
    await Promise.all(snap.docs.filter(d => d.id.startsWith("bt-feedback-")).map(d => d.ref.delete()));
    return;
  }
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith("bt_bt-feedback-")) continue;
      const v = JSON.parse(localStorage.getItem(k) || "null");
      if (v && v.user === email) localStorage.removeItem(k);
    }
  } catch {}
}

async function dbGetAll(collection) {
  const db = await getDb();
  if (db) {
    const snap = await db.collection(collection).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  return [];
}

const LOGO="data:image/png;base64,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";
// Immagine di sfondo originale creata per B&T (nessuna foto ufficiale o di agenzia).
const GP="data:image/jpeg;base64,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";

const A={red:"#E10600",bg:"#0d0d0d",card:"#181818",card2:"#242424",border:"#2d2d2d",text:"#ffffff",muted:"#888",dim:"#555"};
const ADMIN_CODE="080824";
const TIRE_MAX_LAPS={SOFT:22,MEDIUM:38,HARD:55,INTERMEDIATE:30,WET:30};
const TIRE={
  SOFT:{c:"#E10600",t:"#fff",a:"S",name:"Soft"},
  MEDIUM:{c:"#FFF200",t:"#000",a:"M",name:"Medium"},
  HARD:{c:"#fff",t:"#000",a:"H",name:"Hard"},
  INTERMEDIATE:{c:"#39B54A",t:"#fff",a:"I",name:"Inter"},
  WET:{c:"#0067FF",t:"#fff",a:"W",name:"Wet"},
};
const D_PILOTI=[{id:"p1",name:"Andrea Kimi Antonelli",team:"MERCEDES",position:1,points:267},{id:"p2",name:"George Russell",team:"MERCEDES",position:2,points:201},{id:"p3",name:"Lewis Hamilton",team:"FERRARI",position:3,points:191},{id:"p4",name:"Lando Norris",team:"MCLAREN",position:4,points:171},{id:"p5",name:"Charles Leclerc",team:"FERRARI",position:5,points:155},{id:"p6",name:"Max Verstappen",team:"RED BULL",position:6,points:127},{id:"p7",name:"Oscar Piastri",team:"MCLAREN",position:7,points:116},{id:"p8",name:"Isack Hadjar",team:"RED BULL",position:8,points:71},{id:"p9",name:"Liam Lawson",team:"RB F1 TEAM",position:9,points:51},{id:"p10",name:"Pierre Gasly",team:"ALPINE F1 TEAM",position:10,points:41}];
const D_COSTR=[{id:"c1",name:"Mercedes",position:1,points:468},{id:"c2",name:"Ferrari",position:2,points:346},{id:"c3",name:"McLaren",position:3,points:287},{id:"c4",name:"Red Bull",position:4,points:204},{id:"c5",name:"RB F1 Team",position:5,points:75},{id:"c6",name:"Alpine F1 Team",position:6,points:62},{id:"c7",name:"Haas F1 Team",position:7,points:21},{id:"c8",name:"Audi",position:8,points:16},{id:"c9",name:"Williams",position:9,points:11},{id:"c10",name:"Aston Martin",position:10,points:3},{id:"c11",name:"Cadillac F1 Team",position:11,points:0}];
const D_FANTA=[{id:"f1",name:"Kimi Antonelli",team:"MERCEDES",price:28.0,points:267},{id:"f2",name:"George Russell",team:"MERCEDES",price:26.5,points:201},{id:"f3",name:"Lando Norris",team:"MCLAREN",price:27.5,points:171},{id:"f4",name:"Lewis Hamilton",team:"FERRARI",price:25.0,points:191},{id:"f5",name:"Charles Leclerc",team:"FERRARI",price:24.8,points:155},{id:"f6",name:"Oscar Piastri",team:"MCLAREN",price:24.0,points:116},{id:"f7",name:"Max Verstappen",team:"RED BULL",price:22.8,points:127},{id:"f8",name:"Carlos Sainz",team:"WILLIAMS",price:18.2,points:89},{id:"f9",name:"Fernando Alonso",team:"ASTON MARTIN",price:17.4,points:52},{id:"f10",name:"Alex Albon",team:"WILLIAMS",price:15.8,points:44}];
const D_RACES=[
  {id:"r1",name:"Madrid GP",circuit:"MADRING",country:"Spagna",round:17,date:"2026-09-13T15:00:00",status:"CONCLUSA",totalLaps:57},
  {id:"r2",name:"Azerbaijan GP",circuit:"CIRCUITO DI BAKU",country:"Azerbaijan",round:18,date:"2026-09-26T13:00:00",status:"IN ARRIVO",totalLaps:51},
];
const D_NEWS=[{id:"n1",title:"Vi presentiamo l'app B&T!!",summary:"Introduzione all'app ufficiale",category:"APP",author:"Team B&T",image:"",published:true,date:"2026-09-01T10:00:00",content:"Benvenuti nell'app ufficiale B&T Formula1!\n\nQui troverete tutte le ultime notizie, classifiche mondiali in tempo reale, live race tracking con dati dalle gomme ai distacchi, e presto anche il Fanta F1.\n\nRestate sintonizzati per tutti gli aggiornamenti della stagione 2026!"}];
const D_IG={followers:128544,videos:[{id:"v1",title:"Sorpasso impossibile alla Variante del Rettifilo",thumbnail:"https://images.unsplash.com/photo-1624778305680-f4d2cd2e5949?w=600&q=80",views:"342.000",likes:"28.400",url:"https://www.instagram.com/bt_formula1/"},{id:"v2",title:"Monza di notte vista dal drone: spettacolare",thumbnail:"https://images.unsplash.com/photo-1567829155043-e31e94e5e0a3?w=600&q=80",views:"276.000",likes:"21.900",url:"https://www.instagram.com/bt_formula1/"},{id:"v3",title:"Il pit stop perfetto di Ferrari a Singapore",thumbnail:"https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&q=80",views:"198.000",likes:"15.700",url:"https://www.instagram.com/bt_formula1/"}]};

// MOCK DATA (usato come fallback quando OpenF1 non ha la sessione live)



// utils
const fmt=iso=>new Date(iso).toLocaleDateString("it-IT",{day:"2-digit",month:"short",year:"numeric"});
const fmtN=n=>n?.toLocaleString("it-IT")??"—";
const fmtL=s=>{if(!s||s<=0)return"—";const m=Math.floor(s/60);return`${m}:${(s%60).toFixed(3).padStart(6,"0")}`;};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const mkCode=()=>Math.floor(100000+Math.random()*900000).toString();
function cd(ds){const d=new Date(ds)-new Date();if(d<=0)return null;return{d:Math.floor(d/864e5),h:Math.floor(d%864e5/36e5),m:Math.floor(d%36e5/6e4),s:Math.floor(d%6e4/1e3)};}
// Storage layer: Firebase if configured, localStorage fallback for APK
async function ss(k,v,sh=true){
  if(!sh){local.set(k,v);return;}
  const db=await getDb();
  // Firestore vuole sempre un oggetto come radice del documento: un array
  // nudo viene rifiutato dal SDK (l'errore finisce nel catch qui sotto e
  // il salvataggio sparisce nel nulla). Lo incapsuliamo in {__arr:[...]}.
  const payload=Array.isArray(v)?{__arr:v}:v;
  if(db){try{await db.collection(sh?"shared":"private").doc(k).set(JSON.parse(JSON.stringify(payload)),{merge:true});}catch{}}
  else{try{if(typeof localStorage!=="undefined")localStorage.setItem("bt_"+k,JSON.stringify(v));}catch{}}
}
async function sg(k,sh=true){
  if(!sh)return local.get(k);
  const db=await getDb();
  if(db){try{const d=await db.collection(sh?"shared":"private").doc(k).get();if(!d.exists)return null;const data=d.data();return(data&&data.__arr!==undefined)?data.__arr:data;}catch{return null;}}
  try{if(typeof localStorage!=="undefined"){const v=localStorage.getItem("bt_"+k);return v?JSON.parse(v):null;}}catch{}
  return null;
}
async function sd(k,sh=false){
  if(!sh){local.del(k);return;}
  const db=await getDb();
  if(db){try{await db.collection(sh?"shared":"private").doc(k).delete();}catch{}}
  else{try{if(typeof localStorage!=="undefined")localStorage.removeItem("bt_"+k);}catch{}}
}

// ── BASE COMPONENTS ──
const BtLogo=()=>(
  <div style={{background:A.red,borderRadius:8,padding:"5px 10px",display:"flex",alignItems:"center",height:36,minWidth:52}}>
    <img src={LOGO} alt="B&T" style={{height:24,objectFit:"contain",filter:"brightness(0) invert(1)"}}/>
  </div>
);
const Hdr=({onProfile,onNotif,unreadCount,isPremium,onUpgrade})=>(
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",paddingTop:"calc(12px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))",borderBottom:`1px solid ${A.border}`,background:A.bg,position:"sticky",top:0,zIndex:20}}>
    <BtLogo/>
    <div style={{display:"flex",gap:10,alignItems:"center"}}>
      {isPremium?<PremiumBadge/>:<button onClick={onUpgrade} style={{background:`${A.red}18`,border:`1px solid ${A.red}44`,borderRadius:8,padding:"4px 10px",cursor:"pointer",color:A.red,fontSize:11,fontWeight:700}}>⭐ Premium</button>}
      <button onClick={onNotif} style={{width:38,height:38,borderRadius:"50%",border:`1.5px solid ${A.border}`,background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
        <Bell size={20} color={unreadCount>0?A.red:A.text}/>
        {unreadCount>0&&<span style={{position:"absolute",top:4,right:4,width:16,height:16,borderRadius:"50%",background:A.red,fontSize:9,fontWeight:900,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>{unreadCount>9?"9+":unreadCount}</span>}
      </button>
      <button onClick={onProfile} style={{width:38,height:38,borderRadius:"50%",border:`1.5px solid ${A.border}`,background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><User size={20} color={A.text}/></button>
    </div>
  </div>
);

// ── NOTIFICATION CENTER ──
const NotifCenter=({notifs,onClose,onMarkRead})=>{
  if(!notifs||notifs.length===0) return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:70}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:A.card,borderRadius:"0 0 20px 20px",width:"100%",maxWidth:430,padding:"20px 20px 24px",boxShadow:"0 8px 40px rgba(0,0,0,.6)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}><BellRing size={16} color={A.red}/><span style={{fontWeight:900,fontStyle:"italic",fontSize:14,color:A.text}}>NOTIFICHE</span></div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:A.muted}}><X size={18}/></button>
        </div>
        <p style={{color:A.muted,fontSize:13,textAlign:"center",padding:"20px 0"}}>Nessuna notifica al momento.</p>
      </div>
    </div>
  );
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:70}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:A.card,borderRadius:"0 0 20px 20px",width:"100%",maxWidth:430,maxHeight:"70vh",overflowY:"auto",boxShadow:"0 8px 40px rgba(0,0,0,.6)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 20px 14px",borderBottom:`1px solid ${A.border}`,position:"sticky",top:0,background:A.card}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}><BellRing size={16} color={A.red}/><span style={{fontWeight:900,fontStyle:"italic",fontSize:14,color:A.text}}>NOTIFICHE</span><span style={{background:A.red,color:"#fff",fontSize:9,fontWeight:800,borderRadius:10,padding:"2px 7px"}}>{notifs.filter(n=>!n.read).length} nuove</span></div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <button onClick={onMarkRead} style={{background:"none",border:"none",color:A.muted,fontSize:11,cursor:"pointer"}}>Segna tutte lette</button>
            <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:A.muted}}><X size={18}/></button>
          </div>
        </div>
        <div style={{padding:"8px 16px 20px"}}>
          {[...notifs].reverse().map(n=>(
            <div key={n.id} style={{padding:"14px 0",borderBottom:`1px solid ${A.border}`,opacity:n.read?.8:1}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:n.read?A.dim:A.red,flexShrink:0,marginTop:5}}/>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontWeight:800,fontSize:14,color:A.text}}>{n.title}</span>
                    <span style={{fontSize:10,color:A.dim}}>{new Date(n.date).toLocaleString("it-IT",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
                  </div>
                  <p style={{fontSize:13,color:A.muted,lineHeight:1.5,margin:0}}>{n.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
const Nav=({p,set,adOffset=0,adGap=0})=>{
  const T=[{id:"home",l:"HOME",i:<Home size={20}/>},{id:"instagram",l:"INSTAGRAM",i:<span style={{fontSize:19}}>📷</span>},{id:"chat",l:"CHAT",i:<MessageSquare size={20}/>},{id:"fanta",l:"FANTA",i:<Trophy size={20}/>},{id:"live",l:"RACE",i:<span style={{fontSize:19}}>🛞</span>}];
  // adOffset: altezza del banner AdMob nativo (ancorato in basso da Android): la Nav sale
  // di tanto così il banner non copre i pulsanti. adGap: striscia vuota tra pulsanti e banner.
  return <div style={{display:"flex",position:"fixed",bottom:`calc(${adOffset}px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))`,left:0,right:0,maxWidth:430,margin:"0 auto",background:A.bg,borderTop:`1px solid ${A.border}`,paddingBottom:adGap,zIndex:50}}>{T.map(t=><button key={t.id} onClick={()=>set(t.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,border:"none",background:"transparent",cursor:"pointer",padding:"8px 0",color:p===t.id?A.red:A.dim}}>{t.i}<span style={{fontSize:9,fontWeight:700}}>{t.l}</span></button>)}</div>;
};
const Inp=({ph,val,chg,type="text",s,rows})=>rows
  ?<textarea placeholder={ph} value={val} onChange={chg} rows={rows} style={{background:A.card,border:`1px solid ${A.border}`,borderRadius:10,padding:"11px 13px",color:A.text,fontSize:14,width:"100%",outline:"none",resize:"vertical",fontFamily:"inherit",...s}}/>
  :<input type={type} placeholder={ph} value={val} onChange={chg} style={{background:A.card,border:`1px solid ${A.border}`,borderRadius:10,padding:"11px 13px",color:A.text,fontSize:14,width:"100%",outline:"none",...s}}/>;
const Tg=({v,chg})=><div onClick={()=>chg(!v)} style={{width:44,height:26,borderRadius:13,background:v?A.red:A.border,position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}><div style={{position:"absolute",top:3,left:v?21:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/></div>;
const Btn=({ch,onClick,dis,out,sm,s})=><button onClick={onClick} disabled={dis} style={{background:out?"transparent":(dis?"#444":A.red),color:out?A.red:"#fff",border:out?`1.5px solid ${A.red}`:"none",borderRadius:10,padding:sm?"9px 16px":"13px 20px",fontWeight:800,fontStyle:"italic",fontSize:sm?12:13,cursor:dis?"default":"pointer",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,letterSpacing:.4,opacity:dis?.5:1,...s}}>{ch}</button>;
const Tag=({ch,s})=><span style={{background:A.red,color:"#fff",fontSize:10,fontWeight:800,padding:"3px 9px",borderRadius:6,...s}}>{ch}</span>;
const ST=({em,ch})=><div style={{display:"flex",alignItems:"center",gap:8,margin:"20px 0 14px"}}>{em&&<span style={{fontSize:16}}>{em}</span>}<span style={{fontWeight:900,fontStyle:"italic",fontSize:15,color:A.text,letterSpacing:.3}}>{ch}</span></div>;

// TIRE WIDGET
const TireWidget=({compound,stintLap})=>{
  const t=TIRE[compound]||TIRE.HARD;
  const max=TIRE_MAX_LAPS[compound]||40;
  const wear=Math.min(100,Math.round((stintLap/max)*100));
  const wColor=wear<50?"#4AE54A":wear<75?"#FFF200":"#E10600";
  return(
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <span style={{width:24,height:24,borderRadius:"50%",background:t.c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:t.t,flexShrink:0}}>{t.a}</span>
      <div>
        <div style={{width:48,height:5,background:"#333",borderRadius:3,overflow:"hidden"}}>
          <div style={{width:`${100-wear}%`,height:"100%",background:wColor,borderRadius:3,transition:"width .5s"}}/>
        </div>
        <div style={{fontSize:9,color:A.muted,marginTop:1}}>{stintLap}g · {100-wear}%</div>
      </div>
    </div>
  );
};

// TEAM RADIO ITEM
const RadioItem=({msg,highlight})=>{
  const aRef=useRef(null);
  const [playing,setPlaying]=useState(false);
  const toggle=()=>{
    if(!msg.recording_url){return;}
    if(playing){aRef.current?.pause();setPlaying(false);}
    else{aRef.current?.play().catch(()=>{});setPlaying(true);}
  };
  const teamColor={Mercedes:"#00D2BE",Ferrari:"#E10600",McLaren:"#FF8000","Red Bull":"#3671C6","Aston Martin":"#358C75","Alpine F1 Team":"#0093CC","Williams":"#005AFF","RB F1 Team":"#5E8FAA","Haas F1 Team":"#B6BABD","Sauber":"#52E252"}[msg.team]||A.red;
  return(
    <div style={{background:A.card,borderRadius:12,padding:"12px 14px",marginBottom:10,borderLeft:`3px solid ${teamColor}`}}>
      {msg.recording_url&&<audio ref={aRef} src={msg.recording_url} onEnded={()=>setPlaying(false)}/>}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{background:teamColor,color:"#fff",fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:4}}>{msg.acr}</span>
          <span style={{fontSize:11,color:A.muted}}>{msg.time}</span>
        </div>
        {msg.recording_url?(
          <button onClick={toggle} style={{background:playing?`${A.red}33`:A.card2,border:`1px solid ${playing?A.red:A.border}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:5,color:playing?A.red:A.muted,fontSize:11}}>
            {playing?<><Pause size={12}/> Stop</>:<><Play size={12}/> Audio</>}
          </button>
        ):(
          <span style={{fontSize:10,color:A.dim,fontStyle:"italic"}}>Audio n/d</span>
        )}
      </div>
      <p style={{fontSize:13,color:A.text,lineHeight:1.5,margin:0,fontStyle:"italic"}}>"{msg.msg}"</p>
    </div>
  );
};

// AD MODAL
const AdModal=({onClose,onDone,feature})=>{
  // "loading": preparo e mostro il video vero di AdMob
  // "none":    nessun video disponibile (niente rete, nessun annuncio, versione web)
  // "early":   il video è stato chiuso prima della fine
  const [phase,setPhase]=useState("loading");
  const cancelled=useRef(false);
  const featureNames={
    "live-basic":"dati live base","live-tire":"usura gomme","live-lap":"tempi su giro",
    "live-pit":"pit stop","live-radio":"team radio","live-all":"tutti i dati live",fanta:"anteprima Fanta F1",
  };
  const fname=featureNames[feature]||feature||"la funzione";

  // Solo video veri. Il premio arriva dall'evento "onRewardedVideoAdReward" del plugin:
  // se il video viene chiuso prima (evento "Dismissed" senza premio) non si sblocca.
  // Se non c'è nessun video disponibile lo diciamo chiaramente e sblocchiamo lo stesso:
  // non è colpa dell'utente e non mostriamo mai una pubblicità finta.
  const run=async()=>{
    setPhase("loading");
    const AdMob=admobPlugin();
    if(!AdMob||!isNativeApp()||!(await admobReady())){setPhase("none");return;}
    const hs=[];
    const drop=()=>hs.splice(0).forEach(h=>{try{h.remove();}catch{}});
    let rewarded=false,dismissed=false,decided=false;
    const decide=()=>{if(decided)return;decided=true;drop();if(rewarded)onDone();else setPhase("early");};
    const onReward=()=>{rewarded=true;if(dismissed)decide();};
    try{
      hs.push(await AdMob.addListener("onRewardedVideoAdReward",onReward));
      // Alcuni annunci comunicano il premio un attimo dopo la chiusura: aspettiamo un po' prima di dire "interrotto".
      hs.push(await AdMob.addListener("onRewardedVideoAdDismissed",()=>{dismissed=true;if(rewarded)decide();else setTimeout(decide,700);}));
      hs.push(await AdMob.addListener("onRewardedVideoAdFailedToShow",()=>{if(decided)return;decided=true;drop();setPhase("none");}));
      await AdMob.prepareRewardVideoAd({ adId: ADMOB_REWARD_ID, isTesting: ADMOB_TEST });
      if(cancelled.current){drop();return;}
      // La promessa si risolve solo quando il premio è guadagnato.
      AdMob.showRewardVideoAd().then(onReward).catch(()=>{if(decided)return;decided=true;drop();setPhase("none");});
    }catch(e){drop();setPhase("none");}
  };
  useEffect(()=>{run();},[]);

  if(phase==="loading") return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.95)",zIndex:300,
      display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{width:52,height:52,border:`3px solid ${A.red}`,borderTopColor:"transparent",
        borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
      <p style={{color:A.muted,fontSize:14}}>Caricamento annuncio…</p>
      <button onClick={()=>{cancelled.current=true;onClose();}} style={{background:"transparent",border:`1px solid ${A.border}`,borderRadius:8,padding:"7px 16px",color:A.muted,fontSize:12,cursor:"pointer"}}>Annulla</button>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.93)",zIndex:300,
      display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:A.card,borderRadius:14,width:"100%",maxWidth:380,padding:22,position:"relative",textAlign:"center"}}>
        <button onClick={onClose} aria-label="Chiudi" style={{position:"absolute",top:12,right:12,background:A.card2,
          border:"none",borderRadius:8,padding:6,cursor:"pointer",color:A.text}}><X size={16}/></button>
        {phase==="none"?<>
          <h3 style={{fontWeight:900,fontStyle:"italic",fontSize:16,marginBottom:10,color:A.text}}>NESSUN VIDEO DISPONIBILE</h3>
          <p style={{color:A.muted,fontSize:13,lineHeight:1.6,marginBottom:18}}>
            Nessun video disponibile in questo momento: {fname} te lo sblocchiamo lo stesso. 🎁
          </p>
          <Btn ch={<><Gift size={16}/> CONTINUA</>} onClick={onDone}/>
        </>:<>
          <h3 style={{fontWeight:900,fontStyle:"italic",fontSize:16,marginBottom:10,color:A.text}}>VIDEO INTERROTTO</h3>
          <p style={{color:A.muted,fontSize:13,lineHeight:1.6,marginBottom:18}}>
            Il video è stato chiuso prima della fine. Per sbloccare {fname} guardalo fino in fondo.
          </p>
          <Btn ch={<><Play size={16}/> RIPROVA</>} onClick={run} s={{marginBottom:10}}/>
          <Btn ch="CHIUDI" onClick={onClose} out/>
        </>}
      </div>
    </div>
  );
};

// AUTH MODAL
const AuthModal=({onClose,onLogin})=>{
  const [mode,setMode]=useState("choice");
  const [name,setName]=useState("");const [email,setEmail]=useState("");const [pw,setPw]=useState("");const [pw2,setPw2]=useState("");const [code,setCode]=useState("");
  const [err,setErr]=useState("");const [ok,setOk]=useState("");
  const clrE=()=>{setErr("");setOk("");};
  const login=async()=>{if(!email||!pw){setErr("Compila tutti i campi");return;}try{const u=await dbGet("users",email.toLowerCase().trim());if(!u){setErr("Account non trovato");return;}if(u.pw!==pw){setErr("Password errata");return;}await dbSet("sessions","current",{email:u.email,name:u.name,nick:u.nick,isPremium:u.isPremium||false});onLogin(u);}catch(e){console.error("login error:",e);setErr("Errore di connessione, riprova tra poco");}};
  const reg=async()=>{if(!name||!email||!pw||!pw2){setErr("Compila tutti i campi");return;}if(pw!==pw2){setErr("Le password non coincidono");return;}if(pw.length<6){setErr("Password min. 6 caratteri");return;}const ek=email.toLowerCase().trim();try{if(await dbGet("users",ek)){setErr("Email già registrata");return;}const u={name,nick:name,email:ek,pw,isPremium:false,premium:false,notif:{news:true,live:true,fanta:true},ts:Date.now(),plan:"free"};await dbSet("users",ek,u);await dbSet("sessions","current",{email:u.email,name:u.name,nick:u.nick,isPremium:u.isPremium||false});onLogin(u);}catch(e){console.error("reg error:",e);setErr("Errore di connessione, riprova tra poco");}};
  const sendReset=async()=>{if(!email){setErr("Inserisci la tua email");return;}const ek=email.toLowerCase().trim();try{const u=await dbGet("users",ek);if(!u){setErr("Email non trovata");return;}const rc=mkCode();await dbSet("resets",ek,{code:rc,exp:Date.now()+600000});const sent=await sendResetEmail(ek,u.name,rc);if(!sent){await dbDelete("resets",ek);setErr(`Non siamo riusciti a inviare l'email con il codice. Riprova tra qualche minuto o scrivici a ${CONTACT_EMAIL}.`);return;}setOk("📧 Email inviata! Controlla la casella.");setMode("verify");}catch(e){console.error("sendReset error:",e);setErr("Errore di connessione, riprova tra poco. Se persiste, controlla le regole Firestore per la collezione \"resets\".");}};
  const verify=async()=>{if(code.length!==6){setErr("Codice a 6 cifre");return;}try{const st=await dbGet("resets",email.toLowerCase().trim());if(!st||st.code!==code||Date.now()>st.exp){setErr("Codice non valido o scaduto");return;}setMode("newpw");setErr("");}catch(e){console.error("verify error:",e);setErr("Errore di connessione, riprova tra poco");}};
  const newPw=async()=>{if(!pw||!pw2||pw!==pw2||pw.length<6){setErr("Password non valida");return;}const ek=email.toLowerCase().trim();try{const u=await dbGet("users",ek);if(!u)return;await dbSet("users",ek,{...u,pw});await dbDelete("resets",ek);setOk("✅ Password aggiornata! Ora puoi accedere.");setTimeout(()=>setMode("login"),1500);}catch(e){console.error("newPw error:",e);setErr("Errore di connessione, riprova tra poco");}};
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:A.card,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:430,padding:"24px 24px 44px",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{width:40,height:4,borderRadius:2,background:A.border,margin:"0 auto 22px"}}/>
        <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
          <div style={{background:A.red,borderRadius:12,padding:"10px 18px",boxShadow:`0 0 30px ${A.red}66`}}><img src={LOGO} alt="B&T" style={{height:32,filter:"brightness(0) invert(1)",objectFit:"contain"}}/></div>
        </div>
        {err&&<div style={{background:"#E1060018",border:`1px solid ${A.red}`,borderRadius:10,padding:"9px 14px",marginBottom:14,color:A.red,fontSize:13}}>{err}</div>}
        {ok&&<div style={{background:"#00C85018",border:"1px solid #00C850",borderRadius:10,padding:"9px 14px",marginBottom:14,color:"#00C850",fontSize:13,whiteSpace:"pre-line"}}>{ok}</div>}
        {mode==="choice"&&<div><h2 style={{fontWeight:900,fontStyle:"italic",textAlign:"center",fontSize:18,marginBottom:6,color:A.text}}>Accedi a B&T</h2><p style={{color:A.muted,fontSize:13,textAlign:"center",marginBottom:22}}>Registrati per sbloccare tutti i contenuti live</p><Btn ch="CREA ACCOUNT" onClick={()=>setMode("reg")} s={{marginBottom:10}}/><Btn ch="HAI GIÀ UN ACCOUNT? ACCEDI" onClick={()=>setMode("login")} out/></div>}
        {mode==="login"&&<div style={{display:"flex",flexDirection:"column",gap:11}}><h2 style={{fontWeight:900,fontStyle:"italic",fontSize:18,color:A.text,marginBottom:4}}>Accedi</h2><Inp ph="Email" type="email" val={email} chg={ev=>{setEmail(ev.target.value);clrE();}}/><Inp ph="Password" type="password" val={pw} chg={ev=>{setPw(ev.target.value);clrE();}}/><Btn ch="ACCEDI" onClick={login}/><div style={{display:"flex",justifyContent:"space-between"}}><button onClick={()=>{setMode("forgot");clrE();}} style={{background:"none",border:"none",color:A.red,fontSize:13,cursor:"pointer"}}>Password dimenticata?</button><button onClick={()=>{setMode("reg");clrE();}} style={{background:"none",border:"none",color:A.muted,fontSize:13,cursor:"pointer"}}>Registrati</button></div></div>}
        {mode==="reg"&&<div style={{display:"flex",flexDirection:"column",gap:11}}><h2 style={{fontWeight:900,fontStyle:"italic",fontSize:18,color:A.text,marginBottom:4}}>Crea account</h2><Inp ph="Nome / Nickname" val={name} chg={ev=>{setName(ev.target.value);clrE();}}/><Inp ph="Email" type="email" val={email} chg={ev=>{setEmail(ev.target.value);clrE();}}/><Inp ph="Password (min. 6 caratteri)" type="password" val={pw} chg={ev=>{setPw(ev.target.value);clrE();}}/><Inp ph="Ripeti password" type="password" val={pw2} chg={ev=>{setPw2(ev.target.value);clrE();}}/><Btn ch="REGISTRATI" onClick={reg}/><button onClick={()=>{setMode("login");clrE();}} style={{background:"none",border:"none",color:A.muted,fontSize:13,cursor:"pointer",textAlign:"center"}}>Hai già un account? <span style={{color:A.red}}>Accedi</span></button></div>}
        {mode==="forgot"&&<div style={{display:"flex",flexDirection:"column",gap:11}}><h2 style={{fontWeight:900,fontStyle:"italic",fontSize:18,color:A.text}}>Reset password</h2><p style={{color:A.muted,fontSize:13}}>Inserisci la tua email per ricevere il codice.</p><Inp ph="Email" type="email" val={email} chg={ev=>{setEmail(ev.target.value);clrE();}}/><Btn ch={<><Mail size={15}/> INVIA CODICE RESET</>} onClick={sendReset}/><button onClick={()=>{setMode("login");clrE();}} style={{background:"none",border:"none",color:A.muted,fontSize:13,cursor:"pointer",textAlign:"center"}}>← Torna al login</button></div>}
        {mode==="verify"&&<div style={{display:"flex",flexDirection:"column",gap:11}}><h2 style={{fontWeight:900,fontStyle:"italic",fontSize:18,color:A.text}}>Inserisci il codice</h2><Inp ph="Codice 6 cifre" val={code} chg={ev=>{setCode(ev.target.value.replace(/\D/g,"").slice(0,6));clrE();}} s={{fontSize:22,textAlign:"center",letterSpacing:8,fontWeight:700}}/><Btn ch={<><KeyRound size={15}/> VERIFICA</>} onClick={verify}/></div>}
        {mode==="newpw"&&<div style={{display:"flex",flexDirection:"column",gap:11}}><h2 style={{fontWeight:900,fontStyle:"italic",fontSize:18,color:A.text}}>Nuova password</h2><Inp ph="Nuova password" type="password" val={pw} chg={ev=>{setPw(ev.target.value);clrE();}}/><Inp ph="Ripeti" type="password" val={pw2} chg={ev=>{setPw2(ev.target.value);clrE();}}/><Btn ch="SALVA NUOVA PASSWORD" onClick={newPw}/></div>}
      </div>
    </div>
  );
};

const Gate=({user,onAuth,msg,ch})=>{if(user)return ch;return(<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"50vh",padding:24,textAlign:"center"}}><Lock size={42} color={A.red} style={{marginBottom:16}}/><h3 style={{fontWeight:900,fontStyle:"italic",fontSize:17,color:A.text,marginBottom:8}}>Contenuto riservato</h3><p style={{color:A.muted,fontSize:13,lineHeight:1.65,marginBottom:22}}>{msg||"Accedi per usare questa funzione"}</p><Btn ch="ACCEDI O REGISTRATI" onClick={onAuth} s={{maxWidth:300}}/></div>);};

// ══════ LIVE PAGE (componente principale) ══════
const LivePage=({races,piloti,costruttori,isPremium,adFree,unlocked,onAd,user,onAuth,onUpgrade,adsOff})=>{
  const [stab,setStab]=useState("PILOTI");
  const [liveTab,setLiveTab]=useState("GARA");
  const [cnt,setCnt]=useState(null);
  const [rows,setRows]=useState([]);
  const [radioMsgs,setRadioMsgs]=useState([]);
  const [sessionKey,setSessionKey]=useState(null);
  const [loading,setLoading]=useState(false);
  const [apiOk,setApiOk]=useState(false);
  const [currentLap,setCurrentLap]=useState(0);
  const [apiErr,setApiErr]=useState(null);
  const [liveLocked,setLiveLocked]=useState(false);
  const liveR=races.find(r=>r.status==="LIVE");
  const nextR=[...races].filter(r=>r.status==="IN ARRIVO"&&new Date(r.date)>new Date()).sort((a,b)=>new Date(a.date)-new Date(b.date))[0];
  const totalLaps=liveR?.totalLaps||57;

  // countdown
  useEffect(()=>{if(!nextR||liveR)return;const t=()=>setCnt(cd(nextR.date));t();const i=setInterval(t,1000);return()=>clearInterval(i);},[nextR,liveR]);

  // live data fetch
  useEffect(()=>{
    if(!liveR)return;
    // prima subito, poi ogni 10s
    fetchLiveData();
    const i=setInterval(()=>{fetchLiveData();},30000);
    return()=>clearInterval(i);
  },[liveR]);

  // OpenF1: durante la sessione live l'accesso gratuito è bloccato.
  // In quel caso NON mostriamo dati finti: mostriamo un avviso onesto
  // e ricarichiamo finché la sessione finisce e i dati tornano liberi.
  const OF1="https://api.openf1.org/v1";
  const of1=async(path)=>{
    const r=await fetch(`${OF1}/${path}`);
    let body=null;try{body=await r.json();}catch{}
    const detail=(body&&!Array.isArray(body)&&body.detail)?String(body.detail):"";
    if(!r.ok||detail){
      const err=new Error(detail||`HTTP ${r.status}`);
      err.locked=/live f1 session in progress|authenticated/i.test(detail)||r.status===401||r.status===403;
      throw err;
    }
    return Array.isArray(body)?body:[];
  };
  const fetchLiveData=useCallback(async()=>{
    setLoading(true);
    try{
      const sk="latest";
      const [positions,stints,laps,drivers,pits,radio]=await Promise.all([
        of1(`position?session_key=${sk}`),
        of1(`stints?session_key=${sk}`),
        of1(`laps?session_key=${sk}`),
        of1(`drivers?session_key=${sk}`),
        of1(`pit?session_key=${sk}`),
        of1(`team_radio?session_key=${sk}`),
      ]);
      let ints=[];try{ints=await of1(`intervals?session_key=${sk}`);}catch{}

      const dM={};drivers.forEach(d=>{dM[d.driver_number]=d;});
      const lpos={},lstint={},llap={},lint={},bestLap={},pitCount={};
      positions.forEach(x=>{if(!lpos[x.driver_number]||x.date>lpos[x.driver_number].date)lpos[x.driver_number]=x;});
      stints.forEach(x=>{if(!lstint[x.driver_number]||x.stint_number>(lstint[x.driver_number]?.stint_number||0))lstint[x.driver_number]=x;});
      laps.forEach(x=>{
        if(!llap[x.driver_number]||x.lap_number>(llap[x.driver_number]?.lap_number||0))llap[x.driver_number]=x;
        if(x.lap_duration&&(!bestLap[x.driver_number]||x.lap_duration<bestLap[x.driver_number]))bestLap[x.driver_number]=x.lap_duration;
      });
      ints.forEach(x=>{if(!lint[x.driver_number]||x.date>lint[x.driver_number].date)lint[x.driver_number]=x;});
      pits.forEach(p=>{pitCount[p.driver_number]=(pitCount[p.driver_number]||0)+1;});

      const maxLap=Math.max(...Object.values(llap).map(l=>l.lap_number||0),0);
      setCurrentLap(maxLap);

      const built=Object.values(lpos).map(p=>({
        num:p.driver_number,pos:p.position,
        drv:dM[p.driver_number]||{name_acronym:`#${p.driver_number}`,team_name:""},
        stint:lstint[p.driver_number]||{},
        lap:llap[p.driver_number]||{},
        int:lint[p.driver_number]||{},
        pits:pitCount[p.driver_number]||0,
        bestLap:bestLap[p.driver_number]||null,
      })).sort((a,b)=>a.pos-b.pos);

      setRows(built);
      setRadioMsgs(radio.slice(-20).reverse().map(r=>({
        id:r.date+r.driver_number,
        acr:dM[r.driver_number]?.name_acronym||`#${r.driver_number}`,
        team:dM[r.driver_number]?.team_name||"",
        time:new Date(r.date).toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"}),
        msg:"Messaggio radio",
        recording_url:r.recording_url||"",
      })));
      setApiOk(built.length>0);setLiveLocked(false);setApiErr(built.length?null:"Nessun dato disponibile per questa sessione.");
    }catch(e){
      setApiOk(false);setRows([]);setRadioMsgs([]);
      setLiveLocked(!!e.locked);
      setApiErr(e.locked?null:"Impossibile raggiungere il servizio dati. Riprova tra poco.");
    }
    setLoading(false);
  },[]);

  const isU=f=>isPremium||unlocked.has(f);
  const LB=({f,label})=>(
    <button onClick={()=>onAd(f)} title={`Guarda un annuncio per sbloccare ${label||f}`}
      style={{background:`${A.red}18`,border:`1px solid ${A.red}33`,borderRadius:6,padding:"3px 7px",cursor:"pointer",display:"flex",alignItems:"center",gap:3,color:A.red}}>
      <Lock size={10}/><span style={{fontSize:9,fontWeight:700}}>AD</span>
    </button>
  );
  const PB=()=>(
    <div style={{background:"linear-gradient(135deg,#2a1a00,#1a1000)",border:"1px solid #f90444",borderRadius:6,padding:"3px 7px",display:"flex",alignItems:"center",gap:3}}>
      <span style={{fontSize:9,color:"#f90",fontWeight:800}}>★PRO</span>
    </div>
  );

  // LIVE RACE UI
  if(liveR) return(
    <div style={{paddingBottom:88}}>
      {/* Race header */}
      <div style={{background:`linear-gradient(to bottom,${A.red}22,transparent)`,padding:"14px 16px 0",borderBottom:`1px solid ${A.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
          <span style={{background:A.red,color:"#fff",fontSize:10,fontWeight:800,padding:"3px 9px",borderRadius:4,animation:"none"}}>🔴 LIVE</span>
          <span style={{fontWeight:900,fontStyle:"italic",fontSize:16,color:A.text}}>{liveR.name}</span>
          {loading&&<span style={{fontSize:11,color:A.muted,marginLeft:"auto"}}>⟳</span>}
        </div>
        <div style={{display:"flex",gap:16,marginBottom:12}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:11,color:A.muted}}>GIRO</div>
            <div style={{fontWeight:900,fontSize:18,color:A.red}}>{currentLap||"—"}<span style={{fontSize:12,color:A.dim,fontWeight:400}}>/{totalLaps}</span></div>
          </div>
          <div style={{width:1,background:A.border}}/>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:11,color:A.muted}}>CIRCUITO</div>
            <div style={{fontWeight:700,fontSize:13,color:A.text}}>{liveR.circuit}</div>
          </div>
          <div style={{width:1,background:A.border}}/>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:11,color:A.muted}}>ROUND</div>
            <div style={{fontWeight:700,fontSize:13,color:A.text}}>#{liveR.round}</div>
          </div>
          <div style={{width:1,background:A.border}}/>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:11,color:A.muted}}>FONTE</div>
            <div style={{fontSize:10,color:apiOk?"#4AE54A":A.muted,fontWeight:700}}>{apiOk?"OpenF1 🟢":liveLocked?"A fine gara":"Non disp."}</div>
          </div>
        </div>
        {/* Tab switcher */}
        <div style={{display:"flex",gap:8,paddingBottom:12}}>
          {["GARA","TEAM RADIO"].map(t=>(
            <button key={t} onClick={()=>setLiveTab(t)} style={{padding:"7px 16px",fontSize:12,fontWeight:800,fontStyle:"italic",background:liveTab===t?A.red:"transparent",color:liveTab===t?"#fff":A.muted,border:liveTab===t?"none":`1px solid ${A.border}`,borderRadius:20,cursor:"pointer"}}>
              {t==="TEAM RADIO"?<Radio size={11} style={{marginRight:4}}/>:<span style={{marginRight:4}}>🛞</span>}{t}
            </button>
          ))}
        </div>
      </div>

      {/* GARA tab */}
      {liveTab==="GARA"&&(
        <div style={{padding:"12px 16px"}}>
          {user&&(liveLocked||apiErr)&&(
            <div style={{background:A.card,border:`1px solid ${A.border}`,borderRadius:14,padding:"20px 18px",marginBottom:14,textAlign:"center"}}>
              <div style={{fontSize:30,marginBottom:10}}>🏁</div>
              <div style={{fontWeight:900,fontStyle:"italic",fontSize:16,color:A.text,marginBottom:8}}>
                {liveLocked?"GARA IN CORSO":"DATI NON DISPONIBILI"}
              </div>
              <p style={{color:A.muted,fontSize:13,lineHeight:1.6,margin:0}}>
                {liveLocked
                  ?"Posizioni, gomme, pit stop, tempi e team radio saranno disponibili qui a fine gara. Intanto segui la classifica mondiale e commenta in chat!"
                  :apiErr}
              </p>
              <button onClick={()=>fetchLiveData()} style={{marginTop:14,background:"transparent",border:`1px solid ${A.border}`,borderRadius:8,padding:"8px 14px",color:A.muted,fontSize:12,cursor:"pointer"}}>{loading?"Aggiornamento…":"↻ Aggiorna"}</button>
            </div>
          )}
          {user&&(liveLocked||apiErr)&&(
            <div style={{background:A.card,borderRadius:14,marginBottom:14}}>
              <div style={{padding:"12px 16px 4px",fontWeight:900,fontStyle:"italic",fontSize:13,color:A.text}}>CLASSIFICA PILOTI</div>
              {piloti.slice(0,10).map((it,i)=>(
                <div key={it.id} style={{display:"flex",alignItems:"center",padding:"10px 16px",borderTop:`1px solid ${A.border}`}}>
                  <span style={{width:24,fontWeight:900,color:i<3?A.red:A.dim,fontSize:13}}>{it.position||i+1}</span>
                  <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:A.text}}>{it.name}</div><div style={{fontSize:10,color:A.muted}}>{it.team}</div></div>
                  <span style={{fontWeight:900,fontSize:14,color:A.text}}>{it.points}</span>
                </div>
              ))}
            </div>
          )}

          {/* Legenda sblocchi */}
          {user&&!isPremium&&rows.length>0&&(
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
              {!isU("live-tire")&&<button onClick={()=>onAd("live-tire")} style={{background:`${A.red}18`,border:`1px solid ${A.red}33`,borderRadius:8,padding:"5px 10px",cursor:"pointer",color:A.red,fontSize:11,fontWeight:700,display:"flex",alignItems:"center",gap:4}}><Lock size={11}/>SBLOCCA GOMME</button>}
              {!isU("live-pit")&&<button onClick={()=>onAd("live-pit")} style={{background:`${A.red}18`,border:`1px solid ${A.red}33`,borderRadius:8,padding:"5px 10px",cursor:"pointer",color:A.red,fontSize:11,fontWeight:700,display:"flex",alignItems:"center",gap:4}}><Lock size={11}/>SBLOCCA PIT STOP</button>}
              {!isU("live-lap")&&<button onClick={()=>onAd("live-lap")} style={{background:`${A.red}18`,border:`1px solid ${A.red}33`,borderRadius:8,padding:"5px 10px",cursor:"pointer",color:A.red,fontSize:11,fontWeight:700,display:"flex",alignItems:"center",gap:4}}><Lock size={11}/>SBLOCCA TEMPI</button>}
            </div>
          )}

          {!user&&<div style={{marginBottom:12}}><Gate user={user} onAuth={onAuth} msg="Accedi per vedere i dati live del Gran Premio!"/></div>}

          {user&&rows.map((r,idx)=>{
            const t=TIRE[r.stint?.compound]||TIRE.HARD;
            const acr=r.drv.name_acronym||"???";
            const team=(r.drv.team_name||"").split(" ")[0];
            const stintLap=r.stint?.lap_number||0;
            const gap=r.int?.interval;
            const gapStr=typeof gap==="number"?`+${gap.toFixed(3)}`:(gap||"—");
            const gapIsLeader=gap==="LEADER"||r.pos===1;
            const pitsDone=r.pits||0;
            const teamColor={Mercedes:"#00D2BE",Ferrari:"#E10600",McLaren:"#FF8000","Red Bull":"#3671C6","Aston Martin":"#358C75","Williams":"#005AFF","RB F1":"#5E8FAA","Haas":"#B6BABD","Sauber":"#52E252","Alpine":"#0093CC"}[team]||A.dim;
            return(
              <div key={r.num} style={{background:A.card,borderRadius:12,marginBottom:8,overflow:"hidden",borderLeft:`3px solid ${r.pos<=3?A.red:A.dim}`}}>
                <div style={{padding:"10px 14px"}}>
                  {/* Row 1: position + name + gap */}
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <span style={{fontWeight:900,color:r.pos<=3?A.red:A.muted,fontSize:16,minWidth:24,textAlign:"center"}}>{r.pos}</span>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontWeight:800,fontSize:14,color:A.text}}>{acr}</span>
                        <span style={{width:8,height:8,borderRadius:"50%",background:teamColor,display:"inline-block"}}/>
                        <span style={{fontSize:11,color:A.muted}}>{team}</span>
                      </div>
                    </div>
                    {/* gap */}
                    {isU("live-lap")?<span style={{fontWeight:700,fontSize:13,color:gapIsLeader?A.red:"#ccc",minWidth:70,textAlign:"right"}}>{gapIsLeader?"LEADER":gapStr}</span>:<LB f="live-lap" label="distacco"/>}
                  </div>
                  {/* Row 2: tire + pit + last lap + best lap */}
                  <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                    {/* TIRE */}
                    {isU("live-tire")
                      ?<TireWidget compound={r.stint?.compound||"HARD"} stintLap={stintLap}/>
                      :<div style={{display:"flex",alignItems:"center",gap:4}}><Lock size={12} color={A.dim}/><span style={{fontSize:10,color:A.dim}}>Gomma</span></div>}

                    {/* PIT COUNT */}
                    {isU("live-pit")?<div style={{display:"flex",alignItems:"center",gap:4}}>
                      <div style={{background:A.card2,borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:700,color:pitsDone>0?A.text:A.dim}}>
                        🔧 {pitsDone} pit
                      </div>
                    </div>:<div style={{display:"flex",alignItems:"center",gap:4}}><Lock size={12} color={A.dim}/><span style={{fontSize:10,color:A.dim}}>Pit</span></div>}

                    {/* LAST LAP */}
                    {isPremium?<div style={{marginLeft:"auto",textAlign:"right"}}>
                      <div style={{fontSize:9,color:A.dim}}>ULT. GIRO</div>
                      <div style={{fontSize:11,color:A.text,fontFamily:"monospace",fontWeight:600}}>{fmtL(r.lap?.lap_duration)}</div>
                    </div>:<div style={{marginLeft:"auto"}}><PB/></div>}
                  </div>

                  {/* Row 3: best lap (premium) */}
                  {isPremium&&r.bestLap&&(
                    <div style={{marginTop:6,paddingTop:6,borderTop:`1px solid ${A.border}`,display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:9,color:"#f90",fontWeight:700}}>★ BEST LAP</span>
                      <span style={{fontSize:11,color:"#f90",fontFamily:"monospace",fontWeight:700}}>{fmtL(r.bestLap)}</span>
                      <span style={{fontSize:9,color:A.dim,marginLeft:"auto"}}>Giro {r.lap?.lap_number||"—"}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TEAM RADIO tab */}
      {liveTab==="TEAM RADIO"&&(
        <div style={{padding:"12px 16px"}}>
          {!user&&<Gate user={user} onAuth={onAuth} msg="Accedi per ascoltare i team radio in diretta!"/>}
          {user&&rows.length===0&&(
            <p style={{color:A.muted,textAlign:"center",padding:"30px 10px",fontSize:13,lineHeight:1.6}}>{liveLocked?"I team radio della gara saranno disponibili qui a fine gara.":"Team radio non disponibili al momento."}</p>
          )}
          {user&&rows.length>0&&!isU("live-radio")&&(
            <div style={{textAlign:"center",padding:"30px 20px"}}>
              <Volume2 size={42} color={A.red} style={{margin:"0 auto 16px"}}/>
              <h3 style={{fontWeight:900,fontStyle:"italic",fontSize:16,color:A.text,marginBottom:10}}>TEAM RADIO LIVE</h3>
              <p style={{color:A.muted,fontSize:13,lineHeight:1.65,marginBottom:20}}>Ascolta le comunicazioni in tempo reale tra i piloti e il muretto. Guarda un breve annuncio per sbloccare.</p>
              <Btn ch={<><Eye size={15}/> GUARDA E SBLOCCA AUDIO</>} onClick={()=>onAd("live-radio")} s={{maxWidth:320,margin:"0 auto"}}/>
            </div>
          )}
          {user&&rows.length>0&&isU("live-radio")&&(
            <div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <Radio size={14} color={A.red}/>
                  <span style={{fontWeight:900,fontStyle:"italic",fontSize:13,color:A.text}}>COMUNICAZIONI LIVE</span>
                </div>
                <span style={{fontSize:11,color:apiOk?"#4AE54A":A.muted}}>{"OpenF1"}</span>
              </div>
              {radioMsgs.length===0&&<p style={{color:A.muted,textAlign:"center",padding:"30px 0",fontSize:13}}>Nessun messaggio radio al momento.</p>}
              {radioMsgs.map(m=><RadioItem key={m.id} msg={m}/>)}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // NO LIVE RACE: countdown + classifiche
  return(
    <div style={{padding:"16px 16px 88px"}}>
      {nextR&&cnt&&(
        <div style={{background:A.card,borderRadius:14,padding:22,marginBottom:22,textAlign:"center"}}>
          <div style={{fontSize:11,color:A.red,fontWeight:700,letterSpacing:1.5,marginBottom:6}}>PROSSIMO GP</div>
          <div style={{fontWeight:900,fontStyle:"italic",fontSize:19,color:A.text,marginBottom:3}}>{nextR.name}</div>
          <div style={{fontSize:12,color:A.muted,marginBottom:18}}>{nextR.circuit} · {new Date(nextR.date).toLocaleDateString("it-IT",{day:"2-digit",month:"long",year:"numeric"})}</div>
          <div style={{display:"flex",justifyContent:"center",gap:18}}>
            {[["GIORNI",cnt.d],["ORE",cnt.h],["MIN",cnt.m],["SEC",cnt.s]].map(([l,v])=>(
              <div key={l}><div style={{fontWeight:900,fontSize:30,color:A.red,lineHeight:1}}>{String(v).padStart(2,"0")}</div><div style={{fontSize:9,color:A.muted,letterSpacing:1,marginTop:3}}>{l}</div></div>
            ))}
          </div>
        </div>
      )}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <span style={{fontWeight:900,fontStyle:"italic",fontSize:15,color:A.text}}>CLASSIFICHE MONDIALI</span>
        <div style={{display:"flex",background:A.card,borderRadius:20,overflow:"hidden"}}>
          {["PILOTI","COSTRUTTORI"].map(t=><button key={t} onClick={()=>setStab(t)} style={{padding:"6px 14px",fontSize:11,fontWeight:800,fontStyle:"italic",background:stab===t?A.red:"transparent",color:stab===t?"#fff":A.muted,border:"none",cursor:"pointer",borderRadius:20}}>{t}</button>)}
        </div>
      </div>
      <div style={{background:A.card,borderRadius:14}}>
        {(stab==="PILOTI"?piloti:costruttori).map((it,i,arr)=>(
          <div key={it.id} style={{display:"flex",alignItems:"center",padding:"13px 16px",borderBottom:i<arr.length-1?`1px solid ${A.border}`:"none"}}>
            <span style={{width:26,fontWeight:900,color:i<3?A.red:A.dim,fontSize:14}}>{it.position||i+1}</span>
            <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14,color:A.text}}>{it.name}</div>{it.team&&<div style={{fontSize:11,color:A.muted}}>{it.team}</div>}</div>
            <span style={{fontWeight:900,fontSize:16,color:A.text}}>{it.points}</span>
          </div>
        ))}
      </div>
      <AdMobBanner isPremium={adFree||adsOff} adId={ADMOB_ADAPTIVE_BANNER_ID} adSize="ADAPTIVE_BANNER"/>
    </div>
  );
};

// ── OTHER PAGES (same as before, compact) ──
const HomePage=({news,setPage,setSN,user,onAuth,isPremium,adFree,onUpgrade,adsOff})=>{
  const pub=news.filter(n=>n.published).sort((a,b)=>new Date(b.date)-new Date(a.date));
  return(<div style={{padding:"16px 16px 0"}}>
    <div style={{position:"relative",overflow:"hidden",marginBottom:24,borderRadius:16,height:240,backgroundImage:`url(${GP})`,backgroundSize:"cover",backgroundPosition:"center"}}>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,.97) 30%,rgba(0,0,0,.1))"}}>
        <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"0 18px 20px"}}>
          <div style={{fontSize:10,color:A.red,fontWeight:700,letterSpacing:2,marginBottom:5}}>IL PUNTO DI RIFERIMENTO DEI TIFOSI</div>
          <div style={{fontWeight:900,fontStyle:"italic",fontSize:22,color:"#fff",lineHeight:1.1,marginBottom:16}}>B&T MOTORSPORT<br/>NEWS</div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setPage("live")} style={{background:A.red,color:"#fff",border:"none",borderRadius:8,padding:"10px 18px",fontWeight:800,fontStyle:"italic",fontSize:13,cursor:"pointer"}}>🔴 LIVE RACE</button>
            <button onClick={()=>setPage("fanta")} style={{background:"rgba(255,255,255,.15)",color:"#fff",border:"1px solid rgba(255,255,255,.3)",borderRadius:8,padding:"10px 18px",fontWeight:800,fontStyle:"italic",fontSize:13,cursor:"pointer"}}>FANTA F1</button>
          </div>
        </div>
      </div>
    </div>
    <ST em="🔥" ch="ULTIME NEWS"/>
    {!user&&<div style={{background:`${A.red}18`,border:`1px solid ${A.red}44`,borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:A.muted}}>👁 Ospite — <button onClick={onAuth} style={{background:"none",border:"none",color:A.red,fontWeight:700,cursor:"pointer",fontSize:13}}>accedi</button> per leggere</div>}
    <div style={{display:"flex",flexDirection:"column",gap:14,paddingBottom:88}}>
      {pub.map(n=>{
        const locked=!isPremium&&!FREE_CATEGORIES.includes(n.category);
        if(locked)return(<div key={n.id} onClick={()=>user?onUpgrade():onAuth()} style={{background:A.card,borderRadius:14,cursor:"pointer",padding:"18px 16px",display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:10,background:`${A.red}18`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Lock size={18} color={A.red}/></div>
          <div style={{flex:1}}><div style={{fontWeight:800,fontSize:14,color:A.text,marginBottom:2}}>Notizia di {n.category}</div><div style={{fontSize:12,color:A.muted}}>Contenuto riservato agli abbonati Premium</div></div>
          <span style={{color:A.red,fontSize:18}}>›</span>
        </div>);
        return(<div key={n.id} onClick={()=>user?[setSN(n),setPage("news-detail")]:onAuth()} style={{background:A.card,borderRadius:14,overflow:"hidden",cursor:"pointer",opacity:user?1:.75}}>
        <NewsPhoto src={n.image} minH={170} maxH={420}>
          {!n.image&&<div style={{fontWeight:900,fontStyle:"italic",fontSize:44,color:"#fff",opacity:.1}}>B&T</div>}
          <Tag ch={n.category} s={{position:"absolute",top:0,left:0,borderRadius:"0 0 8px 0"}}/>
          {!user&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center"}}><Lock size={28} color="#fff"/></div>}
        </NewsPhoto>
        <div style={{padding:"13px 15px 16px"}}><h3 style={{fontWeight:800,fontSize:15,color:A.text,marginBottom:5,lineHeight:1.3}}>{n.title}</h3><p style={{color:A.muted,fontSize:12,marginBottom:5}}>{n.summary}</p><span style={{fontSize:11,color:A.dim}}>{fmt(n.date)}</span></div>
      </div>);
      })}
    </div>
    <AdMobBanner isPremium={adFree||adsOff}/>
    {!isPremium&&<div onClick={onUpgrade} style={{background:`linear-gradient(135deg,${A.red}18,${A.red}08)`,border:`1px solid ${A.red}33`,borderRadius:14,margin:"0 16px 16px",padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:24}}>⭐</span><div style={{flex:1}}><div style={{fontWeight:800,fontSize:13,color:A.red}}>{PAYMENTS_ENABLED?"Passa a B&T Premium":"B&T Premium in arrivo"}</div><div style={{fontSize:12,color:A.muted}}>{PAYMENTS_ENABLED?"Rimuovi le pubblicità + tutti i dati live":"Presto: niente pubblicità + tutti i dati live"}</div></div><span style={{color:A.red,fontSize:18}}>›</span></div>}
    <p style={{color:A.dim,fontSize:10,lineHeight:1.55,textAlign:"center",padding:"4px 16px 64px",margin:0}}>{F1_DISCLAIMER}</p>
  </div>);
};
const NewsDetail=({a,back})=>(<div style={{paddingBottom:88}}><button onClick={back} style={{display:"flex",alignItems:"center",gap:7,background:"none",border:"none",color:A.muted,padding:"16px 16px 8px",cursor:"pointer",fontSize:13}}><ArrowLeft size={16}/> Indietro</button>{a.image&&<NewsPhoto src={a.image} minH={220} maxH={560}/>}<div style={{padding:"18px 16px"}}><Tag ch={a.category}/><h1 style={{fontWeight:900,fontStyle:"italic",fontSize:22,color:A.text,margin:"12px 0 8px",lineHeight:1.2}}>{a.title}</h1><p style={{fontSize:12,color:A.muted,marginBottom:20}}>{a.author} · {fmt(a.date)}</p>{(a.content||"").split("\n\n").map((p,i)=><p key={i} style={{color:"#ccc",fontSize:14,lineHeight:1.75,marginBottom:14}}>{p}</p>)}</div></div>);
const IGPage=({ig})=>(<div style={{padding:"16px 16px 88px"}}><div style={{background:"linear-gradient(135deg,#405DE6,#5851DB,#833AB4,#C13584,#E1306C,#FD1D1D,#F56040)",borderRadius:16,padding:20,marginBottom:22,display:"flex",alignItems:"center",gap:16}}><div style={{width:64,height:64,borderRadius:"50%",border:"3px solid rgba(255,255,255,.6)",background:"#000",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,padding:10}}><img src={LOGO} alt="B&T" style={{width:"100%",height:"100%",objectFit:"contain"}}/></div><div><div style={{fontWeight:800,fontSize:15,color:"#fff",marginBottom:4}}>@bt_formula1</div><div style={{display:"flex",alignItems:"center",gap:7}}><span style={{width:8,height:8,borderRadius:"50%",background:"#4AE54A",display:"inline-block"}}/><span style={{fontWeight:900,fontSize:24,color:"#fff"}}>{fmtN(ig.followers)}</span><span style={{color:"rgba(255,255,255,.8)",fontSize:13,fontWeight:600}}>FOLLOWER</span></div></div></div><ST ch="VIDEO VIRALI"/>{ig.videos.map(v=>(<a key={v.id} href={v.url} target="_blank" rel="noreferrer" style={{textDecoration:"none",display:"block",marginBottom:14}}><div style={{background:A.card,borderRadius:14,overflow:"hidden"}}><div style={{height:185,backgroundImage:`url(${v.thumbnail})`,backgroundSize:"cover",backgroundPosition:"center",position:"relative"}}><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:52,height:52,borderRadius:"50%",background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center"}}><Play size={22} color="#fff" fill="#fff"/></div></div></div><div style={{padding:"12px 15px 14px"}}><p style={{fontWeight:700,fontSize:14,color:A.text,marginBottom:6}}>{v.title}</p><div style={{fontSize:11,color:A.red,fontWeight:600,marginBottom:5}}>@bt_formula1</div><div style={{display:"flex",gap:16,fontSize:12,color:A.muted}}><span>👁 {v.views}</span><span>❤️ {v.likes}</span></div></div></div></a>))}</div>);
const CHAT_ROOMS=[{key:"generale",label:"Chat Generale",dbKey:"bt-chat-generale",color:A.red,icon:"msg"},{key:"live",label:"Live Gara",dbKey:"bt-chat-live-gara",color:"#4AE54A",icon:"activity"},{key:"fantaf1",label:"FantaF1 Talk",dbKey:"bt-chat-fantaf1-talk",color:"#E7B34C",icon:"trophy"},{key:"boxradio",label:"Box Radio",dbKey:"bt-chat-boxradio",color:"#2DD4BF",icon:"radio"},{key:"paddock",label:"Paddock Talk",dbKey:"bt-chat-paddocktalk",color:"#4A90E2",icon:"shield"}];
const chatIcon=(icon,size=22)=>icon==="trophy"?<Trophy size={size} color="#fff"/>:icon==="radio"?<Radio size={size} color="#fff"/>:icon==="shield"?<Shield size={size} color="#fff"/>:icon==="activity"?<Activity size={size} color="#fff"/>:<MessageSquare size={size} color="#fff"/>;
const chatRelTime=t=>{if(!t)return"";const min=Math.floor((Date.now()-t)/60000);if(min<1)return"ora";if(min<60)return`${min} min`;const h=Math.floor(min/60);if(h<24)return`${h} h`;if(h<48)return"Ieri";const d=new Date(t);return`${d.getDate()}/${d.getMonth()+1}`;};
// "Letti" = orario dell'ultimo messaggio visto (prima era il numero di messaggi, che si
// sfasava quando il moderatore ne cancellava qualcuno).
const markSeen=(k,arr)=>ss("bt-chat-seen-"+k,(arr||[]).reduce((mx,m)=>Math.max(mx,m.t||0),0)||Date.now(),false);
const ChatPage=({races,user,onAuth})=>{
  const live=races.find(r=>r.status==="LIVE");
  const [view,setView]=useState("list");
  const [room,setRoom]=useState("generale");
  const [summaries,setSummaries]=useState({});
  const [msgs,setMsgs]=useState([]);
  const [txt,setTxt]=useState("");
  const [blocked,setBlocked]=useState([]);   // utenti bloccati da me (solo su questo telefono)
  const [menu,setMenu]=useState(null);       // messaggio su cui ho aperto le opzioni
  const [toast,setToast]=useState("");
  const endR=useRef(null);
  const dbKey=CHAT_ROOMS.find(r=>r.key===room).dbKey;
  const myAid=user?authorId(user.email):"";
  const isMine=m=>m.aid?m.aid===myAid:m.user===user.name;
  const isBlocked=(m,bl=blocked)=>bl.some(b=>sameAuthor(b,m));
  const flash=t=>{setToast(t);setTimeout(()=>setToast(""),3500);};
  useEffect(()=>{(async()=>{setBlocked((await sg(BLOCKED_KEY,false))||[]);})();},[user]);
  useEffect(()=>{
    if(!user||view!=="list")return;
    let stop=false;
    const load=async()=>{
      const bl=(await sg(BLOCKED_KEY,false))||[];
      const entries=await Promise.all(CHAT_ROOMS.map(async r=>{
        let d=await sg(r.dbKey,true);
        if(!d&&r.key==="generale"){const old=await sg("bt-chat",true);if(old){d=old;await ss(r.dbKey,old,true);}}
        d=d||[];
        const seen=(await sg("bt-chat-seen-"+r.key,false))||0;
        const vis=d.filter(m=>!isBlocked(m,bl));
        // seen grande = orario (nuovo formato); piccolo = numero di messaggi (vecchio formato).
        const unread=seen>1e12?vis.filter(m=>(m.t||0)>seen&&!isMine(m)).length:Math.max(0,d.length-seen);
        return [r.key,{last:vis[vis.length-1]||null,count:d.length,unread}];
      }));
      if(!stop)setSummaries(Object.fromEntries(entries));
    };
    load();
    const t=setInterval(load,6000);
    return()=>{stop=true;clearInterval(t);};
  },[view,user]);
  useEffect(()=>{
    if(!user||view!=="thread")return;
    setMsgs([]);
    let stop=false;
    const lm=async()=>{
      let d=await sg(dbKey,true);
      if(!d&&room==="generale"){const old=await sg("bt-chat",true);if(old){d=old;await ss(dbKey,old,true);}}
      if(!stop&&d){setMsgs(d);markSeen(room,d);}
    };
    lm();
    const t=setInterval(lm,4000);
    return()=>{stop=true;clearInterval(t);};
  },[view,room,user]);
  useEffect(()=>{endR.current?.scrollIntoView({behavior:"smooth"});},[msgs]);
  const openRoom=k=>{setRoom(k);setView("thread");};
  const backToList=()=>{markSeen(room,msgs);setView("list");};
  const send=async()=>{
    if(!txt.trim())return;
    // Utenti sospesi dal moderatore (pannello admin → CHAT): non possono più scrivere.
    const banned=(await sg(CHAT_BANNED_KEY,true))||[];
    if(banned.some(b=>sameAuthor(b,{aid:myAid,user:user.name}))){flash("Non puoi più scrivere in chat: il tuo account è stato sospeso per violazione delle regole.");return;}
    const m={id:uid(),user:user.name,aid:myAid,txt:txt.trim(),t:Date.now()};
    const u=[...msgs,m];
    setMsgs(u);setTxt("");
    // Aggiunge solo il nuovo messaggio: non riscrive la lista (che può essere vecchia di qualche secondo).
    try{await sharedAppend(dbKey,m);}catch(e){setMsgs(msgs);setTxt(m.txt);flash("Messaggio non inviato: controlla la connessione e riprova.");return;}
    markSeen(room,u);
  };
  const report=async m=>{
    setMenu(null);
    try{
      const reps=(await sg(CHAT_REPORTS_KEY,true))||[];
      if(!reps.some(r=>r.msgId===m.id&&r.byAid===myAid))
        await sharedAppend(CHAT_REPORTS_KEY,{id:uid(),room,msgId:m.id,txt:m.txt,author:m.user,aid:m.aid||"",by:user.name,byAid:myAid,t:Date.now()});
      flash("Segnalazione inviata: la controlleremo al più presto. Grazie!");
    }catch(e){flash("Segnalazione non inviata: controlla la connessione e riprova.");}
  };
  const block=async m=>{
    setMenu(null);
    const who={aid:m.aid||"",name:m.user};
    const nb=[...blocked.filter(b=>!sameAuthor(b,m)),who];
    setBlocked(nb);
    await ss(BLOCKED_KEY,nb,false);
    flash(`Non vedrai più i messaggi di ${m.user}. Puoi sbloccarlo dal Profilo.`);
  };
  if(!user)return <Gate user={user} onAuth={onAuth} msg="Registrati per partecipare alla community!"/>;
  if(view==="thread"){
    const r=CHAT_ROOMS.find(x=>x.key===room);
    const vis=msgs.filter(m=>!isBlocked(m));
    return(<div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 140px)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",borderBottom:`1px solid ${A.border}`}}>
        <button onClick={backToList} aria-label="Torna all'elenco chat" style={{background:"transparent",border:"none",cursor:"pointer",color:A.text,display:"flex",padding:4}}><ArrowLeft size={20}/></button>
        <span style={{width:34,height:34,borderRadius:"50%",background:r.color,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{chatIcon(r.icon,17)}</span>
        <span style={{fontWeight:800,fontStyle:"italic",fontSize:15,color:A.text}}>{r.label}</span>
      </div>
      {live&&room==="live"&&<div style={{padding:"9px 16px",background:`${A.red}22`,borderBottom:`1px solid ${A.red}44`,display:"flex",alignItems:"center",gap:8}}><Radio size={13} color={A.red}/><span style={{color:A.red,fontWeight:800,fontStyle:"italic",fontSize:13}}>LIVE: {live.name}</span></div>}
      <div style={{flex:1,overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:8}}>
        {vis.length===0&&<div style={{textAlign:"center",color:A.dim,fontSize:12,marginTop:20}}>Nessun messaggio ancora. Scrivi il primo tu!</div>}
        {vis.map(m=>{const mine=isMine(m);return <div key={m.id} style={{display:"flex",flexDirection:"column",alignSelf:mine?"flex-end":"flex-start",maxWidth:"76%"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2,alignSelf:mine?"flex-end":"flex-start"}}>
            <span style={{fontSize:10,color:A.muted}}>{m.user}</span>
            {!mine&&<button onClick={()=>setMenu(m)} aria-label={`Opzioni messaggio di ${m.user}`} style={{background:"transparent",border:"none",color:A.dim,cursor:"pointer",fontSize:14,lineHeight:1,padding:"0 4px"}}>⋯</button>}
          </div>
          <div style={{background:mine?A.red:"#2a2a2a",borderRadius:12,padding:"8px 12px"}}><span style={{fontSize:13,color:"#fff"}}>{m.txt}</span></div>
        </div>;})}
        <div ref={endR}/>
      </div>
      {toast&&<div style={{margin:"0 16px 8px",background:A.card2,border:`1px solid ${A.border}`,borderRadius:10,padding:"9px 12px",fontSize:12,color:A.text,textAlign:"center"}}>{toast}</div>}
      <div style={{padding:"11px 16px",borderTop:`1px solid ${A.border}`,display:"flex",gap:10}}>
        <Inp ph="Scrivi…" val={txt} chg={e=>setTxt(e.target.value)} s={{flex:1}}/>
        <button onClick={send} aria-label="Invia messaggio" style={{background:A.red,border:"none",borderRadius:10,width:44,height:44,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",cursor:"pointer"}}><Send size={18}/></button>
      </div>
      {menu&&<div onClick={()=>setMenu(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:350,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div onClick={e=>e.stopPropagation()} style={{background:A.card,borderRadius:"16px 16px 0 0",width:"100%",maxWidth:430,padding:"16px 16px calc(16px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{fontSize:12,color:A.muted,textAlign:"center",marginBottom:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{menu.user}: “{menu.txt}”</div>
          <Btn ch="🚩 Segnala messaggio" onClick={()=>report(menu)}/>
          <Btn ch={`🚫 Blocca ${menu.user}`} onClick={()=>block(menu)} out/>
          <button onClick={()=>setMenu(null)} style={{background:"transparent",border:"none",color:A.muted,fontSize:13,padding:10,cursor:"pointer"}}>Annulla</button>
        </div>
      </div>}
    </div>);
  }
  return(<div style={{padding:"16px 16px 88px"}}>
    <div style={{fontWeight:900,fontStyle:"italic",fontSize:13,color:A.dim,letterSpacing:.5,marginBottom:14}}>LE TUE CHAT</div>
    {CHAT_ROOMS.map(r=>{
      const s=summaries[r.key]||{last:null,count:0,unread:0};
      return(<button key={r.key} onClick={()=>openRoom(r.key)} style={{display:"flex",alignItems:"center",gap:14,width:"100%",background:"transparent",border:"none",borderBottom:`1px solid ${A.border}`,padding:"13px 2px",cursor:"pointer",textAlign:"left"}}>
        <span style={{width:48,height:48,borderRadius:"50%",background:r.color,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{chatIcon(r.icon)}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:800,fontStyle:"italic",fontSize:14,color:A.text,marginBottom:3}}>{r.label}</div>
          <div style={{fontSize:12,color:A.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.last?`${isMine(s.last)?"Tu":s.last.user}: ${s.last.txt}`:"Nessun messaggio ancora"}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
          <span style={{fontSize:11,color:A.dim}}>{chatRelTime(s.last?.t)}</span>
          {s.unread>0&&<span style={{background:A.red,color:"#fff",fontSize:10,fontWeight:800,borderRadius:10,minWidth:18,height:18,padding:"0 5px",display:"flex",alignItems:"center",justifyContent:"center"}}>{s.unread}</span>}
        </div>
      </button>);
    })}
    <p style={{fontSize:11,color:A.dim,lineHeight:1.6,textAlign:"center",marginTop:18}}>Rispetta gli altri tifosi: niente insulti, spam o dati personali. Con ⋯ su un messaggio puoi segnalarlo o bloccare chi l'ha scritto.</p>
  </div>);
};
const FantaPage=({pilots,isPremium,unlocked,onAd,user,onAuth,onUpgrade})=>{const ok=isPremium||unlocked.has("fanta");if(!user)return <Gate user={user} onAuth={onAuth} msg="Registrati per accedere al Fanta F1!"/>;if(!ok)return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"62vh",padding:24}}><div style={{maxWidth:340,width:"100%",textAlign:"center"}}><Lock size={42} color={A.red} style={{margin:"0 auto 16px"}}/><h2 style={{fontWeight:900,fontStyle:"italic",fontSize:18,color:A.text,marginBottom:10}}>FANTA F1 — APRE A FINE STAGIONE</h2><p style={{color:A.muted,fontSize:13,lineHeight:1.65,marginBottom:20}}>Il Fanta F1 si sblocca alla fine della stagione. Vuoi curiosare? Guarda un breve annuncio e apri l'anteprima.</p><Btn ch={<><Eye size={16}/> GUARDA E SBLOCCA ANTEPRIMA</>} onClick={()=>onAd("fanta")}/></div></div>);return(<div style={{padding:"16px 16px 88px"}}><ST em="🏆" ch="PILOTI DISPONIBILI"/><p style={{color:A.muted,fontSize:12,marginBottom:16}}>Budget: 100M · Scegli 5 piloti</p>{pilots.map(p=><div key={p.id} style={{background:A.card,borderRadius:14,marginBottom:9,padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontWeight:700,fontSize:13,color:A.text}}>{p.name}</div><div style={{fontSize:11,color:A.muted}}>{p.team}</div></div><div style={{display:"flex",gap:18}}><div style={{textAlign:"center"}}><div style={{fontSize:10,color:A.muted}}>PREZZO</div><div style={{fontWeight:900,color:A.red,fontSize:15}}>{p.price}M</div></div><div style={{textAlign:"center"}}><div style={{fontSize:10,color:A.muted}}>PUNTI</div><div style={{fontWeight:900,color:A.text,fontSize:15}}>{p.points}</div></div></div></div>)}</div>);};
const PrivacyLinks=()=>{const st={width:"100%",background:"transparent",border:"none",padding:"8px 0",color:A.muted,fontSize:13,cursor:"pointer",textAlign:"center"};return(<div style={{marginBottom:11}}><button onClick={()=>openUrl(PRIVACY_URL)} style={st}>Privacy Policy</button>{isNativeApp()&&_privacyOptionsRequired&&<button onClick={openPrivacyOptions} style={st}>Preferenze privacy annunci</button>}</div>);};
const ProfilePage=({user,onLogout,onDelete,onAdmin,notif,setNotif,isPremium,paid,onUpgrade,onDowngrade,onAuth,onShowTerms})=>{const [confirmDel,setConfirmDel]=useState(false);const [deleting,setDeleting]=useState(false);const [blocked,setBlocked]=useState([]);useEffect(()=>{setConfirmDel(false);setDeleting(false);(async()=>setBlocked((await sg(BLOCKED_KEY,false))||[]))();},[user]);const unblock=async b=>{const nb=blocked.filter(x=>x!==b);setBlocked(nb);await ss(BLOCKED_KEY,nb,false);};const confirmDelete=async()=>{if(deleting)return;setDeleting(true);try{await onDelete();}catch(e){console.error("delete error:",e);setDeleting(false);alert("Eliminazione non riuscita, controlla la connessione e riprova.");}};if(!user)return(<div><Gate user={user} onAuth={onAuth} msg="Accedi per visualizzare il tuo profilo"/><div style={{padding:"0 16px 88px"}}><PrivacyLinks/></div></div>);const ini=(user.name||"??").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);return(<div style={{padding:"16px 16px 88px"}}><div style={{background:A.card,borderRadius:14,padding:"24px 20px",textAlign:"center",marginBottom:14}}><div style={{width:74,height:74,borderRadius:"50%",background:A.red,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",fontWeight:900,fontStyle:"italic",fontSize:26,color:"#fff"}}>{ini}</div><div style={{fontWeight:900,fontStyle:"italic",fontSize:18,color:A.text,marginBottom:2}}>{user.name}</div>{user.nick&&user.nick!==user.name&&<div style={{fontSize:13,color:A.red,fontWeight:600,marginBottom:4}}>@{user.nick}</div>}<div style={{fontSize:13,color:A.muted,marginBottom:20}}>{user.email}</div><Btn ch={<><Shield size={15}/> PANNELLO ADMIN</>} onClick={onAdmin} sm/></div>{!isPremium&&<div style={{background:"linear-gradient(135deg,#181818,#2a1a0a)",border:`1px solid ${A.red}44`,borderRadius:14,padding:16,marginBottom:14}}><div style={{fontWeight:900,fontStyle:"italic",fontSize:14,color:A.red,marginBottom:6}}>⭐ PREMIUM</div><p style={{color:A.muted,fontSize:12,marginBottom:14,lineHeight:1.6}}>Sblocca news esclusive, tutti i dati live (tempi, gomme, pit stop, audio radio), Fanta F1 e nessuna pubblicità.</p><Btn ch={PAYMENTS_ENABLED?`ABBONATI — ${PREMIUM_PRICE}`:"⏳ PREMIUM IN ARRIVO"} onClick={onUpgrade} sm/></div>}{isPremium&&!paid&&<div style={{background:"linear-gradient(135deg,#0a1a0a,#182818)",border:"1px solid #4AE54A44",borderRadius:14,padding:14,marginBottom:14}}><div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}><span style={{fontSize:24}}>🎁</span><div style={{flex:1}}><div style={{fontWeight:800,color:"#4AE54A",fontSize:13}}>PREMIUM GRATIS PER TUTTI</div><div style={{fontSize:11,color:A.muted,lineHeight:1.5}}>Finché non partono gli abbonamenti, notizie esclusive e dati live completi sono aperti a tutti. Il Fanta F1 apre a fine stagione.</div></div></div><div style={{fontWeight:800,fontSize:11,color:A.text,letterSpacing:.5,marginBottom:4}}>COSA AVRÀ IL PREMIUM</div><p style={{fontSize:11,color:A.muted,lineHeight:1.55,marginBottom:12}}>News esclusive, tutti i dati live (tempi, gomme, pit stop, audio radio), Fanta F1 completo con leghe e, con l'abbonamento, nessuna pubblicità.</p><Btn ch="⭐ SCOPRI IL PREMIUM" onClick={onUpgrade} sm/></div>}{isPremium&&paid&&<div style={{background:"linear-gradient(135deg,#0a1a0a,#182818)",border:"1px solid #4AE54A44",borderRadius:14,padding:14,marginBottom:14,display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:24}}>⭐</span><div style={{flex:1}}><div style={{fontWeight:800,color:"#4AE54A",fontSize:13}}>PREMIUM ATTIVO</div><div style={{fontSize:11,color:A.muted}}>Tutti i dati live · No pubblicità</div></div><button onClick={onDowngrade} style={{background:"none",border:`1px solid ${A.dim}`,borderRadius:8,padding:"4px 10px",color:A.dim,fontSize:10,cursor:"pointer"}}>Annulla</button></div>}<div style={{background:A.card,borderRadius:14,padding:"16px 18px",marginBottom:14}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><Bell size={15} color={A.red}/><span style={{fontWeight:900,fontStyle:"italic",fontSize:14,color:A.text}}>NOTIFICHE</span></div>{[{k:"news",l:"Ultime notizie B&T",d:"Nuovi articoli e video"},{k:"live",l:"Allerte gara live",d:"Inizio gara e risultati"},{k:"fanta",l:"Novità Fanta F1",d:"Aggiornamenti punteggi"}].map(it=>(<div key={it.k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 0",borderBottom:`1px solid ${A.border}`}}><div><div style={{fontSize:14,color:A.text,marginBottom:2}}>{it.l}</div><div style={{fontSize:11,color:A.muted}}>{it.d}</div></div><Tg v={notif[it.k]} chg={v=>setNotif(p=>({...p,[it.k]:v}))}/></div>))}</div>{blocked.length>0&&<div style={{background:A.card,borderRadius:14,padding:"14px 18px",marginBottom:14}}><div style={{fontWeight:900,fontStyle:"italic",fontSize:14,color:A.text,marginBottom:10}}>UTENTI BLOCCATI</div>{blocked.map((b,i)=>(<div key={(b.aid||"")+b.name+i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${A.border}`}}><span style={{fontSize:13,color:A.text}}>{b.name}</span><button onClick={()=>unblock(b)} style={{background:"transparent",border:`1px solid ${A.border}`,borderRadius:8,padding:"4px 10px",color:A.muted,fontSize:11,cursor:"pointer"}}>Sblocca</button></div>))}</div>}<button onClick={onShowTerms} style={{width:"100%",background:"transparent",border:"none",padding:"10px 0",color:A.muted,fontSize:13,cursor:"pointer",textAlign:"center",marginBottom:0}}>Termini e Condizioni</button><PrivacyLinks/><Btn ch={<><LogOut size={15}/> ESCI DALL'ACCOUNT</>} onClick={onLogout} out s={{marginBottom:11}}/><button onClick={()=>setConfirmDel(true)} style={{width:"100%",background:"transparent",border:`1px solid ${A.border}`,borderRadius:10,padding:13,color:A.dim,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><Trash2 size={14}/> ELIMINA ACCOUNT</button><p style={{color:A.dim,fontSize:10,lineHeight:1.55,textAlign:"center",margin:"18px 4px 0"}}>{F1_DISCLAIMER}</p>{confirmDel&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}><div style={{background:A.card,borderRadius:14,padding:22,maxWidth:360,width:"100%",textAlign:"center"}}><Trash2 size={30} color={A.red} style={{margin:"0 auto 10px"}}/><h3 style={{fontWeight:900,fontStyle:"italic",fontSize:17,color:A.text,marginBottom:8}}>Eliminare l'account?</h3><p style={{color:A.muted,fontSize:13,lineHeight:1.6,marginBottom:18}}>Cancelleremo il tuo profilo, i messaggi che hai scritto in chat e i feedback inviati. L'operazione non si può annullare.</p><Btn ch={deleting?"ELIMINAZIONE IN CORSO…":"ELIMINA DEFINITIVAMENTE"} onClick={confirmDelete} dis={deleting} s={{marginBottom:10}}/><button onClick={()=>setConfirmDel(false)} style={{background:"transparent",border:"none",color:A.muted,fontSize:13,padding:10,cursor:"pointer"}}>Annulla</button></div></div>}</div>);};

// TASTIERINO INDUSTRIALE
const AdminKeypad=({onOk,onCancel})=>{
  const [code,setCode]=useState("");const [err,setErr]=useState(false);const [flash,setFlash]=useState(false);
  const press=d=>{if(code.length>=6)return;const nc=code+d;setCode(nc);setErr(false);if(nc.length===6){if(nc===ADMIN_CODE){setFlash(true);setTimeout(onOk,500);}else setTimeout(()=>{setCode("");setErr(true);setTimeout(()=>setErr(false),1200);},300);}};
  const gC=err?"#ff2020":flash?"#00ff88":"#3af";
  return(<div style={{position:"fixed",inset:0,background:"#060606",zIndex:200,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
    <button onClick={onCancel} style={{position:"absolute",top:"calc(20px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))",left:20,background:"#181818",border:"none",borderRadius:10,color:"#999",cursor:"pointer",padding:10}}><ArrowLeft size={22}/></button>
    <Shield size={34} color={A.red} style={{marginBottom:14}}/>
    <h2 style={{fontWeight:900,fontStyle:"italic",fontSize:19,color:"#fff",marginBottom:4}}>PANNELLO ADMIN</h2>
    <p style={{color:"#555",fontSize:13,marginBottom:26}}>Inserisci il codice di accesso</p>
    <div style={{display:"flex",gap:12,marginBottom:30}}>
      {[0,1,2,3,4,5].map(i=><div key={i} style={{width:13,height:13,borderRadius:"50%",transition:"all .15s",background:err?"#ff2020":flash?"#00ff88":i<code.length?"#fff":"#222",boxShadow:i<code.length?`0 0 12px ${gC}`:"none"}}/>)}
    </div>
    <div style={{background:"linear-gradient(160deg,#3e3e3e,#282828,#343434)",borderRadius:14,padding:18,boxShadow:`0 0 0 1px #555,0 0 0 3px #1a1a1a,0 14px 50px rgba(0,0,0,.9),0 0 70px ${gC}44`,border:"1px solid #4a4a4a",position:"relative"}}>
      <div style={{position:"absolute",inset:-1,borderRadius:15,border:`1.5px solid ${gC}66`,boxShadow:`inset 0 0 20px ${gC}22,0 0 30px ${gC}55`,pointerEvents:"none"}}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,72px)",gap:9}}>
        {[1,2,3,4,5,6,7,8,9,null,0,null].map((d,i)=>{
          if(d===null)return <div key={i} style={{width:72,height:58}}/>;
          return(<button key={i} onClick={()=>press(String(d))} style={{width:72,height:58,borderRadius:11,cursor:"pointer",background:"linear-gradient(160deg,#505050,#303030,#3c3c3c)",border:"1px solid #5c5c5c",boxShadow:"0 5px 12px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.12),inset 0 -2px 0 rgba(0,0,0,.4)",color:"#e8e8e8",fontSize:22,fontWeight:300,transition:"transform .08s, box-shadow .08s",textShadow:`0 0 10px ${gC}88`}} onMouseDown={e=>{e.currentTarget.style.transform="scale(.94)";e.currentTarget.style.boxShadow="0 2px 6px rgba(0,0,0,.9),inset 0 2px 4px rgba(0,0,0,.4)";}} onMouseUp={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow="0 5px 12px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.12),inset 0 -2px 0 rgba(0,0,0,.4)";}}>{d}</button>);
        })}
      </div>
      <button onClick={()=>setCode(c=>c.slice(0,-1))} style={{marginTop:9,width:"100%",height:44,borderRadius:11,background:"linear-gradient(160deg,#3a2020,#251515)",border:"1px solid #5a3a3a",boxShadow:"0 5px 12px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,100,100,.08)",color:"#f88",fontSize:16,cursor:"pointer",textShadow:"0 0 10px #f884"}}>⌫ CANCELLA</button>
    </div>
    {err&&<p style={{color:A.red,fontSize:13,marginTop:20,fontWeight:700}}>Codice errato. Riprova.</p>}
  </div>);
};



// ════════════════════════════════════════════════════════
// ── ADMOB BANNER REALE (Capacitor SDK su APK, fallback su web)
// ════════════════════════════════════════════════════════
const isNativeApp = () => !!(typeof window !== "undefined" &&
  window.Capacitor && window.Capacitor.isNativePlatform &&
  window.Capacitor.isNativePlatform());
const useAdMob = isNativeApp;
const admobPlugin = () => (typeof window !== "undefined" && window.Capacitor?.Plugins?.AdMob) || null;

// Avvio di AdMob, una sola volta per apertura dell'app. Prima di chiedere qualsiasi
// annuncio chiediamo a Google se serve il consenso (UE, Regno Unito, Svizzera) e, se
// serve, mostriamo il suo messaggio certificato (quello creato su AdMob → Privacy e
// messaggi). Senza consenso agli utenti europei arriverebbero solo annunci non
// personalizzati o "limitati". Restituisce true se si possono chiedere annunci.
let _admobReady = null;
let _privacyOptionsRequired = false; // true dove Google chiede di poter cambiare le scelte (UE ecc.)
function admobReady() {
  if (_admobReady) return _admobReady;
  const p = (async () => {
    const AdMob = admobPlugin();
    if (!AdMob || !isNativeApp()) return false;
    try {
      await AdMob.initialize({ requestTrackingAuthorization: true });
      let info = await AdMob.requestConsentInfo();
      if (info && info.isConsentFormAvailable && info.status === "REQUIRED") info = await AdMob.showConsentForm();
      _privacyOptionsRequired = !!info && info.privacyOptionsRequirementStatus === "REQUIRED";
      return !!info && info.canRequestAds !== false;
    } catch (e) {
      // Rete assente o errore di Google: per ora niente annunci, si riprova al prossimo.
      _admobReady = null;
      return false;
    }
  })();
  _admobReady = p;
  return p;
}
// Dal profilo: riapre le scelte sulla privacy degli annunci (obbligatorio poterle cambiare).
const openPrivacyOptions = async () => {
  const AdMob = admobPlugin();
  if (!AdMob) return;
  try { await admobReady(); await AdMob.showPrivacyOptionsForm(); _admobReady = null; }
  catch { alert("Le preferenze sulla privacy degli annunci non sono disponibili in questo momento."); }
};

// Altezza vera del banner nativo in px (0 = nessun banner). La comunica AdMob con
// l'evento "bannerAdSizeChanged"; la root la usa per alzare le schede in basso sopra il
// banner, su qualunque pagina il banner compaia (prima succedeva solo sulla Home).
const bannerBus = { h: 0, subs: new Set(), set(h) { if (h === this.h) return; this.h = h; this.subs.forEach(f => f(h)); } };
// Mostra/rimuovi banner in fila, uno dopo l'altro: cambiando pagina il vecchio banner va
// tolto prima che parta quello nuovo, altrimenti la rimozione potrebbe cancellare il nuovo.
let _bannerOps = Promise.resolve();
const bannerOp = fn => (_bannerOps = _bannerOps.then(() => Promise.race([Promise.resolve().then(fn), new Promise(r => setTimeout(r, 10000))])).catch(() => {}));

const AdMobBanner = ({ isPremium, adId = ADMOB_BANNER_ID, adSize = "BANNER" }) => {
  const isNative = useAdMob();

  useEffect(() => {
    if (isPremium || !isNative) return;
    const AdMob = admobPlugin();
    if (!AdMob) return;
    let alive = true;
    const handles = [];
    bannerOp(async () => {
      if (!alive || !(await admobReady()) || !alive) return;
      handles.push(await AdMob.addListener("bannerAdSizeChanged", s => {
        if (alive) bannerBus.set(Math.max(0, Math.round((s && s.height) || 0)));
      }));
      await AdMob.showBanner({ adId, adSize, position: "BOTTOM_CENTER", margin: 0, isTesting: ADMOB_TEST });
    });
    // Cambio pagina: via il banner nativo, altrimenti resterebbe sopra le altre schede.
    return () => {
      alive = false;
      bannerOp(async () => {
        handles.splice(0).forEach(h => { try { h.remove(); } catch {} });
        bannerBus.set(0);
        await AdMob.removeBanner();
      });
    };
  }, [isPremium, isNative, adId, adSize]);

  // Il banner vero è disegnato da Android sopra l'app: qui non serve niente.
  return null;
};

// ════════════════════════════════════════════════════════
// ── PREMIUM MODAL ──
// Si apre quando l'utente clicca "Passa a Premium"
// onUpgrade(plan) → aggiorna Firebase e stato locale
// ════════════════════════════════════════════════════════
const PremiumModal = ({ onClose, onUpgrade, isPremium, user }) => {
  const [plan, setPlan] = useState("monthly"); // monthly | annual
  const [loading, setLoading] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [done, setDone] = useState(false);
  const [payErr, setPayErr] = useState("");

  // ── PAGAMENTO REALE (Stripe Checkout) ──
  // 1) chiediamo alla Cloud Function di creare una sessione di pagamento Stripe
  // 2) apriamo la pagina di pagamento (in-app browser su APK, nuova scheda sul web)
  // 3) il pagamento viene confermato dal webhook lato server (mai dal client),
  //    quindi controlliamo Firestore finché isPremium non diventa vero
  const handleUpgrade = async () => {
    if (!PAYMENTS_ENABLED) return; // abbonamenti spenti: niente Stripe dentro l'app
    if (!user?.email) { setPayErr("Devi accedere prima di abbonarti."); return; }
    setPayErr("");
    setLoading(true);
    try {
      const r = await fetch(`${FUNCTIONS_BASE}/createCheckoutSession`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, plan }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.url) throw new Error(data.error || "Impossibile avviare il pagamento. Riprova tra poco.");

      const isNativeApp = typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.();
      const BrowserPlugin = window.Capacitor?.Plugins?.Browser;
      if (isNativeApp && BrowserPlugin) await BrowserPlugin.open({ url: data.url });
      else window.open(data.url, "_blank");

      setLoading(false);
      setWaiting(true);
      const startedAt = Date.now();
      const poll = setInterval(async () => {
        const fresh = await dbGet("users", user.email);
        if (fresh?.isPremium) {
          clearInterval(poll);
          if (isNativeApp && BrowserPlugin) BrowserPlugin.close().catch(() => {});
          setWaiting(false);
          await onUpgrade(fresh);
          setDone(true);
        } else if (Date.now() - startedAt > 6 * 60 * 1000) {
          clearInterval(poll); // 6 minuti senza conferma: l'utente potrebbe aver annullato
          setWaiting(false);
          setPayErr("Non abbiamo ancora ricevuto conferma del pagamento. Se hai completato il pagamento su Stripe, riapri questa schermata tra poco.");
        }
      }, 3000);
    } catch (e) {
      setLoading(false);
      setPayErr(e.message || "Errore durante l'avvio del pagamento.");
    }
  };

  const features = [
    { icon: "📰", label: "News esclusive e in anteprima" },
    { icon: "⏱️", label: "Tempi su giro in tempo reale" },
    { icon: "🏎️", label: "Gomme: usura e strategia" },
    { icon: "📻", label: "Team radio audio live" },
    { icon: "🔢", label: "Pit stop e distacchi completi" },
    { icon: "🏆", label: "Fanta F1 completo con leghe" },
    { icon: "🚫", label: "Zero pubblicità" },
  ];

  if (done) return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.9)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
      <div style={{ background:A.card,borderRadius:20,padding:"32px 24px",textAlign:"center",maxWidth:340,width:"100%" }}>
        <div style={{ fontSize: 60, marginBottom: 16 }}>⭐</div>
        <h2 style={{ fontWeight:900,fontStyle:"italic",fontSize:22,color:A.text,marginBottom:8 }}>Sei Premium!</h2>
        <p style={{ color:A.muted,fontSize:14,lineHeight:1.6,marginBottom:24 }}>
          Tutte le funzioni avanzate sono ora sbloccate. Buona gara! 🏁
        </p>
        <Btn ch="INIZIA A USARE B&T PREMIUM" onClick={onClose}/>
      </div>
    </div>
  );

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:500,display:"flex",alignItems:"flex-end",justifyContent:"center" }} onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:A.card,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:430,maxHeight:"92vh",overflowY:"auto",paddingBottom:40 }}>
        {/* Header gradiente */}
        <div style={{
          background: `linear-gradient(135deg, #1a0000, ${A.red}44, #1a0000)`,
          borderRadius:"24px 24px 0 0", padding:"28px 24px 20px", textAlign:"center",
          position:"relative",
        }}>
          <button onClick={onClose} style={{ position:"absolute",top:16,right:16,background:"rgba(255,255,255,.1)",border:"none",borderRadius:"50%",width:32,height:32,cursor:"pointer",color:"#fff",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center" }}>×</button>
          <div style={{ fontSize:44,marginBottom:8 }}>⭐</div>
          <h2 style={{ fontWeight:900,fontStyle:"italic",fontSize:24,color:"#fff",marginBottom:4 }}>B&T PREMIUM</h2>
          <p style={{ color:"rgba(255,255,255,.7)",fontSize:13 }}>Il massimo dell'esperienza F1</p>
        </div>

        <div style={{ padding:"20px 20px 0" }}>
          {/* Feature list */}
          <div style={{ marginBottom:20 }}>
            {features.map((f,i) => (
              <div key={i} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${A.border}` }}>
                <span style={{ fontSize:20,width:28,textAlign:"center" }}>{f.icon}</span>
                <span style={{ fontSize:14,color:A.text,fontWeight:500 }}>{f.label}</span>
                <span style={{ marginLeft:"auto",color:"#4AE54A",fontSize:16 }}>✓</span>
              </div>
            ))}
          </div>

          {/* Piano selector (solo con abbonamenti attivi) */}
          {PAYMENTS_ENABLED && <div style={{ display:"flex",gap:10,marginBottom:20 }}>
            {[
              { id:"monthly", label:"MENSILE",  price:PREMIUM_PRICE,  badge:null },
              { id:"annual",  label:"ANNUALE",  price:PREMIUM_ANNUAL, badge:"−30%" },
            ].map(p => (
              <div key={p.id} onClick={() => setPlan(p.id)} style={{
                flex:1, border:`2px solid ${plan===p.id ? A.red : A.border}`,
                borderRadius:14, padding:"14px 12px", cursor:"pointer",
                background: plan===p.id ? `${A.red}18` : A.card2,
                textAlign:"center", position:"relative", transition:"all .2s",
              }}>
                {p.badge && <span style={{ position:"absolute",top:-9,left:"50%",transform:"translateX(-50%)",background:"#4AE54A",color:"#000",fontSize:9,fontWeight:900,padding:"2px 8px",borderRadius:10 }}>{p.badge}</span>}
                <div style={{ fontWeight:800,fontSize:11,color:plan===p.id?A.red:A.muted,letterSpacing:1,marginBottom:4 }}>{p.label}</div>
                <div style={{ fontWeight:900,fontSize:18,color:A.text }}>{p.price}</div>
              </div>
            ))}
          </div>}

          {/* CTA */}
          {PAYMENTS_ENABLED ? (<>
          {payErr && <p style={{ background:"#E1060018",border:`1px solid ${A.red}`,borderRadius:10,padding:"9px 14px",marginBottom:12,color:A.red,fontSize:12,lineHeight:1.5 }}>{payErr}</p>}
          <Btn
            ch={waiting ? "In attesa del pagamento…" : loading ? "Attendi…" : `ABBONATI — ${plan==="monthly" ? PREMIUM_PRICE : PREMIUM_ANNUAL}`}
            onClick={handleUpgrade}
            dis={loading||waiting}
            s={{ marginBottom:12, background: (loading||waiting) ? "#555" : A.red, fontSize:15 }}
          />
          {waiting && <p style={{ textAlign:"center",fontSize:12,color:A.muted,marginBottom:12,lineHeight:1.5 }}>Completa il pagamento nella scheda che si è aperta. Questa schermata si aggiornerà da sola.</p>}
          <p style={{ textAlign:"center",fontSize:11,color:A.dim,lineHeight:1.6 }}>
            Annulla in qualsiasi momento · Rinnovo automatico<br/>
            <span style={{ color:A.red }}>Pagamento sicuro con Stripe · carte accettate</span>
          </p>
          </>) : (<>
          {PREMIUM_FREE_FOR_ALL && <p style={{ background:"#4AE54A14",border:"1px solid #4AE54A44",borderRadius:10,padding:"10px 14px",marginBottom:12,color:A.muted,fontSize:12,lineHeight:1.55 }}>
            🎁 <b style={{ color:"#4AE54A" }}>Per ora è gratis per tutti:</b> news esclusive e dati live completi sono già aperti. Il Fanta F1 apre a fine stagione e con l'abbonamento sparirà anche la pubblicità.
          </p>}
          <Btn ch="⏳ PREMIUM IN ARRIVO" dis s={{ marginBottom:12, background:"#555", fontSize:15 }}/>
          <p style={{ textAlign:"center",fontSize:12,color:A.muted,lineHeight:1.6 }}>
            Stiamo preparando gli abbonamenti B&T Premium.<br/>Ti avviseremo con una notifica appena saranno disponibili.
          </p>
          </>)}
        </div>
      </div>
    </div>
  );
};

// ── PREMIUM BADGE (mostrato nell'header quando isPremium) ──
const PremiumBadge = () => (
  <div style={{
    background:"linear-gradient(135deg,#f90,#ff6000)",
    borderRadius:8, padding:"2px 8px",
    fontSize:10, fontWeight:900, color:"#fff", letterSpacing:0.5,
  }}>⭐ PRO</div>
);


// ════════════════════════════════════════════════════════
// ── SPLASH SCREEN (video di apertura)
// ════════════════════════════════════════════════════════
const SplashScreen = ({ onDone }) => {
  const [fade, setFade] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => { setFade(true); setTimeout(onDone, 600); }, 1800);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{
      position:"fixed", inset:0, background:"#000", zIndex:9999,
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14,
      transition:"opacity .6s ease", opacity: fade ? 0 : 1,
    }}>
      <div style={{background:A.red,borderRadius:16,padding:"18px 24px",boxShadow:`0 0 50px ${A.red}55`,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <img src={LOGO} alt="B&T" style={{height:38,filter:"brightness(0) invert(1)"}}/>
      </div>
      <p style={{color:A.dim,fontSize:13}}>Caricamento…</p>
    </div>
  );
};

// ════════════════════════════════════════════════════════
// ── TERMINI & CONDIZIONI MODAL
// ════════════════════════════════════════════════════════
const TermsModal = ({ onAccept, reviewMode = false }) => {
  const [scrolled, setScrolled] = useState(reviewMode);
  const handleScroll = (e) => {
    const el = e.target;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setScrolled(true);
  };
  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,.95)", zIndex:900,
      display:"flex", alignItems:"flex-end", justifyContent:"center",
    }}>
      <div style={{
        background:"#181818", borderRadius:"20px 20px 0 0", width:"100%", maxWidth:430,
        height:"85vh", display:"flex", flexDirection:"column",
      }}>
        <div style={{ padding:"20px 20px 12px", borderBottom:"1px solid #2d2d2d", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ background:"#E10600", borderRadius:6, padding:"3px 10px",
              fontWeight:900, fontStyle:"italic", fontSize:16, color:"#fff" }}>B&T</div>
            <div>
              <div style={{ fontWeight:900, fontSize:15, color:"#fff" }}>Termini e Condizioni</div>
              <div style={{ fontSize:11, color:"#666" }}>Scorri per leggere tutto</div>
            </div>
          </div>
        </div>
        <div onScroll={handleScroll} style={{
          flex:1, overflowY:"auto", padding:"16px 20px",
          fontSize:12, color:"#aaa", lineHeight:1.7,
        }}>
          <h3 style={{ color:"#E10600", fontStyle:"italic", marginBottom:8 }}>1. Accettazione dei Termini</h3>
          <p>Utilizzando l'app B&T App ("l'App"), l'utente accetta di essere vincolato ai presenti Termini e Condizioni. Se non si accettano questi termini, si prega di non utilizzare l'App.</p>

          <h3 style={{ color:"#E10600", fontStyle:"italic", margin:"16px 0 8px" }}>2. Descrizione del Servizio</h3>
          <p>B&T App è un'app di informazione e intrattenimento dedicata alla Formula 1. Offre notizie, classifiche, dati live delle gare tramite OpenF1 API, una sezione community (chat) e funzionalità Fanta F1.</p>

          <h3 style={{ color:"#E10600", fontStyle:"italic", margin:"16px 0 8px" }}>3. Account Utente</h3>
          <p>Per accedere a tutte le funzionalità è necessario creare un account. L'utente è responsabile della riservatezza delle proprie credenziali. Ogni attività effettuata dall'account è responsabilità dell'utente.</p>

          <h3 style={{ color:"#E10600", fontStyle:"italic", margin:"16px 0 8px" }}>4. Abbonamento Premium</h3>
          {PAYMENTS_ENABLED
            ? <p>L'abbonamento Premium (2,99€/mese o 24,99€/anno) sblocca funzionalità avanzate e rimuove la pubblicità. Il rinnovo è automatico e può essere annullato in qualsiasi momento dal profilo. Non sono previsti rimborsi per il periodo in corso.</p>
            : <p>L'abbonamento Premium non è ancora disponibile. Quando verrà attivato, prezzi, rinnovo e modalità di disdetta saranno indicati in questa sezione e nella schermata di acquisto.</p>}

          <h3 style={{ color:"#E10600", fontStyle:"italic", margin:"16px 0 8px" }}>5. Contenuti e Proprietà Intellettuale</h3>
          <p>Tutti i contenuti pubblicati dal Team B&T (articoli, immagini, video) sono di proprietà di B&T App. I dati di gara sono forniti da OpenF1 API. I loghi e i marchi di Formula 1, FIA e team sono di proprietà dei rispettivi titolari.</p>
          <p style={{ marginTop:8 }}>{F1_DISCLAIMER} B&T App non è associata nemmeno alla FIA, alle scuderie o ai piloti.</p>

          <h3 style={{ color:"#E10600", fontStyle:"italic", margin:"16px 0 8px" }}>6. Condotta degli Utenti</h3>
          <p>Nella chat community è vietato pubblicare contenuti offensivi, discriminatori, sessualmente espliciti, spam, materiale illegale o informazioni personali altrui. Con il tasto ⋯ su ogni messaggio puoi segnalarlo o bloccare chi l'ha scritto: i messaggi segnalati vengono controllati dai moderatori e rimossi se violano queste regole. Le violazioni possono comportare la sospensione dalla chat o dell'account.</p>

          <h3 style={{ color:"#E10600", fontStyle:"italic", margin:"16px 0 8px" }}>7. Pubblicità</h3>
          <p>Gli utenti non abbonati visualizzeranno annunci pubblicitari forniti tramite Google AdMob. Nell'Unione Europea ti chiediamo il consenso con il messaggio di Google e puoi cambiare le tue scelte in qualsiasi momento da Profilo → Preferenze privacy annunci.</p>

          <h3 style={{ color:"#E10600", fontStyle:"italic", margin:"16px 0 8px" }}>8. Privacy e Cookie</h3>
          <p>Raccogliamo solo i dati necessari al funzionamento del servizio (email, nome, messaggi in chat, preferenze) e li conserviamo su Firebase (Google). Non vendiamo i dati a terzi. Puoi eliminare l'account e i tuoi dati in qualsiasi momento da Profilo → Elimina account. Tutti i dettagli sono nella <button onClick={()=>openUrl(PRIVACY_URL)} aria-label="Apri la Privacy Policy" style={{ background:"none", border:"none", padding:0, color:"#E10600", textDecoration:"underline", cursor:"pointer", font:"inherit" }}>Privacy Policy</button>.</p>

          <h3 style={{ color:"#E10600", fontStyle:"italic", margin:"16px 0 8px" }}>9. Limitazione di Responsabilità</h3>
          <p>B&T App non garantisce l'accuratezza assoluta dei dati live di gara. L'App è fornita "così com'è". Non siamo responsabili per interruzioni del servizio, perdita di dati o danni derivanti dall'uso dell'App.</p>

          <h3 style={{ color:"#E10600", fontStyle:"italic", margin:"16px 0 8px" }}>10. Modifiche ai Termini</h3>
          <p>Ci riserviamo il diritto di modificare questi termini. Gli utenti saranno notificati tramite l'App. L'uso continuato dopo le modifiche costituisce accettazione dei nuovi termini.</p>

          <h3 style={{ color:"#E10600", fontStyle:"italic", margin:"16px 0 8px" }}>11. Legge Applicabile</h3>
          <p style={{ marginBottom:30 }}>I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia è competente il Foro di Milano. Per contatti: {CONTACT_EMAIL}</p>
        </div>
        <div style={{ padding:"12px 20px 28px", borderTop:"1px solid #2d2d2d", flexShrink:0 }}>
          {!scrolled && <p style={{ fontSize:11, color:"#666", textAlign:"center", marginBottom:10 }}>
            ↓ Scorri fino in fondo per accettare
          </p>}
          <button onClick={scrolled ? onAccept : undefined} style={{
            width:"100%", background: scrolled ? "#E10600" : "#333",
            border:"none", borderRadius:12, padding:14, color: scrolled ? "#fff" : "#666",
            fontWeight:900, fontStyle:"italic", fontSize:14, cursor: scrolled ? "pointer" : "default",
            transition:"all .3s",
          }}>
            {scrolled ? (reviewMode ? "CHIUDI" : "✓ ACCETTO I TERMINI E CONDIZIONI") : "Scorri per continuare…"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════
// ── FEEDBACK CHANNEL (canale feedback a bassa attrito)
// ════════════════════════════════════════════════════════
const FeedbackModal = ({ onClose, user }) => {
  const [stars, setStars] = useState(0);
  const [hov, setHov] = useState(0);
  const [msg, setMsg] = useState("");
  const [category, setCategory] = useState("generale");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!stars) return;
    setSending(true);
    const fb = {
      id: uid(),
      stars,
      category,
      msg: msg.trim(),
      user: user?.email || "anonimo",
      date: new Date().toISOString(),
      appVersion: "1.0.0",
    };
    await ss("bt-feedback-" + fb.id, fb, true);
    setSending(false);
    setSent(true);
    setTimeout(onClose, 2000);
  };

  // Haptic feedback su tap stella
  const tapStar = (n) => {
    setStars(n);
    if (navigator.vibrate) navigator.vibrate(40);
  };

  const cats = [
    { id:"generale", label:"💬 Generale" },
    { id:"bug", label:"🐛 Bug" },
    { id:"live", label:"📡 Dati live" },
    { id:"design", label:"🎨 Design" },
    { id:"idea", label:"💡 Idea" },
  ];

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:600,
      display:"flex",alignItems:"flex-end",justifyContent:"center" }}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{ background:"#181818",borderRadius:"20px 20px 0 0",width:"100%",
        maxWidth:430,padding:"22px 20px 36px" }}>
        <div style={{ width:36,height:4,borderRadius:2,background:"#2d2d2d",
          margin:"0 auto 18px" }}/>

        {sent ? (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🏁</div>
            <div style={{ fontWeight:900, fontStyle:"italic", fontSize:18, color:"#fff" }}>
              Grazie per il feedback!
            </div>
            <p style={{ color:"#888", fontSize:13, marginTop:8 }}>
              Lo leggiamo tutti. Aiuti B&T a migliorare!
            </p>
          </div>
        ) : (
          <>
            <div style={{ fontWeight:900, fontStyle:"italic", fontSize:16, color:"#fff",
              marginBottom:4 }}>📣 Invia Feedback</div>
            <p style={{ color:"#888", fontSize:12, marginBottom:18 }}>
              Bastano 30 secondi. La tua opinione conta davvero.
            </p>

            {/* Stelle */}
            <div style={{ display:"flex", justifyContent:"center", gap:8, marginBottom:18 }}>
              {[1,2,3,4,5].map(n=>(
                <button key={n}
                  onMouseEnter={()=>setHov(n)} onMouseLeave={()=>setHov(0)}
                  onClick={()=>tapStar(n)}
                  style={{ background:"none", border:"none", cursor:"pointer",
                    fontSize:36, transition:"transform .15s",
                    transform: n<=(hov||stars) ? "scale(1.2)" : "scale(1)",
                    filter: n<=(hov||stars) ? "none" : "grayscale(1) opacity(.4)",
                  }}>⭐</button>
              ))}
            </div>
            {stars>0 && <p style={{ textAlign:"center", fontSize:12, color:"#888",
              marginBottom:14 }}>
              {["","😤 Molto male","😕 Migliorabile","😐 Nella media",
                "😊 Bene!","🔥 Ottimo!"][stars]}
            </p>}

            {/* Categoria */}
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
              {cats.map(c=>(
                <button key={c.id} onClick={()=>{setCategory(c.id);if(navigator.vibrate)navigator.vibrate(30);}}
                  style={{ background: category===c.id ? "#E1060022" : "#242424",
                    border: `1px solid ${category===c.id?"#E10600":"#2d2d2d"}`,
                    borderRadius:20, padding:"6px 12px", fontSize:11, fontWeight:600,
                    color: category===c.id ? "#E10600" : "#888", cursor:"pointer" }}>
                  {c.label}
                </button>
              ))}
            </div>

            {/* Messaggio */}
            <textarea
              placeholder="Scrivi qui (opzionale)… cosa ti piace? Cosa manca?"
              value={msg} onChange={e=>setMsg(e.target.value)} rows={3}
              style={{ width:"100%", background:"#242424", border:"1px solid #2d2d2d",
                borderRadius:10, padding:"11px 13px", color:"#fff", fontSize:13,
                outline:"none", resize:"none", fontFamily:"inherit", marginBottom:14 }}
            />

            <button onClick={send} disabled={!stars||sending} style={{
              width:"100%", background: stars ? "#E10600" : "#333",
              border:"none", borderRadius:12, padding:14, color: stars ? "#fff" : "#666",
              fontWeight:900, fontStyle:"italic", fontSize:14,
              cursor: stars ? "pointer" : "default", transition:"all .3s",
            }}>
              {sending ? "Invio…" : "INVIA FEEDBACK"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ── Floating Feedback Button
// adOffset: stessa quota che ricevre la Nav quando il banner AdMob nativo è
// attivo, così il tasto resta sempre sopra la Nav e non ci finisce dentro.
const FeedbackFAB = ({ onClick, adOffset=0 }) => (
  <button onClick={onClick} style={{
    position:"fixed", bottom:`calc(${76+adOffset}px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))`, right:16, width:44, height:44,
    borderRadius:"50%", background:"#E10600",
    boxShadow:"0 4px 16px rgba(225,6,0,.5)",
    border:"none", cursor:"pointer", fontSize:18, zIndex:100,
    display:"flex", alignItems:"center", justifyContent:"center",
    transition:"transform .15s",
  }}
  onMouseDown={e=>{e.currentTarget.style.transform="scale(.9)";if(navigator.vibrate)navigator.vibrate(30);}}
  onMouseUp={e=>{e.currentTarget.style.transform="scale(1)";}}>
    💬
  </button>
);

// ── ADMIN NOTIFICATIONS ──
const AdminNotifications=({notifs,setNotifs})=>{
  const [title,setTitle]=useState("");
  const [text,setText]=useState("");
  const [sent,setSent]=useState(false);
  const send=async()=>{
    if(!title.trim()||!text.trim())return;
    const n={id:uid(),title:title.trim(),text:text.trim(),date:new Date().toISOString(),read:false};
    const updated=[...notifs,n];
    setNotifs(updated);
    await ss("bt-notifs",updated,true);
    setTitle("");setText("");setSent(true);
    setTimeout(()=>setSent(false),2500);
  };
  const del=async(id)=>{const u=notifs.filter(x=>x.id!==id);setNotifs(u);await ss("bt-notifs",u,true);};
  return(
    <div>
      <div style={{color:A.red,fontWeight:900,fontStyle:"italic",fontSize:13,margin:"18px 0 12px"}}>INVIA NOTIFICA</div>
      <div style={{background:A.card,borderRadius:14,padding:16,marginBottom:18,display:"flex",flexDirection:"column",gap:10}}>
        <Inp ph="Titolo della notifica" val={title} chg={e=>setTitle(e.target.value)}/>
        <Inp ph="Testo del messaggio…" val={text} chg={e=>setText(e.target.value)} rows={3}/>
        {sent&&<div style={{background:"#00C85018",border:"1px solid #00C850",borderRadius:10,padding:"9px 14px",color:"#00C850",fontSize:13,textAlign:"center"}}>✅ Notifica inviata a tutti gli utenti!</div>}
        <Btn ch={<><Send size={15}/> INVIA NOTIFICA ORA</>} onClick={send} dis={!title.trim()||!text.trim()}/>
      </div>
      <div style={{color:A.red,fontWeight:900,fontStyle:"italic",fontSize:13,marginBottom:12}}>NOTIFICHE INVIATE ({notifs.length})</div>
      {notifs.length===0&&<p style={{color:A.muted,fontSize:13,textAlign:"center",padding:"20px 0"}}>Nessuna notifica inviata ancora.</p>}
      {[...notifs].reverse().map(n=>(
        <div key={n.id} style={{background:A.card,borderRadius:12,padding:"13px 15px",marginBottom:9,display:"flex",gap:12,alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontWeight:800,fontSize:14,color:A.text}}>{n.title}</span>
              <span style={{fontSize:10,color:A.dim}}>{new Date(n.date).toLocaleString("it-IT",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
            </div>
            <p style={{fontSize:13,color:A.muted,margin:0,lineHeight:1.5}}>{n.text}</p>
          </div>
          <button onClick={()=>del(n.id)} style={{background:"none",border:"none",cursor:"pointer",flexShrink:0}}><Trash2 size={15} color={A.dim}/></button>
        </div>
      ))}
    </div>
  );
};

// ── MODERAZIONE CHAT (pannello admin → CHAT) ──
// Segnalazioni degli utenti, sospensioni e ultimi messaggi di ogni stanza:
// Google Play chiede che un moderatore possa intervenire sui contenuti degli utenti.
const AdminChatModeration=()=>{
  const [reps,setReps]=useState(null);
  const [banned,setBanned]=useState([]);
  const [roomK,setRoomK]=useState("generale");
  // Elenco e stanza insieme: così "ELIMINA" agisce sempre sulla stanza dei messaggi mostrati.
  const [recent,setRecent]=useState({room:"generale",list:[]});
  const reqN=useRef(0);
  const [note,setNote]=useState("");
  const roomOf=k=>CHAT_ROOMS.find(r=>r.key===k);
  const loadRecent=async k=>{const n=++reqN.current;const d=(await sg(roomOf(k).dbKey,true))||[];if(n===reqN.current)setRecent({room:k,list:d.slice(-30).reverse()});};
  const load=async()=>{
    setReps(((await sg(CHAT_REPORTS_KEY,true))||[]).slice().sort((a,b)=>b.t-a.t));
    setBanned((await sg(CHAT_BANNED_KEY,true))||[]);
    await loadRecent(roomK);
  };
  useEffect(()=>{load();},[]);
  const say=t=>{setNote(t);setTimeout(()=>setNote(""),3500);};
  const act=async fn=>{try{await fn();}catch(e){console.error("moderazione:",e);say("Operazione non riuscita: controlla la connessione e riprova.");}};
  // Operazioni atomiche: non si perdono segnalazioni o messaggi arrivati nel frattempo.
  const removeReports=async drop=>{await sharedRemoveWhere(CHAT_REPORTS_KEY,drop);setReps(((await sg(CHAT_REPORTS_KEY,true))||[]).slice().sort((a,b)=>b.t-a.t));};
  const delMsg=(roomKey,msgId)=>act(async()=>{
    const r=roomOf(roomKey);
    if(r)await sharedRemoveWhere(r.dbKey,m=>m.id===msgId);
    await removeReports(x=>x.msgId===msgId);
    await loadRecent(roomK);
    say("Messaggio eliminato.");
  });
  // Serve l'ID autore: per i messaggi vecchi lo ricaviamo dal nome solo se è di un solo utente.
  const suspend=(name,aid)=>act(async()=>{
    let id=aid;
    if(!id){const em=await emailsWithName(name);if(em.length===1)id=authorId(em[0]);}
    if(!id){say(`Non riesco a identificare con certezza ${name} (messaggio vecchio o nome usato da più utenti): sospendilo da un suo messaggio più recente.`);return;}
    const b=(await sg(CHAT_BANNED_KEY,true))||[];
    if(!b.some(x=>x.aid===id))await sharedAppend(CHAT_BANNED_KEY,{aid:id,name,t:Date.now()});
    setBanned((await sg(CHAT_BANNED_KEY,true))||[]);
    say(`${name} non può più scrivere in chat.`);
  });
  const unban=x=>act(async()=>{await sharedRemoveWhere(CHAT_BANNED_KEY,y=>y.name===x.name&&(y.aid||"")===(x.aid||""));setBanned((await sg(CHAT_BANNED_KEY,true))||[]);say(`${x.name} può di nuovo scrivere.`);});
  const card={background:A.card,borderRadius:14,padding:14,marginBottom:10};
  const small=(bg,col)=>({background:bg,color:col,border:bg==="transparent"?`1px solid ${A.border}`:"none",borderRadius:8,padding:"7px 11px",fontSize:11,fontWeight:800,cursor:"pointer"});
  const title={color:A.red,fontWeight:900,fontStyle:"italic",fontSize:13,margin:"16px 0 12px"};
  return(<div>
    {note&&<div style={{...card,background:A.card2,fontSize:12,color:A.text,textAlign:"center"}}>{note}</div>}
    <div style={title}>SEGNALAZIONI{reps&&reps.length?` (${reps.length})`:""}</div>
    {reps===null&&<div style={{color:A.muted,fontSize:12}}>Caricamento…</div>}
    {reps&&reps.length===0&&<div style={{...card,color:A.muted,fontSize:12}}>Nessuna segnalazione da controllare.</div>}
    {reps&&reps.map(r=><div key={r.id} style={card}>
      <div style={{fontSize:11,color:A.muted,marginBottom:6}}>{(roomOf(r.room)||{label:r.room}).label} · scritto da <b style={{color:A.text}}>{r.author}</b></div>
      <div style={{fontSize:13,color:A.text,marginBottom:6}}>“{r.txt}”</div>
      <div style={{fontSize:10,color:A.dim,marginBottom:10}}>Segnalato da {r.by} · {fmt(new Date(r.t).toISOString())}</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={()=>delMsg(r.room,r.msgId)} style={small(A.red,"#fff")}>ELIMINA MESSAGGIO</button>
        <button onClick={()=>suspend(r.author,r.aid)} style={small(A.card2,A.text)}>SOSPENDI {r.author}</button>
        <button onClick={()=>act(()=>removeReports(x=>x.id===r.id))} style={small("transparent",A.muted)}>IGNORA</button>
      </div>
    </div>)}
    <div style={title}>UTENTI SOSPESI</div>
    {banned.length===0?<div style={{...card,color:A.muted,fontSize:12}}>Nessun utente sospeso.</div>:banned.map(x=><div key={(x.aid||"")+x.name} style={{...card,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <span style={{fontSize:13,color:A.text}}>{x.name}</span>
      <button onClick={()=>unban(x)} style={small("transparent",A.muted)}>RIATTIVA</button>
    </div>)}
    <div style={title}>ULTIMI MESSAGGI</div>
    <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10}}>{CHAT_ROOMS.map(r=><button key={r.key} onClick={()=>{setRoomK(r.key);loadRecent(r.key);}} style={{background:r.key===roomK?A.red:A.card,color:r.key===roomK?"#fff":A.muted,border:"none",borderRadius:20,padding:"6px 12px",fontSize:10,fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"}}>{r.label}</button>)}</div>
    {recent.room!==roomK?<div style={{...card,color:A.muted,fontSize:12}}>Caricamento…</div>:recent.list.length===0?<div style={{...card,color:A.muted,fontSize:12}}>Nessun messaggio in questa stanza.</div>:recent.list.map(m=><div key={m.id} style={{...card,display:"flex",gap:10,alignItems:"flex-start"}}>
      <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,color:A.muted,marginBottom:3}}>{m.user} · {chatRelTime(m.t)}</div><div style={{fontSize:13,color:A.text,wordBreak:"break-word"}}>{m.txt}</div></div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        <button onClick={()=>delMsg(recent.room,m.id)} style={small(A.red,"#fff")}>ELIMINA</button>
        <button onClick={()=>suspend(m.user,m.aid)} style={small(A.card2,A.text)}>SOSPENDI</button>
      </div>
    </div>)}
  </div>);
};

// ADMIN PANEL (compact)
const AdminPanel=({news,setNews,fanta,setFanta,piloti,setPiloti,costruttori,setCostruttori,races,setRaces,ig,setIg,notifs,setNotifs,onClose})=>{
  const [tab,setTab]=useState("NEWS");
  const [f,setF]=useState({title:"",summary:"",category:"NEWS",author:"Team B&T",image:"",content:"",published:true});
  const [imgUploading,setImgUploading]=useState(false);const [imgErr,setImgErr]=useState("");
  const onPickImage=async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;setImgErr("");setImgUploading(true);try{const url=await uploadImage(file);setF(p=>({...p,image:url}));}catch(err){console.error("uploadImage error:",err);const c=err&&err.code;setImgErr(c==="timeout"?"La foto non è stata caricata: connessione assente o troppo lenta, riprova.":c==="formato"?"Formato non supportato: scegli una foto JPG o PNG.":c==="troppo-grande"?"Foto troppo pesante anche dopo la compressione: scegline un'altra.":"Upload non riuscito, riprova.");}setImgUploading(false);};
  const [genLoading,setGenLoading]=useState(false);const [genErr,setGenErr]=useState("");
  const genArticle=async()=>{if(!f.title){setGenErr("Scrivi prima un titolo");return;}setGenErr("");setGenLoading(true);try{const r=await fetch(`${FUNCTIONS_BASE}/generateArticle`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:f.title,summary:f.summary,category:f.category})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Errore ChatGPT");setF(p=>({...p,content:d.content||""}));}catch(err){console.error("genArticle error:",err);setGenErr("ChatGPT non ha risposto, riprova");}setGenLoading(false);};
  const saveN=async u=>{setNews(u);await ss("bt-news",u);};const addN=async()=>{if(!f.title)return;await saveN([{...f,id:uid(),date:new Date().toISOString()},...news]);setF({title:"",summary:"",category:"NEWS",author:"Team B&T",image:"",content:"",published:true});setCustomCat(false);};
  const [nff,setNff]=useState({name:"",team:""});const saveF=async u=>{setFanta(u);await ss("bt-fanta-pilots",u);};const addF=async()=>{if(!nff.name)return;await saveF([...fanta,{...nff,id:uid(),price:10,points:0}]);setNff({name:"",team:""});};
  const [pT,setPT]=useState("PILOTI");const pD=pT==="PILOTI"?piloti:costruttori;const setPD=pT==="PILOTI"?setPiloti:setCostruttori;const pK=pT==="PILOTI"?"bt-piloti":"bt-costruttori";
  const [pf,setPf]=useState({name:"",team:""});const savePD=async u=>{setPD(u);await ss(pK,u);};const addPD=async()=>{if(!pf.name)return;await savePD([...pD,{id:uid(),name:pf.name,team:pf.team,position:pD.length+1,points:0}]);setPf({name:"",team:""});};
  const [gf,setGf]=useState({name:"",circuit:"",country:"",round:"",date:""});const saveR=async u=>{setRaces(u);await ss("bt-races",u);};const addR=async()=>{if(!gf.name)return;await saveR([...races,{...gf,id:uid(),status:"IN ARRIVO",totalLaps:57}]);setGf({name:"",circuit:"",country:"",round:"",date:""});};
  const [igF,setIgF]=useState(ig);const saveIg=async()=>{setIg(igF);await ss("bt-ig-config",igF);};
  const cats=FREE_CATEGORIES;
  const [customCat,setCustomCat]=useState(!cats.includes(f.category));
  return(<div style={{minHeight:"100vh",background:A.bg,paddingBottom:40}}>
    <div style={{padding:"16px 16px 0",paddingTop:"calc(16px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))"}}>
      <button onClick={onClose} style={{background:A.card2,border:"none",borderRadius:10,color:A.muted,cursor:"pointer",display:"flex",alignItems:"center",gap:6,marginBottom:16,fontSize:13,padding:"9px 14px"}}><ArrowLeft size={16}/> Esci</button>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><Shield size={20} color={A.red}/><h1 style={{fontWeight:900,fontStyle:"italic",fontSize:21,color:A.text}}>PANNELLO ADMIN</h1></div>
      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:12}}>
        {["NEWS","FANTA F1","CLASSIFICHE","GARA LIVE","INSTAGRAM","NOTIFICHE","CHAT"].map(t=><button key={t} onClick={()=>setTab(t)} style={{background:tab===t?A.red:A.card,color:tab===t?"#fff":A.muted,border:"none",borderRadius:20,padding:"7px 15px",fontSize:11,fontWeight:800,fontStyle:"italic",cursor:"pointer",whiteSpace:"nowrap"}}>{t}</button>)}
      </div>
    </div>
    <div style={{padding:"0 16px 80px"}}>
      {tab==="NEWS"&&<div><div style={{color:A.red,fontWeight:900,fontStyle:"italic",fontSize:13,margin:"16px 0 12px"}}>NUOVO ARTICOLO</div><div style={{background:A.card,borderRadius:14,padding:14,marginBottom:16,display:"flex",flexDirection:"column",gap:9}}><Inp ph="Titolo" val={f.title} chg={e=>setF(p=>({...p,title:e.target.value}))}/><Inp ph="Sottotitolo" val={f.summary} chg={e=>setF(p=>({...p,summary:e.target.value}))}/><div style={{display:"flex",gap:8}}><select value={customCat?"__custom__":f.category} onChange={e=>{if(e.target.value==="__custom__"){setCustomCat(true);setF(p=>({...p,category:""}));}else{setCustomCat(false);setF(p=>({...p,category:e.target.value}));}}} style={{flex:1,background:A.card,border:`1px solid ${A.border}`,borderRadius:10,padding:"11px 13px",color:A.text,fontSize:13,outline:"none"}}>{cats.map(c=><option key={c} value={c}>{c}</option>)}<option value="__custom__">Altra categoria (Premium)…</option></select><Inp ph="Autore" val={f.author} chg={e=>setF(p=>({...p,author:e.target.value}))} s={{flex:1}}/></div>{customCat&&<Inp ph="Nome nuova categoria (sarà Premium)" val={f.category} chg={e=>setF(p=>({...p,category:e.target.value}))}/>}<div style={{display:"flex",flexDirection:"column",gap:6}}><div style={{display:"flex",gap:8}}><input type="file" accept="image/*" id="news-img-input" onChange={onPickImage} style={{display:"none"}}/><label htmlFor="news-img-input" style={{flex:1,background:A.card2,border:`1px solid ${A.border}`,borderRadius:10,padding:"11px 13px",color:A.text,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><ImagePlus size={15}/> {imgUploading?"Caricamento…":f.image?"Immagine caricata ✓":"Allega immagine"}</label><button onClick={genArticle} disabled={genLoading} style={{background:A.card2,border:`1px solid ${A.border}`,borderRadius:10,padding:"11px 14px",color:A.text,fontSize:13,cursor:genLoading?"default":"pointer",display:"flex",alignItems:"center",gap:6,opacity:genLoading?.6:1,whiteSpace:"nowrap"}}><Sparkles size={15}/> {genLoading?"Scrivo…":"ChatGPT"}</button></div>{f.image&&<NewsPhoto src={f.image} minH={90} maxH={240} style={{borderRadius:8,overflow:"hidden"}}/>}{(imgErr||genErr)&&<div style={{color:A.red,fontSize:11}}>{imgErr||genErr}</div>}</div><Inp ph="Contenuto" val={f.content} chg={e=>setF(p=>({...p,content:e.target.value}))} rows={4}/><div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:13,color:A.text,fontWeight:700}}>PUBBLICATO</span><Tg v={f.published} chg={v=>setF(p=>({...p,published:v}))}/></div><Btn ch="PUBBLICA" onClick={addN}/></div>{news.map(n=><div key={n.id} style={{background:A.card,borderRadius:12,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}><div style={{flex:1}}><Tag ch={n.category} s={{fontSize:9,marginRight:8}}/><span style={{fontSize:13,color:n.published?A.text:A.muted,fontWeight:600}}>{n.title}</span>{!n.published&&<span style={{fontSize:10,color:A.dim}}> (bozza)</span>}<div style={{fontSize:11,color:A.dim,marginTop:3}}>{fmt(n.date)}</div></div><button onClick={()=>saveN(news.filter(x=>x.id!==n.id)).then(()=>dropNewsImage(n.image,news.some(x=>x.id!==n.id&&x.image===n.image)))} style={{background:"none",border:"none",cursor:"pointer",paddingLeft:8}}><Trash2 size={16} color={A.dim}/></button></div>)}</div>}
      {tab==="FANTA F1"&&<div><div style={{color:A.red,fontWeight:900,fontStyle:"italic",fontSize:13,margin:"16px 0 12px"}}>PILOTI — PREZZI (M) E PUNTI</div><div style={{background:A.card,borderRadius:14,padding:12,marginBottom:14,display:"flex",gap:8}}><Inp ph="Nome" val={nff.name} chg={e=>setNff(p=>({...p,name:e.target.value}))} s={{flex:1}}/><Inp ph="Team" val={nff.team} chg={e=>setNff(p=>({...p,team:e.target.value}))} s={{flex:1}}/><button onClick={addF} style={{background:A.red,border:"none",borderRadius:10,padding:"0 14px",color:"#fff",fontWeight:800,fontSize:12,cursor:"pointer"}}>AGGIUNGI</button></div>{fanta.map(p=><div key={p.id} style={{background:A.card,borderRadius:12,padding:"12px 14px",marginBottom:8}}><div style={{marginBottom:8}}><span style={{fontWeight:700,fontSize:13,color:A.text}}>{p.name}</span><span style={{fontSize:11,color:A.muted,marginLeft:8}}>{p.team}</span></div><div style={{display:"flex",gap:7,alignItems:"center"}}><input type="number" step=".1" value={p.price} onChange={e=>setFanta(ps=>ps.map(x=>x.id===p.id?{...x,price:parseFloat(e.target.value)}:x))} style={{flex:1,background:A.card2,border:`1px solid ${A.border}`,borderRadius:8,padding:"8px",color:A.text,fontSize:13,outline:"none"}}/><input type="number" value={p.points} onChange={e=>setFanta(ps=>ps.map(x=>x.id===p.id?{...x,points:parseInt(e.target.value)}:x))} style={{flex:1,background:A.card2,border:`1px solid ${A.border}`,borderRadius:8,padding:"8px",color:A.text,fontSize:13,outline:"none"}}/><button onClick={async()=>await saveF(fanta)} style={{background:A.red,border:"none",borderRadius:8,padding:"8px 12px",color:"#fff",fontWeight:800,fontSize:12,cursor:"pointer"}}>SALVA</button><button onClick={()=>saveF(fanta.filter(x=>x.id!==p.id))} style={{background:"none",border:"none",cursor:"pointer"}}><Trash2 size={16} color={A.dim}/></button></div></div>)}</div>}
      {tab==="CLASSIFICHE"&&<div><div style={{display:"flex",gap:8,margin:"16px 0 14px"}}>{["PILOTI","COSTRUTTORI"].map(t=><button key={t} onClick={()=>setPT(t)} style={{background:t===pT?A.red:A.card,color:t===pT?"#fff":A.muted,border:"none",borderRadius:20,padding:"7px 16px",fontSize:11,fontWeight:800,cursor:"pointer"}}>{t}</button>)}</div><div style={{background:A.card,borderRadius:14,padding:12,marginBottom:14,display:"flex",gap:8,flexWrap:"wrap"}}><Inp ph="Nome" val={pf.name} chg={e=>setPf(p=>({...p,name:e.target.value}))} s={{flex:1,minWidth:120}}/>{pT==="PILOTI"&&<Inp ph="Team" val={pf.team} chg={e=>setPf(p=>({...p,team:e.target.value}))} s={{flex:1,minWidth:100}}/>}<button onClick={addPD} style={{background:A.red,border:"none",borderRadius:10,padding:"0 14px",color:"#fff",fontWeight:800,fontSize:12,cursor:"pointer"}}>AGGIUNGI</button></div>{pD.map(it=><div key={it.id} style={{background:A.card,borderRadius:12,padding:"12px 14px",marginBottom:8}}><div style={{marginBottom:8}}><span style={{fontWeight:700,fontSize:13,color:A.text}}>{it.name}</span>{it.team&&<span style={{fontSize:11,color:A.muted,marginLeft:8}}>{it.team}</span>}</div><div style={{display:"flex",gap:7,alignItems:"center"}}><input type="number" value={it.position} onChange={e=>setPD(d=>d.map(x=>x.id===it.id?{...x,position:parseInt(e.target.value)}:x))} style={{width:54,background:A.card2,border:`1px solid ${A.border}`,borderRadius:8,padding:"8px",color:A.text,fontSize:13,outline:"none",textAlign:"center"}}/><input type="number" value={it.points} onChange={e=>setPD(d=>d.map(x=>x.id===it.id?{...x,points:parseInt(e.target.value)}:x))} style={{flex:1,background:A.card2,border:`1px solid ${A.border}`,borderRadius:8,padding:"8px",color:A.text,fontSize:13,outline:"none"}}/><button onClick={async()=>await savePD(pD)} style={{background:A.red,border:"none",borderRadius:8,padding:"8px 12px",color:"#fff",fontWeight:800,fontSize:12,cursor:"pointer"}}>SALVA</button><button onClick={()=>savePD(pD.filter(x=>x.id!==it.id))} style={{background:"none",border:"none",cursor:"pointer"}}><Trash2 size={16} color={A.dim}/></button></div></div>)}</div>}
      {tab==="GARA LIVE"&&<div><div style={{color:A.red,fontWeight:900,fontStyle:"italic",fontSize:13,margin:"16px 0 12px"}}>GARE</div><div style={{background:A.card,borderRadius:14,padding:13,marginBottom:14,display:"flex",flexDirection:"column",gap:8}}><div style={{display:"flex",gap:8}}><Inp ph="Nome GP" val={gf.name} chg={e=>setGf(p=>({...p,name:e.target.value}))} s={{flex:1}}/><Inp ph="Circuito" val={gf.circuit} chg={e=>setGf(p=>({...p,circuit:e.target.value}))} s={{flex:1}}/></div><div style={{display:"flex",gap:8}}><Inp ph="Paese" val={gf.country} chg={e=>setGf(p=>({...p,country:e.target.value}))} s={{flex:1}}/><Inp ph="Round #" val={gf.round} chg={e=>setGf(p=>({...p,round:e.target.value}))} s={{flex:1}}/></div><input type="datetime-local" value={gf.date} onChange={e=>setGf(p=>({...p,date:e.target.value}))} style={{background:A.card,border:`1px solid ${A.border}`,borderRadius:10,padding:"11px 13px",color:A.text,fontSize:13,outline:"none",width:"100%"}}/><Btn ch="AGGIUNGI GARA" onClick={addR}/></div>{races.map(r=><div key={r.id} style={{background:A.card,borderRadius:12,padding:"13px 16px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontWeight:700,fontSize:14,color:A.text}}>{r.name}</div><div style={{fontSize:11,color:A.muted}}>{r.circuit} · {r.date?new Date(r.date).toLocaleString("it-IT"):"-"}</div></div><div style={{display:"flex",gap:8,alignItems:"center"}}><select value={r.status} onChange={e=>saveR(races.map(x=>x.id===r.id?{...x,status:e.target.value}:x))} style={{background:r.status==="LIVE"?A.red:A.card2,border:`1px solid ${A.border}`,borderRadius:8,padding:"6px 10px",color:"#fff",fontSize:11,fontWeight:700,outline:"none",cursor:"pointer"}}>{["IN ARRIVO","LIVE","CONCLUSA"].map(s=><option key={s} style={{background:A.card,color:A.text}}>{s}</option>)}</select><button onClick={()=>saveR(races.filter(x=>x.id!==r.id))} style={{background:"none",border:"none",cursor:"pointer"}}><Trash2 size={16} color={A.dim}/></button></div></div>)}</div>}
      {tab==="NOTIFICHE"&&<AdminNotifications notifs={notifs} setNotifs={setNotifs}/>}
      {tab==="CHAT"&&<AdminChatModeration/>}
      {tab==="INSTAGRAM"&&<div><div style={{color:A.red,fontWeight:900,fontStyle:"italic",fontSize:13,margin:"16px 0 12px"}}>FOLLOWER</div><div style={{background:A.card,borderRadius:14,padding:14,marginBottom:16}}><div style={{display:"flex",gap:8}}><input type="number" value={igF.followers} onChange={e=>setIgF(c=>({...c,followers:parseInt(e.target.value)||0}))} style={{flex:1,background:A.card2,border:`1px solid ${A.border}`,borderRadius:10,padding:"11px 13px",color:A.text,fontSize:14,outline:"none"}}/><button onClick={saveIg} style={{background:A.red,border:"none",borderRadius:10,padding:"0 16px",color:"#fff",fontWeight:800,fontSize:12,cursor:"pointer"}}>SALVA</button></div></div><div style={{color:A.red,fontWeight:900,fontStyle:"italic",fontSize:13,marginBottom:12}}>VIDEO VIRALI</div>{igF.videos.map((v,i)=><div key={v.id} style={{background:A.card,borderRadius:14,padding:14,marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><span style={{fontWeight:700,color:A.muted,fontSize:12}}>Video {i+1}</span><button onClick={()=>setIgF(c=>({...c,videos:c.videos.filter(x=>x.id!==v.id)}))} style={{background:"none",border:"none",cursor:"pointer"}}><Trash2 size={15} color={A.dim}/></button></div><div style={{display:"flex",flexDirection:"column",gap:8}}><Inp ph="Titolo" val={v.title} chg={e=>setIgF(c=>({...c,videos:c.videos.map(x=>x.id===v.id?{...x,title:e.target.value}:x)}))}/><Inp ph="URL thumbnail" val={v.thumbnail} chg={e=>setIgF(c=>({...c,videos:c.videos.map(x=>x.id===v.id?{...x,thumbnail:e.target.value}:x)}))}/><div style={{display:"flex",gap:8}}><Inp ph="Views" val={v.views} chg={e=>setIgF(c=>({...c,videos:c.videos.map(x=>x.id===v.id?{...x,views:e.target.value}:x)}))} s={{flex:1}}/><Inp ph="Likes" val={v.likes} chg={e=>setIgF(c=>({...c,videos:c.videos.map(x=>x.id===v.id?{...x,likes:e.target.value}:x)}))} s={{flex:1}}/></div></div></div>)}<button onClick={()=>setIgF(c=>({...c,videos:[...c.videos,{id:uid(),title:"",thumbnail:"",views:"0",likes:"0",url:"https://www.instagram.com/bt_formula1/"}]}))} style={{width:"100%",background:A.card,border:`1.5px dashed ${A.border}`,borderRadius:12,padding:13,color:A.muted,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:14}}><Plus size={15}/> Aggiungi Video</button><Btn ch={<><Save size={15}/> SALVA TUTTO</>} onClick={saveIg}/></div>}
    </div>
  </div>);
};

// ══ MAIN APP ══
export default function BTApp(){
  const [user,setUser]=useState(null);const [loading,setLoading]=useState(true);
  const [page,setPage]=useState("home");const [selN,setSelN]=useState(null);
  const [keypad,setKeypad]=useState(false);const [admin,setAdmin]=useState(false);
  const [auth,setAuth]=useState(false);
  const [showAd,setShowAd]=useState(false);const [adTgt,setAdTgt]=useState(null);
  const [prem,setPrem]=useState(false);const [unl,setUnl]=useState(new Set());
  const [notif,setNotif]=useState({news:true,live:true,fanta:true});
  const [notifs,setNotifs]=useState([]);
  const [showNotifs,setShowNotifs]=useState(false);
  const [readIds,setReadIds]=useState(new Set());
  // Onboarding & UX
  const [showSplash,setShowSplash]=useState(true);
  const [showTerms,setShowTerms]=useState(false);
  const [showTermsReview,setShowTermsReview]=useState(false);
  // Altezza del banner AdMob nativo, per alzare le schede in basso sopra il banner.
  const [bannerH,setBannerH]=useState(bannerBus.h);
  useEffect(()=>{bannerBus.subs.add(setBannerH);return()=>{bannerBus.subs.delete(setBannerH);};},[]);
  const [showFeedback,setShowFeedback]=useState(false);
  const [termsAccepted,setTermsAccepted]=useState(false);
  const [news,setNews]=useState(D_NEWS);const [piloti,setPiloti]=useState(D_PILOTI);
  const [costr,setCostr]=useState(D_COSTR);const [fanta,setFanta]=useState(D_FANTA);
  const [races,setRaces]=useState(D_RACES);const [ig,setIg]=useState(D_IG);

  useEffect(()=>{(async()=>{try{const sess=await dbGet("sessions","current");if(sess){const u=await dbGet("users",sess.email);if(u)setUser(u);}const shared=[["bt-news",setNews],["bt-piloti",setPiloti],["bt-costruttori",setCostr],["bt-fanta-pilots",setFanta],["bt-races",setRaces],["bt-ig-config",setIg],["bt-notifs",setNotifs]];await Promise.all(shared.map(async([k,s])=>{const d=await sg(k,true);if(d)s(d);}));}catch{}setLoading(false);})();},[]);

  // Termini e Condizioni: mostrati una sola volta a persona (salvati sul dispositivo).
  // Il consenso per la pubblicità lo chiede il messaggio certificato di Google (vedi
  // admobReady): il vecchio banner cookie salvava solo una scelta senza effetti, tolto.
  useEffect(()=>{(async()=>{
    const t=await sg("bt-terms-accepted",false);
    if(t)setTermsAccepted(true);else setShowTerms(true);
  })();},[]);

  const doLogin=u=>{setUser(u);setAuth(false);};
  const doLogout=async()=>{await dbDelete("sessions","current");setUser(null);setPrem(false);setUnl(new Set());};
  // Elimina account (richiesto da Google Play): profilo, messaggi in chat, segnalazioni,
  // sospensioni, feedback, codice di reset e dati salvati sul telefono. Se un passaggio
  // fallisce (rete assente) ci fermiamo PRIMA di eliminare il profilo e l'utente riprova.
  const doDelete=async()=>{
    const u=user;if(!u)return;
    const work=async()=>{
      const aid=authorId(u.email);
      // I messaggi vecchi non hanno l'ID autore: sono suoi solo se nessun altro ha lo stesso nome.
      const nameUnique=!!u.name&&(await emailsWithName(u.name)).length<=1;
      const byName=n=>nameUnique&&n===u.name;
      const mine=m=>!!m&&(m.aid?m.aid===aid:byName(m.user));
      for(const k of [...CHAT_ROOMS.map(r=>r.dbKey),"bt-chat"])await sharedRemoveWhere(k,mine);
      await sharedRemoveWhere(CHAT_REPORTS_KEY,r=>r.byAid===aid||r.aid===aid||(!r.aid&&byName(r.author)));
      await sharedRemoveWhere(CHAT_BANNED_KEY,b=>b.aid?b.aid===aid:byName(b.name));
      await deleteUserFeedback(u.email);
      await dbDelete("resets",u.email);
      await dbDelete("users",u.email);
    };
    await Promise.race([work(),new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),20000))]);
    await dbDelete("sessions","current");
    local.del(BLOCKED_KEY);
    setUser(null);setPrem(false);setUnl(new Set());
  };
  const unreadCount=notifs.filter(n=>!readIds.has(n.id)).length;
  const markAllRead=()=>{const ids=new Set(notifs.map(n=>n.id));setReadIds(ids);};
  const openNotifs=()=>{
    setShowNotifs(true);
  };
  const closeNotifs=()=>{setShowNotifs(false);markAllRead();};
  const [showPremium,setShowPremium]=useState(false);

  // Il pagamento vero avviene su Stripe Checkout (aperto da PremiumModal) e viene
  // confermato dal webhook lato server, che scrive isPremium=true su Firestore.
  // Qui ci limitiamo a riallineare lo stato locale con quello (ormai vero) del server —
  // non impostiamo mai isPremium noi stessi, altrimenti basterebbe toccare un bottone
  // per avere Premium gratis.
  const upgradeToPremium=async(freshUser)=>{
    if(freshUser){
      setUser(freshUser);
      await dbSet("sessions","current",{email:freshUser.email,name:freshUser.name,nick:freshUser.nick,isPremium:!!freshUser.isPremium});
      setPrem(!!freshUser.isPremium);
    }
    setShowPremium(false);
  };

  const downgradeFree=async()=>{
    if(user){
      // Disdice davvero l'abbonamento Stripe, altrimenti l'utente continuerebbe
      // a essere addebitato anche dopo aver premuto "disdici" nell'app.
      try{
        await fetch(`${FUNCTIONS_BASE}/cancelSubscription`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:user.email})});
      }catch{}
      const updUser={...user,isPremium:false,plan:"free"};
      await dbSet("users",user.email,updUser);
      await dbSet("sessions","current",{email:user.email,name:user.name,nick:user.nick,isPremium:false});
      setUser(updUser);
    }
    setPrem(false);
  };

  const acceptTerms=async()=>{
    await ss("bt-terms-accepted",{ts:Date.now()},false);
    setTermsAccepted(true);setShowTerms(false);
  };

  const doAd=f=>{setAdTgt(f);setShowAd(true);};
  const adDone=()=>{if(adTgt)setUnl(p=>new Set([...p,adTgt]));setShowAd(false);setAdTgt(null);};
  const needAuth=()=>setAuth(true);

  if(loading)return(<div style={{minHeight:"100vh",background:A.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14}}><div style={{background:A.red,borderRadius:16,padding:"18px 24px",boxShadow:`0 0 50px ${A.red}55`,display:"flex",alignItems:"center",justifyContent:"center"}}><img src={LOGO} alt="B&T" style={{height:38,filter:"brightness(0) invert(1)"}}/></div><p style={{color:A.dim,fontSize:13}}>Caricamento…</p></div>);
  if(keypad)return <AdminKeypad onOk={()=>{setKeypad(false);setAdmin(true);}} onCancel={()=>setKeypad(false)}/>;
  if(admin)return <AdminPanel news={news} setNews={setNews} fanta={fanta} setFanta={setFanta} piloti={piloti} setPiloti={setPiloti} costruttori={costr} setCostruttori={setCostr} races={races} setRaces={setRaces} ig={ig} setIg={setIg} notifs={notifs} setNotifs={setNotifs} onClose={()=>setAdmin(false)}/>;

  const navigateTo = (p) => {
    setPage(p);
  };
  const isPr=page==="profile";const isND=page==="news-detail";
  // Il banner AdMob nativo è disegnato da Android in fondo allo schermo (Home e RACE):
  // quando c'è, schede e contenuti salgono della sua altezza vera più un distacco,
  // così il banner non copre mai i pulsanti e non viene cliccato per sbaglio.
  const adSpace=bannerH>0?bannerH+AD_GAP:0;
  // Il banner nativo è disegnato da Android sopra l'app, finestre comprese: lo togliamo
  // durante il caricamento (AdMob vieta annunci sulle schermate di caricamento), i Termini
  // e ogni finestra aperta, altrimenti coprirebbe i loro pulsanti (clic accidentali).
  const adsPaused=showSplash||(showTerms&&!termsAccepted)||showTermsReview||auth||showPremium||showFeedback||showNotifs||showAd;
  // Funzioni Premium: aperte a tutti finché gli abbonamenti sono spenti. Le pubblicità
  // seguono solo l'abbonamento pagato (prem), quindi restano anche nel periodo gratis.
  const premAll=PREMIUM_FREE_FOR_ALL||prem;
  const renderP=()=>{
    if(isPr)return <ProfilePage user={user} onLogout={doLogout} onDelete={doDelete} onAdmin={()=>setKeypad(true)} notif={notif} setNotif={setNotif} isPremium={premAll} paid={prem} onUpgrade={()=>setShowPremium(true)} onDowngrade={downgradeFree} onAuth={needAuth} onShowTerms={()=>setShowTermsReview(true)}/>;
    if(isND&&selN)return <NewsDetail a={selN} back={()=>setPage("home")}/>;
    if(page==="home")return <HomePage news={news} setPage={setPage} setSN={setSelN} user={user} onAuth={needAuth} isPremium={premAll} adFree={prem} onUpgrade={()=>setShowPremium(true)} adsOff={adsPaused}/>;
    if(page==="instagram")return <IGPage ig={ig}/>;
    if(page==="chat")return <ChatPage races={races} user={user} onAuth={needAuth}/>;
    if(page==="fanta")return <FantaPage pilots={fanta} isPremium={prem} unlocked={unl} onAd={doAd} user={user} onAuth={needAuth} onUpgrade={()=>setShowPremium(true)}/>;
    if(page==="live")return <LivePage races={races} piloti={piloti} costruttori={costr} isPremium={premAll} adFree={prem} unlocked={unl} onAd={doAd} user={user} onAuth={needAuth} onUpgrade={()=>setShowPremium(true)} adsOff={adsPaused}/>;
    return null;
  };
  return(
    <div style={{background:A.bg,minHeight:"100vh",maxWidth:430,margin:"0 auto",color:A.text,fontFamily:"system-ui,-apple-system,sans-serif"}}>
      <style>{`
        * { box-sizing: border-box; }
        button { transition: transform .12s, opacity .12s; }
        button:active { transform: scale(.95) !important; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #E10600; border-radius: 3px; }
      `}</style>
      {showSplash && <SplashScreen onDone={()=>setShowSplash(false)}/>}
      <Hdr onProfile={()=>setPage(isPr?"home":"profile")} onNotif={openNotifs} unreadCount={unreadCount} isPremium={prem} onUpgrade={()=>setShowPremium(true)}/>
      <div style={{paddingBottom:80+adSpace}}>{renderP()}</div>
      {!isPr&&!isND&&<Nav p={page} set={navigateTo} adOffset={bannerH} adGap={bannerH>0?AD_GAP:0}/>}
      {showAd&&<AdModal onClose={()=>setShowAd(false)} onDone={adDone} feature={adTgt}/>}
      {auth&&<AuthModal onClose={()=>setAuth(false)} onLogin={doLogin}/>}
      {showNotifs&&<NotifCenter notifs={notifs.map(n=>({...n,read:readIds.has(n.id)}))} onClose={closeNotifs} onMarkRead={markAllRead}/>}
      {showPremium&&<PremiumModal onClose={()=>setShowPremium(false)} onUpgrade={upgradeToPremium} isPremium={prem} user={user}/>}
      {showTerms&&!termsAccepted&&<TermsModal onAccept={acceptTerms}/>}
      {showTermsReview&&<TermsModal onAccept={()=>setShowTermsReview(false)} reviewMode/>}
      {!showSplash&&!showTerms&&page!=="chat"&&<FeedbackFAB onClick={()=>setShowFeedback(true)} adOffset={adSpace}/>}
      {showFeedback&&<FeedbackModal onClose={()=>setShowFeedback(false)} user={user}/>}
    </div>
  );
}
