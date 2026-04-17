package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.NetWorthDto;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NetWorthService {

    private final TransactionRepository transactionRepository;

    @Transactional(readOnly = true)
    public NetWorthDto.Response getNetWorth(UUID userId, int months) {
        LocalDate from = LocalDate.now().minusMonths(months).withDayOfMonth(1);
        List<Object[]> rows = transactionRepository.monthlyFlow(userId, from);

        BigDecimal cumulative = BigDecimal.ZERO;
        List<NetWorthDto.MonthPoint> points = new ArrayList<>();
        for (Object[] row : rows) {
            int yr = ((Number) row[0]).intValue();
            int mo = ((Number) row[1]).intValue();
            BigDecimal totalIn  = row[2] != null ? (BigDecimal) row[2] : BigDecimal.ZERO;
            BigDecimal totalOut = row[3] != null ? (BigDecimal) row[3] : BigDecimal.ZERO;
            BigDecimal net = totalIn.subtract(totalOut);
            cumulative = cumulative.add(net);
            points.add(new NetWorthDto.MonthPoint(yr, mo, net, cumulative));
        }
        return new NetWorthDto.Response(points);
    }
}
