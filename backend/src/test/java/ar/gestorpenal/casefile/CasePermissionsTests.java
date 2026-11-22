package ar.gestorpenal.casefile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.user.Role;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

class CasePermissionsTests {

    @Test
    void everyoneSeesANormalCaseButOnlyTheOwnerSeesAReservedOneWithoutBeingOnTheTeam() {
        assertThat(CasePermissions.canSeeWithoutTeam(user(Role.PARALEGAL), false)).isTrue();
        assertThat(CasePermissions.canSeeWithoutTeam(user(Role.OWNER), true)).isTrue();
        assertThat(CasePermissions.canSeeWithoutTeam(user(Role.LAWYER), true)).isFalse();
        assertThat(CasePermissions.canSeeWithoutTeam(user(Role.PARALEGAL), true)).isFalse();
        assertThat(CasePermissions.canSeeWithoutTeam(user(Role.ADMIN_STAFF), true)).isFalse();
    }

    @Test
    void theTeamIsManagedByTheOwnerAndTheResponsibleOnly() {
        AuthenticatedUser responsible = user(Role.LAWYER);

        assertThatCode(() -> CasePermissions.requireCanManageTeam(user(Role.OWNER), UUID.randomUUID()))
                .doesNotThrowAnyException();
        assertThatCode(() -> CasePermissions.requireCanManageTeam(responsible, responsible.userId()))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> CasePermissions.requireCanManageTeam(user(Role.LAWYER), responsible.userId()))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> CasePermissions.requireCanManageTeam(user(Role.LAWYER), null))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void onlyTheOwnerAndLawyersArchive() {
        assertThatCode(() -> CasePermissions.requireCanArchive(user(Role.OWNER))).doesNotThrowAnyException();
        assertThatCode(() -> CasePermissions.requireCanArchive(user(Role.LAWYER))).doesNotThrowAnyException();
        assertThatThrownBy(() -> CasePermissions.requireCanArchive(user(Role.PARALEGAL)))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> CasePermissions.requireCanArchive(user(Role.ADMIN_STAFF)))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void theResponsibleIsAnOwnerOrALawyer() {
        assertThat(CasePermissions.canBeResponsible(Role.OWNER)).isTrue();
        assertThat(CasePermissions.canBeResponsible(Role.LAWYER)).isTrue();
        assertThat(CasePermissions.canBeResponsible(Role.PARALEGAL)).isFalse();
        assertThat(CasePermissions.canBeResponsible(Role.ADMIN_STAFF)).isFalse();
    }

    private static AuthenticatedUser user(Role role) {
        return new AuthenticatedUser(UUID.randomUUID(), UUID.randomUUID(), role, Instant.now());
    }
}
