package ar.gestorpenal.bootstrap;

import ar.gestorpenal.bootstrap.FirstFirmBootstrap.FirstFirm;
import java.io.PrintStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * The one-time command (profile {@code bootstrap}, T66): creates the first firm and its owner from
 * {@link FirstFirmRequest} and prints the temporary password once. The application then exits
 * ({@code GestorPenalApplication}); a refusal or an invalid value fails the start with a non-zero
 * exit code and creates nothing. See {@code docs/HOSTING.md}.
 */
@Component
@Profile("bootstrap")
@EnableConfigurationProperties(FirstFirmRequest.class)
class FirstFirmBootstrapRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(FirstFirmBootstrapRunner.class);

    private final FirstFirmBootstrap bootstrap;
    private final FirstFirmRequest request;
    private final PrintStream console;

    @Autowired
    FirstFirmBootstrapRunner(FirstFirmBootstrap bootstrap, FirstFirmRequest request) {
        this(bootstrap, request, System.out);
    }

    FirstFirmBootstrapRunner(FirstFirmBootstrap bootstrap, FirstFirmRequest request, PrintStream console) {
        this.bootstrap = bootstrap;
        this.request = request;
        this.console = console;
    }

    @Override
    public void run(ApplicationArguments args) {
        FirstFirm firm = bootstrap.create(request);
        // The log line has no password; the password goes to the console only, once.
        log.info("First firm '{}' created with owner {}", firm.firmSlug(), firm.ownerEmail());
        console.println();
        console.println("Estudio creado: " + firm.firmSlug());
        console.println("Titular: " + firm.ownerEmail());
        console.println("Contraseña temporal: " + firm.temporaryPassword());
        console.println("Entregásela al titular por un canal seguro. Al entrar va a tener que elegir"
                + " su propia contraseña; después activá el segundo factor en Ajustes.");
        console.println();
    }
}
