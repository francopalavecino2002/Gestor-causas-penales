package ar.gestorpenal.dataimport;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.lang.annotation.Annotation;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Runs Bean Validation on the request record of a feature, the same constraints its endpoint has,
 * and turns each violation into an error of the column that feeds the property.
 */
@Component
public class ImportValidator {

    private final Validator validator;

    ImportValidator(Validator validator) {
        this.validator = validator;
    }

    /** {@code columns} maps a property of the record to the header it comes from. */
    public void check(ImportRow row, Object data, Map<String, String> columns) {
        for (ConstraintViolation<Object> violation : validator.validate(data)) {
            String property = violation.getPropertyPath().toString();
            Annotation constraint = violation.getConstraintDescriptor().getAnnotation();
            row.error(columns.get(property), messageOf(constraint), violation.getMessage());
        }
    }

    private static String messageOf(Annotation constraint) {
        return switch (constraint) {
            case Size size -> "Tiene que tener como máximo " + size.max() + " caracteres.";
            case Email email -> "No parece un email válido.";
            case PastOrPresent past -> "La fecha no puede ser futura.";
            case Min min -> "Tiene que ser como mínimo " + min.value() + ".";
            case Max max -> "Tiene que ser como máximo " + max.value() + ".";
            default -> "El valor no es válido.";
        };
    }
}
