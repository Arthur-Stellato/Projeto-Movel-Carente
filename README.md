# MóvelCarente

## Executar com Docker

Com o Docker Desktop em execução, na raiz do projeto rode:

```sh
docker compose up --build
```

Depois acesse [http://localhost:8080](http://localhost:8080). A API também fica
disponível em `http://localhost:3000`; a documentação está em
`http://localhost:3000/docs`.

Na primeira subida, as migrations do Prisma são aplicadas automaticamente. Os
dados do PostgreSQL, Redis e os arquivos enviados ficam em volumes Docker e
continuam disponíveis entre reinicializações.

Para usar segredos ou SMTP próprios, copie `.env.docker.example` para `.env` e
ajuste os valores antes de subir os serviços. O `.env` não é versionado.

Para encerrar sem apagar os dados:

```sh
docker compose down
```

Para apagar também os dados locais do Docker:

```sh
docker compose down -v
```
