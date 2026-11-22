package ar.gestorpenal.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.Role;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The startup checks that keep mistakes in {@link Audited} entities out of the history. */
class AuditConfigurationTests {

    @Test
    void shouldAcceptATenantScopedEntityWithAUuidId() {
        AuditListenerRegistration.requireRecordable(AppUser.class, UUID.class);
    }

    @Test
    void shouldRejectAnEntityThatIsNotTenantScoped() {
        assertThatThrownBy(() -> AuditListenerRegistration.requireRecordable(String.class, UUID.class))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("TenantScopedEntity");
    }

    @Test
    void shouldRejectAnEntityWithoutAUuidId() {
        assertThatThrownBy(() -> AuditListenerRegistration.requireRecordable(AppUser.class, Long.class))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void shouldOnlyAuditValuesWithAFaithfulTextForm() {
        assertThat(List.of(String.class, int.class, Long.class, Boolean.class, Role.class, UUID.class,
                        Instant.class, LocalDate.class))
                .allMatch(AuditRecorder::hasTextForm);
        assertThat(List.of(byte[].class, Map.class, List.class, Object.class))
                .noneMatch(AuditRecorder::hasTextForm);
    }

    @Test
    void shouldAuditJsonMapsAndListsAsJsonText() {
        assertThat(List.of(Map.class, java.util.LinkedHashMap.class, List.class, java.util.ArrayList.class))
                .allMatch(AuditRecorder::hasJsonForm);
        assertThat(List.of(String.class, byte[].class, Object.class)).noneMatch(AuditRecorder::hasJsonForm);
    }
}
