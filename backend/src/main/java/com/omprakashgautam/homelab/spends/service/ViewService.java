package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.ViewDto;
import com.omprakashgautam.homelab.spends.model.*;
import com.omprakashgautam.homelab.spends.model.BankAccount;
import com.omprakashgautam.homelab.spends.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ViewService {

    private final ViewRepository viewRepository;
    private final ViewTransactionLinkRepository linkRepository;
    private final ViewCategoryBudgetRepository categoryBudgetRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final CategoryRepository categoryRepository;

    // ── List ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ViewDto.ViewResponse> listViews(UUID userId) {
        Household household = requireHousehold(userId);
        return viewRepository
                .findByHouseholdIdOrderByStartDateDesc(household.getId())
                .stream()
                .map(this::toViewResponse)
                .toList();
    }

    // ── Create ────────────────────────────────────────────────────────────────

    @Transactional
    public ViewDto.ViewResponse createView(UUID userId, ViewDto.CreateRequest req) {
        Household household = requireHousehold(userId);

        SpendView view = viewRepository.save(SpendView.builder()
                .household(household)
                .name(req.name())
                .type(req.type())
                .startDate(req.startDate())
                .endDate(req.endDate())
                .description(req.description())
                .color(req.color())
                .totalBudget(req.totalBudget())
                .build());

        // Persist category budgets from template / user input
        if (req.categoryBudgets() != null && !req.categoryBudgets().isEmpty()) {
            List<ViewCategoryBudget> budgets = req.categoryBudgets().stream()
                    .map(cb -> ViewCategoryBudget.builder()
                            .view(view)
                            .category(categoryRepository.getReferenceById(cb.categoryId()))
                            .expectedAmount(cb.expectedAmount())
                            .build())
                    .toList();
            categoryBudgetRepository.saveAll(budgets);
        }

        // Auto-tag all household transactions in the date range
        List<Transaction> txs = linkRepository
                .findHouseholdTransactionsInRange(household.getId(), req.startDate(), req.endDate());
        List<ViewTransactionLink> links = txs.stream()
                .map(tx -> ViewTransactionLink.builder().view(view).transaction(tx).build())
                .toList();
        linkRepository.saveAll(links);

        return toViewResponse(view);
    }

    // ── Get single view ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ViewDto.ViewResponse getView(UUID userId, UUID viewId) {
        return toViewResponse(resolveView(userId, viewId));
    }

    // ── Update (metadata only — dates/type are immutable) ────────────────────

    @Transactional
    public ViewDto.ViewResponse updateView(UUID userId, UUID viewId, ViewDto.UpdateRequest req) {
        SpendView view = resolveView(userId, viewId);
        view.setName(req.name());
        view.setDescription(req.description());
        view.setColor(req.color());
        view.setTotalBudget(req.totalBudget());
        return toViewResponse(viewRepository.save(view));
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    @Transactional
    public void deleteView(UUID userId, UUID viewId) {
        viewRepository.delete(resolveView(userId, viewId));
    }

    // ── Paginated transactions (List tab) ─────────────────────────────────────

    @Transactional(readOnly = true)
    public ViewDto.TransactionPage getTransactions(UUID userId, UUID viewId, int page, int size, UUID accountId) {
        resolveView(userId, viewId);
        String accountIdStr = accountId != null ? accountId.toString() : null;
        Page<Transaction> txPage = linkRepository
                .findTransactionsByViewIdFiltered(viewId, accountIdStr, PageRequest.of(page, size));
        return new ViewDto.TransactionPage(
                txPage.getContent().stream().map(this::toTransactionItem).toList(),
                page, size,
                txPage.getTotalElements(),
                txPage.getTotalPages()
        );
    }

    // ── Summary (Summary tab) ─────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ViewDto.SummaryResponse getSummary(UUID userId, UUID viewId) {
        SpendView view = resolveView(userId, viewId);

        BigDecimal totalSpent = linkRepository.totalSpentByViewId(viewId);
        long count = linkRepository.countByViewId(viewId);

        // Expected amounts keyed by category UUID
        Map<UUID, BigDecimal> expectedMap = categoryBudgetRepository.findByViewId(viewId)
                .stream()
                .collect(Collectors.toMap(
                        vcb -> vcb.getCategory().getId(),
                        ViewCategoryBudget::getExpectedAmount));

        List<ViewDto.CategoryBudgetItem> categories = linkRepository
                .categoryBreakdownByViewId(viewId)
                .stream()
                .map(row -> new ViewDto.CategoryBudgetItem(
                        (UUID) row[0],
                        (String) row[1],
                        (String) row[2],
                        expectedMap.get((UUID) row[0]),
                        (BigDecimal) row[3]))
                .toList();

        List<ViewDto.MemberBreakdown> members = linkRepository
                .memberBreakdownByViewId(viewId)
                .stream()
                .map(row -> new ViewDto.MemberBreakdown(
                        (UUID) row[0],
                        (String) row[1],
                        (BigDecimal) row[2],
                        (Long) row[3]))
                .toList();

        return new ViewDto.SummaryResponse(
                viewId, view.getName(), view.getTotalBudget(),
                totalSpent != null ? totalSpent : BigDecimal.ZERO, count, categories, members);
    }

    // ── Create view from tag ──────────────────────────────────────────────────

    @Transactional
    public ViewDto.ViewResponse createViewFromTag(UUID userId, String tag) {
        Household household = requireHousehold(userId);

        List<Transaction> matches = transactionRepository
                .findByUserIdAndRawRemarksContaining(userId, tag.trim().toLowerCase());
        if (matches.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No transactions found matching tag: " + tag);
        }

        LocalDate startDate = matches.stream()
                .map(Transaction::getValueDate)
                .min(Comparator.naturalOrder())
                .orElse(LocalDate.now());
        LocalDate endDate = matches.stream()
                .map(Transaction::getValueDate)
                .max(Comparator.naturalOrder())
                .orElse(LocalDate.now());

        SpendView view = viewRepository.save(SpendView.builder()
                .household(household)
                .name(tag)
                .type(ViewType.CUSTOM)
                .startDate(startDate)
                .endDate(endDate)
                .build());

        List<ViewTransactionLink> links = matches.stream()
                .map(tx -> ViewTransactionLink.builder().view(view).transaction(tx).build())
                .toList();
        linkRepository.saveAll(links);

        return toViewResponse(view);
    }

    // ── Manually add transactions ─────────────────────────────────────────────

    @Transactional
    public void addTransactions(UUID userId, UUID viewId, List<UUID> txIds) {
        SpendView view = resolveView(userId, viewId);
        txIds.forEach(txId -> {
            if (!linkRepository.existsByViewIdAndTransactionId(viewId, txId)) {
                linkRepository.save(ViewTransactionLink.builder()
                        .view(view)
                        .transaction(transactionRepository.getReferenceById(txId))
                        .build());
            }
        });
    }

    // ── Manually remove a transaction ─────────────────────────────────────────

    @Transactional
    public void removeTransaction(UUID userId, UUID viewId, UUID txId) {
        resolveView(userId, viewId);
        linkRepository.findByViewIdAndTransactionId(viewId, txId)
                .ifPresent(linkRepository::delete);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private SpendView resolveView(UUID userId, UUID viewId) {
        Household household = requireHousehold(userId);
        SpendView view = viewRepository.findById(viewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "View not found"));
        if (!view.getHousehold().getId().equals(household.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return view;
    }

    private Household requireHousehold(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if (user.getHousehold() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User has no household");
        }
        return user.getHousehold();
    }

    private ViewDto.ViewResponse toViewResponse(SpendView view) {
        BigDecimal totalSpent = linkRepository.totalSpentByViewId(view.getId());
        long count = linkRepository.countByViewId(view.getId());
        List<ViewDto.CategoryBudgetItem> budgetItems = categoryBudgetRepository
                .findByViewId(view.getId())
                .stream()
                .map(vcb -> new ViewDto.CategoryBudgetItem(
                        vcb.getCategory().getId(),
                        vcb.getCategory().getName(),
                        vcb.getCategory().getColor(),
                        vcb.getExpectedAmount(),
                        BigDecimal.ZERO))
                .toList();
        return new ViewDto.ViewResponse(
                view.getId(), view.getName(), view.getType(),
                view.getStartDate(), view.getEndDate(),
                view.getDescription(), view.getColor(),
                view.getTotalBudget(),
                totalSpent != null ? totalSpent : BigDecimal.ZERO,
                (int) count,
                budgetItems);
    }

    private ViewDto.TransactionItem toTransactionItem(Transaction tx) {
        BankAccount account = tx.getBankAccount();
        return new ViewDto.TransactionItem(
                tx.getId(),
                tx.getMerchantName(),
                tx.getRawRemarks(),
                tx.getValueDate(),
                tx.getWithdrawalAmount(),
                tx.getDepositAmount(),
                tx.getCategory() != null ? tx.getCategory().getName() : null,
                tx.getCategory() != null ? tx.getCategory().getColor() : null,
                account != null ? account.getUser().getDisplayName() : null,
                account != null ? account.getBankName() : "");
    }
}
