# Spostamento backend pagamenti (Stripe) e generatore ChatGPT da Firebase a Vercel

**Data**: 2026-09-27
**Stato**: Approccio e design approvati in conversazione — in attesa di piano di implementazione

## Contesto

Il backend dei pagamenti Premium (Stripe Checkout + webhook + disdetta abbonamento) è già scritto e funzionante come Cloud Functions Firebase (`functions/index.js`, 2nd gen), ma per completare la configurazione (in particolare salvare `STRIPE_WEBHOOK_SECRET` via Secret Manager) Google richiede di passare il progetto Firebase dal piano gratuito Spark al piano a consumo Blaze, che richiede di collegare una carta di credito.

Vincolo esplicito dell'utente (vedi memoria di progetto, ways-of-working): **mai un servizio che richiede una carta, nemmeno solo per verifica.** Questo esclude Blaze in modo definitivo, non solo per Stripe ma anche per `generateArticle` (che nel frattempo veniva chiamato direttamente dal client per lo stesso motivo).

## Decisione

Spostare l'intero backend HTTP (i 5 endpoint di `functions/index.js`) da Firebase Cloud Functions a **Vercel** (piano Hobby gratuito), che:
- non richiede mai una carta di credito, nemmeno per verifica;
- non "dorme" tra una richiesta e l'altra (a differenza del piano gratuito di Render, che si riattiva in circa un minuto — inaccettabile per un pagamento o per il webhook Stripe, e in contrasto con la promessa dell'app "Premium si attiva entro pochi secondi");
- offre Node.js reale, quindi le librerie già in uso (`stripe`, `firebase-admin`) funzionano senza riscritture sostanziali — gli handler attuali sono già quasi nella forma `(req, res)` che Vercel si aspetta;
- ha una soglia gratuita (100GB banda/mese, ~1M invocazioni/mese) ampiamente sufficiente per il traffico di B&T.

Alternative considerate e scartate: Netlify (stesso profilo di Vercel ma handler in forma diversa, più codice da riscrivere per lo stesso risultato); Render (sleep dopo 15 min, tempi di risveglio ~1 min); Railway ($5 di credito una tantum, poi l'app si ferma — non adatto a un servizio permanente); Cloudflare Workers / Deno Deploy (runtime non-Node, compatibilità incerta con `firebase-admin`); qualunque hosting Google (Cloud Run compreso) e AWS/Azure (richiedono comunque una carta collegata al progetto/account).

Fonti consultate il 2026-09-27 sullo stato attuale dei piani gratuiti: comparativa piattaforme hosting Node.js 2026 e approfondimento specifico sul piano gratuito di Render.

## Cosa si sposta

Tutti e 5 gli endpoint di `functions/index.js`, riscritti nel formato che Vercel si aspetta (funzioni serverless sotto `functions/api/`):

1. `createCheckoutSession` — crea la sessione di pagamento Stripe Checkout
2. `cancelSubscription` — disdice l'abbonamento Stripe attivo
3. `paymentResult` — pagina statica di ritorno da Stripe Checkout
4. `stripeWebhook` — riceve gli eventi Stripe; l'unico punto che attiva davvero Premium
5. `generateArticle` — assistente ChatGPT per l'Admin (oggi scritto ma non collegato al client)

**`generateArticle` include anche un cambiamento lato app**: il bottone "Genera con ChatGPT" nel pannello Admin (`src/App.jsx`) oggi chiama OpenAI direttamente dal client, con la chiave incorporata nell'APK a build-time (via Codemagic, gruppo `bt_secrets`). Passa a chiamare il nuovo endpoint `generateArticle` su Vercel; la chiave OpenAI si sposta nelle variabili d'ambiente di Vercel e sparisce dall'APK compilato — un miglioramento di sicurezza reale, non solo uno spostamento di codice.

## Come restano collegati i dati

Le funzioni continuano a leggere/scrivere lo stesso Firestore di oggi (collezione `users`, ecc.) tramite `firebase-admin`, usando una **service account key** del progetto Firebase `bt-app-50703` (funzione IAM standard del piano gratuito Spark, non richiede Blaze). La chiave vive come variabile d'ambiente su Vercel, mai nel codice o in git.

## Segreti (tutti come Environment Variables su Vercel, mai nel codice)

- `STRIPE_SECRET`
- `STRIPE_WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT` (nuovo — contenuto JSON della service account key)

## Cosa cambia nell'app (`src/App.jsx`)

- `FUNCTIONS_BASE` (oggi `https://us-central1-bt-app-50703.cloudfunctions.net`) → nuovo dominio Vercel (`https://bt-app-flutter.vercel.app`, da confermare dopo il primo deploy corretto delle funzioni)
- `success_url`/`cancel_url` dentro `createCheckoutSession` (oggi costruiti da `REGION`/`PROJECT_ID` su cloudfunctions.net) → puntano al nuovo dominio Vercel, percorso `/api/paymentResult`
- Bottone "Genera con ChatGPT": chiama `${FUNCTIONS_BASE}/api/generateArticle` invece di OpenAI direttamente; rimosso il placeholder `__OPENAI_API_KEY__` e il relativo step Codemagic (non più necessario)

## Dettaglio tecnico da non perdere

`stripeWebhook` verifica la firma Stripe sul corpo grezzo della richiesta (`req.rawBody`, disponibile automaticamente su Firebase Functions v2). Su Vercel va disabilitato il body-parsing automatico e letto il corpo grezzo a mano, altrimenti la verifica della firma fallisce sempre.

## Fuori scope

- Nessuna modifica a Firestore (regole, struttura dati)
- Nessuna modifica a Stripe stesso (prodotti, prezzi)
- Nessun dominio personalizzato su Vercel per ora — si usa il dominio `*.vercel.app` di default
- Le vecchie Cloud Functions Firebase (`functions/index.js` in formato Firebase) vengono ritirate: non più deployate né mantenute. Il flusso `firebase deploy --only functions` da Cloud Shell non serve più.
- Nessuna modifica alla cartella di primo livello `functions/` (resta quel nome, cambia solo cosa c'è dentro) — evita di confondere `.firebaserc` e la cronologia git senza benefici reali.

## Collaudo prima di andare "live"

Stesso collaudo già previsto nel README esistente: pagamento con carta di test Stripe (`4242 4242 4242 4242`) contro le nuove URL Vercel, prima di passare alla chiave `sk_live_...`.

## Passi manuali che restano dell'utente

Stesso principio già seguito per Stripe e Firebase: creare l'account e collegare il repository è suo (fatto: repo `bt-app-flutter` già importato su Vercel), così come inserire ogni segreto nelle Environment Variables di Vercel quando richiesto — nessun servizio può farlo al posto suo in sicurezza.
