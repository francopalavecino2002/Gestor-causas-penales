package ar.gestorpenal.person;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.SQLException;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;

/** Only a race on a unique key is reported as a concurrent change; other violations are bugs. */
class PersonProblemHandlerTests {

    private final PersonProblemHandler handler = new PersonProblemHandler();

    @Test
    void aUniqueKeyViolationShouldBeAConcurrentChange() {
        var problem = handler.concurrentChange(violationOf("client_person_uk"));

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.CONFLICT.value());
        assertThat(problem.getType()).hasToString("/problems/concurrent-change");
    }

    @Test
    void anyOtherIntegrityViolationShouldBeRethrown() {
        DataIntegrityViolationException check = violationOf("person_human_ck");

        assertThatThrownBy(() -> handler.concurrentChange(check)).isSameAs(check);
        assertThatThrownBy(() -> handler.concurrentChange(new DataIntegrityViolationException("no cause")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private static DataIntegrityViolationException violationOf(String constraint) {
        var cause = new ConstraintViolationException("violation", new SQLException("violation"), constraint);
        return new DataIntegrityViolationException("violation", cause);
    }
}
