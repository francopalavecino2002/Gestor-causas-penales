package ar.gestorpenal.jurisdiction;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
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
 * Reads a jurisdiction package: the {@code jurisdiction.yml} manifest and, next to it, one
 * {@code <catalog-id>.yml} per {@link Catalog}. Every problem found is reported at once, and any
 * problem rejects the whole package, so a broken file stops the application at startup instead of
 * showing a wrong catalog to a lawyer.
 */
final class JurisdictionPackageLoader {

    static final int MAX_NAME_LENGTH = 200;
    static final int MAX_ARTICLE_LENGTH = 120;

    private static final Pattern CODE = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");

    /**
     * Maps the parsed YAML onto the records. Strict, so a misspelled key is an error instead of a
     * silently missing value.
     */
    private final ObjectMapper mapper = JsonMapper.builder()
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .enable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
            .build();

    JurisdictionPackage load(Resource manifestFile) {
        String location = manifestFile.getDescription();
        JurisdictionPackage.Manifest manifest = read(manifestFile, JurisdictionPackage.Manifest.class, location);
        List<String> problems = new ArrayList<>();
        checkManifest(manifest, problems);
        String folder = folderOf(manifestFile, location);
        if (manifest.code() != null && !manifest.code().equals(folder)) {
            problems.add("jurisdiction.yml: code '" + manifest.code() + "' must match its folder '" + folder + "'");
        }

        Map<Catalog, CatalogDefinition> catalogs = new EnumMap<>(Catalog.class);
        for (Catalog catalog : Catalog.values()) {
            String fileName = catalog.id() + ".yml";
            Resource file = sibling(manifestFile, fileName, location);
            if (!file.exists()) {
                problems.add(fileName + " is missing");
                continue;
            }
            CatalogDefinition definition = read(file, CatalogDefinition.class, location);
            checkCatalog(catalog, fileName, definition, problems);
            catalogs.put(catalog, definition);
        }
        if (!problems.isEmpty()) {
            throw new InvalidJurisdictionPackageException(location, problems);
        }
        return new JurisdictionPackage(manifest.code(), manifest.name(), manifest.version(), manifest.law(),
                manifest.reviewedOn(), manifest.source(), catalogs);
    }

    private static void checkManifest(JurisdictionPackage.Manifest manifest, List<String> problems) {
        if (manifest.code() == null || !CODE.matcher(manifest.code()).matches()) {
            problems.add("jurisdiction.yml: code must be lowercase words separated by hyphens");
        }
        if (isBlank(manifest.name())) {
            problems.add("jurisdiction.yml: name is required");
        }
        if (manifest.version() < 1) {
            problems.add("jurisdiction.yml: version must be 1 or greater");
        }
        if (isBlank(manifest.law())) {
            problems.add("jurisdiction.yml: law is required");
        }
    }

    private static void checkCatalog(
            Catalog expected, String fileName, CatalogDefinition definition, List<String> problems) {
        if (definition.catalog() != expected) {
            problems.add(fileName + ": catalog must be '" + expected.id() + "'");
        }
        if (isBlank(definition.source())) {
            problems.add(fileName + ": source is required");
        }
        if (definition.items().isEmpty()) {
            problems.add(fileName + ": at least one item is required");
        }
        Set<String> codes = new HashSet<>();
        for (CatalogItemDefinition item : definition.items()) {
            String where = fileName + " item '" + item.code() + "'";
            checkItem(item, where, problems);
            if (item.code() != null && !codes.add(item.code())) {
                problems.add(where + ": duplicate code");
            }
        }
    }

    private static void checkItem(CatalogItemDefinition item, String where, List<String> problems) {
        if (item.code() == null || !CODE.matcher(item.code()).matches()) {
            problems.add(where + ": code must be lowercase words separated by hyphens");
        } else if (item.code().startsWith(CatalogItemCustomization.CUSTOM_CODE_PREFIX)) {
            problems.add(where + ": codes starting with '" + CatalogItemCustomization.CUSTOM_CODE_PREFIX
                    + "' are reserved for items added by a firm");
        }
        if (isBlank(item.name()) || item.name().length() > MAX_NAME_LENGTH) {
            problems.add(where + ": name must have between 1 and " + MAX_NAME_LENGTH + " characters");
        }
        if (item.article() != null && (isBlank(item.article()) || item.article().length() > MAX_ARTICLE_LENGTH)) {
            problems.add(where + ": article must be omitted or have between 1 and " + MAX_ARTICLE_LENGTH
                    + " characters");
        }
        item.attributes().forEach((key, value) -> {
            if (isBlank(key) || isBlank(value)) {
                problems.add(where + ": attribute '" + key + "' needs a name and a value");
            }
        });
    }

    /**
     * SnakeYAML (shipped with Spring Boot) parses with its safe constructor, which only builds plain
     * maps, lists and scalars, and rejects duplicate keys.
     */
    private <T> T read(Resource file, Class<T> type, String location) {
        LoaderOptions options = new LoaderOptions();
        options.setAllowDuplicateKeys(false);
        try (InputStream input = file.getInputStream()) {
            Object document = new Yaml(new SafeConstructor(options)).load(input);
            return mapper.convertValue(document, type);
        } catch (IOException | YAMLException | JacksonException | IllegalArgumentException e) {
            throw new InvalidJurisdictionPackageException(location, "cannot read " + file.getFilename(), e);
        }
    }

    private static Resource sibling(Resource manifestFile, String fileName, String location) {
        try {
            return manifestFile.createRelative(fileName);
        } catch (IOException e) {
            throw new InvalidJurisdictionPackageException(location, "cannot resolve " + fileName, e);
        }
    }

    /** Works for files and for entries inside a jar ({@code jar:file:...!/jurisdictions/x/...}). */
    private static String folderOf(Resource manifestFile, String location) {
        try {
            String[] segments = manifestFile.getURL().toString().split("/");
            return segments.length < 2 ? "" : segments[segments.length - 2];
        } catch (IOException e) {
            throw new InvalidJurisdictionPackageException(location, "cannot resolve its folder", e);
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
