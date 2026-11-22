package ar.gestorpenal.deadline;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
class DeadlineConfig {

    /** Loaded and validated at startup: an invalid rule or calendar stops the application. */
    @Bean
    DeadlinePackages deadlinePackages() {
        return DeadlinePackages.fromClasspath();
    }
}
