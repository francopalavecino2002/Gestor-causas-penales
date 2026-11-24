package ar.gestorpenal.jurisdiction;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
 * Reads a jurisdiction package: the {@code jurisdiction.yml} manifest with the catalogs shared by
 * every practice area next to it, and one {@code <area>/area.yml} manifest with the area's own
 * {@code <catalog-id>.yml} files per practice area (ADR-0032). Every problem found is reported at
 * once, and any problem rejects the whole package, so a broken file stops the application at
 * startup instead of showing a wrong catalog to a lawyer.
 */
final class JurisdictionPackageLoader {

    static final int MAX_NAME_LENGTH = 200;
    static final int MAX_ARTICLE_LENGTH = 120;

    /**
     * Items every area must offer because the case still stores {@code ActionType} and
     * {@code Representation} as enums (ADR-0032, T41). T42 replaces the enums and drops this check.
     */
    static final Map<Catalog, List<String>> ENUM_ITEMS = Map.of(
            Catalog.ACTION_TYPES, List.of("public", "public-on-complaint", "private"),
            Catalog.REPRESENTED_SIDES, List.of("defence", "private-prosecution"));

    private static final Pattern CODE = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");

    /**
     * Maps the parsed YAML onto the records. Strict, so a misspelled key is an error instead of a
     * silently missing value.
     */
    private final ObjectMapper mapper = JsonMapper.builder()
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .enable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
            .build();

    /**
     * @param manifestFile the {@code jurisdiction.yml} of the package
     * @param areaManifests the {@code area.yml} of every practice area folder of the package
     */
    JurisdictionPackage load(Resource manifestFile, Collection<Resource> areaManifests) {
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
            if (catalog.scope() == Catalog.Scope.JURISDICTION) {
                readCatalog(manifestFile, "", catalog, location, problems).ifPresent(found -> catalogs.put(catalog, found));
            }
        }
        Map<String, PracticeArea> areas = new LinkedHashMap<>();
        for (Resource areaManifest : areaManifests) {
            PracticeArea area = loadArea(areaManifest, location, problems);
            if (areas.putIfAbsent(area.code(), area) != null) {
                problems.add("Two practice areas use the code '" + area.code() + "'");
            }
        }
        if (areas.isEmpty()) {
            problems.add("at least one practice area folder with an area.yml is required");
        }
        if (!problems.isEmpty()) {
            throw new InvalidJurisdictionPackageException(location, problems);
        }
        return new JurisdictionPackage(manifest.code(), manifest.name(), manifest.version(), manifest.law(),
                manifest.reviewedOn(), manifest.source(), catalogs, areas);
    }

    private PracticeArea loadArea(Resource areaFile, String location, List<String> problems) {
        String folder = folderOf(areaFile, location);
        String prefix = folder + "/";
        PracticeArea.Manifest manifest = read(areaFile, PracticeArea.Manifest.class, location);
        List<PracticeModule> modules = checkAreaManifest(manifest, folder, problems);

        Map<Catalog, CatalogDefinition> catalogs = new EnumMap<>(Catalog.class);
        for (Catalog catalog : Catalog.values()) {
            if (catalog.scope() != Catalog.Scope.AREA) {
                continue;
            }
            boolean provided = catalog.module() == null || modules.contains(catalog.module());
            String fileName = prefix + catalog.id() + ".yml";
            if (!provided) {
                if (sibling(areaFile, catalog.id() + ".yml", location).exists()) {
                    problems.add(fileName + " is not used: the area does not declare the module '"
                            + catalog.module().id() + "'");
                }
                continue;
            }
            readCatalog(areaFile, prefix, catalog, location, problems).ifPresent(found -> catalogs.put(catalog, found));
        }
        return new PracticeArea(manifest.code(), manifest.name(), manifest.law(), manifest.reviewedOn(),
                manifest.source(), manifest.flags(), manifest.note(), modules, catalogs);
    }

    /** Reads {@code <catalog-id>.yml} next to {@code sibling}; a missing file is a problem, not an exception. */
    private Optional<CatalogDefinition> readCatalog(
            Resource sibling, String prefix, Catalog catalog, String location, List<String> problems) {
        String fileName = prefix + catalog.id() + ".yml";
        Resource file = sibling(sibling, catalog.id() + ".yml", location);
        if (!file.exists()) {
            problems.add(fileName + " is missing");
            return Optional.empty();
        }
        CatalogDefinition definition = read(file, CatalogDefinition.class, location);
        checkCatalog(catalog, fileName, definition, problems);
        if (catalog.scope() == Catalog.Scope.AREA) {
            ENUM_ITEMS.getOrDefault(catalog, List.of()).stream()
                    .filter(code -> definition.item(code).isEmpty())
                    .forEach(code -> problems.add(fileName + ": the item '" + code + "' is required (cases still store it)"));
        }
        return Optional.of(definition);
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

    /** Returns the modules the manifest declares that are known; unknown ones are reported. */
    private static List<PracticeModule> checkAreaManifest(
            PracticeArea.Manifest manifest, String folder, List<String> problems) {
        String where = folder + "/area.yml: ";
        if (manifest.code() == null || !CODE.matcher(manifest.code()).matches()) {
            problems.add(where + "code must be lowercase words separated by hyphens");
        } else if (!manifest.code().equals(folder)) {
            problems.add(where + "code '" + manifest.code() + "' must match its folder '" + folder + "'");
        }
        if (isBlank(manifest.name())) {
            problems.add(where + "name is required");
        }
        if (isBlank(manifest.law())) {
            problems.add(where + "law is required");
        }
        List<PracticeModule> modules = new ArrayList<>();
        for (String id : manifest.modules() == null ? List.<String>of() : manifest.modules()) {
            Optional<PracticeModule> module = id == null ? Optional.empty() : PracticeModule.fromId(id);
            if (module.isEmpty()) {
                problems.add(where + "unknown module '" + id + "'");
            } else if (modules.contains(module.get())) {
                problems.add(where + "module '" + id + "' is listed twice");
            } else {
                modules.add(module.get());
            }
        }
        for (PracticeModule module : modules) {
            module.requires().stream()
                    .filter(required -> !modules.contains(required))
                    .forEach(required -> problems.add(
                            where + "the module '" + module.id() + "' needs the module '" + required.id() + "'"));
        }
        return modules;
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
            if (document == null) {
                throw new InvalidJurisdictionPackageException(location, file.getFilename() + " is empty", null);
            }
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
