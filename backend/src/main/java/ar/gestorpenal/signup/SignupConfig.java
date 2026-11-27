package ar.gestorpenal.signup;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(SignupProperties.class)
class SignupConfig {}
