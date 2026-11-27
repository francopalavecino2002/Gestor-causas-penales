package ar.gestorpenal.bootstrap;

import ar.gestorpenal.audit.AuditJournal;
import ar.gestorpenal.audit.FieldChange;
import ar.gestorpenal.tenancy.Tenant;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.tenancy.TenantService.TenantSummary;
import ar.gestorpenal.user.Role;
import ar.gestorpenal.user.UserService;
import ar.gestorpenal.user.UserService.CreatedUser;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Creates the first firm of a production database and its owner (T66, ADR-0047), without the demo
 * profile and without any endpoint. It refuses once any firm exists, so it cannot be used to add a
 * firm or an owner to a live database. The firm and the owner are created in one transaction: a
 * failure leaves nothing behind and the command can simply run again.
 *
 * <p>The owner gets a server-generated temporary password, shown once to the operator, and must
 * choose their own at the first login (ADR-0044). Both creations land in the firm's history with no
 * author, which is how the history shows the system.
 */
@Service
public class FirstFirmBootstrap {

    /** The same format as the {@code tenant_slug_format_ck} constraint. */
    private static final Pattern SLUG = Pattern.compile("[a-z0-9]+(-[a-z0-9]+)*");
    private static final int MAX_SLUG_LENGTH = 63;
    private static final int MAX_NAME_LENGTH = 200;

    private final TenantService tenants;
    private final UserService users;
    private final AuditJournal journal;
    private final TransactionTemplate transaction;

    FirstFirmBootstrap(
            TenantService tenants, UserService users, AuditJournal journal, PlatformTransactionManager transactionManager) {
        this.tenants = tenants;
        this.users = users;
        this.journal = journal;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    /** What the operator needs to hand over to the owner; the temporary password is never logged. */
    public record FirstFirm(UUID tenantId, String firmSlug, UUID ownerId, String ownerEmail, String temporaryPassword) {

        @Override
        public String toString() {
            return "FirstFirm[tenantId=" + tenantId + ", firmSlug=" + firmSlug + ", ownerId=" + ownerId
                    + ", temporaryPassword=***]";
        }
    }

    /**
     * @throws IllegalArgumentException if a value is missing or not valid; nothing is created
     * @throws FirmAlreadyExistsException if the database already has a firm, archived or not
     */
    public FirstFirm create(FirstFirmRequest request) {
        String firmName = strip(request.firmName());
        String firmSlug = strip(request.firmSlug());
        String ownerEmail = strip(request.ownerEmail());
        String ownerName = strip(request.ownerName());
        requireValid(firmName, firmSlug, ownerEmail, ownerName);
        // The scope must be entered before the transaction starts (TenantContext).
        return TenantContext.callAs(UUID.randomUUID(), () -> transaction.execute(status -> {
            TenantSummary firm = tenants.createFirstFirmInScope(firmName, firmSlug)
                    .orElseThrow(FirmAlreadyExistsException::new);
            journal.recordCreate(firm.id(), Tenant.class, firm.id(), List.of(
                    new FieldChange("name", null, firm.name()),
                    new FieldChange("slug", null, firm.slug())));
            CreatedUser owner = users.createWithTemporaryPassword(ownerEmail, ownerName, Role.OWNER);
            return new FirstFirm(
                    firm.id(), firm.slug(), owner.user().getId(), owner.user().getEmail(), owner.temporaryPassword());
        }));
    }

    /** Every problem at once, so the operator fixes them in one go. The email is checked by UserService too. */
    private static void requireValid(String firmName, String firmSlug, String ownerEmail, String ownerName) {
        List<String> problems = new ArrayList<>();
        if (firmName.isEmpty() || firmName.length() > MAX_NAME_LENGTH) {
            problems.add("BOOTSTRAP_FIRM_NAME must have between 1 and " + MAX_NAME_LENGTH + " characters");
        }
        if (firmSlug.length() > MAX_SLUG_LENGTH || !SLUG.matcher(firmSlug).matches()) {
            problems.add("BOOTSTRAP_FIRM_SLUG must be lowercase letters and digits separated by single hyphens"
                    + " (at most " + MAX_SLUG_LENGTH + " characters), for example estudio-ejemplo");
        }
        if (ownerEmail.isEmpty() || ownerEmail.indexOf('@') < 1) {
            problems.add("BOOTSTRAP_OWNER_EMAIL must be an email address (name@domain)");
        }
        if (ownerName.isEmpty() || ownerName.length() > MAX_NAME_LENGTH) {
            problems.add("BOOTSTRAP_OWNER_NAME must have between 1 and " + MAX_NAME_LENGTH + " characters");
        }
        if (!problems.isEmpty()) {
            throw new IllegalArgumentException(String.join("; ", problems));
        }
    }

    private static String strip(String value) {
        return value == null ? "" : value.strip();
    }
}
