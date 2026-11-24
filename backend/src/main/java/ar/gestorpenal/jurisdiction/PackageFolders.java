package ar.gestorpenal.jurisdiction;

import java.io.IOException;
import java.io.UncheckedIOException;
import org.springframework.core.io.Resource;

/** Reads the jurisdiction and area codes from where a package file lives. */
public final class PackageFolders {

    private PackageFolders() {}

    /**
     * The name of the folder {@code levelsUp} segments above the file (1 is the file itself, 2 its
     * folder). Works for files and for entries inside a jar.
     */
    public static String folderOf(Resource file, int levelsUp) {
        try {
            String[] segments = file.getURL().toString().split("/");
            return segments.length < levelsUp ? "" : segments[segments.length - levelsUp];
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot resolve the folder of " + file.getDescription(), e);
        }
    }
}
