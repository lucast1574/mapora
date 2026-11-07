FROM alpine:3.23 AS unpack
RUN apk add --no-cache curl ca-certificates tar
RUN curl --fail --location --retry 3 -o /tmp/pmtiles.tar.gz https://github.com/protomaps/go-pmtiles/releases/download/v1.31.2/go-pmtiles_1.31.2_Linux_x86_64.tar.gz \
 && echo "3ed7dbf4ec2e6dfe5e25b6f70d1ffc932729f93c86db353bf514dd71010a312f  /tmp/pmtiles.tar.gz" | sha256sum -c - \
 && tar -xzf /tmp/pmtiles.tar.gz -C /tmp
FROM alpine:3.23
RUN apk add --no-cache ca-certificates
COPY --from=unpack /tmp/pmtiles /usr/local/bin/pmtiles
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/pmtiles"]
