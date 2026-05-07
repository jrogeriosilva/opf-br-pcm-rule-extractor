---
name: pcm-additional-info
description: Consulta as regras de obrigatoriedade do additionalInfo do Open Finance Brasil PCM. Ative ao implementar ou revisar campos de additionalInfo, tokenId, transactionIdentification, paymentInformation e similares; ou quando o usuário mencionar "additionalInfo", "PCM", "Open Finance Brasil", "Iniciação de Pagamentos", "Pagamentos Automáticos", "Iniciação Sem Redirecionamento", "regra de preenchimento" ou "Confluence PCM".
---

# pcm-additional-info

Skill autossuficiente que extrai e filtra as regras de `additionalInfo` das páginas PCM do Confluence do Open Finance Brasil. Use sempre que precisar saber a regra de preenchimento, métodos HTTP, endpoints, versões, tamanho máximo, padrão ou exemplo de um campo `additionalInfo`.

## Pré-requisitos no projeto consumidor

- Node.js 18+ disponível no PATH.
- Acesso à internet na primeira execução (para `npm install`) e em cada refresh (chama `https://openfinancebrasil.atlassian.net`).
- Permissões aprovadas em `.claude/settings.json`: `Bash(node:*)`, `Bash(npm:*)`, `Bash(npx:*)`.

## Como usar

Os comandos abaixo assumem que o `cwd` é a raiz do projeto consumidor (a skill mora em `.claude/skills/pcm-additional-info/`).

### 1. Garanta que o JSON está atualizado

Antes de qualquer consulta, rode:

```
node .claude/skills/pcm-additional-info/scripts/ensure-fresh.mjs
```

É idempotente: só faz `npm install` na primeira vez e só re-extrai quando o JSON está ausente ou tem mais de 24h. Use `--force` para forçar nova extração.

### 2. Consulte com `lookup.mjs`

**Nunca** leia `extractor/output/additional-info.json` direto com Read — sempre use o lookup, que filtra antes de devolver.

```
node .claude/skills/pcm-additional-info/scripts/lookup.mjs <flags>
```

Flags disponíveis (combinações são AND):

- `--field <nome>` — match exato em `campo`, case-insensitive.
- `--contains <substr>` — substring em `campo` ou `definicao`.
- `--endpoint <path>` — substring em `endpoints[]`.
- `--method <verb>` — match em `metodos[]` (uppercase).
- `--page <title-substr>` — substring em `page.title`.
- `--list-fields` — só nomes de campos por página (descoberta).
- `--list-pages` — só `pageId`, `title`, `url`, `fieldCount`.
- `--format compact|json` — default `compact` (omite `null` e arrays vazios).

### 3. Schema do retorno (modo padrão)

```
{
  "matches": <N>,
  "results": [
    {
      "campo": "...",
      "definicao": "...",
      "regraDePreenchimento": "...",
      "roles": "...",
      "httpCode": "...",
      "metodos": ["POST", "GET"],
      "dominio": [...],
      "endpoints": ["/..."],
      "versoes": ["1.0"],
      "tamanhoMaximo": "...",
      "padrao": "...",
      "exemplo": "...",
      "_page": { "pageId": "...", "title": "...", "url": "..." }
    }
  ]
}
```

## Estratégia de descoberta

Quando o nome do campo não estiver claro:

1. Tente `--field <nome>` primeiro.
2. Se vier `matches: 0`, rode `--list-fields` (opcionalmente com `--page`) para ver os nomes disponíveis.
3. Tente `--contains <fragmento>` com base nos nomes listados.
4. Em último caso, `node .claude/skills/pcm-additional-info/scripts/ensure-fresh.mjs --force` revalida contra o Confluence.

## Exemplos

```
node .claude/skills/pcm-additional-info/scripts/lookup.mjs --field tokenId
node .claude/skills/pcm-additional-info/scripts/lookup.mjs --contains pagador --page "Pagamentos Automáticos"
node .claude/skills/pcm-additional-info/scripts/lookup.mjs --endpoint /pix --method POST
node .claude/skills/pcm-additional-info/scripts/lookup.mjs --list-pages
node .claude/skills/pcm-additional-info/scripts/lookup.mjs --list-fields --page "Iniciação de Pagamentos"
```
