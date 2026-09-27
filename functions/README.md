# Pagamenti reali B&T Premium — guida al deploy (Vercel)

Il codice in questa cartella è **completo e pronto**, ma per motivi di sicurezza
nessun servizio può creare da solo il tuo account Stripe o Vercel, o maneggiare
le tue chiavi segrete al posto tuo. Questi passaggi li devi fare tu, una volta
sola.

## Cosa fa questo backend

- `createCheckoutSession` — quando tocchi "ABBONATI" nell'app, crea una vera
  pagina di pagamento Stripe (Checkout) e la apre.
- `stripeWebhook` — l'unico punto che rende davvero Premium un account: Stripe
  lo chiama automaticamente quando il pagamento va a buon fine. **Il telefono
  non decide mai da solo di attivare Premium.**
- `cancelSubscription` — disdice davvero l'abbonamento su Stripe quando
  l'utente preme "Disdici" nel profilo.
- `paymentResult` — pagina di cortesia mostrata dopo il pagamento.
- `generateArticle` — genera testo con ChatGPT per il pannello Admin (la
  chiave OpenAI vive solo qui, mai nell'app).

Gira su **Vercel** (piano Hobby gratuito, nessuna carta richiesta) invece che
su Firebase Cloud Functions, per evitare del tutto il piano a pagamento Blaze.

## 1. Account Stripe (se non l'hai già)

Vedi i passaggi 1 e 7 della guida precedente: registrazione su
[stripe.com](https://dashboard.stripe.com/register), IBAN Postepay Evolution
collegato per l'incasso, chiavi in **Sviluppatori → Chiavi API**.

## 2. Progetto Vercel

Il repository `bt-app-flutter` è già importato su Vercel. Da controllare una
volta sola nelle impostazioni del progetto:

1. **Settings → General → Root Directory** → `functions`
2. **Settings → Environment Variables**, aggiungi:
   - `STRIPE_SECRET` — la Chiave segreta di Stripe
   - `STRIPE_WEBHOOK_SECRET` — vedi punto 4 qui sotto
   - `OPENAI_API_KEY` — la tua chiave da
     [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - `FIREBASE_SERVICE_ACCOUNT` — vedi punto 3 qui sotto

## 3. Chiave per far parlare Vercel con lo stesso database dell'app

1. [console.firebase.google.com](https://console.firebase.google.com/project/bt-app-50703/settings/serviceaccounts/adminsdk)
2. **Genera nuova chiave privata** → scarica il file `.json`
3. Apri il file, copia **tutto** il contenuto (comprese le graffe)
4. Incollalo come valore della variabile `FIREBASE_SERVICE_ACCOUNT` su Vercel
   (punto 2 qui sopra) — su una riga sola va bene, Vercel accetta testo lungo

Questo passaggio non richiede il piano Blaze: le service account key sono una
funzione base di Firebase, disponibile sul piano gratuito.

## 4. Collega il webhook su Stripe

1. Fai un primo deploy su Vercel (basta un push su `main` con il codice di
   questa cartella — Vercel ricostruisce da solo).
2. Nota l'indirizzo pubblico, es. `https://bt-app-flutter.vercel.app`.
3. Dashboard Stripe → **Sviluppatori → Webhook → Aggiungi endpoint**.
4. URL endpoint: `https://bt-app-flutter.vercel.app/api/stripeWebhook`.
5. Eventi da ascoltare: `checkout.session.completed`,
   `customer.subscription.deleted`, `invoice.payment_failed`.
6. Salva, copia il **Signing secret** (`whsec_...`) mostrato da Stripe.
7. Incollalo come valore della variabile `STRIPE_WEBHOOK_SECRET` su Vercel
   (punto 2 qui sopra).

## 5. Prova un pagamento

- Con la chiave `sk_test_...`, su Stripe Checkout paga con la carta di prova
  `4242 4242 4242 4242`, data futura qualsiasi, CVC qualsiasi.
- Quando sei pronto per i pagamenti veri, sostituisci `STRIPE_SECRET` con la
  chiave `sk_live_...` su Vercel.

## Dopo la configurazione

Ogni `git push` su `main` ricostruisce automaticamente le funzioni su Vercel
— non serve nessun comando da lanciare a mano, a differenza del vecchio
flusso Firebase CLI.
