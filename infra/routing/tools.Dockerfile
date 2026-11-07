FROM debian:bookworm-slim
RUN apt-get update -qq && apt-get install -y -qq aria2 osmium-tool ca-certificates \
 && rm -rf /var/lib/apt/lists/*
