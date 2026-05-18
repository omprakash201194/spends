package com.omprakashgautam.homelab.spends.security;

import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@RequiredArgsConstructor
@Slf4j
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final UserRepository userRepository;
    private final JwtTokenProvider jwtTokenProvider;

    @Value("${app.oauth2.frontend-redirect-url}")
    private String frontendRedirectUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        OAuth2User oauth2User = (OAuth2User) authentication.getPrincipal();
        String email = oauth2User.getAttribute("email");

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalStateException("User not found after OAuth2 login: " + email));

        String token = jwtTokenProvider.generateTokenForUser(user);
        log.info("OAuth2 login successful for user: {}", user.getUsername());

        getRedirectStrategy().sendRedirect(request, response, frontendRedirectUrl + "?token=" + token);
    }
}
