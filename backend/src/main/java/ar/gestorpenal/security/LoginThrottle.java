package ar.gestorpenal.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * In-memory sliding-window counter of login attempts (ADR-0008).
 *
 * <p>An attempt is <em>reserved</em> before the password is checked, atomically with the limit
 * check, so a burst of parallel requests cannot get more guesses than the limit. A successful login
 * refunds its reservation: it clears the account and gives the client its attempt back.
 *
 * <p>Memory is bounded: at most {@link #MAX_TRACKED_KEYS} keys, least recently used evicted first.
 * State is per application instance and is lost on restart.
 */
@Component
class LoginThrottle {

    static final int MAX_TRACKED_KEYS = 50_000;

    private final LoginThrottleProperties limits;
    private final Clock clock;
    private final Map<String, Deque<Instant>> attempts = new LinkedHashMap<>(256, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Deque<Instant>> eldest) {
            return size() > MAX_TRACKED_KEYS;
        }
    };

    LoginThrottle(LoginThrottleProperties limits, Clock clock) {
        this.limits = limits;
        this.clock = clock;
    }

    /**
     * Counts one attempt for the account and the client, unless either is already at its limit.
     *
     * @throws LoginThrottledException if the account or the client is over its limit
     */
    synchronized void acquire(String accountKey, String clientKey) {
        Instant now = clock.instant();
        Deque<Instant> account = recent(account(accountKey), now);
        Deque<Instant> client = recent(client(clientKey), now);
        if (account.size() >= limits.maxFailuresPerAccount()) {
            throw new LoginThrottledException(waitUntilOldestExpires(account, now));
        }
        if (client.size() >= limits.maxFailuresPerClient()) {
            throw new LoginThrottledException(waitUntilOldestExpires(client, now));
        }
        account.addLast(now);
        client.addLast(now);
    }

    /** Refunds the attempt reserved by {@link #acquire} and forgets the account's failures. */
    synchronized void recordSuccess(String accountKey, String clientKey) {
        attempts.remove(account(accountKey));
        Deque<Instant> client = attempts.get(client(clientKey));
        if (client != null && !client.isEmpty()) {
            client.removeLast();
        }
    }

    synchronized int trackedKeys() {
        return attempts.size();
    }

    private Deque<Instant> recent(String key, Instant now) {
        Deque<Instant> timestamps = attempts.computeIfAbsent(key, k -> new ArrayDeque<>());
        Instant cutoff = now.minus(limits.window());
        while (!timestamps.isEmpty() && !timestamps.peekFirst().isAfter(cutoff)) {
            timestamps.removeFirst();
        }
        return timestamps;
    }

    private Duration waitUntilOldestExpires(Deque<Instant> timestamps, Instant now) {
        return Duration.between(now, timestamps.peekFirst().plus(limits.window()));
    }

    private static String account(String accountKey) {
        return "account:" + accountKey;
    }

    private static String client(String clientKey) {
        return "client:" + clientKey;
    }
}
