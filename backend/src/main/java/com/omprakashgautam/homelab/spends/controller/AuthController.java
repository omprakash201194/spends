package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.UserDto;
import com.omprakashgautam.homelab.spends.dto.auth.AuthResponse;
import com.omprakashgautam.homelab.spends.dto.auth.ForgotPasswordRequest;
import com.omprakashgautam.homelab.spends.dto.auth.LoginRequest;
import com.omprakashgautam.homelab.spends.dto.auth.RegisterRequest;
import com.omprakashgautam.homelab.spends.dto.auth.ResetPasswordRequest;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.AuthService;
import com.omprakashgautam.homelab.spends.service.PasswordResetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/me")
    public ResponseEntity<UserDto> me(@AuthenticationPrincipal UserDetailsImpl principal) {
        return ResponseEntity.ok(authService.getCurrentUser(principal.getUsername()));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordResetService.initiateReset(request.email());
        return ResponseEntity.ok(Map.of("message", "If that email is registered, a reset link has been sent."));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request.token(), request.newPassword());
        return ResponseEntity.ok(Map.of("message", "Password updated successfully."));
    }
}
