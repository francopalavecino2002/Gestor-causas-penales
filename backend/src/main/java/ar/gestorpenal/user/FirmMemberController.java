package ar.gestorpenal.user;

import java.util.List;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The active members of the current firm, so forms can offer them as a case's responsible lawyer or
 * as the lawyers who attend a hearing (T35). Every member may read it: it only exposes names and
 * roles, never emails or security data. Inviting or changing users is not here (ADR-0026).
 */
@RestController
class FirmMemberController {

    private final UserRepository users;

    FirmMemberController(UserRepository users) {
        this.users = users;
    }

    @GetMapping("/api/v1/users")
    @Transactional(readOnly = true)
    List<MemberView> members() {
        return users.findByArchivedAtIsNullOrderByDisplayNameAscIdAsc().stream()
                .map(MemberView::of)
                .toList();
    }

    record MemberView(UUID id, String displayName, Role role) {

        static MemberView of(AppUser user) {
            return new MemberView(user.getId(), user.getDisplayName(), user.getRole());
        }
    }
}
