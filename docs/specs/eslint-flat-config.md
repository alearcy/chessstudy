# Configurare ESLint flat config

## Obiettivo

Rendere `npm run lint` eseguibile con ESLint 9 flat config per app React 19,
TypeScript strict e Vite.

## Scelte tecniche

- Aggiungere `eslint.config.js` in formato flat config ESM.
- Usare `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`,
  `eslint-plugin-react-refresh` e `globals`, già presenti in `devDependencies`.
- Applicare lint a `**/*.{ts,tsx}`.
- Impostare globals browser per sorgenti frontend.
- Ignorare output e cartelle non sorgente: `dist`, `build`, `coverage`,
  `node_modules`, `public/stockfish`, `src-tauri/target`.
- Non duplicare le regole TypeScript già coperte dal build (`noUnusedLocals`,
  `noUnusedParameters`) oltre alle regole raccomandate del parser/plugin.

## Verifica

- `npm run lint` deve avviare ESLint senza errore di configurazione mancante.
- `npm run build` resta il controllo TypeScript principale.
