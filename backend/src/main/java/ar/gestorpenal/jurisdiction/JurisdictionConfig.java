package ar.gestorpenal.jurisdiction;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
class JurisdictionConfig {

    /** Loaded and validated at startup: an invalid package stops the application. */
    @Bean
    JurisdictionRegistry jurisdictionRegistry() {
        return JurisdictionRegistry.fromClasspath();
    }
}
