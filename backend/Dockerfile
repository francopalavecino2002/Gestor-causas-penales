# One image for the whole product (T65, ADR-0046): the frontend build is served by the backend on the
# same origin as the API. The build context is the repository root:
#   docker build -f backend/Dockerfile -t gestor-causas .
# BuildKit (the default builder) reads backend/Dockerfile.dockerignore for this file.
# Run it with SPRING_PROFILES_ACTIVE=prod (set here) and the variables of docs/HOSTING.md.

# 1. Frontend: the production build of the PWA.
FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2. Backend: the executable jar, with the frontend inside it as classpath:/static/.
FROM eclipse-temurin:21-jdk-noble AS backend
WORKDIR /build
COPY backend/.mvn/ .mvn/
COPY backend/mvnw backend/pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline
COPY backend/src/main/ src/main/
COPY --from=frontend /build/dist/ src/main/resources/static/
# The tests already ran in CI; here they would need Docker inside Docker (Testcontainers).
RUN ./mvnw -B -q package -DskipTests -Djacoco.skip=true && cp target/gestor-penal-*.jar /build/app.jar

# 3. Runtime: only a JRE and the jar, as an unprivileged user.
FROM eclipse-temurin:21-jre-noble
RUN groupadd --system app && useradd --system --gid app --no-create-home app
WORKDIR /app
COPY --from=backend /build/app.jar app.jar
USER app
ENV SPRING_PROFILES_ACTIVE=prod
# Hosting platforms usually set PORT; application-prod.properties reads it (default 8081).
EXPOSE 8081
# The heap follows the container's memory limit and leaves room for metaspace and threads: 512 MB
# (the smallest recommended instance, tested in CI by scripts/docker-smoke.sh) gives ~300 MB of heap.
# Serial GC is the lightest collector for one or two CPUs. Platforms probe
# /actuator/health/liveness and /actuator/health/readiness themselves (docs/HOSTING.md).
# UTF-8 console: the first-firm bootstrap (T66) prints Spanish text, and a bare container has no locale.
ENTRYPOINT ["java", "-Dstdout.encoding=UTF-8", "-Dstderr.encoding=UTF-8", "-XX:MaxRAMPercentage=60", "-XX:+UseSerialGC", "-XX:+ExitOnOutOfMemoryError", "-jar", "/app/app.jar"]
