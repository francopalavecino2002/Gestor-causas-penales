package ar.gestorpenal;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** One injectable clock so time-dependent code can be tested without sleeping. */
@Configuration(proxyBeanMethods = false)
class TimeConfig {

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
