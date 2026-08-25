import { useRef, useState } from 'react';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Alert from 'react-bootstrap/Alert';
import { itemService } from '../../services/item.service';
import { resolverUrlImagem, mensagemDeErro } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import ConfirmModal from '../common/ConfirmModal';

const LIMITE_IMAGENS = 10;

export default function ImagemUploader({ item, onAtualizado }) {
  const inputRef = useRef(null);
  const { mostrar } = useToast();
  const [progresso, setProgresso] = useState(null);
  const [erro, setErro] = useState('');
  const [imagemParaRemover, setImagemParaRemover] = useState(null);
  const [removendo, setRemovendo] = useState(false);

  const imagens = item.imagens || [];
  const vagasRestantes = LIMITE_IMAGENS - imagens.length;

  async function aoEscolherArquivos(evento) {
    const arquivos = Array.from(evento.target.files || []);
    evento.target.value = '';
    if (arquivos.length === 0) return;

    if (arquivos.length > vagasRestantes) {
      setErro(`Este item já tem ${imagens.length} imagem(ns). Só é possível enviar mais ${vagasRestantes}.`);
      return;
    }

    setErro('');
    setProgresso(0);
    try {
      const novasImagens = await itemService.enviarImagens(item.id, arquivos, setProgresso);
      onAtualizado(novasImagens);
      mostrar('Imagens enviadas com sucesso.');
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setProgresso(null);
    }
  }

  async function confirmarRemocao() {
    setRemovendo(true);
    try {
      await itemService.removerImagem(item.id, imagemParaRemover.id);
      onAtualizado(imagens.filter((img) => img.id !== imagemParaRemover.id));
      mostrar('Imagem removida.');
      setImagemParaRemover(null);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <div>
      {erro && <Alert variant="danger" onClose={() => setErro('')} dismissible>{erro}</Alert>}

      <div className="d-flex flex-wrap gap-2 mb-3">
        {imagens.map((img) => (
          <div key={img.id} className="position-relative" style={{ width: 110, height: 110 }}>
            <img
              src={resolverUrlImagem(img.url)}
              alt="Imagem do item"
              className="w-100 h-100 rounded border"
              style={{ objectFit: 'cover' }}
            />
            <button
              type="button"
              className="btn btn-danger btn-sm position-absolute top-0 end-0 m-1 rounded-circle d-flex align-items-center justify-content-center p-0"
              style={{ width: 24, height: 24 }}
              onClick={() => setImagemParaRemover(img)}
              aria-label="Remover imagem"
            >
              <i className="bi bi-x" />
            </button>
          </div>
        ))}

        {vagasRestantes > 0 && (
          <button
            type="button"
            className="d-flex flex-column align-items-center justify-content-center border border-2 border-dashed rounded text-secondary bg-transparent"
            style={{ width: 110, height: 110, borderStyle: 'dashed' }}
            onClick={() => inputRef.current?.click()}
          >
            <i className="bi bi-cloud-upload fs-4" />
            <span className="small mt-1">Adicionar</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="d-none"
        onChange={aoEscolherArquivos}
      />

      {progresso !== null && <ProgressBar now={progresso} label={`${progresso}%`} className="mb-2" />}

      <div className="small text-secondary">
        {imagens.length}/{LIMITE_IMAGENS} imagens · JPEG, PNG ou WebP, até 5MB cada
      </div>

      <ConfirmModal
        show={Boolean(imagemParaRemover)}
        onHide={() => setImagemParaRemover(null)}
        onConfirm={confirmarRemocao}
        carregando={removendo}
        titulo="Remover imagem"
        mensagem="Tem certeza que quer remover esta imagem do item? O arquivo será apagado."
        textoConfirmar="Remover"
      />
    </div>
  );
}
