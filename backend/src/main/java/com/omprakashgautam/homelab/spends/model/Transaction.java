package com.omprakashgautam.homelab.spends.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "financial_transaction")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bank_account_id", nullable = false)
    private BankAccount bankAccount;

    @Column(name = "value_date", nullable = false)
    private LocalDate valueDate;

    @Column(name = "transaction_date", nullable = false)
    private LocalDate transactionDate;

    @Column(name = "cheque_number", length = 50)
    private String chequeNumber;

    @Column(name = "raw_remarks", columnDefinition = "TEXT")
    private String rawRemarks;

    @Column(name = "merchant_name")
    private String merchantName;

    @Column(name = "withdrawal_amount", precision = 15, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal withdrawalAmount = BigDecimal.ZERO;

    @Column(name = "deposit_amount", precision = 15, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal depositAmount = BigDecimal.ZERO;

    @Column(precision = 15, scale = 2)
    private BigDecimal balance;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "import_batch_id")
    @ToString.Exclude
    private ImportBatch importBatch;

    @Column(name = "is_reviewed", nullable = false)
    @Builder.Default
    private boolean reviewed = false;

    @Column(name = "import_hash", unique = true, length = 64)
    private String importHash;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
