package ar.gestorpenal.fee;

import ar.gestorpenal.jurisdiction.PackageFolders;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

/** The fees scale of every jurisdiction on the classpath, by jurisdiction code (the folder name). */
class FeeScales {

    static final String CLASSPATH_FILES = "classpath*:jurisdictions/*/" + FeeScaleLoader.FILE;

    private final Map<String, FeeScale> scales;

    FeeScales(Map<String, FeeScale> scales) {
        this.scales = Map.copyOf(scales);
    }

    static FeeScales fromClasspath() {
        FeeScaleLoader loader = new FeeScaleLoader();
        try {
            Collection<Resource> files = Arrays.asList(
                    new PathMatchingResourcePatternResolver().getResources(CLASSPATH_FILES));
            Map<String, FeeScale> byJurisdiction = new LinkedHashMap<>();
            for (Resource file : files) {
                String jurisdiction = PackageFolders.folderOf(file, 2);
                if (byJurisdiction.putIfAbsent(jurisdiction, loader.load(file)) != null) {
                    throw new IllegalStateException("Two fees scales for " + jurisdiction);
                }
            }
            return new FeeScales(byJurisdiction);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot scan " + CLASSPATH_FILES, e);
        }
    }

    /** A jurisdiction without {@code fees.yml} has no scale. */
    Optional<FeeScale> of(String jurisdictionCode) {
        return Optional.ofNullable(scales.get(jurisdictionCode));
    }
}
