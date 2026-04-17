package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.AnnualBudget;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AnnualBudgetRepository extends JpaRepository<AnnualBudget, UUID> {

    @Query("SELECT ab FROM AnnualBudget ab WHERE ab.user.id = :userId AND ab.year = :year")
    List<AnnualBudget> findByUserIdAndYear(@Param("userId") UUID userId, @Param("year") int year);

    @Query("SELECT ab FROM AnnualBudget ab WHERE ab.user.id = :userId AND ab.category.id = :categoryId AND ab.year = :year")
    Optional<AnnualBudget> findByUserIdAndCategoryIdAndYear(
            @Param("userId") UUID userId,
            @Param("categoryId") UUID categoryId,
            @Param("year") int year);
}
