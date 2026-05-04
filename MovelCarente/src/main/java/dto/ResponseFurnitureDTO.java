package dto;

import lombok.Getter;
import model.enums.FurnitureCondition;
import model.enums.FurnitureStatus;
import model.enums.TypeFurniture;
import java.util.UUID;
import java.time.LocalDateTime;

@Getter
public class ResponseFurnitureDTO {

    private UUID id; // External ID do móvel

    private String title;
    private TypeFurniture typeFurniture;
    private FurnitureCondition furnitureCondition;
    private FurnitureStatus status;
    private String description;

    private UUID userId; // External ID do usuário
    private String userName;
    private String contactLink;

    // Localização vinda do Address (Privacidade: não mostramos rua/CEP na vitrine)
    private String city;
    private String neighborhood;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
