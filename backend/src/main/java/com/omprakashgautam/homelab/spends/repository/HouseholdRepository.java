package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.Household;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface HouseholdRepository extends JpaRepository<Household, UUID> {
    Optional<Household> findByInviteCode(String inviteCode);
}
