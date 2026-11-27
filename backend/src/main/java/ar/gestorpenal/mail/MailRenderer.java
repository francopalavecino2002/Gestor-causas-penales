package ar.gestorpenal.mail;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.UnaryOperator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

/**
 * Fills a {@link MailTemplate} and the shared layout with the firm's name and the caller's values. In the
 * HTML part every value is escaped; a placeholder without a value is a programming error and fails.
 */
@Component
class MailRenderer {

    static final String FIRM_NAME = "firmName";
    private static final String CONTENT = "content";
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{([a-zA-Z][a-zA-Z0-9]*)}}");
    private static final Pattern LINE_BREAKS_AND_CONTROLS = Pattern.compile("[\\p{Cntrl}]+");

    /** Escapes only what HTML needs ({@code < > & " '}); accented letters stay as UTF-8 text. */
    private static final UnaryOperator<String> HTML = value -> HtmlUtils.htmlEscape(value, StandardCharsets.UTF_8.name());

    private final Map<String, String> sources = new ConcurrentHashMap<>();

    Rendered render(MailTemplate template, String firmName, Map<String, String> values) {
        Map<String, String> model = new HashMap<>(values);
        model.put(FIRM_NAME, firmName);
        String html = layout("html", fill(source(template.name() + ".html"), model, HTML), HTML.apply(firmName));
        String text = layout("txt", fill(source(template.name() + ".txt"), model, UnaryOperator.identity()), firmName);
        String subject = oneLine(fill(template.subject(), model, UnaryOperator.identity()));
        return new Rendered(subject, html, text);
    }

    /** Control characters (line breaks included) collapsed to spaces: for header values. */
    static String oneLine(String value) {
        return LINE_BREAKS_AND_CONTROLS.matcher(value).replaceAll(" ").strip();
    }

    /** The layout knows only the firm's name (already escaped for HTML) and the rendered content. */
    private String layout(String extension, String content, String firmName) {
        return fill(source("layout." + extension), Map.of(FIRM_NAME, firmName, CONTENT, content),
                UnaryOperator.identity());
    }

    private static String fill(String source, Map<String, String> model, UnaryOperator<String> escape) {
        Matcher matcher = PLACEHOLDER.matcher(source);
        StringBuilder result = new StringBuilder();
        while (matcher.find()) {
            String key = matcher.group(1);
            String value = model.get(key);
            if (value == null) {
                throw new IllegalStateException("No value for {{" + key + "}} in a mail template");
            }
            matcher.appendReplacement(result, Matcher.quoteReplacement(escape.apply(value)));
        }
        matcher.appendTail(result);
        return result.toString();
    }

    private String source(String fileName) {
        return sources.computeIfAbsent(fileName, MailRenderer::read);
    }

    private static String read(String fileName) {
        ClassPathResource resource = new ClassPathResource("mail/" + fileName);
        try {
            return resource.getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException exception) {
            throw new UncheckedIOException("Missing mail template file mail/" + fileName, exception);
        }
    }

    record Rendered(String subject, String html, String text) {}
}
