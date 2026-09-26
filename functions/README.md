# Pagamenti reali B&T Premium — guida al deploy

Il codice in questa cartella è **completo e pronto**, ma per motivi di sicurezza
nessun servizio può creare da solo il tuo account Stripe, abilitare la
fatturazione su Firebase o maneggiare le tue chiavi segrete al posto tuo.
Questi passaggi li devi fare tu, una volta sola. Non sono complicati, seguili
in ordine.

## Cosa fa questo backend

- `createCheckoutSession` — quando tocchi "ABBONATI" nell'app, crea una vera
  pagina di pagamento Stripe (Checkout) e la apre.
- `stripeWebhook` — l'unico punto che rende davvero Premium un account: Stripe
  lo chiama automaticamente quando il pagamento va a buon fine. **Il telefono
  non decide mai da solo di attivare Premium** (altrimenti basterebbe
  modificare l'app per avere Premium gratis).
- `cancelSubscription` — disdice davvero l'abbonamento su Stripe quando
  l'utente preme "Disdici" nel profilo, così non viene più addebitato.
- `paymentResult` — pagina di cortesia mostrata dopo il pagamento.

## 1. Crea un account Stripe (se non l'hai già)

1. Vai su [stripe.com](https://dashboard.stripe.com/register) e registrati come
   attività italiana (puoi usare anche una partita IVA o, per iniziare in
   modalità test, saltare la verifica completa).
2. In **Impostazioni → Conto bancario e pianificazione pagamenti** aggiungi
   l'IBAN della tua Postepay Evolution come conto di incasso: i pagamenti
   Stripe vengono accreditati lì con un bonifico automatico (Stripe non versa
   direttamente "sulla carta" ma sul suo IBAN, e la Postepay Evolution ha un
   IBAN che riceve bonifici come un conto normale).
3. Recupera le chiavi in **Sviluppatori → Chiavi API**: ti servirà la
   **Chiave segreta** (`sk_live_...` per pagamenti veri, `sk_test_...` per
   fare prove senza spendere soldi reali).

## 2. Attiva la fatturazione su Firebase (serve per le Cloud Functions)

Le Cloud Functions richiedono il piano **Blaze** (paghi solo quello che usi;
per questi volumi resta comunque nella fascia gratuita quasi sempre).

1. Vai su [console.firebase.google.com](https://console.firebase.google.com/project/bt-app-50703/usage/details)
2. In basso a sinistra → **Aggiorna piano** → scegli **Blaze**, collega una
   carta.

## 3. Installa la Firebase CLI sul tuo computer

```bash
npm install -g firebase-tools
firebase login
```

## 4. Configura le chiavi segrete (mai nel codice!)

Dalla cartella principale del progetto (`bt-app-flutter`):

```bash
firebase functions:secrets:set STRIPE_SECRET
# incolla qui la Chiave segreta di Stripe (sk_live_... o sk_test_...)
```

Il webhook secret lo otterrai al punto 6 — per ora salta e torna qui dopo.

## 5. Installa le dipendenze e pubblica le funzioni

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Alla fine del deploy, il terminale stampa gli URL delle funzioni, simili a:
```
https://us-central1-bt-app-50703.cloudfunctions.net/createCheckoutSession
https://us-central1-bt-app-50703.cloudfunctions.net/stripeWebhook
https://us-central1-bt-app-50703.cloudfunctions.net/cancelSubscription
```
(l'app è già configurata per usare esattamente questi indirizzi — se il tuo
deploy stampa una regione diversa da `us-central1`, dimmelo e aggiorno la
costante `FUNCTIONS_BASE` in `src/App.jsx`).

## 6. Collega il webhook su Stripe

1. Dashboard Stripe → **Sviluppatori → Webhook → Aggiungi endpoint**.
2. URL endpoint: l'indirizzo di `stripeWebhook` stampato al punto 5.
3. Eventi da ascoltare: `checkout.session.completed`,
   `customer.subscription.deleted`, `invoice.payment_failed`.
4. Salva, poi copia il **Signing secret** (`whsec_...`) che Stripe mostra.
5. Torna nel terminale e imposta anche questo secret:
   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   # incolla qui il whsec_...
   firebase deploy --only functions
   ```

## 7. Prova un pagamento

- Se hai usato una chiave `sk_test_...`, su Stripe Checkout puoi pagare con la
  carta di prova `4242 4242 4242 4242`, data futura qualsiasi, CVC qualsiasi.
- Quando sei pronto per i pagamenti veri, ripeti il punto 4 con la chiave
  `sk_live_...` e rifai il deploy.

## Dopo il deploy

Da questo momento, toccando "ABBONATI" nell'app si apre una vera pagina di
pagamento Stripe; una volta pagato, l'account diventa Premium entro pochi
secondi (l'app controlla automaticamente). Finché non completi questi
passaggi, il bottone "ABBONATI" mostrerà un errore invece di attivare un
Premium finto — è voluto: meglio un errore onesto che un Premium che non hai
davvero pagato (o, peggio, che nessuno paga).

## 8. Assistente ChatGPT nel pannello Admin (facoltativo)

Il bottone "Genera con ChatGPT" nel form NEWS dell'Admin passa dalla funzione
`generateArticle`, che usa una chiave OpenAI. Stessa regola di Stripe: la
chiave vive solo come secret sul server, mai nel codice.

1. Vai su [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   e crea una nuova chiave (**Create new secret key**).

   ⚠️ Se avevi già condiviso una chiave OpenAI in chat o altrove, quella va
   considerata compromessa: eliminala da quella pagina (**Revoke**) e usa
   solo una chiave nuova, che non hai mai scritto da nessuna parte
   pubblica — chiunque la trovasse potrebbe spendere soldi tuoi.
2. Imposta il secret (dalla cartella principale del progetto):
   ```bash
   firebase functions:secrets:set OPENAI_API_KEY
   # incolla qui la nuova chiave (sk-...)
   ```
3. Pubblica di nuovo le funzioni:
   ```bash
   firebase deploy --only functions
   ```

Da questo momento il bottone "Genera con ChatGPT" nel pannello Admin
funziona. Ogni testo generato consuma credito sul tuo account OpenAI (pochi
centesimi per articolo con il modello usato), quindi conviene tenere
d'occhio i consumi su platform.openai.com/usage.
