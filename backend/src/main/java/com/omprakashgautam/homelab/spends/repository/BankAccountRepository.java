package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.BankAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BankAccountRepository extends JpaRepository<BankAccount, UUID> {
    List<BankAccount> findByUserId(UUID userId);
    List<BankAccount> findByUserHouseholdId(UUID householdId);
}
