package dto;

import lombok.Getter;
import lombok.Setter;
import jakarta.validation.constraints.*;

@Getter
@Setter
public class UpdateUserDTO {

    @Size(min = 3, max = 100, message = "Nome deve ter entre 3 e 100 caracteres")
    private String name;

    @Pattern(regexp = "^\\d{10,11}$", message = "Celular deve ter 10 ou 11 dígitos")
    private String cell;

    private String street;

    private String neighborhood;

    private String city;

    private String state;

    private String zipCode;

}