package ar.gestorpenal.mail;

import ar.gestorpenal.mail.ConnectionTestMail.ConnectionTestResult;
import ar.gestorpenal.security.AuthenticatedUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/** Owner only: a test email to the owner's own address (ADR-0048). */
@RestController
class MailController {

    private final ConnectionTestMail connectionTest;

    MailController(ConnectionTestMail connectionTest) {
        this.connectionTest = connectionTest;
    }

    @PostMapping("/api/v1/mail/test")
    ConnectionTestResult sendTest(@AuthenticationPrincipal AuthenticatedUser user) {
        return connectionTest.sendToOwner(user);
    }
}
