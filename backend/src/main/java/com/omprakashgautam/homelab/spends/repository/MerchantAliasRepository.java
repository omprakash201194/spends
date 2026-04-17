package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.MerchantAlias;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MerchantAliasRepository extends JpaRepository<MerchantAlias, UUID> {
    List<MerchantAlias> findByUserId(UUID userId);
    Optional<MerchantAlias> findByUserIdAndRawPattern(UUID userId, String rawPattern);
    void deleteByIdAndUserId(UUID id, UUID userId);
}
