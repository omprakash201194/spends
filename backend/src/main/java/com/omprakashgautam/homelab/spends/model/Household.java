package com.omprakashgautam.homelab.spends.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "household")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Household {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "invite_code", unique = true, nullable = false, length = 12)
    private String inviteCode;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "max_category_depth", nullable = false)
    @Builder.Default
    private int maxCategoryDepth = 5;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
