package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.SettlementDto;
import com.omprakashgautam.homelab.spends.model.*;
import com.omprakashgautam.homelab.spends.repository.SettlementRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SettlementService {

    private final SettlementRepository settlementRepository;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    @Transactional
    public SettlementDto.Response create(UUID userId, SettlementDto.CreateRequest req) {
        User user = userRepository.getReferenceById(userId);
        Settlement settlement = Settlement.builder()
            .user(user)
            .participantName(req.participantName())
            .description(req.description())
            .status(SettlementStatus.OPEN)
            .build();

        if (req.items() != null) {
            req.items().forEach(item -> {
                Transaction tx = null;
                if (item.transactionId() != null) {
                    tx = transactionRepository.findById(item.transactionId()).orElse(null);
                }
                settlement.getItems().add(SettlementItem.builder()
                    .settlement(settlement)
                    .transaction(tx)
                    .description(item.description())
                    .totalAmount(item.totalAmount())
                    .yourShare(item.yourShare())
                    .build());
            });
        }

        return toResponse(settlementRepository.save(settlement));
    }

    @Transactional(readOnly = true)
    public List<SettlementDto.Response> list(UUID userId) {
        return settlementRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional
    public SettlementDto.Response markSettled(UUID id, UUID userId) {
        Settlement s = settlementRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!s.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        s.setStatus(SettlementStatus.SETTLED);
        s.setSettledAt(LocalDateTime.now());
        return toResponse(settlementRepository.save(s));
    }

    @Transactional
    public void delete(UUID id, UUID userId) {
        Settlement s = settlementRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!s.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        settlementRepository.delete(s);
    }

    private SettlementDto.Response toResponse(Settlement s) {
        BigDecimal totalOwed = s.getItems().stream()
            .map(SettlementItem::getYourShare)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        List<SettlementDto.ItemResponse> items = s.getItems().stream()
            .map(i -> new SettlementDto.ItemResponse(
                i.getId(),
                i.getTransaction() != null ? i.getTransaction().getId() : null,
                i.getDescription(),
                i.getTotalAmount(),
                i.getYourShare()))
            .toList();
        return new SettlementDto.Response(
            s.getId(), s.getParticipantName(), s.getDescription(),
            s.getStatus(), totalOwed, items, s.getCreatedAt(), s.getSettledAt());
    }
}
