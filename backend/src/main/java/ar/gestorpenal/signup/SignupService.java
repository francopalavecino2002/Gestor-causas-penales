package ar.gestorpenal.signup;

import ar.gestorpenal.audit.FieldChange;
import ar.gestorpenal.bootstrap.FirmFounding;
import ar.gestorpenal.bootstrap.FirmFounding.Founded;
import ar.gestorpenal.jurisdiction.JurisdictionRegistry;
import ar.gestorpenal.jurisdiction.PracticeArea;
import ar.gestorpenal.security.EmailVerificationService;
import ar.gestorpenal.tenancy.Tenant;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.UserService;
import jakarta.mail.internet.AddressException;
import jakarta.mail.internet.InternetAddress;
import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Firm self sign-up (T72, ADR-0050). A visitor creates a firm in the default jurisdiction, with the
 * practice areas they chose and a free trial, and its owner with the password they chose, through the
 * same founding path as the first-firm bootstrap. The owner cannot log in until they open the link
 * emailed to them.
 *
 * <p>A filled honeypot field answers like a real sign-up (the same slug) and creates nothing, so a bot
 * cannot tell. The slug comes from the firm's name, never from the visitor; a suffixed slug does tell
 * that a firm with that name signed up before (see ADR-0050).
 *
 * <p>Not transactional on purpose: the founding enters the new firm's scope before its transaction.
 */
@Service
class SignupService {

    private static final Logger log = LoggerFactory.getLogger(SignupService.class);
    private static final int MAX_NAME_LENGTH = 200;

    private final TenantService tenants;
    private final UserService users;
    private final FirmFounding founding;
    private final EmailVerificationService verification;
    private final JurisdictionRegistry jurisdictions;
    private final SignupProperties properties;
    private final Clock clock;

    SignupService(
            TenantService tenants,
            UserService users,
            FirmFounding founding,
            EmailVerificationService verification,
            JurisdictionRegistry jurisdictions,
            SignupProperties properties,
            Clock clock) {
        this.tenants = tenants;
        this.users = users;
        this.founding = founding;
        this.verification = verification;
        this.jurisdictions = jurisdictions;
        this.properties = properties;
        this.clock = clock;
    }

    record SignupForm(
            String firmName,
            List<String> practiceAreas,
            String ownerName,
            String email,
            String password,
            String honeypot) {

        @Override
        public String toString() {
            return "SignupForm[firmName=" + firmName + ", practiceAreas=" + practiceAreas + ", password=***]";
        }
    }

    /** The slug the owner logs in with and the address the link was sent to. */
    record SignedUp(String firmSlug, String email) {}

    /** The practice areas a new firm can choose from, the default one first. */
    List<PracticeArea> availableAreas() {
        return jurisdictions.get(Tenant.DEFAULT_JURISDICTION).areas().values().stream()
                .sorted(Comparator.comparing(area -> !Tenant.DEFAULT_PRACTICE_AREA.equals(area.code())))
                .toList();
    }

    /**
     * @throws InvalidSignupException if a value is missing or not valid; nothing is created
     * @throws ar.gestorpenal.user.InvalidPasswordException if the password is too short or too long
     */
    SignedUp signUp(SignupForm form) {
        String firmName = strip(form.firmName());
        String ownerName = strip(form.ownerName());
        String email = UserService.normalizeEmail(strip(form.email()));
        List<String> areas = validAreas(form.practiceAreas());
        requireLength(firmName, "The firm name");
        requireLength(ownerName, "Your name");
        requirePlainAddress(email);
        UserService.requireValidNewPassword(form.password());
        String baseSlug = FirmSlugs.fromName(firmName);
        if (form.honeypot() != null && !form.honeypot().isBlank()) {
            log.info("Sign-up ignored: the honeypot field was filled");
            // The slug a real sign-up would get, so the two answers cannot be told apart.
            return new SignedUp(tenants.firstFreeSlug(baseSlug), email);
        }

        // Hashed before the founding: its transaction holds the lock on every firm until it commits.
        String passwordHash = users.hashNewPassword(form.password());
        Instant trialEndsAt = clock.instant().plus(properties.trialLength());
        Founded<AppUser> founded = founding.found(
                        () -> Optional.of(tenants.createSignedUpFirmInScope(firmName, baseSlug, areas, trialEndsAt)),
                        List.of(new FieldChange("enabledPracticeAreas", null, String.join(",", areas)),
                                new FieldChange("trialEndsAt", null, trialEndsAt.toString())),
                        firm -> users.createUnverifiedOwner(email, ownerName, passwordHash))
                .orElseThrow();
        // After the founding committed: the email goes out with the link already stored.
        TenantContext.runAs(founded.firm().id(), () -> verification.sendLink(founded.owner().getId()));
        return new SignedUp(founded.firm().slug(), email);
    }

    /** Known codes of the default package, duplicates dropped, in the package's order with the default first. */
    private List<String> validAreas(List<String> codes) {
        Set<String> wanted = new LinkedHashSet<>();
        for (String code : codes == null ? List.<String>of() : codes) {
            wanted.add(strip(code));
        }
        List<String> known = availableAreas().stream().map(PracticeArea::code).toList();
        if (wanted.isEmpty()) {
            throw new InvalidSignupException("Choose at least one practice area");
        }
        if (!known.containsAll(wanted)) {
            throw new InvalidSignupException("A practice area is not offered");
        }
        return known.stream().filter(wanted::contains).toList();
    }

    /** The same check the mailer makes, done first so a firm is never created for an address it rejects. */
    private static void requirePlainAddress(String email) {
        try {
            InternetAddress address = new InternetAddress(email, true);
            if (email.length() > 254 || address.getPersonal() != null || !email.equals(address.getAddress())
                    || email.indexOf('@') < 1) {
                throw new InvalidSignupException("The email is not valid");
            }
        } catch (AddressException e) {
            throw new InvalidSignupException("The email is not valid");
        }
    }

    private static void requireLength(String value, String what) {
        if (value.isEmpty() || value.length() > MAX_NAME_LENGTH) {
            throw new InvalidSignupException(what + " must have between 1 and " + MAX_NAME_LENGTH + " characters");
        }
    }

    private static String strip(String value) {
        return value == null ? "" : value.strip();
    }
}
