package ar.gestorpenal.customfield;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.SQLException;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;

/** Only a race on the field key is reported as a concurrent change; other violations are bugs. */
class CustomFieldProblemHandlerTests {

    private final CustomFieldProblemHandler handler = new CustomFieldProblemHandler();

    @Test
    void aKeyIndexViolationShouldBeAConcurrentChange() {
        var problem = handler.concurrentChange(violationOf(CustomFieldProblemHandler.KEY_UNIQUE_INDEX));

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.CONFLICT.value());
        assertThat(problem.getType()).hasToString("/problems/custom-field-concurrent-change");
    }

    @Test
    void anyOtherIntegrityViolationShouldBeRethrown() {
        DataIntegrityViolationException check = violationOf("custom_field_definition_key_ck");

        assertThatThrownBy(() -> handler.concurrentChange(check)).isSameAs(check);
        assertThatThrownBy(() -> handler.concurrentChange(new DataIntegrityViolationException("no cause")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private static DataIntegrityViolationException violationOf(String constraint) {
        var cause = new ConstraintViolationException("violation", new SQLException("violation"), constraint);
        return new DataIntegrityViolationException("violation", cause);
    }
}
