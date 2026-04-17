package com.omprakashgautam.homelab.spends.dto;

import java.math.BigDecimal;
import java.util.List;

public class NetWorthDto {
    public record MonthPoint(int year, int month, BigDecimal netFlow, BigDecimal cumulativeNet) {}
    public record Response(List<MonthPoint> points) {}
}
