package ar.gestorpenal.user;

import ar.gestorpenal.security.AuthenticatedUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The owner's users screen (ADR-0044). Owner only: the other roles get 403. Unlike
 * {@code GET /api/v1/users} (names and roles for forms), this shows emails and security state.
 * Responses that carry a temporary password are never cached.
 */
@RestController
@RequestMapping("/api/v1/firm/users")
class FirmUserController {

    private final FirmUserService firmUsers;

    FirmUserController(FirmUserService firmUsers) {
        this.firmUsers = firmUsers;
    }

    record FirmUserView(
            UUID id,
            String displayName,
            String email,
            Role role,
            boolean twoFactorEnabled,
            boolean passwordChangeRequired,
            boolean archived,
            Instant createdAt) {

        static FirmUserView of(AppUser user) {
            return new FirmUserView(
                    user.getId(),
                    user.getDisplayName(),
                    user.getEmail(),
                    user.getRole(),
                    user.isTotpEnabled(),
                    user.isPasswordChangeRequired(),
                    !user.isActive(),
                    user.getCreatedAt());
        }
    }

    record NewUserRequest(
            @NotBlank @Size(max = 200) String displayName,
            @NotBlank @Email @Size(max = 254) String email,
            @NotNull Role role) {}

    record RoleRequest(@NotNull Role role) {}

    /** Shown once: the owner gives it to the person, who must replace it at the first login. */
    record CreatedUserView(FirmUserView user, String temporaryPassword) {

        @Override
        public String toString() {
            return "CreatedUserView[user=" + user + ", temporaryPassword=***]";
        }
    }

    record TemporaryPasswordView(String temporaryPassword) {

        @Override
        public String toString() {
            return "TemporaryPasswordView[temporaryPassword=***]";
        }
    }

    @GetMapping
    List<FirmUserView> all(@AuthenticationPrincipal AuthenticatedUser actor) {
        requireOwner(actor);
        return firmUsers.all().stream().map(FirmUserView::of).toList();
    }

    @PostMapping
    ResponseEntity<CreatedUserView> create(
            @AuthenticationPrincipal AuthenticatedUser actor, @Valid @RequestBody NewUserRequest body) {
        requireOwner(actor);
        UserService.CreatedUser created = firmUsers.create(body.email(), body.displayName(), body.role());
        return ResponseEntity.created(URI.create("/api/v1/firm/users/" + created.user().getId()))
                .cacheControl(CacheControl.noStore())
                .body(new CreatedUserView(FirmUserView.of(created.user()), created.temporaryPassword()));
    }

    @PutMapping("/{id}/role")
    FirmUserView changeRole(
            @AuthenticationPrincipal AuthenticatedUser actor,
            @PathVariable UUID id,
            @Valid @RequestBody RoleRequest body) {
        requireOwner(actor);
        return FirmUserView.of(firmUsers.changeRole(actor.userId(), id, body.role()));
    }

    @PostMapping("/{id}/archive")
    FirmUserView archive(@AuthenticationPrincipal AuthenticatedUser actor, @PathVariable UUID id) {
        requireOwner(actor);
        return FirmUserView.of(firmUsers.archive(actor.userId(), id));
    }

    @PostMapping("/{id}/restore")
    FirmUserView restore(@AuthenticationPrincipal AuthenticatedUser actor, @PathVariable UUID id) {
        requireOwner(actor);
        return FirmUserView.of(firmUsers.restore(actor.userId(), id));
    }

    @PostMapping("/{id}/password-reset")
    ResponseEntity<TemporaryPasswordView> resetPassword(
            @AuthenticationPrincipal AuthenticatedUser actor, @PathVariable UUID id) {
        requireOwner(actor);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(new TemporaryPasswordView(firmUsers.resetPassword(actor.userId(), id)));
    }

    private static void requireOwner(AuthenticatedUser actor) {
        if (actor.role() != Role.OWNER) {
            throw new AccessDeniedException("Only the owner manages the firm's users");
        }
    }
}
