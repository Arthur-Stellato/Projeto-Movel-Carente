import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { authService } from '../services/auth.service';
import { usuarioService } from '../services/usuario.service';
import { aoDeslogar, tentarRenovarToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const jaInicializou = useRef(false);

  useEffect(() => {
    // Guarda contra o efeito rodando duas vezes (StrictMode, em desenvolvimento).
    // Importante: por isso NÃO uso mais aqui o padrão de cleanup com uma flag
    // "cancelado" (comum em efeitos de fetch) — o StrictMode chama o cleanup da
    // 1ª execução logo depois de montá-la, pra simular um unmount. Isso marcaria
    // "cancelado" como true bem no meio do trabalho de verdade (a 1ª execução,
    // que é a que realmente busca a sessão), e o setCarregando(false) no finally
    // nunca rodaria — sessão eternamente "verificando", o loop infinito que
    // apareceu na tela de login. Com o guard por ref abaixo, a 2ª invocação do
    // StrictMode já nem entra no corpo do efeito, então não existe mais uma
    // segunda execução pra precisar cancelar.
    if (jaInicializou.current) return;
    jaInicializou.current = true;

    // Ao carregar o app, tenta trocar o cookie httpOnly refreshToken (se existir)
    // por um novo access token — assim a sessão sobrevive a um F5 sem precisar
    // logar de novo. Se não houver cookie válido, falha silenciosamente (visitante).
    // Usa a MESMA função deduplicada do interceptor (tentarRenovarToken), não
    // authService.refresh() direto — ver comentário em services/api.js sobre por
    // que uma segunda chamada concorrente de /auth/refresh derrubava a sessão.
    (async () => {
      try {
        await tentarRenovarToken();
        const perfil = await usuarioService.buscarPerfil();
        setUsuario(perfil);
      } catch {
        // Sem sessão ativa — segue como visitante, sem mostrar erro.
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  useEffect(() => aoDeslogar(() => setUsuario(null)), []);

  const login = useCallback(async (email, senha) => {
    const perfil = await authService.login(email, senha);
    setUsuario(perfil);
    return perfil;
  }, []);

  const registrar = useCallback(async (dados) => authService.registrar(dados), []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUsuario(null);
  }, []);

  const atualizarUsuario = useCallback((parcial) => {
    setUsuario((atual) => (atual ? { ...atual, ...parcial } : atual));
  }, []);

  const valor = {
    usuario,
    carregando,
    logado: Boolean(usuario),
    ehAdmin: usuario?.tipo === 'admin',
    login,
    registrar,
    logout,
    atualizarUsuario,
  };

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth precisa estar dentro de um AuthProvider');
  return contexto;
}
