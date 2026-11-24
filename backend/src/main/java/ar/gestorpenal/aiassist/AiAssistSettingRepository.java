package ar.gestorpenal.aiassist;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Tenant-scoped: the firm in scope has at most one setting. */
interface AiAssistSettingRepository extends JpaRepository<AiAssistSetting, UUID> {

    Optional<AiAssistSetting> findFirstBy();
}
