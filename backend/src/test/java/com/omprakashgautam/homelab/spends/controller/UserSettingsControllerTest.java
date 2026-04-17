package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.UserSettingsDto;
import com.omprakashgautam.homelab.spends.model.Household;
import com.omprakashgautam.homelab.spends.model.Role;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.HouseholdRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserSettingsControllerTest {

    @Mock UserRepository userRepository;
    @Mock HouseholdRepository householdRepository;

    @InjectMocks UserSettingsController controller;

    private User buildUser(UUID userId, Household hh) {
        return User.builder()
                .id(userId)
                .household(hh)
                .username("testuser")
                .email("test@example.com")
                .passwordHash("hash")
                .displayName("Test User")
                .role(Role.MEMBER)
                .build();
    }

    @Test
    void getPreferences_returnsMaxCategoryDepth() {
        UUID userId = UUID.randomUUID();
        Household hh = Household.builder()
                .id(UUID.randomUUID())
                .name("H")
                .inviteCode("X")
                .maxCategoryDepth(5)
                .build();
        User user = buildUser(userId, hh);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        var principal = UserDetailsImpl.build(user);
        var response = controller.getPreferences(principal);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().maxCategoryDepth()).isEqualTo(5);
    }

    @Test
    void savePreferences_updatesMaxDepthOnHousehold() {
        UUID userId = UUID.randomUUID();
        Household hh = Household.builder()
                .id(UUID.randomUUID())
                .name("H")
                .inviteCode("X")
                .maxCategoryDepth(5)
                .build();
        User user = buildUser(userId, hh);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(householdRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var principal = UserDetailsImpl.build(user);
        var req = new UserSettingsDto.PreferencesRequest(3);
        var response = controller.savePreferences(principal, req);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().maxCategoryDepth()).isEqualTo(3);
        verify(householdRepository).save(argThat(h -> h.getMaxCategoryDepth() == 3));
    }

    @Test
    void savePreferences_outOfRange_throwsBadRequest() {
        UUID userId = UUID.randomUUID();
        Household hh = Household.builder()
                .id(UUID.randomUUID())
                .name("H")
                .inviteCode("X")
                .maxCategoryDepth(5)
                .build();
        User user = buildUser(userId, hh);
        var principal = UserDetailsImpl.build(user);

        var req = new UserSettingsDto.PreferencesRequest(0);
        var ex = assertThrows(ResponseStatusException.class,
                () -> controller.savePreferences(principal, req));
        assertThat(ex.getStatusCode().value()).isEqualTo(400);
    }
}
