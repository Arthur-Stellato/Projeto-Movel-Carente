package dto;

import lombok.Getter;
import lombok.Setter;
import model.enums.FurnitureCondition;
import model.enums.FurnitureStatus;
import model.enums.TypeFurniture;
import jakarta.validation.constraints.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
public class UpdateFurnitureDTO {


    private UUID id;

    private String title;

    private TypeFurniture typeFurniture;

    private FurnitureCondition furnitureCondition;

    private FurnitureStatus status;

    @Size(min = 10, max = 500, message = "Descrição deve ter entre 10 e 500 caracteres")
    private String description;

    private String photoUrl;

}