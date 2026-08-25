jest.mock('nodemailer');

const nodemailer = require('nodemailer');
const { enviarEmail } = require('../../src/lib/email');

const ENV_SMTP = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];

describe('enviarEmail', () => {
  let sendMailMock;

  beforeEach(() => {
    jest.clearAllMocks(); // sem isso, o histórico de chamadas de createTransport vaza de um teste pro outro
    ENV_SMTP.forEach((chave) => delete process.env[chave]);
    sendMailMock = jest.fn().mockResolvedValue({ messageId: 'msg-1' });
    nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock });
  });

  describe('validação de entrada', () => {
    test('rejeita sem "para"', async () => {
      await expect(enviarEmail({ assunto: 'Oi', texto: 'corpo' })).rejects.toThrow(/para.*assunto.*html.*texto/i);
    });

    test('rejeita sem "assunto"', async () => {
      await expect(enviarEmail({ para: 'a@b.com', texto: 'corpo' })).rejects.toThrow(/para.*assunto.*html.*texto/i);
    });

    test('rejeita sem "html" nem "texto"', async () => {
      await expect(enviarEmail({ para: 'a@b.com', assunto: 'Oi' })).rejects.toThrow(/para.*assunto.*html.*texto/i);
    });

    test('aceita só com "html" (sem "texto")', async () => {
      process.env.SMTP_HOST = 'smtp.exemplo.com';
      await expect(enviarEmail({ para: 'a@b.com', assunto: 'Oi', html: '<p>corpo</p>' })).resolves.toBeUndefined();
    });
  });

  describe('sem SMTP configurado (fallback de desenvolvimento)', () => {
    test('não chama o nodemailer e resolve normalmente', async () => {
      await expect(
        enviarEmail({ para: 'joana@example.com', assunto: 'Verifique seu email', texto: 'Clique no link' })
      ).resolves.toBeUndefined();

      expect(nodemailer.createTransport).not.toHaveBeenCalled();
      expect(sendMailMock).not.toHaveBeenCalled();
    });
  });

  describe('com SMTP configurado', () => {
    beforeEach(() => {
      process.env.SMTP_HOST = 'smtp.exemplo.com';
      process.env.SMTP_PORT = '587';
    });

    test('chama sendMail com os campos corretos', async () => {
      await enviarEmail({ para: 'joana@example.com', assunto: 'Verifique seu email', html: '<p>oi</p>', texto: 'oi' });

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'joana@example.com',
          subject: 'Verifique seu email',
          html: '<p>oi</p>',
          text: 'oi',
        })
      );
    });

    test('usa remetente padrão quando SMTP_FROM não está definido', async () => {
      await enviarEmail({ para: 'a@b.com', assunto: 'Oi', texto: 'corpo' });
      expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({ from: expect.stringContaining('MóvelCarente') }));
    });

    test('usa SMTP_FROM quando definido', async () => {
      process.env.SMTP_FROM = '"Suporte MC" <suporte@movelcarente.com.br>';
      await enviarEmail({ para: 'a@b.com', assunto: 'Oi', texto: 'corpo' });
      expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({ from: '"Suporte MC" <suporte@movelcarente.com.br>' }));
    });

    test('não envia auth quando SMTP_USER não está definido (servidor de captura local)', async () => {
      await enviarEmail({ para: 'a@b.com', assunto: 'Oi', texto: 'corpo' });
      expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ auth: undefined }));
    });

    test('monta auth quando SMTP_USER está definido', async () => {
      process.env.SMTP_USER = 'usuario';
      process.env.SMTP_PASS = 'senha';
      await enviarEmail({ para: 'a@b.com', assunto: 'Oi', texto: 'corpo' });
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ auth: { user: 'usuario', pass: 'senha' } })
      );
    });

    test('secure=true só quando SMTP_SECURE="true"', async () => {
      process.env.SMTP_SECURE = 'true';
      await enviarEmail({ para: 'a@b.com', assunto: 'Oi', texto: 'corpo' });
      expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: true }));
    });

    test('propaga o erro original quando o SMTP falha (pro BullMQ poder tentar de novo)', async () => {
      const erroSmtp = new Error('Connection refused');
      erroSmtp.code = 'ECONNREFUSED';
      sendMailMock.mockRejectedValue(erroSmtp);

      await expect(enviarEmail({ para: 'a@b.com', assunto: 'Oi', texto: 'corpo' })).rejects.toBe(erroSmtp);
    });
  });
});