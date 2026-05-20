package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.model.PasswordResetToken;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.PasswordResetTokenRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final JavaMailSender mailSender;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.mail.from}")
    private String fromAddress;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Transactional
    public void initiateReset(String email) {
        var userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            // Don't reveal whether the email exists
            log.debug("Password reset requested for unknown email: {}", email);
            return;
        }
        User user = userOpt.get();

        tokenRepository.deleteByUserId(user.getId());

        String rawToken = UUID.randomUUID().toString();
        tokenRepository.save(PasswordResetToken.builder()
                .user(user)
                .tokenHash(hash(rawToken))
                .expiresAt(Instant.now().plus(1, ChronoUnit.HOURS))
                .build());

        sendEmail(user.getEmail(), user.getDisplayName(), rawToken);
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        PasswordResetToken token = tokenRepository.findByTokenHash(hash(rawToken))
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired reset token"));

        if (Instant.now().isAfter(token.getExpiresAt())) {
            tokenRepository.delete(token);
            throw new IllegalArgumentException("Reset token has expired");
        }

        User user = token.getUser();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        tokenRepository.delete(token);
        log.info("Password reset completed for user: {}", user.getUsername());
    }

    private void sendEmail(String to, String displayName, String rawToken) {
        String resetLink = frontendUrl + "/reset-password?token=" + rawToken;
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(to);
        message.setSubject("SpendStack — Reset your password");
        message.setText(
                "Hi " + displayName + ",\n\n" +
                "You requested a password reset for your SpendStack account.\n\n" +
                "Click the link below to set a new password (valid for 1 hour):\n" +
                resetLink + "\n\n" +
                "If you didn't request this, you can safely ignore this email.\n\n" +
                "— SpendStack"
        );
        mailSender.send(message);
        log.info("Password reset email sent to {}", to);
    }

    private String hash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(bytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
