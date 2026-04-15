package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.HouseholdDto;
import com.omprakashgautam.homelab.spends.model.Household;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class HouseholdService {

    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;

    private static final DateTimeFormatter MONTH_HEADER = DateTimeFormatter.ofPattern("MMMM yyyy");

    @Transactional(readOnly = true)
    public HouseholdDto.Summary getSummary(UUID userId) {
        User currentUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        Household household = currentUser.getHousehold();
        if (household == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User has no household");
        }

        UUID householdId = household.getId();

        // Anchor month = most recent transaction date across the whole household
        LocalDate anchor = resolveAnchorMonth(householdId);
        LocalDate from   = anchor.withDayOfMonth(1);
        LocalDate to     = anchor.withDayOfMonth(anchor.lengthOfMonth());

        List<User> members = userRepository.findByHouseholdId(householdId);

        BigDecimal householdSpent  = BigDecimal.ZERO;
        BigDecimal householdIncome = BigDecimal.ZERO;

        List<HouseholdDto.MemberStat> memberStats = members.stream()
                .map(member -> {
                    BigDecimal spent  = transactionRepository.sumWithdrawals(member.getId(), from, to);
                    BigDecimal income = transactionRepository.sumDeposits(member.getId(), from, to);
                    long count        = transactionRepository.countInPeriod(member.getId(), from, to);

                    List<Object[]> catBreakdown = transactionRepository.categoryBreakdown(member.getId(), from, to);
                    String topCategory      = catBreakdown.isEmpty() ? null : (String) catBreakdown.get(0)[0];
                    String topCategoryColor = catBreakdown.isEmpty() ? null : (String) catBreakdown.get(0)[1];

                    return new HouseholdDto.MemberStat(
                            member.getId(),
                            member.getDisplayName(),
                            member.getRole().name(),
                            spent,
                            income,
                            count,
                            topCategory,
                            topCategoryColor
                    );
                })
                // Admin first, then alphabetically
                .sorted((a, b) -> {
                    if (!a.role().equals(b.role())) return "ADMIN".equals(a.role()) ? -1 : 1;
                    return a.displayName().compareTo(b.displayName());
                })
                .toList();

        for (HouseholdDto.MemberStat m : memberStats) {
            householdSpent  = householdSpent.add(m.totalSpent());
            householdIncome = householdIncome.add(m.totalIncome());
        }

        return new HouseholdDto.Summary(
                householdId,
                household.getName(),
                household.getInviteCode(),
                anchor.format(MONTH_HEADER),
                householdSpent,
                householdIncome,
                memberStats
        );
    }

    private LocalDate resolveAnchorMonth(UUID householdId) {
        LocalDate latest = transactionRepository.latestTransactionDateForHousehold(householdId);
        return latest != null ? latest : LocalDate.now();
    }
}
