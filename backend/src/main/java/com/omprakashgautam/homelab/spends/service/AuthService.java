package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.UserDto;
import com.omprakashgautam.homelab.spends.dto.auth.AuthResponse;
import com.omprakashgautam.homelab.spends.dto.auth.LoginRequest;
import com.omprakashgautam.homelab.spends.dto.auth.RegisterRequest;
import com.omprakashgautam.homelab.spends.model.Household;
import com.omprakashgautam.homelab.spends.model.Role;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.HouseholdRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import com.omprakashgautam.homelab.spends.security.JwtTokenProvider;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final HouseholdRepository householdRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByUsername(req.getUsername())) {
            throw new IllegalArgumentException("Username already taken");
        }
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new IllegalArgumentException("Email already registered");
        }

        Household household;
        Role role;

        if (req.getInviteCode() != null && !req.getInviteCode().isBlank()) {
            // Join existing household
            household = householdRepository.findByInviteCode(req.getInviteCode().trim())
                    .orElseThrow(() -> new IllegalArgumentException("Invalid invite code"));
            role = Role.MEMBER;
        } else if (req.getHouseholdName() != null && !req.getHouseholdName().isBlank()) {
            // Create new household
            household = householdRepository.save(Household.builder()
                    .name(req.getHouseholdName().trim())
                    .inviteCode(generateInviteCode())
                    .build());
            role = Role.ADMIN;
        } else {
            throw new IllegalArgumentException("Provide either householdName (to create) or inviteCode (to join)");
        }

        User user = userRepository.save(User.builder()
                .username(req.getUsername())
                .email(req.getEmail())
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .displayName(req.getDisplayName())
                .household(household)
                .role(role)
                .build());

        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.getUsername(), req.getPassword())
        );
        String token = jwtTokenProvider.generateToken(auth);

        return buildAuthResponse(token, user, household);
    }

    public AuthResponse login(LoginRequest req) {
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.getUsername(), req.getPassword())
        );
        String token = jwtTokenProvider.generateToken(auth);
        UserDetailsImpl principal = (UserDetailsImpl) auth.getPrincipal();
        User user = userRepository.findByUsername(principal.getUsername())
                .orElseThrow();
        return buildAuthResponse(token, user, user.getHousehold());
    }

    public UserDto getCurrentUser(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalStateException("User not found"));
        return toUserDto(user);
    }

    private AuthResponse buildAuthResponse(String token, User user, Household household) {
        return AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .userId(user.getId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .role(user.getRole().name())
                .householdId(household != null ? household.getId() : null)
                .householdName(household != null ? household.getName() : null)
                .build();
    }

    private UserDto toUserDto(User user) {
        return UserDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .displayName(user.getDisplayName())
                .role(user.getRole().name())
                .householdId(user.getHousehold() != null ? user.getHousehold().getId() : null)
                .householdName(user.getHousehold() != null ? user.getHousehold().getName() : null)
                .build();
    }

    private String generateInviteCode() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
    }
}
