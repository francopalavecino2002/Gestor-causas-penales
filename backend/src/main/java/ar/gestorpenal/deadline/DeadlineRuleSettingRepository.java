package ar.gestorpenal.deadline;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface DeadlineRuleSettingRepository extends JpaRepository<DeadlineRuleSetting, UUID> {

    Optional<DeadlineRuleSetting> findByRuleCode(String ruleCode);
}
