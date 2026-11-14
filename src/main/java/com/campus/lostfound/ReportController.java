package com.campus.lostfound;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/reports")
public class ReportController {
    private final ReportRepository repo;
    private final UserAccountRepository users;
    private final NotificationService notificationService;

    public ReportController(ReportRepository repo, UserAccountRepository users, NotificationService notificationService) { this.repo = repo; this.users = users; this.notificationService = notificationService; }

    @GetMapping
    public List<Report> all(HttpServletRequest request,
                            @RequestParam(required = false) String type,
                            @RequestParam(required = false) String q,
                            @RequestParam(required = false, defaultValue = "false") boolean mine) {
        requireLogin(request);
        String username = AuthController.currentUsername(request);
        UserAccount currentAcc = currentUser(request);
        String userCollege = currentAcc == null ? "CU" : currentAcc.getCollege();
        List<Report> results = repo.findAll().stream()
                .filter(x -> x.getCollege() == null || x.getCollege().equalsIgnoreCase(userCollege))
                .filter(x -> type == null || type.isBlank() || x.getType().equalsIgnoreCase(type))
                .filter(x -> q == null || q.isBlank() ||
                        ((x.getTitle() + " " + x.getCategory() + " " + x.getLocation() + " " + x.getDescription())
                                .toLowerCase().contains(q.toLowerCase())))
                .filter(x -> !mine || username.equalsIgnoreCase(x.getAccountUsername()))
                .sorted(Comparator.comparing(Report::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
        for (Report report : results) {
            String owner = report.getAccountUsername();
            if (owner != null && !owner.isBlank()) {
                users.findByUsernameKey(owner.toLowerCase(java.util.Locale.ROOT)).ifPresent(account -> {
                    report.setOwnerDisplayName(account.getDisplayName());
                    report.setOwnerCourse(account.getCourse());
                    report.setOwnerAvatarId(account.getAvatarId());
                    report.setOwnerProfileImageUrl(!AuthController.canUseCustomProfilePhoto(account) || account.getProfileImageData().isBlank() ? "" : "/api/users/" + org.springframework.web.util.UriUtils.encodePathSegment(account.getUsername(), java.nio.charset.StandardCharsets.UTF_8) + "/photo");
                    report.setOwnerRole(account.getRole());
                });
            } else {
                report.setOwnerDisplayName(report.getReporterName());
            }
        }
        return results;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Report create(@RequestBody Report r, HttpServletRequest request) {
        requireLogin(request);
        if (blank(r.getType()) || blank(r.getTitle()) || blank(r.getCategory()) ||
                blank(r.getLocation()) || blank(r.getReporterName())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fill all required fields.");
        }
        r.setType(r.getType().toUpperCase());
        if (!List.of("LOST", "FOUND").contains(r.getType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Type must be LOST or FOUND.");
        }
        r.setStatus("OPEN");
        r.setId(null);
        r.setAccountUsername(AuthController.currentUsername(request));
        UserAccount currentAcc = currentUser(request);
        r.setCollege(currentAcc == null ? "CU" : currentAcc.getCollege());
        Report saved = repo.save(r);
        users.findByUsernameKey(r.getAccountUsername().toLowerCase(java.util.Locale.ROOT))
                .ifPresent(actor -> notificationService.notifyReportCreated(saved, actor));
        return saved;
    }

    @PatchMapping("/{id}/status")
    public Report status(@PathVariable Long id, @RequestBody Map<String, String> body,
                         HttpServletRequest request) {
        requireLogin(request);
        Report r = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String currentUser = AuthController.currentUsername(request);
        if (currentUser == null || r.getAccountUsername() == null || !currentUser.equalsIgnoreCase(r.getAccountUsername())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can update only reports submitted by your account.");
        }
        String status = body.getOrDefault("status", "").toUpperCase();
        if (!List.of("OPEN", "MATCHED", "RETURNED").contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status");
        }
        r.setStatus(status);
        return repo.save(r);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, HttpServletRequest request) {
        requireLogin(request);
        Report r = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String username = AuthController.currentUsername(request);
        UserAccount user = currentUser(request);
        boolean isOwner = username != null && r.getAccountUsername() != null && username.equalsIgnoreCase(r.getAccountUsername());
        boolean isPrivileged = user != null && List.of("OWNER", "ADMIN").contains(user.getRole());
        if (!isOwner && !isPrivileged) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot delete this report.");
        }
        repo.delete(r);
        return ResponseEntity.noContent().build();
    }

    private void requireLogin(HttpServletRequest request) {
        if (!AuthController.isLoggedIn(request)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in to continue.");
        }
    }

    private UserAccount currentUser(HttpServletRequest request) {
        if (!AuthController.isLoggedIn(request)) return null;
        Object id = request.getSession(false).getAttribute(AuthController.SESSION_USER_ID);
        return id instanceof Long userId ? users.findById(userId).orElse(null) : null;
    }

    private boolean blank(String value) { return value == null || value.isBlank(); }
}
