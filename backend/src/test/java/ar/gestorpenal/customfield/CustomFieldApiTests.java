package ar.gestorpenal.customfield;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.tenancy.TenantContext;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

/** The custom field endpoints through the real filter chain: roles, CSRF, problem+json, tenancy. */
class CustomFieldApiTests extends CustomFieldApiTestSupport {

    @Autowired
    private CustomFieldService service;

    @Test
    void theOwnerShouldCreateAFieldWhoseKeyComesFromItsLabel() throws Exception {
        postJson(owner, "/api/v1/custom-fields", fieldJson("CASE_FILE", "Honorarios pactados", "BOOLEAN", false))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/v1/custom-fields/")))
                .andExpect(jsonPath("$.key").value("honorarios-pactados"))
                .andExpect(jsonPath("$.entity").value("CASE_FILE"))
                .andExpect(jsonPath("$.type").value("BOOLEAN"))
                .andExpect(jsonPath("$.position").value(0))
                .andExpect(jsonPath("$.archived").value(false));
        postJson(owner, "/api/v1/custom-fields", fieldJson("CASE_FILE", "Honorarios pactados", "TEXT", true))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.key").value("honorarios-pactados-2"))
                .andExpect(jsonPath("$.position").value(1))
                .andExpect(jsonPath("$.required").value(true));
    }

    @Test
    void everyMemberShouldReadTheFieldsOfOneRecordInOrder() throws Exception {
        String first = createField(owner, fieldJson("CASE_FILE", "Primero", "TEXT", false));
        createField(owner, fieldJson("CASE_FILE", "Segundo", "NUMBER", false));
        createField(owner, fieldJson("DEFENDANT", "Unidad de detención", "TEXT", false));

        getJson(lawyer, "/api/v1/custom-fields?entity=CASE_FILE")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].key").value("primero"))
                .andExpect(jsonPath("$[1].key").value("segundo"));
        getJson(lawyer, "/api/v1/custom-fields?entity=DEFENDANT")
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].key").value("unidad-de-detencion"));
        getJson(lawyer, "/api/v1/custom-fields/" + first)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.label").value("Primero"));
    }

    @Test
    void thePositionShouldBeChangeableAndDecideTheOrder() throws Exception {
        String first = createField(owner, fieldJson("CASE_FILE", "Primero", "TEXT", false));
        createField(owner, fieldJson("CASE_FILE", "Segundo", "TEXT", false));

        putJson(owner, "/api/v1/custom-fields/" + first,
                "{\"label\": \"Primero\", \"required\": false, \"position\": 5}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.position").value(5));

        getJson(owner, "/api/v1/custom-fields?entity=CASE_FILE")
                .andExpect(jsonPath("$[0].key").value("segundo"))
                .andExpect(jsonPath("$[1].key").value("primero"));
    }

    @Test
    void aMemberWhoIsNotTheOwnerShouldReadButNotChange() throws Exception {
        String id = createField(owner, fieldJson("CASE_FILE", "Notas internas", "TEXT", false));

        postJson(lawyer, "/api/v1/custom-fields", fieldJson("CASE_FILE", "Otro", "TEXT", false))
                .andExpect(status().isForbidden());
        putJson(lawyer, "/api/v1/custom-fields/" + id, "{\"label\": \"X\", \"required\": false, \"position\": 0}")
                .andExpect(status().isForbidden());
        postEmpty(lawyer, "/api/v1/custom-fields/" + id + "/archive").andExpect(status().isForbidden());
        postEmpty(lawyer, "/api/v1/custom-fields/" + id + "/restore").andExpect(status().isForbidden());

        getJson(lawyer, "/api/v1/custom-fields?entity=CASE_FILE")
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].label").value("Notas internas"));
    }

    @Test
    void renamingShouldKeepTheKeyTypeAndRecord() throws Exception {
        String id = createField(owner, fieldJson("CASE_FILE", "Honorarios pactados", "BOOLEAN", false));

        putJson(owner, "/api/v1/custom-fields/" + id,
                "{\"label\": \"Honorarios acordados\", \"required\": true, \"position\": 0}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.label").value("Honorarios acordados"))
                .andExpect(jsonPath("$.required").value(true))
                .andExpect(jsonPath("$.key").value("honorarios-pactados"))
                .andExpect(jsonPath("$.type").value("BOOLEAN"))
                .andExpect(jsonPath("$.entity").value("CASE_FILE"));
    }

    @Test
    void aListFieldShouldAddRenameAndHideOptionsButNeverDeleteThem() throws Exception {
        String id = createField(owner, listJson("CASE_FILE", "Prioridad", "Alta", "Media"));
        getJson(owner, "/api/v1/custom-fields/" + id)
                .andExpect(jsonPath("$.options[0].code").value("alta"))
                .andExpect(jsonPath("$.options[1].code").value("media"));

        putJson(owner, "/api/v1/custom-fields/" + id,
                """
                {"label": "Prioridad", "required": false, "position": 0, "options": [
                    {"code": "alta", "label": "Prioridad alta", "hidden": false},
                    {"code": "media", "label": "Media", "hidden": true},
                    {"label": "Baja"}]}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.options", hasSize(3)))
                .andExpect(jsonPath("$.options[0].label").value("Prioridad alta"))
                .andExpect(jsonPath("$.options[1].hidden").value(true))
                .andExpect(jsonPath("$.options[2].code").value("baja"))
                .andExpect(jsonPath("$.options[2].hidden").value(false));

        putJson(owner, "/api/v1/custom-fields/" + id,
                """
                {"label": "Prioridad", "required": false, "position": 0, "options": [
                    {"code": "alta", "label": "Prioridad alta", "hidden": false}]}
                """)
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("/problems/invalid-custom-field"));
        putJson(owner, "/api/v1/custom-fields/" + id,
                """
                {"label": "Prioridad", "required": false, "position": 0, "options": [
                    {"code": "alta", "label": "A", "hidden": true},
                    {"code": "media", "label": "M", "hidden": true},
                    {"code": "baja", "label": "B", "hidden": true}]}
                """)
                .andExpect(status().isBadRequest());

        getJson(owner, "/api/v1/custom-fields/" + id).andExpect(jsonPath("$.options", hasSize(3)));
    }

    @Test
    void anArchivedFieldShouldLeaveTheListAndComeBackOnRestore() throws Exception {
        String id = createField(owner, fieldJson("CASE_FILE", "Notas internas", "TEXT", false));

        postEmpty(owner, "/api/v1/custom-fields/" + id + "/archive").andExpect(status().isNoContent());

        getJson(owner, "/api/v1/custom-fields?entity=CASE_FILE").andExpect(jsonPath("$", hasSize(0)));
        getJson(owner, "/api/v1/custom-fields?entity=CASE_FILE&includeArchived=true")
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].archived").value(true));
        putJson(owner, "/api/v1/custom-fields/" + id, "{\"label\": \"X\", \"required\": false, \"position\": 0}")
                .andExpect(status().isBadRequest());

        postEmpty(owner, "/api/v1/custom-fields/" + id + "/restore").andExpect(status().isNoContent());

        getJson(owner, "/api/v1/custom-fields?entity=CASE_FILE").andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void aKeyOfAnArchivedFieldShouldNotBeReused() throws Exception {
        String id = createField(owner, fieldJson("CASE_FILE", "Notas", "TEXT", false));
        postEmpty(owner, "/api/v1/custom-fields/" + id + "/archive").andExpect(status().isNoContent());

        postJson(owner, "/api/v1/custom-fields", fieldJson("CASE_FILE", "Notas", "TEXT", false))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.key").value("notas-2"));
    }

    @Test
    void invalidDefinitionsShouldBeRejectedAsProblemJson() throws Exception {
        postJson(owner, "/api/v1/custom-fields", fieldJson("CASE_FILE", "  ", "TEXT", false))
                .andExpect(status().isBadRequest());
        postJson(owner, "/api/v1/custom-fields", fieldJson("CASE_FILE", "Sin opciones", "LIST", false))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("/problems/invalid-custom-field"));
        postJson(owner, "/api/v1/custom-fields", listJson("CASE_FILE", "Texto con opciones", "Una").replace("LIST", "TEXT"))
                .andExpect(status().isBadRequest());
        postJson(owner, "/api/v1/custom-fields", fieldJson("OTHER", "Notas", "TEXT", false))
                .andExpect(status().isBadRequest());
        getJson(owner, "/api/v1/custom-fields").andExpect(status().isBadRequest());
    }

    @Test
    void aFirmShouldNeverSeeOrTouchTheFieldsOfAnotherFirm() throws Exception {
        String id = createField(owner, fieldJson("CASE_FILE", "Notas internas", "TEXT", false));

        getJson(otherFirmOwner, "/api/v1/custom-fields?entity=CASE_FILE&includeArchived=true")
                .andExpect(jsonPath("$", hasSize(0)));
        getJson(otherFirmOwner, "/api/v1/custom-fields/" + id).andExpect(status().isNotFound());
        putJson(otherFirmOwner, "/api/v1/custom-fields/" + id,
                "{\"label\": \"Robado\", \"required\": false, \"position\": 0}")
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        postEmpty(otherFirmOwner, "/api/v1/custom-fields/" + id + "/archive").andExpect(status().isNotFound());
        postEmpty(otherFirmOwner, "/api/v1/custom-fields/" + id + "/restore").andExpect(status().isNotFound());

        // The same label is free in the other firm: keys are unique per firm.
        postJson(otherFirmOwner, "/api/v1/custom-fields", fieldJson("CASE_FILE", "Notas internas", "TEXT", false))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.key").value("notas-internas"));
        getJson(owner, "/api/v1/custom-fields/" + id).andExpect(jsonPath("$.label").value("Notas internas"));
    }

    @Test
    void aFirmShouldHaveAtMostFiftyActiveFieldsPerRecord() {
        TenantContext.runAs(tenantA, () -> {
            for (int i = 1; i <= CustomFieldService.MAX_ACTIVE_PER_ENTITY; i++) {
                service.create(CustomFieldEntity.DEFENDANT, "Campo " + i, CustomFieldType.TEXT, false, List.of());
            }
        });

        assertThatThrownBy(() -> TenantContext.runAs(tenantA, () ->
                service.create(CustomFieldEntity.DEFENDANT, "Uno de más", CustomFieldType.TEXT, false, List.of())))
                .isInstanceOf(InvalidCustomFieldDefinitionException.class);

        // The limit is per record and counts active fields only.
        TenantContext.runAs(tenantA, () -> {
            service.create(CustomFieldEntity.CASE_FILE, "Otro registro", CustomFieldType.TEXT, false, List.of());
            List<CustomFieldView> all = service.list(CustomFieldEntity.DEFENDANT, false);
            assertThat(all).hasSize(CustomFieldService.MAX_ACTIVE_PER_ENTITY);
            service.archive(all.get(0).id());
            service.create(CustomFieldEntity.DEFENDANT, "Uno de más", CustomFieldType.TEXT, false, List.of());
        });
    }
}
