package ar.gestorpenal.audit;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Records every insert and update of this entity in the change history (ADR-0010). Fields are
 * audited by default; mark secrets with {@link AuditRedacted} and technical noise with
 * {@link NotAudited}.
 */
@Documented
@Inherited
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface Audited {}
