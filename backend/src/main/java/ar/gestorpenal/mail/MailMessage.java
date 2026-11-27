package ar.gestorpenal.mail;

/**
 * A rendered email, ready for a {@link MailTransport}.
 *
 * @param template the template's name, for logs
 * @param senderName the display name of the sender (the firm)
 * @param recipient a single address
 * @param html the HTML part; {@code text} is the plain-text alternative
 */
record MailMessage(String template, String senderName, String recipient, String subject, String html, String text) {}
