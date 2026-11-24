package ar.gestorpenal.deadline;

import ar.gestorpenal.jurisdiction.PackageFolders;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

/**
 * The deadline package of every practice area on the classpath, by jurisdiction code and area code
 * (the folder names). An area without {@code deadline-rules.yml} simply has no rules (ADR-0032).
 */
class DeadlinePackages {

    static final String CLASSPATH_RULES = "classpath*:jurisdictions/*/*/" + DeadlinePackageLoader.RULES_FILE;

    private final Map<String, DeadlinePackage> packages;

    DeadlinePackages(Collection<DeadlinePackage> packages) {
        Map<String, DeadlinePackage> byKey = new LinkedHashMap<>();
        for (DeadlinePackage found : packages) {
            if (byKey.putIfAbsent(key(found.jurisdictionCode(), found.areaCode()), found) != null) {
                throw new IllegalStateException("Two deadline packages for " + found.jurisdictionCode() + "/" + found.areaCode());
            }
        }
        this.packages = Map.copyOf(byKey);
    }

    static DeadlinePackages fromClasspath() {
        DeadlinePackageLoader loader = new DeadlinePackageLoader();
        try {
            Resource[] files = new PathMatchingResourcePatternResolver().getResources(CLASSPATH_RULES);
            return new DeadlinePackages(Arrays.stream(files)
                    .map(file -> {
                        String jurisdiction = PackageFolders.folderOf(file, 3);
                        Resource calendar = new ClassPathResource(
                                "jurisdictions/" + jurisdiction + "/" + DeadlinePackageLoader.CALENDAR_FILE);
                        return loader.load(jurisdiction, PackageFolders.folderOf(file, 2), file, calendar);
                    })
                    .toList());
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot scan " + CLASSPATH_RULES, e);
        }
    }

    /**
     * The package of a practice area. An area without rules gets an empty one that still carries the
     * jurisdiction's court calendar, when some other area of the jurisdiction loaded it.
     */
    DeadlinePackage get(String jurisdictionCode, String areaCode) {
        DeadlinePackage found = packages.get(key(jurisdictionCode, areaCode));
        if (found != null) {
            return found;
        }
        CourtCalendar calendar = packages.values().stream()
                .filter(other -> other.jurisdictionCode().equals(jurisdictionCode))
                .map(DeadlinePackage::calendar)
                .findFirst()
                .orElseGet(DeadlinePackage::noCalendar);
        return DeadlinePackage.empty(jurisdictionCode, areaCode, calendar);
    }

    private static String key(String jurisdictionCode, String areaCode) {
        return jurisdictionCode + "/" + areaCode;
    }
}
