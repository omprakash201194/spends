package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.MerchantAliasDto;
import com.omprakashgautam.homelab.spends.model.MerchantAlias;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.MerchantAliasRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MerchantAliasServiceTest {

    @Mock MerchantAliasRepository merchantAliasRepository;
    @Mock UserRepository userRepository;
    @InjectMocks MerchantAliasService merchantAliasService;

    @Test
    void save_createsNewAlias() {
        UUID userId = UUID.randomUUID();
        when(merchantAliasRepository.findByUserIdAndRawPattern(userId, "UPI/SWIGGY"))
            .thenReturn(Optional.empty());
        when(userRepository.getReferenceById(userId))
            .thenReturn(User.builder().id(userId).build());
        when(merchantAliasRepository.save(any())).thenAnswer(inv -> {
            MerchantAlias a = inv.getArgument(0);
            a.setId(UUID.randomUUID());
            return a;
        });

        MerchantAliasDto.Response result = merchantAliasService.save(userId, "UPI/SWIGGY", "Swiggy");

        assertThat(result.displayName()).isEqualTo("Swiggy");
        assertThat(result.rawPattern()).isEqualTo("UPI/SWIGGY");
    }

    @Test
    void save_updatesExistingAlias() {
        UUID userId = UUID.randomUUID();
        MerchantAlias existing = MerchantAlias.builder()
            .id(UUID.randomUUID())
            .rawPattern("UPI/SWIGGY")
            .displayName("Old Name")
            .build();
        when(merchantAliasRepository.findByUserIdAndRawPattern(userId, "UPI/SWIGGY"))
            .thenReturn(Optional.of(existing));
        when(merchantAliasRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MerchantAliasDto.Response result = merchantAliasService.save(userId, "UPI/SWIGGY", "Swiggy");

        assertThat(result.displayName()).isEqualTo("Swiggy");
    }
}
