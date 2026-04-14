package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TransactionRepository extends JpaRepository<Transaction, UUID> {
    boolean existsByImportHash(String importHash);
    Optional<Transaction> findByImportHash(String importHash);
}
