package ar.gestorpenal.fee;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
class FeeConfig {

    /** Loaded and validated at startup: an invalid scale stops the application. */
    @Bean
    FeeScales feeScales() {
        return FeeScales.fromClasspath();
    }
}
