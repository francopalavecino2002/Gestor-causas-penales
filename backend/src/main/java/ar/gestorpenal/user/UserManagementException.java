package ar.gestorpenal.user;

/**
 * A change to the firm's users that is refused to keep the firm usable: archiving or demoting the
 * last active owner, an owner changing their own account from the users screen, or resetting the
 * password of an archived user.
 */
class UserManagementException extends RuntimeException {

    enum Reason {
        LAST_OWNER("last-owner", "The firm needs at least one active owner"),
        OWN_ACCOUNT("own-account", "Another owner must change or archive your own account"),
        ARCHIVED_USER("archived-user", "Restore the user before resetting their password");

        final String type;
        final String detail;

        Reason(String type, String detail) {
            this.type = type;
            this.detail = detail;
        }
    }

    private final Reason reason;

    UserManagementException(Reason reason) {
        super(reason.detail);
        this.reason = reason;
    }

    Reason reason() {
        return reason;
    }
}
