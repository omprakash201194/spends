package com.omprakashgautam.homelab.spends.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-IP rate limiting on endpoints prone to abuse:
 *   /api/auth/login    — 10 attempts / minute (brute-force guard)
 *   /api/import/**     — 5 uploads / minute (DoS guard)
 *   /api/insights/**   — 5 calls / minute (Anthropic API cost guard)
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final Map<String, Bucket> loginBuckets   = new ConcurrentHashMap<>();
    private final Map<String, Bucket> importBuckets  = new ConcurrentHashMap<>();
    private final Map<String, Bucket> insightBuckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        String path = request.getRequestURI();
        String key  = resolveKey(request);

        Bucket bucket = null;
        if (path.equals("/api/auth/login")) {
            bucket = loginBuckets.computeIfAbsent(key, k -> newBucket(10, Duration.ofMinutes(1)));
        } else if (path.startsWith("/api/import/")) {
            bucket = importBuckets.computeIfAbsent(key, k -> newBucket(5, Duration.ofMinutes(1)));
        } else if (path.startsWith("/api/insights/")) {
            bucket = insightBuckets.computeIfAbsent(key, k -> newBucket(5, Duration.ofMinutes(1)));
        }

        if (bucket != null && !bucket.tryConsume(1)) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"message\":\"Too many requests — please try again later\",\"timestamp\":\"" + java.time.LocalDateTime.now() + "\"}");
            return;
        }

        chain.doFilter(request, response);
    }

    private static Bucket newBucket(int tokens, Duration window) {
        return Bucket.builder()
                .addLimit(Bandwidth.builder().capacity(tokens).refillGreedy(tokens, window).build())
                .build();
    }

    private static String resolveKey(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
