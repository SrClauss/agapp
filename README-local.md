# Rodando backend local com Mongo no Docker

Se quiser rodar o backend local (dentro da sua máquina) e usar o Mongo rodando em Docker (exposto em `localhost:27017`), use o script abaixo.

1) Suba o Mongo como container com porta exposta (opcional com dev compose):

```bash
# Se o projeto tem docker-compose.dev.yml (exemplo), ele mapeia a porta automaticamente.
docker compose -f docker-compose.dev.yml up -d mongodb
```

2) Rode o script que faz todo o trabalho (sobe Mongo se necessário, espera pronto e inicia o uvicorn local):

```bash
bash scripts/run_backend_local_with_mongo.sh
```

3) Valide:

```bash
# Verifica se Mongo responde
nc -vz localhost 27017

# Verifica se 8000 escuta
sudo ss -ltnp | grep :8000

# Checar rota de login
curl -v http://127.0.0.1:8000/system-admin/login
```

Dicas:
- Use credenciais definidas no `docker-compose.dev.yml` (usuário/senha) ou no arquivo `.env` do repositório. O script lê `.env` se existir e prioriza as variáveis nele.
- Se você preferir apontar a aplicação para outro host, defina `MONGODB_URL` antes de executar o script.
- Se for usar o modo completo com docker-compose (serviços interligados), rode `docker compose up -d` normalmente.
