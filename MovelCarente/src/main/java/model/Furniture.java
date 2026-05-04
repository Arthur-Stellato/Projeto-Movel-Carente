package model;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;
import model.enums.FurnitureCondition;
import model.enums.FurnitureStatus;
import model.enums.TypeFurniture;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "furnitures") // Boa prática: definir o nome da tabela no plural
public class Furniture {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    @Column(unique = true, nullable = false, updatable = false)
    private java.util.UUID externalId = java.util.UUID.randomUUID();

    @Column(nullable = false)
    private String title; // Um título curto para o anúncio

    @Column(columnDefinition = "TEXT")
    private String description; // TEXT permite descrições longas sem erro de limite

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TypeFurniture typeFurniture;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FurnitureCondition furnitureCondition;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FurnitureStatus status;

    private String photoUrl; // Para o link da imagem

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // Garante que a data de criação seja salva automaticamente
    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) {
            this.status = FurnitureStatus.AVAILABLE; // Status padrão ao criar
        }
    }
}