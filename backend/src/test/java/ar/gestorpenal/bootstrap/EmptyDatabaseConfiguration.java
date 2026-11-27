package ar.gestorpenal.bootstrap;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * A database of its own for the first-firm tests: the shared test database already has firms from
 * other test classes, and the bootstrap only runs on an empty one.
 */
@TestConfiguration(proxyBeanMethods = false)
class EmptyDatabaseConfiguration {

    @Bean
    @ServiceConnection
    PostgreSQLContainer emptyPostgres() {
        return new PostgreSQLContainer("postgres:18-alpine");
    }
}
