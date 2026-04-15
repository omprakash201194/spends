package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.UserSettingsDto;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class UserSettingsController {

    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<UserSettingsDto.Settings> getSettings(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        User user = userRepository.findById(principal.getId()).orElseThrow();
        return ResponseEntity.ok(new UserSettingsDto.Settings(
                user.getClaudeApiKey() != null && !user.getClaudeApiKey().isBlank()
        ));
    }

    @PutMapping("/api-key")
    @Transactional
    public ResponseEntity<UserSettingsDto.Settings> saveApiKey(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestBody UserSettingsDto.ApiKeyRequest request) {
        User user = userRepository.findById(principal.getId()).orElseThrow();
        user.setClaudeApiKey(request.apiKey() != null ? request.apiKey().trim() : null);
        userRepository.save(user);
        return ResponseEntity.ok(new UserSettingsDto.Settings(true));
    }

    @DeleteMapping("/api-key")
    @Transactional
    public ResponseEntity<UserSettingsDto.Settings> deleteApiKey(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        User user = userRepository.findById(principal.getId()).orElseThrow();
        user.setClaudeApiKey(null);
        userRepository.save(user);
        return ResponseEntity.ok(new UserSettingsDto.Settings(false));
    }
}
