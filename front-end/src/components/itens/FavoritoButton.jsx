import { useState } from 'react';
import { favoritoService } from '../../services/favorito.service';
import { mensagemDeErro } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export default function FavoritoButton({ itemId, favoritado, onMudar, tamanho = '1.1rem' }) {
  const { mostrar } = useToast();
  const [carregando, setCarregando] = useState(false);

  async function alternar(evento) {
    evento.preventDefault();
    evento.stopPropagation();
    if (carregando) return;
    setCarregando(true);
    try {
      if (favoritado) {
        await favoritoService.remover(itemId);
        onMudar(itemId, false);
      } else {
        await favoritoService.adicionar(itemId);
        onMudar(itemId, true);
        mostrar('Adicionado aos favoritos.');
      }
    } catch (err) {
      mostrar(mensagemDeErro(err), 'erro');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={carregando}
      className="btn btn-light border rounded-circle d-flex align-items-center justify-content-center p-0"
      style={{ width: 36, height: 36, color: favoritado ? 'var(--mc-tijolo-600)' : 'var(--mc-tinta-suave)' }}
      aria-label={favoritado ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      aria-pressed={favoritado}
    >
      <i className={`bi ${favoritado ? 'bi-heart-fill' : 'bi-heart'}`} style={{ fontSize: tamanho }} />
    </button>
  );
}
