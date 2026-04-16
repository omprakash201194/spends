package com.omprakashgautam.homelab.spends.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Injects a short request ID, HTTP method, and path into the SLF4J MDC for
 * every incoming request. These fields appear in every log line emitted during
 * the request, making it easy to trace a single API call end-to-end in Loki.
 *
 * Also adds an {@code X-Request-Id} response header so callers can correlate
 * client-side errors with backend log entries.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestCorrelationFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String requestId = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        MDC.put("requestId", requestId);
        MDC.put("method",    request.getMethod());
        MDC.put("path",      request.getRequestURI());
        response.setHeader("X-Request-Id", requestId);

        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.clear();
        }
    }
}
