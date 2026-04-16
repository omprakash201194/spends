package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.ImportBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

public interface ImportBatchRepository extends JpaRepository<ImportBatch, UUID> {

    /** Returns all batches for the user, newest first, with bankAccount eagerly loaded. */
    @Query("""
        SELECT b FROM ImportBatch b
        JOIN FETCH b.bankAccount
        WHERE b.bankAccount.user.id = :userId
        ORDER BY b.importedAt DESC
        """)
    List<ImportBatch> findByUserIdWithAccount(@Param("userId") UUID userId);

    /** Returns true if the batch exists and belongs to the user. */
    @Query("""
        SELECT CASE WHEN COUNT(b) > 0 THEN true ELSE false END
        FROM ImportBatch b
        WHERE b.id = :batchId AND b.bankAccount.user.id = :userId
        """)
    boolean existsByIdAndUserId(@Param("batchId") UUID batchId, @Param("userId") UUID userId);

    /**
     * Bulk-deletes all import batches for the user.
     * Note: call {@code transactionRepository.deleteAllByUserId} first to remove
     * transactions without an import batch; transactions linked to these batches
     * will be removed by the DB cascade (migration 008).
     */
    @Modifying
    @Transactional
    @Query("""
        DELETE FROM ImportBatch b
        WHERE b.bankAccount.user.id = :userId
        """)
    void deleteAllByUserId(@Param("userId") UUID userId);
}
