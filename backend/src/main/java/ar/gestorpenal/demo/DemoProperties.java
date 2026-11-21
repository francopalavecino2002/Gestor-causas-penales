package ar.gestorpenal.demo;

import ar.gestorpenal.user.UserService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * The password shared by the demo users. It has no default on purpose (ADR-0011), and its length
 * is checked at startup so a bad value fails before anything is written.
 */
@Validated
@ConfigurationProperties("app.demo")
record DemoProperties(@NotBlank @Size(min = UserService.MIN_PASSWORD_LENGTH) String password) {

    @Override
    public String toString() {
        return "DemoProperties[password=***]";
    }
}
