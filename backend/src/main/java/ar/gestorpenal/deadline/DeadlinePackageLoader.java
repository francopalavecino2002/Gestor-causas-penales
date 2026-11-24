package ar.gestorpenal.deadline;

import ar.gestorpenal.deadline.CourtCalendar.NonBusinessDay;
import ar.gestorpenal.jurisdiction.ReviewFlag;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
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
 * Reads the {@code deadline-rules.yml} of a practice area and the {@code court-calendar.yml} of its
 * jurisdiction. Like the catalog loader (ADR-0013), every problem is reported at once and any problem
 * stops the application at startup: a wrong rule must never reach a lawyer.
 */
final class DeadlinePackageLoader {

    static final String RULES_FILE = "deadline-rules.yml";
    static final String CALENDAR_FILE = "court-calendar.yml";
    static final int MAX_ALERT_DAYS = 90;

    /** Articles the stage 0 review could not read in the text of the code: they need the flag. */
    static final int FIRST_UNVERIFIED_ARTICLE = 156;
    static final int LAST_UNVERIFIED_ARTICLE = 272;

    private static final Pattern CODE = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");
    /** The article number that starts each part of "158; 160 inc. 7" (not the inciso). */
    private static final Pattern ARTICLE_NUMBER = Pattern.compile("(?:^|;)\\s*(\\d+)");

    private final ObjectMapper mapper = JsonMapper.builder()
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .enable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
            .build();

    record RulesFile(String source, String law, List<DeadlineRule> rules) {}

    record CalendarFile(String source, List<ReviewFlag> flags, List<Integer> years, List<CalendarEntry> days) {}

    /** One non-business day, or a run of them ({@code to} included). */
    record CalendarEntry(LocalDate from, LocalDate to, String name, List<ReviewFlag> flags) {}

    /**
     * @param jurisdictionCode the folder of the jurisdiction
     * @param areaCode the folder of the practice area the rules belong to
     * @param calendarFile the jurisdiction's {@code court-calendar.yml}
     */
    DeadlinePackage load(String jurisdictionCode, String areaCode, Resource rulesFile, Resource calendarFile) {
        String location = rulesFile.getDescription();
        List<String> problems = new ArrayList<>();
        RulesFile rules = read(rulesFile, RulesFile.class, location);
        checkRules(rules, problems);
        CourtCalendar calendar = null;
        if (!calendarFile.exists()) {
            problems.add(CALENDAR_FILE + " is missing");
        } else {
            calendar = calendar(read(calendarFile, CalendarFile.class, location), problems);
        }
        if (!problems.isEmpty()) {
            throw new InvalidDeadlinePackageException(location, problems);
        }
        return new DeadlinePackage(jurisdictionCode, areaCode, rules.law(), rules.source(), rules.rules(), calendar);
    }

    private static void checkRules(RulesFile file, List<String> problems) {
        if (isBlank(file.source())) {
            problems.add(RULES_FILE + ": source is required");
        }
        if (isBlank(file.law())) {
            problems.add(RULES_FILE + ": law is required");
        }
        if (file.rules() == null || file.rules().isEmpty()) {
            problems.add(RULES_FILE + ": at least one rule is required");
            return;
        }
        Set<String> codes = new HashSet<>();
        for (DeadlineRule rule : file.rules()) {
            if (rule == null) {
                problems.add(RULES_FILE + ": a rule entry is empty");
                continue;
            }
            String where = RULES_FILE + " rule '" + rule.code() + "'";
            checkRule(rule, where, problems);
            if (rule.code() != null && !codes.add(rule.code())) {
                problems.add(where + ": duplicate code");
            }
        }
    }

    private static void checkRule(DeadlineRule rule, String where, List<String> problems) {
        if (rule.code() == null || !CODE.matcher(rule.code()).matches()) {
            problems.add(where + ": code must be lowercase words separated by hyphens");
        }
        requireText(rule.name(), where + ": name", problems);
        requireText(rule.trigger(), where + ": trigger", problems);
        requireText(rule.consequence(), where + ": consequence", problems);
        if (isBlank(rule.article()) && isBlank(rule.law())) {
            problems.add(where + ": an article or a law is required");
        }
        if (rule.kind() == null || rule.computation() == null || rule.scope() == null) {
            problems.add(where + ": kind, computation and scope are required");
            return;
        }
        if (rule.caseLaw() == null || isBlank(rule.caseLaw().status()) || rule.caseLaw().reviewedOn() == null) {
            problems.add(where + ": caseLaw needs a status and the day it was reviewed");
        }
        boolean setByCourt = rule.computation() == Computation.SET_BY_COURT;
        if (setByCourt != (rule.kind() == RuleKind.JUDICIAL)) {
            problems.add(where + ": a judicial rule, and only a judicial rule, is SET_BY_COURT");
        }
        if (setByCourt && (rule.duration() != null || !rule.extensions().isEmpty())) {
            problems.add(where + ": a SET_BY_COURT rule has neither duration nor extensions");
        }
        if (!setByCourt && (rule.duration() == null || rule.duration() < 1)) {
            problems.add(where + ": duration must be 1 or greater");
        }
        if (rule.computation() == Computation.HOURS && !rule.suspendedBy().isEmpty()) {
            problems.add(where + ": a term in hours runs continuously and cannot be suspended");
        }
        for (DeadlineRule.ExtensionStep step : rule.extensions()) {
            if (isBlank(step.grantedBy()) || step.maxAmount() < 1) {
                problems.add(where + ": every extension needs grantedBy and a maxAmount of 1 or greater");
            }
        }
        if (rule.alertDaysBefore() < 0 || rule.alertDaysBefore() > MAX_ALERT_DAYS) {
            problems.add(where + ": alertDaysBefore must be between 0 and " + MAX_ALERT_DAYS);
        }
        if (citesUnverifiedArticle(rule.article()) && !rule.flags().contains(ReviewFlag.NO_VERIFICADO)) {
            problems.add(where + ": articles " + FIRST_UNVERIFIED_ARTICLE + " to " + LAST_UNVERIFIED_ARTICLE
                    + " must carry the flag no-verificado");
        }
    }

    static boolean citesUnverifiedArticle(String article) {
        if (article == null) {
            return false;
        }
        Matcher matcher = ARTICLE_NUMBER.matcher(article);
        while (matcher.find()) {
            int number = Integer.parseInt(matcher.group(1));
            if (number >= FIRST_UNVERIFIED_ARTICLE && number <= LAST_UNVERIFIED_ARTICLE) {
                return true;
            }
        }
        return false;
    }

    private static CourtCalendar calendar(CalendarFile file, List<String> problems) {
        if (isBlank(file.source())) {
            problems.add(CALENDAR_FILE + ": source is required");
        }
        Set<Integer> years = file.years() == null ? Set.of() : Set.copyOf(file.years());
        if (years.isEmpty()) {
            problems.add(CALENDAR_FILE + ": at least one year is required");
        }
        Map<LocalDate, NonBusinessDay> days = new HashMap<>();
        for (CalendarEntry entry : file.days() == null ? List.<CalendarEntry>of() : file.days()) {
            if (entry == null) {
                problems.add(CALENDAR_FILE + ": a day entry is empty");
                continue;
            }
            String where = CALENDAR_FILE + " entry '" + entry.name() + "' (" + entry.from() + ")";
            if (entry.from() == null || isBlank(entry.name())) {
                problems.add(where + ": from and name are required");
                continue;
            }
            LocalDate to = entry.to() == null ? entry.from() : entry.to();
            if (to.isBefore(entry.from())) {
                problems.add(where + ": to cannot be before from");
                continue;
            }
            if (!years.contains(entry.from().getYear()) || !years.contains(to.getYear())) {
                problems.add(where + ": its year is not listed under years");
                continue;
            }
            List<ReviewFlag> flags = entry.flags() == null ? List.of() : List.copyOf(entry.flags());
            for (LocalDate day = entry.from(); !day.isAfter(to); day = day.plusDays(1)) {
                days.putIfAbsent(day, new NonBusinessDay(day, entry.name().strip(), flags));
            }
        }
        return new CourtCalendar(years, days, file.source(), file.flags());
    }

    /** SnakeYAML's safe constructor builds plain maps, lists and scalars and rejects duplicate keys. */
    private <T> T read(Resource file, Class<T> type, String location) {
        LoaderOptions options = new LoaderOptions();
        options.setAllowDuplicateKeys(false);
        try (InputStream input = file.getInputStream()) {
            Object document = new Yaml(new SafeConstructor(options)).load(input);
            if (document == null) {
                throw new InvalidDeadlinePackageException(location, file.getFilename() + " is empty", null);
            }
            return mapper.convertValue(document, type);
        } catch (IOException | YAMLException | JacksonException | IllegalArgumentException e) {
            throw new InvalidDeadlinePackageException(location, "cannot read " + file.getFilename(), e);
        }
    }

    private static void requireText(String value, String what, List<String> problems) {
        if (isBlank(value)) {
            problems.add(what + " is required");
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
