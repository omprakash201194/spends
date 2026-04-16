package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.DataHealthDto;
import com.omprakashgautam.homelab.spends.repository.CategoryRuleRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DataHealthService {

    private final TransactionRepository transactionRepository;
    private final CategoryRuleRepository categoryRuleRepository;

    @Transactional(readOnly = true)
    public DataHealthDto.Report getReport(UUID userId) {
        long total         = transactionRepository.countByUserId(userId);
        long uncategorized = transactionRepository.countUncategorized(userId);
        long miscellaneous = transactionRepository.countByCategoryName(userId, "Miscellaneous");
        LocalDate earliest = transactionRepository.earliestDate(userId);
        LocalDate latest   = transactionRepository.latestTransactionDate(userId);
        long accounts      = transactionRepository.countDistinctBankAccounts(userId);

        long userRules   = categoryRuleRepository.countByUserId(userId);
        long globalRules = categoryRuleRepository.countGlobal();

        List<DataHealthDto.NearDuplicate> dups = transactionRepository.findNearDuplicates(userId)
                .stream()
                .map(r -> new DataHealthDto.NearDuplicate(
                        r[0] + " · " + r[1],
                        ((LocalDate) r[2]).toString(),
                        (BigDecimal) r[3],
                        (Long) r[4]
                ))
                .toList();

        return new DataHealthDto.Report(
                new DataHealthDto.TransactionStats(
                        total, uncategorized, miscellaneous,
                        earliest != null ? earliest.toString() : null,
                        latest   != null ? latest.toString()   : null,
                        accounts
                ),
                new DataHealthDto.RuleStats(userRules, globalRules),
                dups
        );
    }
}
