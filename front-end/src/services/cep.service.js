import { api } from './api';

async function buscar(cep) {
  const { data } = await api.get(`/cep/${cep}`);
  return data.endereco;
}

export const cepService = { buscar };
