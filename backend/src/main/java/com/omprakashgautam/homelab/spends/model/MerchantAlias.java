package com.omprakashgautam.homelab.spends.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "merchant_alias",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "raw_pattern"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MerchantAlias {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "raw_pattern", nullable = false, length = 500)
    private String rawPattern;

    @Column(name = "display_name", nullable = false, length = 200)
    private String displayName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
