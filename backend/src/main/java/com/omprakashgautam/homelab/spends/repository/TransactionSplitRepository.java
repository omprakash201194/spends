package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.TransactionSplit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface TransactionSplitRepository extends JpaRepository<TransactionSplit, UUID> {

    List<TransactionSplit> findByTransactionId(UUID transactionId);

    @Modifying
    @Query("DELETE FROM TransactionSplit s WHERE s.transaction.id = :transactionId")
    void deleteByTransactionId(@Param("transactionId") UUID transactionId);
}
