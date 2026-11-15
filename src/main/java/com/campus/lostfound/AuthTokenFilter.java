package com.campus.lostfound;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(1)
public class AuthTokenFilter extends OncePerRequestFilter {

    private final UserAccountRepository users;

    public AuthTokenFilter(UserAccountRepository users) {
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute(AuthController.SESSION_USER_ID) == null) {
            String token = request.getHeader("X-Auth-Token");
            if (token == null || token.isBlank()) {
                String auth = request.getHeader("Authorization");
                if (auth != null && auth.startsWith("Bearer ")) {
                    token = auth.substring(7).trim();
                }
            }
            if (token != null && !token.isBlank()) {
                String cleanToken = token.trim();
                users.findByAuthToken(cleanToken).ifPresent(account -> {
                    HttpSession newSession = request.getSession(true);
                    newSession.setAttribute(AuthController.SESSION_USER_ID, account.getId());
                    newSession.setAttribute(AuthController.SESSION_USERNAME, account.getUsername());
                    newSession.setAttribute(AuthController.SESSION_DISPLAY_NAME, account.getDisplayName());
                });
            }
        }
        filterChain.doFilter(request, response);
    }
}
