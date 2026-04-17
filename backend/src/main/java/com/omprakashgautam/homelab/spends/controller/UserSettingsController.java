package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.UserSettingsDto;
import com.omprakashgautam.homelab.spends.model.Household;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.HouseholdRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class UserSettingsController {

    private final UserRepository userRepository;
    private final HouseholdRepository householdRepository;

    private UserSettingsDto.Settings toSettings(User user) {
        return new UserSettingsDto.Settings(
                user.getClaudeApiKey() != null && !user.getClaudeApiKey().isBlank(),
                user.getNotificationEmail()
        );
    }

    @GetMapping
    public ResponseEntity<UserSettingsDto.Settings> getSettings(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        User user = userRepository.findById(principal.getId()).orElseThrow();
        return ResponseEntity.ok(toSettings(user));
    }

    @PutMapping("/api-key")
    @Transactional
    public ResponseEntity<UserSettingsDto.Settings> saveApiKey(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestBody UserSettingsDto.ApiKeyRequest request) {
        User user = userRepository.findById(principal.getId()).orElseThrow();
        user.setClaudeApiKey(request.apiKey() != null ? request.apiKey().trim() : null);
        userRepository.save(user);
        return ResponseEntity.ok(toSettings(user));
    }

    @DeleteMapping("/api-key")
    @Transactional
    public ResponseEntity<UserSettingsDto.Settings> deleteApiKey(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        User user = userRepository.findById(principal.getId()).orElseThrow();
        user.setClaudeApiKey(null);
        userRepository.save(user);
        return ResponseEntity.ok(toSettings(user));
    }

    @PutMapping("/notification-email")
    @Transactional
    public ResponseEntity<UserSettingsDto.Settings> saveNotificationEmail(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestBody UserSettingsDto.NotificationEmailRequest request) {
        User user = userRepository.findById(principal.getId()).orElseThrow();
        String email = request.notificationEmail();
        user.setNotificationEmail(email != null && !email.isBlank() ? email.trim() : null);
        userRepository.save(user);
        return ResponseEntity.ok(toSettings(user));
    }

    @GetMapping("/preferences")
    public ResponseEntity<UserSettingsDto.Preferences> getPreferences(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        User user = userRepository.findById(principal.getId()).orElseThrow();
        return ResponseEntity.ok(new UserSettingsDto.Preferences(
                user.getHousehold().getMaxCategoryDepth()));
    }

    @PutMapping("/preferences")
    @Transactional
    public ResponseEntity<UserSettingsDto.Preferences> savePreferences(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestBody UserSettingsDto.PreferencesRequest req) {
        if (req.maxCategoryDepth() < 1 || req.maxCategoryDepth() > 10) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "maxCategoryDepth must be between 1 and 10");
        }
        User user = userRepository.findById(principal.getId()).orElseThrow();
        Household hh = user.getHousehold();
        hh.setMaxCategoryDepth(req.maxCategoryDepth());
        householdRepository.save(hh);
        return ResponseEntity.ok(new UserSettingsDto.Preferences(hh.getMaxCategoryDepth()));
    }
}
