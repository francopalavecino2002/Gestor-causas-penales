package ar.gestorpenal.customfield;

import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.user.Role;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The firm's custom field definitions (ADR-0018). Every member can read them, because every member
 * fills them in; only the owner (titular) changes them, because a change applies to the whole firm.
 * There is no delete: a field is archived and keeps its stored values.
 */
@RestController
@RequestMapping("/api/v1/custom-fields")
class CustomFieldController {

    private final CustomFieldService fields;

    CustomFieldController(CustomFieldService fields) {
        this.fields = fields;
    }

    record NewOptionRequest(@NotBlank @Size(max = CustomFieldDefinition.MAX_LABEL_LENGTH) String label) {}

    record NewFieldRequest(
            @NotNull CustomFieldEntity entity,
            @NotBlank @Size(max = CustomFieldDefinition.MAX_LABEL_LENGTH) String label,
            @NotNull CustomFieldType type,
            Boolean required,
            @Size(max = CustomFieldDefinition.MAX_OPTIONS) List<@Valid NewOptionRequest> options) {}

    /**
     * {@code code} null means a new option; with a code it updates that option. {@code hidden} omitted
     * keeps the option as it is.
     */
    record OptionChangeRequest(
            @Size(max = CustomFieldSlug.MAX_LENGTH) String code,
            @NotBlank @Size(max = CustomFieldDefinition.MAX_LABEL_LENGTH) String label,
            Boolean hidden) {}

    /** A full replace of what can change, so {@code required} must be sent. */
    record FieldChangeRequest(
            @NotBlank @Size(max = CustomFieldDefinition.MAX_LABEL_LENGTH) String label,
            @NotNull Boolean required,
            @NotNull @PositiveOrZero Integer position,
            @Size(max = CustomFieldDefinition.MAX_OPTIONS) List<@Valid OptionChangeRequest> options) {}

    @GetMapping
    List<CustomFieldView> list(
            @RequestParam CustomFieldEntity entity, @RequestParam(defaultValue = "false") boolean includeArchived) {
        return fields.list(entity, includeArchived);
    }

    @GetMapping("/{id}")
    CustomFieldView one(@PathVariable UUID id) {
        return fields.get(id);
    }

    @PostMapping
    ResponseEntity<CustomFieldView> create(
            @AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody NewFieldRequest body) {
        requireOwner(user);
        List<String> optionLabels = body.options() == null
                ? List.of()
                : body.options().stream().map(NewOptionRequest::label).toList();
        CustomFieldView created = fields.create(
                body.entity(), body.label(), body.type(), Boolean.TRUE.equals(body.required()), optionLabels);
        return ResponseEntity.created(URI.create("/api/v1/custom-fields/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    CustomFieldView update(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID id,
            @Valid @RequestBody FieldChangeRequest body) {
        requireOwner(user);
        List<CustomFieldDefinition.OptionChange> options = body.options() == null
                ? List.of()
                : body.options().stream()
                        .map(option -> new CustomFieldDefinition.OptionChange(option.code(), option.label(), option.hidden()))
                        .toList();
        return fields.update(id, body.label(), body.required(), body.position(), options);
    }

    @PostMapping("/{id}/archive")
    ResponseEntity<Void> archive(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        requireOwner(user);
        fields.archive(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/restore")
    ResponseEntity<Void> restore(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        requireOwner(user);
        fields.restore(id);
        return ResponseEntity.noContent().build();
    }

    private static void requireOwner(AuthenticatedUser user) {
        if (user.role() != Role.OWNER) {
            throw new AccessDeniedException("Only the firm owner can change custom fields");
        }
    }
}
