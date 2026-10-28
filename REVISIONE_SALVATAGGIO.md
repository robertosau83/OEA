# Revisione del salvataggio OEA — 28 ottobre 2026

## Esito e limiti della verifica

Esaminati frontend Solid, autenticazione, accessi Supabase, schema SQL locale,
caricamento delle partite e delle statistiche. Analisi approfondita del percorso
`GamesSection.QuickScoreModal → Dashboard.applyQuickScores → oea_scores`.
Nessuna scrittura eseguita sul database remoto e nessuna pubblicazione.
Le policy descritte sono quelle degli script locali: non sono state confrontate
con la configurazione effettiva del progetto Supabase.

Il problema intermittente osservato sul dispositivo non e' stato riprodotto dal
vivo. Rete instabile e rinnovo della sessione sono spiegazioni compatibili con
il secondo tentativo riuscito; non sono cause dimostrate senza l'errore originale.

## Come funzionava Applica

1. Divideva il testo per `/` e associava i valori alle voci attive in ordine.
2. Impostava `quickSaving = true`.
3. Inviava tutte le voci attive del giocatore in un solo `upsert`, con chiave
   `game_id,user_id,voice_id`. Non eseguiva una chiamata per ogni voce.
4. Aspettava la risposta senza timeout applicativo e senza retry.
5. All'errore mostrava una frase generica nella pagina, dietro la modal.
6. Al successo aggiornava la tabella in memoria e chiudeva la modal.

L'SDK installato attende la sessione prima di chiamare `fetch`. Dopo una pausa,
anche il recupero/rinnovo della sessione puo' contribuire all'attesa. Impostare
soltanto un AbortSignal sulla query non limita questa fase precedente a fetch.
Non ci sono callback `onAuthStateChange` dell'app che possano dimostrare un
deadlock causato da callback dell'applicazione.

Difetti verificati nel codice precedente:

- Nessun limite applicativo all'attesa della promessa di salvataggio.
- Nessun secondo tentativo per gli errori temporanei.
- Mancanza di `try/catch/finally`: un'eccezione poteva lasciare il pulsante occupato.
- Nessuna conservazione diagnostica dell'errore Supabase.
- Possibilita' di cambiare testo, chiudere la modal e aprirne un'altra mentre la
  richiesta era ancora in corso; la risposta precedente poteva chiudere la nuova.
- Le richieste precedenti dai campi della tabella potevano sovrapporsi ad Applica.
- Testo non numerico convertito silenziosamente in `null`; numeri decimali e fuori
  intervallo ammessi dal parser, mentre il database accetta `integer`.

## Correzioni locali

- Timeout di 12 secondi per ciascuna fase controllata, inclusa l'attesa dell'SDK;
  AbortController interrompe anche la richiesta HTTP quando possibile.
- Massimo due upsert dello stesso insieme di valori per timeout/errori temporanei,
  con una pausa di 600 ms. Errori di permessi o vincoli non vengono ritentati.
- In caso di HTTP 401, un rinnovo della sessione prima del secondo tentativo.
- Attesa dei salvataggi gia' in corso dalla tabella per lo stesso giocatore e
  partita. Se restano sospesi, Applica si ferma senza inviare un upsert concorrente.
- `finally` ripristina sempre il pulsante; errore visibile nella modal e testo
  conservato durante i tentativi e in caso di fallimento.
- Testo, tastierino e chiusura disabilitati durante il salvataggio; guardia contro
  chiamate doppie e risposte appartenenti a una partita precedente.
- Aggiornamento locale basato sulle righe effettivamente inviate.
- Validazione degli interi PostgreSQL, mantenendo `0`, negativi e campi vuoti.
- Log diagnostici nella console con tentativo, categoria, codice e messaggio.

Una risposta persa non dimostra che la scrittura sia fallita: il database potrebbe
averla gia' completata. Per questo il messaggio parla di salvataggio non confermato.
Ripetere gli stessi valori usa il vincolo univoco gia' presente e non crea nuove
righe duplicate. Un abort del client non puo' revocare una transazione gia' avviata
sul server; le modifiche contemporanee da dispositivi diversi restano soggette
alla regola dell'ultima scrittura, come nel codice precedente.

La sequenza mantiene il comportamento esistente: tutte le voci attive vengono
inviate, quindi i campi vuoti diventano `null`; i valori oltre il numero delle voci
attive restano ignorati con l'avviso gia' presente. Non e' un sistema di salvataggio
offline: chiudere o ricaricare la pagina prima della conferma puo' perdere la bozza.

## Altri problemi rilevati, da trattare separatamente

1. **Salvataggio manuale dei singoli campi** (`Dashboard.saveScore` e
   `GamesSection.handleScoreInput`): parte a ogni cifra, aggiorna subito la UI e
   non ripristina il valore quando il server rifiuta la scrittura. Digitando `23`
   partono richieste per `2` e `23`: una risposta/scrittura fuori ordine puo'
   lasciare `2` sul server. La correzione attuale impedisce che queste richieste
   precedenti scavalchino un nuovo Applica, ma non serializza la digitazione manuale.
2. **Creazione partita** (`Dashboard.createGame`): tre scritture distinte
   (partita, giocatori, punteggi), senza transazione. Un errore intermedio lascia
   una partita incompleta; un nuovo tentativo puo' creare un'altra partita.
3. **Gestione generale della rete**: login, caricamenti e altre modifiche non
   condividono ancora la protezione introdotta per Applica. Il caricamento iniziale
   non ha un `finally` per eccezioni impreviste.
4. **Statistiche paginate** (`StatisticsSection.fetchAllRows`): giocatori e punteggi
   sono letti con offset senza ordinamento deterministico; le partite sono ordinate
   solo per data, che puo' essere uguale. Su piu' pagine, soprattutto con modifiche
   simultanee, esiste il rischio di righe saltate o ripetute.
5. **Elenco partite** (`Dashboard.loadGames`): scarica anche tutti i punteggi
   collegati, senza paginazione esplicita. Su storico ampio e' oneroso e dipende dai
   limiti di risposta del server. Nessun superamento del limite e' stato verificato.

## Verifica eseguita

- `node --test scripts/test-quick-score-save.mjs`: 22 test superati.
- Test di successo, errori temporanei e permanenti, timeout con promessa che ignora
  abort, attesa di scritture precedenti, rinnovo e fallimento della sessione,
  eccezioni, validazione, risposta persa dopo scrittura simulata.
- Un test usa realmente l'SDK Supabase installato con fetch simulato; gli altri
  isolano il comportamento del servizio. Nessun test scrive sul server remoto.
- `npm run build`: build completata.

Restano da verificare sul dispositivo il comportamento della modal e il caso reale
di sospensione/ripresa con rete mobile. I test automatici non sono una verifica
dell'interfaccia nel browser ne' della configurazione remota.
