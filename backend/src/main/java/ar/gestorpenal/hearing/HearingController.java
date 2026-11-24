package ar.gestorpenal.hearing;

import ar.gestorpenal.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
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
 * Hearings (ADR-0016). A hearing of a reserved case the user cannot see answers 404 on every
 * endpoint. There is no delete: nothing is deleted, it is archived.
 */
@RestController
@RequestMapping("/api/v1")
class HearingController {

    private final HearingService hearings;
    private final HearingIcsExport icsExport;

    HearingController(HearingService hearings, HearingIcsExport icsExport) {
        this.hearings = hearings;
        this.icsExport = icsExport;
    }

    @PostMapping("/cases/{caseId}/hearings")
    ResponseEntity<HearingDetail> create(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID caseId,
            @Valid @RequestBody HearingData body) {
        HearingDetail created = hearings.create(user, caseId, body);
        return ResponseEntity.created(URI.create("/api/v1/hearings/" + created.id())).body(created);
    }

    /** Every hearing of the case, newest first. */
    @GetMapping("/cases/{caseId}/hearings")
    List<HearingView> ofCase(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID caseId,
            @RequestParam(defaultValue = "false") boolean includeArchived) {
        return hearings.listByCase(user, caseId, includeArchived);
    }

    @GetMapping("/hearings/{id}")
    HearingDetail one(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        return hearings.get(user, id);
    }

    /** The hearing as a one-event {@code .ics} file, to add it to a calendar app (ADR-0034). */
    @GetMapping("/hearings/{id}/calendar.ics")
    ResponseEntity<String> calendarFile(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        return ResponseEntity.ok()
                .contentType(HearingIcsExport.MEDIA_TYPE)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("audiencia.ics")
                        .build()
                        .toString())
                .cacheControl(CacheControl.noStore())
                .body(icsExport.hearing(user, id));
    }

    @PutMapping("/hearings/{id}")
    HearingDetail update(
            @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id, @Valid @RequestBody HearingData body) {
        return hearings.update(user, id, body);
    }

    @PostMapping("/hearings/{id}/reschedule")
    HearingDetail reschedule(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID id,
            @Valid @RequestBody RescheduleData body) {
        return hearings.reschedule(user, id, body);
    }

    @PostMapping("/hearings/{id}/result")
    HearingDetail result(
            @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id, @Valid @RequestBody ResultData body) {
        return hearings.recordResult(user, id, body);
    }

    @PostMapping("/hearings/{id}/archive")
    ResponseEntity<Void> archive(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        hearings.archive(user, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/hearings/{id}/restore")
    ResponseEntity<Void> restore(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        hearings.restore(user, id);
        return ResponseEntity.noContent().build();
    }
}
