package dto;

import lombok.Getter;
import lombok.Setter;
import java.util.UUID;

@Getter
@Setter
public class ResponseUserDTO {

    private UUID id; // External ID (Segurança)

    private String name;
    private String email;
    private String cell;

    private String street;
    private String neighborhood;
    private String city;
    private String state;
    private String zipCode;
}
