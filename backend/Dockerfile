FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Dar permissão de execução ao entrypoint APÓS copiar os arquivos
RUN chmod +x /app/scripts/entrypoint.sh

EXPOSE 8000

# Usar entrypoint personalizado que cria admin e faz seed antes de iniciar app
ENTRYPOINT ["/app/scripts/entrypoint.sh"]

# Comando padrão (passado para o entrypoint via exec "$@")
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]