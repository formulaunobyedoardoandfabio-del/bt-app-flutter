# B&T App

App React + Capacitor (Android) con Firebase, AdMob e dati live OpenF1.

## Build su Codemagic
- **B&T - APK di prova**: crea un APK da installare sul telefono.
- **B&T - Play Store (AAB firmato)**: crea il file .aab per Google Play.
  Richiede un keystore caricato su Codemagic con nome `bt_keystore`.
- **B&T - Crea chiave di firma (una volta sola)**: crea quel keystore.
  1. Avvia questa build su Codemagic e, a fine build, scarica i due file
     negli artefatti: `bt-upload-key.jks` e `LEGGIMI-dati-chiave.txt`.
  2. Codemagic → **Settings → Code signing identities → Android keystores**:
     carica `bt-upload-key.jks` con password e alias scritti nel file
     LEGGIMI, e come *Reference name* scrivi `bt_keystore`.
  3. Salva una copia dei due file in un posto sicuro e privato: servono per
     ogni aggiornamento dell'app sul Play Store. Non lanciare di nuovo questa
     build dopo aver caricato la chiave: ne creerebbe una diversa.

`public/app-ads.txt` va pubblicato sul sito indicato nella scheda Play Store.

## Pagine pubbliche per il Play Store (privacy)
La privacy policy e la pagina per chiedere l'eliminazione dell'account sono in
`docs/` e si pubblicano gratis con GitHub Pages:
- https://formulaunobyedoardoandfabio-del.github.io/bt-app-flutter/privacy.html
- https://formulaunobyedoardoandfabio-del.github.io/bt-app-flutter/elimina-account.html

Da attivare una volta sola: GitHub → repository → **Settings → Pages** →
*Source*: **Deploy from a branch** → branch **main**, cartella **/docs** →
**Save**. Dopo qualche minuto i link funzionano (anche quelli dentro l'app).

## Consenso per la pubblicità (Unione Europea)
Prima di mostrare annunci l'app chiede il consenso con il messaggio certificato
di Google. Il messaggio va creato una volta sola su AdMob → **Privacy e
messaggi** → **Regolamenti europei** → crea il messaggio per B&T App (come link
alla privacy usa quello qui sopra) e **pubblicalo**. Finché non è pubblicato,
agli utenti europei gli annunci non vengono mostrati.

## Moderazione della chat
Gli utenti possono segnalare messaggi e bloccare altri utenti (tasto ⋯ su ogni
messaggio). Le segnalazioni si gestiscono nel pannello admin → scheda **CHAT**:
elimina il messaggio, ignora la segnalazione o sospendi l'utente.

## Build automatica a ogni correzione (facoltativo, una tantum)
Il workflow "B&T - APK di prova" è già configurato per partire da solo a ogni
push su `main`. Manca solo collegare il webhook su GitHub (5 minuti, una
volta sola):

1. Vai su **github.com/formulaunobyedoardoandfabio-del/bt-app-flutter →
   Settings → Webhooks → Add webhook**.
2. Payload URL: `https://api.codemagic.io/hooks/6ab5310b91e4bed07003eafb`
3. Content type: `application/json`.
4. In "Which events would you like to trigger this webhook?" scegli
   **Let me select individual events** e spunta: *Pushes*, *Branch or tag
   creation*, *Pull requests*.
5. Salva.

Da quel momento, ogni volta che una correzione viene pubblicata su GitHub
parte da sola una build, e l'APK arriva automaticamente via email a
bt.formula1@gmail.com — senza dover più aprire Codemagic e
premere "Start new build". Se preferisci continuare a farlo a mano, va bene
lo stesso: questo passaggio è facoltativo.

## Pagamenti Premium (Stripe)
Il backend dei pagamenti reali è in `functions/` (Vercel Functions).
Il codice è pronto, ma il deploy iniziale (account Stripe, chiavi, webhook)
va fatto una volta sola a mano: istruzioni passo-passo in
`functions/README.md`.
