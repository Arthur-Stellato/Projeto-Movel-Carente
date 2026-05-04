package dto;

import lombok.Getter;
import lombok.Setter;
import model.enums.FurnitureCondition;
import model.enums.TypeFurniture;
import jakarta.validation.constraints.*;

@Getter
@Setter
public class FurnitureCreateDTO {

        @NotNull(message = "Titulo é obrigatório")
        private String title;

        @NotNull(message = "Tipo de móvel é obrigatório")
        private TypeFurniture typeFurniture;

        @NotNull(message = "Condição do móvel é obrigatória")
        private FurnitureCondition furnitureCondition;

        @NotBlank(message = "Descrição é obrigatória")
        @Size(min = 10, max = 500, message = "Descrição deve ter entre 10 e 500 caracteres")
        private String description;

        @Pattern(regexp = ".*\\.(jpg|jpeg|png|webp)$", message = "O nome da foto deve ter uma extensão válida (jpg, png, webp)")
        private String photoUrl;
}