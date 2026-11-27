package ar.gestorpenal.user;

import ar.gestorpenal.user.UserManagementException.Reason;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
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
        List<AppUser> activeOwners = lockActiveOwners(actorId);
        AppUser user = someoneElse(actorId, userId);
        if (role != Role.OWNER) {
            requireAnotherOwner(activeOwners, user);
        }
        user.changeRole(role);
        return user;
    }

    @Transactional
    AppUser archive(UUID actorId, UUID userId) {
        List<AppUser> activeOwners = lockActiveOwners(actorId);
        AppUser user = someoneElse(actorId, userId);
        requireAnotherOwner(activeOwners, user);
        user.archive();
        return user;
    }

    @Transactional
    AppUser restore(UUID actorId, UUID userId) {
        lockActiveOwners(actorId);
        AppUser user = someoneElse(actorId, userId);
        user.restore();
        return user;
    }

    /**
     * A new temporary password for someone who forgot theirs; their open sessions end. An archived
     * user cannot log in, so they are restored first.
     */
    @Transactional
    String resetPassword(UUID actorId, UUID userId) {
        lockActiveOwners(actorId);
        AppUser user = someoneElse(actorId, userId);
        if (!user.isActive()) {
            throw new UserManagementException(Reason.ARCHIVED_USER);
        }
        return userService.resetToTemporaryPassword(user);
    }

    /**
     * The active owners, locked until commit. The session said the actor is an owner; if another
     * owner demoted or archived them a moment ago, the change is refused here.
     */
    private List<AppUser> lockActiveOwners(UUID actorId) {
        List<AppUser> activeOwners = users.findByRoleAndArchivedAtIsNullOrderByIdAsc(Role.OWNER);
        if (activeOwners.stream().noneMatch(owner -> owner.getId().equals(actorId))) {
            throw new AccessDeniedException("Only an active owner manages the firm's users");
        }
        return activeOwners;
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
