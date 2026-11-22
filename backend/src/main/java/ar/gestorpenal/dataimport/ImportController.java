package ar.gestorpenal.dataimport;

import ar.gestorpenal.security.AuthenticatedUser;
import java.io.IOException;
import java.io.InputStream;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Bulk load of persons, cases and hearings from a CSV or Excel file (ADR-0019). Only the owner and
 * lawyers import. {@code dryRun} defaults to {@code true}: a preview never saves anything.
 */
@RestController
@RequestMapping("/api/v1/imports")
class ImportController {

    private static final MediaType CSV_UTF8 = MediaType.parseMediaType("text/csv;charset=UTF-8");

    private final ImportService imports;

    ImportController(ImportService imports) {
        this.imports = imports;
    }

    @PostMapping("/{kind}")
    ImportReport upload(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String kind,
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "true") boolean dryRun)
            throws IOException {
        try (InputStream content = file.getInputStream()) {
            return imports.run(user, kindOf(kind), file.getOriginalFilename(), file.getSize(), content, dryRun);
        }
    }

    /** The headers and one fictitious example row, to fill in and upload. */
    @GetMapping("/{kind}/template")
    ResponseEntity<byte[]> template(@PathVariable String kind) {
        ImportKind importKind = kindOf(kind);
        return ResponseEntity.ok()
                .contentType(CSV_UTF8)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("plantilla-" + importKind.path() + ".csv").build().toString())
                .body(imports.template(importKind));
    }

    private static ImportKind kindOf(String path) {
        return ImportKind.fromPath(path)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "There is no import of " + path));
    }
}
