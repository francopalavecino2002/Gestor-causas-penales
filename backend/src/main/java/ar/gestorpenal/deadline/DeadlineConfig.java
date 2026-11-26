package ar.gestorpenal.deadline;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(PublicCalculatorProperties.class)
class DeadlineConfig {

    /** Loaded and validated at startup: an invalid rule or calendar stops the application. */
    @Bean
    DeadlinePackages deadlinePackages() {
        return DeadlinePackages.fromClasspath();
    }
}
