<div align="center">

<img src="public/icon.svg" width="88" alt="Ícone do WishWatch" />

# WishWatch

[English](README.md) · **Português**

Wishlist com monitoramento de preços. Cole o link de um produto, registre por que você quer comprá-lo e acompanhe o histórico de preço com alertas de queda.

![React](https://img.shields.io/badge/React_19-292524?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-292524?logo=typescript&logoColor=3178C6)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_4-292524?logo=tailwindcss&logoColor=38BDF8)
![Gemini](https://img.shields.io/badge/Gemini_API-292524?logo=googlegemini&logoColor=8E75B2)
![PWA](https://img.shields.io/badge/PWA-292524?logo=pwa&logoColor=white)

</div>

<p align="center">
  <img src="docs/screenshots/mobile-lista.png" width="260" alt="Lista de produtos no celular" />
  &nbsp;
  <img src="docs/screenshots/mobile-detalhe.png" width="260" alt="Histórico de preço de um produto" />
</p>

## Funcionalidades

- **Cadastro por link**: o Gemini lê a página do produto e preenche nome, loja, imagem, preço e categoria. Funciona com Amazon, Mercado Livre, Magalu, Kabum, Shopee e outras lojas.
- **Motivo e prioridade**: cada item guarda por que você quer comprá-lo (Preciso / Quero / Desejo).
- **Histórico de preço**: gráfico com preço-alvo, mínimo, médio e variação desde o cadastro.
- **Monitoramento 24/7**: um job agendado no GitHub Actions verifica os preços a cada 3 horas, mesmo com o app fechado.
- **Alertas por push**: preço abaixo do alvo, queda percentual configurável, menor preço registrado e volta ao estoque, enviados por Web Push para todos os aparelhos conectados.
- **APK para Android**: gerado pelo GitHub Actions (Trusted Web Activity) e publicado em Releases.
- **Sincronização**: os dados ficam no servidor (Upstash Redis) e aparecem em qualquer aparelho com a chave de acesso. Sem banco configurado, o app funciona só no aparelho.
- **Análise de desconto**: o carimbo `DESCONTO INFLADO` aparece quando a loja mostra um "de/por", mas o histórico já registrou aquele preço antes.
- **Custo em horas de trabalho**: com a renda mensal e as horas trabalhadas, cada produto mostra quanto tempo de trabalho representa.
- **Análise da IA**: recomendação objetiva ("Comprar agora" ou "Aguardar") com base em histórico, tendência, motivo e prioridade.
- **Economia registrada**: ao marcar um item como comprado, o app soma a diferença entre o preço do cadastro e o valor pago.
- **PWA instalável**: funciona offline para consulta, com ícone monocromático para temas do Android.
- **Backup**: exportação e importação da wishlist em JSON.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Interface | React 19, TypeScript, Tailwind CSS 4, Recharts, Lucide |
| Servidor | Express (rotas `/api`), Web Push (`web-push`, chaves VAPID geradas automaticamente) |
| Banco | Upstash Redis via REST (arquivo local em desenvolvimento) |
| Automação | GitHub Actions: CI, monitoramento agendado e build do APK |
| Android | Trusted Web Activity gerada com `@bubblewrap/core` |
| IA | `@google/genai` com `gemini-2.5-flash`, usando as ferramentas `urlContext` e `googleSearch` |
| PWA | `vite-plugin-pwa` (Workbox), fontes locais via Fontsource |
| Testes | Vitest (regras de alerta e monitoramento no servidor) |

## Arquitetura

```
GitHub Actions (cron, 3 h) ──► POST /api/check-all ──► Gemini (urlContext + googleSearch)
                                      │
             App (PWA / APK) ◄──── Web Push ◄──┤
                    │                          ├──► Upstash Redis
                    └──── /api (chave de acesso) ──┘
```

```
server.ts              # Express: /api, assetlinks e arquivos do app
server/
├── api.ts             # rotas, verificação e monitoramento (checkAll)
├── repo.ts            # produtos, alertas, configurações e inscrições de push
├── db.ts              # Upstash Redis (REST) ou arquivo local
└── push.ts            # Web Push com VAPID gerado no primeiro uso
src/
├── components/        # UI (cards, modais, sincronização)
├── services/
│   ├── alerts.ts            # regras de alerta (puras, usadas no app e no servidor)
│   ├── priceChecker.ts      # extração de preço com Gemini
│   ├── purchaseAnalyzer.ts  # análise de compra com Gemini
│   ├── storage.ts           # repositório local ou remoto, mesma interface
│   ├── sync.ts / push.ts    # conexão com o servidor e inscrição de push
│   └── apiClient.ts
└── sw.ts              # service worker: cache offline, push e clique na notificação
android/generate-twa.mjs  # projeto Android (TWA) gerado no CI
tests/                 # Vitest
```

Decisões que valem destacar:

- **A chave do Gemini fica no servidor.** O app só conversa com `/api/*`, protegido por uma chave de acesso.
- **As regras de alerta são funções puras** (`alerts.ts`), usadas tanto no modo local quanto no servidor, e cobertas por testes.
- **Um repositório, dois modos.** `storage.ts` expõe a mesma interface para `localStorage` e para a API; o app não sabe onde os dados estão.
- **Leituras com baixa confiança não disparam alertas.** Ficam marcadas como `REVISÃO MANUAL`, para evitar notificações falsas.
- **Sem configuração de push.** As chaves VAPID são geradas no primeiro uso e guardadas no banco.

## Como rodar

Pré-requisitos: Node.js 22+ e uma [chave da API do Gemini](https://aistudio.google.com/apikey).

```bash
npm install
cp .env.example .env.local   # e preencha GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

Sem a chave do Gemini, o app funciona com preenchimento manual. Sem as variáveis do Upstash, os dados ficam em `.data/` (desenvolvimento). Para ver o app com dados, use **Configurações → Carregar exemplo**.

| Script | O que faz |
| --- | --- |
| `npm run dev` | servidor Express + Vite com hot reload |
| `npm run build` | build de produção em `dist/` |
| `npm start` | serve o build de produção |
| `npm run lint` | checagem de tipos com `tsc` |
| `npm test` | testes com Vitest |
| `npm run icons` | regenera os ícones do PWA a partir de `scripts/generate-icons.js` |

## Deploy, monitoramento 24/7 e APK

O passo a passo completo (Upstash, Render, GitHub Actions e instalação no celular) está em [docs/CONFIGURACAO.md](docs/CONFIGURACAO.md).

## Identidade visual

O app segue o estilo **Retro Ledger**: fundo linho (`#FAF7F2`), cards off-white com sombra sólida de 2px, textos em Plus Jakarta Sans e valores em Space Mono. O ícone segue o padrão monocromático do Android: squircle cinza com símbolo preto.

<p align="center">
  <img src="docs/screenshots/desktop-detalhe.png" width="720" alt="Detalhe do produto no desktop" />
</p>

## Próximos passos

- [x] Monitoramento 24/7 com GitHub Actions
- [x] Persistência em nuvem e sincronização entre aparelhos
- [x] Notificações push e APK para Android
- [ ] Extensão de navegador para adicionar produtos direto da página da loja

## Licença

[MIT](LICENSE)
