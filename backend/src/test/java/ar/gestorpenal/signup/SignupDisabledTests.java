package ar.gestorpenal.signup;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** Without {@code APP_SIGNUP_ENABLED=true}, the default, nobody can sign a firm up (ADR-0050). */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class SignupDisabledTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void shouldTellTheSpaNotToOfferIt() throws Exception {
        mockMvc.perform(get(SignupController.SETTINGS_PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.practiceAreas").isEmpty());
    }

    @Test
    void shouldAnswerNotFoundToASignUp() throws Exception {
        // The same random value as cookie and header passes the CSRF check (see CatalogApiTests).
        String csrf = "csrf-ficticio-de-prueba";
        mockMvc.perform(post("/api/v1/auth/signup")
                        .cookie(new Cookie("XSRF-TOKEN", csrf))
                        .header("X-XSRF-TOKEN", csrf)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"firmName": "Estudio Ficticio Cerrado", "practiceAreas": ["penal"],
                                 "ownerName": "Titular Ficticia", "email": "titular@ejemplo.test",
                                 "password": "clave-ficticia-larga", "website": ""}"""))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldAnswerNotFoundToAnInvalidSignUpToo() throws Exception {
        String csrf = "csrf-ficticio-de-prueba";
        mockMvc.perform(post("/api/v1/auth/signup")
                        .cookie(new Cookie("XSRF-TOKEN", csrf))
                        .header("X-XSRF-TOKEN", csrf)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isNotFound());
    }
}
