const NOME_COOKIE_REFRESH = 'refreshToken';
const REFRESH_TOKEN_DIAS = 7; // mesmo valor de REFRESH_TOKEN_DIAS em auth.service.js

// path: '/auth' — o navegador só anexa esse cookie em requisições pra /auth/*
// (login, refresh, logout...). Reduz a superfície de CSRF: o cookie nem é enviado
// em requisições pra /itens, /usuarios, etc, então não tem o que um site malicioso
// explorar ali mesmo que consiga disparar uma requisição.
//
// sameSite: 'lax' — cobre o caso comum de frontend e backend em subdomínios ou
// portas diferentes do mesmo domínio "site" (ex: localhost:3000 + localhost:3001,
// ou app.dominio.com + api.dominio.com). Se um dia o frontend for hospedado num
// domínio TOTALMENTE diferente do backend (ex: Vercel + Render em domínios
// distintos, ou dois túneis ngrok com subdomínios aleatórios), 'lax' não é
// suficiente — nesse caso precisa de 'none' + secure:true. É exatamente pra
// esse cenário que existe o COOKIE_CROSS_SITE abaixo, em vez de acoplar isso
// ao NODE_ENV (que controla outras coisas, como verbosidade de log e stack
// trace de erro, sem relação com domínio cross-site).
//
// ATENÇÃO: sameSite:'none' por si só é uma troca real de segurança — cookies
// "none" são enviados em bem mais cenários cross-site, o que amplia a
// superfície de CSRF, e este projeto não tem um token CSRF dedicado (o
// path:'/auth' abaixo já reduz bastante essa superfície, mas não elimina).
// Serve bem pra destravar uma demo cross-network com alguém de confiança;
// não é o suficiente, sozinho, pra um deploy público de verdade em domínios
// diferentes — aí entraria um token CSRF de verdade também.
//
// secure: obrigatório junto de sameSite:'none' (o navegador descarta um cookie
// "none" sem "secure"). Em desenvolvimento local puro (http://localhost, sem
// HTTPS) teria que ficar false — mas um túnel (ngrok, Cloudflare Tunnel) serve
// HTTPS de verdade pro navegador mesmo redirecionando pra HTTP local, então
// secure:true funciona normalmente nesse caso.
function opcoesCookieRefresh() {
  const crossSite = process.env.COOKIE_CROSS_SITE === 'true';
  return {
    httpOnly: true,
    secure: crossSite || process.env.NODE_ENV === 'production',
    sameSite: crossSite ? 'none' : 'lax',
    path: '/auth',
    maxAge: REFRESH_TOKEN_DIAS * 24 * 60 * 60 * 1000,
  };
}

function definirCookieRefreshToken(res, refreshToken) {
  res.cookie(NOME_COOKIE_REFRESH, refreshToken, opcoesCookieRefresh());
}

// clearCookie precisa receber as MESMAS opções de path/sameSite/secure usadas ao
// criar o cookie (exceto maxAge/expires) — senão o navegador não reconhece como o
// mesmo cookie e não limpa nada.
function limparCookieRefreshToken(res) {
  const { maxAge, ...opcoesSemMaxAge } = opcoesCookieRefresh();
  res.clearCookie(NOME_COOKIE_REFRESH, opcoesSemMaxAge);
}

module.exports = { NOME_COOKIE_REFRESH, definirCookieRefreshToken, limparCookieRefreshToken };