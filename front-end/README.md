# MóvelCarente — Front-end

Protótipo funcional em React + Vite, **conectado à API real** (não é mockado).
Consome diretamente os endpoints do backend em `../api`.

## Stack

- React 19 + Vite
- React Router 7
- React-Bootstrap 5 + Bootstrap Icons
- Axios

## Como rodar

1. Instale as dependências:

   ```
   npm install
   ```

2. Confirme o `.env` (já vem criado a partir de `.env.example`):

   ```
   VITE_API_URL="http://localhost:3000"
   ```

3. Suba o backend (`../api`) — Postgres, Redis e `npm run dev` lá — **antes** de
   usar o front-end, já que não há nenhuma camada de mock aqui.

4. Rode o front-end:

   ```
   npm run dev
   ```

   Acesse `http://localhost:5173`.

## Como a autenticação funciona

- O **access token** (JWT curto) fica só em memória, dentro de
  `src/services/api.js` — nunca em `localStorage`.
- O **refresh token** vive num cookie `httpOnly` que o próprio backend seta
  (`../api/src/lib/cookies.js`) — o axios está configurado com
  `withCredentials: true` pra isso funcionar.
- Ao carregar o app, `AuthContext` tenta silenciosamente um
  `POST /auth/refresh` pra restaurar a sessão sem precisar logar de novo.
- Se qualquer chamada tomar 401, o interceptor em `api.js` tenta renovar o
  token uma vez e repete a requisição original antes de desistir e deslogar.

## Estrutura

```
src/
  services/     — um arquivo por recurso da API (auth, item, solicitacao...),
                  todos finos sobre src/services/api.js
  context/      — AuthContext (sessão) e ToastContext (feedback visual)
  components/   — layout, componentes comuns e componentes por domínio
  pages/        — uma pasta por área (auth, itens, solicitacoes, perfil...)
  constants.js  — espelha os enums fixos do backend (UFs, status, motivos)
  theme.css     — tokens de design (paleta, tipografia) sobre o Bootstrap
```

## O que está implementado

Autenticação (login/registro/logout/sessão persistente), busca de itens
(filtros, paginação, busca por raio via geolocalização do navegador),
CRUD de itens com upload real de imagens, solicitações (pedir, aceitar,
recusar, cancelar, concluir), avaliações bidirecionais com a janela de
revelação double-blind, favoritos, notificações, perfil e endereços (com
autopreenchimento por CEP), denúncias, e as telas administrativas de
categorias, denúncias e usuários.

## Próximos passos possíveis

- Verificação de email / recuperação de senha (endpoints já existem em
  `auth.service.js`, só faltam as telas)
- Paginação/infinite scroll na galeria de imagens do item
- Testes de componente (Vitest + Testing Library)
