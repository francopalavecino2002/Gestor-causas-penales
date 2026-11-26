package ar.gestorpenal.fee;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.core.io.Resource;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;
import org.yaml.snakeyaml.error.YAMLException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/**
 * Reads the {@code fees.yml} of a jurisdiction. Like the deadline loader, every problem is reported
 * at once and any problem stops the application at startup: a wrong percentage must never reach a
 * lawyer.
 */
final class FeeScaleLoader {

    static final String FILE = "fees.yml";

    private static final Pattern CODE = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final BigDecimal TWO = BigDecimal.valueOf(2);

    private final ObjectMapper mapper = JsonMapper.builder()
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    FeeScale load(Resource file) {
        String location = file.getDescription();
        FeeScale scale = read(file, location);
        List<String> problems = new ArrayList<>();
        check(scale, problems);
        if (!problems.isEmpty()) {
            throw new InvalidFeeScaleException(location, problems);
        }
        return scale;
    }

    private static void check(FeeScale scale, List<String> problems) {
        requireText(scale.law(), "law", problems);
        requireText(scale.source(), "source", problems);
        checkScale(scale.scale(), problems);
        checkFactor(scale.procurador(), "procurador", BigDecimal.ZERO, BigDecimal.ONE, problems);
        checkFactor(scale.sponsorAndAttorney(), "sponsorAndAttorney", BigDecimal.ONE, TWO, problems);
        checkAppeal(scale.appeal(), problems);
        checkMinimums(scale.minimums(), problems);
    }

    private static void checkScale(FeeScale.Percentages scale, List<String> problems) {
        if (scale == null) {
            problems.add("scale is required");
            return;
        }
        requireText(scale.article(), "scale: article", problems);
        checkRange(scale.minPercent(), scale.maxPercent(), "scale", problems);
        if (!isBetween(scale.losingPartyFloorFactor(), BigDecimal.ZERO, BigDecimal.ONE)) {
            problems.add("scale: losingPartyFloorFactor must be greater than 0 and at most 1");
        }
    }

    private static void checkFactor(
            FeeScale.Factor factor, String name, BigDecimal exclusiveMin, BigDecimal max, List<String> problems) {
        if (factor == null) {
            problems.add(name + " is required");
            return;
        }
        requireText(factor.article(), name + ": article", problems);
        if (!isBetween(factor.factor(), exclusiveMin, max)) {
            problems.add(name + ": factor must be greater than " + exclusiveMin.toPlainString()
                    + " and at most " + max.toPlainString());
        }
    }

    private static void checkAppeal(FeeScale.Appeal appeal, List<String> problems) {
        if (appeal == null) {
            problems.add("appeal is required");
            return;
        }
        requireText(appeal.article(), "appeal: article", problems);
        checkRange(appeal.minPercent(), appeal.maxPercent(), "appeal", problems);
        if (!isBetween(appeal.fullyRevokedPercent(), BigDecimal.ZERO, HUNDRED)) {
            problems.add("appeal: fullyRevokedPercent must be greater than 0 and at most 100");
        }
    }

    private static void checkRange(BigDecimal min, BigDecimal max, String where, List<String> problems) {
        if (!isBetween(min, BigDecimal.ZERO, HUNDRED) || !isBetween(max, BigDecimal.ZERO, HUNDRED)) {
            problems.add(where + ": minPercent and maxPercent must be greater than 0 and at most 100");
        } else if (min.compareTo(max) > 0) {
            problems.add(where + ": minPercent cannot be greater than maxPercent");
        }
    }

    private static void checkMinimums(List<FeeMinimum> minimums, List<String> problems) {
        if (minimums.isEmpty()) {
            problems.add("at least one minimum is required");
            return;
        }
        Set<String> codes = new HashSet<>();
        for (FeeMinimum minimum : minimums) {
            if (minimum == null) {
                problems.add("a minimum entry is empty");
                continue;
            }
            String where = "minimum '" + minimum.code() + "'";
            if (minimum.code() == null || !CODE.matcher(minimum.code()).matches()) {
                problems.add(where + ": code must be lowercase words separated by hyphens");
            } else if (!codes.add(minimum.code())) {
                problems.add(where + ": duplicate code");
            }
            requireText(minimum.name(), where + ": name", problems);
            requireText(minimum.article(), where + ": article", problems);
            if (minimum.jus() == null || minimum.jus().signum() <= 0) {
                problems.add(where + ": jus must be greater than 0");
            }
            if (minimum.areas().stream().anyMatch(area -> area == null || area.isBlank())) {
                problems.add(where + ": areas cannot have blank entries");
            }
        }
    }

    /** SnakeYAML's safe constructor builds plain maps, lists and scalars and rejects duplicate keys. */
    private FeeScale read(Resource file, String location) {
        LoaderOptions options = new LoaderOptions();
        options.setAllowDuplicateKeys(false);
        try (InputStream input = file.getInputStream()) {
            Object document = new Yaml(new SafeConstructor(options)).load(input);
            if (document == null) {
                throw new InvalidFeeScaleException(location, FILE + " is empty", null);
            }
            return mapper.convertValue(document, FeeScale.class);
        } catch (IOException | YAMLException | JacksonException | IllegalArgumentException e) {
            throw new InvalidFeeScaleException(location, "cannot read " + FILE, e);
        }
    }

    private static boolean isBetween(BigDecimal value, BigDecimal exclusiveMin, BigDecimal max) {
        return value != null && value.compareTo(exclusiveMin) > 0 && value.compareTo(max) <= 0;
    }

    private static void requireText(String value, String what, List<String> problems) {
        if (value == null || value.isBlank()) {
            problems.add(what + " is required");
        }
    }
}
