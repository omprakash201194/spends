package com.omprakashgautam.homelab.spends.security;

import com.omprakashgautam.homelab.spends.model.Household;
import com.omprakashgautam.homelab.spends.model.Role;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.HouseholdRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class OAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;
    private final HouseholdRepository householdRepository;

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) {
        OAuth2User oauth2User = super.loadUser(userRequest);

        String email = oauth2User.getAttribute("email");
        String name = oauth2User.getAttribute("name");

        userRepository.findByEmail(email).orElseGet(() -> createUser(email, name));

        return oauth2User;
    }

    private User createUser(String email, String name) {
        String username = deriveUniqueUsername(email);
        String displayName = (name != null && !name.isBlank()) ? name : email;

        Household household = householdRepository.save(Household.builder()
                .name(displayName + "'s Household")
                .inviteCode(generateInviteCode())
                .build());

        log.info("Creating new user via Google OAuth2: email={}", email);

        return userRepository.save(User.builder()
                .username(username)
                .email(email)
                .passwordHash(null)
                .displayName(displayName)
                .household(household)
                .role(Role.ADMIN)
                .build());
    }

    private String deriveUniqueUsername(String email) {
        String base = email.split("@")[0].replaceAll("[^a-zA-Z0-9_]", "_").toLowerCase();
        if (!userRepository.existsByUsername(base)) return base;
        for (int i = 2; i < 100; i++) {
            String candidate = base + i;
            if (!userRepository.existsByUsername(candidate)) return candidate;
        }
        return base + "_" + UUID.randomUUID().toString().substring(0, 4);
    }

    private String generateInviteCode() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
    }
}
