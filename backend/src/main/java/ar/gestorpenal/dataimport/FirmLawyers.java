package ar.gestorpenal.dataimport;

import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.Role;
import ar.gestorpenal.user.UserRepository;
import ar.gestorpenal.user.UserService;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Finds the owner or lawyer of the current firm that an email cell names. */
@Component
public class FirmLawyers {

    private final UserRepository users;

    FirmLawyers(UserRepository users) {
        this.users = users;
    }

    /**
     * The id of the active owner or lawyer with that email, or {@code null} for a blank cell or, with
     * an error added to the row, an email that is not one of them. A user of another firm is never found.
     */
    public UUID idOf(ImportRow row, String column, String email, ImportContext context) {
        if (email == null) {
            return null;
        }
        String normalized = UserService.normalizeEmail(email);
        Map<String, UUID> cache = context.state(Cache.class, Cache::new).byEmail;
        if (!cache.containsKey(normalized)) {
            cache.put(normalized, users.findByEmail(normalized)
                    .filter(FirmLawyers::canActAsLawyer)
                    .map(AppUser::getId)
                    .orElse(null));
        }
        UUID id = cache.get(normalized);
        if (id == null) {
            row.error(column, "No hay un abogado activo del estudio con ese email.");
        }
        return id;
    }

    /** The lawyer named by the cell of {@code column}. */
    public UUID idOf(ImportRow row, String column, ImportContext context) {
        return idOf(row, column, row.text(column), context);
    }

    private static boolean canActAsLawyer(AppUser user) {
        return user.isActive() && (user.getRole() == Role.OWNER || user.getRole() == Role.LAWYER);
    }

    private static final class Cache {
        private final Map<String, UUID> byEmail = new HashMap<>();
    }
}
