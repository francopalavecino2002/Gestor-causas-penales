package ar.gestorpenal;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;

// Users live in app_user and log in through LoginService; no default in-memory user (ADR-0008).
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class GestorPenalApplication {

    public static void main(String[] args) {
        SpringApplication.run(GestorPenalApplication.class, args);
    }
}
