# Crypto Momentum Scanner v0.1

Scanner mobile in italiano per osservare dati pubblici di Crypto.com Exchange e simulare operazioni. Nessun ordine reale e nessuna chiave privata.

## Pubblicazione con GitHub Pages
1. Apri **Settings → Pages** nel repository.
2. In **Build and deployment**, scegli **Deploy from a branch**.
3. Seleziona branch **main**, cartella **/(root)** e premi **Save**.
4. Attendi il completamento della pubblicazione. L'indirizzo previsto è https://marchetto91.github.io/crypto-momentum-scanner/

## Funzioni
- Scansione manuale di coppie EUR e USDT tramite endpoint pubblici Crypto.com Exchange.
- Score sperimentale, calcolatore di rischio, paper trading e diario locale.
- Esportazione CSV e test storico rapido.
- PWA base e richiesta permesso notifiche.

## Limiti
- Le coppie Exchange potrebbero non essere acquistabili nella Crypto.com App italiana.
- Le notifiche sono valutate quando esegui una scansione; non è incluso un server per push in background.
- Il backtest usa uno storico limitato e costi semplificati. Non è una prova di redditività.
- Il diario è salvato nel browser/dispositivo e non sincronizzato.

## Dati e sicurezza
Sono usati soltanto endpoint pubblici. Non inserire API key o credenziali Crypto.com.
