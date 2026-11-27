package ar.gestorpenal;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;
import org.springframework.context.ConfigurableApplicationContext;

// Users live in app_user and log in through LoginService; no default in-memory user (ADR-0008).
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class GestorPenalApplication {

    public static void main(String[] args) {
        ConfigurableApplicationContext context = SpringApplication.run(GestorPenalApplication.class, args);
        // The bootstrap profile is a one-time command (T66): its runner already did the work.
        if (context.getEnvironment().matchesProfiles("bootstrap")) {
            System.exit(SpringApplication.exit(context));
        }
    }
}
