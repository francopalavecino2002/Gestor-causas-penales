package ar.gestorpenal.tenancy;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

interface IsolationProbeRepository extends JpaRepository<IsolationProbe, UUID> {

    List<IsolationProbe> findByLabel(String label);

    @Transactional
    @Modifying
    @Query("update IsolationProbe p set p.label = :label")
    int relabelAll(String label);

    @Transactional
    @Modifying
    @Query("delete from IsolationProbe p")
    int deleteAllInBulk();
}
