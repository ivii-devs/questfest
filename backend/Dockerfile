# Usamos una versión ligera de Python
FROM python:3.11-slim

# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos primero el archivo de dependencias (para optimizar la caché de Docker)
COPY requirements.txt .

# Instalamos las dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Copiamos el resto del código de la aplicación
COPY . .

# Exponemos el puerto en el que corre FastAPI
EXPOSE 8000

# Comando para ejecutar la aplicación:
# --proxy-headers: Habilita la lectura de cabeceras X-Forwarded-* para resolver correctamente la IP y protocolo del cliente.
# --forwarded-allow-ips "*": Permite confiar en las cabeceras inyectadas por el proxy inverso (Nginx) dentro de la red interna de Docker.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]