package ar.gestorpenal.hosting;

import java.io.IOException;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * Serves the built frontend from {@code classpath:/static/} (the Docker image copies it there) on the
 * same origin as the API, so no CORS is needed (ADR-0046). A client-side route such as
 * {@code /causas/123}, reloaded or opened from a link, gets {@code index.html} and the SPA router
 * takes over. API and actuator paths and missing files (a name with a dot) are never answered with
 * the page. In development there is no {@code index.html} and Vite serves the frontend.
 */
@Configuration
class SpaResourceConfig implements WebMvcConfigurer {

    static final String INDEX = "index.html";

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new SpaFallbackResolver());
    }

    /** True for a path the SPA router owns: not the API, not actuator, not a file name. */
    static boolean isClientRoute(String path) {
        String relative = path.startsWith("/") ? path.substring(1) : path;
        if (relative.equals("api") || relative.startsWith("api/")
                || relative.equals("actuator") || relative.startsWith("actuator/")) {
            return false;
        }
        String lastSegment = relative.substring(relative.lastIndexOf('/') + 1);
        return !lastSegment.contains(".");
    }

    private static final class SpaFallbackResolver extends PathResourceResolver {

        @Override
        protected Resource getResource(String resourcePath, Resource location) throws IOException {
            Resource requested = super.getResource(resourcePath, location);
            if (requested != null || !isClientRoute(resourcePath)) {
                return requested;
            }
            return super.getResource(INDEX, location);
        }
    }
}
