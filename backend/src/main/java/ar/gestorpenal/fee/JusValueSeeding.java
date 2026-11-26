package ar.gestorpenal.fee;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The narrow public entry point the demo data uses to load a JUS value without a logged-in user. It
 * trusts its caller. Call it inside a tenant scope, outside any transaction.
 */
@Service
public class JusValueSeeding {

    private final JusValueRepository values;
    private final Clock clock;

    JusValueSeeding(JusValueRepository values, Clock clock) {
        this.values = values;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public boolean hasJusValues() {
        return values.count() > 0;
    }

    @Transactional
    public void createJusValue(UUID createdBy, BigDecimal value, LocalDate validFrom) {
        values.save(JusValue.create(createdBy, value, validFrom, clock.instant()));
    }
}
