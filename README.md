# B&T Formula1

App React + Capacitor (Android) con Firebase, AdMob e dati live OpenF1.

## Build su Codemagic
- **B&T - APK di prova**: crea un APK da installare sul telefono.
- **B&T - Play Store (AAB firmato)**: crea il file .aab per Google Play.
  Richiede un keystore caricato su Codemagic con nome `bt_keystore`.

`public/app-ads.txt` va pubblicato sul sito indicato nella scheda Play Store.

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
formulaunobyedoardoandfabio@gmail.com — senza dover più aprire Codemagic e
premere "Start new build". Se preferisci continuare a farlo a mano, va bene
lo stesso: questo passaggio è facoltativo.

## Pagamenti Premium (Stripe)
Il backend dei pagamenti reali è in `functions/` (Firebase Cloud Functions).
Il codice è pronto, ma il deploy iniziale (account Stripe, chiavi, webhook)
va fatto una volta sola a mano: istruzioni passo-passo in
`functions/README.md`.
