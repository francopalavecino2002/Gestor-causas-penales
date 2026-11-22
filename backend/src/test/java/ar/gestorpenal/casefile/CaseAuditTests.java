package ar.gestorpenal.casefile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.audit.AuditAction;
import ar.gestorpenal.audit.AuditEvent;
import ar.gestorpenal.audit.AuditTrail;
import ar.gestorpenal.audit.FieldChange;
import ar.gestorpenal.tenancy.TenantContext;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Changes to a defendant leave a history; the indigenous-people flag (sensitive data) is redacted. */
class CaseAuditTests extends CaseApiTestSupport {

    @Autowired
    private AuditTrail auditTrail;

    @Test
    void creatingAndUpdatingADefendantShouldLeaveAHistoryWithTheSensitiveFlagRedacted() throws Exception {
        String caseId = createCase(lawyer, caseJson("Caso auditado ficticio", ""));
        String person = createPerson(lawyer, humanJson("Ana", "Quiroga Ejemplo", null));
        String defendant = addDefendant(lawyer, caseId, "{\"personId\": \"" + person + "\"}");
        putJson(lawyer, "/api/v1/cases/" + caseId + "/defendants/" + defendant,
                "{\"stageCode\": \"juicio\", \"indigenousPeople\": true}")
                .andExpect(status().isOk());

        List<AuditEvent> history = TenantContext.callAs(tenantA,
                () -> auditTrail.historyOf(Defendant.class, UUID.fromString(defendant)));

        assertThat(history).extracting(AuditEvent::getAction)
                .containsExactly(AuditAction.CREATE, AuditAction.UPDATE);
        List<FieldChange> changes = history.get(1).getChanges();
        assertThat(changes).anySatisfy(change -> {
            assertThat(change.field()).isEqualTo("stageCode");
            assertThat(change.newValue()).isEqualTo("juicio");
        });
        assertThat(changes).anySatisfy(change -> {
            assertThat(change.field()).isEqualTo("indigenousPeople");
            assertThat(change.newValue()).isEqualTo(FieldChange.REDACTED);
        });
        assertThat(changes).noneMatch(change -> "true".equals(change.newValue()));
    }
}
