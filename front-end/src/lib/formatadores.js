export function formatarTempoRelativo(dataIso) {
  const diffMs = Date.now() - new Date(dataIso).getTime();
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 1) return 'agora mesmo';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  return new Date(dataIso).toLocaleDateString('pt-BR');
}

export function formatarData(dataIso) {
  return new Date(dataIso).toLocaleDateString('pt-BR');
}

export function formatarCpf(cpf) {
  const digitos = String(cpf || '').replace(/\D/g, '').slice(0, 11);
  return digitos
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function formatarCnpj(cnpj) {
  const limpo = String(cnpj || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 14);
  return limpo
    .replace(/^([0-9A-Z]{2})([0-9A-Z])/, '$1.$2')
    .replace(/^([0-9A-Z]{2})\.([0-9A-Z]{3})([0-9A-Z])/, '$1.$2.$3')
    .replace(/\.([0-9A-Z]{3})([0-9A-Z])/, '.$1/$2')
    .replace(/\/([0-9A-Z]{4})([0-9A-Z])/, '/$1-$2');
}
