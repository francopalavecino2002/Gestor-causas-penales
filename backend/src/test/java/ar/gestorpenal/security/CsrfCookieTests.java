package ar.gestorpenal.security;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRepository;

class CsrfCookieTests {

    @Test
    void shouldMarkTheCsrfCookieSecureWhenSecureCookiesAreOn() {
        Cookie cookie = savedCsrfCookie(true);

        assertThat(cookie.getSecure()).isTrue();
        assertThat(cookie.isHttpOnly()).isFalse();
        assertThat(cookie.getAttribute("SameSite")).isEqualTo("Lax");
    }

    @Test
    void shouldDropOnlyTheSecureFlagForThePlainHttpLanDemo() {
        Cookie cookie = savedCsrfCookie(false);

        assertThat(cookie.getSecure()).isFalse();
        assertThat(cookie.isHttpOnly()).isFalse();
        assertThat(cookie.getAttribute("SameSite")).isEqualTo("Lax");
    }

    private static Cookie savedCsrfCookie(boolean secureCookies) {
        CsrfTokenRepository repository = new SecurityConfig().csrfTokenRepository(secureCookies);
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        CsrfToken token = repository.generateToken(request);

        repository.saveToken(token, request, response);

        Cookie cookie = response.getCookie("XSRF-TOKEN");
        assertThat(cookie).isNotNull();
        return cookie;
    }
}
