package com.omprakashgautam.homelab.spends.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extracts a human-readable merchant name from ICICI transaction remarks.
 *
 * ICICI UPI format examples:
 *   UPI/SWIGGY6543210987654/Swiggy Order/SWIBANK/0001234567890/
 *   UPI/ZOMATO12345/Zomato Order/HDFC/001234/
 *   UPI/9876543210@ybl/Payment/YESBANK/000123/
 *   UPI/user@okicici/Transfer/ICICI/000123/
 *   NEFT/HDFC0001234/Salary Credit
 *   POS/AMAZON/Online purchase
 *   ECS/NACH/LIC Premium
 */
@Component
@RequiredArgsConstructor
public class MerchantExtractor {

    private final MerchantAliasService merchantAliasService;

    // UPI/<handle>/<description>/<bank>/<ref>
    private static final Pattern UPI_PATTERN =
            Pattern.compile("UPI/([^/]+)/([^/]*)", Pattern.CASE_INSENSITIVE);

    // Mobile number as UPI handle — not useful as merchant name
    private static final Pattern PHONE_PATTERN =
            Pattern.compile("^\\d{10}(@\\S+)?$");

    /**
     * Extracts merchant name, checking user-defined aliases first.
     * If the raw remarks contain any aliased pattern, the alias display name is returned.
     * Falls back to heuristic extraction.
     */
    public String extract(String rawRemarks, UUID userId) {
        if (rawRemarks == null || rawRemarks.isBlank()) return null;
        Map<String, String> aliases = merchantAliasService.getAliasMap(userId);
        for (Map.Entry<String, String> entry : aliases.entrySet()) {
            if (rawRemarks.contains(entry.getKey())) {
                return entry.getValue();
            }
        }
        return extract(rawRemarks);
    }

    public String extract(String rawRemarks) {
        if (rawRemarks == null || rawRemarks.isBlank()) return null;

        String trimmed = rawRemarks.trim();

        // Try UPI format
        Matcher upiMatcher = UPI_PATTERN.matcher(trimmed);
        if (upiMatcher.find()) {
            String handle = upiMatcher.group(1).trim();
            String description = upiMatcher.group(2).trim();

            // Prefer the description field if it's not a generic term
            if (!description.isBlank() && !isGenericDescription(description)) {
                return toTitleCase(cleanMerchantName(description));
            }

            // Fall back to the handle (strip the @bank part)
            String merchantFromHandle = extractFromHandle(handle);
            if (merchantFromHandle != null) {
                return toTitleCase(merchantFromHandle);
            }
        }

        // NEFT/RTGS/IMPS — use the second segment
        if (trimmed.toUpperCase().startsWith("NEFT/") ||
                trimmed.toUpperCase().startsWith("RTGS/") ||
                trimmed.toUpperCase().startsWith("IMPS/")) {
            String[] parts = trimmed.split("/");
            if (parts.length >= 3) {
                return toTitleCase(cleanMerchantName(parts[2]));
            }
        }

        // POS transactions
        if (trimmed.toUpperCase().startsWith("POS/")) {
            String[] parts = trimmed.split("/");
            if (parts.length >= 2) {
                return toTitleCase(cleanMerchantName(parts[1]));
            }
        }

        // Return first 50 chars of raw remarks as fallback
        return trimmed.length() > 50 ? trimmed.substring(0, 50) : trimmed;
    }

    /**
     * Extracts a readable name from a UPI handle like:
     *   SWIGGY6543210987654  → Swiggy
     *   9876543210@ybl       → null (phone number, not useful)
     *   zomato@icici         → Zomato
     */
    private String extractFromHandle(String handle) {
        // Strip @bank suffix
        String base = handle.contains("@") ? handle.split("@")[0] : handle;

        // Skip plain phone numbers
        if (PHONE_PATTERN.matcher(base).matches()) return null;

        // Strip trailing digits (e.g. SWIGGY6543210987654 → SWIGGY)
        String withoutTrailingDigits = base.replaceAll("\\d+$", "");
        if (withoutTrailingDigits.length() >= 3) {
            return withoutTrailingDigits;
        }

        return base.length() >= 3 ? base : null;
    }

    private boolean isGenericDescription(String description) {
        String lower = description.toLowerCase();
        return lower.equals("payment") ||
                lower.equals("transfer") ||
                lower.equals("upi payment") ||
                lower.equals("online payment") ||
                lower.equals("upi transfer") ||
                lower.equals("paid") ||
                lower.startsWith("ref no") ||
                lower.matches("\\d+");
    }

    private String cleanMerchantName(String name) {
        // Remove common suffixes like Ltd, Pvt Ltd, Inc
        return name.trim()
                .replaceAll("(?i)\\bLtd\\.?$", "")
                .replaceAll("(?i)\\bPvt\\.?$", "")
                .replaceAll("(?i)\\bInc\\.?$", "")
                .replaceAll("[_\\-]+", " ")
                .trim();
    }

    private String toTitleCase(String input) {
        if (input == null || input.isBlank()) return input;
        String[] words = input.toLowerCase().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String word : words) {
            if (!word.isEmpty()) {
                if (!sb.isEmpty()) sb.append(' ');
                sb.append(Character.toUpperCase(word.charAt(0)));
                sb.append(word.substring(1));
            }
        }
        return sb.toString();
    }
}
