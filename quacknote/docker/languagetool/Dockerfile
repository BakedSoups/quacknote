FROM eclipse-temurin:21-jre
ARG LANGUAGETOOL_VERSION=6.6
RUN apt-get update && apt-get install -y --no-install-recommends curl unzip \
    && curl --fail --location --retry 3 \
      "https://languagetool.org/download/LanguageTool-${LANGUAGETOOL_VERSION}.zip" -o /tmp/lt.zip \
    && unzip -q /tmp/lt.zip -d /opt \
    && mv "/opt/LanguageTool-${LANGUAGETOOL_VERSION}" /opt/languagetool \
    && rm /tmp/lt.zip && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --create-home languagetool
COPY server.properties /opt/languagetool/server.properties
USER languagetool
WORKDIR /opt/languagetool
EXPOSE 8081
ENTRYPOINT ["java", "-Xmx1g", "-cp", "languagetool-server.jar", "org.languagetool.server.HTTPServer"]
CMD ["--port", "8081", "--public", "--allow-origin", "*", "--config", "server.properties"]
