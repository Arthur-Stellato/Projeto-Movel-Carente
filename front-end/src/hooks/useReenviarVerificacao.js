import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authService } from '../services/auth.service';
import { mensagemDeErro } from '../services/api';

// Diferente do fluxo de Login.jsx (que pede reenvio ANTES de logar, com o email
// digitado no formulário) — aqui o usuário já está autenticado, então pegamos o
// email direto da sessão em vez de pedir pra digitar de novo.
export function useReenviarVerificacao() {
  const { usuario } = useAuth();
  const { mostrar } = useToast();

  return useCallback(async () => {
    try {
      await authService.reenviarVerificacao(usuario.email);
      mostrar('Enviamos um novo link de verificação para seu email.');
    } catch (err) {
      mostrar(mensagemDeErro(err), 'erro');
    }
  }, [usuario, mostrar]);
}
