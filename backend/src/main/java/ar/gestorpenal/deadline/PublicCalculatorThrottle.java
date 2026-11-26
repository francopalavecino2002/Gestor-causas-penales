package ar.gestorpenal.deadline;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * In-memory sliding-window limit of requests per client address to the public calculator (ADR-0041),
 * so the endpoint without login cannot be used to load the server. Memory is bounded: at most
 * {@link #MAX_TRACKED_CLIENTS} addresses, least recently used evicted first. State is per instance.
 */
@Component
class PublicCalculatorThrottle {

    static final int MAX_TRACKED_CLIENTS = 50_000;

    private final PublicCalculatorProperties limits;
    private final Clock clock;
    private final Map<String, Deque<Instant>> requests = new LinkedHashMap<>(256, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Deque<Instant>> eldest) {
            return size() > MAX_TRACKED_CLIENTS;
        }
    };

    PublicCalculatorThrottle(PublicCalculatorProperties limits, Clock clock) {
        this.limits = limits;
        this.clock = clock;
    }

    /**
     * Counts one request for the client, unless it is already at its limit.
     *
     * @throws PublicCalculatorThrottledException if the client is over its limit
     */
    synchronized void acquire(String clientKey) {
        Instant now = clock.instant();
        Deque<Instant> recent = requests.computeIfAbsent(clientKey, key -> new ArrayDeque<>());
        Instant cutoff = now.minus(limits.window());
        while (!recent.isEmpty() && !recent.peekFirst().isAfter(cutoff)) {
            recent.removeFirst();
        }
        if (recent.size() >= limits.maxRequestsPerClient()) {
            throw new PublicCalculatorThrottledException(
                    Duration.between(now, recent.peekFirst().plus(limits.window())));
        }
        recent.addLast(now);
    }

    synchronized int trackedClients() {
        return requests.size();
    }
}
