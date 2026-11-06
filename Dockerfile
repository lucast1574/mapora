FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/maps-api ./cmd/api

FROM alpine:3.23
RUN apk add --no-cache ca-certificates && addgroup -S maps && adduser -S -G maps maps
COPY --from=build /out/maps-api /usr/local/bin/maps-api
USER maps
ENV PORT=4000
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -q -O /dev/null http://127.0.0.1:4000/health || exit 1
ENTRYPOINT ["/usr/local/bin/maps-api"]
