package com.campus.lostfound;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.security.SecureRandom;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final Logger log = LoggerFactory.getLogger(AuthController.class);
    private static final ZoneId APP_ZONE = ZoneId.of("Asia/Kolkata");
    private static final int USERNAME_USES_PER_YEAR = 2;
    private static final DateTimeFormatter POLICY_DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;
    public static final String SESSION_USER_ID = "campusfind.userId";
    public static final String SESSION_USERNAME = "campusfind.username";
    public static final String SESSION_DISPLAY_NAME = "campusfind.displayName";

    private final UserAccountRepository users;
    private final PasswordHasher passwordHasher;
    private final ReportRepository reports;
    private final CommunityMessageRepository communityMessages;
    private final PasswordResetTokenRepository resetTokens;
    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${spring.mail.username:}")
    private String mailFrom;
    @Value("${campusfind.mail.sender-name:CampUs | Lost & Found}")
    private String mailSenderName;
    @Value("${campusfind.mail.from:${spring.mail.username:}}")
    private String mailFromAddress;
    @Value("${campusfind.reset-otp-minutes:10}")
    private long resetOtpMinutes;

    @Value("${campusfind.owner-username:}")
    private String configuredOwnerUsername;

    public AuthController(UserAccountRepository users, PasswordHasher passwordHasher, ReportRepository reports, CommunityMessageRepository communityMessages, PasswordResetTokenRepository resetTokens, ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.users = users;
        this.passwordHasher = passwordHasher;
        this.reports = reports;
        this.communityMessages = communityMessages;
        this.resetTokens = resetTokens;
        this.mailSenderProvider = mailSenderProvider;
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody Credentials credentials,
                                                        HttpServletRequest request) {
        String submittedUsername = credentials == null || credentials.username() == null
                ? "" : credentials.username().trim().toLowerCase(Locale.ROOT);
        String password = credentials == null ? null : credentials.password();
        String email = credentials == null || credentials.email() == null ? "" : credentials.email().trim().toLowerCase(Locale.ROOT);
        String displayName = credentials == null || credentials.displayName() == null ? "" : credentials.displayName().trim();
        String course = credentials == null || credentials.course() == null ? "" : credentials.course().trim();
        String college = credentials == null || credentials.college() == null ? "CU" : credentials.college().trim().toUpperCase(Locale.ROOT);
        if (!List.of("CGC_UNIV", "CU", "CGC_LANDRAN", "LPU").contains(college)) {
            college = "CU";
        }
        if (email.isEmpty()) return error(HttpStatus.BAD_REQUEST, "Please enter your email address.");
        if (email.length() > 254 || !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            return error(HttpStatus.BAD_REQUEST, "Please enter a valid email address.");
        }
        if (users.existsByEmailKey(email)) {
            return error(HttpStatus.CONFLICT, "An account with this email already exists. Please log in.");
        }
        if (displayName.isEmpty()) return error(HttpStatus.BAD_REQUEST, "Please enter your full name.");
        if (displayName.length() > 100) return error(HttpStatus.BAD_REQUEST, "Full name must be 100 characters or fewer.");
        if (course.isEmpty()) return error(HttpStatus.BAD_REQUEST, "Please enter your course.");
        if (course.length() > 100) return error(HttpStatus.BAD_REQUEST, "Course must be 100 characters or fewer.");
        if (submittedUsername.isEmpty()) {
            return error(HttpStatus.BAD_REQUEST, "Please enter a username.");
        }
        if (submittedUsername.length() > 50) {
            return error(HttpStatus.BAD_REQUEST, "Username must be 50 characters or fewer.");
        }
        // No strength/complexity rules: any non-empty password is accepted.
        if (password == null || password.isEmpty()) {
            return error(HttpStatus.BAD_REQUEST, "Please enter a password.");
        }

        String usernameKey = submittedUsername;
        if (users.existsByUsernameKey(usernameKey)) {
            return error(HttpStatus.CONFLICT,
                    "The username " + submittedUsername + " is taken. Please try another.");
        }

        UserAccount account = new UserAccount();
        LocalDateTime registeredAt = appNow();
        account.setCreatedAt(registeredAt);
        account.setUsernameChangeWindowStart(registeredAt);
        // The first username selected at signup counts as use #1, per the account policy.
        account.setUsernameChangesUsed(1);
        account.setUsername(submittedUsername);
        account.setUsernameKey(usernameKey);
        account.setEmail(email);
        account.setEmailKey(email);
        account.setPasswordHash(passwordHasher.hash(password));
        account.setDisplayName(displayName);
        account.setCourse(course);
        account.setCollege(college);
        account.setPhone("");
        applyConfiguredOwner(account);
        try {
            account = users.saveAndFlush(account);
        } catch (DataIntegrityViolationException duplicate) {
            return error(HttpStatus.CONFLICT,
                    "The username " + submittedUsername + " is taken. Please try another.");
        }
        startSession(request, account);
        Map<String, Object> registered = userPayload(account);
        registered.put("message", "Account created successfully.");
        return ResponseEntity.status(HttpStatus.CREATED).body(registered);
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Credentials credentials,
                                                     HttpServletRequest request) {
        String username = credentials == null || credentials.username() == null
                ? "" : credentials.username().trim().toLowerCase(Locale.ROOT);
        String password = credentials == null ? null : credentials.password();
        if (username.isEmpty() || password == null || password.isEmpty()) {
            return error(HttpStatus.BAD_REQUEST, "Enter your username and password.");
        }
        UserAccount account = users.findByUsernameKey(username)
                .or(() -> users.findByEmailKey(username))
                .orElse(null);
        if (account == null || !passwordHasher.matches(password, account.getPasswordHash())) {
            return error(HttpStatus.UNAUTHORIZED, "Incorrect username or password. Please try again.");
        }
        normalizeStoredUsername(account);
        boolean ownerBootstrapped = applyConfiguredOwner(account);
        if (refreshUsernameChangeWindow(account, appNow()) || ownerBootstrapped) users.saveAndFlush(account);
        startSession(request, account);
        return ResponseEntity.ok(userPayload(account));
    }


    public record ForgotPasswordRequest(String email) {}
    public record ResetPasswordRequest(String email, String otp, String newPassword) {}

    @PostMapping("/forgot-password")
    @Transactional
    public ResponseEntity<Map<String, Object>> forgotPassword(@RequestBody ForgotPasswordRequest body) {
        String email = body == null || body.email() == null ? "" : body.email().trim().toLowerCase(Locale.ROOT);
        if (email.isEmpty() || email.length() > 254 || !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            return error(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
        }
        // Do not reveal whether an email is registered.
        UserAccount account = users.findByEmailKey(email).orElse(null);
        if (account == null) return ResponseEntity.ok(Map.of("message", "If the email belongs to an account, an OTP has been sent."));
        String otp = String.format(Locale.ROOT, "%06d", secureRandom.nextInt(1_000_000));
        PasswordResetToken token = resetTokens.findByEmailKey(email).orElseGet(PasswordResetToken::new);
        token.setEmailKey(email);
        token.setOtpHash(passwordHasher.hash(otp));
        token.setCreatedAt(appNow());
        token.setExpiresAt(appNow().plusMinutes(Math.max(5, Math.min(resetOtpMinutes, 20))));
        token.setAttempts(0);
        resetTokens.saveAndFlush(token);

        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        String effectiveFrom = (mailFromAddress != null && !mailFromAddress.isBlank()) ? mailFromAddress.trim() : (mailFrom != null ? mailFrom.trim() : "");
        if (sender != null && !effectiveFrom.isBlank()) {
            try {
                MimeMessage mimeMessage = sender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
                String displayName = (mailSenderName != null && !mailSenderName.isBlank()) ? mailSenderName.trim() : "CampUs | Lost & Found";
                helper.setFrom(new InternetAddress(effectiveFrom, displayName, "UTF-8"));
                helper.setTo(email);
                helper.setSubject("Your CampUs Password Reset Code: " + otp);

                int expireMinutes = (int) Math.max(5, Math.min(resetOtpMinutes, 20));
                String html = """
                    <!DOCTYPE html>
                    <html>
                    <head><meta charset="utf-8"></head>
                    <body style="margin: 0; padding: 24px 12px; background-color: #FFF8EF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #F1D7C2; overflow: hidden; box-shadow: 0 8px 30px rgba(88,56,28,0.08);">
                        <div style="background: linear-gradient(135deg, #E8944B 0%%, #D0813B 100%%); padding: 32px 24px; text-align: center; color: #ffffff;">
                          <h1 style="margin: 0; font-size: 30px; font-weight: 900; letter-spacing: -0.5px;">Camp<span style="color: #FFE6D0;">Us</span></h1>
                          <p style="margin: 6px 0 0; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; opacity: 0.92;">Campus Lost &amp; Found Hub</p>
                        </div>
                        <div style="padding: 32px 24px; text-align: center;">
                          <h2 style="margin: 0 0 12px; color: #2D2319; font-size: 20px; font-weight: 800;">Reset Your Password</h2>
                          <p style="margin: 0 0 24px; color: #6D5E52; font-size: 14px; line-height: 1.6;">
                            We received a request to reset the password for your CampUs account. Use this verification code below:
                          </p>
                          <div style="display: inline-block; padding: 16px 36px; background: #FFF4E5; border: 2px dashed #E8944B; border-radius: 14px; margin-bottom: 24px;">
                            <span style="font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #D0813B; font-family: monospace;">%s</span>
                          </div>
                          <p style="margin: 0 0 8px; color: #8C786A; font-size: 13px;">
                            ⏱️ This code expires in <strong>%d minutes</strong>.
                          </p>
                          <p style="margin: 20px 0 0; padding-top: 20px; border-top: 1px solid #F6ECE4; color: #A8998C; font-size: 12px; line-height: 1.5;">
                            If you didn't request a password reset, you can safely ignore this email. Your account remains secure.
                          </p>
                        </div>
                      </div>
                    </body>
                    </html>
                """.formatted(otp, expireMinutes);

                helper.setText(html, true);
                sender.send(mimeMessage);
                return ResponseEntity.ok(Map.of("message", "An OTP code has been sent from CampUs to your email inbox."));
            } catch (Exception ex) {
                log.warn("Could not send email via SMTP to {}: {}", email, ex.getMessage());
                return ResponseEntity.ok(Map.of(
                        "message", "SMTP delivery issue: " + ex.getMessage() + ". Your OTP code is: " + otp,
                        "devOtp", otp
                ));
            }
        }

        return ResponseEntity.ok(Map.of(
                "message", "Email SMTP not configured yet. Your verification OTP is: " + otp,
                "devOtp", otp
        ));
    }

    @PostMapping("/reset-password")
    @Transactional
    public ResponseEntity<Map<String, Object>> resetPassword(@RequestBody ResetPasswordRequest body) {
        String email = body == null || body.email() == null ? "" : body.email().trim().toLowerCase(Locale.ROOT);
        String otp = body == null || body.otp() == null ? "" : body.otp().trim();
        String newPassword = body == null ? null : body.newPassword();
        if (newPassword == null || newPassword.length() < 8 || newPassword.length() > 200) {
            return error(HttpStatus.BAD_REQUEST, "New password must be between 8 and 200 characters.");
        }
        PasswordResetToken token = resetTokens.findByEmailKey(email).orElse(null);
        if (token == null || token.getExpiresAt().isBefore(appNow()) || token.getAttempts() >= 5) {
            if (token != null) resetTokens.delete(token);
            return error(HttpStatus.BAD_REQUEST, "OTP is invalid or expired. Request a new OTP.");
        }
        if (!otp.matches("\\d{6}") || !passwordHasher.matches(otp, token.getOtpHash())) {
            token.setAttempts(token.getAttempts() + 1);
            resetTokens.save(token);
            return error(HttpStatus.BAD_REQUEST, "OTP is invalid or expired. Request a new OTP.");
        }
        UserAccount account = users.findByEmailKey(email).orElse(null);
        if (account == null) {
            resetTokens.delete(token);
            return error(HttpStatus.BAD_REQUEST, "OTP is invalid or expired. Request a new OTP.");
        }
        account.setPasswordHash(passwordHasher.hash(newPassword));
        users.saveAndFlush(account);
        resetTokens.delete(token);
        return ResponseEntity.ok(Map.of("message", "Password reset successfully. You can now log in."));
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute(SESSION_USER_ID) == null) {
            return ResponseEntity.ok(Map.of("authenticated", false));
        }
        Object username = session.getAttribute(SESSION_USERNAME);
        Object displayName = session.getAttribute(SESSION_DISPLAY_NAME);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("authenticated", true);
        body.put("username", String.valueOf(username));
        body.put("displayName", displayName == null ? String.valueOf(username) : String.valueOf(displayName));
        body.put("phone", "");
        body.put("course", "");
        body.put("college", "CU");
        body.put("collegeName", "CU (Chandigarh University)");
        body.put("avatarId", "");
        body.put("profileImageData", "");
        body.put("bannerImageData", "");
        body.put("role", "MEMBER");
        Object userId = session.getAttribute(SESSION_USER_ID);
        if (userId instanceof Long id) {
            users.findById(id).ifPresent(account -> {
                body.put("displayName", account.getDisplayName());
                body.put("email", account.getEmail());
                body.put("phone", account.getPhone());
                body.put("course", account.getCourse());
                body.put("college", account.getCollege());
                body.put("collegeName", collegeDisplayName(account.getCollege()));
                body.put("avatarId", account.getAvatarId());
                boolean ownerBootstrapped = applyConfiguredOwner(account);
                body.put("profileImageData", canUseCustomProfilePhoto(account) ? account.getProfileImageData() : "");
                body.put("bannerImageData", canUseProfileBanner(account) ? account.getBannerImageData() : "");
                body.put("role", account.getRole());
                if (refreshUsernameChangeWindow(account, appNow()) || ownerBootstrapped) users.saveAndFlush(account);
                addUsernamePolicyPayload(body, account);
            });
        }
        return ResponseEntity.ok(body);
    }

    @PostMapping("/profile")
    @Transactional
    public ResponseEntity<Map<String, Object>> updateProfile(@RequestBody Profile profile,
                                                             HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null || !(session.getAttribute(SESSION_USER_ID) instanceof Long userId)) {
            return error(HttpStatus.UNAUTHORIZED, "Please log in to update your profile.");
        }
        UserAccount account = users.findByIdForUpdate(userId).orElse(null);
        if (account == null) return error(HttpStatus.UNAUTHORIZED, "Please log in again.");
        if (refreshUsernameChangeWindow(account, appNow())) account = users.saveAndFlush(account);

        String displayName = profile == null || profile.displayName() == null ? "" : profile.displayName().trim();
        String submittedUsername = profile == null || profile.username() == null ? "" : profile.username().trim().toLowerCase(Locale.ROOT);
        String phone = profile == null || profile.phone() == null ? "" : profile.phone().trim();
        String course = profile == null || profile.course() == null ? "" : profile.course().trim();
        String avatarId = profile == null || profile.avatarId() == null ? "" : profile.avatarId().trim();
        String profileImageData = profile == null ? null : profile.profileImageData();
        String bannerImageData = profile == null ? null : profile.bannerImageData();
        if (displayName.isEmpty()) return error(HttpStatus.BAD_REQUEST, "Please enter your full name.");
        if (displayName.length() > 100) return error(HttpStatus.BAD_REQUEST, "Full name must be 100 characters or fewer.");
        if (course.isEmpty()) return error(HttpStatus.BAD_REQUEST, "Please enter your course.");
        if (course.length() > 100) return error(HttpStatus.BAD_REQUEST, "Course must be 100 characters or fewer.");
        if (submittedUsername.isEmpty()) return error(HttpStatus.BAD_REQUEST, "Please enter a username.");
        if (submittedUsername.length() > 50) return error(HttpStatus.BAD_REQUEST, "Username must be 50 characters or fewer.");
        if (phone.length() > 30) return error(HttpStatus.BAD_REQUEST, "Mobile number must be 30 characters or fewer.");
        if (!avatarId.isEmpty() && !avatarId.matches("avatar-(0[1-9]|[12][0-9]|30)")) {
            return error(HttpStatus.BAD_REQUEST, "Choose one of the available avatars.");
        }

        boolean photoPrivileged = canUseCustomProfilePhoto(account);
        boolean bannerPrivileged = canUseProfileBanner(account);
        if (!photoPrivileged && profileImageData != null && !profileImageData.isBlank()) {
            return error(HttpStatus.FORBIDDEN, "Custom profile photos are available to Owner, Admin, and Leader accounts. Choose one of the limited avatars instead.");
        }
        if (!bannerPrivileged && bannerImageData != null && !bannerImageData.isBlank()) {
            return error(HttpStatus.FORBIDDEN, "Profile banners are not available to normal Member accounts.");
        }
        if (photoPrivileged && profileImageData != null && !profileImageData.isBlank()) {
            String problem = validateImageData(profileImageData, 450_000, "Profile photo");
            if (problem != null) return error(HttpStatus.BAD_REQUEST, problem);
        }
        if (bannerPrivileged && bannerImageData != null && !bannerImageData.isBlank()) {
            String problem = validateImageData(bannerImageData, 1_050_000, "Profile banner");
            if (problem != null) return error(HttpStatus.BAD_REQUEST, problem);
        }

        String newKey = submittedUsername;
        UserAccount existing = users.findByUsernameKey(newKey).orElse(null);
        if (existing != null && !existing.getId().equals(account.getId())) {
            return error(HttpStatus.CONFLICT, "The username " + submittedUsername + " is taken. Please try another.");
        }

        String previousUsername = account.getUsername();
        boolean usernameChanging = previousUsername == null || !previousUsername.equalsIgnoreCase(submittedUsername);
        if (usernameChanging && !hasUnlimitedUsernameChanges(account) && account.getUsernameChangesUsed() != null
                && account.getUsernameChangesUsed() >= USERNAME_USES_PER_YEAR) {
            LocalDateTime nextWindow = account.getUsernameChangeWindowStart().plusYears(1);
            return error(HttpStatus.TOO_MANY_REQUESTS, "You have used both username changes for this 12-month period. You can change your username again on "
                    + POLICY_DATE_FORMAT.format(nextWindow.toLocalDate()) + ". To save other profile details now, keep your current username.");
        }
        if (usernameChanging && !hasUnlimitedUsernameChanges(account)) {
            account.setUsernameChangesUsed((account.getUsernameChangesUsed() == null ? 1 : account.getUsernameChangesUsed()) + 1);
        }

        account.setUsername(submittedUsername);
        account.setUsernameKey(newKey);
        account.setDisplayName(displayName);
        account.setCourse(course);
        account.setPhone(phone);
        account.setAvatarId(avatarId.isEmpty() ? null : avatarId);
        if (photoPrivileged && profileImageData != null) account.setProfileImageData(profileImageData.isBlank() ? null : profileImageData);
        if (bannerPrivileged && bannerImageData != null) account.setBannerImageData(bannerImageData.isBlank() ? null : bannerImageData);
        account = users.saveAndFlush(account);

        if (!previousUsername.equals(submittedUsername)) {
            final String oldName = previousUsername;
            final String newName = submittedUsername;
            List<Report> ownedReports = reports.findAll().stream()
                    .filter(report -> report.getAccountUsername() != null && report.getAccountUsername().equalsIgnoreCase(oldName))
                    .toList();
            ownedReports.forEach(report -> report.setAccountUsername(newName));
            reports.saveAll(ownedReports);
            List<CommunityMessage> ownedMessages = communityMessages.findAll().stream()
                    .filter(message -> message.getUsername() != null && message.getUsername().equalsIgnoreCase(oldName))
                    .toList();
            final String newDisplayName = account.getDisplayName();
            ownedMessages.forEach(message -> { message.setUsername(newName); message.setDisplayName(newDisplayName); });
            communityMessages.saveAll(ownedMessages);
        }
        session.setAttribute(SESSION_USERNAME, account.getUsername());
        session.setAttribute(SESSION_DISPLAY_NAME, account.getDisplayName());
        return ResponseEntity.ok(userPayload(account));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
        return ResponseEntity.ok(Map.of("authenticated", false, "message", "You have been logged out."));
    }

    static boolean isLoggedIn(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        return session != null && session.getAttribute(SESSION_USER_ID) != null;
    }

    static String currentUsername(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        Object username = session == null ? null : session.getAttribute(SESSION_USERNAME);
        return username == null ? null : username.toString();
    }

    private void normalizeStoredUsername(UserAccount account) {
        String previousUsername = account.getUsername();
        String normalizedUsername = previousUsername == null ? "" : previousUsername.toLowerCase(Locale.ROOT);
        if (normalizedUsername.equals(previousUsername)) return;

        account.setUsername(normalizedUsername);
        account.setUsernameKey(normalizedUsername);
        users.saveAndFlush(account);

        List<Report> ownedReports = reports.findAll().stream()
                .filter(report -> report.getAccountUsername() != null
                        && report.getAccountUsername().equalsIgnoreCase(previousUsername))
                .toList();
        ownedReports.forEach(report -> report.setAccountUsername(normalizedUsername));
        reports.saveAll(ownedReports);

        List<CommunityMessage> ownedMessages = communityMessages.findAll().stream()
                .filter(message -> message.getUsername() != null
                        && message.getUsername().equalsIgnoreCase(previousUsername))
                .toList();
        String displayName = account.getDisplayName();
        ownedMessages.forEach(message -> {
            message.setUsername(normalizedUsername);
            message.setDisplayName(displayName);
        });
        communityMessages.saveAll(ownedMessages);
    }

    private void startSession(HttpServletRequest request, UserAccount account) {
        HttpSession oldSession = request.getSession(false);
        if (oldSession != null) oldSession.invalidate();
        HttpSession session = request.getSession(true);
        session.setAttribute(SESSION_USER_ID, account.getId());
        session.setAttribute(SESSION_USERNAME, account.getUsername());
        session.setAttribute(SESSION_DISPLAY_NAME, account.getDisplayName());
    }

    private Map<String, Object> userPayload(UserAccount account) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("authenticated", true);
        body.put("username", account.getUsername());
        body.put("email", account.getEmail());
        body.put("displayName", account.getDisplayName());
        body.put("course", account.getCourse());
        body.put("college", account.getCollege());
        body.put("collegeName", collegeDisplayName(account.getCollege()));
        body.put("phone", account.getPhone());
        body.put("avatarId", account.getAvatarId());
        body.put("profileImageData", canUseCustomProfilePhoto(account) ? account.getProfileImageData() : "");
        body.put("bannerImageData", canUseProfileBanner(account) ? account.getBannerImageData() : "");
        body.put("role", account.getRole());
        addUsernamePolicyPayload(body, account);
        return body;
    }

    /** Initialize legacy accounts, then roll the annual window forward on each anniversary. */
    private boolean refreshUsernameChangeWindow(UserAccount account, LocalDateTime now) {
        boolean changed = false;
        LocalDateTime start = account.getUsernameChangeWindowStart();
        Integer used = account.getUsernameChangesUsed();
        if (start == null) {
            start = account.getCreatedAt() == null ? now : account.getCreatedAt();
            changed = true;
        }
        if (used == null) {
            // For older accounts, the username chosen at signup is counted as their first use.
            used = 1;
            changed = true;
        }
        while (!now.isBefore(start.plusYears(1))) {
            start = start.plusYears(1);
            used = 0;
            changed = true;
        }
        if (!start.equals(account.getUsernameChangeWindowStart())) {
            account.setUsernameChangeWindowStart(start);
            changed = true;
        }
        if (!used.equals(account.getUsernameChangesUsed())) {
            account.setUsernameChangesUsed(used);
            changed = true;
        }
        return changed;
    }

    private void addUsernamePolicyPayload(Map<String, Object> body, UserAccount account) {
        LocalDateTime start = account.getUsernameChangeWindowStart();
        int used = account.getUsernameChangesUsed() == null ? 1 : account.getUsernameChangesUsed();
        boolean unlimited = hasUnlimitedUsernameChanges(account);
        int remaining = unlimited ? -1 : Math.max(0, USERNAME_USES_PER_YEAR - used);
        LocalDateTime resetAt = (start == null ? appNow() : start).plusYears(1);
        body.put("usernameChangesUsed", used);
        body.put("usernameChangesRemaining", remaining);
        body.put("usernameUnlimited", unlimited);
        body.put("usernameChangeWindowResetsAt", unlimited ? "" : POLICY_DATE_FORMAT.format(resetAt.toLocalDate()));
    }

    static boolean hasUnlimitedUsernameChanges(UserAccount account) {
        return account != null && ("OWNER".equals(account.getRole()) || "ADMIN".equals(account.getRole()));
    }

    static boolean canUseCustomProfilePhoto(UserAccount account) {
        return account != null && List.of("OWNER", "ADMIN", "LEADER").contains(account.getRole());
    }

    static boolean canUseProfileBanner(UserAccount account) {
        return account != null && List.of("OWNER", "ADMIN", "LEADER", "MODERATOR").contains(account.getRole());
    }

    static boolean canManageMembers(UserAccount account) {
        return account != null && List.of("OWNER", "ADMIN").contains(account.getRole());
    }

    private boolean applyConfiguredOwner(UserAccount account) {
        String configured = configuredOwnerUsername == null ? "" : configuredOwnerUsername.trim().toLowerCase(Locale.ROOT);
        if (configured.isBlank() || account == null || !configured.equalsIgnoreCase(account.getUsername())) return false;
        boolean anotherOwnerExists = users.findAll().stream().anyMatch(u -> "OWNER".equals(u.getRole()) && !java.util.Objects.equals(u.getId(), account.getId()));
        if (anotherOwnerExists || "OWNER".equals(account.getRole())) return false;
        account.setRole("OWNER");
        return true;
    }

    private String validateImageData(String data, int maxChars, String label) {
        if (data.length() > maxChars) return label + " is too large after compression. Choose a smaller image.";
        if (!data.matches("^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$")) return label + " must be a valid JPG, PNG, or WEBP image.";
        return null;
    }

    private LocalDateTime appNow() {
        return LocalDateTime.now(APP_ZONE);
    }

    private ResponseEntity<Map<String, Object>> error(HttpStatus status, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", message);
        body.put("authenticated", false);
        return ResponseEntity.status(status).body(body);
    }

    public static String collegeDisplayName(String code) {
        if (code == null) return "CU (Chandigarh University)";
        return switch (code.toUpperCase(Locale.ROOT)) {
            case "CGC_UNIV" -> "CGC University";
            case "CGC_LANDRAN" -> "CGC Landran";
            case "LPU" -> "LPU (Lovely Professional University)";
            default -> "CU (Chandigarh University)";
        };
    }

    public record Credentials(String username, String password, String displayName, String course, String email, String college) {}
    public record Profile(String displayName, String username, String phone, String course, String avatarId, String profileImageData, String bannerImageData) {}
}
