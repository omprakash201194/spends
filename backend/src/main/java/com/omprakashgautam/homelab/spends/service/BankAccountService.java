package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.BankAccountDto;
import com.omprakashgautam.homelab.spends.model.BankAccount;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.BankAccountRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BankAccountService {

    private final BankAccountRepository bankAccountRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<BankAccountDto.Response> getAccountsForUser(UUID userId) {
        return bankAccountRepository.findByUserId(userId)
                .stream()
                .map(BankAccountDto.Response::from)
                .toList();
    }

    @Transactional
    public BankAccountDto.Response create(UUID userId, BankAccountDto.Request request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        BankAccount account = BankAccount.builder()
                .user(user)
                .bankName(request.bankName())
                .accountNumberMasked(request.accountNumberMasked())
                .accountType(request.accountType())
                .build();

        return BankAccountDto.Response.from(bankAccountRepository.save(account));
    }

    @Transactional
    public BankAccountDto.Response update(UUID accountId, UUID userId, BankAccountDto.Request request) {
        BankAccount account = bankAccountRepository.findById(accountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bank account not found"));

        if (!account.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        account.setBankName(request.bankName());
        account.setAccountNumberMasked(request.accountNumberMasked());
        account.setAccountType(request.accountType());

        return BankAccountDto.Response.from(bankAccountRepository.save(account));
    }

    @Transactional
    public void delete(UUID accountId, UUID userId) {
        BankAccount account = bankAccountRepository.findById(accountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bank account not found"));

        if (!account.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        bankAccountRepository.delete(account);
    }

    @Transactional
    public BankAccount findOrCreate(UUID userId, String bankName, String accountNumberMasked, String accountType) {
        List<BankAccount> existing = bankAccountRepository.findByUserId(userId);

        if (accountNumberMasked != null && !accountNumberMasked.isBlank()) {
            return existing.stream()
                    .filter(a -> accountNumberMasked.equals(a.getAccountNumberMasked()))
                    .findFirst()
                    .orElseGet(() -> createInternal(userId, bankName, accountNumberMasked, accountType));
        }

        return existing.stream()
                .filter(a -> bankName.equalsIgnoreCase(a.getBankName()))
                .findFirst()
                .orElseGet(() -> createInternal(userId, bankName, accountNumberMasked, accountType));
    }

    private BankAccount createInternal(UUID userId, String bankName, String accountNumberMasked, String accountType) {
        User user = userRepository.getReferenceById(userId);
        BankAccount account = BankAccount.builder()
                .user(user)
                .bankName(bankName)
                .accountNumberMasked(accountNumberMasked)
                .accountType(accountType)
                .build();
        return bankAccountRepository.save(account);
    }
}
