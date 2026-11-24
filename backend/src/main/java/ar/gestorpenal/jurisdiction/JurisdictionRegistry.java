package ar.gestorpenal.jurisdiction;

import ar.gestorpenal.tenancy.Tenant;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

/**
 * Every jurisdiction package on the classpath, by code. Adding a province means adding a folder
 * under {@code resources/jurisdictions/}; no code changes (ADR-0013).
 */
public class JurisdictionRegistry {

    static final String CLASSPATH_PACKAGES = "classpath*:jurisdictions/*/jurisdiction.yml";
    static final String CLASSPATH_AREAS = "classpath*:jurisdictions/*/*/area.yml";

    private final Map<String, JurisdictionPackage> packages;

    JurisdictionRegistry(Collection<JurisdictionPackage> packages) {
        Map<String, JurisdictionPackage> byCode = new LinkedHashMap<>();
        for (JurisdictionPackage jurisdiction : packages) {
            if (byCode.putIfAbsent(jurisdiction.code(), jurisdiction) != null) {
                throw new IllegalStateException("Two jurisdiction packages use the code " + jurisdiction.code());
            }
        }
        if (!byCode.containsKey(Tenant.DEFAULT_JURISDICTION)) {
            throw new IllegalStateException(
                    "The default jurisdiction package '" + Tenant.DEFAULT_JURISDICTION + "' is missing");
        }
        PracticeArea defaultArea = byCode.get(Tenant.DEFAULT_JURISDICTION).areas().get(Tenant.DEFAULT_PRACTICE_AREA);
        if (defaultArea == null) {
            throw new IllegalStateException("The default jurisdiction package '" + Tenant.DEFAULT_JURISDICTION
                    + "' needs the practice area '" + Tenant.DEFAULT_PRACTICE_AREA + "'");
        }
        this.packages = Map.copyOf(byCode);
    }

    /**
     * Loads every {@code jurisdictions/<code>/jurisdiction.yml} found on the classpath, with the
     * {@code jurisdictions/<code>/<area>/area.yml} of each practice area.
     */
    static JurisdictionRegistry fromClasspath() {
        JurisdictionPackageLoader loader = new JurisdictionPackageLoader();
        PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
        try {
            Resource[] manifests = resolver.getResources(CLASSPATH_PACKAGES);
            Map<String, List<Resource>> areasByJurisdiction = new LinkedHashMap<>();
            for (Resource areaManifest : resolver.getResources(CLASSPATH_AREAS)) {
                areasByJurisdiction.computeIfAbsent(PackageFolders.folderOf(areaManifest, 3), key -> new ArrayList<>()).add(areaManifest);
            }
            return new JurisdictionRegistry(Arrays.stream(manifests)
                    .map(manifest -> loader.load(manifest, areasByJurisdiction.getOrDefault(PackageFolders.folderOf(manifest, 2), List.of())))
                    .toList());
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot scan " + CLASSPATH_PACKAGES, e);
        }
    }

    public Optional<JurisdictionPackage> find(String code) {
        return Optional.ofNullable(packages.get(code));
    }

    /** The package of a firm; a firm always points to a loaded package. */
    public JurisdictionPackage get(String code) {
        return find(code).orElseThrow(() -> new IllegalStateException("Unknown jurisdiction package " + code));
    }

    public Set<String> codes() {
        return packages.keySet();
    }
}
