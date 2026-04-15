package com.omprakashgautam.homelab.spends.dto;

import com.omprakashgautam.homelab.spends.model.BankAccount;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.UUID;

public class BankAccountDto {

    public record Request(
            @NotBlank @Size(max = 100) String bankName,
            @Size(max = 50) String accountNumberMasked,
            @Size(max = 50) String accountType
    ) {}

    public record Response(
            UUID id,
            String bankName,
            String accountNumberMasked,
            String accountType,
            String currency,
            LocalDateTime createdAt
    ) {
        public static Response from(BankAccount a) {
            return new Response(
                    a.getId(),
                    a.getBankName(),
                    a.getAccountNumberMasked(),
                    a.getAccountType(),
                    a.getCurrency(),
                    a.getCreatedAt()
            );
        }
    }
}
