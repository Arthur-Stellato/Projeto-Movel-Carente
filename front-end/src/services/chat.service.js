import { io } from 'socket.io-client';
import { api, API_URL, getAccessToken } from './api';

export const chatService = {
  async buscarMensagens(solicitacaoId) {
    const resposta = await api.get(`/solicitacoes/${solicitacaoId}/mensagens`);
    return resposta.data;
  },

  async enviarMensagem(solicitacaoId, conteudo) {
    const resposta = await api.post(`/solicitacoes/${solicitacaoId}/mensagens`, { conteudo });
    return resposta.data.mensagem;
  },

  conectarSocket() {
    const token = getAccessToken();
    return io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
  },
};
