package ar.gestorpenal.jurisdiction;

import ar.gestorpenal.tenancy.Tenant;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

/**
 * Every jurisdiction package on the classpath, by code. Adding a province means adding a folder
 * under {@code resources/jurisdictions/}; no code changes (ADR-0013).
 */
public class JurisdictionRegistry {

    static final String CLASSPATH_PACKAGES = "classpath*:jurisdictions/*/jurisdiction.yml";

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
        this.packages = Map.copyOf(byCode);
    }

    /** Loads every {@code jurisdictions/<code>/jurisdiction.yml} found on the classpath. */
    static JurisdictionRegistry fromClasspath() {
        JurisdictionPackageLoader loader = new JurisdictionPackageLoader();
        try {
            var manifests = new PathMatchingResourcePatternResolver().getResources(CLASSPATH_PACKAGES);
            return new JurisdictionRegistry(Arrays.stream(manifests).map(loader::load).toList());
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
