FROM eclipse-temurin:21-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends curl pbzip2 ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /opt/photon /data \
 && curl --fail --location --retry 3 -o /opt/photon/photon.jar https://github.com/komoot/photon/releases/download/1.3.0/photon-1.3.0.jar \
 && echo "a89707c0045e4807b2a1180e132e68e108d998709f48b6c94b98a6e281f571a5  /opt/photon/photon.jar" | sha256sum -c - \
 && groupadd --gid 10001 photon && useradd --uid 10001 --gid 10001 --no-create-home photon \
 && chown 10001:10001 /data
USER 10001:10001
WORKDIR /data
ENV JAVA_TOOL_OPTIONS="-Xms2g -Xmx12g -XX:ActiveProcessorCount=4"
EXPOSE 2322
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=5 CMD curl --fail --silent http://127.0.0.1:2322/status || exit 1
ENTRYPOINT ["java","-jar","/opt/photon/photon.jar","serve","-listen-ip","0.0.0.0","-listen-port","2322","-data-dir","/data","-max-results","20","-max-reverse-results","20"]
