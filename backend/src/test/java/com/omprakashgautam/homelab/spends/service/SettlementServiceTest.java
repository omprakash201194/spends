package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.SettlementDto;
import com.omprakashgautam.homelab.spends.model.Settlement;
import com.omprakashgautam.homelab.spends.model.SettlementStatus;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.SettlementRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SettlementServiceTest {

    @Mock SettlementRepository settlementRepository;
    @Mock TransactionRepository transactionRepository;
    @Mock UserRepository userRepository;
    @InjectMocks SettlementService settlementService;

    @Test
    void create_savesSettlementAndReturnsResponse() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).build();
        when(userRepository.getReferenceById(userId)).thenReturn(user);
        when(settlementRepository.save(any())).thenAnswer(inv -> {
            Settlement s = inv.getArgument(0);
            s.setId(UUID.randomUUID());
            return s;
        });

        SettlementDto.CreateRequest req = new SettlementDto.CreateRequest(
            "Alice", "Dinner",
            List.of(new SettlementDto.ItemRequest(null, "Pizza", new BigDecimal("800"), new BigDecimal("400")))
        );

        SettlementDto.Response result = settlementService.create(userId, req);

        assertThat(result.participantName()).isEqualTo("Alice");
        assertThat(result.totalOwed()).isEqualByComparingTo("400");
        assertThat(result.status()).isEqualTo(SettlementStatus.OPEN);
        assertThat(result.items()).hasSize(1);
    }
}
