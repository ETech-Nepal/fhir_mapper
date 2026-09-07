FROM eclipse-temurin:21-jre-jammy

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN curl -fsSL -o /app/validator_cli.jar \
  https://github.com/hapifhir/org.hl7.fhir.core/releases/latest/download/validator_cli.jar

COPY package.json package-lock.json ./
RUN npm ci

COPY package.r4.tgz ./
COPY tsconfig.json ./
COPY src ./src
COPY start.sh ./
RUN npm run build && npm prune --omit=dev
RUN chmod +x start.sh

ENV VALIDATOR_URL=http://127.0.0.1:8081/validateResource
ENV PORT=3000

EXPOSE 3000
CMD ["./start.sh"]
