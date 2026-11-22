package ar.gestorpenal.deadline;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

/**
 * The deadline package of every jurisdiction on the classpath, by jurisdiction code (the folder
 * name). A jurisdiction without {@code deadline-rules.yml} simply has no rules.
 */
class DeadlinePackages {

    static final String CLASSPATH_RULES = "classpath*:jurisdictions/*/" + DeadlinePackageLoader.RULES_FILE;

    private final Map<String, DeadlinePackage> packages;

    DeadlinePackages(Collection<DeadlinePackage> packages) {
        Map<String, DeadlinePackage> byCode = new LinkedHashMap<>();
        for (DeadlinePackage found : packages) {
            if (byCode.putIfAbsent(found.jurisdictionCode(), found) != null) {
                throw new IllegalStateException("Two deadline packages for the jurisdiction " + found.jurisdictionCode());
            }
        }
        this.packages = Map.copyOf(byCode);
    }

    static DeadlinePackages fromClasspath() {
        DeadlinePackageLoader loader = new DeadlinePackageLoader();
        try {
            Resource[] files = new PathMatchingResourcePatternResolver().getResources(CLASSPATH_RULES);
            return new DeadlinePackages(Arrays.stream(files)
                    .map(file -> loader.load(folderOf(file), file))
                    .toList());
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot scan " + CLASSPATH_RULES, e);
        }
    }

    DeadlinePackage get(String jurisdictionCode) {
        return packages.getOrDefault(jurisdictionCode, DeadlinePackage.empty(jurisdictionCode));
    }

    /** Works for files and for entries inside a jar ({@code jar:file:...!/jurisdictions/x/...}). */
    private static String folderOf(Resource file) {
        try {
            String[] segments = file.getURL().toString().split("/");
            return segments.length < 2 ? "" : segments[segments.length - 2];
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot resolve the folder of " + file.getDescription(), e);
        }
    }
}
