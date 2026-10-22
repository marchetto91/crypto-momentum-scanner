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


## Backend 24/7 gratuito (Cloudflare Workers + D1)

Questa repo include il backend paper-only in `worker.js`, schema SQL in `schema.sql` e configurazione Wrangler in `wrangler.toml`. Il backend esegue una scansione schedulata ogni 5 minuti, salva i segnali in D1 e simula l'apertura di una posizione quando si chiama `POST /api/trades/open`. Le posizioni simulate vengono chiuse dal job schedulato quando il prezzo osservato raggiunge stop o target. Non invia ordini reali.

### Attivazione una tantum
1. Crea un account Cloudflare gratuito e apri **Workers & Pages**.
2. Crea un database **D1** chiamato `crypto-momentum-paper-bot`; esegui il contenuto di `schema.sql` nell'editor SQL del database.
3. Crea un Worker chiamato `crypto-momentum-paper-bot` e incolla il contenuto di `worker.js`, poi distribuiscilo.
4. In **Settings → Bindings**, aggiungi un binding D1 chiamato esattamente `DB` e seleziona il database creato.
5. In **Settings → Triggers**, imposta un Cron Trigger `*/5 * * * *` (ogni 5 minuti). Il piano gratuito ha quote e limiti: consulta il pannello Cloudflare per i limiti attuali.
6. Il Worker avrà un URL simile a `https://crypto-momentum-paper-bot.<tuo-account>.workers.dev`. Conserva quell'URL; il frontend GitHub Pages va collegato a esso per mostrare dati live e inviare le azioni paper. La configurazione Wrangler qui è un modello: sostituisci il database ID prima di usarla.

### Limiti importanti
- Il piano gratuito è adatto a un prototipo, non garantisce SLA o continuità assoluta. Le scansioni possono fallire per quote, manutenzione, rate limit o indisponibilità di Crypto.com.
- Il job ogni 5 minuti non osserva ogni tick: uno spike rapido o un gap può non essere rilevato; l'uscita simulata usa l'ultimo prezzo rilevato dal job.
- Il modello di prezzo, spread e commissioni è semplificato; le prestazioni simulate non dimostrano redditività reale.
- Il backend è in modalità paper trading. Prima di renderlo accessibile pubblicamente, aggiungere autenticazione o un token segreto per impedire ad altri di aprire posizioni sul tuo portafoglio. Non collegare API key di exchange.
