package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.TransactionSplitDto;
import com.omprakashgautam.homelab.spends.service.TransactionSplitService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/transactions/{id}/splits")
@RequiredArgsConstructor
public class TransactionSplitController {

    private final TransactionSplitService transactionSplitService;

    @GetMapping
    public List<TransactionSplitDto.Response> getSplits(@PathVariable UUID id) {
        return transactionSplitService.getSplits(id);
    }

    @PutMapping
    public List<TransactionSplitDto.Response> saveSplits(
            @PathVariable UUID id,
            @RequestBody @Valid TransactionSplitDto.SaveRequest req) {
        return transactionSplitService.saveSplits(id, req.splits());
    }
}
