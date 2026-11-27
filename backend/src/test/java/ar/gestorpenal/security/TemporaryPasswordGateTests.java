package ar.gestorpenal.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.mock.web.MockHttpServletRequest;

/**
 * What a user with a temporary password may reach (ADR-0044), checked on the raw path without the
 * firewall in front: every variant of an allowed path is refused.
 */
class TemporaryPasswordGateTests {

    @ParameterizedTest
    @CsvSource({
        "GET, /api/v1/me",
        "GET, /api/v1/auth/csrf",
        "GET, /api/v1/public/deadline-calculator",
        "GET, /api/v1/calendar-feed/abc123.ics",
        "POST, /api/v1/me/password",
        "POST, /api/v1/auth/login",
    })
    void shouldAllowWhatChangingThePasswordNeeds(String method, String path) {
        assertThat(ActiveUserFilter.allowedWithTemporaryPassword(new MockHttpServletRequest(method, path))).isTrue();
    }

    @ParameterizedTest
    @CsvSource({
        "GET, /api/v1/cases",
        "GET, /api/v1/me/",
        "POST, /api/v1/me",
        "GET, /api/v1/public/../cases",
        "GET, /api/v1/public/./x/../../cases",
        "GET, /api/v1/public//cases",
        "GET, /api/v1/public/%2e%2e/cases",
        "GET, /api/v1/public/x;jsessionid=1",
        "GET, /api/v1/public/",
        "GET, /api/v1/calendar-feed/..%2fcases",
        "DELETE, /api/v1/me/password",
    })
    void shouldRefuseEverythingElseAndEveryVariant(String method, String path) {
        assertThat(ActiveUserFilter.allowedWithTemporaryPassword(new MockHttpServletRequest(method, path))).isFalse();
    }
}
