# Deploy web su Cloudflare Pages

## Produzione

- progetto Pages: `chessstudy`
- dominio: <https://chessstudy.pages.dev>
- branch di produzione: `main`
- modalita: Direct Upload di soli asset statici

Il progetto non usa Pages Functions, Workers o binding Cloudflare. La
configurazione versionata in `wrangler.jsonc` dichiara soltanto il nome del
progetto e la directory statica `dist`, mantenendo il deploy compatibile con il
piano gratuito Pages.

## Build

- comando: `npm run build`
- directory di output: `dist`
- runtime consigliato: Node.js 22

Per un deploy manuale autenticato:

```bash
npm run build
npx wrangler pages deploy dist --project-name chessstudy --branch main
```

Configurare nel progetto Pages le variabili:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Non configurare nel frontend chiavi `service_role`, secret key o credenziali
amministrative.

## Routing e Stockfish

I file `public/_redirects` e `public/_headers` vengono copiati in `dist` dal
build Vite. Configurano rispettivamente il fallback di tutte le route SPA verso
`index.html` e gli header COOP/COEP necessari al worker Stockfish multi-thread.

Dopo ogni deploy verificare:

1. refresh diretto su `/login`, `/auth/confirm`, `/auth/update-password` e una
   route applicativa protetta;
2. `Cross-Origin-Opener-Policy: same-origin` e
   `Cross-Origin-Embedder-Policy: require-corp` sulla pagina e sugli asset;
3. MIME `text/javascript` per i worker e `application/wasm` per i binari;
4. `crossOriginIsolated === true` e disponibilita di `SharedArrayBuffer`;
5. avvio di un'analisi Stockfish multi-thread e fallback single-thread in un
   contesto privo di isolamento.

## Supabase Auth

Nel Dashboard Supabase impostare il dominio Pages definitivo come Site URL e
aggiungere alla redirect allow list almeno:

- `https://chessstudy.pages.dev/auth/confirm`
- `https://chessstudy.pages.dev/auth/update-password`

Conservare anche i redirect locali usati per sviluppo e preview. Il dominio di
produzione deve essere configurato prima di provare conferme e recupero
password sull'ambiente pubblicato.

Gli account sono creati manualmente da **Authentication > Users > Add user**,
assegnando email e password temporanea senza usare l'invio automatico di un
invito. Le credenziali vengono comunicate all'utente fuori da Supabase. Al primo
login l'app blocca automaticamente la navigazione sulla route interna
`/account/first-password`; il cambio effettivo della password rimuove il blocco.
