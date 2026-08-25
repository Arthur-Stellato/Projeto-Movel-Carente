import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import { categoriaService } from '../../services/categoria.service';
import { usuarioService } from '../../services/usuario.service';
import { itemService } from '../../services/item.service';
import { mensagemDeErro } from '../../services/api';
import { CONDICOES_ITEM } from '../../constants';
import ImagemUploader from './ImagemUploader';

const VAZIO = { titulo: '', descricao: '', categoriaId: '', condicao: 'usado', enderecoId: '' };

export default function ItemFormModal({ show, onHide, item, onSalvo }) {
  const [form, setForm] = useState(VAZIO);
  const [categorias, setCategorias] = useState([]);
  const [enderecos, setEnderecos] = useState([]);
  const [carregandoEnderecos, setCarregandoEnderecos] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Enquanto null: ainda não existe (modo criação, antes do 1º salvar). Assim
  // que existir (edição desde o início, ou logo após criar com sucesso), a
  // seção de fotos aparece — sem precisar sair do modal pra outra tela.
  const [itemAtual, setItemAtual] = useState(item);

  const jaExiste = Boolean(itemAtual);

  useEffect(() => {
    if (!show) return;
    setErro('');
    setItemAtual(item);
    setForm(
      item
        ? {
            titulo: item.titulo,
            descricao: item.descricao,
            categoriaId: item.categoria?.id || item.categoriaId || '',
            condicao: item.condicao,
            enderecoId: item.enderecoId || '',
          }
        : VAZIO
    );
    categoriaService.listar().then(setCategorias).catch(() => setCategorias([]));
    setCarregandoEnderecos(true);
    usuarioService
      .listarEnderecos()
      .then((lista) => {
        setEnderecos(lista);
        // Pré-seleciona o endereço principal quando ainda não há nenhum escolhido —
        // poupa um clique no caso (comum) de só existir um endereço cadastrado.
        if (!item) {
          const principal = lista.find((e) => e.principal) || lista[0];
          if (principal) setForm((atual) => ({ ...atual, enderecoId: atual.enderecoId || principal.id }));
        }
      })
      .catch(() => setEnderecos([]))
      .finally(() => setCarregandoEnderecos(false));
  }, [show, item]);

  function atualizarCampo(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvar(evento) {
    evento.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      const enderecoSelecionado = enderecos.find((e) => e.id === form.enderecoId);
      const payload = {
        titulo: form.titulo,
        descricao: form.descricao,
        categoriaId: form.categoriaId,
        condicao: form.condicao,
        enderecoId: form.enderecoId,
        cidade: enderecoSelecionado?.cidade,
        estado: enderecoSelecionado?.estado,
      };

      if (jaExiste) {
        const atualizado = await itemService.atualizar(itemAtual.id, payload);
        const mesclado = { ...itemAtual, ...atualizado };
        setItemAtual(mesclado);
        onSalvo(mesclado);
      } else {
        const criado = await itemService.criar(payload);
        setItemAtual(criado);
        onSalvo(criado);
      }
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setSalvando(false);
    }
  }

  function aoAtualizarImagens(imagens) {
    setItemAtual((atual) => {
      const atualizado = { ...atual, imagens };
      onSalvo(atualizado);
      return atualizado;
    });
  }

  const semEnderecoCadastrado = !carregandoEnderecos && enderecos.length === 0;

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title as="h5">{jaExiste ? (item ? 'Editar item' : 'Item anunciado!') : 'Anunciar novo item'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {erro && <Alert variant="danger">{erro}</Alert>}

        {semEnderecoCadastrado ? (
          <Alert variant="light" className="border">
            <i className="bi bi-geo-alt me-2" />
            Você precisa cadastrar um endereço antes de anunciar um item — é dele que vem a localização
            usada na busca por proximidade, e o endereço de retirada combinado com quem solicitar.
            <div className="mt-3">
              <Button as={Link} to="/painel/perfil/enderecos" target="_blank" rel="noopener noreferrer" variant="primary" size="sm">
                <i className="bi bi-plus-lg me-1" /> Cadastrar endereço
              </Button>
            </div>
          </Alert>
        ) : (
          <Form onSubmit={salvar}>
            <Form.Group className="mb-3">
              <Form.Label>Título</Form.Label>
              <Form.Control
                value={form.titulo}
                maxLength={150}
                onChange={(e) => atualizarCampo('titulo', e.target.value)}
                placeholder="Ex: Sofá de 3 lugares em bom estado"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Descrição</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={form.descricao}
                onChange={(e) => atualizarCampo('descricao', e.target.value)}
                placeholder="Conte o estado do item, medidas, motivo da doação..."
                required
              />
            </Form.Group>

            <Row>
              <Col md={7} className="mb-3">
                <Form.Label>Categoria</Form.Label>
                <Form.Select value={form.categoriaId} onChange={(e) => atualizarCampo('categoriaId', e.target.value)} required>
                  <option value="">Selecione...</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={5} className="mb-3">
                <Form.Label>Condição</Form.Label>
                <Form.Select value={form.condicao} onChange={(e) => atualizarCampo('condicao', e.target.value)}>
                  {CONDICOES_ITEM.map((c) => (
                    <option key={c.valor} value={c.valor}>
                      {c.rotulo}
                    </option>
                  ))}
                </Form.Select>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Endereço de retirada</Form.Label>
              <Form.Select value={form.enderecoId} onChange={(e) => atualizarCampo('enderecoId', e.target.value)} required>
                <option value="">Selecione um endereço...</option>
                {enderecos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.tipo ? `${e.tipo} — ` : ''}
                    {e.logradouro}, {e.cidade}/{e.estado}
                    {e.principal ? ' (principal)' : ''}
                  </option>
                ))}
              </Form.Select>
              <Form.Text>
                Obrigatório — define a localização do item na busca e o endereço combinado com quem solicitar.{' '}
                <Link to="/painel/perfil/enderecos" target="_blank" rel="noopener noreferrer">
                  Gerenciar endereços
                </Link>
              </Form.Text>
            </Form.Group>

            <Button type="submit" variant="primary" disabled={salvando} className="w-100">
              {salvando && <Spinner animation="border" size="sm" className="me-2" />}
              {jaExiste ? 'Salvar alterações' : 'Anunciar item'}
            </Button>
          </Form>
        )}

        {jaExiste && (
          <div className="mt-4 pt-3 border-top">
            <strong className="d-block mb-2">Fotos do item</strong>
            <ImagemUploader item={itemAtual} onAtualizado={aoAtualizarImagens} />
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant={jaExiste ? 'primary' : 'outline-secondary'} onClick={onHide}>
          {jaExiste ? 'Concluir' : 'Cancelar'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
