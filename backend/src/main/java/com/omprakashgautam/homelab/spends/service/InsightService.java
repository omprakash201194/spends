package com.omprakashgautam.homelab.spends.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.omprakashgautam.homelab.spends.dto.InsightDto;
import com.omprakashgautam.homelab.spends.dto.RecurringDto;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.BudgetRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class InsightService {

    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final BudgetRepository budgetRepository;
    private final RecurringService recurringService;

    private static final String CLAUDE_MODEL     = "claude-haiku-4-5-20251001";
    private static final int    MAX_TOKENS       = 600;
    private static final String ANTHROPIC_API    = "https://api.anthropic.com/v1/messages";
    private static final String ANTHROPIC_VERSION = "2023-06-01";

    private static final DateTimeFormatter MONTH_HEADER = DateTimeFormatter.ofPattern("MMMM yyyy");

    private final RestClient restClient = RestClient.create();

    @Transactional(readOnly = true)
    public InsightDto.Response getInsight(UUID userId, InsightDto.InsightType type) {
        User user = userRepository.findById(userId).orElseThrow();
        String apiKey = user.getClaudeApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No API key configured. Go to Settings and add your Anthropic API key.");
        }

        LocalDate anchor = resolveAnchorMonth(userId);
        LocalDate from   = anchor.withDayOfMonth(1);
        LocalDate to     = anchor.withDayOfMonth(anchor.lengthOfMonth());
        String month     = anchor.format(MONTH_HEADER);

        String prompt = switch (type) {
            case DASHBOARD    -> buildDashboardPrompt(userId, from, to, month);
            case BUDGET       -> buildBudgetPrompt(userId, from, to, month);
            case TRANSACTIONS -> buildTransactionsPrompt(userId, from, to, month);
            case RECURRING    -> buildRecurringPrompt(userId);
        };

        String insight = callClaude(apiKey, prompt);
        return new InsightDto.Response(insight, month);
    }

    // ── Prompt builders ───────────────────────────────────────────────────────

    private String buildDashboardPrompt(UUID userId, LocalDate from, LocalDate to, String month) {
        BigDecimal spent  = transactionRepository.sumWithdrawals(userId, from, to);
        BigDecimal income = transactionRepository.sumDeposits(userId, from, to);
        BigDecimal net    = income.subtract(spent);
        long count        = transactionRepository.countInPeriod(userId, from, to);

        var sb = new StringBuilder();
        sb.append("My spending summary for ").append(month).append(":\n\n");
        sb.append("Total spent: ₹").append(fmt(spent)).append("\n");
        sb.append("Total income: ₹").append(fmt(income)).append("\n");
        sb.append("Net: ").append(net.compareTo(BigDecimal.ZERO) >= 0 ? "Surplus" : "Deficit")
          .append(" of ₹").append(fmt(net.abs())).append("\n");
        sb.append("Transactions: ").append(count).append("\n\n");

        sb.append("Spending by category:\n");
        for (Object[] row : transactionRepository.categoryBreakdown(userId, from, to)) {
            BigDecimal amount = (BigDecimal) row[2];
            BigDecimal pct = spent.compareTo(BigDecimal.ZERO) > 0
                    ? amount.multiply(BigDecimal.valueOf(100)).divide(spent, 0, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            sb.append("  ").append(row[0]).append(": ₹").append(fmt(amount))
              .append(" (").append(pct).append("%)\n");
        }

        sb.append("\nTop merchants:\n");
        for (Object[] row : transactionRepository.topMerchants(userId, from, to)) {
            sb.append("  ").append(row[0]).append(": ₹").append(fmt((BigDecimal) row[1]))
              .append(" (").append(row[2]).append("×)\n");
        }

        return systemPrompt("financial summary") + "\n\nUser data:\n" + sb +
               "\n\nProvide 4 concise bullet-point insights (use • as bullet). " +
               "Focus on patterns, savings opportunities, and one positive observation.";
    }

    private String buildBudgetPrompt(UUID userId, LocalDate from, LocalDate to, String month) {
        int year  = from.getYear();
        int mth   = from.getMonthValue();

        var budgets = budgetRepository.findByUserIdAndYearAndMonth(userId, year, mth);
        var catSpend = transactionRepository.categoryBreakdown(userId, from, to);

        // map categoryName → spent
        var spentMap = new java.util.HashMap<String, BigDecimal>();
        for (Object[] row : catSpend) {
            spentMap.put((String) row[0], (BigDecimal) row[2]);
        }

        var sb = new StringBuilder();
        sb.append("My budget status for ").append(month).append(":\n\n");

        if (budgets.isEmpty()) {
            sb.append("No budgets set yet.\n\n");
        } else {
            sb.append("Budgets:\n");
            for (var b : budgets) {
                BigDecimal limit   = b.getAmount();
                BigDecimal spent2  = spentMap.getOrDefault(b.getCategory().getName(), BigDecimal.ZERO);
                int pct = limit.compareTo(BigDecimal.ZERO) > 0
                        ? spent2.multiply(BigDecimal.valueOf(100)).divide(limit, 0, RoundingMode.HALF_UP).intValue()
                        : 0;
                String status = pct >= 100 ? "OVER BUDGET" : pct >= 80 ? "near limit" : "on track";
                sb.append("  ").append(b.getCategory().getName())
                  .append(": spent ₹").append(fmt(spent2))
                  .append(" of ₹").append(fmt(limit))
                  .append(" (").append(pct).append("%) — ").append(status).append("\n");
            }
        }

        // Categories with spending but no budget
        var budgetedCategories = budgets.stream()
                .map(b -> b.getCategory().getName()).collect(java.util.stream.Collectors.toSet());
        sb.append("\nCategories with spending but no budget:\n");
        boolean any = false;
        for (Object[] row : catSpend) {
            String cat = (String) row[0];
            if (!budgetedCategories.contains(cat)) {
                sb.append("  ").append(cat).append(": ₹").append(fmt((BigDecimal) row[2])).append("\n");
                any = true;
            }
        }
        if (!any) sb.append("  (none)\n");

        return systemPrompt("budget advisor") + "\n\nUser data:\n" + sb +
               "\n\nProvide 4 concise bullet-point recommendations (use • as bullet). " +
               "Suggest which limits to adjust, where to add new budgets, and one encouragement.";
    }

    private String buildTransactionsPrompt(UUID userId, LocalDate from, LocalDate to, String month) {
        BigDecimal spent = transactionRepository.sumWithdrawals(userId, from, to);
        long count       = transactionRepository.countInPeriod(userId, from, to);

        var sb = new StringBuilder();
        sb.append("Transaction analysis for ").append(month).append(":\n\n");
        sb.append("Total: ").append(count).append(" transactions, ₹").append(fmt(spent)).append(" spent\n\n");

        sb.append("By category:\n");
        for (Object[] row : transactionRepository.categoryBreakdown(userId, from, to)) {
            sb.append("  ").append(row[0]).append(": ₹").append(fmt((BigDecimal) row[2])).append("\n");
        }

        sb.append("\nTop merchants:\n");
        for (Object[] row : transactionRepository.topMerchants(userId, from, to)) {
            sb.append("  ").append(row[0]).append(": ₹").append(fmt((BigDecimal) row[1]))
              .append(" (").append(row[2]).append(" visits)\n");
        }

        return systemPrompt("spending pattern analyst") + "\n\nUser data:\n" + sb +
               "\n\nProvide 4 concise bullet-point insights (use • as bullet). " +
               "Identify spending habits, frequent merchants, and specific optimisation tips.";
    }

    private String buildRecurringPrompt(UUID userId) {
        RecurringDto.RecurringSummary summary = recurringService.getPatterns(userId);

        var sb = new StringBuilder();
        sb.append("Recurring transaction patterns detected over the last 12 months:\n\n");

        if (summary.patterns().isEmpty()) {
            sb.append("No recurring patterns detected yet.\n");
        } else {
            BigDecimal totalExpenses = BigDecimal.ZERO;
            BigDecimal totalIncome   = BigDecimal.ZERO;
            int expenseCount = 0;
            int incomeCount  = 0;

            for (RecurringDto.RecurringPattern p : summary.patterns()) {
                boolean isIncome = p.categoryName() != null &&
                        (p.categoryName().toLowerCase().contains("income") ||
                         p.categoryName().toLowerCase().contains("salary"));

                sb.append("  ").append(p.merchantName())
                  .append(": ₹").append(fmt(p.averageAmount())).append("/month")
                  .append(isIncome ? " [income]" : " [expense]");
                if (p.categoryName() != null) sb.append(", ").append(p.categoryName());
                sb.append(", seen ").append(p.occurrences()).append(" months");
                if (!p.activeThisMonth()) sb.append(" [missed this month]");
                sb.append("\n");

                if (isIncome) { totalIncome   = totalIncome.add(p.averageAmount());   incomeCount++; }
                else          { totalExpenses = totalExpenses.add(p.averageAmount()); expenseCount++; }
            }

            sb.append("\nTotal estimated monthly recurring expenses: ₹").append(fmt(totalExpenses))
              .append(" across ").append(expenseCount).append(" patterns\n");
            sb.append("Total estimated monthly recurring income: ₹").append(fmt(totalIncome))
              .append(" across ").append(incomeCount).append(" patterns\n");
        }

        return systemPrompt("subscription and recurring payment analyst") + "\n\nUser data:\n" + sb +
               "\n\nProvide 4 concise bullet-point insights (use • as bullet). " +
               "Identify potential forgotten subscriptions, cost-saving opportunities, " +
               "any patterns that were missed this month, and one observation about income stability.";
    }

    private static String systemPrompt(String role) {
        return "You are a friendly personal finance advisor acting as a " + role +
               " for an Indian household. Be concise, specific, and use ₹ for rupee amounts. " +
               "Respond only with the bullet points, no preamble or closing sentence.";
    }

    // ── Claude API call ───────────────────────────────────────────────────────

    private String callClaude(String apiKey, String prompt) {
        var body = Map.of(
                "model", CLAUDE_MODEL,
                "max_tokens", MAX_TOKENS,
                "messages", List.of(Map.of("role", "user", "content", prompt))
        );

        try {
            JsonNode response = restClient.post()
                    .uri(ANTHROPIC_API)
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", ANTHROPIC_VERSION)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);

            return response.get("content").get(0).get("text").asText();

        } catch (RestClientResponseException ex) {
            String detail = ex.getResponseBodyAsString();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Claude API error (" + ex.getStatusCode().value() + "): " + detail);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Failed to reach Claude API: " + ex.getMessage());
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private LocalDate resolveAnchorMonth(UUID userId) {
        LocalDate latest = transactionRepository.latestTransactionDate(userId);
        return latest != null ? latest : LocalDate.now();
    }

    private static String fmt(BigDecimal v) {
        return String.format("%,.0f", v.abs());
    }
}
