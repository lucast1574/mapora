FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends osmium-tool ca-certificates && rm -rf /var/lib/apt/lists/* \
 && pip install --no-cache-dir osmium==4.2.0
WORKDIR /app
COPY catalog.py build.py ./
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
EXPOSE 8090
CMD ["python", "catalog.py"]
