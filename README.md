# Settee Lead Scoring Audit

Dashboard client-side para importar e auditar os resultados do pipeline de Lead Scoring.

## Rodar localmente

```bash
npm install
npm run dev
```

O app abre vazio por segurança. Use “Importar XLSX” para carregar um arquivo real. O processamento é feito no navegador e não altera o arquivo original.

O workbook deve conter as abas `Resumo`, `Pontuações`, `Detalhamento` e `Revisões`, relacionadas pela coluna `Lead`.
