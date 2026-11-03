# MóvelCarente — Plataforma de Doação de Móveis

Plataforma colaborativa para conectar doadores de móveis e utensílios domésticos a pessoas e famílias que precisam.

---

## Tecnologias Utilizadas

- **Front-end**: React, Vite, Bootstrap, React Router, Socket.IO Client.
- **Back-end**: Node.js, Express, Prisma ORM, Socket.IO, BullMQ, Joi, JWT, Helmet.
- **Banco de Dados**: PostgreSQL (Supabase na nuvem ou local via Docker).
- **Cache e Filas**: Redis (rate limiting e fila de e-mails em background).
- **Infraestrutura**: Docker, Docker Compose, Nginx.

---

## Como Executar Localmente com Docker

O projeto está configurado para rodar por padrão em **4 containers**, utilizando o banco de dados **Supabase** na nuvem:
1. `api-movelcarente` (porta `3000`)
2. `frontend-movelcarente` (porta `8080`)
3. `redis-movelcarente` (porta `6379`)
4. `worker-movelcarente` (envia os e-mails em segundo plano; sem ele nenhum e-mail de verificação ou de recuperação de senha é enviado. Sem `SMTP_HOST`, os e-mails aparecem só no log dele: `docker compose logs -f worker`)

### Passo a Passo Local:

1. **Configurar as variáveis de ambiente:**
   Copie `.env.docker.example` para `.env` na raiz do projeto e informe as URLs do Supabase e credenciais:
   ```sh
   cp .env.docker.example .env
   ```

2. **Subir os containers:**
   ```sh
   docker compose up --build
   ```

3. **Acessar a aplicação:**
   - **Front-end**: [http://localhost:8080](http://localhost:8080)
   - **API**: [http://localhost:3000](http://localhost:3000)
   - **Documentação Swagger**: [http://localhost:3000/docs](http://localhost:3000/docs)

4. **Perfis adicionais opcionais:**
   - Para rodar com um PostgreSQL local (sem Supabase), aponte `DATABASE_URL` e `DIRECT_URL` do `.env` para ele (os dois com o mesmo valor) e suba com o perfil:
     ```env
     DATABASE_URL=postgresql://movelcarente:SUA_POSTGRES_PASSWORD@postgres:5432/movelcarente?schema=public
     DIRECT_URL=postgresql://movelcarente:SUA_POSTGRES_PASSWORD@postgres:5432/movelcarente?schema=public
     ```
     ```sh
     docker compose --profile local-db up
     ```
   - Para rodar todos os 5 serviços juntos:
     ```sh
     docker compose --profile full up
     ```

---

## Guia de Deploy (2 Abordagens)

Dependendo de onde você pretende hospedar a aplicação, escolha a abordagem mais adequada:

```
 ┌──────────────────────────────────────────────┐
 │              Banco de Dados                  │
 │             PostgreSQL (Supabase)            │
 └──────────────────────┬───────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          │                           │
          ▼                           ▼
┌───────────────────┐      ┌────────────────────┐
│   Abordagem 1     │      │    Abordagem 2     │
│  (Recomendada)    │      │    (100% Docker)   │
│ Front: Vercel     │      │ VPS / Servidor     │
│ API: Railway      │      │ Docker Compose     │
│ Worker: Railway   │      │ Nginx+Node+Redis   │
│ Redis: Railway    │      │ +Worker            │
└───────────────────┘      └────────────────────┘
```

---

###  Abordagem 1: Front-end na Vercel + API no Railway/Render (Recomendada)

> [!TIP]
> **Por que é a mais recomendada?**
> A Vercel entrega o Front-end estático com altíssima performance (CDN global), enquanto serviços de container como **Railway** ou **Render** mantêm a API e o **Socket.IO (Chat em Tempo Real)** rodando de forma contínua com conexões WebSocket persistentes.

#### Passo 1: Banco de Dados no Supabase
1. Crie seu projeto no [Supabase](https://supabase.com).
2. Em **Project Settings > Database**, copie:
   - `DATABASE_URL` (porta `6543`, Transaction Pooler).
   - `DIRECT_URL` (porta `5432`, Session Pooler para migrations).

#### Passo 2: API e Redis no Railway
1. Acesse o [Railway.app](https://railway.app) e crie um **New Project**.
2. Adicione um banco **Redis** com 1 clique.
3. Clique em **New > GitHub Repo** e selecione o repositório do projeto:
   - Em **Settings > Root Directory**, defina: `/api`.
   - O Railway detectará o `api/Dockerfile` automaticamente.
4. Em **Variables**, configure:
   ```env
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=sua_connection_string_do_supabase?pgbouncer=true
   DIRECT_URL=sua_direct_string_do_supabase
   REDIS_HOST=${{Redis.REDISHOST}}
   REDIS_PORT=${{Redis.REDISPORT}}
   JWT_SECRET=gere_uma_chave_secreta_com_mais_de_32_caracteres
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   CORS_ORIGIN=https://seu-front.vercel.app
   FRONTEND_URL=https://seu-front.vercel.app
   COOKIE_CROSS_SITE=true
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=seu_email@gmail.com
   SMTP_PASS=sua_senha_de_app
   SMTP_FROM=MóvelCarente <nao-responda@movelcarente.com.br>
   ```
   > `COOKIE_CROSS_SITE=true` é necessário porque o front (Vercel) e a API (Railway) ficam em domínios diferentes; sem ele o cookie de refresh não é enviado e o login cai ao recarregar a página.
5. Gere um domínio público para a API em **Settings > Networking > Generate Domain** (ex: `https://api-movelcarente.up.railway.app`).

#### Passo 3: Worker de e-mails no Railway
Sem o worker nenhum e-mail (verificação de conta, recuperação de senha) é enviado.
1. No mesmo projeto, clique em **New > GitHub Repo** e selecione o mesmo repositório (**Root Directory**: `/api`).
2. Em **Settings > Deploy > Custom Start Command**, defina: `npm run worker:email`.
3. Em **Variables**, copie do serviço da API: `DATABASE_URL`, `DIRECT_URL`, `REDIS_HOST`, `REDIS_PORT` e as variáveis `SMTP_*`.

#### Passo 4: Front-end na Vercel
1. Acesse a [Vercel](https://vercel.com) e clique em **Add New > Project**.
2. Importe o repositório do GitHub.
3. Configure o projeto:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `front-end`
4. Em **Environment Variables**, adicione:
   ```env
   VITE_API_URL=https://api-movelcarente.up.railway.app
   ```
5. Clique em **Deploy**.

---

### Abordagem 2: 100% Docker em VPS / Servidor em Nuvem

Ideal para hospedar tudo em uma única máquina virtual própria (DigitalOcean, AWS EC2, Hetzner, Linode, Oracle Cloud, etc.).

#### Passo 1: Preparar o Servidor
No terminal da sua VPS (Ubuntu/Debian):
```bash
# 1. Atualizar pacotes e instalar Docker + Git
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 git

# 2. Permitir executar docker sem sudo (opcional)
sudo usermod -aG docker $USER
newgrp docker
```

#### Passo 2: Clonar o Repositório e Configurar
```bash
# 1. Clonar o projeto
git clone https://github.com/Arthur-Stellato/Projeto-Movel-Carente.git
cd Projeto-Movel-Carente

# 2. Criar o arquivo de ambiente na raiz
cp .env.docker.example .env
nano .env
```
Preencha o `.env` com suas credenciais do Supabase, SMTP e JWT_SECRET.

#### Passo 3: Iniciar a Aplicação
```bash
docker compose up -d --build
```

- O Front-end estará respondendo na porta `8080` (Nginx).
- A API estará na porta `3000`.
- O Nginx já faz o proxy reverso interno para `/api/` e `/socket.io/`, eliminando qualquer problema de CORS.

*(Opcional: Aponte um domínio e configure o Certbot / Let's Encrypt para HTTPS na porta 80/443)*.

---

## Tabela Comparativa das Abordagens

| Recurso / Requisito | Abordagem 1 (Vercel + Railway) | Abordagem 2 (100% Docker / VPS) |
| :--- | :---: | :---: |
| **Dificuldade de Setup** | Fácil | Média |
| **Custo Inicial** | Gratuito / Muito Baixo | ~\$4 - \$6/mês (VPS) |
| **Chat em Tempo Real (Socket.IO)** | ✅ 100% Funcional | ✅ 100% Funcional |
| **Worker de E-mails Contínuo** | ✅ Suportado | ✅ Suportado |
| **Manutenção de Servidor** | Zero (Gerenciado) | Você gerencia o Linux |
| **Banco de Dados** | Supabase | Supabase ou Local |

---

## Comandos Úteis

```sh
# Aplicar as migrations no banco em desenvolvimento (rode dentro de api/):
npx prisma migrate dev

# Em produção, aplica só as migrations pendentes (rode dentro de api/):
npx prisma migrate deploy

# Não use "prisma db push": ele pula o SQL das migrations (PostGIS, unaccent).

# Gerar o Prisma Client após alterações no schema:
npx prisma generate

# Executar testes da API:
npm test

# Build de produção do Front-end:
npm run build
```
