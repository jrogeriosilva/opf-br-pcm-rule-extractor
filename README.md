# pcm-additional-info — Claude Skill

Skill autossuficiente do Claude Code que dá ao agente de codificação acesso filtrado às regras de obrigatoriedade do `additionalInfo` das páginas PCM do Open Finance Brasil (Confluence).

Em vez de despejar o JSON inteiro no contexto, a skill faz fetch sob demanda e devolve **apenas** os campos relevantes a cada pedido — economizando tokens e mantendo o foco do agente.

## O que fica em `.claude/skills/pcm-additional-info/`

```
SKILL.md                              instruções carregadas pelo Claude
scripts/ensure-fresh.mjs              garante JSON atualizado (npm install + extração)
scripts/lookup.mjs                    filtra o JSON e imprime só o relevante
extractor/                            extrator embarcado (Node.js puro, autocontido)
  package.json
  config.json                         pageIds, baseUrl, retry policy
  src/{index,fetcher,parser}.mjs
  output/additional-info.json         gerado, gitignored
```

## Pré-requisitos

- Node.js 18+ (a skill usa `fetch` global e `import.meta.url`).
- Acesso à internet:
  - Primeira execução: para `npm install` dentro de `extractor/`.
  - Cada refresh: para chamar `https://openfinancebrasil.atlassian.net/wiki/rest/api/content/...`.
- Acesso à API pública do Confluence Open Finance — sem autenticação especial, mas redes corporativas restritas podem bloquear.

## Como usar em outro projeto Open Finance

1. Copie a pasta `.claude/skills/pcm-additional-info/` inteira para `.claude/skills/` do seu projeto.
2. Aprove (uma vez) as permissões em `.claude/settings.json`:
   ```json
   {
     "permissions": {
       "allow": [
         "Bash(node:*)",
         "Bash(npm:*)",
         "Bash(npx:*)"
       ]
     }
   }
   ```
3. Pronto. Peça ao Claude algo como _"implementa `additionalInfo.tokenId` na requisição de iniciação"_ — o roteador de skills detecta os termos-gatilho e o Claude:
   - roda `ensure-fresh.mjs` (faz `npm install` na primeira vez, extrai o JSON);
   - chama `lookup.mjs --field tokenId`;
   - recebe **só** o registro daquele campo (com `regraDePreenchimento`, `metodos`, `endpoints`, etc.) e implementa.

## Economia de tokens de input

A skill evita que o Claude receba o `additional-info.json` inteiro a cada consulta. A tabela abaixo mostra a diferença entre as duas abordagens:

| Abordagem | Tamanho | Tokens (aprox.) |
|---|---|---|
| `Read` no JSON completo (sem skill) | ~127 KB | **~32.600 tokens** |
| `lookup.mjs --field tokenId` (1 match) | ~1 KB | **~260 tokens** |
| `lookup.mjs --contains pagador` (3 matches) | ~3 KB | **~670 tokens** |

**Economia por consulta: 98–99% dos tokens de input** (~32.000 tokens poupados).

> Estimativas calculadas com dataset sintético representativo: 165 campos distribuídos nas 4 páginas (70 + 50 + 25 + 20), cada campo com os 12 atributos do schema (incluindo `regraDePreenchimento` de ~200 chars). O JSON real pode ser maior — campos com regras mais longas elevam ainda mais a economia. Para medir com dados reais, rode `npm run start` em um ambiente com acesso ao Confluence e use `wc -c` no `output/additional-info.json` gerado.

## Como funciona

```
Pedido do usuário
       │
       ▼
Claude carrega SKILL.md  ──►  ensure-fresh.mjs  ──►  npm run start (se ausente/>24h)
                                      │                       │
                                      │                       ▼
                                      │          extractor/output/additional-info.json
                                      ▼
                              lookup.mjs --flags
                                      │
                                      ▼
                          { matches, results: [...] }  → contexto enxuto
```

## Comandos diretos (debug)

```bash
node .claude/skills/pcm-additional-info/scripts/ensure-fresh.mjs
node .claude/skills/pcm-additional-info/scripts/ensure-fresh.mjs --force
node .claude/skills/pcm-additional-info/scripts/lookup.mjs --help
node .claude/skills/pcm-additional-info/scripts/lookup.mjs --list-pages
node .claude/skills/pcm-additional-info/scripts/lookup.mjs --field tokenId
node .claude/skills/pcm-additional-info/scripts/lookup.mjs --contains pagador --page "Pagamentos Automáticos"
```

## Desenvolvimento da skill (neste repo)

A raiz expõe scripts facade:

```bash
npm run skill:install    # npm install dentro de extractor/
npm run skill:start      # roda a extração (npm run start em extractor/)
npm run start            # ensure-fresh --force (atalho)
```

## Páginas extraídas

Definidas em `extractor/config.json`:

- Iniciação de Pagamentos
- Iniciação de Pagamentos Sem Redirecionamento
- Pagamentos Automáticos
- Regras de Obrigatoriedade additionalInfo - SG

Para adicionar/atualizar páginas, edite `extractor/config.json` (campos `pageId` e `title`).
