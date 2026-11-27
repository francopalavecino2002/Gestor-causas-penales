package ar.gestorpenal.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.gestorpenal.mail.MailRenderer.Rendered;
import java.util.Map;
import org.junit.jupiter.api.Test;

class MailRendererTests {

    private final MailRenderer renderer = new MailRenderer();

    @Test
    void shouldWrapTheTemplateInTheLayoutWithTheFirmsName() {
        Rendered rendered = renderer.render(
                ConnectionTestMail.TEMPLATE, "Estudio Ficticio Alfa", Map.of("displayName", "Titular Ficticia"));

        assertThat(rendered.subject()).isEqualTo("Correo de prueba de Estudio Ficticio Alfa");
        assertThat(rendered.html())
                .startsWith("<!doctype html>")
                .contains("<html lang=\"es\">")
                .contains("Hola, Titular Ficticia:")
                .contains("Te escribimos en nombre de Estudio Ficticio Alfa");
        assertThat(rendered.text())
                .startsWith("Estudio Ficticio Alfa")
                .contains("Hola, Titular Ficticia:")
                .contains("Te escribimos en nombre de Estudio Ficticio Alfa")
                .doesNotContain("<p");
    }

    @Test
    void shouldEscapeValuesInTheHtmlPartOnly() {
        Rendered rendered = renderer.render(
                ConnectionTestMail.TEMPLATE, "Estudio <Ficticio> & Asoc.", Map.of("displayName", "<script>x</script>"));

        assertThat(rendered.html())
                .contains("Estudio &lt;Ficticio&gt; &amp; Asoc.")
                .contains("Hola, &lt;script&gt;x&lt;/script&gt;:")
                .doesNotContain("<script>")
                .doesNotContain("<Ficticio>");
        assertThat(rendered.text()).contains("Estudio <Ficticio> & Asoc.").contains("Hola, <script>x</script>:");
    }

    @Test
    void shouldNotExpandPlaceholdersInsideValues() {
        Rendered rendered = renderer.render(
                ConnectionTestMail.TEMPLATE, "Estudio Ficticio", Map.of("displayName", "{{firmName}} {{content}}"));

        assertThat(rendered.text()).contains("Hola, {{firmName}} {{content}}:");
    }

    @Test
    void shouldKeepTheSubjectOnOneLine() {
        Rendered rendered = renderer.render(
                ConnectionTestMail.TEMPLATE, "Estudio\r\nBcc: otra@ejemplo.test", Map.of("displayName", "Ficticia"));

        assertThat(rendered.subject()).isEqualTo("Correo de prueba de Estudio Bcc: otra@ejemplo.test");
    }

    @Test
    void shouldFailForAPlaceholderWithoutAValue() {
        assertThatIllegalStateException()
                .isThrownBy(() -> renderer.render(ConnectionTestMail.TEMPLATE, "Estudio Ficticio", Map.of()))
                .withMessageContaining("{{displayName}}");
    }

    @Test
    void shouldFailForATemplateWithoutFiles() {
        MailTemplate missing = new MailTemplate("no-existe", "Asunto");

        assertThatThrownBy(() -> renderer.render(missing, "Estudio", Map.of()))
                .hasMessageContaining("mail/no-existe.html");
    }

    @Test
    void shouldRejectATemplateNameThatIsAPath() {
        assertThatIllegalArgumentException().isThrownBy(() -> new MailTemplate("../layout", "Asunto"));
    }

    @Test
    void shouldMaskTheRecipientInLogs() {
        assertThat(LoggingMailTransport.masked("titular@ejemplo.test")).isEqualTo("t***@ejemplo.test");
        assertThat(LoggingMailTransport.masked("sin-arroba")).isEqualTo("***");
    }
}
