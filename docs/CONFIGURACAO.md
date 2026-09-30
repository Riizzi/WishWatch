# Configuração: monitoramento 24/7, notificações e APK

Tudo pelo navegador, sem terminal. Leva uns 20 minutos na primeira vez.

```
GitHub Actions (a cada 3 h) ──► Servidor no Render ──► Gemini lê os preços
                                      │
                                      ├──► Upstash Redis (produtos, histórico, alertas)
                                      └──► Web Push ──► WishWatch no celular
```

## 1. Banco de dados (Upstash Redis, grátis)

1. Entre em https://console.upstash.com e faça login (dá para usar a conta do GitHub).
2. Clique em **Create Database** → tipo **Redis**.
3. Nome: `wishwatch`. Região: a mais próxima disponível (ex.: `sa-east-1`, São Paulo). Plano **Free**.
4. Na página do banco, na seção **REST API**, copie:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

## 2. Servidor (Render, grátis)

Se o Web Service ainda não existe, crie em https://render.com → **New + → Web Service** → repositório **Riizzi/WishWatch**:

| Campo | Valor |
| --- | --- |
| Branch | `main` |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Instance Type | Free |

Em **Environment**, cadastre as quatro variáveis:

| Nome | Valor |
| --- | --- |
| `GEMINI_API_KEY` | sua chave em https://aistudio.google.com/apikey |
| `APP_ACCESS_KEY` | uma senha forte criada por você (protege os dados) |
| `UPSTASH_REDIS_REST_URL` | copiada no passo 1 |
| `UPSTASH_REDIS_REST_TOKEN` | copiada no passo 1 |

Salve e espere o deploy. Anote a URL, por exemplo `https://wishwatch-xxxx.onrender.com`.

Para conferir, abra `https://SUA-URL/api/health`. O esperado é `"sync":true` e `"auth":true`.

## 3. GitHub Actions

No repositório: **Settings → Secrets and variables → Actions**.

Aba **Variables** → **New repository variable**:

| Nome | Valor |
| --- | --- |
| `APP_URL` | a URL do Render, sem barra no final |

Aba **Secrets** → **New repository secret**:

| Nome | Valor |
| --- | --- |
| `APP_ACCESS_KEY` | a mesma senha do Render |
| `ANDROID_KEYSTORE_PASSWORD` | a senha da chave de assinatura do APK |

## 4. Gerar o APK

1. Aba **Actions** → **Android (APK)** → **Run workflow** → **Run workflow**.
2. Em uns 5 minutos, o APK aparece em **Releases** (coluna da direita na página do repositório) como `WishWatch.apk`.

Só é preciso gerar de novo quando mudar a URL do app ou o ícone. As mudanças no site chegam no app sozinhas.

## 5. Instalar no celular

1. No celular, abra a página de **Releases** e baixe o `WishWatch.apk`.
2. Toque no arquivo. Se o Android pedir, permita **instalar apps desta fonte** para o navegador.
3. Se você tinha instalado o WishWatch pelo Chrome antes, desinstale essa versão para não ficar com dois ícones.
4. Abra o WishWatch → **Configurações → Sincronização**, digite a `APP_ACCESS_KEY` e toque em **Conectar**. Os produtos que estavam no aparelho vão para o servidor.
5. Ainda em Configurações, ligue **Notificações**, aceite a permissão e toque em **Enviar notificação de teste**.

Repita o passo 4 em cada aparelho (PC, outro celular) para ver os mesmos dados.

## 6. Testar o monitoramento

Aba **Actions** → **Monitoramento de preços** → **Run workflow**. Ao terminar, o resumo mostra cada produto com o preço lido e os alertas gerados. Depois disso ele roda sozinho a cada 3 horas.

## Observações

- **Render grátis:** o servidor dorme após 15 minutos sem uso. A primeira abertura pode levar até 1 minuto, e o monitoramento já espera por isso.
- **Agendamento do GitHub:** o GitHub pausa tarefas agendadas em repositórios sem nenhum commit por 60 dias. Se isso acontecer, é só reativar em **Actions → Monitoramento de preços → Enable workflow**.
- **Intervalo:** para mudar a frequência, edite o `cron` em `.github/workflows/price-check.yml` (ex.: `'23 */6 * * *'` para a cada 6 horas).
- **Chave de assinatura:** o arquivo `android/wishwatch.keystore` é protegido pela senha do segredo `ANDROID_KEYSTORE_PASSWORD`. Guarde essa senha: sem ela não dá para gerar atualizações do mesmo APK.
