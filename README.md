# MóvelCarente — Plataforma de Doação de Móveis

Plataforma colaborativa para conectar doadores de móveis e utensílios domésticos a pessoas e famílias que precisam.

---

## 🛠️ Tecnologias Utilizadas

- **Front-end**: React, Vite, Bootstrap, React Router, Socket.IO Client.
- **Back-end**: Node.js, Express, Prisma ORM, Socket.IO, BullMQ, Joi, JWT, Helmet.
- **Banco de Dados**: PostgreSQL (Supabase na nuvem ou local via Docker).
- **Cache e Filas**: Redis (rate limiting e fila de e-mails em background).
- **Infraestrutura**: Docker, Docker Compose, Nginx.

---

## 🚀 Como Executar Localmente com Docker

O projeto está configurado para rodar por padrão em **3 containers**, utilizando o banco de dados **Supabase** na nuvem:
1. `api-movelcarente` (porta `3000`)
2. `frontend-movelcarente` (porta `8080`)
3. `redis-movelcarente` (porta `6379`)

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
   - Para rodar também o worker de processamento de e-mails:
     ```sh
     docker compose --profile worker up
     ```
   - Para rodar com um PostgreSQL local (sem Supabase):
     ```sh
     docker compose --profile local-db up
     ```
   - Para rodar todos os 5 serviços juntos:
     ```sh
     docker compose --profile full up
     ```

---

## 🌐 Guia de Deploy (3 Abordagens)

Dependendo de onde você pretende hospedar a aplicação, escolha a abordagem mais adequada:

```
                  ┌──────────────────────────────────────────────┐
                  │              Banco de Dados                  │
                  │             PostgreSQL (Supabase)            │
                  └──────────────┬───────────────────────────────┘
                                 │
         ┌───────────────────────┼────────────────────────┐
         │                       │                        │
         ▼                       ▼                        ▼
┌───────────────────┐  ┌────────────────────┐   ┌───────────────────┐
│   Abordagem 1     │  │    Abordagem 2     │   │    Abordagem 3    │
│  (Recomendada)    │  │    (100% Docker)   │   │   (100% Vercel)   │
│ Front: Vercel     │  │ VPS / Servidor     │   │ Front: Vercel     │
│ API: Railway      │  │ Docker Compose     │   │ API: Vercel       │
│ Redis: Railway    │  │ Nginx + Node + Redis│  │ (Serverless)      │
└───────────────────┘  └────────────────────┘   └───────────────────┘
```

---

### 🌟 Abordagem 1: Front-end na Vercel + API no Railway/Render (Recomendada)

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
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=seu_email@gmail.com
   SMTP_PASS=sua_senha_de_app
   SMTP_FROM=MóvelCarente <nao-responda@movelcarente.com.br>
   ```
5. Gere um domínio público para a API em **Settings > Networking > Generate Domain** (ex: `https://api-movelcarente.up.railway.app`).

#### Passo 3: Front-end na Vercel
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

### 🐳 Abordagem 2: 100% Docker em VPS / Servidor em Nuvem

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
cd Projeto-Movel-Carente/Projeto-Movel-Carente

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

### ⚡ Abordagem 3: Dois Projetos na Vercel (Front-end + API Serverless)

Ideal se você deseja uma hospedagem 100% gratuita na Vercel sem gerenciar nenhum servidor.

> [!WARNING]
> **Limitações importantes desta abordagem:**
> 1. **Chat em Tempo Real (Socket.IO)**: A Vercel executa código em funções *Serverless* efêmeras, que não suportam conexões WebSocket persistentes. O chat em tempo real exigirá fallback para requisições REST ou um serviço externo de WebSockets.
> 2. **Processos Contínuos (Worker)**: O worker de e-mails em background não roda de forma contínua na Vercel.
> 3. Todas as demais funções (Cadastro, Login, Catálogo de Itens, Doações, Avaliações, etc.) funcionam normalmente.

#### Passo 1: Criar o Projeto da API na Vercel
1. Importe o repositório na Vercel.
2. Nome do projeto: `movelcarente-api`.
3. **Root Directory**: `api`.
4. A Vercel detectará automaticamente as configurações do arquivo [`api/vercel.json`](file:///c:/Users/Yonit/OneDrive/Documentos/GitHub/Projeto-Movel-Carente/Projeto-Movel-Carente/api/vercel.json).
5. Em **Environment Variables**, adicione:
   ```env
   DATABASE_URL=sua_connection_string_supabase?pgbouncer=true
   DIRECT_URL=sua_direct_string_supabase
   JWT_SECRET=seu_segredo_jwt_de_32_caracteres
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   CORS_ORIGIN=https://seu-front.vercel.app
   FRONTEND_URL=https://seu-front.vercel.app
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=seu_email@gmail.com
   SMTP_PASS=sua_senha_de_app
   SMTP_FROM=MóvelCarente <nao-responda@movelcarente.com.br>
   COOKIE_CROSS_SITE=true
   ```
6. Faça o Deploy e copie a URL gerada (ex: `https://movelcarente-api.vercel.app`).

#### Passo 2: Criar o Projeto do Front-end na Vercel
1. No painel da Vercel, clique em **Add New > Project**.
2. Importe o mesmo repositório.
3. Nome do projeto: `movelcarente-front`.
4. **Root Directory**: `front-end`.
5. **Framework Preset**: `Vite`.
6. Em **Environment Variables**, adicione:
   ```env
   VITE_API_URL=https://movelcarente-api.vercel.app
   ```
7. Clique em **Deploy**.

---

## 📋 Tabela Comparativa das Abordagens

| Recurso / Requisito | Abordagem 1 (Vercel + Railway) | Abordagem 2 (100% Docker / VPS) | Abordagem 3 (100% Vercel) |
| :--- | :---: | :---: | :---: |
| **Dificuldade de Setup** | Fácil | Média | Muito Fácil |
| **Custo Inicial** | Gratuito / Muito Baixo | ~\$4 - \$6/mês (VPS) | Gratuito |
| **Chat em Tempo Real (Socket.IO)** | ✅ 100% Funcional | ✅ 100% Funcional | ⚠️ Limitado (Serverless) |
| **Worker de E-mails Contínuo** | ✅ Suportado | ✅ Suportado | ❌ Não suportado |
| **Manutenção de Servidor** | Zero (Gerenciado) | Você gerencia o Linux | Zero (Serverless) |
| **Banco de Dados** | Supabase | Supabase ou Local | Supabase |

---

## 🛠️ Comandos Úteis

```sh
# Sincronizar o banco de dados com o schema do Prisma:
npx prisma db push

# Gerar o Prisma Client após alterações no schema:
npx prisma generate

# Executar testes da API:
npm test

# Build de produção do Front-end:
npm run build
```

