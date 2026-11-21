package ar.gestorpenal.tenancy;

import static org.assertj.core.api.Assertions.assertThat;

import ar.gestorpenal.TestcontainersConfiguration;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.metamodel.EntityType;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

/** Guards the rule "tenant_id on every table" for every future migration and entity. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class TenantSchemaConventionTests {

    private static final List<String> GLOBAL_TABLES = List.of("tenant", "flyway_schema_history");

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Test
    void everyBusinessTableShouldHaveARequiredTenantForeignKey() {
        assertThat(tablesWithoutTenantForeignKey()).isEmpty();
    }

    @Test
    void guardShouldReportATableWithoutTenantForeignKey() {
        List<String> reported = transactionTemplate.execute(status -> {
            status.setRollbackOnly();
            jdbc.execute("create table unscoped_table (id uuid primary key, tenant_id uuid)");
            return tablesWithoutTenantForeignKey();
        });

        assertThat(reported).containsExactly("unscoped_table");
    }

    private List<String> tablesWithoutTenantForeignKey() {
        return jdbc.queryForList(
                """
                select t.table_name
                from information_schema.tables t
                where t.table_schema = 'public'
                  and t.table_type = 'BASE TABLE'
                  and t.table_name <> all (string_to_array(?, ','))
                  and not exists (
                      select 1
                      from information_schema.columns c
                      join information_schema.key_column_usage k
                        on k.table_schema = c.table_schema and k.table_name = c.table_name
                       and k.column_name = c.column_name
                      join information_schema.referential_constraints r
                        on r.constraint_schema = k.constraint_schema and r.constraint_name = k.constraint_name
                      join information_schema.constraint_column_usage u
                        on u.constraint_schema = r.unique_constraint_schema
                       and u.constraint_name = r.unique_constraint_name
                      where c.table_schema = t.table_schema
                        and c.table_name = t.table_name
                        and c.column_name = 'tenant_id'
                        and c.is_nullable = 'NO'
                        and u.table_name = 'tenant')
                """,
                String.class,
                String.join(",", GLOBAL_TABLES));
    }

    @Test
    void everyEntityExceptTenantShouldBeTenantScoped() {
        List<String> unscopedEntities = entityManagerFactory.getMetamodel().getEntities().stream()
                .map(EntityType::getJavaType)
                .filter(type -> type != Tenant.class)
                .filter(type -> !TenantScopedEntity.class.isAssignableFrom(type))
                .map(Class::getName)
                .toList();

        assertThat(unscopedEntities).isEmpty();
    }
}
