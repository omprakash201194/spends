package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final JavaMailSender mailSender;

    @Value("${notification.enabled:false}")
    private boolean enabled;

    private static final BigDecimal ANOMALY_THRESHOLD = new BigDecimal("10000");

    public record AnomalyEntry(String description, BigDecimal amount) {}

    @Transactional(readOnly = true)
    public List<AnomalyEntry> detectAnomalies(User user) {
        LocalDate since = LocalDate.now().minusDays(1);
        return transactionRepository.findLargeWithdrawalsInLast24Hours(
                user.getId(), since, ANOMALY_THRESHOLD)
            .stream()
            .map(tx -> new AnomalyEntry(tx.getRawRemarks(), tx.getWithdrawalAmount()))
            .toList();
    }

    @Scheduled(cron = "0 0 8 * * *")
    @Transactional(readOnly = true)
    public void sendDailyDigest() {
        if (!enabled) {
            log.debug("Notifications disabled — skipping daily digest");
            return;
        }
        userRepository.findAll().stream()
            .filter(u -> u.getNotificationEmail() != null && !u.getNotificationEmail().isBlank())
            .forEach(user -> {
                List<AnomalyEntry> anomalies = detectAnomalies(user);
                if (!anomalies.isEmpty()) {
                    sendEmail(user, anomalies);
                }
            });
    }

    private void sendEmail(User user, List<AnomalyEntry> anomalies) {
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setTo(user.getNotificationEmail());
            msg.setSubject("SpendStack: " + anomalies.size() + " large transaction"
                + (anomalies.size() != 1 ? "s" : "") + " detected");
            StringBuilder body = new StringBuilder("Hi ").append(user.getDisplayName()).append(",\n\n")
                .append("The following large transactions were detected in the last 24 hours:\n\n");
            anomalies.forEach(a -> body.append("• ").append(a.description())
                .append(" — ₹").append(a.amount().toPlainString()).append("\n"));
            body.append("\nLog in to review: https://spends.homelab.local\n\n")
                .append("— SpendStack");
            msg.setText(body.toString());
            mailSender.send(msg);
            log.info("Sent anomaly digest to {}", user.getNotificationEmail());
        } catch (Exception e) {
            log.warn("Failed to send digest to {}: {}", user.getNotificationEmail(), e.getMessage());
        }
    }
}
