package ar.gestorpenal.user;

import ar.gestorpenal.user.UserManagementException.Reason;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The owner manages the firm's users (ADR-0044): create with a temporary password, change a role,
 * archive and restore, reset a forgotten password. Users are never deleted. The firm always keeps
 * one active owner, and an owner never changes their own account here, so nobody locks themselves
 * out by mistake. Every change lands in the history, since {@link AppUser} is audited.
 */
@Service
class FirmUserService {

    private final UserRepository users;
    private final UserService userService;

    FirmUserService(UserRepository users, UserService userService) {
        this.users = users;
        this.userService = userService;
    }

    @Transactional(readOnly = true)
    List<AppUser> all() {
        return users.findAllByOrderByDisplayNameAscIdAsc();
    }

    @Transactional
    UserService.CreatedUser create(String email, String displayName, Role role) {
        users.findByEmail(UserService.normalizeEmail(email)).ifPresent(existing -> {
            throw new DuplicateEmailException();
        });
        try {
            return userService.createWithTemporaryPassword(email, displayName, role);
        } catch (IllegalArgumentException e) {
            throw new InvalidUserDataException(e.getMessage());
        }
    }

    @Transactional
    AppUser changeRole(UUID actorId, UUID userId, Role role) {
        List<AppUser> activeOwners = users.findByRoleAndArchivedAtIsNullOrderByIdAsc(Role.OWNER);
        AppUser user = someoneElse(actorId, userId);
        if (role != Role.OWNER) {
            requireAnotherOwner(activeOwners, user);
        }
        user.changeRole(role);
        return user;
    }

    @Transactional
    AppUser archive(UUID actorId, UUID userId) {
        List<AppUser> activeOwners = users.findByRoleAndArchivedAtIsNullOrderByIdAsc(Role.OWNER);
        AppUser user = someoneElse(actorId, userId);
        requireAnotherOwner(activeOwners, user);
        user.archive();
        return user;
    }

    @Transactional
    AppUser restore(UUID actorId, UUID userId) {
        AppUser user = someoneElse(actorId, userId);
        user.restore();
        return user;
    }

    /** A new temporary password for someone who forgot theirs; their open sessions end. */
    @Transactional
    String resetPassword(UUID actorId, UUID userId) {
        return userService.resetToTemporaryPassword(someoneElse(actorId, userId));
    }

    private AppUser someoneElse(UUID actorId, UUID userId) {
        if (actorId.equals(userId)) {
            throw new UserManagementException(Reason.OWN_ACCOUNT);
        }
        return users.findById(userId).orElseThrow(UserNotFoundException::new);
    }

    /** {@code activeOwners} was read with a lock, so it is still true when the transaction commits. */
    private static void requireAnotherOwner(List<AppUser> activeOwners, AppUser user) {
        boolean isActiveOwner = activeOwners.stream().anyMatch(owner -> owner.getId().equals(user.getId()));
        if (isActiveOwner && activeOwners.size() == 1) {
            throw new UserManagementException(Reason.LAST_OWNER);
        }
    }
}
